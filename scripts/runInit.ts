import { GameConfig, GameState } from '../src/models/types';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { generateTributes } from '../src/engine/generator';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { FRESH_CAMPAIGN } from '../src/engine/campaign';

/**
 * AUDIT-9 B19: one run-initialisation function, shared with the harnesses.
 *
 * Both harnesses built their own starting `GameState` by hand, and both had
 * drifted from what `gameStore.startGame` actually does. `metrics.ts` omitted
 * the `quell` argument to `generateTributes` entirely, so every Quell-specific
 * starting loadout in the game was unmeasured; `soak.ts` stored the raw config
 * where production stores the profile-resolved one. A harness that does not
 * initialise the run the way production does is not measuring the game.
 *
 * This is that one function. If production grows another input, it grows here
 * and both harnesses get it, instead of two more hand-written copies drifting
 * apart for another few audits.
 */
export function initialRunState(
    { seed, arenaId, config, gamemakerMode = false }:
    { seed: string; arenaId: string; config: GameConfig; gamemakerMode?: boolean },
): GameState {
    // REPLAY-01: this year's temperament is rolled before the arena and the
    // cast, because a Quell can shape both of them.
    const gamesProfile = gamesProfileFor(seed);
    // AUDIT-6 §1.3: the store's own resolver, so a headless run plays the
    // arena — off-season skin and Quell law override included — that the
    // player is handed.
    const arena = resolveArenaForRun(seed, arenaId, gamesProfile);
    const resolved = configForProfile(config, gamesProfile);
    const tributes = generateTributes(
        seed,
        resolved,
        arena.zones[0].name,
        gamesProfile.castShape,
        // The argument metrics.ts was missing: a Quell changes what tributes
        // walk in carrying.
        gamesProfile.quell,
    );
    return {
        seed, arena, tributes, phase: 'setup', day: 0, log: [],
        gamemakerMode,
        config: resolved,
        baseConfig: config,
        gamesProfile,
        logCounter: 0,
        feastsHeld: 0,
        cycle: 0,
        // AUDIT-9 B06: headless runs are explicitly first-career runs. Stated
        // rather than left undefined so it is obvious that a measurement is
        // of the game a new player is handed, not of somebody's record book.
        campaign: FRESH_CAMPAIGN,
    };
}

/**
 * AUDIT-9 B19: the explicit arena x config product, instead of two moduli.
 *
 * Both harnesses chose arena and config with the same loop index:
 *
 *     arenaIds[i % arenaIds.length]     // 46 choices, including procedural
 *     configs[i % configs.length]       //  4 choices
 *
 * 46 and 4 share a factor, so the pair `(i % 46, i % 4)` cycles with period
 * 92 and visits 92 of the 184 combinations — forever. Adding runs does not
 * help: at 1,600 runs it was still 92 cells, each arena seeing exactly two of
 * the four configurations, and which two is an artefact of list order. Half
 * the matrix has never been executed, and an arena law that misbehaves under a
 * twelve-district field will not be found by a harness that never gives that
 * arena a twelve-district field.
 *
 * So the cells are enumerated, and the run budget is spent *within* them:
 * every (arena, config) pair appears, and seeds vary across repeats. The
 * returned list is deterministic and in a stable order, so a run index still
 * maps to the same cell between invocations.
 */
export interface CoverageCell {
    arenaId: string;
    configIndex: number;
    /** Which repeat of this cell this run is — folded into the seed. */
    repeat: number;
}

export function coverageCells(arenaIds: string[], configCount: number, runs: number): CoverageCell[] {
    const pairs: Array<{ arenaId: string; configIndex: number }> = [];
    arenaIds.forEach(arenaId => {
        for (let c = 0; c < configCount; c++) pairs.push({ arenaId, configIndex: c });
    });
    const cells: CoverageCell[] = [];
    for (let i = 0; i < runs; i++) {
        const pair = pairs[i % pairs.length];
        cells.push({ ...pair, repeat: Math.floor(i / pairs.length) });
    }
    return cells;
}

/**
 * How much of the matrix a sweep actually executed, and whether that is all of
 * it. A sweep smaller than the matrix is legitimate — a quick local run — but
 * it must say so rather than look like full coverage.
 */
export function coverageReport(cells: CoverageCell[], arenaIds: string[], configCount: number): string {
    const visited = new Set(cells.map(c => `${c.arenaId}|${c.configIndex}`));
    const total = arenaIds.length * configCount;
    const missing = total - visited.size;
    const repeats = cells.length === 0 ? 0 : Math.min(...cells.map(c => c.repeat)) + 1;
    return `coverage: ${visited.size}/${total} arena x config cells`
        + (missing > 0
            ? ` — ${missing} not visited (raise the run count to ${total} for a full pass)`
            : `, minimum ${repeats} seed(s) per cell`);
}
