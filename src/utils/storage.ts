/**
 * The one place that knows what this game keeps in localStorage.
 *
 * Two problems this replaces:
 *
 * 1. No schema versioning. Every payload was written as a bare `JSON.stringify`
 *    and read back with a shallow truthiness check, so a save written by an
 *    older build — with a `Tribute` missing a dozen fields the current engine
 *    reads — loaded straight into the simulator and was defended against, if at
 *    all, by scattered `??` guards at the point of use.
 * 2. Four naming conventions across five keys (`hungerGamesHoF`,
 *    `capitolCoins`, `survivalGamesSave`, …).
 *
 * Everything now goes through a versioned envelope:
 *
 *     { v: <number>, data: <payload> }
 *
 * Anything read back that is *not* that envelope is legacy data written before
 * versioning existed. It is treated as version 0 and run through the same
 * migration chain, never discarded — players have saves, Halls of Fame and coin
 * balances on disk right now.
 *
 * Key renames are handled the same way: a `StorageSpec` may list `legacyKeys`,
 * which are read (newest convention first), migrated, rewritten under the
 * canonical key, and then removed.
 */

/** Canonical key names. One convention: `survivalGames<Thing>`. */
export const STORAGE_KEYS = {
    savedRun: 'survivalGamesSave',
    hallOfFame: 'survivalGamesHallOfFame',
    coins: 'survivalGamesCoins',
    panem: 'survivalGamesPanem',
    feedFilters: 'survivalGamesFeedFilters',
    lastConfig: 'survivalGamesLastConfig',
    prefs: 'survivalGamesPrefs',
    saveSlot2: 'survivalGamesSaveSlot2',
    saveSlot3: 'survivalGamesSaveSlot3',
} as const;

/**
 * Old key names, per payload, oldest build last. Read once, migrated, rewritten
 * under the canonical key and deleted. Kept forever-ish: there is no server to
 * tell us every player has upgraded.
 */
export const LEGACY_KEYS: Partial<Record<keyof typeof STORAGE_KEYS, string[]>> = {
    hallOfFame: ['hungerGamesHoF'],
    coins: ['capitolCoins'],
};

/** The envelope every payload is written inside. */
export interface Envelope<T> {
    /** Schema version of `data`. */
    v: number;
    data: T;
}

export interface StorageSpec<T> {
    /** Canonical key. */
    key: string;
    /** Current schema version. Bump when the payload shape changes. */
    version: number;
    /** Old key names to adopt on first read. */
    legacyKeys?: string[];
    /**
     * Migrate one decoded payload from `from` to the current version.
     * `from` is 0 for unversioned legacy data. Returns null to reject the
     * payload entirely (corrupt beyond repair), which reads as "no saved data".
     *
     * Implementations must be total: they are handed genuinely unknown values
     * (hand-edited files, half-written quota failures) and must not throw.
     */
    migrate: (raw: unknown, from: number) => T | null;
}

/* -------------------------------------------------------------------------- */
/* Backend                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Everything below is written against this, not against the global, for two
 * reasons: Safari Private Browsing throws on `localStorage` access itself
 * (before React mounts), and the migration chain has to be exercisable from a
 * plain node script.
 */
export interface StorageBackend {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

function memoryBackend(): StorageBackend {
    const map = new Map<string, string>();
    return {
        getItem: k => (map.has(k) ? map.get(k)! : null),
        setItem: (k, v) => { map.set(k, v); },
        removeItem: k => { map.delete(k); },
    };
}

let backend: StorageBackend | null = null;

function getBackend(): StorageBackend {
    if (backend) return backend;
    try {
        // Touch it: the throw happens on access, not on use.
        const ls = globalThis.localStorage;
        if (ls) {
            ls.getItem(STORAGE_KEYS.savedRun);
            backend = ls;
            return backend;
        }
    } catch {
        /* fall through to the in-memory stand-in */
    }
    backend = memoryBackend();
    return backend;
}

/** Test hook: swap in a fake store (and reset with `setStorageBackend(null)`). */
export function setStorageBackend(next: StorageBackend | null): void {
    backend = next;
}

/* -------------------------------------------------------------------------- */
/* Envelope handling                                                          */
/* -------------------------------------------------------------------------- */

function isEnvelope(value: unknown): value is Envelope<unknown> {
    return !!value
        && typeof value === 'object'
        && !Array.isArray(value)
        && typeof (value as Record<string, unknown>).v === 'number'
        && 'data' in (value as Record<string, unknown>);
}

/**
 * Split a raw string into `{ payload, version }`, where an unversioned payload
 * reports version 0. Returns null when the string is not JSON at all.
 */
export function decodeEnvelope(raw: string): { payload: unknown; version: number } | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (isEnvelope(parsed)) {
        // A payload claiming a version from the future is not something this
        // build can reason about; treat it as unreadable rather than guessing.
        return { payload: parsed.data, version: parsed.v };
    }
    return { payload: parsed, version: 0 };
}

