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

/**
 * Measured at 56/60 over a sixty-seed sweep. The floor is well under that
 * because this suite runs far fewer seeds, and a rate asserted on a small
 * sample needs room to breathe — the point of the check is to catch the
 * arrangement being switched off, not to pin the number.
 */
const RIGGED_MIN_WIN_RATE = 0.7;

const runs = Array.from({ length: RUNS }, (_, i) => riggedRun(i, weakest));

scenario(
    'the nominated tribute usually comes home, even as the weakest in the cast',
    'an arrangement that does not move the outcome is not an arrangement',
    () => {
        /*
         * REQUEST: "make it so that forced victors don't survive/cheat death,
         * just have the simulation cater to them winning."
         *
         * This scenario used to assert a *guarantee*, which was true when the
         * engine pulled every killing blow aimed at the nominated tribute and
         * is deliberately not true any more. The saves cost two things: they
         * made the arrangement visible — somebody who cannot die stops being
         * watchable — and they dragged rigged runs 4.7 days longer than the
         * same seeds unrigged, because the arena had to finish everybody else
         * off around an immortal finalist.
         *
         * So the assertion is a rate, and it is a rate against the weakest
         * tribute in the cast, which is the hard case. A quarter of the field's
         * worth of wins would mean the thumb is not on the scale; a hundred per
         * cent would mean the saves are back.
         */
        const crowned = runs.filter(state =>
            state.tributes.some(t => t.status === 'alive' && t.id === state.riggedVictorId)).length;
        check(crowned >= Math.ceil(runs.length * RIGGED_MIN_WIN_RATE),
            `the nominated tribute came home ${crowned}/${runs.length}, below the arranged rate`);
        check(crowned < runs.length || runs.length < 8,
            `the nominated tribute came home every single time — that is a guarantee, not an arrangement`);
    },
);

scenario(
    'every other death in an arranged Games is a real death',
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
    'an arranged Games says so, in the chronicle',
    'a setting that quietly changes the outcome and reads like an ordinary Games is a corrupted record',
    () => {
        /*
         * AUDIT-10: paired with a typed assertion, because a prose probe can
         * fail in two directions and only one of them is loud.
         *
         * A reword breaks the positive check here, which is an annoyance and
         * gets noticed. The negative check in the scene below is the dangerous
         * one: a reword makes "an ordinary Games did not claim to be fixed"
         * pass because the string no longer exists anywhere, and it passes
         * silently and forever. `check-projects` was caught doing the same
         * class of thing this afternoon — and `soak.ts`'s own header records
         * six counters that had been "reading lines that were not the beat at
         * all". The typed field is what actually decides; the line is what the
         * audience gets told, and both are worth asserting.
         *
         * The probe is anchored to the whole opening sentence rather than a
         * phrase. Renaming the setting broke it immediately: an interview line
         * in `flavorText` has a tribute say their chances depend "on what has
         * been arranged", and a loose match called every ordinary Games
         * arranged. Fourth substring collision of this session, and the second
         * in this file.
         */
        runs.forEach((state, i) => {
            eq(state.riggedVictorId !== undefined, true, `run ${i}: nothing was nominated`);
            check(state.log.some(l => /This Games has been arranged\./.test(l.text)),
                `run ${i}: the chronicle does not admit the Games was arranged`);
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
        // The typed half is what makes this scene mean anything: without it, a
        // reworded admission line would satisfy the prose half by no longer
        // existing, and this would pass on a Games that had in fact been fixed.
        eq(state.riggedVictorId, undefined, 'nothing nominated itself');
        check(!state.log.some(l => /This Games has been arranged\./.test(l.text)),
            'an ordinary Games claimed to be arranged');
        check(state.tributes.filter(t => t.status === 'dead').length > 1, 'and it still ran');
    },
);

process.exitCode = report('a fixed Games') === 0 ? 0 : 1;
