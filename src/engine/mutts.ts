import { Mutt, Tribute } from '../models/types';
import { ARENA_MUTTS } from '../data/mutts';
import { BLEEDING, MEMORY } from '../data/balance';
import { SimContext } from './context';
import { applyDamage, checkDeath } from './combat';
import { getZone } from './map';
import { addZoneThreat, ensureMemory, cycleOf } from './memory';
import { openWound } from './wounds';
import { clampTribute } from './vitals';
import { trainProficiency } from './proficiency';
import { earnTrait } from './earnedTraits';

/**
 * Mutt resolution (ARENA-04): every mutt used to be a name string, a fixed
 * evasion threshold and a flat 40 damage. This module reads the per-arena
 * `Mutt` rosters in src/data/mutts.ts and resolves an encounter against the
 * specific mutt's kit — its own speed, its own pack size, its own injuries,
 * where and when it can even appear.
 *
 * INTEGRATION NOTE for whoever wires this in: `tickPersistentMutts(ctx)` must
 * be called once per day/night cycle, from `processDayNight` in
 * src/engine/phases/dayNight.ts, AFTER `resolveEncounters` has run for that
 * cycle (so a mutt that just started hunting someone this cycle doesn't also
 * get an extra free bite the same cycle it was created). It is idempotent to
 * call on a cycle with no active mutts.
 */

/** Tunables. Documented the way src/data/balance.ts documents its own. */
const MUTTS = {
    /** Evasion roll: tribute agility + spread vs mutt speed. Wider spread than
     *  the old fixed threshold, so a slow tribute can still get lucky. */
    evasionRollSpread: 4,
    /** Extra hits beyond the first do less each time, so a pack raises danger
     *  without one-shotting a whole tribute in a single roll. */
    packDamageFalloff: 0.55,
    /** A pack can never deal more than this multiple of the lead mutt's base
     *  damage in one encounter, however many extra mutts connect. */
    packDamageCap: 2.5,
    /** How many cycles a persistent mutt keeps hunting once it finds someone. */
    persistentDuration: 3,
    /** Chance a persistent mutt's tracked target gets caught again on a given tick. */
    persistentReattackChance: 0.55,
    /**
     * "Wearing the faces of the fallen" — canon's most disturbing mutt beat.
     * Kept rare and gated on there actually being a death someone in the zone
     * mourned; this is not a roll on every mutt attack, it is a distinct
     * horror event layered on top of one.
     */
    facesOfFallenChance: 0.08,
    facesOfFallenSanityLoss: 30,
} as const;

function rosterFor(ctx: SimContext): Mutt[] {
    return ARENA_MUTTS[ctx.state.arena.id] ?? [];
}

/** Mutts allowed to appear right now, given terrain and time of day. */
function eligibleMutts(ctx: SimContext, t: Tribute, time: 'day' | 'night'): Mutt[] {
    const zone = getZone(ctx.state.arena, t.zone);
    return rosterFor(ctx).filter(m => {
        if (m.nocturnal && time !== 'night') return false;
        // Ice wolves don't swim: undefined preference means "anywhere".
        if (m.terrainPreference && zone && !m.terrainPreference.includes(zone.terrain)) return false;
        return true;
    });
}

/** Applies whatever `mutt` inflicts beyond the base damage. Bleeding goes through openWound. */
function applyMuttInjuries(t: Tribute, mutt: Mutt) {
    if (!mutt.inflicts) return;
    if (mutt.inflicts.bleeding) openWound(t, BLEEDING.muttSeverity);
    if (mutt.inflicts.poisoned) t.injuries.poisoned = true;
    if (mutt.inflicts.burned) t.injuries.burned = true;
    if (mutt.inflicts.frostbitten) t.injuries.frostbitten = true;
    if (mutt.inflicts.infected) t.injuries.infected = true;
}

/**
 * "Wearing the faces of the fallen": if anyone present has a death in their
 * `memory.mourned`, there's a rare chance the mutt is dressed as that person.
 * Only possible once someone in the zone has actually lost someone — this is
 * layered on top of a normal attack, not a replacement for one.
 */
function tryFacesOfTheFallen(ctx: SimContext, t: Tribute, mutt: Mutt) {
    const mourned = ensureMemory(t).mourned;
    if (mourned.length === 0) return;
    if (!ctx.rng.chance(MUTTS.facesOfFallenChance)) return;

    const fallen = ctx.rng.pick(mourned);
    const fallenTribute = ctx.state.tributes.find(o => o.id === fallen);
    const fallenName = fallenTribute?.name ?? 'someone they lost';
    t.vitals.sanity -= MUTTS.facesOfFallenSanityLoss;
    ctx.logEvent(
        `${mutt.name} turns toward ${t.name} wearing ${fallenName}'s face. ${t.name} freezes, and something in them breaks all over again.`,
        [t.id],
        { important: true, category: 'sanity' }
    );
}

