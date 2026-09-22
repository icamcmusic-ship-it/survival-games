/**
 * §16: the five intentions added after the cascade was surveyed.
 *
 * An objective kind is content: it has its own announcement, its own label in
 * three UI surfaces, its own arrival beat. Content nobody ever sees is worse
 * than absent, because it reads as shipped. This project has been bitten by
 * that specific shape twice — `wait` sat at 0.0% of 18,195 tribute-cycles for
 * an entire audit, and `stalk`, `wait` and `hold` together accounted for 5.5%
 * of all decisions while carrying a third of the objective flavour.
 *
 * So the floor is the point of this guard, and it is deliberately not a
 * statement about balance. It asserts only that each new rung is *reachable*:
 * that the situation it describes arises, that it beats whatever used to catch
 * that situation, and that the cascade does not simply consume it two rungs
 * higher. A sixth intention — sabotaging somebody else's half-built work — was
 * written, measured at 0.03 choices per run against 0.37 to 1.90 for these
 * five, and cut rather than shipped, which is what this guard exists to force.
 *
 * The ceiling matters for the same reason in reverse. A new rung placed too
 * high does not read as new content, it reads as the old behaviour going
 * missing: `court` at thirty per cent would mean the arena had quietly stopped
 * being about hunting anybody.
 *
 *   npm run test:intentions
 *   INTENTION_RUNS=200 npm run test:intentions
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState, Objective } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';

const RUNS = Number(process.env.INTENTION_RUNS ?? 60);
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];

/**
 * Share of tribute-cycles each new intention must be held in. The floors are
 * set against the incumbents rather than against a round number: `wait` sits
 * at 0.5% and `hold` at 1.4% in the same sample, so a new rung clearing 0.15%
 * is doing real work by the standard of the kinds already shipped, and one
 * below it is decoration.
 */
const FLOOR = 0.0015;
/** ...and none of them may quietly become the arena's main activity. */
const CEILING = 0.12;

const WATCHED: Array<Objective['kind']> = ['court', 'mourn', 'scavenge', 'scout', 'recover'];

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

const held: Partial<Record<Objective['kind'], number>> = {};
let tributeCycles = 0;
let completed = 0;

for (let i = 0; i < RUNS; i++) {
    const sim = new Simulator(start(`OBJ${i}`, arenaIds[i % arenaIds.length], i % 4 === 3));
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
            sim.getState().tributes.filter(t => t.status === 'alive').forEach(t => {
                tributeCycles++;
                const kind = t.objective?.kind ?? 'survive';
                held[kind] = (held[kind] ?? 0) + 1;
            });
        }
        state = sim.getState();
    }
    if (state.phase === 'ended') completed++;
}

const share = (kind: Objective['kind']) => (held[kind] ?? 0) / Math.max(1, tributeCycles);
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

console.log(`intention check: ${completed}/${RUNS} runs, ${tributeCycles} tribute-cycles\n`);
console.log('every intention held, for context:');
Object.entries(held).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
    const mark = WATCHED.includes(k as Objective['kind']) ? ' <-' : '';
    console.log(`  ${k.padEnd(10)} ${pct(n / tributeCycles).padStart(7)}${mark}`);
});

const failures: string[] = [];
if (tributeCycles < 2000) {
    failures.push(`only ${tributeCycles} tribute-cycles sampled — too few to say anything; raise INTENTION_RUNS`);
}
WATCHED.forEach(kind => {
    const s = share(kind);
    if (s < FLOOR) {
        failures.push(`\`${kind}\` held in ${pct(s)} of tribute-cycles, under the ${pct(FLOOR)} floor `
            + '— either its prerequisite does not arise or a rung above it consumes the same state');
    }
    if (s > CEILING) {
        failures.push(`\`${kind}\` held in ${pct(s)} of tribute-cycles, over the ${pct(CEILING)} ceiling `
            + '— it is displacing the behaviour it was meant to sit alongside');
    }
});

if (failures.length) {
    console.error(`\n${failures.length} intention problem(s):`);
    failures.forEach(f => console.error(`  ${f}`));
    process.exit(1);
}
console.log('\nAll five new intentions are reachable, and none has taken the arena over.');
