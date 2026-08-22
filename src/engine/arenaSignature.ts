import { SignatureRule, Tribute } from '../models/types';
import { RNG } from '../utils/rng';
import { SimContext, getAlive } from './context';
import { applyDamage, checkDeath } from './combat';
import { getZone, severEdge, edgeKey, depleteZone, depletionOf } from './map';
import { addZoneThreat, noteSighting } from './memory';
import { startZoneEffect, hasEffect, severRandomEdge } from './zoneEffects';
import { injure, openWound } from './wounds';
import { clampTribute } from './vitals';
import { rosterFor, engageMutt } from './mutts';
import { BLEEDING, ESCALATION, MEMORY, PROC_SIGNATURE, SIGNATURE_RULES } from '../data/balance';

/**
 * Arena signature mechanics.
 *
 * Every hand-authored arena carried a promise in its own description that the
 * simulation never kept. The Clockwork Island advertised "sectors, each
 * unleashing a different horror at a specific hour" — there was no clock. The
 * Vault said "the lights go out on a schedule nobody explains" — the lights
 * never went out. The Tempest Reach said "the tide takes a different zone every
 * night" — the tide never moved. Arena choice therefore changed zone names,
 * a handful of event strings and three mutt names, and nothing else: two runs
 * in different arenas read as the same run with the nouns swapped.
 *
 * One bespoke rule per arena, run once per cycle from `processDayNight`. Each
 * is seeded from `(seed, arena, cycle)` so it replays exactly, and each is
 * expressed through machinery that already exists — zone effects, severed
 * edges, exposure, the damage pipeline — rather than adding a subsystem.
 */

/** Zones a signature can touch: alive, not already out of bounds. */
function activeZones(ctx: SimContext): string[] {
    const collapsed = ctx.state.collapsedZones ?? [];
    return ctx.state.arena.zones.map(z => z.name).filter(n => !collapsed.includes(n));
}

function tributesIn(ctx: SimContext, zone: string): Tribute[] {
    return getAlive(ctx.state).filter(t => t.zone === zone);
}

/**
 * The Clockwork Island's clock.
 *
 * The arena is a twelve-hour dial and one sector goes off per cycle, in strict
 * rotation, telegraphed one cycle ahead. The rotation is the point: a tribute
 * who has been paying attention can work out where not to be, which is exactly
 * the pressure the description promised.
 */
function clockworkSignature(ctx: SimContext, cycle: number, rng: RNG) {
    const zones = activeZones(ctx);
    if (zones.length === 0) return;
    // Rotation over the printed zone order, so it is learnable rather than random.
    const all = ctx.state.arena.zones.map(z => z.name);
    const striking = all[cycle % all.length];
    const next = all[(cycle + 1) % all.length];

    if (!zones.includes(striking)) return;

    const horrors = [
        { name: 'a wall of acid fog', damage: 22, effect: 'contaminated' as const, poison: true },
        { name: 'a lightning barrage', damage: 30, effect: undefined, poison: false },
        { name: 'a tide of blood rain', damage: 14, effect: 'fogbound' as const, poison: false },
        { name: 'the tick-tock monkeys', damage: 26, effect: undefined, poison: false },
    ];
    const horror = horrors[cycle % horrors.length];

    const caught = tributesIn(ctx, striking);
    ctx.logEvent(
        `THE CLOCK: the hour turns and ${striking} is the sector that pays for it — ${horror.name}. ${next} is next.`,
        [],
        { important: true, zone: striking, category: 'arena' }
    );
    caught.forEach(t => {
        // Anyone who read the dial and moved early is simply not here; anyone
        // standing in it rolls to get clear at the last second.
        if (rng.chance(0.25 + t.attributes.agility * 0.04)) {
            ctx.logEvent(`${t.name} is already moving when ${striking} goes off, and clears it.`, [t.id], { zone: striking, category: 'arena' });
            return;
        }
        applyDamage(ctx, t, horror.damage, { cause: `Caught by the clock in ${striking}`, kind: 'arena' });
        if (horror.poison) injure(t, 'poisoned');
        addZoneThreat(ctx.state, t, striking, MEMORY.hazardThreat * 2);
        clampTribute(t);
        checkDeath(ctx, t, `Caught by the clock in ${striking}`);
    });
    if (horror.effect) startZoneEffect(ctx, striking, horror.effect, false);
    // Everyone alive learns the rotation by watching it, which is what makes it
    // a mechanic rather than a random tax.
    getAlive(ctx.state).forEach(t => addZoneThreat(ctx.state, t, next, MEMORY.cannonThreat));
}

/**
 * The Vault's blackout schedule.
 *
 * Every third cycle the lights fail complex-wide. In the dark nobody can be
 * seen coming — expressed as a fogbound effect on every zone at once, which the
 * awareness layer already reads — and the tributes who are moving take the
 * consequences of moving blind.
 */
function vaultSignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (cycle % 3 !== 0) return;
    const zones = activeZones(ctx);
    if (zones.length === 0) return;

    ctx.logEvent(
        'THE VAULT GOES DARK: every light in the complex fails at once. The schedule is the only thing down here that has ever been reliable.',
        [],
        { important: true, category: 'arena' }
    );
    zones.forEach(z => startZoneEffect(ctx, z, 'fogbound', false));
    getAlive(ctx.state).forEach(t => {
        if (!rng.chance(0.3)) return;
        applyDamage(ctx, t, 6, { cause: 'Walked into something in the dark', kind: 'arena' });
        t.vitals.sanity -= 8;
        clampTribute(t);
        checkDeath(ctx, t, 'Walked into something in the dark');
    });
}

/**
 * The Tempest Reach's tide.
 *
 * One zone floods every night and drains by morning, and the tide is the
 * arena's own escalation — it takes whichever zone the most tributes are
 * standing in, because the Gamemakers are watching too.
 */
function tempestSignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (ctx.state.timeOfDay !== 'night') return;
    const zones = activeZones(ctx);
    if (zones.length === 0) return;

    const byPopulation = [...zones].sort((a, b) => tributesIn(ctx, b).length - tributesIn(ctx, a).length);
    const busiest = byPopulation[0];
    // A coin flip between "where the people are" and a genuinely random sector,
    // so the tide is threatening rather than perfectly predictable.
    const target = rng.chance(0.6) ? busiest : rng.pick(zones);
    if (hasEffect(ctx.state, target, 'flooded')) return;

    ctx.logEvent(
        `THE TIDE TURNS: the water comes up over ${target} in the dark, faster than anything that deep should move.`,
        [],
        { important: true, zone: target, category: 'arena' }
    );
    startZoneEffect(ctx, target, 'flooded', false);
    tributesIn(ctx, target).forEach(t => {
        const swims = rng.chance(0.3 + t.attributes.strength * 0.05);
        if (swims) {
            ctx.logEvent(`${t.name} gets above the waterline in ${target} with nothing worse than a soaking.`, [t.id], { zone: target, category: 'arena' });
            t.vitals.fatigue += 15;
            clampTribute(t);
            return;
        }
        applyDamage(ctx, t, 18, { cause: `Taken by the tide in ${target}`, kind: 'arena' });
        t.vitals.fatigue += 25;
        addZoneThreat(ctx.state, t, target, MEMORY.hazardThreat * 2);
        clampTribute(t);
        checkDeath(ctx, t, `Taken by the tide in ${target}`);
    });
}

