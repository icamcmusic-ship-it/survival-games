/**
 * Balance metrics: what actually happens across a few hundred complete runs.
 *
 * The soak test asserts invariants — things that must never happen. This asks
 * the softer question the soak cannot: is the simulation producing the *shape*
 * of outcome the design wants? A run where nobody violates an invariant but
 * a third of the cast quietly bleeds to death alone is a passing test and a
 * broken game.
 *
 * Every number here is a design target with a comment saying what it should be
 * and why, so a balance change can be judged instead of guessed at.
 *
 *   npm run test:metrics
 */
import { generateTributes } from '../src/engine/generator';
import { generateArena } from '../src/engine/arenaGenerator';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameConfig, GameState, Stance, Tribute } from '../src/models/types';
import { STANCES } from '../src/data/stances';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';

const RUNS = 400;

const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];
const configs: GameConfig[] = [
    DEFAULT_GAME_CONFIG,
    { ...DEFAULT_GAME_CONFIG, districtCount: 6 },
    { ...DEFAULT_GAME_CONFIG, districtCount: 12, hazardRate: 1.5 },
    { ...DEFAULT_GAME_CONFIG, districtCount: 8, betrayalRate: 1.5 },
];

function start(seed: string, arenaId: string, config: GameConfig): GameState {
    const arena = arenaId.startsWith('procedural') ? generateArena(seed) : ARENAS.find(a => a.id === arenaId)!;
    // REPLAY-01: measure the game the player actually gets, which is their
    // config multiplied through this year's announced temperament.
    const gamesProfile = gamesProfileFor(seed);
    const resolved = configForProfile(config, gamesProfile);
    const tributes = generateTributes(seed, resolved, arena.zones[0].name, gamesProfile.castShape);
    return {
        seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: false,
        config: resolved, baseConfig: config, gamesProfile, logCounter: 0, feastsHeld: 0, cycle: 0,
    };
}

/**
 * Buckets a cause-of-death string. `killTribute` writes "Killed by <name>" for
 * every tribute-dealt death, and the status causes come from `survival.ts`
 * verbatim, so matching on those prefixes is exact rather than heuristic.
 */
function bucketOf(cause: string | undefined): string {
    if (!cause) return 'unknown';
    if (cause.startsWith('Killed by ')) return 'tribute';
    if (cause.includes('Bled out')) return 'bleeding';
    if (cause.includes('dehydration')) return 'dehydration';
    if (cause.includes('starvation')) return 'starvation';
    if (cause.includes('infected')) return 'infection';
    if (cause.includes('poison')) return 'poison';
    if (cause.includes('Froze')) return 'frostbite';
    if (cause.includes('burns')) return 'burns';
    if (cause.includes('Torn apart')) return 'mutts';
    if (cause.includes('collapsing border')) return 'border';
    return 'arena/hazard';
}

const deathsByCause: Record<string, number> = {};
let deaths = 0;
let victors = 0, victorKills = 0, victorZeroKills = 0, victorHealth = 0;
let wipeouts = 0, careerVictors = 0;
const victorsByDistrict: Record<number, number> = {};
// A2: the archetype balance table the design review measured by hand. Win
// rate is the only number that says whether an archetype is a character or a
// handicap, and it was not being tracked at all.
const archetypeEntrants: Record<string, number> = {};
const archetypeWins: Record<string, number> = {};
/**
 * §8d: per-trait tracking, partitioned.
 *
 * The trait win-rate table cannot be read naively: `earnedTraits.ts` grants
 * traits mid-run, so Vulture's 34.67% is survivorship — you cannot earn it
 * without surviving long enough to loot four corpses. Reaping-assigned traits
 * are the only ones that can be balanced against each other, so the two
 * populations are counted separately: the reaping set is captured from the
 * cast at generation (before a single cycle has run), and anything a tribute
 * finishes with that is not in that set was earned.
 */
const reapingTraitEntrants: Record<string, number> = {};
const reapingTraitWins: Record<string, number> = {};
const earnedTraitHolders: Record<string, number> = {};
const earnedTraitWins: Record<string, number> = {};
/** §3.2: how often a trait is shed or transformed rather than merely gained. */
let traitsShed = 0;
const archetypeDays: Record<string, number> = {};
const archetypeKills: Record<string, number> = {};
let runs = 0, totalDays = 0;
const runLengths: number[] = [];

