import { GameState, Tribute } from '../models/types';
import { AUDIENCE_SEGMENTS } from '../data/balance';

/**
 * AUDIT-11 §8: the audience is not one number.
 *
 * Three segments — the bloodthirsty, the romantics and the underdog fans —
 * each warm to a different kind of beat and cool off by `decay` every phase.
 * Deterministic: read from the log the phase just wrote, no RNG. The mood
 * feeds the player's sponsor pricing (a tribute the loudest segment loves is
 * dearer to reach) and is shown on the sponsor booth.
 */
export type AudienceSegment = 'bloodthirsty' | 'romantic' | 'underdog';
export const AUDIENCE_SEGMENT_LIST: AudienceSegment[] = ['bloodthirsty', 'romantic', 'underdog'];

export interface AudienceMood {
    bloodthirsty: number;
    romantic: number;
    underdog: number;
    /** Log length already read. */
    logMark: number;
}

export function audienceOf(state: GameState): AudienceMood {
    return state.audience ?? { bloodthirsty: 20, romantic: 20, underdog: 20, logMark: 0 };
}

/** Called once per simulated turn, after the phase has logged its beats. */
export function updateAudience(state: GameState): void {
    const mood = { ...audienceOf(state) };
    AUDIENCE_SEGMENT_LIST.forEach(s => { mood[s] *= AUDIENCE_SEGMENTS.decay; });
    const byId = new Map(state.tributes.map(t => [t.id, t] as const));
    for (let i = Math.min(mood.logMark, state.log.length); i < state.log.length; i++) {
        const l = state.log[i];
        if (l.category === 'kill' || l.category === 'combat') mood.bloodthirsty += l.category === 'kill' ? AUDIENCE_SEGMENTS.perKill : AUDIENCE_SEGMENTS.perFight;
        if (l.category === 'romance' || l.category === 'alliance') mood.romantic += l.category === 'romance' ? AUDIENCE_SEGMENTS.perRomance : AUDIENCE_SEGMENTS.perAlliance;
        if (l.category === 'kill') {
            const actor = byId.get(l.actorId ?? l.tributesInvolved[0]);
            if (actor && actor.trainingScore <= AUDIENCE_SEGMENTS.underdogTrainingMax) mood.underdog += AUDIENCE_SEGMENTS.perUpset;
        }
    }
    AUDIENCE_SEGMENT_LIST.forEach(s => { mood[s] = Math.round(Math.max(0, Math.min(100, mood[s])) * 10) / 10; });
    mood.logMark = state.log.length;
    state.audience = mood;
}

/** 0-1: how much a segment likes this tribute. */
export function segmentAppeal(t: Tribute, s: AudienceSegment): number {
    if (s === 'bloodthirsty') return Math.min(1, t.kills / 3);
    if (s === 'romantic') return (t.allianceId?.startsWith('lovers-') ? 1 : 0) || ((t.protectorBonds?.length ?? 0) > 0 ? 0.6 : 0);
    return t.trainingScore <= AUDIENCE_SEGMENTS.underdogTrainingMax ? 1 : 0;
}

/** Multiplier on the player's sponsor quote. 1 when nobody in particular cares. */
export function audiencePriceFactor(state: GameState, t: Tribute): number {
    const mood = audienceOf(state);
    const pull = AUDIENCE_SEGMENT_LIST.reduce((sum, s) => sum + (mood[s] / 100) * segmentAppeal(t, s), 0);
    return 1 + Math.min(AUDIENCE_SEGMENTS.priceCap, pull * AUDIENCE_SEGMENTS.pricePressure);
}

/** The segment the crowd is loudest in right now. */
export function loudestSegment(state: GameState): AudienceSegment {
    const mood = audienceOf(state);
    return AUDIENCE_SEGMENT_LIST.reduce((a, b) => (mood[b] > mood[a] ? b : a));
}
