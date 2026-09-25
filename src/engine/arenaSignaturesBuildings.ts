import { Tribute } from '../models/types';
import { RNG } from '../utils/rng';
import { SimContext, getAlive } from './context';
import { applyDamage, checkDeath } from './combat';
import { getZone, zoneFeatures } from './map';
import { addZoneThreat, noteSighting } from './memory';
import { openWound } from './wounds';
import { clampTribute } from './vitals';
import { rosterFor, engageMutt } from './mutts';
import { loseSanity } from './sanityBands';
import { allied } from './alliance';
import { ARENA_SIGNATURES, BLEEDING, MEMORY } from '../data/balance';
import {
    burnChain, getMark, ignitionChain, isZoneLocked, lockZone, remapZoneFeatures, rotateSafeShelter, safeShelter, setMark,
} from './arenaRules';

/**
 * The signatures of the five building arenas: the Gallery, the Malt House,
 * Circuit Row, the Ward Block and the Glasshouse.
 *
 * Kept beside `arenaSignature.ts` rather than inside it because each one is
 * mostly a driver for a generic mechanic in `arenaRules.ts` — lockdown,
 * ignition chains, permanent remap, the rotating shelter — and reads better
 * next to the other four than scattered through forty-five others. Registered
 * in `SIGNATURES` like every other arena's.
 *
 * Every one is a two-beat chain — a telegraph the field can read, then the
 * swing — with its state in `arenaRuleState.marks`, so it replays exactly.
 */

function activeZones(ctx: SimContext): string[] {
    const collapsed = ctx.state.collapsedZones ?? [];
    return ctx.state.arena.zones.map(z => z.name).filter(n => !collapsed.includes(n));
}

function tributesIn(ctx: SimContext, zone: string): Tribute[] {
    return getAlive(ctx.state).filter(t => t.zone === zone);
}

/** Whether anybody in this zone is not allied with somebody else in it: a fight waiting to happen. */
function contested(people: Tribute[]): boolean {
    return people.some(a => people.some(b => a.id !== b.id && !allied(a, b)));
}

/**
 * The Gallery: Open Mic.
 *
 * The house was built so a whisper on the stage reaches the gods, and it has
 * not forgotten how. Each cycle it may pick one room — the one with a fight
 * brewing in it, for preference — and the next cycle it plays that room to
 * the whole arena: every tribute alive learns who is in it. The rig in the
 * flies is still hanging over whatever room it picked.
 */
export function gallerySignature(ctx: SimContext, _cycle: number, rng: RNG) {
    const knobs = ARENA_SIGNATURES.openMic;
    const zones = activeZones(ctx);
    if (zones.length === 0) return;
    const live = getMark(ctx.state, 'openMic:zone');
    if (typeof live === 'string' && zones.includes(live)) {
        setMark(ctx.state, 'openMic:zone', undefined);
        const present = tributesIn(ctx, live);
        ctx.logEvent(
            `OPEN MIC: the house takes ${live} and plays it to every seat. Every breath, every step and every word in there is heard from the stalls to the flies${present.length ? ` — ${present.length === 1 ? 'one tribute' : `${present.length} tributes`}, and now everybody knows it` : ', and there is nobody in it, which everybody also now knows'}.`,
            present.map(t => t.id),
            { type: 'signature-beats', important: true, zone: live, category: 'arena' },
        );
        getAlive(ctx.state).forEach(o => {
            if (o.zone === live) return;
            noteSighting(ctx.state, o, live, present.length, 0);
        });
        present.forEach(t => {
            loseSanity(t, knobs.sanity);
            addZoneThreat(ctx.state, t, live, MEMORY.hazardThreat);
            clampTribute(t);
        });
        if (present.length > 0 && rng.chance(knobs.rigChance)) {
            const t = rng.pick(present);
            if (rng.chance(knobs.dodgeBase + t.attributes.agility * knobs.dodgePerAgility)) {
                ctx.logEvent(`A lighting bar comes down out of the flies onto ${live}. ${t.name} hears the cable go and is not under it.`, [t.id], { zone: live, category: 'arena' });
                return;
            }
            const cause = `Crushed by the lighting rig in ${live}`;
            applyDamage(ctx, t, knobs.rigDamage, { cause, kind: 'arena', code: 'collapse' });
            if (rng.chance(knobs.rigBleedChance)) openWound(t, BLEEDING.hazardSeverity);
            clampTribute(t);
            ctx.logEvent(`A lighting bar comes down out of the flies onto ${live} and takes ${t.name} across the shoulders.`, [t.id], { important: true, zone: live, category: 'hazard' });
            checkDeath(ctx, t, cause);
        }
        return;
    }
    if (!rng.chance(knobs.pickChance)) return;
    const brewing = zones.filter(z => contested(tributesIn(ctx, z)));
    const busiest = [...zones].sort((a, b) => tributesIn(ctx, b).length - tributesIn(ctx, a).length)[0];
    const target = brewing.length > 0 ? rng.pick(brewing) : busiest;
    setMark(ctx.state, 'openMic:zone', target);
    ctx.logEvent(
        `FEEDBACK: a whine comes up out of the house speakers and settles on ${target}. Anybody who has been in this building a day knows what comes after the whine.`,
        [],
        { type: 'signature-beats', zone: target, category: 'arena' },
    );
}

