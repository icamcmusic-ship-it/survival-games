/**
 * AUDIT-12 wave 3 (§11/§12/§13): the shapes the side features share.
 *
 * Three layers, kept apart on purpose:
 *
 *  - `SeasonLedger` is what persists in the record book (`PanemRecords.ledger`)
 *    across Games: apprenticeships the player chose, reunions, rivalries,
 *    nemeses, arena mastery, the museum, story-chain progress, the season
 *    standings, the prediction bankroll.
 *  - `CampaignLedger` is the slice of it a run is created under
 *    (`CampaignSnapshot.ledger`). The engine reads only this, so a headless
 *    run with no snapshot behaves exactly as before.
 *  - `SeasonRunState` is the in-run bookkeeping (`GameState.season`): what the
 *    director has fired, the cruelty meter, bloc regret, reunions seen, the
 *    arena's story chain. It is written by the engine and folded into the
 *    ledger by `commitRun`.
 */

/** A district pair, always `low-high`. */
export type DistrictPairKey = `${number}-${number}`;

export interface ApprenticeChoice {
    /** The proficiency the district's next tribute walks in knowing. */
    skill: string;
    /** Who taught it, for the reaping line. */
    fromName: string;
    run: number;
}

export interface ApprenticeOffer {
    /** Skills a tribute of this district was taught (or taught) in the last Games. */
    skills: string[];
    teacher: string;
    run: number;
}

export interface ReunionBond {
    a: number;
    b: number;
    count: number;
    run: number;
}

export interface Rivalry {
    aDistrict: number;
    bDistrict: number;
    /** Kills between the two districts, decayed each Games. */
    heat: number;
    lastRun: number;
}

export interface Nemesis {
    /** Single given name of the victor who became the nemesis. */
    name: string;
    district: number;
    /** Districts whose tributes they killed on the way to the crown. */
    victimDistricts: number[];
    kills: number;
    run: number;
    arenaName: string;
}

export interface MuseumPiece {
    name: string;
    district: number;
    cause: string;
    code: string;
    day: number;
    run: number;
}

export interface ArenaMastery {
    runs: number;
    crowns: number;
    /** Longest Games held here. */
    longest: number;
    /** Most recent victors crowned here (given names). */
    victors: string[];
}

export interface StoryChainProgress {
    chainId: string;
    /** Steps reached (0-3) the last time this arena was played. */
    step: number;
    run: number;
    /** Times the chain has been completed here. */
    completed: number;
}

export interface SeasonStanding {
    /** 1-based season number. */
    number: number;
    /** Games played in this season so far. */
    played: number;
    /** Points per district: a crown is worth the most. */
    points: Record<number, number>;
    /** A mutator drawn for this season: every Games in it carries it. */
    mutator?: string;
    /** Drawn at the close of the previous season, for the next. */
    nextMutator?: string;
    /** Champion districts of closed seasons, newest first. */
    champions?: Array<{ number: number; district: number }>;
}

export interface PredictionBank {
    /** Slip points banked across saves; each slip stakes `slipStake`. */
    bankroll: number;
    /** Consecutive slips that scored at least the sharp share. */
    streak: number;
    bestStreak: number;
    /** Slips that named a no-kill or thin-district victor who then won. */
    upsetsCalled: number;
    causeCalls: number;
    overUnderCalls: number;
}

export interface GauntletBest {
    score: number;
    mutators: string[];
    seed: string;
    date: string;
}

export interface AnnouncedQuell {
    /** The run number (`records.runs` after that Games) that will be the Quell. */
    forRun: number;
    quellId: string;
    /** The run the announcement was made after. */
    announcedAfter: number;
}

export interface VictorCache {
    fromName: string;
    district: number;
    arenaName: string;
    /** Catalogue item ids the victor was carrying when crowned. */
    itemIds: string[];
}

export interface MentorArena {
    arenaId: string;
    arenaName: string;
    /** The dominant terrain of the arena they won in. */
    terrain?: string;
    /** The proficiency they were best at. */
    bestSkill?: string;
}

/** What persists in the record book. Every field optional. */
export interface SeasonLedger {
    apprenticeships?: Record<number, ApprenticeChoice>;
    apprenticeOffers?: Record<number, ApprenticeOffer>;
    reunions?: ReunionBond[];
    veteranRespect?: Record<number, number>;
    rivalries?: Rivalry[];
    nemeses?: Nemesis[];
    arenaMastery?: Record<string, ArenaMastery>;
    museum?: Record<string, MuseumPiece[]>;
    storyChains?: Record<string, StoryChainProgress>;
    season?: SeasonStanding;
    predictionBank?: PredictionBank;
    gauntletBest?: GauntletBest;
    announcedQuell?: AnnouncedQuell;
    mentorArenas?: Record<number, MentorArena>;
    upsetRewards?: number;
}

/** The slice of the ledger a run is created under. */
export interface CampaignLedger {
    apprenticeships?: Record<number, ApprenticeChoice>;
    reunions?: ReunionBond[];
    veteranRespect?: Record<number, number>;
    rivalries?: Rivalry[];
    nemeses?: Nemesis[];
    storyChains?: Record<string, StoryChainProgress>;
    announcedQuell?: AnnouncedQuell;
    seasonMutator?: string;
    mentorArenas?: Record<number, MentorArena>;
    oldVictorCache?: VictorCache;
}

export interface KillLedgerEntry {
    victim: string;
    district: number;
    day: number;
    how: string;
}

/** In-run bookkeeping. Every field optional, so older saves read as empty. */
export interface SeasonRunState {
    /** Calendar beats a hands-off director struck off. */
    cancelledBeats?: number;
    /** Director interventions already fired, by id. */
    directorFired?: string[];
    /** 0-100: how hard the Gamemakers have leaned on the field. */
    cruelty?: number;
    /** The cruelty meter's recent entries, newest last. */
    crueltyLog?: Array<{ cycle: number; amount: number; why: string }>;
    /** Multiplier on a bloc's generosity after its tribute died soon after a gift. */
    blocRegret?: Record<string, number>;
    /** The bloc that last paid for each tribute, and when. */
    lastGift?: Record<string, { bloc: string; cycle: number }>;
    /** Deaths already read for regret, kill ledgers and the museum. */
    readDead?: string[];
    biddingWars?: number;
    reunionPairs?: DistrictPairKey[];
    veteranDistricts?: number[];
    apprenticeLessons?: Array<{ district: number; skill: string; teacher: string }>;
    mentorNotes?: string[];
    /** Story chain for this arena: which chain, how far, and on what day each step fired. */
    story?: { chainId: string; step: number; lastDay: number };
    /** Mutator setup already applied (wounded start, border doubles). */
    mutatorsApplied?: string[];
    lastCollapsedCount?: number;
    /** 'Alliance never formed' what-if: members barred from allying each other. */
    barredAlliance?: string[];
    /** Group-6 mechanics: truces of the wounded (pair keys) and paranoia nights. */
    truces?: Array<{ a: string; b: string; until: number }>;
    paranoiaNights?: number;
    /** Kills credited to the crowd under `mutts-only-kills`. */
    muttCredit?: Record<string, number>;
    oldCacheOpened?: boolean;
}
