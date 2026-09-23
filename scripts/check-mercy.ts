/**
 * AUDIT-10 §12, and the case where the spec was wrong about its own game.
 *
 * The audit proposes "Receipt of Mercy": a tribute spared during an execution
 * opportunity later supplies treatment to that same person. Measured over 150
 * runs it cannot happen. Sparings are abundant — 111 of them across 50.7% of
 * runs — and treatment is common at 80% of runs, and the conjunction occurred
 * **zero** times, because sparing happens between enemies and treatment
 * between allies. The two systems never touch.
 *
 * The same measurement found the inverse 17 times: the sparer meeting the
 * spared again and finishing it, roughly one sparing in seven. That is the
 * beat this guards.
 *
 * It also guards the half-beat the investigation exposed. Sparing used to give
 * the *winner* a trait and twenty points of audience excitement and give the
 * person they spared nothing at all — no gratitude, no trust, no record of who
 * had done it. The site's own comment said "the arena remembers people who
 * make it", and the one person with most reason to remember did not.
 *
 *   npm run test:mercy
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { getRel } from '../src/engine/relationships';

const RUNS = Number(process.env.MERCY_RUNS ?? 120);
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];

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

let completed = 0, sparingRuns = 0, sparings = 0, withdrawn = 0, gratefulPairs = 0, ungratefulPairs = 0;

for (let i = 0; i < RUNS; i++) {
    const sim = new Simulator(start(`MY${i}`, arenaIds[i % arenaIds.length], i % 4 === 3));
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
    const spared = state.tributes.filter(t => (t.sparedBy ?? []).length > 0);
    if (spared.length) { sparingRuns++; sparings += spared.length; }
    if ((state.milestones ?? {})['mercy-withdrawn']) withdrawn++;
    spared.forEach(t => (t.sparedBy ?? []).forEach(id => {
        // Gratitude is applied at the moment of sparing and then lives in the
        // ordinary relationship, where everything else can move it. Counted
        // both ways rather than asserted per pair for that reason.
        if (getRel(t, id) > 0) gratefulPairs++; else ungratefulPairs++;
    }));
}

const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
console.log(`mercy: ${completed}/${RUNS} runs\n`);
console.log(`runs with a sparing:        ${pct(sparingRuns, completed)}  (${sparings} sparings)`);
console.log(`runs where mercy was withdrawn: ${pct(withdrawn, completed)}`);
console.log(`spared tributes on positive terms with their sparer: ${pct(gratefulPairs, gratefulPairs + ungratefulPairs)}`);

const failures: string[] = [];
if (completed < 20) failures.push(`only ${completed} runs completed — too few to judge`);
if (sparings === 0) failures.push('nobody was ever spared — the beat this reads is unreachable');
/* The withdrawal must happen, or the achievement reading it is dead content. */
if (sparings > 0 && withdrawn === 0) {
    failures.push('mercy was never withdrawn — `mercy-withdrawn` has a writer and no occurrences');
}
/*
 * ...and it must stay the exception. If every sparing ended with the sparer
 * finishing the job, sparing would not be mercy, it would be a delay.
 */
if (sparingRuns > 0 && withdrawn / Math.max(1, sparingRuns) > 0.6) {
    failures.push(`mercy was withdrawn in ${pct(withdrawn, sparingRuns)} of the runs that had a sparing `
        + '— sparing has stopped meaning anything');
}
/*
 * And being spared has to be worth something to the person spared.
 *
 * The bar is 0.38, and the first draft of it was 0.5 — an untested intuition
 * that gratitude ought to leave most spared tributes on good terms. Measured,
 * it does not, and it should not: the sparing happens at the end of a fight
 * the fleer was losing, so the duel's accumulated grudge is already large and
 * a single act of mercy does not wipe it out. Somebody who just beat you
 * bloody and then let you walk is not thereby your friend.
 *
 * What gratitude actually does, measured by switching `mercyRegard` and
 * `mercyTrust` to zero and re-running: 35.2% of spared tributes end on
 * positive terms without it, 42.7% with it. So the bar sits between those two
 * — it fails if the gratitude is removed and passes as shipped, which is the
 * only thing a bound here can honestly assert.
 */
if (gratefulPairs + ungratefulPairs > 0 && gratefulPairs / (gratefulPairs + ungratefulPairs) < 0.38) {
    failures.push(`only ${pct(gratefulPairs, gratefulPairs + ungratefulPairs)} of spared tributes end on `
        + 'positive terms with the person who spared them — the gratitude is not landing');
}

if (failures.length) {
    console.error(`\n${failures.length} mercy problem(s):`);
    failures.forEach(f => console.error(`  ${f}`));
    process.exit(1);
}
console.log('\nMercy is felt by the person receiving it, and withdrawing it stays the exception.');
