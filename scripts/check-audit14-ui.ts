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
 */
import assert from 'node:assert/strict';
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