/**
 * Read, migrating from whatever is on disk (including a legacy key name).
 *
 * Never throws. Corrupt, unparseable, rejected or future-versioned data all
 * degrade to `null` — "no saved data" — rather than a white screen.
 */
export function readStored<T>(spec: StorageSpec<T>): T | null {
    const store = getBackend();

    const candidates = [spec.key, ...(spec.legacyKeys ?? [])];
    for (const key of candidates) {
        let raw: string | null;
        try {
            raw = store.getItem(key);
        } catch {
            return null;
        }
        if (raw === null || raw === '') continue;

        const decoded = decodeEnvelope(raw);
        if (!decoded) {
            // Unparseable. Drop it so the next write starts clean rather than
            // re-failing forever.
            safeRemove(store, key);
            continue;
        }
        if (decoded.version > spec.version) {
            // Written by a newer build. Leave it alone — downgrading a player's
            // data is worse than showing them "no saved run" on an old tab.
            return null;
        }

        let value: T | null;
        try {
            value = spec.migrate(decoded.payload, decoded.version);
        } catch {
            value = null;
        }
        if (value === null) {
            safeRemove(store, key);
            continue;
        }

        // Adopt: rewrite under the canonical key at the current version, and
        // retire the old key so this only happens once.
        if (key !== spec.key || decoded.version !== spec.version) {
            writeStored(spec, value);
            if (key !== spec.key) safeRemove(store, key);
        }
        return value;
    }
    return null;
}

/**
 * Like `writeStored`, but reports what happened instead of swallowing it.
 * The saved-run writer needs the distinction: on 'quota' it retries with a
 * progressively shorter chronicle tail, while 'unavailable' (private mode, a
 * sandboxed iframe) means no retry can ever succeed and it should stop.
 */
export function tryWriteStored<T>(spec: StorageSpec<T>, data: T): 'ok' | 'quota' | 'unavailable' {
    try {
        const envelope: Envelope<T> = { v: spec.version, data };
        getBackend().setItem(spec.key, JSON.stringify(envelope));
        return 'ok';
    } catch (err) {
        const quota = err instanceof DOMException
            && (err.name === 'QuotaExceededError'
                || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
                // Legacy WebKit reports the quota code without the modern name.
                || err.code === 22);
        return quota ? 'quota' : 'unavailable';
    }
}

export function writeStored<T>(spec: StorageSpec<T>, data: T): void {
    // Result deliberately dropped — for most payloads the in-memory state is
    // still correct and there is nothing useful to do about a failed write.
    tryWriteStored(spec, data);
}

/** Remove the canonical key and every legacy alias for it. */
export function removeStored<T>(spec: StorageSpec<T>): void {
    const store = getBackend();
    safeRemove(store, spec.key);
    (spec.legacyKeys ?? []).forEach(k => safeRemove(store, k));
}

/**
 * Everything this app has ever written, gone.
 *
 * `clearPanem` removes exactly one of the nine canonical keys, so what the
 * Hall of Fame offered as a reset left coins, the Hall of Fame archive, prefs,
 * feed filters, the last config and all three save slots standing — eight of
 * nine. A player asking to start over means start over.
 *
 * Legacy key names are swept too: a reset that leaves a pre-migration payload
 * behind is a reset that undoes itself on the next load.
 */
export function clearAllStoredData(): void {
    const store = getBackend();
    (Object.keys(STORAGE_KEYS) as Array<keyof typeof STORAGE_KEYS>).forEach(name => {
        safeRemove(store, STORAGE_KEYS[name]);
        (LEGACY_KEYS[name] ?? []).forEach(legacy => safeRemove(store, legacy));
    });
}

function safeRemove(store: StorageBackend, key: string): void {
    try {
        store.removeItem(key);
    } catch {
        /* storage unavailable — nothing to clear anyway */
    }
}

/* -------------------------------------------------------------------------- */
/* Small coercion helpers, shared by every migration                          */
/* -------------------------------------------------------------------------- */

export function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

export function asNum(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function asStr(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}

export function asBool(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

export function asStrArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** A `Record<string, number>` with every non-numeric entry dropped. */
export function asNumMap(value: unknown): Record<string, number> {
    const rec = asRecord(value);
    if (!rec) return {};
    const out: Record<string, number> = {};
    Object.entries(rec).forEach(([k, v]) => {
        if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    });
    return out;
}

/** A plain object passthrough, or `{}`. */
export function asObjMap<T>(value: unknown): Record<string, T> {
    const rec = asRecord(value);
    return rec ? (rec as Record<string, T>) : {};
}