/**
 * The Hanging Gardens' failing bridges.
 *
 * The arena is platforms and rope; the ground is not survivable. Every couple
 * of cycles a crossing parts, permanently — so the map genuinely shrinks in
 * connectivity rather than in area, and a tribute can be stranded on a limb.
 */
function canopySignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (cycle % 2 !== 0) return;
    const zones = activeZones(ctx);
    const from = zones.find(z => tributesIn(ctx, z).length === 0) ?? rng.pick(zones);
    const zone = getZone(ctx.state.arena, from);
    if (!zone) return;
    const severed = new Set(ctx.state.severedEdges ?? []);
    const candidates = zone.adjacent.filter(n => zones.includes(n) && !severed.has(edgeKey(from, n)));
    if (candidates.length === 0) return;

    const to = rng.pick(candidates);
    severEdge(ctx.state, from, to);
    ctx.logEvent(
        `A crossing parts two hundred metres up: the span between ${from} and ${to} is gone, and there is no rebuilding it.`,
        [],
        { important: true, zone: from, category: 'arena' }
    );
}

/**
 * The Solar Desert's noon.
 *
 * Every day phase the sun stalls, and open ground becomes the thing that kills
 * you. Shade is a premium — the description says so — and this is what makes it
 * one: standing anywhere with cover costs nothing, standing in the open costs
 * water you do not have.
 */
function solarSignature(ctx: SimContext, _cycle: number, rng: RNG) {
    if (ctx.state.timeOfDay !== 'day') return;
    const exposed = getAlive(ctx.state).filter(t => {
        const zone = getZone(ctx.state.arena, t.zone);
        return zone?.terrain === 'open';
    });
    if (exposed.length === 0) return;

    ctx.logEvent(
        'THE SUN STALLS: the Gamemakers hold noon in place, and every open sector in the arena becomes an oven.',
        [],
        { important: true, category: 'arena' }
    );
    exposed.forEach(t => {
        t.vitals.thirst += 22;
        t.vitals.fatigue += 12;
        if (rng.chance(0.25)) {
            injure(t, 'burned');
            applyDamage(ctx, t, 8, { cause: 'Burned alive under a stalled sun', kind: 'arena' });
        }
        clampTribute(t);
        checkDeath(ctx, t, 'Burned alive under a stalled sun');
    });
}

/**
 * The Frozen Wasteland's night.
 *
 * Cold is the arena's whole premise, and the climate layer already models it —
 * what was missing was the night that makes shelter a decision rather than a
 * nicety. Anyone without warmth or a shelter takes real damage after dark.
 */
function frozenSignature(ctx: SimContext, _cycle: number, rng: RNG) {
    if (ctx.state.timeOfDay !== 'night') return;
    const alive = getAlive(ctx.state);
    if (alive.length === 0) return;

    ctx.logEvent(
        'THE COLD COMES DOWN: the temperature drops past anything a person survives in the open. Tonight, shelter is the whole game.',
        [],
        { important: true, category: 'arena' }
    );
    alive.forEach(t => {
        const warm = t.inventory.some(i => i.warmth) || ctx.state.camps?.[t.id]?.shelter !== undefined;
        if (warm) return;
        applyDamage(ctx, t, 10, { cause: 'Froze to death in the open', kind: 'arena' });
        t.vitals.fatigue += 18;
        if (rng.chance(0.3)) injure(t, 'frostbitten');
        clampTribute(t);
        checkDeath(ctx, t, 'Froze to death in the open');
    });
}

/**
 * The Concrete Jungle's collapses.
 *
 * A dead city falls down. Every third cycle a structure in a ruins or highland
 * sector goes, taking a route with it and hurting whoever was inside.
 */
function concreteSignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (cycle % 3 !== 1) return;
    const zones = activeZones(ctx).filter(n => {
        const z = getZone(ctx.state.arena, n);
        return z?.terrain === 'ruins' || z?.terrain === 'highland';
    });
    if (zones.length === 0) return;

    const target = rng.pick(zones);
    ctx.logEvent(
        `STRUCTURAL FAILURE: something enormous comes down in ${target}, and the dust takes ten minutes to settle.`,
        [],
        { important: true, zone: target, category: 'arena' }
    );
    tributesIn(ctx, target).forEach(t => {
        if (rng.chance(0.35 + t.attributes.agility * 0.04)) {
            ctx.logEvent(`${t.name} is clear of ${target} before the floor goes.`, [t.id], { zone: target, category: 'arena' });
            return;
        }
        applyDamage(ctx, t, 24, { cause: `Buried in a collapse in ${target}`, kind: 'arena' });
        openWound(t, BLEEDING.hazardSeverity);
        addZoneThreat(ctx.state, t, target, MEMORY.hazardThreat * 2);
        clampTribute(t);
        checkDeath(ctx, t, `Buried in a collapse in ${target}`);
    });
    const zone = getZone(ctx.state.arena, target);
    const severed = new Set(ctx.state.severedEdges ?? []);
    const routes = zone?.adjacent.filter(n => !severed.has(edgeKey(target, n))) ?? [];
    if (routes.length > 1) severEdge(ctx.state, target, rng.pick(routes));
}

/**
 * The Toxic Swamps' gas.
 *
 * The premise is undrinkable water and hallucinogenic air. The signature is the
 * bog exhaling: a wetland sector goes contaminated and everyone in it loses
 * their grip for a while.
 */
function toxicSignature(ctx: SimContext, _cycle: number, rng: RNG) {
    const zones = activeZones(ctx).filter(n => {
        const z = getZone(ctx.state.arena, n);
        return z?.terrain === 'wetland' || z?.terrain === 'water';
    });
    if (zones.length === 0 || !rng.chance(0.5)) return;

    const target = rng.pick(zones);
    if (hasEffect(ctx.state, target, 'contaminated')) return;
    ctx.logEvent(
        `THE BOG EXHALES: ${target} fills with something that smells sweet and is not. The air itself is the hazard now.`,
        [],
        { important: true, zone: target, category: 'arena' }
    );
    startZoneEffect(ctx, target, 'contaminated', false);
    tributesIn(ctx, target).forEach(t => {
        const covered = t.inventory.some(i => i.purifies) || rng.chance(t.attributes.intelligence * 0.05);
        if (covered) return;
        t.vitals.sanity -= 22;
        injure(t, 'poisoned');
        applyDamage(ctx, t, 6, { cause: `Breathed the swamp gas in ${target}`, kind: 'arena' });
        clampTribute(t);
        checkDeath(ctx, t, `Breathed the swamp gas in ${target}`);
    });
}

