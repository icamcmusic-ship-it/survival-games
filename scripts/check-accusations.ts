/**
 * §16 / AUDIT-10 B5-01: witnessed events as private, suspected or proven.
 *
 * Every ingredient for this existed and none of them was it. `applyDeathFallout`
 * worked out whether an observer saw the kill, pieced it together from the next
 * zone, or pinned it on the wrong person — and kept all three as local booleans
 * that died with the call. `suspicion` is graded and persistent but is about a
 * *person*, so nothing could ask what A suspects B *of*. `rumours` are the only
 * proposition with a truth value and a planter, and they are only ever about a
 * zone. A tribute who watched a killing could not tell anybody.
 *
 * The raw material was measured first: 5.95 deed-beliefs held per cycle across
 * the field, 6.4% of them already naming somebody with no kills at all, and
 * 61.9% of co-present living pairs holding an asymmetry. Against the 0.7
 * zone-rumours a run that were the only existing channel.
 *
 * Abundance is the danger, not the reassurance — the same shape as noise. A
 * claim that spreads without friction produces an arena where everyone hates
 * the same person by day three, and the guards below are mostly about that:
 *
 *   - `proven` must stay rarer than `suspected`, or corroboration means nothing
 *   - the field must not converge on one universally-accused tribute
 *   - false claims must exist, because misattribution is a feature
 *   - ...and must stay a minority, or the accusation layer is just noise
 *
 *   npm run test:accusations
 *   ACCUSATION_RUNS=120 npm run test:accusations
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { ensureMemory } from '../src/engine/memory';
import { createContext } from '../src/engine/context';
import { RNG } from '../src/utils/rng';
import { correctAccusations } from '../src/engine/accusations';

const RUNS = Number(process.env.ACCUSATION_RUNS ?? 40);
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

const level = { private: 0, suspected: 0, proven: 0 };
let held = 0, falseHeld = 0, falseProven = 0, completed = 0;
let aliveSamples = 0;
/** The most-accused tribute in each run, as a share of the living field. */
let worstShareSum = 0, worstRuns = 0;

for (let i = 0; i < RUNS; i++) {
    const sim = new Simulator(start(`AC${i}`, arenaIds[i % arenaIds.length], i % 4 === 3));
    let guard = 3000;
    let state = sim.getState();
    let worstShare = 0;
    while (state.phase !== 'ended' && guard-- > 0) {
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') sim.processBloodbath();
        else if (state.phase === 'epilogue') { state.phase = 'ended'; }
        else {
            if (!sim.processTurn()) break;
            const s = sim.getState();
            const alive = s.tributes.filter(t => t.status === 'alive');
            aliveSamples += alive.length;
            const accusedCount = new Map<string, number>();
            alive.forEach(t => {
                const acc = ensureMemory(t).accusations;
                if (!acc) return;
                Object.entries(acc).forEach(([accusedId, claim]) => {
                    held++;
                    level[claim.level]++;
                    if (!claim.isTrue) {
                        falseHeld++;
                        if (claim.level === 'proven') falseProven++;
                    }
                    accusedCount.set(accusedId, (accusedCount.get(accusedId) ?? 0) + 1);
                });
            });
            /*
             * Only while there is a field to speak of. A peak share taken with
             * three tributes alive is arithmetic rather than opinion — one
             * accuser out of two survivors reads as 50% and says nothing about
             * whether claims are spreading too freely. The first version of
             * this guard used `> 2` and reported 75.3%, most of which was the
             * endgame's small denominators.
             */
            if (alive.length >= 6 && accusedCount.size > 0) {
                const worst = Math.max(...accusedCount.values());
                worstShare = Math.max(worstShare, worst / alive.length);
            }
        }
        state = sim.getState();
    }
    if (state.phase === 'ended') {
        completed++;
        if (worstShare > 0) { worstShareSum += worstShare; worstRuns++; }
    }
}

const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
const provenShare = level.proven / Math.max(1, held);
const falseShare = falseHeld / Math.max(1, held);
const worstAvg = worstShareSum / Math.max(1, worstRuns);

