import { GameState, GameConfig, HallOfFameEntry } from '../models/types';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../data/constants';
import { generateTributes } from '../engine/generator';
import { generateArena } from '../engine/arenaGenerator';
import { Simulator } from '../engine/simulator';
import { tributeOdds } from '../engine/odds';
import { createStore } from './createStore';

export type ViewName = 'setup' | 'roster' | 'game' | 'hallOfFame';

export interface GameStoreState {
    gameState: GameState | null;
    simulator: Simulator | null;
    view: ViewName;
    coins: number;
    bets: Record<string, number>;
    betWonMessage: string | null;
    isReplayedRun: boolean;
    /** Guards against paying out the same wager twice (e.g. Run to End then Proceed). */
    betsResolved: boolean;
    /** Guards against writing the same victory to the Hall of Fame twice. */
    hofSaved: boolean;
}

const STARTING_COINS = 1000;
const BROKE_THRESHOLD = 50;
const STIPEND = 250;

function readCoins(): number {
    // Note the explicit null check: `Number(null)` is 0, which would silently
    // hand a brand-new player an empty wallet instead of their starting stake.
    const stored = localStorage.getItem('capitolCoins');
    if (stored === null) return STARTING_COINS;
    const raw = Number(stored);
    return Number.isFinite(raw) && raw >= 0 ? raw : STARTING_COINS;
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
    localStorage.setItem('hungerGamesHoF', JSON.stringify([entry, ...readHallOfFame()].slice(0, 50)));
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
});

/** Deep clone so React sees new object identities all the way down the tree. */
function snapshot(state: GameState): GameState {
    return JSON.parse(JSON.stringify(state));
}

function commitVictory(state: GameState) {
    const { hofSaved } = gameStore.getState();
    if (hofSaved) return;
    saveHallOfFame(state);
    gameStore.setState({ hofSaved: true });
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
        const { mult } = tributeOdds(winner, state.tributes);
        const betAmount = bets[winner.id];
        const winnings = Math.floor(betAmount * mult);
        gameActions.setCoins(coins + winnings);
        gameStore.setState({
            betWonMessage: `${winner.name} of District ${winner.district} came home. Your ${betAmount}-coin wager pays out ${winnings} Capitol Coins at ${mult.toFixed(1)}x.`,
            betsResolved: true,
        });
    } else {
        const staked = Object.values(bets).reduce((a, b) => a + b, 0);
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

    setBets(bets: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) {
        gameStore.setState(s => ({ bets: typeof bets === 'function' ? bets(s.bets) : bets }));
    },

    setCoins(coins: number) {
        const safe = Math.max(0, Math.floor(coins));
        localStorage.setItem('capitolCoins', safe.toString());
        gameStore.setState({ coins: safe });
    },

    /** Hands back any coins staked on a run that never resolved. */
    refundOpenBets() {
        const { bets, betsResolved, coins } = gameStore.getState();
        const staked = Object.values(bets).reduce((a, b) => a + b, 0);
        if (betsResolved || staked === 0) return;
        gameActions.setCoins(coins + staked);
        gameStore.setState({ bets: {} });
    },

    startGame(seed: string, arenaId: string, gamemakerMode: boolean, config: GameConfig = DEFAULT_GAME_CONFIG, markReplayed = false) {
        // Abandoning a run mid-wager used to silently pocket the player's coins.
        gameActions.refundOpenBets();

        const safeSeed = seed.trim() || Math.random().toString(36).substring(2, 8).toUpperCase();
        const arena = arenaId.startsWith('procedural')
            ? generateArena(safeSeed)
            : (ARENAS.find(a => a.id === arenaId) || ARENAS[0]);
        const tributes = generateTributes(safeSeed, config);
        const startZone = arena.zones[0].name;
        tributes.forEach(t => { t.zone = startZone; });

        const initialState: GameState = {
            seed: safeSeed,
            arena,
            tributes,
            phase: 'reaping',
            day: 0,
            log: [],
            gamemakerMode,
            config,
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
        });
    },

    rerollCast() {
        const { gameState } = gameStore.getState();
        if (!gameState || gameState.phase !== 'reaping') return;

        const baseSeed = gameState.seed.split('~')[0];
        const newSeed = `${baseSeed}~${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const tributes = generateTributes(newSeed, gameState.config);
        tributes.forEach(t => { t.zone = gameState.arena.zones[0].name; });
        const newState: GameState = { ...gameState, seed: newSeed, tributes, log: [], logCounter: 0 };

        gameStore.setState({ gameState: newState, simulator: new Simulator(newState) });
    },

    confirmReaping() {
        const { gameState } = gameStore.getState();
        if (!gameState || gameState.phase !== 'reaping') return;

        const newState: GameState = { ...gameState, phase: 'setup' };
        gameStore.setState({ gameState: newState, simulator: new Simulator(newState) });
    },

    syncFromSimulator() {
        const { simulator } = gameStore.getState();
        if (!simulator) return;
        gameStore.setState({ gameState: snapshot(simulator.getState()) });
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

    triggerGamemakerEvent(type: 'mutt' | 'weather' | 'feast', targetId?: string) {
        const { simulator } = gameStore.getState();
        if (!simulator) return;
        simulator.triggerGamemakerEvent(type, targetId);
        gameActions.syncFromSimulator();
    },
};

export { readHallOfFame };
