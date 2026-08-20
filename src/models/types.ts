export type Gender = 'Male' | 'Female';
export type Stance = 'Aggressive' | 'Defensive' | 'Evasive';

export type ArchetypeId = 'career' | 'strategist' | 'survivalist' | 'protector' | 'trickster' | 'wildcard' | 'underdog';

export interface Attributes {
    strength: number;
    agility: number;
    intelligence: number;
    charisma: number;
    stealth: number;
}

export interface Vitals {
    hunger: number; // 0-100, 100 is starving
    thirst: number; // 0-100, 100 is dehydrated
    fatigue: number; // 0-100, 100 is exhausted
    sanity: number; // 0-100, 0 is insane
}

export interface Injuries {
    head: boolean;
    torso: boolean;
    arms: boolean;
    legs: boolean;
    bleeding: boolean;
    infected: boolean;
    poisoned: boolean;
    burned: boolean;
    frostbitten: boolean;
}

/**
 * Skills a tribute actually gets better at by doing.
 *
 * Attributes are fixed at the reaping; these are not. A tribute who forages
 * successfully all week is genuinely better at it by day 8, which is what makes
 * a survivalist visibly become a survivalist over a run instead of merely
 * being labelled one.
 */
export type Proficiency = 'forage' | 'melee' | 'ranged' | 'medicine' | 'tracking';

export type WeaponClass = 'melee' | 'ranged' | 'thrown';

export interface Item {
    id: string;
    name: string;
    type: 'weapon' | 'food' | 'water' | 'medical' | 'utility';
    durability?: number;
    spoilage?: number;
    value: number;
    weaponClass?: WeaponClass;
    damage?: number;
    poison?: boolean;
}

export type Build = 'Frail' | 'Slight' | 'Average' | 'Athletic' | 'Stocky' | 'Muscular';

/**
 * What a tribute has personally learned about a place. Nobody in the arena has
 * a map of everyone else — they have impressions, and those impressions rot.
 */
export interface ZoneMemory {
    /** Cycle index the impression was last refreshed. */
    seen: number;
    /** Accumulated dread: deaths witnessed, fights survived, hazards taken. */
    threat: number;
    /** Rivals believed to be standing there, as of `seen`. */
    rivals: number;
    /** How picked-over the tribute believes the ground is (0-1). */
    barren: number;
}

/**
 * Long-term social memory. `relationships` holds the raw number; this holds the
 * reasons, which is what betrayal, grief and vengeance actually key off.
 */
export interface TributeMemory {
    /** Zone name -> impression. */
    zones: Record<string, ZoneMemory>;
    /** Ids this tribute has sworn to kill, most recent first. */
    vengeance: string[];
    /** Ids that have personally betrayed them. */
    betrayedBy: string[];
    /** How many times they have been sold out. Drives blanket distrust. */
    timesBetrayed: number;
    /** Tribute id -> cycle index of last direct contact, for relationship decay. */
    lastContact: Record<string, number>;
    /** Ids whose deaths this tribute grieved, for the epilogue. */
    mourned: string[];
    /** Sponsor gifts already delivered, for compounding rarity. */
    giftsReceived: number;
    /**
     * Tribute id -> how frightened this tribute is of that specific person
     * (0-100). Raised by losing an exchange to them, watching them kill, or
     * their training score. Fear is personal: the whole cast can be terrified
     * of the boy from District 2 while nobody gives the girl from 11 a thought,
     * and each of them acts on their own number.
     */
    fear: Record<string, number>;
}

/** Where a tribute's most recent wound actually came from. */
export interface DamageRecord {
    /** Human-readable cause, used verbatim as cause of death. */
    cause: string;
    /** Set when another tribute dealt it. */
    sourceId?: string;
    /** Broad bucket, for tone and epilogue copy. */
    kind: 'tribute' | 'mutt' | 'hazard' | 'climate' | 'status' | 'gamemaker' | 'arena';
    /** Cycle index the wound landed. */
    cycle: number;
    amount: number;
}

