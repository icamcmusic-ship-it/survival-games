import { GameState, PredictionResult } from '../../models/types';
import { AUDIT12_WAVE3 } from '../../data/balance';
import { mutatorDifficulty } from '../../data/mutators';

/**
 * AUDIT-12 wave 3 §11/§12: gauntlet mode.
 *
 * A gauntlet stacks up to four mutators and is scored into the Hall of Fame:
 * the stack's total difficulty, times how well the player read the Games it
 * produced (their prediction slip's share of its maximum), with a bonus for
 * calling the victor. A gauntlet run with no slip scores half — the stack was
 * survived, not read.
 */
const MU = AUDIT12_WAVE3.mutators;

export function stackDifficulty(mutators: readonly string[] | undefined): number {
    return (mutators ?? []).reduce((sum, id) => sum + mutatorDifficulty(id), 0);
}

export function gauntletScoreOf(state: GameState, slip: PredictionResult | undefined): number | undefined {
    if (!state.config.gauntlet && !state.baseConfig?.gauntlet) return undefined;
    const cards = state.config.mutators ?? state.baseConfig?.mutators ?? [];
    if (cards.length === 0) return undefined;
    const read = slip && slip.max > 0 ? 0.5 + slip.score / slip.max : 0.5;
    const called = slip?.hits.includes('winner') ? MU.gauntletCalledVictor : 1;
    return Math.round(stackDifficulty(cards) * MU.gauntletPointsPerDifficulty * read * called);
}
