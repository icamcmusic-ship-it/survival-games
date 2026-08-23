import { Arena, GameState, Tribute, Zone, ZoneFeatures } from '../models/types';
import { traitMod } from '../data/traits';
import { BLEEDING, EDGE_TOLL, ZONE_EFFECTS, ZONES } from '../data/balance';
import { injuryGrade, openWound } from './wounds';
import { massOf } from './physique';
import { SimContext } from './context';

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
        return (traitMod(t, 'water') > 0 ? 1 : 2) + limping;
    }
    if (dest.terrain === 'highland') {
        return (traitMod(t, 'highland') > 0 ? 1 : 2) + limping;
    }
    return 1 + limping;
}

/**
 * `tolled` edges (`Arena.edgeRules`) charge a fatigue cost and/or a wound
 * roll the moment a tribute commits to crossing them — called once from
 * `beginMove` (dayNight.ts), which is the single place every kind of move
 * (immediate, multi-cycle transit, alliance-led) actually decides to cross
 * a specific edge.
 */
export function applyEdgeToll(ctx: SimContext, t: Tribute, from: string, to: string) {
    const rule = ctx.state.arena.edgeRules?.[edgeKey(from, to)];
    if (!rule || rule.kind !== 'tolled' || !rule.toll) return;
    if (rule.toll.fatigue) {
        // §11.6: the same rope costs different bodies differently — a heavy
        // frame hauls more of itself up it, and a bad limb pays again.
        const massSurcharge = Math.max(0, massOf(t)) * EDGE_TOLL.fatiguePerMass;
        const injurySurcharge = (injuryGrade(t, 'legs') + injuryGrade(t, 'arms')) * EDGE_TOLL.fatiguePerInjuryGrade;
        t.vitals.fatigue = Math.min(100, t.vitals.fatigue + rule.toll.fatigue + Math.round(massSurcharge + injurySurcharge));
    }
    if (rule.toll.woundChance && ctx.rng.chance(rule.toll.woundChance)) {
        openWound(t, BLEEDING.hazardSeverity);
        ctx.logEvent(`${t.name} pays for the crossing from ${from} to ${to} in blood.`, [t.id], { important: true, category: 'travel' });
    }
    // §11.6: some crossings consume gear — rope burned on the descent, a pack
    // lost to the current. The least-valued non-weapon item goes.
    if (rule.toll.itemCost) {
        const droppable = t.inventory.filter(i => i.type !== 'weapon');
        if (droppable.length > 0) {
            const lost = droppable.reduce((worst, i) => (i.value < worst.value ? i : worst));
            t.inventory = t.inventory.filter(i => i !== lost);
            ctx.logEvent(
                `The crossing from ${from} to ${to} takes ${t.name}'s ${lost.name} with it. That is the toll, paid in kind.`,
                [t.id],
                { category: 'travel' }
            );
        }
    }
    // §11.6 `timeCost` (extra cycles on the edge): applied by `beginMove` as
    // added transit, with a recovery penalty per extra cycle charged here.
    if (rule.toll.timeCost) {
        t.vitals.fatigue = Math.min(100, t.vitals.fatigue + rule.toll.timeCost * EDGE_TOLL.recoveryFatiguePerCycle);
    }
}

