import { generateTributes } from '../src/engine/generator';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
const PAT: Record<string, RegExp> = {
  'pedestal: arena shot': /The plates rise into|come up out of the dark|cameras pull back over|Light, and then the arena|rising plate and a rising note|countdown starts over|catches what light|hovercraft holds overhead|clock over .* starts at sixty|reads as two things|plates lock|Sixty seconds\./,
  'pedestal: reaction': /finds the weapon they want|runner's crouch|counts the distance|does not look at .* once|back half-turned|shaking on the plate|closes their eyes for most|spends the minute on the arena|counts the plates|hold the look long enough/,
  'pedestal: early step-off': /steps off the plate with|before the gong|loses their footing on the plate|breaks early|goes a half-second before|count is at four|mistakes the anthem cue/,
  'gong: horn': /straight for the mouth of|shortest line to|off the plate before the sound|commits to .* completely|rehearsed the distance/,
  'gong: edge': /nearest pack from the outer ring|take what is lying at the edge|sweeps up whatever is closest|grabs one thing from the scatter|plays the edge of/,
  'gong: flee': /turns from .* at the gong|moving away from the first second|leaves the ring empty-handed|runs from .* without looking back|shortest route out of the ring/,
  'gong: ally': /runs to .* rather than to|cuts across the ring to reach|find each other in the first ten|goes for .* first/,
  'gong: hunt': /goes straight at|goes to where .* is going to be|close the distance|picks .* out of twenty-three/,
  'gong: freeze': /does not move\. The gong|three seconds to start|comes off the plate and then stops|turning on the spot/,
  'gong: wait': /backs off the plate and stops|drops flat, and lets the first thirty|finds cover at the edge of the ring|gets out of the open and watch/,
  'career pack converge': /converge on the horn and close ranks/,
  'career pack collapse': /scatter before the bloodbath is finished/,
  'career opt-out': /goes the other way from the rest of the Careers/,
  'OLD gamemaker briefing': /GAMEMAKER LOG — ARENA BRIEF/,
  'OLD pack agreement on plates': /close ranks into a single pack/,
};
const hits: Record<string, number> = {}; const runsWith: Record<string, number> = {};
const RUNS = 60; let stepOffDeaths = 0;
for (let i = 0; i < RUNS; i++) {
    const seed = `bb-${i}`; const arena = ARENAS[i % ARENAS.length];
    const gp = gamesProfileFor(seed); const cfg = configForProfile(DEFAULT_GAME_CONFIG, gp);
    const sim = new Simulator({ seed, arena, tributes: generateTributes(seed, cfg, arena.zones[0].name, gp.castShape), phase: 'setup', day: 0, log: [], gamemakerMode: false, config: cfg, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: gp, logCounter: 0, feastsHeld: 0, cycle: 0 });
    let s = sim.getState(); let g = 60;
    while (s.phase !== 'day' && g-- > 0) { if (!sim.advance()) break; s = sim.getState(); }
    const bb = s.log.filter(l => l.phase === 'bloodbath');
    for (const [k, re] of Object.entries(PAT)) {
        const n = bb.filter(l => re.test(l.text)).length;
        hits[k] = (hits[k] ?? 0) + n; if (n > 0) runsWith[k] = (runsWith[k] ?? 0) + 1;
    }
    stepOffDeaths += s.tributes.filter(t => t.causeOfDeath === 'Stepped off the plate before the gong').length;
}
console.log('beat'.padEnd(28), 'per run'.padStart(8), 'runs'.padStart(7));
for (const [k, n] of Object.entries(hits)) console.log(k.padEnd(28), (n / RUNS).toFixed(2).padStart(8), `${Math.round(100*(runsWith[k]??0)/RUNS)}%`.padStart(7));
console.log(`\nearly step-off deaths: ${stepOffDeaths} across ${RUNS} runs (${(100*stepOffDeaths/(RUNS*24)).toFixed(2)}% of tributes)`);
