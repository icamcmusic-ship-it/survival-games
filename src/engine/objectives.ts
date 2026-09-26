import { targetDrawOf } from './targeting';
import { hiddenFromHunt } from './traitHooks';
import { GameState, Objective, Tribute, Zone } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { AUDIT12_TRIBUTES, ENDGAME, ESCALATION, PERCEPTION, ENDGAME_POSITIONING, INJURY_BEHAVIOUR, MEMORY, MOVEMENT, OBJECTIVES, PLANNING, REPUTATION_TARGETING, RISK, STANDING_GOAL } from '../data/balance';
import { SimContext } from './context';
import { cycleOf, cyclesSinceContact, ensureMemory, hasVengeanceAgainst, impressionOf, rememberedBarren, rememberedRivals, rememberedThreat } from './memory';
import { getZone, hopsTo, nextHopToward, severedEdgeSet, zoneFeatures } from './map';
import { notorietyFraction } from './notoriety';
import { injuryGrade } from './wounds';
import { riskTolerance } from './risk';
import { fearOf } from './fear';
import { breakTruce, breaksTruce, hasTruce } from './parley';
import { perceivedBond, targetReluctance } from './rapport';
import { errandChain, pressTension, queueGoal } from './intent';
import { areLovers, allied, isHostileTo } from './alliance';
import { sharesVengeancePact } from './vengeancePact';
import { getRel } from './relationships';
import { SURVIVAL_TEXTS } from '../data/flavorText';
import { fill } from './encounters';
import { isAggressiveStance } from '../data/stances';
import { objectiveBiasFor, targetPreferenceScore } from './archetypeHooks';
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
                { type: 'objective-formed', important: true, category: 'travel' }
            );
            return;
        case 'reach': {
            const why = {
                water: 'looking for water',
                shelter: 'looking for somewhere to sleep',
                feast: 'heading for the feast',
                ally: 'trying to rejoin their allies',
                forage: 'looking for anything to eat',
                endgame: 'moving to where this ends',
            }[objective.reason];
            ctx.logEvent(
                `${t.name} sets off for ${objective.zone}, ${why}.`,
                [t.id],
                { type: 'objective-formed', category: 'travel' }
            );
            return;
        }
        case 'hold':
            ctx.logEvent(
                `${t.name} decides ${objective.zone} is worth holding and digs in.`,
                [t.id],
                { type: 'objective-formed', category: 'survival' }
            );
            return;
        case 'flee':
            ctx.logEvent(
                fill(ctx.pickText(SURVIVAL_TEXTS.flee), { tribute: t.name, zone: objective.from }),
                [t.id],
                { type: 'objective-formed', category: 'travel' }
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
                { type: 'objective-formed', important: true, category: 'alliance' }
            );
            return;
        case 'scavenge':
            ctx.logEvent(
                `${t.name} works out where ${name(objective.ownerId)} went down, and starts walking to ${objective.zone}.`,
                [t.id, objective.ownerId],
                { type: 'objective-formed', category: 'loot' }
            );
            return;
        case 'court':
            ctx.logEvent(
                `${t.name} decides they are not doing this alone, and goes looking for ${name(objective.targetId)}.`,
                [t.id, objective.targetId],
                { type: 'objective-formed', important: true, category: 'alliance' }
            );
            return;
        case 'mourn':
            ctx.logEvent(
                `${t.name} turns back toward ${objective.zone}, where ${name(objective.forId)} fell. There is nothing there for them.`,
                [t.id, objective.forId],
                { type: 'objective-formed', important: true, category: 'travel' }
            );
            return;
        case 'recover':
            ctx.logEvent(
                `${t.name} stops, takes stock of the damage, and decides ${objective.zone} will have to do until it closes.`,
                [t.id],
                { type: 'objective-formed', category: 'survival' }
            );
            return;
        case 'scout':
            ctx.logEvent(
                `${t.name} realises they have not seen another living soul in days, and sets off for the high ground at ${objective.zone}.`,
                [t.id],
                { type: 'objective-formed', category: 'travel' }
            );
            return;
        default:
            return;
    }
}

/**
 * AUDIT-12 §5: commitment by caution. A cautious tributes keeps walking toward
 * a `reach` through a minor threat and past its nominal expiry (up to a cap),
 * rather than re-rolling their whole life each time the clock runs out; a
 * reckless one drops the errand the moment somebody hostile turns up.
 */
