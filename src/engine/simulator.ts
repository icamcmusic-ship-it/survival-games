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

    public processTurn() {
        processAlliances(this.ctx);

        if (this.state.phase === 'day') {
            processDayNight(this.ctx, 'day');
            this.state.phase = 'night';
        } else if (this.state.phase === 'night') {
            processDayNight(this.ctx, 'night');
            this.state.day += 1;
            this.state.phase = 'day';
        } else if (this.state.phase === 'feast') {
            processFeast(this.ctx);
            this.state.phase = 'day';
        }

        if (getAlive(this.state).length <= 1) {
            this.state.phase = 'epilogue';
            this.processEpilogue();
        }
    }

    public triggerGamemakerEvent(type: 'mutt' | 'weather' | 'feast', targetId?: string) {
        triggerGamemakerEventPhase(this.ctx, type, targetId);
    }

    public processEpilogue() {
        processEpilogue(this.ctx);
    }
}
