import { Arena, EdgeRule, GameState, Tribute, Zone, ZoneFeatures, attr } from '../models/types';
import { traitMod } from '../data/traits';
import { BLEEDING, EDGE_RULES, EDGE_TOLL, ZONE_EFFECTS, ZONES } from '../data/balance';
import { injuryGrade, openWound } from './wounds';
import { chokepointModifier, climbModifier, massOf } from './physique';
import { SimContext, getAlive } from './context';
import { resolveCombat } from './combat';

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
        return Math.max(1, (traitMod(t, 'highland') > 0 ? 1 : 2) + limping - Math.round(climbModifier(t)));
    }
    // §3.1: chokepoints, burrows and steep ground. A broad frame pays to get
    // through a gap; long limbs pay again, and a compact tribute climbs.
    const shape = dest.terrain === 'ruins' ? climbModifier(t) : chokepointModifier(t);
    return Math.max(1, Math.round(1 + limping - shape));
}

/**
 * `tolled` edges (`Arena.edgeRules`) charge a fatigue cost and/or a wound
 * roll the moment a tribute commits to crossing them — called once from
 * `beginMove` (dayNight.ts), which is the single place every kind of move
 * (immediate, multi-cycle transit, alliance-led) actually decides to cross
 * a specific edge.
 */
export function applyEdgeToll(ctx: SimContext, t: Tribute, from: string, to: string) {
    const key = edgeKey(from, to);
    const rule = ctx.state.arena.edgeRules?.[key];
    if (!rule) return;
    // §5.5: this is the one moment a crossing is real, so it is where the
    // wearing kinds wear and where a garrison gets its say.
    if (rule.kind === 'collapsing' || rule.kind === 'oneWayAfter') countCrossing(ctx, t, from, to, rule);
    if (rule.kind === 'contested') runGarrison(ctx, t, from, to);
    if (rule.kind !== 'tolled' || !rule.toll) return;
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

/**
 * §5.5: a crossing over a `collapsing` or `oneWayAfter` edge, counted. The
 * counting is the mechanic — a rope bridge is only interesting because every
 * tribute who uses it spends part of it, and the last one over is the one who
 * hears it go.
 */
function countCrossing(ctx: SimContext, t: Tribute, from: string, to: string, rule: EdgeRule) {
    const state = ctx.state;
    const key = edgeKey(from, to);
    state.edgeCrossings = state.edgeCrossings ?? {};
    const made = (state.edgeCrossings[key] ?? 0) + 1;
    state.edgeCrossings[key] = made;
    if (rule.kind === 'collapsing' && made >= (rule.crossings ?? EDGE_RULES.defaultCrossings)) {
        // Severing rather than book-keeping a zero: every other part of the
        // engine already understands a severed edge, and this one is permanent.
        severEdge(state, from, to);
        ctx.logEvent(
            `The crossing between ${from} and ${to} gives way behind ${t.name}. Whatever was holding it has finished letting go — nobody is coming that way again.`,
            [t.id],
            { important: true, zone: to, category: 'arena' }
        );
    }
    if (rule.kind === 'oneWayAfter' && made === (rule.after ?? EDGE_RULES.defaultAfter) && rule.from && rule.to) {
        ctx.logEvent(
            `The way between ${rule.from} and ${rule.to} has been worn into a one-way thing: down is still possible, back up is not.`,
            [t.id],
            { important: true, zone: rule.to, category: 'arena' }
        );
    }
}

/**
 * §5.5: a `contested` edge with somebody sitting on it. Structurally the pass
 * is open — the cost is the people at the far end of it, who either catch the
 * crosser or merely make them run.
 */
function runGarrison(ctx: SimContext, t: Tribute, from: string, to: string) {
    const state = ctx.state;
    const holder = state.garrisonedEdges?.[edgeKey(from, to)];
    if (!holder || holder === t.allianceId) return;
    const intercept = EDGE_RULES.garrisonInterceptBase - attr(t, 'stealth') * EDGE_RULES.garrisonInterceptPerStealth;
    const guards = getAlive(state)
        .filter(g => g.allianceId === holder && g.id !== t.id && (g.zone === to || g.zone === from));
    if (guards.length > 0 && ctx.rng.chance(intercept)) {
        const guard = guards.find(g => g.zone === to) ?? guards[0];
        ctx.logEvent(
            `${t.name} comes through the pass between ${from} and ${to} and finds ${guard.name} already standing in it.`,
            [t.id, guard.id],
            { important: true, zone: guard.zone, category: 'combat' }
        );
        resolveCombat(ctx, guard, t);
        return;
    }
    t.vitals.fatigue = Math.min(100, t.vitals.fatigue + EDGE_RULES.forcedCrossingFatigue);
    ctx.logEvent(
        `${t.name} goes through the held ground between ${from} and ${to} at a dead run, and is past it before anyone can put a hand out.`,
        [t.id],
        { zone: to, category: 'travel' }
    );
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
            acoustics: zone.features.acoustics ?? derivedAcoustics(zone, zone.features.cover),
        };
    }
    const cover = Math.max(0, Math.min(1, BASE_COVER[zone.terrain] + (h - 0.5) * 0.3));
    const elevation = zone.terrain === 'highland' || /ridge|cliff|tower|spire|peak|stair|terrace|hill/i.test(zone.name) || h > 0.85;
    const chokepoint = /pass|bridge|ravine|tunnel|gate|causeway|canal|strait|corridor/i.test(zone.name)
        || (!elevation && h >= 0.62 && h <= 0.78);
    const shelterQuality = Math.max(0, Math.min(1,
        BASE_SHELTER[zone.terrain] + cover * 0.25 + (/cave|cavern|tunnel|vault|cellar|shaft|bunker|lodge|cabin|shack|hollow/i.test(zone.name) ? 0.2 : 0)));
    return { cover, elevation, chokepoint, waterSource: derivedWater, shelterQuality, acoustics: derivedAcoustics(zone, cover) };
}

