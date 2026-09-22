/**
 * AUDIT-10 B5-01: a shared decision, with the parts that make it one.
 *
 * The audit asks for "shared decisions with a recorded proposal, voters,
 * positions and concession". `AllianceDisputeRecord` had four of those five and
 * not the first: it recorded the outcome — the split, who was fed, who was
 * passed over, who walked out — which is a record of a *result*. Without what
 * was put on the table, "they chose by need" and "by need was the only thing
 * anybody suggested" are the same sentence.
 *
 * Underneath, `decideSplit` was a weighted roll over three rules. It produced
 * plausible rates and no politics.
 *
 * So the properties asserted here are the ones that distinguish a vote from a
 * die. A room has to be able to disagree, a proposal has to be able to lose,
 * and the concession list has to be exactly the people whose position was not
 * the outcome — which is checkable against the positions themselves rather than
 * taken on trust.
 *
 *   npm run test:hearings
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';

const RUNS = Number(process.env.HEARING_RUNS ?? 160);

const failures: string[] = [];
const splits: Record<string, number> = {};
let hearings = 0, divided = 0, proposalCarried = 0, conceded = 0, completed = 0;

for (let i = 0; i < RUNS; i++) {
    const seed = `HEAR${i}`;
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

    (s.allianceDisputes ?? []).forEach(d => {
        hearings++;
        splits[d.split] = (splits[d.split] ?? 0) + 1;
        const positions = d.positions ?? {};
        const voters = Object.keys(positions);
        if (new Set(Object.values(positions)).size > 1) divided++;
        if (d.proposal === d.split) proposalCarried++;
        conceded += (d.conceded ?? []).length;

        // Everybody at the hearing held a position. A voter with no recorded
        // position is somebody the record cannot account for.
        (d.memberIdsAtHearing ?? []).forEach(id => {
            if (!positions[id]) failures.push(`${seed}: a member at the hearing has no recorded position`);
        });
        // The proposer was in the room and proposed what they wanted.
        if (d.proposedById && !voters.includes(d.proposedById)) {
            failures.push(`${seed}: the proposal came from somebody who was not at the hearing`);
        }
        if (d.proposedById && d.proposal && positions[d.proposedById] !== d.proposal) {
            failures.push(`${seed}: the proposer put forward something other than their own position`);
        }
        // Concession is derivable, so it is checked rather than believed: the
        // conceders are exactly those whose position was not the outcome.
        const expected = voters.filter(id => positions[id] !== d.split).sort().join(',');
        const actual = [...(d.conceded ?? [])].sort().join(',');
        if (expected !== actual) failures.push(`${seed}: the concession list does not match the positions`);
    });
}

console.log(`\nhearings: ${completed} runs, ${hearings} hearings held`);
if (hearings > 0) {
    console.log(`  splits: ${Object.entries(splits).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    console.log(`  rooms that were divided: ${divided}/${hearings}`);
    console.log(`  the proposal carried:    ${proposalCarried}/${hearings}`);
    console.log(`  members overruled:       ${conceded}`);
}

if (hearings === 0) {
    failures.push('no hearing was ever held — either groups never run short or the beat is unreachable');
}
/*
 * The two properties that separate a vote from a die, and they fail for
 * opposite reasons. A room that is never divided means positions are not
 * really read from interest; a proposal that always carries means proposing
 * and deciding are the same act and one of them is decoration.
 */
if (hearings > 0 && divided === 0) failures.push('no room was ever divided — positions are not coming from members\' own interests');
if (hearings > 0 && proposalCarried === hearings) failures.push('the proposal carried every time — proposing and deciding are the same act');

if (failures.length) {
    console.error(`\n${failures.length} hearing problem(s):`);
    [...new Set(failures)].slice(0, 10).forEach(f => console.error(`  ${f}`));
    process.exit(1);
}
console.log('\nThe room can disagree, the proposal can lose, and the concessions match the positions.');
