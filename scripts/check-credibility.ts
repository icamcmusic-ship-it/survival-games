/**
 * AUDIT-10 B5-01: a liar can be a reliable shield.
 *
 * That sentence is the audit's clearest statement of why one trust number was
 * never enough, and it is only true if the axes can actually come apart. A
 * `believes` record that always moves with `respects` or with regard is not
 * contextual trust; it is the old scalar with two more names.
 *
 * So this asserts the separation directly rather than assuming it follows from
 * having written the field: over a sweep, there has to be at least one pair
 * where one tribute disbelieves another and does not think less of them as a
 * fighter, and the axis has to move in both directions and stay inside its
 * scale.
 *
 *   npm run test:credibility
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { RELATIONSHIPS } from '../src/data/balance';
import { adjustBelief, credibilityWeight } from '../src/engine/relationships';

const RUNS = Number(process.env.CREDIBILITY_RUNS ?? 80);

let pairs = 0, positive = 0, negative = 0, separated = 0, runsWithHistory = 0, completed = 0;
let lowest = 0, highest = 0, weightLo = Infinity, weightHi = -Infinity;

for (let i = 0; i < RUNS; i++) {
    const seed = `CRED${i}`;
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
    while (s.phase !== 'ended' && guard-- > 0) {
        if (s.phase === 'setup') sim.processTraining();
        else if (s.phase === 'training' || s.phase === 'scores') sim.processInterviews();
        else if (s.phase === 'interviews') sim.startGames();
        else if (s.phase === 'bloodbath') sim.processBloodbath();
        else if (s.phase === 'epilogue') { s.phase = 'ended'; }
        else if (!sim.processTurn()) break;
        s = sim.getState();
    }
    if (s.phase !== 'ended') continue;
    completed++;

    let any = false;
    s.tributes.forEach(t => {
        Object.entries(t.believes ?? {}).forEach(([otherId, belief]) => {
            pairs++; any = true;
            if (belief > 0) positive++;
            if (belief < 0) negative++;
            lowest = Math.min(lowest, belief);
            highest = Math.max(highest, belief);
            const w = credibilityWeight(t, otherId);
            weightLo = Math.min(weightLo, w);
            weightHi = Math.max(weightHi, w);
            // The claim itself: disbelieved, and not thought less of as a fighter.
            if (belief < 0 && (t.respects?.[otherId] ?? 0) >= 0) separated++;
        });
    });
    if (any) runsWithHistory++;
}

console.log(`\ncredibility: ${completed} runs, ${runsWithHistory} carried any history, ${pairs} pairs recorded`);
console.log(`  ${positive} believed more, ${negative} believed less; range ${lowest} to ${highest}`);
if (pairs > 0) console.log(`  weight on a retelling ran ${weightLo.toFixed(2)}x to ${weightHi.toFixed(2)}x`);
console.log(`  ${separated} pair(s) disbelieved somebody they did not think less of as a fighter`);

const failures: string[] = [];

/*
 * The separation is asserted on a constructed pair rather than hoped for in the
 * sweep.
 *
 * A first version required the sweep to produce a tribute who disbelieved
 * somebody they still rated as a fighter. It found one — out of 48 pairs, of
 * which only 2 were negative at all, because being caught lying is rare and
 * should be. A build gate that depends on a single occurrence of a rare event
 * is a build gate that fails on a Tuesday for no reason.
 *
 * The claim is a property of the code, so it is checked as one: moving
 * credibility must move credibility and nothing else. That is exactly what "a
 * liar can be a reliable shield" asserts, and it is decidable rather than
 * sampled.
 */
{
    const subject = { believes: {}, respects: { x: 20 }, relationships: { x: 15 }, trusts: { x: 10 } } as unknown as Parameters<typeof credibilityWeight>[0];
    adjustBelief(subject, 'x', -RELATIONSHIPS.lieCaughtBelief);
    if ((subject.believes?.x ?? 0) >= 0) failures.push('a caught lie did not lower credibility');
    if (subject.respects?.x !== 20) failures.push('changing credibility moved combat regard with it');
    if (subject.relationships?.x !== 15) failures.push('changing credibility moved regard with it');
    if (subject.trusts?.x !== 10) failures.push('changing credibility moved stored trust with it');
    if (credibilityWeight(subject, 'x') >= 1) failures.push('a disbelieved teller is still weighted at full');
    adjustBelief(subject, 'x', RELATIONSHIPS.lieCaughtBelief + RELATIONSHIPS.corroboratedBelief);
    if (credibilityWeight(subject, 'x') <= 1) failures.push('corroboration did not raise the weight above full');
    // The floor and ceiling are the promise that neither end runs away.
    adjustBelief(subject, 'x', -RELATIONSHIPS.max * 2);
    if (credibilityWeight(subject, 'x') < RELATIONSHIPS.credibilityFloor - 1e-9) failures.push('credibility weight fell through its floor');
    adjustBelief(subject, 'x', RELATIONSHIPS.max * 4);
    if (credibilityWeight(subject, 'x') > RELATIONSHIPS.credibilityCeiling + 1e-9) failures.push('credibility weight rose through its ceiling');
}

// The sweep's job is liveness: is the axis connected to the simulation at all.
if (pairs === 0) {
    failures.push('no tribute ever formed an impression of anybody\'s credibility — the axis is not connected to anything');
}
if (pairs > 0 && positive === 0) failures.push('credibility never rose — corroboration is not reaching the ledger');
// The weight is clamped in code; this checks the clamp is the thing that binds
// rather than the data never getting near it.
if (pairs > 0 && (weightLo < RELATIONSHIPS.credibilityFloor - 1e-9 || weightHi > RELATIONSHIPS.credibilityCeiling + 1e-9)) {
    failures.push(`credibility weight escaped its bounds: ${weightLo}–${weightHi}`);
}

if (failures.length) {
    console.error('\nContextual trust checks failed:');
    failures.forEach(f => console.error(`  ${f}`));
    process.exit(1);
}
console.log('\nCredibility moves both ways, stays in its bounds, and moves nothing but itself.');
if (negative === 0) {
    console.log('No caught lie in this sweep — being caught out is rare, and rightly so. The');
    console.log('constructed check above covers that direction; this line is a note, not a failure.');
}
