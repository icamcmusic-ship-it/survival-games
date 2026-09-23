/**
 * AUDIT-10 B3-03: an achievement must not depend on how much chronicle survived.
 *
 * `writeSave` writes the whole log, and falls back through 4,000 / 2,000 / 800
 * / 200-line tails when localStorage refuses the payload. So a run saved and
 * resumed on a full disk loses its opening days — and any predicate that reads
 * `state.log` can lose an achievement the player earned on day two along with
 * them. That is not a rewording hazard, which is the one the audit names; it is
 * a *storage* hazard, and it applies to a typed `e.type === 'obligation-kept'`
 * read exactly as much as to a regular expression over prose.
 *
 * This replays finished runs against the same trim ladder the save uses and
 * asserts that the achievements which were migrated onto typed milestones are
 * unmoved by it. Everything still reading the chronicle is *reported* rather
 * than failed: there are two dozen of them, migrating them is the rest of this
 * work item's descendants, and a guard that fails on the known backlog is a
 * guard somebody disables on day one.
 *
 *   npm run test:milestones
 *   MILESTONE_RUNS=200 npm run test:milestones
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { ACHIEVEMENTS } from '../src/data/achievements';

const RUNS = Number(process.env.MILESTONE_RUNS ?? 60);

/** The ladder from `gameStore.writeSave`, shortest tail last. */
const LOG_TAIL_FALLBACKS = [4000, 2000, 800, 200];

/**
 * The entries B3-03 moved onto `state.milestones`. Named rather than detected,
 * because "does this predicate read the log" is a question about a closure and
 * the honest way to ask it is to trim the log and look.
 */
const MIGRATED = ['wildfire', 'lone-wolf', 'three-fingers', 'the-tended', 'the-perimeter', 'the-restocked-horn', 'the-whole-menagerie',
    // AUDIT-10 §12 requires save/resume coverage for every new achievement.
    // These three read typed milestones rather than the chronicle, so a
    // trimmed log must not move them.
    'the-returned', 'the-high-ground', 'who-really-cut-it', 'mercy-withdrawn'];

const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];

function start(seed: string, arenaId: string, gamemaker: boolean): GameState {
    const gamesProfile = gamesProfileFor(seed, seed.endsWith('7'));
    const arena = resolveArenaForRun(seed, arenaId, gamesProfile);
    const resolved = configForProfile(DEFAULT_GAME_CONFIG, gamesProfile);
    const tributes = generateTributes(seed, resolved, arena.zones[0].name, gamesProfile.castShape, gamesProfile.quell);
    return {
        seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: gamemaker,
        config: resolved, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile, logCounter: 0, feastsHeld: 0, cycle: 0,
    };
}

function play(seed: string, arenaId: string, gamemaker: boolean): GameState | undefined {
    const sim = new Simulator(start(seed, arenaId, gamemaker));
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
    return state.phase === 'ended' ? state : undefined;
}

function earned(state: GameState): Set<string> {
    const victor = state.tributes.find(t => t.status === 'alive');
    const out = new Set<string>();
    ACHIEVEMENTS.forEach(a => {
        try { if (a.test(state, victor)) out.add(a.id); } catch { /* crash-tested by test:achievements */ }
    });
    return out;
}

/** id -> the shortest tail at which it changed answer, and which way. */
const lost = new Map<string, { at: number; runs: number }>();
const gained = new Map<string, { at: number; runs: number }>();
let completed = 0;
let trimmedRuns = 0;
let milestonesSeen = 0;

for (let i = 0; i < RUNS; i++) {
    const state = play(`MS${i}`, arenaIds[i % arenaIds.length], i % 4 === 3);
    if (!state) continue;
    completed++;
    milestonesSeen += Object.keys(state.milestones ?? {}).length;
    const full = earned(state);
    let sawTrim = false;
    for (const cap of LOG_TAIL_FALLBACKS) {
        if (state.log.length <= cap) continue;
        sawTrim = true;
        // The same shape `writeSave` persists: everything but the chronicle,
        // which keeps only its tail.
        const short = earned({ ...state, log: state.log.slice(-cap) });
        full.forEach(id => { if (!short.has(id)) note(lost, id, cap); });
        short.forEach(id => { if (!full.has(id)) note(gained, id, cap); });
    }
    if (sawTrim) trimmedRuns++;
}

function note(into: Map<string, { at: number; runs: number }>, id: string, cap: number) {
    const seen = into.get(id);
    if (!seen) { into.set(id, { at: cap, runs: 1 }); return; }
    seen.at = Math.max(seen.at, cap);   // the *longest* tail that already broke it
    seen.runs += 1;
}

console.log(`milestone check: ${completed} completed runs, ${trimmedRuns} long enough to trim`);
console.log(`typed milestones recorded: ${(milestonesSeen / Math.max(1, completed)).toFixed(1)} kinds per run`);

if (trimmedRuns === 0) {
    console.log('\nNo run produced a chronicle longer than 200 lines, so nothing was trimmed.');
    console.log('That is a finding about the sample, not a pass — raise MILESTONE_RUNS.');
    process.exit(1);
}

const failures: string[] = [];
for (const id of MIGRATED) {
    const l = lost.get(id), g = gained.get(id);
    if (l) failures.push(`${id}: earned on the full chronicle, not on a ${l.at}-line tail (${l.runs} runs)`);
    if (g) failures.push(`${id}: earned only once the chronicle was cut to ${g.at} lines (${g.runs} runs)`);
}

const affected = new Set([...lost.keys(), ...gained.keys()]);
const backlog = [...affected].filter(id => !MIGRATED.includes(id)).sort();
if (backlog.length) {
    console.log(`\nstill hostage to log trimming (${backlog.length}) — the rest of B3-03's worklist:`);
    backlog.slice(0, 20).forEach(id => {
        const l = lost.get(id), g = gained.get(id);
        console.log(`  ${id.padEnd(32)} ${l ? `lost at ${l.at} (${l.runs}x)` : ''}${g ? ` gained at ${g.at} (${g.runs}x)` : ''}`);
    });
    if (backlog.length > 20) console.log(`  ... and ${backlog.length - 20} more`);
} else {
    console.log('\nNo achievement in the catalogue changes answer when the chronicle is trimmed.');
}

if (failures.length) {
    console.error('\nMigrated achievements must not depend on the surviving chronicle:');
    failures.forEach(f => console.error(`  ${f}`));
    process.exit(1);
}
console.log(`\nAll ${MIGRATED.length} migrated achievements answer identically at every tail length.`);
