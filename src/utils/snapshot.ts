import { GameState } from '../models/types';

/**
 * Deep clone of a full game state.
 *
 * structuredClone is 2-3x faster than the JSON round-trip on a ~290 KB state,
 * and it preserves Map/Set/Date should any ever enter the state. Both the
 * store's per-phase React snapshot and the simulator's constructor copy run
 * through here, so the two hot paths can never drift apart again.
 * (try/catch: unlike JSON, structuredClone throws on anything non-cloneable,
 * and the JSON fallback matches the old behaviour.)
 */
export function snapshotState(state: GameState): GameState {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(state);
        } catch {
            // fall through to the JSON round-trip
        }
    }
    return JSON.parse(JSON.stringify(state));
}
