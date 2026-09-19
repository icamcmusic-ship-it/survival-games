import { samePlace } from './verticality';
import { Tribute } from '../models/types';
import { DEBTS, RELATIONSHIPS, SUSPICION } from '../data/balance';
import { DEBT_TEXTS } from '../data/flavorText';
import { SimContext, getAlive } from './context';
import { traitMod } from '../data/traits';
import { adjustMutual, adjustRel, getRel, trustOf, adjustTrust } from './relationships';
import { cycleOf, cyclesSinceContact, easeSuspicion, ensureMemory, noteStoodBy, raiseSuspicion } from './memory';
import { witnessKindness } from './rapport';
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
export function incurDebt(debtor: Tribute, creditor: Tribute, amount: number, ctx?: SimContext) {
    if (debtor.id === creditor.id) return;
    // §4.3: the people standing there learn something too — who would come for
    // whom, which is the most dangerous piece of information in an arena.
    if (ctx) witnessKindness(ctx, creditor, debtor);
    debtor.debts = debtor.debts ?? {};
    debtor.debts[creditor.id] = Math.min(DEBTS.max, debtTo(debtor, creditor.id) + amount);
    // The creditor knows what they did, even if nobody says so.
    noteStoodBy(creditor, debtor.id);
    // AUDIT-7 §4.1: helping somebody at a cost is the clearest trust signal the
    // engine has, and it moved only the derived half.
    adjustTrust(debtor, creditor.id, RELATIONSHIPS.trustStoodBy);
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
    // §1.2: a retainer is a debt with a receipt.
    //
    // `retainerPaidBy` was written by the Mercenary's signature and then read
    // by nothing at all — the archetype's entire identity ("the price of their
    // company, and who has paid it") was recorded and never charged, so paying
    // a mercenary bought you precisely nothing enforceable. It buys this: a
    // contract holds harder than a favour, because a mercenary who turns on a
    // paying client is a mercenary nobody else will ever hire.
    const paid = betrayer.retainerPaidBy?.filter(id => id === victimId).length ?? 0;
    if (owed <= 0 && paid <= 0) return 1;
    return Math.max(
        DEBTS.minBetrayalMultiplier,
        1 - owed * DEBTS.betrayalResistPerPoint - paid * DEBTS.retainerBetrayalResist
    );
}

/** §1.2: everyone who has ever paid for this tribute's company. */
export function clientsOf(t: Tribute): string[] {
    return [...new Set(t.retainerPaidBy ?? [])];
}

/**
 * §1.2: a contract has an upkeep, and honouring it pays.
 *
 * A mercenary standing between a paying client and the arena is the archetype
 * working; the Capitol loves a professional, and the client's regard is bought
 * rather than felt. Run once a cycle from the alliance phase.
 */
