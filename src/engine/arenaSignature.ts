import { Tribute } from '../models/types';
import { RNG } from '../utils/rng';
import { SimContext, getAlive } from './context';
import { applyDamage, checkDeath } from './combat';
import { getZone, severEdge, edgeKey } from './map';
import { addZoneThreat, noteSighting } from './memory';
import { startZoneEffect, hasEffect } from './zoneEffects';
import { openWound } from './wounds';
import { clampTribute } from './vitals';
import { BLEEDING, ESCALATION, MEMORY } from '../data/balance';

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
        if (horror.poison) t.injuries.poisoned = true;
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
            t.injuries.burned = true;
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
        if (rng.chance(0.3)) t.injuries.frostbitten = true;
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
        t.injuries.poisoned = true;
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
            t.injuries.infected = true;
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
            t.injuries.poisoned = true;
            t.vitals.sanity -= 18;
            applyDamage(ctx, t, 14, { cause: `Poisoned by the bloom in ${target}`, kind: 'arena' });
            ctx.logEvent(`${t.name} eats well in ${target}, and picks wrong.`, [t.id], { important: true, zone: target, category: 'hazard' });
        }
        clampTribute(t);
        checkDeath(ctx, t, `Poisoned by the bloom in ${target}`);
    });
}

type Signature = (ctx: SimContext, cycle: number, rng: RNG) => void;

const SIGNATURES: Record<string, Signature> = {
    clockwork: clockworkSignature,
    vault: vaultSignature,
    tempest: tempestSignature,
    canopy: canopySignature,
    solar: solarSignature,
    frozen: frozenSignature,
    concrete: concreteSignature,
    toxic: toxicSignature,
    ashfall: ashfallSignature,
    saltflats: saltflatsSignature,
    sporefields: sporefieldsSignature,
};

/** True when this arena has a rule of its own — used by the UI to explain it. */
export function hasSignature(arenaId: string): boolean {
    return SIGNATURES[arenaId] !== undefined;
}

/** One-line description of the arena's own rule, for the setup and game screens. */
export const SIGNATURE_BLURBS: Record<string, string> = {
    clockwork: 'The clock: one sector is struck every cycle, in strict rotation, telegraphed a cycle ahead.',
    vault: 'The schedule: every third cycle every light in the complex fails at once.',
    tempest: 'The tide: one sector floods every night, usually whichever one holds the most tributes.',
    canopy: 'The spans: a crossing parts every other cycle, permanently, and the map loses a route.',
    solar: 'Stalled noon: every day the sun holds still and open ground burns anyone standing on it.',
    frozen: 'The cold: every night, anyone without warmth or shelter takes real damage.',
    concrete: 'Structural failure: a building comes down every third cycle and takes a route with it.',
    toxic: 'The exhale: a wetland sector goes contaminated and the air itself turns hostile.',
    ashfall: 'The fall: the ashfall thickens on a rhythm and grinds down everyone still outdoors.',
    saltflats: 'The mirror: by day, everyone on the flats can see everyone else on the flats.',
    sporefields: 'The bloom: a forest sector fruits overnight, and eating there is a coin flip.',
};

/**
 * Runs the arena's own rule for this cycle. Called once per day/night phase,
 * after movement and encounters have resolved, so the signature acts on where
 * tributes actually ended up.
 */
export function runArenaSignature(ctx: SimContext) {
    const signature = SIGNATURES[ctx.state.arena.id];
    if (!signature) return;
    // The Gamemakers want a victor, not an empty arena. Once the field is down
    // to the finalists the arena stops taking swings of its own and lets them
    // settle it — the same principle the border collapse follows.
    if (getAlive(ctx.state).length <= ESCALATION.finalistCount) return;
    const cycle = ctx.state.cycle ?? 0;
    const rng = new RNG(`${ctx.state.seed}-signature-${ctx.state.arena.id}-${cycle}`);
    signature(ctx, cycle, rng);
}
