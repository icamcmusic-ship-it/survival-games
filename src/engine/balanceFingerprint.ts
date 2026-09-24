import * as BALANCE from '../data/balance';
import * as FLAVOR from '../data/flavorText';
import * as ARENA_FLAVOR from '../data/arenaFlavor';
import * as ARENA_FLAVOR_NEW from '../data/arenaFlavorNew';
import * as PROCEDURAL_FLAVOR from '../data/proceduralFlavor';
import * as NAMES from '../data/names';
import { BUILDS, DEFAULT_GAME_CONFIG, IMPROVISED_ITEMS, INCOMPATIBLE_TRAITS, ITEMS } from '../data/constants';
import { TRAIT_DEFS } from '../data/traits';
import { ARCHETYPES, CAST_SHAPE_ARCHETYPE_WEIGHTS, CAST_SHAPE_EXCLUDES, DISTRICT_ARCHETYPE_WEIGHTS } from '../data/archetypes';

/**
 * AUDIT-10 batch 6: "scenario manifests with recorded initial conditions
 * **and versions**".
 *
 * The initial-conditions half was already done and is tested: `check-replay.ts`
 * asserts a run replays bit-for-bit from its seed, its config and its
 * intervention log. The versions half was not, and the distinction is not
 * pedantic.
 *
 * `SAVED_RUN_VERSION` is a *schema* version. Its own comment says v0 and v1
 * "differ only in the envelope" — it tracks the shape of the payload so a save
 * written by an older build can still be parsed. It says nothing about the
 * simulation that produced the run.
 *
 * So when a balance number moves, a save written before the change resumes
 * under the new one. The chronicle of the first half was produced by one set
 * of rules and the second half by another, the two are stitched together with
 * no seam, and nothing anywhere says so. The same seed no longer replays the
 * same Games, which is the one promise the engine makes about itself.
 *
 * That is not hypothetical. In a single working session this file's own
 * repository moved the victor retrieval floor from 12 to 35, added a hearing
 * threshold and then tuned it from 0.75 to 1.1, added headline pacing, and
 * re-baselined a decision guard. Any run saved between two of those and
 * resumed after would be a hybrid.
 *
 * The fingerprint is a cheap, stable digest of every exported balance group.
 * It is not a checksum of the build — code changes move behaviour too — but
 * balance is where the numbers that decide a run live, and it is the part that
 * changes most often and most silently.
 */

/**
 * Deterministic, order-independent-by-key digest. Sorted keys so a reordering
 * of the file is not mistaken for a change of its contents, and a plain FNV-1a
 * because this identifies a configuration rather than defending against one.
 */
function digest(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => typeof v !== 'function')
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/**
 * AUDIT-11 E13: the *shape* of a text table — every string array reduced to
 * its length, everything else walked. A flavour pool's size decides how many
 * values `pickText` draws over, so adding a line moves the RNG stream and the
 * run; rewording a line does not, and should not read as a mismatch.
 */
function poolShape(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.every(v => typeof v === 'string') ? `#${value.length}` : value.map(poolShape);
    }
    if (value === null || typeof value !== 'object') return typeof value === 'function' ? undefined : value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, poolShape(v)]));
}

let cached: string | undefined;

/**
 * The digest of every exported balance group, computed once per process.
 *
 * AUDIT-11 E13: balance alone missed replay-breaking changes. The item, trait
 * and archetype tables and the generation config decide a run as surely as a
 * knob does, and the sizes of the flavour and name pools decide how the RNG
 * stream advances — #95's flavour rewrite changed streams with no mismatch.
 * The arenas are left out: a run carries its own arena in its state.
 */
export function balanceFingerprint(): string {
    if (cached !== undefined) return cached;
    const groups = Object.entries(BALANCE as Record<string, unknown>)
        .filter(([, v]) => v !== null && typeof v === 'object')
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const tables: Array<[string, unknown]> = [
        ['@ITEMS', ITEMS], ['@IMPROVISED_ITEMS', IMPROVISED_ITEMS], ['@BUILDS', BUILDS],
        ['@DEFAULT_GAME_CONFIG', DEFAULT_GAME_CONFIG], ['@INCOMPATIBLE_TRAITS', INCOMPATIBLE_TRAITS],
        ['@TRAIT_DEFS', TRAIT_DEFS], ['@ARCHETYPES', ARCHETYPES],
        ['@DISTRICT_ARCHETYPE_WEIGHTS', DISTRICT_ARCHETYPE_WEIGHTS],
        ['@CAST_SHAPE_ARCHETYPE_WEIGHTS', CAST_SHAPE_ARCHETYPE_WEIGHTS],
        ['@CAST_SHAPE_EXCLUDES', CAST_SHAPE_EXCLUDES],
    ];
    const pools: Array<[string, unknown]> = [
        ['%flavorText', FLAVOR], ['%arenaFlavor', ARENA_FLAVOR], ['%arenaFlavorNew', ARENA_FLAVOR_NEW],
        ['%proceduralFlavor', PROCEDURAL_FLAVOR], ['%names', NAMES],
    ];
    cached = digest([
        ...groups.map(([k, v]) => `${k}=${stableStringify(v)}`),
        ...tables.map(([k, v]) => `${k}=${stableStringify(v)}`),
        ...pools.map(([k, v]) => `${k}=${stableStringify(poolShape({ ...(v as object) }))}`),
    ].join(';'));
    return cached;
}

/**
 * Whether a run recorded under `recorded` is still being simulated by the same
 * rules. An absent fingerprint is a save written before this existed, which is
 * unknown rather than mismatched — the caller decides what to do about that,
 * and saying "unknown" is the honest answer rather than guessing either way.
 */
export function balanceMatches(recorded: string | undefined): 'match' | 'mismatch' | 'unknown' {
    if (!recorded) return 'unknown';
    return recorded === balanceFingerprint() ? 'match' : 'mismatch';
}
