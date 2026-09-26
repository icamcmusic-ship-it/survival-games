/**
 * AUDIT-12 S3 guard (wave 3): every director taste visibly changes the Games.
 *
 * S3 found the tastes inside run-to-run noise — multipliers of 0.95-1.15 on
 * draws the engine was already making. Wave 1 widened them; wave 3 gave each
 * taste two or three authored interventions (`engine/season/directorPlays.ts`).
 * This holds the result to a number: for every taste, the metric that taste is
 * about (`TASTE_METRIC`) is measured over the same seeds with the taste pinned
 * on and with it pinned to neutral, and the difference of the means must clear
 * `AUDIT12_WAVE3.directors.guardSd` standard errors, in the taste's direction.
 *
 * It also prints the neutral means, which are the baseline the run profile's
 * "director effect" line is measured against (`directors.baseline`).
 *
 *   npm run test:directors
 *   DIRECTOR_RUNS=80 npm run test:directors
 */
import { initialRunState } from './runInit';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { DIRECTOR_TASTE_IDS, DirectorTasteId, setDirectorTasteOverride } from '../src/data/directors';
import { TASTE_METRIC } from '../src/engine/season/directorEffect';
import { AUDIT12_WAVE3 } from '../src/data/balance';
import { GameState } from '../src/models/types';

const RUNS = Number(process.env.DIRECTOR_RUNS ?? 60);
const arenaIds = ARENAS.map(a => a.id);
/** Hands-off is the one taste whose metric is meant to fall. */
const DIRECTION: Record<DirectorTasteId, 1 | -1> = {
    'mutt-lover': 1, 'fire-lover': 1, 'alliance-breaker': 1, 'weather-obsessed': 1, 'sponsor-friendly': 1, showrunner: 1, 'hands-off': -1,
};

function play(seed: string, arenaId: string): GameState {
    const sim = new Simulator(initialRunState({ seed, arenaId, config: DEFAULT_GAME_CONFIG }));
    let guard = 600;
    while (guard-- > 0 && sim.advance()) { /* to the end */ }
    return sim.getState();
}

function stats(xs: number[]): { mean: number; sd: number } {
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, xs.length - 1));
    return { mean, sd };
}

const seeds = Array.from({ length: RUNS }, (_, i) => ({ seed: `DIR${i}`, arena: arenaIds[i % arenaIds.length] }));
const neutral = seeds.map(({ seed, arena }) => {
    setDirectorTasteOverride('neutral');
    return play(seed, arena);
});
const failures: string[] = [];
const baseline: Record<string, number> = {};

DIRECTOR_TASTE_IDS.forEach(taste => {
    const metric = TASTE_METRIC[taste];
    const base = neutral.map(metric.count);
    const tasted = seeds.map(({ seed, arena }) => {
        setDirectorTasteOverride(taste);
        return metric.count(play(seed, arena));
    });
    const a = stats(base);
    const b = stats(tasted);
    baseline[metric.key] = Math.round(a.mean * 10) / 10;
    const se = Math.sqrt((a.sd ** 2 + b.sd ** 2) / RUNS) || 1e-9;
    const shift = (b.mean - a.mean) / se * DIRECTION[taste];
    const ok = shift >= AUDIT12_WAVE3.directors.guardSd;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${taste.padEnd(17)} ${metric.label.padEnd(15)} neutral ${a.mean.toFixed(2)} → ${b.mean.toFixed(2)}  (${shift.toFixed(1)} se)`);
    if (!ok) failures.push(`${taste}: ${metric.label} moved ${shift.toFixed(1)} standard errors, need ${AUDIT12_WAVE3.directors.guardSd}`);
});
setDirectorTasteOverride(undefined);

console.log(`\nneutral baseline (for AUDIT12_WAVE3.directors.baseline): ${JSON.stringify(baseline)}`);
if (failures.length > 0) {
    console.error(`\n${failures.length} director taste(s) below the S3 guard:\n - ${failures.join('\n - ')}`);
    process.exit(1);
}
console.log(`\nall ${DIRECTOR_TASTE_IDS.length} director tastes clear ${AUDIT12_WAVE3.directors.guardSd} standard errors over ${RUNS} paired runs`);
