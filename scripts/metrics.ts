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
    const tributes = generateTributes(seed, config, arena.zones[0].name);
    return { seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: false, config, logCounter: 0, feastsHeld: 0, cycle: 0 };
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
let runs = 0, totalDays = 0;

// Sampled once per cycle across every living tribute.
let aliveSamples = 0, armedSamples = 0;
const stanceSamples: Record<Stance, number> = { Aggressive: 0, Defensive: 0, Evasive: 0 };
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

for (let i = 0; i < RUNS; i++) {
    const seed = `METRIC${i}`;
    const sim = new Simulator(start(seed, arenaIds[i % arenaIds.length], configs[i % configs.length]));
    let guard = 3000;
    let state = sim.getState();

    while (state.phase !== 'ended' && guard-- > 0) {
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') sim.processBloodbath();
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
    state.tributes.forEach(t => {
        if (t.status === 'dead') {
            deaths++;
            const bucket = bucketOf(t.causeOfDeath);
            deathsByCause[bucket] = (deathsByCause[bucket] || 0) + 1;
        }
    });
    const winner = state.tributes.find(t => t.status === 'alive');
    if (winner) {
        victors++;
        victorKills += winner.kills;
        if (winner.kills === 0) victorZeroKills++;
        victorHealth += winner.health;
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

const indicators: Indicator[] = [
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
        label: 'victor average end health',
        value: victorHealth / Math.max(1, victors),
        guard: v => v >= 45,
        guardText: '>= 45',
        baseline: '48.4',
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

console.log('\nboard samples:');
console.log(`  carrying a weapon  ${pct(armedSamples, aliveSamples)}`);
console.log(`  currently bleeding ${pct(bleedingSamples, aliveSamples)}`);
console.log(`  stance             Defensive ${pct(stanceSamples.Defensive, aliveSamples)} / Evasive ${pct(stanceSamples.Evasive, aliveSamples)} / Aggressive ${pct(stanceSamples.Aggressive, aliveSamples)}`);
if (profSamples > 0) {
    console.log(`  best proficiency   avg ${(profTotal / profSamples).toFixed(2)}, peak ${profMax.toFixed(2)}`);
}

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
