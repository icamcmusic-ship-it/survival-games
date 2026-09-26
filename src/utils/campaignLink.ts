import { CampaignSnapshot } from '../models/types';
import { normalizeCampaignLedger } from './seasonLedger';

/**
 * AUDIT-9 B06: a campaign snapshot, small enough to put in a URL.
 *
 * A share link used to carry seed + arena + rules and nothing else, while the
 * run also depended on the sender's record book — district standing, sponsor
 * trust, patronage, mentors, the incumbent Head Gamemaker. So the link
 * reproduced the *seed* and advertised itself as reproducing the *run*, and
 * the two quietly diverged as either player accumulated Games.
 *
 * Rather than widen the query string with a dozen more parameters, the
 * snapshot travels as one opaque value, and the player chooses whether to
 * include it:
 *
 *   - "Copy run link"  — encodes the snapshot. The receiver replays the run.
 *   - "Copy seed link" — omits it. The receiver plays the same seed under
 *                        their own career, which is a different and
 *                        legitimate thing to want.
 *
 * base64url of JSON: compact enough for the sizes involved (a long career is
 * a few hundred bytes), and trivially inspectable, which matters because a
 * link is untrusted input. `decodeCampaign` therefore validates rather than
 * casts — a malformed or hostile payload resolves to "no history" instead of
 * reaching the simulation as a half-built object.
 */

