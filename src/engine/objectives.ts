import { GameState, Objective, Tribute, Zone } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { ENDGAME, MEMORY, MOVEMENT, OBJECTIVES } from '../data/balance';
import { SimContext } from './context';
import { cycleOf, cyclesSinceContact, ensureMemory, rememberedBarren, rememberedRivals, rememberedThreat } from './memory';
import { getZone, hopsTo, nextHopToward, severedEdgeSet, zoneFeatures } from './map';
import { fearOf } from './fear';
import { breakTruce, breaksTruce, hasTruce } from './parley';
import { perceivedBond, targetReluctance } from './rapport';
import { prerequisiteFor, pressTension, queueGoal } from './intent';
import { areLovers } from './alliance';
import { getRel } from './relationships';
import { SURVIVAL_TEXTS } from '../data/flavorText';
import { fill } from './encounters';
import { isAggressiveStance } from '../data/stances';
import { objectiveBiasFor, targetPreferenceScore } from './archetypeHooks';
import { traitMod } from '../data/traits';
import { resolveOf } from './resolve';

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
        case 'stalk':
            ctx.logEvent(
                `${t.name} settles in behind ${name(objective.targetId)} at a distance, with no apparent intention of closing it.`,
                [t.id, objective.targetId],
                { important: true, category: 'travel' }
            );
            return;
        case 'wait':
            ctx.logEvent(
                `${t.name} picks a spot in ${objective.zone} where everything has to come past them, and stops moving.`,
                [t.id],
                { category: 'survival' }
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
        case 'stalk':
            // §3.3: a stalk survives fear that would abandon a hunt — being
            // frightened of somebody is a reason to keep watching them.
            return !!living(objective.targetId);
        case 'protect':
            return !!living(objective.wardId);
        case 'reach':
            // Arrived, or the ground went out of bounds under the destination.
            return t.zone !== objective.zone && !collapsed.includes(objective.zone);
        case 'hold':
        case 'wait':
            return t.zone === objective.zone && !collapsed.includes(objective.zone);
        case 'flee':
            return t.zone === objective.from;
        default:
            return false;
    }
}

/**
 * §3.2: whether a queued goal is still something this tribute could go and do.
 * Deliberately looser than `isObjectiveValid` — a plan is allowed to be a
 * little stale, it is only not allowed to be impossible.
 */
