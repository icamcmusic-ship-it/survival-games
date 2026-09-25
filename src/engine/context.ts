import { STORY_PACING } from '../data/balance';
import { GameState, LogOptions, Phase, Tribute } from '../models/types';
import { lineHash } from '../utils/lineHash';
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
/**
 * §(requests 20): the spacing is per phase, and it is measured.
 *
 * It used to be four minutes a line for every phase, which is fine for a day
 * phase and nonsense for a bloodbath: the bloodbath writes a mean of 158 lines
 * (max 207) into a sixty-minute window, so from the sixteenth line onward every
 * stamp clamped to the same minute. Measured across 25 runs, **23.3% of all
 * stamps were duplicates**, 3,554 of them in the bloodbath alone.
 *
 * `secondsPerLine` is now sized against the measured worst case for each phase
 * so a phase cannot run out of clock, and a phase whose lines land less than a
 * minute apart is stamped to the second — which is what a bloodbath actually
 * is. Everything else keeps `HH:MM`.
 */
const PHASE_WINDOWS: Record<Phase, { start: number; minutes: number; secondsPerLine: number }> = {
    // Day 0, in broadcast order.
    setup: { start: 8 * 60, minutes: 60, secondsPerLine: 120 },
    roster: { start: 8 * 60, minutes: 60, secondsPerLine: 120 },
    reaping: { start: 10 * 60, minutes: 120, secondsPerLine: 120 },
    // max 85 lines over 180 minutes
    square: { start: 10 * 60, minutes: 3 * 60, secondsPerLine: 110 },
    // max 24 lines over 360 minutes
    train: { start: 14 * 60, minutes: 6 * 60, secondsPerLine: 600 },
    // max 26 lines over 120 minutes
    parade: { start: 20 * 60, minutes: 2 * 60, secondsPerLine: 240 },
    // max 43 lines over 480 minutes
    training: { start: 9 * 60, minutes: 8 * 60, secondsPerLine: 600 },
    training1: { start: 9 * 60, minutes: 8 * 60, secondsPerLine: 600 },
    training2: { start: 9 * 60, minutes: 8 * 60, secondsPerLine: 600 },
    training3: { start: 9 * 60, minutes: 8 * 60, secondsPerLine: 600 },
    // max 46 lines over 60 minutes
    scores: { start: 19 * 60, minutes: 60, secondsPerLine: 70 },
    // max 139 lines over 180 minutes
    interviews: { start: 19 * 60, minutes: 3 * 60, secondsPerLine: 70 },
    // In the arena. The bloodbath is the one phase dense enough to need
    // seconds: 207 lines in an hour is a line every seventeen seconds, and
    // that is genuinely how fast it happens.
    bloodbath: { start: 10 * 60, minutes: 60, secondsPerLine: 15 },
    day: { start: 6 * 60, minutes: 12 * 60, secondsPerLine: 300 },
    night: { start: 18 * 60, minutes: 12 * 60, secondsPerLine: 360 },
    feast: { start: 12 * 60, minutes: 2 * 60, secondsPerLine: 80 },
    epilogue: { start: 12 * 60, minutes: 60, secondsPerLine: 120 },
    ended: { start: 12 * 60, minutes: 60, secondsPerLine: 120 },
};

