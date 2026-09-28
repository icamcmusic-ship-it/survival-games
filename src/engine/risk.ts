import { wardDownedRisk } from './relationsArc';
import { riskShift } from './arenaDepth';
import { Tribute } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { AUDIT14_ENGINE as E14, RISK, STANCE } from '../data/balance';
import { allied } from './alliance';
import { fearFraction } from './fear';
import { isBeingFollowed } from './intent';
import { SimContext, getAlive } from './context';
import { effectiveCaution } from './archetypeHooks';
import { inventoryValue } from './items';

/**
 * Workstream A §4: state-dependent risk tolerance.
 *
 * `riskCurve` moved an archetype's caution with the day count and nothing
 * else — a Career at 20 health with a full pack on day nine read the board
 * exactly like the same Career at 90 health on day one. The composite here is
 * what the stance table, the hunt scorer, the destination scorer and the
 * retreat roll all read instead of `arch.caution` alone:
 *
 *   temperament   aggression pushes up, effective (curved) caution pushes down;
 *   health        the single strongest state term — you take chances you can survive;
 *   kit           a weapon is a reason to; a valuable pack is something to lose;
 *   day count     a long run wears everybody down toward caution;
 *   field size    a small field is arithmetic — somebody has to force it.
 *
 * Returns roughly [-1, 1]; positive is willing. Pure, no RNG draws.
 */
export function riskTolerance(ctx: SimContext, t: Tribute): number {
    const arch = ARCHETYPES[t.archetype];
    const day = ctx.state.day;
    let risk = arch.aggression * RISK.aggressionWeight
        - effectiveCaution(t, day) * RISK.cautionWeight;

    risk += ((t.health - RISK.healthPivot) / 100) * RISK.healthWeight;

    if (t.inventory.some(i => i.type === 'weapon')) risk += RISK.weaponBonus;
    const kit = inventoryValue(t);
    risk -= Math.min(RISK.kitMaxPenalty, Math.max(0, kit - RISK.kitPivot) * RISK.kitWeightPerPoint);

    risk -= Math.min(RISK.dayMaxPenalty, Math.max(0, day - RISK.dayPivot) * RISK.dayWeightPerDay);

    const field = getAlive(ctx.state).length;
    risk += Math.min(RISK.fieldMaxBonus, Math.max(0, RISK.fieldPivot - field) * RISK.fieldWeightPerTribute);

    // AUDIT-11 §5: the late-game curve — desperation, turned hoarders, broken pacifists.
    risk += riskShift(ctx.state, t);

    // AUDIT-14 T5: the room. Company, the most frightening person here, being
    // followed, and how the best hostile here measures up against them.
    risk += roomRisk(ctx, t);

    // AUDIT-14 T12: a ward down beside them.
    risk += wardDownedRisk(ctx.state, t);

    return Math.max(-1, Math.min(1, risk));
}

function powerOf(o: Tribute): number {
    return o.attributes.strength + o.attributes.agility
        + (o.inventory.some(i => i.type === 'weapon') ? STANCE.ownWeaponBonus : 0)
        + o.health / STANCE.ownHealthDivisor;
}

/** AUDIT-14 T5: what the people in this zone do to a tribute's nerve. */
function roomRisk(ctx: SimContext, t: Tribute): number {
    let allies = 0;
    let worstFear = 0;
    let bestHostile = 0;
    ctx.state.tributes.forEach(o => {
        if (o.status !== 'alive' || o.id === t.id || o.zone !== t.zone) return;
        if (allied(o, t)) { allies += 1; return; }
        worstFear = Math.max(worstFear, fearFraction(t, o.id));
        bestHostile = Math.max(bestHostile, powerOf(o));
    });
    let r = Math.min(E14.riskAllyCap, allies * E14.riskPerAllyHere);
    r -= E14.riskFearWeight * worstFear;
    if (isBeingFollowed(ctx, t)) r -= E14.riskFollowedPenalty;
    if (bestHostile > 0) r += E14.riskPowerWeight * (powerOf(t) - bestHostile) / E14.riskPowerDivisor;
    return r;
}
