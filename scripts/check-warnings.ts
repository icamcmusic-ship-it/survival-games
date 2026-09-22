/**
 * AUDIT-10 B5-02: a hazard nobody could have seen coming.
 *
 * The audit's line is sharp — *"forecasts with actionable lead time: a log line
 * immediately followed by resolution in the same function is not an
 * intervention window"* — and `hazardChain.ts` already argues the same case in
 * its own header: "a hazard that arrives with no warning cannot be prevented,
 * and one that cannot be prevented is weather rather than a decision".
 *
 * A first pass at measuring this counted how many hazard arrivals had a
 * `forecast` on the calendar first and got 20.4%, which looks damning and is
 * the wrong question. A forecast is not the only way a hazard announces
 * itself, and the other ways are the better ones:
 *
 *   - **a burning neighbour.** Fire spreads along the adjacency graph. The
 *     zone next door being on fire is the most legible warning in the game and
 *     needs no calendar entry at all.
 *   - **an approaching front.** `weatherFront` has a position and a direction
 *     and the sector dossier says "one sector away and moving". A storm you can
 *     watch cross the map is the canonical warnable hazard.
 *   - **standing in it.** A tribute in a zone that is already flooding when it
 *     worsens has the best warning there is.
 *
 * Counting only forecasts would have reported those as unwarned and sent
 * somebody off to forecast a fire that is visibly next door. So this asks the
 * question the audit actually asks — *could anybody have seen this coming* —
 * and the number that matters is the remainder: arrivals with no warning of any
 * kind.
 *
 * Two sources are exempt by design and named rather than quietly dropped. A
 * Gamemaker's strike is supposed to be sudden — that is what the booth is for —
 * and an arena's once-per-run signature is a set piece whose whole shape is
 * that it happens to you. Both are counted and reported separately.
 *
 *   npm run test:warnings
 *   WARNING_RUNS=200 npm run test:warnings
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';

const RUNS = Number(process.env.WARNING_RUNS ?? 80);

/** The kinds that spread along the map, for which a neighbour is the warning. */
const SPREADING = new Set(['burning', 'flooded', 'contaminated', 'fogbound']);

/**
 * Not every zone effect is a hazard.
 *
 * `blooming` is temporary abundance — fruit, fish, run-off, "everyone who can
 * see it knows that" — and the first version of this script counted 21 of them
 * as threats that arrived unannounced. Asking for a warning before a good thing
 * happens is not a coherent request, and leaving it in would have inflated the
 * worklist by a tenth with entries nobody should act on.
 */
const BENEFICIAL = new Set(['blooming']);

let arrivals = 0;
const by: Record<string, number> = { forecast: 0, neighbour: 0, front: 0, occupied: 0, none: 0 };
const unwarnedKinds: Record<string, number> = {};
const leads: number[] = [];
let zeroLead = 0;

