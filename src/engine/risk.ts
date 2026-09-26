import { riskShift } from './arenaDepth';
import { Tribute } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { RISK } from '../data/balance';
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

    return Math.max(-1, Math.min(1, risk));
}
