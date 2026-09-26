/**
 * AUDIT-12 §3.2 / §5 / §6 guards (tributes, alliances, side systems).
 *
 * A seeded sweep plus a handful of static assertions. Run with
 * `npm run test:audit12` (AUDIT12_RUNS overrides the sweep size).
 */
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState, Tribute } from '../src/models/types';
import { initialRunState } from './runInit';
import { deathCodeOf } from '../src/engine/causes';
import { isActive } from '../src/engine/downed';
import { TRAIT_DEFS } from '../src/data/traits';
import { victorsOf } from '../src/utils/notables';

const RUNS = Number(process.env.AUDIT12_RUNS ?? 150);
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];

let failures = 0;
function guard(ok: boolean, label: string, detail: string) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(48)} ${detail}`);
    if (!ok) failures++;
}

const decisionN: Record<string, number> = {};
const decisionDied: Record<string, number> = {};
let deaths = 0, starved = 0, hornRuns = 0, hornDeaths = 0;
let roleSamples = 0, staleRoleSamples = 0, staleLeaderSamples = 0;
let shadowSamples = 0, staleShadow = 0;
let victors = 0, bloodiedVictors = 0, unbrokenVictors = 0;
const archN: Record<string, number> = {};
const NEW_TYPES: string[] = ['night-theft', 'hollow-victory', 'shared-camp', 'alliance-splinter'];
const beat: Record<string, number> = {};
const archW: Record<string, number> = {};

function sampleRoles(state: GameState) {
    const byId = new Map(state.tributes.map(t => [t.id, t] as const));
    Object.values(state.alliances ?? {}).forEach(a => {
        const member = (t: Tribute | undefined) => !!t && t.status === 'alive' && t.allianceId === a.id;
        const living = state.tributes.filter(t => member(t));
        if (living.length < 2) return;
        roleSamples++;
        if (!member(byId.get(a.leaderId))) { staleLeaderSamples++; if (process.env.A12_DEBUG) { const l = byId.get(a.leaderId); console.log('stale leader', a.id, state.phase, state.day, l?.status, l?.allianceId, living.length); } }
        const stale = Object.values(a.roles ?? {}).some(id => !!id && !member(byId.get(id)));
        if (stale) { staleRoleSamples++; if (process.env.A12_DEBUG) console.log('stale role', a.id, state.phase, JSON.stringify(a.roles), living.map(t => t.id).join(',')); }
    });
    state.tributes.forEach(t => {
        if (t.status !== 'alive' || !isActive(t)) return;
        shadowSamples++;
        if (t.shadowing && t.stance !== 'Shadowing') staleShadow++;
    });
}

for (let i = 0; i < RUNS; i++) {
    const seed = `A12-${i}`;
    const arenaId = arenaIds[i % arenaIds.length];
    const config = i % 3 === 0 ? { ...DEFAULT_GAME_CONFIG, districtCount: 8 } : DEFAULT_GAME_CONFIG;
    const sim = new Simulator(initialRunState({ seed, arenaId, config }));
    let state = sim.getState();
    let steps = 3000;
    while (state.phase !== 'ended' && steps-- > 0) {
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') {
            sim.processBloodbath();
            if (sim.getState().tributes.length >= 24) {
                hornRuns++;
                hornDeaths += sim.getState().tributes.filter(t => t.status === 'dead').length;
            }
            sim.getState().tributes.forEach(t => {
                const d = t.gongDecision;
                if (!d) return;
                decisionN[d] = (decisionN[d] ?? 0) + 1;
                if (t.status === 'dead') decisionDied[d] = (decisionDied[d] ?? 0) + 1;
            });
        }
        else if (state.phase === 'epilogue') { state.phase = 'ended'; }
        else if (!sim.processTurn()) break;
        state = sim.getState();
        if (state.phase === 'day' || state.phase === 'night') sampleRoles(state);
    }
    state.log.forEach(l => { if (l.type && NEW_TYPES.includes(l.type)) beat[l.type] = (beat[l.type] ?? 0) + 1; });
    state.tributes.forEach(t => {
        archN[t.archetype] = (archN[t.archetype] ?? 0) + 1;
        if (t.status !== 'dead') return;
        deaths++;
        if (deathCodeOf(t) === 'starvation') starved++;
    });
    victorsOf(state).forEach(w => {
        victors++;
        archW[w.archetype] = (archW[w.archetype] ?? 0) + 1;
        if (w.traits.includes('Bloodied')) bloodiedVictors++;
        if (w.traits.includes('Unbroken')) unbrokenVictors++;
    });
}

const rate = (d: string) => (decisionDied[d] ?? 0) / Math.max(1, decisionN[d] ?? 0);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

console.log(`AUDIT-12 sweep: ${RUNS} runs, ${deaths} deaths, ${victors} victors`);
console.log(`bloodbath deaths per full-field Games: ${(hornDeaths / Math.max(1, hornRuns)).toFixed(2)}`);
console.log('horn deaths by gong decision:');
Object.keys(decisionN).sort().forEach(d => console.log(`  ${d.padEnd(8)} n=${String(decisionN[d]).padStart(5)}  died ${pct(rate(d))}`));
const arch = Object.keys(archN).filter(a => archN[a] >= 40).map(a => ({ a, w: (archW[a] ?? 0) / archN[a] }));
arch.sort((x, y) => y.w - x.w);
if (arch.length) console.log(`archetype win spread: best ${arch[0].a} ${pct(arch[0].w)} / worst ${arch[arch.length - 1].a} ${pct(arch[arch.length - 1].w)}`);
console.log(`new beats: ${NEW_TYPES.map(k => `${k} ${beat[k] ?? 0}`).join(', ')}`);
console.log('guards:');
NEW_TYPES.forEach(k => guard((beat[k] ?? 0) > 0, `§6 beat '${k}' fires`, String(beat[k] ?? 0)));
guard(rate('flee') <= rate('edge') + 0.02, 'T1 flee death rate <= edge rate', `${pct(rate('flee'))} vs ${pct(rate('edge'))}`);
guard(rate('flee') <= 0.4, 'T1 flee death rate <= 40%', pct(rate('flee')));
guard(hornDeaths / Math.max(1, hornRuns) >= 7, 'T1 bloodbath still takes >= 7 of 24', (hornDeaths / Math.max(1, hornRuns)).toFixed(2));
guard(staleLeaderSamples / Math.max(1, roleSamples) <= 0.002, 'E16 leaders living', `${staleLeaderSamples}/${roleSamples}`);
guard(staleRoleSamples / Math.max(1, roleSamples) <= 0.002, 'E4 role holders living members', `${staleRoleSamples}/${roleSamples}`);
guard(staleShadow === 0, 'T2 no shadowing record off the Shadowing stance', `${staleShadow}/${shadowSamples}`);
guard(starved / Math.max(1, deaths) >= 0.005 && starved / Math.max(1, deaths) <= 0.04, 'A12 starvation share 0.5%-4%', pct(starved / Math.max(1, deaths)));
guard(bloodiedVictors / Math.max(1, victors) <= 0.8, 'earned Bloodied not universal (<=80% victors)', pct(bloodiedVictors / Math.max(1, victors)));
guard(unbrokenVictors / Math.max(1, victors) <= 0.75, 'earned Unbroken not universal (<=75% victors)', pct(unbrokenVictors / Math.max(1, victors)));

// Static checks.
const fleet = TRAIT_DEFS['Fleet'];
guard(!!fleet && (fleet.mods?.retreat ?? 0) > 0, 'T7 Fleet retreat is positive', String(fleet?.mods?.retreat));
const names = Object.keys(TRAIT_DEFS).map(t => t.toLowerCase().replace(/[^a-z]/g, ''));
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
guard(dupes.length === 0, 'T16 no folded trait-name collisions', dupes.join(', ') || 'none');

console.log(failures === 0 ? 'AUDIT-12 checks passed.' : `${failures} AUDIT-12 check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
