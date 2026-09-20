/**
 * Headless soak test: runs hundreds of complete simulations across every
 * arena and a spread of configs, then asserts the invariants that matter
 * (no infinite loops, vitals in range, unique names and log ids, no
 * unreplaced text placeholders, deterministic output for a fixed seed).
 *
 * The second half of the file asserts the invariants introduced by the
 * combat/relationship/memory overhaul: zones must recover instead of being
 * stripped permanently, stances must not thrash cycle to cycle, grief and
 * betrayal must never push a relationship outside its bounds, and every
 * obituary must name the thing that actually landed the killing blow.
 *
 *   npm run test:sim
 */
import { coverageCells, coverageReport, initialRunState } from './runInit';
import { emptyTruceLedger, truceLedger } from '../src/engine/parley';
import { OFF_SEASON_SKINS } from '../src/data/offSeason';
import { PARLEY_TEXTS } from '../src/data/flavorText';
const TRUCE_LEDGER = emptyTruceLedger();
import { generateTributes, strengthCapForAge } from '../src/engine/generator';
import { generateArena } from '../src/engine/arenaGenerator';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG, ITEMS, traitsConflict } from '../src/data/constants';
import { ARENA_FLAVOR, DERIVED_ID_COLLISIONS, UNIVERSAL_EVENTS } from '../src/data/arenaFlavor';
/**
 * Audit 4 §1.5: **per-run** reach, not sweep reach.
 *
 * This used to be `EVENT_REACH_FLOOR = 0.45` on the share of all 1,388
 * authored events that fired at least once across the whole sweep, and the
 * line it printed — "695/1388 (50.1%)" — reads like half the authored content
 * is unreachable. It is not. The sweep runs 400 runs across 41 arena ids, so
 * each arena gets about ten runs; measured at 120 runs on one arena, reach is
 * 94-100% (eclipse, the sweep's thinnest pack at 8/33, reaches all 33).
 *
 * The old statistic was therefore a function of `RUNS / arenaIds.length`: it
 * falls when somebody adds an arena and rises when somebody raises the run
 * count, which are the two changes a ratchet must not react to. What is stable,
 * and is what the player actually experiences, is how much of its own pack an
 * arena shows in a single Games. Measured range across four arenas at 120 runs
 * each on the default config: frozen 3.7, reef 5.5, eclipse 6.7, labyrinth 8.0
 * of 33.
 *
 * The floor is on the **sweep-wide** mean, not per arena. This sweep gives each
 * arena about ten runs and sweeps two- and three-district configs that end in a
 * few days (the same reason the `avgDays` comment above exists), so a
 * per-arena mean at n=10 swings a whole event either way on one short run and
 * is not a threshold anybody could act on. The per-arena figures are printed
 * so a genuinely thin pack is visible; only the aggregate is guarded.
 */
const EVENT_REACH_PER_RUN_FLOOR = 3.5;
import { ALLIANCES, FEAR, GENERATION, HUNTING, NOTORIETY, PROFICIENCY, RELATIONSHIPS, ZONES } from '../src/data/balance';
import { carryCapacity } from '../src/engine/items';
import { emptyPickCount } from '../src/utils/rng';
import { oddsScore, tributeOdds } from '../src/engine/odds';
import { GameConfig, GameState, Item, Stance, Tribute } from '../src/models/types';
import { giveItem } from '../src/engine/items';
import { deathCodeOf } from '../src/engine/causes';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';

const problems: string[] = [];
const note = (m: string) => { if (!problems.includes(m)) problems.push(m); };

/*
 * AUDIT-9 B08: stacks conserve quantity, asserted rather than assumed.
 *
 * `giveItem` silently destroyed stack overflow for a long time — six units of
 * bread became four, and nothing anywhere recorded it — because the only thing
 * watching item movement was whether anybody noticed a missing loaf in a log
 * line. The audit's repair condition was explicit: "assert input quantity =
 * retained + explicitly dropped/consumed quantity."
 *
 * This is that assertion, at the one function every acquisition funnels
 * through. It runs over the real runs the soak is already doing rather than as
 * a unit test, so it also covers the shapes only a live run produces: a full
 * pack, a tribute who has just lost their backpack, a stack landing on a
 * partial stack of the same thing.
 */
function checkStackConservation() {
    const units = (items: Item[]) => items.reduce((sum, i) => sum + (i.stack ?? 1), 0);
    const holder = (): Tribute => ({
        id: 'conservation-probe', traits: [], quirks: [], inventory: [],
        attributes: { strength: 5, agility: 5, intelligence: 5, endurance: 5, charisma: 5 },
    } as unknown as Tribute);
    const stackable = ITEMS.filter(i => i.stack !== undefined);
    stackable.forEach(base => {
        for (let seed = 1; seed <= base.stack! + 2; seed++) {
            for (let incoming = 1; incoming <= base.stack! + 2; incoming++) {
                const t = holder();
                t.inventory.push({ ...base, stack: seed });
                const before = units(t.inventory) + incoming;
                const dropped = giveItem(t, { ...base, stack: incoming });
                const after = units(t.inventory) + units(dropped);
                if (after !== before) {
                    note(`giveItem loses quantity: ${base.id} ${seed}+${incoming} -> kept+dropped ${after}, expected ${before}`);
                    return;
                }
            }
        }
    });
}
checkStackConservation();

const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];
/** Phases in which the arena exists and a tribute's behaviour means something. */
const ARENA_PHASES = new Set(['bloodbath', 'day', 'night', 'feast']);
/** Every `ZoneEffectKind`, so the sweep can assert each one actually occurs. */
const ZONE_EFFECT_KINDS = [
  'burning', 'flooded', 'frozen', 'contaminated', 'fogbound', 'stripped',
  'blooming', 'irradiated', 'quaking', 'swarming',
] as const;
// Note on avgDays: this sweep and `metrics.ts` both count `state.day` at the
// end of the run, but they sweep different configs. Two of the four here are
// two- and three-district fields that end in a few days, which is why the
// soak's average sits ~2 days under the metrics sweep's. Neither is wrong;
// they are measuring different Games.
//
// REQUEST (run length): the ten-to-thirteen-day target is a statement about a
// *full* Games, and it is guarded in `metrics.ts`, whose four configs are all
// six-to-twelve-district fields. A two-district Games is four people and is
// supposed to be over quickly. So this file reports both numbers — the whole
// sweep's average, and the average over the full fields only, which is the one
// comparable to the metrics guard. Reporting one without the other is how
// "the soak says 8.1" gets mistaken for a regression.
const FULL_FIELD_DISTRICTS = 6;
const configs: GameConfig[] = [
  DEFAULT_GAME_CONFIG,
  { ...DEFAULT_GAME_CONFIG, districtCount: 2, hazardRate: 2.5, betrayalRate: 3, sponsorGenerosity: 0 },
  { ...DEFAULT_GAME_CONFIG, districtCount: 12, hazardRate: 0.25, betrayalRate: 0, sponsorGenerosity: 3, enableFeast: false, enableSanity: false },
  { ...DEFAULT_GAME_CONFIG, districtCount: 3, enableFeast: true, enableSanity: true, hazardRate: 2 },
];

/**
 * AUDIT-6 §1.2: every prose probe in this file, and whether it still matches
 * anything.
 *
 * This file measures the engine by grepping its English, which works right up
 * until somebody rewrites a line. Two probes had been reading zero for several
 * commits — `treatiesSworn` ("anybody made on behalf of somebody else") and
 * `successionUnnamed` ("nothing agreed about what happens next"). Both strings
 * had been edited out of `src/` entirely. The soak printed
 * `blocTreaties: sworn=0 … lapsed=6`, which is arithmetically impossible, and
 * stayed green because these counters are reported rather than asserted.
 *
 * So every `/…/.test(l.text)` in this file goes through here instead. A probe
 * registers itself the first time it is evaluated and records a hit whenever it
 * matches; anything still at zero after the whole sweep is a dead probe and
 * fails the run by name. That is the assertion that would have caught both on
 * the commit that broke them.
 *
 * `expectedRare` is the escape hatch, and it is deliberately small: a probe
 * listed there is allowed to read zero because the beat it watches is genuinely
 * rarer than the sweep. Adding to it is a decision somebody has to write down.
 */
/**
 * AUDIT-9, second pass: a measured beat, counted by what it *is*.
 *
 * This replaces `prose(...)` at every counter in this file. The probes were
 * the file's own documented weakness — it says so in the header, about two of
 * them that read zero for several commits — and the dead-probe assertion added
 * with the first pass only catches a probe that reaches exactly zero. A reword
 * that costs a counter most of its hits, or a regex loose enough to count
 * somebody else's lines, stays silent and stays wrong.
 *
 * Both happened. See `DEAD_TYPES` below and the migration notes in the commit:
 * six of these counters were reading lines that were not the beat at all.
 */
const beatCounts = new Map<string, number>();
function beat(l: { type?: string }, type: string): boolean {
  if (!beatCounts.has(type)) beatCounts.set(type, 0);
  if (l.type !== type) return false;
  beatCounts.set(type, (beatCounts.get(type) ?? 0) + 1);
  return true;
}

/**
 * Types allowed to read zero across a sweep, with the reason. Deliberately
 * small, like `PROSE_ALLOWED_ZERO`: adding to it is a decision somebody writes
 * down.
 */
const BEAT_ALLOWED_ZERO = new Map<string, string>([
  ['expulsion', 'the hearing-driven expulsion: it needs a second charter breach, a hearing, '
    + 'the expel roll and two members left to stay a group — measured at 0 across 400 runs '
    + 'against 11 hearings, so it is genuinely rarer than the sweep. Every expulsion the '
    + 'sweep does see is a faction one. If this ever fires, delete this line.'],
]);

/**
 * A counter whose beat has more than one type under it. `expulsions` is the
 * whole of "somebody was put out of a group", which the engine reaches by two
 * routes — a faction with the numbers, and a second charter breach going to a
 * hearing. The prose probe counted both because both go through one sentence;
 * the types keep them apart, and this is where they are put back together.
 */
function beatAny(l: { type?: string }, types: string[]): boolean {
  return types.map(t => beat(l, t)).some(Boolean);
}

const proseProbes = new Map<string, { hits: number }>();
/** Probes allowed to read zero across a sweep, with the reason. */
const PROSE_ALLOWED_ZERO = new Map<string, string>([
  ['\\{[a-z0-9]+\\}', 'the placeholder-leak guard — a match here is the bug'],
]);

function prose(re: RegExp, text: string): boolean {
  let probe = proseProbes.get(re.source);
  if (!probe) { probe = { hits: 0 }; proseProbes.set(re.source, probe); }
  if (!re.test(text)) return false;
  probe.hits++;
  return true;
}


/**
 * AUDIT-9 B19: production's own initialisation, shared with the metrics
 * harness. This copy stored the raw config where production stores the
 * profile-resolved one. See `scripts/runInit.ts`.
 */
const start = (seed: string, arenaId: string, config: GameConfig, gamemaker: boolean): GameState =>
  initialRunState({ seed, arenaId, config, gamemakerMode: gamemaker });

const trainingHistogram: Record<number, number> = {};
let runs = 0, victors = 0, wipeouts = 0, totalDays = 0, totalLogs = 0, feastRuns = 0;
let fullFieldRuns = 0, fullFieldDays = 0;
// AUDIT-6 §1.3/§6.1: the off-season skins, which were reachable from no check
// at all until `resolveArenaForRun` landed. 120 definitions across 40 arenas,
// each able to lift the arena's law, impose another, and change what the ground
// yields and costs — measured here for the first time.
const offSeasonSeen = new Map<string, number>();
let offSeasonRuns = 0;
// AUDIT-6 §9.1: the muster — the softer convergence at twice the field size.
let musterRuns = 0;
let musterPayouts = 0;
let musterAttended = 0;
let musterCalls = 0;
let musterScenes = 0;
const phasesSeen = new Set<string>();
const categoriesSeen = new Set<string>();

