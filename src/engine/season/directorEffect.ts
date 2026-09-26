import { GameState } from '../../models/types';
import { AUDIT12_WAVE3 } from '../../data/balance';
import { DirectorTasteId, NEUTRAL_TASTE, directorTaste } from '../../data/directors';
import { CAUSE_FAMILY, deathCodeOf } from '../causes';

/**
 * AUDIT-12 wave 3 §11: the director effect — the metric each taste moves,
 * counted over a Games and set against the measured neutral baseline. Kept
 * free of simulation imports so the end screen and the Hall of Fame can read
 * it without pulling the engine into the UI bundle.
 */
const D = AUDIT12_WAVE3.directors;


/** The metric each taste moves, as a label and a counter over a finished (or running) Games. */
export const TASTE_METRIC: Record<DirectorTasteId, { key: string; label: string; count: (s: GameState) => number }> = {
    'mutt-lover': { key: 'muttAttacks', label: 'mutt attacks', count: s => s.log.filter(l => l.category === 'mutt').length },
    'fire-lover': { key: 'fireWeather', label: 'fires and heat', count: s => s.log.filter(l => /set alight|fire|heat|scorch|burn/i.test(l.text) && l.category === 'gamemaker').length },
    'alliance-breaker': { key: 'betrayals', label: 'betrayals', count: s => s.log.filter(l => l.category === 'betrayal').length },
    'weather-obsessed': { key: 'weatherFronts', label: 'weather turns', count: s => s.log.filter(l => l.category === 'gamemaker' && /weather|fog|flood|front/i.test(l.text)).length },
    'sponsor-friendly': { key: 'parachutes', label: 'parachutes', count: s => s.log.filter(l => l.category === 'sponsor').length },
    showrunner: { key: 'headlines', label: 'set pieces', count: s => s.log.filter(l => l.category === 'gamemaker' && l.important).length },
    'hands-off': {
        key: 'interventions', label: 'Capitol disruptions',
        count: s => (s.firedWildcards?.length ?? 0) - (s.season?.cancelledBeats ?? 0) + (s.extraWildcardsFired ?? 0)
            + (s.interventionLog ?? []).filter(r => !r.scheduled && !['mercy', 'drop', 'reveal', 'parachute'].includes(r.type)).length
            + (s.interventionLog ?? []).filter(r => r.scheduled && (r.type === 'mutt' || r.type === 'weather')).length,
    },
};

/**
 * "director effect: +X mutt deaths vs baseline" — the run's own count of the
 * metric its director's taste moves, against the measured neutral baseline.
 */
export function directorEffectLine(state: GameState): string | undefined {
    if (!state.headGamemaker || state.config.vanillaRules) return undefined;
    const taste = directorTaste(state.headGamemaker);
    if (taste === NEUTRAL_TASTE) return undefined;
    const metric = TASTE_METRIC[taste.id];
    const base = D.baseline[metric.key] ?? 0;
    const delta = Math.round((metric.count(state) - base) * 10) / 10;
    const line = `director effect: ${delta >= 0 ? '+' : ''}${delta} ${metric.label} vs baseline`;
    if (taste.id !== 'mutt-lover') return line;
    // The mutt-lover's line also says what the mutts actually cost.
    const deaths = state.tributes.filter(t => t.status === 'dead' && CAUSE_FAMILY[deathCodeOf(t)] === 'mutt').length;
    const dDelta = Math.round((deaths - (D.baseline.muttDeaths ?? 0)) * 10) / 10;
    return `${line}, ${dDelta >= 0 ? '+' : ''}${dDelta} mutt deaths`;
}
