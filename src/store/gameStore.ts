import { GameState, GameConfig, HallOfFameEntry } from '../models/types';
import { Bet, SAVED_RUN_SPEC, SavedRun } from '../utils/saveMigrations';
import { STARTING_COINS, readCoins, writeCoins } from '../utils/prefsStorage';
import { HOF_CAP, readHallOfFame, writeHallOfFame } from '../utils/hofStorage';
import { readStored, removeStored, tryWriteStored, writeStored } from '../utils/storage';
import { snapshotState } from '../utils/snapshot';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../data/constants';
import { QUELLS } from '../data/gamesProfile';
import { RNG } from '../utils/rng';
import type { Simulator } from '../engine/simulator';
import type { GamemakerEventType } from '../engine/gamemaker';
import { createStore } from './createStore';
import { PanemRecords, RunOutcome, clearPanem, commitRun, readPanem, setPatronDistrict } from '../utils/panemStorage';
import type { SponsorResult } from '../engine/playerSponsor';

/**
 * PERF: the engine is loaded on demand.
 *
 * `engine/engineBundle` pulls in the simulator and the big flavour/balance
 * tables — ~500 kB of the old single chunk — none of which the setup screen
 * needs. Every path that can start a run (fresh start, seeded replay from a
 * share link, Hall-of-Fame relaunch, resuming a save) awaits `loadEngine()`
 * first, so the boundary can only ever be crossed with the module present.
 *
 * Once resolved the module is cached in `engine`, so the synchronous callers
 * that only ever run *during* a Games (reroll, phase advance, sponsoring) can
 * keep reading it directly.
 */
type EngineModule = typeof import('../engine/engineBundle');
let engine: EngineModule | null = null;
let enginePromise: Promise<EngineModule> | null = null;

function loadEngine(): Promise<EngineModule> {
    if (engine) return Promise.resolve(engine);
    if (!enginePromise) {
        enginePromise = import('../engine/engineBundle').then(mod => {
            engine = mod;
            return mod;
        }).catch(err => {
            // Let a later attempt retry rather than caching the failure forever.
            enginePromise = null;
            throw err;
        });
    }
    return enginePromise;
}

/** Kicks off the engine fetch without waiting for it — used to warm the chunk
 *  while the player is still reading the setup screen. */
export function prefetchEngine() {
    void loadEngine().catch(() => { /* the real load path reports failures */ });
}

export type ViewName = 'setup' | 'roster' | 'game' | 'hallOfFame';

/**
 * `Bet` and `SavedRun` are declared in `utils/saveMigrations` (with the schema
 * that repairs them on load) and re-exported here so existing importers of
 * `gameStore` are unaffected.
 */
export type { Bet, SavedRun };

export interface GameStoreState {
    gameState: GameState | null;
    simulator: Simulator | null;
    view: ViewName;
    coins: number;
    bets: Record<string, Bet>;
    betWonMessage: string | null;
    isReplayedRun: boolean;
    /** Guards against paying out the same wager twice (e.g. Run to End then Proceed). */
    betsResolved: boolean;
    /** Guards against writing the same victory to the Hall of Fame twice. */
    hofSaved: boolean;
    /** REPLAY-03: everything that carries between runs. */
    panem: PanemRecords;
    /** What the run that just finished unlocked or beat, for the end screen. */
    lastRunOutcome: RunOutcome | null;
    /** Non-null while `runToEnd()` is fast-forwarding, for the progress readout. */
    runProgress: RunProgress | null;
}

/** Live counters for the Run-to-End progress readout. */
export interface RunProgress {
    day: number;
    phase: GameState['phase'];
    turns: number;
    logLines: number;
    tributesAlive: number;
    /**
     * U-4: the stakes, not just the counters. The tributes the player has
     * wagered on, and whether each is still breathing — losing your bet
     * during a skip should not be silent until the end screen.
     */
    wagered: Array<{ name: string; district: number; alive: boolean }>;
}

const BROKE_THRESHOLD = 50;
const STIPEND = 250;
/** §6.2: cost of becoming (or changing) a district's standing patron. */
const PATRON_COST = 750;
const PATRON_TRUST_BONUS = 12;