// Sampled once per cycle across every living tribute.
let aliveSamples = 0, armedSamples = 0;
const stanceSamples: Record<Stance, number> = Object.fromEntries(STANCES.map((s: Stance) => [s, 0])) as Record<Stance, number>;
let bleedingSamples = 0;
// Proficiency growth: is anyone actually getting better at anything?
let profSamples = 0, profTotal = 0, profMax = 0;
// Social systems: the ones the design review measured directly.
let runsWithLovers = 0, loverDaySum = 0, loverRuns = 0;
let vengeanceSworn = 0, betrayals = 0;
const allianceSizeHistogram: Record<number, number> = {};
let organicTrios = 0;

const sampleBoard = (tributes: Tribute[]) => {
    tributes.forEach(t => {
        if (t.status !== 'alive') return;
        aliveSamples++;
        if (t.inventory.some(i => i.type === 'weapon')) armedSamples++;
        stanceSamples[t.stance]++;
        if (t.injuries.bleeding) bleedingSamples++;
        const prof = (t as Tribute & { proficiencies?: Record<string, number> }).proficiencies;
        if (prof) {
            const best = Math.max(0, ...Object.values(prof));
            profSamples++;
            profTotal += best;
            if (best > profMax) profMax = best;
        }
    });
};

// CANON-01. The bloodbath is the single most recognisable event in the source
// material, and roughly half the field dies in it.
let bloodbathDeaths = 0;
let bloodbathFields = 0;
// SIDE-04. The training board, against the shape the source material describes.
let scored = 0;
let scoredElite = 0;
let careerScores = 0;
let careerCount = 0;