function toBase64Url(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/')
        + '='.repeat((4 - (text.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function encodeCampaign(snapshot: CampaignSnapshot): string {
    return toBase64Url(JSON.stringify(snapshot));
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Bounds. A campaign link is untrusted input that is handed straight to the
 * simulation, so every collection is capped and every number is range-checked
 * before it can reach a continuity pass.
 */
const MAX_ENCODED_CHARS = 8192;
const MAX_RECENT_RUNS = 64;
const MAX_RECORD_ENTRIES = 64;
const MAX_NAME_CHARS = 60;
const MAX_COUNT = 1_000_000;
const MAX_DISTRICT = 13;

/** Non-finite, non-numeric and out-of-range values all read as absent. */
function num(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** A whole count in [0, MAX_COUNT]. Anything else is absent. */
function count(value: unknown): number | undefined {
    const n = num(value);
    if (n === undefined) return undefined;
    const whole = Math.floor(n);
    return whole >= 0 && whole <= MAX_COUNT ? whole : undefined;
}

/**
 * A district ID the game actually has. District 0 is the Capitol/neutral slot
 * several records key on, so the range starts there rather than at 1.
 */
function district(value: unknown): number | undefined {
    const n = num(value);
    if (n === undefined) return undefined;
    const whole = Math.floor(n);
    return whole >= 0 && whole <= MAX_DISTRICT ? whole : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
}

/** A short display string, trimmed and length-capped. Empty reads as absent. */
function text(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().slice(0, MAX_NAME_CHARS);
    return trimmed === '' ? undefined : trimmed;
}

/**
 * Rebuild a `Record<number, T>` keyed by district, dropping members whose key
 * is not a district or whose value does not survive `build`.
 */
function districtMap<T>(value: unknown, build: (entry: Record<string, unknown>) => T | undefined): Record<number, T> | undefined {
    const raw = record(value);
    if (!raw) return undefined;
    const out: Record<number, T> = {};
    let kept = 0;
    for (const [key, member] of Object.entries(raw)) {
        if (kept >= MAX_RECORD_ENTRIES) break;
        const id = district(Number(key));
        const entry = record(member);
        if (id === undefined || !entry) continue;
        const built = build(entry);
        if (built === undefined) continue;
        out[id] = built;
        kept++;
    }
    return kept > 0 ? out : undefined;
}

/**
 * Decode a link's campaign payload, or `undefined` for anything that is not
 * plainly a snapshot.
 *
 * AUDIT-10 F02: this used to cast the nested records and `recentRuns` straight
 * through on a shape check no deeper than "is an object". An encoded
 * `{runs:1,victors:1,recentRuns:[null]}` was therefore accepted, and advancing
 * the resulting run threw reading `victorDistrict` of null inside continuity
 * processing — a crash reachable from a pasted URL.
 *
 * Every nested record and array member is now rebuilt field by field: numbers
 * must be finite and in range, district IDs must be districts this game has,
 * strings are trimmed and capped, and every collection has a length limit.
 * Anything that does not survive that is dropped; if the mandatory head of the
 * payload does not survive, the whole snapshot is rejected and the caller
 * plays the seed under the receiver's own career instead of claiming a replay
 * of a campaign it discarded.
 *
 * Deliberately permissive about *missing* fields (an older or shorter career
 * legitimately has few) and strict about *wrong* ones.
 */
export function decodeCampaign(raw: string | null): CampaignSnapshot | undefined {
    return decodeCampaignResult(raw).snapshot;
}

/**
 * The same decode, with the reason attached.
 *
 * - `absent`:   the link carries no campaign; play under the receiver's career.
 * - `ok`:       the campaign was carried and is intact.
 * - `rejected`: a campaign was carried and did not validate. The caller must
 *               not describe the launch as an exact replay.
 */
export interface CampaignDecode {
    status: 'absent' | 'ok' | 'rejected';
    snapshot?: CampaignSnapshot;
    /** Player-facing, one sentence, safe to show verbatim. */
    reason?: string;
}

export function decodeCampaignResult(raw: string | null): CampaignDecode {
    if (!raw) return { status: 'absent' };
    if (raw.length > MAX_ENCODED_CHARS) {
        return { status: 'rejected', reason: 'The campaign attached to this link is too large to be a record book.' };
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(fromBase64Url(raw));
    } catch {
        return { status: 'rejected', reason: 'The campaign attached to this link could not be read.' };
    }
    const r = record(parsed);
    if (!r) return { status: 'rejected', reason: 'The campaign attached to this link is not a record book.' };

    const runs = count(r.runs);
    const victors = count(r.victors);
    if (runs === undefined || victors === undefined) {
        return { status: 'rejected', reason: 'The campaign attached to this link is missing its Games and victor counts.' };
    }
    if (victors > runs * 2) {
        // Two victors per Games is the ceiling (a dual crown); more than that
        // is not a career this game can have produced.
        return { status: 'rejected', reason: 'The campaign attached to this link reports more victors than its Games allow.' };
    }
    const snapshot: CampaignSnapshot = { runs, victors };

    if (Array.isArray(r.patronDistricts)) {
        const ds = r.patronDistricts.slice(0, MAX_RECORD_ENTRIES)
            .map(district).filter((d): d is number => d !== undefined);
        if (ds.length) snapshot.patronDistricts = [...new Set(ds)];
    }

    const patronDistrict = district(r.patronDistrict);
    if (patronDistrict !== undefined) snapshot.patronDistrict = patronDistrict;
    const lastVictorDistrict = district(r.lastVictorDistrict);
    if (lastVictorDistrict !== undefined) snapshot.lastVictorDistrict = lastVictorDistrict;
    const patronWins = count(r.patronWins);
    if (patronWins !== undefined) snapshot.patronWins = Math.min(patronWins, runs * 2);
    const streak = count(r.victorDistrictStreak);
    if (streak !== undefined) snapshot.victorDistrictStreak = Math.min(streak, runs);

    const crowns = districtMap(r.districtCrowns, entry => {
        const victories = count(entry.victories);
        return victories === undefined ? undefined : { victories };
    });
    if (crowns) snapshot.districtCrowns = crowns;

    const mentors = districtMap(r.victorMentors, entry => {
        const name = text(entry.name);
        const archetype = text(entry.archetype);
        const run = count(entry.run);
        return name && archetype && run !== undefined ? { name, archetype, run } : undefined;
    });
    if (mentors) snapshot.victorMentors = mentors;

    const heirlooms = districtMap(r.heirlooms, entry => {
        const token = text(entry.token);
        const fromName = text(entry.fromName);
        const run = count(entry.run);
        if (!token || !fromName || run === undefined) return undefined;
        const quirk = text(entry.quirk);
        return quirk ? { token, quirk, fromName, run } : { token, fromName, run };
    });
    if (heirlooms) snapshot.heirlooms = heirlooms;

    const gm = record(r.gamemakerRecords);
    if (gm) {
        const out: NonNullable<CampaignSnapshot['gamemakerRecords']> = {};
        let kept = 0;
        for (const [key, member] of Object.entries(gm)) {
            if (kept >= MAX_RECORD_ENTRIES) break;
            const id = text(key);
            const entry = record(member);
            if (!id || !entry) continue;
            const games = count(entry.games);
            const gmVictors = count(entry.victors);
            const deaths = count(entry.deaths);
            if (games === undefined || gmVictors === undefined || deaths === undefined) continue;
            const totalDays = count(entry.totalDays);
            out[id] = totalDays === undefined
                ? { games, victors: gmVictors, deaths }
                : { games, victors: gmVictors, deaths, totalDays };
            kept++;
        }
        if (kept > 0) snapshot.gamemakerRecords = out;
    }

    const term = record(r.headGamemakerTerm);
    if (term) {
        const name = text(term.name);
        const runsServed = count(term.runsServed);
        if (name && runsServed !== undefined) snapshot.headGamemakerTerm = { name, runsServed };
    }

    if (Array.isArray(r.recentRuns)) {
        // The crash site. Members are rebuilt, never passed through: a null,
        // a string, or a run whose `victorDistrict` is `"7"` all drop out here
        // rather than reaching continuity processing.
        const recent: NonNullable<CampaignSnapshot['recentRuns']> = [];
        for (const member of r.recentRuns.slice(0, MAX_RECENT_RUNS)) {
            const entry = record(member);
            if (!entry) continue;
            const victorDistrict = district(entry.victorDistrict);
            recent.push(victorDistrict === undefined ? {} : { victorDistrict });
        }
        if (recent.length) snapshot.recentRuns = recent;
    }

    // AUDIT-11 §8/§12: the campaign arc.
    const rebellion = num(r.rebellion);
    if (rebellion !== undefined) snapshot.rebellion = Math.max(0, Math.min(100, Math.round(rebellion)));
    const rep = record(r.districtReputation);
    if (rep) {
        const out: Record<number, number> = {};
        let kept = 0;
        for (const [key, v] of Object.entries(rep)) {
            const id = district(Number(key));
            const n = num(v);
            if (id === undefined || n === undefined) continue;
            out[id] = Math.max(-50, Math.min(50, Math.round(n)));
            if (++kept >= MAX_RECORD_ENTRIES) break;
        }
        if (kept > 0) snapshot.districtReputation = out;
    }
    if (Array.isArray(r.feuds)) {
        const feuds: NonNullable<CampaignSnapshot['feuds']> = [];
        for (const member of r.feuds.slice(0, 8)) {
            const e = record(member);
            if (!e) continue;
            const aName = text(e.aName);
            const bName = text(e.bName);
            const aDistrict = district(e.aDistrict);
            const bDistrict = district(e.bDistrict);
            const run = count(e.run);
            if (!aName || !bName || aDistrict === undefined || bDistrict === undefined || run === undefined) continue;
            feuds.push({ aName, aDistrict, bName, bDistrict, run });
        }
        if (feuds.length) snapshot.feuds = feuds;
    }
    // AUDIT-12 wave 3: the season ledger slice, validated like everything else here.
    const ledger = normalizeCampaignLedger(r.ledger);
    if (ledger) snapshot.ledger = ledger;

    return { status: 'ok', snapshot };
}
