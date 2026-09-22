/**
 * AUDIT-10 batch 6: story-aware scheduling that tracks repeated situation
 * *types* rather than repeated strings.
 *
 * `pickText` already refuses to repeat a *sentence* until its pool is
 * exhausted. Nothing noticed the same *kind* of thing happening over and over
 * in fresh wording. Measured across the Games proper — a block of training
 * lines is the training phase, not repetition — 44.1% of headlined lines
 * repeated the category of the line before them, against the 10-15% ten
 * categories would give by chance, and the longest unbroken run of headlined
 * combat lines was 38.
 *
 * The clustering itself is correct and is deliberately not touched: a fight
 * produces fight lines, and forcing variety onto consequences would falsify
 * the run. What this guards is the *broadcast* — `important` is a presentation
 * flag that no other check reads, so a run of them can be demoted without any
 * event being suppressed.
 *
 * Which makes the floor as important as the ceiling here, and it is the one a
 * careless tightening would breach: demote too eagerly and the feed stops
 * carrying the story at all. The chronicle length is asserted too, because the
 * one thing this must never do is drop an event.
 *
 *   npm run test:pacing
 *   PACING_RUNS=120 npm run test:pacing
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { STORY_PACING } from '../src/data/balance';

const RUNS = Number(process.env.PACING_RUNS ?? 60);
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];
/** Training and interviews are phases; a block of their lines is the phase. */
const PHASE = new Set(['training', 'interview', 'system']);

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

let completed = 0, lines = 0, headlines = 0;
let repeats = 0, transitions = 0;
let worstStreak = 0;
let worstCategory = '';

for (let i = 0; i < RUNS; i++) {
    const sim = new Simulator(start(`PC${i}`, arenaIds[i % arenaIds.length], i % 4 === 3));
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
    lines += state.log.length;
    headlines += state.log.filter(e => e.important).length;

    const feed = state.log.filter(e => e.important && !PHASE.has(e.category ?? ''));
    let streak = 1;
    for (let k = 1; k < feed.length; k++) {
        transitions++;
        const category = feed[k].category ?? 'none';
        if (category === feed[k - 1].category) {
            repeats++;
            streak++;
            // A protected category is allowed to run: a broadcast cannot
            // decline to lead with a cannon.
            if (!STORY_PACING.neverDemoted.includes(category) && streak > worstStreak) {
                worstStreak = streak;
                worstCategory = category;
            }
        } else streak = 1;
    }
}

const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
const headlineShare = headlines / Math.max(1, lines);

console.log(`pacing: ${completed}/${RUNS} runs\n`);
console.log(`chronicle        ${(lines / Math.max(1, completed)).toFixed(0)} lines a run`);
console.log(`headlined        ${(headlines / Math.max(1, completed)).toFixed(0)} a run (${pct(headlines, lines)})`);
console.log(`category repeats the line before: ${pct(repeats, transitions)}`);
console.log(`longest demotable same-category headline run: ${worstStreak} (${worstCategory || 'none'})`);

const failures: string[] = [];
if (completed < 10) failures.push(`only ${completed} runs completed — too few to judge pacing`);
/*
 * The ceiling, and it is deliberately an absolute number rather than a
 * multiple of `STORY_PACING.sameCategoryHeadlines`.
 *
 * The first version of this guard used `sameCategoryHeadlines * 2`, and it was
 * worthless: raising that knob to 400 — switching the demotion off entirely —
 * also raised the ceiling to 800, so a 30-line wall of headlined combat sailed
 * through. A bound computed from the thing it is bounding cannot catch that
 * thing being disabled. Verified by doing exactly that and watching it pass.
 *
 * Measured, over the same 60 runs: demotion off gives a longest run of 30, the
 * shipped setting gives 6, and demoting after every single line gives 2. Twelve
 * sits clear of the working value and well under the broken one.
 */
const CEILING = 12;
if (worstStreak > CEILING) {
    failures.push(`${worstStreak} headlined \`${worstCategory}\` lines in a row against a ceiling of `
        + `${CEILING} — the demotion is not reaching the feed`);
}
/*
 * The floor, which is what a careless tightening breaches. A feed that has
 * stopped headlining anything has not been paced, it has been silenced.
 */
/*
 * Measured the same way: off headlines 43.6% of the chronicle, the shipped
 * setting 31.3%, and demoting after every line with nothing protected 19.6%.
 * A floor of 0.15 passed that last case happily, which made it no floor at
 * all; 0.25 sits between the working value and the over-demoted one.
 */
if (headlineShare < 0.25) {
    failures.push(`only ${pct(headlines, lines)} of the chronicle is headlined — the feed has been `
        + 'demoted into silence rather than paced');
}
/* And the thing this must never do. */
if (lines / Math.max(1, completed) < 500) {
    failures.push(`${(lines / Math.max(1, completed)).toFixed(0)} chronicle lines a run — events are being `
        + 'dropped, not demoted');
}

if (failures.length) {
    console.error(`\n${failures.length} pacing problem(s):`);
    failures.forEach(f => console.error(`  ${f}`));
    process.exit(1);
}
console.log('\nThe feed stops shouting without going quiet, and nothing was dropped to do it.');
