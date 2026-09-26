import { GameState, Tribute } from '../../models/types';
import { AUDIT12_WAVE3, QUALITY_BIAS } from '../../data/balance';
import { ITEMS } from '../../data/constants';
import { SimContext, getAlive } from '../context';
import { addZoneThreat } from '../memory';
import { addExcitement } from '../audience';
import { giveItem, itemPhrase, itemPoolFor, mintItem } from '../items';
import { startZoneEffect } from '../zoneEffects';
import { campaignOf } from '../campaign';
import { seasonOf, sideRng } from './runState';

/**
 * AUDIT-12 wave 3 §12.4: arena-level story chains.
 *
 * `state.eventChains` links two beats on one tribute. These are the arena's
 * own three-part stories, spanning days: the first step plants something, the
 * second escalates it, the third pays it off — every `stepDays` days, to
 * whoever is standing in the chain's zone. Progress is kept in the campaign
 * per arena, so a chain the Games ended in the middle of picks up where it
 * left off the next time the player comes back here, and a finished one
 * rotates to the next story.
 */
const S = AUDIT12_WAVE3.story;

interface ChainStep {
    text: (zone: string, who: string) => string;
    /** 'threat' marks the zone; 'reward' leaves an item; 'effect' changes the zone. */
    kind: 'threat' | 'reward' | 'effect';
}

export interface StoryChain {
    id: string;
    title: string;
    steps: [ChainStep, ChainStep, ChainStep];
}

export const STORY_CHAINS: StoryChain[] = [
    {
        id: 'the-signal', title: 'The Signal',
        steps: [
            { kind: 'threat', text: z => `A light starts blinking in ${z} at the same hour every evening. Nobody in the arena knows who is making it.` },
            { kind: 'effect', text: z => `The light in ${z} is brighter tonight, and it is answered from somewhere else in the arena. The fog comes in behind it.` },
            { kind: 'reward', text: (z, w) => `${w} finally reaches the light in ${z}: a buried beacon, and beside it a crate the Gamemakers forgot to collect.` },
        ],
    },
    {
        id: 'the-dead-tree', title: 'The Dead Tree',
        steps: [
            { kind: 'threat', text: z => `Something has been carving marks into the dead tree in ${z}. One more every night.` },
            { kind: 'threat', text: (z, w) => `${w} counts the marks on the tree in ${z}: one for every cannon so far. Somebody is keeping score.` },
            { kind: 'reward', text: (z, w) => `${w} digs at the roots of the tree in ${z} and finds what the scorekeeper buried there.` },
        ],
    },
    {
        id: 'the-flood-gate', title: 'The Flood Gate',
        steps: [
            { kind: 'threat', text: z => `A grinding noise starts under ${z}. The ground is wet where it was not wet yesterday.` },
            { kind: 'threat', text: z => `Water is standing in ${z} now, and the grinding is louder. The arena is filling something.` },
            { kind: 'effect', text: z => `The gate under ${z} opens all at once.` },
        ],
    },
    {
        id: 'the-cache-map', title: 'The Cache Map',
        steps: [
            { kind: 'threat', text: (z, w) => `${w} finds a scrap of map pinned to a post in ${z}, with half a route on it.` },
            { kind: 'threat', text: (z, w) => `The second half of the map is in ${z}. ${w} is not the only one who has seen the first.` },
            { kind: 'reward', text: (z, w) => `${w} follows the map to its end in ${z}. It was real.` },
        ],
    },
    {
        id: 'the-burn-line', title: 'The Burn Line',
        steps: [
            { kind: 'threat', text: z => `Smoke on the edge of ${z}. Not a campfire: a line of it, too straight to be an accident.` },
            { kind: 'threat', text: z => `The burn line has moved into ${z} overnight. It is being walked, deliberately, toward somebody.` },
            { kind: 'effect', text: z => `The line reaches the middle of ${z} and the Gamemakers light the rest of it.` },
        ],
    },
];

function arenaKey(state: GameState): string {
    return state.arena.mapId ?? state.arena.id;
}

/** Which chain this arena is on, and from which step, given the campaign's memory of it. */
export function chainFor(state: GameState): { chain: StoryChain; step: number } {
    const saved = campaignOf(state.campaign).ledger?.storyChains?.[arenaKey(state)];
    const completed = saved?.completed ?? 0;
    const unfinished = saved && saved.step > 0 && saved.step < S.steps ? saved : undefined;
    const chain = (unfinished && STORY_CHAINS.find(c => c.id === unfinished.chainId))
        ?? STORY_CHAINS[(hash(arenaKey(state)) + completed) % STORY_CHAINS.length];
    return { chain, step: unfinished ? unfinished.step : 0 };
}

function hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
}

/** Called once per cycle. At most one step every `stepDays` days. */
export function tickStoryChain(ctx: SimContext): void {
    const state = ctx.state;
    if (state.day < 1 || state.timeOfDay === 'night') return;
    const s = seasonOf(state);
    if (!s.story) {
        const { chain, step } = chainFor(state);
        s.story = { chainId: chain.id, step, lastDay: 0 };
    }
    const story = s.story;
    if (story.step >= S.steps || state.day - story.lastDay < S.stepDays) return;
    const chain = STORY_CHAINS.find(c => c.id === story.chainId);
    const alive = getAlive(state);
    if (!chain || alive.length < 2) return;
    const rng = sideRng(state, `story-${chain.id}-${story.step}`);
    const who: Tribute = rng.pick(alive);
    const zone = who.zone;
    const step = chain.steps[story.step];
    story.step += 1;
    story.lastDay = state.day;
    addExcitement(who, S.stepExcitement);
    if (step.kind === 'threat') alive.forEach(t => addZoneThreat(state, t, zone, S.stepThreat));
    if (step.kind === 'effect') startZoneEffect(ctx, zone, chain.id === 'the-flood-gate' ? 'flooded' : chain.id === 'the-signal' ? 'fogbound' : 'burning');
    let text = step.text(zone, who.name);
    if (step.kind === 'reward') {
        const pool = itemPoolFor(state, ITEMS.filter(i => i.value >= S.rewardMinValue));
        if (pool.length > 0) {
            const item = mintItem(rng, rng.pick(pool), QUALITY_BIAS.feast);
            giveItem(who, item);
            text += ` Inside: ${itemPhrase(item)}.`;
        }
    }
    ctx.logEvent(`${chain.title}, part ${story.step} of ${S.steps}. ${text}`, [who.id], { important: story.step === S.steps, category: 'arena', zone });
}