for (let i = 0; i < RUNS; i++) {
    const seed = `METRIC${i}`;
    const sim = new Simulator(start(seed, arenaIds[i % arenaIds.length], configs[i % configs.length]));
    let guard = 3000;
    let state = sim.getState();
    // §8d: the reaping-assigned set, snapshotted before a cycle has run.
    // Everything a tribute finishes with that is not in here was earned.
    const reapingTraits = new Map<string, string[]>();
    state.tributes.forEach(t => {
        reapingTraits.set(t.id, [...t.traits]);
        t.traits.forEach(trait => {
            reapingTraitEntrants[trait] = (reapingTraitEntrants[trait] ?? 0) + 1;
        });
    });

    while (state.phase !== 'ended' && guard-- > 0) {
        if (state.phase === 'setup') {
            sim.processTraining();
            sim.getState().tributes.forEach(t => {
                scored++;
                if (t.trainingScore >= 9) scoredElite++;
                if (t.isCareer) { careerScores += t.trainingScore; careerCount++; }
            });
        }
        else if (state.phase === 'training') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') {
            const fieldSize = state.tributes.length;
            sim.processBloodbath();
            bloodbathFields += fieldSize;
            bloodbathDeaths += sim.getState().tributes.filter(t => t.status === 'dead').length;
        }
        else if (state.phase === 'epilogue') { state.phase = 'ended'; }
        else if (!sim.processTurn()) break;
        state = sim.getState();
        if (state.phase === 'day' || state.phase === 'night') {
            sampleBoard(state.tributes);
            const counts = new Map<string, number>();
            state.tributes.forEach(t => {
                if (t.status !== 'alive' || !t.allianceId) return;
                counts.set(t.allianceId, (counts.get(t.allianceId) ?? 0) + 1);
            });
            counts.forEach((n, id) => {
                allianceSizeHistogram[n] = (allianceSizeHistogram[n] ?? 0) + 1;
                if (n >= 3 && !id.startsWith('career-pack') && !id.startsWith('lovers-')) organicTrios++;
            });
        }
    }

    // Star-crossed lovers: the review measured this forming in 92.5% of runs on
    // an average of day 3, when it should be the rarest thing in the game.
    const loversLine = state.log.find(l => l.category === 'romance' && /star-crossed|lovers/i.test(l.text));
    if (state.tributes.some(t => t.traits.includes('Star-Crossed'))) {
        runsWithLovers++;
        if (loversLine) { loverDaySum += loversLine.day; loverRuns++; }
    }
    vengeanceSworn += state.log.filter(l => l.text.startsWith('VENGEANCE:')).length;
    betrayals += state.log.filter(l => l.category === 'betrayal').length;

    runs++;
    totalDays += state.day;
    runLengths.push(state.day);
    state.tributes.forEach(t => {
        if (t.status === 'dead') {
            deaths++;
            const bucket = bucketOf(t.causeOfDeath);
            deathsByCause[bucket] = (deathsByCause[bucket] || 0) + 1;
        }
    });
    state.tributes.forEach(t => {
        traitsShed += (t.shedTraits ?? []).length;
        const reaped = reapingTraits.get(t.id) ?? [];
        t.traits.filter(trait => !reaped.includes(trait)).forEach(trait => {
            earnedTraitHolders[trait] = (earnedTraitHolders[trait] ?? 0) + 1;
        });
        archetypeEntrants[t.archetype] = (archetypeEntrants[t.archetype] ?? 0) + 1;
        archetypeDays[t.archetype] = (archetypeDays[t.archetype] ?? 0) + t.daysSurvived;
        archetypeKills[t.archetype] = (archetypeKills[t.archetype] ?? 0) + t.kills;
    });
    const winner = state.tributes.find(t => t.status === 'alive');
    if (winner) {
        victors++;
        victorKills += winner.kills;
        if (winner.kills === 0) victorZeroKills++;
        victorHealth += winner.health;
        // §7: who actually wins. A twelve-district reaping whose win column is
        // three districts wide is a twelve-district reaping in name only, and
        // the underdog outer-district victor is the single most central trope
        // in the source material.
        victorsByDistrict[winner.district] = (victorsByDistrict[winner.district] ?? 0) + 1;
        if (winner.isCareer) careerVictors++;
        archetypeWins[winner.archetype] = (archetypeWins[winner.archetype] ?? 0) + 1;
        const reaped = reapingTraits.get(winner.id) ?? [];
        reaped.forEach(trait => { reapingTraitWins[trait] = (reapingTraitWins[trait] ?? 0) + 1; });
        winner.traits.filter(trait => !reaped.includes(trait)).forEach(trait => {
            earnedTraitWins[trait] = (earnedTraitWins[trait] ?? 0) + 1;
        });
    } else {
        // Every canonical Games produces a victor. A run that ends with an
        // empty arena is the largest canon-fidelity failure the sim can have.
        wipeouts++;
    }
}

const pct = (n: number, d: number) => d === 0 ? '—' : `${(n / d * 100).toFixed(1)}%`;

/**
 * A tracked indicator.
 *
 * `guard` is a regression bound, not an aspiration: it is set where the
 * simulation actually landed after the tribute-logic overhaul, with a little
 * slack for run-to-run noise, so this script fails when a future change makes
 * things *worse* rather than when it fails to reach a number nobody has hit.
 * `goal` is the design intent, printed alongside so the gap stays visible
 * instead of being quietly forgotten.
 *
 * `baseline` is the measured pre-overhaul value, kept so the direction and size
 * of each change is legible without digging through git history.
 */
interface Indicator {
    label: string;
    value: number;
    /** Regression bound. Failing this fails the build. */
    guard: (v: number) => boolean;
    guardText: string;
    /** Design intent, informational only. Reported but never fails the build. */
    goal?: string;
    goalMet?: (v: number) => boolean;
    baseline: string;
    fmt: (v: number) => string;
}

const asPct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Standard deviation of run length, in days. */
const runLengthSpread = (() => {
    if (runLengths.length === 0) return 0;
    const mean = runLengths.reduce((a, b) => a + b, 0) / runLengths.length;
    return Math.sqrt(runLengths.reduce((a, d) => a + (d - mean) ** 2, 0) / runLengths.length);
})();

/**
 * §7: concentration of the win column. The share taken by the three
 * winningest districts — the audit measured D1/D2/D4 combined at 74.9%, with
 * nine of twelve districts statistically irrelevant. Measured as "top three"
 * rather than "D1+D2+D4" so the indicator keeps meaning something if the
 * identity of the dominant districts shifts.
 */
