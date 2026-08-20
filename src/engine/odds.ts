import { Tribute } from '../models/types';
import { ODDS } from '../data/balance';
import { traitMod } from '../data/traits';

/**
 * Betting odds, live.
 *
 * The score used to be computed purely from base attributes, the training
 * score and a couple of traits — none of which change once the gong sounds.
 * A tribute at 8 health with four kills and no allies read exactly the same on
 * day 6 as they had on day 0, which made the odds board decorative. In-run
 * performance is now part of the number: kills, condition, alliance backing and
 * simple survival all move it.
 */
export function oddsScore(t: Tribute): number {
    if (t.status === 'dead') return 0;

    const training = t.trainingScore || 5;
    let score = ODDS.base
        + t.attributes.strength * ODDS.strengthWeight
        + t.attributes.agility * ODDS.agilityWeight
        + training * ODDS.trainingWeight;

    // How the field and the bookmakers read them, from the trait table rather
    // than from four hard-coded names.
    score += traitMod(t, 'odds') * ODDS.traitWeight;
    score += traitMod(t, 'combatPower') * 4;
    if (t.fanFavourite) score += ODDS.fanFavouriteBonus;

    // Live form.
    score += t.kills * ODDS.killWeight;
    score -= (100 - t.health) * ODDS.healthWeight;
    if (t.allianceId) score += ODDS.allianceBonus;
    if (t.injuries.bleeding || t.injuries.poisoned || t.injuries.infected) score -= ODDS.woundedPenalty;
    if (t.vitals.sanity < 30) score -= ODDS.sanityPenalty;
    // Every day survived is evidence — but only against expectation. A flat
    // "still breathing" bonus is identical for every living tribute and
    // cancels straight out of the normalised percentage, so the term is
    // weighted by how little was expected of them in the first place.
    const expectation = Math.min(1, training / 12);
    score += t.daysSurvived * ODDS.survivalDayWeight
        * (1 - expectation * ODDS.survivalExpectationDamping);

    return Math.max(ODDS.minScore, Math.round(score));
}

export interface TributeOdds {
    /** Rounded survival chance as a percentage. */
    pct: number;
    /** Payout multiplier applied to a winning wager. */
    mult: number;
}

export function tributeOdds(t: Tribute, field: Tribute[]): TributeOdds {
    // Only the living compete for the crown; a dead field member is not a rival.
    const contenders = field.filter(o => o.status === 'alive');
    const pool = contenders.length > 0 ? contenders : field;
    const total = pool.reduce((sum, other) => sum + oddsScore(other), 0);
    const own = oddsScore(t);
    const pct = total > 0 ? Math.max(1, Math.round((own / total) * 100)) : 4;
    const mult = Math.max(1.1, Math.min(25.0, 100 / pct));
    return { pct, mult };
}
