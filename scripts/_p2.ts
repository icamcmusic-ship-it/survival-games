import { generateTributes } from '../src/engine/generator';
import { generateArena } from '../src/engine/arenaGenerator';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];
let solo = 0, doubles = 0; const samples: string[] = [];
for (let i = 0; i < 40; i++) {
    const seed = `d-${i}`; const arenaId = arenaIds[i % arenaIds.length];
    const arena = arenaId.startsWith('procedural') ? generateArena(seed) : ARENAS.find(a => a.id === arenaId)!;
    const gp = gamesProfileFor(seed); const cfg = configForProfile(DEFAULT_GAME_CONFIG, gp);
    const sim = new Simulator({ seed, arena, tributes: generateTributes(seed, cfg, arena.zones[0].name, gp.castShape), phase: 'setup', day: 0, log: [], gamemakerMode: false, config: cfg, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: gp, logCounter: 0, feastsHeld: 0, cycle: 0 });
    let s = sim.getState(); let g = 4000;
    let deadBefore = new Set(s.tributes.filter(t => t.status === 'dead').map(t => t.id));
    let logLen = s.log.length;
    while (s.phase !== 'ended' && g-- > 0) {
        if (s.phase === 'epilogue') break;
        if (!sim.advance()) break;
        s = sim.getState();
        const deadNow = s.tributes.filter(t => t.status === 'dead');
        const fresh = deadNow.filter(t => !deadBefore.has(t.id));
        const added = s.log.slice(logLen);
        if (fresh.length === 1) {
            const victim = fresh[0];
            const red = added.filter(l => (l.category === 'death' || l.category === 'kill')
                && !l.text.startsWith('The anthem plays')
                && l.tributesInvolved.includes(victim.id));
            if (red.length === 1) solo++;
            else if (red.length > 1) {
                doubles++;
                if (samples.length < 8) samples.push(`${victim.name} (${victim.causeOfDeath}):\n      ` + red.map(l => `[${l.category}] ${l.text.slice(0, 100)}`).join('\n      '));
            }
        }
        deadBefore = new Set(deadNow.map(t => t.id));
        logLen = s.log.length;
    }
}
console.log(`single-death steps: ${solo + doubles}; exactly one red line: ${solo}; more than one: ${doubles} (${(100*doubles/(solo+doubles)).toFixed(1)}%)`);
samples.forEach(x => console.log('  ' + x));

// Aggregate: red non-anthem lines against actual deaths, across whole runs.
let redTotal = 0, deathTotal = 0;
for (let i = 0; i < 30; i++) {
    const seed = `agg-${i}`; const arenaId = arenaIds[i % arenaIds.length];
    const arena = arenaId.startsWith('procedural') ? generateArena(seed) : ARENAS.find(a => a.id === arenaId)!;
    const gp = gamesProfileFor(seed); const cfg = configForProfile(DEFAULT_GAME_CONFIG, gp);
    const sim = new Simulator({ seed, arena, tributes: generateTributes(seed, cfg, arena.zones[0].name, gp.castShape), phase: 'setup', day: 0, log: [], gamemakerMode: false, config: cfg, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: gp, logCounter: 0, feastsHeld: 0, cycle: 0 });
    let s = sim.getState(); let g = 4000;
    while (s.phase !== 'ended' && g-- > 0) { if (s.phase === 'epilogue') break; if (!sim.advance()) break; s = sim.getState(); }
    redTotal += s.log.filter(l => (l.category === 'death' || l.category === 'kill') && !l.text.startsWith('The anthem plays')).length;
    deathTotal += s.tributes.filter(t => t.status === 'dead').length;
}
console.log(`\nred non-anthem lines ${redTotal} vs deaths ${deathTotal} = ${(redTotal/deathTotal).toFixed(2)} per death`);