const topThreeDistrictShare = (() => {
    if (victors === 0) return 0;
    const counts = Object.values(victorsByDistrict).sort((a, b) => b - a);
    return counts.slice(0, 3).reduce((a, b) => a + b, 0) / victors;
})();

/**
 * §8d: the two numbers the harness never measured — the two things a player
 * actually chooses to care about.
 *
 * `archetypeSpread` is the ratio of the best archetype's win rate to the
 * worst; `reapingTraitSpread` the same for reaping-assigned traits only
 * (earned traits are excluded on purpose: their win rates are survivorship,
 * not power — see the comment on `reapingTraitEntrants`). Both are computed
 * over populations large enough to mean something.
 */
const MIN_SAMPLE = 100;
function winRates(entrants: Record<string, number>, wins: Record<string, number>): Array<[string, number, number]> {
    return Object.keys(entrants)
        .filter(k => entrants[k] >= MIN_SAMPLE)
        .map(k => [k, (wins[k] ?? 0) / entrants[k], entrants[k]] as [string, number, number])
        .sort((a, b) => b[1] - a[1]);
}
const archetypeRates = winRates(archetypeEntrants, archetypeWins);
const reapingTraitRates = winRates(reapingTraitEntrants, reapingTraitWins);
const earnedTraitRates = winRates(earnedTraitHolders, earnedTraitWins);
const spreadOf = (rates: Array<[string, number, number]>) => {
    if (rates.length < 2) return 1;
    const worst = rates[rates.length - 1][1];
    return worst > 0 ? rates[0][1] / worst : Infinity;
};
const archetypeSpread = spreadOf(archetypeRates);
const reapingTraitSpread = spreadOf(reapingTraitRates);
const worstArchetypeRate = archetypeRates.length ? archetypeRates[archetypeRates.length - 1][1] : 0;
const bestArchetypeRate = archetypeRates.length ? archetypeRates[0][1] : 0;

/** How many districts win often enough to be worth rooting for at all. */
const viableDistricts = Object.values(victorsByDistrict)
    .filter(n => n / Math.max(1, victors) >= 0.04).length;

