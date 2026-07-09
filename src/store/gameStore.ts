import { GameState, HallOfFameEntry } from '../models/types';
import { ARENAS } from '../data/constants';
import { generateTributes } from '../engine/generator';
import { Simulator } from '../engine/simulator';
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
}

function computeOddsScore(t: GameState['tributes'][number]) {
    const strength = t.attributes.strength;
    const agility = t.attributes.agility;
    const training = t.trainingScore || 5;
    let score = 100 * 0.4 + strength * 2 + agility * 2 + training * 4;
    if (t.traits.includes('Brute')) score += 15;
    if (t.traits.includes('Bloodthirsty')) score += 15;
    if (t.traits.includes('Pacifist')) score -= 10;
    if (t.traits.includes('Strategist')) score += 12;
    return Math.max(10, score);
}

function saveHallOfFame(state: GameState) {
    const winner = state.tributes.find(t => t.status === 'alive');
    if (!winner) return;
    const entry: HallOfFameEntry = {
        id: Math.random().toString(36).substring(2, 9),
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
    let existing = [];
    try {
        existing = JSON.parse(localStorage.getItem('hungerGamesHoF') || '[]');
        if (!Array.isArray(existing)) existing = [];
    } catch (e) {
        existing = [];
    }
    localStorage.setItem('hungerGamesHoF', JSON.stringify([entry, ...existing]));
}

export const gameStore = createStore<GameStoreState>({
    gameState: null,
    simulator: null,
    view: 'setup',
    coins: Number(localStorage.getItem('capitolCoins') || '1000'),
    bets: {},
    betWonMessage: null,
    isReplayedRun: false,
});

export const gameActions = {
    setView(view: ViewName) {
        gameStore.setState({ view });
    },

    setBets(bets: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) {
        gameStore.setState(s => ({ bets: typeof bets === 'function' ? bets(s.bets) : bets }));
    },

    setCoins(coins: number) {
        localStorage.setItem('capitolCoins', coins.toString());
        gameStore.setState({ coins });
    },

    startGame(seed: string, arenaId: string, gamemakerMode: boolean, markReplayed = false) {
        const arena = ARENAS.find(a => a.id === arenaId) || ARENAS[0];
        const tributes = generateTributes(seed);

        const initialState: GameState = {
            seed,
            arena,
            tributes,
            phase: 'setup',
            day: 0,
            log: [],
            gamemakerMode
        };

        gameStore.setState({
            gameState: initialState,
            simulator: new Simulator(initialState),
            view: 'roster',
            bets: {},
            betWonMessage: null,
            isReplayedRun: markReplayed || gameStore.getState().isReplayedRun,
        });
    },

    syncFromSimulator() {
        const { simulator } = gameStore.getState();
        if (!simulator) return;
        gameStore.setState({ gameState: JSON.parse(JSON.stringify(simulator.getState())) });
    },

    nextPhase() {
        const { simulator, bets, coins } = gameStore.getState();
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

            const winner = state.tributes.find(t => t.status === 'alive');
            if (winner && bets[winner.id]) {
                const totalOriginalScore = state.tributes.reduce((sum, tr) => sum + computeOddsScore(tr), 0);
                const winScore = computeOddsScore(winner);

                const rawOdds = winScore / totalOriginalScore;
                const oddsPercentage = Math.round(rawOdds * 100) || 4;
                const multiplier = Math.max(1.1, Math.min(25.0, 100 / oddsPercentage));

                const betAmount = bets[winner.id];
                const winnings = Math.floor(betAmount * multiplier);
                const newCoinBalance = coins + winnings;
                gameActions.setCoins(newCoinBalance);
                gameStore.setState({ betWonMessage: `Your backed tribute ${winner.name} won! You won ${winnings} Capitol Coins! (Wager: ${betAmount} @ ${multiplier.toFixed(1)}x)` });
            } else if (Object.keys(bets).length > 0) {
                gameStore.setState({ betWonMessage: "Your wagered tributes did not survive. The Capitol takes your coins." });
            }

            saveHallOfFame(state);
        } else if (state.phase === 'ended') {
            return;
        } else {
            simulator.processTurn();

            const newState = simulator.getState();
            if (newState.phase === 'ended') {
                saveHallOfFame(newState);
            }
        }

        gameActions.syncFromSimulator();
    },
};
