/**
 * REQUEST: how a Games ends.
 *
 *   "too many victors walk out with 1% health"
 *   "too many final deaths before victor is crowned do not end in a show down,
 *    this needs to happen most of the time"
 *
 * Both are distributions rather than propositions about one run, so this is a
 * sweep with assertions on the shape — the same instrument as `check-bodies`,
 * and for the same reason: nothing else in the suite could have noticed either.
 *
 * Measured before the repairs, over 150 runs: the 25th percentile of victor
 * health was *exactly 1*, 36% of victors were crowned at five or below, and
 * the last death of the Games was the victor's own kill 76.7% of the time.
 */
import { initialRunState } from './runInit';
import { Simulator } from '../src/engine/simulator';
import { DEFAULT_GAME_CONFIG, ARENAS } from '../src/data/constants';
import { deathCodeOf } from '../src/engine/causes';
import { Tribute } from '../src/models/types';
import { scenario, check, report } from './scenarios';

const RUNS = 120;
const victorHealth: number[] = [];
const atCannon: number[] = [];
let showdowns = 0, decided = 0;

for (let i = 0; i < RUNS; i++) {
    let state = initialRunState({
        seed: `END-${i}`,
        arenaId: ARENAS[i % ARENAS.length].id,
        config: DEFAULT_GAME_CONFIG,
    });
    const sim = new Simulator(state);
    let guard = 3000;
    while (state.phase !== 'ended' && guard-- > 0) {
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') sim.processBloodbath();
        else if (state.phase === 'epilogue') state.phase = 'ended';
        else if (!sim.processTurn()) break;
        state = sim.getState();
    }
    const victors = state.tributes.filter(t => t.status === 'alive');
    if (victors.length === 0) continue;
    decided++;
    victors.forEach(v => {
        victorHealth.push(v.health);
        atCannon.push(v.healthAtLastCannon ?? v.health);
    });
    const last = state.tributes
        .filter(t => t.status === 'dead')
        // The recorded elimination order, not `dayOfDeath`: two tributes who
        // fall on the same day are indistinguishable by day, and the last death
        // of a Games very often shares a day with the one before it.
        .sort((a, b) => (b.eliminationIndex ?? -1) - (a.eliminationIndex ?? -1))[0] as Tribute | undefined;
    if (last && deathCodeOf(last) === 'tribute'
        && victors.some(v => last.lastDamage?.sourceId === v.id)) showdowns++;
}

const sorted = [...victorHealth].sort((a, b) => a - b);
const pctile = (p: number) => sorted[Math.floor(sorted.length * p)];
const share = (pred: (v: number) => boolean) =>
    victorHealth.filter(pred).length / Math.max(1, victorHealth.length);

console.log(`${decided} decided Games, ${victorHealth.length} crowned`);
console.log(`  victor health   p10 ${pctile(0.1)}  p25 ${pctile(0.25)}  p50 ${pctile(0.5)}`
    + `  p75 ${pctile(0.75)}  p90 ${pctile(0.9)}`);
console.log(`  the last death was the victor's own kill in ${(100 * showdowns / decided).toFixed(1)}% of Games`);

scenario(
    'a victor is not crowned at one health',
    'the Capitol retrieves a victor before the crown; it does not put a dying person on camera',
    () => {
        check(share(v => v <= 5) < 0.02,
            `${(share(v => v <= 5) * 100).toFixed(1)}% of victors are crowned at five health or below`);
        check(pctile(0.25) > 10, `the 25th percentile of victor health is ${pctile(0.25)}`);
    },
);

scenario(
    'and is not handed a full recovery either',
    'the retrieval is stabilisation, not a cure — a Games that nearly killed somebody should show',
    () => {
        check(pctile(0.5) < 70, `the median victor is at ${pctile(0.5)}, which is too comfortable`);
        check(share(v => v >= 95) < 0.15, 'few victors walk out untouched');
        // The arena's own number is still recorded, and is still brutal.
        const rough = atCannon.filter(v => v <= 5).length / Math.max(1, atCannon.length);
        check(rough > 0.1,
            `only ${(rough * 100).toFixed(0)}% of victors were at five or below when the cannon went`
            + ' — the last fight should still be able to nearly kill them');
    },
);

scenario(
    'the Games usually ends with the victor killing the runner-up',
    'the last death should be a showdown most of the time',
    () => {
        const rate = showdowns / Math.max(1, decided);
        check(rate > 0.8, `the last death was the victor's own kill in only ${(rate * 100).toFixed(1)}% of Games`);
    },
);

process.exitCode = report('endgame shape') === 0 ? 0 : 1;
