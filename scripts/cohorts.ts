/**
 * AUDIT-10 B4-01: matched cohorts — a counterfactual you can defend.
 *
 * §8 of the audit is emphatic that the archetype and trait rankings in
 * `metrics.ts` are not causal estimates. District, arena, preferred traits,
 * age, body, starting kit and who else is in the field all move a win rate, and
 * every one of them is correlated with archetype: Careers are District 1, 2 and
 * 4, they are older, they are bigger, and they start beside the horn. A table
 * that reads "Career 11.0%, Tracker 3.5%" is comparing two populations, not two
 * archetypes.
 *
 * The fix is the oldest one there is: change one thing and hold the rest still.
 *
 * What "matched" can honestly mean here
 * -------------------------------------
 *
 * The plan's own warning is the important part: *"a shared seed alone is not a
 * clean counterfactual if an earlier branch consumes different draws"*. It is
 * worth being exact about why, because the temptation is to believe the seed
 * does more work than it does.
 *
 * Running the same seed twice with one tribute's archetype swapped gives two
 * runs that are identical until the first decision that archetype touches — and
 * from that moment the shared stream is worthless. The swapped tribute takes a
 * different action, the draw count diverges, and every subsequent number in
 * both runs is drawn from a different position. By cycle three the two runs are
 * no more related than two arbitrary seeds.
 *
 * So the seed does not make the *runs* comparable. It makes the *starting
 * conditions* identical, which is a smaller claim and the true one: same arena,
 * same field, same kit, same everything except the one attribute under test.
 * That is a randomised experiment with the randomisation done for us, and the
 * estimate it supports is the average difference over many such pairs — not
 * the difference within any one pair, which is noise wearing a lab coat.
 *
 * Two things follow, and both are built in here:
 *
 *   1. The statistic is the *paired* difference across seeds, with an interval.
 *      Reporting two separate rates and eyeballing the gap throws away the
 *      pairing, which is the only thing that makes this cheaper than measuring
 *      two unrelated populations.
 *   2. Every pair is a swap between two tributes rather than a change to one.
 *      Turning a Tracker into a Career changes the archetype *and* the number
 *      of Careers in the field, and a field with one more Career is a harder
 *      field for everybody — so a naive swap measures the archetype plus the
 *      cast composition. Exchanging two tributes' archetypes leaves the
 *      composition untouched: the same archetypes are present in the same
 *      numbers, in different bodies.
 *
 * What it cannot do
 * -----------------
 *
 * It cannot separate an archetype from the tribute it is attached to. Swapping
 * archetypes between a District 1 eighteen-year-old and a District 12
 * twelve-year-old measures "this archetype on this body" in both directions,
 * which is why the swap is run *both ways* and the two halves are reported.
 * Where they disagree, the archetype interacts with the body, and no single
 * number is the answer — which is itself a finding the ranking table cannot
 * express.
 *
 *   npm run cohorts -- archetype career tracker
 *   COHORT_PAIRS=400 npm run cohorts -- archetype career tracker
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { ArchetypeId, GameState, Tribute } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';

const PAIRS = Number(process.env.COHORT_PAIRS ?? 200);
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];

/** One run's starting conditions, before anybody has been swapped. */
function cast(seed: string, arenaId: string): GameState {
    const profile = gamesProfileFor(seed, false);
    const arena = resolveArenaForRun(seed, arenaId, profile);
    const config = configForProfile(DEFAULT_GAME_CONFIG, profile);
    const tributes = generateTributes(seed, DEFAULT_GAME_CONFIG, arena.zones[0].name, profile.castShape, profile.quell);
    return {
        seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: false,
        config, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: profile, logCounter: 0, feastsHeld: 0, cycle: 0,
    } as GameState;
}

