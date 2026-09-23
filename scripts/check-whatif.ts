/**
 * AUDIT-10 §11.8: the counterfactual debrief has to be a counterfactual.
 *
 * `engine/whatIf.ts` branches a finished Games from one of its checkpoints by
 * re-rolling a single phase. The debrief is only worth reading if four things
 * hold, and each is checked here against real Games:
 *
 *   1. Determinism. A branch with no salt replays the Games that happened —
 *      same victor, same day, same chronicle length. Without this, any
 *      difference a salted branch shows could be the harness, not the dice.
 *   2. Isolation. Playing a branch never touches the checkpoint it started
 *      from; the debrief runs off the store's live rewind stack.
 *   3. The seed comes back. Only the one re-rolled phase draws from the
 *      salted seed; a branch that kept it would be re-rolling the rest of the
 *      Games too, which is a different (and much less interesting) question.
 *   4. It says something. The Games should firm up as it goes: re-rolling
 *      a late phase keeps the victor far more often than re-rolling an early
 *      one, and at the late checkpoint some Games are settled (every branch
 *      agrees) while others are still open. A debrief whose answer never
 *      varies is not telling the player anything about *their* Games.
 *
 *      Measured, 30 Games: 14.6% of early branches kept the victor against
 *      71.7% late, and the late verdicts spread from 0/8 to 8/8 (eleven
 *      settled, six at two or fewer). "Any branch differed" was the first
 *      draft of this assertion and is useless — from day two, with twenty
 *      alive, one of eight re-rolls almost always crowns somebody else.
 *
 *   npm run test:whatif
 *   WHATIF_RUNS=60 npm run test:whatif
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { snapshotState } from '../src/utils/snapshot';
import { BRANCHABLE, playBranch, whatIf } from '../src/engine/whatIf';

const RUNS = Number(process.env.WHATIF_RUNS ?? 30);
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];

function start(seed: string, arenaId: string): GameState {
    const gp = gamesProfileFor(seed, false);
    const arena = resolveArenaForRun(seed, arenaId, gp);
    const cfg = configForProfile(DEFAULT_GAME_CONFIG, gp);
    return {
        seed, arena, tributes: generateTributes(seed, cfg, arena.zones[0].name, gp.castShape, gp.quell),
        phase: 'setup', day: 0, log: [], gamemakerMode: false, config: cfg, baseConfig: DEFAULT_GAME_CONFIG,
        gamesProfile: gp, logCounter: 0, feastsHeld: 0, cycle: 0,
    };
}

const victors = (s: GameState) => s.tributes.filter(t => t.status === 'alive').map(t => t.id).sort().join(',');
const failures: string[] = [];
let games = 0, replayed = 0;
let earlySame = 0, lateSame = 0, branchesEach = 0;
const earlyDist: Record<number, number> = {}, lateDist: Record<number, number> = {};

for (let i = 0; i < RUNS; i++) {
    const sim = new Simulator(start(`WI${i}`, arenaIds[i % arenaIds.length]));
    const checkpoints: GameState[] = [];
    let guard = 400;
    do {
        const s = sim.getState();
        if (BRANCHABLE.has(s.phase)) checkpoints.push(snapshotState(s));
    } while (guard-- > 0 && sim.advance());
    const actual = sim.getState();
    if (checkpoints.length < 2) continue;
    games++;

    // (1) + (2): replay from the middle checkpoint, unsalted.
    const mid = checkpoints[Math.floor(checkpoints.length / 2)];
    const before = JSON.stringify(mid);
    const replay = playBranch(mid);
    if (JSON.stringify(mid) !== before) failures.push(`WI${i}: playing a branch mutated its checkpoint`);
    if (victors(replay) !== victors(actual) || replay.day !== actual.day || replay.log.length !== actual.log.length) {
        failures.push(`WI${i}: an unsalted replay diverged (victor ${victors(replay)} vs ${victors(actual)}, `
            + `day ${replay.day} vs ${actual.day}, log ${replay.log.length} vs ${actual.log.length})`);
    } else {
        replayed++;
    }

    // (3): the salted seed does not outlive the phase it re-rolled.
    const branch = playBranch(mid, 'probe');
    if (branch.seed !== mid.seed) failures.push(`WI${i}: a branch finished on seed '${branch.seed}', not '${mid.seed}'`);

    // (4): early and late.
    const early = whatIf(checkpoints[Math.min(2, checkpoints.length - 1)], actual);
    const late = whatIf(checkpoints[checkpoints.length - 2], actual);
    earlySame += early.sameOutcome; lateSame += late.sameOutcome; branchesEach += early.branches.length;
    lateDist[late.sameOutcome] = (lateDist[late.sameOutcome] ?? 0) + 1;
    earlyDist[early.sameOutcome] = (earlyDist[early.sameOutcome] ?? 0) + 1;
}

console.log(`what-if: ${games}/${RUNS} Games with branchable checkpoints`);
console.log(`  unsalted replays that reproduced the Games exactly: ${replayed}/${games}`);
console.log(`  same victor, early checkpoint: ${(100 * earlySame / Math.max(1, branchesEach)).toFixed(1)}% of branches  ${JSON.stringify(earlyDist)}`);
console.log(`  same victor, last-but-one:     ${(100 * lateSame / Math.max(1, branchesEach)).toFixed(1)}% of branches  ${JSON.stringify(lateDist)}`);

if (games < 10) failures.push(`only ${games} Games had checkpoints to branch from — too few to judge`);
const earlyRate = earlySame / Math.max(1, branchesEach);
const lateRate = lateSame / Math.max(1, branchesEach);
if (lateRate < earlyRate + 0.3) {
    failures.push(`a late re-roll kept the victor ${(100 * lateRate).toFixed(1)}% of the time against `
        + `${(100 * earlyRate).toFixed(1)}% early — the Games is not firming up, so the debrief cannot tell `
        + 'a settled ending from an open one');
}
const settled = lateDist[branchesEach / Math.max(1, games)] ?? 0;
const open = Object.entries(lateDist).filter(([k]) => Number(k) <= 2).reduce((a, [, v]) => a + v, 0);
if (settled === 0 || open === 0) {
    failures.push(`late verdicts do not vary (${settled} settled, ${open} open of ${games}) — every debrief would read the same`);
}

if (failures.length > 0) {
    console.log(`\n${failures.length} what-if problem(s):`);
    failures.slice(0, 12).forEach(f => console.log(`  ${f}`));
    process.exit(1);
}
console.log('\nA branch replays exactly when left alone and differs only by the phase it re-rolls.');
