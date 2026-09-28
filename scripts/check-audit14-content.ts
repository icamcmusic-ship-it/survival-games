/**
 * AUDIT-14 §7: the new traits, skills, archetypes, quirks, stances and
 * personas each have to *do* something in a real run, and the §7 balance
 * changes that are code (A28 small-field horn, A34 isolate, A35 side bet,
 * A38 skill inflation) have to be live.
 *
 * A seeded sweep plus direct asserts on the hooks a sweep reaches too rarely
 * to count on. Run with `npm run test:audit14-content`
 * (AUDIT14_CONTENT_RUNS overrides the sweep size).
 */
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState, InterviewPersona, Proficiency, Tribute } from '../src/models/types';
import { initialRunState } from './runInit';
import { TRAIT_DEFS } from '../src/data/traits';
import { QUIRKS, QUIRK_MODS } from '../src/data/quirks';
import { ARCHETYPES } from '../src/data/archetypes';
import { STANCE_PROFILES } from '../src/data/stances';
import { INTERVIEW_SCENARIOS } from '../src/data/flavorText';
import { PERSONA_FAMILY, PERSONA_THREAT } from '../src/data/personas';
import { AUDIT14_CONTENT as C } from '../src/data/balance';
import {
    audit14DamageScale, audit14PowerHooks, audit14RetreatShift, buryOverflow, feverProofScale, forcedHornPlan,
    oracleCredibility, smallFieldHornShift, softStepNoise,
} from '../src/engine/audit14Content';
import { SIGNATURES } from '../src/engine/archetypeHooks';
import { SimContext } from '../src/engine/context';

const RUNS = Number(process.env.AUDIT14_CONTENT_RUNS ?? 160);
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];

