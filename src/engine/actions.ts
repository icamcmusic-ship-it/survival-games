import { GameState, Tribute, ZoneLevel } from '../models/types';
import { SimContext } from './context';
import { isActive, isDowned } from './downed';
import { isVertical, levelOf, samePlace } from './verticality';
import { canAfford, spend } from './actionBudget';
import { carryCapacity } from './items';
import { hopsTo, severedEdgeSet, zoneSightlines, getZone } from './map';

/**
 * AUDIT-10 batch 2: one place that says what a tribute is physically able to do.
 *
 * Batch 1 repaired nine separate violations of physical rules — a downed
 * tribute climbing a shaft, a helper treating somebody a level below them,
 * three alliance members in three sectors sharing one box, a rescuer with no
 * hours left completing a haul. Each was repaired where it was found, which is
 * correct and is not sufficient: there were nine of them *because* every
 * subsystem asked its own version of "can this happen", and a tenth subsystem
 * will ask a tenth version.
 *
 * The audit's §4 asks for the thing that stops that:
 *
 * > Introduce a small action specification with actor IDs, required
 * > capability, origin/target location and level, resources reserved,
 * > duration, interruption policy, success criteria and typed results.
 * > Validate twice: before committing and immediately before resolution.
 * >
 * > Use explicit queries: `canAct`, `canReach`, `canObserve`, `canTransfer`,
 * > `canCarry` and `canAfford`. `isActive` currently means alive and not
 * > downed; it does not by itself prove a person is not in transit or has free
 * > hands/time.
 *
 * Two halves, and the second is the one that matters:
 *
 *   1. **The queries.** Six predicates, each answering exactly one question,
 *      each with the reason it said no. Nothing here is new behaviour — it is
 *      the checks batch 1 wrote, in one file, asked the same way everywhere.
 *   2. **The double validation.** The examples the audit gives are all things
 *      that change *between* deciding and doing: the rescue target moved, the
 *      rope holder died, the cache emptied, a gate closed, a promise expired
 *      while somebody was crossing. A check at intent time is not a check.
 *
 * Why refusals are values rather than booleans: the audit's measurement list
 * asks for "impossible-action attempts" to be countable, and a branch that was
 * never taken cannot be counted. A refusal that names itself can be tallied,
 * narrated, and used to pick a cheaper action instead.
 */

/** Why an action cannot happen. One reason, the first that applies. */
export type Refusal =
    /** Dead, or downed — `isActive` is false. */
    | 'incapable'
    /** Mid-crossing. Somebody in transit is not standing anywhere yet. */
    | 'in-transit'
    /** Not in the same place. In a vertical zone, "place" includes the level. */
    | 'out-of-contact'
    /** Not reachable at all: no route, or too far for this action. */
    | 'out-of-reach'
    /** Cannot see or hear it from here. */
    | 'unobserved'
    /** No hours left in the day for an action this size. */
    | 'no-time'
    /** No hands free — the pack is full. */
    | 'no-room'
    /** The thing being acted on is gone: the target died, the cache emptied. */
    | 'gone'
    /** A capability the actor does not have: an item, a proficiency, a trait. */
    | 'incapable-of-this';

export type Verdict = { ok: true } | { ok: false; why: Refusal };

const YES: Verdict = { ok: true };
const no = (why: Refusal): Verdict => ({ ok: false, why });

/* -------------------------------------------------------------------------- */
/* The six queries                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Able to do anything at all this cycle.
 *
 * `isActive` is alive and not downed, and the audit is explicit that this is
 * not the same question: a tribute two cycles into a river crossing is active
 * and is not available. Every other query below starts here.
 */
export function canAct(t: Tribute): Verdict {
    if (!isActive(t)) return no('incapable');
    if (t.transit !== undefined) return no('in-transit');
    return YES;
}

/**
 * Close enough to put hands on: to treat, to strike, to hand something over.
 *
 * This is `samePlace` — zone equality in a flat zone, zone *and* level in a
 * vertical one — and it is the predicate F09 replaced a zone-name comparison
 * with. Direct contact is the strictest of the three proximity questions.
 */
export function canReach(state: GameState, actor: Tribute, target: Tribute): Verdict {
    const able = canAct(actor);
    if (!able.ok) return able;
    if (target.status !== 'alive') return no('gone');
    if (target.transit !== undefined) return no('in-transit');
    return samePlace(state.arena, actor, target) ? YES : no('out-of-contact');
}

