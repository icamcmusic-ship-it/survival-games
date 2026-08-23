import { Alliance, CharterRule, Tribute } from '../models/types';
import { raiseSuspicion } from './memory';
import { SUSPICION, CHARTER, ENDGAME } from '../data/balance';
import { SimContext, getAlive } from './context';
import { allianceOf } from './alliance';
import { adjustRel, getRel } from './relationships';
import { RNG } from '../utils/rng';
import { isAggressiveStance } from '../data/stances';

/**
 * The alliance charter: rules a group agrees to, and what happens when somebody
 * breaks one.
 *
 * An alliance had exactly three exits — death, betrayal, and the pact running
 * out — so the entire middle of group life was missing. Nobody ever argued
 * about rations, nobody ever slipped away on their own against the group's
 * wishes, nobody ever did something small and selfish that cost them trust
 * without ending the alliance. Every disagreement had to escalate to a knife or
 * not exist.
 *
 * A charter is 1-2 clauses agreed when the group forms. Breaking one is real
 * fallout — the group's regard for the offender drops, the leader may lose the
 * room — but it is not a betrayal, and the alliance survives it. That is the
 * missing register.
 */

const RULE_TEXT: Record<CharterRule, string> = {
    'share-food': 'everything edible goes in the pile',
    'no-fighting': 'nobody raises a hand to anybody here',
    'hold-the-camp': 'somebody is always at the camp',
    'no-hunting-alone': 'nobody goes out on their own',
    // §4.5: the endgame is finally expressible as a pact.
    'split-at-eight': 'when eight are left, this ends — everyone walks away clean',
};

/** Rolls the clauses a new alliance agrees to, from its members' natures. */
export function rollCharter(rng: RNG, members: Tribute[]): CharterRule[] {
    const pool: CharterRule[] = ['share-food', 'no-fighting', 'hold-the-camp', 'no-hunting-alone'];
    const count = rng.chance(CHARTER.twoClauseChance) ? 2 : 1;
    const chosen: CharterRule[] = [];
    for (let i = 0; i < count; i++) {
        const remaining = pool.filter(r => !chosen.includes(r));
        if (remaining.length === 0) break;
        chosen.push(rng.pick(remaining));
    }
    // §4.5: a cautious group writes the ending into the terms up front —
    // "we split at the final eight" is a pact, and now it is a clause.
    if (rng.chance(CHARTER.endgameClauseChance)) chosen.push('split-at-eight');
    void members;
    return chosen;
}

/** Announces the terms, so the reader knows what can later be broken. */
export function announceCharter(ctx: SimContext, record: Alliance, members: Tribute[]) {
    if (!record.charter || record.charter.length === 0) return;
    const terms = record.charter.map(r => RULE_TEXT[r]).join(', and ');
    ctx.logEvent(
        `${members.map(m => m.name).join(', ')} set their terms: ${terms}.`,
        members.map(m => m.id),
        { category: 'alliance' }
    );
}

/**
 * Per-cycle check: did anybody break what they agreed to?
 *
 * Each clause is measured against state the simulation already tracks, so a
 * breach is a real observation rather than a roll — a tribute hoarding food
 * while the group's cache is empty genuinely is hoarding food.
 */
