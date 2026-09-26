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

/**
 * AUDIT-12 wave 3 §11/§13: excitement fades.
 *
 * `excitementRating` only ever went up, so a tribute who had one good day in
 * the bloodbath stayed the crowd's favourite for the rest of the Games. It
 * now decays toward zero each simulated turn — a share kept, so a tribute the
 * cameras keep finding stays hot and one who has gone quiet cools.
 */
export function decayExcitement(tributes: Tribute[], keep: number) {
    tributes.forEach(t => {
        if (t.status !== 'alive' || t.excitementRating <= 0) return;
        t.excitementRating = Math.round(t.excitementRating * keep * 100) / 100;
    });
}
