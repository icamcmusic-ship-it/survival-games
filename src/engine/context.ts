import { GameState, Tribute } from '../models/types';
import { RNG } from '../utils/rng';

export interface SimContext {
    state: GameState;
    rng: RNG;
    logEvent(text: string, tributesInvolved: string[], important?: boolean, zone?: string): void;
}

export function getAlive(state: GameState): Tribute[] {
    return state.tributes.filter(t => t.status === 'alive');
}

export function createContext(state: GameState, rng: RNG): SimContext {
    const ctx: SimContext = {
        state,
        rng,
        logEvent(text, tributesInvolved, important = false, zone) {
            let resolvedZone = zone;
            if (!resolvedZone && tributesInvolved.length > 0) {
                const firstTribute = ctx.state.tributes.find(t => t.id === tributesInvolved[0]);
                if (firstTribute) {
                    resolvedZone = firstTribute.zone;
                }
            }
            ctx.state.log.push({
                id: ctx.rng.nextInt(0, 1000000).toString(),
                day: ctx.state.day,
                phase: ctx.state.phase,
                text,
                tributesInvolved,
                important,
                zone: resolvedZone
            });
        }
    };
    return ctx;
}
