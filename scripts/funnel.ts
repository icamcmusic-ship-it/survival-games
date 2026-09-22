/**
 * AUDIT-10 B4-02: the opportunity funnel.
 *
 * A signature that fires on a third of its entrants has failed somewhere, and
 * `signatureFired` is a boolean, so "somewhere" covers cases whose fixes point
 * in opposite directions — the prerequisite never existed, or it did and the
 * tribute could not see it, or they could see it and not afford it, or it fired
 * and changed nothing.
 *
 * The audit is specific about why that matters: this *"is what stops an
 * opportunity failure being hidden behind a larger bonus, which is the failure
 * mode behind every one of the low-signature archetypes"*. Raise a Broker's
 * sale multiplier because their set piece fires rarely and you have improved
 * the price of a deal they are still never in a position to offer.
 *
 * There is direct evidence in this repository that the funnel is the right
 * instrument: `archetypeHooks.ts` carries a comment recording that a previous
 * audit measured "nobody in the zone 77.7% of the time, against only 10.2%
 * where the broker had nothing to trade". That is a funnel reading, taken by
 * hand, written into a comment, and never reproducible again. This makes it
 * standing.
 *
 *   npm run funnel
 *   FUNNEL_RUNS=400 npm run funnel
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { ARCHETYPES } from '../src/data/archetypes';
import { FUNNEL_STAGES, FunnelStage, OUTCOMES_DEFINED, enableFunnel } from '../src/engine/funnel';

const RUNS = Number(process.env.FUNNEL_RUNS ?? 120);

/**
 * An instrument that changes what it measures is not an instrument.
 *
 * The funnel writes counters and one boolean and draws no random numbers, so it
 * cannot move a run — but "cannot" is a claim about code somebody will edit,
 * and the cheap way to keep it true is to check it. Thirty seeds played twice,
 * once with the funnel on and once without, compared on every tribute's
 * outcome. If this ever fails, every number below it is worthless and the run
 * stops rather than printing them.
 */
function assertInert() {
    const shapeOf = (s: GameState) => s.tributes
        .map(t => `${t.id}:${t.status}:${t.health}:${t.causeOfDeath ?? ''}:${t.kills}:${t.daysSurvived}`).join('|');
    for (let i = 0; i < 30; i++) {
        const seed = `FUNDET${i}`;
        if (shapeOf(playOut(seed, ARENAS[i % ARENAS.length].id, false))
            !== shapeOf(playOut(seed, ARENAS[i % ARENAS.length].id, true))) {
            console.error(`\nThe funnel changed the run on seed ${seed}.`);
            console.error('It is supposed to count what happens, not take part in it. Nothing below this would mean anything.');
            process.exit(1);
        }
    }
    console.log('The funnel is inert: 30 seeds play identically with it on and off.');
}
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];

function playOut(seed: string, arenaId: string, withFunnel: boolean): GameState {
    const profile = gamesProfileFor(seed, false);
    const arena = resolveArenaForRun(seed, arenaId, profile);
    const config = configForProfile(DEFAULT_GAME_CONFIG, profile);
    const tributes = generateTributes(seed, DEFAULT_GAME_CONFIG, arena.zones[0].name, profile.castShape, profile.quell);
    const state = {
        seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: false,
        config, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: profile, logCounter: 0, feastsHeld: 0, cycle: 0,
    } as GameState;
    if (withFunnel) enableFunnel(state);
    const sim = new Simulator(state);
    let guard = 3000;
    let s = sim.getState();
    while (s.phase !== 'ended' && guard-- > 0) {
        if (s.phase === 'setup') sim.processTraining();
        else if (s.phase === 'training' || s.phase === 'scores') sim.processInterviews();
        else if (s.phase === 'interviews') sim.startGames();
        else if (s.phase === 'bloodbath') sim.processBloodbath();
        else if (s.phase === 'epilogue') { s.phase = 'ended'; }
        else if (!sim.processTurn()) break;
        s = sim.getState();
    }
    return s;
}

const totals: Record<string, Partial<Record<string, number>>> = {};
const entrants: Record<string, number> = {};
let completed = 0;

assertInert();

for (let i = 0; i < RUNS; i++) {
    const s2 = playOut(`FUN${i}`, arenaIds[i % arenaIds.length], true);
    if (s2.phase !== 'ended') continue;
    completed++;
    s2.tributes.forEach(t => { entrants[t.archetype] = (entrants[t.archetype] ?? 0) + 1; });
    Object.entries(s2.funnel ?? {}).forEach(([archetype, row]) => {
        const into = totals[archetype] ?? (totals[archetype] = {});
        Object.entries(row).forEach(([stage, n]) => { into[stage] = (into[stage] ?? 0) + (n ?? 0); });
    });
}

console.log(`\nOpportunity funnel over ${completed} runs.\n`);
console.log('Counts are tribute-cycles for the offered/available/aware/affordable stages — the same');
console.log('tribute is asked on every cycle until the beat lands — and tributes for fired/benefited,');
console.log('which happen once. So the useful reading is the *shape* of the drop, not stage-to-stage');
console.log('percentages, which would be comparing two different units.\n');

const rows = Object.keys(totals).sort((a, b) =>
    (totals[b].fired ?? 0) / Math.max(1, entrants[b]) - (totals[a].fired ?? 0) / Math.max(1, entrants[a]));

const INSTRUMENTED: FunnelStage[] = ['available', 'aware', 'affordable'];

console.log('archetype           entrants   fired    of them   ' + INSTRUMENTED.join('   '));
rows.forEach(a => {
    const row = totals[a];
    const n = entrants[a] ?? 0;
    const fired = row.fired ?? 0;
    const inner = INSTRUMENTED.map(s => (row[s] ?? 0) === 0 ? '   —   ' : String(row[s]).padStart(6) + ' ').join(' ');
    console.log(`${(ARCHETYPES[a as keyof typeof ARCHETYPES]?.name ?? a).padEnd(20)}${String(n).padStart(6)}  ${String(fired).padStart(6)}`
        + `   ${n === 0 ? '—' : (fired / n * 100).toFixed(1).padStart(5)}%   ${inner}`);
});

console.log('\nWhere the beat led somewhere');
if (OUTCOMES_DEFINED.length === 0) {
    console.log('  No archetype has a defined outcome yet.');
} else {
    OUTCOMES_DEFINED.forEach(a => {
        const fired = totals[a]?.fired ?? 0;
        const benefited = totals[a]?.benefited ?? 0;
        console.log(`  ${(ARCHETYPES[a as keyof typeof ARCHETYPES]?.name ?? a).padEnd(20)}`
            + `${benefited} of ${fired} firings led anywhere`
            + (fired > 0 ? ` (${(benefited / fired * 100).toFixed(1)}%)` : ''));
    });
}
const undefinedOutcomes = rows.filter(a => !OUTCOMES_DEFINED.includes(a));
console.log(`\n  ${undefinedOutcomes.length} archetype(s) have no outcome defined, so their beats are not`);
console.log('  reported as leading nowhere — that would confuse "measured and found wanting"');
console.log('  with "nobody has yet said what this set piece is for".');

// The stages that exist in the type and are not yet written by any beat. Named
// rather than left to be inferred from a column of dashes.
const wired = new Set<string>();
Object.values(totals).forEach(row => Object.keys(row).forEach(s => { if ((row[s] ?? 0) > 0) wired.add(s); }));
const unwired = FUNNEL_STAGES.filter(s => !wired.has(s));
if (unwired.length > 0) console.log(`\nStages no beat writes yet: ${unwired.join(', ')}.`);
