import { Tribute, attr } from '../models/types';
import { ACTION_BUDGET } from '../data/balance';
import { injuryGrade } from './wounds';

/**
 * AUDIT-9 stage C §3: "time and action budgets".
 *
 * The audit's first ask of the decision layer was this: *"A tribute cannot
 * travel far, forage, repair a shelter, negotiate and fight at full
 * effectiveness in one step. Major actions consume time; interruptions leave
 * partial work."*
 *
 * They could. A cycle handed every living tribute the same unpriced sequence —
 * craft, observe every zone their sightlines reach, re-stance, re-objective,
 * move, and then one resolved encounter — and nothing anywhere asked whether
 * there had been time for all of it. A tribute two cycles into a river
 * crossing still lashed a spear together, read the ridge, changed their mind
 * about where they were going and fought somebody, at full effectiveness, for
 * free. The encounter pass had a one-action gate (`acted`), but it governed
 * only the *encounter*: everything before it was outside the accounting
 * entirely, so the gate priced the cheapest part of the cycle and left the
 * expensive parts unpriced.
 *
 * A cycle is a budget. Actions cost hours out of it; when the hours are gone
 * the remaining actions do not silently happen anyway — they are refused, or
 * they start and are left half-done for next cycle to pick up.
 *
 * Two deliberate properties:
 *
 *  - **Refusal is visible, not silent.** An action that cannot be afforded
 *    does not quietly no-op; the caller learns it was refused and can narrate
 *    it or choose something cheaper. The audit's measurement list asks for
 *    "impossible intents" to be countable, which requires them to be a thing
 *    that is said rather than a branch that was never taken.
 *  - **Partial work persists.** `beginWork` and `resumeWork` carry progress
 *    across cycles, so an interrupted shelter is a half-built shelter rather
 *    than either a finished one or nothing. This is the shape travel already
 *    had — `Tribute.transit` is a multi-cycle crossing with a remainder — and
 *    the reason it was the only "interruption leaves partial work" in the
 *    engine was that it was the only action with a cost at all.
 *
 * The budget is hours rather than an abstract point, because every caller has
 * to reason about it in prose eventually ("no time to set a snare *and* build
 * a shelter") and hours are the unit that makes that argument readable.
 */

/**
 * A fresh cycle: everybody gets the day back, minus what their body costs.
 *
 * `hoursToday` records the allowance as granted. `hoursFor` is recomputed from
 * live fatigue and health, so it drifts *within* a cycle — a tribute who rested
 * has a longer notional day at dusk than the one they were actually given at
 * dawn. Anything asking "how much of today has this tribute spent" has to
 * compare against what they were given, not against what they would be given
 * now; the first scenario written against this got it wrong and reported the
 * budget leaking when it was the measurement that was moving.
 */
export function resetBudget(t: Tribute) {
    t.hoursToday = hoursFor(t);
    t.hoursLeft = t.hoursToday;
}

/** The allowance this cycle granted, for anything reporting on spending. */
export function hoursToday(t: Tribute): number {
    return t.hoursToday ?? hoursFor(t);
}

/** Hours actually spent so far this cycle. */
export function hoursSpent(t: Tribute): number {
    return Math.max(0, hoursToday(t) - hoursLeft(t));
}

/**
 * The hours this tribute actually has.
 *
 * Not a constant, because the audit's "load and physiology" item is the same
 * idea seen from the other side: a broken leg does not make each action worse
 * by a modifier, it makes the day shorter. Exhaustion, a bad leg and being
 * badly hurt all buy less done, and `Tireless` buys more.
 */
export function hoursFor(t: Tribute): number {
    let hours = ACTION_BUDGET.baseHours;
    hours -= (t.vitals.fatigue / 100) * ACTION_BUDGET.fatigueHourCost;
    hours -= injuryGrade(t, 'legs') * ACTION_BUDGET.legInjuryHourCost;
    if (t.health < ACTION_BUDGET.hurtHealthLine) hours -= ACTION_BUDGET.hurtHourCost;
    // Endurance is the attribute that means "can keep going", so it is hours
    // rather than a modifier on each thing those hours buy.
    hours += (attr(t, 'endurance') - ACTION_BUDGET.enduranceMidpoint) * ACTION_BUDGET.enduranceHourBonus;
    return Math.max(ACTION_BUDGET.minHours, hours);
}

/** Hours remaining, defaulting for a tribute who predates the budget. */
export function hoursLeft(t: Tribute): number {
    return t.hoursLeft ?? hoursFor(t);
}

/** Whether there is room for an action of this size. */
export function canAfford(t: Tribute, hours: number): boolean {
    return hoursLeft(t) >= hours;
}

/**
 * Spend hours if they are there. Returns false and spends nothing otherwise,
 * which is what makes a refusal a fact the caller can act on.
 */
export function spend(t: Tribute, hours: number): boolean {
    const left = hoursLeft(t);
    if (left < hours) return false;
    t.hoursLeft = left - hours;
    return true;
}

/**
 * Spend whatever is left, up to `hours`, and report how much went in.
 *
 * This is the partial-work primitive: an action too big for what remains still
 * gets the remaining hours put into it, and the caller records progress.
 */
export function spendUpTo(t: Tribute, hours: number): number {
    const spent = Math.min(hoursLeft(t), hours);
    t.hoursLeft = hoursLeft(t) - spent;
    return spent;
}

/**
 * Put hours into a piece of work, returning true when it is finished.
 *
 * A tribute can only have one thing on the go. Starting something else
 * abandons what was in progress — which is a real cost, and the reason a
 * tribute who keeps changing their mind gets nothing built.
 */
export function work(t: Tribute, kind: string, totalHours: number): boolean {
    if (t.partialWork && t.partialWork.kind !== kind) delete t.partialWork;
    const done = t.partialWork?.kind === kind ? t.partialWork.hoursDone : 0;
    const spent = spendUpTo(t, totalHours - done);
    if (spent <= 0) return false;
    const total = done + spent;
    if (total >= totalHours) {
        delete t.partialWork;
        return true;
    }
    t.partialWork = { kind, hoursDone: total };
    return false;
}

/** How far along a piece of work is, 0 when it has not been started. */
export function progressOf(t: Tribute, kind: string, totalHours: number): number {
    if (t.partialWork?.kind !== kind) return 0;
    return Math.min(1, t.partialWork.hoursDone / totalHours);
}
