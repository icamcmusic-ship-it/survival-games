import { GameState } from '../../models/types';
import { SeasonRunState } from '../../models/seasonTypes';
import { SimContext } from '../context';
import { RNG } from '../../utils/rng';
import { cycleOf } from '../memory';

/**
 * AUDIT-12 wave 3: the in-run bookkeeping for the side features, and the one
 * rule every one of them follows — **they draw from their own seeded stream**.
 *
 * A side feature that pulled from `ctx.rng` would shift every later draw of
 * the phase, so turning a director's taste or a mutator on would re-roll the
 * whole Games rather than change the one thing it is about. `withSideRng`
 * swaps a stream salted by (seed, feature, cycle) in for the duration of the
 * call and restores the phase's own stream afterwards, so the main streams are
 * untouched and a replay stays exact.
 */
export function seasonOf(state: GameState): SeasonRunState {
    return state.season ?? (state.season = {});
}

export function sideRng(state: GameState, salt: string): RNG {
    return new RNG(`${state.seed}-w3-${salt}-${cycleOf(state)}`);
}

export function withSideRng<T>(ctx: SimContext, salt: string, fn: (rng: RNG) => T): T {
    const previous = ctx.rng;
    const rng = sideRng(ctx.state, salt);
    ctx.rng = rng;
    try {
        return fn(rng);
    } finally {
        ctx.rng = previous;
    }
}

/** Once-per-run guard, keyed on the season state. */
export function firstTime(state: GameState, key: string): boolean {
    const s = seasonOf(state);
    const fired = s.directorFired ?? (s.directorFired = []);
    if (fired.includes(key)) return false;
    fired.push(key);
    return true;
}

export function pairKey(a: number, b: number): `${number}-${number}` {
    return a <= b ? `${a}-${b}` : `${b}-${a}`;
}
