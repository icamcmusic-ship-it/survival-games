import { Tribute } from '../models/types';
import { DEBTS } from '../data/balance';
import { DEBT_TEXTS } from '../data/flavorText';
import { SimContext, getAlive } from './context';
import { adjustMutual, adjustRel, getRel } from './relationships';
import { noteStoodBy } from './memory';
import { giveItem } from './items';
import { addExcitement } from './audience';
import { clampTribute } from './vitals';

/**
 * Debts: what being saved actually costs.
 *
 * `memory.stoodBy` already recorded that somebody took a real risk for you —
 * shared a fight, handed over supplies they needed, patched you up — and it
 * gated romance off that, which is good design. But nothing ever *charged* for
 * it. A tribute could be pulled out of a fire on day two and knife the person
 * who did it on day three at exactly the same odds as a stranger.
 *
 * A debt is a number that decays slowly, raises the cost of betraying the
 * creditor, and can be discharged — which is a beat the chronicle never had:
 * somebody paying somebody back.
 */

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

export function debtTo(t: Tribute, creditorId: string): number {
    return t.debts?.[creditorId] ?? 0;
}

/** Records that `creditor` did something for `debtor` that has to be answered. */
export function incurDebt(debtor: Tribute, creditor: Tribute, amount: number) {
    if (debtor.id === creditor.id) return;
    debtor.debts = debtor.debts ?? {};
    debtor.debts[creditor.id] = Math.min(DEBTS.max, debtTo(debtor, creditor.id) + amount);
    // The creditor knows what they did, even if nobody says so.
    noteStoodBy(creditor, debtor.id);
}

export function clearDebt(debtor: Tribute, creditorId: string) {
    if (!debtor.debts) return;
    delete debtor.debts[creditorId];
    if (Object.keys(debtor.debts).length === 0) delete debtor.debts;
}

/**
 * How much harder it is to move on somebody you owe. Consumed by the betrayal
 * layer as a straight multiplier on the willingness to turn on them.
 */
export function betrayalReluctance(betrayer: Tribute, victimId: string): number {
    const owed = debtTo(betrayer, victimId);
    if (owed <= 0) return 1;
    return Math.max(DEBTS.minBetrayalMultiplier, 1 - owed * DEBTS.betrayalResistPerPoint);
}

/**
 * A tribute with the means settles up. Rare, deliberate, and one of the few
 * genuinely warm things that can happen in an arena.
 */
export function repayDebts(ctx: SimContext) {
    const alive = getAlive(ctx.state);

    alive.forEach(debtor => {
        if (!debtor.debts) return;
        const creditorId = Object.keys(debtor.debts)
            .sort((a, b) => debtTo(debtor, b) - debtTo(debtor, a))[0];
        if (!creditorId) return;
        const creditor = alive.find(o => o.id === creditorId);
        // A debt to the dead cannot be paid, only carried.
        if (!creditor || creditor.zone !== debtor.zone) return;
        if (debtTo(debtor, creditorId) < DEBTS.repayThreshold) return;
        if (!ctx.rng.chance(DEBTS.repayChance)) return;

        // Pay in whatever they can spare that the creditor actually needs.
        const spare = debtor.inventory.filter(i => i.type !== 'weapon' || debtor.inventory.filter(w => w.type === 'weapon').length > 1);
        const gift = spare.length > 0
            ? spare.reduce((best, i) => (i.value > best.value ? i : best))
            : undefined;

        if (gift) {
            debtor.inventory = debtor.inventory.filter(i => i !== gift);
            giveItem(creditor, gift);
            ctx.logEvent(
                fill(ctx.pickText(DEBT_TEXTS.repayItem), {
                    debtor: debtor.name, creditor: creditor.name, zone: debtor.zone, item: gift.name,
                }),
                [debtor.id, creditor.id],
                { important: true, category: 'alliance' }
            );
        } else {
            // Nothing to give but the watch. It still counts.
            creditor.vitals.fatigue = Math.max(0, creditor.vitals.fatigue - DEBTS.repayRestRelief);
            ctx.logEvent(
                fill(ctx.pickText(DEBT_TEXTS.repayWatch), {
                    debtor: debtor.name, creditor: creditor.name, zone: debtor.zone,
                }),
                [debtor.id, creditor.id],
                { important: true, category: 'alliance' }
            );
        }

        clearDebt(debtor, creditorId);
        adjustMutual(ctx.state, debtor, creditor, DEBTS.repayRegard);
        addExcitement(debtor, DEBTS.repayExcitement);
        clampTribute(debtor);
        clampTribute(creditor);
    });
}

/**
 * Cross-district loyalty.
 *
 * `RELATIONSHIPS.districtPartnerBase` seeded the two tributes from a district
 * as acquaintances and then nothing in the arena ever escalated it — a district
 * pair reaching the final eight together is one of the strongest stories the
 * simulation could tell and it had no machinery at all. Surviving alongside
 * your partner, cycle after cycle, is itself the bond.
 */
export function tickDistrictBonds(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    const fieldSize = alive.length;

    alive.forEach(t => {
        const partner = alive.find(o => o.id !== t.id && o.district === t.district);
        if (!partner) return;
        // The further they both get, the more the fact that they are both still
        // here means. Below the final eight it becomes the whole story.
        const weight = fieldSize <= DEBTS.districtLateFieldSize
            ? DEBTS.districtLateBond
            : DEBTS.districtBondPerCycle;
        adjustRel(t, partner.id, weight);

        if (fieldSize <= DEBTS.districtLateFieldSize
            && getRel(t, partner.id) > DEBTS.districtMilestoneRegard
            && !t.districtBondNoted) {
            t.districtBondNoted = true;
            partner.districtBondNoted = true;
            ctx.logEvent(
                `${t.name} and ${partner.name} are both still standing, and they are both from District ${t.district}. ` +
                `Nobody in the Capitol is saying out loud what that is going to mean.`,
                [t.id, partner.id],
                { important: true, category: 'alliance' }
            );
        }
    });
}
