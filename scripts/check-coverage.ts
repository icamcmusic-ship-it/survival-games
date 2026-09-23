/**
 * AUDIT-10 batch 6 §16: opportunity coverage.
 *
 * The audit's line is *"a subsystem that appears in one run in a thousand is
 * not everyday depth"*, and nothing measured that. `soak.ts` counts every
 * typed beat and asserts none of its probes reads zero — its own header says
 * what that misses: *"the dead-probe assertion added then can only catch a
 * probe that reaches zero. A reword that costs a counter half its hits is
 * still silent."* Catching nothing is not the same as catching almost nothing,
 * and almost-nothing is what the audit is asking about.
 *
 * So this reads the declared `EventType` vocabulary straight out of the type
 * and asks, of each value, in what share of complete runs it happens at all.
 *
 * Two different failures fall out of that, and they want opposite fixes:
 *
 *   - A value nothing ever emits is dead vocabulary. The first run of this
 *     sweep found five. `border-warning` and `border-collapse` turned out to
 *     have real beats that simply carried no type, and are emitted now.
 *     `betrayal`, `romance` and `bond` had been superseded by the specific
 *     values (`exotic-betrayals`, `romance-tragedy`, `performed-bonds`) and
 *     were removed — they were worse than untidy, because `EventCategory`
 *     carries live `'betrayal'` and `'romance'` values, so `e.type ===
 *     'betrayal'` type-checked and could never match.
 *   - A value that fires in a handful of runs in a hundred is content the
 *     player will almost never meet. That is *reported* rather than failed:
 *     several of them are legitimately once-in-a-while beats, and a guard that
 *     fails on the known backlog is a guard somebody disables on day one.
 *
 *   npm run test:coverage
 *   COVERAGE_RUNS=600 npm run test:coverage
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { readFileSync } from 'node:fs';

/*
 * 300 rather than 120: a power problem, not a softened assertion.
 *
 * The hard half of this guard asserts that every declared beat happens at
 * least once. `parachute-lost` runs at about 1% of runs — measured 6 in 600 —
 * so at 120 runs the expected count is a bit over one and drawing zero is an
 * ordinary outcome rather than evidence the beat is dead. It duly failed the
 * build having not broken, exactly as `expulsion` (also ~1%) was one unlucky
 * sample away from doing. 300 runs costs 52 seconds and puts both of them
 * reliably above zero.
 */
const RUNS = Number(process.env.COVERAGE_RUNS ?? 300);
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];

/**
 * Read from the type rather than a hand-kept list, for the reason F21
 * established: a copy of a table is a thing nothing updates. A value added to
 * `EventType` is measured by this sweep the moment it exists.
 */
function declaredEventTypes(): string[] {
    const src = readFileSync('src/models/types.ts', 'utf8');
    const from = src.indexOf('export type EventType');
    if (from < 0) throw new Error('EventType is no longer declared where this sweep looks for it');
    const block = src.slice(from, from + src.slice(from).indexOf(';'));
    return [...block.matchAll(/\|\s*'([^']+)'/g)].map(m => m[1]);
}

function start(seed: string, arenaId: string, gm: boolean): GameState {
    const gp = gamesProfileFor(seed, seed.endsWith('7'));
    const arena = resolveArenaForRun(seed, arenaId, gp);
    const cfg = configForProfile(DEFAULT_GAME_CONFIG, gp);
    return {
        seed, arena, tributes: generateTributes(seed, cfg, arena.zones[0].name, gp.castShape, gp.quell),
        phase: 'setup', day: 0, log: [], gamemakerMode: gm, config: cfg, baseConfig: DEFAULT_GAME_CONFIG,
        gamesProfile: gp, logCounter: 0, feastsHeld: 0, cycle: 0,
    };
}

const declared = declaredEventTypes();
const runsWith = new Map<string, number>();
const total = new Map<string, number>();
declared.forEach(d => { runsWith.set(d, 0); total.set(d, 0); });
/** Types emitted by the engine that the union does not declare. */
const undeclared = new Map<string, number>();
let completed = 0;

for (let i = 0; i < RUNS; i++) {
    const sim = new Simulator(start(`CV${i}`, arenaIds[i % arenaIds.length], i % 4 === 3));
    let guard = 3000;
    let state = sim.getState();
    while (state.phase !== 'ended' && guard-- > 0) {
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') sim.processBloodbath();
        else if (state.phase === 'epilogue') { state.phase = 'ended'; }
        else if (!sim.processTurn()) break;
        state = sim.getState();
    }
    if (state.phase !== 'ended') continue;
    completed++;
    const seen = new Set<string>();
    state.log.forEach(e => {
        const t = e.type;
        if (!t) return;
        if (!runsWith.has(t)) { undeclared.set(t, (undeclared.get(t) ?? 0) + 1); return; }
        total.set(t, (total.get(t) ?? 0) + 1);
        seen.add(t);
    });
    seen.forEach(t => runsWith.set(t, (runsWith.get(t) ?? 0) + 1));
}

const share = (n: number) => n / Math.max(1, completed);
const pct = (n: number) => `${(share(n) * 100).toFixed(1)}%`;
const rows = declared.map(d => ({ d, runs: runsWith.get(d) ?? 0, n: total.get(d) ?? 0 }))
    .sort((a, b) => a.runs - b.runs);

const never = rows.filter(r => r.runs === 0);
const rare = rows.filter(r => r.runs > 0 && share(r.runs) < 0.05);

console.log(`coverage: ${completed}/${RUNS} complete runs, ${declared.length} declared event types\n`);
console.log(`never fired:            ${never.length}`);
console.log(`under 5% of runs:       ${rare.length}`);
console.log(`5% to 25%:              ${rows.filter(r => share(r.runs) >= 0.05 && share(r.runs) < 0.25).length}`);
console.log(`a quarter of runs or more: ${rows.filter(r => share(r.runs) >= 0.25).length}`);

if (rare.length) {
    console.log('\nthin — the player will rarely meet these (reported, not failed):');
    rare.forEach(r => console.log(`  ${r.d.padEnd(28)} ${pct(r.runs).padStart(6)} of runs, ${r.n} total`));
}

const failures: string[] = [];
if (completed < 20) failures.push(`only ${completed} runs completed — too few to say anything about coverage`);
never.forEach(r => {
    failures.push(`\`${r.d}\` is declared and never emitted — either the beat carries no type, `
        + 'or a specific value superseded it and this one is a synonym nothing writes');
});
undeclared.forEach((n, t) => {
    failures.push(`\`${t}\` is emitted ${n} times and is not in the EventType union`);
});

if (failures.length) {
    console.error(`\n${failures.length} coverage problem(s):`);
    failures.slice(0, 20).forEach(f => console.error(`  ${f}`));
    process.exit(1);
}
console.log('\nEvery declared beat happens. Nothing is emitting a type the union does not know.');