/** The Malt House's rooms that fill with vapour on their own. */
const VAPOUR_ROOMS = ['The Boiler Room', 'The Cellar Vaults'];

/**
 * The Malt House: Vapour Rises / Vapour Ignites.
 *
 * The boiler room and the cellar vaults fill with vapour off the stills, a
 * little each day and more each night. When a room is full the arena says so
 * — the air shimmers, the fumes start taking people — and the next cycle it
 * goes, and it takes every enclosed room it touches with it. The cellar is
 * the best shelter in the arena until it is a flue.
 */
export function malthouseSignature(ctx: SimContext, _cycle: number, rng: RNG) {
    const knobs = ARENA_SIGNATURES.vapour;
    const zones = activeZones(ctx);
    const night = ctx.state.timeOfDay === 'night';
    VAPOUR_ROOMS.filter(z => zones.includes(z)).forEach(room => {
        const warned = getMark(ctx.state, `vapour:warned:${room}`) !== undefined;
        if (warned) {
            setMark(ctx.state, `vapour:warned:${room}`, undefined);
            if (!rng.chance(knobs.igniteChance)) {
                setMark(ctx.state, `vapour:${room}`, undefined);
                ctx.logEvent(`The extractors in ${room} catch on their own, and the vapour goes up the stack instead of up in flames. Nobody in the Malt House believes it was luck.`, [], { zone: room, category: 'arena' });
                return;
            }
            const chain = ignitionChain(ctx.state, room);
            ctx.logEvent(
                `VAPOUR IGNITES: ${room} goes up in a single sheet${chain.length > 1 ? `, and the flash runs through the doors into ${chain.slice(1).join(' and ')}` : ''}. The shelter was full of fuel the whole time.`,
                [],
                { type: 'signature-beats', important: true, zone: room, category: 'arena' },
            );
            burnChain(ctx, chain, 'Burned when the vapour went up in {zone}');
            return;
        }
        const level = Number(getMark(ctx.state, `vapour:${room}`) ?? 0) + (night ? knobs.risePerNight : knobs.risePerDay);
        setMark(ctx.state, `vapour:${room}`, Math.min(1, level));
        if (level < 1) return;
        setMark(ctx.state, `vapour:warned:${room}`, 1);
        const present = tributesIn(ctx, room);
        ctx.logEvent(
            `VAPOUR RISES: the air in ${room} has gone thick and sweet and it moves when nothing is moving it.${present.length ? ' Whoever is sheltering in there has a headache, and one cycle.' : ''}`,
            present.map(t => t.id),
            { type: 'signature-beats', zone: room, category: 'arena' },
        );
        present.forEach(t => {
            t.vitals.fatigue += knobs.fumeFatigue;
            loseSanity(t, knobs.fumeSanity);
            addZoneThreat(ctx.state, t, room, MEMORY.hazardThreat * 2);
            clampTribute(t);
        });
    });
}

/** The oval, in the one direction it runs. */
const TRACK = ['The Cornucopia (Start/Finish Straight)', 'Turn One', 'Turn Two', 'Turn Three', 'Turn Four'];

/**
 * Circuit Row: The Pace Car.
 *
 * Something still laps the track, one sector a cycle, in the direction the
 * track runs, and it has never once been late. Anybody standing on the
 * sector it is passing takes it; the board shows where it will be next, so a
 * tribute who reads it rotates through the infield instead.
 */
