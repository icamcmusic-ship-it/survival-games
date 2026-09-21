/**
 * REQUEST: "a setting to force a certain tribute to win the games".
 *
 * The easy way to build this would be to make the nominated tribute invincible
 * and stop thinking about it. The hard part — and the part worth checking — is
 * that a fixed Games must still be a Games: the other twenty-three deaths have
 * to be real deaths, attributed to whoever dealt them, in a real order, with a
 * real chronicle, or the setting has quietly corrupted every record the run
 * produces.
 *
 * So these scenes assert the outcome *and* the honesty of everything around it.
 */
import { initialRunState } from './runInit';
import { Simulator } from '../src/engine/simulator';
import { DEFAULT_GAME_CONFIG, ARENAS } from '../src/data/constants';
import { deathCodeOf } from '../src/engine/causes';
import { GameState, Tribute } from '../src/models/types';
import { scenario, check, eq, report } from './scenarios';

const RUNS = 25;

/** Play a Games with `pick` nominated, and hand back the finished state. */
function riggedRun(i: number, pick: (cast: Tribute[]) => Tribute): GameState {
    let state = initialRunState({
        seed: `RIG-${i}`,
        arenaId: ARENAS[i % ARENAS.length].id,
        config: DEFAULT_GAME_CONFIG,
    });
    state.riggedVictorId = pick(state.tributes).id;
    const sim = new Simulator(state);
    let guard = 4000;
    while (state.phase !== 'ended' && guard-- > 0) {
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') sim.processBloodbath();
        else if (state.phase === 'epilogue') state.phase = 'ended';
        else if (!sim.processTurn()) break;
        state = sim.getState();
    }
    return state;
}

// The weakest tribute in the cast, because a setting that only works when the
// favourite is nominated is not the setting that was asked for.
const weakest = (cast: Tribute[]) => [...cast]
    .sort((a, b) => (a.attributes.strength + a.attributes.agility)
        - (b.attributes.strength + b.attributes.agility))[0];

const runs = Array.from({ length: RUNS }, (_, i) => riggedRun(i, weakest));

scenario(
    'the nominated tribute is crowned, even when they are the weakest in the cast',
    'the Gamemakers have decided who comes home',
    () => {
        runs.forEach((state, i) => {
            const survivors = state.tributes.filter(t => t.status === 'alive');
            check(survivors.some(t => t.id === state.riggedVictorId),
                `run ${i}: the nominated tribute did not come home`);
        });
    },
);

scenario(
    'every other death in a fixed Games is a real death',
    'the setting must not corrupt the record of everything around it',
    () => {
        runs.forEach((state, i) => {
            const dead = state.tributes.filter(t => t.status === 'dead');
            check(dead.length > 0, `run ${i}: nobody died at all`);
            dead.forEach(t => {
                check(!!t.causeOfDeath, `run ${i}: ${t.name} died with no cause`);
                check(deathCodeOf(t) !== 'unknown', `run ${i}: ${t.name} died with no cause code`);
                check(t.eliminationIndex !== undefined, `run ${i}: ${t.name} is missing from the elimination order`);
                // Attribution: a death credited to a tribute names one who exists.
                if (t.lastDamage?.kind === 'tribute') {
                    const killer = state.tributes.find(o => o.id === t.lastDamage!.sourceId);
                    check(!!killer, `run ${i}: ${t.name}'s killer is not in the cast`);
                }
            });
            // ...and the elimination order is a real order, with no gaps.
            const order = dead.map(t => t.eliminationIndex!).sort((a, b) => a - b);
            order.forEach((v, idx) => eq(v, idx + 1, `run ${i}: elimination order is not contiguous`));
        });
    },
);

scenario(
    'a fixed Games says so, in the chronicle',
    'a setting that quietly changes the outcome and reads like an ordinary Games is a corrupted record',
    () => {
        runs.forEach((state, i) => {
            check(state.log.some(l => /already been decided/i.test(l.text)),
                `run ${i}: the chronicle does not admit the Games was fixed`);
        });
    },
);

scenario(
    'the nominated tribute still gets hurt',
    'a tribute who walks out untouched tells the audience what has been arranged',
    () => {
        const victors = runs.map(s => s.tributes.find(t => t.id === s.riggedVictorId)!);
        const marked = victors.filter(v => (v.healthAtLastCannon ?? v.health) < 100);
        check(marked.length > runs.length * 0.5,
            `only ${marked.length} of ${runs.length} nominated victors took a scratch`);
    },
);

scenario(
    'and an unfixed Games is unchanged',
    'the protection must be inert when nobody is nominated',
    () => {
        let state = initialRunState({ seed: 'RIG-none', arenaId: ARENAS[0].id, config: DEFAULT_GAME_CONFIG });
        const sim = new Simulator(state);
        let guard = 4000;
        while (state.phase !== 'ended' && guard-- > 0) {
            if (state.phase === 'setup') sim.processTraining();
            else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
            else if (state.phase === 'interviews') sim.startGames();
            else if (state.phase === 'bloodbath') sim.processBloodbath();
            else if (state.phase === 'epilogue') state.phase = 'ended';
            else if (!sim.processTurn()) break;
            state = sim.getState();
        }
        eq(state.riggedVictorId, undefined, 'nothing nominated itself');
        check(!state.log.some(l => /already been decided/i.test(l.text)),
            'an ordinary Games claimed to be fixed');
        check(state.tributes.filter(t => t.status === 'dead').length > 1, 'and it still ran');
    },
);

process.exitCode = report('a fixed Games') === 0 ? 0 : 1;
