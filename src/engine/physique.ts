import { Build, Tribute } from '../models/types';
import { PHYSIQUE, GENERATION } from '../data/balance';

/**
 * Bodies.
 *
 * `heightCm` and `build` were generated with real care — scaled by age and
 * gender, derived from strength — and then read by nothing but display code.
 * Age already mattered in a fight; height and build did not. Reach decides who
 * lands first in a melee, mass decides who gets moved, who shrugs off the cold,
 * and how much they can carry out of the Cornucopia.
 */

/** How much of a tribute there is, as a signed rating around an average build. */
export function massOf(t: Tribute): number {
    return PHYSIQUE.massByBuild[t.build as Build] ?? 0;
}

/** Melee power from reach. A long-armed tribute lands first. */
export function reachBonus(t: Tribute): number {
    const advantage = (t.heightCm - PHYSIQUE.neutralHeightCm) * PHYSIQUE.reachPerCm;
    return Math.max(-PHYSIQUE.maxReachBonus, Math.min(PHYSIQUE.maxReachBonus, advantage));
}

/**
 * Formats a height for display. The underlying field is centimetres; the
 * player's unit preference (survivalGamesPrefs) decides how it reads.
 */
export function heightLabel(heightCm: number, units: 'imperial' | 'metric' = 'imperial'): string {
    if (units === 'metric') return `${Math.round(heightCm)} cm`;
    const totalInches = Math.round(heightCm / 2.54);
    return `${Math.floor(totalInches / 12)}'${totalInches % 12}"`;
}

/** The most raw strength a tribute of this age can possibly have. */
export function strengthCapForAge(age: number): number {
    return Math.min(10, GENERATION.strengthCapAtMinAge + (age - GENERATION.minAge) * GENERATION.strengthCapPerYear);
}