function playOut(state: GameState): GameState {
    const sim = new Simulator(state);
    let guard = 3000;
    let s = sim.getState();
    while (s.phase !== 'ended' && guard-- > 0) {
        if (s.phase === 'setup') sim.processTraining();
        else if (s.phase === 'training' || s.phase === 'scores') sim.processInterviews();
        else if (s.phase === 'interviews') sim.startGames();
        else if (s.phase === 'bloodbath') sim.processBloodbath();
        else if (s.phase === 'epilogue') { s.phase = 'ended'; }
        else if (!sim.processTurn()) break;
        s = sim.getState();
    }
    return s;
}

/**
 * The paired statistic.
 *
 * `n` pairs, each contributing +1 when the treatment tribute outlived the
 * control, -1 when it did not, 0 when the pair is uninformative (neither
 * finished, or the run did not complete). The mean is the effect; the interval
 * is the standard error of that mean, which is the right one *because* the
 * pairing makes the two halves of each pair dependent.
 */
function pairedMean(diffs: number[]): { mean: number; lo: number; hi: number; n: number } {
    const n = diffs.length;
    if (n === 0) return { mean: 0, lo: 0, hi: 0, n };
    const mean = diffs.reduce((a, b) => a + b, 0) / n;
    const variance = n < 2 ? 0 : diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
    const se = Math.sqrt(variance / n);
    return { mean, lo: mean - 1.96 * se, hi: mean + 1.96 * se, n };
}

/** Days survived is a finer outcome than won/lost and needs far fewer pairs. */
const daysOf = (s: GameState, id: string) => s.tributes.find(t => t.id === id)?.daysSurvived ?? 0;
const wonBy = (s: GameState, id: string) => s.tributes.find(t => t.id === id)?.status === 'alive' ? 1 : 0;

interface Swap { aId: string; bId: string; }

/**
 * Two seats, chosen by position rather than by what they happened to be dealt.
 *
 * The first draft looked for a tribute of each archetype already in the field
 * and skipped the seed when one was missing. It skipped 94 of 120 seeds for
 * career-vs-tracker — Trackers are rare, which is itself most of why a 3.51%
 * win rate is not a measurement — and an instrument that can only run on the
 * quarter of seeds the draw happened to favour is measuring the draw.
 *
 * So both roles are *assigned*. The seats are fixed by index, so the same two
 * tributes are used in both arms, and the pair of archetypes present is
 * identical in both arms — which is the composition control the whole design
 * rests on. The control arm is (seat A: from, seat B: to) and the treatment is
 * the exchange. Every seed is usable.
 *
 * The seats are spread across the field rather than taken from the front,
 * because tribute order is district order and the first two seats are always
 * District 1 — the Career districts, the strongest bodies, the best kit. An
 * instrument built to remove confounding should not begin by picking the two
 * most confounded seats in the arena.
 */
function seatsFor(state: GameState): Swap | undefined {
    const alive = state.tributes;
    if (alive.length < 2) return undefined;
    return { aId: alive[0].id, bId: alive[Math.floor(alive.length / 2)].id };
}

/** Put `from` in seat A and `to` in seat B — the control arm's assignment. */
function assign(state: GameState, seats: Swap, from: ArchetypeId, to: ArchetypeId) {
    state.tributes.find(t => t.id === seats.aId)!.archetype = from;
    state.tributes.find(t => t.id === seats.bId)!.archetype = to;
}