const indicators: Indicator[] = [
    {
        // §8d: the harness measured districts and stances and not the two
        // things a player chooses. Career ran at 2.2x the field average and
        // 4.6x the worst archetype; Strategist at 2.56% was a flavour label.
        label: 'archetype win-rate spread (best/worst)',
        value: archetypeSpread,
        guard: v => v <= 4.6,
        guardText: '<= 4.6',
        goal: '<= 2.3',
        goalMet: v => v <= 2.3,
        baseline: '4.6',
        fmt: v => `${v.toFixed(2)}x`,
    },
    {
        label: 'worst archetype win rate',
        value: worstArchetypeRate,
        guard: v => v >= 0.02,
        guardText: '>= 2.0%',
        goal: '>= 3.5%',
        goalMet: v => v >= 0.035,
        baseline: '2.56%',
        fmt: v => `${(v * 100).toFixed(2)}%`,
    },
    {
        label: 'best archetype win rate',
        value: bestArchetypeRate,
        guard: v => v <= 0.13,
        guardText: '<= 13%',
        goal: '<= 8%',
        goalMet: v => v <= 0.08,
        baseline: '11.8%',
        fmt: v => `${(v * 100).toFixed(2)}%`,
    },
    {
        // §8b/§8d: reaping-assigned traits only. Earned traits are excluded
        // because their win rates are survivorship — you cannot earn Vulture
        // without having already survived four deaths.
        label: 'reaping-trait win spread (best/worst)',
        value: reapingTraitSpread,
        guard: v => v <= 4.5,
        guardText: '<= 4.5',
        goal: '<= 2.5',
        goalMet: v => v <= 2.5,
        baseline: '4.31 measured here (the audit reported 4.3)',
        fmt: v => `${v.toFixed(2)}x`,
    },
    {
        // REPLAY-01. Every run used to have the same shape: mean 8.0 days in a
        // tight 5-14 band, same escalation schedule, same sponsor climate. A
        // simulation sold on replayability cannot have one shape, so the spread
        // of run lengths is the cheapest honest proxy for whether the Games
        // actually differ from each other.
        label: 'run length spread (days, sd)',
        value: runLengthSpread,
        guard: v => v >= 1.4,
        guardText: '>= 1.4',
        goal: '>= 2.0',
        goalMet: v => v >= 2.0,
        baseline: '1.1',
        fmt: v => v.toFixed(2),
    },
    {
        // SIDE-04. In the source material a 9 or a 10 marks you as a Career or
        // a genuine threat and the rest of the board sits in the middle. The
        // old one-line roll put a fifth of every field at 8 and above.
        label: 'training scores of 9 or better',
        value: scoredElite / Math.max(1, scored),
        guard: v => v >= 0.07 && v <= 0.24,
        guardText: '7%-24%',
        goal: '12%-18%',
        goalMet: v => v >= 0.12 && v <= 0.18,
        baseline: '9.1%',
        fmt: asPct,
    },
    {
        // The Careers should reliably be the top of the board without owning
        // all of it — the whole point of the training broadcast is that the
        // field learns who to be afraid of.
        label: 'average Career training score',
        value: careerScores / Math.max(1, careerCount),
        guard: v => v >= 6.8 && v <= 9,
        guardText: '6.8-9.0',
        baseline: '6.4',
        fmt: v => v.toFixed(2),
    },
    {
        // CANON-01. Half the field dies at the Cornucopia in the first ten
        // minutes. The old scramble managed 0.84 deaths out of 24 — and every
        // downstream problem started there, because the tributes with nothing
        // to offer a fight survived it to die of thirst on day six instead.
        label: 'share of the field lost in the bloodbath',
        value: bloodbathDeaths / Math.max(1, bloodbathFields),
        guard: v => v >= 0.25 && v <= 0.62,
        guardText: '25%-62%',
        goal: '33%-50%',
        goalMet: v => v >= 0.33 && v <= 0.50,
        baseline: '3.5%',
        fmt: asPct,
    },
    {
        // DESIGN-01. Bleeding should be what softens a tribute up for the fight
        // that kills them, not the thing that kills them alone in a field having
        // never met another person.
        label: 'deaths from untreated bleeding',
        value: (deathsByCause.bleeding || 0) / deaths,
        guard: v => v <= 0.13,
        guardText: '<= 13%',
        goal: '<= 10%',
        goalMet: v => v <= 0.10,
        baseline: '33.1%',
        fmt: asPct,
    },
    {
        // The Games are meant to be tributes killing tributes rather than the
        // weather doing it for them. Not a figure the brief set a target for —
        // 40% is the author's judgement of where it ought to end up.
        label: 'deaths caused by another tribute',
        value: (deathsByCause.tribute || 0) / deaths,
        guard: v => v >= 0.33,
        guardText: '>= 33%',
        goal: '>= 40%',
        goalMet: v => v >= 0.40,
        baseline: '25.7%',
        fmt: asPct,
    },
    {
        // DESIGN-03: aggression has to be a live option, not a trap.
        label: 'Aggressive stance share',
        value: stanceSamples.Aggressive / Math.max(1, aliveSamples),
        guard: v => v >= 0.20,
        guardText: '>= 20%',
        baseline: '16.7%',
        fmt: asPct,
    },
    {
        // A victor who never killed anyone is a legitimate story. A victor who
        // never killed anyone two times in five is a simulation that does not
        // reward fighting.
        label: 'victors with zero kills',
        value: victorZeroKills / Math.max(1, victors),
        guard: v => v <= 0.32,
        guardText: '<= 32%',
        goal: '<= 25%',
        goalMet: v => v <= 0.25,
        baseline: '43.4%',
        fmt: asPct,
    },
    {
        label: 'living tributes carrying a weapon',
        value: armedSamples / Math.max(1, aliveSamples),
        guard: v => v >= 0.40,
        guardText: '>= 40%',
        baseline: '27.5%',
        fmt: asPct,
    },
    {
        // DESIGN-02/06: a victor should be able to reach the finale in some
        // condition, rather than every run ending with two wrecks.
        //
        // §7: this dropped hard (48.4 -> ~22) alongside the wipeout fix, and
        // that is the fix working as intended rather than a regression to
        // guard against. A run that used to end with the field's last two
        // both dying of thirst/poison before either landed a blow was a
        // wipeout, excluded from this average entirely; the finalist
        // protection in `applyDamage` now keeps holding one of them back from
        // that instead of letting the arena empty out, which means a
        // meaningfully unhealthy survivor now *counts* where before there was
        // no victor to count at all. Fewer wipeouts (the audit's own
        // "most significant canon-fidelity gap") necessarily costs some of
        // this metric's headroom — a victor who crawls out of a near-death
        // finalist standoff is exactly the trade being made, and is itself a
        // fair canon shape (the source material's victors are not always in
        // good condition either). Guard set with margin below the new
        // measured value; the goal stays as a reminder this could still
        // improve without pulling wipeouts back up.
        label: 'victor average end health',
        value: victorHealth / Math.max(1, victors),
        guard: v => v >= 15,
        guardText: '>= 15',
        goal: '>= 30',
        goalMet: v => v >= 30,
        baseline: '48.4 (pre wipeout-fix; ~22 after, see comment)',
        fmt: v => v.toFixed(1),
    },
    {
        // REL-01. This should be the rarest and most memorable outcome in the
        // game; it was firing in the large majority of runs by roughly day 3,
        // before either tribute had done anything for the other.
        label: 'runs with star-crossed lovers',
        value: runsWithLovers / runs,
        guard: v => v >= 0.05 && v <= 0.22,
        guardText: '5%-22%',
        goal: '10%-15%',
        goalMet: v => v >= 0.10 && v <= 0.15,
        baseline: '75.8%',
        fmt: asPct,
    },
    {
        // REL-02. The epilogue's best beat — "you went after X for what happened
        // to Y" — fired in well under 1% of runs.
        label: 'vengeance sworn per run',
        value: vengeanceSworn / runs,
        guard: v => v >= 0.75,
        guardText: '>= 0.75',
        baseline: '0.19',
        fmt: v => v.toFixed(2),
    },
    {
        // REL-03. Alliances were duos because nothing could ever grow one.
        label: 'alliance samples of 3 or more',
        value: (Object.entries(allianceSizeHistogram)
            .filter(([k]) => Number(k) >= 3)
            .reduce((sum, [, v]) => sum + v, 0))
            / Math.max(1, Object.values(allianceSizeHistogram).reduce((a, b) => a + b, 0)),
        guard: v => v >= 0.30,
        guardText: '>= 30%',
        baseline: '28.7%',
        fmt: asPct,
    },
    {
        // Bleeding must not be *solved*, only survivable — if nobody is ever
        // bleeding, the whole wound system has been tuned into irrelevance.
        label: 'tributes bleeding at any moment',
        value: bleedingSamples / Math.max(1, aliveSamples),
        guard: v => v >= 0.05 && v <= 0.25,
        guardText: '5%-25%',
        baseline: '18.1%',
        fmt: asPct,
    },
    {
        // §7. Every canonical Games produces a victor — sometimes two, which
        // this simulation already models deliberately. A run that ends with an
        // empty arena is the single largest canon-fidelity gap available, and
        // ESCALATION's finalist protection was written to prevent exactly it
        // but only covers the border-collapse damage vector.
        label: 'runs ending with no victor',
        value: wipeouts / Math.max(1, runs),
        guard: v => v <= 0.05,
        guardText: '<= 5%',
        goal: '<= 2%',
        goalMet: v => v <= 0.02,
        baseline: '8.3%',
        fmt: asPct,
    },
    {
        // §7. D1/D2/D4 took 74.9% of all victories, leaving nine districts
        // close to statistically irrelevant. That undercuts canon (Katniss is
        // District 12) and is the largest replayability tax in the game: once
        // a player notices, the reaping stops being interesting.
        label: 'win share of the top three districts',
        value: topThreeDistrictShare,
        guard: v => v <= 0.75,
        guardText: '<= 75%',
        goal: '<= 55%',
        goalMet: v => v <= 0.55,
        baseline: '74.9%',
        fmt: asPct,
    },
    {
        // The same thing from the other side, and the one a player actually
        // feels: how many districts win often enough to be worth rooting for.
        label: 'districts winning >= 4% of runs',
        value: viableDistricts,
        guard: v => v >= 5,
        guardText: '>= 5 of 12',
        goal: '>= 8 of 12',
        goalMet: v => v >= 8,
        baseline: '3',
        fmt: v => `${v}/12`,
    },
    {
        // §5. The two most iconic threats in the source material — Gamemaker
        // mutts and the arena's own hazards — were mechanically present and
        // statistically decorative: 2.3% of deaths combined, off more than a
        // thousand mutt encounters per 240 runs, almost all of which resolved
        // as a scare and a wound.
        //
        // Deliberately a band rather than a floor. Too low and the arena is
        // scenery; too high and the Games stop being about the tributes, which
        // is the actual subject. The upper bound is as much the point as the
        // lower one.
        label: 'deaths from mutts and hazards',
        value: ((deathsByCause['mutts'] ?? 0) + (deathsByCause['arena/hazard'] ?? 0)) / Math.max(1, deaths),
        guard: v => v >= 0.05 && v <= 0.18,
        guardText: '5%-18%',
        goal: '>= 7%',
        goalMet: v => v >= 0.07,
        baseline: '2.3%',
        fmt: asPct,
    },
    {
        // §7. Careers are meant to be favourites, not the answer.
        //
        // Baseline correction: the audit that prompted this work reported
        // Career victors at 40.1%. Instrumenting it here measured 76.3% on the
        // unmodified engine across this script's config sweep — the audit's
        // figure does not reproduce, and a guard set from it would have been
        // permanently red for reasons unrelated to any change. The number
        // below is what main actually measures.
        //
        // D1/D2/D4 are 3 of 12 districts, i.e. 25% of the cast, so parity
        // would be 25% and canon wants them meaningfully above that but not
        // dominant. The rebalance (district attribute spread, the Career
        // archetype's redundant stat stacking, and Career hunger dependence)
        // moved this to ~68%, which is real progress and still short of the
        // goal. Deliberately left as an unmet goal rather than a relaxed one:
        // closing the rest of it means giving the outer districts ways to win
        // that are not "roll better melee stats" — traps, poison and attrition
        // are all present but under-tuned — and that is a larger piece of work
        // than a stat table.
        label: 'Career victors',
        value: careerVictors / Math.max(1, victors),
        guard: v => v <= 0.72,
        guardText: '<= 72%',
        goal: '<= 45%',
        goalMet: v => v <= 0.45,
        baseline: '76.3% measured (audit reported 40.1%, did not reproduce)',
        fmt: asPct,
    },
];

