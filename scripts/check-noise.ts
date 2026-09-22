/**
 * §16: noise as a property of a crossing.
 *
 * `ZoneFeatures.acoustics` documented itself as "how far sound carries *out
 * of*, and inside, this zone" and had exactly one reader in the whole engine —
 * static concealment, the inside half. Moving was silent, so the only way to
 * learn where somebody was, was to be standing next to them.
 *
 * The room for this was measured before it was built and it is enormous: 37.6%
 * of living pairs stand in adjacent zones, and in 67.6% of those the listener
 * had no recent sighting of the mover. That is the danger, not the
 * reassurance. A quarter of every pair in the arena is one zone apart in
 * mutual ignorance, and if sound crosses that gap too freely the cast becomes
 * omniscient and stealth, hiding and every ambush quietly stop mattering.
 *
 * So the ceiling is the real assertion here, and it is checked three ways: the
 * arena must keep a substantial share of its mutual ignorance, a quiet stance
 * must be measurably quieter than a loud one, and what a listener writes down
 * must stay weaker than what somebody who walked the ground wrote. The floor
 * is checked too, because a channel nobody ever hears is not a channel.
 *
 *   npm run test:noise
 *   NOISE_RUNS=200 npm run test:noise
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState, Tribute } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { cyclesSinceContact, ensureMemory } from '../src/engine/memory';
import { getZone } from '../src/engine/map';
import { crossingNoise } from '../src/engine/noise';

const RUNS = Number(process.env.NOISE_RUNS ?? 40);
const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];

function start(seed: string, arenaId: string, gm: boolean): GameState {
    const gp = gamesProfileFor(seed, seed.endsWith('7'));
    const arena = resolveArenaForRun(seed, arenaId, gp);
    const cfg = configForProfile(DEFAULT_GAME_CONFIG, gp);
    const tributes = generateTributes(seed, cfg, arena.zones[0].name, gp.castShape, gp.quell);
    return {
        seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: gm,
        config: cfg, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: gp, logCounter: 0, feastsHeld: 0, cycle: 0,
    };
}

let pairs = 0, adjacent = 0, adjacentUnknown = 0;
let heardSlots = 0, seenSlots = 0, heardConfidence = 0, seenConfidence = 0;
let quietSum = 0, quietN = 0, loudSum = 0, loudN = 0;
let completed = 0;

const QUIET = new Set(['Shadowing', 'Evasive']);
const LOUD = new Set(['Aggressive', 'Hunting', 'Desperate']);

for (let i = 0; i < RUNS; i++) {
    const sim = new Simulator(start(`NS${i}`, arenaIds[i % arenaIds.length], i % 4 === 3));
    let guard = 3000;
    let state = sim.getState();
    while (state.phase !== 'ended' && guard-- > 0) {
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') sim.processBloodbath();
        else if (state.phase === 'epilogue') { state.phase = 'ended'; }
        else {
            if (!sim.processTurn()) break;
            const s = sim.getState();
            const alive = s.tributes.filter(t => t.status === 'alive');
            alive.forEach(t => {
                const n = crossingNoise(t, 1);
                if (QUIET.has(t.stance)) { quietSum += n; quietN++; }
                if (LOUD.has(t.stance)) { loudSum += n; loudN++; }
                // What their map is made of.
                Object.values(ensureMemory(t).zones ?? {}).forEach((slot: { hops?: number; confidence?: number }) => {
                    if (slot.hops === 1 && slot.confidence !== undefined && slot.confidence < 1) {
                        heardSlots++; heardConfidence += slot.confidence;
                    } else if ((slot.hops ?? 0) === 0) {
                        seenSlots++; seenConfidence += slot.confidence ?? 1;
                    }
                });
            });
            alive.forEach((a: Tribute) => alive.forEach((b: Tribute) => {
                if (a.id >= b.id) return;
                pairs++;
                if (a.zone === b.zone) return;
                if (!getZone(s.arena, a.zone)?.adjacent.includes(b.zone)) return;
                adjacent++;
                if (cyclesSinceContact(s, a, b.id) > 3) adjacentUnknown++;
            }));
        }
        state = sim.getState();
    }
    if (state.phase === 'ended') completed++;
}

const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
const ignorance = adjacentUnknown / Math.max(1, adjacent);
const quiet = quietSum / Math.max(1, quietN);
const loud = loudSum / Math.max(1, loudN);
const heardConf = heardConfidence / Math.max(1, heardSlots);
const seenConf = seenConfidence / Math.max(1, seenSlots);

console.log(`noise check: ${completed}/${RUNS} runs, ${pairs} living pairs\n`);
const heardShare = heardSlots / Math.max(1, heardSlots + seenSlots);
console.log(`adjacent pairs: ${pct(adjacent, pairs)}`);
console.log(`  ...where neither knows WHO the other is: ${pct(adjacentUnknown, adjacent)} of adjacency`);
console.log(`heard share of all zone impressions: ${pct(heardSlots, heardSlots + seenSlots)}`);
console.log(`heard impressions (hops 1): ${heardSlots}, mean confidence ${heardConf.toFixed(2)}`);
console.log(`looked-at impressions:      ${seenSlots}, mean confidence ${seenConf.toFixed(2)}`);
console.log(`mean crossing noise — quiet stances ${quiet.toFixed(2)}, loud stances ${loud.toFixed(2)}`);

const failures: string[] = [];
if (heardSlots === 0) {
    failures.push('nobody ever heard anything — the channel is wired up to nothing');
}
/*
 * The ceiling, and the thing most worth being careful about.
 *
 * Hearing a crossing is deliberately anonymous: `noteHeard` writes a count
 * into zone memory and never touches identity contact, because the honest
 * content of a noise next door is "somebody is over there", not "that is
 * Marvel". This number therefore should NOT fall much as noise is tuned up —
 * if it ever does, something has started leaking names down a channel that
 * only ever carried footsteps, and the ambush layer is quietly finished.
 */
