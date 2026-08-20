import { Tribute } from '../models/types';
import { traitMod } from '../data/traits';

/**
 * Excitement, through one door.
 *
 * `excitementRating` was written to from fourteen places with a bare `+=`,
 * which meant no trait could ever change how a tribute plays to the cameras —
 * and excitement is now the metric the Gamemakers escalate on, so "who the
 * audience finds interesting" is a real lever rather than a sponsor input.
 * Showman amplifies everything they do; Unremarkable is a tribute nobody is
 * watching.
 */
export function addExcitement(t: Tribute, amount: number) {
    if (amount === 0) return;
    const scale = Math.max(0.1, 1 + traitMod(t, 'excitement'));
    // Only gains are amplified: a trait that makes you compelling should not
    // also make a penalty hurt more.
    t.excitementRating += amount > 0 ? amount * scale : amount;
}