function isObjectiveReachable(ctx: SimContext, t: Tribute, goal: Objective): boolean {
    const collapsed = ctx.state.collapsedZones ?? [];
    const living = (id: string) => ctx.state.tributes.find(o => o.id === id && o.status === 'alive');
    switch (goal.kind) {
        case 'hunt':
        case 'stalk': return !!living(goal.targetId);
        case 'protect': return !!living(goal.wardId);
        case 'reach': return !collapsed.includes(goal.zone) && t.zone !== goal.zone;
        case 'hold':
        case 'wait': return !collapsed.includes(goal.zone);
        default: return false;
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

/**
 * §3.4: one pass of the priority cascade.
 *
 * The cascade below is a ladder of needs, and it used to return the first rung
 * that applied and throw the rest away — so there was no representation of a
 * tribute torn between two of them. `offer` is the seam: every rung now
 * declares its tier and goes through it, which lets the same function be run a
 * second time with the winner suppressed to find out what they *nearly* did
 * and by how much (see `updateObjective`).
 *
 * `skip` suppresses a candidate; `out` receives the tier the returned
 * objective came from. `dry` is set on the runner-up pass: it suppresses the
 * two branches with side effects (a broken truce) or an RNG draw, so asking
 * the question a second time cannot change the world or the stream.
 */
function chooseObjective(
    ctx: SimContext,
    t: Tribute,
    here: Tribute[],
    skip?: (o: Objective) => boolean,
    out?: { tier: number },
    dry = false,
): Objective {
    const state = ctx.state;
    const offer = (tier: number, objective: Objective): Objective | undefined => {
        if (skip?.(objective)) return undefined;
        if (out) out.tier = tier;
        return objective;
    };
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
            const o = offer(100, { kind: 'hunt', targetId: rival.id, expires: expiry(OBJECTIVES.huntCycles) });
            if (o) return o;
        }
        if (t.zone !== state.finaleZone) {
            const o = offer(100, { kind: 'reach', zone: state.finaleZone, reason: 'feast', expires: expiry(OBJECTIVES.reachCycles) });
            if (o) return o;
        }
    }

    // 1. Get out. Standing somewhere they are badly outmatched beats every
    //    other consideration a tribute has.
    const hostilesHere = here.filter(o =>
        o.id !== t.id && (o.allianceId === undefined || o.allianceId !== t.allianceId));
    const scaredOf = hostilesHere.some(o => fearOf(t, o.id) >= OBJECTIVES.fleeFear);
    const fleePull = objectiveBiasFor(t, 'flee');
    if ((scaredOf || (!dry && fleePull > 0 && hostilesHere.length > 0 && ctx.rng.chance(fleePull)))
        && !isAggressiveStance(t.stance)) {
        const o = offer(90, { kind: 'flee', from: t.zone, expires: expiry(OBJECTIVES.fleeCycles) });
        if (o) return o;
    }

    // 2. Thirst. The most reliable killer that a tribute can actually do
    //    something about, and the clearest possible intention.
    if (t.vitals.thirst > MOVEMENT.thirstUrgency && !t.inventory.some(i => i.type === 'water')) {
        // §7.7: a drinkable spring on a moor counts; a brine sump does not —
        // the same waterSource read the hydration layer itself uses.
        const water = nearestZoneMatching(ctx, t, active, z => zoneFeatures(z).waterSource === true);
        if (water && water !== t.zone) {
            const o = offer(80, { kind: 'reach', zone: water, reason: 'water', expires: expiry(OBJECTIVES.reachCycles) });
            if (o) return o;
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
                const o = offer(72, { kind: 'reach', zone: larder, reason: 'forage', expires: expiry(OBJECTIVES.reachCycles) });
                if (o) return o;
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
                const o = offer(66, { kind: 'reach', zone: known.zone, reason: 'ally', expires: expiry(OBJECTIVES.reachCycles) });
                if (o) return o;
            }
        }
    }

    // 3. The feast, once it is called: a scheduled reason for the whole cast to
    //    converge that the movement layer previously knew nothing about.
    if (state.feastDay !== undefined && state.day >= state.feastDay - 1) {
        const cornucopia = active.find(z => /cornucopia/i.test(z.name));
        if (cornucopia && cornucopia.name !== t.zone && arch.aggression > -0.2) {
            const o = offer(60, { kind: 'reach', zone: cornucopia.name, reason: 'feast', expires: expiry(OBJECTIVES.reachCycles) });
            if (o) return o;
        }
    }

    // 4. Somebody to kill. Either sworn, or simply the nearest rival a hunter
    //    has a live sighting of.
    const mem = ensureMemory(t);
    const sworn = mem.vengeance
        .map(id => state.tributes.find(o => o.id === id && o.status === 'alive'))
        .find(o => !!o);
    if (sworn) {
        const o = offer(56, { kind: 'hunt', targetId: sworn.id, expires: expiry(OBJECTIVES.huntCycles) });
        if (o) return o;
    }
    // §3.3: in the endgame, a tribute who concludes they win a straight fight
    // hunts whatever their stance says — waiting is how favourites get
    // whittled down by attrition they were built to shortcut.
    const fieldCount = state.tributes.filter(o => o.status === 'alive').length;
    const countingTheField = fieldCount <= ENDGAME.fieldSize;
    const edge = countingTheField ? endgameEdge(state, t) : 0;
    // A2: `objectiveBias.hunt` is an archetype reaching for the intention on
    // its own account rather than waiting for the stance to hand it over — a
    // Beast goes looking whatever posture the scoring table settled on.
    const huntPull = objectiveBiasFor(t, 'hunt');
    if (isAggressiveStance(t.stance) || (countingTheField && edge > ENDGAME.hunterEdge)
        || (!dry && huntPull > 0 && ctx.rng.chance(huntPull))) {
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
                // A2: whose board this is. The shared arithmetic above is
                // "easiest kill worth the most loot", which is how everybody
                // used to read the arena; `targetPreference` is the archetype
                // reading it their own way — a Mercenary wants the richest
                // pack, a Zealot wants whoever is hardest, and neither is
                // expressible as another point of aggression.
                const hops = hopsTo(state.arena, t.zone, o.zone, collapsed, severedEdgeSet(state)) ?? 4;
                // §8c: how much the field wants this person at all. The only
                // trait that claimed to be hard to notice (Unremarkable) had
                // no read site anywhere in the targeting layer, which is why
                // it was the worst trait in the game.
                // §4.3: you go after the person you rate *last*. Respect is
                // not liking — a tribute can loathe somebody and still leave
                // them until there is no choice, because the person they are
                // most afraid of losing to is the person they rate. This is
                // the read `respects` was written for and never got.
                return (winnable + loot + grudge - fearOf(t, o.id)
                    + traitMod(o, 'targetDraw')
                    + targetPreferenceScore(t, o, hops)
                    // §4.3: and who is going to come looking. A hunter who has
                    // watched somebody else pull this tribute out of a fire has
                    // learned that killing them buys a second enemy — which is
                    // exactly what third-party inference is *for*.
                    - visible.reduce((worst, ally) => Math.max(worst,
                        ally.id === o.id ? 0 : perceivedBond(t, o.id, ally.id)), 0)
                        * OBJECTIVES.avengerDeterrent
                    ) * targetReluctance(t, o.id);
            };
            const best = (pool: Tribute[]) =>
                pool.reduce((top, o) => (score(o) > score(top) ? o : top));
            const target = candidates.length > 0 ? best(candidates) : undefined;
            // Would breaking their word buy them a better mark than anyone they
            // could hunt honestly? Only then is it even considered, and only
            // then is the roll made — so a truce is never broken idly, and
            // never over someone who was not worth it.
            const tempting = underTruce.length > 0 ? best(underTruce) : undefined;
            if (!dry && tempting && (!target || score(tempting) > score(target))
                && breaksTruce(ctx, t, tempting)) {
                breakTruce(ctx, t, tempting);
                return { kind: 'hunt', targetId: tempting.id, expires: expiry(OBJECTIVES.huntCycles) };
            }
            // No honest mark and no truce worth breaking: fall through to the
            // objectives below rather than forcing a hunt that has no target.
            if (target) {
                // §3.3: hunting is not the only thing to do with somebody you
                // have found. A tribute who is behind on the fight — hurt,
                // outmatched, or simply built for it — follows instead, which
                // is the behavioural pair to the Shadowing stance and the only
                // objective in the list that wants the target left alive.
                const shadowing = t.stance === 'Shadowing'
                    || t.health < OBJECTIVES.stalkHealth
                    || fearOf(t, target.id) >= OBJECTIVES.stalkFear;
                const o = shadowing
                    ? offer(50, { kind: 'stalk', targetId: target.id, expires: expiry(OBJECTIVES.stalkCycles) })
                    : offer(52, { kind: 'hunt', targetId: target.id, expires: expiry(OBJECTIVES.huntCycles) });
                if (o) return o;
            }
        }
    }

    // 5. Somebody to keep alive. Protectors are defined by this and had no way
    //    to express it.
    const protectPull = objectiveBiasFor(t, 'protect');
    if (arch.allianceAffinity > 0.15 || protectPull > 0 || (t.protectorBonds?.length ?? 0) > 0) {
        const ward = state.tributes.find(o =>
            o.status === 'alive' && o.id !== t.id
            // §4.5: a sworn protector bond outranks the alliance test — a
            // protector does not need a charter to refuse to leave their ward.
            && ((t.protectorBonds?.includes(o.id))
                || (o.allianceId !== undefined && o.allianceId === t.allianceId))
            // A2: an archetype that exists to keep somebody alive notices a
            // ward sooner and on thinner grounds than one that does not.
            && (o.health < OBJECTIVES.wardHealth + protectPull * OBJECTIVES.wardBiasHealth
                || getRel(t, o.id) > OBJECTIVES.wardBond - protectPull * OBJECTIVES.wardBiasBond));
        if (ward) {
            const o = offer(48, { kind: 'protect', wardId: ward.id, expires: expiry(OBJECTIVES.protectCycles) });
            if (o) return o;
        }
    }

    // 6. Somewhere to sleep it off — or somewhere to get warm before the
    // cold finishes what it started (§7.7).
    // A2: `objectiveBias.reach` is an archetype more willing to *go somewhere*
    // than to sit where it is — the Scholar's whole counter-play to the arena
    // signature is being elsewhere before the arena does the thing.
    const reachPull = objectiveBiasFor(t, 'reach');
    if (t.vitals.fatigue > MOVEMENT.shelterUrgency - reachPull * OBJECTIVES.reachBiasUrgency
        || t.health < OBJECTIVES.holeUpHealth || t.injuries.frostbitten) {
        const shelter = nearestZoneMatching(ctx, t, active, z => z.terrain === 'forest' || z.terrain === 'ruins');
        if (shelter && shelter !== t.zone) {
            const o = offer(40, { kind: 'reach', zone: shelter, reason: 'shelter', expires: expiry(OBJECTIVES.reachCycles) });
            if (o) return o;
        }
        if (shelter === t.zone) {
            const o = offer(40, { kind: 'hold', zone: t.zone, expires: expiry(OBJECTIVES.holdCycles) });
            if (o) return o;
        }
    }

    // 7. Ground worth standing on: good forage, no bad memories, nobody else in it.
    const current = getZone(state.arena, t.zone);
    if (current && rememberedThreat(state, t, t.zone) < OBJECTIVES.holdMaxThreat
        && hostilesHere.length === 0
        && current.resources > OBJECTIVES.holdMinResources - objectiveBiasFor(t, 'hold') * OBJECTIVES.holdBiasResources) {
        const o = offer(30, { kind: 'hold', zone: t.zone, expires: expiry(OBJECTIVES.holdCycles) });
        if (o) return o;
    }

    // §3.3: waiting. Distinct from holding, which is holding ground worth
    // having — this is sitting on a chokepoint precisely because everyone else
    // has to come through it, and it is the one intention that wants the zone
    // to stay empty until it does not.
    const chokepoint = current && zoneFeatures(current).chokepoint === true;
    if (chokepoint && hostilesHere.length === 0 && !isAggressiveStance(t.stance)
        && t.vitals.fatigue > OBJECTIVES.waitFatigue) {
        const o = offer(28, { kind: 'wait', zone: t.zone, expires: expiry(OBJECTIVES.waitCycles) });
        if (o) return o;
    }

    if (out) out.tier = 0;
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
    if (isObjectiveValid(ctx, t)) {
        // §3.2: being torn is now cumulative. Three cycles pulled the same two
        // ways and the runner-up wins outright, loudly — the tension system
        // voiced itself once and then had no way to ever resolve.
        const snapped = pressTension(ctx, t);
        if (snapped) {
            t.objective = snapped;
            announce(ctx, t, snapped);
        }
        return;
    }

    // §3.2: the errand is done; the thing it was in service of is still there.
    // This is the whole of the planning horizon — a tribute who went for water
    // so they could set up on the chokepoint now goes and does that, instead of
    // re-deriving their life from scratch against the state of this instant.
    const queued = t.objectiveQueue?.shift();
    if (t.objectiveQueue?.length === 0) t.objectiveQueue = undefined;
    if (queued && isObjectiveReachable(ctx, t, queued)) {
        t.objective = { ...queued, expires: cycleOf(ctx.state) + OBJECTIVES.reachCycles } as Objective;
        announce(ctx, t, t.objective);
        return;
    }

    const previous = t.objective;
    const chosenTier = { tier: 0 };
    let next = chooseObjective(ctx, t, here, undefined, chosenTier);

    // §3.4: what they nearly did instead. The same cascade, run again with the
    // winner suppressed and its side-effecting branches disabled, which is the
    // cheapest honest way to ask "and what was the other thing?" of a priority
    // ladder. A tribute needing water while their ally is dying two zones over
    // now has both facts on them, not just the one that won.
    const runnerTier = { tier: 0 };
    const runnerUp = chooseObjective(ctx, t, here, o => sameObjective(next, o), runnerTier, true);
    const margin = chosenTier.tier - runnerTier.tier;

    if (runnerUp.kind !== 'survive' && next.kind !== 'survive' && margin <= OBJECTIVES.tensionMargin) {
        t.objectiveTension = { runnerUp, margin };
        // Under pressure the other option wins often enough that a torn
        // tribute reads as torn rather than as decisive-with-a-footnote.
        const cracking = resolveOf(t) <= OBJECTIVES.tensionPressureBelow
            || t.vitals.sanity <= OBJECTIVES.tensionPressureBelow;
        const flip = OBJECTIVES.tensionFlipChance + (cracking ? OBJECTIVES.tensionFlipUnderPressure : 0);
        if (ctx.rng.chance(flip)) {
            t.objectiveTension = { runnerUp: next, margin };
            next = runnerUp;
        }
        hesitate(ctx, t, next, t.objectiveTension.runnerUp);
        t.objectiveTension.voiced = true;
    } else {
        t.objectiveTension = undefined;
    }

    // §3.2: a goal the tribute cannot currently serve gets an errand put in
    // front of it and is remembered rather than discarded.
    const prerequisite = prerequisiteFor(ctx, t, next);
    if (prerequisite) {
        queueGoal(t, next);
        next = prerequisite;
    }

    t.objective = next;

    // Only narrate genuinely new intentions, and never the null one — a line
    // every time someone lapses back to "survive" would drown the feed.
    if (next.kind !== 'survive' && !sameObjective(previous, next)) {
        announce(ctx, t, next);
    }
}

