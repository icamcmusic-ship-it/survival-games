import { GameState, LogOptions, Tribute } from '../models/types';
import { RNG } from '../utils/rng';

export interface SimContext {
    state: GameState;
    rng: RNG;
    logEvent(text: string, tributesInvolved: string[], options?: LogOptions | boolean, zone?: string): void;
    /**
     * Picks a flavour template, avoiding whatever was last drawn from the same
     * pool. Plain `rng.pick` happily printed the same sentence five times in a
     * row, which made the feed read like a stuck record.
     */
    pickText(pool: string[]): string;
}

export function getAlive(state: GameState): Tribute[] {
    return state.tributes.filter(t => t.status === 'alive');
}

export function createContext(state: GameState, rng: RNG): SimContext {
    const lastPicked = new WeakMap<string[], string>();

    const ctx: SimContext = {
        state,
        rng,
        pickText(pool) {
            if (pool.length === 0) return '';
            if (pool.length === 1) return pool[0];
            const previous = lastPicked.get(pool);
            const options = previous ? pool.filter(p => p !== previous) : pool;
            const chosen = ctx.rng.pick(options.length > 0 ? options : pool);
            lastPicked.set(pool, chosen);
            return chosen;
        },
        logEvent(text, tributesInvolved, options, zone) {
            // Legacy call shape: logEvent(text, ids, important, zone)
            const opts: LogOptions = typeof options === 'boolean'
                ? { important: options, zone }
                : { zone, ...(options || {}) };

            let resolvedZone = opts.zone ?? zone;
            if (!resolvedZone && tributesInvolved.length > 0) {
                const firstTribute = ctx.state.tributes.find(t => t.id === tributesInvolved[0]);
                if (firstTribute) {
                    resolvedZone = firstTribute.zone;
                }
            }

            // Monotonic counter: RNG-derived ids collided and produced duplicate React keys.
            const nextId = (ctx.state.logCounter ?? 0) + 1;
            ctx.state.logCounter = nextId;

            ctx.state.log.push({
                id: `e${nextId}`,
                day: ctx.state.day,
                phase: ctx.state.phase,
                text,
                tributesInvolved,
                important: opts.important ?? false,
                zone: resolvedZone,
                category: opts.category ?? 'system',
            });
        }
    };
    return ctx;
}
