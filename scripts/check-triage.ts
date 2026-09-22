/**
 * AUDIT-10 B5-03: treatment scarcity, and the distinction the audit asks for.
 *
 * *"Two injured people and one treatment; choose ... Triage affects trust
 * differently from deliberate refusal."* That sentence is the whole design, and
 * it is only true if the two outcomes are actually different — a beat where
 * every scarcity resolves the same way is a cutscene with a random seed.
 *
 * So this asserts the split rather than the existence: the question has to be
 * posed, and it has to go more than one way. It also asserts the thing that is
 * easy to get wrong and impossible to see in a chronicle — that the kit
 * physically moves, and that nobody ends up holding a copy of it.
 *
 *   npm run test:triage
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { timesHappened } from '../src/engine/milestones';

const RUNS = Number(process.env.TRIAGE_RUNS ?? 80);

let posed = 0, given = 0, refused = 0, completed = 0, runsWithAny = 0;
const failures: string[] = [];

for (let i = 0; i < RUNS; i++) {
    const seed = `TRI${i}`;
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

    const p = timesHappened(s, 'treatment-scarcity');
    const g = timesHappened(s, 'treatment-given');
    const r = timesHappened(s, 'treatment-refused');
    posed += p; given += g; refused += r;
    if (p > 0) runsWithAny++;

    // A gift and a noticed refusal are both resolutions of a posed question, so
    // neither can outnumber the questions. If this ever trips, the beat is
    // firing somewhere it was not counted.
    if (g + r > p) failures.push(`${seed}: ${g + r} resolutions against ${p} questions posed`);

    /*
     * Items are conserved, checked by *reference* rather than by id.
     *
     * `Item` has no per-instance identity — two tributes both holding
     * `bandages` is ordinary and correct — so counting ids proves nothing, and
     * a first version of this check that did so was asserting nothing at all.
     * What a transfer can actually get wrong is aliasing: pushing the same
     * object into the receiver without removing it from the giver, so one
     * bandage becomes two that degrade and spoil in lockstep. That is invisible
     * in a chronicle and decidable here.
     */
    const seenObjects = new Set<object>();
    s.tributes.forEach(t => t.inventory.forEach(item => {
        if (seenObjects.has(item)) failures.push(`${seed}: one item object is in two inventories at once`);
        seenObjects.add(item);
    }));
}

const quiet = posed - given - refused;
console.log(`\ntreatment scarcity: ${completed} runs, posed ${posed} times across ${runsWithAny} runs`);
if (posed > 0) {
    const pct = (n: number) => `${(n / posed * 100).toFixed(0)}%`;
    console.log(`  given over       ${String(given).padStart(4)}  ${pct(given)}`);
    console.log(`  refused, noticed ${String(refused).padStart(4)}  ${pct(refused)}`);
    console.log(`  kept quietly     ${String(quiet).padStart(4)}  ${pct(quiet)}`);
}

if (posed === 0) {
    failures.push('the question was never posed — either the beat is unreachable or it is not wired in');
}
/*
 * The split is the design. A beat that always resolves the same way is not a
 * choice, and both failure directions are worth naming separately because they
 * mean opposite things: nobody ever giving means the threshold is unreachable,
 * and nobody ever keeping means it is free.
 */
if (posed > 0 && given === 0) failures.push('nobody ever handed the kit over — the generosity threshold is unreachable');
if (posed > 0 && quiet + refused === 0) failures.push('the kit was always handed over — the beat costs its holder nothing');

if (failures.length) {
    console.error(`\n${failures.length} triage problem(s):`);
    [...new Set(failures)].slice(0, 10).forEach(f => console.error(`  ${f}`));
    process.exit(1);
}
console.log('\nThe question gets asked, and it goes more than one way.');