// Aggregate observations for the behavioural invariants.
let zonesEverDepleted = 0, zonesEverRecovered = 0;
let maxDepletionSeen = 0;
const depletionValues: number[] = [];
let worstThrashRate = 0;
let vengeanceSworn = 0, groupFights = 0, retreats = 0, griefEvents = 0, depletedForages = 0;
let ambushes = 0, hiddenMoments = 0, recruitments = 0, overloadedDrops = 0;
let maxAllianceSeen = 0, organicTrios = 0;
let oddsMoved = 0, oddsCompared = 0;
// §1.1/§10.3: board calibration. Sum of shown percentages for eventual
// victors vs the field average — if the board discriminates, victors must
// have been priced meaningfully above the mean when bets closed.
let victorPctSum = 0, victorPctCount = 0, fieldPctSum = 0, fieldPctCount = 0;
let dualVictories = 0;
// Tribute-logic overhaul: every new system needs evidence it ran.
let clots = 0, fieldDressings = 0, restRecoveries = 0, huntOrCraft = 0;
// §3.1: infection — wounds turning, deepening, being treated, and killing.
let rumoursPlanted = 0, rumoursCaughtPlanted = 0, rumoursCaughtRepeated = 0, rumoursDeadEnd = 0;
/**
 * Audit 3 §1.3: true claims by kind, counted off the live pool rather than off
 * a log line — a rumour is minted into state and only some of them ever get
 * narrated. `restock` and `cache` are the two kinds `rumourPull` treats as
 * lures, and neither had a true source at all: every lure anybody heard across
 * 132 runs was a lie. A kind with no true source reads zero here.
 */
const trueRumourKinds: Record<string, number> = {};
/**
 * Audit 3 §1.4: which authored arena events actually reach a player.
 *
 * Every event now carries an id (derived in `arenaFlavor.ts` rather than
 * hand-typed), and `applyArenaEvent` stamps `eventLastFired` with it on every
 * firing — so for the first time this sweep can answer the question
 * `test:flavor` structurally could not: not "how deep is the pool" but "does
 * any of it ever happen". The floor below is a regression bound, not a design
 * goal: at ~10 runs per arena most of a 33-event pack will not come up, and
 * that is expected. What is not expected is the number going down.
 */
const eventIdsFired = new Set<string>();
// Audit 4 §1.5: distinct authored event ids that fired *within one run*,
// accumulated per arena so the report can say how much of its own pack an
// arena shows in a single Games.
const perRunReach: Record<string, number[]> = {};
const rumourIdsCounted = new Set<string>();
let vengeancePacts = 0, vengeancePaid = 0, vengeanceStolen = 0, vengeanceAbandoned = 0;
let treatiesSworn = 0, treatiesBroken = 0, treatiesLapsed = 0, treatiesOutgrown = 0, treatiesOutlivedASide = 0, treatiesRenewed = 0;
let trianglesFormed = 0, triangleJealousy = 0, triangleChoices = 0;
let loansMade = 0, loansReturned = 0, loansDefaulted = 0;
let loansLost = 0, loansLenderDied = 0, loansBorrowerDied = 0, loansOpenAtEnd = 0;
let vengeanceOutlived = 0, vengeanceSoloed = 0, vengeancePactsOpenAtEnd = 0;
let successionHeir = 0, successionPassedOver = 0, successionSplit = 0, successionUnnamed = 0;
let peakNotoriety = 0, notorietyWithoutContact = 0, strangersKnownByName = 0;
let sleepDrops = 0, coldWeaponSwings = 0, bluffsLanded = 0, bluffsCaught = 0, loyalBroke = 0, mercyBroke = 0, pacifistBroke = 0;
let woundsTurned = 0, sepsisDeepened = 0, sepsisTerminal = 0, sepsisTreated = 0, sepsisDeaths = 0, feverLines = 0;
let zoneDrinks = 0, pursuits = 0, desperationFights = 0, fearFelt = 0;
let bestProficiencySeen = 0;
// Relationships and alliances.
let exoticBetrayals = 0, preemptiveBetrayals = 0, merges = 0, leadershipChanges = 0, pactsDeclared = 0, pactsHonoured = 0;
let factionCoups = 0, factionExpulsions = 0, factionWalkouts = 0, expulsions = 0, hearings = 0, trucesOutlived = 0, brokeredHeld = 0;
let feuds = 0, freeForAlls = 0, careerDefections = 0, cacheContributions = 0;
// Intentions and fieldcraft.
let objectivesFormed = 0, trapsSet = 0, trapsTriggered = 0, partialWork = 0;
let chutesClaimed = 0, chutesStolen = 0, chutesLost = 0, chutesCollected = 0;
let obligationsMade = 0, obligationsKept = 0, obligationsBroken = 0, obligationsLapsed = 0;
/**
 * Audit 3 §1.2: traps were counted as one number, so a five-kind menu that was
 * a two-kind menu in play read as a healthy 304 traps a sweep. Counted per
 * kind, and a kind that reads zero fails the build like any other dead branch.
 */
const trapKinds = { snare: 0, deadfall: 0, pit: 0, tripwire: 0, stake: 0 };
const TRAP_SET_KINDS = Object.keys(trapKinds) as Array<keyof typeof trapKinds>;
let firesLit = 0, sheltersBuilt = 0, camouflaged = 0, weaponsPoisoned = 0;
// Arena: stateful zones, mutts, border variety.
let zoneFiresStarted = 0, zoneFiresSpread = 0, zoneFloods = 0, zoneFreezes = 0;
let zoneContaminations = 0, zoneFogs = 0, zoneStripped = 0, zoneSevered = 0;
let borderTelegraphs = 0, cornucopiaRestocks = 0, muttEncounters = 0;
// Newer systems: each needs evidence it actually fired across the sweep.
let standoffs = 0, tributesPaid = 0, tributesPaidInformation = 0, trucesStruck = 0;
/**
 * §9 (audit): match a log line against the flavour pool that produced it.
 *
 * The truce counters were hand-written regexes quoting a few phrases from each
 * pool. Every time a pool grew, the counter silently stopped seeing the new
 * entries — which is how the on-screen truce check came to report 472 of 527
 * terms narrated while the engine ledger balanced exactly. Deriving the
 * matchers from the pools themselves means a new line is counted the day it is
 * authored and never needs a second edit here.
 */
const POOL_PATTERNS = new Map<readonly string[], RegExp[]>();
function matchesPool(pool: readonly string[], text: string): boolean {
    let pats = POOL_PATTERNS.get(pool);
    if (!pats) {
        pats = pool.map(tpl => new RegExp(
            '^' + tpl
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\\\{(t1|t2|zone|tribute|other|breaker|victim|target|striker|name)\\\}/g, '.+?')
            + '$',
        ));
        POOL_PATTERNS.set(pool, pats);
    }
    return pats.some(p => p.test(text));
}

let trucesBroken = 0, soloDepartures = 0, trucesHeld = 0, schisms = 0;
// §4: the beats this pass added — a coalition coming apart, an estate passing
// to whoever was standing closest, and two mentors splitting a parachute.
let fractures = 0, inheritances = 0, mentorCrossTalk = 0, watchesPosted = 0;
// §4.1 (audit 2): the suspicion axis gates four mechanics and only one of them
// was counted, which is how three of the four shipped calibrated above their
// own data and stayed that way. An unmeasured mechanic is assumed dead.
let investigationsGuilty = 0, investigationsCleared = 0, preemptiveDepartures = 0, sleepingApart = 0;
// §1.6/§3.3 (audit 2): three of the eight objectives were vestigial — `wait`
// held in 0.0% of 18,195 tribute-cycles, `stalk` 1.1%, `hold` 1.7% — and
// nothing counted any of them, so there was no difference between "rare by
// design" and "cannot happen".
const objectiveCycles: Record<string, number> = {};
// §1.1 (audit 2): the two beats the killTribute ordering bug silently removed.
let loverTragedies = 0, hauntedGrants = 0, hollowGrants = 0, reconciliations = 0;
let trucesRenewed = 0, trucesLapsed = 0, trucesTurned = 0;
let resolveBreakdowns = 0, nightlockDeaths = 0;
let debtsRepaid = 0, charterBreaches = 0, performedBonds = 0, districtBonds = 0;
let weatherFronts = 0, trapsDestroyed = 0, gamemakerSignatures = 0;
// Audit 4 §1.1: the three edge mechanics that ran in every game and did
// nothing, because `contested`, `collapsing`/`oneWayAfter` and `hidden` were
// authored 1, 5 and 2 times across forty arenas. Counted so the next time a
// kind falls out of the roster it shows up here rather than in an audit.
let garrisonRuns = 0, garrisonCycles = 0, edgeCrossingsMade = 0, hiddenEdgesFound = 0;
/**
 * Audit 4 §1.8/§1.9: every `ZoneEffectKind`, counted off live state rather
 * than off a log line.
 *
 * `irradiated` had forty-five lines of engine behind it — a 999-cycle
 * duration, its own damage, and the only *creeping* effect in the game — and
 * fired zero times in 340 complete runs, because six authored events across
 * forty arenas were the only thing that could start one. Nothing said so,
 * because nothing counted it. The `every kind must occur` assertion below is
 * the same shape as the one `trapKinds` grew for exactly this reason.
 */
const zoneEffectKinds: Record<string, number> = {};
let cornucopiaHeld = 0, cornucopiaPayouts = 0;
let signatureBeats = 0, calendarBeats = 0;
let maxAbsRelationship = 0;

// 400, not 240: five new arenas widened the round-robin denominator
// (arenaIds.length), which on its own reshuffles which seed/config lands on
// which arena across a fixed-size sweep and can starve a rare firing-rate
// floor below its calibrated threshold with no underlying regression. The
// sweep is cheap (a few seconds for hundreds of runs), so scaling it up
// preserves the floors' statistical power instead of loosening them.
// AUDIT-9 B19: the explicit arena x config product rather than two moduli
// that share a factor and so visit half the matrix forever. See runInit.ts.
const cells = coverageCells(arenaIds, configs.length, 400);
console.log(coverageReport(cells, arenaIds, configs.length));

