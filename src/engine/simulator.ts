import { GameState } from '../models/types';
import { RNG } from '../utils/rng';
import { SimContext, createContext, getAlive } from './context';
import { processTraining } from './phases/training';
import { processInterviews } from './phases/interviews';
import { startGames, processBloodbath } from './phases/bloodbath';
import { processAlliances } from './phases/alliances';
import { processFeast } from './phases/feast';
import { processDayNight } from './phases/dayNight';
import { processEpilogue } from './phases/epilogue';
import { triggerGamemakerEvent as triggerGamemakerEventPhase } from './gamemaker';
import { FEAST_TEXTS } from '../data/flavorText';

const MAX_FEASTS = 2;

export class Simulator {
    private state: GameState;
    private ctx: SimContext;

    constructor(initialState: GameState) {
        this.state = JSON.parse(JSON.stringify(initialState));
        this.ctx = createContext(this.state, new RNG(`${this.state.seed}-${this.state.phase}-${this.state.day}`));
    }

    public getState(): GameState {
        return this.state;
    }

    /** True once the run can no longer advance — used to stop auto-play and run-to-end loops. */
    public isFinished(): boolean {
        return this.state.phase === 'ended';
    }

    public processTraining() {
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

        if (this.state.phase === 'day') {
            processDayNight(this.ctx, 'day');
            this.state.phase = 'night';
        } else if (this.state.phase === 'night') {
            processDayNight(this.ctx, 'night');
            this.state.day += 1;
            this.state.phase = 'day';
            this.maybeAnnounceFeast();
        } else if (this.state.phase === 'feast') {
            // A feast replaces that day's day-phase rather than adding an
            // extra one — otherwise two "day" phases play out under the same
            // day number and the chronicle's day-grouped sections merge.
            processFeast(this.ctx);
            this.state.phase = 'night';
        }

        if (getAlive(this.state).length <= 1) {
            this.state.phase = 'epilogue';
            this.processEpilogue();
        }
        return true;
    }

    /**
     * The Gamemakers call a feast when the field thins out. Previously the only
     * way to see a feast at all was to trigger one by hand in Gamemaker mode,
     * so the `enableFeast` setting did nothing in a normal run.
     */
    private maybeAnnounceFeast() {
        if (!this.state.config.enableFeast) return;
        if ((this.state.feastsHeld ?? 0) >= MAX_FEASTS) return;
        if (this.state.day < 3) return;

        const alive = getAlive(this.state).length;
        const total = this.state.tributes.length;
        const thinnedOut = alive <= Math.max(4, Math.ceil(total * 0.4));
        const overdue = this.state.day >= 6;
        if (!thinnedOut && !overdue) return;
        if (alive <= 2) return;

        const rng = new RNG(`${this.state.seed}-feast-call-${this.state.day}`);
        if (!rng.chance(0.6)) return;

        this.state.phase = 'feast';
        this.state.feastDay = this.state.day;
        this.ctx.rng = rng;
        this.ctx.logEvent(rng.pick(FEAST_TEXTS.announce), [], { important: true, category: 'feast' });
    }

    public triggerGamemakerEvent(type: 'mutt' | 'weather' | 'feast', targetId?: string) {
        triggerGamemakerEventPhase(this.ctx, type, targetId);
        if (getAlive(this.state).length <= 1 && this.state.phase !== 'ended' && this.state.phase !== 'epilogue') {
            this.state.phase = 'epilogue';
            this.processEpilogue();
        }
    }

    public processEpilogue() {
        processEpilogue(this.ctx);
    }
}
