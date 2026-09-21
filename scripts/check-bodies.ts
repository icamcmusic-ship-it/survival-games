/**
 * REQUEST: bodies are weighted, and weighted per district and per age.
 *
 * A distribution is the one thing a positioned scene cannot check — one cast
 * says nothing about a curve — so this is a small sweep with assertions on the
 * shape rather than on any individual tribute. It exists because the shape was
 * wrong for a long time and nothing anywhere would have noticed: measured
 * before this guard, 53.7% of every cast was Broad or larger, "big" ran 76-81%
 * in *every* district (the career districts were indistinguishable from
 * District 8), and 61% of twelve-year-olds were built like adults.
 *
 * The bounds are deliberately wide. This is a guard against the shape
 * collapsing, not a pin on the exact numbers — those move whenever the age
 * bowl or the height bands move, and should be allowed to.
 */
import { initialRunState } from './runInit';
import { DEFAULT_GAME_CONFIG, ARENAS } from '../src/data/constants';
import { CONDITIONS, FRAMES } from '../src/engine/physique';
import { Tribute } from '../src/models/types';
import { scenario, check, report } from './scenarios';

const RUNS = 150;
const cast: Tribute[] = [];
for (let i = 0; i < RUNS; i++) {
    const state = initialRunState({
        seed: `BODY-${i}`,
        arenaId: ARENAS[i % ARENAS.length].id,
        config: { ...DEFAULT_GAME_CONFIG, districtCount: 12 },
    });
    cast.push(...state.tributes);
}

/**
 * The eleven-rung Build ladder, which is the thing a player actually reads off
 * a tribute sheet — `frame` and `condition` are the two axes it is derived
 * from, and a Broad frame carrying a Lean condition is rangy rather than
 * bulky. "Athletic or above" is the "strong, bulky, athletic" look.
 */
const LADDER = [
    'Skeletal', 'Frail', 'Slight', 'Wiry', 'Lean',
    'Average', 'Athletic', 'Stocky', 'Burly', 'Muscular', 'Hulking',
] as const;
const rung = (t: Tribute) => LADDER.indexOf(t.build as typeof LADDER[number]);
const isBig = (t: Tribute) => rung(t) >= LADDER.indexOf('Athletic');

const share = (of: Tribute[], pred: (t: Tribute) => boolean) =>
    of.length === 0 ? 0 : of.filter(pred).length / of.length;

const aged = (age: number) => cast.filter(t => t.age === age);
const from = (...districts: number[]) => cast.filter(t => districts.includes(t.district));

console.log(`sampled ${cast.length} reaped tributes across ${RUNS} casts`);

scenario(
    'the middle of the ladder is where most of the field is',
    'a bell with rare ends, not a ramp: "big" must be a kind of tribute rather than the default one',
    () => {
        const counts = LADDER.map(b => share(cast, t => t.build === b));
        LADDER.forEach((b, i) => { if (counts[i] > 0) console.log(`    ${b.padEnd(10)} ${(counts[i] * 100).toFixed(1)}%`); });
        const big = share(cast, isBig);
        check(big < 0.48, `Athletic and above is ${(big * 100).toFixed(1)}% of the field (ceiling 48%)`);
        const modal = counts.indexOf(Math.max(...counts));
        check(LADDER[modal] === 'Average' || LADDER[modal] === 'Lean',
            `the modal build is ${LADDER[modal]}, which should be the middle of the ladder`);
        check(counts[LADDER.indexOf('Muscular')] + counts[LADDER.indexOf('Hulking')] < 0.09,
            'Muscular and Hulking together stay rare');
        // The frame axis keeps its own ends rare, which is what stops the
        // ladder's middle being reached by two extremes cancelling out.
        const frameCounts = FRAMES.map(f => share(cast, t => t.frame === f));
        check(frameCounts[FRAMES.indexOf('Massive')] < 0.09, 'Massive frames stay rare');
        check(frameCounts[FRAMES.indexOf('Slender')] < 0.15, 'and so do Slender ones');
    },
);

scenario(
    'nobody is reaped already starving',
    'the bottom of the condition scale is somewhere the run takes you, not somewhere you start',
    () => {
        const starved = share(cast, t =>
            CONDITIONS.indexOf(t.condition!) < CONDITIONS.indexOf('Lean'));
        check(starved === 0, `${(starved * 100).toFixed(1)}% of the cast is reaped Wasted or Skeletal`);
    },
);

scenario(
    'the career districts and the labouring ones send bigger tributes',
    'District 1, 2, 4 train from childhood; 7 and 11 are timber and fields',
    () => {
        const careers = share(from(1, 2, 4), isBig);
        const indoor = share(from(3, 8, 12), isBig);
        const labour = share(from(7, 11), isBig);
        check(careers > indoor + 0.2,
            `careers ${(careers * 100).toFixed(0)}% vs indoor trades ${(indoor * 100).toFixed(0)}%`
            + ' — the difference should be unmistakable, not statistical');
        check(labour > indoor + 0.1,
            `labouring districts ${(labour * 100).toFixed(0)}% vs indoor ${(indoor * 100).toFixed(0)}%`);
        check(careers >= labour, 'and an academy beats a field');
    },
);

scenario(
    'a twelve-year-old built like an adult is very rare, and a Massive one impossible',
    'it should be very rare for younger tributes to be these types',
    () => {
        const young = share([...aged(12), ...aged(13)], isBig);
        const old = share(aged(18), isBig);
        check(young < 0.08, `${(young * 100).toFixed(0)}% of twelve- and thirteen-year-olds are Athletic or above (ceiling 8%)`);
        check(old > 0.45, `${(old * 100).toFixed(0)}% of eighteen-year-olds are (floor 45%)`);
        // The cap, not the pull: a bias big enough to carry an eighteen-year-old
        // to the top rung must not carry a child there with it.
        const twelve = aged(12);
        check(twelve.length > 0, 'the sample has twelve-year-olds in it at all');
        check(twelve.every(t => FRAMES.indexOf(t.frame!) <= FRAMES.indexOf('Even')),
            'no twelve-year-old is Broad or larger');
        check(twelve.every(t => CONDITIONS.indexOf(t.condition!) <= CONDITIONS.indexOf('Conditioned')),
            'and none is Padded or heavier');
    },
);

scenario(
    'the age curve is monotonic',
    'six years should be a gradient, not a step',
    () => {
        const byAge = [12, 13, 14, 15, 16, 17, 18].map(a => ({ a, big: share(aged(a), isBig) }));
        byAge.forEach(({ a, big }) => console.log(`    age ${a}: ${(big * 100).toFixed(0)}% big`));
        for (let i = 1; i < byAge.length; i++) {
            check(byAge[i].big >= byAge[i - 1].big - 0.03,
                `age ${byAge[i].a} (${(byAge[i].big * 100).toFixed(0)}%) is not below `
                + `age ${byAge[i - 1].a} (${(byAge[i - 1].big * 100).toFixed(0)}%)`);
        }
    },
);

process.exitCode = report('body distribution') === 0 ? 0 : 1;
