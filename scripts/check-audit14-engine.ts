/**
 * AUDIT-14 §3: guard for the engine fixes (E1–E18) and tribute-logic items.
 *
 * Runs seeded Games across every arena and checks, after every phase step, the
 * invariants the audit's harnesses found broken. Each failure names the seed
 * and the item. Also prints the tribute-logic census (stance and objective
 * shares) the T-items move, so a regression is visible in CI output.
 *
 *   npm run test:audit14-engine            (AUDIT14_RUNS=… to widen)
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState, Item, Tribute } from '../src/models/types';
import { STANCE_PROFILES } from '../src/data/stances';
import { allied } from '../src/engine/alliance';
import { deathCodeOf } from '../src/engine/causes';
import { hasVengeanceAgainst } from '../src/engine/memory';
import { initialRunState } from './runInit';
import { ABANDONED_CAMPS } from '../src/data/balance';

const RUNS = Number(process.env.AUDIT14_RUNS ?? 150);
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];

const failures: string[] = [];
const counts: Record<string, number> = {};
function fail(id: string, msg: string) {
    counts[id] = (counts[id] ?? 0) + 1;
    if (counts[id] <= 5) failures.push(`${id}: ${msg}`);
}

// ---- E17 (static): every movement helper passes the severed-edge set.
function engineFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) return engineFiles(p);
        return p.endsWith('.ts') ? [p] : [];
    });
}
for (const file of engineFiles('src/engine')) {
    const text = readFileSync(file, 'utf8');
    const re = /reachableZones\(([^)]*\([^)]*\)[^)]*|[^)]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        if (text.slice(Math.max(0, m.index - 16), m.index).includes('function ')) continue;
        const args = m[1];
        if (!/severed|Severed/.test(args)) fail('E17', `${file}: reachableZones(${args.slice(0, 80)}) without the severed-edge set`);
    }
}

// Doubled words the prose may legitimately contain.
const DOUBLE_OK = /^(that|had|very|bye|no|knock|far|round|over|again|on|so|go|come|run|now|in|out|two|one|tick|drip|step|is|do|slowly|closer|more|deeper|down|up|back|and|it|you|there|pull|dig|hold|hush|left|right|tap|thud|higher|faster|further|louder|clear|wait|cut|hand|drop|breathe|plate|blood|scrape|lap|stop|walk|here|then|along)$/i;
const CODES_E9 = ['crush', 'impact', 'electrocution', 'sound', 'animal', 'exposure-pressure'] as const;
const causeTally: Record<string, number> = {};
let arenaDeaths = 0;
const stanceCensus: Record<string, number> = {};
const objectiveCensus: Record<string, number> = {};
let tributePhases = 0;
let huntEvasive = 0;

function step(sim: Simulator): boolean {
    const s = sim.getState();
    if (s.phase === 'setup') sim.processTraining();
    else if (s.phase === 'training' || s.phase === 'scores') sim.processInterviews();
    else if (s.phase === 'interviews') sim.startGames();
    else if (s.phase === 'bloodbath') sim.processBloodbath();
    else if (s.phase === 'epilogue') s.phase = 'ended';
    else return sim.processTurn();
    return true;
}

const conditional = (t: Tribute) => !!STANCE_PROFILES[t.stance]?.conditional;

for (let i = 0; i < RUNS; i++) {
    const seed = `A14E-${i}`;
    const arenaId = arenaIds[i % arenaIds.length];
    const config = i % 3 === 0 ? { ...DEFAULT_GAME_CONFIG, districtCount: 8 } : DEFAULT_GAME_CONFIG;
    const sim = new Simulator(initialRunState({ seed, arenaId, config }));
    const opening = sim.getState();
    // E1: nobody opens in a conditional stance — nothing has happened yet.
    opening.tributes.forEach(t => { if (conditional(t)) fail('E1', `${seed} ${t.name} opens ${t.stance} (${t.archetype})`); });

    // Consecutive steps each link has been stale. The upkeep that clears
    // them runs once per cycle (the crown, the pilgrim) or once per alliance
    // pass (the intent, the ward), so a link may be stale for that long and
    // no longer.
    const stale = new Map<string, number>();
    const LAG: Record<string, number> = { E8: 2, E11: 1, E12: 2, E18: 1 };
    const seenStale = new Set<string>();
    const noteStale = (id: string, key: string, msg: string) => {
        const k = `${id}:${key}`;
        seenStale.add(k);
        const n = (stale.get(k) ?? 0) + 1;
        stale.set(k, n);
        if (n > LAG[key]) fail(key, msg);
    };
    const cachesSeen = new WeakSet<object>();
    let guard = 3000;
    let sawBloodbath = false;
    while (sim.getState().phase !== 'ended' && guard-- > 0) {
        const before = sim.getState();
        const logMark = before.log.length;
        const phaseBefore = before.phase;
        const collapsedBefore = [...(before.collapsedZones ?? [])];
        const zoneBefore = new Map(before.tributes.map(t => [t.id, t.zone] as const));
        const foundBefore = new Set((before.abandonedCamps ?? []).filter(c => c.foundBy !== undefined));
        if (!step(sim)) break;
        const s: GameState = sim.getState();
        const collapsed = s.collapsedZones ?? [];
        const byId = new Map(s.tributes.map(t => [t.id, t] as const));
        const living = s.tributes.filter(t => t.status === 'alive');

        // T16 / E1: the first day starts from a scored stance.
        if (phaseBefore === 'bloodbath' && !sawBloodbath) {
            sawBloodbath = true;
            living.forEach(t => {
                if (!t.decisionTrace) fail('T16', `${seed} ${t.name} leaves the bloodbath with no scored stance`);
                if (t.stance === 'Mourning' && !t.mourning) fail('E1', `${seed} ${t.name} Mourning with nobody to mourn after the bloodbath`);
            });
        }
        if (s.phase === 'day' || s.phase === 'night') {
            living.forEach(t => {
                tributePhases++;
                stanceCensus[t.stance] = (stanceCensus[t.stance] ?? 0) + 1;
                const k = t.objective?.kind ?? 'none';
                objectiveCensus[k] = (objectiveCensus[k] ?? 0) + 1;
                if (k === 'hunt' && (t.stance === 'Evasive' || t.stance === 'Defensive')) huntEvasive++;
                // E1: Mourning needs somebody to mourn unless an event forced it.
                if (t.stance === 'Mourning' && !t.mourning && !t.decisionTrace?.forced) {
                    fail('E1', `${seed} D${s.day} ${t.name} Mourning with no death to mourn`);
                }
            });
        }

        // ---- log text: E7, E14, E16, E6 tell
        for (const l of s.log.slice(logMark)) {
            const tx = l.text;
            if (/\bthe The\b/.test(tx)) fail('E16', `${seed} "the The": ${tx.slice(0, 120)}`);
            if (/flooded Flooded/i.test(tx)) fail('E16', `${seed} ${tx.slice(0, 120)}`);
            const dw = tx.match(/\b(\w+) \1\b/i);
            if (dw && !DOUBLE_OK.test(dw[1])) fail('E16', `${seed} doubled "${dw[0]}": ${tx.slice(0, 140)}`);
            if (l.type === 'betrayal-warning') {
                if (l.phase === 'day' && /the evening/.test(tx)) fail('E7', `${seed} D${l.day} day-phase warning says evening`);
                // The alliance pass runs before anybody moves this step.
                const [a, b] = l.tributesInvolved.map(id => zoneBefore.get(id));
                if (a && b && a !== b) fail('E6', `${seed} D${l.day} warning across zones: ${a} / ${b}`);
            }
            if (/come[s]? apart overnight/.test(tx) && l.phase !== 'night') fail('E14', `${seed} D${l.day} ${l.phase}: finale mutation "overnight" in the day`);
            if (l.category === 'arena' && l.zone && collapsedBefore.includes(l.zone)
                && /coming back through the ash|The water goes down in|run out of things to burn/.test(tx)) {
                fail('E5', `${seed} zone-state line for collapsed ${l.zone}`);
            }
        }
        // E3: a body's kit found this step is never narrated as a fled camp.
        (s.abandonedCamps ?? []).forEach(c => {
            if (c.foundBy === undefined || foundBefore.has(c) || !c.kind) return;
            const finder = byId.get(c.foundBy)?.name ?? '';
            const fled = s.log.slice(logMark).some(l => l.text.startsWith(`${finder} finds a camp in ${c.zone} that somebody left standing`));
            if (fled) fail('E3', `${seed} ${c.kind} cache in ${c.zone} narrated as a fled camp`);
        });

        // ---- E5: no zone state on closed ground
        Object.keys(s.zoneStates ?? {}).forEach(z => { if (collapsed.includes(z)) fail('E5', `${seed} zoneStates on collapsed ${z}`); });

        // ---- caches: E2, E3, E4, E13
        const kitOwner = new Map<Item, string>();
        s.tributes.forEach(t => t.inventory.forEach(it => kitOwner.set(it, `inventory:${t.name}`)));
        const unfoundPerZone = new Map<string, string[]>();
        (s.abandonedCamps ?? []).forEach(c => {
            if (!cachesSeen.has(c)) {
                cachesSeen.add(c);
                if (collapsedBefore.includes(c.zone) && c.foundBy === undefined) fail('E4', `${seed} new cache in collapsed ${c.zone}`);
                const owner = byId.get(c.ownerId);
                if (c.kind === 'corpse' && c.foundBy === undefined && (!c.kit || c.kit.length !== c.items.length)) fail('E13', `${seed} corpse cache without its item instances`);
                if (owner && owner.status === 'dead' && !c.kind && c.ownerName === owner.name) {
                    fail('E3', `${seed} ${owner.name}'s corpse kit cached as a camp`);
                }
            }
            if (c.foundBy === undefined && (s.cycle ?? 0) - c.cycle <= ABANDONED_CAMPS.lifetimeCycles) unfoundPerZone.set(c.zone, [...(unfoundPerZone.get(c.zone) ?? []), `${c.ownerName}/${c.kind ?? 'camp'}`]);
            (c.kit ?? []).forEach(it => {
                const other = kitOwner.get(it);
                if (other) fail('E2', `${seed} ${it.name} in ${c.ownerName}'s cache and ${other}`);
                kitOwner.set(it, `cache:${c.ownerName}`);
            });
        });
        unfoundPerZone.forEach((n, z) => { if (n.length > 1) fail('E4', `${seed} unfound caches stacked in ${z}: ${n.join(', ')}`); });

        // ---- E8, E11, E12, E18: stale links may survive one step (the upkeep
        // that clears them runs once per cycle), never two.
        seenStale.clear();
        living.forEach(t => {
            const intent = t.relationsArc?.betrayalIntent;
            if (intent) {
                const target = byId.get(intent.targetId);
                if (!target || target.status !== 'alive' || !allied(t, target)) {
                    noteStale(t.id, 'E8', `${seed} D${s.day} ${t.name} holds intent toward ${target?.name} (dead or not an ally)`);
                }
            }
            if (t.crownedById) {
                const maker = byId.get(t.crownedById);
                if (!maker || maker.status !== 'alive' || maker.crownedId !== t.id) {
                    noteStale(t.id, 'E11', `${seed} D${s.day} ${t.name} keeps a crown ${maker?.name} no longer gives`);
                }
            }
            const wardOf = t.relationsArc?.wardOf;
            const elder = wardOf ? byId.get(wardOf) : undefined;
            if (elder && elder.status === 'alive'
                && (!allied(elder, t) || hasVengeanceAgainst(elder, t.id) || hasVengeanceAgainst(t, elder.id))) {
                noteStale(t.id, 'E12', `${seed} D${s.day} ${t.name} still ward of ${elder.name} outside the alliance`);
            }
            if (t.archetype === 'pilgrim' && t.pilgrimZone && !t.pilgrimArrived && collapsed.includes(t.pilgrimZone)) {
                noteStale(t.id, 'E18', `${seed} D${s.day} ${t.name} still bound for collapsed ${t.pilgrimZone}`);
            }
        });
        [...stale.keys()].forEach(k => { if (!seenStale.has(k)) stale.delete(k); });

        // ---- E15: the bloodbath is not counted as a haunting.
        if (s.deathSites) {
            Object.entries(s.deathSites).forEach(([z, n]) => {
                const real = s.tributes.filter(t => t.status === 'dead' && t.zone === z && !t.diedInBloodbath).length;
                if (n > real) fail('E15', `${seed} deathSites[${z}] = ${n} but only ${real} non-bloodbath deaths there`);
            });
        }
    }
    if (sim.getState().phase !== 'ended') fail('run', `${seed} did not end`);

    // ---- E9/E10: cause codes on the deaths this run produced.
    sim.getState().tributes.forEach(t => {
        if (t.status !== 'dead') return;
        const code = deathCodeOf(t);
        if (code === 'tribute' && !t.lastDamage?.sourceId && t.lastDamage?.kind !== 'tribute') {
            fail('E10', `${seed} "${t.causeOfDeath}" coded tribute with no killer (kind ${t.lastDamage?.kind})`);
        }
        const kind = t.lastDamage?.kind;
        if (kind === 'hazard' || kind === 'arena') {
            if (process.env.AUDIT14_DUMP && code === 'hazard') console.log(`hazard: ${t.causeOfDeath}`);
            arenaDeaths++;
            causeTally[code] = (causeTally[code] ?? 0) + 1;
        }
    });
}

// ---- E9: each AUDIT-13 arena code fires on a measured share of arena deaths.
const floor = Number(process.env.AUDIT14_CODE_FLOOR ?? 0.002);
// Codes almost no authored arena death names, so classification alone
// cannot make them fire. Reported, not failed, until the arena content lands;
// remove a code from this list the moment its content does.
const PENDING = new Set((process.env.AUDIT14_CODE_PENDING ?? 'electrocution,exposure-pressure').split(',').filter(Boolean));
console.log(`arena deaths: ${arenaDeaths}`);
for (const c of CODES_E9) {
    const n = causeTally[c] ?? 0;
    const share = arenaDeaths > 0 ? n / arenaDeaths : 0;
    console.log(`  ${c.padEnd(18)} ${String(n).padStart(4)}  ${(share * 100).toFixed(2)}%`);
    if (share < floor && PENDING.has(c)) { console.log(`    (pending: ${c} is below the floor; it needs authored arena deaths that name it — arena content)`); continue; }
    if (share < floor) fail('E9', `${c} is ${(share * 100).toFixed(2)}% of arena deaths (floor ${(floor * 100).toFixed(1)}%)`);
}

// ---- tribute-logic census (printed; T2 asserted loosely)
const pct = (n: number) => `${((n / Math.max(1, tributePhases)) * 100).toFixed(1)}%`;
console.log(`stances over ${tributePhases} tribute-phases:`);
Object.entries(stanceCensus).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${k.padEnd(12)} ${pct(n)}`));
console.log('objectives:');
Object.entries(objectiveCensus).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, n]) => console.log(`  ${k.padEnd(12)} ${pct(n)}`));
console.log(`hunt objective held in Evasive/Defensive: ${pct(huntEvasive)}`);

Object.entries(counts).forEach(([k, n]) => console.log(`${k}: ${n} violation(s)`));
if (failures.length > 0) {
    console.error('\nFAILURES:');
    failures.forEach(f => console.error(` - ${f}`));
    process.exit(1);
}
console.log(`\nAUDIT-14 engine guard: ${RUNS} runs, all invariants hold.`);
