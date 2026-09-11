import { CONTINUITY } from '../data/balance';

/**
 * §9.3/§6.2: what run N does to run N+1.
 *
 * `PanemRecords` tracked runs, victors, districtCrowns, gamemakerRecords and
 * quellsSeen, and the file's own comment admitted the problem: Panem "was a
 * trophy case — nothing a player did in run 1" reached run 2. `setPatronDistrict`
 * was the one exception, and it was a flat +12 sponsor trust that never
 * changed however the patronage went.
 *
 * Twenty Head Gamemakers each carried a running record — games, victors,
 * totalDays, deaths — which was displayed and read by nothing. A district that
 * had been crowned four times looked exactly like one that had never been
 * crowned at all, to everybody except the record book.
 *
 * So: two memories, both derived from records that already persist, so nothing
 * new has to be written to storage and no migration is needed.
 *
 *   1. A Head Gamemaker remembers being beaten. Somebody whose Games this
 *      player keeps winning — and especially whose Games the player's own
 *      patron district keeps winning — runs a harder year the next time they
 *      are drawn.
 *   2. A district remembers its own standing. A dynasty is resented (the
 *      Capitol is bored of them and the field wants them dead); a district
 *      that has never once come home is the story the sponsors want.
 *
 * Deliberately derived rather than stored. A stored grudge counter is a
 * migration, a corruption surface and a thing that can disagree with the
 * record book; a derived one cannot drift from the records it reads.
 */

/** The subset of `PanemRecords` this module reads. Structural, so it cannot import the store. */
export interface ContinuityRecords {
    runs: number;
    victors: number;
    patronDistrict?: number;
    patronWins?: number;
    victorDistrictStreak?: number;
    lastVictorDistrict?: number;
    districtCrowns?: Record<number, { victories: number }>;
    gamemakerRecords?: Record<string, { games: number; victors: number; deaths: number }>;
    recentRuns?: Array<{ victorDistrict?: number }>;
}

/** How a district is regarded going into these Games. */
export type DistrictStanding = 'dynasty' | 'decorated' | 'forgotten' | 'ordinary';

/** Everything run N+1 inherits, resolved once at the reaping. */
export interface RunContinuity {
    /**
     * How sore the Head Gamemaker running these Games is, 0 to
     * `CONTINUITY.maxGrudge`. 0 is a Gamemaker with nothing to prove.
     */
    grudge: number;
    /** Why — one line, for the reaping feed. Empty at grudge 0. */
    grudgeLine: string;
    /** The district the Gamemakers are leaning on this year, if any. */
    watchedDistrict?: number;
    /** District number -> how Panem regards it this year. Only non-ordinary districts appear. */
    standings: Record<number, DistrictStanding>;
}

/** Crowns this player has taken with a district. */
const crownsOf = (records: ContinuityRecords, district: number) =>
    records.districtCrowns?.[district]?.victories ?? 0;

/**
 * How a district is regarded, from what this player has actually done with it.
 *
 * `dynasty` needs a live streak, not merely a lot of crowns: a district that
 * won four times across forty Games is decorated, not feared.
 */
export function districtStanding(records: ContinuityRecords, district: number): DistrictStanding {
    const crowns = crownsOf(records, district);
    const streaking = records.lastVictorDistrict === district
        && (records.victorDistrictStreak ?? 0) >= CONTINUITY.dynastyStreak;
    const recent = (records.recentRuns ?? []).filter(r => r.victorDistrict === district).length;
    if (streaking || (crowns >= CONTINUITY.dynastyCrowns && recent >= CONTINUITY.dynastyRecent)) return 'dynasty';
    if (crowns >= CONTINUITY.decoratedCrowns) return 'decorated';
    if (crowns === 0 && records.runs >= CONTINUITY.forgottenAfterRuns) return 'forgotten';
    return 'ordinary';
}

/**
 * How much this Head Gamemaker has to prove against this player.
 *
 * Three things make a year harder, and each of them is something the player
 * did: beating this Gamemaker before, running a patron district that keeps
 * coming home, and a live dynasty on the board.
 */
