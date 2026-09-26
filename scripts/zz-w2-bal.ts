import { Simulator } from '../src/engine/simulator';
import { victorsOf } from '../src/utils/notables';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameConfig } from '../src/models/types';
import { coverageCells, initialRunState } from './runInit';
import { deathCodeOf } from '../src/engine/causes';
import * as fs from 'fs';
const RUNS = Number(process.env.RUNS ?? 1600), SH = Number(process.env.SHARD ?? 0), SHS = Number(process.env.SHARDS ?? 1);
const PREFIX = process.env.PREFIX ?? 'METRIC';
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];
const configs: GameConfig[] = [DEFAULT_GAME_CONFIG, { ...DEFAULT_GAME_CONFIG, districtCount: 6 },
  { ...DEFAULT_GAME_CONFIG, districtCount: 12, hazardRate: 1.5 }, { ...DEFAULT_GAME_CONFIG, districtCount: 8, betrayalRate: 1.5 }];
const cells = coverageCells(arenaIds, configs.length, RUNS);
const out = { runs: 0, archN: {} as Record<string, number>, archW: {} as Record<string, number>, distW: {} as Record<string, number>, victors: 0,
  stance: {} as Record<string, number>, stanceSamples: 0, deaths: 0, starved: 0, tribKills: 0, bare: 0, traitN: {} as Record<string, number>, traitW: {} as Record<string, number> };
for (let i = SH; i < RUNS; i += SHS) {
  const cell = cells[i];
  const sim = new Simulator(initialRunState({ seed: `${PREFIX}${i}`, arenaId: cell.arenaId, config: configs[cell.configIndex] }));
  let state = sim.getState(); let guard = 3000;
  const reap = new Map(state.tributes.map(t => [t.id, [...t.traits]] as const));
  while (state.phase !== 'ended' && guard-- > 0) {
    if (state.phase === 'setup') sim.processTraining();
    else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
    else if (state.phase === 'interviews') sim.startGames();
    else if (state.phase === 'bloodbath') sim.processBloodbath();
    else if (state.phase === 'epilogue') state.phase = 'ended';
    else if (!sim.processTurn()) break;
    state = sim.getState();
    if (state.phase === 'day' || state.phase === 'night') state.tributes.forEach(t => { if (t.status !== 'alive') return; out.stanceSamples++; out.stance[t.stance] = (out.stance[t.stance] ?? 0) + 1; });
  }
  out.runs++;
  const vs = victorsOf(state); const vids = new Set(vs.map(v => v.id));
  state.tributes.forEach(t => {
    out.archN[t.archetype] = (out.archN[t.archetype] ?? 0) + 1;
    (reap.get(t.id) ?? []).forEach(tr => { out.traitN[tr] = (out.traitN[tr] ?? 0) + 1; if (vids.has(t.id)) out.traitW[tr] = (out.traitW[tr] ?? 0) + 1; });
    if (t.status === 'dead') {
      out.deaths++; const c = deathCodeOf(t);
      if (c === 'starvation') out.starved++;
      if (c === 'tribute') { out.tribKills++; if (!/\(([^)]+)\)\s*$/.test(t.causeOfDeath ?? '')) out.bare++; }
    }
  });
  vs.forEach(v => { out.victors++; out.archW[v.archetype] = (out.archW[v.archetype] ?? 0) + 1; out.distW[v.district] = (out.distW[v.district] ?? 0) + 1; });
}
fs.writeFileSync(process.env.OUT!, JSON.stringify(out));
