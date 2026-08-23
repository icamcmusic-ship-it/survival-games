import { GameState, Objective, Tribute, Zone } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { ENDGAME, MEMORY, MOVEMENT, OBJECTIVES } from '../data/balance';
import { SimContext } from './context';
import { cycleOf, cyclesSinceContact, ensureMemory, rememberedBarren, rememberedRivals, rememberedThreat } from './memory';
import { getZone, hopsTo, nextHopToward, severedEdgeSet, zoneFeatures } from './map';
import { fearOf } from './fear';
import { breakTruce, breaksTruce, hasTruce } from './parley';
import { areLovers } from './alliance';
import { getRel } from './relationships';
import { SURVIVAL_TEXTS } from '../data/flavorText';
import { fill } from './encounters';

/**
 * Intentions.
 *
 * Every decision in the simulation used to be a fresh per-cycle scored roll.
 * Nothing persisted across cycles, so no tribute ever *decided* anything — they
 * re-rolled a destination lottery every turn. That produced a chronicle of
 * "Marvel moved to Sector 2" when the interesting sentence was always "Marvel is
 * hunting Rue", and it made behaviour unreadable: you could not tell why anyone
 * went anywhere because there was no why, only a weighting.
 *
 * An objective is chosen from need, archetype and memory, and then *held* —
 * re-evaluated only when it expires or something invalidates it. That single
 * property is what turns a weighted wander into a plan.
 */

/** Human-readable line for the chronicle when a tribute forms a new intention. */
function announce(ctx: SimContext, t: Tribute, objective: Objective) {
    const name = (id: string) => ctx.state.tributes.find(o => o.id === id)?.name ?? 'someone';
    switch (objective.kind) {
        case 'hunt':
            ctx.logEvent(
                `${t.name} stops pretending to forage and starts hunting ${name(objective.targetId)}.`,
                [t.id, objective.targetId],
                { important: true, category: 'travel' }
            );
            return;
        case 'reach': {
            const why = {
                water: 'looking for water',
                shelter: 'looking for somewhere to sleep',
                feast: 'heading for the feast',
                ally: 'trying to rejoin their allies',
                forage: 'looking for anything to eat',
            }[objective.reason];
            ctx.logEvent(
                `${t.name} sets off for ${objective.zone}, ${why}.`,
                [t.id],
                { category: 'travel' }
            );
            return;
        }
        case 'hold':
            ctx.logEvent(
                `${t.name} decides ${objective.zone} is worth holding and digs in.`,
                [t.id],
                { category: 'survival' }
            );
            return;
        case 'flee':
            ctx.logEvent(
                fill(ctx.pickText(SURVIVAL_TEXTS.flee), { tribute: t.name, zone: objective.from }),
                [t.id],
                { category: 'travel' }
            );
            return;
        case 'protect':
            ctx.logEvent(
                `${t.name} decides ${name(objective.wardId)} is not dying on their watch.`,
                [t.id, objective.wardId],
                { important: true, category: 'alliance' }
            );
            return;
        default:
            return;
    }
}

/** Whether the intention still makes sense, or the world has moved on without it. */
export function isObjectiveValid(ctx: SimContext, t: Tribute): boolean {
    const objective = t.objective;
    if (!objective || objective.kind === 'survive') return false;

    const cycle = cycleOf(ctx.state);
    if ('expires' in objective && cycle >= objective.expires) return false;

    const collapsed = ctx.state.collapsedZones ?? [];
    const living = (id: string) => ctx.state.tributes.find(o => o.id === id && o.status === 'alive');

    switch (objective.kind) {
        case 'hunt':
            // No point hunting a corpse, or someone you have become too
            // frightened of to follow through on.
            return !!living(objective.targetId)
                && fearOf(t, objective.targetId) < OBJECTIVES.huntAbandonFear;
        case 'protect':
            return !!living(objective.wardId);
        case 'reach':
            // Arrived, or the ground went out of bounds under the destination.
            return t.zone !== objective.zone && !collapsed.includes(objective.zone);
        case 'hold':
            return t.zone === objective.zone && !collapsed.includes(objective.zone);
        case 'flee':
            return t.zone === objective.from;
        default:
            return false;
    }
}

/** Picks the most pressing thing this tribute could be trying to do right now. */
/**
 * §3.3: "am I winning?" — a coarse edge in [-1, 1] against the current field.
 * Only meaningful once the field is small enough to count; callers gate on
 * ENDGAME.fieldSize themselves.
 */