export interface Tribute {
    id: string;
    district: number;
    gender: Gender;
    name: string;
    age: number;
    heightCm: number;
    build: Build;
    isCareer: boolean;
    archetype: ArchetypeId;
    attributes: Attributes;
    traits: string[];
    vitals: Vitals;
    injuries: Injuries;
    health: number; // 0-100
    status: 'alive' | 'dead';
    inventory: Item[];
    stance: Stance;
    relationships: Record<string, number>;
    excitementRating: number;
    sponsorTrust: number;
    trainingScore: number;
    kills: number;
    causeOfDeath?: string;
    dayOfDeath?: number;
    zone: string;
    allianceId?: string;
    /** Everything this tribute has learned since the reaping. */
    memory: TributeMemory;
    /** The last thing that hurt them — the real cause of death, not a guess. */
    lastDamage?: DamageRecord;
    /** Cycles the current stance has been held, for hysteresis. */
    stanceHeld: number;
    /** Pre-Games audience darling. Starts with sponsor trust and draws envy. */
    fanFavourite: boolean;
    /** Persona sold on the interview couch — shapes who allies and who targets them. */
    interviewStrategy?: string;
    /** Baseline sponsor trust the crowd keeps drifting back toward. */
    reputation: number;
    /** Days this tribute lasted. Frozen at the day they died. */
    daysSurvived: number;
    /** The district's Games history, which decides the quality of their mentor. */
    mentorLegacy?: string;
    /** Total stealth lost permanently to sanity breakdowns, capped rather than uncapped-frequency. */
    sanityStealthLoss?: number;
    /**
     * How badly they are bleeding right now, 0-3. `injuries.bleeding` stays the
     * boolean "is there an open wound"; this is how fast it is running. A wound
     * clots down through the severities rather than draining a fixed 15 health
     * per cycle until something else intervenes.
     */
    bleedSeverity?: number;
    /**
     * Bloodlust. A kill leaves a tribute keyed up: briefly stronger in a fight
     * and far less willing to break off. Decays every cycle, so it rewards
     * pressing an advantage rather than permanently buffing whoever scored first.
     */
    momentum?: number;
    /** Skills that improve with successful use. See `Proficiency`. */
    proficiencies?: Partial<Record<Proficiency, number>>;
}

export type Terrain = 'open' | 'forest' | 'water' | 'highland' | 'ruins' | 'wetland';

export interface Zone {
    name: string;
    terrain: Terrain;
    danger: number;    // 0-1, multiplier bias for hazard/mutt encounters
    resources: number; // 0-1, forage success bias
    adjacent: string[]; // names of connected zones
}

export interface Arena {
    id: string;
    name: string;
    description: string;
    mutts: string[];
    events: string[];
    zones: Zone[];
}

export type Phase = 'setup' | 'roster' | 'reaping' | 'training' | 'interviews' | 'bloodbath' | 'day' | 'night' | 'feast' | 'epilogue' | 'ended';

/**
 * Semantic category for every logged event. Drives the colour coding of the
 * chronicle feed so a reader can scan a day and immediately tell a death from
 * a sponsor gift from a quiet forage.
 */
export type EventCategory =
    | 'death'
    | 'kill'
    | 'combat'
    | 'injury'
    | 'hazard'
    | 'mutt'
    | 'alliance'
    | 'betrayal'
    | 'romance'
    | 'sponsor'
    | 'loot'
    | 'survival'
    | 'travel'
    | 'sanity'
    | 'arena'
    | 'gamemaker'
    | 'training'
    | 'interview'
    | 'feast'
    | 'system';

export interface GameConfig {
    districtCount: number; // 1-12, each district reaps 2 tributes
    hazardRate: number; // multiplier on random event/mutt attack chance
    betrayalRate: number; // multiplier on alliance betrayal chance
    sponsorGenerosity: number; // multiplier on sponsor gift chance
    enableFeast: boolean;
    enableSanity: boolean;
}

export interface GameState {
    seed: string;
    arena: Arena;
    tributes: Tribute[];
    phase: Phase;
    day: number;
    log: EventLog[];
    gamemakerMode: boolean;
    config: GameConfig;
    collapsedZones?: string[];
    epilogueInterview?: EpilogueQA[];
    /** Day the next Gamemaker feast is scheduled for (undefined = none scheduled). */
    feastDay?: number;
    /** Feasts already held this run, used to space them out. */
    feastsHeld?: number;
    /** Monotonic counter guaranteeing unique event log ids. */
    logCounter?: number;
    /** Zone name -> fraction of its printed yield currently stripped out (0-1). */
    zoneDepletion?: Record<string, number>;
    /** Monotonic day/night cycle counter, used for memory and decay timings. */
    cycle?: number;
    /** Zone name -> deaths that have happened there, broadcast by the sky each night. */
    zoneDeaths?: Record<string, number>;
}

export interface EventLog {
    id: string;
    day: number;
    phase: Phase;
    text: string;
    tributesInvolved: string[];
    important: boolean;
    zone?: string;
    category: EventCategory;
}

export interface LogOptions {
    important?: boolean;
    zone?: string;
    category?: EventCategory;
}

export interface EpilogueQA {
    question: string;
    answer: string;
}

export interface TributeHoFSummary {
    name: string;
    district: number;
    kills: number;
    causeOfDeath?: string;
    status: 'alive' | 'dead';
    dayOfDeath?: number;
}

export interface HallOfFameEntry {
    id: string;
    seed: string;
    arenaName: string;
    winnerName: string;
    winnerDistrict: number;
    kills: number;
    date: string;
    winnerTraits?: string[];
    winnerEndHealth?: number;
    tributeSummaries?: TributeHoFSummary[];
}
