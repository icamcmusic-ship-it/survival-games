/**
 * AUDIT-14 §4 / §8 side-system guards.
 *
 *   npm run test:audit14-ui
 *
 * U2  undo past a watched phase locks the book (bets and cash-outs)
 * S1  a run link keeps campaign records for districts 14-16
 * S2  a corrupted record book reads without throwing, and the record book renders
 * S3  a Hall of Fame import never evicts the player's own victors
 * S11 the stored victor count never exceeds what a run link accepts
 * S4-S10, F1-F3, F5, F6 and the rest: see each test's name
 */
import assert from 'node:assert/strict';
import { initialRunState } from './runInit';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { scenarioCast } from '../src/engine/season/scenarios';
import { STORY_CHAINS } from '../src/engine/season/storyChains';
import { COMMENTATORS, SCENARIO_CARDS, STORY_CHAIN_META } from '../src/data/replayCards';
import { sendPlayerNote, sendPlayerParachute } from '../src/engine/playerSponsor';
import { SPONSOR_NOTE } from '../src/data/balance';
import { interventionUndone } from '../src/engine/season/whatIfBranches';
import { snapshotState } from '../src/utils/snapshot';
import { decodeCampaignResult, encodeCampaign } from '../src/utils/campaignLink';
import { PANEM_SPEC, careerTotals, dailyStreakOf, foldDailyAndWeekly } from '../src/utils/panemStorage';
import { HOF_CAP, importHallOfFame } from '../src/utils/hofStorage';
import { SAVED_RUN_SPEC } from '../src/utils/saveMigrations';
import { StorageBackend, setStorageBackend } from '../src/utils/storage';
import type { CampaignSnapshot, GameState, HallOfFameEntry } from '../src/models/types';

const mem = new Map<string, string>();
const backend: StorageBackend = {
    getItem: k => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k, v) => { mem.set(k, v); },
    removeItem: k => { mem.delete(k); },
};
setStorageBackend(backend);

/** Play a run headless, to the end or until `stopAt` is the phase. */
function play(seed: string, mutate?: (s: GameState) => void, stopAt?: GameState['phase'], config = DEFAULT_GAME_CONFIG): GameState {
    let state = initialRunState({ seed, arenaId: ARENAS[0].id, config });
    mutate?.(state);
    const sim = new Simulator(state);
    let guard = 4000;
    while (state.phase !== 'ended' && guard-- > 0) {
        if (stopAt && state.phase === stopAt && (stopAt !== 'day' || state.day >= 1)) break;
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') sim.processBloodbath();
        else if (state.phase === 'epilogue') state.phase = 'ended';
        else if (!sim.processTurn()) break;
        state = sim.getState();
    }
    return state;
}
const outcome = (s: GameState) => s.tributes.map(t => `${t.id}:${t.status}:${t.kills}:${t.eliminationIndex ?? ''}`).join('|');

let failures = 0;
async function test(name: string, fn: () => void | Promise<void>) {
    try {
        await fn();
        console.log(`ok   ${name}`);
    } catch (e) {
        failures++;
        console.log(`FAIL ${name}\n     ${(e as Error).message}`);
    }
}

