import { generateTributes } from './src/engine/generator';
import { Simulator } from './src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from './src/data/constants';
import { gamesProfileFor } from './src/engine/gamesProfile';
import { QUELLS } from './src/data/gamesProfile';
import { GameState } from './src/models/types';

const quell = QUELLS.find(q => q.id === 'feast-quell');
console.log('quell found:', !!quell, quell?.id);

for (const seed of ['A1', 'B2', 'C3', 'D4']) {
  const base0 = gamesProfileFor(seed, true);
  const gamesProfile = { ...base0, quell,
    calendar: [{ kind: 'quell-feast-nightly' as const, name: quell!.name, announcement: quell!.announcement, day: 0 }],
    wildcard: { kind: 'quell-feast-nightly' as const, name: quell!.name, announcement: quell!.announcement, day: 0 } };
  const base = ARENAS.find(a => a.id === 'clockwork')!;
  const arena = { ...base, zones: base.zones.map(z => ({ ...z })) };
  const config = { ...DEFAULT_GAME_CONFIG, enableFeast: true };
  const tributes = generateTributes(seed, config, arena.zones[0].name, gamesProfile.castShape, quell);
  const st: GameState = { seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: false,
    config, baseConfig: config, gamesProfile, logCounter: 0, feastsHeld: 0, cycle: 0 } as GameState;
  const sim = new Simulator(st);
  const live = sim.getState();
  const counts: Record<string, number> = {};
  let guard = 3000;
  while (live.phase !== 'ended' && guard-- > 0) {
    counts[live.phase] = (counts[live.phase] || 0) + 1;
    if (live.phase === 'setup') sim.processTraining();
    else if (live.phase === 'training') sim.processInterviews();
    else if (live.phase === 'interviews') sim.startGames();
    else if (live.phase === 'bloodbath') sim.processBloodbath();
    else if (live.phase === 'epilogue') live.phase = 'ended';
    else sim.processTurn();
  }
  const victor = live.tributes.find(t => t.status === 'alive');
  console.log(seed, 'nightly=', live.log.filter(l=>l.text.includes('feast every night')).length, JSON.stringify(counts), 'finalDay=', live.day,
    'victorDays=', victor?.daysSurvived, 'guardLeft=', guard);
}
