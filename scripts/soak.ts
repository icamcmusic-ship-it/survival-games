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
import { GENERATION, RELATIONSHIPS, ZONES } from '../src/data/balance';
import { oddsScore } from '../src/engine/odds';
import { GameConfig, GameState, Stance } from '../src/models/types';

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
  const tributes = generateTributes(seed, config);
  tributes.forEach(t => { t.zone = arena.zones[0].name; });
  return { seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: gamemaker, config, logCounter: 0, feastsHeld: 0, cycle: 0 };
}

const trainingHistogram: Record<number, number> = {};
let runs = 0, victors = 0, wipeouts = 0, totalDays = 0, totalLogs = 0, feastRuns = 0;
const phasesSeen = new Set<string>();
const categoriesSeen = new Set<string>();

// Aggregate observations for the behavioural invariants.
let zonesEverDepleted = 0, zonesEverRecovered = 0;
let maxDepletionSeen = 0;
let worstThrashRate = 0;
let vengeanceSworn = 0, groupFights = 0, retreats = 0, griefEvents = 0, depletedForages = 0;
let oddsMoved = 0, oddsCompared = 0;
let maxAbsRelationship = 0;

for (let i = 0; i < 240; i++) {
  const seed = `SOAK${i}`;
  const arenaId = arenaIds[i % arenaIds.length];
  const config = configs[i % configs.length];
  const gamemaker = i % 5 === 0;
  const sim = new Simulator(start(seed, arenaId, config, gamemaker));

  let guard = 3000;
  let state = sim.getState();

  // Per-run behavioural tracking.
  const stanceSamples = new Map<string, { last: Stance; changes: number; samples: number }>();
  const depletionSamples = new Map<string, number>();
  let sawRecovery = false;
  const startingOdds = new Map<string, number>();

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
    Object.entries(state.zoneDepletion ?? {}).forEach(([zone, value]) => {
      maxDepletionSeen = Math.max(maxDepletionSeen, value);
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
      sim.startGames();
    }
    else if (state.phase === 'bloodbath') sim.processBloodbath();
    else if (state.phase === 'epilogue') state.phase = 'ended';
    else {
      // exercise gamemaker controls mid-run
      if (gamemaker && state.day === 3 && state.phase === 'day') {
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

  const alive = state.tributes.filter(t => t.status === 'alive');
  if (alive.length > 1) note(`run ${seed} ended with ${alive.length} survivors`);
  if (alive.length === 1) victors++; else wipeouts++;

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
    if (/breaks off|disengages and runs|back away from each other/.test(l.text)) retreats++;
    if (/hears the cannon and stops dead|sees .* face in the sky/.test(l.text)) griefEvents++;
    if (l.text.includes('already stripped bare')) depletedForages++;
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

// determinism: same seed twice must produce identical output
function runOnce(seed: string) {
  const sim = new Simulator(start(seed, 'clockwork', DEFAULT_GAME_CONFIG, false));
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
if (runOnce('DETERMINISM') !== runOnce('DETERMINISM')) note('simulation is not deterministic for a fixed seed');

// A dead system is as much a bug as a broken one: if a mechanic never fires
// across 240 runs, it is not implemented, it is decorative.
if (vengeanceSworn === 0) note('no tribute ever swore vengeance across the whole soak');
if (groupFights === 0) note('group combat never triggered across the whole soak');
if (retreats === 0) note('nobody ever retreated from a fight');
if (griefEvents === 0) note('no death ever produced grief in another tribute');
if (depletedForages === 0) note('no zone was ever foraged out from under anyone');
if (zonesEverDepleted > 0 && zonesEverRecovered === 0) note('zone resources deplete but never recover');
if (oddsCompared > 0 && oddsMoved === 0) note('odds never moved during a run — they are still static');

console.log(`runs=${runs} victors=${victors} wipeouts=${wipeouts} avgDays=${(totalDays/runs).toFixed(1)} avgLogs=${(totalLogs/runs).toFixed(0)} runsWithFeast=${feastRuns}`);
console.log('phases seen:', [...phasesSeen].sort().join(', '));
console.log('categories seen:', [...categoriesSeen].sort().join(', '));
console.log(`behaviour: vengeance=${vengeanceSworn} groupFights=${groupFights} retreats=${retreats} griefMoments=${griefEvents} strippedZones=${depletedForages}`);
console.log(`zones: runsWithDepletion=${zonesEverDepleted} runsWithRecovery=${zonesEverRecovered} peakDepletion=${maxDepletionSeen.toFixed(2)} (floor ${(1 - ZONES.minYieldFraction).toFixed(2)})`);
console.log(`stance: worst change rate ${(worstThrashRate * 100).toFixed(0)}% of cycles (threshold 60%)`);
console.log(`odds: ${oddsMoved}/${oddsCompared} survivors moved off their opening line`);
console.log(`relationships: peak magnitude ${maxAbsRelationship} (bound ${RELATIONSHIPS.max})`);
const totalScores = Object.values(trainingHistogram).reduce((a, b) => a + b, 0);
console.log('training score distribution:');
Object.keys(trainingHistogram).map(Number).sort((a, b) => a - b).forEach(k => {
  console.log(`  ${String(k).padStart(2)}: ${(trainingHistogram[k] / totalScores * 100).toFixed(2)}%  (${trainingHistogram[k]})`);
});
console.log(problems.length ? '\nPROBLEMS:\n' + problems.map(p => ' - ' + p).join('\n') : '\nNo invariant violations.');
if (problems.length) process.exit(1);
