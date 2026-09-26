import { Tribute } from '../models/types';
import { RNG } from '../utils/rng';
import { SimContext, getAlive } from './context';
import { applyDamage, checkDeath } from './combat';
import { getZone, zoneFeatures } from './map';
import { addZoneThreat, noteSighting } from './memory';
import { startZoneEffect } from './zoneEffects';
import { injure } from './wounds';
import { clampTribute } from './vitals';
import { rosterFor, engageMutt } from './mutts';
import { hasTool } from './items';
import { loseSanity } from './sanityBands';
import { ARENA_RULES, ARENA_SIGNATURES, MEMORY } from '../data/balance';
import {
    clearSightline, closedLatentEdges, collapseZonePermanently, currentSightline, evictZone,
    fallenZones, getMark, openLatentEdge, setMark, setSightline,
} from './arenaRules';

/**
 * Signatures for the Hippodrome set (`data/arenasSetHippodrome.ts`).
 *
 * Each one is the arena taking its swing, and each swing is expressed through
 * a generic rule in `arenaRules.ts` rather than through bespoke state: the
 * Hippodrome and Cinder Peak drive the arena-wide sightline, the Undercroft
 * evicts its track zones, and the Open Cut collapses ground for good and opens
 * the latent routes the fall leaves behind. Folded into `SIGNATURES` in
 * `arenaSignature.ts`.
 */

type Signature = (ctx: SimContext, cycle: number, rng: RNG) => void;

function activeZones(ctx: SimContext): string[] {
    const collapsed = ctx.state.collapsedZones ?? [];
    return ctx.state.arena.zones.map(z => z.name).filter(n => !collapsed.includes(n));
}

function tributesIn(ctx: SimContext, zone: string): Tribute[] {
    return getAlive(ctx.state).filter(t => t.zone === zone);
}

/** Everybody alive learns where everybody in `zones` is standing. */
function exposeZones(ctx: SimContext, zones: string[]) {
    const living = getAlive(ctx.state);
    zones.forEach(zone => {
        const there = living.filter(t => t.zone === zone);
        if (there.length === 0) return;
        living.forEach(w => { if (w.zone !== zone) noteSighting(ctx.state, w, zone, there.length, 0); });
    });
}

function shelterOf(ctx: SimContext, zone: string): number {
    const z = getZone(ctx.state.arena, zone);
    return z ? (zoneFeatures(z).shelterQuality ?? 0) : 0;
}

// ---- The Hippodrome: lights up, lights fail ------------------------------------------

/**
 * The park's power comes on at an hour nobody announces. For two cycles every
 * zone is lit and loud (the `lit` sightline: sound carries further, cover
 * hides less, the bow comes into its own) — then it fails, all at once, into
 * a blackout the animatronics are built for. Then the park waits, and does it
 * again. The Ferris wheel is seen from everywhere, lit or not.
 */
