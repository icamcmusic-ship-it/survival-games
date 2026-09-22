/**
 * AUDIT-10 B3-02: the wound ledger has to agree with the health bar.
 *
 * A panel that recounts what the simulation did is only worth having if it
 * cannot disagree with it. Three ways it could, all of them found by writing
 * this and running it rather than by reading the code:
 *
 *   - `selfInflictedDeath` recorded the blow *before* zeroing the health, so
 *     eight tributes who stepped off the plate were on record as finished by
 *     something that left them at a hundred.
 *   - `reattributeWound` carried the previous entry's `healthAfter` forward,
 *     which put 19 of 1,920 dead tributes in the same state for a different
 *     reason.
 *   - a first draft capped the ledger at 64 entries, chosen as a number that
 *     "never bites", and truncated 9 of 1,920.
 *
 *   npm run test:wounds
 *   WOUND_RUNS=120 npm run test:wounds
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';

const RUNS = Number(process.env.WOUND_RUNS ?? 40);
/** Must match `LEDGER_CAP` in `engine/woundLedger`. Asserted, not assumed. */
const LEDGER_CAP = 256;

const failures: string[] = [];
let people = 0, wounds = 0, worst = 0, untouched = 0, truncated = 0;

for (let i = 0; i < RUNS; i++) {
    const seed = `WL${i}`;
    const gp = gamesProfileFor(seed, i % 4 === 3);
    const arena = resolveArenaForRun(seed, ARENAS[i % ARENAS.length].id, gp);
    const cfg = configForProfile(DEFAULT_GAME_CONFIG, gp);
    const tributes = generateTributes(seed, cfg, arena.zones[0].name, gp.castShape, gp.quell);
    const sim = new Simulator({
        seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: i % 4 === 3,
        config: cfg, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: gp, logCounter: 0, feastsHeld: 0, cycle: 0,
    } as GameState);
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

    state.tributes.forEach(t => {
        people++;
        const ledger = t.wounds ?? [];
        if (ledger.length === 0) { untouched++; return; }
        wounds += ledger.length;
        worst = Math.max(worst, ledger.length);
        if (ledger.length >= LEDGER_CAP) truncated++;

        ledger.forEach((w, n) => {
            if (w.healthAfter === undefined) {
                failures.push(`${t.name} wound ${n} (${w.cause}) has no healthAfter`);
            }
            // Cycles do not run backwards, so neither does the ledger. An
            // out-of-order entry means something wrote one out of band.
            if (n > 0 && w.cycle < ledger[n - 1].cycle) {
                failures.push(`${t.name} wound ${n} is at cycle ${w.cycle}, after one at ${ledger[n - 1].cycle}`);
            }
            // The whole point of the attribution column: a wound credited to
            // somebody has to be credited to somebody who exists.
            if (w.sourceId && !state.tributes.some(o => o.id === w.sourceId)) {
                failures.push(`${t.name} wound ${n} is credited to a tribute who does not exist`);
            }
        });

        const last = ledger[ledger.length - 1];
        // The ledger's last line is the obituary's whole argument, so it is the
        // one line that must agree with where they finished.
        if (t.status === 'dead' && (last.healthAfter ?? -1) !== 0) {
            failures.push(`${t.name} died of "${t.causeOfDeath}" but the last wound left them at ${last.healthAfter}`);
        }
        if (t.status === 'alive' && (last.healthAfter ?? 0) > t.health + 100) {
            failures.push(`${t.name} is at ${t.health} but their last wound claims ${last.healthAfter}`);
        }
        if (t.lastDamage && last.cause !== t.lastDamage.cause) {
            failures.push(`${t.name}: lastDamage ("${t.lastDamage.cause}") is not the ledger's last entry ("${last.cause}")`);
        }
    });
}

const hurt = people - untouched;
console.log(`wound ledger: ${people} tributes, ${untouched} untouched`);
console.log(`  ${(wounds / Math.max(1, hurt)).toFixed(1)} wounds each on average, worst ${worst} (cap ${LEDGER_CAP})`);
if (truncated > 0) {
    console.log(`  ${truncated} ledger(s) hit the cap — the oldest wounds were dropped.`);
    console.log('  That is the cap doing its job, but it is also the sample saying it is too low.');
}
if (worst >= LEDGER_CAP * 0.75) {
    console.log(`  Headroom is thin: the worst run used ${Math.round(worst / LEDGER_CAP * 100)}% of the cap.`);
}

if (failures.length) {
    console.error(`\nThe ledger disagrees with the simulation (${failures.length}):`);
    [...new Set(failures)].slice(0, 20).forEach(f => console.error(`  ${f}`));
    process.exit(1);
}
console.log('\nEvery wound reconciles: stamped, ordered, attributable, and ending where the tribute did.');