if (adjacent > 0 && ignorance < 0.5) {
    failures.push(`only ${pct(adjacentUnknown, adjacent)} of adjacency is anonymous `
        + '— hearing a crossing has started telling listeners who made it');
}
/*
 * And noise must stay a clear minority of what a tribute's map is made of.
 * Eyes remain the way the arena is learned; ears are the margin.
 *
 * The bar was 0.35 first, and it was useless: cranking `adjacentCarry` 6.7x
 * and dropping `hearThreshold` 15x — a deliberate, absurd break — moved the
 * share only 9.1% -> 18.3% and the guard passed happily. The share saturates
 * because `noteHeard` refuses to overwrite a stronger belief, so most slots
 * are already held by something looked at and no amount of volume takes them.
 * A bound that a 6.7x change cannot reach is not a bound. 0.15 sits above the
 * measured 9.1% with room for ordinary drift and below what that break
 * produces, so it fails when the thing it is guarding actually breaks.
 */
if (heardShare > 0.15) {
    failures.push(`heard impressions are ${pct(heardSlots, heardSlots + seenSlots)} of all zone belief `
        + '— the cast is navigating by ear');
}
/* A quiet stance has to buy something, or the stance scale is decoration. */
if (quietN > 0 && loudN > 0 && quiet >= loud * 0.8) {
    failures.push(`quiet stances average ${quiet.toFixed(2)} against ${loud.toFixed(2)} for loud ones `
        + '— posture is not buying meaningful silence');
}
/* Hearing must never be worth as much as looking. */
if (heardSlots > 0 && heardConf >= seenConf) {
    failures.push(`heard impressions average ${heardConf.toFixed(2)} confidence against ${seenConf.toFixed(2)} `
        + 'for looked-at ones — an ear is being believed like an eye');
}

if (failures.length) {
    console.error(`\n${failures.length} noise problem(s):`);
    failures.forEach(f => console.error(`  ${f}`));
    process.exit(1);
}
console.log('\nSound crosses the gap, and the arena still has somewhere to hide.');
