import { GameState } from '../models/types';
import { RNG } from '../utils/rng';
import { snapshotState } from '../utils/snapshot';
import { SimContext, createContext, getAlive } from './context';
import { processTraining, processTrainingDay, processTrainingScores } from './phases/training';
import { processParade, processPreGames, processSquare, processTrain } from './phases/pregames';
import { processInterviews } from './phases/interviews';
import { startGames, processBloodbath } from './phases/bloodbath';
import { processAlliances } from './phases/alliances';
import { pruneDeadAlliances } from './alliance';
import { announceFeastTheme, processFeast } from './phases/feast';
import { processDayNight } from './phases/dayNight';
import { processEpilogue } from './phases/epilogue';
import { GamemakerEventType, replayPlannedInterventions, triggerGamemakerEvent as triggerGamemakerEventPhase } from './gamemaker';
import { checkDualVictory } from './victory';
import { fireScheduledWildcard } from './wildcards';
import { FEAST_TEXTS } from '../data/flavorText';
import { FEAST } from '../data/balance';
import { wildcardIs } from './gamesProfile';

export class Simulator {
    private state: GameState;
    private ctx: SimContext;
    private observers: Array<(state: GameState) => void> = [];

    constructor(initialState: GameState) {
        // Shared with the store's per-phase snapshot: structuredClone with a
        // JSON fallback. This runs on four hot paths (startGame, rerollCast,
        // confirmReaping, resumeSavedRun), so it gets the fast clone too.
        this.state = snapshotState(initialState);
        // Inert on purpose: every phase entry point reseeds `ctx.rng` from
        // (seed, phase, day) before drawing, so this seed is never consumed.
        // It is here so `ctx.rng` is never undefined between construction and
        // the first phase, not because resume determinism depends on it.
        this.ctx = createContext(this.state, new RNG(`${this.state.seed}-${this.state.phase}-${this.state.day}`));
    }

    public getState(): GameState {
        return this.state;
    }

    /**
     * Audit 4 §1.10: one observation point, so measurement stops guessing.
     *
     * `getState()` after a phase is the only thing the harness has ever
     * exposed, and nothing in it distinguishes state that *accumulates* from
     * state that is *live and pruned*. Three audits running have measured a
     * live subsystem with an end-state census and reported a false zero:
     * Audit 2 invented field names; Audit 3 read `state.alliances` at the end
     * of a run and reported five alliances across 120 runs (the last tribute
     * standing has no allies); Audit 4 read `state.feastTheme` at the end and
     * reported 90.6% of runs themeless, because `processFeast` clears it on
     * the way out. Each time the instrument was wrong and the finding looked
     * like a bug.
     *
     * `runRecords.ts` already solves this for the six things the achievement
     * table needed. This is the general form: a probe or a check declares what
     * it wants sampled and the simulator calls it once per phase advance, so
     * nobody has to know which fields survive to the epilogue. Every probe
     * behind this report re-implemented the same loop by hand.
     *
     * Observers run after the phase has resolved and before the caller sees
     * the state. They must not mutate it; nothing enforces that, because a
     * harness that could not reach the state would be useless, but a mutating
     * observer breaks seeded replay and is a bug in the observer.
     */
    public observe(fn: (state: GameState) => void): () => void {
        this.observers.push(fn);
        return () => { this.observers = this.observers.filter(o => o !== fn); };
    }

    private notifyObservers() {
        for (const fn of this.observers) fn(this.state);
    }

    /** True once the run can no longer advance — used to stop auto-play and run-to-end loops. */
    public isFinished(): boolean {
        return this.state.phase === 'ended';
    }

    /**
     * The reaping square, the goodbyes, the train, the Remake Center and the
     * chariots. Runs once, immediately before the training floor, so a run
     * started from any entry point still gets its pre-Games — and so the
     * audience numbers the whole simulation reads are earned rather than rolled.
     */
    public processTraining() {
        processPreGames(this.ctx);
        processTraining(this.ctx);
        this.notifyObservers();
    }

    /**
     * §(requests): one stage at a time, whatever the stage is.
     *
     * The store used to know the whole pre-Games dispatch table; now the
     * simulator does, and the UI asks for "the next thing" without caring
     * whether that is a train ride, a day on the floor, or a night in the
     * arena. Returns false when there is nothing left to advance.
     */
    public advance(): boolean {
        const phase = this.state.phase;
        switch (phase) {
            case 'setup':
            case 'roster':
            case 'reaping':
                processSquare(this.ctx); break;
            case 'square':
                processTrain(this.ctx); break;
            case 'train':
                processParade(this.ctx); break;
            case 'parade':
                processTrainingDay(this.ctx, 1); break;
            case 'training1':
                processTrainingDay(this.ctx, 2); break;
            case 'training2':
                processTrainingDay(this.ctx, 3); break;
            case 'training3':
                processTrainingScores(this.ctx); break;
            // A save from before the split lands here with the floor already
            // run; the scores phase is idempotent on its own phase check.
            case 'training':
            case 'scores':
                processInterviews(this.ctx); break;
            case 'interviews':
                startGames(this.ctx); break;
            case 'bloodbath':
                processBloodbath(this.ctx); break;
            case 'epilogue':
            case 'ended':
                return false;
            default:
                return this.processTurn();
        }
        pruneDeadAlliances(this.ctx);
        this.notifyObservers();
        return true;
    }

    public processInterviews() {
        processInterviews(this.ctx);
        this.notifyObservers();
    }

    public startGames() {
        startGames(this.ctx);
        this.notifyObservers();
    }

    public processBloodbath() {
        processBloodbath(this.ctx);
        this.notifyObservers();
    }

