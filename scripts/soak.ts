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
import { generateTributes, strengthCapForAge } from '../src/engine/generator';
import { generateArena } from '../src/engine/arenaGenerator';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG, traitsConflict } from '../src/data/constants';
import { ALLIANCES, FEAR, GENERATION, HUNTING, PROFICIENCY, RELATIONSHIPS, ZONES } from '../src/data/balance';
import { carryCapacity } from '../src/engine/items';
import { oddsScore, tributeOdds } from '../src/engine/odds';
import { GameConfig, GameState, Stance } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';

const problems: string[] = [];
const note = (m: string) => { if (!problems.includes(m)) problems.push(m); };

const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];
const configs: GameConfig[] = [
  DEFAULT_GAME_CONFIG,
  { ...DEFAULT_GAME_CONFIG, districtCount: 2, hazardRate: 2.5, betrayalRate: 3, sponsorGenerosity: 0 },
  { ...DEFAULT_GAME_CONFIG, districtCount: 12, hazardRate: 0.25, betrayalRate: 0, sponsorGenerosity: 3, enableFeast: false, enableSanity: false },
  { ...DEFAULT_GAME_CONFIG, districtCount: 3, enableFeast: true, enableSanity: true, hazardRate: 2 },
];

function start(seed: string, arenaId: string, config: GameConfig, gamemaker: boolean): GameState {
  const arena = arenaId.startsWith('procedural') ? generateArena(seed) : ARENAS.find(a => a.id === arenaId)!;
  const gamesProfile = gamesProfileFor(seed);
  const tributes = generateTributes(seed, config, arena.zones[0].name, gamesProfile.castShape);
  return { seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: gamemaker, config, baseConfig: config, gamesProfile, logCounter: 0, feastsHeld: 0, cycle: 0 };
}

const trainingHistogram: Record<number, number> = {};
let runs = 0, victors = 0, wipeouts = 0, totalDays = 0, totalLogs = 0, feastRuns = 0;
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
let zoneDrinks = 0, pursuits = 0, desperationFights = 0, fearFelt = 0;
let bestProficiencySeen = 0;
// Relationships and alliances.
let exoticBetrayals = 0, merges = 0, leadershipChanges = 0, pactsDeclared = 0, pactsHonoured = 0;
let feuds = 0, freeForAlls = 0, careerDefections = 0, cacheContributions = 0;
// Intentions and fieldcraft.
let objectivesFormed = 0, trapsSet = 0, trapsTriggered = 0;
let firesLit = 0, sheltersBuilt = 0, camouflaged = 0, weaponsPoisoned = 0;
// Arena: stateful zones, mutts, border variety.
let zoneFiresStarted = 0, zoneFiresSpread = 0, zoneFloods = 0, zoneFreezes = 0;
let zoneContaminations = 0, zoneFogs = 0, zoneStripped = 0, zoneSevered = 0;
let borderTelegraphs = 0, cornucopiaRestocks = 0, muttEncounters = 0;
// Newer systems: each needs evidence it actually fired across the sweep.
let standoffs = 0, tributesPaid = 0, tributesPaidInformation = 0, trucesStruck = 0;
let trucesBroken = 0, soloDepartures = 0, trucesHeld = 0, schisms = 0;
let trucesRenewed = 0, trucesLapsed = 0, trucesTurned = 0;
let resolveBreakdowns = 0, nightlockDeaths = 0;
let debtsRepaid = 0, charterBreaches = 0, performedBonds = 0, districtBonds = 0;
let weatherFronts = 0, trapsDestroyed = 0, gamemakerSignatures = 0;
let cornucopiaHeld = 0, cornucopiaPayouts = 0;
let signatureBeats = 0, calendarBeats = 0;
let maxAbsRelationship = 0;