/**
 * §5.2: how far sound carries here, when the arena has not said.
 *
 * Hard, enclosed, empty ground throws every footfall around it — a canyon, a
 * vault, a tunnel. Deep cover swallows it: timber, moss, reeds, snow. Any
 * arena may override this per zone via `ZoneFeatures.acoustics` rather than
 * the effect existing only inside one hand-authored map.
 */
function derivedAcoustics(zone: Zone, cover: number): number {
    const hard = /canyon|gorge|ravine|gallery|hall|vault|tunnel|shaft|cathedral|chamber|cistern|spire|cliff|throat|stair/i.test(zone.name)
        || zone.terrain === 'ruins' || zone.terrain === 'highland';
    const base = hard ? 1.35 : 1;
    // Cover is the muffler: full cover takes a third off whatever the ground
    // would otherwise carry.
    return Math.max(0.55, Math.min(1.6, base - cover * 0.35));
}

/**
 * §13.3: zones that carry no light source of their own.
 *
 * A property of the two hand-authored arenas built around absence of light,
 * rather than of zones in general — so it is a small table here rather than a
 * flag on `Zone` that thirty-eight arenas would have to answer. An `ambusher`
 * mutt written for the dark is eligible in one of these at noon, and the
 * arena's own signature reads the same list, so the two cannot drift apart.
 */
const UNLIT_ZONES: Record<string, (zone: string) => boolean> = {
    // The Undermere. Everything except the sinkhole floor (open to the sky
    // through the collapse that made it) and the fungus-rich hollow.
    karst: zone => zone !== 'The Cornucopia (Sinkhole Floor)' && zone !== 'The Glowmoss Hollow',
};

export function isUnlitZone(arena: Arena, zone: string): boolean {
    const rule = UNLIT_ZONES[arena.id];
    return rule !== undefined && rule(zone);
}

/**
 * §5.2: the acoustics of a zone by name, for the stealth and encounter
 * layers. Defaults to 1 for anything that has not been derived or authored.
 */