    /**
     * Advances one step of whatever phase the run is currently in.
     * Returns false if the run is already over, so callers can stop looping.
     */
    public processTurn(): boolean {
        /*
         * AUDIT-10 B3-01: a replay link's recorded commands fire here, before
         * the turn, because here is where a real one fires.
         *
         * The point in the cycle matters as much as the cycle. A player can
         * only press a Gamemaker button between turns — the simulation is
         * turn-stepped and nothing runs while the UI is waiting — so a recorded
         * command landed between turns, and a replay that fired it anywhere
         * else would reproduce the right command at the wrong moment. A first
         * draft drained the queue inside the day phase, just after the cycle
         * counter advanced, and the replayed run diverged from the one it was
         * replaying: same commands, same cycles, different world when they
         * landed. `npm run test:replay` is what caught it.
         */
        replayPlannedInterventions(this.ctx);
        if (this.state.phase === 'ended') return false;
        if (this.state.phase === 'epilogue') {
            // The epilogue is terminal for the simulation; the UI drives the
            // transition to 'ended'. Re-entering here used to replay the
            // interview every cycle and flooded the log.
            return false;
        }

        processAlliances(this.ctx);

        // REPLAY-01: this year's one scheduled disruption. Fired here rather
        // than inside the day phase because some wildcards change which phase
        // today is — an early feast replaces the day, and the phase dispatch
        // below has to see that.
        if (this.state.phase === 'day') fireScheduledWildcard(this.ctx);

        if (this.state.phase === 'day') {
            processDayNight(this.ctx, 'day');
            this.state.phase = 'night';
        } else if (this.state.phase === 'night') {
            processDayNight(this.ctx, 'night');
            this.state.day += 1;
            this.maybeAnnounceFeast();
            // A feast announced yesterday convenes today — the intervening day
            // and night were the journey, driven by the 'feast' objective. The
            // phase is set here rather than at the top of the next turn so the
            // UI actually renders a FEAST phase to advance into.
            this.state.phase = this.state.feastDay === this.state.day && this.state.config.enableFeast
                ? 'feast'
                : 'day';
        } else if (this.state.phase === 'feast') {
            // A feast replaces that day's day-phase rather than adding an
            // extra one — otherwise two "day" phases play out under the same
            // day number and the chronicle's day-grouped sections merge.
            processFeast(this.ctx);
            this.state.phase = 'night';
        }

        pruneDeadAlliances(this.ctx);
        this.maybeEndGames();
        this.notifyObservers();
        return true;
    }

    /**
     * One survivor ends the Games as it always did; §7.1 lets the right final
     * two end them together — a standing "two may win" rule, a district-pairs
     * Quarter Quell, or the lovers' nightlock standoff.
     */
    private maybeEndGames() {
        if (this.state.phase === 'ended' || this.state.phase === 'epilogue') return;
        const alive = getAlive(this.state).length;
        if (alive <= 1 || (alive === 2 && checkDualVictory(this.ctx))) {
            this.state.phase = 'epilogue';
            this.processEpilogue();
        }
    }

    /**
     * The Gamemakers call a feast when the field thins out. Previously the only
     * way to see a feast at all was to trigger one by hand in Gamemaker mode,
     * so the `enableFeast` setting did nothing in a normal run.
     */
    private maybeAnnounceFeast() {
        if (!this.state.config.enableFeast) return;

        // 'The Feast Quell': a feast every single night, no cap, no roll —
        // the ordinary scarcity/overdue logic below never even runs.
        if (wildcardIs(this.state, 'quell-feast-nightly')) {
            if (this.state.feastDay !== undefined) return;
            if (getAlive(this.state).length <= 2) return;
            this.state.feastDay = this.state.day + 1;
            // The proclamation is made once. `processFeast` clears `feastDay`
            // after every table, so without the flag the "one-time" line and
            // the theme announcement fired every single night of the Quell.
            if (!this.state.nightlyFeastProclaimed) {
                this.state.nightlyFeastProclaimed = true;
                this.ctx.logEvent(
                    'THE CAPITOL: there will be a feast every night this year, and nothing else worth eating.',
                    [], { important: true, category: 'feast' }
                );
                announceFeastTheme(this.ctx);
            } else {
                announceFeastTheme(this.ctx, true);
            }
            return;
        }

        if ((this.state.feastsHeld ?? 0) >= FEAST.maxFeasts) return;
        // One already announced and not yet convened — re-announcing would push
        // the date back a day every night and the table would never be laid.
        if (this.state.feastDay !== undefined) return;
        if (this.state.day < FEAST.earliestDay) return;

        const alive = getAlive(this.state).length;
        const total = this.state.tributes.length;
        const thinnedOut = alive <= Math.max(FEAST.thinnedOutFloor, Math.ceil(total * FEAST.thinnedOutShare));
        const overdue = this.state.day >= FEAST.overdueDay;
        if (!thinnedOut && !overdue) return;
        if (alive <= 2) return;

        const rng = new RNG(`${this.state.seed}-feast-call-${this.state.day}`);
        if (!rng.chance(FEAST.callChance)) return;

        // Announced a full day ahead: canon gives tributes the journey, and the
        // journey — driven by the 'feast' objective in the movement layer — is
        // where the tension lives. The feast itself convenes tomorrow.
        this.state.feastDay = this.state.day + 1;
        this.ctx.logEvent(rng.pick(FEAST_TEXTS.announce), [], { important: true, category: 'feast' });
        // §10.6: the table is themed, and the announcement says what is on it.
        announceFeastTheme(this.ctx);
    }

    public triggerGamemakerEvent(type: GamemakerEventType, targetId?: string) {
        triggerGamemakerEventPhase(this.ctx, type, targetId);
        this.maybeEndGames();
    }

    public processEpilogue() {
        processEpilogue(this.ctx);
    }
}
