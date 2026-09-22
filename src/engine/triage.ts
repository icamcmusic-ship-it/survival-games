import { Item, Tribute } from '../models/types';
import { SimContext, getAlive } from './context';
import { samePlace } from './verticality';
import { giveItem, consumeOne } from './items';
import { getRel, adjustRel, adjustTrust, adjustBelief } from './relationships';
import { TRIAGE } from '../data/balance';
import { noteMilestone } from './milestones';

/**
 * AUDIT-10 B5-03: treatment scarcity.
 *
 * The audit's row: *"Two injured people and one treatment; choose, split only
 * if physically valid, or seek alternatives. ... Triage affects trust
 * differently from deliberate refusal."*
 *
 * Verified absent before being written, and verified *possible* before being
 * written: across 60 runs there are 4,625 observations of two or more wounded
 * tributes in one place, and 1,146 of those have exactly one medical item
 * between them. The Medic's signature treats somebody; nothing in the engine
 * ever posed the choice.
 *
 * The four parts §7 asks for.
 *
 *   **Warning.** You are standing next to somebody visibly worse off than you,
 *   holding the only thing that would help either of you. Nothing is hidden.
 *   **Choice.** Treat yourself or hand it over. Both are defensible; that is
 *   what makes it a choice rather than a morality test.
 *   **Nonfatal result.** The untreated condition simply continues — it worsens
 *   on the paths that already exist. Nothing new kills anybody here, which is
 *   the audit's standing instruction for this whole section.
 *   **Durable record.** Who gave and who kept, on both ledgers.
 *
 * The distinction the audit asks for, made explicit: **keeping the kit is not
 * a betrayal.** A tribute who treats their own open wound has done the ordinary
 * thing, and the engine says nothing about it. It costs standing only when the
 * other person was *much* worse — `refusalGap` — because that is the case
 * where "I needed it too" stops being the whole story. Triage the other way
 * earns gratitude and, separately, credibility: somebody who hands over the
 * last bandage has told you something true about themselves.
 */

/** How badly this tribute needs the one kit, on a single scale. */
function need(t: Tribute): number {
    let score = 0;
    if (t.injuries.bleeding) score += TRIAGE.bleedingNeed * (t.bleedSeverity ?? 1);
    if (t.injuries.infected) score += TRIAGE.infectedNeed;
    if (t.injuries.poisoned) score += TRIAGE.poisonedNeed;
    // Health is the tiebreak rather than the driver: a scratch on somebody at
    // twelve health is more urgent than the same scratch at ninety.
    score += (100 - t.health) * TRIAGE.healthWeight;
    return score;
}

const MEDICAL_IDS = new Set(['bandages', 'sutures', 'tourniquet', 'cautery-kit', 'antidote', 'antivenom']);
const isTreatment = (i: Item) => MEDICAL_IDS.has(i.id) || i.type === 'medical';

/**
 * Called immediately before a tribute treats themselves.
 *
 * Returns true when the kit was given away, so the caller knows not to spend it
 * on the holder — the decision has to happen before the self-treatment branch
 * or it is not a decision, it is a refund.
 */
export function resolveTreatmentScarcity(ctx: SimContext, t: Tribute): boolean {
    const mine = t.inventory.filter(isTreatment);
    /*
     * Scarcity means *one*, and one means one unit rather than one slot.
     *
     * Somebody holding two is not choosing between two patients, they are
     * treating both, and the beat has nothing to say. The stack check is the
     * same statement — three bandages in a slot is not the last bandage — and
     * it is also what keeps the transfer honest: `consumeOne` decrements a
     * stack of more than one and returns *the object that is still in the
     * giver's inventory*, which is correct for eating a ration and catastrophic
     * for handing something over. `check-triage` caught exactly that, by
     * comparing object references across inventories.
     */
    if (mine.length !== 1 || (mine[0].stack ?? 1) !== 1) return false;
    const myNeed = need(t);
    if (myNeed <= 0) return false;

    const patient = getAlive(ctx.state)
        .filter(o => o.id !== t.id
            && samePlace(ctx.state.arena, t, o)
            && !o.inventory.some(isTreatment)
            && need(o) > myNeed)
        .sort((a, b) => need(b) - need(a))[0];
    if (!patient) return false;

    const gap = need(patient) - myNeed;
    noteMilestone(ctx, 'treatment-scarcity', [t.id, patient.id]);

    /*
     * Who gives. Regard is most of it, a standing debt is the rest — somebody
     * who has already taken a risk for you has a claim that is not affection —
     * and the size of the gap matters, because it is easier to hand over the
     * last bandage to somebody who is obviously dying than to somebody who is
     * merely worse off than you.
     */
    const generosity = getRel(t, patient.id)
        + ((patient.debts?.[t.id] ?? 0) > 0 ? TRIAGE.creditorPull : 0)
        + gap * TRIAGE.gapPull;

    if (generosity >= TRIAGE.giveThreshold) {
        const item = consumeOne(t, isTreatment);
        if (!item) return false;
        // Capacity is the rulebook's, not this beat's: a patient who cannot
        // carry it does not get it, and the giver keeps it rather than it
        // evaporating.
        const dropped = giveItem(patient, item);
        /*
         * By reference, not by id. `Item` has no per-instance identity, so
         * `dropped.some(d => d.id === item.id)` would match the *patient's own*
         * bandages being pushed out to make room, and hand the giver's bandages
         * back while the patient is still holding them.
         *
         * Counting ids proves nothing when two tributes holding `bandages` is
         * ordinary — the same mistake as matching a chronicle line by
         * substring, which this session made twice before this one. A
         * non-unique key used where identity was meant.
         */
        if (dropped.includes(item)) {
            giveItem(t, item);
            return false;
        }
        adjustRel(patient, t.id, TRIAGE.gratitudeRegard);
        adjustTrust(patient, t.id, TRIAGE.gratitudeTrust);
        // Handing over the last bandage tells somebody something true about
        // you, which is credibility rather than affection.
        adjustBelief(patient, t.id, TRIAGE.gratitudeBelief);
        noteMilestone(ctx, 'treatment-given', [t.id, patient.id]);
        ctx.logEvent(
            `${t.name} looks at the ${item.name} in their hand, looks at ${patient.name}, and gives it to them. `
            + `${t.name} is still bleeding when they walk away.`,
            [t.id, patient.id],
            { important: true, category: 'alliance', zone: t.zone },
        );
        return true;
    }

    /*
     * Keeping it is the ordinary thing and mostly passes without comment. It
     * costs standing only when the other person was much worse off, which is
     * the line between triage and refusal the audit asks to be drawn.
     */
    if (gap >= TRIAGE.refusalGap) {
        adjustRel(patient, t.id, -TRIAGE.refusedRegard);
        adjustTrust(patient, t.id, -TRIAGE.refusedTrust);
        noteMilestone(ctx, 'treatment-refused', [t.id, patient.id]);
        ctx.logEvent(
            `${patient.name} watches ${t.name} use the last of the dressings on themselves. Nothing is said about it. `
            + `${patient.name} will not forget which way that went.`,
            [t.id, patient.id],
            { category: 'alliance', zone: t.zone },
        );
    }
    return false;
}
