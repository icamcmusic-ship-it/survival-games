import { CampaignSnapshot } from '../models/types';

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

/** Non-finite, non-numeric and out-of-range values all read as absent. */
function num(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Decode a link's campaign payload, or `undefined` for anything that is not
 * plainly a snapshot. Deliberately permissive about *missing* fields (an older
 * or shorter career legitimately has few) and strict about *wrong* ones.
 */
export function decodeCampaign(raw: string | null): CampaignSnapshot | undefined {
    if (!raw) return undefined;
    let parsed: unknown;
    try {
        parsed = JSON.parse(fromBase64Url(raw));
    } catch {
        return undefined;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
    const r = parsed as Record<string, unknown>;
    const runs = num(r.runs);
    const victors = num(r.victors);
    if (runs === undefined || victors === undefined) return undefined;
    const snapshot: CampaignSnapshot = { runs: Math.max(0, runs), victors: Math.max(0, victors) };
    const districts = r.patronDistricts;
    if (Array.isArray(districts)) {
        snapshot.patronDistricts = districts.map(num).filter((d): d is number => d !== undefined);
    }
    // The rest are read straight through where they are the right *kind* of
    // thing. Nothing here is a capability — the worst a bad value can do is
    // produce an odd reaping line — so the validation stops at shape.
    const passthrough = [
        'patronDistrict', 'patronWins', 'victorDistrictStreak', 'lastVictorDistrict',
    ] as const;
    passthrough.forEach(key => {
        const value = num(r[key]);
        if (value !== undefined) (snapshot as unknown as Record<string, unknown>)[key] = value;
    });
    const objects = [
        'districtCrowns', 'gamemakerRecords', 'headGamemakerTerm', 'victorMentors', 'heirlooms',
    ] as const;
    objects.forEach(key => {
        const value = r[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            (snapshot as unknown as Record<string, unknown>)[key] = value;
        }
    });
    if (Array.isArray(r.recentRuns)) snapshot.recentRuns = r.recentRuns as CampaignSnapshot['recentRuns'];
    return snapshot;
}
