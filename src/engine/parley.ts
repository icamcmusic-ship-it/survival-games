import { Item, Tribute } from '../models/types';
import { PARLEY } from '../data/balance';
import { PARLEY_TEXTS } from '../data/flavorText';
import { SimContext } from './context';
import { assessZone } from './stance';
import { adjustMutual, getRel } from './relationships';
import { cycleOf, noteStoodBy } from './memory';
import { giveItem, itemPhrase } from './items';
import { fearOf } from './fear';
import { clampTribute } from './vitals';
import { addExcitement } from './audience';

/**
 * Talking instead of fighting.
 *
 * `resolvePairEncounter` had four outcomes: peaceful, friendly, combat and
 * desperation. Two strangers who met in a clearing either fought or exchanged
 * pleasantries — there was no way to model the far more common thing, which is
 * two frightened people negotiating their way out of a fight neither of them
 * can afford.
 *
 * Three outcomes, all of which are decisions rather than dice:
 *
 *  - **standoff** — both armed, both aware, neither with an advantage worth
 *    taking. They back out of the clearing watching each other's hands. Nobody
 *    gains anything except the knowledge of where the other one is.
 *  - **tribute** — one of them is clearly outmatched and pays to be allowed to
 *    leave. That is a real transfer of supplies, and a real humiliation.
 *  - **truce** — an explicit, expiring non-aggression pact. Neither has to like
 *    the other; they simply both prefer the odds elsewhere.
 */

export type ParleyOutcome = 'standoff' | 'tribute' | 'truce' | null;

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

/** Cycle a truce between these two runs out on, if one is standing. */
export function truceWith(t: Tribute, otherId: string): number | undefined {
    return t.truces?.[otherId];
}

export function hasTruce(state: { cycle?: number }, t: Tribute, otherId: string): boolean {
    const until = truceWith(t, otherId);
    return until !== undefined && (state.cycle ?? 0) < until;
}

function declareTruce(ctx: SimContext, a: Tribute, b: Tribute) {
    const until = cycleOf(ctx.state) + PARLEY.truceCycles;
    a.truces = { ...(a.truces ?? {}), [b.id]: until };
    b.truces = { ...(b.truces ?? {}), [a.id]: until };
}

/**
 * The most expendable thing a tribute is carrying — what they would hand over.
 * Never their only weapon: paying with that is not buying your life, it is
 * postponing the same fight under worse terms.
 */
function tributePayment(t: Tribute): Item | undefined {
    const weapons = t.inventory.filter(i => i.type === 'weapon').length;
    const spare = t.inventory.filter(i => i.type !== 'weapon' || weapons > 1);
    if (spare.length === 0) return undefined;
    return spare.reduce((worst, i) => (i.value < worst.value ? i : worst));
}

/**
 * Decides whether this meeting is a negotiation, and resolves it if so.
 * Returns the outcome, or null to let the caller fall through to its normal
 * peaceful/friendly/combat handling.
 */
