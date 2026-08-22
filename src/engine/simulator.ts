import { GameState } from '../models/types';
import { RNG } from '../utils/rng';
import { snapshotState } from '../utils/snapshot';
import { SimContext, createContext, getAlive } from './context';
import { processTraining } from './phases/training';
import { processPreGames } from './phases/pregames';
import { processInterviews } from './phases/interviews';
import { startGames, processBloodbath } from './phases/bloodbath';
import { processAlliances } from './phases/alliances';
import { announceFeastTheme, processFeast } from './phases/feast';
import { processDayNight } from './phases/dayNight';
import { processEpilogue } from './phases/epilogue';
import { GamemakerEventType, triggerGamemakerEvent as triggerGamemakerEventPhase } from './gamemaker';
import { checkDualVictory } from './victory';
import { fireScheduledWildcard } from './wildcards';
import { FEAST_TEXTS } from '../data/flavorText';
import { wildcardIs } from './gamesProfile';

const MAX_FEASTS = 2;

export class Simulator {
    private state: GameState;
    private ctx: SimContext;

    constructor(initialState: GameState) {
        // Shared with the store's per-phase snapshot: structuredClone with a
        // JSON fallback. This runs on four hot paths (startGame, rerollCast,
        // confirmReaping, resumeSavedRun), so it gets the fast clone too.
        this.state = snapshotState(initialState);
        this.ctx = createContext(this.state, new RNG(`${this.state.seed}-${this.state.phase}-${this.state.day}`));
    }

    public getState(): GameState {
        return this.state;
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
    }

    public processInterviews() {
        processInterviews(this.ctx);
    }

    public startGames() {
        startGames(this.ctx);
    }

    public processBloodbath() {
        processBloodbath(this.ctx);
    }

    /**
     * Advances one step of whatever phase the run is currently in.
     * Returns false if the run is already over, so callers can stop looping.
     */
    public processTurn(): boolean {
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

        this.maybeEndGames();
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
            this.ctx.logEvent(
                'THE CAPITOL: there will be a feast every night this year, and nothing else worth eating.',
                [], { important: true, category: 'feast' }
            );
            announceFeastTheme(this.ctx);
            return;
        }

        if ((this.state.feastsHeld ?? 0) >= MAX_FEASTS) return;
        // One already announced and not yet convened — re-announcing would push
        // the date back a day every night and the table would never be laid.
        if (this.state.feastDay !== undefined) return;
        if (this.state.day < 3) return;

        const alive = getAlive(this.state).length;
        const total = this.state.tributes.length;
        const thinnedOut = alive <= Math.max(4, Math.ceil(total * 0.4));
        const overdue = this.state.day >= 6;
        if (!thinnedOut && !overdue) return;
        if (alive <= 2) return;

        const rng = new RNG(`${this.state.seed}-feast-call-${this.state.day}`);
        if (!rng.chance(0.6)) return;

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
