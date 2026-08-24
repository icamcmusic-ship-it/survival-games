import { Tribute } from '../models/types';
import { SimContext } from './context';
import { EPITHETS } from '../data/flavorText';
import { EPITHET_RULES } from '../data/balance';
import { cycleOf } from './memory';

/**
 * §11.5: earned epithets — a name a tribute is given for what they did here.
 *
 * A tribute's name is fixed at the reaping and the birth-name pools in
 * `names.ts` are the only proper-noun content in the game. This is a separate
 * layer: an in-run epithet awarded off fame and notoriety, which then shows up
 * in the commentary and on the interview couch alongside the name they arrived
 * with. It is deliberately non-mechanical — nothing reads it for a decision —
 * because the whole point of a nickname is that it belongs to the audience
 * rather than to the tribute.
 *
 * One per tribute, ever. The first thing they become known for is the thing
 * they stay known for, which is both truer to how this works and stops a
 * tribute cycling through four epithets in a week.
 */

type EpithetKind = keyof typeof EPITHETS;

function award(ctx: SimContext, t: Tribute, kind: EpithetKind) {
    if (t.epithet) return;
    const template = ctx.pickText([...EPITHETS[kind]]);
    const epithet = template
        .split('{district}').join(String(t.district))
        .split('{zone}').join(t.zone);
    t.epithet = epithet;
    t.epithetCycle = cycleOf(ctx.state);
    ctx.logEvent(
        `Somewhere between the third and fourth commentary break, the country stops calling ${t.name} by their district and starts calling them ${epithet}. `
        + 'Names given in here are not given back.',
        [t.id],
        { important: true, category: 'system' }
    );
}

/**
 * Per-cycle check for anybody who has become known for something. Call once a
 * cycle after the day's or night's events have resolved, so it reads the state
 * the audience just watched rather than the state before it.
 */
export function tickEpithets(ctx: SimContext) {
    ctx.state.tributes.forEach(t => {
        if (t.status !== 'alive' || t.epithet) return;
        // Blood first: a kill streak is the loudest thing anybody does here.
        if (t.kills >= EPITHET_RULES.killsForBloody) { award(ctx, t, 'bloody'); return; }
        // Then absence, which the Ghost archetype and the stealth build both
        // spend a whole run buying and which nothing ever named.
        if ((t.unseenStreak ?? 0) >= EPITHET_RULES.unseenCyclesForGhost) { award(ctx, t, 'unseen'); return; }
        // Then survival past the point anybody expected: down once and back,
        // or a signature moment that landed.
        if (t.everDowned && t.revivedBy === undefined) { award(ctx, t, 'enduring'); return; }
        if (t.signatureFired && t.daysSurvived >= EPITHET_RULES.daysForEnduring) award(ctx, t, 'enduring');
    });
}

/** How the feed refers to somebody who has earned one. "Cato, the Butcher of X". */
export function displayName(t: Tribute): string {
    return t.epithet ? `${t.name}, ${t.epithet},` : t.name;
}