let failures = 0;
function guard(ok: boolean, label: string, detail: string) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${detail}`);
    if (!ok) failures++;
}

const NEW_TRAITS = ['Horn-Shy', 'Sore Loser', 'Pack Mule', 'Quick Study', 'Gallows Humor', 'Magpie', 'Fever-Proof',
    'Rearguard', 'Cold Feet', 'Late Bloomer', 'Blood-Shy', 'Soft Step', 'Iron Lungs', 'Sharp Elbows', 'Hand-Me-Down', 'Short Fuse'];
const NEW_SKILLS: Proficiency[] = ['poisoncraft', 'feinting', 'disarming', 'shelterwright', 'triage', 'bracing', 'scentcraft', 'caching'];
const NEW_ARCHETYPES = ['cutpurse', 'undertaker', 'poacher', 'tinker', 'smuggler', 'nightwarden'] as const;
const NEW_QUIRKS = ['counts arrows before sleeping', 'never takes the path they came by', 'sleeps under their pack',
    'talks to the mutts', 'eats the bitter leaves first', 'hides a blade in their boot', 'marks every body they pass',
    'keeps one sip for later'];
const NEW_STANCES = ['Rallying', 'BloodTrailing', 'Retreating'] as const;
const NEW_PERSONAS: InterviewPersona[] = ['The Outsider', 'The Showboat', 'The Scrapper', 'The Oracle'];
const SIGNATURE_EVENTS = ['cutpurse-lift', 'last-rites', 'snare-hunt', 'jury-rig', 'run-goods', 'hold-the-line'];

// ---- static -----------------------------------------------------------------
console.log('static');
guard(NEW_TRAITS.every(n => !!TRAIT_DEFS[n] && !TRAIT_DEFS[n].earned), 'T1-T16 traits are rollable rows', `${NEW_TRAITS.length}`);
guard(NEW_QUIRKS.every(q => QUIRKS.some(x => x.label === q) && q in QUIRK_MODS), 'Q1-Q8 quirks have lines and a mods row', `${NEW_QUIRKS.length}`);
guard(NEW_ARCHETYPES.every(a => !!ARCHETYPES[a]?.signature && !!SIGNATURES[ARCHETYPES[a].signature!]),
    'R1-R6 archetypes carry a registered signature', `${NEW_ARCHETYPES.length}`);
guard(NEW_STANCES.every(s => STANCE_PROFILES[s]?.conditional), 'S1-S3 stances are conditional rows', `${NEW_STANCES.length}`);
guard(NEW_PERSONAS.every(p => INTERVIEW_SCENARIOS.some(s => s.strategy === p) && p in PERSONA_THREAT && p in PERSONA_FAMILY),
    'P1-P4 personas have scenarios, threat and family', `${NEW_PERSONAS.length}`);
// The collisions the audit named are resolved by the names used.
guard(!('sentinel' in ARCHETYPES) && !('Pursuing' in STANCE_PROFILES), 'naming collisions resolved (Nightwarden, Blood-Trailing)',
    `${STANCE_PROFILES.BloodTrailing.label}, ${ARCHETYPES.nightwarden.name}`);
guard(ARCHETYPES.confessor.stanceBias?.Desperate === 0.3 && ARCHETYPES.confessor.stanceBias?.Parleying === 0.3,
    'A32 confessor Desperate 0.3 / Parleying 0.3', '');
guard(ARCHETYPES.duellist.targetDraw === 1.5 && ARCHETYPES.showrunner.hornFight === -0.15 && ARCHETYPES.mourner.hornFight === -0.1,
    'A33 / signature table: duellist, showrunner, mourner', '');
guard((ARCHETYPES.hermit.objectiveBias?.isolate ?? 0) > 0, 'A34 hermit carries the isolate objective', '');

// ---- direct hooks -----------------------------------------------------------
console.log('\nhooks');
{
    const state = initialRunState({ seed: 'A14C-hooks', arenaId: arenaIds[0], config: DEFAULT_GAME_CONFIG });
    const ctx = { state, rng: { chance: () => true, nextFloat: () => 0 } } as unknown as SimContext;
    const [a, b, c] = state.tributes;
    const withTrait = (t: Tribute, trait: string) => ({ ...t, traits: [...t.traits, trait] }) as Tribute;

    // A28: six districts, half the cast Careers, and a non-Career scatters.
    const small = state.tributes.slice(0, 12).map((t, i) => ({ ...t, isCareer: i < 6 }) as Tribute);
    const outsider = small.find(t => !t.isCareer)!;
    guard(smallFieldHornShift(small, outsider) < 0 && smallFieldHornShift(state.tributes.map(t => ({ ...t, isCareer: false }) as Tribute), outsider) === 0,
        'A28 small-field horn shift bites only in a Career-heavy field', smallFieldHornShift(small, outsider).toFixed(2));
    guard(forcedHornPlan(withTrait(a, 'Horn-Shy')) === 'scatter' && forcedHornPlan(a) === undefined, 'T1 Horn-Shy works the edge', '');
    const sore = withTrait(a, 'Sore Loser');
    sore.lastDamage = { cycle: 0, amount: 5, cause: 'x', kind: 'tribute', sourceId: b.id };
    guard(audit14PowerHooks(ctx, sore, b) > audit14PowerHooks(ctx, sore, c), 'T2 Sore Loser against whoever last hurt them', '');
    guard(feverProofScale(withTrait(a, 'Fever-Proof')) < 1, 'T7 Fever-Proof scales infection', `${feverProofScale(withTrait(a, 'Fever-Proof'))}`);
    guard(softStepNoise(withTrait(a, 'Soft Step')) < 1, 'T12 Soft Step quiets a crossing', '');
    guard(audit14DamageScale(ctx, withTrait(a, 'Iron Lungs'), 'arena', 'hazard') < 1
        && audit14DamageScale(ctx, withTrait(a, 'Iron Lungs'), 'arena', 'burns') === 1, 'T13 Iron Lungs: hazards, not burns', '');
    state.day = 1;
    (state as GameState).phase = 'bloodbath';
    guard(audit14PowerHooks(ctx, withTrait(a, 'Sharp Elbows'), b) > audit14PowerHooks(ctx, a, b), 'T14 Sharp Elbows at the horn', '');
    guard(audit14PowerHooks(ctx, withTrait(a, 'Late Bloomer'), b) < audit14PowerHooks(ctx, a, b), 'T10 Late Bloomer weak on day one', '');
    guard(audit14RetreatShift({ ...a, stance: 'Retreating' } as Tribute) > 0, 'S3 Retreating breaks off sooner', '');
    guard(oracleCredibility({ ...a, interviewStrategy: 'The Oracle' } as Tribute) > 0
        && oracleCredibility({ ...a, interviewStrategy: 'The Oracle', oracleTold: C.oracleRumours } as Tribute) === 0,
    'P4 the Oracle: first rumours only', '');
    const cacher = { ...a, zone: 'here', proficiencies: { caching: 2 }, inventory: [] } as unknown as Tribute;
    const food = { id: 'bread', name: 'Bread', type: 'food', value: 3 } as const;
    const left = buryOverflow(cacher, [{ ...food }]);
    guard(left.length === 0 && cacher.cache?.items.length === 1, 'K8 caching buries the overflow', `${cacher.cache?.items.length ?? 0} buried`);
}

// ---- sweep ------------------------------------------------------------------
const stanceCycles: Record<string, number> = {};
const events: Record<string, number> = {};
const personas: Record<string, number> = {};
const objectives: Record<string, number> = {};
const seenLog = new Set<string>();
let entrants = 0, sideBets = 0, noticed = 0, bootBlades = 0, sips = 0, caches = 0;
const gained: Record<string, number> = {};
const peak: Record<string, number> = {};
const traitHolders: Record<string, number> = {};

for (let i = 0; i < RUNS; i++) {
    const arenaId = arenaIds[i % arenaIds.length];
    const config = i % 3 === 0 ? { ...DEFAULT_GAME_CONFIG, districtCount: 8 } : DEFAULT_GAME_CONFIG;
    const sim = new Simulator(initialRunState({ seed: `A14C-${i}`, arenaId, config }));
    const startLevel = new Map(sim.getState().tributes.map(t => [t.id, { ...(t.proficiencies ?? {}) }]));
    sim.observe((s: GameState) => {
        s.log.forEach(e => {
            const key = `${i}-${e.id}`;
            if (!e.type || seenLog.has(key)) return;
            seenLog.add(key);
            if (SIGNATURE_EVENTS.includes(e.type)) events[e.type] = (events[e.type] ?? 0) + 1;
            if (e.type === 'gambler-side-bet') sideBets++;
            if (e.type === 'betrayal-noticed') noticed++;
        });
        s.tributes.forEach(t => {
            if (t.status !== 'alive') return;
            stanceCycles[t.stance] = (stanceCycles[t.stance] ?? 0) + 1;
            if (t.objective) objectives[t.objective.kind] = (objectives[t.objective.kind] ?? 0) + 1;
            if (t.cache) caches++;
        });
    });
    let steps = 0;
    while (!sim.isFinished() && steps++ < 400) sim.advance();
    const end = sim.getState();
    end.tributes.forEach(t => {
        entrants++;
        if (t.interviewStrategy) personas[t.interviewStrategy] = (personas[t.interviewStrategy] ?? 0) + 1;
        if (t.bootBladeUsed) bootBlades++;
        if (t.sipDrunk) sips++;
        t.traits.forEach(tr => { if (NEW_TRAITS.includes(tr)) traitHolders[tr] = (traitHolders[tr] ?? 0) + 1; });
        NEW_SKILLS.forEach(k => { peak[k] = Math.max(peak[k] ?? 0, t.proficiencies?.[k] ?? 0); });
        [...NEW_SKILLS, 'weathercraft', 'teaching'].forEach(k => {
            const before = startLevel.get(t.id)?.[k as Proficiency] ?? 0;
            if (before < 1 && (t.proficiencies?.[k as Proficiency] ?? 0) >= 1) gained[k] = (gained[k] ?? 0) + 1;
        });
    });
}

console.log(`\nsweep over ${RUNS} runs, ${entrants} entrants`);
NEW_STANCES.forEach(s => guard((stanceCycles[s] ?? 0) > 0, `stance ${s} is taken`, `${stanceCycles[s] ?? 0} tribute-cycles`));
SIGNATURE_EVENTS.forEach(e => guard((events[e] ?? 0) > 0, `set piece ${e} fires`, `${events[e] ?? 0}`));
NEW_PERSONAS.forEach(p => guard((personas[p] ?? 0) > 0, `persona ${p} is chosen`, `${personas[p] ?? 0}`));
NEW_TRAITS.forEach(tr => guard((traitHolders[tr] ?? 0) > 0, `trait ${tr} is rolled`, `${traitHolders[tr] ?? 0}`));
NEW_SKILLS.forEach(k => guard((peak[k] ?? 0) > 0, `skill ${k} is trained`, `peak ${(peak[k] ?? 0).toFixed(2)}`));
guard(sideBets > 0, 'A35 a Gambler bets on somebody else\'s fight', `${sideBets}`);
guard((objectives.isolate ?? 0) > 0, 'A34 a Hermit goes looking for empty ground', `${objectives.isolate ?? 0} tribute-cycles`);
guard(noticed > 0, '§3 T8 a betrayal tell is noticed', `${noticed}`);
// A38: no non-core skill reaches a whole level for more than 15% of entrants
// — including the two AUDIT-13 skills that were universal.
const inflated = Object.entries(gained).filter(([, n]) => n / entrants > 0.15);
guard(inflated.length === 0, 'A38 no new skill gained by more than 15% of entrants',
    Object.entries(gained).map(([k, n]) => `${k} ${(100 * n / entrants).toFixed(1)}%`).join(', '));
console.log(`  info  skills reaching level 1 in the sweep: ${NEW_SKILLS.map(k => `${k} ${gained[k] ?? 0}`).join(', ')}`);
console.log(`  info  Q6 boot blades ${bootBlades}, Q8 kept sips ${sips}, K8 cache-cycles ${caches}`);

if (failures > 0) {
    console.log(`\n${failures} AUDIT-14 content check(s) failed.`);
    process.exit(1);
}
console.log('\nAUDIT-14 content checks passed.');
