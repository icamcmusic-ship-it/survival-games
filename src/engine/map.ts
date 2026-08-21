import { Arena, GameState, Tribute, Zone, ZoneFeatures } from '../models/types';
import { traitMod } from '../data/traits';
import { PROFICIENCY, ZONES } from '../data/balance';
import { injuryGrade } from './wounds';
import { profOf } from './proficiency';

export function zoneNames(arena: Arena): string[] {
    return arena.zones.map(z => z.name);
}

export function getZone(arena: Arena, name: string): Zone | undefined {
    return arena.zones.find(z => z.name === name);
}

/**
 * §5.3: distances are no longer uniform. Every edge used to be one hop, so a
 * river crossing cost the same cycle a stroll did and a ten-zone arena was
 * traversable in a handful of cycles. Entering water, wetland or highland is
 * a two-cycle traversal — unless the tribute has the terrain in their blood
 * (the district terrain affinities, `traitMod` 'water'/'highland'), in which
 * case the crossing is ordinary ground to them.
 */
export function travelCost(t: Tribute, dest: Zone): number {
    // T-5/A-5: a badly injured leg finally slows a tribute down — a grade-2+
    // leg turns any crossing into a slow one. `injuries.legs` was a boolean
    // with no travel consequence at all.
    const limping = injuryGrade(t, 'legs') >= 2 ? 1 : 0;
    if (dest.terrain === 'water' || dest.terrain === 'wetland') {
        // T-2: crossings charged a cycle with no way to ever get better at
        // them. Enough practice in the water and a crossing is just ground.
        const swims = traitMod(t, 'water') > 0
            || profOf(t, 'swimming') >= PROFICIENCY.swimmingCrossingRelief;
        return (swims ? 1 : 2) + limping;
    }
    if (dest.terrain === 'highland') {
        return (traitMod(t, 'highland') > 0 ? 1 : 2) + limping;
    }
    return 1 + limping;
}

/** Deterministic per-name hash in [0, 1), so derived features are stable per zone. */
function nameHash(name: string): number {
    let h = 2166136261;
    for (let i = 0; i < name.length; i++) {
        h ^= name.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 1000) / 1000;
}

const BASE_COVER: Record<Zone['terrain'], number> = {
    forest: 0.8, wetland: 0.6, ruins: 0.6, highland: 0.35, water: 0.2, open: 0.1,
};

/**
 * §5.2: the zone's interior, hand-authored or derived. Derivation is
 * deterministic — terrain sets the baseline, the name jitters it — so the
 * same arena always has the same texture without any data edits, and an
 * arena author can override any zone by setting `features` in its data.
 */
export function zoneFeatures(zone: Zone): ZoneFeatures {
    if (zone.features) return zone.features;
    const h = nameHash(zone.name);
    const cover = Math.max(0, Math.min(1, BASE_COVER[zone.terrain] + (h - 0.5) * 0.3));
    const elevation = zone.terrain === 'highland' || /ridge|cliff|tower|spire|peak|stair|terrace|hill/i.test(zone.name) || h > 0.85;
    const chokepoint = /pass|bridge|ravine|tunnel|gate|causeway|canal|strait|corridor/i.test(zone.name)
        || (!elevation && h >= 0.62 && h <= 0.78);
    return { cover, elevation, chokepoint };
}

// Zones reachable in one move from `from`, excluding collapsed ones.
// Empty when every neighbour is collapsed or severed — a tribute walled into
// a dead end holds position (and takes the border-collapse pressure that is
// already meant to punish that) rather than teleporting across the arena.
export function reachableZones(arena: Arena, from: string, collapsed: string[], severed?: Set<string>): Zone[] {
    const active = arena.zones.filter(z => !collapsed.includes(z.name));
    const current = getZone(arena, from);
    if (!current) return active;
    return active.filter(z =>
        current.adjacent.includes(z.name) && !(severed && severed.has(edgeKey(from, z.name))));
}

/** Builds the severed-edge set once per cycle, for callers that need to pass it repeatedly. */
export function severedEdgeSet(state: GameState): Set<string> {
    return new Set(state.severedEdges ?? []);
}

export function severEdge(state: GameState, a: string, b: string) {
    state.severedEdges = state.severedEdges ?? [];
    const key = edgeKey(a, b);
    if (!state.severedEdges.includes(key)) state.severedEdges.push(key);
}

export function isSevered(state: GameState, a: string, b: string): boolean {
    return (state.severedEdges ?? []).includes(edgeKey(a, b));
}

/** Breadth-first search over the adjacency graph for the closest zone matching `safeNames`. */
export function nearestSafeZone(arena: Arena, from: string, safeNames: string[], severed?: Set<string>): string {
    if (safeNames.includes(from)) return from;
    const cut = (a: string, b: string) => !!severed && severed.has(edgeKey(a, b));
    const visited = new Set<string>([from]);
    let frontier = [from];
    while (frontier.length > 0) {
        const next: string[] = [];
        for (const name of frontier) {
            const zone = getZone(arena, name);
            if (!zone) continue;
            for (const neighbor of zone.adjacent) {
                if (visited.has(neighbor) || cut(name, neighbor)) continue;
                if (safeNames.includes(neighbor)) return neighbor;
                visited.add(neighbor);
                next.push(neighbor);
            }
        }
        frontier = next;
    }
    return safeNames[0] ?? from;
}