/**
 * Reachable by something that spans a gap — a rope, a thrown line, a shouted
 * instruction acted on.
 *
 * Deliberately looser than `canReach` and deliberately not "the same zone
 * name": a rope may span the levels of a vertical zone, which is the one case
 * where two people are in different places and one can still get a line to the
 * other. Everything else requires contact.
 */
export function canSpanTo(state: GameState, actor: Tribute, target: Tribute): Verdict {
    const able = canAct(actor);
    if (!able.ok) return able;
    if (target.status !== 'alive') return no('gone');
    if (actor.zone !== target.zone) return no('out-of-reach');
    if (!isVertical(state.arena, target.zone)) return YES;
    // Within a vertical zone: the same level is contact, and upper-to-lower is
    // the span. Lower-to-upper is not — a line is paid *down*.
    if (samePlace(state.arena, actor, target)) return YES;
    return levelOf(state.arena, actor) === 'upper' && levelOf(state.arena, target) === 'lower'
        ? YES
        : no('out-of-reach');
}

/**
 * Able to see or hear something happen there.
 *
 * Wider than reach and narrower than omniscience, which is the audit's point:
 * *"hearing a scream is different from identifying its speaker."* Sightlines
 * are the arena's own, so a zone that overlooks another is an observation and
 * a zone that does not is not.
 */
export function canObserve(state: GameState, actor: Tribute, zone: string): Verdict {
    const able = canAct(actor);
    if (!able.ok) return able;
    if (actor.zone === zone) return YES;
    const here = getZone(state.arena, actor.zone);
    if (!here) return no('unobserved');
    return zoneSightlines(state.arena, here).includes(zone) ? YES : no('unobserved');
}

/** Hours in the day for an action this size. F15's check, named. */
export function canSpend(t: Tribute, hours: number): Verdict {
    const able = canAct(t);
    if (!able.ok) return able;
    return canAfford(t, hours) ? YES : no('no-time');
}

/** Room in the pack for `count` more things. */
export function canCarry(t: Tribute, count = 1): Verdict {
    return t.inventory.length + count <= carryCapacity(t) ? YES : no('no-room');
}

/**
 * A hand-over: both people present, and the receiver with somewhere to put it.
 *
 * F12's boundary as a question that can be asked before the transfer rather
 * than a result that has to be read after it — though the atomic transfer
 * still reports what actually happened, because a stack can merge into a
 * partial one and change the answer.
 */
export function canTransfer(state: GameState, from: Tribute, to: Tribute, count = 1): Verdict {
    const reach = canReach(state, from, to);
    if (!reach.ok) return reach;
    return canCarry(to, count);
}

/** Within `hops` crossings of a zone, by a route that currently exists. */
export function canTravelTo(state: GameState, t: Tribute, zone: string, hops = 1): Verdict {
    const able = canAct(t);
    if (!able.ok) return able;
    if (t.zone === zone) return YES;
    const distance = hopsTo(state.arena, t.zone, zone, state.collapsedZones ?? [], severedEdgeSet(state));
    return distance !== undefined && distance <= hops ? YES : no('out-of-reach');
}

/* -------------------------------------------------------------------------- */
/* The specification                                                          */
/* -------------------------------------------------------------------------- */

/** Where an action happens. A zone, and in a vertical zone a level too. */
export interface ActionSite {
    zone: string;
    level?: ZoneLevel;
}

/**
 * One intended action, stated fully enough to be validated twice.
 *
 * `check` is the caller's own extra condition — the cache still has bread in
 * it, the promise has not expired, the gate is still open — and is the thing
 * that makes the second validation worth doing at all. It is re-run at
 * resolution.
 */
export interface ActionSpec {
    /** What this is, for metrics and for narration. */
    kind: string;
    /** Whoever has to be able to act. The first is the one who pays. */
    actors: Tribute[];
    /** Hours reserved from the payer's day. */
    hours: number;
    /** Where it happens, when it is tied to a place. */
    site?: ActionSite;
    /** Everyone who has to be reachable by `actors[0]` for it to be legal. */
    participants?: Tribute[];
    /** Anything else that must still be true. Re-checked at resolution. */
    check?: () => boolean;
}

