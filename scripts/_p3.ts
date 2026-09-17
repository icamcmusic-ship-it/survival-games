import { generateTributes } from '../src/engine/generator';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
const hist: Record<number, number> = {}; let n = 0, sum = 0; const tens: number[] = [];
for (let i = 0; i < 120; i++) {
    const seed = `s-${i}`; const arena = ARENAS[i % ARENAS.length];
    const gp = gamesProfileFor(seed); const cfg = configForProfile(DEFAULT_GAME_CONFIG, gp);
    const sim = new Simulator({ seed, arena, tributes: generateTributes(seed, cfg, arena.zones[0].name, gp.castShape), phase: 'setup', day: 0, log: [], gamemakerMode: false, config: cfg, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: gp, logCounter: 0, feastsHeld: 0, cycle: 0 });
    // advance only through the pre-Games
    let s = sim.getState(); let g = 40;
    while (s.phase !== 'interviews' && g-- > 0) { if (!sim.advance()) break; s = sim.getState(); }
    let big = 0;
    for (const t of s.tributes) { hist[t.trainingScore] = (hist[t.trainingScore] ?? 0) + 1; n++; sum += t.trainingScore; if (t.trainingScore >= 10) big++; }
    tens.push(big);
}
const mean = sum / n;
const sd = Math.sqrt(Object.entries(hist).reduce((acc, [v, c]) => acc + c * (Number(v) - mean) ** 2, 0) / n);
console.log(`n=${n} mean=${mean.toFixed(2)} sd=${sd.toFixed(2)}`);
console.log('histogram:', Object.entries(hist).sort((a, b) => Number(a[0]) - Number(b[0])).map(([v, c]) => `${v}:${c}`).join(' '));
console.log(`scores >=10 per game: mean ${(tens.reduce((a,b)=>a+b,0)/tens.length).toFixed(2)}, max ${Math.max(...tens)}, games with 0: ${tens.filter(x=>x===0).length}/${tens.length}`);
console.log(`scores >=9 share: ${(100*Object.entries(hist).filter(([v])=>Number(v)>=9).reduce((a,[,c])=>a+c,0)/n).toFixed(1)}%`);