/**
 * UX-01: an in-progress run is autosaved after every phase, so a refresh or a
 * closed tab doesn't erase an 8-day chronicle. Finished runs aren't worth
 * resuming, so they don't get saved.
 *
 * The payload carries a schema version and is normalised on read (see
 * `utils/saveMigrations`), so a save written by an older build — one whose
 * `Tribute` predates half the fields the current engine reads — resumes with
 * every field defaulted rather than relying on `??` at each call site.
 */
function readSavedRun(): SavedRun | null {
    return readStored(SAVED_RUN_SPEC);
}

/**
 * The chronicle is the run's whole point, so the save keeps all of it.
 *
 * It used to be truncated to the last 200 lines, which meant every
 * refresh-and-resume silently threw away the opening days of the narrative.
 * The full log is written instead; only if localStorage actually refuses the
 * payload do we fall back through progressively shorter tails, so a save near
 * the ~5 MB origin quota degrades instead of failing outright.
 */
const LOG_TAIL_FALLBACKS = [4000, 2000, 800, 200];

function writeSave() {
    const { gameState, bets, betsResolved, hofSaved, isReplayedRun } = gameStore.getState();
    if (!gameState || gameState.phase === 'ended') {
        clearSavedRun();
        return;
    }
    // Full log first (the chronicle is the run's whole point), through the
    // versioned envelope, falling back through shorter tails only on a
    // genuine quota refusal — `tryWriteStored` reports the difference between
    // "won't fit" (retry smaller) and "storage unavailable" (stop).
    const savedAt = new Date().toISOString();
    const attempt = (log: GameState['log']) => tryWriteStored(SAVED_RUN_SPEC, {
        gameState: log === gameState.log ? gameState : { ...gameState, log },
        bets, betsResolved, hofSaved, isReplayedRun, savedAt,
    } as SavedRun);

    const first = attempt(gameState.log);
    if (first !== 'quota') return;

    for (const cap of LOG_TAIL_FALLBACKS) {
        if (gameState.log.length <= cap) continue;
        if (attempt(gameState.log.slice(-cap)) !== 'quota') return;
    }
    // Even the shortest tail won't fit — leave whatever save already exists
    // rather than clobbering it with a failed write.
}

/**
 * Autosaving on every phase advance was a synchronous main-thread write every
 * 60 ms at the fastest speed setting. A trailing debounce loses at most a
 * couple of seconds of progress on a crash, which a phase-based sim shrugs off.
 */
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistRun() {
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
        persistTimer = null;
        writeSave();
    }, 2000);
}

function clearSavedRun() {
    // A debounced write pending from before the clear must not fire after it
    // and resurrect the save.
    if (persistTimer !== null) {
        clearTimeout(persistTimer);
        persistTimer = null;
    }
    // localStorage access itself throws in Safari Private Browsing and
    // sandboxed iframes; removeStored absorbs that. This is called from
    // startGame, so an unguarded throw here blocked starting the game.
    removeStored(SAVED_RUN_SPEC);
}

function saveHallOfFame(state: GameState) {
    const survivors = state.tributes.filter(t => t.status === 'alive');
    const winner = survivors[0];
    // §7.1: a dual victory is archived under both names.
    const jointName = survivors.length === 2 ? `${survivors[0].name} & ${survivors[1].name}` : undefined;
    // A Games nobody survived used to return here, so the run vanished from the
    // archive entirely — the rarest outcome in the game was also the only one
    // with no record of it. A wipeout is archived as its own kind of entry.
    const entry: HallOfFameEntry = {
        id: `${state.seed}-${Date.now().toString(36)}`,
        seed: state.seed,
        arenaName: state.arena.name,
        arenaId: state.arena.id,
        quellId: state.gamesProfile?.quell?.id ?? null,
        config: state.baseConfig,
        noVictor: !winner,
        winnerName: jointName ?? winner?.name ?? 'No victor',
        winnerDistrict: winner?.district ?? 0,
        kills: winner?.kills ?? 0,
        date: new Date().toISOString(),
        winnerTraits: winner?.traits ?? [],
        winnerEndHealth: winner?.health ?? 0,
        tributeSummaries: state.tributes.map(t => ({
            name: t.name,
            district: t.district,
            kills: t.kills,
            status: t.status,
            causeOfDeath: t.causeOfDeath,
            dayOfDeath: t.dayOfDeath
        }))
    };
    // Keep the archive bounded — storage quota is not infinite. writeHallOfFame
    // applies the cap and swallows a full/unavailable store.
    writeHallOfFame([entry, ...readHallOfFame()].slice(0, HOF_CAP));
}

