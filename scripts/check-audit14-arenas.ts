import { ARENA_FLAVOR, UNIVERSAL_EVENTS } from '../src/data/arenaFlavor';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { refineHazardCode } from '../src/engine/causes';
import { DEATH_MIX_BAND } from '../src/engine/arenaWave2';
import { Simulator } from '../src/engine/simulator';
import { initialRunState } from './runInit';

/**
 * AUDIT-14 §6 guard: the arena fixes and the new deaths and events.
 *
 *  - D1–D30, V1–V30 + V15b are in the universal pool; A1–A42 and V31–V72 are
 *    in their arena's pack; every lethal one declares a non-`hazard` code.
 *  - Every landmark gate (`requires.zone`) names a zone the arena has.
 *  - W3/W4: the named leftovers refine out of `hazard`; the seed-shrapnel and
 *    procedural deaths carry no sub-label, no "Caught by the arena", no `hazard`.
 *  - W2: the death-mix band carries the 5 % `lastDamage.signature` floor.
 */
const fail: string[] = [];
const U = new Map(UNIVERSAL_EVENTS.filter(e => e.id).map(e => [e.id!, e]));

for (let i = 1; i <= 30; i++) {
    const d = [...U.keys()].find(k => k.startsWith(`u-a14-d${i}-`));
    if (!d) { fail.push(`universal death D${i} missing`); continue; }
    const e = U.get(d)!;
    if (!(e.damage! > 0) || !e.code || e.code === 'hazard') fail.push(`${d}: lethal entry without a real code`);
    const v = [...U.keys()].find(k => k.startsWith(`u-a14-v${i}-`));
    if (!v) fail.push(`universal event V${i} missing`);
}
if (!U.has('u-a14-v15b-confront')) fail.push('V15b missing');
if (U.get('u-a14-v15-false-ally-overheard')?.chain !== 'u-a14-v15b-confront') fail.push('V15 does not chain to V15b');

const A_IDS = ['tw-a14-mussel-cut-tide', 'tw-a14-wreck-shift', 'tw-a14-boathouse-winch', 'th-a14-coolant-race-scald', 'th-a14-bone-hopper-bury', 'th-a14-scale-house-weigh',
    'sw-a14-brine-well-descent', 'sw-a14-stack-avalanche', 'sw-a14-salt-eyes-walkoff', 'kl-a14-slip-cellar-suck', 'kl-a14-cooling-rack-shatter', 'kl-a14-glaze-lead',
    'vi-a14-press-house', 'vi-a14-bell-tower-swing', 'vi-a14-cellar-must-gas', 'fl-a14-seal-colony-bull', 'fl-a14-frozen-wreck-hold', 'fl-a14-grease-ice-swim',
    'mh-a14-fermenter-co2', 'mh-a14-silo-engulf', 'mh-a14-spirit-flash', 'gh-a14-pane-drop', 'gh-a14-aquatic-intake', 'gh-a14-boiler-steam',
    'wb-a14-cell-lock', 'wb-a14-laundry-mangle', 'wb-a14-tower-searchlight', 'uc-a14-third-rail', 'uc-a14-ghost-train', 'uc-a14-turnstile-crush',
    'sp-a14-ice-chimney-plug', 'sp-a14-sea-cave-tide', 'sp-a14-kelp-tangle', 'bs-a14-standing-dead-fall', 'bs-a14-stump-hole', 'bs-a14-erosion-gully-slide',
    'va-a14-turbine-hall', 'va-a14-seed-vault-cold', 'va-a14-reactor-level-sickness', 'cn-a14-strangler-fig', 'cn-a14-epiphyte-shelf-tip', 'cn-a14-cistern-hollow'];
let aEvents = 0;
const packIds = new Map<string, { arena: string; lethal: boolean; code?: string; signature?: boolean }>();
for (const [arena, pack] of Object.entries(ARENA_FLAVOR)) {
    const zones = ARENAS.find(a => a.id === arena)?.zones.map(z => z.name) ?? [];
    for (const e of pack.events) {
        if (e.id) packIds.set(e.id, { arena, lethal: (e.damage ?? 0) > 0, code: e.code, signature: e.signature });
        for (const z of e.requires?.zone ?? []) {
            if (!zones.some(n => n === z || n.startsWith(`${z} (`))) fail.push(`${arena}/${e.id}: gated to zone '${z}', which the arena does not have`);
        }
        if (e.id && /-a14-v-/.test(e.id)) aEvents++;
    }
}
for (const id of A_IDS) {
    const p = packIds.get(id);
    if (!p) { fail.push(`arena death ${id} missing`); continue; }
    if (!p.lethal || !p.code || p.code === 'hazard') fail.push(`${id}: lethal entry without a real code`);
    if (!p.signature) fail.push(`${id}: not stamped as the arena's own death`);
}
if (aEvents < 42) fail.push(`arena events V31–V72: ${aEvents} of 42`);

for (const [cause, want] of [['Stuck in the flue', 'asphyxiation'], ['Taken by the pumps', 'machinery'], ['Lost a hand on Gull Rock', 'crush']] as const) {
    const got = refineHazardCode('hazard', cause);
    if (got !== want) fail.push(`refine '${cause}' -> ${got}, want ${want}`);
}
if (!(DEATH_MIX_BAND.sigMin >= 0.05)) fail.push('DEATH_MIX_BAND.sigMin under 5%');

// W3/W4/W10: live runs of the arenas the audit named, plus procedural.
const RUNS = Number(process.env.RUNS ?? 4);
for (const arenaId of ['burnscar', 'ashgrove', 'islands', 'vault', 'warren', 'kiln', 'saltworks', 'tidewrack', 'procedural']) {
    for (let i = 0; i < RUNS; i++) {
        const sim = new Simulator(initialRunState({ seed: `A14-${i}-${arenaId}`, arenaId, config: DEFAULT_GAME_CONFIG }));
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
            const c = t.causeOfDeath ?? '';
            if (s.arena.zones.some(z => z.name.includes('(') && c.includes(z.name))) fail.push(`${arenaId}#${i}: sub-label leaked into "${c}"`);
            if (/^Caught by the arena/.test(c)) fail.push(`${arenaId}#${i}: generic "${c}"`);
            if (t.causeCode === 'hazard') fail.push(`${arenaId}#${i}: '${c}' ended on the hazard catch-all`);
        }
    }
}

if (fail.length) { console.error(`${fail.length} AUDIT-14 arena failure(s):\n` + fail.join('\n')); process.exit(1); }
console.log(`AUDIT-14 §6 ok: 30 universal deaths, 31 universal events, ${A_IDS.length} arena deaths, ${aEvents} arena events; no sub-label, generic or hazard deaths in ${RUNS} runs x 9 arenas.`);
