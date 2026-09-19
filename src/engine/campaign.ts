import { CampaignSnapshot } from '../models/types';

export type { CampaignSnapshot };

/**
 * AUDIT-9 B06: everything a career of Games contributes to a run, in one
 * serialisable object.
 *
 * A shared seed was not a complete replay specification. `processSquare` read
 * the player's persistent record book straight out of storage, and the store
 * applied patronage and victor-mentor bonuses on top of the generated cast.
 * With identical simulation input and nothing changed but the record book, one
 * tribute's opening sponsor trust moved from 63 to 71 — so the same link
 * handed two players different Games, and handed *the same* player different
 * Games after a few more runs.
 *
 * Campaign continuity is worth having; the defect was that it travelled
 * invisibly. This snapshot is taken once, at run creation, and stored on the
 * `GameState`, which means three things at once:
 *
 *   - the engine never reaches into storage, so a headless run and a browser
 *     run with an empty record book are byte-identical;
 *   - a save resumes with the record book it was played under, not whatever
 *     the player's career looks like now;
 *   - a share link can carry it (reproduce this exact run) or deliberately
 *     omit it (play this seed in my own campaign), and the difference is
 *     something the player chooses rather than something that happens to them.
 *
 * Deliberately a structural type rather than an import of `PanemRecords`: the
 * engine must not depend on the storage layer, which is the whole point.
 */

/**
 * The snapshot a run with no history behind it gets — and the one every
 * headless harness gets, so a check measures the game a first-time player is
 * handed rather than whichever career happened to be in the browser.
 */
export const FRESH_CAMPAIGN: CampaignSnapshot = { runs: 0, victors: 0 };

/**
 * The campaign a run was actually played under, defaulting to a fresh one.
 *
 * Every engine read goes through this rather than through storage, so
 * "no snapshot" has exactly one meaning and it is the documented one.
 */
export function campaignOf(snapshot: CampaignSnapshot | undefined): CampaignSnapshot {
    return snapshot ?? FRESH_CAMPAIGN;
}

/** True when this run carried no campaign history at all. */
export function isFreshCampaign(snapshot: CampaignSnapshot | undefined): boolean {
    return (snapshot?.runs ?? 0) === 0 && (snapshot?.patronDistricts?.length ?? 0) === 0;
}