export function tickRetainers(ctx: SimContext) {
    getAlive(ctx.state).forEach(t => {
        const clients = clientsOf(t);
        if (clients.length === 0) return;
        let honoured = 0;
        clients.forEach(id => {
            const client = getAlive(ctx.state).find(o => o.id === id);
            if (!client) return;
            honoured += 1;
            // The regard is contractual, not warm — it is the client's, and it
            // stops the moment the fee stops.
            adjustRel(client, t.id, DEBTS.retainerRegardPerCycle);
            // AUDIT-9 B10: visibly on the job means visibly — two people on
            // opposite levels of a shaft are not attending each other.
            if (samePlace(ctx.state.arena, client, t)) {
                t.sponsorTrust = Math.min(100, t.sponsorTrust + DEBTS.retainerTrustPerCycle);
            }
        });
        // §10.1/§1.7: the high-water mark of clients on the books at once —
        // the Mercenary's version of a charter kept. Read by the 'On Retainer'
        // achievement; for four releases it was written here and read nowhere,
        // which is exactly the write-once-read-never shape the lifetime-ledger
        // audit was looking for.
        t.retainersHonoured = Math.max(t.retainersHonoured ?? 0, honoured);
    });
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
        /*
         * A debt to the dead cannot be paid, only carried.
         *
         * AUDIT-9 B10: and a debt cannot be paid across a two-hundred-metre
         * shaft either. `zone === zone` ignores vertical level, so repayment
         * transferred bread and cleared the debt between a tribute on the rim
         * and a tribute at the bottom of it — `samePlace` returned false for
         * the pair at the same moment the handover happened. `samePlace` is
         * the engine's existing answer to "are these two in the same place",
         * and physically handing somebody a loaf is exactly the kind of act it
         * governs.
         */
        if (!creditor || !samePlace(ctx.state.arena, debtor, creditor)) return;
        if (debtTo(debtor, creditorId) < DEBTS.repayThreshold) return;
        // AUDIT-6 §12.2 `debtHonour`: a Bookkeeper pays what they owe.
        /*
         * AUDIT-7 §4.2: ...and a group with a `keeper` remembers who owes what.
         *
         * `types.ts` says the keeper "holds the group's debts, which `debts.ts`
         * tracked per-person with nobody responsible for them" — a sentence
         * with no implementation, on a role that `assignRoles` could not reach
         * in the first place. This is it: an alliance that has named somebody
         * to keep the books settles up more often, because somebody is asking.
         * It reads the *debtor's* group, since that is whose books the debt is
         * on, and the keeper asking themselves is still somebody asking.
         */
        const keeperId = debtor.allianceId
            ? ctx.state.alliances?.[debtor.allianceId]?.roles?.keeper
            : undefined;
        const keeperPush = keeperId ? DEBTS.repayKeeperBonus : 0;
        if (!ctx.rng.chance(DEBTS.repayChance + traitMod(debtor, 'debtHonour') + keeperPush)) return;

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
        easeSuspicion(creditor, debtor.id, SUSPICION.easedByRepaidDebt);
        // §4.2 (audit): a debt honoured is trust earned, on its own axis.
        adjustTrust(creditor, debtor.id, RELATIONSHIPS.trustRepaidDebt);
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
        // §4.5 (audit): a bond grows between people who are in each other's
        // lives. Partners who have not laid eyes on each other in days, who
        // have fought, or where one sold the other out, do not drift warmer
        // by arithmetic — this used to tick every cycle for everybody.
        const inContact = t.allianceId !== undefined && t.allianceId === partner.allianceId
            || cyclesSinceContact(ctx.state, t, partner.id) <= DEBTS.districtBondContactWindow;
        if (!inContact) return;
        const fought = (t.memory?.rivals?.[partner.id]?.fights ?? 0) > 0;
        const betrayed = ensureMemory(t).betrayedBy.includes(partner.id);
        if (fought || betrayed) return;
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

/**
 * §4.4: the ledger below the life-debt.
 *
 * `incurDebt` above prices somebody taking a real risk for you. Nothing priced
 * the far commoner, far smaller thing: an ally handing over their spare knife
 * because you have nothing, and then the days going by. That is not a debt in
 * the `stoodBy` sense — nobody is bound by it, it will not stop a betrayal —
 * but it is a specific grievance with a name and an object attached, which is
 * exactly the texture alliance economics was missing underneath the weight of
 * a life owed.
 *
 * Three beats: it is lent, it is given back, or it quietly becomes theft.
 */
export function offerLoans(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    alive.forEach(lender => {
        if (!lender.allianceId) return;
        /*
         * Audit 3 §4.6: a loan required the lender to be carrying a *second
         * weapon*, and carrying two weapons at once is rare under the carry
         * cap — so the whole primitive was live on 2.2% of tribute-cycles, far
         * below `debts`, the heavy version it was written to sit underneath.
         *
         * The rule the comment states is "only a genuine spare", and that is
         * kept. What widens is what counts as one: a second weapon, or any
         * kind of kit the lender is carrying two of. A lent waterskin that has
         * not come back is exactly the small, specific grievance this field
         * exists for — arguably more so than a blade, which gets handed back
         * the moment there is a fight.
         */
        const LENDABLE = new Set(['weapon', 'utility', 'tool', 'medical']);
        const counts = new Map<string, number>();
        lender.inventory.forEach(i => counts.set(i.type, (counts.get(i.type) ?? 0) + 1));
        const spares = lender.inventory.filter(i => LENDABLE.has(i.type) && (counts.get(i.type) ?? 0) >= 2);
        if (spares.length === 0) return;
        const borrower = alive.find(o =>
            o.id !== lender.id
            && o.allianceId === lender.allianceId
            // AUDIT-9 B10: lending is a physical handover, so it needs the
            // locality test rather than the zone name.
            && samePlace(ctx.state.arena, lender, o)
            // Short of something the lender has two of. A weapon still counts
            // for the reason it always did; so now does everything else.
            && spares.some(sp => !o.inventory.some(i => i.type === sp.type))
            // §4.5: on the trust axis, not the affection one. You can be very
            // fond of the person you are not handing a blade to.
            && trustOf(lender, o) >= DEBTS.loanMinTrust
            && !(o.loans ?? {})[lender.id]);
        if (!borrower || !ctx.rng.chance(DEBTS.loanChance)) return;

        // The worse of the spares the borrower actually lacks. Lending is not
        // the same as giving.
        const useful = spares.filter(sp => !borrower.inventory.some(i => i.type === sp.type));
        const spare = useful.reduce((worst, w) => (w.value < worst.value ? w : worst));
        lender.inventory = lender.inventory.filter(i => i !== spare);
        giveItem(borrower, spare);
        borrower.loans = borrower.loans ?? {};
        borrower.loans[lender.id] = { itemId: spare.id, itemName: spare.name, sinceCycle: cycleOf(ctx.state) };
        ctx.logEvent(
            `${lender.name} hands ${borrower.name} the spare ${spare.name}. "Until you find your own," they say, `
            + 'and both of them hear the word "until".',
            [lender.id, borrower.id],
            { category: 'alliance' }
        );
    });
}

/**
 * One cycle of loans being settled, resented, or written off.
 *
 * Returning is voluntary and mostly happens once the borrower has armed
 * themselves properly — which is the honest model: nobody gives back the only
 * weapon they have, and everybody means to give it back eventually.
 */
export function settleLoans(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    const byId = new Map(ctx.state.tributes.map(t => [t.id, t] as const));
    const cycle = cycleOf(ctx.state);

    alive.forEach(borrower => {
        if (!borrower.loans) return;
        Object.entries(borrower.loans).forEach(([lenderId, loan]) => {
            const lender = byId.get(lenderId);
            const held = borrower.inventory.find(i => i.id === loan.itemId);

            // A dead lender is not owed anything. The loan becomes an
            // inheritance — and the borrower knows whose it was. Roughly 140
            // of 200 loans a soak used to end here or in the branch below
            // with no line at all, which read as the ledger simply losing them.
            if (!lender || lender.status !== 'alive') {
                // §4.2: this is now a safety net rather than the usual path —
                // `resolveLoansOnDeath` closes the entry on the cannon — and,
                // like every other ending, it writes a line. A deletion with
                // no line is exactly how 175 of 244 loans went missing.
                writeOffToDeadLender(ctx, borrower, lenderId, loan.itemName, lender);
                return;
            }
            // They no longer have it — lost, traded, taken off them. Nothing
            // to give back, and the lender is owed an explanation they will
            // not entirely believe.
            if (!held) {
                delete borrower.loans![lenderId];
                adjustRel(lender, borrower.id, -DEBTS.loanLostRegard);
                ctx.logEvent(
                    `${borrower.name} has to tell ${lender.name} that the ${loan.itemName} is gone. ${lender.name} nods, and files it.`,
                    [borrower.id, lender.id],
                    { category: 'alliance' }
                );
                return;
            }

            const age = cycle - loan.sinceCycle;

            // Giving it back: they have found something better, and they are
            // standing in front of the person who lent it to them.
            const armedElsewhere = borrower.inventory.some(i => i.type === 'weapon' && i.id !== loan.itemId);
            // AUDIT-9 B10: "standing in front of the person who lent it to
            // them" is what the comment above already says. Now it is what the
            // code tests.
            if (armedElsewhere && samePlace(ctx.state.arena, borrower, lender)) {
                borrower.inventory = borrower.inventory.filter(i => i !== held);
                giveItem(lender, held);
                delete borrower.loans![lenderId];
                adjustMutual(ctx.state, borrower, lender, DEBTS.loanReturnedRegard);
                ctx.logEvent(
                    `${borrower.name} gives ${lender.name} their ${loan.itemName} back without being asked for it. `
                    + 'It is a small thing and neither of them treats it as one.',
                    [borrower.id, lender.id],
                    { category: 'alliance' }
                );
                return;
            }

            // It has been long enough that it is not a loan any more.
            if (age >= DEBTS.loanDefaultCycles) {
                delete borrower.loans![lenderId];
                adjustRel(lender, borrower.id, -DEBTS.loanDefaultRegard);
                raiseSuspicion(lender, borrower.id, DEBTS.loanDefaultSuspicion);
                ctx.logEvent(
                    `${lender.name} has stopped thinking of the ${loan.itemName} as lent. `
                    + `${borrower.name} has not mentioned it in days, and that is its own kind of answer.`,
                    [lender.id, borrower.id],
                    { category: 'alliance' }
                );
                return;
            }

            // The slow sour in between.
            if (age >= DEBTS.loanPatience) {
                adjustRel(lender, borrower.id, -DEBTS.loanResentmentPerCycle);
            }
        });
        if (borrower.loans && Object.keys(borrower.loans).length === 0) delete borrower.loans;
    });
}

/**
 * §4.2: the ending the loan ledger did not have.
 *
 * `loans: made=244 returned=46 defaulted=23` — 175 of 244 loans reached the
 * end of a run in neither state, and the reason is that both of the states a
 * loan can *also* end in involve somebody dying, which `settleLoans` only ever
 * walked the living for. A borrower who is killed takes the entry to the grave
 * with them; a lender who is killed leaves an entry nobody is ever coming to
 * collect. Both are real endings and both were silent.
 *
 * Called from `propagateDeathFallout`, so every cannon closes every loan the
 * dead tribute was on either side of. No items move: whatever the borrower was
 * carrying is on the body or in their hands, and the looting layer already has
 * opinions about that. What moves is the ledger, and the record of it.
 */
export function resolveLoansOnDeath(ctx: SimContext, victim: Tribute) {
    // Loans the dead tribute had taken out. The lender, if they are still
    // alive, has just watched their spare weapon leave the ledger.
    Object.entries(victim.loans ?? {}).forEach(([lenderId, loan]) => {
        const lender = ctx.state.tributes.find(t => t.id === lenderId);
        delete victim.loans![lenderId];
        if (!lender || lender.status !== 'alive') return;
        // No regard written toward a corpse; the line is the whole of it.
        ctx.logEvent(
            `${lender.name} lent ${victim.name} that ${loan.itemName}. It is out there somewhere in ${victim.zone} now, `
            + 'and so is everything else they were going to say to them.',
            [lender.id, victim.id],
            { category: 'alliance' }
        );
    });
    delete victim.loans;

    // ...and loans they had made, which have just stopped being loans.
    ctx.state.tributes.forEach(borrower => {
        if (borrower.status !== 'alive' || !borrower.loans?.[victim.id]) return;
        const loan = borrower.loans[victim.id];
        writeOffToDeadLender(ctx, borrower, victim.id, loan.itemName, victim);
    });
}

/** One loan closing because the person who made it is dead. */
function writeOffToDeadLender(ctx: SimContext, borrower: Tribute, lenderId: string, itemName: string, lender?: Tribute) {
    delete borrower.loans![lenderId];
    if (borrower.loans && Object.keys(borrower.loans).length === 0) delete borrower.loans;
    if (!lender) return;
    ctx.logEvent(
        `${borrower.name} is still carrying ${lender.name}'s ${itemName}. There is nobody left to give it back to, `
        + 'and they stop thinking of it as borrowed the same day they stop saying the name.',
        [borrower.id, lender.id],
        { category: 'alliance' }
    );
}
