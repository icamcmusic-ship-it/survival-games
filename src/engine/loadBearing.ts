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
        // §7.1: a structure past `collapseAt` is no longer waiting for somebody
        // to draw the right event — it is waiting for a bad hour. This is the
        // half of the primitive the module always described and never had, and
        // it is why "load-bearing" was a shipped mechanic that fired once in
        // 400 runs. Rolled before the occupation load so a zone that has just
        // tipped over the line gets its first chance next cycle, not this one.
        if (structuralFatigueOf(state, zone.name) >= LOAD_BEARING.collapseAt) {
            const odds = LOAD_BEARING.collapseChancePerCycle
                * (occupants > 0 ? LOAD_BEARING.collapseOccupiedMultiplier : 1);
            if (ctx.rng.chance(odds)) {
                collapseStructure(ctx, zone.name);
                return;
            }
        }
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
    // AUDIT-9 §5: the run-level count, for "is the arena coming apart" as
    // distinct from "was this person under one".
    state.structuresCollapsed = (state.structuresCollapsed ?? 0) + 1;
    ctx.logEvent(
        `Whatever was holding ${zoneName} up stops holding it up. The failure runs through the whole structure in about two seconds.`,
        caught.map(t => t.id),
        { important: true, zone: zoneName, category: 'hazard' }
    );
    caught.forEach(t => {
        const cause = `Buried in the collapse of ${zoneName}`;
        applyDamage(ctx, t, ctx.rng.nextInt(LOAD_BEARING.collapseDamageMin, LOAD_BEARING.collapseDamageMax), { cause, kind: 'arena', code: 'collapse' });
        openWound(t, BLEEDING.hazardSeverity);
        if (ctx.rng.chance(LOAD_BEARING.collapseCrushChance)) injure(t, ctx.rng.chance(LOAD_BEARING.collapseLegShare) ? 'legs' : 'torso');
        clampTribute(t);
        checkDeath(ctx, t, cause);
        if (t.status === 'alive') t.collapsesSurvived = (t.collapsesSurvived ?? 0) + 1;
    });
    if (state.structuralFatigue) state.structuralFatigue[zoneName] = 0;

    /*
     * AUDIT-9 §5: a building does not come down in isolation.
     *
     * The fatigue of the zone that failed is spent — the thing that was going
     * to fall has fallen — and until now that was the whole of it, so a
     * collapse was a terminal event for that corner of the map and nothing
     * followed from it. A structure that shared walls, footings or a street
     * with the one that just went is measurably worse off afterwards; the
     * audit's own arena backlog asks for exactly this ("collapse blocks street
     * below", "inspect load paths"), and it is the behaviour that makes a
     * second collapse in one Games a thing that can happen rather than a tail
     * that exists only on paper.
     *
     * `loadStructure` is already terrain-gated, so a collapse next to open
     * ground or forest does nothing and a collapse in a district of ruins
     * propagates — which is the correct shape.
     */
    const failed = getZone(state.arena, zoneName);
    failed?.adjacent.forEach(neighbour => {
        loadStructure(state, neighbour, LOAD_BEARING.adjacentLoadOnCollapse);
    });
}