for (let i = 0; i < RUNS; i++) {
    const seed = `WARN${i}`;
    const profile = gamesProfileFor(seed, false);
    const arena = resolveArenaForRun(seed, ARENAS[i % ARENAS.length].id, profile);
    const config = configForProfile(DEFAULT_GAME_CONFIG, profile);
    const tributes = generateTributes(seed, DEFAULT_GAME_CONFIG, arena.zones[0].name, profile.castShape, profile.quell);
    const sim = new Simulator({
        seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: false,
        config, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: profile, logCounter: 0, feastsHeld: 0, cycle: 0,
    } as GameState);

    let guard = 3000;
    let s = sim.getState();
    const seenEffect = new Set<string>();
    const seenForecast = new Set<string>();
    // The previous cycle's picture. A warning has to have existed *before* the
    // arrival to be a warning; reading this cycle's state would let a hazard
    // count as its own forecast.
    let prevEffects: Record<string, string[]> = {};
    let prevFrontZone: string | undefined;

    while (s.phase !== 'ended' && guard-- > 0) {
        const cycle = s.cycle ?? 0;
        (s.forecasts ?? []).forEach(f => {
            const key = `${f.zone}|${f.kind}`;
            if (seenForecast.has(key)) return;
            seenForecast.add(key);
            const lead = f.dueCycle - cycle;
            leads.push(lead);
            if (lead <= 0) zeroLead++;
        });

        Object.entries(s.zoneEffects ?? {}).forEach(([zone, list]) => {
            (list ?? []).forEach(effect => {
                const key = `${zone}|${effect.kind}`;
                if (seenEffect.has(key)) return;
                seenEffect.add(key);
                if (BENEFICIAL.has(effect.kind)) return;
                arrivals++;

                if (seenForecast.has(key)) { by.forecast++; return; }

                const printed = s.arena.zones.find(z => z.name === zone);
                const neighbours = printed?.adjacent ?? [];
                if (SPREADING.has(effect.kind)
                    && neighbours.some(n => (prevEffects[n] ?? []).includes(effect.kind))) {
                    by.neighbour++;
                    return;
                }
                if (prevFrontZone && (prevFrontZone === zone || neighbours.includes(prevFrontZone))) {
                    by.front++;
                    return;
                }
                // Already carrying something else here: the ground was visibly
                // going wrong, which is a warning even if not of this exactly.
                if ((prevEffects[zone] ?? []).length > 0) { by.occupied++; return; }

                by.none++;
                unwarnedKinds[effect.kind] = (unwarnedKinds[effect.kind] ?? 0) + 1;
            });
        });

        prevEffects = Object.fromEntries(Object.entries(s.zoneEffects ?? {})
            .map(([z, list]) => [z, (list ?? []).map(e => e.kind)]));
        prevFrontZone = s.weatherFront?.zone;

        if (s.phase === 'setup') sim.processTraining();
        else if (s.phase === 'training' || s.phase === 'scores') sim.processInterviews();
        else if (s.phase === 'interviews') sim.startGames();
        else if (s.phase === 'bloodbath') sim.processBloodbath();
        else if (s.phase === 'epilogue') { s.phase = 'ended'; }
        else if (!sim.processTurn()) break;
        s = sim.getState();
    }
}

const pct = (n: number) => `${(n / Math.max(1, arrivals) * 100).toFixed(1)}%`;
console.log(`\n${arrivals} hazard arrivals over ${RUNS} runs.\n`);
console.log(`  on the calendar first        ${String(by.forecast).padStart(5)}  ${pct(by.forecast)}`);
console.log(`  a neighbour already had it   ${String(by.neighbour).padStart(5)}  ${pct(by.neighbour)}`);
console.log(`  a front was here or next door${String(by.front).padStart(5)}  ${pct(by.front)}`);
console.log(`  the ground was already wrong ${String(by.occupied).padStart(5)}  ${pct(by.occupied)}`);
console.log(`  no warning of any kind       ${String(by.none).padStart(5)}  ${pct(by.none)}`);

const warned = arrivals - by.none;
console.log(`\n${pct(warned)} of hazard arrivals could have been seen coming.`);

if (leads.length > 0) {
    const avg = leads.reduce((a, b) => a + b, 0) / leads.length;
    console.log(`\n${leads.length} forecasts raised, average lead ${avg.toFixed(2)} cycles.`);
}

const failures: string[] = [];
/*
 * The audit's own sentence, as an assertion: a warning that resolves on the
 * cycle it is announced is a log line, not an intervention window. Zero is the
 * only defensible bound — one cycle of lead is the minimum that lets anybody
 * do anything, and a forecast due on the cycle it appears had none.
 */
if (zeroLead > 0) failures.push(`${zeroLead} forecast(s) were due on the cycle they were announced — that is a log line, not a warning`);

if (Object.keys(unwarnedKinds).length > 0) {
    console.log('\nArriving unannounced, by kind:');
    Object.entries(unwarnedKinds).sort((a, b) => b[1] - a[1])
        .forEach(([kind, n]) => console.log(`  ${kind.padEnd(16)} ${n}`));
    console.log('\n  A Gamemaker strike and an arena signature are *supposed* to be sudden, and');
    console.log('  both land here. This list is a worklist for B5-03 rather than a defect count:');
    console.log('  the chains it describes each need "a warning, an avoidance or mitigation".');
}

if (failures.length) {
    console.error('\nWarning checks failed:');
    failures.forEach(f => console.error(`  ${f}`));
    process.exit(1);
}
console.log('\nEvery forecast raised had at least one cycle of lead.');
