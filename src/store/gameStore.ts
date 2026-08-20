import { GameState, GameConfig, HallOfFameEntry } from '../models/types';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../data/constants';
import { generateTributes } from '../engine/generator';
import { generateArena } from '../engine/arenaGenerator';
import { Simulator } from '../engine/simulator';
import { createStore } from './createStore';
import { configForProfile, gamesProfileFor } from '../engine/gamesProfile';
import { PanemRecords, RunOutcome, commitRun, readPanem } from '../utils/panemStorage';
import {
    SponsorResult, sendPlayerParachute, sponsorCost, sponsorableItems,
} from '../engine/playerSponsor';

export type ViewName = 'setup' | 'roster' | 'game' | 'hallOfFame';

export interface Bet {
    stake: number;
    /** Payout multiplier at the moment the wager was placed — the odds you saw are the odds you took. */
    mult: number;
}

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
}

const STARTING_COINS = 1000;
const BROKE_THRESHOLD = 50;
const STIPEND = 250;

function readCoins(): number {
    // Note the explicit null check: `Number(null)` is 0, which would silently
    // hand a brand-new player an empty wallet instead of their starting stake.
    try {
        const stored = localStorage.getItem('capitolCoins');
        if (stored === null) return STARTING_COINS;
        const raw = Number(stored);
        return Number.isFinite(raw) && raw >= 0 ? raw : STARTING_COINS;
    } catch {
        // Safari private mode (and similar) throws on localStorage access
        // before React ever mounts.
        return STARTING_COINS;
    }
}

const SAVE_KEY = 'survivalGamesSave';

export interface SavedRun {
    gameState: GameState;
    bets: Record<string, Bet>;
    betsResolved: boolean;
    hofSaved: boolean;
    isReplayedRun: boolean;
    savedAt: string;
}

/** UX-01: an in-progress run is autosaved after every phase, so a refresh or a
 *  closed tab doesn't erase an 8-day chronicle. Finished runs aren't worth
 *  resuming, so they don't get saved. */
function readSavedRun(): SavedRun | null {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && parsed.gameState ? (parsed as SavedRun) : null;
    } catch {
        return null;
    }
}

function persistRun() {
    const { gameState, bets, betsResolved, hofSaved, isReplayedRun } = gameStore.getState();
    if (!gameState || gameState.phase === 'ended') {
        localStorage.removeItem(SAVE_KEY);
        return;
    }
    try {
        const saved: SavedRun = { gameState, bets, betsResolved, hofSaved, isReplayedRun, savedAt: new Date().toISOString() };
        localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    } catch {
        // Storage full or unavailable — the run just won't be resumable.
    }
}

function clearSavedRun() {
    localStorage.removeItem(SAVE_KEY);
}