export const gameStore = createStore<GameStoreState>({
    gameState: null,
    simulator: null,
    view: 'setup',
    coins: readCoins(),
    bets: {},
    betWonMessage: null,
    isReplayedRun: false,
    betsResolved: false,
    hofSaved: false,
    panem: readPanem(),
    lastRunOutcome: null,
    runProgress: null,
});

/** Deep clone so React sees new object identities all the way down the tree. */
const snapshot = snapshotState;

function commitVictory(state: GameState) {
    const { hofSaved } = gameStore.getState();
    if (hofSaved) return;
    saveHallOfFame(state);
    // REPLAY-03/04: the record book and the discovery layer both fold in a
    // finished run here, behind the same double-commit guard the archive uses.
    const outcome = commitRun(state);
    gameStore.setState({
        hofSaved: true,
        panem: outcome.records,
        lastRunOutcome: outcome,
    });
}

function resolveBets(state: GameState) {
    const { bets, coins, betsResolved } = gameStore.getState();
    if (betsResolved) return;
    if (Object.keys(bets).length === 0) {
        gameStore.setState({ betsResolved: true });
        // A player who went broke sponsoring parachutes rather than wagering
        // still needs the stipend — the early return used to skip it, which
        // recreated the exact permanently-broke state it was written to fix.
        const balance = gameStore.getState().coins;
        if (balance < BROKE_THRESHOLD) {
            gameActions.setCoins(balance + STIPEND);
            gameStore.setState({
                betWonMessage: `The Capitol extends a ${STIPEND}-coin stipend so you can play the next Games.`,
            });
        }
        return;
    }

    // §7.1: a dual victory pays a wager on either victor — the book paid out
    // on "comes home", and both of them did.
    const winners = state.tributes.filter(t => t.status === 'alive' && bets[t.id]);
    if (winners.length > 0) {
        const payouts = winners.map(w => ({ w, winnings: Math.floor(bets[w.id].stake * bets[w.id].mult) }));
        const total = payouts.reduce((sum, p) => sum + p.winnings, 0);
        gameActions.setCoins(coins + total);
        gameStore.setState({
            betWonMessage: payouts
                .map(({ w, winnings }) => `${w.name} of District ${w.district} came home. Your ${bets[w.id].stake}-coin wager pays out ${winnings} Capitol Coins at ${bets[w.id].mult.toFixed(1)}x.`)
                .join(' '),
            betsResolved: true,
        });
    } else {
        const staked = Object.values(bets).reduce((a, b) => a + b.stake, 0);
        gameStore.setState({
            betWonMessage: `None of your ${staked} coins came back. The Capitol thanks you for your contribution.`,
            betsResolved: true,
        });
    }

    // A broke player could never wager again, which quietly removed a whole
    // feature from the game. The Capitol grants a stipend instead.
    const balance = gameStore.getState().coins;
    if (balance < BROKE_THRESHOLD) {
        gameActions.setCoins(balance + STIPEND);
        gameStore.setState(s => ({
            betWonMessage: `${s.betWonMessage} The Capitol extends a ${STIPEND}-coin stipend so you can play the next Games.`,
        }));
    }
}

/**
 * Run-to-End fast-forward, chunked.
 *
 * `RUN_BATCH_SIZE` turns run back-to-back, then the loop hands the thread back
 * so React can paint the progress readout and the Cancel button stays live.
 * 20 is small enough that the longest single batch is a few milliseconds and
 * large enough that the yields don't dominate the run.
 */
