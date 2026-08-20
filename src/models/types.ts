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

/** Why a tribute is walking somewhere. Drives the chronicle copy as well as the route. */
export type ObjectiveReason = 'water' | 'shelter' | 'feast' | 'ally' | 'forage';

/**
 * A standing intention, held across cycles.
 *
 * Every decision used to be a fresh per-cycle scored roll, so nothing persisted:
 * a tribute never decided "I am going to the water source" or "I am going to
 * find the girl from 11", they simply re-rolled a destination lottery every
 * cycle and the chronicle read "Marvel moved to Sector 2" instead of "Marvel is
 * hunting Rue". An objective is re-evaluated only when it expires or is
 * invalidated, which is what makes it an intention rather than a mood.
 */
export type Objective =
    | { kind: 'survive' }
    | { kind: 'hunt'; targetId: string; expires: number }
    | { kind: 'reach'; zone: string; reason: ObjectiveReason; expires: number }
    | { kind: 'hold'; zone: string; expires: number }
    | { kind: 'flee'; from: string; expires: number }
    | { kind: 'protect'; wardId: string; expires: number };

export type WeaponClass = 'melee' | 'ranged' | 'thrown';

/**
 * How well-made a particular instance of an item is.
 *
 * The same base item comes off the Cornucopia in three grades: the sword the
 * Gamemakers laid at the mouth of the horn is not the sword somebody scavenged
 * off a body on day five. Quality scales damage, durability and what a sponsor
 * thinks it is worth, and it shows in the name.
 */
export type ItemQuality = 'crude' | 'standard' | 'fine';

export interface Item {
    id: string;
    name: string;
    type: 'weapon' | 'food' | 'water' | 'medical' | 'utility' | 'armour' | 'tool';
    /** Current condition. Weapons degrade with use; at 0 they are dropped. */
    durability?: number;
    /** What `durability` started at, so condition can be read as a fraction. */
    maxDurability?: number;
    spoilage?: number;
    value: number;
    weaponClass?: WeaponClass;
    damage?: number;
    poison?: boolean;
    quality?: ItemQuality;
    /**
     * Stackable consumables. `undefined` means a single indivisible thing; a
     * number is how many are left in the stack. Food, water and medical
     * supplies stack; a sword does not.
     */
    stack?: number;
    /** Fraction of incoming damage this absorbs while carried. Armour and shields. */
    armour?: number;
    /** Extra inventory slots. Packs and containers. */
    capacity?: number;
    /** Makes foul water safe to drink without a fire. */
    purifies?: boolean;
    /** Turns the night from a handicap into ordinary ground. */
    light?: boolean;
    /** Sleeping warm: the famous parachute. Improves overnight recovery. */
    warmth?: boolean;
    /** Lets a tribute fish still water rather than forage the bank. */
    fishing?: boolean;
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
    /** Tribute id -> the history of this specific feud. See `RivalRecord`. */
    rivals: Record<string, RivalRecord>;
    /**
     * Ids this tribute has taken a real risk for — shared a fight, handed over
     * supplies they needed, or patched up. Romance is gated on this rather than
     * on a number ticking up from standing next to someone.
     */
    stoodBy: string[];
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
    /** What they are currently trying to do. See `Objective`. */
    objective?: Objective;
    /** Ids of tributes this one has formed a protective bond with. See `growProtectorBond`. */
    protectorBonds?: string[];
    /**
     * How far their launch plate landed from the mouth of the Cornucopia, 0-1.
     * 0 is close enough to touch the horn; 1 is the far edge of the ring.
     * Decided at the reaping so it can be shown on the tribute sheet, and read
     * only by the bloodbath.
     */
    platePosition?: number;
    /** Who dressed them for the Capitol. Set at the Remake Center. */
    stylist?: string;
    /** The angle the stylist took for the chariot parade. */
    chariotAngle?: string;
    /** How they played the training floor: showcase, conceal, or neither. */
    trainingStrategy?: 'showcase' | 'conceal' | 'balanced';
    /** They put their hand up rather than being drawn out of the bowl. */
    volunteered?: boolean;
    /** The reaping-day line: how they came to be standing on that plate. */
    reapingNote?: string;
}

/**
 * A standing alliance, as an object rather than a shared string.
 *
 * An alliance used to be nothing but an id copied onto several tributes. There
 * was no leader (movement used `members[0]` — i.e. array order), no roles, no
 * shared supplies, no camp, and no internal politics beyond a scalar trust
 * decay. That leaves the most socially interesting structure in the game with
 * nothing to actually happen inside it.
 */