export function circuitSignature(ctx: SimContext, cycle: number, rng: RNG) {
    const knobs = ARENA_SIGNATURES.paceCar;
    const zones = activeZones(ctx);
    const track = TRACK.filter(z => zones.includes(z));
    if (track.length === 0) return;
    const here = TRACK[cycle % TRACK.length];
    const next = TRACK[(cycle + 1) % TRACK.length];
    if (!zones.includes(here)) return;
    const present = tributesIn(ctx, here);
    if (present.length === 0) {
        if (tributesIn(ctx, next).length > 0) {
            ctx.logEvent(`The lap board over the grandstand turns over: the pace car is through ${here} and due in ${next}.`, [], { type: 'signature-beats', zone: next, category: 'arena' });
        }
        return;
    }
    ctx.logEvent(
        `THE PACE CAR: it comes through ${here} flat out on its line, exactly on time, lights on and nobody driving it. ${next} is next.`,
        present.map(t => t.id),
        { type: 'signature-beats', important: true, zone: here, category: 'arena' },
    );
    present.forEach(t => {
        if (rng.chance(knobs.dodgeBase + t.attributes.agility * knobs.dodgePerAgility)) {
            ctx.logEvent(`${t.name} is over the barrier in ${here} with the car's slipstream pulling at their jacket.`, [t.id], { zone: here, category: 'arena' });
            t.vitals.fatigue += knobs.fatigue;
            clampTribute(t);
            return;
        }
        const cause = `Hit by the pace car on ${here}`;
        applyDamage(ctx, t, knobs.damage, { cause, kind: 'arena', code: 'machinery' });
        if (rng.chance(knobs.bleedChance)) openWound(t, BLEEDING.hazardSeverity);
        t.vitals.fatigue += knobs.fatigue;
        addZoneThreat(ctx.state, t, here, MEMORY.hazardThreat * 2);
        clampTribute(t);
        checkDeath(ctx, t, cause);
    });
}

/** The Ward Block's sealable doors. */
const BLOCKS = ['Cell Block A', 'Cell Block B', 'Cell Block C', 'The Solitary Wing'];

/**
 * The Ward Block: Lockdown.
 *
 * On a timer the doors of one block seal — the busiest, usually — and
 * whoever is inside is inside until they open again. The first lockdown of
 * the run also kills the speakers (`rules.lockdownBlackout`): from then on
 * there are no cannons and no faces in the sky, and nobody outside a block
 * learns what happened in it.
 */
export function wardblockSignature(ctx: SimContext, cycle: number, rng: RNG) {
    const knobs = ARENA_SIGNATURES.lockdown;
    const zones = activeZones(ctx);
    // The trapped pay for it every cycle they are in there.
    BLOCKS.filter(b => isZoneLocked(ctx.state, b)).forEach(block => {
        const trapped = tributesIn(ctx, block);
        trapped.forEach(t => {
            loseSanity(t, knobs.trappedSanity);
            t.vitals.fatigue += knobs.trappedFatigue;
            clampTribute(t);
        });
        const roster = rosterFor(ctx);
        if (trapped.length > 0 && roster.length > 0 && rng.chance(knobs.muttChance)) {
            engageMutt(ctx, rng.pick(trapped), rng.pick(roster));
        }
    });
    if (cycle < knobs.firstCycle || (cycle - knobs.firstCycle) % knobs.everyNth !== 0) return;
    const candidates = BLOCKS.filter(b => zones.includes(b) && !isZoneLocked(ctx.state, b));
    if (candidates.length === 0) return;
    const busiest = [...candidates].sort((a, b) => tributesIn(ctx, b).length - tributesIn(ctx, a).length)[0];
    const block = rng.chance(knobs.busiestChance) ? busiest : rng.pick(candidates);
    const firstBlackout = ctx.state.arena.rules?.lockdownBlackout && getMark(ctx.state, 'blackout') === undefined;
    const trapped = lockZone(ctx.state, block, cycle + knobs.lockCycles);
    ctx.logEvent(
        `LOCKDOWN: a klaxon, and every door in ${block} runs shut on its track at once.${trapped.length ? ` ${trapped.length === 1 ? 'One tribute is' : `${trapped.length} tributes are`} on the inside.` : ''}`,
        trapped.map(t => t.id),
        { type: 'signature-beats', important: true, zone: block, category: 'arena' },
    );
    if (firstBlackout) {
        ctx.logEvent('The speakers in the Ward Block cut out mid-klaxon and do not come back. There will be no cannons from here on, and no faces in the sky.', [], { important: true, category: 'arena' });
    }
    trapped.forEach(t => {
        if (!rng.chance(knobs.doorChance)) return;
        const cause = `Caught in a cell door in ${block}`;
        applyDamage(ctx, t, knobs.doorDamage, { cause, kind: 'arena', code: 'trap' });
        clampTribute(t);
        ctx.logEvent(`${t.name} is in the doorway in ${block} when it runs shut.`, [t.id], { zone: block, category: 'hazard' });
        checkDeath(ctx, t, cause);
    });
}

/** The Glasshouse's roofed wings, in the order they can give. */
const WINGS = ['The Tropical Wing', 'The Desert Wing', 'The Aquatic Wing', 'The Canopy Walk'];

/** The wings in the order this run's glass gives, fixed from the seed. */
export function wingOrder(ctx: SimContext): string[] {
    const rng = new RNG(`${ctx.state.seed}-glasshouse-order`);
    return rng.shuffle([...WINGS]);
}