/**
 * The Ashfall Basin's fall.
 *
 * Permanent grey snowfall that coats the lungs. It thickens on a rhythm, and
 * when it does, everyone outdoors pays a little — the arena as a slow grind
 * rather than a spike.
 */
function ashfallSignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (cycle % 2 !== 1) return;
    ctx.logEvent(
        'THE FALL THICKENS: the ash comes down heavier, and every breath in the basin tastes like the inside of a furnace.',
        [],
        { important: true, category: 'arena' }
    );
    getAlive(ctx.state).forEach(t => {
        const filtered = t.inventory.some(i => i.purifies);
        t.vitals.fatigue += filtered ? 4 : 12;
        t.vitals.thirst += 8;
        if (!filtered && rng.chance(0.2)) {
            applyDamage(ctx, t, 7, { cause: 'Choked on volcanic ash', kind: 'arena' });
            injure(t, 'infected');
        }
        clampTribute(t);
        checkDeath(ctx, t, 'Choked on volcanic ash');
    });
}

/**
 * The Salt Mirror's glare.
 *
 * "There is nowhere to hide" is the promise. The signature enforces it: by day
 * everyone standing on the flats is visible to everyone else on the flats,
 * which feeds straight into the sighting layer and makes the arena a hunting
 * ground rather than a hiding one.
 */
function saltflatsSignature(ctx: SimContext, _cycle: number, rng: RNG) {
    if (ctx.state.timeOfDay !== 'day') return;
    const openZones = activeZones(ctx).filter(n => getZone(ctx.state.arena, n)?.terrain === 'open');
    const exposed = getAlive(ctx.state).filter(t => openZones.includes(t.zone));
    if (exposed.length < 2) return;

    ctx.logEvent(
        'THE MIRROR: the glare comes off the crust from below as well as above, and on the flats every living thing is a black mark on white. There is nowhere to hide out here.',
        [],
        { important: true, category: 'arena' }
    );
    // Everyone on the flats sees everyone else on the flats — real sightings,
    // fed to the memory layer, so hunters can actually act on it.
    exposed.forEach(observer => {
        openZones.forEach(z => {
            const rivals = exposed.filter(o => o.zone === z && o.allianceId !== observer.allianceId && o.id !== observer.id).length;
            if (rivals > 0) noteSighting(ctx.state, observer, z, rivals, 0);
        });
        observer.vitals.thirst += 10;
        if (rng.chance(0.2)) observer.vitals.sanity -= 6;
        clampTribute(observer);
    });
}

/**
 * The Spore Fields' bloom.
 *
 * Everything is edible and half of it kills you. The bloom is the arena
 * offering: a forest sector becomes extraordinarily rich, and anyone who eats
 * there rolls against it.
 */
function sporefieldsSignature(ctx: SimContext, _cycle: number, rng: RNG) {
    const zones = activeZones(ctx).filter(n => getZone(ctx.state.arena, n)?.terrain === 'forest');
    if (zones.length === 0 || !rng.chance(0.55)) return;

    const target = rng.pick(zones);
    ctx.logEvent(
        `THE BLOOM: ${target} fruits overnight. There is more food there than anywhere in the arena, and no way at all to tell which of it is safe.`,
        [],
        { important: true, zone: target, category: 'arena' }
    );
    tributesIn(ctx, target).forEach(t => {
        if (!rng.chance(0.7)) return;
        // Knowing your fungi is the entire skill this arena tests.
        const safe = rng.chance(0.4 + t.attributes.intelligence * 0.06);
        if (safe) {
            t.vitals.hunger = Math.max(0, t.vitals.hunger - 45);
            t.health = Math.min(100, t.health + 6);
            ctx.logEvent(`${t.name} eats well in ${target}, and picks right.`, [t.id], { zone: target, category: 'survival' });
        } else {
            injure(t, 'poisoned');
            t.vitals.sanity -= 18;
            applyDamage(ctx, t, 14, { cause: `Poisoned by the bloom in ${target}`, kind: 'arena' });
            ctx.logEvent(`${t.name} eats well in ${target}, and picks wrong.`, [t.id], { important: true, zone: target, category: 'hazard' });
        }
        clampTribute(t);
        checkDeath(ctx, t, `Poisoned by the bloom in ${target}`);
    });
}

type Signature = (ctx: SimContext, cycle: number, rng: RNG) => void;

/**
 * §8.3: the Warren's rule — the tunnels move. Every fourth cycle a passage
 * chokes shut somewhere; every eighth, the mountain settles and the old ways
 * are open again. The map is a rumour down here.
 */
function warrenSignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (cycle % 8 === 0 && (ctx.state.severedEdges?.length ?? 0) > 0) {
        ctx.state.severedEdges = [];
        ctx.logEvent(
            'THE SHIFTING: the mountain settles with a sound like a held breath released. Every choked passage in the Warren stands open again — for now.',
            [],
            { important: true, category: 'arena' }
        );
        return;
    }
    if (cycle % 4 !== 0) return;
    const zones = activeZones(ctx);
    if (zones.length === 0) return;
    const zone = rng.pick(zones);
    const cut = severRandomEdge(ctx, zone);
    if (cut) {
        ctx.logEvent(
            `THE SHIFTING: dust runs, timbers groan, and the passage between ${zone} and ${cut} chokes shut. The Warren has redrawn itself.`,
            [],
            { important: true, category: 'arena' }
        );
    }
}

/**
 * The Shattered Archipelago's fog.
 *
 * The islands are only a map because the bridges say so. Every other cycle the
 * magnetic fog rises and takes a crossing with it; every sixth the fog thins
 * and every span is walkable again. The Warren's shifting, translated to rope.
 */
function islandsSignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (cycle % 6 === 0 && (ctx.state.severedEdges?.length ?? 0) > 0) {
        ctx.state.severedEdges = [];
        ctx.logEvent(
            'THE FOG THINS: for the first time in days the islands can all see each other, and every span and zip-line stands crossable again.',
            [],
            { important: true, category: 'arena' }
        );
        return;
    }
    if (cycle % 2 !== 0) return;
    const zones = activeZones(ctx);
    if (zones.length === 0) return;
    const zone = rng.pick(zones);
    const cut = severRandomEdge(ctx, zone);
    if (cut) {
        ctx.logEvent(
            `THE FOG RISES: the crossing between ${zone} and ${cut} disappears into the grey, ropes and all. Nobody sane steps onto a span they cannot see the far end of.`,
            [],
            { important: true, category: 'arena' }
        );
    }
}

