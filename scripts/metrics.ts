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
import { Simulator } from '../src/engine/simulator';
import { victorsOf } from '../src/utils/notables';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameConfig, GameState, Stance, Tribute } from '../src/models/types';
import { STANCES } from '../src/data/stances';
import { legacyOf } from '../src/data/districts';
import { coverageCells, coverageReport, initialRunState } from './runInit';
import { deathCodeOf } from '../src/engine/causes';
import { refusalSummary } from '../src/engine/actions';
import { TRAIT_DEFS } from '../src/data/traits';
import { ARCHETYPES } from '../src/data/archetypes';

const RUNS = Number(process.env.METRICS_RUNS ?? 400);

const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];
// avgDays here runs ~2 days over the soak's: every config below is a
// six-to-twelve-district field, where the soak also sweeps two- and
// three-district Games that end fast. Same counter, different fields.
const configs: GameConfig[] = [
    DEFAULT_GAME_CONFIG,
    { ...DEFAULT_GAME_CONFIG, districtCount: 6 },
    { ...DEFAULT_GAME_CONFIG, districtCount: 12, hazardRate: 1.5 },
    { ...DEFAULT_GAME_CONFIG, districtCount: 8, betrayalRate: 1.5 },
];

/**
 * AUDIT-9 B19: production's own initialisation, not a hand-written copy.
 *
 * This function used to build the state inline and omitted the `quell`
 * argument to `generateTributes`, so every Quell-specific starting loadout in
 * the game was unmeasured by the metrics batch. See `scripts/runInit.ts`.
 */
const start = (seed: string, arenaId: string, config: GameConfig): GameState =>
    initialRunState({ seed, arenaId, config });

/**
 * AUDIT-9: buckets a death by its cause *code*, not by its prose.
 *
 * This matched on string prefixes — `startsWith('Killed by ')`,
 * `includes('Bled out')`, `includes('Froze')` — against a space of 373
 * distinct cause strings, so every one of these buckets could silently empty
 * out the moment somebody reworded an obituary, and the table would keep
 * printing plausible-looking numbers. `deathCodeOf` is the one classifier now,
 * and `check-cause-codes` fails the build if any string escapes it.
 */
function bucketOf(t: Tribute): string {
    const code = deathCodeOf(t);
    // The table has always reported these families rather than all 26 codes;
    // the mapping is explicit so a new code cannot quietly land in "other".
    switch (code) {
        case 'tribute': return 'tribute';
        case 'bleeding': return 'bleeding';
        case 'dehydration': return 'dehydration';
        case 'starvation': return 'starvation';
        case 'infection':
        case 'sepsis': return 'infection';
        case 'poison': return 'poison';
        case 'hypothermia': return 'frostbite';
        case 'burns': return 'burns';
        case 'mutt': return 'mutts';
        case 'border': return 'border';
        case 'unknown': return 'unknown';
        default: return 'arena/hazard';
    }
}

const deathsByCause: Record<string, number> = {};
/** §(requests): weapon name -> kills credited to it across the sweep. */
const killsByWeapon: Record<string, number> = {};
let deaths = 0;
let victors = 0, victorKills = 0, victorZeroKills = 0, victorHealth = 0;
// AUDIT-10 B09: people crowned, and how often more than one was.
let crowned = 0, dualWins = 0;
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
/**
 * §8: per-archetype signature fire rate. `signatureFired` is already recorded
 * per tribute and has never been aggregated anywhere, so nobody could say
 * whether all fifteen archetypes' once-per-run set pieces actually fire at
 * comparable rates or whether several are effectively theoretical.
 */
const archetypeSignatures: Record<string, number> = {};
/**
 * §8: win rate by district legacy tier. Nine of sixteen districts start with
 * negative reputation and non-positive training merit — a deliberate design
 * choice (it is the underdog engine), but nothing measured whether the
 * `forgotten` tier is quietly suppressing who actually wins as opposed to
 * merely who starts behind.
 */
const tierEntrants: Record<string, number> = {};
const tierWins: Record<string, number> = {};
let runs = 0, totalDays = 0;
const runLengths: number[] = [];

// Sampled once per cycle across every living tribute.
let aliveSamples = 0, armedSamples = 0;
const stanceSamples: Record<Stance, number> = Object.fromEntries(STANCES.map((s: Stance) => [s, 0])) as Record<Stance, number>;
let bleedingSamples = 0;
/**
 * Audit 4 §3.2: the sanity distribution, which had no indicator for four
 * audits and was the worst-shaped distribution in the simulation.
 *
 * Measured before the fix: **31.4% of all live tribute-cycles at sanity 0-9
 * and 31.3% at 90+**, with the four middle deciles holding 17% between them
 * and p25 at literal zero. Half the cast went all the way down and one in a
 * thousand ever came back. Sanity was a two-state flag wearing a 0-100 scale,
 * and it was simultaneously the largest single category of feed line in the
 * game (12.9%), so the most common thing the broadcast said was a beat from a
 * state a third of the cast occupied permanently.
 *
 * Two indicators, because a single mean hides exactly this failure: how much
 * of tribute-time is spent pinned at the bottom, and how much is spent in the
 * two middle bands `sanityBands.ts` exists to create.
 */
let sanityFloorSamples = 0, sanityMidSamples = 0;
// Proficiency growth: is anyone actually getting better at anything?
let profSamples = 0, profTotal = 0, profMax = 0;
// Social systems: the ones the design review measured directly.
let runsWithLovers = 0, loverDaySum = 0, loverRuns = 0;
/*
 * AUDIT-6 §4.1: whether the last two know each other.
 *
 * The audit's headline was that 75.9% of all live relationship readings sit in
 * the neutral band. Field-wide that is mostly correct modelling — most of
 * twenty-four people never meet — and the number that actually matters is this
 * one: measured at **43.5%**, nearly half of all Games were decided between two
 * people with no regard for each other in either direction.
 */
let finalTwoSamples = 0, finalTwoStrangers = 0;
const STRANGER_BAND = 20;
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
        if (t.vitals.sanity < 10) sanityFloorSamples++;
        if (t.vitals.sanity >= 15 && t.vitals.sanity < 70) sanityMidSamples++;
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
/*
 * The two death-mix dials are settings now, so the numbers they were tuned to
 * need guards or they drift silently the next time anything touches combat.
 * Counted per Games rather than as shares, because "16 people killed by other
 * tributes" is the thing the default was set to and a share moves when the
 * field size does.
 */
let bloodbathDeathRuns = 0;
let bloodbathDeathTotal = 0;
let fullFieldRuns = 0;
let fullFieldTributeDeaths = 0;
/*
 * AUDIT-10 batch 2, the audit's §4 measurement list.
 *
 * "Add behavior metrics: impossible-action attempts ... These reveal failures
 * that 'event fired at least once' cannot." A chain that fires once in a
 * thousand runs because its actors never have the hours for it is
 * indistinguishable, to every other check here, from a chain that is meant to
 * be rare. These two counters tell them apart.
 */
const actionAttempts: Record<string, number> = {};
const actionRefusals: Record<string, number> = {};
let bloodbathFields = 0;
// SIDE-04. The training board, against the shape the source material describes.
let scored = 0;
let scoredElite = 0;
let careerScores = 0;
let careerCount = 0;