/** Seconds past midnight -> `21:40`, or `21:40:07` when the phase needs them. */
function clockFace(totalSeconds: number, withSeconds: boolean): string {
    const wrapped = ((totalSeconds % 86400) + 86400) % 86400;
    const h = Math.floor(wrapped / 3600);
    const m = Math.floor((wrapped % 3600) / 60);
    const s = wrapped % 60;
    const hm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return withSeconds ? `${hm}:${String(s).padStart(2, '0')}` : hm;
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
    // Sized so the measured worst case for this phase still fits inside its
    // window; the clamp is a backstop for an outlier run rather than the
    // normal case it used to be.
    const offset = Math.min(window.minutes * 60 - 1, index * window.secondsPerLine);
    // balance-exempt: a minute is sixty seconds, not a tunable
    const stamp = clockFace(window.start * 60 + offset, window.secondsPerLine < 60);
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
    let staleSet: Set<string> | undefined;
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
            /*
             * §(requests): "limit repeat entries across entire games".
             *
             * The anti-repeat memory was one line deep — it avoided whatever
             * was drawn *last* from this pool and nothing before that. Over a
             * twelve-day run with hundreds of draws from a pool of eight, the
             * same four sentences came round and round, which is most of why
             * the chronicle reads repetitive. It is also why a long run feels
             * like a shorter one: the feed stops carrying new information
             * before the Games stop producing it.
             *
             * The memory is a *used set* per pool instead: a sentence is not
             * drawn again until every other sentence in the pool has been. When
             * the pool is exhausted it resets, minus the one just used, so the
             * cycle cannot begin with an immediate repeat of the line that
             * ended the last one. That turns a pool of eight from "four
             * sentences on rotation" into eight sentences before any of them
             * comes back.
             *
             * Still on the state, still keyed by the pool's first line, so it
             * serialises with the save exactly as the single-entry version did
             * and a resumed run continues the same rotation.
             */
            const memory = state.lastPickedText ?? (state.lastPickedText = {});
            const used = state.usedText ?? (state.usedText = {});
            const seen = used[pool[0]] ?? [];
            let options = pool.filter(p => !seen.includes(p));
            if (options.length === 0) {
                // Exhausted: start the rotation again, but never with the line
                // that closed the previous one.
                const previous = memory[pool[0]];
                options = previous !== undefined ? pool.filter(p => p !== previous) : pool;
                used[pool[0]] = [];
            }
            // AUDIT-9 B12: narration draws from its own stream, never from
            // `ctx.rng`. On the shared stream the *size of a prose pool* was a
            // mechanical input: a one-entry pool short-circuits above and
            // consumes nothing, a two-entry pool consumes a draw, so adding a
            // second sentence to a flavour list moved every roll after it and
            // changed who lived. The per-draw seed keeps narration fully
            // deterministic — same seed, same words — while making the
            // mechanical stream blind to how much prose was written.
            const draw = state.proseDraws ?? 0;
            state.proseDraws = draw + 1;
            const candidates = options.length > 0 ? options : pool;
            const drawn = new RNG(`${state.seed}-prose-${draw}`).pick(candidates);
            let chosen = drawn;
            // AUDIT-11 §12: lines this player saw in recent sessions are
            // passed over for the next unseen one in the pool, walking from
            // the drawn index. Selection only — no extra draw — and the stale
            // set is snapshotted onto the state, so a save rewords identically.
            if (state.staleLines && state.staleLines.length > 0) {
                const stale = staleSet ?? (staleSet = new Set(state.staleLines));
                if (stale.has(lineHash(chosen))) {
                    // Only a line with exactly the same `{token}` slots may
                    // stand in: some callers branch on a template's tokens
                    // (a `{watcher}` line names and draws a witness), so a
                    // swap across slot shapes would change the Games, not
                    // just its wording — and a share link carries no stale set.
                    // The rotation below still records the *drawn* line, so
                    // every later draw sees the same pool state it would have.
                    const shape = slotShape(drawn);
                    const at = pool.indexOf(drawn);
                    const seenThisRun = used[pool[0]] ?? [];
                    let fallback: string | undefined;
                    for (let k = 1; k < pool.length; k++) {
                        const next = pool[(at + k) % pool.length];
                        if (stale.has(lineHash(next)) || slotShape(next) !== shape) continue;
                        if (!seenThisRun.includes(next)) { chosen = next; fallback = undefined; break; }
                        fallback = fallback ?? next;
                    }
                    if (fallback !== undefined && chosen === drawn) chosen = fallback;
                }
            }
            memory[pool[0]] = drawn;
            used[pool[0]] = [...(used[pool[0]] ?? []), drawn];
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

            /*
             * §16 / batch 6: story-aware scheduling, on the one axis where
             * scheduling is honest.
             *
             * `pickText` above refuses to repeat a *sentence* until its pool
             * is exhausted. Nothing noticed the same *kind* of thing happening
             * over and over in fresh wording: measured across the Games proper,
             * 44.1% of headlined lines repeat the category of the line before,
             * and the longest unbroken run of headlined combat is 38.
             *
             * The clustering is correct and is deliberately left alone — a
             * fight produces fight lines, and forcing variety on consequences
             * would falsify the run. This demotes the fifth consecutive
             * headline of one category out of the headline feed. The event
             * still happens, still goes in the chronicle, and is still
             * filterable; the broadcast simply stops shouting.
             *
             * Deaths, kills and Gamemaker interventions are never demoted: a
             * broadcast cannot decline to lead with a cannon, and a run of
             * Gamemaker beats *is* the story rather than a monotony.
             */
            const category = opts.category ?? 'system';
            let important = opts.important ?? false;
            if (important) {
                const recent = ctx.state.recentHeadlines ?? (ctx.state.recentHeadlines = []);
                const bar = STORY_PACING.sameCategoryHeadlines;
                const protectedCategory = STORY_PACING.neverDemoted.includes(category);
                if (!protectedCategory
                    && recent.length >= bar
                    && recent.slice(-bar).every(c => c === category)) {
                    important = false;
                } else {
                    recent.push(category);
                    if (recent.length > bar) recent.splice(0, recent.length - bar);
                }
            }

            ctx.state.log.push({
                id: `e${nextId}`,
                day: ctx.state.day,
                phase: ctx.state.phase,
                clock: arenaClock(ctx.state),
                text,
                tributesInvolved,
                important,
                zone: resolvedZone,
                category,
                // §(requests): the stripped-down chronicle's version of this
                // line, where the caller knows something the prose does not
                // say outright. Derived from the entry elsewhere.
                fact: opts.fact,
                // AUDIT-9 B18: presence and mention are different facts, and
                // so are acting and being listed first.
                absentIds: opts.absentIds,
                actorId: opts.actorId,
                // AUDIT-9: the structured kind, where the beat is one
                // something measures. See `EventType`.
                type: opts.type,
                // The actor, where the caller named one; otherwise only where
                // the first-listed tribute is unambiguously acting (a solo
                // beat, or a kill, which lists the killer first).
                why: important
                    ? compactWhy(ctx.state, opts.actorId
                        ?? (tributesInvolved.length === 1 || category === 'kill' ? tributesInvolved[0] : undefined))
                    : undefined,
            });
        }
    };
    return ctx;
}

