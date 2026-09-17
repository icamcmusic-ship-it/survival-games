import { generateTributes } from '../src/engine/generator';
import { generateArena } from '../src/engine/arenaGenerator';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameConfig, GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];
function run(seed: string, arenaId: string): GameState {
    const arena = arenaId.startsWith('procedural') ? generateArena(seed) : ARENAS.find(a => a.id === arenaId)!;
    const gp = gamesProfileFor(seed); const cfg = configForProfile(DEFAULT_GAME_CONFIG, gp);
    const sim = new Simulator({ seed, arena, tributes: generateTributes(seed, cfg, arena.zones[0].name, gp.castShape), phase: 'setup', day: 0, log: [], gamemakerMode: false, config: cfg, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: gp, logCounter: 0, feastsHeld: 0, cycle: 0 });
    let s = sim.getState(); let g = 4000;
    while (s.phase !== 'ended' && g-- > 0) { if (s.phase === 'epilogue') break; if (!sim.advance()) break; s = sim.getState(); }
    return s;
}
const perPhase: Record<string, number[]> = {};
const dupStamp: Record<string, number> = {}; let stampTotal = 0, stampDup = 0;
const deathDupes: string[] = [];
for (let i = 0; i < 25; i++) {
    const s = run(`t-${i}`, arenaIds[i % arenaIds.length]);
    const counts: Record<string, number> = {};
    for (const l of s.log) counts[`${l.day}:${l.phase}`] = (counts[`${l.day}:${l.phase}`] ?? 0) + 1;
    for (const [k, n] of Object.entries(counts)) { const ph = k.split(':')[1]; (perPhase[ph] ??= []).push(n); }
    // stamp collisions among consecutive lines
    const byPhase: Record<string, string[]> = {};
    for (const l of s.log) (byPhase[`${l.day}:${l.phase}`] ??= []).push(l.clock ?? '');
    for (const [k, stamps] of Object.entries(byPhase)) {
        const seen: Record<string, number> = {};
        for (const st of stamps) { seen[st] = (seen[st] ?? 0) + 1; stampTotal++; }
        for (const [st, n] of Object.entries(seen)) if (n > 1) { stampDup += n - 1; dupStamp[k.split(':')[1]] = (dupStamp[k.split(':')[1]] ?? 0) + (n - 1); }
    }
    // deaths: per dead tribute, how many death/kill category lines name them
    for (const t of s.tributes) {
        if (t.status !== 'dead') continue;
        const lines = s.log.filter(l => (l.category === 'death' || l.category === 'kill') && l.tributesInvolved.includes(t.id));
        if (lines.length > 1) deathDupes.push(`${t.name}: ` + lines.map(l => `[${l.category}] ${l.text.slice(0, 70)}`).join(' || '));
    }
}
console.log('lines per phase (mean/max):');
for (const [ph, arr] of Object.entries(perPhase).sort((a,b)=>Math.max(...b[1])-Math.max(...a[1])))
    console.log(`  ${ph.padEnd(12)} mean ${(arr.reduce((x,y)=>x+y,0)/arr.length).toFixed(0).padStart(4)}  max ${String(Math.max(...arr)).padStart(4)}`);
console.log(`\nduplicate timestamps: ${stampDup}/${stampTotal} (${(100*stampDup/stampTotal).toFixed(1)}%)`);
console.log('  by phase:', Object.entries(dupStamp).sort((a,b)=>b[1]-a[1]).map(e=>`${e[0]}=${e[1]}`).join(' '));
console.log(`\ntributes with >1 death/kill line: ${deathDupes.length} (over 25 runs)`);
deathDupes.slice(0, 8).forEach(d => console.log('  ' + d));
