import { Mutt, Tribute } from '../models/types';
import { ARENA_MUTTS } from '../data/mutts';
import { ITEMS } from '../data/constants';
import { BLEEDING, MEMORY, MUTTS, POISONING, QUELL_MECHANICS } from '../data/balance';
import { giveItem } from './items';
import { SimContext, getAlive } from './context';
import { applyDamage, checkDeath } from './combat';
import { getZone, reachableZones, severedEdgeSet } from './map';
import { addZoneThreat, ensureMemory, cycleOf } from './memory';
import { hasEffect } from './zoneEffects';
import { injure, openWound } from './wounds';
import { clampTribute } from './vitals';
import { trainProficiency } from './proficiency';
import { earnTrait } from './earnedTraits';
import { wildcardIs } from './gamesProfile';

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

/**
 * How hard this mutt bites right now.
 *
 * The printed `damage` on each roster entry is its danger *relative* to the
 * others, which is the carefully-authored part; this applies the global
 * lethality dial and the Gamemakers' escalation teeth on top, so the roster
 * data never has to be touched to retune how frightening mutts are overall.
 */
function scaledDamage(ctx: SimContext, mutt: Mutt): number {
    let scale = MUTTS.damageScale;
    const escalationDay = ctx.state.escalationDay;
    if (escalationDay !== undefined) {
        const daysIn = Math.max(0, ctx.state.day - escalationDay);
        scale += Math.min(MUTTS.escalationDamageCap, daysIn * MUTTS.escalationDamagePerDay);
    }
    return mutt.damage * scale;
}

export function rosterFor(ctx: SimContext): Mutt[] {
    // A generated arena's own roster (see arenaGenerator.ts) always wins —
    // it's specific to this run, where ARENA_MUTTS's procedural entries are
    // one shared roster per biome, reused by every arena of that biome.
    if (ctx.state.arena.muttRoster) return ctx.state.arena.muttRoster;
    const id = ctx.state.arena.id;
    // Procedural arenas are keyed `procedural-<biome>` on the Arena itself,
    // but their ARENA_MUTTS entries are keyed by the bare biome id — try the
    // exact id first so a hand-authored arena is never mangled, then fall
    // back to the biome id for procedural arenas.
    return ARENA_MUTTS[id] ?? ARENA_MUTTS[id.replace(/^procedural-/, '')] ?? [];
}

/**
 * 'The Reflection': every tribute's own mutt, statted from their own
 * attributes rather than drawn from the arena's roster — always eligible,
 * wherever they are. `role: 'mimic'` reuses "Faces of the Fallen" as-is;
 * this mutt simply always wears one face in particular.
 */
function reflectionMuttFor(t: Tribute): Mutt {
    return {
        id: `reflection-${t.id}`,
        name: `${t.name}'s Reflection`,
        packSize: [1, 1],
        damage: Math.round(t.attributes.strength * QUELL_MECHANICS.reflectionDamageScale),
        speed: Math.round(t.attributes.agility * QUELL_MECHANICS.reflectionSpeedScale),
        fearAura: QUELL_MECHANICS.reflectionFearAura,
        role: 'mimic',
    };
}

/** Mutts allowed to appear right now, given terrain, time of day, and role. */
export function eligibleMutts(ctx: SimContext, t: Tribute, time: 'day' | 'night'): Mutt[] {
    if (wildcardIs(ctx.state, 'quell-reflection')) return [reflectionMuttFor(t)];
    const zone = getZone(ctx.state.arena, t.zone);
    const cycle = cycleOf(ctx.state);
    return rosterFor(ctx).filter(m => {
        if (m.nocturnal && time !== 'night') return false;
        // Ice wolves don't swim: undefined preference means "anywhere".
        if (m.terrainPreference && zone && !m.terrainPreference.includes(zone.terrain)) return false;
        switch (m.role) {
            case 'ambusher':
                // Only shows itself in the dark or under cover of fog.
                if (time !== 'night' && !(zone && hasEffect(ctx.state, zone.name, 'fogbound'))) return false;
                break;
            case 'scavenger':
                // Only interested in a zone where a cannon just fired.
                if (!(ctx.state.recentCannonZones ?? []).some(c => c.zone === t.zone && c.cycle === cycle)) return false;
                break;
            case 'siege':
                // Never leaves its zone — it isn't eligible anywhere else.
                if (m.homeZone && m.homeZone !== t.zone) return false;
                break;
            default:
                break;
        }
        return true;
    });
}