/**
 * The first step of a route from `from` to `target`, avoiding collapsed ground.
 *
 * `pickDestination` is a one-step weighted lottery, which is the right model for
 * a tribute wandering in search of water and cover and the wrong one for a
 * tribute who has decided to be somewhere. An objective two zones away needs a
 * route, not a coin flip that happens to lean the right way — otherwise
 * "I am going to the lake" is indistinguishable from drifting.
 *
 * Returns undefined when the target is unreachable or is where they already
 * stand, so the caller can fall back to wandering.
 */
export function nextHopToward(
    arena: Arena,
    from: string,
    target: string,
    collapsed: string[],
    severed?: Set<string>,
): string | undefined {
    if (from === target) return undefined;
    const blocked = new Set(collapsed);
    const cut = (a: string, b: string) => !!severed && severed.has(edgeKey(a, b));
    // Breadth-first from the destination outwards, so the first time the search
    // touches one of `from`'s neighbours we have a shortest route and that
    // neighbour is the step to take.
    const origin = getZone(arena, from);
    if (!origin) return undefined;
    const firstHops = new Set(origin.adjacent.filter(n => !blocked.has(n) && !cut(from, n)));
    if (firstHops.has(target)) return target;

    const visited = new Set<string>([target]);
    let frontier = [target];
    while (frontier.length > 0) {
        const next: string[] = [];
        for (const name of frontier) {
            const zone = getZone(arena, name);
            if (!zone) continue;
            for (const neighbor of zone.adjacent) {
                if (visited.has(neighbor) || blocked.has(neighbor) || cut(name, neighbor)) continue;
                if (firstHops.has(neighbor)) return neighbor;
                visited.add(neighbor);
                next.push(neighbor);
            }
        }
        frontier = next;
    }
    return undefined;
}

/** Shortest number of hops from `from` to `target` over the adjacency graph, or undefined if unreachable. */
export function hopsTo(arena: Arena, from: string, target: string, collapsed: string[], severed?: Set<string>): number | undefined {
    if (from === target) return 0;
    const blocked = new Set(collapsed);
    const cut = (a: string, b: string) => !!severed && severed.has(edgeKey(a, b));
    const visited = new Set<string>([from]);
    let frontier = [from];
    let hops = 0;
    while (frontier.length > 0) {
        hops++;
        const next: string[] = [];
        for (const name of frontier) {
            const zone = getZone(arena, name);
            if (!zone) continue;
            for (const neighbor of zone.adjacent) {
                if (visited.has(neighbor) || blocked.has(neighbor) || cut(name, neighbor)) continue;
                if (neighbor === target) return hops;
                visited.add(neighbor);
                next.push(neighbor);
            }
        }
        frontier = next;
    }
    return undefined;
}

/** Stable key for an undirected edge between two zones. */
export function edgeKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Records a tribute walking from one zone to another, for the map's traffic view. */
export function noteTraffic(state: GameState, from: string, to: string, count = 1) {
    if (from === to) return;
    state.zoneTraffic = state.zoneTraffic || {};
    const key = edgeKey(from, to);
    state.zoneTraffic[key] = (state.zoneTraffic[key] ?? 0) + count;
}

/** Traffic fades, so the map shows this cycle's movement rather than the run's. */
export function decayTraffic(state: GameState) {
    if (!state.zoneTraffic) return;
    Object.keys(state.zoneTraffic).forEach(key => {
        const next = state.zoneTraffic![key] * 0.55;
        if (next < 0.1) delete state.zoneTraffic![key];
        else state.zoneTraffic![key] = Math.round(next * 100) / 100;
    });
}

/**
 * Zone economy.
 *
 * A zone's printed `resources` is its potential, not its stock. Foraging draws
 * the stock down, so "the resource-rich forest" is a prize that runs out if
 * three tributes camp in it — and a reason to move on rather than a permanent
 * label. The arena grows it back slowly, so a zone abandoned for a few days is
 * worth returning to.
 */
export function depletionOf(state: GameState, zoneName: string): number {
    return state.zoneDepletion?.[zoneName] ?? 0;
}

/** The yield a tribute foraging here would actually see, after depletion. */
export function effectiveResources(state: GameState, zone: Zone | undefined): number {
    if (!zone) return 0;
    const remaining = 1 - depletionOf(state, zone.name);
    return zone.resources * Math.max(ZONES.minYieldFraction, remaining);
}

export function depleteZone(state: GameState, zoneName: string, amount: number) {
    state.zoneDepletion = state.zoneDepletion || {};
    const next = Math.min(1 - ZONES.minYieldFraction, depletionOf(state, zoneName) + amount);
    state.zoneDepletion[zoneName] = Math.round(next * 1000) / 1000;
}

/** Called once per cycle: the arena quietly restocks what nobody is stripping. */
export function regenerateZones(state: GameState) {
    if (!state.zoneDepletion) return;
    Object.keys(state.zoneDepletion).forEach(name => {
        const current = state.zoneDepletion![name];
        if (current <= 0) {
            delete state.zoneDepletion![name];
            return;
        }
        const next = Math.max(0, current - ZONES.regenPerCycle);
        if (next <= 0.001) delete state.zoneDepletion![name];
        else state.zoneDepletion![name] = Math.round(next * 1000) / 1000;
    });
}
