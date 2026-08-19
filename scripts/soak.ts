/**
 * Headless soak test: runs hundreds of complete simulations across every
 * arena and a spread of configs, then asserts the invariants that matter
 * (no infinite loops, vitals in range, unique names and log ids, no
 * unreplaced text placeholders, deterministic output for a fixed seed).
 *
 *   npm run test:sim
 */
import { generateTributes } from '../src/engine/generator';
import { generateArena } from '../src/engine/arenaGenerator';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameConfig, GameState } from '../src/models/types';

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
  return { seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: gamemaker, config, logCounter: 0, feastsHeld: 0 };
}

const trainingHistogram: Record<number, number> = {};
let runs = 0, victors = 0, wipeouts = 0, totalDays = 0, totalLogs = 0, feastRuns = 0;
const phasesSeen = new Set<string>();
const categoriesSeen = new Set<string>();

for (let i = 0; i < 240; i++) {
  const seed = `SOAK${i}`;
  const arenaId = arenaIds[i % arenaIds.length];
  const config = configs[i % configs.length];
  const gamemaker = i % 5 === 0;
  const sim = new Simulator(start(seed, arenaId, config, gamemaker));

  let guard = 3000;
  let state = sim.getState();
  while (state.phase !== 'ended' && guard-- > 0) {
    if (state.phase === 'setup') sim.processTraining();
    else if (state.phase === 'training') {
      state.tributes.forEach(t => { trainingHistogram[t.trainingScore] = (trainingHistogram[t.trainingScore] || 0) + 1; });
      sim.processInterviews();
    }
    else if (state.phase === 'interviews') sim.startGames();
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
  });

  const names = state.tributes.map(t => t.name);
  if (new Set(names).size !== names.length) note(`duplicate tribute names in ${seed}`);

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
    if (t.status === 'dead') {
      if (t.allianceId) note('dead tribute still in an alliance');
      if (t.dayOfDeath === undefined) note('dead tribute without dayOfDeath');
      if (!t.causeOfDeath) note('dead tribute without cause of death');
      if (t.health !== 0) note(`dead tribute health ${t.health}`);
    } else {
      if (!state.arena.zones.some(z => z.name === t.zone)) note(`tribute in unknown zone: ${t.zone}`);
    }
    Object.values(t.relationships).forEach(r => {
      if (!Number.isFinite(r)) note('non-finite relationship');
    });
  });

  if (alive.length === 1 && (!state.epilogueInterview || state.epilogueInterview.length === 0)) {
    note('victor without an epilogue interview');
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

console.log(`runs=${runs} victors=${victors} wipeouts=${wipeouts} avgDays=${(totalDays/runs).toFixed(1)} avgLogs=${(totalLogs/runs).toFixed(0)} runsWithFeast=${feastRuns}`);
console.log('phases seen:', [...phasesSeen].sort().join(', '));
console.log('categories seen:', [...categoriesSeen].sort().join(', '));
const totalScores = Object.values(trainingHistogram).reduce((a, b) => a + b, 0);
console.log('training score distribution:');
Object.keys(trainingHistogram).map(Number).sort((a, b) => a - b).forEach(k => {
  console.log(`  ${String(k).padStart(2)}: ${(trainingHistogram[k] / totalScores * 100).toFixed(2)}%  (${trainingHistogram[k]})`);
});
console.log(problems.length ? '\nPROBLEMS:\n' + problems.map(p => ' - ' + p).join('\n') : '\nNo invariant violations.');