console.log(`accusation check: ${completed}/${RUNS} runs\n`);
console.log(`beliefs held (tribute-cycles): ${held}, ${(held / Math.max(1, aliveSamples)).toFixed(2)} per living tribute-cycle`);
console.log(`  private   ${pct(level.private, held)}   (seen, said to nobody yet)`);
console.log(`  suspected ${pct(level.suspected, held)}   (one mouth)`);
console.log(`  proven    ${pct(level.proven, held)}   (two independent mouths, or their own eyes said out loud)`);
console.log(`false claims: ${pct(falseHeld, held)} of beliefs; ${pct(falseProven, Math.max(1, level.proven))} of proven ones`);
console.log(`worst-accused tribute, peak share of the living field: ${pct(worstAvg, 1)} (mean over runs)`);

const failures: string[] = [];
if (held === 0) failures.push('nobody ever held an accusation — the layer is wired to nothing');
if (level.suspected === 0) failures.push('nothing was ever passed on — accusations never leave the witness');
if (level.proven === 0) failures.push('nothing was ever corroborated — the second mouth never arrives');
/* Corroboration has to be the harder state or the distinction is decorative. */
if (held > 0 && provenShare > 0.5) {
    failures.push(`${pct(level.proven, held)} of beliefs are 'proven' — corroboration is too easy to mean anything`);
}
/* The mob ceiling: the whole field must not converge on one name. */
if (worstRuns > 0 && worstAvg > 0.8) {
    failures.push(`the most-accused tribute is believed guilty by ${pct(worstAvg, 1)} of the living field `
        + '— accusations have collapsed into a lynch mob');
}
/* Misattribution is a feature; it must survive, and must not dominate. */
if (held > 0 && falseHeld === 0) {
    failures.push('every belief in the arena is true — misattribution is not reaching this layer');
}
if (held > 0 && falseShare > 0.5) {
    failures.push(`${pct(falseHeld, held)} of beliefs are false — the layer is carrying more noise than signal`);
}

/*
 * AUDIT-10 §12 requires a positive fixture and a near-miss fixture for a new
 * achievement, and the aggregate rates above are neither: they say the beat
 * happens, not that it happens for the reason claimed. These two construct
 * the exact state and assert the correction fires on one and declines on the
 * other.
 *
 * The near-miss is the one that matters. Holding a told claim and a
 * first-hand claim at the same time is common; what licenses a correction is
 * that they are about the *same victim*. A rule that fired on any two claims
 * would look identical in the aggregate and be wrong.
 */
function fixtures(): string[] {
    const problems: string[] = [];
    const build = (toldVictim: string, seenVictim: string) => {
        const state = start('FIXTURE', arenaIds[0], false);
        const [holder, accused, realKiller] = state.tributes;
        const mem = ensureMemory(holder);
        mem.accusations = {
            [accused.id]: { victimId: toldVictim, level: 'suspected', toldBy: ['someone'], isTrue: false, cycle: 1 },
            [realKiller.id]: { victimId: seenVictim, level: 'private', toldBy: [], isTrue: true, cycle: 1 },
        };
        state.phase = 'day';
        const ctx = createContext(state, new RNG('fixture'));
        correctAccusations(ctx);
        return { holder, accusedId: accused.id, state };
    };
    // Positive: both claims name the same victim, so the eyes win.
    const victim = 'v1';
    const pos = build(victim, victim);
    if (ensureMemory(pos.holder).accusations?.[pos.accusedId]) {
        problems.push('positive fixture: a told claim contradicted by first-hand sight of the same killing survived');
    }
    if (!(pos.state.milestones ?? {})['accusation-corrected']) {
        problems.push('positive fixture: the correction left no typed evidence');
    }
    // Near miss: different victims, so there is no contradiction to resolve.
    const near = build('v1', 'v2');
    if (!ensureMemory(near.holder).accusations?.[near.accusedId]) {
        problems.push('near-miss fixture: a told claim was overturned by sight of an unrelated killing');
    }
    return problems;
}
failures.push(...fixtures());

if (failures.length) {
    console.error(`\n${failures.length} accusation problem(s):`);
    failures.forEach(f => console.error(`  ${f}`));
    process.exit(1);
}
console.log('\nClaims travel, corroboration is harder than hearsay, and the arena has not turned into a mob.');
