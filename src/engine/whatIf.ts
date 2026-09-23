import { GameState } from '../models/types';
import { Simulator } from './simulator';
import { snapshotState } from '../utils/snapshot';
import { WHAT_IF } from '../data/balance';

/**
 * AUDIT-10 §11.8: the counterfactual debrief — "what if that day had gone
 * the other way?"
 *
 * Every phase entry point reseeds `ctx.rng` from (seed, phase, day), so a
 * checkpoint plus its seed replays the rest of the Games exactly — that is
 * the rewind foundation the audit points at, and `check-whatif` holds it to
 * that. A branch changes one thing: the seed for the *next phase only*. It
 * is salted for that one advance and restored straight after, so everything
 * before the checkpoint is the Games that happened, one phase of luck is
 * re-rolled, and every phase after it draws from the same streams it would
 * have — it is the world, not the dice, that is now different.
 *
 * Only arena phases branch. Before the gong the seed also names things (the
 * Career pack's alliance id is built from it), and re-rolling a training day
 * is not the question anybody is asking at the end of a Games.
 *
 * On demand, never automatic: a debrief is `WHAT_IF.branches` re-simulations
 * of the back half of a Games, and ordinary play should not pay for it.
 */

/** Phases a branch can start from. */
export const BRANCHABLE: ReadonlySet<GameState['phase']> = new Set(['day', 'night', 'feast']);

export interface WhatIfBranch {
    /** Who was left standing when this branch ended. Empty if nobody was. */
    victorIds: string[];
    /** The day the branch ended on. */
    endDay: number;
}

export interface WhatIfResult {
    fromPhase: GameState['phase'];
    fromDay: number;
    actualVictorIds: string[];
    branches: WhatIfBranch[];
    /** Branches whose victor set matches the Games that actually happened. */
    sameOutcome: number;
}

function victorsOf(state: GameState): string[] {
    return state.tributes.filter(t => t.status === 'alive').map(t => t.id).sort();
}

/**
 * Play one branch from a checkpoint to the end of the Games.
 *
 * `salt` undefined replays the checkpoint unchanged — the determinism control
 * the check uses to prove a branch differs only by the phase it re-rolled.
 */
export function playBranch(checkpoint: GameState, salt?: string): GameState {
    const start = snapshotState(checkpoint);
    const seed = start.seed;
    if (salt !== undefined) start.seed = `${seed}~whatif-${salt}`;
    const sim = new Simulator(start);
    sim.advance();
    // Restore on the simulator's own copy: the constructor cloned `start`.
    sim.getState().seed = seed;
    let guard = WHAT_IF.maxAdvances;
    while (guard-- > 0 && sim.advance()) { /* run to the epilogue */ }
    return sim.getState();
}

/** Fold finished branches into the debrief's verdict. */
export function summariseBranches(checkpoint: GameState, actual: GameState, ends: GameState[]): WhatIfResult {
    const actualVictorIds = victorsOf(actual);
    const key = actualVictorIds.join(',');
    const branches = ends.map(end => ({ victorIds: victorsOf(end), endDay: end.day }));
    return {
        fromPhase: checkpoint.phase,
        fromDay: checkpoint.day,
        actualVictorIds,
        branches,
        sameOutcome: branches.filter(b => b.victorIds.join(',') === key).length,
    };
}

/** Re-roll the phase after `checkpoint` `WHAT_IF.branches` times. */
export function whatIf(checkpoint: GameState, actual: GameState): WhatIfResult {
    if (!BRANCHABLE.has(checkpoint.phase)) {
        throw new Error(`what-if branches start from an arena phase, not '${checkpoint.phase}'`);
    }
    const ends: GameState[] = [];
    for (let k = 0; k < WHAT_IF.branches; k++) ends.push(playBranch(checkpoint, String(k)));
    return summariseBranches(checkpoint, actual, ends);
}
