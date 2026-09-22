import { DamageRecord, Tribute } from '../models/types';

/**
 * AUDIT-10 B3-02: every wound, not just the last one.
 *
 * The audit asks for causal inspection — *"from a death, jump to the wound,
 * the source incident, the failed escape, the attribution"* — and the engine
 * could not answer it. `DamageRecord` is a complete, typed account of a single
 * wound: cause, cause code, who dealt it, what kind of thing it was, the cycle
 * and the amount. Exactly one was kept. `lastDamage` is the killing blow, and
 * a killing blow explains a death the way the final domino explains the row.
 *
 * A tribute who bled out on day six was cut on day two, and the chronicle was
 * the only place that ever said so — which puts the answer behind a regular
 * expression over prose, and behind a chronicle that gets trimmed, both of
 * which B3-03 has just finished arguing against.
 *
 * So the wounds accumulate. The sites that used to assign `lastDamage` go
 * through here instead, which is the point of a funnel: a route somebody adds
 * later is on the ledger without anybody remembering to put it there.
 *
 * (`engine/wounds` is the injury *model* — grades, bleeding, recovery. This is
 * the account of what caused them.)
 */

/**
 * The ledger is bounded, because two dozen unbounded arrays ride in the save
 * envelope and "a run is only so long" is not a bound.
 *
 * Measured rather than guessed: across 80 runs and 1,920 tributes, a tribute
 * takes 13.5 wounds and the worst took 84. A first draft capped at 64 and
 * truncated 9 of those 1,920 — which is the whole argument for measuring, since
 * 64 was chosen as a number that "never bites".
 *
 * Oldest-first is the wrong end to drop and this drops it anyway, because the
 * alternative is losing the killing blow.
 */
// balance-exempt: a storage bound on a record, not a lever on anything the simulation does
const LEDGER_CAP = 256;

export function recordWound(t: Tribute, record: DamageRecord) {
    // Every caller has already taken the health off; `clampTribute` runs after,
    // so the floor is applied here rather than read.
    const stamped: DamageRecord = { ...record, healthAfter: Math.max(0, Math.round(t.health)) };
    t.lastDamage = stamped;
    const ledger = t.wounds ?? (t.wounds = []);
    ledger.push(stamped);
    if (ledger.length > LEDGER_CAP) ledger.splice(0, ledger.length - LEDGER_CAP);
}

/**
 * The wounds worth naming, newest first.
 *
 * Deliberately not "recent": a wound that took forty health two cycles ago is
 * most of why somebody is at fifteen, and a scratch from this cycle is not.
 */
// balance-exempt: a display threshold for which wounds are worth a line, read by no simulation path
export function significantWounds(t: Tribute, minAmount = 4): DamageRecord[] {
    return [...(t.wounds ?? [])].reverse().filter(w => w.amount >= minAmount);
}

/**
 * The same blow, credited to somebody else.
 *
 * Two sites re-write `lastDamage` without anybody having been hurt again: the
 * downed window closing on a finisher, and `killTribute` naming a killer the
 * damage record did not. Both carry the *old* amount forward, because there is
 * no new wound — they are settling the attribution of one that already landed.
 *
 * So they amend the last entry rather than appending. Appending would put a
 * second forty-damage blow on a tribute who took one, which would make the
 * ledger disagree with the health bar the moment anybody added them up — and a
 * record that can disagree with the simulation is the thing this whole panel
 * exists to avoid.
 */
export function reattributeWound(t: Tribute, record: DamageRecord) {
    // Both callers are death sites — the downed window closing on a finisher,
    // and `killTribute` naming a killer the damage record did not. Carrying the
    // previous entry's `healthAfter` forward put 19 of 1,920 dead tributes on
    // record as finished by a blow that left them standing, because the entry
    // being re-stamped was an older wound and its figure was still true of it.
    const stamped: DamageRecord = { ...record, healthAfter: 0 };
    t.lastDamage = stamped;
    const ledger = t.wounds ?? (t.wounds = []);
    if (ledger.length === 0) ledger.push(stamped);
    else ledger[ledger.length - 1] = stamped;
}
