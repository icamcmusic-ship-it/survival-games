import { Tribute } from '../models/types';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Keeps every numeric tribute stat inside its documented range.
 *
 * Vitals used to drift far outside 0-100 (fatigue could sit at -180 after a
 * few quiet nights, sanity at -400), which broke both the UI bars and the
 * sanity-breakdown threshold. Health is floored at 0 so a corpse never shows
 * a negative percentage.
 */
export function clampTribute(t: Tribute): Tribute {
    t.health = clamp(Math.round(t.health), 0, 100);
    t.vitals.hunger = clamp(Math.round(t.vitals.hunger), 0, 100);
    t.vitals.thirst = clamp(Math.round(t.vitals.thirst), 0, 100);
    t.vitals.fatigue = clamp(Math.round(t.vitals.fatigue), 0, 100);
    t.vitals.sanity = clamp(Math.round(t.vitals.sanity), 0, 100);
    t.sponsorTrust = clamp(Math.round(t.sponsorTrust), 0, 100);
    t.excitementRating = Math.max(0, Math.round(t.excitementRating));
    return t;
}