for (let i = 0; i < 400; i++) {
  const seed = `SOAK${i}`;
  const arenaId = cells[i].arenaId;
  const config = configs[cells[i].configIndex];
  const gamemaker = i % 5 === 0;
  const sim = new Simulator(start(seed, arenaId, config, gamemaker));

  let guard = 3000;
  let state = sim.getState();
  let gamemakerFired = false;
  let sawGarrison = false;
  /**
   * Audit 4 §1.10: sampling through the simulator's own observation hook
   * rather than a `sample()` call the loop has to remember to make.
   *
   * The old shape called `sample()` at exactly one of the six places the run
   * advances — inside the `processTurn` branch — so the bloodbath, the
   * training floor, the interviews and the feast were never sampled at all,
   * and every counter below silently measured the day/night loop only. That is
   * the same class of mistake as reading pruned state at the end of a run, and
   * it is the reason `Simulator.observe` exists.
   */
  sim.observe(() => sample());

  // Per-run behavioural tracking.
  const stanceSamples = new Map<string, { last: Stance; changes: number; samples: number }>();
  const depletionSamples = new Map<string, number>();
  let sawRecovery = false;
  const startingOdds = new Map<string, number>();
  const gongPct = new Map<string, number>();

  const sample = () => {
    /**
     * Audit 4 §1.10: only once the Games are actually running.
     *
     * Routing this through `Simulator.observe` fixed a real gap — the old
     * shape called `sample()` from inside the `processTurn` branch alone, so
     * the bloodbath and the feast were never sampled — but it also started
     * sampling the reaping, the training floor and the interviews, where every
     * tribute holds the default `survive` objective and the arena does not
     * exist yet. That turned "objectives held: survive 7.3%" into 45.1%
     * without anything in the simulation changing, which is a measurement bug
     * of exactly the kind this hook exists to prevent.
     *
     * The bloodbath and the feast are in. The pre-arena phases are out.
     */
    if (!ARENA_PHASES.has(state.phase)) return;
    Object.keys(state.eventLastFired ?? {}).forEach(id => eventIdsFired.add(id));
    if (Object.keys(state.garrisonedEdges ?? {}).length > 0) { garrisonCycles++; sawGarrison = true; }
    Object.values(state.zoneEffects ?? {}).forEach(list =>
      list.forEach(e => { zoneEffectKinds[e.kind] = (zoneEffectKinds[e.kind] ?? 0) + 1; }));
    (state.rumours ?? []).forEach(r => {
      if (!r.isTrue || rumourIdsCounted.has(r.id)) return;
      rumourIdsCounted.add(r.id);
      trueRumourKinds[r.kind] = (trueRumourKinds[r.kind] ?? 0) + 1;
    });
    state.tributes.forEach(t => {
      if (t.status !== 'alive') return;
      const kind = t.objective?.kind ?? 'none';
      objectiveCycles[kind] = (objectiveCycles[kind] ?? 0) + 1;
      const prior = stanceSamples.get(t.id);
      if (!prior) stanceSamples.set(t.id, { last: t.stance, changes: 0, samples: 1 });
      else {
        prior.samples++;
        if (prior.last !== t.stance) { prior.changes++; prior.last = t.stance; }
      }
    });
    const allianceCounts = new Map<string, number>();
    state.tributes.forEach(t => {
      if (t.status !== 'alive' || !t.allianceId) return;
      allianceCounts.set(t.allianceId, (allianceCounts.get(t.allianceId) ?? 0) + 1);
    });
    allianceCounts.forEach((n, id) => {
      maxAllianceSeen = Math.max(maxAllianceSeen, n);
      if (n >= 3 && !id.startsWith('career-pack')) organicTrios++;
      // §4: a Career-heavy year lifts the ceiling for a grand coalition, which
      // then fractures. The invariant is the lifted ceiling, not the base cap —
      // anything past *that* is still a bug.
      const cap = ALLIANCES.maxSize + ALLIANCES.grandCoalitionExtra;
      if (n > cap && !id.startsWith('career-pack')) {
        note(`alliance ${id} grew to ${n}, past the cap of ${cap}`);
      }
    });
    Object.entries(state.zoneDepletion ?? {}).forEach(([zone, value]) => {
      maxDepletionSeen = Math.max(maxDepletionSeen, value);
      if (value > 0) depletionValues.push(value);
      if (value > 1 - ZONES.minYieldFraction + 1e-6) note(`zone depleted past the floor: ${zone} at ${value}`);
      if (value < 0) note(`negative zone depletion: ${zone}`);
      const prev = depletionSamples.get(zone);
      if (prev !== undefined && value < prev - 1e-9) sawRecovery = true;
      depletionSamples.set(zone, value);
    });
  };

  while (state.phase !== 'ended' && guard-- > 0) {
    if (state.phase === 'setup') sim.processTraining();
    else if (state.phase === 'training' || state.phase === 'scores') {
      state.tributes.forEach(t => { trainingHistogram[t.trainingScore] = (trainingHistogram[t.trainingScore] || 0) + 1; });
      sim.processInterviews();
    }
    else if (state.phase === 'interviews') {
      state.tributes.forEach(t => startingOdds.set(t.id, oddsScore(t)));
      state.tributes.forEach(t => gongPct.set(t.id, tributeOdds(t, state.tributes).pct));
      sim.startGames();
    }
    else if (state.phase === 'bloodbath') sim.processBloodbath();
    else if (state.phase === 'epilogue') state.phase = 'ended';
    else {
      // Exercise the gamemaker controls once, mid-run. Keyed on (day, phase)
      // alone this re-fired every cycle, because resolving a feast returns the
      // run to the day it started on.
      if (gamemaker && !gamemakerFired && state.day === 3 && state.phase === 'day') {
        gamemakerFired = true;
        sim.triggerGamemakerEvent('mutt');
        sim.triggerGamemakerEvent('weather');
        const alive = state.tributes.find(t => t.status === 'alive');
        sim.triggerGamemakerEvent('mutt', alive?.id);
        sim.triggerGamemakerEvent('feast');
      }
      if (!sim.processTurn()) break;
    }
    state = sim.getState();
    phasesSeen.add(state.phase);
    if (guard < 2500) note(`run ${seed} needed excessive cycles`);
  }
  if (guard <= 0) note(`run ${seed} hit the cycle guard (possible infinite loop)`);
  { const L = truceLedger(state); (Object.keys(L) as Array<keyof typeof L>).forEach(k => { TRUCE_LEDGER[k] += L[k]; }); }

  runs++;
  if (state.blocTreatyBroken) treatiesBroken++;
  if (state.config.districtCount >= FULL_FIELD_DISTRICTS) { fullFieldRuns++; fullFieldDays += state.day; }
  if (state.musterDay !== undefined) {
    musterRuns++;
    musterPayouts += state.musterPayouts ?? 0;
    if ((state.musterPayouts ?? 0) > 0) musterAttended++;
  }
  if (state.arena.offSeason) {
    offSeasonRuns++;
    offSeasonSeen.set(state.arena.offSeason, (offSeasonSeen.get(state.arena.offSeason) ?? 0) + 1);
  }
  if (sawGarrison) garrisonRuns++;
  edgeCrossingsMade += Object.values(state.edgeCrossings ?? {}).reduce((a, b) => a + b, 0);
  hiddenEdgesFound += state.tributes.reduce((a, t) => a + (t.knownEdges?.length ?? 0), 0);
  {
    // Audit 4 §1.5: this run's own reach, before the ids are unioned into the
    // sweep-wide set. Counts only ids belonging to this arena's pack or the
    // universal pool, so a procedural run is measured against what it drew.
    const firedThisRun = new Set(Object.keys(state.eventLastFired ?? {}));
    const own = ARENA_FLAVOR[state.arena.id]?.events ?? [];
    const ownIds = new Set([...own, ...UNIVERSAL_EVENTS].map(e => e.id).filter((x): x is string => x !== undefined));
    let hits = 0;
    firedThisRun.forEach(id => { if (ownIds.has(id)) hits++; });
    (perRunReach[arenaId] ??= []).push(hits);
  }
  totalDays += state.day;
  totalLogs += state.log.length;
  if ((state.feastsHeld ?? 0) > 0) feastRuns++;
  // §4.2/§4.3: the two ledgers that have to close. Everything else is counted
  // off a log line; what is *still open* when the Games end can only be read
  // off the final state, and without it "made" and "sworn" can never be
  // reconciled against their endings.
  state.tributes.forEach(t => { loansOpenAtEnd += Object.keys(t.loans ?? {}).length; });
  vengeancePactsOpenAtEnd += (state.vengeancePacts ?? []).length;
  calendarBeats += (state.firedWildcards ?? []).length;

  const alive = state.tributes.filter(t => t.status === 'alive');
  // §7.1: two survivors is legal exactly when the run recorded a dual victory.
  const isDual = state.victorIds?.length === 2 && alive.length === 2;
  if (alive.length > 1 && !isDual) note(`run ${seed} ended with ${alive.length} survivors and no dual-victory record`);
  if (isDual) dualVictories++;
  if (alive.length >= 1) victors++; else wipeouts++;

  // §1.1: the board's read on the eventual victor(s), at the moment bets closed.
  alive.forEach(w => {
    const pct = gongPct.get(w.id);
    if (pct !== undefined) { victorPctSum += pct; victorPctCount++; }
  });
  gongPct.forEach(pct => { fieldPctSum += pct; fieldPctCount++; });

  // invariants
  const ids = new Set<string>();
  state.log.forEach(l => {
    if (ids.has(l.id)) note('duplicate log id');
    ids.add(l.id);
    if (!l.category) note('log without category');
    categoriesSeen.add(l.category);
    if (prose(/\{[a-z0-9]+\}/i, l.text)) note(`unreplaced placeholder: ${l.text.slice(0, 90)}`);
    if (l.text.includes('undefined') || l.text.includes('NaN')) note(`bad text: ${l.text.slice(0, 90)}`);
    // The other shape of placeholder: a line that ends in a bracketed
    // identifier because the authored text for it was never written and a
    // fallback printed the id instead. `earnTrait`'s `[${trait}]` fallback
    // shipped 120 of these per 120 runs — every trait conversion in the game
    // narrated twice, and the first of the two named the trait in brackets.
    // The `{...}` test above cannot see it: brackets, not braces.
    if (/\[[A-Za-z][A-Za-z -]*\]\s*$/.test(l.text.trim())) note(`bracketed id in feed text: ${l.text.slice(-60)}`);
    /*
     * AUDIT-9: counted off the structured kind rather than off a prefix in
     * the prose.
     *
     * These three read the event's *type* out of the first word of its own
     * sentence — `'VENGEANCE: {mourner} learns that...'` — which is a field
     * stored as a substring and stops existing the moment anybody rewrites
     * the line. `EventType` is the field. The prefixes are still in the
     * wording, because they read well; nothing depends on them any more.
     */
    if (l.type === 'vengeance-sworn') vengeanceSworn++;
    if (l.type === 'group-fight') groupFights++;
    if (l.type === 'ambush') ambushes++;
    // Prose-matched, so kept deliberately broad: these must survive new
    // flavour lines being added to the same pools.
    if (beat(l, 'retreat')) retreats++;
    if (beat(l, 'grief-events')) griefEvents++;
    if (beat(l, 'hidden-moments')) hiddenMoments++;
    if (beat(l, 'recruitment')) recruitments++;
    // AUDIT-6 §9.1: the muster, both halves — the offer and somebody taking it.
    if (beat(l, 'muster-calls')) musterCalls++;
    if (beat(l, 'muster-scenes')) musterScenes++;
    if (l.text.includes('cannot carry it all') || l.text.includes('leaves') && l.text.includes('in the dirt')) overloadedDrops++;
    if (l.text.includes('already stripped bare')) depletedForages++;
    // --- Tribute-logic overhaul: each new system must actually fire. ---
    if (l.text.includes('bleeding has clotted')) clots++;
    if (beat(l, 'field-dressings')) fieldDressings++;
    if (l.text.includes('sleeps properly for the first time')) restRecoveries++;
    if (beat(l, 'hunt-or-craft')) huntOrCraft++;
    if (beat(l, 'zone-drinks')) zoneDrinks++;
    if (l.text.includes('hunting ')) pursuits++;
    if (beat(l, 'desperation-fights')) desperationFights++;
    // --- Intentions and fieldcraft. ---
    if (beat(l, 'objective-formed')) objectivesFormed++;
    TRAP_SET_KINDS.forEach(kind => { if (beat(l, `trap-set-${kind}`)) { trapKinds[kind]++; trapsSet++; } });
    if (beat(l, 'trap-triggered')) trapsTriggered++;
    if (beat(l, 'fire-lit')) firesLit++;
    // AUDIT-9 stage C: a cycle that ran out of hours mid-job.
    if (beat(l, 'partial-work')) partialWork++;
    // AUDIT-9 stage C §4: gifts as objects — claimed by the addressee, taken
    // by somebody else, or collected unclaimed.
    if (beat(l, 'parachute-claimed')) chutesClaimed++;
    if (beat(l, 'parachute-stolen')) chutesStolen++;
    if (beat(l, 'parachute-collected')) chutesCollected++;
    if (beat(l, 'parachute-lost')) chutesLost++;
    // AUDIT-9 stage C §4: promises made, and how they ended.
    if (beat(l, 'obligation-made')) obligationsMade++;
    if (beat(l, 'obligation-kept')) obligationsKept++;
    if (beat(l, 'obligation-broken')) obligationsBroken++;
    if (beat(l, 'obligation-lapsed')) obligationsLapsed++;
    if (beat(l, 'shelter-built')) sheltersBuilt++;
    if (beat(l, 'camouflaged')) camouflaged++;
    if (beat(l, 'standoff')) standoffs++;
    // Both shapes of the toll: an item handed over, and — for the far more
    // common tribute who is carrying nothing spare — directions paid instead.
    if (beat(l, 'tribute-paid')) tributesPaid++;
    if (beat(l, 'tribute-paid-information')) tributesPaidInformation++;
    if (beat(l, 'truce')) trucesStruck++;
    if (beat(l, 'truce-held')) trucesHeld++;
    if (matchesPool(PARLEY_TEXTS.truceBroken, l.text)) trucesBroken++;
    // §4.1: expiry resolves on-screen now — renew, lapse, or turn. These three
    // together are the fix for the "80 of 84 truces evaporated silently" bug,
    // so the floor below asserts the resolution layer stays visible.
    if (matchesPool(PARLEY_TEXTS.truceRenewed, l.text)) trucesRenewed++;
    if (matchesPool(PARLEY_TEXTS.truceLapsed, l.text)) trucesLapsed++;
    if (matchesPool(PARLEY_TEXTS.truceTurned, l.text)) trucesTurned++;
    if (beat(l, 'solo-departures')) soloDepartures++;
    if (beat(l, 'schism')) schisms++;
    if (beat(l, 'resolve-breakdowns')) resolveBreakdowns++;
    if (beat(l, 'nightlock-deaths')) nightlockDeaths++;
    if (beat(l, 'debt-repaid')) debtsRepaid++;
    if (beat(l, 'charter-breaches')) charterBreaches++;
    if (beat(l, 'performed-bonds')) performedBonds++;
    if (beat(l, 'weather-fronts')) weatherFronts++;
    if (beat(l, 'cornucopia-held')) cornucopiaHeld++;
    if (beat(l, 'cornucopia-payouts')) cornucopiaPayouts++;
    if (beat(l, 'trap-destroyed')) trapsDestroyed++;
    if (beat(l, 'gamemaker-signatures')) gamemakerSignatures++;
    if (beat(l, 'district-bonds')) districtBonds++;
    if (beat(l, 'signature-beats')) signatureBeats++;
    if (beat(l, 'weapon-poisoned')) weaponsPoisoned++;
    // --- Relationships and alliances. ---
    if (beat(l, 'exotic-betrayals')) exoticBetrayals++;
    if (beat(l, 'preemptive-betrayals')) preemptiveBetrayals++;
    if (beat(l, 'merge')) merges++;
    if (beat(l, 'leadership-changes')) leadershipChanges++;
    if (beat(l, 'rumour-planted')) rumoursPlanted++;
    if (beat(l, 'rumour-caught-planted')) rumoursCaughtPlanted++;
    if (beat(l, 'rumour-caught-repeated')) rumoursCaughtRepeated++;
    if (beat(l, 'rumour-dead-end')) rumoursDeadEnd++;
    if (beat(l, 'vengeance-pacts')) vengeancePacts++;
    // §4.3: two ways a pact is paid by the people who swore it — the named
    // hand, and both of them standing in the fight it ended in.
    if (beat(l, 'vengeance-paid')) vengeancePaid++;
    if (beat(l, 'vengeance-stolen')) vengeanceStolen++;
    if (beat(l, 'vengeance-abandoned')) vengeanceAbandoned++;
    // AUDIT-6 §1.2: the swearing line was rewritten under §22 to name both
    // memberships; the old probe string is gone from src/ entirely.
    if (beat(l, 'treaty-sworn')) treatiesSworn++;
    /*
     * AUDIT-7 §4.5: counted off the engine's own flag, not off prose.
     *
     * This was `prose(/takes the agreement between the two groups with them/)`,
     * and a killing across a treaty line happens about four times in 400 runs —
     * so the probe sat at the edge of firing at all, and a change elsewhere
     * that merely reshuffled the RNG stream took it to zero and tripped the
     * dead-probe meta-assertion. A probe on a 1%-per-run event is a coin toss
     * with a build failure attached.
     *
     * `state.blocTreatyBroken` is set by `noteBlocKill` itself, is exact, and
     * cannot rot when somebody rewrites the line. The prose is still worth
     * having; it is just not the right thing to count.
     */
    // AUDIT-7 §4.5: a treaty that comes up and gets renewed, which is the
    // ending that did not exist. 204 of 253 used to end by one side dying.
    if (beat(l, 'treaty-renewed')) treatiesRenewed++;
    if (beat(l, 'treaty-lapsed')) treatiesLapsed++;
    if (beat(l, 'treaty-outgrown')) treatiesOutgrown++;
    // AUDIT-6 §4.3: the ending that used to happen silently, and was the
    // most common one by an order of magnitude.
    if (beat(l, 'treaty-outlived-a-side')) treatiesOutlivedASide++;
    if (beat(l, 'fracture')) fractures++;
    if (beat(l, 'investigation-guilty')) investigationsGuilty++;
    if (beat(l, 'investigation-cleared')) investigationsCleared++;
    if (beat(l, 'preemptive-departures')) preemptiveDepartures++;
    if (beat(l, 'sleeping-apart')) sleepingApart++;
    if (beat(l, 'romance-tragedy')) loverTragedies++;
    if (beat(l, 'haunted-grants')) hauntedGrants++;
    if (beat(l, 'hollow-grants')) hollowGrants++;
    if (beat(l, 'reconciliation')) reconciliations++;
    if (beat(l, 'inheritance')) inheritances++;
    if (beat(l, 'mentor-cross-talk')) mentorCrossTalk++;
    if (beat(l, 'watch-posted')) watchesPosted++;
    // §4.1: all three triangle beats draw from pools now (TRIANGLE_TEXTS), so
    // each matcher names one fragment per variant rather than the single
    // wording the beat used to have.
    if (beat(l, 'triangle-formed')) trianglesFormed++;
    if (beat(l, 'triangle-jealousy')) triangleJealousy++;
    if (beat(l, 'triangle-choices')) triangleChoices++;
    if (beat(l, 'loan-made')) loansMade++;
    if (beat(l, 'loan-returned')) loansReturned++;
    if (beat(l, 'loan-defaulted')) loansDefaulted++;
    // §4.2: the three endings the loan ledger used to close silently. 175 of
    // 244 loans reached the end of a run in no state at all; these are where
    // they were going.
    if (beat(l, 'loan-lost')) loansLost++;
    if (beat(l, 'loan-lender-died')) loansLenderDied++;
    if (beat(l, 'loan-borrower-died')) loansBorrowerDied++;
    // §4.3: and the two the vengeance-pact ledger closed silently.
    if (beat(l, 'vengeance-outlived')) vengeanceOutlived++;
    if (beat(l, 'vengeance-soloed')) vengeanceSoloed++;
    // AUDIT-6 §1.2: the first branch matched nothing, so this counter was
    // silently reporting *contested* installs as clean ones. Both shapes are
    // an heir taking over, and both are counted, but the clean line is the
    // one that actually exists.
    if (beat(l, 'succession-heir')) successionHeir++;
    if (beat(l, 'succession-passed-over')) successionPassedOver++;
    if (beat(l, 'succession-split')) successionSplit++;
    // AUDIT-6 §1.2: likewise — the real line is the one `resolveSuccession`
    // writes when no heir was ever named.
    if (beat(l, 'succession-unnamed')) successionUnnamed++;
    // §4.1: pacts are a union of six shapes now, all sworn with `shake on it:`.
    if (beat(l, 'pact-declared')) pactsDeclared++;
    if (beat(l, 'pact-honoured')) pactsHonoured++;
    /*
     * AUDIT-7 §4.3: this probe read a third of what it named.
     *
     * `alliancePolitics.resolveFactions` has three outcomes — a coup, an
     * expulsion and a walk-out — and this counted the coup line plus a
     * walk-out line that does not exist: the prose reads "There are two groups
     * now.", not "the group is two groups now". So "factionActions=13 across
     * 400 runs" was the coup branch alone, reported as the whole mechanic, and
     * AUDIT-7 §4.3 read it as a near-dead subsystem. It is the same class of
     * bug AUDIT-6 §1.2 found and the meta-assertion below cannot catch, because
     * the probe *did* match — just not everything it claimed to.
     *
     * Three counters now, one per branch, so no branch can hide behind another.
     */
    if (beat(l, 'faction-coups')) factionCoups++;
    if (beat(l, 'faction-expulsions')) factionExpulsions++;
    if (beat(l, 'faction-walkouts')) factionWalkouts++;
    if (beatAny(l, ['expulsion', 'faction-expulsions'])) expulsions++;
    /*
     * AUDIT-6 §4.4: this counted two of the four ways a hearing ends.
     *
     * A hearing that ends in an expulsion was logged as an expulsion and
     * counted as one, so the reported figure (7 per 400 runs) was the tail of
     * the mechanic rather than the mechanic — the same class of measurement bug
     * as the two dead probes in §1.2, and it is why the hearing looked
     * near-dead when what was actually rare was a hearing somebody survived.
     */
    if (beat(l, 'hearing')) hearings++;
    if (beat(l, 'sleep-drops')) sleepDrops++;
    if (beat(l, 'cold-weapon-swings')) coldWeaponSwings++;
    if (beat(l, 'bluff-landed')) bluffsLanded++;
    if (beat(l, 'bluff-caught')) bluffsCaught++;
    if (beat(l, 'loyal-broke')) loyalBroke++;
    if (beat(l, 'mercy-broke')) mercyBroke++;
    if (beat(l, 'pacifist-broke')) pacifistBroke++;
    if (beat(l, 'wound-turned')) woundsTurned++;
    if (beat(l, 'sepsis-deepened')) sepsisDeepened++;
    if (beat(l, 'sepsis-deepened')) { sepsisDeepened++; sepsisTerminal++; }
    if (beat(l, 'sepsis-treated')) sepsisTreated++;
    if (beat(l, 'fever-lines')) feverLines++;
    if (beat(l, 'truce-outlived')) trucesOutlived++;
    // §1.4: all three beats that pay a broker. This matcher used to name only
    // the LAPSE line, which is why the counter read 1 across 400 runs even
    // after the other endings started crediting the broker — the metric was
    // measuring one ending, not the mechanic.
    if (beat(l, 'brokered-held')) brokeredHeld++;
    if (beat(l, 'feud')) feuds++;
    if (beat(l, 'free-for-alls')) freeForAlls++;
    if (beat(l, 'career-defections')) careerDefections++;
    if (beat(l, 'cache-contributions')) cacheContributions++;
    // --- Arena: stateful zones, mutts, border variety. ---
    if (l.text.includes('Fire takes hold')) zoneFiresStarted++;
    if (l.text.includes('jumps to')) zoneFiresSpread++;
    if (l.text.includes('goes under')) zoneFloods++;
    if (l.text.includes('hard freeze locks down')) zoneFreezes++;
    if (l.text.includes('is wrong') && l.text.includes('lingers')) zoneContaminations++;
    if (l.text.includes('fog bank rolls into')) zoneFogs++;
    if (l.text.includes('burned down to ash')) zoneStripped++;
    if (l.text.includes('route between') || l.text.includes('route gives out')) zoneSevered++;
    // Keyed on the line's stable marker rather than a fragment of its prose —
    // the previous matcher read 'border will close around', which is one
    // telegraph line out of ten and went to zero the moment it was reworded.
    if (l.text.startsWith('BORDER WARNING:')) borderTelegraphs++;
    if (l.text.includes('A supply drop lands at the Cornucopia')) cornucopiaRestocks++;
    if (l.category === 'mutt') muttEncounters++;
  });

  // --- Structure invariants: an alliance record must match reality. ---
  Object.values(state.alliances ?? {}).forEach(record => {
    const living = state.tributes.filter(t => t.status === 'alive' && t.allianceId === record.id);
    if (living.length === 1) note(`alliance ${record.id} left with a single member in ${seed}`);
    if (living.length > ALLIANCES.maxSize) note(`alliance ${record.id} over the size cap in ${seed}`);
    if (living.length >= 2 && !living.some(t => t.id === record.leaderId)) {
      note(`alliance ${record.id} led by a tribute who is not in it, in ${seed}`);
    }
  });
  // A lone tribute must never still be carrying an alliance id.
  const idCounts = new Map<string, number>();
  state.tributes.forEach(t => {
    if (t.status !== 'alive' || !t.allianceId) return;
    idCounts.set(t.allianceId, (idCounts.get(t.allianceId) ?? 0) + 1);
  });
  idCounts.forEach((n, id) => { if (n === 1) note(`solo tribute still carrying alliance id ${id} in ${seed}`); });

  // --- Traps must never outlive their bounds or belong to nobody. ---
  (state.traps ?? []).forEach(trap => {
    if (!state.tributes.some(o => o.id === trap.ownerId)) note(`trap owned by a non-existent tribute in ${seed}`);
    if (trap.concealment < 0 || trap.concealment > 1) note(`trap concealment out of range in ${seed}`);
  });
  if ((state.traps ?? []).length > state.tributes.length * 2) {
    note(`traps accumulated without bound in ${seed}: ${(state.traps ?? []).length}`);
  }

  // --- Bleeding must be a rate, not a boolean. Any tribute flagged as
  // bleeding must carry a severity inside the damage table's bounds, or the
  // wound silently costs zero health per cycle. ---
  state.tributes.forEach(t => {
    if (!t.injuries.bleeding) return;
    const severity = t.bleedSeverity ?? -1;
    if (severity < 1 || severity > 3) {
      note(`bleeding tribute with out-of-range severity ${severity} in ${seed}`);
    }
  });

  // --- Proficiencies must grow, and must never exceed their cap. ---
  state.tributes.forEach(t => {
    Object.entries(t.proficiencies ?? {}).forEach(([skill, level]) => {
      if ((level ?? 0) > PROFICIENCY.max + 1e-9) {
        note(`proficiency ${skill} exceeded its cap at ${level} in ${seed}`);
      }
      if ((level ?? 0) > bestProficiencySeen) bestProficiencySeen = level ?? 0;
    });
    // Fear is bounded and only ever aimed at other people.
    Object.entries(t.memory?.fear ?? {}).forEach(([id, value]) => {
      if (id === t.id) note(`tribute afraid of themselves in ${seed}`);
      if (value < 0 || value > FEAR.max) note(`fear out of bounds at ${value} in ${seed}`);
      if (value > 0) fearFelt++;
    });
    if ((t.momentum ?? 0) > HUNTING.momentumMax) note(`momentum exceeded its cap in ${seed}`);
  });

  if (new Set(state.tributes.map(t => t.name)).size !== state.tributes.length) note(`duplicate tribute names in ${seed}`);

  // --- Zone economy: depletion must be bounded, and must recover. ---
  if (depletionSamples.size > 0) {
    zonesEverDepleted++;
    if (sawRecovery) zonesEverRecovered++;
  }

  state.tributes.forEach(t => {
    const v = t.vitals;
    if (t.health < 0 || t.health > 100 || !Number.isFinite(t.health)) note(`health out of range: ${t.health}`);
    [['hunger', v.hunger], ['thirst', v.thirst], ['fatigue', v.fatigue], ['sanity', v.sanity]].forEach(([k, n]) => {
      if ((n as number) < 0 || (n as number) > 100 || !Number.isFinite(n as number)) note(`${k} out of range: ${n}`);
    });
    if (t.sponsorTrust < 0 || t.sponsorTrust > 100) note(`sponsorTrust out of range: ${t.sponsorTrust}`);
    Object.entries(t.attributes).forEach(([k, n]) => {
      if (n < 0 || n > 10) note(`attribute ${k} out of range: ${n}`);
    });
    if (t.trainingScore < 1 || t.trainingScore > 12) note(`training score out of range: ${t.trainingScore}`);

    // --- Generation invariants ---
    if (t.attributes.strength > strengthCapForAge(t.age)) {
      note(`age ${t.age} tribute with strength ${t.attributes.strength} (cap ${strengthCapForAge(t.age)})`);
    }
    for (let a = 0; a < t.traits.length; a++) {
      for (let b = a + 1; b < t.traits.length; b++) {
        if (traitsConflict(t.traits[a], t.traits[b])) note(`incompatible traits: ${t.traits[a]} + ${t.traits[b]}`);
      }
    }
    if (t.inventory.length > carryCapacity(t)) {
      note(`tribute carrying ${t.inventory.length} items over a capacity of ${carryCapacity(t)}`);
    }
    if (t.daysSurvived < 0 || t.daysSurvived > state.day) note(`daysSurvived out of range: ${t.daysSurvived}`);
    if (!t.memory) note('tribute without memory');
    if (t.reputation === undefined) note('tribute without a reputation baseline');
    if (!t.interviewStrategy) note('tribute never got an interview persona');

    // §3.5: notoriety must stay in bounds, and — the point of the mechanic —
    // it has to reach people who have never met its subject. A ledger entry
    // for somebody this tribute has no contact record with is exactly the
    // "reputation travelled without contact" case.
    Object.entries(t.memory?.notoriety ?? {}).forEach(([otherId, n]) => {
      if (!Number.isFinite(n)) note('non-finite notoriety');
      if (n < 0 || n > NOTORIETY.max) note(`notoriety out of bounds: ${n}`);
      if (otherId === t.id) note('tribute is notorious to themselves');
      peakNotoriety = Math.max(peakNotoriety, n);
      if (t.memory?.lastContact?.[otherId] === undefined) {
        if (n >= NOTORIETY.max * 0.15) strangersKnownByName++;
        notorietyWithoutContact++;
      }
    });

    // --- Relationship bounds: grief, betrayal and decay must all stay inside them. ---
    Object.entries(t.relationships).forEach(([otherId, r]) => {
      if (!Number.isFinite(r)) note('non-finite relationship');
      if (r < RELATIONSHIPS.min || r > RELATIONSHIPS.max) note(`relationship out of bounds: ${r}`);
      if (otherId === t.id) note('tribute has a relationship with themselves');
      maxAbsRelationship = Math.max(maxAbsRelationship, Math.abs(r));
    });

    // --- Memory bounds ---
    if (t.memory) {
      Object.entries(t.memory.zones).forEach(([, slot]) => {
        if (!Number.isFinite(slot.threat) || slot.threat < 0 || slot.threat > 6.001) note(`zone threat out of range: ${slot.threat}`);
        if (slot.barren < 0 || slot.barren > 1.001) note(`zone barren out of range: ${slot.barren}`);
      });
      if (t.memory.vengeance.length > 4) note('vengeance list grew unbounded');
      if (t.memory.vengeance.includes(t.id)) note('tribute swore vengeance on themselves');
      if (t.memory.mourned.length > state.tributes.length * 2) note('mourned list grew unbounded');
    }

    if (t.status === 'dead') {
      if (t.allianceId) note('dead tribute still in an alliance');
      if (t.dayOfDeath === undefined) note('dead tribute without dayOfDeath');
      if (!t.causeOfDeath) note('dead tribute without cause of death');
      // AUDIT-9: counted off the code, not off the sentence. This was
      // `/Died of sepsis/` against a space of 373 distinct cause strings, so
      // rewording the obituary would have taken the counter to zero silently.
      if (deathCodeOf(t) === 'sepsis') sepsisDeaths++;
      // AUDIT-9: and the taxonomy is complete, which is the property
      // `check-cause-codes` asserts in full. Asserted here too because the
      // soak sweeps configurations that check does not, and an `unknown` is
      // the one outcome that means a measurement has gone blind.
      if (deathCodeOf(t) === 'unknown') note(`death with no cause code: "${t.causeOfDeath}"`);
      if (t.health !== 0) note(`dead tribute health ${t.health}`);

      // --- Cause of death must name the real source, not a guessed one. ---
      // Arena hazards legitimately read "Killed by the tropical storm", so the
      // check keys off the recorded damage source rather than the prose.
      if (t.lastDamage) {
        if (!Number.isFinite(t.lastDamage.amount)) note('non-finite damage record');
        if (t.lastDamage.kind === 'tribute') {
          const killer = state.tributes.find(o => o.id === t.lastDamage!.sourceId);
          if (!killer) note('killing blow attributed to a tribute who does not exist');
          else if (!t.causeOfDeath?.includes(killer.name)) {
            note(`cause of death "${t.causeOfDeath}" does not name the killer ${killer.name}`);
          }
          // AUDIT-9: the structured half of the same assertion. The prose
          // check above is about the obituary naming the right person; this
          // is about the code agreeing that a person did it at all, which is
          // what every downstream measurement now keys off.
          if (deathCodeOf(t) !== 'tribute') {
            note(`tribute-dealt death coded as "${deathCodeOf(t)}": "${t.causeOfDeath}"`);
          }
        } else if (t.lastDamage.cause !== t.causeOfDeath) {
          note(`cause of death "${t.causeOfDeath}" does not match last damage "${t.lastDamage.cause}"`);
        }
      }
    } else {
      if (!state.arena.zones.some(z => z.name === t.zone)) note(`tribute in unknown zone: ${t.zone}`);
      // --- Stance hysteresis: nobody may flip stance every single cycle. ---
      const s = stanceSamples.get(t.id);
      if (s && s.samples >= 6) {
        const rate = s.changes / (s.samples - 1);
        worstThrashRate = Math.max(worstThrashRate, rate);
        if (rate > 0.6) note(`stance thrashing: ${t.name} changed stance on ${(rate * 100).toFixed(0)}% of cycles`);
      }
      // --- Odds are live: a survivor's score should have moved off its opening line. ---
      const opening = startingOdds.get(t.id);
      if (opening !== undefined) {
        oddsCompared++;
        if (oddsScore(t) !== opening) oddsMoved++;
      }
    }
  });

  // --- Fan favourites: the audience always has exactly its quota. ---
  const favourites = state.tributes.filter(t => t.fanFavourite).length;
  const expected = Math.min(GENERATION.fanFavouriteCount, state.tributes.length);
  if (favourites !== expected) note(`expected ${expected} fan favourites, found ${favourites}`);

  if (alive.length === 1) {
    const qas = state.epilogueInterview;
    if (!qas || qas.length === 0) note('victor without an epilogue interview');
    else {
      if (qas.length < 4) note(`epilogue has only ${qas.length} exchanges`);
      // --- The epilogue must draw on the actual chronicle, not just traits. ---
      const winner = alive[0];
      if (winner.kills > 0 && !qas.some(qa => qa.question.includes('"'))) {
        note('epilogue never quotes a real event despite the victor having kills');
      }
      qas.forEach(qa => {
        if (/\{[a-z]+\}/i.test(qa.question) || /\{[a-z]+\}/i.test(qa.answer)) note('unreplaced placeholder in the epilogue');
        if (qa.answer.includes('undefined')) note('undefined in the epilogue');
      });
    }
  }
}
// §1.4: snapshot before the determinism replays below open more truces.
const truceStruckInSample = TRUCE_LEDGER.struck;
const truceLedgerInSample = { ...TRUCE_LEDGER };

