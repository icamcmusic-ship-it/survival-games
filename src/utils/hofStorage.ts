import { HallOfFameEntry, TributeHoFSummary } from '../models/types';
import { LEGACY_KEYS, STORAGE_KEYS, StorageSpec, readStored, removeStored, writeStored } from './storage';

/**
 * Standalone read/write for the Hall of Fame archive.
 *
 * gameStore owns writing a *new* victor at the end of a run, but the Hall of Fame
 * screen also needs to import, merge and clear records. Importing gameStore here
 * would drag the whole simulator store (and its subscriptions) into a screen that
 * only ever touches storage, so the spec and cap live here — they are the
 * storage contract, not gameStore's private detail.
 */
export const HOF_STORAGE_KEY = STORAGE_KEYS.hallOfFame;

/** The archive evicts oldest-first past this many records; matches gameStore's slice(0, 50). */
export const HOF_CAP = 50;

/**
 * v0 — an unversioned bare array under `hungerGamesHoF`.
 * v1 — versioned envelope under `survivalGamesHallOfFame`. Same array; the
 *      rename is handled by `legacyKeys`, and per-record repair by
 *      `normalizeEntry`, which the archive has always run on read.
 */
export const HOF_SPEC: StorageSpec<HallOfFameEntry[]> = {
    key: STORAGE_KEYS.hallOfFame,
    version: 1,
    legacyKeys: LEGACY_KEYS.hallOfFame,
    migrate: raw => {
        if (!Array.isArray(raw)) return null;
        // Records written by older builds (or hand-edited by a player) can be missing
        // fields the screen indexes into, so everything read back is normalised once
        // here rather than defended against at every render site.
        return capWithPins(raw.map(normalizeEntry).filter((e): e is HallOfFameEntry => e !== null));
    },
};

export function readHallOfFame(): HallOfFameEntry[] {
    return readStored(HOF_SPEC) ?? [];
}

/**
 * Applies the archive cap while honouring pins: pinned entries are never
 * evicted, and unpinned ones fill the remaining space newest-first (list
 * order). If a player somehow pins more than the cap, the pins all survive —
 * the cap exists for storage hygiene, not to delete what they asked to keep.
 */
export function capWithPins(entries: HallOfFameEntry[], cap = HOF_CAP): HallOfFameEntry[] {
    if (entries.length <= cap) return entries;
    const kept: HallOfFameEntry[] = [];
    let unpinned = 0;
    const unpinnedBudget = Math.max(0, cap - entries.filter(e => e.pinned).length);
    for (const e of entries) {
        if (e.pinned) kept.push(e);
        else if (unpinned < unpinnedBudget) { kept.push(e); unpinned++; }
    }
    return kept;
}

export function writeHallOfFame(entries: HallOfFameEntry[]): void {
    writeStored(HOF_SPEC, capWithPins(entries));
}

export function clearHallOfFame(): void {
    removeStored(HOF_SPEC);
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeSummary(raw: unknown): TributeHoFSummary | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const name = asString(r.name);
    if (!name) return null;
    return {
        name,
        district: asNumber(r.district),
        kills: asNumber(r.kills),
        status: r.status === 'alive' ? 'alive' : 'dead',
        causeOfDeath: typeof r.causeOfDeath === 'string' ? r.causeOfDeath : undefined,
        dayOfDeath: typeof r.dayOfDeath === 'number' ? r.dayOfDeath : undefined
    };
}

/**
 * Coerce one unknown value into a HallOfFameEntry, or reject it.
 *
 * Import data is pasted by the player, so this must never throw: a single bad
 * record should be dropped, not take the whole import (or the archive) down.
 */
