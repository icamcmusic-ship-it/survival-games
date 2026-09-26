import { GameState, Prediction, PredictionResult, Tribute } from '../models/types';
import { AUDIT12_WAVE3, PREDICTION } from '../data/balance';
import { CAUSE_FAMILY, deathCodeOf } from './causes';
import { isUpsetVictor } from './season/upset';

/**
 * AUDIT-11 §12: prediction mode.
 *
 * Before the bloodbath the player fills in a slip — the victor, the first
 * death, the top killer, and optionally a ranked final eight — and it is
 * scored against the finished run. Nothing in the simulation reads a slip, so
 * filling one in cannot change what happens; it is scored from the same
 * elimination order the side-bet book settles on.
 */

/** Everyone ranked from last standing (index 0) to first eliminated. */
export function finishingOrder(tributes: Tribute[]): Tribute[] {
    const haveIndex = tributes.some(t => t.eliminationIndex !== undefined);
    const rank = (t: Tribute) => t.status === 'alive'
        ? Number.POSITIVE_INFINITY
        : haveIndex ? (t.eliminationIndex ?? 0) : (t.dayOfDeath ?? 0);
    return [...tributes].sort((a, b) => rank(b) - rank(a));
}

/** The first tribute eliminated, by the engine's total order. */
export function firstDeathOf(tributes: Tribute[]): Tribute | undefined {
    const order = finishingOrder(tributes).filter(t => t.status !== 'alive');
    return order[order.length - 1];
}

/** The tributes tied on the most kills (empty when nobody killed). */
export function topKillersOf(tributes: Tribute[]): Tribute[] {
    const most = Math.max(0, ...tributes.map(t => t.kills));
    return most === 0 ? [] : tributes.filter(t => t.kills === most);
}

/** AUDIT-12 wave 3: the families a first-death-cause pick may name. */
export const FIRST_DEATH_CAUSES: ReadonlyArray<NonNullable<Prediction['firstDeathCause']>> = ['tribute', 'body', 'arena', 'mutt', 'gamemaker'];

/** True when a slip has at least one pick on it. */
export function predictionFilled(p: Prediction | undefined): boolean {
    return !!p && (!!p.winnerId || !!p.firstDeathId || !!p.topKillerId || (p.finalEight ?? []).some(id => !!id)
        || !!p.firstDeathCause || !!p.endDayPick);
}

/**
 * Scores a slip against a finished run.
 *
 * Victor, first death and top killer are worth fixed points each; the final
 * eight scores a point for every named tribute who made the last eight and a
 * bonus for each named in exactly the right place. `max` is what a perfect
 * slip of the same shape would have scored, so a partial slip is not
 * penalised for picks the player never made.
 */
/**
 * AUDIT-12 S1: normalise a slip against the cast — drops ids not in the Games,
 * blanks repeated final-eight picks (keeping the first slot), pads to size.
 */
export function sanitizePrediction(p: Prediction, castIds: Iterable<string>): Prediction {
    const cast = new Set(castIds);
    const ok = (id: string | undefined) => (id && cast.has(id) ? id : undefined);
    const seen = new Set<string>();
    const out: Prediction = { ...p, winnerId: ok(p.winnerId), firstDeathId: ok(p.firstDeathId), topKillerId: ok(p.topKillerId) };
    // AUDIT-12 wave 3: the cause pick is a family, the over/under needs a line.
    if (p.firstDeathCause && !FIRST_DEATH_CAUSES.includes(p.firstDeathCause)) delete out.firstDeathCause;
    if (p.endDayPick && (p.endDayPick !== 'over' && p.endDayPick !== 'under' || !(typeof p.endDayLine === 'number' && p.endDayLine >= 1))) {
        delete out.endDayPick;
        delete out.endDayLine;
    }
    if (p.finalEight) {
        out.finalEight = p.finalEight.slice(0, PREDICTION.finalSize).map(id => {
            if (!ok(id) || seen.has(id)) return '';
            seen.add(id);
            return id;
        });
    }
    return out;
}

export function scorePrediction(state: GameState, p: Prediction | undefined): PredictionResult | undefined {
    if (!predictionFilled(p) || !p) return undefined;
    const tributes = state.tributes;
    const victors = tributes.filter(t => t.status === 'alive');
    const order = finishingOrder(tributes);
    const lastEight = order.slice(0, PREDICTION.finalSize).map(t => t.id);
    let score = 0;
    let max = 0;
    const hits: string[] = [];

    if (p.winnerId) {
        max += PREDICTION.winnerPoints;
        if (victors.some(v => v.id === p.winnerId)) { score += PREDICTION.winnerPoints; hits.push('winner'); }
    }
    if (p.firstDeathId) {
        max += PREDICTION.firstDeathPoints;
        if (firstDeathOf(tributes)?.id === p.firstDeathId) { score += PREDICTION.firstDeathPoints; hits.push('first-death'); }
    }
    if (p.topKillerId) {
        max += PREDICTION.topKillerPoints;
        if (topKillersOf(tributes).some(t => t.id === p.topKillerId)) { score += PREDICTION.topKillerPoints; hits.push('top-killer'); }
    }
    // The slip is a fixed eight-slot array; an empty slot ('') is skipped but
    // keeps every later pick in its own place.
    // AUDIT-12 S1: an id counts once (its first slot) and only if it is in the cast.
    const cast = new Set(tributes.map(t => t.id));
    const seen = new Set<string>();
    const eight = (p.finalEight ?? []).slice(0, PREDICTION.finalSize).map(id => {
        if (!id || !cast.has(id) || seen.has(id)) return '';
        seen.add(id);
        return id;
    });
    if (eight.some(id => !!id)) {
        let eightScore = 0;
        eight.forEach((id, i) => {
            if (!id) return;
            max += PREDICTION.finalEightPoints + PREDICTION.exactPlacePoints;
            if (lastEight.includes(id)) eightScore += PREDICTION.finalEightPoints;
            if (lastEight[i] === id) eightScore += PREDICTION.exactPlacePoints;
        });
        score += eightScore;
        if (eightScore > 0) hits.push('final-eight');
    }
    // AUDIT-12 wave 3 §11: how the first tribute died, by family.
    const W = AUDIT12_WAVE3.prediction;
    if (p.firstDeathCause) {
        max += W.causePoints;
        const first = firstDeathOf(tributes);
        if (first && CAUSE_FAMILY[deathCodeOf(first)] === p.firstDeathCause) { score += W.causePoints; hits.push('first-death-cause'); }
    }
    // The day the Games end, over or under the line. Landing on it is a push: no points either way.
    if (p.endDayPick && typeof p.endDayLine === 'number') {
        max += W.overUnderPoints;
        const won = p.endDayPick === 'over' ? state.day > p.endDayLine : state.day < p.endDayLine;
        if (won) { score += W.overUnderPoints; hits.push('end-day'); }
    }
    // Called the upset: the victor named was a no-kill or thin-district crown.
    if (p.winnerId && hits.includes('winner') && victors.some(v => v.id === p.winnerId && isUpsetVictor(v))) {
        max += W.upsetPoints;
        score += W.upsetPoints;
        hits.push('upset');
    }
    return { score, max, hits };
}