export interface Alliance {
    id: string;
    /** Chosen on merit (charisma and strength) and open to challenge. */
    leaderId: string;
    memberIds: string[];
    formedCycle: number;
    /** Ground they return to and defend. */
    campZone?: string;
    /** Pooled supplies: a reason to stay, and a thing worth stealing. */
    sharedCache: Item[];
    /**
     * What they agreed out loud. A pact to split at the final eight is a
     * scheduled, telegraphed betrayal — the audience can see it coming, which
     * is exactly what makes it land.
     */
    pact: 'to-the-end' | 'until-the-final-eight' | 'no-pact';
}

/**
 * What happened between one specific pair, across the whole run.
 *
 * Grudges were a single decaying scalar, so two tributes who fought three times
 * had no escalation — the third fight was mechanically identical to the first.
 */
export interface RivalRecord {
    fights: number;
    /** Wounds this tribute took from them, and dealt to them. */
    woundsTaken: number;
    woundsDealt: number;
    /** Times this tribute broke off rather than finish it. */
    timesFled: number;
    lastFightCycle: number;
}

/**
 * A zone in a state other than its printed one.
 *
 * `Zone.danger` and `.resources` were immutable printed numbers forever — only
 * `zoneDepletion`, a parallel record, ever changed. Terrain never changed: a
 * flooded zone stayed forest. This is the layer that lets the arena itself do
 * something over the course of a run — burn, flood, freeze, fog over — the way
 * `zoneDepletion` already lets it get quietly stripped.
 */
export type ZoneEffectKind = 'burning' | 'flooded' | 'frozen' | 'contaminated' | 'fogbound' | 'stripped';

export interface ZoneEffect {
    kind: ZoneEffectKind;
    /** Cycle it lifts on its own, absent anything putting it out early. */
    expiresCycle: number;
    /** 'burning' only: the cycle it is next eligible to spread to a neighbour. */
    nextSpreadCycle?: number;
}

/** A snare, deadfall or tripline left in a zone, waiting for whoever walks into it. */
export interface Trap {
    id: string;
    kind: 'snare' | 'deadfall';
    zone: string;
    /** Who set it. They know it is there; nobody else does until they find it. */
    ownerId: string;
    /** How well hidden it is — rolled against a passer-by's awareness. */
    concealment: number;
    /** Cycle it was set, so the arena can rot them out rather than accumulating forever. */
    setCycle: number;
}

export type Terrain = 'open' | 'forest' | 'water' | 'highland' | 'ruins' | 'wetland';

/**
 * A mutt archetype, not a mutt instance.
 *
 * The old model was a flavour string picked at random and fed a flat 40
 * damage, a fixed evasion threshold and an unconditional bleed — Tick-Tock
 * Monkeys and Acid Fog were mechanically identical. This gives every named
 * mutt its own kit: how hard it hits, how fast it is against a tribute's
 * agility, how many of it show up, what it actually inflicts, and where and
 * when it can appear at all.
 */
export interface Mutt {
    id: string;
    name: string;
    /** [min, max] mutts in a pack, inclusive. */
    packSize: [number, number];
    damage: number;
    /** Rolled against the tribute's agility for evasion — not a fixed threshold. */
    speed: number;
    /** Injuries this mutt can leave beyond the standard bleed-on-hit. */
    inflicts?: Partial<Injuries>;
    /** Terrain this mutt can appear/attack in. Undefined = anywhere. */
    terrainPreference?: Terrain[];
    /** Only active at night. */
    nocturnal?: boolean;
    /** Once it finds a tribute, keeps tracking them for a few cycles. See `ActiveMutt`. */
    persistent?: boolean;
    /** Flat sanity cost from the encounter alone, evaded or not. */
    fearAura?: number;
}

/**
 * A `persistent` mutt that has found someone and is still hunting them.
 *
 * Lives on `GameState.activeMutts`. `tickPersistentMutts` (src/engine/mutts.ts)
 * both creates and consumes these — see that file's header comment for exactly
 * when it needs to be called.
 */
export interface ActiveMutt {
    muttId: string;
    targetId: string;
    arenaId: string;
    /** Cycle index after which this pursuit lapses. */
    expiresCycle: number;
}

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
    /** Flavor text only — the game engine resolves mutts through `ARENA_MUTTS` (src/data/mutts.ts) via engine/mutts.ts, not this list. */
    mutts: string[];
    /** Flavor text only — terrain events are resolved through `arenaFlavor` (src/data/arenaFlavor.ts) via engine/encounters.ts, not this list. */
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

