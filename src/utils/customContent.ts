import { STORAGE_KEYS, StorageSpec, asRecord, asStrArray, readStored, removeStored, tryWriteStored } from './storage';

/**
 * §10.2: player-authored content.
 *
 * `HofTransfer` proved the import/export pattern works and it was only ever
 * used to move an archive between browsers. The same shape lets a player add
 * to the *cast* — name pools their own districts draw from, quirks the cameras
 * find, and the arena descriptions the roster reads — which is the cheapest
 * possible route to content this project could not otherwise afford: somebody
 * else writes it.
 *
 * Deliberately limited to additive, non-mechanical pools. A player can add a
 * name, a quirk or an arena blurb; they cannot add a trait with a combat
 * modifier or an arena whose zones the pathfinder has to trust. Everything
 * imported is merged *after* the built-in tables, so a malformed or empty
 * import degrades to the stock game rather than breaking a run.
 */

export interface CustomContent {
    /** Extra tribute names, added to every district's pool. */
    names: string[];
    /** Extra quirk labels. Non-mechanical by construction — see `data/quirks`. */
    quirks: string[];
    /** Extra ambient chronicle lines. `{zone}` is substituted; anything else is left alone. */
    ambient: string[];
}

export const EMPTY_CUSTOM_CONTENT: CustomContent = { names: [], quirks: [], ambient: [] };

/** Hard caps, so a pasted megabyte cannot brick the storage quota or the draw. */
const LIMITS = { names: 400, quirks: 120, ambient: 200 } as const;
const MAX_LENGTH = 240;

function clean(values: string[], cap: number): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    values.forEach(raw => {
        const value = String(raw).trim().replace(/\s+/g, ' ').slice(0, MAX_LENGTH);
        if (!value || seen.has(value)) return;
        seen.add(value);
        if (out.length < cap) out.push(value);
    });
    return out;
}

export const CUSTOM_CONTENT_SPEC: StorageSpec<CustomContent> = {
    key: STORAGE_KEYS.customContent,
    version: 1,
    migrate: raw => {
        const r = asRecord(raw);
        if (!r) return null;
        return {
            names: clean(asStrArray(r.names), LIMITS.names),
            quirks: clean(asStrArray(r.quirks), LIMITS.quirks),
            ambient: clean(asStrArray(r.ambient), LIMITS.ambient),
        };
    },
};

export function readCustomContent(): CustomContent {
    return readStored(CUSTOM_CONTENT_SPEC) ?? EMPTY_CUSTOM_CONTENT;
}

export function writeCustomContent(content: CustomContent): boolean {
    // Unlike most payloads, a failed write here is worth reporting: the player
    // has just handed us a file and expects to be told whether it took.
    return tryWriteStored(CUSTOM_CONTENT_SPEC, content) === 'ok';
}

export function clearCustomContent() {
    removeStored(CUSTOM_CONTENT_SPEC);
}

export interface ImportResult {
    ok: boolean;
    message: string;
    added?: CustomContent;
}

/**
 * Parses a pasted or uploaded pack. Accepts the object form
 * `{ names: [], quirks: [], ambient: [] }` and, for convenience, a bare array
 * of strings (treated as names — which is what almost everybody's first
 * attempt at this file is).
 */
export function importCustomContent(text: string): ImportResult {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { ok: false, message: 'That is not valid JSON. Expected { "names": [...], "quirks": [...], "ambient": [...] }.' };
    }

    const incoming: CustomContent = Array.isArray(parsed)
        ? { names: clean(parsed.map(String), LIMITS.names), quirks: [], ambient: [] }
        : {
            names: clean(asStrArray(asRecord(parsed)?.names), LIMITS.names),
            quirks: clean(asStrArray(asRecord(parsed)?.quirks), LIMITS.quirks),
            ambient: clean(asStrArray(asRecord(parsed)?.ambient), LIMITS.ambient),
        };

    const total = incoming.names.length + incoming.quirks.length + incoming.ambient.length;
    if (total === 0) {
        return { ok: false, message: 'Nothing usable in that file — expected names, quirks or ambient lines.' };
    }

    // Additive: importing a second pack extends the first rather than
    // replacing it, which is what "add your own" implies.
    const existing = readCustomContent();
    const merged: CustomContent = {
        names: clean([...existing.names, ...incoming.names], LIMITS.names),
        quirks: clean([...existing.quirks, ...incoming.quirks], LIMITS.quirks),
        ambient: clean([...existing.ambient, ...incoming.ambient], LIMITS.ambient),
    };
    if (!writeCustomContent(merged)) {
        return { ok: false, message: 'Could not save — this browser is refusing to store any more.' };
    }
    return {
        ok: true,
        added: incoming,
        message: `Added ${incoming.names.length} names, ${incoming.quirks.length} quirks and ${incoming.ambient.length} ambient lines. They are in the draw from the next Games.`,
    };
}

/** A starter pack, so the format documents itself. */
export function exampleCustomContent(): string {
    return JSON.stringify({
        names: ['Ember Callow', 'Tallis Vane'],
        quirks: ['keeps a tally on their forearm'],
        ambient: ['Somewhere over {zone}, a camera drone repositions and stays there.'],
    }, null, 2);
}