/**
 * The safe wing, given the index of the next wing scheduled to crack: a whole
 * wing that is not that one (the last whole wing in the order). Undefined when
 * the only whole wing left is the next to go — no roof is safe then.
 */
export function safeWing(order: string[], nextToCrack: number): string | undefined {
    const later = order.slice(nextToCrack + 1);
    return later.length > 0 ? later[later.length - 1] : undefined;
}

/**
 * The Glasshouse: The Glass Gives.
 *
 * On a schedule, one wing's roof cracks — telegraphed a cycle ahead by the
 * sound — then shatters, dropping debris on everybody under it and leaving
 * the wing roofless for the rest of the run (`remapZoneFeatures`). The wing
 * that has not given yet, and is not the one cracking, is the arena's safe
 * shelter (`rotateSafeShelter`) — and the designation moves every time the
 * glass does.
 */
export function glasshouseSignature(ctx: SimContext, cycle: number, rng: RNG) {
    const knobs = ARENA_SIGNATURES.glassGives;
    const order = wingOrder(ctx);
    const given = Number(getMark(ctx.state, 'glass:given') ?? 0);
    const zones = activeZones(ctx);

    // A roofless wing is weather, every night.
    if (ctx.state.timeOfDay === 'night') {
        order.slice(0, given).forEach(wing => tributesIn(ctx, wing).forEach(t => {
            t.vitals.fatigue += knobs.exposureFatigue;
            t.vitals.thirst += knobs.exposureThirst;
            clampTribute(t);
        }));
        const safe = safeShelter(ctx.state);
        if (safe) tributesIn(ctx, safe).forEach(t => {
            t.vitals.fatigue = Math.max(0, t.vitals.fatigue - knobs.safeRelief);
            clampTribute(t);
        });
    }

    const cracking = getMark(ctx.state, 'glass:cracking');
    if (typeof cracking === 'string') {
        setMark(ctx.state, 'glass:cracking', undefined);
        setMark(ctx.state, 'glass:given', given + 1);
        const z = getZone(ctx.state.arena, cracking);
        const f = z ? zoneFeatures(z) : undefined;
        remapZoneFeatures(ctx.state, cracking, {
            shelterQuality: knobs.rooflessShelter,
            cover: (f?.cover ?? 0.3) * knobs.coverKept,
            acoustics: (f?.acoustics ?? 1) + knobs.acousticsGain,
        });
        const present = zones.includes(cracking) ? tributesIn(ctx, cracking) : [];
        ctx.logEvent(
            `THE GLASS GIVES: the roof over ${cracking} comes down in one long sheet of noise. The wing is open to the sky now and will stay that way.`,
            present.map(t => t.id),
            { type: 'signature-beats', important: true, zone: cracking, category: 'arena' },
        );
        present.forEach(t => {
            if (rng.chance(knobs.dodgeBase + t.attributes.agility * knobs.dodgePerAgility)) {
                ctx.logEvent(`${t.name} is under the ironwork in ${cracking} when the panes come down, and the ironwork holds.`, [t.id], { zone: cracking, category: 'arena' });
                return;
            }
            const cause = `Cut to pieces when the glass gave in ${cracking}`;
            applyDamage(ctx, t, knobs.damage, { cause, kind: 'arena', code: 'collapse' });
            openWound(t, BLEEDING.hazardSeverity);
            addZoneThreat(ctx.state, t, cracking, MEMORY.hazardThreat * 2);
            clampTribute(t);
            checkDeath(ctx, t, cause);
        });
        // The next safe wing: whole, and not the next to go.
        rotateSafeShelter(ctx.state, safeWing(order, given + 1));
        return;
    }

    if (given >= order.length) {
        if (safeShelter(ctx.state)) rotateSafeShelter(ctx.state, undefined);
        return;
    }
    // Before the first crack the designation is simply the last wing to go.
    if (given === 0 && !safeShelter(ctx.state)) rotateSafeShelter(ctx.state, order[order.length - 1]);
    if (cycle < knobs.firstCycle || (cycle - knobs.firstCycle) % knobs.everyNth !== 0) return;
    const next = order[given];
    setMark(ctx.state, 'glass:cracking', next);
    // `next` is cracking; order[given + 1] is the one after it. Neither is safe.
    const safe = safeWing(order, given + 1);
    rotateSafeShelter(ctx.state, safe);
    ctx.logEvent(
        `THE GLASS CRACKS: a sound like ice on a pond goes across the roof of ${next}, and then another.${safe ? ` ${safe} is the only roof in the Glasshouse nobody is worried about tonight.` : ''}`,
        tributesIn(ctx, next).map(t => t.id),
        { type: 'signature-beats', zone: next, category: 'arena' },
    );
}
