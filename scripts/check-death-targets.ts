/**
 * REQUEST: "the length of the hazards, arena deaths, cornucopia deaths should
 * be more absolute. I want to be able to choose for up to 23 tribute deaths in
 * cornucopia if I choose, and so on with other sliders."
 *
 * A setting that claims to be a number of tributes has to be checked against
 * the number of tributes it actually produces — across its range, not at its
 * default, because "absolute" is a claim about the whole slider.
 *
 * The target is met by keeping people in the fight and hitting harder while
 * behind, never by executing anybody: every death still goes through
 * `resolveCombat` and belongs to whoever landed it. People survive fights, so
 * the ask is met to within a rounding error up to about half the field and
 * approached above that. Both halves are asserted, because a setting that
 * overshoots would be as wrong as one that saturates.
 */
import { initialRunState } from './runInit';
import { Simulator } from '../src/engine/simulator';
import { DEFAULT_GAME_CONFIG, ARENAS } from '../src/data/constants';
import { deathCodeOf } from '../src/engine/causes';
import { scenario, check, report } from './scenarios';

const RUNS = 30;
const CAST = 24;

/** Play `RUNS` Games at one setting and report what the Cornucopia took. */
function bloodbathAt(ask: number): { dead: number; tributeDealt: number } {
    let atHorn = 0, byTributes = 0, played = 0;
    for (let i = 0; i < RUNS; i++) {
        let state = initialRunState({
            seed: `DT-${ask}-${i}`,
            arenaId: ARENAS[i % ARENAS.length].id,
            config: { ...DEFAULT_GAME_CONFIG, districtCount: CAST / 2, bloodbathDeathShare: ask / CAST },
        });
        const sim = new Simulator(state);
        let guard = 4000;
        let standingAtGong = 0;
        while (state.phase !== 'ended' && guard-- > 0) {
            if (state.phase === 'setup') sim.processTraining();
            else if (state.phase === 'training' || state.phase === 'scores') sim.processInterviews();
            else if (state.phase === 'interviews') sim.startGames();
            else if (state.phase === 'bloodbath') {
                standingAtGong = sim.getState().tributes.filter(t => t.status === 'alive').length;
                sim.processBloodbath();
                atHorn += standingAtGong - sim.getState().tributes.filter(t => t.status === 'alive').length;
            } else if (state.phase === 'epilogue') state.phase = 'ended';
            else if (!sim.processTurn()) break;
            state = sim.getState();
        }
        played++;
        byTributes += state.tributes.filter(t => t.status === 'dead' && deathCodeOf(t) === 'tribute').length;
    }
    return { dead: atHorn / played, tributeDealt: byTributes / played };
}

const asks = [0, 4, 8, 12, 18, 23];
const measured = asks.map(ask => ({ ask, ...bloodbathAt(ask) }));
measured.forEach(m => console.log(
    `  asked ${String(m.ask).padStart(2)} of ${CAST} -> ${m.dead.toFixed(1)} dead at the horn`
    + `  (${m.tributeDealt.toFixed(1)} tribute-dealt over the whole Games)`));

scenario(
    'asking for nothing at the Cornucopia gets nothing',
    'a scramble for packs that nobody dies in is a legitimate thing to want to watch',
    () => {
        const none = measured[0].dead;
        check(none < 0.5, `${none.toFixed(1)} died at a Cornucopia asked for none`);
    },
);

scenario(
    'the setting is a number of tributes, not a multiplier',
    'up to about half the field, the ask is met to within a rounding error',
    () => {
        measured.filter(m => m.ask > 0 && m.ask <= CAST / 2).forEach(m => {
            check(Math.abs(m.dead - m.ask) <= 1.2,
                `asked ${m.ask}, got ${m.dead.toFixed(1)}`);
        });
    },
);

scenario(
    'and a very large ask is approached rather than saturating',
    'every death still goes through a fight somebody wins, so the residual is people surviving them',
    () => {
        const high = measured.filter(m => m.ask > CAST / 2);
        high.forEach(m => {
            check(m.dead >= m.ask * 0.85,
                `asked ${m.ask}, got only ${m.dead.toFixed(1)} — the ask is not being approached`);
            check(m.dead <= m.ask,
                `asked ${m.ask}, got ${m.dead.toFixed(1)} — the Cornucopia must not overshoot`);
        });
        // The whole point of the request: 23 of 24 has to be reachable, not a
        // slider position that behaves the same as 12.
        const most = measured[measured.length - 1];
        check(most.dead > measured[measured.length - 3].dead + 3,
            'the top of the slider is not distinguishable from the middle of it');
    },
);

scenario(
    'it is monotonic',
    'a slider whose middle and top produce the same Games is not a slider',
    () => {
        for (let i = 1; i < measured.length; i++) {
            check(measured[i].dead >= measured[i - 1].dead - 0.5,
                `asked ${measured[i].ask} produced fewer than asked ${measured[i - 1].ask}`);
        }
    },
);

process.exitCode = report('death targets') === 0 ? 0 : 1;