/*
 * AUDIT-9 B19: the explicit arena x config product.
 *
 * `arenaIds[i % 46]` with `configs[i % 4]` visits 92 of 184 cells and does so
 * however many runs are added, because 46 and 4 share a factor. Every arena
 * saw exactly two of the four configurations, chosen by list order. The cells
 * are enumerated now and the budget is spent inside them; the seed carries the
 * cell so repeats of a cell are different Games rather than the same one.
 */
const cells = coverageCells(arenaIds, configs.length, RUNS);
console.log(coverageReport(cells, arenaIds, configs.length));

for (let i = 0; i < RUNS; i++) {
    const cell = cells[i];
    const seed = `METRIC${i}`;
    const sim = new Simulator(start(seed, cell.arenaId, configs[cell.configIndex]));
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
        else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') {
            const fieldSize = state.tributes.length;
            sim.processBloodbath();
            bloodbathFields += fieldSize;
            const fallenAtTheHorn = sim.getState().tributes.filter(t => t.status === 'dead').length;
            bloodbathDeaths += fallenAtTheHorn;
            // Per-Games, for the default-tuning guard below. Full fields only:
            // a six-district Games cannot lose eight people at the horn and
            // averaging it in would make the guard a statement about the
            // sweep's district mix rather than about the setting.
            if (fieldSize >= 24) { bloodbathDeathRuns++; bloodbathDeathTotal += fallenAtTheHorn; }
        }
        else if (state.phase === 'epilogue') { state.phase = 'ended'; }
        else if (!sim.processTurn()) break;
        state = sim.getState();
        if (state.phase === 'day' || state.phase === 'night') {
            sampleBoard(state.tributes);
            const standing = state.tributes.filter(t => t.status === 'alive');
            if (standing.length === 2) {
                const [a, b] = standing;
                finalTwoSamples++;
                const known = Math.max(Math.abs(a.relationships[b.id] ?? 0), Math.abs(b.relationships[a.id] ?? 0));
                if (known < STRANGER_BAND) finalTwoStrangers++;
            }
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
    // AUDIT-9: off the structured kind, not off a prefix in the prose.
    vengeanceSworn += state.log.filter(l => l.type === 'vengeance-sworn').length;
    betrayals += state.log.filter(l => l.category === 'betrayal').length;

    runs++;
    totalDays += state.day;
    runLengths.push(state.day);
    Object.entries(state.actionLedger?.attempted ?? {}).forEach(([k, v]) => {
        actionAttempts[k] = (actionAttempts[k] ?? 0) + v;
    });
    refusalSummary(state).forEach(({ key, count }) => {
        actionRefusals[key] = (actionRefusals[key] ?? 0) + count;
    });
    // Full fields only for the per-Games death counts: a six-district Games
    // cannot lose sixteen people to each other, and averaging it in would make
    // the guard a statement about the sweep's district mix.
    const fullField = state.tributes.length >= 24;
    if (fullField) fullFieldRuns++;
    state.tributes.forEach(t => {
        if (t.status === 'dead') {
            deaths++;
            if (fullField && deathCodeOf(t) === 'tribute') fullFieldTributeDeaths++;
            const bucket = bucketOf(t);
            deathsByCause[bucket] = (deathsByCause[bucket] || 0) + 1;
            /*
             * §(requests): which weapon actually finished people.
             *
             * `killTribute` writes "Killed by <name> (<Weapon>)" for every
             * armed kill, so the parenthetical is the weapon by construction
             * rather than by heuristic. This table is the only way to see the
             * thing the request describes — deaths concentrated in the weakest
             * weapons in the armoury — and it was not measured at all, which
             * is why it went unnoticed for so long.
             */
            // Gated on the tribute bucket: other cause strings end in a
            // parenthetical too (a zone name, mostly), and counting those as
            // weapons put "Jungle" and "Breakwater" in the armoury table.
            if (bucket === 'tribute') {
                const named = /\(([^)]+)\)\s*$/.exec(t.causeOfDeath ?? '');
                const weapon = named ? named[1] : '(bare hands)';
                killsByWeapon[weapon] = (killsByWeapon[weapon] ?? 0) + 1;
            }
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
        if (t.signatureFired) archetypeSignatures[t.archetype] = (archetypeSignatures[t.archetype] ?? 0) + 1;
        const tier = legacyOf(t.district).tier;
        tierEntrants[tier] = (tierEntrants[tier] ?? 0) + 1;
    });
    /*
     * AUDIT-10 B09: every entrant who won, not the first row of the cast that
     * is still breathing.
     *
     * The win columns here are per-*entrant* rates: an archetype's win rate is
     * "of the N tributes who entered as this archetype, how many came home",
     * and the denominators below count every entrant. Crediting only
     * `find(alive)` therefore dropped a co-winner out of the numerator while
     * leaving them in the denominator — a silent bias against whatever the cast
     * array happened to order second, in exactly the numbers the balance pass
     * is tuned from.
     *
     * `victors` stays a count of *runs that produced a victor*, because that is
     * what the wipeout rate is measured against.
     */
    const winners = victorsOf(state);
    if (winners.length > 0) {
        victors++;
        dualWins += winners.length > 1 ? 1 : 0;
        crowned += winners.length;
    }
    winners.forEach(winner => {
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
        const winnerTier = legacyOf(winner.district).tier;
        tierWins[winnerTier] = (tierWins[winnerTier] ?? 0) + 1;
        const reaped = reapingTraits.get(winner.id) ?? [];
        reaped.forEach(trait => { reapingTraitWins[trait] = (reapingTraitWins[trait] ?? 0) + 1; });
        winner.traits.filter(trait => !reaped.includes(trait)).forEach(trait => {
            earnedTraitWins[trait] = (earnedTraitWins[trait] ?? 0) + 1;
        });
    });
    if (winners.length === 0) {
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
/**
 * AUDIT-9 stage E: how wide the error bar is on a proportion.
 *
 * The stage's completion gate is "improvements hold across explicit coverage
 * cells; uncertainty and regression budgets reported". Every indicator here
 * has been a point estimate with no error bar since the file was written,
 * which is why the comments around `GUARD_MIN_SAMPLE` read like a
 * three-audit-long argument with the instrument: guards flipping on one
 * victor, a spread of 2.94x in one audit and 4.35x in the next "without a
 * single archetype changing", indicators that "fell back to 0 and failed a
 * guard no measurement had been taken for". Every one of those is the same
 * bug — a number reported to three significant figures that was never that
 * precise.
 *
 * Wilson rather than the normal approximation, because the rates that matter
 * most here are the small ones (a 0.4% achievement, a 3% archetype) and the
 * normal interval is worst exactly there — it happily runs below zero.
 */
function wilson(successes: number, n: number, z = 1.96): { lo: number; hi: number } {
    if (n <= 0) return { lo: 0, hi: 1 };
    const p = successes / n;
    const d = 1 + (z * z) / n;
    const centre = p + (z * z) / (2 * n);
    const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
    return { lo: Math.max(0, (centre - spread) / d), hi: Math.min(1, (centre + spread) / d) };
}

/** The half-width of that interval, in percentage points. */
function marginPct(successes: number, n: number): number {
    const { lo, hi } = wilson(successes, n);
    return ((hi - lo) / 2) * 100;
}

interface Indicator {
    label: string;
    value: number;
    /**
     * AUDIT-9 stage E: the sample behind this indicator, where it is a
     * proportion. Present means an error bar is printed and the guard is
     * annotated when the interval straddles it — which is the difference
     * between "this regressed" and "this moved less than the noise".
     */
    sample?: () => { successes: number; n: number };
    /** Regression bound. Failing this fails the build. */
    guard: (v: number) => boolean;
    guardText: string;
    /** Design intent, informational only. Reported but never fails the build. */
    goal?: string;
    goalMet?: (v: number) => boolean;
    baseline: string;
    fmt: (v: number) => string;
    /**
     * AUDIT-6 §12.5: when the population behind an indicator is too small to
     * guard, the indicator reports and does not vote.
     *
     * Adding six archetypes made this real rather than theoretical. The three
     * archetype rows read off `guardable()`, and at 400 runs across 29
     * archetypes *nothing* clears GUARD_MIN_SAMPLE — so `worstArchetypeRate`
     * fell back to 0 and failed a `>= 2.6%` guard that no measurement had
     * been taken for. A guard with an empty sample behind it was asserting
     * about nothing.
     */
    judgeable?: () => boolean;
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
 *
 * §8: 100 was not large enough to mean something. At 400 runs the rarest
 * archetypes draw ~150 entrants, where a single victor moves the measured win
 * rate by two thirds of a percentage point — so the two archetype indicators
 * were flipping between PASS and FAIL on one win, and reporting a "regression"
 * that a longer run does not reproduce. The bottom archetype measured 1.32%
 * over 152 entrants and 3.59% over 613 of the same build. A guard that
 * disagrees with itself by 2.3 points is measuring the sample, not the game.
 *
 * The floor is the number of entrants at which a one-victor swing is smaller
 * than the gap between the guard and the goal. Anything under it is still
 * printed in the table above — where it is read as texture — and simply does
 * not carry a guard.
 */
const MIN_SAMPLE = 100;
/** Entrants an archetype or trait needs before its win rate can fail a guard. */
/**
 * Entrants an archetype or trait needs before its win rate can fail a guard.
 *
 * It was 250, with a note singling out `beast` as too small to guard. The note
 * was right and the number was wrong: at 400 runs a single victor moves a
 * 334-entrant archetype by 0.3 percentage points, so *any* change that
 * consumes a different number of RNG draws reshuffles all 400 runs and can
 * swing a small archetype's rate by a factor of three without anything about
 * that archetype having changed. Scholar was observed at 3.89%, 2.99%, 3.59%,
 * 2.10% and 1.20% across commits that did not touch it; at 1600 runs the same
 * two builds read 3.39% and 3.15%, which is the true difference.
 *
 * Raised so the guard only fires on populations large enough for it to
 * reproduce. Everything smaller is still measured and printed — it is just not
 * allowed to fail the build on a sample that cannot support the claim. Run
 * `METRICS_RUNS=1600 npx tsx scripts/metrics.ts` to check a small archetype
 * properly.
 */
const GUARD_MIN_SAMPLE = 500;
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
// Guarded populations only: the printed tables keep every archetype and trait
// above MIN_SAMPLE, but a guard may only fail on a population big enough for
// the failure to reproduce. See GUARD_MIN_SAMPLE.
const guardable = (rates: Array<[string, number, number]>) => rates.filter(r => r[2] >= GUARD_MIN_SAMPLE);
const archetypeGuardRates = guardable(archetypeRates);
const archetypeSpread = spreadOf(archetypeGuardRates);
/*
 * AUDIT-7 §1.6: this row printed a verdict on a two-element population.
 *
 * At the 400 runs CI uses, exactly two reaping traits clear GUARD_MIN_SAMPLE —
 * Charismatic (n=501) and Trapper (n=728) — so `spreadOf(guardable(...))` was
 * 5.79/4.81 = 1.20x, and the indicator printed "goal <= 2.5 MET". The real
 * spread over the 50 traits that clear the threshold at n=1,600 is 2.20x. The
 * number it printed was not a noisy version of the right answer; it was a
 * different statistic.
 *
 * The archetype rows above already handled this correctly, abstaining with
 * "no population over 500 entrants at this run count — reported, not guarded".
 * The trait row had no `judgeable` predicate, so it printed green where its
 * neighbours printed an abstention. It has one now, and it needs a population
 * rather than a pair: a spread is a statement about a *table*.
 */
const reapingTraitGuardRates = guardable(reapingTraitRates);
const reapingTraitSpread = spreadOf(reapingTraitGuardRates);
/** A spread over fewer traits than this is two rows of a table, not a table. */
const TRAIT_SPREAD_MIN_POPULATION = 10;
/**
 * The whole-table spread, printed without a verdict beside the guarded one — so
 * the shape of the tail is visible at 400 runs instead of only at 1,600, and so
 * nobody has to infer it from the printed table by hand.
 */
const reapingTraitFullSpread = spreadOf(reapingTraitRates);
const worstArchetypeRate = archetypeGuardRates.length ? archetypeGuardRates[archetypeGuardRates.length - 1][1] : 0;
const bestArchetypeRate = archetypeGuardRates.length ? archetypeGuardRates[0][1] : 0;
const underSampled = archetypeRates.filter(r => r[2] < GUARD_MIN_SAMPLE).map(r => r[0]);

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
        /*
         * AUDIT-6 §8.1: ratcheted after the draw was flattened. The old bound
         * was set when eight of twenty-three archetypes drew under 500 entrants
         * at n=1,600 and the best/worst rows were therefore whichever rare
         * archetype got lucky — the same commit measured 2.94x and 4.35x in two
         * consecutive audits without an archetype changing. Every archetype now
         * draws 760+ at n=1,600, so this number finally means something and can
         * be held to.
         */
        guard: v => v <= 3.4,
        guardText: '<= 3.4',
        goal: '<= 2.3',
        goalMet: v => v <= 2.3,
        baseline: '4.6',
        fmt: v => `${v.toFixed(2)}x`,
        judgeable: () => archetypeGuardRates.length >= 2,
    },
    {
        label: 'worst archetype win rate',
        value: worstArchetypeRate,
        // §8.1: ratcheted with the spread above. Measured 3.02% at n=1,600.
        guard: v => v >= 0.026,
        guardText: '>= 2.6%',
        goal: '>= 3.5%',
        goalMet: v => v >= 0.035,
        baseline: '2.56%',
        fmt: v => `${(v * 100).toFixed(2)}%`,
        judgeable: () => archetypeGuardRates.length > 0,
    },
    {
        label: 'best archetype win rate',
        value: bestArchetypeRate,
        // §8.1: ratcheted. Measured 9.02% at n=1,600, 7.38% at n=400.
        guard: v => v <= 0.102,
        guardText: '<= 10.2%',
        goal: '<= 8%',
        goalMet: v => v <= 0.08,
        baseline: '11.8%',
        fmt: v => `${(v * 100).toFixed(2)}%`,
        judgeable: () => archetypeGuardRates.length > 0,
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
        baseline: '4.31 measured here (the audit reported 4.3); 2.20 at n=1,600',
        fmt: v => `${v.toFixed(2)}x`,
        // AUDIT-7 §1.6: a spread needs a table. At 400 runs two traits clear
        // GUARD_MIN_SAMPLE and this row read 1.20x against a real 2.20x.
        judgeable: () => reapingTraitGuardRates.length >= TRAIT_SPREAD_MIN_POPULATION,
    },
    {
        /*
         * REQUEST: the average length of a Games, which is the one number a
         * player feels directly and which nothing guarded.
         *
         * Measured at 8.45 days before this landed, with the field down to 3.9
         * alive by day 7 — the arena was finishing the cast before the
         * Gamemakers ever had to, and the escalation that was supposed to be
         * the pressure was instead the full stop. The target is ten to
         * thirteen: long enough that the middle of a run is a middle rather
         * than a slide, short enough that a reader can hold the whole
         * chronicle in their head.
         *
         * Guarded as a band in both directions. A run-length indicator with
         * only a floor is how a simulation drifts into a fortnight of two
         * people not finding each other.
         */
        label: 'average run length (days)',
        value: totalDays / runs,
        guard: v => v >= 10 && v <= 13,
        guardText: '10-13',
        goal: '10.5-12',
        goalMet: v => v >= 10.5 && v <= 12,
        baseline: '8.5',
        fmt: v => v.toFixed(2),
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
        sample: () => ({ successes: bloodbathDeaths, n: bloodbathFields }),
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
        sample: () => ({ successes: deathsByCause.bleeding || 0, n: deaths }),
        guard: v => v <= 0.13,
        guardText: '<= 13%',
        goal: '<= 10%',
        goalMet: v => v <= 0.10,
        baseline: '33.1%',
        fmt: asPct,
    },
    {
        /*
         * What `bloodbathLethality`'s default was tuned to: roughly 8-11 dead
         * before the first morning is over, in a full field. Measured mean at
         * the default is 8.1 (p50 8, p90 11) over 200 runs; the guard is the
         * band either side of it that still reads as the same setting.
         */
        label: 'bloodbath deaths per full-field Games',
        value: bloodbathDeathTotal / Math.max(1, bloodbathDeathRuns),
        guard: v => v >= 6.5 && v <= 11,
        guardText: '6.5-11',
        goal: '8-11 (the default\'s design range)',
        goalMet: v => v >= 8 && v <= 11,
        baseline: '7.4 (before the setting existed)',
        fmt: v => v.toFixed(2),
    },
    {
        /*
         * And what `naturalDeathRate`'s default was tuned to: roughly 16 of a
         * full field killed by another tribute rather than by the arena. Before
         * the setting existed this was 12.0 against 11.2 natural — more than
         * half of every Games was scenery.
         */
        label: 'tribute-dealt deaths per full-field Games',
        value: fullFieldTributeDeaths / Math.max(1, fullFieldRuns),
        guard: v => v >= 12 && v <= 19,
        guardText: '12-19',
        goal: '15-17 (the default\'s design range)',
        goalMet: v => v >= 15 && v <= 17,
        baseline: '12.0 (before the setting existed)',
        fmt: v => v.toFixed(2),
    },
    {
        // The Games are meant to be tributes killing tributes rather than the
        // weather doing it for them. Not a figure the brief set a target for —
        // 40% is the author's judgement of where it ought to end up.
        label: 'deaths caused by another tribute',
        value: (deathsByCause.tribute || 0) / deaths,
        sample: () => ({ successes: deathsByCause.tribute || 0, n: deaths }),
        guard: v => v >= 0.33,
        guardText: '>= 33%',
        goal: '>= 40%',
        goalMet: v => v >= 0.40,
        baseline: '25.7%',
        fmt: asPct,
    },
    {
        /*
         * AUDIT-6 §3.1: the rarest stance in the roster, as a share of all live
         * tribute-cycles.
         *
         * Ten stances exist and five of them were under 3%, with Nursing at
         * 0.8% and Patrolling at 0.5% — roughly one tribute-cycle in a hundred
         * and twenty. Each carries a scorer row, a `minHold`, a blurb and
         * per-arena conditional action pools, so a stance that never fires is a
         * large authored surface doing nothing.
         *
         * Guarded as a floor on the *minimum* rather than as ten separate
         * indicators: what matters is that no stance has quietly become
         * decoration. A stance genuinely meant to be rare can still sit near
         * the floor; one that has fallen off the board cannot hide.
         */
        label: 'rarest stance share',
        value: (() => {
            const total = STANCES.reduce((a: number, st: Stance) => a + stanceSamples[st], 0);
            if (total === 0) return 0;
            return Math.min(...STANCES.map((st: Stance) => stanceSamples[st] / total));
        })(),
        guard: v => v >= 0.01,
        guardText: '>= 1%',
        goal: '>= 1.5%',
        goalMet: v => v >= 0.015,
        baseline: '0.5%',
        fmt: asPct,
    },
    {
        /*
         * AUDIT-6 §4.1: the share of final-two standoffs between strangers.
         *
         * Two people with no regard for each other in either direction, deciding
         * the Games. The convergence runs a recap now — every tribute still
         * standing is shown what every other one has done, and forms an opinion
         * on the spot — which took this from 43.5% to 31.5%. The remainder are
         * runs where the field fell past the convergence band before it could
         * fire, which is a legitimate shape for a Games to have.
         */
        label: 'final-two standoffs between strangers',
        value: finalTwoSamples === 0 ? 0 : finalTwoStrangers / finalTwoSamples,
        guard: v => v <= 0.42,
        guardText: '<= 42%',
        goal: '<= 30%',
        goalMet: v => v <= 0.30,
        baseline: '43.5%',
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
        //
        // §26 (requests): the goal is now five in a hundred, and it is met.
        // §11 removed the arena's right to finish the second-to-last tribute
        // and took this from 43.4% to 15.2% (n=1600); the rest of it was three
        // more doors the same ending was walking out of, all of them closed in
        // `resolveBreakdowns`, `resolveEncounters` and `collapseBorders`:
        //
        //  - the runner-up taking the nightlock or walking into the border,
        //    which was 34 of the 58 remaining cases;
        //  - the forced-finale meeting losing its roll to a hazard, a mutt or
        //    a stealth check before it could happen;
        //  - and the border leaving the arena open while the announcement said
        //    it had been closed, so the last two were herded by an objective
        //    they could decline and nothing else.
        //
        // 15.2% -> 4.4% at n=1600, 5.9% at the 400-run default. Guard ratcheted
        // 32% -> 12% so the number can keep falling and cannot climb back.
        label: 'victors with zero kills',
        value: victorZeroKills / Math.max(1, crowned),
        sample: () => ({ successes: victorZeroKills, n: crowned }),
        guard: v => v <= 0.12,
        guardText: '<= 12%',
        goal: '<= 6%',
        goalMet: v => v <= 0.06,
        baseline: '43.4%; 15.2% on main at n=1600',
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
        value: victorHealth / Math.max(1, crowned),
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
        sample: () => ({ successes: runsWithLovers, n: runs }),
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
        // Audit 4 §3.2: sanity must not be a two-state flag. A tribute pinned
        // at the floor has stopped being a character and become a status
        // effect, and the bottom band's residues fire every cycle they are
        // there — which is why this was 12.9% of every line in the feed.
        label: 'tribute-time spent at the sanity floor',
        value: sanityFloorSamples / Math.max(1, aliveSamples),
        guard: v => v <= 0.22,
        guardText: '<= 22%',
        goal: '<= 15%',
        goalMet: (v: number) => v <= 0.15,
        baseline: '31.4%',
        fmt: asPct,
    },
    {
        // The other half of the same finding: the two middle bands are the
        // ones `sanityBands.ts` was written to create — cover starting to slip,
        // foraging you no longer trust — and they held 22% of tribute-time
        // between them while the two ends held 78%.
        label: 'tribute-time in the middle sanity bands',
        value: sanityMidSamples / Math.max(1, aliveSamples),
        guard: v => v >= 0.22,
        guardText: '>= 22%',
        goal: '>= 30%',
        goalMet: (v: number) => v >= 0.30,
        baseline: '22.3%',
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
        sample: () => ({ successes: wipeouts, n: runs }),
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
        sample: () => ({ successes: (deathsByCause['mutts'] ?? 0) + (deathsByCause['arena/hazard'] ?? 0), n: deaths }),
        /*
         * AUDIT-6 §7: the ceiling goes 18% to 20%, and the reason is that the
         * ceiling and the work now disagree.
         *
         * It was set when this number was 2.3% and its job was to stop the
         * arena out-killing the cast. §7 of this audit then asked for the
         * opposite of what the ceiling assumes: **eight of forty-five arenas
         * could not produce a death that belonged to them**, and five new
         * universal deaths and thirty-four arena packs were written to fix it.
         * The result is 13.2% from arena hazards and 4.9% from mutts, which is
         * the design goal on the same row (`>= 7%`) being met rather handsomely
         * and the ceiling being brushed from underneath.
         *
         * It was also no longer resolvable at the run count CI uses. The value
         * reads **17.6% at n=1,600** and 18.0%–18.2% across three n=400 sweeps
         * of the same commit — so an 18% line failed or passed on which seeds
         * were drawn, which is the failure mode `GUARD_MIN_SAMPLE` exists to
         * prevent elsewhere in this file. A guard that fires at random is worse
         * than no guard, because it trains the reader to re-run it.
         *
         * What the ceiling was protecting is still protected, and by a number
         * with room in it: `deaths caused by another tribute` guards `>= 33%`
         * and measures **58.3%**. The cast is emphatically still the main cause
         * of death in this arena.
         */
        guard: v => v >= 0.05 && v <= 0.20,
        guardText: '5%-20%',
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
        // moved this to ~68%, then to 48.1% at n=3200.
        //
        // §9.4 closed the rest of it on the clock rather than on the stat
        // table. The measurement that mattered was not the share: it was that
        // Careers were taking those crowns with the *longest* average survival
        // in the game (4.52 days against a 3.7 field mean) on 0.96 kills. The
        // archetype whose `riskCurve` is `front-loaded`, whose story is a pack
        // that comes apart, and whose district table already said in prose
        // that "the pack falls apart once the supplies are gone" was winning
        // the attrition game. `CAREER_APPETITE` makes that prose true — the
        // head start is untouched, the hunger multiplier climbs once the
        // horn's pile is gone — and the share fell to 42.9% at n=3200, with the
        // bloodbath share, tribute-caused deaths and end health flat and four
        // further design goals (best archetype, archetype spread, worst
        // archetype, wipeouts) newly met alongside it.
        //
        // §26 (requests): second baseline correction, for the same reason as
        // the first one above, and it is the reason CI went red on `main`.
        //
        // §9.4 reported 42.9% at n=3200 and ratcheted the guard to 50% on the
        // strength of it. That figure does not reproduce either. `main` at
        // 5a9c945 measures 52.7% at METRICS_RUNS=1600 and 50.6% at the 400-run
        // default — so the guard was set below the value the build actually
        // produces, and the first commit to land after it failed the check for
        // reasons that had nothing to do with the commit. A guard a build
        // cannot pass on a good day is not a regression guard.
        //
        // Re-measured rather than re-derived. At 1,600 runs: `main` 52.7%,
        // this branch 53.6%. The 0.9 between them is inside the run-to-run
        // spread of this indicator — seeds are fixed, but any engine change
        // reshuffles the RNG stream, and single-lever probes at 400 runs were
        // measured swinging ±2 points on changes that cannot touch the
        // Careers at all. The guard below is 57%: ~3.4 points of headroom over
        // the measured value, which is that spread rather than a round number.
        //
        // The design goal stays at 45% and stays unmet, and the goal is the
        // honest number to argue with. What was tried against it this pass,
        // measured at 1,600 runs and written down rather than replaced with a
        // plausible cause:
        //
        //  - Not the §23 bloodbath work. Reverting all three of its levers
        //    (`fightChanceCareer`, `careerKillingZoneBonus`, `careerReachBonus`)
        //    together is worth 3.8 points at 400 runs, and no single one of
        //    them is worth more than 3. The first morning is not the Games.
        //  - Not the §9.4 appetite clock. See `CAREER_APPETITE` in
        //    data/balance.ts: nearly twice as steep is worth 0.7 points,
        //    because Careers are not reaching the endgame hungry.
        //
        // What the measurement does say, instrumented across 400 runs: Careers
        // hold 54.6% of final-two slots off 25% of the cast, and then *lose*
        // mixed final twos 68 to 91. The last fight is not where this is
        // decided and no amount of tuning the last fight will move it. What
        // gets them there is a pass of its own.
        label: 'Career victors',
        value: careerVictors / Math.max(1, crowned),
        sample: () => ({ successes: careerVictors, n: crowned }),
        /*
         * §8.1: ratcheted. Measured 52.1% at n=1,600, 47.0% at n=400.
         *
         * AUDIT-10: re-baselined from 55% to 60%, deliberately and once.
         *
         * The death-mix settings moved the Games from half arena attrition to
         * tribute-on-tribute killing (a median of 16 such deaths against 12
         * before). A Games decided by fighting is a Games the people who trained
         * to fight win more of; that is not a defect in the setting, it is what
         * the setting does, and measured it is worth about five points here.
         *
         * `careerReachBonus` was halved to price the largest single cause — the
         * pack arriving at the horn first, which decides who comes away armed —
         * and the rest was left alone on purpose. Three decisive sweeps
         * (n=1637-1641) at reach bonuses of 2.5, 1.75 and 1.25 measured 57.5%,
         * 58.1% and 54.4% against a +/-2.4pp interval: non-monotonic, so the
         * knob is inside the noise and tuning to 55% would be fitting a number
         * to one sweep. The comment above already records that the last fight
         * is not where this is decided.
         *
         * The **goal is unchanged at <= 45%**, and the pass that would earn it
         * is batch 4 of `PLAN-AUDIT-10.md` — the opportunity funnel and matched
         * cohorts, which is the instrument for asking *why* Careers convert
         * final-two slots, rather than another knob moved until a number fits.
         */
        guard: v => v <= 0.60,
        guardText: '<= 60%',
        goal: '<= 45%',
        goalMet: v => v <= 0.45,
        baseline: '76.3% measured (audit reported 40.1%, did not reproduce); 52.7% on main at n=1600 before the death-mix settings, 57.5% after',
        fmt: asPct,
    },
];

console.log(`runs=${runs} victors=${victors} deaths=${deaths} avgDays=${(totalDays / runs).toFixed(1)}`);

/*
 * AUDIT-10 batch 2: the behaviour ledger.
 *
 * Reported rather than guarded, deliberately. A refusal is not a defect — a
 * tribute out of hours *should* be refused — and the number worth acting on is
 * the ratio: a chain refused far more often than it is attempted is a chain
 * whose prerequisites nobody can meet, which is the failure the audit says the
 * existing checks cannot see. Guards come once there is a measured normal to
 * regress against.
 */
{
    const kinds = [...new Set([
        ...Object.keys(actionAttempts),
        ...Object.keys(actionRefusals).map(k => k.split(':')[0]),
    ])].sort();
    if (kinds.length > 0) {
        console.log('\naction ledger (attempted vs refused, per run):');
        kinds.forEach(kind => {
            const done = actionAttempts[kind] ?? 0;
            const refused = Object.entries(actionRefusals)
                .filter(([k]) => k.startsWith(`${kind}:`));
            const refusedTotal = refused.reduce((sum, [, v]) => sum + v, 0);
            const why = refused
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `${k.split(':')[1]} ${(v / runs).toFixed(1)}`)
                .join(', ');
            const share = done + refusedTotal > 0
                ? `${((done / (done + refusedTotal)) * 100).toFixed(0)}% got through`
                : 'never reached';
            console.log(`  ${kind.padEnd(18)} ${(done / runs).toFixed(1)} done, `
                + `${(refusedTotal / runs).toFixed(1)} refused — ${share}`
                + (why ? `  (${why})` : ''));
        });
    }
}
console.log('\ncause of death:');
Object.entries(deathsByCause)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k.padEnd(14)} ${pct(v, deaths).padStart(6)}  (${v})`));

console.log('\nvictor profile:');
console.log(`  average kills      ${(victorKills / Math.max(1, crowned)).toFixed(2)}`);
console.log(`  zero-kill victors  ${pct(victorZeroKills, crowned)}`);
console.log(`  people crowned     ${crowned} across ${victors} Games with a victor (${dualWins} dual)`);
console.log(`  average end health ${(victorHealth / Math.max(1, crowned)).toFixed(1)}`);

console.log('\nvictors by district:');
{
    const districts = Object.keys(victorsByDistrict).map(Number).sort((a, b) => a - b);
    districts.forEach(d => {
        const n = victorsByDistrict[d];
        const bar = '#'.repeat(Math.round((n / Math.max(1, victors)) * 60));
        console.log(`  D${String(d).padStart(2)}  ${pct(n, victors).padStart(6)}  (${String(n).padStart(3)})  ${bar}`);
    });
    console.log(`  Careers            ${pct(careerVictors, crowned)}`);
    console.log(`  top three combined ${pct(topThreeDistrictShare * victors, victors)}`);
    console.log(`  wipeouts (no victor at all) ${pct(wipeouts, runs)}`);
}

console.log('\nboard samples:');
console.log(`  carrying a weapon  ${pct(armedSamples, aliveSamples)}`);
console.log(`  currently bleeding ${pct(bleedingSamples, aliveSamples)}`);
/**
 * §8: trait power level, measured rather than eyeballed.
 *
 * The audit could not answer "is any trait obviously over- or under-tuned"
 * from a read of the tables, because a trait's power is the sum of several
 * modifiers on several different scales. This is the same "measure, don't
 * guess" move `test:flavor` applies to pool depth, applied to trait strength:
 * bucket every numeric modifier by rough category, sum its magnitude per
 * trait, and flag anything sitting well outside its own category's mean.
 *
 * Deliberately a report and not a guard. Modifier magnitude is a proxy for
 * power, not a measurement of it — a 0.3 on `combatPower` and a 0.3 on
 * `sanityRecovery` are not the same amount of game — so this is a shortlist
 * for a human to look at, and failing the build on a proxy would be worse
 * than not measuring at all.
 */
{
    type Category = 'combat' | 'social' | 'survival';
    const CATEGORY_OF: Record<string, Category> = {};
    const put = (cat: Category, keys: string[]) => keys.forEach(k => { CATEGORY_OF[k] = cat; });
    put('combat', ['combatPower', 'ambush', 'concealment', 'awareness', 'awarenessNight', 'targetDraw',
        'evasion', 'killSanity', 'critChance', 'retreat', 'weaponAffinity', 'wrestle', 'ranged', 'muttDamage']);
    put('social', ['allianceAffinity', 'treachery', 'betrayalResist', 'persuasion', 'sponsorAppeal',
        'charmBonus', 'rapport', 'intimidation', 'romanceAffinity']);
    put('survival', ['hungerDrain', 'thirstDrain', 'fatigueDay', 'fatigueNight', 'sanityDrain',
        'sanityRecovery', 'bleedResist', 'poisonResist', 'burnResist', 'coldResist', 'heatResist',
        'forage', 'medicine', 'water', 'climb', 'trapSkill', 'resolveDrift']);

    const perTrait: Array<{ name: string; cat: Category; magnitude: number }> = [];
    Object.entries(TRAIT_DEFS).forEach(([name, def]) => {
        const totals: Record<Category, number> = { combat: 0, social: 0, survival: 0 };
        Object.entries(def.mods ?? {}).forEach(([key, value]) => {
            if (typeof value !== 'number') return;
            const cat = CATEGORY_OF[key];
            if (!cat) return;
            // Normalised: the drain modifiers are flat points on a 0-100 vital
            // and everything else is a 0-1-ish scalar, so a raw sum would say
            // Camel is forty times the trait Ruthless is.
            totals[cat] += Math.abs(value) / (Math.abs(value) > 1.5 ? 10 : 1);
        });
        const dominant = (Object.keys(totals) as Category[]).sort((a, b) => totals[b] - totals[a])[0];
        const magnitude = totals.combat + totals.social + totals.survival;
        if (magnitude > 0) perTrait.push({ name, cat: dominant, magnitude });
    });

    console.log('\ntrait power level by category (magnitude of combined numeric modifiers):');
    (['combat', 'social', 'survival'] as Category[]).forEach(cat => {
        const inCat = perTrait.filter(t => t.cat === cat);
        if (inCat.length === 0) return;
        const mean = inCat.reduce((sum, t) => sum + t.magnitude, 0) / inCat.length;
        const sd = Math.sqrt(inCat.reduce((sum, t) => sum + (t.magnitude - mean) ** 2, 0) / inCat.length) || 1;
        const outliers = inCat
            .filter(t => Math.abs(t.magnitude - mean) > sd * 1.5)
            .sort((a, b) => b.magnitude - a.magnitude);
        console.log(`  ${cat.padEnd(9)} n=${String(inCat.length).padStart(2)}  mean ${mean.toFixed(2)}  sd ${sd.toFixed(2)}`);
        outliers.forEach(t => console.log(
            `      ${t.magnitude > mean ? 'hot ' : 'cold'} ${t.name.padEnd(18)} ${t.magnitude.toFixed(2)}`
            + ` (${((t.magnitude - mean) / sd).toFixed(1)} sd)`));
        if (outliers.length === 0) console.log('      no trait more than 1.5 sd from its category mean');
    });
}

/**
 * §8: does every archetype's once-per-run set piece actually fire? A signature
 * that fires for one archetype in twenty is a design promise the player never
 * sees kept, and it is invisible in a win-rate table.
 */
let signatureFailures = 0;
console.log('\narchetype signature fire rate (share of entrants whose set piece fired):');
{
    const rates = Object.keys(ARCHETYPES)
        .map(id => [id, (archetypeSignatures[id] ?? 0) / Math.max(1, archetypeEntrants[id] ?? 0), archetypeEntrants[id] ?? 0] as const)
        .sort((a, b) => b[1] - a[1]);
    rates.forEach(([id, rate, n]) => console.log(
        `  ${id.padEnd(12)} ${pct(rate * n, n).padStart(6)}  (n=${n})`));
    const fired = rates.filter(r => r[2] >= GUARD_MIN_SAMPLE);
    if (fired.length > 1) {
        const best = fired[0], worst = fired[fired.length - 1];
        console.log(`  spread: ${best[0]} ${pct(best[1] * best[2], best[2])} vs ${worst[0]} ${pct(worst[1] * worst[2], worst[2])}`);
    }
    /*
     * AUDIT-7 §8.2: the floor this table printed and never enforced.
     *
     * At n=1,600 the spread ran survivalist 60.4% to quartermaster 19.8% —
     * 3.05x — and the bottom four (captor, warden, broker, quartermaster) were
     * all below the *old* floor of the fifteen-archetype roster AUDIT-6
     * measured. Three of the four were alliance-gated: their set piece needed
     * another tribute, in the same zone, in the same group, at the same moment.
     *
     * A signature is the once-per-run beat that makes an archetype a character
     * rather than four bias scalars, so a rate of one in five is a promise the
     * player mostly does not see kept. Guarded over adequately-sampled
     * archetypes only, for the same reason every other guard here is.
     */
    /*
     * Two numbers, not one — the lesson of AUDIT-7 §1.7, where a floor set
     * equal to its own target made the backlog structurally always zero.
     *
     * `SIGNATURE_FLOOR` is the hard minimum every adequately-sampled signature
     * clears *today*; it fails the build and may only be raised.
     * `SIGNATURE_TARGET` is where the roster is going, reported as
     * distance-to-go and never failed. History of the floor: the roster ran
     * 16.7% to 64.6% when this section was written.
     */
    const SIGNATURE_FLOOR = 0.29;
    const SIGNATURE_TARGET = 0.35;
    const starved = fired.filter(([, rate]) => rate < SIGNATURE_FLOOR);
    const shortOfTarget = fired.filter(([, rate]) => rate < SIGNATURE_TARGET);
    if (starved.length > 0) {
        console.log(`  ${starved.length} signature(s) under the ${(SIGNATURE_FLOOR * 100).toFixed(0)}% floor: `
            + starved.map(([id, rate]) => `${id} ${(rate * 100).toFixed(1)}%`).join(', '));
        signatureFailures = starved.length;
    } else if (fired.length > 0) {
        const lowest = fired[fired.length - 1];
        console.log(`  every adequately-sampled signature clears the ${(SIGNATURE_FLOOR * 100).toFixed(0)}% floor`
            + ` (${fired.length} of ${rates.length} archetypes over ${GUARD_MIN_SAMPLE} entrants);`
            + ` thinnest ${lowest[0]} ${(lowest[1] * 100).toFixed(1)}%.`);
        if (shortOfTarget.length > 0) {
            console.log(`  ${shortOfTarget.length} still under the ${(SIGNATURE_TARGET * 100).toFixed(0)}% target: `
                + shortOfTarget.map(([id, rate]) => `${id} ${(rate * 100).toFixed(1)}%`).join(', '));
        }
        if (lowest[1] > SIGNATURE_FLOOR + 0.02) {
            console.log(`  raise SIGNATURE_FLOOR to ${(lowest[1] * 100).toFixed(0) }% in scripts/metrics.ts to lock that in.`);
        }
    }
}

/**
 * §8: and who actually wins, by district legacy tier rather than by district.
 * Over half the roster starts behind on purpose; this is the check that
 * "starts behind" has not become "cannot win".
 */
console.log('\nwin rate by district legacy tier:');
Object.keys(tierEntrants)
    .sort((a, b) => (tierWins[b] ?? 0) / tierEntrants[b] - (tierWins[a] ?? 0) / tierEntrants[a])
    .forEach(tier => console.log(
        `  ${tier.padEnd(10)} ${pct(tierWins[tier] ?? 0, tierEntrants[tier]).padStart(6)}`
        + `  (${tierWins[tier] ?? 0} of ${tierEntrants[tier]} entrants)`));

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
console.log("  note: 'Trapper' is also issued to District 3 at the reaping (generator.ts), and archetype");
console.log('  preferredTraits skew every other large sample here. A trait far off the field mean with a');
console.log('  large n is as likely to be measuring who receives it as what it does.');
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
let indecisive = 0;
indicators.forEach(ind => {
    const judgeable = ind.judgeable ? ind.judgeable() : true;
    const ok = ind.guard(ind.value);
    if (judgeable && !ok) failed++;
    const shown = ind.fmt(ind.value);
    const metGoal = ind.goalMet ? ind.goalMet(ind.value) : true;
    const goalNote = ind.goal ? `  goal ${ind.goal}${metGoal ? ' MET' : ' unmet'}` : '';
    if (!judgeable) {
        console.log(
            `  ----  ${ind.label.padEnd(36)} ${shown.padStart(7)}` +
            `  (fewer than the minimum population over ${GUARD_MIN_SAMPLE} entrants at this run count`
            + ` — reported, not guarded; re-run with METRICS_RUNS=1600)`
        );
        return;
    }
    /*
     * AUDIT-9 stage E: the error bar, and whether the guard is inside it.
     *
     * A PASS whose confidence interval straddles the guard is not evidence
     * that the guard holds; it is evidence that this run count cannot tell.
     * Saying so is the whole of the "uncertainty reported" gate — the number
     * is unchanged, what changes is how much weight a reader gives it.
     */
    let uncertainty = '';
    if (ind.sample) {
        const { successes, n } = ind.sample();
        const margin = marginPct(successes, n);
        const { lo, hi } = wilson(successes, n);
        const straddles = !ind.guard(lo) || !ind.guard(hi);
        uncertainty = `  [+/-${margin.toFixed(1)}pp, n=${n}${straddles ? ', guard inside the interval — not decisive at this run count' : ''}]`;
        if (straddles) indecisive++;
    }
    console.log(
        `  ${ok ? 'PASS' : 'FAIL'}  ${ind.label.padEnd(36)} ${shown.padStart(7)}` +
        `  (was ${ind.baseline}, guard ${ind.guardText}${goalNote})${uncertainty}`
    );
    if (!metGoal) shortOfGoal++;
});

/*
 * AUDIT-9 stage E: the regression budget, stated rather than implied.
 *
 * An indicator whose confidence interval contains its own guard has not been
 * tested by this run: it would read PASS on a simulation that had genuinely
 * regressed past the bound, and FAIL on one that had not, and which it does is
 * a coin flip on the seeds. Naming those rows is the difference between a
 * green suite and a green suite you can act on.
 */
if (indecisive > 0) {
    console.log(`\n${indecisive} indicator(s) cannot be decided at ${runs} runs: the guard lies inside the `
        + '95% interval, so the verdict is noise either way. Re-run with METRICS_RUNS=1600 before '
        + 'concluding anything from them.');
}

// The goals are deliberately still printed when unmet. A design target that
// quietly disappears once it is inconvenient is worse than no target at all.
if (shortOfGoal > 0) {
    console.log(`\nNote: ${shortOfGoal} indicator(s) clear their regression guard but remain short of the design goal.`);
}
if (underSampled.length) {
    console.log(`Note: ${underSampled.join(', ')} drew fewer than ${GUARD_MIN_SAMPLE} entrants; reported above, but not guarded — `
        + `at this run count one victor moves their rate too far for a pass/fail to reproduce.`);
}

/**
 * Audit 3 §1.5: the same three statistics over the *whole* field, printed
 * where the guarded ones cannot be mistaken for them.
 *
 * `GUARD_MIN_SAMPLE` is right — a guard that fires on a 270-entrant archetype
 * fails on RNG reshuffles rather than on balance. But the report read
 * `archetype win-rate spread 1.63x  goal <= 2.3 MET` on a line computed over
 * seven of fifteen archetypes, while the two that actually miss the goal were
 * the two the guard is structurally unable to see. A design target reported as
 * met over the subset that meets it is not a design target.
 *
 * These carry no guard for exactly the reason above. They carry the goal, so
 * the gap is visible, and the run count needed to close the confidence gap is
 * named rather than left as an exercise.
 *
 * Audit 4 §1.6: and they now *withhold the verdict* below the sample size at
 * which it reproduces. At the default 400 runs this block printed
 * `spread 2.77x SHORT of goal` and `worst zealot 2.79% SHORT of goal`; at
 * 1,600 the same two lines read 1.92x and 3.82%, both MET. Eight of fifteen
 * archetypes draw under `GUARD_MIN_SAMPLE` at 400 runs, so the whole-field
 * spread is set by whichever small archetype got unlucky — zealot needed four
 * more victors. A default invocation telling its reader that balance is
 * failing when it is not is worse than one that says it cannot yet tell.
 */
{
    const fullSpread = spreadOf(archetypeRates);
    const worstFull = archetypeRates[archetypeRates.length - 1];
    const bestFull = archetypeRates[0];
    // Every member of the field has to clear the guard sample before a
    // best/worst verdict over the whole field means anything: the extremes are
    // by definition the rows most sensitive to one victor.
    const canJudge = archetypeRates.every(([, , n]) => n >= GUARD_MIN_SAMPLE);
    const verdict = (met: boolean) => (canJudge ? (met ? 'goal MET' : 'SHORT of goal') : 'not yet judgeable');
    console.log('\nwhole-field archetype balance (every archetype, no guard — see GUARD_MIN_SAMPLE):');
    console.log(`  spread (best/worst)   ${fullSpread.toFixed(2)}x  ${verdict(fullSpread <= 2.3)}  (goal <= 2.3x)`);
    console.log(`  best   ${bestFull[0]} ${(bestFull[1] * 100).toFixed(2)}% (n=${bestFull[2]})`);
    console.log(`  worst  ${worstFull[0]} ${(worstFull[1] * 100).toFixed(2)}% (n=${worstFull[2]})`
        + `  ${verdict(worstFull[1] >= 0.035)}${canJudge ? '' : ''} (goal >= 3.5%)`);
    if (!canJudge) {
        console.log(`  Reported without a verdict: ${underSampled.length} archetype(s) are under ${GUARD_MIN_SAMPLE}`);
        console.log(`  entrants at ${runs} runs, and the best/worst rows are the two most sensitive`);
        console.log(`  to a single victor. Re-run with METRICS_RUNS=1600 to judge these two lines.`);
    } else if (fullSpread > 2.3 || worstFull[1] < 0.035) {
        console.log(`  These two lines are the design targets over the real cast, and every`);
        console.log(`  archetype cleared ${GUARD_MIN_SAMPLE} entrants at ${runs} runs, so the verdict stands.`);
    }
}

/*
 * AUDIT-7 §1.6: the same treatment for reaping traits, which had none.
 *
 * The guarded row above is computed over traits clearing GUARD_MIN_SAMPLE, and
 * at 400 runs that is two of them. Printing only that left a reader with no way
 * to see the tail without adding up the printed table by hand — and the tail is
 * where trait balance actually lives: the bottom four rows are all one- and
 * two-modifier traits.
 *
 * So the whole-table spread is printed beside the guarded one, with the same
 * withheld verdict, and the bottom of the table is named.
 */
{
    const worstFull = reapingTraitRates[reapingTraitRates.length - 1];
    const bestFull = reapingTraitRates[0];
    /*
     * AUDIT-10 F20: judge this table on the rows it is comparing.
     *
     * `canJudge` used to be `reapingTraitGuardRates.length >= TRAIT_SPREAD_MIN_POPULATION`
     * — "have at least ten *other* traits cleared the 500-entrant guard?" — and
     * that question has nothing to do with whether *these two rows* are
     * measured well enough to be ranked against each other. It printed "SHORT
     * of goal" for Ruthless against Slow Burn at 248 and 303 entrants, while
     * only 27 of 155 observed labels cleared 500 at all. The exploratory table
     * is useful; a release verdict off two under-sampled rows is not, and the
     * eligibility rule was not the one the verdict needed.
     *
     * So: a verdict requires the two compared rows to clear the same guard
     * every other judged row clears. Below that this is an exploratory ranking
     * and says so, with intervals, so a reader can see how wide the rows are
     * rather than inferring precision from a two-decimal ratio.
     */
    const comparedN = [bestFull?.[2] ?? 0, worstFull?.[2] ?? 0];
    const canJudge = comparedN.every(n => n >= GUARD_MIN_SAMPLE);
    console.log('\nwhole-table reaping-trait balance (every trait over MIN_SAMPLE, no guard):');
    // A trait with zero victors on a 109-entrant sample makes the ratio
    // infinite, which is a statement about the sample and not about the trait.
    // Print it as what it is rather than as a number.
    const spreadText = Number.isFinite(reapingTraitFullSpread)
        ? `${reapingTraitFullSpread.toFixed(2)}x`
        : 'unbounded (a trait at zero victors)';
    console.log(`  spread (best/worst)   ${spreadText}`
        + `  ${canJudge ? (reapingTraitFullSpread <= 2.5 ? 'goal MET' : 'SHORT of goal') : 'exploratory — no verdict'}  (goal <= 2.5x)`);
    // F20: the interval on each compared row, so the ratio above is read with
    // the width of the things it is a ratio of.
    const row = (label: string, entry: typeof bestFull) => {
        if (!entry) return;
        const [name, rate, n] = entry;
        const margin = marginPct(Math.round(rate * n), n);
        console.log(`  ${label}  ${name} ${(rate * 100).toFixed(2)}% [+/-${margin.toFixed(1)}pp, n=${n}]`);
    };
    row('best ', bestFull);
    row('worst', worstFull);
    console.log(`  ${reapingTraitGuardRates.length} of ${reapingTraitRates.length} traits clear ${GUARD_MIN_SAMPLE} entrants.`);
    if (!canJudge) {
        console.log(`  No verdict: a release gate needs BOTH compared rows at ${GUARD_MIN_SAMPLE}+ entrants`);
        console.log(`  and they are at ${comparedN.join(' and ')}. This ranking is exploratory — use it to`);
        console.log(`  choose what to oversample, not to pass or fail a build. Re-run with METRICS_RUNS=1600.`);
    }
    // The tail is the actionable part: a trait far off the mean on a small
    // sample is noise, but a *cluster* at the bottom is a family that is weak.
    const tail = reapingTraitRates.slice(-6).map(([k, v, n]) => `${k} ${(v * 100).toFixed(2)}% (n=${n})`);
    console.log(`  bottom six: ${tail.join(', ')}`);
}
// AUDIT-7 §8.2: counted alongside the indicator guards rather than beside them.
failed += signatureFailures;
/*
 * §(requests): the armoury's share of the killing, sorted.
 *
 * Reported rather than guarded for now: the right shape is "the heavy end of
 * the table finishes more people than the light end", and that is a claim
 * about ordering across ~30 weapons rather than a single threshold. Printing
 * it is what makes the ordering checkable at all.
 */
const weaponKills = Object.entries(killsByWeapon).sort((a, b) => b[1] - a[1]);
const weaponKillTotal = weaponKills.reduce((sum, [, n]) => sum + n, 0);
if (weaponKillTotal > 0) {
    console.log('\nkills by weapon (share of all tribute-dealt deaths):');
    weaponKills.forEach(([name, n]) => {
        console.log(`  ${name.padEnd(24)} ${(100 * n / weaponKillTotal).toFixed(1).padStart(5)}%  (${n})`);
    });
}

console.log(failed ? `\n${failed} regression guard(s) breached.` : '\nAll regression guards hold.');
if (failed) process.exit(1);
