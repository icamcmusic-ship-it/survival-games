import { GameState } from '../models/types';
import { STALE_LINES } from '../data/balance';
import { lineHash } from './lineHash';
import { STORAGE_KEYS, StorageSpec, asRecord, readStored, writeStored } from './storage';

/**
 * AUDIT-11 §12: text anti-staleness across sessions.
 *
 * `pickText` already rotates a pool within one run. Across runs the same
 * opening lines came round every session. This remembers which templates the
 * player has recently been shown — as short hashes with the day they were
 * seen, pruned to `STALE_LINES.windowDays` and capped at `STALE_LINES.cap` —
 * and hands the set to a new run as a snapshot on its state, so the engine
 * never reads storage and a save rewords the way it first did.
 */
export interface RecentLines {
    /** hash -> day number (days since epoch) last seen. */
    seen: Record<string, number>;
    /** AUDIT-14 P7: hash -> the run counter when it was last seen. */
    seenRun?: Record<string, number>;
    /** AUDIT-14 P7: runs noted so far. */
    run?: number;
}

/**
 * v1 — `seen` only (hash -> day).
 * v2 — AUDIT-14 P7: plus `seenRun` (hash -> run) and the `run` counter. A v1
 *      store reads with no run memory, which is what it had.
 */
export const RECENT_LINES_SPEC: StorageSpec<RecentLines> = {
    key: STORAGE_KEYS.recentLines,
    version: 2,
    migrate: raw => {
        const r = asRecord(raw);
        const clean = (value: unknown): Record<string, number> => {
            const out: Record<string, number> = {};
            Object.entries(asRecord(value) ?? {}).forEach(([k, v]) => {
                if (typeof v === 'number' && Number.isFinite(v) && k.length <= 16) out[k] = v;
            });
            return out;
        };
        const seen = clean(r?.seen);
        const seenRun = clean(r?.seenRun);
        const run = typeof r?.run === 'number' && Number.isFinite(r.run) && r.run >= 0 ? Math.floor(r.run) : 0;
        return Object.keys(seenRun).length > 0 || run > 0 ? { seen, seenRun, run } : { seen };
    },
};

function today(now = Date.now()): number {
    // balance-exempt: milliseconds in a day
    return Math.floor(now / 86_400_000);
}

/**
 * A template stays remembered while it is inside the day window *or* the run
 * window (AUDIT-14 P7), newest first, up to the cap.
 */
function prune(lines: RecentLines, day: number): RecentLines {
    const run = lines.run ?? 0;
    const seenRun = lines.seenRun ?? {};
    const fresh = (k: string) => day - (lines.seen[k] ?? -Infinity) < STALE_LINES.windowDays
        || (seenRun[k] !== undefined && run - seenRun[k] < STALE_LINES.windowRuns);
    const kept = Object.keys(lines.seen)
        .filter(fresh)
        .sort((a, b) => (seenRun[b] ?? 0) - (seenRun[a] ?? 0) || lines.seen[b] - lines.seen[a])
        .slice(0, STALE_LINES.cap);
    return {
        seen: Object.fromEntries(kept.map(k => [k, lines.seen[k]])),
        seenRun: Object.fromEntries(kept.filter(k => seenRun[k] !== undefined).map(k => [k, seenRun[k]])),
        run,
    };
}

/** The stale set a new run should start with. */
export function readStaleLines(): string[] {
    const stored = readStored(RECENT_LINES_SPEC);
    if (!stored) return [];
    return Object.keys(prune(stored, today()).seen);
}

/** Folds a finished (or abandoned) run's used templates into the memory. */
export function noteRunLines(state: GameState): void {
    // The lines the player was shown, not the ones drawn: a stale substitution
    // shows a different line than the rotation recorded.
    const used = state.shownText ?? state.usedText;
    if (!used) return;
    const day = today();
    const stored = readStored(RECENT_LINES_SPEC);
    const run = (stored?.run ?? 0) + 1;
    const seen = { ...(stored?.seen ?? {}) };
    const seenRun = { ...(stored?.seenRun ?? {}) };
    Object.values(used).forEach(lines => (lines ?? []).forEach(line => {
        const h = lineHash(line);
        seen[h] = day;
        seenRun[h] = run;
    }));
    writeStored(RECENT_LINES_SPEC, prune({ seen, seenRun, run }, day));
}
