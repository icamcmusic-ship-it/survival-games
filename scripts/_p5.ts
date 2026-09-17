import { generateTributes } from '../src/engine/generator';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
const personas: Record<string, number> = {}; const q: Record<string, number> = {};
const RUNS = 60;
for (let i = 0; i < RUNS; i++) {
    const seed = `iv-${i}`; const arena = ARENAS[i % ARENAS.length];
    const gp = gamesProfileFor(seed); const cfg = configForProfile(DEFAULT_GAME_CONFIG, gp);
    const sim = new Simulator({ seed, arena, tributes: generateTributes(seed, cfg, arena.zones[0].name, gp.castShape), phase: 'setup', day: 0, log: [], gamemakerMode: false, config: cfg, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: gp, logCounter: 0, feastsHeld: 0, cycle: 0 });
    let s = sim.getState(); let g = 40;
    while (s.phase !== 'bloodbath' && g-- > 0) { if (!sim.advance()) break; s = sim.getState(); }
    for (const t of s.tributes) if (t.interviewStrategy) personas[t.interviewStrategy] = (personas[t.interviewStrategy] ?? 0) + 1;
    for (const l of s.log) {
        if (/Caesar asks|Caesar wants to know|Caesar and .* talk for|says Caesar|Caesar has the Gamemakers|Caesar tries the|Caesar mentions the trade|Caesar reads out|Caesar puts it to them/.test(l.text)) q['caesar question'] = (q['caesar question'] ?? 0) + 1;
    }
}
const tot = Object.values(personas).reduce((a,b)=>a+b,0);
console.log('persona share:');
Object.entries(personas).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${k.padEnd(26)} ${(100*v/tot).toFixed(1)}%`));
console.log('\ncaesar questions per run:', ((q['caesar question'] ?? 0)/RUNS).toFixed(1));
