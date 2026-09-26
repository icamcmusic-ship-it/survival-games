/**
 * AUDIT-13 §16 N1-N37: the new traits, skills, archetypes, quirks and stances
 * each have to *do* something in a real run — a hook nothing reaches is the
 * dead content every audit since AUDIT-9 has had to go back and wire.
 *
 * A seeded sweep. Run with `npm run test:audit13-content`
 * (AUDIT13_CONTENT_RUNS overrides the sweep size).
 */
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState, Proficiency } from '../src/models/types';
import { initialRunState } from './runInit';
import { TRAIT_DEFS } from '../src/data/traits';
import { QUIRKS, QUIRK_MODS } from '../src/data/quirks';
import { ARCHETYPES } from '../src/data/archetypes';
import { STANCE_PROFILES } from '../src/data/stances';

const RUNS = Number(process.env.AUDIT13_CONTENT_RUNS ?? 120);
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];

let failures = 0;
function guard(ok: boolean, label: string, detail: string) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(48)} ${detail}`);
    if (!ok) failures++;
}

const NEW_TRAITS = ['Stitch-Fingered', 'Loud Heart', 'Bad Knee', 'Drowned Once', 'Mud-Skinned', 'Bell-Voiced',
    'Two-Faced', 'Kin-Seeker', 'Ash-Lunged', 'Tin Ear', 'Hunger-Sharp', 'Borrowed Luck', 'Bitter Root',
    'Deadfall Mind', 'Slow Healer', 'Keeps Watch Alone'];
const NEW_SKILLS: Proficiency[] = ['angling', 'mimicry', 'bartering', 'weathercraft', 'teaching', 'resting'];
const NEW_ARCHETYPES = ['firekeeper', 'kingmaker', 'ratcatcher', 'pilgrim', 'mourner', 'lamplighter'] as const;
const NEW_QUIRKS = ['counts their steps between trees', 'sleeps with one boot off', 'licks the blade before a fight',
    'keeps the first thing they find', 'hums a lullaby for the dead', 'never eats the last of anything'];
const NEW_STANCES = ['Regrouping', 'Mourning', 'Sheltering'] as const;
const SIGNATURE_EVENTS = ['hearth-kept', 'kingmaker-crown', 'pest-sweep', 'pilgrim-arrival', 'mourner-vigil', 'beacon-lit'];

// ---- static -----------------------------------------------------------------
console.log('static');
guard(NEW_TRAITS.every(n => !!TRAIT_DEFS[n] && !TRAIT_DEFS[n].earned), 'N1-N16 traits are rollable rows', `${NEW_TRAITS.length}`);
guard(NEW_QUIRKS.every(q => QUIRKS.some(x => x.label === q) && q in QUIRK_MODS), 'N29-N34 quirks have lines and a mods row', `${NEW_QUIRKS.length}`);
guard(NEW_ARCHETYPES.every(a => !!ARCHETYPES[a]?.signature), 'N23-N28 archetypes carry a signature', `${NEW_ARCHETYPES.length}`);
guard(NEW_STANCES.every(s => STANCE_PROFILES[s]?.conditional), 'N35-N37 stances are conditional rows', `${NEW_STANCES.length}`);

// ---- sweep ------------------------------------------------------------------
const stanceCycles: Record<string, number> = {};
const events: Record<string, number> = {};
const seenLog = new Set<string>();
let luckSpent = 0, keepsakes = 0, stitched = 0, heartened = 0, mourning = 0, hearths = 0, beacons = 0, crowned = 0;
const skillPeak: Record<string, number> = {};

for (let i = 0; i < RUNS; i++) {
    const arenaId = arenaIds[i % arenaIds.length];
    const config = i % 3 === 0 ? { ...DEFAULT_GAME_CONFIG, districtCount: 8 } : DEFAULT_GAME_CONFIG;
    const sim = new Simulator(initialRunState({ seed: `A13C-${i}`, arenaId, config }));
    sim.observe((s: GameState) => {
        s.log.forEach(e => {
            const key = `${i}-${e.id}`;
            if (!e.type || seenLog.has(key)) return;
            seenLog.add(key);
            if (SIGNATURE_EVENTS.includes(e.type)) events[e.type] = (events[e.type] ?? 0) + 1;
        });
        s.tributes.forEach(t => {
            if (t.status !== 'alive') return;
            stanceCycles[t.stance] = (stanceCycles[t.stance] ?? 0) + 1;
            if (t.heartened) heartened++;
            if (t.mourning) mourning++;
            if (t.hearthUntil !== undefined) hearths++;
            if (t.beaconUntil !== undefined) beacons++;
            if (t.crownedById) crowned++;
        });
    });
    let steps = 0;
    while (!sim.isFinished() && steps++ < 400) sim.advance();
    const end = sim.getState();
    end.tributes.forEach(t => {
        if (t.luckSpent) luckSpent++;
        if (t.stitchedUntil !== undefined) stitched++;
        if (t.inventory.some(it => it.keepsake)) keepsakes++;
        NEW_SKILLS.forEach(k => { skillPeak[k] = Math.max(skillPeak[k] ?? 0, t.proficiencies?.[k] ?? 0); });
    });
}

console.log(`\nsweep over ${RUNS} runs`);
NEW_STANCES.forEach(s => guard((stanceCycles[s] ?? 0) > 0, `stance ${s} is taken`, `${stanceCycles[s] ?? 0} tribute-cycles`));
SIGNATURE_EVENTS.forEach(e => guard((events[e] ?? 0) > 0, `set piece ${e} fires`, `${events[e] ?? 0}`));
NEW_SKILLS.forEach(k => guard((skillPeak[k] ?? 0) > 0, `skill ${k} is trained`, `peak ${(skillPeak[k] ?? 0).toFixed(2)}`));
guard(luckSpent > 0, 'N12 Borrowed Luck spends', `${luckSpent}`);
guard(stitched > 0, 'N1 a Stitch-Fingered dressing lands', `${stitched}`);
guard(heartened > 0, 'N2 a Loud Heart steadies an ally', `${heartened} tribute-cycles`);
guard(keepsakes > 0, 'N32 a keepsake is kept', `${keepsakes}`);
guard(mourning > 0 && hearths > 0 && beacons > 0 && crowned > 0, 'N23/N24/N28/N36 state is reached',
    `mourning ${mourning}, hearth ${hearths}, beacon ${beacons}, crowned ${crowned}`);

if (failures > 0) {
    console.log(`\n${failures} AUDIT-13 content check(s) failed.`);
    process.exit(1);
}
console.log('\nAUDIT-13 content checks passed.');