/**
 * The Perpetual Eclipse Forest's stars.
 *
 * Every third cycle the artificial stars rearrange — the only fixed points in
 * a duskbound sky move — and everyone navigating by them is suddenly wrong.
 * Fogbound everywhere, and a toll on anyone caught mid-move.
 */
function eclipseSignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (cycle % 3 !== 2) return;
    const zones = activeZones(ctx);
    if (zones.length === 0) return;

    ctx.logEvent(
        'THE STARS SHIFT: every artificial star over the forest slides to a new station at once. Every bearing taken in the last three days is now a lie.',
        [],
        { important: true, category: 'arena' }
    );
    zones.forEach(z => startZoneEffect(ctx, z, 'fogbound', false));
    getAlive(ctx.state).forEach(t => {
        if (!rng.chance(SIGNATURE_RULES.eclipseStumbleChance)) return;
        applyDamage(ctx, t, 5, { cause: 'Walked off a bearing that no longer existed', kind: 'arena' });
        t.vitals.sanity -= SIGNATURE_RULES.eclipseSanityLoss;
        clampTribute(t);
        checkDeath(ctx, t, 'Walked off a bearing that no longer existed');
    });
}

/**
 * The Dead Coral Reef's bloom.
 *
 * The anemones did not die with the ocean. On their rhythm they open all at
 * once, and any low ground becomes a field of stinging cells.
 */
function reefSignature(ctx: SimContext, _cycle: number, rng: RNG) {
    const zones = activeZones(ctx).filter(n => {
        const z = getZone(ctx.state.arena, n);
        return z?.terrain === 'wetland' || z?.terrain === 'open';
    });
    if (zones.length === 0 || !rng.chance(SIGNATURE_RULES.reefBloomChance)) return;

    const target = rng.pick(zones);
    if (hasEffect(ctx.state, target, 'contaminated')) return;
    ctx.logEvent(
        `THE BLOOM OPENS: every anemone in ${target} unfurls at once, acres of them, reaching for an ocean that is not coming back. The ground itself is venomous now.`,
        [],
        { important: true, zone: target, category: 'arena' }
    );
    startZoneEffect(ctx, target, 'contaminated', false);
    tributesIn(ctx, target).forEach(t => {
        if (rng.chance(SIGNATURE_RULES.reefDodgeBase + t.attributes.agility * 0.04)) {
            ctx.logEvent(`${t.name} picks a line across the dead coral heads of ${target} and never touches the bloom.`, [t.id], { zone: target, category: 'arena' });
            return;
        }
        injure(t, 'poisoned');
        t.vitals.sanity -= SIGNATURE_RULES.reefSanityLoss;
        applyDamage(ctx, t, 12, { cause: `Stung down by the bloom in ${target}`, kind: 'arena' });
        addZoneThreat(ctx.state, t, target, MEMORY.hazardThreat * 2);
        clampTribute(t);
        checkDeath(ctx, t, `Stung down by the bloom in ${target}`);
    });
}

/**
 * The Industrial Abattoir's line.
 *
 * The factory still runs a shift. Every cycle the machinery starts in one hall,
 * in strict rotation through the printed map — learnable, like the Clockwork
 * Island's dial, because a factory schedule is the most learnable thing there is.
 */
function abattoirSignature(ctx: SimContext, cycle: number, rng: RNG) {
    const all = ctx.state.arena.zones.map(z => z.name);
    const striking = all[cycle % all.length];
    const next = all[(cycle + 1) % all.length];
    if (!activeZones(ctx).includes(striking)) return;

    ctx.logEvent(
        `THE LINE STARTS: the machinery of ${striking} shudders through a full shift — pistons, belts, hooks, all of it. ${next} is next on the board.`,
        [],
        { important: true, zone: striking, category: 'arena' }
    );
    tributesIn(ctx, striking).forEach(t => {
        if (rng.chance(SIGNATURE_RULES.abattoirDodgeBase + t.attributes.agility * 0.04)) {
            ctx.logEvent(`${t.name} reads the warning shudder in ${striking} and is off the line before it moves.`, [t.id], { zone: striking, category: 'arena' });
            return;
        }
        applyDamage(ctx, t, 24, { cause: `Caught in the machinery of ${striking}`, kind: 'arena' });
        openWound(t, BLEEDING.hazardSeverity);
        t.vitals.fatigue += SIGNATURE_RULES.abattoirFatigue;
        addZoneThreat(ctx.state, t, striking, MEMORY.hazardThreat * 2);
        clampTribute(t);
        checkDeath(ctx, t, `Caught in the machinery of ${striking}`);
    });
    getAlive(ctx.state).forEach(t => addZoneThreat(ctx.state, t, next, MEMORY.cannonThreat));
}

/**
 * The Forgotten Carnival's rides.
 *
 * At night, one attraction powers up from nowhere — lights, music, the works —
 * and everyone in the park knows exactly where everyone standing in it is.
 */
function carnivalSignature(ctx: SimContext, _cycle: number, rng: RNG) {
    if (ctx.state.timeOfDay !== 'night') return;
    const zones = activeZones(ctx).filter(n => getZone(ctx.state.arena, n)?.terrain === 'ruins');
    if (zones.length === 0) return;

    const target = rng.pick(zones);
    const caught = tributesIn(ctx, target);
    ctx.logEvent(
        `THE RIDE WAKES: ${target} lights up end to end and the music starts, mid-song, like it never stopped. Every tribute in the arena turns to look.`,
        [],
        { important: true, zone: target, category: 'arena' }
    );
    caught.forEach(t => {
        t.vitals.sanity -= SIGNATURE_RULES.carnivalSanityLoss;
        clampTribute(t);
    });
    // The whole park sees where the lights are — and who is standing in them.
    if (caught.length > 0) {
        getAlive(ctx.state).forEach(observer => {
            const rivals = caught.filter(o => o.allianceId !== observer.allianceId && o.id !== observer.id).length;
            if (rivals > 0 && observer.zone !== target) noteSighting(ctx.state, observer, target, rivals, 0);
        });
    }
}

/**
 * The Ash Wasteland's throat.
 *
 * Every second cycle the caldera clears its throat: a hot gust across the whole
 * basin, and everyone wading three feet of ash pays for every step. High ground
 * near the vent burns outright.
 */
function ashwasteSignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (cycle % 2 !== 1) return;
    ctx.logEvent(
        'THE MOUNTAIN CLEARS ITS THROAT: a hot pressure-wave rolls off the caldera, and the ash lifts hip-high across the whole basin before it settles again.',
        [],
        { important: true, category: 'arena' }
    );
    getAlive(ctx.state).forEach(t => {
        t.vitals.fatigue += SIGNATURE_RULES.ashwasteWadeFatigue;
        const zone = getZone(ctx.state.arena, t.zone);
        if (zone?.terrain === 'highland' && rng.chance(SIGNATURE_RULES.ashwasteBurnChance)) {
            injure(t, 'burned');
            applyDamage(ctx, t, 12, { cause: 'Scorched by the caldera gust', kind: 'arena' });
        }
        clampTribute(t);
        checkDeath(ctx, t, 'Scorched by the caldera gust');
    });
}

/**
 * The Vertical Quarry's benches.
 *
 * Rock cut into steps stays steps only as long as it feels like it. Every third
 * cycle a bench lets go, hurts whoever is standing on it, and takes a road with
 * it permanently — the pit narrows toward its own flooded centre.
 */
function quarrySignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (cycle % 3 !== 1) return;
    const zones = activeZones(ctx).filter(n => {
        const z = getZone(ctx.state.arena, n);
        return z?.terrain === 'highland' || z?.terrain === 'open';
    });
    if (zones.length === 0) return;

    const target = rng.pick(zones);
    ctx.logEvent(
        `BENCH COLLAPSE: a hundred metres of ${target} shears off the wall and goes down the pit in one long roar. The dust plume climbs past the rim.`,
        [],
        { important: true, zone: target, category: 'arena' }
    );
    tributesIn(ctx, target).forEach(t => {
        if (rng.chance(SIGNATURE_RULES.quarryDodgeBase + t.attributes.agility * 0.04)) {
            ctx.logEvent(`${t.name} feels ${target} tilt underfoot and runs the right way.`, [t.id], { zone: target, category: 'arena' });
            return;
        }
        applyDamage(ctx, t, 24, { cause: `Went down with the bench in ${target}`, kind: 'arena' });
        openWound(t, BLEEDING.hazardSeverity);
        addZoneThreat(ctx.state, t, target, MEMORY.hazardThreat * 2);
        clampTribute(t);
        checkDeath(ctx, t, `Went down with the bench in ${target}`);
    });
    const zone = getZone(ctx.state.arena, target);
    const severed = new Set(ctx.state.severedEdges ?? []);
    const routes = zone?.adjacent.filter(n => !severed.has(edgeKey(target, n))) ?? [];
    if (routes.length > 1) severEdge(ctx.state, target, rng.pick(routes));
}

/**
 * The Glacial Cavern Network's calving.
 *
 * The glacier is moving the whole time; every third cycle it moves somewhere
 * that matters. A gallery drops, the cold pours in behind it, and whoever was
 * under the ice rolls against the roof.
 */
function glacierSignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (cycle % 3 !== 0) return;
    const zones = activeZones(ctx);
    if (zones.length === 0) return;

    const target = rng.pick(zones);
    ctx.logEvent(
        `CALVING: the glacier shifts its weight and something the size of a district block comes down across ${target}. The boom arrives through the ice before it arrives through the air.`,
        [],
        { important: true, zone: target, category: 'arena' }
    );
    startZoneEffect(ctx, target, 'frozen', false);
    tributesIn(ctx, target).forEach(t => {
        if (rng.chance(SIGNATURE_RULES.glacierDodgeBase + t.attributes.agility * 0.04)) {
            ctx.logEvent(`${t.name} reads the crack running overhead in ${target} and is out before the roof follows it.`, [t.id], { zone: target, category: 'arena' });
            return;
        }
        applyDamage(ctx, t, 22, { cause: `Buried in the calving at ${target}`, kind: 'arena' });
        injure(t, 'frostbitten');
        addZoneThreat(ctx.state, t, target, MEMORY.hazardThreat * 2);
        clampTribute(t);
        checkDeath(ctx, t, `Buried in the calving at ${target}`);
    });
    const zone = getZone(ctx.state.arena, target);
    const severed = new Set(ctx.state.severedEdges ?? []);
    const routes = zone?.adjacent.filter(n => !severed.has(edgeKey(target, n))) ?? [];
    if (routes.length > 1) severEdge(ctx.state, target, rng.pick(routes));
}

/**
 * The Shattered Ice Floe Sea's drift.
 *
 * The plates never stop moving. Most nights the drift takes a crossing; every
 * fourth cycle the pack grinds back together and the map is briefly whole.
 * Anyone standing where a plate parts rolls against the black water.
 */
function floeSignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (cycle % 4 === 0 && (ctx.state.severedEdges?.length ?? 0) > 0) {
        ctx.state.severedEdges = [];
        ctx.logEvent(
            'THE PACK CLOSES: wind and current shove the plates back together with a grinding that goes on for an hour. Every crossing stands again — until the next drift.',
            [],
            { important: true, category: 'arena' }
        );
        return;
    }
    if (ctx.state.timeOfDay !== 'night' || cycle % 2 !== 1) return;
    const zones = activeZones(ctx);
    if (zones.length === 0) return;
    const zone = rng.pick(zones);
    const cut = severRandomEdge(ctx, zone);
    if (!cut) return;
    ctx.logEvent(
        `THE DRIFT: black water opens between ${zone} and ${cut}, wide as a river and getting wider. That crossing is gone.`,
        [],
        { important: true, zone, category: 'arena' }
    );
    tributesIn(ctx, zone).forEach(t => {
        if (!rng.chance(SIGNATURE_RULES.floeDunkChance)) return;
        applyDamage(ctx, t, 14, { cause: 'Went into the black water when the plates parted', kind: 'arena' });
        injure(t, 'frostbitten');
        t.vitals.fatigue += SIGNATURE_RULES.floeDunkFatigue;
        clampTribute(t);
        checkDeath(ctx, t, 'Went into the black water when the plates parted');
    });
}

/**
 * The Avalanche Peaks' snow.
 *
 * The loaded slopes let go every second cycle — off a highland sector, down
 * into it and whatever sits below it. The pass it buries stays buried.
 */
function alpineSignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (cycle % 2 !== 0) return;
    const zones = activeZones(ctx).filter(n => getZone(ctx.state.arena, n)?.terrain === 'highland');
    if (zones.length === 0) return;

    const target = rng.pick(zones);
    ctx.logEvent(
        `AVALANCHE: the snowpack above ${target} fractures along its whole width and comes down. The sound reaches every tribute in the arena; the snow reaches ${target}.`,
        [],
        { important: true, zone: target, category: 'arena' }
    );
    startZoneEffect(ctx, target, 'frozen', false);
    tributesIn(ctx, target).forEach(t => {
        if (rng.chance(SIGNATURE_RULES.alpineDodgeBase + t.attributes.agility * 0.04)) {
            ctx.logEvent(`${t.name} skis the debris of ${target} on their boot soles and stays on top of it.`, [t.id], { zone: target, category: 'arena' });
            return;
        }
        applyDamage(ctx, t, 26, { cause: `Buried by the avalanche in ${target}`, kind: 'arena' });
        injure(t, 'frostbitten');
        addZoneThreat(ctx.state, t, target, MEMORY.hazardThreat * 2);
        clampTribute(t);
        checkDeath(ctx, t, `Buried by the avalanche in ${target}`);
    });
    const zone = getZone(ctx.state.arena, target);
    const severed = new Set(ctx.state.severedEdges ?? []);
    const routes = zone?.adjacent.filter(n => !severed.has(edgeKey(target, n))) ?? [];
    if (routes.length > 1) severEdge(ctx.state, target, rng.pick(routes));
}

/**
 * The Abandoned Terraced Mines' subsidence.
 *
 * The mountain was hollowed before it was carved. Every third cycle a terrace
 * slips or a cable span parts — same result: someone's road stops existing,
 * and whoever was on it goes some of the way down with it.
 */
function terracesSignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (cycle % 3 !== 2) return;
    const zones = activeZones(ctx);
    if (zones.length === 0) return;

    const target = rng.pick(zones);
    ctx.logEvent(
        `TERRACE SLIP: a step of ${target} settles a full metre with a crack like the mountain's spine going, and the terraces below it vanish under rubble and cable.`,
        [],
        { important: true, zone: target, category: 'arena' }
    );
    tributesIn(ctx, target).forEach(t => {
        if (rng.chance(SIGNATURE_RULES.terracesDodgeBase + t.attributes.agility * 0.04)) {
            ctx.logEvent(`${t.name} gets a hand on standing rock as ${target} settles, and keeps it.`, [t.id], { zone: target, category: 'arena' });
            return;
        }
        applyDamage(ctx, t, 20, { cause: `Went down with the terrace in ${target}`, kind: 'arena' });
        openWound(t, BLEEDING.hazardSeverity);
        t.vitals.fatigue += SIGNATURE_RULES.terracesFatigue;
        addZoneThreat(ctx.state, t, target, MEMORY.hazardThreat * 2);
        clampTribute(t);
        checkDeath(ctx, t, `Went down with the terrace in ${target}`);
    });
    const zone = getZone(ctx.state.arena, target);
    const severed = new Set(ctx.state.severedEdges ?? []);
    const routes = zone?.adjacent.filter(n => !severed.has(edgeKey(target, n))) ?? [];
    if (routes.length > 1) severEdge(ctx.state, target, rng.pick(routes));
}

/**
 * The Alpine Archipelago's rising tide: the sea comes up another fifty feet
 * every few cycles, and whatever low ground was dry when the Games started
 * is not dry now.
 */
function seapeaksSignature(ctx: SimContext, cycle: number, rng: RNG) {
    if (cycle % 3 !== 0) return;
    const zones = activeZones(ctx);
    const candidates = ctx.state.arena.zones.filter(z =>
        zones.includes(z.name) && z.name !== ctx.state.arena.zones[0].name && (z.terrain === 'open' || z.terrain === 'ruins'));
    if (candidates.length === 0) return;
    const target = rng.pick(candidates);

    ctx.logEvent(`THE TIDE: the water climbs another fifty feet, and ${target.name} goes under.`, [], { important: true, zone: target.name, category: 'arena' });
    tributesIn(ctx, target.name).forEach(t => {
        applyDamage(ctx, t, 18, { cause: `Caught by the rising tide in ${target.name}`, kind: 'arena' });
        addZoneThreat(ctx.state, t, target.name, MEMORY.hazardThreat * 2);
        clampTribute(t);
        checkDeath(ctx, t, `Caught by the rising tide in ${target.name}`);
    });
    startZoneEffect(ctx, target.name, 'flooded', false);
    const severed = new Set(ctx.state.severedEdges ?? []);
    const routes = target.adjacent.filter(n => !severed.has(edgeKey(target.name, n)));
    if (routes.length > 1) severEdge(ctx.state, target.name, rng.pick(routes));
}

/**
 * The Suspended Canopy Web's needle-shrapnel drops: the Gamemakers shake the
 * high limbs with sonic blasts, and millions of stiff needles come down like
 * kinetic darts — through clothing, through rope bridges, through anyone
 * still on the ground.
 */
function canopywebSignature(ctx: SimContext, cycle: number, rng: RNG) {
    const zones = activeZones(ctx);
    if (zones.length === 0) return;
    const target = rng.pick(zones);
    ctx.logEvent(`THE CANOPY: the high limbs shake, and a hail of needles rains down on ${target}.`, [], { important: true, zone: target, category: 'arena' });
    tributesIn(ctx, target).forEach(t => {
        if (rng.chance(SIGNATURE_RULES.canopywebDodgeBase + t.attributes.agility * 0.04)) {
            ctx.logEvent(`${t.name} gets under cover before the worst of it reaches ${target}.`, [t.id], { zone: target, category: 'arena' });
            return;
        }
        applyDamage(ctx, t, 16, { cause: `Shredded by falling needles in ${target}`, kind: 'arena' });
        openWound(t, BLEEDING.hazardSeverity);
        addZoneThreat(ctx.state, t, target, MEMORY.hazardThreat * 2);
        clampTribute(t);
        checkDeath(ctx, t, `Shredded by falling needles in ${target}`);
    });
    // The rope bridges take it worse than the tributes do.
    if (rng.chance(SIGNATURE_RULES.canopywebSeverChance)) severRandomEdge(ctx, target);
}

/**
 * The Whispering Acoustic Forest's resonant shattering: the Gamemakers tune
 * the wind to the hollow pines' exact resonant frequency, and an entire
 * grove comes apart into flying timber at once.
 */
function acousticforestSignature(ctx: SimContext, cycle: number, rng: RNG) {
    const zones = activeZones(ctx).filter(z => getZone(ctx.state.arena, z)?.terrain === 'forest');
    if (zones.length === 0) return;
    const target = rng.pick(zones);
    ctx.logEvent(`THE WIND FINDS THE NOTE: the whole grove at ${target} starts to shake, and then it comes apart.`, [], { important: true, zone: target, category: 'arena' });
    tributesIn(ctx, target).forEach(t => {
        if (rng.chance(SIGNATURE_RULES.acousticforestDodgeBase + t.attributes.agility * 0.04)) {
            ctx.logEvent(`${t.name} throws themself flat as ${target} implodes into splinters overhead.`, [t.id], { zone: target, category: 'arena' });
            return;
        }
        applyDamage(ctx, t, 24, { cause: `Caught in the shattering trees of ${target}`, kind: 'arena' });
        openWound(t, BLEEDING.hazardSeverity);
        t.vitals.sanity -= SIGNATURE_RULES.acousticforestSanityLoss;
        addZoneThreat(ctx.state, t, target, MEMORY.hazardThreat * 2);
        clampTribute(t);
        checkDeath(ctx, t, `Caught in the shattering trees of ${target}`);
    });
}

