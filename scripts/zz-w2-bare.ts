import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { initialRunState } from './runInit';
import { deathCodeOf } from '../src/engine/causes';
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];
const kinds: Record<string, number> = {}; let armedKiller = 0, bare = 0;
for (let i = 0; i < 150; i++) {
  const sim = new Simulator(initialRunState({ seed: `BARE${i}`, arenaId: arenaIds[i % arenaIds.length], config: DEFAULT_GAME_CONFIG }));
  let state = sim.getState(); let guard = 3000;
  const seen = new Set<string>();
  while (state.phase !== 'ended' && guard-- > 0) {
    if (state.phase === 'setup') sim.processTraining();
    else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
    else if (state.phase === 'interviews') sim.startGames();
    else if (state.phase === 'bloodbath') sim.processBloodbath();
    else if (state.phase === 'epilogue') state.phase = 'ended';
    else if (!sim.processTurn()) break;
    state = sim.getState();
    state.tributes.forEach(t => {
      if (t.status !== 'dead' || seen.has(t.id)) return; seen.add(t.id);
      if (deathCodeOf(t) !== 'tribute' || /\(([^)]+)\)\s*$/.test(t.causeOfDeath ?? '')) return;
      bare++;
      const k = (t.causeOfDeath ?? '').replace(/[A-Z][a-z]+/g, 'X').slice(0, 50);
      kinds[k] = (kinds[k] ?? 0) + 1;
      const killer = state.tributes.find(o => o.id === t.lastDamage?.sourceId);
      if (killer?.inventory.some(x => x.type === 'weapon')) armedKiller++;
    });
  }
}
console.log('bare', bare, 'killer armed now', armedKiller);
Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(v, k));