for (let i = 0; i < 240; i++) {
  const seed = `SOAK${i}`;
  const arenaId = arenaIds[i % arenaIds.length];
  const config = configs[i % configs.length];
  const gamemaker = i % 5 === 0;
  const sim = new Simulator(start(seed, arenaId, config, gamemaker));

  let guard = 3000;
  let state = sim.getState();
  let gamemakerFired = false;

  // Per-run behavioural tracking.
  const stanceSamples = new Map<string, { last: Stance; changes: number; samples: number }>();
  const depletionSamples = new Map<string, number>();
  let sawRecovery = false;
  const startingOdds = new Map<string, number>();
  const gongPct = new Map<string, number>();

  const sample = () => {
    state.tributes.forEach(t => {
      if (t.status !== 'alive') return;
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
      if (n > ALLIANCES.maxSize && !id.startsWith('career-pack')) {
        note(`alliance ${id} grew to ${n}, past the cap of ${ALLIANCES.maxSize}`);
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
    else if (state.phase === 'training') {
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
      sample();
    }
    state = sim.getState();
    phasesSeen.add(state.phase);
    if (guard < 2500) note(`run ${seed} needed excessive cycles`);
  }
  if (guard <= 0) note(`run ${seed} hit the cycle guard (possible infinite loop)`);

  runs++;
  totalDays += state.day;
  totalLogs += state.log.length;
  if ((state.feastsHeld ?? 0) > 0) feastRuns++;
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
    if (/\{[a-z0-9]+\}/i.test(l.text)) note(`unreplaced placeholder: ${l.text.slice(0, 90)}`);
    if (l.text.includes('undefined') || l.text.includes('NaN')) note(`bad text: ${l.text.slice(0, 90)}`);
    if (l.text.startsWith('VENGEANCE:')) vengeanceSworn++;
    if (l.text.startsWith('GROUP FIGHT:')) groupFights++;
    if (l.text.startsWith('AMBUSH:')) ambushes++;
    // Prose-matched, so kept deliberately broad: these must survive new
    // flavour lines being added to the same pools.
    if (/breaks off|disengages and runs|back away from each other|is gone into the cover|breaks contact|throws everything they are carrying|does not follow far|go opposite ways out of|simply stop, ten feet apart/.test(l.text)) retreats++;
    if (/hears the cannon and stops dead|face in the sky|says .*'s name out loud|something closes behind their eyes/.test(l.text)) griefEvents++;
    if (/never knows it|does not move a muscle|until .* has gone|is right there|never once looks up|until the footsteps go away/.test(l.text)) hiddenMoments++;
    if (/wave .* in\.|worth more inside|nobody asks them to leave|makes their case/.test(l.text)) recruitments++;
    if (l.text.includes('cannot carry it all') || l.text.includes('leaves') && l.text.includes('in the dirt')) overloadedDrops++;
    if (l.text.includes('already stripped bare')) depletedForages++;
    // --- Tribute-logic overhaul: each new system must actually fire. ---
    if (l.text.includes('bleeding has clotted')) clots++;
    if (/binds their wound tight|rough dressing onto the wound|dressing onto .*'s wound|binds .*'s wound properly/.test(l.text)) fieldDressings++;
    if (l.text.includes('sleeps properly for the first time')) restRecoveries++;
    if (/runs down something small|knapping a stone|works it into a cudgel/.test(l.text)) huntOrCraft++;
    if (/drinks their fill from the water|risks a drink from|boils water from/.test(l.text)) zoneDrinks++;
    if (l.text.includes('hunting ')) pursuits++;
    if (/too few left for either|Only one of them is going home|the week runs out|wanting has stopped mattering|small enough now to decide things/.test(l.text)) desperationFights++;
    // --- Intentions and fieldcraft. ---
    if (/starts hunting |sets off for |worth holding and digs in|wants to be anywhere but|not dying on their watch/.test(l.text)) objectivesFormed++;
    if (/sets a snare|balances a deadfall/.test(l.text)) trapsSet++;
    if (/snare closes on their leg|deadfall comes down on|pulls apart a (snare|deadfall)/.test(l.text)) trapsTriggered++;
    if (/gets a fire going/.test(l.text)) firesLit++;
    if (/lashes together a shelter/.test(l.text)) sheltersBuilt++;
    if (/works mud and leaf litter/.test(l.text)) camouflaged++;
    if (/^STANDOFF:|back out of the clearing|both decide, separately|stop pretending either of them will|neither turns their back|It is arithmetic\./.test(l.text)) standoffs++;
    // Both shapes of the toll: an item handed over, and — for the far more
    // common tribute who is carrying nothing spare — directions paid instead.
    if (/is allowed to walk away|works out the price on their own|to get out of .* alive|before .* has finished closing|A toll, in everything but name/.test(l.text)) tributesPaid++;
    if (/pay in directions instead|finds nothing worth taking, and asks a question|Empty pockets buy nothing|Information is the only currency|knowing better than to go back to/.test(l.text)) tributesPaidInformation++;
    if (/^TRUCE:/.test(l.text)) trucesStruck++;
    if (/The agreement is holding|still worth more than the fight|it holds for one more day|Nothing is what they agreed on|That is what the word was for|and neither of them says what|It looks like courtesy|and neither of them moves/.test(l.text)) trucesHeld++;
    if (/there was never any agreement at all|decides the arithmetic has changed|has just stopped honouring it|Arguing would take longer|replays the handshake twice|is finished with it now/.test(l.text)) trucesBroken++;
    // §4.1: expiry resolves on-screen now — renew, lapse, or turn. These three
    // together are the fix for the "80 of 84 truces evaporated silently" bug,
    // so the floor below asserts the resolution layer stays visible.
    if (/truce holds another stretch|same terms, both still in|renew the agreement|The truce rolls over/.test(l.text)) trucesRenewed++;
    if (/runs out quietly|simply expires, and from tomorrow|clock on it has run out|let the pact lapse|The truce is over/.test(l.text)) trucesLapsed++;
    if (/was counting the hours|discovers what the letter was worth|turns on .* before the echo|kept the truce like a blade/.test(l.text)) trucesTurned++;
    if (/would rather stop pretending otherwise/.test(l.text)) soloDepartures++;
    if (/it is two camps/.test(l.text)) schisms++;
    if (/stops taking cover in|stops making plans/.test(l.text)) resolveBreakdowns++;
    if (/takes out the nightlock/.test(l.text)) nightlockDeaths++;
    if (/without being asked. Neither of them mentions why|That is the whole conversation|settles up in|so they take it, all of it|pay what they can|I owe you one/.test(l.text)) debtsRepaid++;
    if (/while the pile stayed empty|It gets loud between|come back to an empty one|which is the one thing this group agreed/.test(l.text)) charterBreaches++;
    if (/plays it beautifully/.test(l.text)) performedBonds++;
    if (/A front builds on the edge of the arena/.test(l.text)) weatherFronts++;
    if (/The horn belongs to somebody now|The horn has changed hands/.test(l.text)) cornucopiaHeld++;
    if (/takes .* straight off the top/.test(l.text)) cornucopiaPayouts++;
    if (/is so much ash|lifts .* trap clean off its anchor/.test(l.text)) trapsDestroyed++;
    if (/calls the tributes to the Cornucopia|is asked, live, when he intends to intervene|signs the release order personally|adjusts nothing dramatic|finally gets to use the weather systems|brings the schedule forward|A parachute comes down for the youngest/.test(l.text)) gamemakerSignatures++;
    if (/Nobody in the Capitol is saying out loud what that is going to mean/.test(l.text)) districtBonds++;
    if (/^THE CLOCK:|^THE VAULT GOES DARK:|^THE TIDE TURNS:|^STRUCTURAL FAILURE:|^THE SUN STALLS:|^THE COLD COMES DOWN:|^THE BOG EXHALES:|^THE FALL THICKENS:|^THE MIRROR:|^THE BLOOM:|A crossing parts two hundred metres up/.test(l.text)) signatureBeats++;
    if (/coats their .* with it/.test(l.text)) weaponsPoisoned++;
    // --- Relationships and alliances. ---
    if (/empties the group's stash|and watches them go|keeps their hand over the pocket|hears it, and keeps walking/.test(l.text)) exoticBetrayals++;
    if (/run as one/.test(l.text)) merges++;
    if (/takes charge of what is left|stops deferring to/.test(l.text)) leadershipChanges++;
    if (/run together until the final eight|swear to see it through/.test(l.text)) pactsDeclared++;
    if (/agreed this was where it ended/.test(l.text)) pactsHonoured++;
    if (/have done this before/.test(l.text)) feuds++;
    if (/not one of them has a friend in it/.test(l.text)) freeForAlls++;
    if (/walks the other way|there is no pack this year/.test(l.text)) careerDefections++;
    if (/adds their .* to the group's stash/.test(l.text)) cacheContributions++;
    // --- Arena: stateful zones, mutts, border variety. ---
    if (l.text.includes('Fire takes hold')) zoneFiresStarted++;
    if (l.text.includes('jumps to')) zoneFiresSpread++;
    if (l.text.includes('goes under')) zoneFloods++;
    if (l.text.includes('hard freeze locks down')) zoneFreezes++;
    if (l.text.includes('is wrong') && l.text.includes('lingers')) zoneContaminations++;
    if (l.text.includes('fog bank rolls into')) zoneFogs++;
    if (l.text.includes('burned down to ash')) zoneStripped++;
    if (l.text.includes('route between') || l.text.includes('route gives out')) zoneSevered++;
    if (l.text.includes('border will close around')) borderTelegraphs++;
    if (l.text.includes('supply drop lands over the Cornucopia')) cornucopiaRestocks++;
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
    else if (s.phase === 'training') sim.processInterviews();
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
    else if (s.phase === 'training') sim.processInterviews();
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
// across 240 runs, it is not implemented, it is decorative.
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
// never see. The floors are aggregate counts against the 240-run sweep,
// set at roughly half the measured post-tuning baselines so ordinary drift
// passes and a regression to the pre-tuning rates fails.
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
console.log('phases seen:', [...phasesSeen].sort().join(', '));
console.log('categories seen:', [...categoriesSeen].sort().join(', '));
console.log(`behaviour: vengeance=${vengeanceSworn} groupFights=${groupFights} retreats=${retreats} griefMoments=${griefEvents} strippedZones=${depletedForages}`);
console.log(`stealth: ambushes=${ambushes} unnoticed=${hiddenMoments}`);
console.log(`wounds: clots=${clots} fieldDressings=${fieldDressings} restRecoveries=${restRecoveries}`);
console.log(`agency: hunts/crafts=${huntOrCraft} zoneDrinks=${zoneDrinks} pursuits=${pursuits} desperationFights=${desperationFights}`);
console.log(`psychology: fear entries=${fearFelt} peakProficiency=${bestProficiencySeen.toFixed(2)} (cap ${PROFICIENCY.max})`);
console.log(`intentions: objectives formed=${objectivesFormed}`);
console.log(`social: exoticBetrayals=${exoticBetrayals} merges=${merges} leaderChanges=${leadershipChanges} feuds=${feuds} freeForAlls=${freeForAlls}`);
console.log(`pacts: declared=${pactsDeclared} honoured=${pactsHonoured} careerDefections=${careerDefections} cacheContributions=${cacheContributions}`);
console.log(`parley: standoffs=${standoffs} tributesPaid=${tributesPaid} paidInInformation=${tributesPaidInformation} truces=${trucesStruck} trucesHeld=${trucesHeld} trucesBroken=${trucesBroken} trucesRenewed=${trucesRenewed} trucesLapsed=${trucesLapsed} trucesTurned=${trucesTurned} soloDepartures=${soloDepartures} schisms=${schisms}`);
console.log(`bonds: debtsRepaid=${debtsRepaid} charterBreaches=${charterBreaches} performed=${performedBonds} districtPairs=${districtBonds}`);
console.log(`resolve: breakdowns=${resolveBreakdowns} nightlock=${nightlockDeaths}`);
console.log(`arena2: weatherFronts=${weatherFronts} trapsDestroyed=${trapsDestroyed} gmSignatures=${gamemakerSignatures}`);
console.log(`zoneControl: held=${cornucopiaHeld} payouts=${cornucopiaPayouts}`);
console.log(`schedule: signatureBeats=${signatureBeats} calendarBeats=${calendarBeats}`);
console.log(`fieldcraft: trapsSet=${trapsSet} trapsTriggered=${trapsTriggered} fires=${firesLit} shelters=${sheltersBuilt} camouflage=${camouflaged} poisonedWeapons=${weaponsPoisoned}`);
console.log(`arena: zoneFires=${zoneFiresStarted} (spread ${zoneFiresSpread}) floods=${zoneFloods} freezes=${zoneFreezes} contaminations=${zoneContaminations} fogs=${zoneFogs} stripped=${zoneStripped} severed=${zoneSevered}`);
console.log(`arena: borderTelegraphs=${borderTelegraphs} cornucopiaRestocks=${cornucopiaRestocks} muttEncounters=${muttEncounters}`);
console.log(`alliances: recruitments=${recruitments} organicGroupsOf3Plus=${organicTrios} largestSeen=${maxAllianceSeen}`);
console.log(`inventory: overloaded drops=${overloadedDrops}`);
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
console.log(problems.length ? '\nPROBLEMS:\n' + problems.map(p => ' - ' + p).join('\n') : '\nNo invariant violations.');
if (problems.length) process.exit(1);
