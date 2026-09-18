/**
 * §3.3 (audit): decision quality, measured.
 *
 * Every tribute records a per-cycle `decisionTrace`: the top scored stances,
 * the destinations the wander scorer weighed and which one it picked. Until
 * now that trace fed the tribute sheet and nothing else, so when a tribute
 * did something stupid there was no way to tell whether the scorer was wrong,
 * the memory was stale, or the roll went against a correct call. This turns
 * the trace into an assertion:
 *
 *  - the stance a tribute is *holding* should be one of the top scored
 *    options nearly always — hysteresis is allowed to keep an incumbent, but
 *    an incumbent the scorer ranks fourth or worse is a scorer being ignored;
 *  - a destination pick in the bottom fifth of its own scoring should be
 *    rare — the roll is weighted, so it happens, and if it happens often the
 *    weights are too flat to mean anything;
 *  - the trace has to exist for nearly every living tribute, or the tribute
 *    sheet's "why did they do that?" is blank.
 *
 *   npm run test:decisions            # 40 runs
 *   DECISION_RUNS=200 npm run test:decisions
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { DECISION_TRACE } from '../src/data/balance';

const RUNS = Number(process.env.DECISION_RUNS ?? 40);

function start(seed: string, arenaId: string): GameState {
    const gamesProfile = gamesProfileFor(seed, false);
    const arena = resolveArenaForRun(seed, arenaId, gamesProfile);
    const resolved = configForProfile(DEFAULT_GAME_CONFIG, gamesProfile);
    const tributes = generateTributes(seed, resolved, arena.zones[0].name, gamesProfile.castShape, gamesProfile.quell);
    return {
        seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: false,
        config: resolved, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile, logCounter: 0, feastsHeld: 0, cycle: 0,
    };
}

let aliveSamples = 0, traced = 0, forced = 0;
let stanceSamples = 0, stanceOutsideTop = 0, stanceHeldBest = 0;
let destSamples = 0, destBottomQuintile = 0, destBest = 0;
const stanceRankHistogram: number[] = [0, 0, 0, 0];

for (let i = 0; i < RUNS; i++) {
    const seed = `DEC${i}`;
    const sim = new Simulator(start(seed, ARENAS[i % ARENAS.length].id));
    let guard = 3000;
    let state = sim.getState();
    while (state.phase !== 'ended' && guard-- > 0) {
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') sim.processBloodbath();
        else if (state.phase === 'epilogue') { state.phase = 'ended'; }
        else {
            if (!sim.processTurn()) break;
            state = sim.getState();
            state.tributes.forEach(t => {
                if (t.status !== 'alive') return;
                aliveSamples++;
                const trace = t.decisionTrace;
                if (!trace) return;
                traced++;
                if (trace.forced) { forced++; return; }
                if (trace.stances.length > 0) {
                    stanceSamples++;
                    const rank = trace.stances.findIndex(s => s.stance === t.stance);
                    if (rank === 0) stanceHeldBest++;
                    if (rank < 0) stanceOutsideTop++;
                    stanceRankHistogram[rank < 0 ? 3 : rank]++;
                }
                if (trace.destinationPick && trace.destinationPick.of >= 3) {
                    destSamples++;
                    if (trace.destinationPick.rank === 0) destBest++;
                    if (trace.destinationPick.percentile <= 0.2) destBottomQuintile++;
                }
            });
            continue;
        }
        state = sim.getState();
    }
}

const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
console.log(`decision quality over ${RUNS} runs, ${aliveSamples} tribute-cycles\n`);
console.log(`trace present:       ${pct(traced, aliveSamples)} (forced ${pct(forced, traced)})`);
console.log(`stance held = best:  ${pct(stanceHeldBest, stanceSamples)}`);
console.log(`stance rank histogram (0=best, 3=outside top ${DECISION_TRACE.topN}): ${stanceRankHistogram.map((n, r) => `${r}:${pct(n, stanceSamples)}`).join('  ')}`);
console.log(`destination = best:  ${pct(destBest, destSamples)}`);
console.log(`destination in bottom fifth of its own scoring: ${pct(destBottomQuintile, destSamples)}`);

const GUARDS: Array<[string, number, number, string]> = [
    ['trace present', traced / Math.max(1, aliveSamples), 0.9, '>='],
    ['stance held outside the top three', stanceOutsideTop / Math.max(1, stanceSamples), 0.15, '<='],
    ['stance held = best', stanceHeldBest / Math.max(1, stanceSamples), 0.5, '>='],
    ['destination pick in bottom fifth', destBottomQuintile / Math.max(1, destSamples), 0.15, '<='],
];
const failures = GUARDS.filter(([, v, bound, op]) => op === '>=' ? v < bound : v > bound);
if (failures.length > 0) {
    console.log('\nFAIL:');
    failures.forEach(([label, v, bound, op]) => console.log(`  ${label}: ${(v * 100).toFixed(1)}% (guard ${op} ${bound * 100}%)`));
    process.exit(1);
}
console.log('\nDecision quality guards hold.');
