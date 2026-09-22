import { Tribute } from '../models/types';
import { SimContext, getAlive } from './context';
import { addZoneThreat, cycleOf, ensureMemory } from './memory';
import { adjustBelief, credibilityWeight, getRel } from './relationships';
import { HAZARD_CHAIN, RELATIONSHIPS, WARNINGS } from '../data/balance';
import { canSpanTo } from './actions';

/**
 * AUDIT-10 B5-03: exchanged warnings.
 *
 * One of the twelve nonlethal events the audit names, and the one with the
 * largest hole behind it. `forecastHazard` raises the ground's threat for
 * everybody *standing in the zone* — "the warning is a belief, which is what
 * lets a tribute act on it and lets somebody who was elsewhere not know" — and
 * nothing else ever moved that belief. Nobody could tell anybody. A tribute
 * who watched the water start to rise and then walked into camp had no way to
 * say so.
 *
 * The four parts §7 asks for:
 *
 *   **Warning.** The forecast itself, which already exists and already has
 *   lead time — `check-warnings` asserts no forecast is ever due on the cycle
 *   it is announced.
 *   **Choice.** Whether to pass it on. A warning is a favour, so it goes to
 *   people the teller has some regard for, and it is worth something to the
 *   teller precisely because it need not be given.
 *   **Nonfatal result.** Somebody moves, or does not. Nobody dies of being
 *   told.
 *   **Durable record.** `warnedById` on the listener's memory of that zone,
 *   settled when the hazard lands: a warning that came true earns its teller
 *   credibility, which is the `believes` axis B5-01 added doing the job it was
 *   added for.
 *
 * Kept apart from `toldById` on purpose. That is provenance for an impression
 * of a *place* — who is there, how picked over it is — and it is settled by
 * standing in it. A warning is a claim about the future and is settled by the
 * future. Sharing one field would let a warning that came true silently vouch
 * for a sighting that was a lie.
 */
export function exchangeWarnings(ctx: SimContext) {
    const forecasts = ctx.state.forecasts ?? [];
    if (forecasts.length === 0) return;
    const alive = getAlive(ctx.state);
    const now = cycleOf(ctx.state);

    forecasts.forEach(forecast => {
        // Nothing to pass on about a hazard that has already landed.
        if (forecast.dueCycle <= now) return;

        const knows = alive.filter(t => (ensureMemory(t).zones[forecast.zone]?.threat ?? 0) >= HAZARD_CHAIN.forecastThreat);
        if (knows.length === 0) return;

        knows.forEach(teller => {
            alive.forEach(listener => {
                if (listener.id === teller.id) return;
                // The rulebook decides who can be spoken to, not this function.
                // A warning shouted up a rope is the case that rule exists for.
                if (!canSpanTo(ctx.state, teller, listener).ok) return;
                const slot = ensureMemory(listener).zones[forecast.zone];
                if ((slot?.threat ?? 0) >= HAZARD_CHAIN.forecastThreat) return;
                if (slot?.warnedById) return;
                /*
                 * A warning is a favour, and that is the whole reason it is
                 * worth anything. A tribute who warns everybody indiscriminately
                 * is not being generous, they are being a public address system,
                 * and the credibility they earn for it would be free.
                 */
                if (getRel(teller, listener.id) < WARNINGS.minRegard) return;
                if (!ctx.rng.chance(WARNINGS.chancePerPair)) return;

                // Scaled by what the listener thinks of the teller's word. This
                // is the read side of `believes`: a tribute caught lying once is
                // warned by and half-believed.
                addZoneThreat(ctx.state, listener, forecast.zone,
                    HAZARD_CHAIN.forecastThreat * credibilityWeight(listener, teller.id));
                ensureMemory(listener).zones[forecast.zone].warnedById = teller.id;

                ctx.logEvent(
                    `${teller.name} tells ${listener.name} what is coming to ${forecast.zone}. `
                    + `${listener.name} can believe it or not; there is no way to check from here.`,
                    [teller.id, listener.id],
                    { category: 'survival', zone: listener.zone },
                );
            });
        });
    });
}

/**
 * The hazard landed. Everybody who was warned about it now knows who was right.
 *
 * Called where a forecast resolves, so the account settles on the event that
 * settles it. A warning that came true is the cheapest credibility in the game
 * to earn honestly and the only kind this pays for.
 */
export function settleWarnings(ctx: SimContext, zone: string) {
    getAlive(ctx.state).forEach((t: Tribute) => {
        const slot = t.memory?.zones?.[zone];
        const tellerId = slot?.warnedById;
        if (!tellerId) return;
        delete slot.warnedById;
        adjustBelief(t, tellerId, RELATIONSHIPS.corroboratedBelief);
    });
}
