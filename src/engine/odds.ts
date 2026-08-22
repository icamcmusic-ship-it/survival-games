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

/**
 * §2.9: why the number is what it is. The same terms `oddsScore` adds up,
 * returned as labelled contributions so the odds board can show the top
 * factors instead of a bare percentage and an arrow.
 */
export interface OddsFactor {
    label: string;
    delta: number;
}

export function oddsFactors(t: Tribute): OddsFactor[] {
    if (t.status === 'dead') return [];
    const training = t.trainingScore || 5;
    const factors: OddsFactor[] = [
        { label: 'Raw strength', delta: t.attributes.strength * ODDS.strengthWeight },
        { label: 'Agility', delta: t.attributes.agility * ODDS.agilityWeight },
        { label: `Training score of ${training}`, delta: training * ODDS.trainingWeight },
        { label: 'How the bookmakers read them', delta: traitMod(t, 'odds') * ODDS.traitWeight + traitMod(t, 'combatPower') * 4 },
    ];
    if (t.fanFavourite) factors.push({ label: 'Capitol darling', delta: ODDS.fanFavouriteBonus });
    if (t.kills > 0) factors.push({ label: `${t.kills} confirmed kill${t.kills === 1 ? '' : 's'}`, delta: t.kills * ODDS.killWeight });
    if (t.health < 100) factors.push({ label: `Down to ${t.health} health`, delta: -(100 - t.health) * ODDS.healthWeight });
    if (t.allianceId) factors.push({ label: 'Alliance at their back', delta: ODDS.allianceBonus });
    if (t.injuries.bleeding || t.injuries.poisoned || t.injuries.infected) {
        factors.push({ label: 'Carrying an open wound', delta: -ODDS.woundedPenalty });
    }
    if (t.vitals.sanity < 30) factors.push({ label: 'Coming apart', delta: -ODDS.sanityPenalty });
    if (t.daysSurvived > 0) {
        const expectation = Math.min(1, training / 12);
        factors.push({
            label: `${t.daysSurvived} day${t.daysSurvived === 1 ? '' : 's'} survived against expectation`,
            delta: t.daysSurvived * ODDS.survivalDayWeight * (1 - expectation * ODDS.survivalExpectationDamping),
        });
    }
    return factors
        .filter(f => Math.round(f.delta) !== 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
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
    // Scores are raised to ODDS.discrimination before normalising: the raw
    // heuristic only spreads ~2x across a cast while realised win rates
    // spread >20x, so a linear share compressed every tribute into a 3-6%
    // band and left the favourites systematically underpriced.
    const share = (o: Tribute) => Math.pow(oddsScore(o), ODDS.discrimination);
    const total = pool.reduce((sum, other) => sum + share(other), 0);
    const own = share(t);
    const pct = total > 0 ? Math.max(1, Math.round((own / total) * 100)) : 4;
    // The payout carries an explicit house margin rather than being derived
    // straight from the display number — EV is set on purpose, not by
    // accident of the rounding.
    const mult = Math.max(1.1, Math.min(25.0, ODDS.houseMargin * 100 / pct));
    return { pct, mult };
}