/** Applies whatever `mutt` inflicts beyond the base damage. Bleeding goes through openWound. */
function applyMuttInjuries(t: Tribute, mutt: Mutt) {
    if (!mutt.inflicts) return;
    if (mutt.inflicts.bleeding) openWound(t, BLEEDING.muttSeverity);
    if (mutt.inflicts.poisoned) injure(t, 'poisoned');
    if (mutt.inflicts.burned) injure(t, 'burned');
    if (mutt.inflicts.frostbitten) injure(t, 'frostbitten');
    if (mutt.inflicts.infected) injure(t, 'infected');
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
    // The `mimic` role formalizes this beat as its whole identity rather than
    // a rare layer on top of a normal attack — it always wears a face, once
    // there's a face available to wear.
    if (mutt.role !== 'mimic' && !ctx.rng.chance(MUTTS.facesOfFallenChance)) return;

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

/** The actual encounter, shared by a fresh sighting, a persistent re-attack, and a Gamemaker release. */
export function engageMutt(ctx: SimContext, t: Tribute, mutt: Mutt) {
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

    // `herder` never damages — a connecting hit shoves the tribute into an
    // adjacent zone instead, and the encounter ends there.
    if (mutt.role === 'herder') {
        const options = reachableZones(ctx.state.arena, t.zone, ctx.state.collapsedZones ?? [], severedEdgeSet(ctx.state));
        if (options.length > 0) {
            const from = t.zone;
            const dest = ctx.rng.pick(options);
            t.zone = dest.name;
            t.vitals.sanity -= MUTTS.herderSanityLoss;
            addZoneThreat(ctx.state, t, from, MEMORY.hazardThreat);
            ctx.logEvent(`${mutt.name} drives ${t.name} out of ${from} and into ${dest.name}.`, [t.id], { important: true, category: 'mutt' });
        }
        clampTribute(t);
        return;
    }

    // First hit at full damage, each additional connecting mutt adds less,
    // bounded so a big pack raises danger without guaranteeing a kill.
    let base = scaledDamage(ctx, mutt);
    // `swarm` hits harder for every other tribute standing in the same zone —
    // it punishes exactly the alliance-clustering that makes every other
    // encounter safer.
    if (mutt.role === 'swarm') {
        const occupants = getAlive(ctx.state).filter(o => o.zone === t.zone).length;
        const scale = Math.min(MUTTS.swarmDamageCap, 1 + Math.max(0, occupants - 1) * MUTTS.swarmDamagePerAlly);
        base *= scale;
    }
    let damage = base;
    for (let i = 1; i < hits; i++) damage += base * Math.pow(MUTTS.packDamageFalloff, i);
    damage = Math.min(damage, base * MUTTS.packDamageCap);

    applyDamage(ctx, t, Math.round(damage), { cause: `Torn apart by ${mutt.name}`, kind: 'mutt' });
    applyMuttInjuries(t, mutt);
    trainProficiency(t, 'tracking');
    addZoneThreat(ctx.state, t, t.zone, MEMORY.hazardThreat * 2);

    tryFacesOfTheFallen(ctx, t, mutt);

    // "Barely breaks free" is only true if they did. Now that a pack can
    // actually finish someone, the encounter needs to be able to say so —
    // otherwise the feed reported an escape immediately before the cannon.
    const pack = packSize > 1 ? `a pack of ${mutt.name}` : mutt.name;
    if (t.health <= 0) {
        ctx.logEvent(
            `${mutt.name} catches ${t.name} in ${t.zone}, and there is no breaking free of it this time.`,
            [t.id],
            { important: true, category: 'mutt' }
        );
    } else {
        ctx.logEvent(
            `${t.name} is set upon by ${pack} in ${t.zone} and barely breaks free.`,
            [t.id],
            { important: true, category: 'mutt' }
        );
    }
    clampTribute(t);
    checkDeath(ctx, t, `Torn apart by ${mutt.name}`);
    // Surviving the Gamemakers' own animals recalibrates what frightens you.
    if (t.status === 'alive') earnTrait(ctx, t, 'Hardened');
    // §6.4: venom comes off the arena's own animals. Fighting free of a
    // venomous mutt sometimes leaves a tribute holding the gland — the raw
    // material a blade gets coated with.
    if (t.status === 'alive' && mutt.inflicts?.poisoned && ctx.rng.chance(POISONING.muttGlandChance)) {
        const gland = ITEMS.find(i => i.id === 'venom-gland');
        if (gland && !t.inventory.some(i => i.id === 'venom-gland')) {
            giveItem(t, { ...gland });
            ctx.logEvent(
                `${t.name} cuts the venom gland out of what ${mutt.name} left behind. It is not food. It is not for food.`,
                [t.id],
                { category: 'loot' }
            );
        }
    }

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