function grudgeOf(records: ContinuityRecords, gamemaker: string | undefined): { grudge: number; reasons: string[] } {
    const reasons: string[] = [];
    if (!gamemaker) return { grudge: 0, reasons };
    let grudge = 0;

    const record = records.gamemakerRecords?.[gamemaker];
    if (record && record.games >= CONTINUITY.grudgeMinGames && record.victors >= CONTINUITY.grudgeBeatenBy) {
        grudge += 1;
        reasons.push(`has run ${record.games} of your Games and crowned ${record.victors}`);
    }
    if ((records.patronWins ?? 0) >= CONTINUITY.grudgePatronWins) {
        grudge += 1;
        reasons.push(`has watched your patron district come home ${records.patronWins} times`);
    }
    if ((records.victorDistrictStreak ?? 0) >= CONTINUITY.dynastyStreak) {
        grudge += 1;
        reasons.push(`has a dynasty on the board to break`);
    }
    return { grudge: Math.min(CONTINUITY.maxGrudge, grudge), reasons };
}

/**
 * Resolve everything run N+1 inherits. Pure: same records and same Gamemaker,
 * same continuity — so a seeded replay of a run replays identically as long as
 * the record book has not moved, and the arena itself is untouched either way.
 */
export function resolveContinuity(
    records: ContinuityRecords,
    gamemaker: string | undefined,
    districts: number[],
): RunContinuity {
    const { grudge, reasons } = grudgeOf(records, gamemaker);

    const standings: Record<number, DistrictStanding> = {};
    districts.forEach(d => {
        const standing = districtStanding(records, d);
        if (standing !== 'ordinary') standings[d] = standing;
    });

    // Who the Gamemakers are leaning on: the live dynasty first, then the
    // player's own patronage. A Gamemaker with no grudge watches nobody.
    const dynasty = districts.find(d => standings[d] === 'dynasty');
    const watchedDistrict = grudge > 0
        ? (dynasty ?? (records.patronDistrict !== undefined && districts.includes(records.patronDistrict)
            ? records.patronDistrict
            : undefined))
        : undefined;

    const grudgeLine = grudge === 0 || !gamemaker
        ? ''
        : `${gamemaker} ${reasons.join(', and ')}.`
            + (watchedDistrict !== undefined
                ? ` District ${watchedDistrict} will not be left alone this year.`
                : '');

    return { grudge, grudgeLine, watchedDistrict, standings };
}

/**
 * What a standing is worth at the reaping, as deltas applied to every tribute
 * of that district.
 *
 * A dynasty arrives with the Capitol already tired of them and the field
 * already watching them; a district nobody has ever seen win arrives as the
 * story sponsors want to buy. Both are small — this is a thumb on the scale
 * across runs, not a handicap system.
 */
export function standingEffect(standing: DistrictStanding): { trust: number; threat: number } {
    switch (standing) {
        case 'dynasty': return { trust: -CONTINUITY.dynastyTrustPenalty, threat: CONTINUITY.dynastyThreat };
        case 'decorated': return { trust: -CONTINUITY.decoratedTrustPenalty, threat: CONTINUITY.decoratedThreat };
        case 'forgotten': return { trust: CONTINUITY.forgottenTrustBonus, threat: 0 };
        case 'ordinary': return { trust: 0, threat: 0 };
    }
}

/** One line per non-ordinary district, for the reaping feed. */
export function standingLine(district: number, standing: DistrictStanding): string {
    switch (standing) {
        case 'dynasty':
            return `District ${district} has been winning. The Capitol has noticed, the other districts have noticed, and nobody here is pretending otherwise.`;
        case 'decorated':
            return `District ${district} sends its tributes out under the weight of the ones who came home before them.`;
        case 'forgotten':
            return `District ${district} has never had a victor in your Games. The commentators say so twice before the reaping is finished, and the sponsors are listening.`;
        case 'ordinary':
            return '';
    }
}
