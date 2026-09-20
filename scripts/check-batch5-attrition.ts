/**
 * The attrition dial: how hard the body is on a tribute.
 *
 * Roughly 27% of deaths in a default Games are `status` — starvation, thirst,
 * infection, sepsis, hypothermia, exhaustion, venom, a wound that will not
 * close — and nobody did any of them to anybody. `attritionRate` is the dial
 * for that, and these are the propositions it has to hold to:
 *
 *   - it actually changes the number of those deaths, monotonically;
 *   - 0 means none of them, and is a legal setting rather than a crash;
 *   - it does not touch deaths anybody *did* to anybody, which is the whole
 *     point of having a separate dial;
 *   - a Games at any setting still finishes.
 */
import { scenario, check, eq, report } from './scenarios';
import { initialRunState } from './runInit';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { Simulator } from '../src/engine/simulator';
import { GameState } from '../src/models/types';

/** Status vs tribute-dealt deaths across a small sweep at one setting. */
function sweep(rate: number, runs = 40): { status: number; tribute: number; days: number; finished: number } {
    let status = 0, tribute = 0, days = 0, finished = 0;
    for (let i = 0; i < runs; i++) {
        const sim = new Simulator(initialRunState({
            seed: `attr-${rate}-${i}`,
            arenaId: ARENAS[i % ARENAS.length].id,
            config: { ...DEFAULT_GAME_CONFIG, attritionRate: rate },
        }));
        let n = 0;
        while (!sim.isFinished() && n++ < 400) sim.advance();
        const s: GameState = sim.getState();
        days += s.day;
        if (['epilogue', 'ended'].includes(s.phase)) finished++;
        s.tributes.filter(t => t.status === 'dead').forEach(t => {
            if (t.lastDamage?.kind === 'status') status++;
            if (t.lastDamage?.kind === 'tribute') tribute++;
        });
    }
    return { status, tribute, days, finished };
}

const off = sweep(0);
const half = sweep(0.5);
const normal = sweep(1);
const double = sweep(2);

console.log('the attrition dial');
console.log(`   0.0x  status ${off.status}  tribute ${off.tribute}  days ${(off.days / 40).toFixed(1)}`);
console.log(`   0.5x  status ${half.status}  tribute ${half.tribute}  days ${(half.days / 40).toFixed(1)}`);
console.log(`   1.0x  status ${normal.status}  tribute ${normal.tribute}  days ${(normal.days / 40).toFixed(1)}`);
console.log(`   2.0x  status ${double.status}  tribute ${double.tribute}  days ${(double.days / 40).toFixed(1)}`);

scenario(
    'turning it down reduces deaths from wounds, illness and exposure',
    'a dial that does not move the thing it names is a decoration',
    () => {
        check(half.status < normal.status,
            `0.5x produces fewer status deaths than 1.0x (${half.status} vs ${normal.status})`);
        check(normal.status < double.status,
            `2.0x produces more than 1.0x (${double.status} vs ${normal.status})`);
    },
);

scenario(
    'at zero, nothing natural kills anybody through the damage system',
    'a legal setting, for an arena where the only thing that kills you is another tribute',
    () => {
        /*
         * Not exactly zero: nightlock and the downed clock write a `status`
         * record without passing through `applyDamage`, because neither is
         * attrition — one is a choice and the other is a timer. The assertion
         * is that the attritional part is gone, not that the field is
         * immortal.
         */
        check(off.status < normal.status * 0.25,
            `0x leaves only the non-attritional remainder (${off.status} against ${normal.status})`);
    },
);

scenario(
    'it does not touch deaths somebody caused',
    'the entire reason this is a separate dial from hazard rate',
    () => {
        // Tribute-dealt deaths rise slightly when nothing else is killing
        // people, because there are more tributes left alive to do it. The
        // assertion is that the dial does not *suppress* them.
        check(off.tribute >= normal.tribute * 0.8,
            `combat deaths are not suppressed by it (${off.tribute} at 0x against ${normal.tribute} at 1x)`);
    },
);

scenario(
    'a Games still finishes at either extreme',
    'a setting that produces an arena nobody can win is not a setting',
    () => {
        eq(off.finished, 40, 'every run at 0x reaches an ending');
        eq(double.finished, 40, 'every run at 2x reaches an ending');
    },
);

scenario(
    'the default is unchanged, so the balance baseline still means something',
    'batch 3 was tuned against 1.0; moving the default would silently re-tune every indicator in it',
    () => {
        eq(DEFAULT_GAME_CONFIG.attritionRate, 1.0, 'default is 1.0');
    },
);

process.exit(report('AUDIT-9 batch 5 attrition dial') ? 1 : 0);