const RUN_BATCH_SIZE = 20;

interface ActiveRun {
    cancelled: boolean;
    simulator: Simulator;
}

/** At most one fast-forward may be in flight; this is the token for it. */
let activeRun: ActiveRun | null = null;

/**
 * Yields to the event loop. `setTimeout(0)` (rather than a microtask) is
 * deliberate: a microtask would drain before paint and reproduce the freeze.
 */
function yieldToBrowser(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Stops any in-flight fast-forward. Also called whenever a run is replaced or
 * abandoned, so navigating away can't leave a zombie loop stepping a simulator
 * nothing is looking at any more.
 */
function cancelRunToEnd() {
    if (!activeRun) return;
    activeRun.cancelled = true;
    // Released immediately so the player can start another run at once; the
    // abandoned loop's `finally` sees the token has moved on and stands down.
    activeRun = null;
    gameStore.setState({ runProgress: null });
}

export const gameActions = {
    setView(view: ViewName) {
        // Leaving the game view abandons any fast-forward in progress.
        if (view !== 'game') cancelRunToEnd();
        gameStore.setState({ view });
    },

    setBets(bets: Record<string, Bet> | ((prev: Record<string, Bet>) => Record<string, Bet>)) {
        gameStore.setState(s => ({ bets: typeof bets === 'function' ? bets(s.bets) : bets }));
    },

    setCoins(coins: number | ((prev: number) => number)) {
        gameStore.setState(s => {
            const next = typeof coins === 'function' ? coins(s.coins) : coins;
            const safe = Math.max(0, Math.floor(next));
            // Swallows a full/unavailable store — the balance just won't persist.
            writeCoins(safe);
            return { coins: safe };
        });
    },

    /** Hands back any coins staked on a run that never resolved. */
    refundOpenBets() {
        const { bets, betsResolved, coins } = gameStore.getState();
        const staked = Object.values(bets).reduce((a, b) => a + b.stake, 0);
        if (betsResolved || staked === 0) return;
        gameActions.setCoins(coins + staked);
        gameStore.setState({ bets: {} });
    },

    /**
     * SIDE-07: relaunch an archived victory.
     *
     * The Hall of Fame could copy a seed to the clipboard and nothing else —
     * the player then had to walk back to setup and paste it, and guess which
     * arena and which settings had produced it. An entry now carries both, so
     * "run it again" is a button.
     */
    replayHallOfFameEntry(entry: HallOfFameEntry): Promise<void> {
        const arenaId = entry.arenaId
            ?? ARENAS.find(a => a.name === entry.arenaName)?.id
            ?? 'procedural';
        return gameActions.startGame(entry.seed, arenaId, false, entry.config ?? DEFAULT_GAME_CONFIG, true, false, entry.quellId);
    },

    async resumeSavedRun() {
        const saved = readSavedRun();
        if (!saved) return;
        cancelRunToEnd();
        // Resuming is a cold-load entry into the simulation, so it has to cross
        // the lazy engine boundary too.
        const { Simulator } = await loadEngine();
        const { gameState } = saved;
        // Saves written before baseConfig existed: the executed config is the
        // best remaining approximation of what the player chose.
        if (!gameState.baseConfig) gameState.baseConfig = gameState.config;
        gameStore.setState({
            gameState,
            simulator: new Simulator(gameState),
            view: gameState.phase === 'reaping' || gameState.phase === 'setup' ? 'roster' : 'game',
            bets: saved.bets,
            betWonMessage: null,
            betsResolved: saved.betsResolved,
            hofSaved: saved.hofSaved,
            isReplayedRun: saved.isReplayedRun,
        });
    },

    discardSavedRun() {
        clearSavedRun();
    },

    /** §6.2: spend coins to become the standing patron of one district. */
    patronDistrict(district: number): boolean {
        const { coins } = gameStore.getState();
        if (coins < PATRON_COST) return false;
        gameActions.setCoins(coins - PATRON_COST);
        gameStore.setState({ panem: setPatronDistrict(district) });
        return true;
    },

    patronCost: PATRON_COST,

    /** Wipes achievements, records, and career totals — the "Your Panem" book — back to a blank slate. */
    resetPanem() {
        clearPanem();
        gameStore.setState({ panem: readPanem() });
    },

    async startGame(seed: string, arenaId: string, gamemakerMode: boolean, config: GameConfig = DEFAULT_GAME_CONFIG, markReplayed = false, forceQuell = false, pinnedQuellId?: string | null) {
        // Abandoning a run mid-wager used to silently pocket the player's coins.
        gameActions.refundOpenBets();
        cancelRunToEnd();
        clearSavedRun();

        const { Simulator, generateArena, generateTributes, gamesProfileFor, configForProfile } = await loadEngine();

        const safeSeed = seed.trim() || Math.random().toString(36).substring(2, 8).toUpperCase();

        // REPLAY-01/REPLAY-11: this year's Games — including whether it's a
        // Quarter Quell — are rolled from the seed before the arena and cast
        // are resolved, because a Quell can shape both of them.
        // A Hall of Fame replay pins the archived run's exact Quell (or
        // explicit lack of one) rather than re-drawing from the seed — see
        // HallOfFameEntry.quellId. `undefined` (no replay, or an entry that
        // predates Quells) falls through to the ordinary seeded draw.
        const pinnedQuell = pinnedQuellId === undefined ? undefined : (pinnedQuellId === null ? null : QUELLS.find(q => q.id === pinnedQuellId) ?? null);
        const gamesProfile = gamesProfileFor(safeSeed, forceQuell, pinnedQuell);
        // 'random-hidden': a real arena, still resolved deterministically from
        // the seed (a shared seed reproduces the same Games) — the pick just
        // isn't the player's to make, and its identity stays out of the UI
        // until the bloodbath reveals it (see arenaHidden below and
        // ui/disclosure.ts's canSeeArena).
        const arenaHidden = arenaId === 'random-hidden';
        const resolvedArenaId = arenaHidden
            ? new RNG(`${safeSeed}-random-arena`).pick([...ARENAS.map(a => a.id), 'procedural'])
            : arenaId;
        const baseArena = resolvedArenaId.startsWith('procedural')
            ? generateArena(safeSeed)
            : (ARENAS.find(a => a.id === resolvedArenaId) || ARENAS[0]);
        // Never mutate the shared ARENAS/generated-arena objects: a per-zone
        // shallow clone gives this run its own zone objects (arenaLawOverride
        // below, and the Moving Arena Quell later, both write to them).
        const arena = { ...baseArena, zones: baseArena.zones.map(z => ({ ...z })) };
        if (gamesProfile.quell?.arenaLawOverride) {
            arena.law = gamesProfile.quell.arenaLawOverride;
            // 'sponsorsFixedZone' and 'noWaterExceptZone' both compare a
            // tribute's zone against `arena.lawZone` — on the handful of
            // arenas that define one of these laws natively that's already
            // set, but a Quell forces the law onto whichever arena the
            // player (or the hidden-arena roll) picked, most of which carry
            // no `lawZone` at all. Left undefined, `t.zone === lawZone` is
            // never true for any real zone: sponsor gifts would land nowhere
            // for the entire run, or every zone would come up dry, for a
            // Quell whose entire point was to concentrate the drama on one
            // sector of the map. Defaulting to the Cornucopia keeps the
            // mechanic meaningful regardless of which arena it lands on.
            if (
                (gamesProfile.quell.arenaLawOverride === 'sponsorsFixedZone' || gamesProfile.quell.arenaLawOverride === 'noWaterExceptZone')
                && !arena.lawZone
            ) {
                arena.lawZone = arena.zones[0]?.name;
            }
        }
        const startZone = arena.zones[0].name;

        const tributes = generateTributes(safeSeed, config, startZone, gamesProfile.castShape, gamesProfile.quell);

        // §6.2: standing district patronage — a persistent sink for Capitol
        // Coins. The patron's tributes arrive with sponsors already warm.
        const patron = gameStore.getState().panem.patronDistrict;
        if (patron !== undefined) {
            tributes.forEach(t => {
                if (t.district === patron) {
                    t.sponsorTrust = Math.min(100, t.sponsorTrust + PATRON_TRUST_BONUS);
                }
            });
        }

        const initialState: GameState = {
            seed: safeSeed,
            arena,
            tributes,
            phase: 'reaping',
            day: 0,
            log: [],
            gamemakerMode,
            arenaHidden,
            config: configForProfile(config, gamesProfile),
            baseConfig: config,
            gamesProfile,
            logCounter: 0,
            feastsHeld: 0,
        };

        gameStore.setState({
            gameState: initialState,
            simulator: new Simulator(initialState),
            view: 'roster',
            bets: {},
            betWonMessage: null,
            betsResolved: false,
            hofSaved: false,
            isReplayedRun: markReplayed,
            lastRunOutcome: null,
        });
        persistRun();
    },

    rerollCast() {
        const { gameState } = gameStore.getState();
        if (!gameState || gameState.phase !== 'reaping' || !engine) return;
        const { Simulator, generateTributes, gamesProfileFor, configForProfile } = engine;

        const baseSeed = gameState.seed.split('~')[0];
        const newSeed = `${baseSeed}~${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        // A rerolled cast is a rerolled Games: the sub-seed decides both, and
        // the executed config is re-derived from the player's base config so
        // the old profile's multipliers don't leak into the new year. The
        // Quell is pinned to whatever it already was, though — the arena is
        // already locked in (law and all), so a reroll can't silently swap
        // the run's Quell out from under it.
        const gamesProfile = gamesProfileFor(newSeed, false, gameState.gamesProfile?.quell ?? null);
        const config = configForProfile(gameState.baseConfig, gamesProfile);
        const tributes = generateTributes(newSeed, config, gameState.arena.zones[0].name, gamesProfile.castShape, gamesProfile.quell);
        const newState: GameState = {
            ...gameState, seed: newSeed, tributes, log: [], logCounter: 0, gamesProfile, config,
        };

        gameStore.setState({ gameState: newState, simulator: new Simulator(newState) });
        persistRun();
    },

    confirmReaping() {
        const { gameState } = gameStore.getState();
        if (!gameState || gameState.phase !== 'reaping' || !engine) return;

        const newState: GameState = { ...gameState, phase: 'setup' };
        gameStore.setState({ gameState: newState, simulator: new engine.Simulator(newState) });
        persistRun();
    },

    syncFromSimulator() {
        const { simulator } = gameStore.getState();
        if (!simulator) return;
        gameStore.setState({ gameState: snapshot(simulator.getState()) });
        persistRun();
    },

    nextPhase() {
        const { simulator } = gameStore.getState();
        if (!simulator) return;

        const state = simulator.getState();
        if (state.phase === 'setup') {
            simulator.processTraining();
        } else if (state.phase === 'training') {
            simulator.processInterviews();
        } else if (state.phase === 'interviews') {
            simulator.startGames();
        } else if (state.phase === 'bloodbath') {
            simulator.processBloodbath();
        } else if (state.phase === 'epilogue') {
            state.phase = 'ended';
            resolveBets(state);
            commitVictory(state);
        } else if (state.phase === 'ended') {
            return;
        } else {
            simulator.processTurn();
        }

        gameActions.syncFromSimulator();
    },

    /**
     * Fast-forwards the whole run, yielding to the browser between batches.
     *
     * This used to be one synchronous `while` loop, which froze the tab for the
     * length of the run with no progress and no way out. The step sequence is
     * byte-for-byte the same — only the awaits between batches are new, and
     * nothing in the yield touches the simulator or the RNG — so the same seed
     * still produces exactly the same Games.
     */
    async runToEnd() {
        const { simulator } = gameStore.getState();
        // Re-entrancy guard: a second click (or a click on a run already being
        // cancelled) must not start a second loop over the same simulator.
        if (!simulator || activeRun) return;

        const run: ActiveRun = { cancelled: false, simulator };
        activeRun = run;

        /** Aborts if cancelled, or if the run underneath us was swapped out. */
        const stale = () => run.cancelled || gameStore.getState().simulator !== simulator;

        const publishProgress = (state: GameState, turns: number) => {
            const bets = gameStore.getState().bets;
            gameStore.setState({
                runProgress: {
                    day: state.day,
                    phase: state.phase,
                    turns,
                    logLines: state.log.length,
                    tributesAlive: state.tributes.filter(t => t.status === 'alive').length,
                    wagered: state.tributes
                        .filter(t => bets[t.id])
                        .map(t => ({ name: t.name, district: t.district, alive: t.status === 'alive' })),
                },
            });
        };

        try {
            let state = simulator.getState();
            let turns = 0;
            publishProgress(state, turns);
            await yieldToBrowser();
            if (stale()) return;

            // Ceiling well above any realistic run; the phase guards below are
            // what actually terminate the loop.
            let guard = 2000;
            while (state.phase !== 'ended' && guard-- > 0) {
                // Checked before every step, not just at batch boundaries, so a
                // cancelled loop cannot land another turn after the player has
                // already started a new one.
                if (stale()) return;
                if (state.phase === 'setup') {
                    simulator.processTraining();
                } else if (state.phase === 'training') {
                    simulator.processInterviews();
                } else if (state.phase === 'interviews') {
                    simulator.startGames();
                } else if (state.phase === 'bloodbath') {
                    simulator.processBloodbath();
                } else if (state.phase === 'epilogue') {
                    state.phase = 'ended';
                } else if (!simulator.processTurn()) {
                    break;
                }
                state = simulator.getState();
                turns++;

                if (turns % RUN_BATCH_SIZE === 0) {
                    publishProgress(state, turns);
                    await yieldToBrowser();
                    if (stale()) return;
                }
            }

            if (state.phase === 'ended') {
                resolveBets(state);
                commitVictory(state);
            }
        } finally {
            // `cancelRunToEnd` may already have released the token to let a new
            // run start; only the loop that still owns it clears the readout.
            if (activeRun === run) {
                activeRun = null;
                gameStore.setState({ runProgress: null });
            }
            // Whether it finished or was cancelled, show the player where the
            // simulation actually got to — unless the run was replaced, in
            // which case the new one owns the state.
            if (gameStore.getState().simulator === simulator) gameActions.syncFromSimulator();
        }
    },

    /** Stops an in-flight `runToEnd()` at the next batch boundary. */
    cancelRunToEnd,

    isRunningToEnd: () => activeRun !== null,

    /**
     * SIDE-03: the player spends Capitol Coins on a parachute.
     *
     * The wallet used to be a one-way bet placed before the gong. This is the
     * other half of the economy — the audience doing the one thing the audience
     * can actually do — and it is the only way the player touches the arena
     * without Gamemaker mode.
     */
    sponsorTribute(tributeId: string, itemId: string): SponsorResult {
        const { simulator, coins } = gameStore.getState();
        if (!simulator || !engine) return { ok: false, cost: 0, message: 'No Games are running.' };
        const { sponsorableItems, sponsorCost, sendPlayerParachute } = engine;

        const state = simulator.getState();
        const tribute = state.tributes.find(t => t.id === tributeId);
        const item = sponsorableItems().find(i => i.id === itemId);
        if (!tribute || !item) return { ok: false, cost: 0, message: 'That parachute cannot be sent.' };

        const cost = sponsorCost(state, tribute, item);
        if (coins < cost) {
            return { ok: false, cost, message: `That parachute costs ${cost} coins. You have ${coins}.` };
        }

        const result = sendPlayerParachute(state, tributeId, itemId);
        if (!result.ok) return result;

        gameActions.setCoins(coins - result.cost);
        gameActions.syncFromSimulator();
        return result;
    },

    triggerGamemakerEvent(type: GamemakerEventType, targetId?: string) {
        const { simulator } = gameStore.getState();
        if (!simulator) return;
        simulator.triggerGamemakerEvent(type, targetId);
        gameActions.syncFromSimulator();
    },
};

export { readHallOfFame, readSavedRun };