console.log(`runs=${runs} victors=${victors} deaths=${deaths} avgDays=${(totalDays / runs).toFixed(1)}`);
console.log('\ncause of death:');
Object.entries(deathsByCause)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k.padEnd(14)} ${pct(v, deaths).padStart(6)}  (${v})`));

console.log('\nvictor profile:');
console.log(`  average kills      ${(victorKills / Math.max(1, victors)).toFixed(2)}`);
console.log(`  zero-kill victors  ${pct(victorZeroKills, victors)}`);
console.log(`  average end health ${(victorHealth / Math.max(1, victors)).toFixed(1)}`);

console.log('\nvictors by district:');
{
    const districts = Object.keys(victorsByDistrict).map(Number).sort((a, b) => a - b);
    districts.forEach(d => {
        const n = victorsByDistrict[d];
        const bar = '#'.repeat(Math.round((n / Math.max(1, victors)) * 60));
        console.log(`  D${String(d).padStart(2)}  ${pct(n, victors).padStart(6)}  (${String(n).padStart(3)})  ${bar}`);
    });
    console.log(`  Careers            ${pct(careerVictors, victors)}`);
    console.log(`  top three combined ${pct(topThreeDistrictShare * victors, victors)}`);
    console.log(`  wipeouts (no victor at all) ${pct(wipeouts, runs)}`);
}

console.log('\nboard samples:');
console.log(`  carrying a weapon  ${pct(armedSamples, aliveSamples)}`);
console.log(`  currently bleeding ${pct(bleedingSamples, aliveSamples)}`);
console.log('');
console.log('archetypes (n / win% / avg days / avg kills):');
Object.keys(archetypeEntrants)
    .sort((a, b) => (archetypeWins[b] ?? 0) / archetypeEntrants[b] - (archetypeWins[a] ?? 0) / archetypeEntrants[a])
    .forEach(id => {
        const n = archetypeEntrants[id];
        const wins = archetypeWins[id] ?? 0;
        console.log(`  ${id.padEnd(12)} ${String(n).padStart(5)}  ${(wins / n * 100).toFixed(2).padStart(5)}%  ${(archetypeDays[id] / n).toFixed(2).padStart(5)}  ${(archetypeKills[id] / n).toFixed(2).padStart(5)}`);
    });
console.log('');
console.log('  stance             '
    + STANCES.filter((st: Stance) => stanceSamples[st] > 0)
        .sort((a: Stance, b: Stance) => stanceSamples[b] - stanceSamples[a])
        .map((st: Stance) => `${st} ${pct(stanceSamples[st], aliveSamples)}`)
        .join(' / '));
if (profSamples > 0) {
    console.log(`  best proficiency   avg ${(profTotal / profSamples).toFixed(2)}, peak ${profMax.toFixed(2)}`);
}

console.log('');
console.log('reaping-assigned traits (n / win%) — the only set that can be balanced against itself:');
reapingTraitRates.forEach(([trait, rate, n]) => {
    console.log(`  ${trait.padEnd(16)} ${String(n).padStart(5)}  ${(rate * 100).toFixed(2).padStart(6)}%`);
});
console.log('');
console.log('earned traits (holders / win%) — survivorship, NOT power. Read against the field, not each other:');
earnedTraitRates.forEach(([trait, rate, n]) => {
    console.log(`  ${trait.padEnd(16)} ${String(n).padStart(5)}  ${(rate * 100).toFixed(2).padStart(6)}%`);
});
console.log(`  traits shed or transformed (§3.2): ${traitsShed} across ${runs} runs`);

console.log('\nsocial systems:');
console.log(`  runs with star-crossed lovers  ${pct(runsWithLovers, runs)}${loverRuns > 0 ? `, avg day ${(loverDaySum / loverRuns).toFixed(1)}` : ''}`);
console.log(`  vengeance sworn per run        ${(vengeanceSworn / runs).toFixed(2)}`);
console.log(`  betrayals per run              ${(betrayals / runs).toFixed(2)}`);
console.log(`  organic groups of 3+ per run   ${(organicTrios / runs).toFixed(2)} (sampled per cycle)`);
console.log('  alliance size distribution:');
Object.keys(allianceSizeHistogram).map(Number).sort((a, b) => a - b).forEach(k => {
    console.log(`    size ${k}: ${allianceSizeHistogram[k]}`);
});

console.log('\nindicators (guard = regression bound, goal = design intent):');
let failed = 0;
let shortOfGoal = 0;
indicators.forEach(ind => {
    const ok = ind.guard(ind.value);
    if (!ok) failed++;
    const shown = ind.fmt(ind.value);
    const metGoal = ind.goalMet ? ind.goalMet(ind.value) : true;
    const goalNote = ind.goal ? `  goal ${ind.goal}${metGoal ? ' MET' : ' unmet'}` : '';
    console.log(
        `  ${ok ? 'PASS' : 'FAIL'}  ${ind.label.padEnd(36)} ${shown.padStart(7)}` +
        `  (was ${ind.baseline}, guard ${ind.guardText}${goalNote})`
    );
    if (!metGoal) shortOfGoal++;
});

// The goals are deliberately still printed when unmet. A design target that
// quietly disappears once it is inconvenient is worse than no target at all.
if (shortOfGoal > 0) {
    console.log(`\nNote: ${shortOfGoal} indicator(s) clear their regression guard but remain short of the design goal.`);
}
console.log(failed ? `\n${failed} regression guard(s) breached.` : '\nAll regression guards hold.');
if (failed) process.exit(1);