// --- Backstory relationships exist before the gong. ---
{
  const cast = generateTributes('BACKSTORY', DEFAULT_GAME_CONFIG);
  const partners = cast.filter(t => t.district === 5);
  if (partners.length === 2) {
    const [a, b] = partners;
    if (!a.relationships[b.id] || !b.relationships[a.id]) note('district partners start as total strangers');
  }
  const anyStranger = cast.every(t => Object.keys(t.relationships).length === 0);
  if (anyStranger) note('no backstory relationships were seeded at all');
  const careers = cast.filter(t => t.isCareer);
  if (careers.length > 1 && !careers.some(c => careers.some(o => o.id !== c.id && (c.relationships[o.id] ?? 0) > 0))) {
    note('careers do not know each other from the academy');
  }
}

// Determinism: same seed twice must produce identical output.
//
// This used to replay only the hand-authored 'clockwork' arena, which is why a
// sort-with-random-comparator in the *procedural* arena generator survived
// here undetected for as long as it did. Both paths are checked now, and the
// generated zone graph is compared directly rather than only the event log.
function runOnce(seed: string, arenaId: string) {
  const sim = new Simulator(start(seed, arenaId, DEFAULT_GAME_CONFIG, false));
  let g = 3000; let s = sim.getState();
  while (s.phase !== 'ended' && g-- > 0) {
    if (s.phase === 'setup') sim.processTraining();
    else if (s.phase === 'training' || s.phase === 'scores') sim.processInterviews();
    else if (s.phase === 'interviews') sim.startGames();
    else if (s.phase === 'bloodbath') sim.processBloodbath();
    else if (s.phase === 'epilogue') s.phase = 'ended';
    else if (!sim.processTurn()) break;
    s = sim.getState();
  }
  return JSON.stringify(s.log.map(l => l.text));
}
if (runOnce('DETERMINISM', 'clockwork') !== runOnce('DETERMINISM', 'clockwork')) {
  note('simulation is not deterministic for a fixed seed');
}
if (runOnce('DETERMINISM', 'procedural') !== runOnce('DETERMINISM', 'procedural')) {
  note('procedural-arena runs are not deterministic for a fixed seed');
}