/**
 * The Post-Burn Scar's heat-activated seed shrapnel: thermal flares trigger
 * serotinous cones to explode like shrapnel, igniting brushfires and seeding
 * instant-growth thorn barriers in the same instant.
 */
function burnscarSignature(ctx: SimContext, cycle: number, rng: RNG) {
    const zones = activeZones(ctx);
    if (zones.length === 0) return;
    const target = rng.pick(zones);
    ctx.logEvent(`THE MOUNTAIN CATCHES HEAT: the seed pods over ${target} go off at once, and the brush with them.`, [], { important: true, zone: target, category: 'arena' });
    tributesIn(ctx, target).forEach(t => {
        applyDamage(ctx, t, 15, { cause: `Caught in the seed-shrapnel over ${target}`, kind: 'arena' });
        if (!t.injuries.burned && rng.chance(SIGNATURE_RULES.burnscarBurnChance)) injure(t, 'burned');
        addZoneThreat(ctx.state, t, target, MEMORY.hazardThreat * 2);
        clampTribute(t);
        checkDeath(ctx, t, `Caught in the seed-shrapnel over ${target}`);
    });
    startZoneEffect(ctx, target, 'burning', false);
    if (rng.chance(SIGNATURE_RULES.burnscarSeverChance)) severRandomEdge(ctx, target); // an instant thorn barrier
}

/**
 * The Overgrown Ordnance Crater Field's pressure-sensitive seed pods: the
 * vines' pods look like wild fruit and detonate like landmines when picked.
 */
function craterfieldSignature(ctx: SimContext, cycle: number, rng: RNG) {
    const zones = activeZones(ctx);
    if (zones.length === 0) return;
    const target = rng.pick(zones);
    const present = tributesIn(ctx, target);
    if (present.length === 0) return;
    const t = rng.pick(present);
    if (rng.chance(SIGNATURE_RULES.craterfieldDodgeBase + t.attributes.agility * 0.03)) {
        ctx.logEvent(`${t.name} spots the seed pod in ${target} for what it is, just in time.`, [t.id], { zone: target, category: 'arena' });
        return;
    }
    ctx.logEvent(`${t.name} reaches for what looks like fruit in ${target}, and the pod goes off in their hand.`, [t.id], { important: true, zone: target, category: 'arena' });
    applyDamage(ctx, t, 26, { cause: `Caught by a pressure pod in ${target}`, kind: 'arena' });
    openWound(t, BLEEDING.hazardSeverity);
    addZoneThreat(ctx.state, t, target, MEMORY.hazardThreat * 2);
    clampTribute(t);
    checkDeath(ctx, t, `Caught by a pressure pod in ${target}`);
}

/**
 * The declarative signature grammar for procedurally generated arenas.
 *
 * Every hand-authored arena above got a bespoke rule; every procedural arena
 * got none — `SIGNATURES[id]` was always undefined for the four `procedural-*`
 * ids, so `runArenaSignature` silently no-oped and two arenas of the same
 * biome played identically. `SignatureRule` (models/types.ts) composes one
 * from `trigger × selector × payload × telegraph`, rolled once per generated
 * arena in `generateArena` and stored on `Arena.signatureRule`. This runs it
 * through the exact same primitives the hand-authored signatures above use.
 */

function triggerFires(ctx: SimContext, trigger: SignatureRule['trigger'], cycle: number): boolean {
    switch (trigger.kind) {
        case 'everyCycle': return true;
        case 'everyNth': return cycle % Math.max(1, trigger.n ?? 3) === 0;
        case 'nightsOnly': return ctx.state.timeOfDay !== 'day';
        case 'daysOnly': return ctx.state.timeOfDay === 'day';
        case 'afterEscalation': return ctx.state.escalationDay !== undefined;
        case 'lowSurvivors': return getAlive(ctx.state).length <= (trigger.threshold ?? 6);
        default: return true;
    }
}

function selectSignatureZones(ctx: SimContext, selector: SignatureRule['selector'], cycle: number): string[] {
    const zones = activeZones(ctx);
    if (zones.length === 0) return [];
    switch (selector.kind) {
        case 'allZones':
            return zones;
        case 'fixedRotation': {
            const all = ctx.state.arena.zones.map(z => z.name);
            const striking = all[cycle % all.length];
            return zones.includes(striking) ? [striking] : [];
        }
        case 'busiestZone':
        case 'emptiestZone': {
            const counts = zones.map(z => [z, tributesIn(ctx, z).length] as const);
            counts.sort((a, b) => selector.kind === 'busiestZone' ? b[1] - a[1] : a[1] - b[1]);
            return counts.length ? [counts[0][0]] : [];
        }
        case 'nearCornucopia': {
            const cornucopia = ctx.state.arena.zones[0];
            const adj = (cornucopia?.adjacent ?? []).filter(n => zones.includes(n));
            return adj.length ? adj : (cornucopia && zones.includes(cornucopia.name) ? [cornucopia.name] : []);
        }
        case 'lowestDanger': {
            const withDanger = ctx.state.arena.zones
                .filter(z => zones.includes(z.name))
                .sort((a, b) => a.danger - b.danger);
            return withDanger.length ? [withDanger[0].name] : [];
        }
        default:
            return [];
    }
}

/** One cycle's warning, in the same voice `clockworkSignature` already uses for `next`. */
function telegraphSignature(ctx: SimContext, rule: SignatureRule, cycle: number, rng: RNG) {
    if (rule.telegraph.kind === 'none') return;
    const upcoming = selectSignatureZones(ctx, rule.selector, cycle + 1);
    if (upcoming.length === 0) return;
    let named = upcoming;
    if (rule.telegraph.kind === 'falseChance' && rng.chance(rule.telegraph.falseChance ?? PROC_SIGNATURE.falseChanceMin)) {
        const others = activeZones(ctx).filter(z => !upcoming.includes(z));
        if (others.length > 0) named = [rng.pick(others)];
    }
    ctx.logEvent(
        `THE ARENA: something in ${named.join(' and ')} is about to give way.`,
        [],
        { zone: named[0], category: 'arena' }
    );
}