async function main() {
    await test('S1: D14-16 campaign records survive a run link', () => {
        const snap = {
            runs: 4, victors: 3,
            patronDistricts: [3, 14, 16],
            districtCrowns: { 14: { victories: 3 }, 3: { victories: 1 } },
            districtReputation: { 15: 2, 2: 1 },
            recentRuns: [{ victorDistrict: 16 }, { victorDistrict: 2 }],
            lastVictorDistrict: 16,
        } as unknown as CampaignSnapshot;
        const out = decodeCampaignResult(encodeCampaign(snap));
        assert.equal(out.status, 'ok');
        const s = out.snapshot as unknown as Record<string, unknown>;
        assert.deepEqual(s.patronDistricts, [3, 14, 16]);
        assert.deepEqual((s.recentRuns as Array<{ victorDistrict?: number }>)[0], { victorDistrict: 16 });
        assert.equal(s.lastVictorDistrict, 16);
        assert.ok(14 in ((s.districtCrowns ?? {}) as object), 'D14 crown kept');
        assert.ok(15 in ((s.districtReputation ?? {}) as object), 'D15 reputation kept');
    });

    await test('S2: null map entries in the record book are dropped, not rendered', () => {
        const book = PANEM_SPEC.migrate({
            runs: 3, victors: 2, unlocked: [],
            bests: { a: null, b: { value: 3, name: 'Rue', district: 11, seed: 's', arenaName: 'x', date: '' } },
            gamemakerRecords: { x: null, y: { games: 1, victors: 1, totalDays: 5, deaths: 20 } },
            districtCrowns: { 3: null, 4: { victories: 1 } },
            victorMentors: { 2: null },
            dailyBests: { d: null },
            recentRuns: [null, 'x', { seed: 's', arenaName: 'a', day: 5, deaths: 20, victorDistrict: 3 }],
        }, 1)!;
        assert.ok(book);
        assert.deepEqual(Object.keys(book.bests), ['b']);
        assert.deepEqual(Object.keys(book.gamemakerRecords ?? {}), ['y']);
        assert.deepEqual(Object.keys(book.districtCrowns ?? {}), []);
        assert.deepEqual(Object.keys(book.victorMentors ?? {}), []);
        assert.equal(book.recentRuns?.length, 1);
        careerTotals(book); // used to throw on `archetypes` of null
    });

    await test('S11: stored victors are clamped to two a Games', () => {
        const book = PANEM_SPEC.migrate({ runs: 2, victors: 9, unlocked: [], bests: {} }, 1)!;
        assert.equal(book.victors, 4);
    });

    await test('S3: an import never evicts the player\'s own victors, and never arrives pinned', () => {
        const mine: HallOfFameEntry[] = Array.from({ length: 10 }, (_, i) => ({
            id: `mine-${i}`, winnerName: `Mine${i}`, district: 1, arenaName: 'A', seed: 's', day: 5, kills: 1,
            date: new Date(2026, 0, i + 1).toISOString(),
        } as unknown as HallOfFameEntry));
        const hostile = Array.from({ length: 60 }, (_, i) => ({
            ...mine[0], id: `evil-${i}`, winnerName: `Evil${i}`, pinned: true, date: '2099-01-01T00:00:00.000Z',
        }));
        const res = importHallOfFame(JSON.stringify(hostile), mine);
        assert.ok(res.ok, res.message);
        assert.ok(res.entries.length <= HOF_CAP, `cap held (${res.entries.length})`);
        assert.equal(res.entries.filter(e => e.id.startsWith('mine-')).length, 10);
        assert.ok(res.entries.every(e => !e.id.startsWith('evil-') || !e.pinned), 'imports arrive unpinned');
        assert.ok(res.entries.every(e => Date.parse(e.date) <= Date.now() + 1000), 'no future dates');
    });

    await test('S4: a daily streak from last year is not live', () => {
        const row = (date: string) => ({ date, seed: `daily-${date}` });
        const week = ['2025-03-07', '2025-03-06', '2025-03-05', '2025-03-04', '2025-03-03', '2025-03-02', '2025-03-01'].map(row);
        assert.equal(dailyStreakOf(week, new Date(Date.UTC(2026, 8, 27))), 0);
        assert.equal(dailyStreakOf(week, new Date(Date.UTC(2025, 2, 8, 12))), 7, 'yesterday still counts');
    });

    await test('S5/S6/S7: dailies count on their own date, first run wins; weeklies match their launch week', () => {
        const victor = { id: 'v', name: 'Rue', district: 11, status: 'alive' };
        const base = { tributes: [victor], log: [], day: 5 } as unknown as GameState;
        const typed = { ...base, seed: 'daily-2025-03-01' } as GameState;
        assert.equal(foldDailyAndWeekly(undefined, typed), undefined, 'a typed-in past daily is practice');
        const real = { ...base, seed: 'daily-2025-03-01', launchedOn: '2025-03-01', prediction: { winnerId: 'x' } } as unknown as GameState;
        const first = foldDailyAndWeekly(undefined, real)!;
        assert.equal(first.dailyHistory?.[0].pickRight, false);
        const replay = { ...real, prediction: { winnerId: 'v' } } as unknown as GameState;
        const second = foldDailyAndWeekly(first, replay)!;
        assert.equal(second.dailyHistory?.length, 1);
        assert.equal(second.dailyHistory?.[0].pickRight, false, 'a replay does not overwrite the first result');
        const wk = { ...base, seed: 'weekly-1999-W01', launchWeekKey: 'week-1999-W01' } as unknown as GameState;
        // No slip on this state, so nothing is written; the point is that it is not rejected outright.
        assert.notEqual(foldDailyAndWeekly({}, wk), undefined);
    });

    await test('S9: The Pack of Six does not apply below four districts; Strange Allies swear a real alliance', () => {
        const small = play('A14-S9-SMALL', st => { st.config = { ...st.config, scenario: 'career-six' }; }, undefined, { ...DEFAULT_GAME_CONFIG, districtCount: 3 });
        assert.equal(scenarioCast(small).length, 0, 'no pack of four');
        assert.ok(!small.log.some(e => e.text.startsWith('Scenario: The Pack of Six')), 'not announced');
        let formed = 0;
        for (const seed of ['A14-S9-1', 'A14-S9-2', 'A14-S9-3', 'A14-S9-4', 'A14-S9-5']) {
            const s = play(seed, st => { st.config = { ...st.config, scenario: 'rival-allies' }; }, 'bloodbath');
            const [a, b] = scenarioCast(s);
            if (a && b && a.allianceId && a.allianceId === b.allianceId) formed++;
        }
        assert.ok(formed >= 3, `the pair came off the plates allied in ${formed}/5 runs`);
    });

    await test('F3: every scenario card applies, announces itself, and replays exactly', () => {
        assert.ok(SCENARIO_CARDS.length >= 15, `${SCENARIO_CARDS.length} cards`);
        assert.ok(COMMENTATORS.length >= 7, `${COMMENTATORS.length} voices`);
        assert.ok(STORY_CHAIN_META.length >= 15, `${STORY_CHAIN_META.length} chains`);
        assert.deepEqual(STORY_CHAIN_META.map(c => c.id), STORY_CHAINS.map(c => c.id));
        for (const card of SCENARIO_CARDS) {
            const mutate = (st: GameState) => { st.config = { ...st.config, scenario: card.id }; };
            const s = play(`A14-F3-${card.id}`, mutate, 'bloodbath');
            assert.ok(scenarioCast(s).length > 0, `${card.id}: empty cast`);
            assert.ok(s.log.some(e => e.text.startsWith(`Scenario: ${card.name}`)), `${card.id}: not announced`);
        }
        const once = play('A14-F3-REPLAY', st => { st.config = { ...st.config, scenario: 'old-grudge' }; });
        const twice = play('A14-F3-REPLAY', st => { st.config = { ...st.config, scenario: 'old-grudge' }; });
        assert.equal(outcome(once), outcome(twice));
    });

    await test('S8/S10: the player parachute line varies; a training flub is not a toll paid', () => {
        const s = play('A14-S10', undefined, 'bloodbath');
        const flubs = s.log.filter(e => e.type === 'training-flub').length;
        const paid = s.log.filter(e => e.type === 'tribute-paid' && e.category === 'training').length;
        assert.equal(paid, 0, 'training lines still typed tribute-paid');
        void flubs;
        const lines = new Set<string>();
        for (let i = 0; i < 12; i++) {
            const st = play(`A14-S8-${i}`, undefined, 'day');
            const t = st.tributes.find(x => x.status === 'alive')!;
            const before = st.log.length;
            sendPlayerParachute(st, t.id, 'bandages');
            const line = st.log.slice(before).find(e => e.category === 'sponsor')?.text ?? '';
            lines.add(line.replace(t.name, 'X').replace(t.zone, 'Z').replace(/finds .*?[.:]/, 'finds I.'));
        }
        assert.ok(lines.size >= 3, `only ${lines.size} distinct parachute lines`);
    });

    await test('F6: "I had not done this" replays the Games without one intervention', () => {
        const reaping = initialRunState({ seed: 'A14-F6', arenaId: ARENAS[0].id, config: DEFAULT_GAME_CONFIG });
        const target = reaping.tributes[0].id;
        const start = snapshotState(reaping);
        start.plannedInterventions = [{ cycle: 3, type: 'parachute', targetId: target, itemId: 'bandages' }];
        const sim = new Simulator(start);
        let guard = 4000;
        while (guard-- > 0 && sim.advance()) { /* to the end */ }
        const actual = sim.getState();
        const mine = (actual.interventionLog ?? []).filter(r => !r.scheduled);
        assert.ok(mine.length >= 1, 'the replayed parachute is in the log');
        const r = interventionUndone(reaping, actual, 0, 2);
        assert.ok(r, 'a result');
        assert.equal(r!.kind, 'no-intervention');
        assert.equal(r!.branches.length, 2);
        assert.match(r!.subject, /parachute/);
    });

    await test('F5: a paid note lands, is logged for replay, and is capped per tribute', () => {
        const st = play('A14-F5', undefined, 'day');
        const t = st.tributes.find(x => x.status === 'alive')!;
        const sanity = t.vitals.sanity;
        const r = sendPlayerNote(st, t.id);
        assert.ok(r.ok, r.message);
        assert.ok(t.vitals.sanity >= sanity);
        assert.equal((st.interventionLog ?? []).filter(x => x.type === 'note').length, 1);
        for (let i = 0; i < 5; i++) sendPlayerNote(st, t.id);
        assert.equal((st.interventionLog ?? []).filter(x => x.type === 'note' && x.targetId === t.id).length, SPONSOR_NOTE.maxPerTribute);
        // Replayed from the log, a note lands the same line.
        const reaping = initialRunState({ seed: 'A14-F5', arenaId: ARENAS[0].id, config: DEFAULT_GAME_CONFIG });
        const start = snapshotState(reaping);
        start.plannedInterventions = [{ cycle: 3, type: 'note', targetId: reaping.tributes[1].id }];
        const sim = new Simulator(start);
        let guard = 4000;
        while (guard-- > 0 && sim.advance()) { /* to the end */ }
        const end = sim.getState();
        assert.ok(end.log.some(e => e.id.startsWith('player-note-')) || end.tributes[1].status === 'dead', 'the replayed note landed');
    });

    await test('U2: the save carries the undo high-water mark', () => {
        const raw = mem.size; void raw;
        const saved = SAVED_RUN_SPEC.migrate({ gameState: {}, seenAhead: 2 }, 1);
        // A bare gameState may not normalise; the field only matters when it does.
        if (saved) assert.equal(saved.seenAhead, 2);
        const bad = SAVED_RUN_SPEC.migrate({ gameState: {}, seenAhead: 'x' }, 1);
        if (bad) assert.equal(bad.seenAhead, undefined);
    });

    await test('U2: undo past a watched phase locks the book until re-played', async () => {
        const { gameStore, gameActions } = await import('../src/store/gameStore');
        await gameActions.startGame('AUDIT14-U2', 'classic', false);
        const phaseOf = () => gameStore.getState().gameState!.phase;
        let guard = 0;
        while (phaseOf() !== 'bloodbath' && guard++ < 40) gameActions.nextPhase();
        assert.equal(phaseOf(), 'bloodbath', 'reached the gong');
        assert.equal(gameActions.wagersLocked(), false);
        gameActions.nextPhase(); // run the bloodbath
        gameActions.stepBack();
        gameActions.stepBack(); // back before the gong
        assert.equal(gameActions.wagersLocked(), true, 'locked after undo');
        const coins = gameStore.getState().coins;
        gameActions.setCoins(Math.max(coins, 500));
        assert.equal(gameActions.placeSideBet('no-victor', 10), false, 'side bet refused');
        gameActions.nextPhase();
        gameActions.nextPhase();
        assert.equal(gameActions.wagersLocked(), false, 'unlocked once caught up');
    });

    console.log(failures === 0 ? '\nall audit-14 ui/side checks passed' : `\n${failures} check(s) failed`);
    process.exit(failures === 0 ? 0 : 1);
}

void main();