function commitmentByCaution(ctx: SimContext, t: Tribute, here: Tribute[]) {
    const o = t.objective;
    if (!o || o.kind !== 'reach') { t.committedSince = undefined; t.committedZone = undefined; return; }
    const cycle = cycleOf(ctx.state);
    if (t.committedZone !== o.zone || t.committedSince === undefined) { t.committedSince = cycle; t.committedZone = o.zone; }
    const caution = ARCHETYPES[t.archetype].caution;
    const hostile = here.some(x => x.id !== t.id && x.status === 'alive' && !allied(x, t));
    if (caution <= AUDIT12_TRIBUTES.recklessCaution && hostile && t.zone !== o.zone) {
        o.expires = cycle;  // expire now: the cascade re-scores with the threat in view
        return;
    }
    const minorThreat = here.every(x => x.id === t.id || allied(x, t) || fearOf(t, x.id) < OBJECTIVES.fleeFear);
    if (caution >= AUDIT12_TRIBUTES.committedCaution && cycle >= o.expires && t.zone !== o.zone && minorThreat
        && cycle - t.committedSince < AUDIT12_TRIBUTES.commitmentMaxCycles
        && !(ctx.state.collapsedZones ?? []).includes(o.zone)) {
        o.expires = cycle + AUDIT12_TRIBUTES.commitmentExtension;
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
        // §16: resting joins holding and waiting — all three are expressed by
        // staying where the decision was made. The comment belongs above the
        // group rather than between two of its labels: a comment between case
        // labels reads as a statement to `no-fallthrough`, which is a lint
        // error for behaviour that was always correct.
        case 'hold':
        case 'wait':
        case 'recover':
            return t.zone === objective.zone && !collapsed.includes(objective.zone);
        // §16: the travelling intentions end the same way `reach` does —
        // arriving is what finishes them, and the ground going out of bounds
        // is what cancels them. `scavenge` has one extra way to end: somebody
        // else got there first, and there is nothing to walk to any more.
        case 'scavenge':
            return t.zone !== objective.zone && !collapsed.includes(objective.zone)
                && (ctx.state.abandonedCamps ?? []).some(c =>
                    c.zone === objective.zone && c.ownerId === objective.ownerId && c.foundBy === undefined);
        case 'mourn':
        case 'scout':
            return t.zone !== objective.zone && !collapsed.includes(objective.zone);
        // §16: courting ends when you are standing in front of them — the
        // asking itself is the alliance layer's business, not this one's.
        case 'court': {
            const them = living(objective.targetId);
            return !!them && them.zone !== t.zone;
        }
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
/**
 * AUDIT-7 §1.3: whether a goal parked in the queue is still worth coming back to.
 *
 * Reachability alone is not enough once the queue can hold a goal across more
 * than one cycle: "hold the ridge" stays reachable forever, so without a clock
 * a goal nobody ever gets round to would sit at the head of the queue for the
 * rest of the run and keep a second one from ever being remembered. A goal is
 * dropped once it is this far past the expiry it was queued with.
 */
function queuedGoalStillStands(ctx: SimContext, t: Tribute, goal: Objective, cycle: number): boolean {
    if (!isObjectiveReachable(ctx, t, goal)) return false;
    if (!('expires' in goal)) return false;
    return cycle - goal.expires <= PLANNING.queueStaleAfter;
}

function isObjectiveReachable(ctx: SimContext, t: Tribute, goal: Objective): boolean {
    const collapsed = ctx.state.collapsedZones ?? [];
    const living = (id: string) => ctx.state.tributes.find(o => o.id === id && o.status === 'alive');
    switch (goal.kind) {
        case 'hunt':
        case 'stalk': return !!living(goal.targetId);
        case 'protect': return !!living(goal.wardId);
        case 'reach': return !collapsed.includes(goal.zone) && t.zone !== goal.zone;
        case 'hold':
        case 'wait':
        case 'recover': return !collapsed.includes(goal.zone);
        case 'scavenge':
        case 'mourn':
        case 'scout': return !collapsed.includes(goal.zone) && t.zone !== goal.zone;
        case 'court': return !!living(goal.targetId);
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
    // AUDIT-11 §5: the field as this tribute knows it — their last look at
    // each rival's condition, and a reputation built from cannons and hearsay
    // standing in for a kill count nobody outside the Capitol can read.
    edge += (t.health - avg(o => impressionOf(state, t, o).health)) / 200;
    edge += (t.kills - avg(o => notorietyFraction(t, o.id) * PERCEPTION.notorietyKills)) / 6;
    edge += (t.inventory.some(i => i.type === 'weapon') ? 0.15 : -0.2);
    const allies = state.tributes.filter(o =>
        o.status === 'alive' && o.id !== t.id && allied(o, t)).length;
    edge += Math.min(0.2, allies * 0.1);
    edge += (t.inventory.some(i => i.type === 'food') && t.inventory.some(i => i.type === 'water')) ? 0.05 : -0.05;
    // §7 (audit): the Capitol expects blood from a finalist who has never
    // drawn any. A tribute who has reached the last eight without a kill
    // knows the Gamemakers will not let them hide their way to the crown,
    // and reads the board more aggressively for it.
    if (t.kills === 0 && field.length + 1 <= ENDGAME.fieldSize && t.health >= ENDGAME.bloodlessPressureHealth) {
        edge += ENDGAME.bloodlessPressure;
    }
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
    // §11 (requests): the convergence outranks everything except the forced
    // finale itself, and for the same reason — the arena has been closed to one
    // sector, so "go there" is not a preference the tribute is weighing. It
    // reads exactly like `finaleZone` below it, one stage earlier and for a
    // field of up to six rather than two, which is the whole point: the run's
    // middle endgame should be people meeting, not people politely orbiting.
    // AUDIT-11 §5: who, of the people standing here, is the one to go for.
    // Both rungs below used to take the first match in roster order, so low
    // district ids were targeted systematically. Scored from what `t` can see
    // (they are in the same sector) plus their own grudges and truces.
    const faceOffScore = (o: Tribute) => {
        const seen = impressionOf(state, t, o);
        return (100 - seen.health) + (1 - seen.armed) * 30
            // AUDIT-12 T12: a loner weighs fear heavier — nobody is behind them.
            - fearOf(t, o.id) * (t.allianceId ? 1 : AUDIT12_TRIBUTES.lonerFearWeight)
            + Math.max(0, -getRel(t, o.id)) * OBJECTIVES.faceOffGrudgeWeight
            + (hasVengeanceAgainst(t, o.id) ? OBJECTIVES.faceOffVengeanceBonus : 0)
            - (hasTruce(state, t, o.id) ? OBJECTIVES.faceOffTruceCost : 0);
    };
    const pickFaceOff = (pool: Tribute[]) => pool.length === 0 ? undefined
        : pool.reduce((top, o) => (faceOffScore(o) > faceOffScore(top) ? o : top));

    if (state.convergenceZone && !state.finaleZone) {
        const inZone = state.tributes.filter(o =>
            o.status === 'alive' && o.zone === t.zone && isHostileTo(t, o));
        // AUDIT-11 §5: the convergence closes the map, it does not switch off
        // fear. The ordinary hunt drops a mark past `huntAbandonFear`; a
        // terrified loner facing the Career pack here falls through to the
        // flee rung instead of walking into them.
        const terrified = inZone.some(o => fearOf(t, o.id) >= OBJECTIVES.huntAbandonFear);
        /*
         * AUDIT-12 T12 / §5: the loner's fear curve. Somebody with nobody at
         * their back who is merely afraid (past `fleeFear`, short of
         * terrified) does not walk into the room swinging: they hide and let
         * it thin, lie in wait for the one they fear, or try talking to the
         * one they fear least.
         */
        const peak = inZone.reduce((m, o) => Math.max(m, fearOf(t, o.id)), 0);
        if (!t.allianceId && !terrified && inZone.length > 0 && peak >= OBJECTIVES.fleeFear) {
            const feared = inZone.reduce((top, o) => (fearOf(t, o.id) > fearOf(t, top.id) ? o : top));
            const leastFeared = inZone.reduce((top, o) => (fearOf(t, o.id) < fearOf(t, top.id) ? o : top));
            const band = (peak - OBJECTIVES.fleeFear) / Math.max(1, OBJECTIVES.huntAbandonFear - OBJECTIVES.fleeFear);
            let choice: Objective;
            if (band >= AUDIT12_TRIBUTES.lonerHideBand) {
                choice = { kind: 'wait', zone: t.zone, expires: expiry(AUDIT12_TRIBUTES.lonerHideCycles) };
            } else if (t.attributes.stealth >= AUDIT12_TRIBUTES.lonerAmbushStealth) {
                choice = { kind: 'stalk', targetId: feared.id, expires: expiry(OBJECTIVES.huntCycles) };
            } else {
                choice = { kind: 'court', targetId: leastFeared.id, expires: expiry(OBJECTIVES.huntCycles) };
            }
            const o = offer(99, choice);
            if (o) return o;
        }
        const rival = terrified ? undefined : pickFaceOff(inZone);
        if (rival) {
            const o = offer(99, { kind: 'hunt', targetId: rival.id, expires: expiry(OBJECTIVES.huntCycles) });
            if (o) return o;
        }
        if (t.zone !== state.convergenceZone) {
            const o = offer(99, { kind: 'reach', zone: state.convergenceZone, reason: 'feast', expires: expiry(OBJECTIVES.reachCycles) });
            if (o) return o;
        }
    }

    /*
     * AUDIT-6 §9.1: the muster's pull. Deliberately well below the
     * convergence's 99 — the arena has *not* been closed, so this is a
     * preference the tribute is weighing against everything else they might
     * do, which is the whole difference between the two.
     */
    if (state.musterZone && !state.convergenceZone && !state.finaleZone && t.zone !== state.musterZone) {
        const o = offer(ESCALATION.musterPriority, {
            kind: 'reach', zone: state.musterZone, reason: 'feast', expires: expiry(OBJECTIVES.reachCycles),
        });
        if (o) return o;
    }

    if (state.finaleZone) {
        // Co-location belongs inside the predicate. Picking the first living
        // non-lover in roster order and *then* asking where they are meant that
        // with three finalists, a tribute standing next to one of them formed no
        // intention at all because somebody else, elsewhere, was found first.
        const rival = pickFaceOff(state.tributes.filter(o =>
            o.status === 'alive' && o.id !== t.id && o.zone === t.zone && !areLovers(t, o)));
        if (rival) {
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
        o.id !== t.id && !allied(o, t));
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
            o.status === 'alive' && o.id !== t.id && allied(o, t));
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

    // 3b. A §11: the tribute side of the endgame. The Gamemakers already
    //    strip the cover away once the field is down to the last few; nobody
    //    on the floor did anything deliberate about it. The final four pick
    //    ground on purpose — the horn if they fancy the fight, high ground if
    //    they do not — rather than being herded onto it.
    const fieldLeft = state.tributes.filter(o => o.status === 'alive').length;
    if (!state.finaleZone && fieldLeft <= ENDGAME_POSITIONING.fieldSize && fieldLeft > 1) {
        const wantsTheHorn = riskTolerance(ctx, t) > ENDGAME_POSITIONING.hornEdge;
        const horn = active.find(z => /cornucopia/i.test(z.name));
        const highGround = active
            .filter(z => zoneFeatures(z).elevation)
            .sort((a, b) => (hopsTo(state.arena, t.zone, a.name, collapsed, severedEdgeSet(state)) ?? 9)
                - (hopsTo(state.arena, t.zone, b.name, collapsed, severedEdgeSet(state)) ?? 9))[0];
        const destination = wantsTheHorn ? (horn ?? highGround) : (highGround ?? horn);
        if (destination && destination.name !== t.zone) {
            const o = offer(ENDGAME_POSITIONING.tier, {
                kind: 'reach', zone: destination.name, reason: 'endgame', expires: expiry(OBJECTIVES.reachCycles),
            });
            if (o) return o;
        }
    }

    // 3c. §16: a named pile. Somebody died or ran, and their kit is still on
    //     the ground where it happened — the cannon told the whole arena
    //     where. This is not `reach ... forage`, which is walking toward
    //     ground that might have something on it; this is walking toward a
    //     specific cache with a specific dead owner's name on it, which is
    //     also what makes arriving worth a line.
    const cache = (state.abandonedCamps ?? [])
        .filter(c => c.foundBy === undefined && c.zone !== t.zone
            && !collapsed.includes(c.zone)
            && cycle - c.cycle <= OBJECTIVES.scavengeStaleAfter)
        .map(c => ({ c, hops: hopsTo(state.arena, t.zone, c.zone, collapsed, severedEdgeSet(state)) }))
        .filter((m): m is { c: typeof m.c; hops: number } => m.hops !== undefined)
        .sort((a, b) => a.hops - b.hops)[0];
    // Above the hunt rung, and only for somebody with nothing to hunt *with*.
    // A tribute holding a weapon has better things to do than pick over a
    // corpse; a tribute holding nothing, who knows exactly where a dead
    // Career's kit is lying, going hunting anyway was the cascade at its
    // least sensible.
    // The leg-injury gate that used to sit here was redundant: a tribute hurt
    // enough not to walk reaches the `recover` rung two clauses down, which
    // is a better answer than silently declining to have an intention.
    if (cache) {
        const o = offer(OBJECTIVES.scavengeTier, {
            kind: 'scavenge', zone: cache.c.zone, ownerId: cache.c.ownerId, expires: expiry(OBJECTIVES.scavengeCycles),
        });
        if (o) return o;
    }

    // 4. Somebody to kill. Either sworn, or simply the nearest rival a hunter
    //    has a live sighting of.
    const mem = ensureMemory(t);
    const sworn = mem.vengeance
        .map(id => state.tributes.find(o => o.id === id && o.status === 'alive'))
        .find(o => !!o);
    if (sworn) {
        // A pact-mate standing beside them for the same kill outranks a
        // private oath: this is the read site `sharesVengeancePact` was
        // written for.
        const withPactMate = here.some(o => o.id !== t.id && o.status === 'alive' && sharesVengeancePact(state, t, o)
            && ensureMemory(o).vengeance.includes(sworn.id));
        const o = offer(withPactMate ? OBJECTIVES.pactHuntTier : 56, { kind: 'hunt', targetId: sworn.id, expires: expiry(OBJECTIVES.huntCycles) });
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
            && !allied(o, t)
            && rememberedRivals(state, t, o.zone) > 0
            && cyclesSinceContact(state, t, o.id) <= MEMORY.sightingLifetime
            && fearOf(t, o.id) < OBJECTIVES.huntAbandonFear
            // AUDIT-12 §16: somebody Hiding is off the list unless they are tracked.
            && !hiddenFromHunt(t, o));
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
        const myAllies = state.tributes.filter(o => o.status === 'alive' && o.id !== t.id && allied(o, t));
        const candidates = visible.filter(o => !hasTruce(state, t, o.id));
        const underTruce = visible.filter(o => hasTruce(state, t, o.id));
        if (candidates.length > 0 || underTruce.length > 0) {
            // Hunting is opportunism, the same arithmetic pickBetrayalTarget
            // already does: the wounded loner carrying a medkit outranks the
            // healthy Career with a trident. Weigh how winnable the fight looks
            // (from what the hunter last saw, not the live sheet), the loot,
            // and the grudge — minus how much this person frightens them.
            const rawScore = (o: Tribute) => {
                // AUDIT-11 §5: "from what the hunter last saw" is now true —
                // the snapshot from their last sighting, going soft with age,
                // rather than the live health and pack of somebody out of view.
                const seen = impressionOf(state, t, o);
                const winnable = (100 - seen.health)
                    + (1 - seen.armed) * 30
                    + (o.allianceId === undefined ? 15 : 0);
                const loot = seen.loot * 0.3;
                // A §4: an unwilling tribute who hunts at all hunts the
                // weakest thing on the board; a willing one does not need to.
                const picky = Math.max(0, -riskTolerance(ctx, t)) * RISK.targetWeakWeight;
                const weakness = (100 - seen.health) * picky;
                const grudge = Math.max(0, -getRel(t, o.id)) * 0.5;
                // A2: whose board this is. The shared arithmetic above is
                // "easiest kill worth the most loot", which is how everybody
                // used to read the arena; `targetPreference` is the archetype
                // reading it their own way — a Mercenary wants the richest
                // pack, a Zealot wants whoever is hardest, and neither is
                // expressible as another point of aggression.
                const hops = hopsTo(state.arena, t.zone, o.zone, collapsed, severedEdgeSet(state)) ?? 4;
                // A §7: nobody with their legs opened starts a manhunt across
                // the map. The mark has to be close enough to walk to.
                if (injuryGrade(t, 'legs') > 0 && hops > INJURY_BEHAVIOUR.legsHuntMaxHops) return -Infinity;
                // §8c: how much the field wants this person at all. The only
                // trait that claimed to be hard to notice (Unremarkable) had
                // no read site anywhere in the targeting layer, which is why
                // it was the worst trait in the game.
                // §4.3: you go after the person you rate *last*. Respect is
                // not liking — a tribute can loathe somebody and still leave
                // them until there is no choice, because the person they are
                // most afraid of losing to is the person they rate. This is
                // the read `respects` was written for and never got.
                // A §9: a reputation is a deterrent and a prize at the same
                // time. Notoriety says "this one has done something" — which
                // puts most of the field off and draws exactly the tributes
                // willing to take the risk.
                const notorious = notorietyFraction(t, o.id);
                const boldEnough = riskTolerance(ctx, t) > REPUTATION_TARGETING.prizeRiskAbove;
                // How far that reputation travelled without anybody having to
                // witness anything first-hand.
                const visibility = notorious * REPUTATION_TARGETING.notorietyVisibleWeight;
                const reputation = boldEnough
                    ? visibility * REPUTATION_TARGETING.reputationPrize
                    : -(visibility * REPUTATION_TARGETING.notorietyDeterrent);
                // §4: whose word you would be stepping on. Attacking B when B
                // has an agreement with my ally A is not a private matter
                // between me and B — A gave their word, and it is A's word I
                // would be making worthless.
                // AUDIT-11 E4: the hunter's actual allies. This used to search
                // `visible`, which already excludes alliance-mates, so the
                // cost was never charged.
                const trucedWithAnAlly = myAllies.some(ally =>
                    ally.id !== o.id && hasTruce(state, ally, o.id));
                const thirdPartyCost = trucedWithAnAlly ? OBJECTIVES.thirdPartyTruceCost : 0;
                return (winnable + loot + weakness + grudge - fearOf(t, o.id) + reputation - thirdPartyCost
                    + targetDrawOf(o)
                    + targetPreferenceScore(state, t, o, hops)
                    // §3.2 (audit): the outcome ledger. A mark that has got
                    // away from this hunter before scores lower, so a tribute
                    // who keeps failing changes *target* rather than trying
                    // the same person identically — learning that changes
                    // the hunt, not the appetite for one.
                    - sameTargetPenaltyFor(t, o.id)
                    // §4.3: and who is going to come looking. A hunter who has
                    // watched somebody else pull this tribute out of a fire has
                    // learned that killing them buys a second enemy — which is
                    // exactly what third-party inference is *for*.
                    - visible.reduce((worst, ally) => Math.max(worst,
                        ally.id === o.id ? 0 : perceivedBond(t, o.id, ally.id)), 0)
                        * OBJECTIVES.avengerDeterrent
                    );
            };
            // Respect is a reason to leave somebody for last. On a mark that
            // already scores negative, multiplying by a number under one made
            // them *more* attractive; the reluctance has to push away from
            // zero in both directions.
            // Memoised: `rawScore` runs a BFS and two visibility scans, and the
            // reduce below re-scored its running best on every step.
            const scoreCache = new Map<string, number>();
            const score = (o: Tribute) => {
                const cached = scoreCache.get(o.id);
                if (cached !== undefined) return cached;
                const raw = rawScore(o);
                const reluctance = targetReluctance(t, o.id);
                const value = raw >= 0 ? raw * reluctance : raw * (2 - reluctance);
                scoreCache.set(o.id, value);
                return value;
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
                // Through `offer`, so it carries the hunt's tier: returned
                // bare it sat at tier 0, and any standing goal overrode a
                // truce that had just been broken for this.
                return offer(OBJECTIVES.huntTier, { kind: 'hunt', targetId: tempting.id, expires: expiry(OBJECTIVES.huntCycles) })
                    ?? { kind: 'hunt', targetId: tempting.id, expires: expiry(OBJECTIVES.huntCycles) };
            }
            // No honest mark and no truce worth breaking: fall through to the
            // objectives below rather than forcing a hunt that has no target.
            if (target) {
                // §3.3: hunting is not the only thing to do with somebody you
                // have found. A tribute who is behind on the fight — hurt,
                // outmatched, or simply built for it — follows instead, which
                // is the behavioural pair to the Shadowing stance and the only
                // objective in the list that wants the target left alive.
                /*
                 * Audit 3 §3.3: `stalk` was held in 1.9% of tribute-cycles,
                 * `wait` in 1.0% and `hold` in 2.6% — three of eight objective
                 * kinds accounting for 5.5% of all decisions between them, each
                 * carrying its own log lines and tension beats that almost
                 * nobody sees.
                 *
                 * The gate was the problem rather than the idea. A stalk fired
                 * on the Shadowing stance (3.1% of stances), being hurt, or
                 * being frightened — all states, none of them *disposition* —
                 * while `objectiveBias` has always accepted a `stalk` key and
                 * not one archetype declared one. Following somebody without
                 * closing is a character trait before it is a condition, and
                 * the four archetypes built around watching now say so.
                 */
                const shadowing = t.stance === 'Shadowing'
                    || t.health < OBJECTIVES.stalkHealth
                    || fearOf(t, target.id) >= OBJECTIVES.stalkFear
                    || objectiveBiasFor(t, 'stalk') > 0;
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
                || allied(o, t))
            // A2: an archetype that exists to keep somebody alive notices a
            // ward sooner and on thinner grounds than one that does not.
            && (o.health < OBJECTIVES.wardHealth + protectPull * OBJECTIVES.wardBiasHealth
                || getRel(t, o.id) > OBJECTIVES.wardBond - protectPull * OBJECTIVES.wardBiasBond));
        if (ward) {
            const o = offer(48, { kind: 'protect', wardId: ward.id, expires: expiry(OBJECTIVES.protectCycles) });
            if (o) return o;
        }
    }

    // 5c. §16: a body that cannot be spent. The rung below already sends a
    //     tribute to shelter on fatigue, low health or frostbite — none of
    //     which is an *injury*, and a tribute with a split arm and 70 health
    //     therefore had no reason to stop at all. Chosen on graded damage,
    //     and only where nobody is standing over them.
    const totalGrade = injuryGrade(t, 'legs') + injuryGrade(t, 'arms') + injuryGrade(t, 'torso');
    if (totalGrade >= OBJECTIVES.recoverInjuryGrade && hostilesHere.length === 0) {
        const o = offer(OBJECTIVES.recoverTier, { kind: 'recover', zone: t.zone, expires: expiry(OBJECTIVES.recoverCycles) });
        if (o) return o;
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

    // §16: somebody to ask. Every other person-shaped intention in this
    // cascade is adversarial or already settled — a tribute who has concluded
    // they cannot do this alone had no way to say so, and no way to go and do
    // anything about it. The warmth test is deliberately on the relationship
    // rather than on the archetype: wanting company is a position you arrive
    // at, not a disposition you were printed with.
    if (t.allianceId === undefined) {
        const worthAsking = state.tributes
            .filter(o => o.status === 'alive' && o.id !== t.id && o.allianceId === undefined
                && getRel(t, o.id) >= OBJECTIVES.courtWarmth
                && fearOf(t, o.id) < OBJECTIVES.fleeFear
                && cyclesSinceContact(state, t, o.id) <= OBJECTIVES.courtSightingAge)
            .sort((a, b) => getRel(t, b.id) - getRel(t, a.id))[0];
        if (worthAsking) {
            const o = offer(OBJECTIVES.courtTier, {
                kind: 'court', targetId: worthAsking.id, expires: expiry(OBJECTIVES.courtCycles),
            });
            if (o) return o;
        }
    }

    // §16: the ground somebody fell on. No survival value whatsoever, which
    // is the whole reason it is in the list — every other rung is a tribute
    // doing arithmetic, and a run in which nobody ever does anything that
    // costs them is a run about eight optimisers.
    //
    // Written first against `abandonedCamps`, which was the wrong source and
    // measured 0.00 of these per run: a camp is only minted for the dead
    // under the `salvage` arena law, so in most arenas nobody left a trace to
    // walk back to. A corpse's `zone` is where it fell, it is always there,
    // and it is what the intention was always about.
    const grieved = state.tributes
        .filter(o => o.status === 'dead' && o.zone !== t.zone && !collapsed.includes(o.zone)
            && getRel(t, o.id) >= OBJECTIVES.mournBond
            // Recent, in the only clock a corpse carries. A tribute does not
            // walk back across the arena for somebody who died on day one.
            && state.day - (o.dayOfDeath ?? -Infinity) <= OBJECTIVES.mournRecentDays)
        .sort((x, y) => getRel(t, y.id) - getRel(t, x.id))[0];
    if (grieved) {
        const o = offer(OBJECTIVES.mournTier, {
            kind: 'mourn', zone: grieved.zone, forId: grieved.id, expires: expiry(OBJECTIVES.mournCycles),
        });
        if (o) return o;
    }

    // §16: a map gone cold. A tribute who has not laid eyes on another
    // person in days is not calm, they are blind — and until now the two were
    // indistinguishable, because the cascade only ever reacted to people it
    // could already see. This is the one rung that goes looking for
    // information rather than for a thing.
    const field = state.tributes.filter(o => o.status === 'alive' && o.id !== t.id);
    // Blindness as a *share* of the field. Requiring it of every living
    // rival measured 0.03 climbs per run: in a field of twelve, one stale
    // sighting of one person was enough to call a tribute well-informed.
    const known = field.filter(o => cyclesSinceContact(state, t, o.id) <= OBJECTIVES.scoutBlindFor).length;
    const blind = field.length > 0 && known / field.length <= OBJECTIVES.scoutKnownShare;
    if (blind) {
        const vantage = nearestZoneMatching(ctx, t, active, z => zoneFeatures(z).elevation === true);
        if (vantage) {
            const o = offer(OBJECTIVES.scoutTier, { kind: 'scout', zone: vantage, expires: expiry(OBJECTIVES.scoutCycles) });
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
    //
    // Audit 2 §1.6: this was held in 0.0% of 18,195 tribute-cycles. Of the
    // 1,748 times the cascade reached this clause, the chokepoint held 559
    // times, the empty zone 344, the non-aggressive stance 1,483 — and
    // `fatigue > 45` only 163, which took all four together down to 18.
    //
    // The fatigue clause was also backwards. Waiting on a chokepoint is a
    // decision to spend time denying a route to other people; gating it on
    // being tired made it a rest behaviour wearing an ambush's name, and the
    // one tribute who did it was the one least able to do anything when
    // somebody finally walked in. You wait because you are *in shape to*, so
    // the test is now the other way round.
    const chokepoint = current && zoneFeatures(current).chokepoint === true;
    if (chokepoint && hostilesHere.length === 0 && !isAggressiveStance(t.stance)
        && t.vitals.fatigue < OBJECTIVES.waitMaxFatigue) {
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
    commitmentByCaution(ctx, t, here);
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

    /*
     * §3.2: the errand is done; the thing it was in service of is still there.
     * This is the whole of the planning horizon — a tribute who went for water
     * so they could set up on the chokepoint now goes and does that, instead of
     * re-deriving their life from scratch against the state of this instant.
     *
     * AUDIT-7 §1.3: and until now it could only ever remember one thing.
     *
     * `PLANNING.queueDepth` has said 2 since the queue was written, with the
     * comment "Two is a person; three is a planner". It was never reachable.
     * The old shape `shift()`ed the head here and then, further down, called
     * `queueGoal` — the queue's only writer — on what was left. So the queue
     * was always emptied before it could be written to, `[goal, ...rest]` could
     * never find a `rest`, and the state could not bootstrap. Measured over
     * 53,996 living-tribute cycles: depth 0 = 51,382, depth 1 = 2,614,
     * **depth 2 = zero**. `test:knobs` passed throughout, because the knob was
     * read; nothing checked that it could ever bind.
     *
     * Two changes, and the second is the one that matters:
     *
     *  1. The head is no longer consumed unless it is taken, and a head that
     *     has gone stale or unreachable is dropped without taking whatever is
     *     behind it with it.
     *  2. A queued goal now *competes* instead of preempting. It used to
     *     outrank the whole cascade unconditionally, which is both why the
     *     queue drained every cycle and why a tribute would walk back to a
     *     chokepoint while somebody was standing over them. It now gets first
     *     refusal on the same terms the standing goal already had — it wins
     *     when the cascade has settled for something unambitious, and loses to
     *     anything urgent. So a goal can sit in the queue across a cycle, which
     *     is the state depth 2 needs in order to exist at all.
     */
    const cycle = cycleOf(ctx.state);
    const liveQueue = (t.objectiveQueue ?? []).filter(g => queuedGoalStillStands(ctx, t, g, cycle));

    // A §3: the standing goal — the third slot behind the two-deep errand
    // queue. Even a two-deep queue is consumed by errands eventually, so a
    // goal that survives *more than two* interruptions needs somewhere to live:
    // a tribute who set out for the feast and stopped three times for water
    // should not simply forget about the feast. This is picked back up whenever
    // the cascade would otherwise settle for something unambitious.
    const standing = resumeStandingGoal(ctx, t);

    const previous = t.objective;
    // §3.2 (audit): before choosing again, judge the one that just ended.
    if (previous && previous.kind !== 'survive') recordObjectiveOutcome(ctx, t, previous);
    const chosenTier = { tier: 0 };
    let next = chooseObjective(ctx, t, here, undefined, chosenTier);
    const settledForLittle = chosenTier.tier < STANDING_GOAL.resumeBelowTier;

    // The queue gets first refusal — ahead of the standing goal, because it is
    // both more recent and more specific — and only over something unambitious.
    const head = liveQueue[0];
    if (head && settledForLittle) {
        const rest = liveQueue.slice(1);
        t.objectiveQueue = rest.length ? rest : undefined;
        t.objective = { ...head, expires: cycle + OBJECTIVES.reachCycles } as Objective;
        announce(ctx, t, t.objective);
        return;
    }
    // Not taken: it keeps its place, minus anything that has gone stale.
    t.objectiveQueue = liveQueue.length ? liveQueue : undefined;

    // ...and the standing goal only reasserts itself over something unambitious
    // too. A tribute fleeing a zone or dying of thirst has a better reason to be
    // doing what they are doing than a goal they set four cycles ago.
    if (standing && settledForLittle) {
        t.objective = standing;
        announce(ctx, t, standing);
        return;
    }

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
    // AUDIT-12 §5: the whole errand chain, not only its first stop — the goal
    // goes to the back of the queue and the second errand in front of it.
    const [prerequisite, secondErrand] = errandChain(ctx, t, next);
    if (prerequisite) {
        queueGoal(t, next);
        if (secondErrand) queueGoal(t, secondErrand);
        next = prerequisite;
    }

    t.objective = next;
    noteStandingGoal(ctx, t, next);

    // A §1: what the cascade weighed, for the tribute sheet.
    if (t.decisionTrace) {
        const label = (o: Objective) => objectiveLabel(ctx.state, { ...t, objective: o });
        t.decisionTrace.objectives = [
            { label: label(next), tier: chosenTier.tier },
            ...(runnerUp.kind !== 'survive' ? [{ label: label(runnerUp), tier: runnerTier.tier }] : []),
        ];
    }

    // Only narrate genuinely new intentions, and never the null one — a line
    // every time someone lapses back to "survive" would drown the feed.
    if (next.kind !== 'survive' && !sameObjective(previous, next)) {
        announce(ctx, t, next);
    }
}

/**
 * A §3: record a goal worth coming back to.
 *
 * Only the three that are actually goals rather than errands: the feast is a
 * scheduled appointment, a vengeance hunt is a promise, and the endgame
 * reposition is the one piece of forward planning the final four do.
 */
function noteStandingGoal(ctx: SimContext, t: Tribute, chosen: Objective) {
    const cycle = cycleOf(ctx.state);
    const reason = chosen.kind === 'reach' && chosen.reason === 'feast' ? 'feast'
        : chosen.kind === 'reach' && chosen.reason === 'endgame' ? 'endgame'
            : chosen.kind === 'hunt' && ensureMemory(t).vengeance.includes(chosen.targetId) ? 'avenge'
                : undefined;
    if (!reason) return;
    if (t.standingGoal?.reason === reason) return;
    t.standingGoal = { goal: chosen, reason, setCycle: cycle };
}

/**
 * A §3: is the standing goal still worth more than whatever the cascade is
 * about to settle for? Expired, completed and impossible goals are dropped.
 */
function resumeStandingGoal(ctx: SimContext, t: Tribute): Objective | undefined {
    const standing = t.standingGoal;
    if (!standing) return undefined;
    const cycle = cycleOf(ctx.state);

    // Aged out, or the thing it was about is over.
    const stale = cycle - standing.setCycle > STANDING_GOAL.maxCycles;
    const feastOver = standing.reason === 'feast'
        && ctx.state.feastDay === undefined && ctx.state.phase !== 'feast';
    const quarry = standing.goal.kind === 'hunt' ? standing.goal.targetId : undefined;
    const avenged = quarry !== undefined
        && ctx.state.tributes.find(o => o.id === quarry)?.status !== 'alive';
    if (stale || feastOver || avenged || !isObjectiveReachable(ctx, t, standing.goal)) {
        t.standingGoal = undefined;
        return undefined;
    }

    // Not yet — give the errand queue a few cycles to clear before reasserting.
    if (cycle - (standing.resumedCycle ?? standing.setCycle) < STANDING_GOAL.resumeCycles) return undefined;

    const resumed = { ...standing.goal, expires: cycle + OBJECTIVES.reachCycles } as Objective;
    // `setCycle` used to be reset here, so a goal resumed at least once per
    // window could never go stale. It keeps its birthday now.
    t.standingGoal = { ...standing, resumedCycle: cycle };
    return resumed;
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
            case 'scavenge': return `what ${name(o.ownerId)} left in ${o.zone}`;
            case 'court': return `finding ${name(o.targetId)}`;
            case 'mourn': return `going back for ${name(o.forId)}`;
            case 'recover': return 'letting the wound close';
            case 'scout': return `getting eyes on the arena from ${o.zone}`;
            case 'reach': return {
                water: 'finding water', shelter: 'finding somewhere to sleep',
                feast: 'the feast', ally: 'reaching their allies', forage: 'finding food',
                endgame: 'where this ends',
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
    // §16: two intentions of the same zone-shaped kind are the same plan when
    // they name the same place; the two person-shaped ones, the same person.
    if (a.kind === b.kind && 'zone' in a && 'zone' in b) return a.zone === b.zone;
    if (a.kind === b.kind && 'targetId' in a && 'targetId' in b) return a.targetId === b.targetId;
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
        // The three that stay put, and the three §16 ones that are a walk to a
        // place for three different reasons. Both groups answer with the zone
        // written on the objective.
        case 'hold':
        case 'wait':
        case 'recover':
        case 'scavenge':
        case 'mourn':
        case 'scout':
            return objective.zone;
        // §16: courting reads the same rule as protecting — you go to where
        // you last saw them, not to where they actually are.
        case 'court': {
            const them = state.tributes.find(o => o.id === objective.targetId && o.status === 'alive');
            if (!them) return undefined;
            if (them.zone !== t.zone && cyclesSinceContact(state, t, them.id) > MEMORY.sightingLifetime) return undefined;
            return them.zone;
        }
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

    if (objective.kind === 'hold' || objective.kind === 'wait' || objective.kind === 'recover') {
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

/** What the ledger says about hunting this particular tribute again. */
function sameTargetPenaltyFor(t: Tribute, targetId: string): number {
    const hunt = t.objectiveOutcomes?.hunt;
    const stalk = t.objectiveOutcomes?.stalk;
    const streak = (hunt?.lastTargetId === targetId ? hunt.streak : 0) + (stalk?.lastTargetId === targetId ? stalk.streak : 0);
    return Math.min(OBJECTIVES.failureStreakCap, streak) * OBJECTIVES.sameTargetPenalty;
}

/**
 * §3.2 (audit): did it work?
 *
 * Judged when an objective is replaced, against the state of the world at
 * that moment: a reach that ends standing in the zone worked, a hunt that
 * ends with the quarry dead by this tribute's hand worked, a flee that ends
 * anywhere but where it started worked, a protect whose ward is still alive
 * worked. Anything else is a failure — including an objective that simply
 * expired, which is the commonest way an intention fails in an arena.
 */
function recordObjectiveOutcome(ctx: SimContext, t: Tribute, previous: Objective) {
    const state = ctx.state;
    const find = (id: string) => state.tributes.find(o => o.id === id);
    let won: boolean;
    switch (previous.kind) {
        case 'reach': won = t.zone === previous.zone; break;
        case 'hunt': { const q = find(previous.targetId); won = !!q && q.status === 'dead' && q.lastDamage?.sourceId === t.id; break; }
        case 'stalk': { const q = find(previous.targetId); won = !!q && (q.status === 'dead' || (t.memory?.lastContact?.[q.id] ?? -Infinity) >= cycleOf(state) - 1); break; }
        case 'flee': won = t.zone !== previous.from; break;
        case 'protect': { const w = find(previous.wardId); won = !!w && w.status === 'alive'; break; }
        case 'hold':
        case 'wait': won = t.zone === previous.zone && t.status === 'alive'; break;
        // §16: arriving is the win for all three walks. Scavenging asks for
        // one thing more — the cache has to have been theirs when they got
        // there, otherwise they walked across the arena to look at a
        // trampled patch, which is a loss and should be remembered as one.
        case 'scavenge': won = t.zone === previous.zone
            && (state.abandonedCamps ?? []).some(c => c.zone === previous.zone && c.foundBy === t.id); break;
        case 'mourn':
        case 'scout': won = t.zone === previous.zone; break;
        // §16: the win is standing in front of them. Whether they said yes is
        // the alliance layer's question, and it is asked one rung later.
        case 'court': { const them = find(previous.targetId); won = !!them && them.zone === t.zone; break; }
        // §16: resting worked if the wound is smaller than it was.
        case 'recover': won = injuryGrade(t, 'legs') + injuryGrade(t, 'arms') + injuryGrade(t, 'torso')
            < OBJECTIVES.recoverInjuryGrade; break;
        default: return;
    }
    t.objectiveOutcomes = t.objectiveOutcomes ?? {};
    const record = t.objectiveOutcomes[previous.kind] ?? { tries: 0, wins: 0, streak: 0 };
    record.tries += 1;
    if (won) { record.wins += 1; record.streak = 0; record.lastTargetId = undefined; }
    else {
        record.streak += 1;
        record.lastTargetId = 'targetId' in previous ? previous.targetId : undefined;
    }
    t.objectiveOutcomes[previous.kind] = record;
}

/** True when the objective says to stay put this cycle. */
export function objectiveHolds(t: Tribute): boolean {
    return t.objective?.kind === 'hold' || t.objective?.kind === 'wait'
        // §16: recovering is the third way of deciding not to move.
        || t.objective?.kind === 'recover';
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
        case 'scavenge': return `Going for ${name(objective.ownerId)}'s kit in ${objective.zone}`;
        case 'court': return `Looking for ${name(objective.targetId)}`;
        case 'mourn': return `Going back to where ${name(objective.forId)} fell`;
        case 'recover': return `Resting up in ${objective.zone}`;
        case 'scout': return `Climbing ${objective.zone} for a look`;
        case 'reach': {
            const why = {
                water: 'for water', shelter: 'for shelter', feast: 'for the feast',
                ally: 'to reach an ally', forage: 'to forage', endgame: 'to force the end',
            }[objective.reason];
            return `Making for ${objective.zone} ${why}`;
        }
        default: return 'Surviving';
    }
}