export function endgameEdge(state: GameState, t: Tribute): number {
    const field = state.tributes.filter(o => o.status === 'alive' && o.id !== t.id);
    if (field.length === 0) return 1;
    const avg = (f: (o: Tribute) => number) => field.reduce((sum, o) => sum + f(o), 0) / field.length;
    let edge = 0;
    edge += (t.health - avg(o => o.health)) / 200;
    edge += (t.kills - avg(o => o.kills)) / 6;
    edge += (t.inventory.some(i => i.type === 'weapon') ? 0.15 : -0.2);
    const allies = state.tributes.filter(o =>
        o.status === 'alive' && o.id !== t.id && o.allianceId !== undefined && o.allianceId === t.allianceId).length;
    edge += Math.min(0.2, allies * 0.1);
    edge += (t.inventory.some(i => i.type === 'food') && t.inventory.some(i => i.type === 'water')) ? 0.05 : -0.05;
    return Math.max(-1, Math.min(1, edge));
}

function chooseObjective(ctx: SimContext, t: Tribute, here: Tribute[]): Objective {
    const state = ctx.state;
    const cycle = cycleOf(state);
    const arch = ARCHETYPES[t.archetype];
    const collapsed = state.collapsedZones ?? [];
    const active = state.arena.zones.filter(z => !collapsed.includes(z.name));
    const expiry = (cycles: number) => cycle + cycles;

    // 0. The forced finale outranks everything, including fear. The arena has
    //    been drained down to one place to be, so there is no decision left to
    //    model — go there, and if the other finalist is already standing in it,
    //    the intention is them. See `forceFinale` in phases/dayNight.ts.
    if (state.finaleZone) {
        const rival = state.tributes.find(o =>
            o.status === 'alive' && o.id !== t.id && !areLovers(t, o));
        if (rival && rival.zone === t.zone) {
            return { kind: 'hunt', targetId: rival.id, expires: expiry(OBJECTIVES.huntCycles) };
        }
        if (t.zone !== state.finaleZone) {
            return { kind: 'reach', zone: state.finaleZone, reason: 'feast', expires: expiry(OBJECTIVES.reachCycles) };
        }
    }

    // 1. Get out. Standing somewhere they are badly outmatched beats every
    //    other consideration a tribute has.
    const hostilesHere = here.filter(o =>
        o.id !== t.id && (o.allianceId === undefined || o.allianceId !== t.allianceId));
    const scaredOf = hostilesHere.some(o => fearOf(t, o.id) >= OBJECTIVES.fleeFear);
    if (scaredOf && t.stance !== 'Aggressive') {
        return { kind: 'flee', from: t.zone, expires: expiry(OBJECTIVES.fleeCycles) };
    }

    // 2. Thirst. The most reliable killer that a tribute can actually do
    //    something about, and the clearest possible intention.
    if (t.vitals.thirst > MOVEMENT.thirstUrgency && !t.inventory.some(i => i.type === 'water')) {
        // §7.7: a drinkable spring on a moor counts; a brine sump does not —
        // the same waterSource read the hydration layer itself uses.
        const water = nearestZoneMatching(ctx, t, active, z => zoneFeatures(z).waterSource === true);
        if (water && water !== t.zone) {
            return { kind: 'reach', zone: water, reason: 'water', expires: expiry(OBJECTIVES.reachCycles) };
        }
    }

    // 2b. Hunger. The second-most reliable status killer, and until now the
    //     one need that produced no intention at all: a starving tribute in a
    //     stripped zone just kept rolling forage against nothing. If where they
    //     stand is (believed) barren or was never rich, walk somewhere that
    //     still has food in it.
    if (t.vitals.hunger > MOVEMENT.hungerUrgency && !t.inventory.some(i => i.type === 'food')) {
        const hereZone = getZone(state.arena, t.zone);
        const hereBarren = rememberedBarren(state, t, t.zone) >= MOVEMENT.forageBarrenThreshold
            || (hereZone !== undefined && hereZone.resources < MOVEMENT.forageMinResources);
        if (hereBarren) {
            const larder = nearestZoneMatching(ctx, t, active, z =>
                z.resources >= MOVEMENT.forageMinResources
                && rememberedBarren(state, t, z.name) < MOVEMENT.forageBarrenThreshold);
            if (larder && larder !== t.zone) {
                return { kind: 'reach', zone: larder, reason: 'forage', expires: expiry(OBJECTIVES.reachCycles) };
            }
        }
    }

    // 2c. The group. A member split off from their alliance — a border
    //     collapse, a feast, a fight that scattered — makes getting back to
    //     them a stated plan, not just a silent pull in the movement layer.
    if (t.allianceId) {
        const mates = state.tributes.filter(o =>
            o.status === 'alive' && o.id !== t.id && o.allianceId === t.allianceId);
        const together = mates.some(o => o.zone === t.zone);
        if (mates.length > 0 && !together) {
            const known = mates.find(o => cyclesSinceContact(state, t, o.id) <= MEMORY.sightingLifetime * 2);
            if (known && !collapsed.includes(known.zone)) {
                return { kind: 'reach', zone: known.zone, reason: 'ally', expires: expiry(OBJECTIVES.reachCycles) };
            }
        }
    }

    // 3. The feast, once it is called: a scheduled reason for the whole cast to
    //    converge that the movement layer previously knew nothing about.
    if (state.feastDay !== undefined && state.day >= state.feastDay - 1) {
        const cornucopia = active.find(z => /cornucopia/i.test(z.name));
        if (cornucopia && cornucopia.name !== t.zone && arch.aggression > -0.2) {
            return { kind: 'reach', zone: cornucopia.name, reason: 'feast', expires: expiry(OBJECTIVES.reachCycles) };
        }
    }

    // 4. Somebody to kill. Either sworn, or simply the nearest rival a hunter
    //    has a live sighting of.
    const mem = ensureMemory(t);
    const sworn = mem.vengeance
        .map(id => state.tributes.find(o => o.id === id && o.status === 'alive'))
        .find(o => !!o);
    if (sworn) {
        return { kind: 'hunt', targetId: sworn.id, expires: expiry(OBJECTIVES.huntCycles) };
    }
    // §3.3: in the endgame, a tribute who concludes they win a straight fight
    // hunts whatever their stance says — waiting is how favourites get
    // whittled down by attrition they were built to shortcut.
    const fieldCount = state.tributes.filter(o => o.status === 'alive').length;
    const countingTheField = fieldCount <= ENDGAME.fieldSize;
    const edge = countingTheField ? endgameEdge(state, t) : 0;
    if (t.stance === 'Aggressive' || (countingTheField && edge > ENDGAME.hunterEdge)) {
        // Only somebody they have actually seen recently — a hunter with no
        // sighting is not tracking anyone, they are just walking around angry.
        // `rememberedRivals(state, t, o.zone) > 0` alone only confirms that
        // *someone* hostile was in that zone; picking `o` by their live
        // position on top of that would name the specific person the hunter
        // was never actually shown. `cyclesSinceContact` is identity-scoped.
        const visible = state.tributes.filter(o =>
            o.status === 'alive' && o.id !== t.id
            && (o.allianceId === undefined || o.allianceId !== t.allianceId)
            && rememberedRivals(state, t, o.zone) > 0
            && cyclesSinceContact(state, t, o.id) <= MEMORY.sightingLifetime
            && fearOf(t, o.id) < OBJECTIVES.huntAbandonFear);
        // A standing truce is worth most exactly here — deciding who to go
        // looking for. It used to be consulted only in `resolvePairEncounter`,
        // so a truce held during a chance meeting and was silently irrelevant
        // the moment either party went hunting, which is backwards.
        //
        // But a truce is a promise, not a shield: filtering these out entirely
        // would make it unbreakable, and the one thing `parley.ts` says about a
        // truce is that it is "the one that can later be broken". So someone
        // under truce is off the list *unless* they are the best target on it
        // and the hunter decides, then and there, to go back on their word.
        // That decision is the break.
        const candidates = visible.filter(o => !hasTruce(state, t, o.id));
        const underTruce = visible.filter(o => hasTruce(state, t, o.id));
        if (candidates.length > 0 || underTruce.length > 0) {
            // Hunting is opportunism, the same arithmetic pickBetrayalTarget
            // already does: the wounded loner carrying a medkit outranks the
            // healthy Career with a trident. Weigh how winnable the fight looks
            // (from what the hunter last saw, not the live sheet), the loot,
            // and the grudge — minus how much this person frightens them.
            const score = (o: Tribute) => {
                const winnable = (100 - o.health)
                    + (o.inventory.some(i => i.type === 'weapon') ? 0 : 30)
                    + (o.allianceId === undefined ? 15 : 0);
                const loot = o.inventory.reduce((sum, i) => sum + i.value, 0) * 0.3;
                const grudge = Math.max(0, -getRel(t, o.id)) * 0.5;
                return winnable + loot + grudge - fearOf(t, o.id);
            };
            const best = (pool: Tribute[]) =>
                pool.reduce((top, o) => (score(o) > score(top) ? o : top));
            const target = candidates.length > 0 ? best(candidates) : undefined;
            // Would breaking their word buy them a better mark than anyone they
            // could hunt honestly? Only then is it even considered, and only
            // then is the roll made — so a truce is never broken idly, and
            // never over someone who was not worth it.
            const tempting = underTruce.length > 0 ? best(underTruce) : undefined;
            if (tempting && (!target || score(tempting) > score(target))
                && breaksTruce(ctx, t, tempting)) {
                breakTruce(ctx, t, tempting);
                return { kind: 'hunt', targetId: tempting.id, expires: expiry(OBJECTIVES.huntCycles) };
            }
            // No honest mark and no truce worth breaking: fall through to the
            // objectives below rather than forcing a hunt that has no target.
            if (target) {
                return { kind: 'hunt', targetId: target.id, expires: expiry(OBJECTIVES.huntCycles) };
            }
        }
    }

    // 5. Somebody to keep alive. Protectors are defined by this and had no way
    //    to express it.
    if (arch.allianceAffinity > 0.15 || t.archetype === 'protector' || (t.protectorBonds?.length ?? 0) > 0) {
        const ward = state.tributes.find(o =>
            o.status === 'alive' && o.id !== t.id
            // §4.5: a sworn protector bond outranks the alliance test — a
            // protector does not need a charter to refuse to leave their ward.
            && ((t.protectorBonds?.includes(o.id))
                || (o.allianceId !== undefined && o.allianceId === t.allianceId))
            && (o.health < OBJECTIVES.wardHealth || getRel(t, o.id) > OBJECTIVES.wardBond));
        if (ward) {
            return { kind: 'protect', wardId: ward.id, expires: expiry(OBJECTIVES.protectCycles) };
        }
    }

    // 6. Somewhere to sleep it off — or somewhere to get warm before the
    // cold finishes what it started (§7.7).
    if (t.vitals.fatigue > MOVEMENT.shelterUrgency || t.health < OBJECTIVES.holeUpHealth || t.injuries.frostbitten) {
        const shelter = nearestZoneMatching(ctx, t, active, z => z.terrain === 'forest' || z.terrain === 'ruins');
        if (shelter && shelter !== t.zone) {
            return { kind: 'reach', zone: shelter, reason: 'shelter', expires: expiry(OBJECTIVES.reachCycles) };
        }
        if (shelter === t.zone) {
            return { kind: 'hold', zone: t.zone, expires: expiry(OBJECTIVES.holdCycles) };
        }
    }

    // 7. Ground worth standing on: good forage, no bad memories, nobody else in it.
    const current = getZone(state.arena, t.zone);
    if (current && rememberedThreat(state, t, t.zone) < OBJECTIVES.holdMaxThreat
        && hostilesHere.length === 0 && current.resources > OBJECTIVES.holdMinResources) {
        return { kind: 'hold', zone: t.zone, expires: expiry(OBJECTIVES.holdCycles) };
    }

    return { kind: 'survive' };
}

