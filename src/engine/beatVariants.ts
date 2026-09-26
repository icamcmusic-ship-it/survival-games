/**
 * AUDIT-12 §10 (staleness): the fixed beats, rotated.
 *
 * A handful of lines fire in 99-100 % of runs — the gong, the bloodbath's
 * cannon count, "the Capitol is talking about…", the last tribute from a
 * district, the partner's cannon, "something in {T} goes quiet", "stops
 * pretending to forage", the Capitol's enforced truce. Each was a single
 * template written at its call site, so the recent-lines filter in
 * `context.ts` had nothing to rotate *to*.
 *
 * Rather than touching every call site, `logEvent` passes each line through
 * `rotateFixedBeat`. A line that matches one of the patterns below is re-drawn
 * from a pool of variants through `ctx.pickText`, which is the same path every
 * other flavour pool uses: the per-pool used-set, the prose RNG stream (so the
 * mechanical stream never sees how much prose exists) and the cross-session
 * stale-line filter. Every variant names exactly the people the original did,
 * so `tributesInvolved` stays truthful.
 */

import { REAPING_CROWD_VARIANTS } from '../data/pregames';

interface FixedBeat {
    /** Matches the call site's line exactly; groups become `{1}`, `{2}`, … */
    pattern: RegExp;
    /** Variants. The first is the original wording, which keys the pool. */
    variants: string[];
}

