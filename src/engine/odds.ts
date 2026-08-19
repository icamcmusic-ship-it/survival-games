import { Tribute } from '../models/types';

/**
 * Single source of truth for betting odds. The roster screen, the payout and
 * the end screen previously each carried their own copy of this maths, so a
 * tweak in one place silently disagreed with the others.
 */
export function oddsScore(t: Tribute): number {
    const training = t.trainingScore || 5;
    let score = 40 + t.attributes.strength * 2 + t.attributes.agility * 2 + training * 4;
    if (t.traits.includes('Brute')) score += 15;
    if (t.traits.includes('Bloodthirsty')) score += 15;
    if (t.traits.includes('Pacifist')) score -= 10;
    if (t.traits.includes('Strategist')) score += 12;
    return Math.max(10, score);
}

export interface TributeOdds {
    /** Rounded survival chance as a percentage. */
    pct: number;
    /** Payout multiplier applied to a winning wager. */
    mult: number;
}

export function tributeOdds(t: Tribute, field: Tribute[]): TributeOdds {
    const total = field.reduce((sum, other) => sum + oddsScore(other), 0);
    const pct = total > 0 ? Math.max(1, Math.round((oddsScore(t) / total) * 100)) : 4;
    const mult = Math.max(1.1, Math.min(25.0, 100 / pct));
    return { pct, mult };
}