/** Closest zone satisfying a predicate, by hops over the adjacency graph. */
function nearestZoneMatching(
    ctx: SimContext,
    t: Tribute,
    active: Zone[],
    predicate: (z: Zone) => boolean,
): string | undefined {
    const matches = active.filter(predicate);
    if (matches.length === 0) return undefined;
    if (matches.some(z => z.name === t.zone)) return t.zone;

    const collapsed = ctx.state.collapsedZones ?? [];
    const severed = severedEdgeSet(ctx.state);
    // Actually nearest by hop count first, and least dreaded as the tiebreak —
    // not threat alone, which used to send a thirsty tribute past a close lake
    // to reach a calmer one three zones further out.
    const routable = matches
        .map(z => ({ z, hops: hopsTo(ctx.state.arena, t.zone, z.name, collapsed, severed) }))
        .filter((m): m is { z: Zone; hops: number } => m.hops !== undefined)
        .sort((a, b) =>
            a.hops - b.hops
            || rememberedThreat(ctx.state, t, a.z.name) - rememberedThreat(ctx.state, t, b.z.name));
    return routable[0]?.z.name;
}

/**
 * Re-evaluates the tribute's intention, but only when the current one has run
 * out or stopped making sense. Holding is the entire point — an objective
 * recomputed every cycle is just a mood with extra steps.
 */