const FIXED_BEATS: FixedBeat[] = [
    {
        pattern: /^The gong sounds\. (\d+) tributes come off their plates at once\.$/,
        variants: [
            'The gong sounds. {1} tributes come off their plates at once.',
            'The gong. {1} tributes leave their plates in the same heartbeat, and the Games begin.',
            'The gong goes, and {1} tributes step off metal onto ground that is trying to kill them.',
            'One note from the gong, and {1} bodies are already moving before it finishes.',
            'The countdown reaches nothing. The gong sounds, and {1} tributes run — most of them towards the horn.',
            'The gong rings out over the arena. {1} tributes, and not one of them stays where they were put.',
        ],
    },
    {
        pattern: /^(\d+) cannons? mark the end of the bloodbath\.$/,
        variants: [
            '{1} cannon(s) mark the end of the bloodbath.',
            'The cannons start and do not stop for a long time: {1} of them, by the end of the bloodbath.',
            'When the horn goes quiet the Capitol counts {1} cannon(s). The bloodbath is over.',
            'The bloodbath is over. {1} cannon(s), and the arena exhales.',
            'Somebody in the Capitol counts {1} cannon(s) out loud. That is the bloodbath, done.',
            'The field around the horn empties. {1} cannon(s) say what the cameras already showed.',
        ],
    },
    {
        pattern: /^By the end of the night the Capitol is talking about (.+)\. Everybody else came down the same avenue and nobody remembers it\.$/,
        variants: [
            'By the end of the night the Capitol is talking about {1}. Everybody else came down the same avenue and nobody remembers it.',
            'The parade has two stories, and they are {1}. The rest of the chariots are already a blur.',
            'Every screen in the Capitol is replaying {1} by midnight. Nobody asks for anyone else.',
            'The sponsors leave the avenue saying two names: {1}. The others will have to earn it in the arena.',
            'If the Capitol remembers one thing from the parade, it is {1}. The broadcast agrees and cuts accordingly.',
        ],
    },
    {
        pattern: /^(.+?) is the last tribute from District (\d+)\. (.+?) is dead\.$/,
        variants: [
            '{1} is the last tribute from District {2}. {3} is dead.',
            'The cannon is for {3}. {1} is all District {2} has left in the arena.',
            '{1} counts the cannon and knows whose it was. {3} is gone, and District {2} is down to one.',
            'District {2} has one tribute left, and it is {1}. {3} will not be coming home.',
            '{3} is dead. From tonight {1} carries District {2} alone.',
        ],
    },
    {
        pattern: /^(.+?) hears the cannon for (.+?), the other tribute from District (\d+)\. (.+?) killed them\.$/,
        variants: [
            '{1} hears the cannon for {2}, the other tribute from District {3}. {4} killed them.',
            'The cannon is for {2}, and {1} knows it before the sky confirms it. {4} did it. District {3} is down to one.',
            '{1} sits very still at the cannon. {2}, the other half of District {3}, is dead, and {4} is the reason.',
            '{4} has killed {2}. Somewhere else in the arena, {1} hears the cannon and is the last of District {3}.',
            'District {3} loses {2} to {4}, and {1} hears it happen from too far away to matter.',
        ],
    },
    {
        pattern: /^Something in (.+?) goes quiet and does not come back\. Whatever they are from here on, it is not what walked into the arena\.$/,
        variants: [
            'Something in {1} goes quiet and does not come back. Whatever they are from here on, it is not what walked into the arena.',
            '{1} stops flinching at the cannons. It is not courage. It is something going out.',
            'The part of {1} that was still counting days goes dark, and the rest of them carries on without it.',
            '{1} catches their own reflection in the water and does not recognise it, and does not mind.',
            'Whatever was holding {1} together lets go, very quietly, and nobody is there to see it.',
        ],
    },
    {
        pattern: /^(.+?) stops pretending to forage and starts hunting (.+)\.$/,
        variants: [
            '{1} stops pretending to forage and starts hunting {2}.',
            '{1} is not looking for food any more. {1} is looking for {2}.',
            '{1} drops the gathering and picks up the trail. The trail belongs to {2}.',
            'Every step {1} takes now is towards {2}, and they have stopped pretending otherwise.',
            '{1} has a name in mind, and it is {2}. The foraging was only ever an excuse.',
        ],
    },
    {
        pattern: /^The Capitol declares a truce between (.+?) and (.+?), who would each rather die than keep it, and the arena will enforce it for (\d+) cycles\. (.+)$/,
        variants: [
            'The Capitol declares a truce between {1} and {2}, who would each rather die than keep it, and the arena will enforce it for {3} cycles. {4}',
            'An announcement names {1} and {2}: they are at peace for {3} cycles, by order, whether they like it or not. {4}',
            '{1} and {2} are told, over the whole arena, that they may not touch each other for {3} cycles. Neither of them looks relieved. {4}',
            'The Gamemakers bind {1} and {2} to a truce neither asked for, {3} cycles long, and make sure the cameras catch both faces. {4}',
            'For {3} cycles, the arena itself will stop {1} and {2} from killing each other. The Capitol calls this a gift. {4}',
        ],
    },
    {
        pattern: /^(.+?) leaves the goodbye room carrying their district token: (.+)\. The review board will allow it\. It is the only thing of home the arena will\.$/,
        variants: [
            '{1} leaves the goodbye room carrying their district token: {2}. The review board will allow it. It is the only thing of home the arena will.',
            'The review board turns {2} over twice and hands it back. {1} goes into the arena with one piece of home: {2}.',
            '{1} is allowed to keep {2}. They close their hand round it on the way to the train and do not open it again for hours.',
            'The token passes inspection: {2}. {1} pins it inside their collar, where the cameras cannot see it.',
            '{1} gets to keep {2}. Of all the things the Capitol takes this week, it will not take that.',
        ],
    },
    {
        pattern: /^(.+?) is asked to leave their token behind at the review board\. No reason is given, and none is ever given\. They go in with nothing of home on them at all\.$/,
        variants: [
            '{1} is asked to leave their token behind at the review board. No reason is given, and none is ever given. They go in with nothing of home on them at all.',
            'The review board keeps {1}\'s token in a drawer with a lot of others. {1} goes into the arena empty-handed.',
            '{1}\'s token is confiscated as a possible weapon. It is not one. Nobody argues with the board.',
            'A clerk looks at {1}\'s token for one second and drops it in a tray. That is the last {1} sees of home.',
            'The board refuses {1}\'s token without looking up. Whatever it was, it stays in the Capitol.',
        ],
    },
];

/** AUDIT-12 §10: each district square's line, by exact text, to its pool. */
const CROWD_POOLS = new Map<string, string[]>(
    Object.values(REAPING_CROWD_VARIANTS).map(pool => [pool[0], pool]));

function fillGroups(template: string, groups: string[]): string {
    const n = Number(groups[0]);
    return template
        .replace(/cannon\(s\)/g, n === 1 ? 'cannon' : 'cannons')
        .replace(/\{(\d)\}/g, (_, i: string) => groups[Number(i) - 1] ?? '');
}

/**
 * The line to log instead of `text`: a variant of a fixed beat when `text` is
 * one, drawn through `pickText`; otherwise `text` unchanged.
 */
export function rotateFixedBeat(pickText: (pool: string[]) => string, text: string): string {
    const crowd = CROWD_POOLS.get(text);
    if (crowd) return pickText(crowd);
    for (const beat of FIXED_BEATS) {
        const m = beat.pattern.exec(text);
        if (!m) continue;
        return fillGroups(pickText(beat.variants), m.slice(1));
    }
    return text;
}

/** For tests and coverage scripts: how many variants each fixed beat carries. */
export const FIXED_BEAT_VARIANT_COUNTS: number[] = FIXED_BEATS.map(b => b.variants.length);
