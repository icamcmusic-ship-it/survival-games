/**
 * AUDIT-13 K6: a guard on the Career horn rate, and on the fear and retreat
 * numbers that produced it.
 *
 * The audit measured, across three harnesses, 20-27% of Careers dying in the
 * bloodbath, volunteers exactly as often as reaped Careers, 74% of surviving
 * Careers holding >= 30 fear of some outsider by day 2, and Careers retreating
 * from outsiders 2.2x as often as the reverse (847 vs 378 per 160 Games).
 * K1-K5 and T5-T8 repaired the causes; this is the sweep that says they stay
 * repaired.
 *
 * Career victor share is printed, not guarded here: `test:metrics` owns that
 * guard (and the district shares), and the horn fix is balanced mid-game.
 */
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameConfig, GameState, Tribute } from '../src/models/types';
import { victorsOf } from '../src/utils/notables';
import { ensureMemory } from '../src/engine/memory';
import { coverageCells, initialRunState } from './runInit';
import { DUEL_TEXTS } from '../src/data/flavorText';

// K4: only a one-sided break-off is logged [fleer, stayer]. A mutual break and
// a group scatter share the `retreat` type but name nobody as the one who ran,
// so they are told apart by the template that wrote them.
const escape = (x: string) => x.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
const oneSided = DUEL_TEXTS.retreat.map(tpl => new RegExp('^' + escape(tpl).replace(/\\?\{[a-z]+\\?\}/g, '.+') + '$'));

const RUNS = Number(process.env.AUDIT13_RUNS ?? 200);
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];
const configs: GameConfig[] = [
    DEFAULT_GAME_CONFIG,
    { ...DEFAULT_GAME_CONFIG, districtCount: 6 },
    { ...DEFAULT_GAME_CONFIG, districtCount: 12, hazardRate: 1.5 },
    { ...DEFAULT_GAME_CONFIG, districtCount: 8, betrayalRate: 1.5 },
];

let careers = 0, careerHorn = 0, volunteers = 0, volunteerHorn = 0;
let reaped = 0, reapedHorn = 0;
let fearSamples = 0, fearful = 0;
let careerFromOutsider = 0, outsiderFromCareer = 0, rawCareerFirst = 0, rawOutsiderFirst = 0;
let crowned = 0, careerCrowned = 0, careerOnCareer = 0;

const isCareer = (t: Tribute | undefined) => !!t?.isCareer;

const cells = coverageCells(arenaIds, configs.length, RUNS);
for (let i = 0; i < RUNS; i++) {
    const cell = cells[i];
    const sim = new Simulator(initialRunState({ seed: `${process.env.AUDIT13_SEED ?? "A13K"}${i}`, arenaId: cell.arenaId, config: configs[cell.configIndex] }));
    let state: GameState = sim.getState();
    let guard = 3000;
    let sampledFear = false;
    while (state.phase !== 'ended' && guard-- > 0) {
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') sim.processBloodbath();
        else if (state.phase === 'epilogue') { state.phase = 'ended'; }
        else if (!sim.processTurn()) break;
        state = sim.getState();
        // K3: the audit's day-2 snapshot — any surviving Career holding >= 30
        // fear of a living outsider.
        if (!sampledFear && state.day >= 2 && (state.phase === 'day' || state.phase === 'night')) {
            sampledFear = true;
            const byId = new Map(state.tributes.map(t => [t.id, t]));
            state.tributes.filter(t => t.isCareer && t.status === 'alive').forEach(c => {
                fearSamples++;
                const fear = ensureMemory(c).fear ?? {};
                if (Object.entries(fear).some(([id, v]) => v >= 30 && byId.get(id)?.status === 'alive' && !isCareer(byId.get(id)))) fearful++;
            });
        }
    }
    const byId = new Map(state.tributes.map(t => [t.id, t]));
    state.tributes.filter(t => t.isCareer).forEach(t => {
        careers++;
        const horn = t.diedInBloodbath === true;
        if (horn) careerHorn++;
        if (t.volunteered) { volunteers++; if (horn) volunteerHorn++; }
        else { reaped++; if (horn) reapedHorn++; }
        if (!horn && t.status === 'dead' && isCareer(byId.get(t.lastDamage?.sourceId ?? ''))) careerOnCareer++;
    });
    // K4: retreat lines are logged [fleer, stayer].
    state.log.filter(l => l.type === 'retreat' && l.tributesInvolved.length === 2 && oneSided.some(r => r.test(l.text))).forEach(l => {
        const fleer = byId.get(l.tributesInvolved[0]);
        const stayer = byId.get(l.tributesInvolved[1]);
        if (!fleer || !stayer) return;
        if (isCareer(fleer) && !isCareer(stayer)) careerFromOutsider++;
        if (!isCareer(fleer) && isCareer(stayer)) outsiderFromCareer++;
    });
    // The audit's own count: every `retreat` line, first-named against
    // second-named, mutual breaks and scatters included.
    state.log.filter(l => l.type === 'retreat' && l.tributesInvolved.length >= 2).forEach(l => {
        const a = byId.get(l.tributesInvolved[0]), b = byId.get(l.tributesInvolved[1]);
        if (isCareer(a) && b && !isCareer(b)) rawCareerFirst++;
        if (a && !isCareer(a) && isCareer(b)) rawOutsiderFirst++;
    });
    victorsOf(state).forEach(w => { crowned++; if (w.isCareer) careerCrowned++; });
}