function applySignaturePayload(ctx: SimContext, zones: string[], payload: SignatureRule['payload'], rng: RNG) {
    switch (payload.kind) {
        case 'damageEffect': {
            const damage = payload.amount ?? PROC_SIGNATURE.damageBase;
            zones.forEach(zone => {
                tributesIn(ctx, zone).forEach(t => {
                    if (rng.chance(PROC_SIGNATURE.dodgeBase + t.attributes.agility * PROC_SIGNATURE.dodgeAgility)) {
                        ctx.logEvent(`${t.name} feels the arena shift in ${zone} and gets clear in time.`, [t.id], { zone, category: 'arena' });
                        return;
                    }
                    applyDamage(ctx, t, damage, { cause: `Caught by the arena in ${zone}`, kind: 'arena' });
                    addZoneThreat(ctx.state, t, zone, MEMORY.hazardThreat * 2);
                    clampTribute(t);
                    checkDeath(ctx, t, `Caught by the arena in ${zone}`);
                });
                if (payload.effect) startZoneEffect(ctx, zone, payload.effect, false);
            });
            break;
        }
        case 'severEdges':
            zones.forEach(zone => severRandomEdge(ctx, zone));
            break;
        case 'invertResources':
            zones.forEach(zone => {
                const current = depletionOf(ctx.state, zone);
                const delta = current >= PROC_SIGNATURE.invertMidpoint ? -PROC_SIGNATURE.invertDelta : PROC_SIGNATURE.invertDelta;
                depleteZone(ctx.state, zone, delta);
            });
            ctx.logEvent(`THE ARENA: what was scarce is suddenly plentiful, and what was plentiful is gone.`, [], { category: 'arena' });
            break;
        case 'spawnMutt': {
            const roster = rosterFor(ctx);
            if (roster.length === 0) break;
            zones.forEach(zone => {
                const present = tributesIn(ctx, zone);
                if (present.length === 0) return;
                engageMutt(ctx, rng.pick(present), rng.pick(roster));
            });
            break;
        }
        case 'drainVital':
            zones.forEach(zone => {
                tributesIn(ctx, zone).forEach(t => {
                    t.vitals.sanity -= payload.amount ?? PROC_SIGNATURE.sanityDrain;
                    t.vitals.fatigue += PROC_SIGNATURE.fatigueDrain;
                    clampTribute(t);
                });
            });
            break;
        case 'revealPositions':
            zones.forEach(zone => {
                const present = tributesIn(ctx, zone);
                if (present.length === 0) return;
                getAlive(ctx.state).forEach(t => addZoneThreat(ctx.state, t, zone, MEMORY.cannonThreat));
            });
            ctx.logEvent(`THE ARENA: every position in the field lights up on the Gamemakers' board, and everyone knows it.`, [], { category: 'arena' });
            break;
        default:
            break;
    }
}

export function runDeclarativeSignature(ctx: SimContext, rule: SignatureRule, cycle: number, rng: RNG) {
    if (!triggerFires(ctx, rule.trigger, cycle)) return;
    telegraphSignature(ctx, rule, cycle, rng);
    const zones = selectSignatureZones(ctx, rule.selector, cycle);
    if (zones.length === 0) return;
    applySignaturePayload(ctx, zones, rule.payload, rng);
}

const SIGNATURES: Record<string, Signature> = {
    islands: islandsSignature,
    eclipse: eclipseSignature,
    reef: reefSignature,
    abattoir: abattoirSignature,
    carnival: carnivalSignature,
    ashwaste: ashwasteSignature,
    quarry: quarrySignature,
    glacier: glacierSignature,
    floe: floeSignature,
    alpine: alpineSignature,
    terraces: terracesSignature,
    clockwork: clockworkSignature,
    vault: vaultSignature,
    warren: warrenSignature,
    tempest: tempestSignature,
    canopy: canopySignature,
    solar: solarSignature,
    frozen: frozenSignature,
    concrete: concreteSignature,
    toxic: toxicSignature,
    ashfall: ashfallSignature,
    saltflats: saltflatsSignature,
    sporefields: sporefieldsSignature,
    seapeaks: seapeaksSignature,
    canopyweb: canopywebSignature,
    acousticforest: acousticforestSignature,
    burnscar: burnscarSignature,
    craterfield: craterfieldSignature,
};

/** True when this arena has a rule of its own — used by the UI to explain it. */
export function hasSignature(arenaId: string, signatureRule?: SignatureRule): boolean {
    return SIGNATURES[arenaId] !== undefined || signatureRule !== undefined;
}

/** A generated one-line summary of a composed rule, for arenas with no hand-authored blurb. */
export function describeSignatureRule(rule: SignatureRule): string {
    const when: Record<SignatureRule['trigger']['kind'], string> = {
        everyCycle: 'every cycle', everyNth: 'on a rotation', nightsOnly: 'every night',
        daysOnly: 'every day', afterEscalation: 'once the border starts closing', lowSurvivors: 'once the field thins out',
    };
    const where: Record<SignatureRule['selector']['kind'], string> = {
        fixedRotation: 'a zone that rotates on a schedule', busiestZone: 'wherever the most tributes are standing',
        emptiestZone: 'wherever almost nobody is standing', nearCornucopia: 'a zone near the Cornucopia',
        lowestDanger: 'the zone that looked safest', allZones: 'the whole arena at once',
    };
    const what: Record<SignatureRule['payload']['kind'], string> = {
        damageEffect: 'turns lethal', severEdges: 'cuts off a route out', invertResources: 'flips scarce and plentiful',
        spawnMutt: 'lets something loose', drainVital: 'wears at whoever is there', revealPositions: 'lights up every position on the board',
    };
    const telegraphed = rule.telegraph.kind === 'none' ? 'without warning' : 'with a warning the cycle before';
    return `${when[rule.trigger.kind]}, ${where[rule.selector.kind]} ${what[rule.payload.kind]}, ${telegraphed}.`;
}

export { SIGNATURE_BLURBS } from '../data/signatureBlurbs';

/**
 * Runs the arena's own rule for this cycle. Called once per day/night phase,
 * after movement and encounters have resolved, so the signature acts on where
 * tributes actually ended up.
 */
export function runArenaSignature(ctx: SimContext) {
    // The Gamemakers want a victor, not an empty arena. Once the field is down
    // to the finalists the arena stops taking swings of its own and lets them
    // settle it — the same principle the border collapse follows.
    if (getAlive(ctx.state).length <= ESCALATION.finalistCount) return;
    const cycle = ctx.state.cycle ?? 0;
    const signature = SIGNATURES[ctx.state.arena.id];
    const rng = new RNG(`${ctx.state.seed}-signature-${ctx.state.arena.id}-${cycle}`);
    if (signature) {
        signature(ctx, cycle, rng);
        return;
    }
    const rule = ctx.state.arena.signatureRule;
    if (rule) runDeclarativeSignature(ctx, rule, cycle, rng);
}