export function enforceCharters(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    const groups = new Map<string, Tribute[]>();
    alive.forEach(t => {
        if (!t.allianceId) return;
        if (!groups.has(t.allianceId)) groups.set(t.allianceId, []);
        groups.get(t.allianceId)!.push(t);
    });

    groups.forEach((members, id) => {
        const record = allianceOf(ctx.state, id);
        if (!record?.charter || members.length < 2) return;

        // §10.1: 'Charter Kept' — a group of three or more standing at the
        // final eight with terms agreed and never once broken.
        if (members.length >= 3 && alive.length <= ENDGAME.fieldSize && (record.breaches ?? 0) === 0) {
            ctx.state.charterKeptSeen = true;
        }

        // §4.5: the endgame clause resolves as a scene, not a breach — a
        // pact honoured in full is the rarest and most valuable thing the
        // social layer can produce.
        if (record.charter.includes('split-at-eight') && alive.length <= 8) {
            members.forEach(m => { delete m.allianceId; });
            members.forEach(m => members.forEach(o => {
                if (o.id !== m.id) adjustRel(m, o.id, CHARTER.breachRegardCost);
            }));
            ctx.logEvent(
                `${members.map(m => m.name).join(', ')} count the cannons and stop at eight. The terms were the terms: they divide what is in the cache, and walk away from each other without a word being broken.`,
                members.map(m => m.id),
                { important: true, category: 'alliance' }
            );
            return;
        }

        record.charter.forEach(rule => {
            if (rule === 'split-at-eight') return;
            const offender = findBreach(ctx, rule, record, members);
            if (!offender) return;
            if (!ctx.rng.chance(CHARTER.noticeChance)) return;
            record.breaches = (record.breaches ?? 0) + 1;

            // Everybody else thinks less of them. Nobody draws a knife over it.
            members.forEach(m => {
                if (m.id === offender.id) return;
                adjustRel(m, offender.id, -CHARTER.breachRegardCost);
                // §4.2: a breach is exactly the kind of small tell suspicion feeds on.
                raiseSuspicion(m, offender.id, SUSPICION.perCharterBreach);
            });
            ctx.logEvent(
                breachLine(rule, offender, members),
                members.map(m => m.id),
                { important: true, category: 'alliance' }
            );

            // §4.5: renegotiation — a breach can produce a new, harsher
            // clause instead of only fallout. The group closes the loophole
            // the offender just walked through.
            if (ctx.rng.chance(CHARTER.renegotiateChance)) {
                const pool: CharterRule[] = ['share-food', 'no-fighting', 'hold-the-camp', 'no-hunting-alone'];
                const missing = pool.filter(r => !record.charter!.includes(r));
                if (missing.length > 0) {
                    const added = ctx.rng.pick(missing);
                    record.charter = [...record.charter!, added];
                    ctx.logEvent(
                        `The terms get harsher around the fire that night: from now on, ${RULE_TEXT[added]}. Nobody looks at ${offender.name} while it is agreed.`,
                        members.map(m => m.id),
                        { category: 'alliance' }
                    );
                }
            }
        });
    });
}

function findBreach(ctx: SimContext, rule: CharterRule, record: Alliance, members: Tribute[]): Tribute | undefined {
    switch (rule) {
        case 'share-food': {
            // Sitting on food while the shared cache has none in it.
            if (record.sharedCache.some(i => i.type === 'food')) return undefined;
            return members.find(m => m.inventory.filter(i => i.type === 'food').length >= CHARTER.hoardingFood);
        }
        case 'no-fighting': {
            // Somebody in the group has picked up a grudge against another member.
            return members.find(m => members.some(o => o.id !== m.id && getRel(m, o.id) < CHARTER.hostileRegard));
        }
        case 'hold-the-camp': {
            if (!record.campZone) return undefined;
            const anyoneHome = members.some(m => m.zone === record.campZone);
            if (anyoneHome) return undefined;
            // The one furthest from where they said they would be.
            return members.find(m => m.zone !== record.campZone);
        }
        case 'no-hunting-alone': {
            return members.find(m =>
                isAggressiveStance(m.stance)
                && !members.some(o => o.id !== m.id && o.zone === m.zone));
        }
        default:
            return undefined;
    }
}

function breachLine(rule: CharterRule, offender: Tribute, members: Tribute[]): string {
    const others = members.filter(m => m.id !== offender.id).map(m => m.name).join(' and ');
    switch (rule) {
        case 'share-food':
            return `${others} work out that ${offender.name} has been eating out of their own pack while the pile stayed empty. Nobody draws anything over it. Nobody forgets it either.`;
        case 'no-fighting':
            return `It gets loud between ${offender.name} and the rest of them. No blood, and no apology, and the camp is a colder place afterwards.`;
        case 'hold-the-camp':
            return `${offender.name} was supposed to be at the camp. ${others} come back to an empty one and a very obvious conversation waiting to be had.`;
        case 'no-hunting-alone':
            return `${offender.name} went out hunting alone, which is the one thing this group agreed nobody would do. ${others} notice they are gone before they notice why.`;
        default:
            return `${offender.name} breaks the terms.`;
    }
}

/** Used by the UI to explain what a group has actually agreed to. */
export function charterSummary(record: Alliance | undefined): string | undefined {
    if (!record?.charter || record.charter.length === 0) return undefined;
    return record.charter.map(r => RULE_TEXT[r]).join('; ');
}