function readHallOfFame(): HallOfFameEntry[] {
    try {
        const parsed = JSON.parse(localStorage.getItem('hungerGamesHoF') || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveHallOfFame(state: GameState) {
    const winner = state.tributes.find(t => t.status === 'alive');
    if (!winner) return;
    const entry: HallOfFameEntry = {
        id: `${state.seed}-${Date.now().toString(36)}`,
        seed: state.seed,
        arenaName: state.arena.name,
        arenaId: state.arena.id,
        config: state.baseConfig,
        winnerName: winner.name,
        winnerDistrict: winner.district,
        kills: winner.kills,
        date: new Date().toISOString(),
        winnerTraits: winner.traits,
        winnerEndHealth: winner.health,
        tributeSummaries: state.tributes.map(t => ({
            name: t.name,
            district: t.district,
            kills: t.kills,
            status: t.status,
            causeOfDeath: t.causeOfDeath,
            dayOfDeath: t.dayOfDeath
        }))
    };
    // Keep the archive bounded — localStorage quota is not infinite.
    try {
        localStorage.setItem('hungerGamesHoF', JSON.stringify([entry, ...readHallOfFame()].slice(0, 50)));
    } catch {
        // Storage full or unavailable — the victory just won't be archived.
    }
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
});

/** Deep clone so React sees new object identities all the way down the tree. */
function snapshot(state: GameState): GameState {
    return JSON.parse(JSON.stringify(state));
}

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
        return;
    }

    const winner = state.tributes.find(t => t.status === 'alive');
    if (winner && bets[winner.id]) {
        const { stake, mult } = bets[winner.id];
        const winnings = Math.floor(stake * mult);
        gameActions.setCoins(coins + winnings);
        gameStore.setState({
            betWonMessage: `${winner.name} of District ${winner.district} came home. Your ${stake}-coin wager pays out ${winnings} Capitol Coins at ${mult.toFixed(1)}x.`,
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

export const gameActions = {
    setView(view: ViewName) {
        gameStore.setState({ view });
    },

    setBets(bets: Record<string, Bet> | ((prev: Record<string, Bet>) => Record<string, Bet>)) {
        gameStore.setState(s => ({ bets: typeof bets === 'function' ? bets(s.bets) : bets }));
    },

    setCoins(coins: number | ((prev: number) => number)) {
        gameStore.setState(s => {
            const next = typeof coins === 'function' ? coins(s.coins) : coins;
            const safe = Math.max(0, Math.floor(next));
            try {
                localStorage.setItem('capitolCoins', safe.toString());
            } catch {
                // Storage full or unavailable — the balance just won't persist.
            }
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
    replayHallOfFameEntry(entry: HallOfFameEntry) {
        const arenaId = entry.arenaId
            ?? ARENAS.find(a => a.name === entry.arenaName)?.id
            ?? 'procedural';
        gameActions.startGame(entry.seed, arenaId, false, entry.config ?? DEFAULT_GAME_CONFIG, true);
    },

    resumeSavedRun() {
        const saved = readSavedRun();
        if (!saved) return;
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

    startGame(seed: string, arenaId: string, gamemakerMode: boolean, config: GameConfig = DEFAULT_GAME_CONFIG, markReplayed = false) {
        // Abandoning a run mid-wager used to silently pocket the player's coins.
        gameActions.refundOpenBets();
        clearSavedRun();

        const safeSeed = seed.trim() || Math.random().toString(36).substring(2, 8).toUpperCase();
        const arena = arenaId.startsWith('procedural')
            ? generateArena(safeSeed)
            : (ARENAS.find(a => a.id === arenaId) || ARENAS[0]);
        const startZone = arena.zones[0].name;
        const tributes = generateTributes(safeSeed, config, startZone);

        // REPLAY-01: this year's Games are rolled from the seed and the
        // player's config is multiplied through them, so a shared seed
        // reproduces the same Games rather than merely the same cast.
        const gamesProfile = gamesProfileFor(safeSeed);

        const initialState: GameState = {
            seed: safeSeed,
            arena,
            tributes,
            phase: 'reaping',
            day: 0,
            log: [],
            gamemakerMode,
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
        if (!gameState || gameState.phase !== 'reaping') return;

        const baseSeed = gameState.seed.split('~')[0];
        const newSeed = `${baseSeed}~${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        // A rerolled cast is a rerolled Games: the sub-seed decides both, and
        // the executed config is re-derived from the player's base config so
        // the old profile's multipliers don't leak into the new year.
        const gamesProfile = gamesProfileFor(newSeed);
        const config = configForProfile(gameState.baseConfig, gamesProfile);
        const tributes = generateTributes(newSeed, config, gameState.arena.zones[0].name);
        const newState: GameState = {
            ...gameState, seed: newSeed, tributes, log: [], logCounter: 0, gamesProfile, config,
        };

        gameStore.setState({ gameState: newState, simulator: new Simulator(newState) });
        persistRun();
    },

    confirmReaping() {
        const { gameState } = gameStore.getState();
        if (!gameState || gameState.phase !== 'reaping') return;

        const newState: GameState = { ...gameState, phase: 'setup' };
        gameStore.setState({ gameState: newState, simulator: new Simulator(newState) });
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

    /** Fast-forwards the whole run in one tick, with the same bookkeeping as manual play. */
    runToEnd() {
        const { simulator } = gameStore.getState();
        if (!simulator) return;

        let state = simulator.getState();
        // Ceiling well above any realistic run; the phase guards below are what
        // actually terminate the loop.
        let guard = 2000;
        while (state.phase !== 'ended' && guard-- > 0) {
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
        }

        if (state.phase === 'ended') {
            resolveBets(state);
            commitVictory(state);
        }
        gameActions.syncFromSimulator();
    },

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
        if (!simulator) return { ok: false, cost: 0, message: 'No Games are running.' };

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

    triggerGamemakerEvent(type: 'mutt' | 'weather' | 'feast', targetId?: string) {
        const { simulator } = gameStore.getState();
        if (!simulator) return;
        simulator.triggerGamemakerEvent(type, targetId);
        gameActions.syncFromSimulator();
    },
};

export { readHallOfFame, readSavedRun };