export function zoneAcoustics(arena: Arena, zoneName: string): number {
    const zone = getZone(arena, zoneName);
    return zone ? (zoneFeatures(zone).acoustics ?? 1) : 1;
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
 * §5.5: everything traversal needs to answer for the state-dependent edge
 * kinds — the run's crossing counts, and (where there is one) the specific
 * tribute doing the walking. Both optional: omitting them asks for the graph
 * as a stranger sees it.
 */
export interface EdgeContext {
    state?: GameState;
    tribute?: Tribute;
}

/**
 * Whether an edge can be crossed from `a` to `b` right now, per `Arena.edgeRules`.
 * `oneWay` only allows its declared direction; `timeGated` only allows its
 * declared time (open when `time` isn't supplied — a caller that doesn't
 * track time of day gets the ungated graph rather than a silent block).
 * `tolled` edges are always passable — the toll itself is a fatigue/wound
 * cost applied where a crossing actually commits (`beginMove` in dayNight.ts),
 * not a reachability question. So is `contested`: an occupied pass is walkable,
 * it is just expensive, and the garrison is resolved at the crossing.
 *
 * §5.5: the remaining kinds are not pure over arena data — `collapsing` and
 * `oneWayAfter` read how often the edge has been used, `hidden` reads who is
 * asking — so traversal takes an optional `EdgeContext`. Callers that have
 * neither get the conservative graph rather than a wrong one.
 */
function edgeAllowed(arena: Arena, a: string, b: string, time?: 'day' | 'night', who?: EdgeContext): boolean {
    const key = edgeKey(a, b);
    const rule = arena.edgeRules?.[key];
    if (!rule) return true;
    switch (rule.kind) {
        case 'oneWay': return rule.from === a && rule.to === b;
        case 'timeGated': return time === undefined || rule.gatedTime === undefined || rule.gatedTime === time;
        case 'collapsing': return crossingsLeft(who?.state, key, rule) > 0;
        case 'oneWayAfter':
            return crossingsMade(who?.state, key) < (rule.after ?? EDGE_RULES.defaultAfter)
                || (rule.from === a && rule.to === b);
        // §5.5: a way nobody has found is a way nobody can walk. Without a
        // traveller to ask — pathfinding, AI planning, an arena signature
        // reading its own map — the conservative answer is "shut", so nothing
        // routes a stranger through a passage they have never heard of.
        case 'hidden': return !!who?.tribute?.knownEdges?.includes(key);
        default: return true;
    }
}

/** Crossings already made over an edge this run. */
function crossingsMade(state: GameState | undefined, key: string): number {
    return state?.edgeCrossings?.[key] ?? 0;
}

/** §5.5: crossings a `collapsing` edge has left in it. */
function crossingsLeft(state: GameState | undefined, key: string, rule: EdgeRule): number {
    return (rule.crossings ?? EDGE_RULES.defaultCrossings) - crossingsMade(state, key);
}

// Zones reachable in one move from `from`, excluding collapsed ones.
// Empty when every neighbour is collapsed or severed — a tribute walled into
// a dead end holds position (and takes the border-collapse pressure that is
// already meant to punish that) rather than teleporting across the arena.
export function reachableZones(arena: Arena, from: string, collapsed: string[], severed?: Set<string>, time?: 'day' | 'night', who?: EdgeContext): Zone[] {
    const active = arena.zones.filter(z => !collapsed.includes(z.name));
    const current = getZone(arena, from);
    if (!current) return active;
    return active.filter(z =>
        current.adjacent.includes(z.name)
        && !(severed && severed.has(edgeKey(from, z.name)))
        && edgeAllowed(arena, from, z.name, time, who));
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
    who?: EdgeContext,
): string | undefined {
    if (from === target) return undefined;
    const blocked = new Set(collapsed);
    // Note: the search below walks the BFS edge as (name -> neighbor) but a
    // route is actually walked the other way (neighbor -> name, from the
    // destination out to `from`) — `edgeAllowed` is checked in the direction
    // a tribute would actually cross it, `neighbor -> name`, not the BFS's own.
    const cut = (a: string, b: string) => (!!severed && severed.has(edgeKey(a, b))) || !edgeAllowed(arena, b, a, time, who);
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
export function hopsTo(arena: Arena, from: string, target: string, collapsed: string[], severed?: Set<string>, time?: 'day' | 'night', who?: EdgeContext): number | undefined {
    if (from === target) return 0;
    const blocked = new Set(collapsed);
    const cut = (a: string, b: string) => (!!severed && severed.has(edgeKey(a, b))) || !edgeAllowed(arena, a, b, time, who);
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
    const effects = state.zoneEffects?.[zone.name] ?? [];
    const blooming = effects.some(e => e.kind === 'blooming');
    const lifted = blooming ? Math.min(1, base + ZONE_EFFECTS.bloomingResourceLift) : base;
    // §7: an infestation is the bloom's inverse — nothing here is worth
    // eating while the zone is crawling, however much of it there is.
    const swarming = effects.some(e => e.kind === 'swarming');
    return swarming ? lifted * ZONE_EFFECTS.swarmingResourcePenalty : lifted;
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

/**
 * §5.5: hidden ways, and who knows about them.
 *
 * A hidden edge is worth more than any weapon in the arena — it is a route
 * out of a zone nobody else can follow you through. Finding one takes
 * standing still long enough to look: a tribute who has held the ground for a
 * cycle, with a head on them, may notice where the wall stops being a wall.
 * Called once per cycle.
 */
export function tickHiddenEdges(ctx: SimContext) {
    const state = ctx.state;
    const rules = state.arena.edgeRules;
    if (!rules) return;
    const hidden = Object.entries(rules).filter(([, r]) => r.kind === 'hidden').map(([key]) => key);
    if (hidden.length === 0) return;

    const alive = getAlive(state);
    for (const t of alive) {
        const settled = t.zoneHeldName === t.zone && (t.zoneHeld ?? 0) >= EDGE_RULES.discoverSettledCycles;
        if (!settled) continue;
        for (const key of hidden) {
            if (t.knownEdges?.includes(key)) continue;
            const [a, b] = key.split('|');
            if (t.zone !== a && t.zone !== b) continue;
            const chance = EDGE_RULES.discoverBase
                + attr(t, 'intelligence') * EDGE_RULES.discoverPerIntelligence
                + traitMod(t, 'awareness') * EDGE_RULES.discoverPerAwareness;
            if (!ctx.rng.chance(chance)) continue;
            learnEdge(t, key);
            const other = t.zone === a ? b : a;
            ctx.logEvent(
                `${t.name} finds the way out of ${t.zone} that is not on anybody's map — a seam, a gap, a stair — and it comes out in ${other}.`,
                [t.id],
                { important: true, zone: t.zone, category: 'arena' }
            );
        }
    }

    // §9.7: and knowledge travels. Allies sharing a camp talk, and a route
    // nobody else can walk is the single best thing an outer-district tribute
    // has to put on the table.
    for (const teller of alive) {
        if (!teller.knownEdges || teller.knownEdges.length === 0 || !teller.allianceId) continue;
        for (const listener of alive) {
            if (listener.id === teller.id || listener.allianceId !== teller.allianceId || listener.zone !== teller.zone) continue;
            for (const key of teller.knownEdges) {
                if (listener.knownEdges?.includes(key)) continue;
                if (!ctx.rng.chance(EDGE_RULES.tellAllyChance)) continue;
                tellAllyAboutEdge(ctx, teller, listener, key);
            }
        }
    }
}

/** Records that a tribute knows a hidden edge, without duplicating it. */
function learnEdge(t: Tribute, key: string) {
    t.knownEdges = t.knownEdges ?? [];
    if (!t.knownEdges.includes(key)) t.knownEdges.push(key);
}

/**
 * §9.7: one tribute hands another a hidden way. Exported so the wider
 * information-trading work (parley, camp talk) can spend a route as currency
 * rather than re-deriving what "telling somebody" means.
 */
export function tellAllyAboutEdge(ctx: SimContext, teller: Tribute, listener: Tribute, key: string) {
    if (listener.knownEdges?.includes(key)) return;
    learnEdge(listener, key);
    teller.sharedIntelWith = teller.sharedIntelWith ?? [];
    if (!teller.sharedIntelWith.includes(listener.id)) teller.sharedIntelWith.push(listener.id);
    const [a, b] = key.split('|');
    ctx.logEvent(
        `${teller.name} tells ${listener.name} how to get from ${a} to ${b} without going the long way. It is the most valuable thing either of them owns.`,
        [teller.id, listener.id],
        { zone: listener.zone, category: 'alliance' }
    );
}

/**
 * §5.5: garrisons. An alliance dug in on a chokepoint owns the `contested`
 * edges that touch it — which is what turns "we are camped at the bridge"
 * from a description into a toll booth. Claims lapse the moment nobody is
 * actually standing there. Called once per cycle.
 */
export function tickGarrisons(ctx: SimContext) {
    const state = ctx.state;
    const rules = state.arena.edgeRules;
    if (!rules) return;
    const contested = Object.entries(rules).filter(([, r]) => r.kind === 'contested').map(([key]) => key);
    if (contested.length === 0) return;
    const alive = getAlive(state);
    state.garrisonedEdges = state.garrisonedEdges ?? {};

    for (const key of contested) {
        const [a, b] = key.split('|');
        const holder = [a, b]
            .filter(name => {
                const zone = getZone(state.arena, name);
                return !!zone && zoneFeatures(zone).chokepoint;
            })
            .flatMap(name => alive.filter(t => t.zone === name && t.allianceId))
            .find(t => (t.fortifiedCycles ?? 0) >= EDGE_RULES.garrisonHoldCycles
                || (t.zoneHeldName === t.zone && (t.zoneHeld ?? 0) >= EDGE_RULES.garrisonHoldCycles));
        const current = state.garrisonedEdges[key];
        if (holder && holder.allianceId !== current) {
            state.garrisonedEdges[key] = holder.allianceId!;
            ctx.logEvent(
                `${holder.name}'s people have settled onto the ground between ${a} and ${b}. Anybody who wants through it now has to ask them.`,
                [holder.id],
                { important: true, zone: holder.zone, category: 'alliance' }
            );
        } else if (!holder && current) {
            delete state.garrisonedEdges[key];
            ctx.logEvent(
                `Nobody is holding the ground between ${a} and ${b} any more. The pass is just a pass again.`,
                [],
                { zone: a, category: 'arena' }
            );
        }
    }
}