/**
 * AUDIT-11 §4: the reasoning chip's text, read from a decision trace the
 * stance scorer already wrote this cycle. Headline beats only, capped at 90
 * characters, so a save grows by a few KB at most.
 */
export function compactWhy(state: GameState, actorId: string | undefined): string | undefined {
    if (!actorId) return undefined;
    const t = state.tributes.find(x => x.id === actorId);
    const trace = t?.decisionTrace;
    if (!t || !trace || trace.cycle !== (state.cycle ?? 0)) return undefined;
    let out: string;
    if (trace.forced) out = `Not choosing: ${trace.forced}`;
    else if (trace.held) out = `${trace.held.stance}, held: ${trace.held.because}`;
    else {
        const top = trace.stances[0];
        if (!top) return undefined;
        const reasons = top.reasons.slice(0, 2).map(r => r.label).join(', ');
        out = reasons ? `${top.stance}: ${reasons}` : top.stance;
    }
    const goal = trace.objectives?.[0]?.label;
    if (goal) out += ` · ${goal.toLowerCase()}`;
    return out.length > 90 ? `${out.slice(0, 89)}…` : out;
}


/** AUDIT-11 §12: a template's `{token}` slots, sorted — its mechanical shape. */
function slotShape(line: string): string {
    return [...new Set(line.match(/\{[a-zA-Z0-9_]+\}/g) ?? [])].sort().join('');
}