/** §11.6: extra transit cycles a tolled edge adds on top of terrain cost. */
export function edgeTimeCost(state: GameState, from: string, to: string): number {
    const rule = state.arena.edgeRules?.[edgeKey(from, to)];
    if (!rule || rule.kind !== 'tolled') return 0;
    return rule.toll?.timeCost ?? 0;
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

/** §5.6: how much shelter each terrain's interior offers before cover adjusts it. */
const BASE_SHELTER: Record<Zone['terrain'], number> = {
    forest: 0.6, wetland: 0.3, ruins: 0.7, highland: 0.25, water: 0.1, open: 0.1,
};

/** §5.6: names that read as a drinkable source even off water terrain. */
const WATER_SOURCE_NAME = /spring|creek|brook|stream|well|cistern|seep|tarn|loch|lake|river|falls|rain catch|meltwater|oasis|pond|pool/i;
/** ...and water-terrain names that are explicitly not drinkable. */
const FOUL_SOURCE_NAME = /brine|salt|sulphur|sulfur|boiling|steam|coolant|slurry|stagnant|black lead|sump/i;

/**
 * §5.2: the zone's interior, hand-authored or derived. Derivation is
 * deterministic — terrain sets the baseline, the name jitters it — so the
 * same arena always has the same texture without any data edits, and an
 * arena author can override any zone by setting `features` in its data.
 */
export function zoneFeatures(zone: Zone): ZoneFeatures {
    const h = nameHash(zone.name);
    const derivedWater = !FOUL_SOURCE_NAME.test(zone.name)
        && (zone.terrain === 'water' || zone.terrain === 'wetland' || WATER_SOURCE_NAME.test(zone.name));
    if (zone.features) {
        // Hand-authored features predate §5.6's fields: fill in what data
        // does not declare, so an authored `cover` never zeroes out shelter.
        return {
            ...zone.features,
            waterSource: zone.features.waterSource ?? derivedWater,
            shelterQuality: zone.features.shelterQuality
                ?? Math.max(0, Math.min(1, BASE_SHELTER[zone.terrain] + zone.features.cover * 0.25)),
        };
    }
    const cover = Math.max(0, Math.min(1, BASE_COVER[zone.terrain] + (h - 0.5) * 0.3));
    const elevation = zone.terrain === 'highland' || /ridge|cliff|tower|spire|peak|stair|terrace|hill/i.test(zone.name) || h > 0.85;
    const chokepoint = /pass|bridge|ravine|tunnel|gate|causeway|canal|strait|corridor/i.test(zone.name)
        || (!elevation && h >= 0.62 && h <= 0.78);
    const shelterQuality = Math.max(0, Math.min(1,
        BASE_SHELTER[zone.terrain] + cover * 0.25 + (/cave|cavern|tunnel|vault|cellar|shaft|bunker|lodge|cabin|shack|hollow/i.test(zone.name) ? 0.2 : 0)));
    return { cover, elevation, chokepoint, waterSource: derivedWater, shelterQuality };
}

/**
 * §5.6: zone names visible from this zone. High ground sees into every
 * adjacent zone that is not itself elevated — a watcher on a ridge counts
 * campfires in the valley; two ridges only glare at each other. Ground-level
 * zones see nothing beyond their own treeline.
 */
export function zoneSightlines(arena: Arena, zone: Zone): string[] {
    if (!zoneFeatures(zone).elevation) return [];
    return zone.adjacent.filter(n => {
        const neighbor = getZone(arena, n);
        return !!neighbor && !zoneFeatures(neighbor).elevation;
    });
}

/**
 * §7.1: whether this zone sits against the arena's force field. The border
 * is where the map runs out: the zones with the fewest ways in and out.
 * The Cornucopia is never a border zone, whatever its degree — it is the
 * centre by construction.
 */
export function hasForceField(arena: Arena, zoneName: string): boolean {
    const zone = getZone(arena, zoneName);
    if (!zone || zone === arena.zones[0]) return false;
    const degrees = arena.zones.slice(1).map(z => z.adjacent.length);
    const min = Math.min(...degrees);
    return zone.adjacent.length <= Math.max(2, min);
}

/**
 * Whether an edge can be crossed from `a` to `b` right now, per `Arena.edgeRules`.
 * `oneWay` only allows its declared direction; `timeGated` only allows its
 * declared time (open when `time` isn't supplied — a caller that doesn't
 * track time of day gets the ungated graph rather than a silent block).
 * `tolled` edges are always passable — the toll itself is a fatigue/wound
 * cost applied where a crossing actually commits (`beginMove` in dayNight.ts),
 * not a reachability question.
 */
function edgeAllowed(arena: Arena, a: string, b: string, time?: 'day' | 'night'): boolean {
    const rule = arena.edgeRules?.[edgeKey(a, b)];
    if (!rule) return true;
    switch (rule.kind) {
        case 'oneWay': return rule.from === a && rule.to === b;
        case 'timeGated': return time === undefined || rule.gatedTime === undefined || rule.gatedTime === time;
        default: return true;
    }
}

// Zones reachable in one move from `from`, excluding collapsed ones.
// Empty when every neighbour is collapsed or severed — a tribute walled into
// a dead end holds position (and takes the border-collapse pressure that is
// already meant to punish that) rather than teleporting across the arena.
export function reachableZones(arena: Arena, from: string, collapsed: string[], severed?: Set<string>, time?: 'day' | 'night'): Zone[] {
    const active = arena.zones.filter(z => !collapsed.includes(z.name));
    const current = getZone(arena, from);
    if (!current) return active;
    return active.filter(z =>
        current.adjacent.includes(z.name)
        && !(severed && severed.has(edgeKey(from, z.name)))
        && edgeAllowed(arena, from, z.name, time));
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
    time?: 'day' | 'night',
): string | undefined {
    if (from === target) return undefined;
    const blocked = new Set(collapsed);
    // Note: the search below walks the BFS edge as (name -> neighbor) but a
    // route is actually walked the other way (neighbor -> name, from the
    // destination out to `from`) — `edgeAllowed` is checked in the direction
    // a tribute would actually cross it, `neighbor -> name`, not the BFS's own.
    const cut = (a: string, b: string) => (!!severed && severed.has(edgeKey(a, b))) || !edgeAllowed(arena, b, a, time);
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
export function hopsTo(arena: Arena, from: string, target: string, collapsed: string[], severed?: Set<string>, time?: 'day' | 'night'): number | undefined {
    if (from === target) return 0;
    const blocked = new Set(collapsed);
    const cut = (a: string, b: string) => (!!severed && severed.has(edgeKey(a, b))) || !edgeAllowed(arena, a, b, time);
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
    const base = zone.resources * Math.max(ZONES.minYieldFraction, remaining);
    // §5.2: a bloom is the one effect that gives. It lifts the zone's yield
    // for as long as it lasts, on top of whatever depletion has taken —
    // stripped ground that blooms is worth foraging again, briefly.
    const blooming = (state.zoneEffects?.[zone.name] ?? []).some(e => e.kind === 'blooming');
    return blooming ? Math.min(1, base + ZONE_EFFECTS.bloomingResourceLift) : base;
}

export function depleteZone(state: GameState, zoneName: string, amount: number) {
    state.zoneDepletion = state.zoneDepletion || {};
    const next = Math.min(1 - ZONES.minYieldFraction, depletionOf(state, zoneName) + amount);
    state.zoneDepletion[zoneName] = Math.round(next * 1000) / 1000;
    // §5.10: remember the deepest this zone has been stripped, so its eventual
    // recovery can be narrated once instead of happening silently.
    state.zoneDepletionPeak = state.zoneDepletionPeak ?? {};
    state.zoneDepletionPeak[zoneName] = Math.max(state.zoneDepletionPeak[zoneName] ?? 0, state.zoneDepletion[zoneName]);
}

/** Depletion below which a badly stripped zone visibly reads as recovered. */
const REGROWTH_BEAT_BELOW = 0.2;
/** Peak depletion a zone must have hit for its recovery to be worth a line. */
const REGROWTH_BEAT_PEAK = 0.5;

/** Called once per cycle: the arena quietly restocks what nobody is stripping. */
export function regenerateZones(ctx: SimContext) {
    const state = ctx.state;
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

        // §5.10: the regrowth beat. A zone that was visibly stripped bare and
        // has grown most of the way back gets one line saying so — the arena
        // repairing itself is worth a camera cut, and it tells the field the
        // ground is worth returning to. Once per zone per recovery: the peak
        // record is cleared here and only rewritten by fresh depletion.
        const peak = state.zoneDepletionPeak?.[name] ?? 0;
        if (peak >= REGROWTH_BEAT_PEAK && next <= REGROWTH_BEAT_BELOW) {
            delete state.zoneDepletionPeak![name];
            ctx.logEvent(
                `The green returns to ${name}. What was picked over and trampled a few days ago is quietly worth foraging again.`,
                [],
                { zone: name, category: 'arena' }
            );
        }
    });
}
