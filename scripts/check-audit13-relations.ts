/**
 * AUDIT-13 §6 (R1-R7): a guard on how long alliances last and how they end.
 *
 * The audit measured a median alliance lifetime of 2 cycles, with 76% of
 * groups gone while two or more of their members were still alive, and no
 * record anywhere of *how* a group had ended. R1 adds a cohesion floor and R2
 * an `endReason` on the chronicle; this sweep holds the first at a median of
 * at least 4 cycles and checks that every ended group says why it ended.
 *
 * The relationship beats R3-R7 add are counted and printed (info), so a
 * change that silences one of them is visible here.
 */
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameConfig, GameState } from '../src/models/types';
import { coverageCells, initialRunState } from './runInit';

const RUNS = Number(process.env.AUDIT13_RUNS ?? 200);
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];
const configs: GameConfig[] = [
    DEFAULT_GAME_CONFIG,
    { ...DEFAULT_GAME_CONFIG, districtCount: 6 },
    { ...DEFAULT_GAME_CONFIG, districtCount: 12, hazardRate: 1.5 },
    { ...DEFAULT_GAME_CONFIG, districtCount: 8, betrayalRate: 1.5 },
];

const lifetimes: number[] = [];
const reasons: Record<string, number> = {};
const byReason: Record<string, number[]> = {};
let stillborn = 0;
let ended = 0, unexplained = 0, endedWithTwoAlive = 0;
const beats: Record<string, number> = {};
const BEAT_TYPES = [
    'alliance-reunion', 'alliance-feud', 'betrayal-warning', 'partner-search', 'last-of-district',
    'partner-standoff', 'romance-slow-burn', 'vengeance-cooled', 'ward-bond', 'ward-guardian', 'ward-inheritance',
    'career-defections', 'district-bonds',
];

const cells = coverageCells(arenaIds, configs.length, RUNS);
for (let i = 0; i < RUNS; i++) {
    const cell = cells[i];
    const sim = new Simulator(initialRunState({ seed: `${process.env.AUDIT13_SEED ?? 'A13R'}${i}`, arenaId: cell.arenaId, config: configs[cell.configIndex] }));
    let state: GameState = sim.getState();
    let guard = 3000;
    while (state.phase !== 'ended' && guard-- > 0) {
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') sim.processBloodbath();
        else if (state.phase === 'epilogue') { state.phase = 'ended'; }
        else if (!sim.processTurn()) break;
        state = sim.getState();
    }
    const live = new Set(Object.keys(state.alliances ?? {}));
    (state.allianceChronicle ?? []).forEach(e => {
        // A pact struck on the floor whose members died in the same bloodbath
        // never stood as a group in the arena; it is a casualty count, not
        // alliance churn, and R1 is about churn. Counted apart.
        if (e.endReason === 'attrition' && e.lastCycle === e.formedCycle) { stillborn++; return; }
        lifetimes.push(e.lastCycle - e.formedCycle);
        if (live.has(e.id)) return;
        ended++;
        if (!e.endReason) unexplained++;
        else {
            reasons[e.endReason] = (reasons[e.endReason] ?? 0) + 1;
            (byReason[e.endReason] ??= []).push(e.lastCycle - e.formedCycle);
        }
        // Every reason but attrition is a group that ended with people in it.
        if (e.endReason && e.endReason !== 'attrition') endedWithTwoAlive++;
    });
    state.log.forEach(l => { if (l.type && BEAT_TYPES.includes(l.type)) beats[l.type] = (beats[l.type] ?? 0) + 1; });
}

lifetimes.sort((a, b) => a - b);
const median = lifetimes.length ? lifetimes[Math.floor(lifetimes.length / 2)] : 0;
const pct = (a: number, b: number) => (100 * a / Math.max(1, b)).toFixed(1) + '%';
console.log(`AUDIT-13 relationships over ${RUNS} runs`);
console.log(`  alliances ${lifetimes.length} (+${stillborn} wiped out in the cycle they formed), median lifetime ${median} cycles`);
console.log(`  lifetime histogram ${JSON.stringify([0, 1, 2, 3, 4, 5, 6].map(n => lifetimes.filter(x => (n === 6 ? x >= 6 : x === n)).length))} (0..5, 6+)`);
console.log(`  ended ${ended}; ended by a choice rather than by deaths (info) ${pct(endedWithTwoAlive, ended)}`);
console.log(`  end reasons ${JSON.stringify(reasons)}; unexplained ${unexplained}`);
Object.entries(byReason).forEach(([r, xs]) => {
    xs.sort((a, b) => a - b);
    console.log(`    ${r.padEnd(13)} median lifetime ${xs[Math.floor(xs.length / 2)]}`);
});
BEAT_TYPES.forEach(b => console.log(`  ${b.padEnd(20)} ${beats[b] ?? 0} (${((beats[b] ?? 0) / RUNS).toFixed(2)} per Games)`));

const failures: string[] = [];
const check = (ok: boolean, text: string) => { if (!ok) failures.push(text); };
check(median >= 4, `alliance median lifetime >= 4 cycles (was ${median})`);
check(unexplained === 0, `every ended alliance records an endReason (${unexplained} did not)`);
if (failures.length) {
    failures.forEach(f => console.error(`FAIL: ${f}`));
    process.exit(1);
}
console.log('PASS');
