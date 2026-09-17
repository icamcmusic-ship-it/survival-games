import { GameState, LogOptions, Phase, Tribute } from '../models/types';
import { RNG } from '../utils/rng';

/**
 * §13 (requests): the arena clock.
 *
 * Every log line carries a timestamp now, and it is an *in-arena* time, not a
 * wall clock — a chronicle is a record of the Games, and the reader wants to
 * know it was two in the morning, not that they pressed a key at 19:04.
 *
 * The clock is derived, never stored as a running value: a phase owns a window
 * of the day, and a line's stamp is its position within that window. That
 * keeps it exactly as deterministic as everything else in the engine — the
 * same seed replays the same Games with the same times on it — and it means no
 * phase can ever hand out a stamp outside its own window however many lines it
 * produces.
 *
 * The day phase runs 06:00-18:00 and the night phase 18:00-06:00. The
 * pre-arena ceremonies get the hour they would actually be held at.
 */
const PHASE_WINDOWS: Record<Phase, { start: number; minutes: number }> = {
    // Day 0, in broadcast order.
    setup: { start: 8 * 60, minutes: 60 },
    roster: { start: 8 * 60, minutes: 60 },
    reaping: { start: 10 * 60, minutes: 120 },
    training: { start: 9 * 60, minutes: 8 * 60 },
    interviews: { start: 19 * 60, minutes: 3 * 60 },
    // In the arena.
    bloodbath: { start: 10 * 60, minutes: 60 },
    day: { start: 6 * 60, minutes: 12 * 60 },
    night: { start: 18 * 60, minutes: 12 * 60 },
    feast: { start: 12 * 60, minutes: 2 * 60 },
    epilogue: { start: 12 * 60, minutes: 60 },
    ended: { start: 12 * 60, minutes: 60 },
};

/** Minutes past midnight -> `21:40`. */
function hhmm(minutes: number): string {
    const wrapped = ((minutes % 1440) + 1440) % 1440;
    const h = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * The stamp for the next line of this phase, advancing the phase's own line
 * counter. Lines are spread evenly across the phase window and then clamped a
 * minute short of its end, so a long day never spills into the night.
 */
export function arenaClock(state: GameState): string {
    const key = `${state.day}:${state.phase}`;
    if (state.clockPhaseKey !== key) {
        state.clockPhaseKey = key;
        state.clockPhaseLines = 0;
    }
    const index = state.clockPhaseLines ?? 0;
    state.clockPhaseLines = index + 1;

    const window = PHASE_WINDOWS[state.phase] ?? PHASE_WINDOWS.day;
    // Four minutes a line reads at about the pace a phase actually contains:
    // a busy day fills its twelve hours, a quiet one finishes by mid-morning.
    const offset = Math.min(window.minutes - 1, index * 4);
    const stamp = hhmm(window.start + offset);
    // Day 0 is the ceremonies; everything after it is a day in the arena.
    return state.day <= 0 ? stamp : `D${state.day} ${stamp}`;
}

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
                clock: arenaClock(ctx.state),
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