const hippodromeSignature: Signature = (ctx, cycle, rng) => {
    const k = ARENA_SIGNATURES.hippodromeLights;
    const state = ctx.state;

    // The wheel: whoever is on it is on the skyline of the whole park.
    exposeZones(ctx, ['The Ferris Wheel'].filter(z => activeZones(ctx).includes(z)));

    const phase = getMark(state, 'hippo:phase') ?? 'dormant';
    let next = getMark(state, 'hippo:next');
    if (next === undefined) {
        next = rng.nextInt(k.firstMinCycle, k.firstMaxCycle);
        setMark(state, 'hippo:next', next);
    }
    const nextAt = Number(next);

    if (phase === 'dormant' && cycle >= nextAt) {
        setSightline(state, 'lit', cycle + k.litCycles);
        setMark(state, 'hippo:phase', 'lit');
        setMark(state, 'hippo:next', cycle + k.litCycles);
        ctx.logEvent(
            'LIGHTS UP: somewhere a breaker is thrown and the whole Hippodrome comes on at once — every bulb on every ride, every speaker, every sign. There is no dark left in the park, and everybody in it can see everybody else.',
            [],
            { type: 'signature-beats', important: true, category: 'arena' },
        );
        // Open ground under floodlights hides nobody.
        exposeZones(ctx, activeZones(ctx).filter(z => {
            const zone = getZone(state.arena, z);
            return zone !== undefined && zoneFeatures(zone).cover < ARENA_RULES.litOpenCoverBelow;
        }));
        return;
    }

    if (phase === 'lit' && cycle >= nextAt) {
        setSightline(state, 'blackout', cycle + k.blackoutCycles);
        setMark(state, 'hippo:phase', 'blackout');
        setMark(state, 'hippo:next', cycle + k.blackoutCycles);
        ctx.logEvent(
            'LIGHTS FAIL: the power goes with a bang from the generator shed, and the park drops into a dark so total the afterimages of the bulbs are the only thing anybody can see. The music keeps playing.',
            [],
            { type: 'signature-beats', important: true, category: 'arena' },
        );
        return;
    }

    if (phase === 'blackout') {
        // The animatronics do not need the lights.
        getAlive(state).forEach(t => {
            if (hasTool(t, 'light')) return;
            loseSanity(t, k.blackoutSanity);
            const zone = getZone(state.arena, t.zone);
            const vertical = zone ? zoneFeatures(zone).vertical === true : false;
            if (vertical && rng.chance(k.stumbleChance)) {
                applyDamage(ctx, t, k.stumbleDamage, { cause: `Fell in the dark on ${t.zone}`, kind: 'arena', code: 'fall' });
                ctx.logEvent(`${t.name} misses a step on ${t.zone} in the blackout and finds the next one the hard way.`, [t.id], { zone: t.zone, category: 'arena' });
                checkDeath(ctx, t, `Fell in the dark on ${t.zone}`);
            }
            clampTribute(t);
        });
        const exposed = getAlive(state).filter(t => !hasTool(t, 'light'));
        const victim = rng.chance(k.animatronicChance) ? rng.pickOrUndefined(exposed) : undefined;
        if (victim) {
            applyDamage(ctx, victim, k.animatronicDamage, { cause: `Caught by an animatronic in ${victim.zone}`, kind: 'arena', code: 'machinery' });
            addZoneThreat(state, victim, victim.zone, MEMORY.hazardThreat * 2);
            ctx.logEvent(
                `Something with a painted face and a motor in it finds ${victim.name} in the blackout in ${victim.zone}. It does not let go until its cycle ends.`,
                [victim.id],
                { important: true, zone: victim.zone, category: 'arena' },
            );
            clampTribute(victim);
            checkDeath(ctx, victim, `Caught by an animatronic in ${victim.zone}`);
        }
        if (cycle >= nextAt) {
            clearSightline(state);
            setMark(state, 'hippo:phase', 'dormant');
            setMark(state, 'hippo:next', cycle + k.restCycles + rng.nextInt(0, 2));
            ctx.logEvent(
                'The emergency lighting comes back on, one bulb in five, and the Hippodrome is only dim again. Nobody knows when the breaker will go next.',
                [],
                { category: 'arena' },
            );
        }
    }
};

// ---- The Undercroft: train due ------------------------------------------------------------

const TRACK_ZONES = ['Track Tunnel North', 'Track Tunnel South', 'The Third Rail'];

/**
 * The ghost train. Every third cycle it runs the main line; the cycle before,
 * the rails sing. Anyone on the tracks is hit or scrambles clear, and either
 * way ends up on the nearest platform — the tracks are evicted, and with the
 * tunnels running one way, the nearest platform is often not the one the
 * tribute would have chosen.
 */