/**
 * §3.4: the hesitation beat.
 *
 * The most human-reading line the simulation can produce, and it costs one
 * comparison: a tribute who is about to do one thing, visibly weighing the
 * other. Narrated once per re-evaluation, and only for pairs where the
 * conflict is legible — nobody needs to watch somebody agonise over which
 * patch of forest to forage in.
 */
function hesitate(ctx: SimContext, t: Tribute, chosen: Objective, other: Objective) {
    const name = (id: string) => ctx.state.tributes.find(o => o.id === id)?.name ?? 'someone';
    const describe = (o: Objective): string | undefined => {
        switch (o.kind) {
            case 'hunt': return `going after ${name(o.targetId)}`;
            case 'stalk': return `following ${name(o.targetId)}`;
            case 'protect': return `getting to ${name(o.wardId)}`;
            case 'flee': return 'getting out';
            case 'hold': return `staying where they are`;
            case 'wait': return `sitting on ${o.zone}`;
            case 'reach': return {
                water: 'finding water', shelter: 'finding somewhere to sleep',
                feast: 'the feast', ally: 'reaching their allies', forage: 'finding food',
            }[o.reason];
            default: return undefined;
        }
    };
    const a = describe(chosen);
    const b = describe(other);
    if (!a || !b) return;
    ctx.logEvent(
        `${t.name} stands still for a moment longer than they should, weighing ${a} against ${b}. They settle on ${a}, and it does not look like a decision they are finished making.`,
        [t.id],
        { category: 'travel' }
    );
}

function sameObjective(a: Objective | undefined, b: Objective): boolean {
    if (!a || a.kind !== b.kind) return false;
    if (a.kind === 'hunt' && b.kind === 'hunt') return a.targetId === b.targetId;
    if (a.kind === 'stalk' && b.kind === 'stalk') return a.targetId === b.targetId;
    if (a.kind === 'wait' && b.kind === 'wait') return a.zone === b.zone;
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
        case 'wait':
            return objective.zone;
        case 'stalk':
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

    if (objective.kind === 'hold' || objective.kind === 'wait') {
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
    return t.objective?.kind === 'hold' || t.objective?.kind === 'wait';
}

/** Short label for the UI, so a reader can see what a tribute is trying to do. */
export function objectiveLabel(state: { tributes: Tribute[] }, t: Tribute): string {
    const objective = t.objective;
    if (!objective || objective.kind === 'survive') return 'Surviving';
    const name = (id: string) => state.tributes.find(o => o.id === id)?.name ?? 'someone';
    switch (objective.kind) {
        case 'hunt': return `Hunting ${name(objective.targetId)}`;
        case 'stalk': return `Shadowing ${name(objective.targetId)}`;
        case 'wait': return `Waiting at ${objective.zone}`;
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
