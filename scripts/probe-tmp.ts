import { generateArena } from '../src/engine/arenaGenerator';
import { generateTributes } from '../src/engine/generator';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { gamesProfileFor } from '../src/engine/gamesProfile';

function start(seed: string): GameState {
  const arena = JSON.parse(JSON.stringify(ARENAS[0]));
  const config = { ...DEFAULT_GAME_CONFIG, enableFeast: true };
  return {
    seed, day: 0, phase: 'setup', arena, config,
    tributes: generateTributes(config, seed), log: [], sponsors: [],
    gamesProfile: gamesProfileFor(seed),
  } as unknown as GameState;
}
const counts: Record<string, number> = {};
for (let i = 0; i < 40; i++) {
  const sim = new Simulator(start(`PROBE${i}`));
  let g = 2000; let s = sim.getState();
  while (s.phase !== 'ended' && g-- > 0) {
    if (s.phase === 'setup') sim.processTraining();
    else if (s.phase === 'training') sim.processInterviews();
    else if (s.phase === 'interviews') sim.startGames();
    else sim.step();
    s = sim.getState();
  }
  s.tributes.forEach(t => {
    if (t.interviewAngle) counts[`angle:${t.interviewAngle}`] = (counts[`angle:${t.interviewAngle}`] ?? 0) + 1;
    if (t.privateSession) counts['privateSession'] = (counts['privateSession'] ?? 0) + 1;
    if (t.concealRevealed) counts['concealRevealed'] = (counts['concealRevealed'] ?? 0) + 1;
    if (t.feastPrizeTaken) counts['feastPrizeTaken'] = (counts['feastPrizeTaken'] ?? 0) + 1;
    if ((t.personaBacklash ?? 0) > 0) counts['backlashPending'] = (counts['backlashPending'] ?? 0) + 1;
    (t.trainingPacts ?? []).forEach(p => counts[`pact:${p.kind}`] = (counts[`pact:${p.kind}`] ?? 0) + 1);
    (t.trainingLog ?? []).forEach((e: any) => { if (e.witnessIds) counts['logWitnesses'] = (counts['logWitnesses'] ?? 0) + 1; });
  });
  s.log.forEach(e => {
    if (e.text.includes('sold the country') || e.text.includes('stopped being a mystery') || e.text.includes('great love story') || e.text.includes('bookmaker moves')) counts['backlashLine'] = (counts['backlashLine'] ?? 0) + 1;
    if (e.text.includes('Caesar opens by mentioning') || e.text.includes('said your name') || e.text.includes('You will have heard')) counts['caesarCallback'] = (counts['caesarCallback'] ?? 0) + 1;
    if (e.text.includes('reach the Cornucopia first')) counts['earlyArrival'] = (counts['earlyArrival'] ?? 0) + 1;
    if (e.text.includes('It is not theirs')) counts['packStolen'] = (counts['packStolen'] ?? 0) + 1;
    if (e.text.includes('Behind the doors')) counts['sessionLine'] = (counts['sessionLine'] ?? 0) + 1;
    if (e.text.includes('{')) counts['UNFILLED:' + e.text.slice(0, 60)] = 1;
  });
}
console.log(counts);