export function updateObjective(ctx: SimContext, t: Tribute, here: Tribute[]) {
    if (isObjectiveValid(ctx, t)) return;

    const previous = t.objective;
    const next = chooseObjective(ctx, t, here);
    t.objective = next;

    // Only narrate genuinely new intentions, and never the null one — a line
    // every time someone lapses back to "survive" would drown the feed.
    if (next.kind !== 'survive' && !sameObjective(previous, next)) {
        announce(ctx, t, next);
    }
}

function sameObjective(a: Objective | undefined, b: Objective): boolean {
    if (!a || a.kind !== b.kind) return false;
    if (a.kind === 'hunt' && b.kind === 'hunt') return a.targetId === b.targetId;
    if (a.kind === 'protect' && b.kind === 'protect') return a.wardId === b.wardId;
    if (a.kind === 'reach' && b.kind === 'reach') return a.zone === b.zone;
    if (a.kind === 'hold' && b.kind === 'hold') return a.zone === b.zone;
    if (a.kind === 'flee' && b.kind === 'flee') return a.from === b.from;
    return true;
}

/**
 * The zone this tribute's objective wants them in, if any. Hunt and protect
 * resolve through the target's *believed* position rather than their true one —
 * a hunter chases the last place they saw someone, not a live tracking beacon.
 */
