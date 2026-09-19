import { SimContext } from '../context';
import { processSpoilage, processVitals } from '../survival';
import { tickDowned } from '../downed';
import { decayMemories, decayRelationships, decaySuspicion } from '../memory';
import { decayFear } from '../fear';
import { decayAllianceRegard, decayTrust } from '../relationships';

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
 *   3. `decayUpkeep`      — memory, regard, trust, dread and suspicion fade on
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
    tickDowned(ctx);
}

/** Stage 3: everything that fades on the cycle clock. */
export function decayUpkeep(ctx: SimContext) {
    decayMemories(ctx.state);
    decayRelationships(ctx.state);
    decayTrust(ctx.state);
    decayAllianceRegard(ctx.state);
    decayFear(ctx.state);
    decaySuspicion(ctx.state);
}
