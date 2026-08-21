import { Tribute } from '../models/types';
import { BROADCAST } from '../data/balance';
import { CAESAR_COMMENTARY, CROWD_REACTIONS } from '../data/flavorText';
import { SimContext, getAlive } from './context';

/**
 * §8.3: the Capitol as a recurring voice.
 *
 * Caesar Flickerman existed in exactly two places — the interview couch and
 * the victor's debrief — so the Games themselves were narrated by nobody. In
 * the source material the broadcast *is* the frame: there is always a desk,
 * always a commentator filling the silence, always a crowd in a Capitol bar
 * reacting to something a tribute cannot hear them reacting to. That framing
 * is most of what makes the arena feel watched rather than merely simulated.
 *
 * Deliberately sparse. A line every cycle would drown the chronicle; these
 * fire on the beats a real broadcast would actually cut to the desk for — the
 * opening days, a quiet stretch the desk has to fill, a death, the field
 * narrowing to a countable number, the feast, and nightfall.
 */

/** Guards the once-per-run threshold beats so they cannot repeat. */
const FIRED = new WeakMap<object, Set<string>>();

function once(ctx: SimContext, key: string): boolean {
    const seen = FIRED.get(ctx.state) ?? new Set<string>();
    if (seen.has(key)) return false;
    seen.add(key);
    FIRED.set(ctx.state, seen);
    return true;
}

function say(ctx: SimContext, pool: string[], vars: Record<string, string> = {}) {
    const line = Object.entries(vars).reduce(
        (text, [k, v]) => text.split(`{${k}}`).join(v),
        ctx.pickText(pool),
    );
    ctx.logEvent(line, [], { category: 'system' });
}

/**
 * The desk, once per cycle at most. Called from the day/night orchestrator
 * after the phase's events have resolved, so "a quiet day" means the day was
 * actually quiet rather than merely early.
 */
export function commentate(ctx: SimContext, time: 'day' | 'night', deathsThisCycle: number) {
    const alive = getAlive(ctx.state).length;
    const day = ctx.state.day;
    const vars = { alive: String(alive), day: String(day) };

    // The field narrowing is the one thing a broadcast never fails to mention,
    // and it only happens once per run per threshold.
    if (alive <= BROADCAST.finalThreeAt && once(ctx, 'final-three')) {
        say(ctx, CAESAR_COMMENTARY.finalThree, vars);
        return;
    }
    if (alive <= BROADCAST.finalEightAt && once(ctx, 'final-eight')) {
        say(ctx, CAESAR_COMMENTARY.finalEight, vars);
        return;
    }

    if (day <= BROADCAST.openingDays && time === 'day' && once(ctx, `opening-${day}`)) {
        say(ctx, CAESAR_COMMENTARY.openingDay, vars);
        return;
    }

    if (time === 'night' && ctx.rng.chance(BROADCAST.nightfallChance)) {
        say(ctx, CAESAR_COMMENTARY.nightfall, vars);
        return;
    }

    // Filling the silence: only when the silence is real.
    if (deathsThisCycle === 0 && ctx.rng.chance(BROADCAST.quietDayChance)) {
        say(ctx, CAESAR_COMMENTARY.quietDay, vars);
    }
}

/** The desk's reaction to a death, and the country's. */
export function commentateDeath(ctx: SimContext, victim: Tribute, wasChild: boolean) {
    if (ctx.rng.chance(BROADCAST.afterDeathChance)) {
        say(ctx, CAESAR_COMMENTARY.afterDeath, { victim: victim.name });
    }
    if (!ctx.rng.chance(BROADCAST.crowdChance)) return;
    // What the Capitol does with it depends on who it was: a child or a
    // favourite lands as grief, a kill as spectacle.
    // balance-exempt: an even split between two equally-apt reaction pools, not a dial
    const evenSplit = () => ctx.rng.chance(0.5);
    const pool = wasChild || victim.fanFavourite
        ? (evenSplit() ? CROWD_REACTIONS.heartbreak : CROWD_REACTIONS.hush)
        : (evenSplit() ? CROWD_REACTIONS.cheer : CROWD_REACTIONS.outrage);
    say(ctx, pool, { tribute: victim.name });
}

/** The desk, when the horn goes. */
export function commentateFeast(ctx: SimContext) {
    say(ctx, CAESAR_COMMENTARY.feastCalled);
}