export function tryParley(ctx: SimContext, t: Tribute, other: Tribute): ParleyOutcome {
    // A standing truce is itself the outcome: they have already had this
    // conversation and both are still honouring it.
    if (hasTruce(ctx.state, t, other.id)) {
        ctx.logEvent(
            fill(ctx.pickText(PARLEY_TEXTS.truceHeld), { t1: t.name, t2: other.name, zone: t.zone }),
            [t.id, other.id],
            { category: 'alliance' }
        );
        return 'truce';
    }

    const tArmed = t.inventory.some(i => i.type === 'weapon');
    const otherArmed = other.inventory.some(i => i.type === 'weapon');
    // How each of them reads the matchup, using the same estimate the stance
    // layer does — so a concealer's disguise and a Career's reputation both
    // count, and neither side is reading the other's sheet.
    const tRatio = assessZone(t, [t, other], ctx.state).ratio;
    const otherRatio = assessZone(other, [other, t], ctx.state).ratio;

    // Anyone genuinely committed to a fight is not negotiating.
    if (t.stance === 'Aggressive' && tRatio < PARLEY.confidentRatio) return null;
    if (other.stance === 'Aggressive' && otherRatio < PARLEY.confidentRatio) return null;

    const mutualRegard = Math.min(getRel(t, other.id), getRel(other, t.id));
    const mutualFear = Math.max(fearOf(t, other.id), fearOf(other, t.id));

    // TRIBUTE: one of them knows they lose. Paying is better than dying, and
    // the stronger one has to be willing to take payment rather than blood.
    const tOutmatched = tRatio > PARLEY.outmatchedRatio;
    const otherOutmatched = otherRatio > PARLEY.outmatchedRatio;
    if (tOutmatched !== otherOutmatched) {
        const weaker = tOutmatched ? t : other;
        const stronger = tOutmatched ? other : t;
        const payment = tributePayment(weaker);
        if (payment && ctx.rng.chance(PARLEY.tributeChance)) {
            weaker.inventory = weaker.inventory.filter(i => i !== payment);
            giveItem(stronger, payment);
            // Being extorted is not being befriended, and the crowd loves it.
            adjustMutual(ctx.state, weaker, stronger, -PARLEY.tributeResentment);
            addExcitement(stronger, PARLEY.tributeExcitement);
            weaker.vitals.sanity -= PARLEY.tributeSanityCost;
            clampTribute(weaker);
            clampTribute(stronger);
            ctx.logEvent(
                fill(ctx.pickText(PARLEY_TEXTS.tribute), {
                    weak: weaker.name, strong: stronger.name, zone: weaker.zone, item: itemPhrase(payment),
                }),
                [weaker.id, stronger.id],
                { important: true, category: 'loot' }
            );
            return 'tribute';
        }
    }

    // TRUCE: neither can see an advantage, and there is at least some basis for
    // taking the other at their word. This is the one that can later be broken.
    if (mutualRegard > PARLEY.truceMinRegard && ctx.rng.chance(PARLEY.truceChance)) {
        declareTruce(ctx, t, other);
        // Agreeing to something and keeping it is the seed of a real bond.
        adjustMutual(ctx.state, t, other, PARLEY.truceRegard);
        noteStoodBy(t, other.id);
        noteStoodBy(other, t.id);
        ctx.logEvent(
            fill(ctx.pickText(PARLEY_TEXTS.truce), { t1: t.name, t2: other.name, zone: t.zone }),
            [t.id, other.id],
            { important: true, category: 'alliance' }
        );
        return 'truce';
    }

    // STANDOFF: both armed, both wary, nobody moves first. The default shape of
    // two strangers meeting in an arena that has already taught them what
    // strangers cost.
    if (tArmed && otherArmed && ctx.rng.chance(PARLEY.standoffChance + mutualFear * PARLEY.standoffPerFear)) {
        // They learn nothing about each other except that it was not worth it.
        t.vitals.fatigue += PARLEY.standoffFatigue;
        other.vitals.fatigue += PARLEY.standoffFatigue;
        clampTribute(t);
        clampTribute(other);
        ctx.logEvent(
            fill(ctx.pickText(PARLEY_TEXTS.standoff), { t1: t.name, t2: other.name, zone: t.zone }),
            [t.id, other.id],
            { important: true, category: 'combat' }
        );
        return 'standoff';
    }

    return null;
}

/** Per-cycle upkeep: expired truces are simply forgotten. */
export function decayTruces(state: { cycle?: number; tributes: Tribute[] }) {
    const cycle = state.cycle ?? 0;
    state.tributes.forEach(t => {
        if (!t.truces) return;
        Object.keys(t.truces).forEach(id => {
            if (cycle >= t.truces![id]) delete t.truces![id];
        });
        if (Object.keys(t.truces).length === 0) delete t.truces;
    });
}