// P0-1: a shared link carries the player's *base* config (GameState.baseConfig),
// not the games-profile-multiplied config actually executed. Reproduce what
// startGame/App.tsx's URL round-trip does — take the base config, re-derive
// the profile from the (same) seed, and re-multiply — and check that running
// it a second time from those same base inputs reproduces an identical log,
// rather than applying the temperament multiplier twice.
function runFromBaseConfig(seed: string, arenaId: string, base: GameConfig) {
  const profile = gamesProfileFor(seed);
  const resolved = configForProfile(base, profile);
  const sim = new Simulator(start(seed, arenaId, resolved, false));
  let g = 3000; let s = sim.getState();
  while (s.phase !== 'ended' && g-- > 0) {
    if (s.phase === 'setup') sim.processTraining();
    else if (s.phase === 'training' || s.phase === 'scores') sim.processInterviews();
    else if (s.phase === 'interviews') sim.startGames();
    else if (s.phase === 'bloodbath') sim.processBloodbath();
    else if (s.phase === 'epilogue') s.phase = 'ended';
    else if (!sim.processTurn()) break;
    s = sim.getState();
  }
  return JSON.stringify(s.log.map(l => l.text));
}
if (runFromBaseConfig('SHARELINK', 'clockwork', DEFAULT_GAME_CONFIG) !== runFromBaseConfig('SHARELINK', 'clockwork', DEFAULT_GAME_CONFIG)) {
  note('a shared-link round-trip (base config -> re-derived profile) does not reproduce an identical run');
}