const pct = (a: number, b: number) => (100 * a / Math.max(1, b)).toFixed(1) + '%';
console.log(`AUDIT-13 Careers over ${RUNS} runs`);
console.log(`  Career horn deaths      ${pct(careerHorn, careers)} (${careerHorn}/${careers})`);
console.log(`  volunteer horn deaths   ${pct(volunteerHorn, volunteers)} (${volunteerHorn}/${volunteers})`);
console.log(`  reaped-Career horn      ${pct(reapedHorn, reaped)} (${reapedHorn}/${reaped})`);
console.log(`  Careers >=30 fear of an outsider, day 2   ${pct(fearful, fearSamples)} (${fearful}/${fearSamples})`);
console.log(`  retreats Career->outsider ${careerFromOutsider}, outsider->Career ${outsiderFromCareer} (per 160 Games: ${(careerFromOutsider * 160 / RUNS).toFixed(0)} vs ${(outsiderFromCareer * 160 / RUNS).toFixed(0)})`);
console.log(`  all retreat lines, Career named first vs outsider first (audit's count, per 160): ${(rawCareerFirst * 160 / RUNS).toFixed(0)} vs ${(rawOutsiderFirst * 160 / RUNS).toFixed(0)}`);
console.log(`  Careers killed by Careers after the horn (info)  ${(careerOnCareer / RUNS).toFixed(2)} per Games`);
console.log(`  Career victors (info; guarded by test:metrics)  ${pct(careerCrowned, crowned)}`);

const failures: string[] = [];
const guard = (ok: boolean, text: string) => { if (!ok) failures.push(text); };
guard(volunteerHorn / Math.max(1, volunteers) <= 0.12, 'volunteer-Career horn death <= 12%');
guard(careerHorn / Math.max(1, careers) <= 0.15, 'all-Career horn death <= 15%');
// Baseline 74%: "cut sharply" is held at under a third.
guard(fearful / Math.max(1, fearSamples) <= 0.30, 'Careers holding >= 30 fear of an outsider on day 2 <= 30%');
// K4: the audit counted every `retreat` line (847 vs 378 per 160 Games; 684
// vs 342 on the AUDIT-13 base). The one-sided count is the honest one — who
// actually turned and ran from whom — and measured 0.7-0.8 Career-from-outsider
// per outsider-from-Career on that base. Held under half.
guard(careerFromOutsider <= 0.5 * outsiderFromCareer, 'Career->outsider one-sided retreats <= half of outsider->Career');
if (failures.length) {
    failures.forEach(f => console.error(`FAIL: ${f}`));
    process.exit(1);
}
console.log('PASS');
