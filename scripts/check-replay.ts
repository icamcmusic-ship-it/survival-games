/**
 * AUDIT-10 B3-01: a link that says `exact` has to actually replay the run.
 *
 * F19 made the share link *describe* its own fidelity, which stopped it lying.
 * B3-01 is the other half: making the strongest claim true more often, by
 * carrying the Gamemaker commands the player made rather than only counting
 * them. That claim needs a test, because "it replays" is the kind of statement
 * that is either checked or merely asserted.
 *
 * Three things asserted here:
 *
 *   1. A run with no interventions replays bit-for-bit from seed and config
 *      alone. That is the control: if it fails, nothing below means anything.
 *   2. A run steered by Gamemaker commands does *not* replay without them, and
 *      does with them. Both halves matter — the second is the feature and the
 *      first is the evidence that the second is doing something.
 *   3. `parseInterventionLog` round-trips what `shareParams` encodes, including
 *      what it does with a log a stranger mangled.
 *
 *   npm run test:replay
 */
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { GamemakerEventType } from '../src/engine/gamemaker';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState, InterventionRecord } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { fidelityOf, parseInterventionLog, CONTENT_REVISION, REPLAYABLE_COMMANDS } from '../src/utils/replayManifest';

const failures: string[] = [];
const ok = (label: string) => console.log(`  ok   ${label}`);
const bad = (label: string, detail: string) => { failures.push(`${label}: ${detail}`); console.log(`  FAIL ${label} — ${detail}`); };

function start(seed: string, arenaId: string, planned?: InterventionRecord[]): GameState {
    const gp = gamesProfileFor(seed, false);
    const arena = resolveArenaForRun(seed, arenaId, gp);
    const cfg = configForProfile(DEFAULT_GAME_CONFIG, gp);
    const tributes = generateTributes(seed, DEFAULT_GAME_CONFIG, arena.zones[0].name, gp.castShape, gp.quell);
    return {
        seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: true,
        config: cfg, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: gp, logCounter: 0, feastsHeld: 0, cycle: 0,
        ...(planned?.length ? { plannedInterventions: planned } : {}),
    } as GameState;
}

/** Steer the run by hand at `steerAt`, or let it run; return the finished state. */
function play(seed: string, arenaId: string, steerAt?: Array<[number, GamemakerEventType]>, planned?: InterventionRecord[]): GameState {
    const sim = new Simulator(start(seed, arenaId, planned));
    const fired = new Set<number>();
    let guard = 3000;
    let state = sim.getState();
    while (state.phase !== 'ended' && guard-- > 0) {
        // Fired through the same entry point the booth uses, on the cycle it
        // would have been pressed on — the point being that the replay path and
        // the original path are the same code.
        (steerAt ?? []).forEach(([cycle, type], i) => {
            if ((state.cycle ?? 0) === cycle && !fired.has(i) && state.phase !== 'setup') {
                fired.add(i);
                sim.triggerGamemakerEvent(type);
            }
        });
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') sim.processBloodbath();
        else if (state.phase === 'epilogue') { state.phase = 'ended'; }
        else if (!sim.processTurn()) break;
        state = sim.getState();
    }
    return state;
}

/**
 * The run's outcome as a comparable string. Deliberately not the whole state:
 * a log id or a timestamp differing is not a divergent Games, and comparing
 * everything would make this test fail for reasons that are not about replay.
 */
const shapeOf = (s: GameState) => s.tributes
    .map(t => `${t.id}:${t.status}:${t.health}:${t.causeOfDeath ?? ''}:${t.kills}`)
    .join('|');

console.log('\nA run with nothing steering it');
{
    const a = play('RP-plain', ARENAS[0].id);
    const b = play('RP-plain', ARENAS[0].id);
    if (shapeOf(a) === shapeOf(b)) ok('replays bit-for-bit from seed and config alone');
    else bad('unsteered replay', 'the same seed produced two different Games');
}