/**
 * Resolves one mutt encounter for `t`. `time` gates nocturnal mutts; callers
 * that don't have it default to 'day' rather than breaking.
 */
export function resolveMuttAttack(ctx: SimContext, t: Tribute, time: 'day' | 'night' = 'day') {
    const eligible = eligibleMutts(ctx, t, time);
    if (eligible.length === 0) return; // nothing that can be here, right now, in this terrain

    const mutt = ctx.rng.pick(eligible);
    engageMutt(ctx, t, mutt);
}

/** The actual encounter, shared by a fresh sighting and a persistent re-attack. */
function engageMutt(ctx: SimContext, t: Tribute, mutt: Mutt) {
    const packSize = ctx.rng.nextInt(mutt.packSize[0], mutt.packSize[1]);

    // Proximity dread lands whether or not the tribute gets touched.
    if (mutt.fearAura) t.vitals.sanity -= mutt.fearAura;

    // Roll evasion once per mutt in the pack — more mutts, more chances to connect.
    let hits = 0;
    for (let i = 0; i < packSize; i++) {
        const roll = t.attributes.agility + ctx.rng.nextInt(0, MUTTS.evasionRollSpread);
        if (roll <= mutt.speed) hits++;
    }

    if (hits === 0) {
        ctx.logEvent(
            packSize > 1
                ? `${t.name} outruns a pack of ${mutt.name} through ${t.zone}.`
                : `${t.name} spots ${mutt.name} in time and gets clear.`,
            [t.id],
            { category: 'mutt' }
        );
        clampTribute(t);
        return;
    }

    // First hit at full damage, each additional connecting mutt adds less,
    // bounded so a big pack raises danger without guaranteeing a kill.
    let damage = mutt.damage;
    for (let i = 1; i < hits; i++) damage += mutt.damage * Math.pow(MUTTS.packDamageFalloff, i);
    damage = Math.min(damage, mutt.damage * MUTTS.packDamageCap);

    applyDamage(ctx, t, Math.round(damage), { cause: `Torn apart by ${mutt.name}`, kind: 'mutt' });
    applyMuttInjuries(t, mutt);
    trainProficiency(t, 'tracking');
    addZoneThreat(ctx.state, t, t.zone, MEMORY.hazardThreat * 2);

    tryFacesOfTheFallen(ctx, t, mutt);

    ctx.logEvent(
        packSize > 1
            ? `${t.name} is set upon by a pack of ${mutt.name} in ${t.zone} and barely breaks free.`
            : `${t.name} is set upon by ${mutt.name} in ${t.zone} and barely breaks free.`,
        [t.id],
        { important: true, category: 'mutt' }
    );
    clampTribute(t);
    checkDeath(ctx, t, `Torn apart by ${mutt.name}`);
    // Surviving the Gamemakers' own animals recalibrates what frightens you.
    if (t.status === 'alive') earnTrait(ctx, t, 'Hardened');

    if (mutt.persistent && t.status === 'alive') {
        const state = ctx.state;
        state.activeMutts = (state.activeMutts ?? []).filter(a => a.targetId !== t.id || a.muttId !== mutt.id);
        state.activeMutts.push({
            muttId: mutt.id,
            targetId: t.id,
            arenaId: state.arena.id,
            expiresCycle: cycleOf(state) + MUTTS.persistentDuration,
        });
    }
}

/**
 * Per-cycle upkeep for `persistent` mutts. See the file header for exactly
 * when this needs to run. Expires stale pursuits and gives each still-active
 * one a chance to catch its target again.
 */
export function tickPersistentMutts(ctx: SimContext) {
    const state = ctx.state;
    if (!state.activeMutts || state.activeMutts.length === 0) return;

    const cycle = cycleOf(state);
    const survivors = state.activeMutts.filter(a => a.expiresCycle >= cycle);

    survivors.forEach(active => {
        if (active.arenaId !== state.arena.id) return;
        const target = state.tributes.find(o => o.id === active.targetId);
        if (!target || target.status !== 'alive') return;
        if (!ctx.rng.chance(MUTTS.persistentReattackChance)) return;

        const mutt = rosterFor(ctx).find(m => m.id === active.muttId);
        if (!mutt) return;

        ctx.logEvent(
            `${mutt.name} has been on ${target.name}'s trail since the last cycle, and finds them again.`,
            [target.id],
            { category: 'mutt' }
        );
        engageMutt(ctx, target, mutt);
    });

    state.activeMutts = survivors.filter(a => {
        const target = state.tributes.find(o => o.id === a.targetId);
        return target && target.status === 'alive' && a.expiresCycle >= cycle;
    });
}
