import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { initialRunState } from './runInit';
import { AUDIT12_WAVE2_ARENA } from '../src/data/balance';

/**
 * AUDIT-12 §8.1-8.3: the per-arena death mix.
 *
 * For every hand-authored arena, over a fixed seed set:
 *   - tribute-kill share of all deaths sits in the band (50-72 %);
 *   - the arena's own causes (`lastDamage.signature`) are at least 8 % of the
 *     deaths that were not another tribute;
 *   - the closing border kills no more than its cap per Games on average.
 *
 * `RUNS` (env) sets seeds per arena; `ARENA` narrows to one id.
 */
const RUNS = Number(process.env.RUNS ?? 24);
const only = process.env.ARENA;
const K = AUDIT12_WAVE2_ARENA;
const failures: string[] = [];
const rows: string[] = [];

for (const arena of ARENAS) {
    if (only && arena.id !== only) continue;
    let deaths = 0, tribute = 0, nonTribute = 0, signature = 0, border = 0;
    for (let i = 0; i < RUNS; i++) {
        const sim = new Simulator(initialRunState({ seed: `MIX${i}-${arena.id}`, arenaId: arena.id, config: DEFAULT_GAME_CONFIG }));
        let g = 3000; let s = sim.getState();
        while (s.phase !== 'ended' && g-- > 0) {
            if (s.phase === 'setup') sim.processTraining();
            else if (s.phase === 'training' || s.phase === 'scores') sim.processInterviews();
            else if (s.phase === 'interviews') sim.startGames();
            else if (s.phase === 'bloodbath') sim.processBloodbath();
            else if (s.phase === 'epilogue') s.phase = 'ended';
            else if (!sim.processTurn()) break;
            s = sim.getState();
        }
        for (const t of s.tributes) {
            if (t.status !== 'dead') continue;
            deaths++;
            if (t.causeCode === 'tribute') { tribute++; continue; }
            nonTribute++;
            if (t.causeCode === 'border') border++;
            if (t.lastDamage?.signature) signature++;
        }
    }
    const share = tribute / Math.max(1, deaths);
    const sig = signature / Math.max(1, nonTribute);
    const borderPer = border / RUNS;
    rows.push(`${arena.id.padEnd(16)} tribute ${(share * 100).toFixed(0).padStart(3)}%  own ${(sig * 100).toFixed(0).padStart(3)}%  border/run ${borderPer.toFixed(2)}`);
    if (share < K.tributeShareMin || share > K.tributeShareMax) failures.push(`${arena.id}: tribute-kill share ${(share * 100).toFixed(1)}% outside ${K.tributeShareMin * 100}-${K.tributeShareMax * 100}%`);
    if (sig < K.signatureShareMin) failures.push(`${arena.id}: own-cause share ${(sig * 100).toFixed(1)}% of non-tribute deaths < ${K.signatureShareMin * 100}%`);
    if (borderPer > K.borderKillCap + 0.5) failures.push(`${arena.id}: ${borderPer.toFixed(2)} border deaths per Games > cap ${K.borderKillCap}`);
}
console.log(rows.join('\n'));
if (process.env.REPORT_ONLY) process.exit(0);
if (failures.length) { console.error(`\n${failures.length} death-mix failure(s):\n` + failures.join('\n')); process.exit(1); }
console.log(`\ndeath mix ok across ${rows.length} arenas x ${RUNS} runs`);