const undercroftSignature: Signature = (ctx, cycle, rng) => {
    const k = ARENA_SIGNATURES.trainDue;
    const tracks = TRACK_ZONES.filter(z => activeZones(ctx).includes(z));
    if (tracks.length === 0) return;

    // The live rail, every cycle, regardless of the timetable.
    tributesIn(ctx, 'The Third Rail').forEach(t => {
        if (!rng.chance(ARENA_RULES.thirdRailTouchChance)) return;
        injure(t, 'burned');
        applyDamage(ctx, t, k.railDamage, { cause: 'Electrocuted on the third rail', kind: 'arena', code: 'hazard' });
        ctx.logEvent(`${t.name} touches the wrong rail on the Third Rail. It is still live.`, [t.id], { important: true, zone: t.zone, category: 'arena' });
        clampTribute(t);
        checkDeath(ctx, t, 'Electrocuted on the third rail');
    });

    if (cycle % k.everyNth === k.everyNth - 1) {
        ctx.logEvent(
            'THE RAILS SING: a hum comes up out of the tracks and through the soles of every boot in the Undercroft. The timetable on the platform wall has a train due.',
            [],
            { category: 'arena' },
        );
        getAlive(ctx.state).forEach(t => tracks.forEach(z => addZoneThreat(ctx.state, t, z, MEMORY.cannonThreat)));
        return;
    }
    if (cycle === 0 || cycle % k.everyNth !== 0) return;

    ctx.logEvent(
        'TRAIN DUE: headlights in the north tunnel, and then the whole train, lit and empty, doing forty through the main line without slowing. It does not stop at the platform. It never has.',
        [],
        { type: 'signature-beats', important: true, category: 'arena' },
    );
    tracks.forEach(zone => {
        tributesIn(ctx, zone).forEach(t => {
            if (rng.chance(k.dodgeBase + t.attributes.agility * k.dodgePerAgility)) {
                t.vitals.fatigue += k.fatigue;
                ctx.logEvent(`${t.name} flattens into a refuge in the wall of ${zone} as the train goes by close enough to touch.`, [t.id], { zone, category: 'arena' });
                clampTribute(t);
                return;
            }
            applyDamage(ctx, t, k.damage, { cause: `Hit by the train in ${zone}`, kind: 'arena', code: 'machinery' });
            addZoneThreat(ctx.state, t, zone, MEMORY.hazardThreat * 2);
            clampTribute(t);
            checkDeath(ctx, t, `Hit by the train in ${zone}`);
        });
        evictZone(ctx, zone, TRACK_ZONES).forEach(({ t, to }) => {
            ctx.logEvent(`${t.name} comes off the tracks in ${zone} and up onto ${to}, because that is where the train left them.`, [t.id], { zone: to, category: 'travel' });
        });
    });
};

// ---- The Long Vintage: harvest bell, frost warning -----------------------------------------

/**
 * By day the bell names the terraces the frost will take tonight — and one of
 * them, as often as not, is the one with fruit still on the vine, because the
 * Gamemakers want somebody standing there when the frost comes. By night the
 * frost comes. Walls are the only answer; a cloak or a bag halves it.
 */
const vintageSignature: Signature = (ctx, _cycle, rng) => {
    const k = ARENA_SIGNATURES.vintageFrost;
    const state = ctx.state;
    const cornucopia = state.arena.zones[0]?.name;
    const open = activeZones(ctx).filter(z => {
        const zone = getZone(state.arena, z);
        return zone !== undefined && zone.terrain === 'open' && z !== cornucopia && shelterOf(ctx, z) < k.shelteredAt;
    });
    if (open.length === 0) return;

    if (state.timeOfDay === 'day') {
        const named = rng.shuffle(open).slice(0, k.terraces);
        setMark(state, 'vintage:frost', named.join('|'));
        ctx.logEvent(
            `HARVEST BELL: the bell in the tower rings the harvest, and then rings it again, slower. Frost warning tonight on ${named.join(' and ')}.`,
            [],
            { type: 'signature-beats', important: true, zone: named[0], category: 'arena' },
        );
        if (rng.chance(k.bloomChance)) startZoneEffect(ctx, named[0], 'blooming', false);
        getAlive(state).forEach(t => named.forEach(z => addZoneThreat(state, t, z, MEMORY.cannonThreat)));
        return;
    }

    const marked = String(getMark(state, 'vintage:frost') ?? '');
    setMark(state, 'vintage:frost', undefined);
    const targets = marked.split('|').filter(z => z && activeZones(ctx).includes(z));
    if (targets.length === 0) return;
    ctx.logEvent(
        `THE FROST: it comes down the slope in the dark and settles on ${targets.join(' and ')}. By midnight the vines are white.`,
        [],
        { type: 'signature-beats', important: true, zone: targets[0], category: 'arena' },
    );
    targets.forEach(zone => {
        tributesIn(ctx, zone).forEach(t => {
            const wrapped = hasTool(t, 'warmth');
            const damage = wrapped ? Math.round(k.damage / 2) : k.damage;
            t.vitals.fatigue += wrapped ? Math.round(k.fatigue / 2) : k.fatigue;
            applyDamage(ctx, t, damage, { cause: `Froze on ${zone}`, kind: 'arena', code: 'hypothermia' });
            if (!wrapped && rng.chance(k.frostbiteChance)) {
                injure(t, 'frostbitten');
                ctx.logEvent(`${t.name}'s hands go white and then grey on ${zone}, holding the dead vines for warmth that is not in them.`, [t.id], { zone, category: 'injury' });
            }
            clampTribute(t);
            checkDeath(ctx, t, `Froze on ${zone}`);
        });
    });
};