// The zone graph itself, independent of the run: a generator that consumes a
// variable number of RNG draws produces a different map on a second call.
for (const seed of ['GRAPH1', 'GRAPH2', 'GRAPH3', 'GRAPH4', 'GRAPH5']) {
  const shape = (a: ReturnType<typeof generateArena>) =>
    JSON.stringify({ id: a.id, name: a.name, zones: a.zones.map(z => [z.name, z.terrain, z.danger, z.resources, [...z.adjacent].sort()]) });
  if (shape(generateArena(seed)) !== shape(generateArena(seed))) {
    note(`procedural arena graph is not deterministic for seed ${seed}`);
  }
}

// A dead system is as much a bug as a broken one: if a mechanic never fires
// across the whole sweep, it is not implemented, it is decorative.
if (vengeanceSworn === 0) note('no tribute ever swore vengeance across the whole soak');
if (groupFights === 0) note('group combat never triggered across the whole soak');
if (retreats === 0) note('nobody ever retreated from a fight');
if (griefEvents === 0) note('no death ever produced grief in another tribute');
if (depletedForages === 0) note('no zone was ever foraged out from under anyone');
if (ambushes === 0) note('stealth never produced a single ambush — the attribute has no teeth');
if (hiddenMoments === 0) note('no tribute ever went unnoticed — stealth does not hide anyone');
if (recruitments === 0) note('no alliance ever recruited a third member');
if (organicTrios === 0) note('no alliance outside the Career pack ever exceeded two members');
if (overloadedDrops === 0) note('carry capacity never bound on anyone — the Backpack has nothing to do');
if (zonesEverDepleted > 0 && zonesEverRecovered === 0) note('zone resources deplete but never recover');
if (oddsCompared > 0 && oddsMoved === 0) note('odds never moved during a run — they are still static');
if (clots === 0) note('no wound ever clotted — bleeding is still a one-way ratchet');
if (fieldDressings === 0) note('nobody ever dressed a wound — the field-dressing action is unreachable');
if (restRecoveries === 0) note('no tribute ever recovered health by resting — healing is still loot-only');
if (huntOrCraft === 0) note('nobody ever hunted game or improvised a weapon');
if (zoneDrinks === 0) note('nobody ever drank from the arena — open water is still decorative');
if (pursuits === 0) note('no hunter ever pursued a rival across zones');
if (desperationFights === 0) note('the narrowing field never forced a fight between strangers');
if (fearFelt === 0) note('no tribute was ever afraid of another — fear has no teeth');
if (bestProficiencySeen === 0) note('no proficiency ever grew — skills do not improve with use');
if (objectivesFormed === 0) note('no tribute ever formed an objective — the intent layer is inert');
if (trapsSet === 0) note('nobody ever set a trap');
Object.entries(trapKinds).forEach(([kind, n]) => {
    if (n === 0) note(`no tribute ever built a ${kind} — Trap.kind declares five and the engine reaches four`);
});
if (trapsTriggered === 0) note('no trap was ever spotted or sprung — traps are decorative');
if (firesLit === 0) note('nobody ever lit a fire');
if (sheltersBuilt === 0) note('nobody ever built a shelter');
if (camouflaged === 0) note('nobody ever used camouflage');
if (standoffs === 0) note('two armed strangers never once backed out of a fight');
if (trucesStruck === 0) note('no truce was ever negotiated');
if (tributesPaid === 0) note('nobody ever paid their way out of a fight');
if (resolveBreakdowns === 0) note('no tribute ever ran out of the will to keep going');
if (signatureBeats === 0) note('no arena signature mechanic ever fired');
if (debtsRepaid === 0) note('no debt was ever repaid');
if (charterBreaches === 0) note('no alliance charter was ever broken');
if (districtBonds === 0) note('no district pair ever reached the late game together');
if (weatherFronts === 0) note('no weather front ever crossed the arena');
ZONE_EFFECT_KINDS.forEach(kind => {
  if (!zoneEffectKinds[kind]) note(`no zone was ever ${kind} — ZoneEffectKind declares it and nothing the engine does can produce it`);
});
if (garrisonRuns === 0) note('no alliance ever garrisoned a contested edge — tickGarrisons runs every cycle and reaches nothing');
if (edgeCrossingsMade === 0) note('no collapsing or oneWayAfter edge was ever crossed — countCrossing has nothing to count');
if (hiddenEdgesFound === 0) note('no hidden edge was ever discovered — tickHiddenEdges reaches nothing');
if (gamemakerSignatures === 0) note('no Head Gamemaker ever used their signature intervention');
if (cornucopiaHeld === 0) note('nobody ever held the Cornucopia');
if (calendarBeats === 0) note('no scheduled calendar beat ever fired');
if (weaponsPoisoned === 0) note('nobody ever poisoned a weapon');
if (exoticBetrayals === 0) note('every betrayal was a knife — the other forms never fire');
if (merges === 0) note('two alliances never merged');
if (leadershipChanges === 0) note('an alliance never changed leader');
if (pactsDeclared === 0) note('no alliance ever declared a pact');
if (pactsHonoured === 0) note('a final-eight pact never came due');
if (feuds === 0) note('no pair ever built a running feud');
if (freeForAlls === 0) note('a brawl never collapsed into a free-for-all');
if (careerDefections === 0) note('the Career pack always formed exactly as scripted');
if (cacheContributions === 0) note('nobody ever pooled supplies — the shared cache is decorative');
if (zoneFiresStarted === 0) note('a zone never caught fire — the burning effect is inert');
if (zoneFloods === 0) note('a zone never flooded');
if (zoneFreezes === 0) note('a zone never froze');
if (zoneContaminations === 0) note('a zone never became contaminated');
if (zoneFogs === 0) note('a zone never went fogbound');
if (zoneStripped === 0) note('fire never burned a zone down to stripped ground');
if (zoneSevered === 0) note('a route was never severed');
if (borderTelegraphs === 0) note('the border collapse was never telegraphed');
if (cornucopiaRestocks === 0) note('the Cornucopia never restocked');
if (muttEncounters === 0) note('no mutt ever attacked anyone across the whole soak');

// §6.1/§10.3: the firing-rate floor, as an assertion instead of a printed
// line. Zero-checks above catch a mechanic that is dead; this catches one
// that is merely unreachable — authored content a player will essentially
// never see. The floors are aggregate counts against the full sweep, set at
// roughly half the measured post-tuning baselines so ordinary drift passes
// and a regression to the pre-tuning rates fails.
const firingFloors: Array<[string, number, number]> = [
    ['performed (insincere) bonds', performedBonds, 4],
    ['nightlock deaths', nightlockDeaths, 2],
    ['alliance merges', merges, 5],
    ['desperation fights', desperationFights, 10],
    ['poisoned weapons', weaponsPoisoned, 10],
    ['tributes paying their way out of a parley', tributesPaid, 1],
    // Extortion's other half. Most tributes carry nothing spare, so the
    // information toll is the branch that actually makes the mechanic
    // reachable — it needs its own floor, or the item path passing alone
    // would hide it going dead again.
    ['tributes paying a parley toll in information', tributesPaidInformation, 4],
    // Both halves of the truce lifecycle. `truceHeld` guards a specific
    // regression: the branch that narrates a truce holding sat below the
    // "we get on" branch in `resolvePairEncounter`, and since striking a truce
    // grants regard, truce partners were always warm enough to be caught by
    // that branch first — the whole path measured zero firings across the
    // sweep. A truce nobody can break is a timer rather than a promise, so the
    // break needs its own floor as well.
    // Renewal is a truce visibly holding — the mid-truce "both keep it" line
    // and the expiry-day rollover are the same promise being kept on camera.
    ['truces visibly holding', trucesHeld + trucesRenewed, 2],
    // 'turned' is the expiry-timed break — same promise ending in the same blood.
    ['truces broken', trucesBroken + trucesTurned, 2],
    ['truces resolving on-screen at expiry', trucesRenewed + trucesLapsed + trucesTurned, 10],
    ['tributes leaving an alliance to go it alone', soloDepartures, 30],
    // §4: a large pack splitting along its own faction lines.
    ['alliances splitting into factions', schisms, 3],
    ['traps destroyed', trapsDestroyed, 3],
    ['zones stripped bare', zoneStripped, 3],
];
firingFloors.forEach(([label, count, floor]) => {
    if (count < floor) note(`firing-rate floor: ${label} fired ${count} times (floor ${floor} per ${runs} runs)`);
});

