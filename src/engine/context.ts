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
    /**
     * The order zones fail in during border collapse, memoised per run.
     *
     * It used to live in a module-level `Map` in dayNight.ts — the one piece
     * of global mutable state in an otherwise seeded/pure engine, cleared
     * crudely at 32 entries with no real invalidation. A `SimContext` already
     * lives exactly as long as one `Simulator`/run and is thrown away with it,
     * which is the scope this cache actually needs: no cross-run leakage, no
     * size cap to tune, and it stops being a problem the moment two runs (two
     * tabs, a server-side batch) exist at the same time. Undefined until the
     * first border-collapse cycle computes it.
     */
    collapseOrder?: string[];
}

export function getAlive(state: GameState): Tribute[] {
    return state.tributes.filter(t => t.status === 'alive');
}

export function createContext(state: GameState, rng: RNG): SimContext {
    const ctx: SimContext = {
        state,
        rng,
        collapseOrder: undefined,
        pickText(pool) {
            if (pool.length === 0) return '';
            if (pool.length === 1) return pool[0];
            // The anti-repeat memory lives on the state, not in a
            // context-local WeakMap: a save/resume constructs a fresh
            // Simulator, and a context-local map reset there — the resumed
            // run produced the same outcomes with different wording, quietly
            // breaking the "same seed replays the same Games" promise. The
            // pool's first line is a stable identity for a static template
            // array.
            const memory = state.lastPickedText ?? (state.lastPickedText = {});
            const previous = memory[pool[0]];
            const options = previous !== undefined ? pool.filter(p => p !== previous) : pool;
            const chosen = ctx.rng.pick(options.length > 0 ? options : pool);
            memory[pool[0]] = chosen;
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
