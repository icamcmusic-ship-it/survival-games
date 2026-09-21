import { SimContext } from '../context';
import { processSpoilage, processVitals } from '../survival';
import { tickDowned } from '../downed';
import { tickRescueAftermath, tickRescueLines } from '../rescueLine';
import { decayMemories, decayRelationships, decaySuspicion } from '../memory';
import { decayFear } from '../fear';
import { decayAllianceRegard, decayTrust } from '../relationships';
import { tickForecasts } from '../hazardChain';
import { tickExposure } from '../survival';
import { tickZoneEffects } from '../zoneEffects';

/**
 * AUDIT-9 B01: the upkeep every elapsed phase owes, in one place.
 *
 * A feast *replaces* that day's day-phase, and its implementation advanced the
 * cycle without running any of the work a day costs. Reproduced: an isolated
 * non-attendee came out of a feast day at exactly the same health, hunger and
 * thirst it went in with, bleeding included, while the clock moved; a downed
 * tribute at zero health travelled from the Jungle to the Cornucopia and was
 * still downed at the end of it. Scheduling a feast changed physiology for the
 * whole arena.
 *
 * The rule this module encodes is that *time is not optional*. A phase may
 * replace the encounter/action portion of a day — that is what a feast is —
 * but it may not replace the part where people get hungry, wounds go on
 * bleeding and whoever is on the ground either gets up or does not.
 *
 * Three stages, in the order the day phase has always run them, so a phase
 * that adopts them is running the same lifecycle rather than an approximation
 * of it:
 *
 *   1. `preActionUpkeep`  — spoilage and vitals, before anybody decides
 *                           anything, so the body they decide with is the one
 *                           the elapsed time left them.
 *   2. `postActionUpkeep` — the downed tick, after movement and violence have
 *                           settled, because the whole question it asks is who
 *                           is standing in the zone at the end of the cycle.
 *   3. `worldClockUpkeep` — the arena's own clock: forecasts coming due, slow
 *                           poisoning arriving, and active zone effects taking
 *                           their per-cycle turn.
 *   4. `decayUpkeep`      — memory, regard, trust, dread and suspicion fade on
 *                           the cycle clock whatever the cycle contained.
 *
 * The day phase calls these in place of the inline calls it used to make, so
 * there is exactly one definition of what a cycle costs and a new phase cannot
 * quietly acquire immunity to time by forgetting a line.
 */

/** Stage 1: spoilage and vitals, before anybody acts. */
export function preActionUpkeep(ctx: SimContext, time: 'day' | 'night') {
    processSpoilage(ctx);
    processVitals(ctx, time);
}

/** Stage 2: the rescue window, after movement and violence have settled. */
export function postActionUpkeep(ctx: SimContext) {
    /*
     * AUDIT-9 batch 4, pilot 1: somebody puts a line down, before the clock
     * on the person at the bottom of it runs out.
     *
     * Ordered ahead of `tickDowned` deliberately. That function owns how a
     * downed tribute's window ends — rescued, executed, or expired — so a
     * rescue attempt has to happen while the window is still open, in the same
     * cycle, or the chain can only ever fire on people who were going to be
     * saved anyway.
     */
    tickRescueLines(ctx);
    tickDowned(ctx);
    // ...and the beat a cycle or two later that reads what actually happened.
    tickRescueAftermath(ctx);
}

/**
 * Stage 3: the arena's clock.
 *
 * AUDIT-10 F14: `processFeast` adopted the physiological stages and not these,
 * so a flood forecast due at cycle 6 was still pending, with no effect, after a
 * feast advanced cycle 5 to 6 — and every active zone effect skipped its
 * per-cycle tick on that route too. The meaning of a deadline therefore
 * depended on which kind of phase happened to occupy the cycle it fell in,
 * which makes "due at cycle 6" unusable as a promise to the player.
 *
 * One definition, called by every phase that advances the cycle. The internal
 * order is the day phase's own and is the rule everywhere: a forecast comes due
 * *before* the effects tick, so a hazard that lands this cycle is a hazard this
 * cycle rather than next one; and it lands before travel is resolved in the
 * day phase and at the close of a feast, which is the same relationship — the
 * forecast resolves against where people actually were for the cycle.
 */
export function worldClockUpkeep(ctx: SimContext) {
    tickForecasts(ctx);
    tickExposure(ctx);
    tickZoneEffects(ctx);
}

/** Stage 4: everything that fades on the cycle clock. */
export function decayUpkeep(ctx: SimContext) {
    decayMemories(ctx.state);
    decayRelationships(ctx.state);
    decayTrust(ctx.state);
    decayAllianceRegard(ctx.state);
    decayFear(ctx.state);
    decaySuspicion(ctx.state);
}