console.log(`runs=${runs} victors=${victors} wipeouts=${wipeouts} avgDays=${(totalDays/runs).toFixed(1)} avgLogs=${(totalLogs/runs).toFixed(0)} runsWithFeast=${feastRuns}`);
{
  const fullAvg = fullFieldRuns > 0 ? fullFieldDays / fullFieldRuns : 0;
  console.log(`avgDays on full fields only (>= ${FULL_FIELD_DISTRICTS} districts, n=${fullFieldRuns}): ${fullAvg.toFixed(1)} (target 10-13)`);
  // The same band `metrics.ts` guards, asserted here too so a pacing change
  // cannot pass one harness and fail the other unnoticed.
  if (fullFieldRuns >= 20 && (fullAvg < 10 || fullAvg > 13)) {
    note(`full-field average run length is ${fullAvg.toFixed(1)} days, outside the 10-13 target`);
  }
}
console.log('phases seen:', [...phasesSeen].sort().join(', '));
console.log('categories seen:', [...categoriesSeen].sort().join(', '));
// `foragedOutZones` (forage depletion, behavioural) is a different metric
// from the arena line's `strippedZones` (fire burning ground down to ash) —
// they printed under near-identical names for a while and read as duplicates.
console.log(`behaviour: vengeance=${vengeanceSworn} groupFights=${groupFights} retreats=${retreats} griefMoments=${griefEvents} foragedOutZones=${depletedForages}`);
console.log(`stealth: ambushes=${ambushes} unnoticed=${hiddenMoments}`);
console.log(`wounds: clots=${clots} fieldDressings=${fieldDressings} restRecoveries=${restRecoveries}`);
console.log(`agency: hunts/crafts=${huntOrCraft} zoneDrinks=${zoneDrinks} pursuits=${pursuits} desperationFights=${desperationFights}`);
console.log(`psychology: fear entries=${fearFelt} peakProficiency=${bestProficiencySeen.toFixed(2)} (cap ${PROFICIENCY.max})`);
console.log(`intentions: objectives formed=${objectivesFormed}`);
console.log(`social: exoticBetrayals=${exoticBetrayals} preemptiveBetrayals=${preemptiveBetrayals} merges=${merges} leaderChanges=${leadershipChanges} feuds=${feuds} freeForAlls=${freeForAlls}`);
console.log(`pacts: declared=${pactsDeclared} honoured=${pactsHonoured} careerDefections=${careerDefections} cacheContributions=${cacheContributions}`);
// §1.4: the truce ledger has to close. renew + lapse + turn + break + held
// only ever accounted for ~40% of the truces struck; the missing majority is
// `trucesOutlived` — a truce ended by one party dying — which was a real,
// logged, achievement-granting ending that no counter here named, so the
// mechanic read as "251 formed, 102 resolved, 149 vanished".
// §1.4 (audit): a renewal closes one term and opens the next, so the terms
// the ledger has to close are `struck + renewed`, and `struck` itself is read
// from the engine's own counter rather than from 'TRUCE:' prose — brokered and
// bought truces never printed that line and were invisible to the old count.
const truceTerms = truceStruckInSample + trucesRenewed;
const truceEndings = trucesRenewed + trucesLapsed + trucesTurned + trucesBroken + trucesOutlived;
// The engine's own ledger, counted at every site a term opens or ends, so the
// closure assertion does not depend on matching prose.
const L = truceLedgerInSample;
const ledgerTerms = L.struck + L.renewed;
const ledgerEndings = L.renewed + L.lapsed + L.turned + L.broken + L.outlived + L.buried + L.dissolved + L.standingAtEnd;
console.log(`sleep: deprivedDrops=${sleepDrops}`);
console.log(`weapons: coldSwings=${coldWeaponSwings}`);
console.log(`bluffs: landed=${bluffsLanded} caught=${bluffsCaught}`);
{
  // Audit 3 §1.4: authored-event reach, per pack and overall.
  const packs: Record<string, string[]> = {};
  Object.entries(ARENA_FLAVOR).forEach(([id, pack]) => {
    packs[id] = pack.events.map(e => e.id).filter((x): x is string => x !== undefined);
  });
  packs.universal = UNIVERSAL_EVENTS.map(e => e.id).filter((x): x is string => x !== undefined);
  let authored = 0, reached = 0;
  const worst: Array<[string, number, number]> = [];
  Object.entries(packs).forEach(([id, ids]) => {
    const hit = ids.filter(x => eventIdsFired.has(x)).length;
    authored += ids.length; reached += hit;
    worst.push([id, hit, ids.length]);
  });
  worst.sort((a, b) => (a[1] / a[2]) - (b[1] / b[2]));
  const share = authored > 0 ? reached / authored : 0;

  // Audit 4 §1.5: the number that describes the player's experience, and the
  // one that is guarded. Sweep-wide reach is still printed below it, without a
  // guard, because "no pack is entirely dead" is a real assertion and the
  // cumulative figure is useful context — it is just not a threshold.
  const perArena = Object.entries(perRunReach)
    .map(([id, xs]) => [id, xs.reduce((a, b) => a + b, 0) / xs.length, xs.length] as [string, number, number])
    .sort((a, b) => a[1] - b[1]);
  if (perArena.length > 0) {
    const overall = perArena.reduce((sum, [, avg, n]) => sum + avg * n, 0) / perArena.reduce((sum, [, , n]) => sum + n, 0);
    console.log(`arena events: ${overall.toFixed(1)} distinct authored events fired per run (floor ${EVENT_REACH_PER_RUN_FLOOR.toFixed(1)})`);
    console.log(`  thinnest per run: ${perArena.slice(0, 5).map(([id, avg, n]) => `${id} ${avg.toFixed(1)} (n=${n})`).join(', ')}`);
    if (overall < EVENT_REACH_PER_RUN_FLOOR) {
      note(`a run shows only ${overall.toFixed(1)} distinct authored arena events, under the floor of ${EVENT_REACH_PER_RUN_FLOOR.toFixed(1)}`);
    }
  }
  console.log(`  cumulative over the whole sweep: ${reached}/${authored} fired at least once (${(share * 100).toFixed(1)}%) — a function of runs-per-arena, not of reach; see the comment on EVENT_REACH_PER_RUN_FLOOR`);
  console.log(`  thinnest cumulative: ${worst.slice(0, 5).map(([id, h, n]) => `${id} ${h}/${n}`).join(', ')}`);
  const dead = Object.entries(packs).filter(([, ids]) => ids.every(x => !eventIdsFired.has(x)));
  dead.forEach(([id]) => note(`not one authored event in the "${id}" pack ever fired`));
  if (DERIVED_ID_COLLISIONS.length > 0) {
    console.log(`  ${DERIVED_ID_COLLISIONS.length} derived id(s) needed a collision suffix: ${DERIVED_ID_COLLISIONS.slice(0, 4).join(', ')}`);
  }
}

const RUMOUR_KINDS = ['restock', 'holed-up', 'cache', 'empty'];
RUMOUR_KINDS.forEach(k => {
  if (!trueRumourKinds[k]) note(`no true "${k}" rumour was ever minted — that kind can only ever be a lie`);
});
console.log(`rumours: true claims by kind ${RUMOUR_KINDS.map(k => `${k}=${trueRumourKinds[k] ?? 0}`).join(' ')}`);
console.log(`rumours: planted=${rumoursPlanted} exposedAsPlant=${rumoursCaughtPlanted} exposedAsRepeated=${rumoursCaughtRepeated} untraceable=${rumoursDeadEnd}`);
console.log(`vengeancePacts: sworn=${vengeancePacts} paidThemselves=${vengeancePaid} takenByAnother=${vengeanceStolen} abandoned=${vengeanceAbandoned}`);
const treatyEndings = treatiesBroken + treatiesLapsed + treatiesOutgrown + treatiesOutlivedASide;
console.log(`blocTreaties: sworn=${treatiesSworn} renewed=${treatiesRenewed} brokenByAKilling=${treatiesBroken} lapsed=${treatiesLapsed}`
  + ` endedByTheField=${treatiesOutgrown} outlivedASide=${treatiesOutlivedASide} narratedEndings=${treatyEndings}`);
// AUDIT-6 §4.3: a treaty that is sworn on screen and then disappears is the
// bug the repaired probe found. Every treaty either ends on screen or is still
// standing when the run does; the gap between the two is what this asserts.
if (treatiesSworn > 0 && treatyEndings < treatiesSworn * 0.5) {
  note(`blocTreaties: ${treatiesSworn} sworn but only ${treatyEndings} narrated endings — treaties are vanishing unexplained`);
}
console.log(`§4: coalitionFractures=${fractures} inheritances=${inheritances} mentorCrossTalk=${mentorCrossTalk} watchesPosted=${watchesPosted}`);
console.log(`suspicion: investigations=${investigationsGuilty + investigationsCleared} (guilty=${investigationsGuilty} cleared=${investigationsCleared}) preemptiveDepartures=${preemptiveDepartures} sleepingApart=${sleepingApart}`);
console.log(`grief: loverTragedies=${loverTragedies} haunted=${hauntedGrants} hollow=${hollowGrants} reconciliations=${reconciliations}`);
// Each of these is a shipped mechanic whose only previous evidence of existing
// was the code. Zero is the bug this file exists to catch.
{
  const total = Object.values(objectiveCycles).reduce((a, b) => a + b, 0);
  const share = (k: string) => ((objectiveCycles[k] ?? 0) / Math.max(1, total) * 100).toFixed(1) + '%';
  console.log('objectives held: ' + ['survive', 'reach', 'hunt', 'flee', 'protect', 'hold', 'stalk', 'wait']
    .map(k => `${k}=${share(k)}`).join(' '));
  (['hold', 'stalk', 'wait'] as const).forEach(k => {
    if ((objectiveCycles[k] ?? 0) === 0) note(`the '${k}' objective was never held across ${runs} runs`);
  });
}

([
  ['pre-emptive betrayal', preemptiveBetrayals],
  ['pre-emptive departure', preemptiveDepartures],
  ['suspicion investigations', investigationsGuilty + investigationsCleared],
  ['lover death (TRAGEDY)', loverTragedies],
  ['Haunted', hauntedGrants],
  ['Hollow', hollowGrants],
  ['rivalry reconciliation', reconciliations],
] as Array<[string, number]>).forEach(([label, n]) => {
  if (n === 0) note(`${label} never fired across ${runs} runs`);
});
console.log(`triangles: formed=${trianglesFormed} jealousyBeats=${triangleJealousy} forcedChoices=${triangleChoices}`);
console.log(`loans: made=${loansMade} returned=${loansReturned} defaulted=${loansDefaulted}`);
// §4.2: the loan ledger, closed the way the truce ledger is. Every loan ends
// in exactly one of six ways or is still standing when the Games end; if these
// do not add up to `made`, the ledger is losing entries again.
const loanEndings = loansReturned + loansDefaulted + loansLost + loansLenderDied + loansBorrowerDied;
console.log(`loan ledger: made=${loansMade} accountedEndings=${loanEndings} `
  + `(returned=${loansReturned} defaulted=${loansDefaulted} lostTheItem=${loansLost} lenderDied=${loansLenderDied} borrowerDied=${loansBorrowerDied}) `
  + `stillStandingAtEnd=${loansOpenAtEnd} unaccounted=${loansMade - loanEndings - loansOpenAtEnd}`);
if (loansMade - loanEndings - loansOpenAtEnd > loansMade * 0.05) {
  note(`loan ledger loses ${loansMade - loanEndings - loansOpenAtEnd} of ${loansMade} loans`);
}
const pactEndings = vengeancePaid + vengeanceStolen + vengeanceAbandoned + vengeanceOutlived + vengeanceSoloed;
console.log(`vengeance ledger: sworn=${vengeancePacts} accountedEndings=${pactEndings} `
  + `(paidThemselves=${vengeancePaid} takenByAnother=${vengeanceStolen} abandoned=${vengeanceAbandoned} outlivedByTheArena=${vengeanceOutlived} downToOne=${vengeanceSoloed}) `
  + `stillStandingAtEnd=${vengeancePactsOpenAtEnd} unaccounted=${vengeancePacts - pactEndings - vengeancePactsOpenAtEnd}`);
