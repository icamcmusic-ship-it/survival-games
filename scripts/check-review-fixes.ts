/**
 * Review fixes: latent edges, reopening cuts, stale-line memory, the eight-slot
 * prediction slip, legacy seating on pinned replays, the Ward Block count under
 * blackout, and the Glasshouse's safe wing.
 *
 *   npm run test:review-fixes
 */
import { readFileSync } from 'node:fs';
import { initialRunState } from './runInit';
import { DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { RNG } from '../src/utils/rng';
import { lineHash } from '../src/utils/lineHash';
import { createContext } from '../src/engine/context';
import { edgeKey, hopsTo, nearestSafeZone, reachableZones, tickOpeningEdges } from '../src/engine/map';
import { isZoneLocked, lockZone, openLatentEdge, safeShelter, startBlackout, getMark } from '../src/engine/arenaRules';
import { markPackCut } from '../src/engine/arenaRules';
import { tickArenaEvents } from '../src/engine/arenaEventPacks';
import { glasshouseSignature, safeWing, wingOrder } from '../src/engine/arenaSignaturesBuildings';
import { scorePrediction, finishingOrder, predictionFilled } from '../src/engine/prediction';
import { normalizePrediction } from '../src/utils/saveMigrations';
import { scenario, check, eq, report } from './scenarios';

/* eslint-disable @typescript-eslint/no-explicit-any */

const tri = () => ({
    name: 'x', rules: { latentEdges: [['A', 'C']] }, zones: [
        { name: 'A', terrain: 'open', adjacent: ['B', 'C'] },
        { name: 'B', terrain: 'open', adjacent: ['A', 'C'] },
        { name: 'C', terrain: 'open', adjacent: ['A', 'B'] },
    ],
}) as any;

scenario('1: an opened latent edge is open for callers that pass no state', 'review #1', () => {
    const arena = tri();
    const state: any = { arena, cycle: 1, tributes: [], seed: 's' };
    eq(hopsTo(arena, 'A', 'C', []), 2, 'closed latent edge routes around');
    eq(nearestSafeZone(arena, 'A', ['C']), 'C', 'reachable via B');
    const walled = { ...tri(), zones: [
        { name: 'A', terrain: 'open', adjacent: ['C'] }, { name: 'C', terrain: 'open', adjacent: ['A'] },
    ] } as any;
    eq(nearestSafeZone(walled, 'A', ['C'], new Set()), 'C', 'fallback when nothing else reachable');
    check(openLatentEdge(state, 'A', 'C'), 'opened');
    eq(hopsTo(arena, 'A', 'C', []), 1, 'stateless hopsTo sees opened edge');
    check(reachableZones(arena, 'A', []).some(z => z.name === 'C'), 'stateless reachableZones sees opened edge');
    check(reachableZones(arena, 'A', [], undefined, undefined, { state }).some(z => z.name === 'C'), 'stateful too');
});

scenario('2: the reopening tick never undoes a lockdown cut or an event-pack sever', 'review #2', () => {
    const always = { chance: () => true, pick: (a: any[]) => a[0] } as any;
    const arena: any = { name: 'x', zones: [
        { name: 'A', terrain: 'open', adjacent: ['B'] }, { name: 'B', terrain: 'open', adjacent: ['A', 'C'] },
        { name: 'C', terrain: 'open', adjacent: ['B'] },
    ] };
    const state: any = { arena, cycle: 1, tributes: [], seed: 's', severedEdges: [] };
    lockZone(state, 'B', 10);
    tickOpeningEdges({ state, rng: always, logEvent: () => {} } as any);
    check(isZoneLocked(state, 'B'), 'still locked');
    check(state.severedEdges.includes(edgeKey('A', 'B')), 'lock cut stays');
    const s2: any = { arena, cycle: 1, tributes: [], seed: 's', severedEdges: [edgeKey('A', 'B')] };
    markPackCut(s2, 'A', 'B');
    tickOpeningEdges({ state: s2, rng: always, logEvent: () => {} } as any);
    check(s2.severedEdges.includes(edgeKey('A', 'B')), 'pack sever stays');
    const s3: any = { arena, cycle: 1, tributes: [], seed: 's', severedEdges: [edgeKey('A', 'B')] };
    tickOpeningEdges({ state: s3, rng: always, logEvent: () => {} } as any);
    eq(s3.severedEdges.length, 0, 'an ordinary cut still reopens');
});

scenario('3: stale-line memory records what was shown, rotation records what was drawn', 'review #3', () => {
    const pool = ['a {x}', 'b {x}', 'c {x}', 'd {x}'];
    const run = (stale: string[]) => {
        const state: any = { seed: 's', tributes: [], log: [], ...(stale.length ? { staleLines: stale } : {}) };
        const ctx: any = createContext(state, new RNG('s'));
        const shown: string[] = [];
        for (let i = 0; i < 4; i++) shown.push(ctx.pickText(pool));
        return { state, shown };
    };
    const plain = run([]);
    eq(plain.state.shownText, undefined, 'no shownText without a stale set');
    eq(plain.shown.join(), plain.state.usedText[pool[0]].join(), 'shown == drawn without stale set');
    const stale = run([lineHash(pool[0])]);
    eq(stale.state.usedText[pool[0]].join(), plain.state.usedText[pool[0]].join(), 'rotation identical');
    eq(stale.state.shownText[pool[0]].join(), stale.shown.join(), 'shownText is what was shown');
    check(!stale.shown.includes(pool[0]), 'stale line never shown');
});

scenario('4: the final-eight slip is a fixed eight-slot array', 'review #4', () => {
    const sparse = ['', 'T2', '', 'T4', '', '', '', ''];
    const n = normalizePrediction({ finalEight: sparse });
    eq(n?.finalEight?.join(), sparse.join(), 'sparse kept in place');
    eq(normalizePrediction({ finalEight: ['', ''] })?.finalEight, undefined, 'all-empty dropped');
    eq(normalizePrediction({ finalEight: ['T1', 'T1'] })?.finalEight?.join(), 'T1,', 'duplicate keeps first');
    check(predictionFilled({ finalEight: sparse }), 'sparse slip is filled');
    check(!predictionFilled({ finalEight: ['', ''] }), 'empty slip is not');
    const state = { tributes: Array.from({ length: 10 }, (_, i) => ({ id: `T${i}`, status: i === 0 ? 'alive' : 'dead', eliminationIndex: 10 - i, kills: 0 })) } as any;
    const order = finishingOrder(state.tributes).map((t: any) => t.id);
    const slot = ['', order[1], '', '', '', '', '', ''];
    const r = scorePrediction(state, { finalEight: slot })!;
    eq(r.score, r.max, 'a pick in slot 2 scores exact place');
    // The component's setPlace: duplicate moves the tribute.
    const src = readFileSync(new URL('../src/components/PredictionSlip.tsx', import.meta.url), 'utf8');
    check(src.includes("if (x === id) next[j] = ''"), 'duplicate pick moves tribute to the new slot');
    check(!src.includes('next.filter('), 'no compaction on setPlace');
});

scenario('5: a pinned share-link replay never seats a legacy tribute', 'review #5', () => {
    const src = readFileSync(new URL('../src/store/gameStore.ts', import.meta.url), 'utf8');
    check(/pinnedCampaign === undefined && legacyReapingDue\(/.test(src), 'legacy seating guarded on pinned replay');
    check(/delete newState\.legacyTributeIds/.test(src) && /delete newState\.prediction/.test(src), 'reroll clears seating and slip');
});

function wardblockState(seed: string): { state: GameState; ctx: any } {
    const state = initialRunState({ seed, arenaId: 'wardblock', config: DEFAULT_GAME_CONFIG });
    state.phase = 'day';
    state.day = 3;
    state.cycle = 6;
    state.arenaEventPlan = [{ id: 'wardblock-the-count', day: 2 }];
    state.arenaEventsFired = [];
    return { state, ctx: createContext(state, new RNG(seed)) };
}

scenario('9: the Ward Block count does not go out under the lockdown blackout', 'review #9', () => {
    const loud = wardblockState('COUNT-1');
    tickArenaEvents(loud.ctx);
    check(loud.state.log.some(l => l.text.startsWith('Count.')), 'count announced normally');
    const quiet = wardblockState('COUNT-1');
    startBlackout(quiet.state);
    tickArenaEvents(quiet.ctx);
    check(!quiet.state.log.some(l => l.text.startsWith('Count.')), 'no count under blackout');
    check(quiet.state.arenaEventsFired?.includes('wardblock-the-count') ?? false, 'still consumed');
});

scenario('11: the Glasshouse never names the next wing to crack as safe', 'review #11', () => {
    const order = ['W1', 'W2', 'W3', 'W4'];
    for (let n = 0; n < order.length; n++) check(safeWing(order, n) !== order[n], `safeWing(${n})`);
    eq(safeWing(order, 3), undefined, 'no safe wing when only the next is whole');
    ['GLASS-1', 'GLASS-2', 'GLASS-3'].forEach(seed => {
        const state = initialRunState({ seed, arenaId: 'glasshouse', config: DEFAULT_GAME_CONFIG });
        state.phase = 'day';
        const ctx: any = createContext(state, new RNG(seed));
        const wings = wingOrder(ctx);
        for (let cycle = 1; cycle < 60; cycle++) {
            state.cycle = cycle;
            state.timeOfDay = cycle % 2 ? 'day' : 'night';
            glasshouseSignature(ctx, cycle, new RNG(`${seed}-${cycle}`));
            const given = Number(getMark(state, 'glass:given') ?? 0);
            const cracking = getMark(state, 'glass:cracking');
            const nextAfter = typeof cracking === 'string' ? wings[given + 1] : wings[given];
            const safe = safeShelter(state);
            if (safe !== undefined) {
                check(safe !== cracking, `${seed} c${cycle}: safe is not the cracking wing`);
                check(safe !== nextAfter, `${seed} c${cycle}: safe is not the next to crack`);
            }
        }
    });
});

process.exit(report('review-fixes') > 0 ? 1 : 0);