function runArchetypeCohort(from: ArchetypeId, to: ArchetypeId) {
    // Four series, because the question has two halves and each half needs its
    // own control. `aDays` is "what happened to the tribute who started as
    // `from`, when they became `to`"; `bDays` is the mirror.
    const aDays: number[] = [];
    const bDays: number[] = [];
    const aWins: number[] = [];
    const bWins: number[] = [];
    let usable = 0, skipped = 0;

    for (let i = 0; i < PAIRS; i++) {
        const seed = `COH${i}`;
        const arenaId = arenaIds[i % arenaIds.length];

        const control = cast(seed, arenaId);
        const swap = seatsFor(control);
        // A field of fewer than two cannot carry a swap. Counted rather than
        // dropped silently, because a skipped pair is a sample that would
        // otherwise report itself larger than it is.
        if (!swap) { skipped++; continue; }
        usable++;
        assign(control, swap, from, to);

        const treatment = cast(seed, arenaId);
        // The exchange, and nothing else: the same two seats, the same two
        // archetypes, in the other order.
        assign(treatment, swap, to, from);

        const c = playOut(control);
        const t = playOut(treatment);

        aDays.push(daysOf(t, swap.aId) - daysOf(c, swap.aId));
        bDays.push(daysOf(t, swap.bId) - daysOf(c, swap.bId));
        aWins.push(wonBy(t, swap.aId) - wonBy(c, swap.aId));
        bWins.push(wonBy(t, swap.bId) - wonBy(c, swap.bId));
    }

    const show = (label: string, r: ReturnType<typeof pairedMean>, unit: string, events?: number) => {
        // A series in which the outcome never once happened has a mean of zero
        // and an interval of zero width, which prints as the most decisive
        // result on the page and is the least informative. Say so instead: a
        // win is a few-per-cent event and a couple of hundred pairs cannot see
        // one either way.
        if (events === 0) {
            console.log(`  ${label.padEnd(46)} no ${unit} in either arm — this sample cannot measure it`);
            return;
        }
        const decisive = (r.lo > 0 || r.hi < 0) ? '' : '   (interval spans zero — not decisive at this sample)';
        console.log(`  ${label.padEnd(46)} ${r.mean >= 0 ? '+' : ''}${r.mean.toFixed(3)} ${unit}`
            + `  [${r.lo.toFixed(3)}, ${r.hi.toFixed(3)}]${decisive}`);
    };
    const nonzero = (xs: number[]) => xs.filter(x => x !== 0).length;

    console.log(`\nSwapping ${from} <-> ${to}: ${usable} usable pairs, ${skipped} seeds skipped (field too small)`);
    if (usable === 0) {
        console.log('  No seed in the sample fielded two tributes. Nothing to compare.');
        return;
    }
    console.log('\n  The tribute who started as ' + from + ', after becoming ' + to + ':');
    show('days survived', pairedMean(aDays), 'days');
    show('won the Games', pairedMean(aWins), 'wins', nonzero(aWins));
    console.log('\n  The tribute who started as ' + to + ', after becoming ' + from + ':');
    show('days survived', pairedMean(bDays), 'days');
    show('won the Games', pairedMean(bWins), 'wins', nonzero(bWins));

    const a = pairedMean(aDays), b = pairedMean(bDays);
    // The two halves should be mirror images. Where they are not, the archetype
    // is doing different work on different bodies, and the ranking table's
    // single number is hiding it.
    if (a.lo > 0 && b.lo > 0) {
        console.log(`\n  Both halves improved, which a swap cannot do on its own: the effect is`);
        console.log(`  interacting with who is carrying it, not with the archetype alone.`);
    } else if (a.hi < 0 && b.hi < 0) {
        console.log(`\n  Both halves worsened. Same reading as above, in the other direction.`);
    } else if ((a.lo > 0) !== (b.hi < 0) && (a.hi < 0) !== (b.lo > 0)) {
        console.log(`\n  The halves do not mirror each other. The archetype's effect depends on`);
        console.log(`  the tribute carrying it — a single ranked number cannot express that.`);
    }
}

const [kind, fromArg, toArg] = process.argv.slice(2);
if (kind !== 'archetype' || !fromArg || !toArg) {
    console.error('usage: npm run cohorts -- archetype <from> <to>');
    console.error('  e.g. npm run cohorts -- archetype career tracker');
    process.exit(2);
}

console.log(`Matched cohorts: ${PAIRS} seeds, each played twice.`);
console.log('The seed makes the starting conditions identical, not the runs — see the header.');
runArchetypeCohort(fromArg as ArchetypeId, toArg as ArchetypeId);