// ---- Cinder Peak: clear sky, whiteout -----------------------------------------------------

/**
 * The summit swings. Calm, then a clear sky (the `clear` sightline: long
 * sightlines, ranged weapons favoured, anybody on the exposed ground seen by
 * everybody), then a whiteout (the `whiteout` sightline: dark at noon, close
 * range only, every crossing a cycle slower) that bites anyone without a roof.
 */
const cinderpeakSignature: Signature = (ctx, cycle, rng) => {
    const k = ARENA_SIGNATURES.cinderSky;
    const state = ctx.state;
    const phase = String(getMark(state, 'cinder:phase') ?? 'calm');
    const until = Number(getMark(state, 'cinder:until') ?? k.calmCycles);

    if (phase === 'whiteout' && currentSightline(state) === 'whiteout') {
        getAlive(state).forEach(t => {
            if (shelterOf(ctx, t.zone) >= 0.5) return;
            const wrapped = hasTool(t, 'warmth');
            t.vitals.fatigue += wrapped ? Math.round(k.exposedFatigue / 2) : k.exposedFatigue;
            applyDamage(ctx, t, wrapped ? Math.round(k.exposedDamage / 2) : k.exposedDamage,
                { cause: `Lost in the whiteout on ${t.zone}`, kind: 'arena', code: 'hypothermia' });
            if (!wrapped && rng.chance(k.frostbiteChance)) injure(t, 'frostbitten');
            clampTribute(t);
            checkDeath(ctx, t, `Lost in the whiteout on ${t.zone}`);
        });
    }

    if (cycle < until) {
        if (phase === 'clear' && cycle === until - 1) {
            ctx.logEvent('Weather on the horizon: a grey wall low over the western range, and coming on fast.', [], { category: 'arena' });
        }
        return;
    }

    if (phase === 'calm') {
        setSightline(state, 'clear', cycle + k.clearCycles);
        setMark(state, 'cinder:phase', 'clear');
        setMark(state, 'cinder:until', cycle + k.clearCycles);
        ctx.logEvent(
            'CLEAR SKY: the cloud drops away below the summit and the air goes perfectly clear. From the deck a tribute can count the buttons on another tribute\'s jacket a kilometre off.',
            [],
            { type: 'signature-beats', important: true, category: 'arena' },
        );
        exposeZones(ctx, activeZones(ctx).filter(z => {
            const zone = getZone(state.arena, z);
            return zone !== undefined && zoneFeatures(zone).elevation && zoneFeatures(zone).cover < ARENA_RULES.exposedRidgeCoverBelow;
        }));
        return;
    }

    if (phase === 'clear') {
        setSightline(state, 'whiteout', cycle + k.whiteoutCycles);
        setMark(state, 'cinder:phase', 'whiteout');
        setMark(state, 'cinder:until', cycle + k.whiteoutCycles);
        ctx.logEvent(
            'WHITEOUT: the storm comes over the ridge and the world goes white. Nobody on the mountain can see further than their own outstretched arm, and every step takes twice as long to trust.',
            [],
            { type: 'signature-beats', important: true, category: 'arena' },
        );
        return;
    }

    // After a whiteout: calm again for a while.
    clearSightline(state);
    setMark(state, 'cinder:phase', 'calm');
    setMark(state, 'cinder:until', cycle + k.calmCycles + rng.nextInt(0, 1));
    ctx.logEvent('The storm blows itself out over the eastern range. The summit is only cold again.', [], { category: 'arena' });
};

// ---- The Open Cut: the ground gives ----------------------------------------------------------

/** Whether every standing zone can still reach the Cornucopia once `without` is gone. */
function staysConnected(ctx: SimContext, without: string): boolean {
    const state = ctx.state;
    const collapsed = new Set([...(state.collapsedZones ?? []), without]);
    const latentShut = new Set(closedLatentEdges(state).map(([a, b]) => [a, b].sort().join('|')));
    const standing = state.arena.zones.map(z => z.name).filter(n => !collapsed.has(n));
    const start = state.arena.zones[0]?.name;
    if (!start || !standing.includes(start)) return false;
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
        const cur = queue.shift()!;
        (getZone(state.arena, cur)?.adjacent ?? []).forEach(n => {
            if (seen.has(n) || collapsed.has(n)) return;
            if (latentShut.has([cur, n].sort().join('|'))) return;
            seen.add(n);
            queue.push(n);
        });
    }
    return standing.every(n => seen.has(n));
}