export function normalizeEntry(raw: unknown): HallOfFameEntry | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;

    const winnerName = asString(r.winnerName);
    if (!winnerName) return null;

    // A record with no usable date would sort unpredictably against real ones, so
    // fall back to the epoch rather than to "now" — an undated import should sink
    // to the bottom of "newest first", not jump the queue and evict a real victor.
    const parsedDate = Date.parse(asString(r.date));
    const date = Number.isNaN(parsedDate) ? new Date(0).toISOString() : new Date(parsedDate).toISOString();

    const summaries = Array.isArray(r.tributeSummaries)
        ? r.tributeSummaries.map(normalizeSummary).filter((s): s is TributeHoFSummary => s !== null)
        : undefined;

    // The replay fields (arenaId, config, quellId) and the wipeout/pin flags
    // must survive normalisation — this runs on every archive *read*, and
    // dropping them here silently broke exact relaunches of stored entries.
    const config = ((): HallOfFameEntry['config'] => {
        const c = r.config;
        if (!c || typeof c !== 'object' || Array.isArray(c)) return undefined;
        const rc = c as Record<string, unknown>;
        const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
        return {
            districtCount: Math.min(12, Math.max(2, Math.round(num(rc.districtCount, 12)))),
            hazardRate: num(rc.hazardRate, 1),
            betrayalRate: num(rc.betrayalRate, 1),
            sponsorGenerosity: num(rc.sponsorGenerosity, 1),
            enableFeast: typeof rc.enableFeast === 'boolean' ? rc.enableFeast : true,
            enableSanity: typeof rc.enableSanity === 'boolean' ? rc.enableSanity : true,
            plainNames: typeof rc.plainNames === 'boolean' ? rc.plainNames : false,
        };
    })();

    return {
        id: asString(r.id) || `imported-${date}-${winnerName}`,
        seed: asString(r.seed, 'unknown'),
        arenaName: asString(r.arenaName, 'Unknown Arena'),
        arenaId: typeof r.arenaId === 'string' ? r.arenaId : undefined,
        config,
        quellId: typeof r.quellId === 'string' || r.quellId === null ? r.quellId : undefined,
        noVictor: r.noVictor === true ? true : undefined,
        pinned: r.pinned === true ? true : undefined,
        winnerName,
        winnerDistrict: asNumber(r.winnerDistrict),
        kills: asNumber(r.kills),
        date,
        winnerTraits: Array.isArray(r.winnerTraits)
            ? r.winnerTraits.filter((t): t is string => typeof t === 'string')
            : undefined,
        winnerEndHealth: typeof r.winnerEndHealth === 'number' ? r.winnerEndHealth : undefined,
        tributeSummaries: summaries
    };
}

export interface ImportResult {
    ok: boolean;
    message: string;
    entries: HallOfFameEntry[];
}

/**
 * Merge imported JSON into the existing archive.
 *
 * De-duplicates on `id` (existing records win, so re-importing a backup is a no-op
 * rather than a way to silently rewrite history), then re-applies the cap keeping
 * the newest — which is the same eviction rule a normal victory save uses.
 */
export function importHallOfFame(rawJson: string, existing: HallOfFameEntry[]): ImportResult {
    let parsed: unknown;
    try {
        parsed = JSON.parse(rawJson);
    } catch {
        return { ok: false, message: 'That is not valid JSON. Paste the contents of an exported file.', entries: existing };
    }

    // Accept both a bare array and the wrapped `{ entries: [...] }` export envelope,
    // since players will copy whichever half of the file they happen to select.
    const list = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).entries)
            ? (parsed as { entries: unknown[] }).entries
            : null;

    if (!list) {
        return { ok: false, message: 'Expected a list of victor records (or an export file containing one).', entries: existing };
    }

    const incoming = list.map(normalizeEntry).filter((e): e is HallOfFameEntry => e !== null);
    const rejected = list.length - incoming.length;

    if (incoming.length === 0) {
        return {
            ok: false,
            message: rejected > 0
                ? `None of the ${rejected} record${rejected === 1 ? '' : 's'} in that file were readable victor records.`
                : 'That file contained no victor records.',
            entries: existing
        };
    }

    const seen = new Set(existing.map(e => e.id));
    const added = incoming.filter(e => !seen.has(e.id));
    const merged = [...existing, ...added].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    const capped = capWithPins(merged);
    const evicted = merged.length - capped.length;

    const parts = [`Imported ${added.length} new record${added.length === 1 ? '' : 's'}`];
    if (incoming.length - added.length > 0) parts.push(`${incoming.length - added.length} already on file`);
    if (rejected > 0) parts.push(`${rejected} unreadable and skipped`);
    if (evicted > 0) parts.push(`${evicted} oldest dropped at the ${HOF_CAP}-record cap`);

    return { ok: true, message: `${parts.join(' · ')}.`, entries: capped };
}

/** Stable, pretty-printed export envelope — versioned so a future format change can be detected. */
export function serializeHallOfFame(entries: HallOfFameEntry[]): string {
    return JSON.stringify(
        { format: 'hunger-games-hall-of-fame', version: 1, exportedAt: new Date().toISOString(), entries },
        null,
        2
    );
}
