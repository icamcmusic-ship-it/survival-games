import { Tribute } from '../models/types';
import { SimContext, getAlive } from './context';
import { EPITHETS } from '../data/flavorText';
import { EPITHET_RULES } from '../data/balance';
import { cycleOf } from './memory';
import { addNotoriety } from './notoriety';

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
    /*
     * AUDIT-6 §10.1: epithets were documented as deliberately non-mechanical,
     * on the grounds that a nickname belongs to the audience. That holds for
     * the *choice* of name and not for its effect: being given one is the
     * moment the field decides about somebody, and `notoriety` is the model of
     * exactly that. So the name stays the audience's and the consequence is
     * the arena's — everybody alive now knows this tribute by reputation.
     */
    getAlive(ctx.state)
        .filter(o => o.id !== t.id)
        .forEach(o => addNotoriety(o, t.id, EPITHET_RULES.notorietyOnAward));
}

/**
 * AUDIT-6 §10.1: score every kind, award the best one.
 *
 * This used to be a fixed priority ladder with blood at the top and one
 * epithet per tribute ever, which produced exactly the distribution you would
 * predict: across 300 runs, `bloody` took **68.7%** of all 504 awards and
 * `builder` took **none**. Any tribute with three kills took `bloody` and
 * could never earn any of the other six, so six kinds were competing for the
 * 31% of awards that went to tributes who had not killed much.
 *
 * Each kind now reports how far past its own bar the tribute is, on a shared
 * scale where 1.0 is "exactly at the threshold". The loudest thing they did
 * wins, rather than the thing that happened to be checked first.
 */
function scoreEpithets(t: Tribute): Array<[EpithetKind, number]> {
    const ratio = (value: number, bar: number) => (bar <= 0 ? 0 : value / bar);
    const scores: Array<[EpithetKind, number]> = [
        ['bloody', ratio(t.kills, EPITHET_RULES.killsForBloody)],
        ['unseen', ratio(t.unseenStreak ?? 0, EPITHET_RULES.unseenCyclesForGhost)],
        // Endurance is still narrow on purpose: it has to be somebody who went
        // down, got up unaided, and then kept going for days.
        ['enduring', t.everDowned && t.revivedBy === undefined
            ? ratio(t.daysSurvived, EPITHET_RULES.daysForEnduring)
            : 0],
        ['merciful', ratio(t.sparedDowned?.length ?? 0, EPITHET_RULES.sparesForMerciful)],
        ['turncoat', ratio((t.betrayalsCommitted ?? 0) + (t.faithBroken ?? 0), EPITHET_RULES.breaksForTurncoat)],
        ['builder', ratio(t.trapKills ?? 0, EPITHET_RULES.trapKillsForBuilder)],
        ['warden', ratio(t.fortifiedCycles ?? 0, EPITHET_RULES.cyclesForWarden)],
    ];
    return scores.filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]);
}

/**
 * Per-cycle check for anybody who has become known for something. Call once a
 * cycle after the day's or night's events have resolved, so it reads the state
 * the audience just watched rather than the state before it.
 */
export function tickEpithets(ctx: SimContext) {
    ctx.state.tributes.forEach(t => {
        if (t.status !== 'alive' || t.epithet) return;
        const best = scoreEpithets(t)[0];
        if (best) award(ctx, t, best[0]);
    });
}

/** How the feed refers to somebody who has earned one. "Cato, the Butcher of X". */
export function displayName(t: Tribute): string {
    return t.epithet ? `${t.name}, ${t.epithet},` : t.name;
}