import type { GamesProfile } from '../engine/gamesProfile';

export interface GameState {
    seed: string;
    arena: Arena;
    tributes: Tribute[];
    phase: Phase;
    day: number;
    log: EventLog[];
    gamemakerMode: boolean;
    /** The config actually driving the simulation (base config with the games profile's multipliers applied). */
    config: GameConfig;
    /** The player's unmultiplied config, as chosen at setup — what gets shared or archived so a replay starts from the same inputs rather than double-applying the profile. */
    baseConfig: GameConfig;
    collapsedZones?: string[];
    epilogueInterview?: EpilogueQA[];
    /** Day the next Gamemaker feast is scheduled for (undefined = none scheduled). Cleared once the feast resolves. */
    feastDay?: number;
    /** Day the most recent feast actually convened — guards against two feasts landing on the same day. */
    lastFeastDay?: number;
    /** Feasts already held this run, used to space them out. */
    feastsHeld?: number;
    /** Monotonic counter guaranteeing unique event log ids. */
    logCounter?: number;
    /** Zone name -> fraction of its printed yield currently stripped out (0-1). */
    zoneDepletion?: Record<string, number>;
    /** Zone name -> whatever is currently happening to it beyond depletion. */
    zoneEffects?: Record<string, ZoneEffect[]>;
    /**
     * Adjacency edges cut by the arena itself — a collapsed bridge, a fire that
     * burned through a crossing. Stored as `map.edgeKey()` strings. The printed
     * `Zone.adjacent` graph is shared/regenerated data and is never mutated;
     * this is the run-local exception list layered on top of it.
     */
    severedEdges?: string[];
    /** Monotonic day/night cycle counter, used for memory and decay timings. */
    cycle?: number;
    /**
     * The day the Gamemakers started closing the arena. Undefined until they
     * do. Set by boredom or by the calendar, whichever comes first — collapse
     * progress counts from here rather than from a fixed day.
     */
    escalationDay?: number;
    /** Guard so the pre-Games ceremonies are narrated exactly once. */
    preGamesDone?: boolean;
    /** This run's Head Gamemaker. Chosen once, at the reaping. */
    headGamemaker?: string;
    /**
     * REPLAY-01: this year's Games, as announced. Rolled from the seed so a
     * shared seed reproduces the same Games, not merely the same cast.
     */
    gamesProfile?: GamesProfile;
    /** Guard so a scheduled wildcard fires exactly once. */
    wildcardFired?: boolean;
    /**
     * Which half of the cycle is currently resolving.
     *
     * REPLAY-07: a night used to differ from a day by a fatigue modifier and
     * one forest bonus. Concealment, awareness and ambush all care what time it
     * is, and they are read from half a dozen call sites that have no business
     * taking a `time` parameter — so the arena's clock lives on the state.
     */
    timeOfDay?: 'day' | 'night';
    /** Aggregate audience interest in the living field, recomputed each cycle. */
    audienceInterest?: number;
    /** Zone name -> deaths that have happened there, broadcast by the sky each night. */
    zoneDeaths?: Record<string, number>;
    /** Traps currently set in the arena, by whoever set them. */
    traps?: Trap[];
    /** Alliance id -> its structure. See `Alliance`. */
    alliances?: Record<string, Alliance>;
    /**
     * Movement along each edge of the zone graph, keyed by the two zone names
     * sorted and joined with '|'. Decays every cycle, so it reads as "where the
     * traffic is right now" rather than a cumulative total.
     */
    zoneTraffic?: Record<string, number>;
    /** Tribute id -> cycle their fire/shelter/camouflage lapses. */
    camps?: Record<string, { fire?: number; shelter?: number; camouflage?: number }>;
    /** Persistent mutts currently hunting a specific tribute. See `ActiveMutt`. */
    activeMutts?: ActiveMutt[];
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
    /**
     * The arena and settings the run actually used, so an archived victory can
     * be relaunched rather than merely copied as a seed. Optional: entries
     * archived before this existed only carry the arena's display name.
     */
    arenaId?: string;
    config?: GameConfig;
    winnerName: string;
    winnerDistrict: number;
    kills: number;
    date: string;
    winnerTraits?: string[];
    winnerEndHealth?: number;
    tributeSummaries?: TributeHoFSummary[];
}