if (vengeancePacts - pactEndings - vengeancePactsOpenAtEnd > vengeancePacts * 0.05) {
  note(`vengeance-pact ledger loses ${vengeancePacts - pactEndings - vengeancePactsOpenAtEnd} of ${vengeancePacts} pacts`);
}
console.log(`succession: toNamedHeir=${successionHeir} heirPassedOver=${successionPassedOver} splitTheGroup=${successionSplit} noHeirNamed=${successionUnnamed}`);
console.log(`notoriety: peak=${Math.round(peakNotoriety)} ledgerEntriesWithoutContact=${notorietyWithoutContact} strangersKnownByName=${strangersKnownByName}`);
console.log(`traitArcs: pacifistToBroken=${pacifistBroke} loyalToTreacherous=${loyalBroke} mercifulToRuthless=${mercyBroke}`);
console.log(`infection: woundsTurned=${woundsTurned} deepened=${sepsisDeepened} reachedTerminal=${sepsisTerminal} treated=${sepsisTreated} feverLines=${feverLines} sepsisDeaths=${sepsisDeaths}`);
console.log(`truces2: outlived=${trucesOutlived} brokeredHeld=${brokeredHeld}`);
console.log(`truce endings narrated: renewed=${trucesRenewed} lapsed=${trucesLapsed} turned=${trucesTurned} broken=${trucesBroken} `
  + `outlivedOrClosedAtEnd=${trucesOutlived} (matched by prose; the engine ledger below is the assertion)`);
console.log(`truce ledger (engine): terms=${ledgerTerms} endings=${ledgerEndings} `
  + `(renewed=${L.renewed} lapsed=${L.lapsed} turned=${L.turned} broken=${L.broken} outlived=${L.outlived} buried=${L.buried} `
  + `dissolvedWithBroker=${L.dissolved} standingAtEnd=${L.standingAtEnd}) unaccounted=${ledgerTerms - ledgerEndings}`);
// §1.4 (audit): loans and vengeance pacts both closed to zero; truces left
// 38% open. Every exit is counted at its site now, and the epilogue closes
// whatever is still standing, so the ledger has to balance exactly.
if (ledgerTerms !== ledgerEndings) {
  problems.push(`truce ledger loses ${ledgerTerms - ledgerEndings} of ${ledgerTerms} truce terms`);
}
// The prose-matched view is the on-screen guarantee: nearly every ending has
// to have printed a line the reader can find.
if (Math.abs(truceTerms - truceEndings - L.dissolved - L.buried) > truceTerms * 0.1) {
  note(`truce endings on screen: ${truceEndings + L.dissolved + L.buried} of ${truceTerms} terms narrated`);
}
console.log(`politics: factionActions=${factionCoups + factionExpulsions + factionWalkouts}`
    + ` (coups=${factionCoups} expulsions=${factionExpulsions} walkouts=${factionWalkouts})`
    + ` charterExpulsions=${expulsions} hearings=${hearings}`);
console.log(`parley: standoffs=${standoffs} tributesPaid=${tributesPaid} paidInInformation=${tributesPaidInformation} truces=${trucesStruck} trucesHeld=${trucesHeld} trucesBroken=${trucesBroken} trucesRenewed=${trucesRenewed} trucesLapsed=${trucesLapsed} trucesTurned=${trucesTurned} soloDepartures=${soloDepartures} schisms=${schisms}`);
console.log(`bonds: debtsRepaid=${debtsRepaid} charterBreaches=${charterBreaches} performed=${performedBonds} districtPairs=${districtBonds}`);
console.log(`resolve: breakdowns=${resolveBreakdowns} nightlock=${nightlockDeaths}`);
console.log('zone effects (live instances sampled per cycle): '
  + Object.entries(zoneEffectKinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(' '));
console.log(`edges: garrisonRuns=${garrisonRuns} garrisonCycles=${garrisonCycles} crossingsCounted=${edgeCrossingsMade} hiddenEdgesFound=${hiddenEdgesFound}`);
console.log(`arena2: weatherFronts=${weatherFronts} trapsDestroyed=${trapsDestroyed} gmSignatures=${gamemakerSignatures}`);
console.log(
  `muster: called in ${musterRuns}/${runs} runs (${(musterRuns / runs * 100).toFixed(1)}%), `
  + `attended in ${musterAttended} of those, ${musterPayouts} tribute-cycles paid `
  + `(narrated: ${musterCalls} calls, ${musterScenes} scenes)`);
/*
 * AUDIT-6 §9.1: the muster is an *incentive*, so "nobody came" is a legitimate
 * outcome of any single run and "nobody ever came" is the bug. The assertion is
 * that the offer is taken at all, not that it is taken often.
 */
if (musterRuns > 0 && musterAttended === 0) {
  problems.push(
    `the muster was called in ${musterRuns} runs and nobody ever stood in the sector — the pull is not reaching objectives`);
}
{
  const authored = Object.values(OFF_SEASON_SKINS).reduce((n, list) => n + list.length, 0);
  console.log(`offSeason: ${offSeasonRuns}/${runs} runs skinned (${(offSeasonRuns / runs * 100).toFixed(1)}%),`
    + ` ${offSeasonSeen.size}/${authored} distinct skins seen`);
  // AUDIT-6 §1.3: the assertion. The whole point of hoisting the resolver is
  // that a skin can now reach a headless run at all; zero here means the wiring
  // has come apart again, which is exactly the state this check was blind to.
  if (offSeasonRuns === 0) note('no run drew an off-season skin — resolveArenaForRun is not being reached');
}
console.log(`zoneControl: held=${cornucopiaHeld} payouts=${cornucopiaPayouts}`);
console.log(`schedule: signatureBeats=${signatureBeats} calendarBeats=${calendarBeats}`);
console.log(`fieldcraft: traps by kind ${Object.entries(trapKinds).map(([k, n]) => `${k}=${n}`).join(' ')}`);
console.log(`obligations: made=${obligationsMade} kept=${obligationsKept} broken=${obligationsBroken} lapsed=${obligationsLapsed}`);
console.log(`parachutes: claimed=${chutesClaimed} collectedByAlly=${chutesCollected} stolen=${chutesStolen} lost=${chutesLost}`);
console.log(`fieldcraft: trapsSet=${trapsSet} trapsTriggered=${trapsTriggered} fires=${firesLit} shelters=${sheltersBuilt} camouflage=${camouflaged} poisonedWeapons=${weaponsPoisoned} partialWork=${partialWork}`);
console.log(`arena: zoneFires=${zoneFiresStarted} (spread ${zoneFiresSpread}) floods=${zoneFloods} freezes=${zoneFreezes} contaminations=${zoneContaminations} fogs=${zoneFogs} strippedZones=${zoneStripped} severed=${zoneSevered}`);
console.log(`arena: borderTelegraphs=${borderTelegraphs} cornucopiaRestocks=${cornucopiaRestocks} muttEncounters=${muttEncounters}`);
console.log(`alliances: recruitments=${recruitments} organicGroupsOf3Plus=${organicTrios} largestSeen=${maxAllianceSeen}`);
console.log(`inventory: overloaded drops=${overloadedDrops}`);
// §3.4: empty pools handed to `RNG.pickOrUndefined`. `RNG.pick` throws, so a
// genuinely-empty required pool cannot pass silently any more; this is the
// other half — the honest form returns undefined, and an undefined that lands
// in a non-string field or in a branch that narrates nothing is invisible to
// the rendered-text grep below. The number is not a pass/fail bound. It is a
// tripwire: a jump after a change to a filter is the thing worth looking at.
console.log(`rng: empty pools handed to pickOrUndefined=${emptyPickCount()}`);
// §5.4: the peak sat exactly on the clamp, which says nothing about how
// often zones actually strip. The distribution does.
if (depletionValues.length > 0) {
  const sorted = [...depletionValues].sort((x, y) => x - y);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const atFloor = depletionValues.filter(v => v >= (1 - ZONES.minYieldFraction) - 1e-6).length;
  console.log(`depletion distribution: n=${sorted.length} p50=${q(0.5).toFixed(2)} p90=${q(0.9).toFixed(2)} atFloor=${(atFloor / sorted.length * 100).toFixed(1)}%`);
}
console.log(`zones: runsWithDepletion=${zonesEverDepleted} runsWithRecovery=${zonesEverRecovered} peakDepletion=${maxDepletionSeen.toFixed(2)} (floor ${(1 - ZONES.minYieldFraction).toFixed(2)})`);
console.log(`stance: worst change rate ${(worstThrashRate * 100).toFixed(0)}% of cycles (threshold 60%)`);
console.log(`odds: ${oddsMoved}/${oddsCompared} survivors moved off their opening line`);
const victorMeanPct = victorPctCount > 0 ? victorPctSum / victorPctCount : 0;
const fieldMeanPct = fieldPctCount > 0 ? fieldPctSum / fieldPctCount : 0;
const calibrationRatio = fieldMeanPct > 0 ? victorMeanPct / fieldMeanPct : 0;
console.log(`odds calibration: victors priced at ${victorMeanPct.toFixed(1)}% vs field mean ${fieldMeanPct.toFixed(1)}% (ratio ${calibrationRatio.toFixed(2)})`);
console.log(`dual victories: ${dualVictories}`);
// §1.1/§10.3: this is the assertion that would have caught the exploitable
// board. A board that discriminates prices eventual victors well above the
// field mean at bet time; the pre-fix board managed ~1.1x.
if (calibrationRatio < 1.5) note(`odds board barely discriminates: victors priced at only ${calibrationRatio.toFixed(2)}x the field mean at bet time`);
if (dualVictories === 0) note('no run ever ended with two victors — the §7.1 endgame never fired');
console.log(`relationships: peak magnitude ${maxAbsRelationship} (bound ${RELATIONSHIPS.max})`);
const totalScores = Object.values(trainingHistogram).reduce((a, b) => a + b, 0);
console.log('training score distribution:');
Object.keys(trainingHistogram).map(Number).sort((a, b) => a - b).forEach(k => {
  console.log(`  ${String(k).padStart(2)}: ${(trainingHistogram[k] / totalScores * 100).toFixed(2)}%  (${trainingHistogram[k]})`);
});
// AUDIT-6 §1.2: the meta-assertion. A prose probe that matched nothing across
// the whole sweep is measuring a line that no longer exists.
{
  const dead = [...proseProbes.entries()]
    .filter(([source, p]) => p.hits === 0 && !PROSE_ALLOWED_ZERO.has(source))
    .map(([source]) => source);
  console.log(`prose probes: ${proseProbes.size} evaluated, ${proseProbes.size - dead.length} matched at least once`);
  dead.forEach(source => problems.push(
    `dead prose probe: /${source}/ matched nothing in ${runs} runs — the line it watches has been rewritten or deleted`,
  ));
}
/*
 * AUDIT-9, second pass: the same meta-assertion, one level down.
 *
 * A dead *type* is a stronger statement than a dead probe. A probe reads zero
 * when its sentence changed; a type reads zero only when the beat itself
 * stopped happening, or when somebody removed the `type:` from its emitter —
 * and the second is a mistake the compiler cannot catch, because `type` is
 * optional by design. This is what catches it.
 */
{
  const dead = [...beatCounts.entries()]
    .filter(([type, n]) => n === 0 && !BEAT_ALLOWED_ZERO.has(type))
    .map(([type]) => type);
  console.log(`typed beats: ${beatCounts.size} counted, ${beatCounts.size - dead.length} fired at least once`);
  dead.forEach(type => problems.push(
    `dead event type: '${type}' was never emitted in ${runs} runs — either the beat stopped happening `
    + 'or its emitter lost its `type:`',
  ));
}
console.log(problems.length ? '\nPROBLEMS:\n' + problems.map(p => ' - ' + p).join('\n') : '\nNo invariant violations.');
if (problems.length) process.exit(1);