export function objectiveZone(ctx: SimContext, t: Tribute): string | undefined {
    const objective = t.objective;
    if (!objective) return undefined;
    const state = ctx.state;

    switch (objective.kind) {
        case 'reach':
            return objective.zone;
        case 'hold':
            return objective.zone;
        case 'hunt': {
            const target = state.tributes.find(o => o.id === objective.targetId && o.status === 'alive');
            if (!target) return undefined;
            // Only if they have a live sighting of that zone. Otherwise the
            // hunter genuinely does not know where their quarry went.
            return rememberedRivals(state, t, target.zone) > 0 ? target.zone : undefined;
        }
        case 'protect': {
            const ward = state.tributes.find(o => o.id === objective.wardId && o.status === 'alive');
            if (!ward) return undefined;
            // Same rule as 'hunt' above: a recent sighting, not a live position —
            // a protector cannot rush to a ward's side sight-unseen.
            if (ward.zone !== t.zone && cyclesSinceContact(state, t, ward.id) > MEMORY.sightingLifetime) return undefined;
            return ward.zone;
        }
        default:
            return undefined;
    }
}

/**
 * The next step toward the objective, or undefined to let the normal wander
 * scoring decide. A 'flee' objective has no destination, only a direction:
 * away.
 */
export function objectiveStep(ctx: SimContext, t: Tribute, options: Zone[]): Zone | undefined {
    const objective = t.objective;
    if (!objective || objective.kind === 'survive') return undefined;
    const collapsed = ctx.state.collapsedZones ?? [];

    if (objective.kind === 'hold') {
        // Holding is expressed by not moving, which the caller handles.
        return undefined;
    }

    if (objective.kind === 'flee') {
        // Anywhere but here, preferring ground they have no bad memory of.
        const away = [...options]
            .filter(z => z.name !== objective.from)
            .sort((a, b) =>
                rememberedThreat(ctx.state, t, a.name) - rememberedThreat(ctx.state, t, b.name));
        return away[0];
    }

    const target = objectiveZone(ctx, t);
    if (!target || target === t.zone) return undefined;
    const hop = nextHopToward(ctx.state.arena, t.zone, target, collapsed, severedEdgeSet(ctx.state));
    if (!hop) return undefined;
    return options.find(z => z.name === hop);
}

/** True when the objective says to stay put this cycle. */
export function objectiveHolds(t: Tribute): boolean {
    return t.objective?.kind === 'hold';
}

/** Short label for the UI, so a reader can see what a tribute is trying to do. */
export function objectiveLabel(state: { tributes: Tribute[] }, t: Tribute): string {
    const objective = t.objective;
    if (!objective || objective.kind === 'survive') return 'Surviving';
    const name = (id: string) => state.tributes.find(o => o.id === id)?.name ?? 'someone';
    switch (objective.kind) {
        case 'hunt': return `Hunting ${name(objective.targetId)}`;
        case 'protect': return `Protecting ${name(objective.wardId)}`;
        case 'hold': return `Holding ${objective.zone}`;
        case 'flee': return `Fleeing ${objective.from}`;
        case 'reach': {
            const why = {
                water: 'for water', shelter: 'for shelter', feast: 'for the feast',
                ally: 'to reach an ally', forage: 'to forage',
            }[objective.reason];
            return `Making for ${objective.zone} ${why}`;
        }
        default: return 'Surviving';
    }
}
