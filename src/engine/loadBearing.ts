import { GameState, Terrain } from '../models/types';
import { SimContext } from './context';
import { LOAD_BEARING } from '../data/balance';
import { getZone } from './map';
import { applyDamage, checkDeath } from './combat';
import { injure, openWound } from './wounds';
import { BLEEDING } from '../data/balance';
import { clampTribute } from './vitals';

/**
 * §5.8: structural fatigue, as shared engine surface.
 *
 * Every arena with a ruin in it hand-authored its own one-off collapse event,
 * which meant seven near-identical "___ Collapse" beats across the roster and
 * no way for an arena that had not written one to have a building come down.
 * The mechanic underneath all of them is the same and belongs in one place:
 * a structure carries load, occupation and violence add to it, and past a
 * threshold it is a question of when rather than whether.
 *
 * Nothing opts in. Any `ruins` zone in any arena accumulates it, the universal
 * "Load-Bearing" event reads it as a precondition, and `collapseStructure`
 * below is the payoff — the death-side of the mechanic, recorded as its own
 * cause ("Buried in the collapse") rather than as generic hazard damage.
 */

const RUINS: Terrain = 'ruins';

export function structuralFatigueOf(state: GameState, zone: string): number {
    return state.structuralFatigue?.[zone] ?? 0;
}

/** True once a zone is loaded enough for the collapse beat to be live. */
export function isLoadBearing(state: GameState, zone: string): boolean {
    return structuralFatigueOf(state, zone) >= LOAD_BEARING.liveAt;
}

/** Adds load to a zone, if it is the kind of ground that can carry any. */
export function loadStructure(state: GameState, zoneName: string, amount: number, arenaZoneTerrain?: Terrain) {
    const terrain = arenaZoneTerrain ?? getZone(state.arena, zoneName)?.terrain;
    if (terrain !== RUINS) return;
    state.structuralFatigue = state.structuralFatigue ?? {};
    const next = Math.min(1, structuralFatigueOf(state, zoneName) + amount);
    state.structuralFatigue[zoneName] = Math.round(next * 1000) / 1000;
}

/**
 * §5.8: noise as load. A fight inside a ruin does more to it in a minute than
 * a week of somebody sleeping there — this is what a caller reaches for when
 * combat resolves, so an arena's structures remember the violence done in
 * them without any arena having to author it.
 */
export function loadFromViolence(state: GameState, zoneName: string) {
    loadStructure(state, zoneName, LOAD_BEARING.perCombat);
}

/**
 * Per-cycle upkeep: occupation loads the structures people are standing in,
 * and everything else settles back a little. Call once per cycle after
 * movement, alongside `tickZoneEffects`.
 */
export function tickStructuralFatigue(ctx: SimContext) {
    const state = ctx.state;
    state.arena.zones.forEach(zone => {
        if (zone.terrain !== RUINS) return;
        const occupants = state.tributes.filter(t => t.status === 'alive' && t.zone === zone.name).length;
        if (occupants > 0) {
            loadStructure(state, zone.name, LOAD_BEARING.perOccupantCycle * occupants, zone.terrain);
            return;
        }
        // Nobody in it: old stone settles. It never goes back to nothing —
        // a structure that has been loaded once is never quite what it was.
        const current = structuralFatigueOf(state, zone.name);
        if (current <= 0) return;
        state.structuralFatigue![zone.name] =
            Math.round(Math.max(LOAD_BEARING.settleFloor, current - LOAD_BEARING.settlePerCycle) * 1000) / 1000;
    });
}

/**
 * §7: the death-side payoff. Everyone standing in the zone is under it when
 * it comes down; the fatigue is spent, because the thing that was going to
 * fall has fallen.
 */
export function collapseStructure(ctx: SimContext, zoneName: string) {
    const state = ctx.state;
    const caught = state.tributes.filter(t => t.status === 'alive' && t.zone === zoneName);
    ctx.logEvent(
        `Whatever was holding ${zoneName} up stops holding it up. The failure runs through the whole structure in about two seconds.`,
        caught.map(t => t.id),
        { important: true, zone: zoneName, category: 'hazard' }
    );
    caught.forEach(t => {
        const cause = `Buried in the collapse of ${zoneName}`;
        applyDamage(ctx, t, ctx.rng.nextInt(LOAD_BEARING.collapseDamageMin, LOAD_BEARING.collapseDamageMax), { cause, kind: 'arena' });
        openWound(t, BLEEDING.hazardSeverity);
        if (ctx.rng.chance(LOAD_BEARING.collapseCrushChance)) injure(t, ctx.rng.chance(0.5) ? 'legs' : 'torso');
        clampTribute(t);
        checkDeath(ctx, t, cause);
    });
    if (state.structuralFatigue) state.structuralFatigue[zoneName] = 0;
}
