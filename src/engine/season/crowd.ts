import { GameState, Tribute } from '../../models/types';
import { AUDIT12_WAVE3, GAMEMAKER_AGENCY, QUALITY_BIAS } from '../../data/balance';
import { ITEMS } from '../../data/constants';
import { AUDIENCE_SEGMENT_LIST, AudienceSegment, audienceOf } from '../audienceSegments';
import { SimContext, getAlive } from '../context';
import { NEUTRAL_TASTE, directorTaste } from '../../data/directors';
import { triggerGamemakerEvent } from '../gamemaker';
import { announceFeastTheme } from '../phases/feast';
import { dropParachute } from '../parachutes';
import { mintItem } from '../items';
import { pickNeededGift } from '../sponsors';
import { itemPoolFor } from '../items';

/**
 * AUDIT-12 wave 3 §11/§13: the audience segments, finally steering the booth.
 *
 * The three segments used to price the player's sponsor quote and nothing
 * else, while the Gamemakers' boredom read a separate scalar. Now the booth
 * reads the segments: a crowd with no heat left anywhere is bored, and when
 * the Head Gamemaker reaches for their signature the loudest segment gets
 * what it wants first — mutts for the bloodthirsty, a feast for the
 * romantics, a parachute to an outsider for the underdog fans.
 */
const A = AUDIT12_WAVE3.audience;

export function crowdHeat(state: GameState): number {
    const mood = audienceOf(state);
    return AUDIENCE_SEGMENT_LIST.reduce((sum, s) => sum + mood[s], 0);
}

export function crowdIsBored(state: GameState): boolean {
    // Before the first turn has scored anything, fall back to the old scalar
    // so the very first check of a run means what it always meant.
    if (!state.audience) return state.audienceInterest !== undefined && state.audienceInterest < GAMEMAKER_AGENCY.boredomThreshold;
    return crowdHeat(state) < A.boredHeat;
}

/** The segment leading the others by at least the margin, if any. */
export function leadingSegment(state: GameState): AudienceSegment | undefined {
    const mood = audienceOf(state);
    const sorted = [...AUDIENCE_SEGMENT_LIST].sort((a, b) => mood[b] - mood[a]);
    return mood[sorted[0]] - mood[sorted[1]] >= A.leadMargin ? sorted[0] : undefined;
}

function asGamemaker(ctx: SimContext, fn: () => void) {
    const previous = ctx.state.gamemakerMode;
    ctx.state.gamemakerMode = true;
    try { fn(); } finally { ctx.state.gamemakerMode = previous; }
}

/** What the loudest segment gets. Returns the segment answered, if any. */
export function answerLoudestSegment(ctx: SimContext): AudienceSegment | undefined {
    // A hands-off director does not play to the crowd.
    if (ctx.state.headGamemaker && directorTaste(ctx.state.headGamemaker).id === 'hands-off' && directorTaste(ctx.state.headGamemaker) !== NEUTRAL_TASTE) return undefined;
    const lead = leadingSegment(ctx.state);
    if (!lead) return undefined;
    if (lead === 'bloodthirsty') {
        ctx.logEvent('The control room has been reading the crowd, and the crowd wants blood. The pens are opened first.', [], { category: 'gamemaker', important: true });
        asGamemaker(ctx, () => triggerGamemakerEvent(ctx, 'mutt', undefined, true));
        return lead;
    }
    if (lead === 'romantic') {
        if (!ctx.state.config.enableFeast || ctx.state.feastDay !== undefined) return undefined;
        ctx.state.feastDay = ctx.state.day + 1;
        ctx.logEvent('The romantics have the ratings tonight, and the Capitol gives them what they like best: a table everybody has to walk to. There will be a feast tomorrow.', [], { category: 'feast', important: true });
        announceFeastTheme(ctx);
        return lead;
    }
    const outsider = [...getAlive(ctx.state)].sort((a: Tribute, b: Tribute) => a.trainingScore - b.trainingScore || a.id.localeCompare(b.id))[0];
    if (!outsider) return undefined;
    const pool = itemPoolFor(ctx.state, ITEMS.filter(i => i.value > 0));
    if (pool.length === 0) return undefined;
    const gift = mintItem(ctx.rng, pickNeededGift(ctx, outsider, pool), QUALITY_BIAS.parachute);
    dropParachute(ctx, outsider, gift, 'The underdog fans pooled for it — every coin of it small.');
    ctx.logEvent(`The underdog fans have been loud all day, and the Capitol lets their money through: a parachute starts down toward ${outsider.name}.`, [outsider.id], { category: 'sponsor', important: true });
    return lead;
}
