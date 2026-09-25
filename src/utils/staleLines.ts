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
}

export const RECENT_LINES_SPEC: StorageSpec<RecentLines> = {
    key: STORAGE_KEYS.recentLines,
    version: 1,
    migrate: raw => {
        const r = asRecord(raw);
        const seen = asRecord(r?.seen);
        if (!seen) return { seen: {} };
        const out: Record<string, number> = {};
        Object.entries(seen).forEach(([k, v]) => {
            if (typeof v === 'number' && Number.isFinite(v) && k.length <= 16) out[k] = v;
        });
        return { seen: out };
    },
};

function today(now = Date.now()): number {
    // balance-exempt: milliseconds in a day
    return Math.floor(now / 86_400_000);
}

function prune(seen: Record<string, number>, day: number): Record<string, number> {
    const kept = Object.entries(seen)
        .filter(([, d]) => day - d < STALE_LINES.windowDays)
        .sort((a, b) => b[1] - a[1])
        .slice(0, STALE_LINES.cap);
    return Object.fromEntries(kept);
}

/** The stale set a new run should start with. */
export function readStaleLines(): string[] {
    const stored = readStored(RECENT_LINES_SPEC);
    if (!stored) return [];
    return Object.keys(prune(stored.seen, today()));
}

/** Folds a finished (or abandoned) run's used templates into the memory. */
export function noteRunLines(state: GameState): void {
    const used = state.usedText;
    if (!used) return;
    const day = today();
    const seen = { ...(readStored(RECENT_LINES_SPEC)?.seen ?? {}) };
    Object.values(used).forEach(lines => (lines ?? []).forEach(line => { seen[lineHash(line)] = day; }));
    writeStored(RECENT_LINES_SPEC, { seen: prune(seen, day) });
}