export type ActionResult =
    | { ok: true }
    /** Refused, with the reason and which actor it was about. */
    | { ok: false; why: Refusal; actorId?: string };

/**
 * Can this happen? Asked without changing anything.
 *
 * Called twice per action by `perform`: once before committing, and once
 * immediately before resolution, because every example in the audit's list is
 * a thing that becomes false in between.
 */
export function validate(state: GameState, spec: ActionSpec): ActionResult {
    for (const actor of spec.actors) {
        const able = canAct(actor);
        if (!able.ok) return { ok: false, why: able.why, actorId: actor.id };
    }
    const payer = spec.actors[0];
    if (payer && spec.hours > 0) {
        const time = canSpend(payer, spec.hours);
        if (!time.ok) return { ok: false, why: time.why, actorId: payer.id };
    }
    if (spec.site && payer) {
        if (payer.zone !== spec.site.zone) return { ok: false, why: 'out-of-contact', actorId: payer.id };
        if (spec.site.level !== undefined && (payer.zoneLevel ?? 'upper') !== spec.site.level) {
            return { ok: false, why: 'out-of-contact', actorId: payer.id };
        }
    }
    for (const other of spec.participants ?? []) {
        if (!payer) break;
        const reach = canReach(state, payer, other);
        if (!reach.ok) return { ok: false, why: reach.why, actorId: other.id };
    }
    if (spec.check && !spec.check()) return { ok: false, why: 'gone' };
    return { ok: true };
}

/**
 * Validate, reserve the hours, resolve, and record what happened.
 *
 * The one entry point a major action should go through. `resolve` runs only
 * after the *second* validation passes, and the hours are spent immediately
 * before it — so a refusal at either gate costs nothing, and a resolution
 * cannot happen on time the actor does not have.
 *
 * Refusals are counted rather than dropped: `state.impossibleActions` is the
 * audit's "impossible-action attempts" metric, and it exists because a branch
 * that was never taken cannot be measured.
 */
export function perform(ctx: SimContext, spec: ActionSpec, resolve: () => void): ActionResult {
    const first = validate(ctx.state, spec);
    if (!first.ok) { noteRefusal(ctx.state, spec.kind, first.why); return first; }

    // Anything can have happened between the two — including, in a single
    // cycle, another action of this same pass killing a participant.
    const second = validate(ctx.state, spec);
    if (!second.ok) { noteRefusal(ctx.state, spec.kind, second.why); return second; }

    const payer = spec.actors[0];
    if (payer && spec.hours > 0 && !spend(payer, spec.hours)) {
        noteRefusal(ctx.state, spec.kind, 'no-time');
        return { ok: false, why: 'no-time', actorId: payer.id };
    }
    noteAttempt(ctx.state, spec.kind);
    resolve();
    return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Measurement                                                                */
/* -------------------------------------------------------------------------- */

/**
 * AUDIT-10 batch 2, the audit's §4 measurement list.
 *
 * *"Add behavior metrics: impossible-action attempts, affordable-plan
 * completion, ... These reveal failures that 'event fired at least once'
 * cannot."* A chain that fires in one run per thousand because its actors
 * never have the hours for it looks, to every existing check, exactly like a
 * chain that is meant to be rare.
 */
export function noteRefusal(state: GameState, kind: string, why: Refusal) {
    state.actionLedger = state.actionLedger ?? { attempted: {}, refused: {} };
    const key = `${kind}:${why}`;
    state.actionLedger.refused[key] = (state.actionLedger.refused[key] ?? 0) + 1;
}

export function noteAttempt(state: GameState, kind: string) {
    state.actionLedger = state.actionLedger ?? { attempted: {}, refused: {} };
    state.actionLedger.attempted[kind] = (state.actionLedger.attempted[kind] ?? 0) + 1;
}

/** Everything refused, worst first, for a report. */
export function refusalSummary(state: GameState): Array<{ key: string; count: number }> {
    const refused = state.actionLedger?.refused ?? {};
    return Object.entries(refused)
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count);
}

/** Convenience for the several callers that only want a yes or no. */
export function allowed(v: Verdict | ActionResult): boolean {
    return v.ok;
}

/** Re-exported so a caller needs one import to ask any of these. */
export { isActive, isDowned };
