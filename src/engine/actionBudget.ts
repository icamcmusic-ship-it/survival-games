import { Tribute, attr } from '../models/types';
import { ACTION_BUDGET } from '../data/balance';
import { injuryGrade } from './wounds';
import { isOverprepared, scoutsTheExit } from '../data/traits';
import { profOf } from './proficiency';

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
 * AUDIT-9 stage E: a hard ceiling on crossings, on top of the hours.
 *
 * Hours alone stopped being a sufficient constraint once the day lengthened
 * and `pacing` started buying hours back: a fit, well-practised tribute could
 * afford four or five crossings in a cycle, which is not a long day, it is a
 * different map. The budget is the *economic* limit and this is the physical
 * one — there are only so many hours of daylight and only so far a body goes
 * in them, however good at walking it is.
 *
 * Caught by the scenario "a second crossing does not fit in the same day",
 * which had quietly become false for the toughest tributes.
 */
export function crossingsLeft(t: Tribute): number {
    return Math.max(0, ACTION_BUDGET.maxCrossingsPerCycle - (t.crossingsThisCycle ?? 0));
}

export function noteCrossing(t: Tribute) {
    t.crossingsThisCycle = (t.crossingsThisCycle ?? 0) + 1;
}

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
    t.crossingsThisCycle = 0;
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

/**
 * AUDIT-9 stage D: what a crossing costs *this* tribute.
 *
 * `Overprepared` carries the spare and the spare's spare, and the audit's cost
 * for it is "increased load and slower departure" — so the pack is bigger
 * (a `capacity` mod) and getting it moving takes longer. `Exit-Minded` spends
 * part of the day finding the way out before committing to ground, which is
 * the same shape: the preparation is real hours, and it buys a real thing.
 */
export function travelHoursFor(t: Tribute): number {
    /*
     * AUDIT-9 stage E: `pacing` is the proficiency for covering ground, and
     * it buys hours back.
     *
     * Added as a controlled balance experiment rather than a guess. Pricing
     * travel halved the Broker's win rate (4.33% -> 2.29% at n=1,600) and put
     * its set piece under the firing floor, because a broker needs a client
     * *in the same zone* and a field that moves less meets less. The lever
     * that fixes it has to give the walking back to the people whose job is
     * walking, not make walking cheap for everyone — which is what a
     * proficiency does and a flat reduction does not.
     */
    let hours = ACTION_BUDGET.travelHours
        * Math.max(ACTION_BUDGET.minPacingMultiplier, 1 - profOf(t, 'pacing') * ACTION_BUDGET.pacingHourRelief);
    if (isOverprepared(t)) hours += ACTION_BUDGET.overpreparedTravelHours;
    if (scoutsTheExit(t)) hours += ACTION_BUDGET.exitMindedScoutHours;
    return hours;
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
 * Where a piece of work is being done — a job's site, not just its kind.
 *
 * AUDIT-10 B10: `work()` keyed partial progress on the kind alone, so a shelter
 * was a shelter wherever you were. Two hours of framing on the North Ridge plus
 * one hour somewhere else finished "the" shelter, and `buildShelter()` then
 * created it at wherever the tribute was standing when the last hour went in.
 * A fixed construction does not move because its builder did; a job carries the
 * place it belongs to, and arriving somewhere else abandons it.
 */
export interface JobSite {
    zone: string;
    level?: string;
}

function siteOf(t: Tribute): JobSite {
    return { zone: t.zone, level: t.zoneLevel };
}

function sameSite(a: JobSite | undefined, b: JobSite): boolean {
    if (!a) return true;
    return a.zone === b.zone && (a.level ?? 'upper') === (b.level ?? 'upper');
}

/**
 * Put hours into a piece of work, returning true when it is finished.
 *
 * A tribute can only have one thing on the go. Starting something else — or
 * carrying a fixed job somewhere it does not belong — abandons what was in
 * progress, which is a real cost, and the reason a tribute who keeps changing
 * their mind gets nothing built.
 *
 * `fixed` marks a job that belongs to its site: shelters, barricades, traps and
 * hazard mitigation are all built somewhere, and leaving means leaving the
 * work. Portable crafting passes `fixed: false` and travels with its owner.
 */
export function work(
    t: Tribute,
    kind: string,
    totalHours: number,
    opts: { fixed?: boolean } = {},
): boolean {
    const fixed = opts.fixed !== false;
    const here = siteOf(t);
    const carried = t.partialWork;
    const resumable = carried !== undefined
        && carried.kind === kind
        && (!fixed || sameSite(carried.site, here));
    if (carried && !resumable) delete t.partialWork;
    const done = resumable ? carried!.hoursDone : 0;
    /*
     * AUDIT-10 B11: finish immediately when there is no work left to do.
     *
     * A job's hour cost is not immutable — hazard mitigation recomputes it from
     * the tribute's carpentry, so a skill gained mid-job can make the total
     * *smaller* than the hours already banked. Three hours done against a newly
     * reduced two-hour total called `spendUpTo(-1)`, which handed an hour back
     * (one remaining hour became two), returned false, and left the partial
     * work in place to do it again next cycle.
     */
    const remaining = totalHours - done;
    if (remaining <= 0) {
        delete t.partialWork;
        return true;
    }
    const spent = spendUpTo(t, remaining);
    if (spent <= 0) return false;
    const total = done + spent;
    if (total >= totalHours) {
        delete t.partialWork;
        return true;
    }
    t.partialWork = { kind, hoursDone: total, site: fixed ? here : undefined, totalHours };
    return false;
}

/** How far along a piece of work is, 0 when it has not been started. */
export function progressOf(t: Tribute, kind: string, totalHours: number): number {
    const carried = t.partialWork;
    if (carried?.kind !== kind) return 0;
    // Progress on a job at a site the tribute has walked away from is progress
    // on a thing that is not here; reporting it as this job's would put "2 of 3
    // hours" on a shelter nobody is standing next to.
    if (!sameSite(carried.site, siteOf(t))) return 0;
    return Math.min(1, carried.hoursDone / totalHours);
}