/**
 * A terrace comes apart. Telegraphed the cycle before by the bench cracking;
 * then it goes, with whoever did not get off it, and it is gone for the rest
 * of the Games (`collapseZonePermanently`). The rubble opens whatever latent
 * ramp ran past it, so the levels around the fall reconnect in a new shape.
 * Never a zone whose loss would strand part of the pit.
 */
const opencutSignature: Signature = (ctx, cycle, rng) => {
    const k = ARENA_SIGNATURES.groundGive;
    const state = ctx.state;
    if (cycle < k.firstCycle - 1) return;
    const cornucopia = state.arena.zones[0]?.name;
    const candidates = activeZones(ctx).filter(z => {
        const zone = getZone(state.arena, z);
        return zone !== undefined && z !== cornucopia && zoneFeatures(zone).elevation
            && (zone.terrain === 'highland' || zone.terrain === 'open');
    });
    const fallen = fallenZones(state).length;
    if (fallen >= k.maxFalls) return;
    const step = (cycle - k.firstCycle) % k.everyNth;
    const pending = getMark(state, 'opencut:next');

    if (pending === undefined && (step === k.everyNth - 1 || cycle === k.firstCycle - 1)) {
        const viable = candidates.filter(z => staysConnected(ctx, z));
        const target = rng.pickOrUndefined(viable);
        if (!target) return;
        setMark(state, 'opencut:next', target);
        startZoneEffect(ctx, target, 'quaking', false);
        ctx.logEvent(
            `THE BENCH CRACKS: a split opens the length of ${target} with a sound like a rifle shot, and dust starts to come off the face below it. That terrace is not going to be there much longer.`,
            [],
            { type: 'signature-beats', important: true, zone: target, category: 'arena' },
        );
        getAlive(state).forEach(t => addZoneThreat(state, t, target, MEMORY.hazardThreat * 2));
        return;
    }
    if (pending === undefined || step !== 0) return;

    const target = String(pending);
    setMark(state, 'opencut:next', undefined);
    if (!activeZones(ctx).includes(target) || !staysConnected(ctx, target)) return;

    const neighbours = getZone(state.arena, target)?.adjacent ?? [];
    ctx.logEvent(
        `GROUND GIVE: ${target} goes. The whole bench slides into the pit in one long roar, and when the dust clears there is nothing there to stand on. There never will be again.`,
        [],
        { type: 'signature-beats', important: true, zone: target, category: 'arena' },
    );
    const present = tributesIn(ctx, target);
    present.forEach(t => {
        if (rng.chance(k.holdBase + t.attributes.agility * k.holdPerAgility)) {
            ctx.logEvent(`${t.name} is off ${target} and onto solid rock with the edge going behind their heels.`, [t.id], { zone: target, category: 'arena' });
            return;
        }
        applyDamage(ctx, t, k.damage, { cause: `Went down with ${target}`, kind: 'arena', code: 'fall' });
        clampTribute(t);
        checkDeath(ctx, t, `Went down with ${target}`);
    });
    collapseZonePermanently(ctx, target);

    // The remap: rubble ramps where the bench came down.
    const collapsed = state.collapsedZones ?? [];
    closedLatentEdges(state).forEach(([a, b]) => {
        if (collapsed.includes(a) || collapsed.includes(b)) return;
        if (!neighbours.includes(a) && !neighbours.includes(b)) return;
        if (!openLatentEdge(state, a, b)) return;
        ctx.logEvent(
            `The rubble from ${target} has come to rest as a ramp, and there is a way between ${a} and ${b} now that nobody has walked before.`,
            [],
            { important: true, zone: a, category: 'arena' },
        );
    });

    const survivors = present.filter(t => t.status === 'alive');
    const roster = rosterFor(ctx);
    if (roster.length > 0 && survivors.length > 0 && rng.chance(k.muttChance)) {
        engageMutt(ctx, rng.pick(survivors), rng.pick(roster));
    }
};

export const HIPPODROME_SET_SIGNATURES: Record<string, Signature> = {
    hippodrome: hippodromeSignature,
    undercroft: undercroftSignature,
    vintage: vintageSignature,
    cinderpeak: cinderpeakSignature,
    opencut: opencutSignature,
};