console.log('\nA run the player steered');
{
    const steer: Array<[number, GamemakerEventType]> = [[2, 'burn'], [4, 'mutt'], [6, 'flood']];
    const original = play('RP-steered', ARENAS[1].id, steer);
    const log = original.interventionLog ?? [];

    if (log.length >= steer.length) ok(`the commands were recorded (${log.length} entries)`);
    else bad('intervention log', `pressed ${steer.length} commands, recorded ${log.length}`);

    // The control: without the log, the same seed is a different Games. If this
    // passes trivially the test below proves nothing.
    const unsteered = play('RP-steered', ARENAS[1].id);
    if (shapeOf(unsteered) !== shapeOf(original)) ok('does not replay from the seed alone — the commands changed the Games');
    else bad('steering', 'the Gamemaker commands made no difference to the outcome, so this proves nothing');

    // The feature: replaying the recorded list reproduces the run.
    const replayed = play('RP-steered', ARENAS[1].id, undefined, log.filter(a => !a.scheduled));
    if (shapeOf(replayed) === shapeOf(original)) ok('replays exactly from the recorded commands');
    else bad('recorded replay', 'the replayed run diverged from the one it recorded');
}

console.log('\nThe log through a link');
{
    const encoded = '3.burn~5.mutt.d1-male~7.feast!';
    const parsed = parseInterventionLog(encoded);
    if (parsed.length === 3
        && parsed[0].cycle === 3 && parsed[0].type === 'burn' && parsed[0].targetId === undefined
        && parsed[1].targetId === 'd1-male'
        && parsed[2].scheduled === true) ok('round-trips cycle, type, target and the scheduled flag');
    else bad('parse', `read back as ${JSON.stringify(parsed)}`);

    // A stranger's string. Each of these is a way a log arrives broken, and
    // none of them may take the whole list down with it.
    const junk = parseInterventionLog('~~x.burn~.mutt~2~-1.burn~3.5.burn~9.flood~a.b.c.d~4.nonesuch');
    if (junk.length === 1 && junk[0].type === 'flood') ok('drops malformed entries and keeps the rest');
    else bad('parse hardening', `kept ${JSON.stringify(junk)}`);

    if (parseInterventionLog(null).length === 0 && parseInterventionLog('').length === 0) ok('an absent log is an empty list, not a crash');
    else bad('parse', 'an absent log did not read as empty');

    // The whitelist is a copy of the engine's union, kept out of the boot path.
    // A copy that drifts is worse than no copy, so it is asserted rather than
    // trusted: every command the engine can fire must be one a link can carry.
    const engineTypes: GamemakerEventType[] = ['mutt', 'weather', 'feast', 'burn', 'flood', 'fog',
        'sever', 'bounty', 'drop', 'mercy', 'reveal', 'strip'];
    const drifted = engineTypes.filter(t => !REPLAYABLE_COMMANDS.has(t));
    if (drifted.length === 0 && REPLAYABLE_COMMANDS.size === engineTypes.length) ok('the replayable-command list matches the engine\'s');
    else bad('command whitelist', drifted.length ? `missing ${drifted.join(', ')}` : 'the lists are different sizes');

    const shuffled = parseInterventionLog('9.flood~2.burn~5.mutt');
    if (shuffled.map(a => a.cycle).join(',') === '2,5,9') ok('a log that arrived shuffled is replayed in cycle order');
    else bad('parse ordering', shuffled.map(a => a.cycle).join(','));
}

console.log('\nWhat the link then promises');
{
    const base = { campaign: true, campaignRejected: false, revision: CONTENT_REVISION, veteransSeated: 0 };
    if (fidelityOf({ ...base, interventions: 0 }) === 'exact') ok('an unsteered run is exact');
    else bad('fidelity', 'an unsteered run was not exact');

    if (fidelityOf({ ...base, interventions: 3 }) === 'conditions') ok('a steered run whose log did not travel is only conditions');
    else bad('fidelity', 'a steered run with no log claimed more than conditions');

    if (fidelityOf({ ...base, interventions: 3, carriedInterventions: 3 }) === 'exact') ok('a steered run whose log did travel is exact');
    else bad('fidelity', 'a carried log did not raise the claim to exact');

    // The case the whole `carriedInterventions` field exists for.
    if (fidelityOf({ ...base, interventions: 50, carriedInterventions: 40 }) === 'conditions') ok('a truncated log is still only conditions');
    else bad('fidelity', 'a partly carried log claimed an exact replay');
}

if (failures.length) {
    console.error(`\n${failures.length} replay check(s) failed:`);
    failures.forEach(f => console.error(`  ${f}`));
    process.exit(1);
}
console.log('\nA link that claims to replay a run replays it.');
