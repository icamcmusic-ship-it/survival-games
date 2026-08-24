export type Gender = 'Male' | 'Female';

/**
 * §1.7: the thirteen personas a tribute can sell on Caesar's couch.
 *
 * Declared here rather than derived from `INTERVIEW_SCENARIOS` because
 * `models/types.ts` must not import from `data/` — the check that the two
 * lists match lives in `data/personas.ts`, which does.
 */
export type InterviewPersona =
    | 'The Star-Crossed Lover'
    | 'The Ruthless Warrior'
    | 'The Humble Underdog'
    | 'The Mysterious Enigma'
    | 'The Charming Flirt'
    | 'The Arrogant Brute'
    | 'The Quirky Oddball'
    | 'The Silent Threat'
    | 'The Grieving Sibling'
    | 'The Cold Strategist'
    | 'The Reluctant Hero'
    | 'The District Loyalist'
    | 'The Wildcard';
/**
 * A tribute's standing posture.
 *
 * A1: the original three-value union (Aggressive/Defensive/Evasive) was too
 * coarse to express the difference between hiding and running, or between
 * hunting and holding a line. The core triad is always reachable; the five
 * added here are *conditional* — each has a precondition predicate in
 * `engine/stance.ts` and is filtered out of the ranking entirely when its
 * situation does not hold, so nobody thrashes in and out of Fortified.
 *
 * Every legacy read site (`t.stance === 'Aggressive'`) now goes through
 * `stanceFamily()` in `data/stances.ts`, which maps each new stance onto the
 * one of the original three it behaves like.
 */
export type Stance =
    | 'Aggressive'
    | 'Defensive'
    | 'Evasive'
    | 'Hunting'
    | 'Fortified'
    | 'Desperate'
    | 'Scavenging'
    | 'Shadowing';

export type ArchetypeId =
    | 'career' | 'strategist' | 'survivalist' | 'protector' | 'trickster' | 'wildcard' | 'underdog'
    // A2: eight archetypes with behavioural hooks rather than four more bias
    // scalars. See `data/archetypes.ts`.
    | 'mercenary' | 'zealot' | 'medic' | 'saboteur' | 'beast' | 'diplomat' | 'scholar' | 'ghost';

export interface Attributes {
    strength: number;
    agility: number;
    intelligence: number;
    charisma: number;
    stealth: number;
    /**
     * §3.1: the difference between "can fight" and "can keep walking".
     *
     * Fatigue used to do both jobs: the same number that decided whether a
     * tribute could swing a sword decided whether they could cross the arena
     * on the eighth day. Endurance is the trait half of that — a scalar rolled
     * at the reaping that scales how fast fatigue accumulates and how much of
     * it a night's rest gives back. Optional-free (always written by the
     * generator) but read defensively through `attr()` so saves from before it
     * existed resume with a neutral 5.
     */
    endurance: number;
    /**
     * §3.1: the trait `resolve` was conflating.
     *
     * `Tribute.resolve` is per-run state — it rises and falls with what has
     * happened. Willpower is the disposition underneath it: how steeply that
     * state falls, how much fear and grief land, and how likely a tribute is
     * to keep going when the arithmetic says not to.
     */
    willpower: number;
}

/**
 * One attribute, tolerating tributes generated before §3.1 added endurance
 * and willpower. Everything that reads the two new scalars goes through this
 * rather than `t.attributes.endurance` so an in-flight save never yields NaN.
 */
export function attr(t: { attributes: Attributes }, key: keyof Attributes): number {
    const value = t.attributes[key];
    return typeof value === 'number' && !Number.isNaN(value) ? value : 5;
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

/** One place a tribute can be hurt. See `Tribute.injurySeverity`. */
export type InjurySite = keyof Injuries;

/**
 * Skills a tribute actually gets better at by doing.
 *
 * Attributes are fixed at the reaping; these are not. A tribute who forages
 * successfully all week is genuinely better at it by day 8, which is what makes
 * a survivalist visibly become a survivalist over a run instead of merely
 * being labelled one.
 */
export type Proficiency = 'forage' | 'melee' | 'ranged' | 'medicine' | 'tracking' | 'persuasion';

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
    | { kind: 'protect'; wardId: string; expires: number }
    /**
     * §3.3: following without engaging. The behavioural pair to the Shadowing
     * stance — a tribute who has decided that knowing where somebody is beats
     * fighting them today.
     */
    | { kind: 'stalk'; targetId: string; expires: number }
    /**
     * §3.3: deliberate inaction at a chokepoint. Distinct from 'hold', which
     * is holding ground worth having; this is holding ground worth *watching*,
     * and it is the only objective that wants nobody else to arrive.
     */
    | { kind: 'wait'; zone: string; expires: number };

/**
 * §3.4: the objective that came second, and by how much.
 *
 * `chooseObjective` used to take the top of a priority cascade and throw the
 * rest away, so there was no representation of a tribute torn — needing water
 * while their ally is dying two zones over. The runner-up is kept so a narrow
 * margin can be narrated (a hesitation beat) and, under pressure, acted on.
 */
export interface ObjectiveTension {
    runnerUp: Objective;
    /** Score gap between the chosen objective and the runner-up. */
    margin: number;
    /** Set once the hesitation beat has been narrated, so it fires once per choice. */
    voiced?: boolean;
}

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
    /**
     * Tribute id -> consecutive cycles of recent contact, tracked on the
     * lower-indexed side of each pair. Romance requires a sustained streak
     * (ROMANCE.sustainedCycles), not one shared scene. Optional so saves from
     * before it existed still resume.
     */
    contactStreak?: Record<string, number>;
    /**
     * §4.2: tribute id -> how much this tribute distrusts that specific ally
     * (0-100). Raised by witnessed betrayals and charter breaches; decays.
     */
    suspicion?: Record<string, number>;
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
    /**
     * Killed at the Cornucopia rather than out in the Games.
     *
     * §12: `dayOfDeath` cannot answer this — `startGames` sets day 1 before the
     * bloodbath resolves, so a bloodbath death and a first-day death carry the
     * same stamp. Set once, where the bloodbath ends.
     */
    diedInBloodbath?: boolean;
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
    /**
     * Persona sold on the interview couch — shapes who allies and who targets
     * them.
     *
     * §1.7: this was a bare `string` while `trainingStrategy` was a proper
     * union, and it is read by `personaThreat` and `interviewChemistry` through
     * literal comparisons in three files. A typo in a flavour table became a
     * silently unmatched persona: no threat weighting, no chemistry, no
     * warning. The union is the same list `INTERVIEW_SCENARIOS` declares, and
     * `data/personas.ts` asserts the two stay in step.
     */
    interviewStrategy?: InterviewPersona;
    /** Baseline sponsor trust the crowd keeps drifting back toward. */
    reputation: number;
    /** Days this tribute lasted. Frozen at the day they died. */
    daysSurvived: number;
    /** The district's Games history, which decides the quality of their mentor. */
    mentorLegacy?: string;
    /** Total stealth lost permanently to sanity breakdowns, capped rather than uncapped-frequency. */
    sanityStealthLoss?: number;
    /**
     * The will to keep going, 0-100. Distinct from `vitals.sanity`: sanity is
     * perception coming apart, resolve is whether they still want to win. See
     * `engine/resolve.ts`.
     */
    resolve?: number;
    /**
     * Standing non-aggression pacts: other tribute id -> the cycle it expires
     * on. Negotiated by `engine/parley.ts`; distinct from an alliance, which is
     * a shared camp and shared supplies rather than an agreement not to fight.
     */
    truces?: Record<string, number>;
    /**
     * Displayed regard: what a tribute is *performing* toward someone, as
     * distinct from `relationships`, which is what they actually feel.
     *
     * Star-Crossed in canon is a strategy before it is a romance, and the
     * simulation could only model the sincere version — a bond was mutual,
     * symmetric and true by construction. A performed bond earns the sponsor
     * benefit without the mechanical loyalty, and the other party may not know.
     * Only populated when it differs from the real number.
     */
    displayedRegard?: Record<string, number>;
    /**
     * §11.1: consecutive cycles this tribute has been performing a bond
     * (displayedRegard non-empty). Resets when the act drops. Read by the
     * chronicle and reserved for a future performance achievement.
     */
    performingStreak?: number;
    /**
     * Outstanding obligations: other tribute id -> how much is owed them.
     *
     * `memory.stoodBy` recorded that somebody took a risk for you, and then
     * nothing ever charged for it. A debt raises the cost of betraying the
     * creditor and unlocks a repayment beat. See `engine/debts.ts`.
     */
    debts?: Record<string, number>;
    /** Guards the one-off "both still standing, both from the same district" beat. */
    districtBondNoted?: boolean;
    /**
     * How badly they are bleeding right now, 0-3. `injuries.bleeding` stays the
     * boolean "is there an open wound"; this is how fast it is running. A wound
     * clots down through the severities rather than draining a fixed 15 health
     * per cycle until something else intervenes.
     */
    bleedSeverity?: number;
    /**
     * T-5: graded severity per injury site, 0-3, generalising the
     * `bleedSeverity` pattern to every other injury. The `Injuries` booleans
     * stay the "is there an injury here" flags every existing read site
     * understands; this is how bad each one is. A broken leg and a bruised
     * leg are no longer both `legs: true` — grades scale the combat and
     * escape penalties and the per-cycle status damage, and a repeat insult
     * to the same site worsens it rather than being absorbed silently.
     */
    injurySeverity?: Partial<Record<InjurySite, number>>;
    /**
     * Bloodlust. A kill leaves a tribute keyed up: briefly stronger in a fight
     * and far less willing to break off. Decays every cycle, so it rewards
     * pressing an advantage rather than permanently buffing whoever scored first.
     */
    momentum?: number;
    /** §3.4: short-lived shaken state, symmetric to momentum. Decays per cycle. */
    rattled?: number;
    /**
     * §3.1: attribute points earned in the arena, per attribute, capped per
     * attribute by the `DRIFT.maxGain*` ceilings.
     *
     * T-1 widened this from agility/stealth only — repeated fighting builds
     * strength and practised fieldcraft sharpens judgement, so a survivalist
     * can genuinely become a fighter over a run. §3 closed the last gap:
     * charisma used to be the one attribute fixed at the reaping forever,
     * which meant physical builds visibly compounded over a run and social
     * ones could not. Every attribute now has a proficiency behind it that can
     * move it: melee/ranged -> agility, melee -> strength, tracking -> stealth,
     * medicine/forage -> intelligence, persuasion -> charisma.
     */
    attributeDrift?: Partial<Record<keyof Attributes, number>>;
    /** §5.3: a slow traversal in progress — a crossing or a climb. The tribute
     *  stays in their origin zone until `remaining` cycles have been spent. */
    transit?: { to: string; remaining: number };
    /** Skills that improve with successful use. See `Proficiency`. */
    proficiencies?: Partial<Record<Proficiency, number>>;
    /** What they are currently trying to do. See `Objective`. */
    objective?: Objective;
    /** §3.4: what they nearly did instead, and how close it was. */
    objectiveTension?: ObjectiveTension;
    /**
     * §3.6: sites that will never fully come back. Written when a grade-3
     * injury heals; read by `visiblePower` (a tribute who favours an arm is
     * read as weaker) and by the epilogue.
     */
    scars?: Partial<Record<InjurySite, boolean>>;
    /**
     * §3.6: the observable consequence of a bad leg or arm — a limp, a guarded
     * shoulder. Set alongside the severity grade, cleared when the site heals
     * below grade 2, and visible to anyone who can see them.
     */
    favouring?: InjurySite;
    /**
     * §3.2: cycles a trait has been carried, keyed by trait name. Drives trait
     * decay and the evolution chains in `engine/traitArcs.ts` — a trait is a
     * stage a tribute is passing through, not a permanent label.
     */
    traitAge?: Record<string, number>;
    /** §3.2: traits that have burned off or transformed, kept for the epilogue. */
    shedTraits?: string[];
    /** §3.6: cycles of undisturbed healing banked per injury site. */
    recoveryProgress?: Partial<Record<InjurySite, number>>;
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
    /**
     * How hard the parade landed (the chariot angle's pull plus charisma and
     * legacy). Read by the sponsor stream for the first few days of the Games
     * — see SPONSORS.paradeBuzzPerPull/paradeBuzzDays.
     */
    paradeBuzz?: number;
    /** How they played the training floor: showcase, conceal, or neither. */
    trainingStrategy?: 'showcase' | 'conceal' | 'balanced';
    /** They put their hand up rather than being drawn out of the bowl. */
    volunteered?: boolean;
    /** The reaping-day line: how they came to be standing on that plate. */
    reapingNote?: string;
    /**
     * §3.10: the private reason they intend to survive, set at the reaping.
     * Biases resolve and vengeance, and pays off in the epilogue interview.
     */
    motive?: 'family' | 'partner' | 'prove' | 'honour' | 'escape';
    /** §3.5: they went all the way down once; some of it never comes back. */
    sanityScarred?: boolean;
    /**
     * §4.1: professional esteem, per tribute id (0-100 scale deltas around 0).
     * Distinct from `relationships` (regard): you can rate someone as a
     * fighter and still never sleep unguarded near them. Written by witnessed
     * kills and the training reveal; read by recruitment and truce restraint.
     */
    respects?: Record<string, number>;
    /** §4.4: the angle they took with Caesar — a showmance is a strategy chosen before the arena. */
    interviewAngle?: 'showmance';
    /**
     * §7.1: tessera claims — extra name-slips taken for grain, one per family
     * mouth per year. Decided at generation from district poverty and age.
     * A tribute who carries them has been hungry for years: the hunger drain
     * respects that (see `survival.ts`), and the reaping note says so.
     */
    tesserae?: number;
    /**
     * T-7: non-mechanical idiosyncrasies (labels into `data/quirks.ts`).
     * Two tributes with identical traits stop being behaviourally identical
     * on camera: quirks show on the sheet and surface from quiet cycles.
     */
    quirks?: string[];
    /**
     * §6.9: the district token — the one thing from home they are allowed to
     * carry into the arena. Set in the goodbye room at pregames; surfaces
     * again at their death or in the victor's hands.
     */
    token?: string;
    /** §10.1: the longest performing streak this tribute ever held, for 'The Long Con'. */
    maxPerformingStreak?: number;
    /** §10.1: tribute ids this one has extorted at a parley (item or information). */
    extortedIds?: string[];
    /** §10.1: set the first time a weapon enters their inventory, ever. */
    everCarriedWeapon?: boolean;
    /** §10.1: every zone this tribute has personally stood in. */
    visitedZones?: string[];
    /** §10.1: kills credited to this tribute's own traps. */
    trapKills?: number;
    /** §8.9: traps this tribute has successfully pulled apart. */
    trapsDisarmed?: number;
    /** §8.9: hard water crossings begun (destination terrain 'water'). */
    waterCrossings?: number;
    /** §8.9: consecutive cycles spent with no hostile in their zone. */
    unseenStreak?: number;
    /** §8.9: bodies this tribute has stripped for supplies. */
    corpsesLooted?: number;
    /** §10.1: they took a graze from a poisoned weapon at some point. */
    poisonedByWeapon?: boolean;
    /** §10.1: they held armour, light, warmth and a purifier all at once. */
    fullKitSeen?: boolean;
    /** §10.1: other tribute id -> times a truce with them was renewed. */
    truceRenewed?: Record<string, number>;

    // ---- A1: state the conditional stances read ----
    /**
     * Consecutive cycles spent in the current zone. Fortified needs a tribute
     * to have actually settled somewhere; without this "held the same zone for
     * three cycles" was unrepresentable.
     */
    zoneHeld?: number;
    /** The zone `zoneHeld` is counting, so a move resets it rather than lying. */
    zoneHeldName?: string;
    /**
     * Shadowing: who they are one zone behind, and for how many consecutive
     * cycles the target has failed to notice them. Three in a row converts to
     * a free ambush — the payoff `unseenStreak` never had.
     */
    shadowing?: { targetId: string; cycles: number };
    /** A1: cycles the tribute has been dug in — read by the Fortified payoffs. */
    fortifiedCycles?: number;
    /**
     * A1: per-stance re-entry lockout, stance -> cycle it becomes available
     * again. A conditional stance whose precondition flickers cycle to cycle
     * (a cannon two zones over, a quarry stepping in and out of the next
     * sector) would otherwise thrash a tribute in and out of it; the minimum
     * hold cannot help, because a lapsed precondition has to vacate the stance
     * immediately whatever the hold says.
     */
    stanceCooldown?: Partial<Record<Stance, number>>;
    /**
     * A1: the last cycle each conditional stance's precondition was true.
     *
     * Entry latency, the mirror of `stanceCooldown`'s exit lockout: a
     * conditional stance may only be *entered* once its situation has held for
     * two consecutive cycles, so a cannon two zones over or a quarry stepping
     * briefly into the next sector cannot pull a tribute out of what they were
     * doing for a single turn and then drop them back.
     */
    stanceReady?: Partial<Record<Stance, number>>;

    // ---- A2: archetype hook state ----
    /** A2: whether this tribute's once-per-run archetype signature has fired. */
    signatureFired?: boolean;
    /** A2: Mercenary — the price of their company, and who has paid it. */
    retainerPaidBy?: string[];
    /** A4: pre-arena agreements struck on the training floor. */
    trainingPact?: string[];
    /** A4: stations worked, per day, so the chronicle can narrate three days. */
    trainingLog?: Array<{ day: number; station: string; outcome: 'success' | 'struggle' | 'failure' }>;
    /** A2: Diplomat — truces this tribute brokered between two other people. */
    brokeredTruces?: Array<[string, string]>;
    /** A2: Ghost — sponsor credit accrued purely for never being seen. */
    ghostTrust?: number;
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
    /**
     * §4.5: what the broadcast calls them. An alliance with a name is a brand
     * the crowd tracks — 'the Career pack' was the only group that ever had
     * one, and only informally.
     */
    name?: string;
    /** Ground they return to and defend. */
    campZone?: string;
    /** Pooled supplies: a reason to stay, and a thing worth stealing. */
    sharedCache: Item[];
    /**
     * What they agreed out loud. A telegraphed, scheduled betrayal the
     * audience can watch approaching is one of the best things the alliance
     * layer can produce — but it used to be a single hard-coded threshold
     * ("the final eight"), which is wrong for every field of eight or fewer.
     * With `districtCount` legal from 2, that was a third of all legal setups
     * dissolving their pacts on the cycle after they swore them. See
     * `AlliancePact` and `rollPact` in `engine/alliance.ts`.
     */
    pact: AlliancePact;
    /**
     * §4.2: a bloc inside the group. Formed when two members' suspicion of a
     * third correlates; acts as a coup, a mass defection or a quiet split.
     */
    factions?: Faction[];
    /** §4.2: breaches logged per member, so a *second* one is a hearing. */
    breachesBy?: Record<string, string[]>;
    /** §4.2: who put what into the cache. A claim, when the group splits. */
    cacheContributions?: Record<string, number>;
    /** §4.2: named heir. Makes killing the leader a different calculation. */
    successorId?: string;
    /** §4.2: members thrown out, so they are not simply re-recruited. */
    expelledIds?: string[];
    /** The field size when the pact was sworn, so ceremony can scale to it. */
    pactSwornField?: number;
    /**
     * §4.4: who does what inside the group. Assigned on formation from
     * attributes, so a coup and a betrayal both have somewhere to land: the
     * quartermaster holds the cache and is the natural knife target, the
     * scout's sightings are pooled into the group's memory.
     */
    roles?: Partial<Record<AllianceRole, string>>;
    /**
     * The rules they actually agreed to keep, beyond the pact's expiry date.
     * Breaking one is fallout short of a full betrayal — an argument, a lost
     * night's trust — which is the whole middle ground the alliance layer was
     * missing: the only ways out used to be death, betrayal and pact expiry.
     */
    charter?: CharterRule[];
    /** §10.1: charter breaches this group has logged, for 'Charter Kept'. */
    breaches?: number;
}

/**
 * §4.1: what an alliance agreed about its own ending.
 *
 * The old three-way string union could express exactly one deadline, at a
 * constant field size of eight. That constant is larger than the *entire
 * field* in any run with four districts or fewer, so a third of every alliance
 * formed in a small field was registered and dissolved on the next alliance
 * phase, ceremonial line and all. The threshold is now rolled relative to the
 * live field (`rollPact`), and the union carries the other four kinds of
 * ending people actually agree to.
 */
export type AlliancePact =
    | { kind: 'to-the-end' }
    | { kind: 'no-pact' }
    /** Dissolve when the field is down to `threshold` or fewer. */
    | { kind: 'until-field'; threshold: number }
    /** "We run together through the first week." */
    | { kind: 'until-day'; day: number }
    /** Tied to something the Capitol or the arena is going to do anyway. */
    | { kind: 'until-event'; event: PactEvent }
    /** An alliance of convenience against somebody specific. */
    | { kind: 'until-goal'; goal: 'kill-target'; targetId: string };

/**
 * Scheduled or conditional endings. `feast` and `arena-closes` have a visible
 * countdown on the state; `career-pack-falls` and `first-hurt` might never
 * come due at all, which is what makes agreeing to them a gamble.
 */
export type PactEvent = 'feast' | 'first-blood' | 'career-pack-falls' | 'arena-closes' | 'first-hurt';

/**
 * §4.2: two or more members who have privately agreed the leadership is a
 * problem. Substrate is `memory.suspicion`, which is already per-pair: when
 * several members' suspicion of the same person correlates above a threshold,
 * that is a faction whether anybody says so or not.
 */
export interface Faction {
    memberIds: string[];
    /** Who they have decided is the liability. Usually the leader. */
    againstId: string;
    formedCycle: number;
    /** How hard they have hardened. Drives coup vs. split vs. nothing. */
    heat: number;
}

/** §4.4: a job inside an alliance, held by exactly one member. */
export type AllianceRole = 'quartermaster' | 'scout' | 'muscle' | 'medic';

/** One clause of an alliance's charter. See `engine/allianceCharter.ts`. */
export type CharterRule = 'share-food' | 'no-fighting' | 'hold-the-camp' | 'no-hunting-alone' | 'split-at-eight';

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
/**
 * §5.2: the six primitives, plus the two the set was missing entirely — an
 * abundance effect (every existing kind is a punishment) and a permanent one.
 * Interactions between kinds are resolved in `engine/zoneEffects.ts`:
 * water puts fire out, fire on ice makes meltwater, and contamination
 * travels along the adjacency it is floated down.
 */
export type ZoneEffectKind =
    | 'burning' | 'flooded' | 'frozen' | 'contaminated' | 'fogbound' | 'stripped'
    | 'blooming'      // temporary abundance — forage and morale both lift
    | 'irradiated';   // permanent, and it creeps

export interface ZoneEffect {
    kind: ZoneEffectKind;
    /** Cycle it lifts on its own, absent anything putting it out early. */
    expiresCycle: number;
    /** 'burning' only: the cycle it is next eligible to spread to a neighbour. */
    nextSpreadCycle?: number;
    /** 'burning' only: how many zones deep this particular fire chain runs (1 = the origin fire). */
    chainLength?: number;
    /** Multiplier on this instance's per-tick damage/chance constants. Defaults to 1 where absent. */
    severity?: number;
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
    /**
     * §6.2: tribute ids who have spotted this trap and chosen to leave it
     * standing. They walk around it from then on; everyone else still rolls.
     */
    knownBy?: string[];
}

export type Terrain = 'open' | 'forest' | 'water' | 'highland' | 'ruins' | 'wetland';

/**
 * A behavioural archetype layered on top of a mutt's raw kit. Undefined means
 * a plain attacker with no special handling beyond `Mutt`'s own fields.
 *
 * - `ambusher`: only eligible in fogbound zones or at night.
 * - `herder`: a connecting hit relocates the tribute to an adjacent zone instead of damaging them.
 * - `scavenger`: only eligible in a zone where a cannon fired this cycle.
 * - `siege`: forced `persistent`, and re-attacks pin to its original zone rather than roaming.
 * - `mimic`: formalizes "Faces of the Fallen" — always eligible for that beat, never rolls it by chance.
 * - `swarm`: damage scales up with how many tributes are present in the zone.
 */
export type MuttRole = 'ambusher' | 'herder' | 'scavenger' | 'siege' | 'mimic' | 'swarm';

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
    /** Behavioural archetype beyond the base kit above. See `MuttRole`. */
    role?: MuttRole;
    /** `siege` only: the zone it never leaves. Ignored for every other role. */
    homeZone?: string;
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

/**
 * §5.2: a zone's interior. Zones had no inside — every tribute in one was at
 * the same place, so stealth was a single roll and terrain was a binary.
 * Features give each zone a texture: how much cover it offers, whether it has
 * high ground to watch approaches from, and whether its ways in and out
 * bottleneck. Hand-authored data may set them; otherwise they are derived
 * deterministically from terrain and name (see `zoneFeatures` in engine/map).
 */
export interface ZoneFeatures {
    /** 0-1: how much of the zone offers real concealment. */
    cover: number;
    /** High ground: approaches are visible, ambushes harder. */
    elevation: boolean;
    /** Bottlenecked ways in and out: ambushes easier, retreat harder. */
    chokepoint: boolean;
    /**
     * §5.6: drinkable water inside the zone, distinct from the terrain being
     * 'water' — a spring on a moor is a water source; a brine sump is not
     * automatically one. Derived from terrain and name when absent
     * (see `zoneFeatures` in engine/map); read by the hydration layer.
     */
    waterSource?: boolean;
    /**
     * §5.6: 0-1, how much shelter the zone's interior offers against the
     * weather — caves, ruins and deep timber near 1, bare flats near 0.
     * Scales exposure ticks and derives from terrain and cover when absent.
     */
    shelterQuality?: number;
}

export interface Zone {
    name: string;
    terrain: Terrain;
    danger: number;    // 0-1, multiplier bias for hazard/mutt encounters
    resources: number; // 0-1, forage success bias
    adjacent: string[]; // names of connected zones
    /** §5.2: optional hand-authored interior; derived from terrain when absent. */
    features?: ZoneFeatures;
}

/**
 * A single override to the engine's default rules, scoped to one arena. Each
 * law is a standing condition for the whole run, not a one-off event — see
 * the hook it hangs off of in `arenaLaw.ts` for exactly what it changes.
 */
export type ArenaLawId =
    | 'noCannons'          // no cannon/sky broadcast on death — witnessed kills are still seen in person
    | 'cornucopiaRefills'  // the Cornucopia restocks on schedule all run, not just once early
    | 'sponsorsFixedZone'  // gifts only deliver to a tribute standing in `Arena.lawZone`
    | 'noNight'            // the arena never leaves 'day' — no rest phase, fatigue never fully recovers
    | 'noWaterExceptZone'  // only `Arena.lawZone` yields any water relief; everywhere else is dry
    | 'fireImpossible'      // fire cannot be lit anywhere in this arena
    // §5.1: an arena is allowed more than one of these now (`Arena.laws`).
    | 'noSponsors'         // communications blackout: no gift ever lands
    | 'noHealing';         // medical items do nothing; rest is the only recovery

/** A traversal rule layered on top of plain adjacency for one edge. Keyed by `edgeKey(a,b)` on `Arena.edgeRules`. */
export interface EdgeRule {
    kind: 'oneWay' | 'tolled' | 'timeGated';
    /** 'oneWay' only: the one direction this edge may be crossed. */
    from?: string;
    to?: string;
    /** 'tolled' only: an extra cost paid to cross, on top of normal travel cost.
     *  §11.6: `itemCost` consumes one carried non-weapon item (rope burned on
     *  the climb, a pack lost to the current); `timeCost` adds extra transit
     *  cycles on top of the terrain's own travel cost. */
    toll?: { fatigue?: number; woundChance?: number; itemCost?: boolean; timeCost?: number };
    /** 'timeGated' only: the edge is only passable during this time. */
    gatedTime?: 'day' | 'night';
}

/**
 * A composed, declarative arena signature for procedurally generated arenas
 * — the trigger/selector/payload/telegraph a hand-authored arena instead
 * expresses as a bespoke function in `SIGNATURES` (engine/arenaSignature.ts).
 * Rolled once per generated arena from `(seed, biome)` and stored here so two
 * arenas of the same biome don't necessarily share a mechanic.
 */
export interface SignatureRule {
    trigger: {
        kind: 'everyCycle' | 'everyNth' | 'nightsOnly' | 'daysOnly' | 'afterEscalation' | 'lowSurvivors';
        n?: number;           // 'everyNth'
        threshold?: number;   // 'lowSurvivors'
    };
    selector: {
        kind: 'fixedRotation' | 'busiestZone' | 'emptiestZone' | 'nearCornucopia' | 'lowestDanger' | 'allZones';
    };
    payload: {
        kind: 'damageEffect' | 'severEdges' | 'invertResources' | 'spawnMutt' | 'drainVital' | 'revealPositions';
        effect?: ZoneEffectKind;  // 'damageEffect'
        amount?: number;          // magnitude, meaning depends on `kind`
    };
    telegraph: {
        kind: 'oneAhead' | 'none' | 'falseChance';
        falseChance?: number;  // 'falseChance': odds the telegraph lies
    };
}

export interface Arena {
    id: string;
    /**
     * Procedural arenas only: a per-map identity. `id` collapses every
     * generated arena of a biome to `procedural-<biome>` (flavour packs,
     * climate profiles and mutt kits key on it and that must not change),
     * so anything that cares which *map* this was — Panem records,
     * achievements — reads `mapId ?? name` instead.
     */
    mapId?: string;
    name: string;
    description: string;
    /** Flavor text only — the game engine resolves mutts through `ARENA_MUTTS` (src/data/mutts.ts) via engine/mutts.ts, not this list. */
    mutts: string[];
    /** Flavor text only — terrain events are resolved through `arenaFlavor` (src/data/arenaFlavor.ts) via engine/encounters.ts, not this list. */
    events: string[];
    zones: Zone[];
    /**
     * A standing rule override for this arena only. See `ArenaLawId`.
     *
     * §5.1: kept as the single-law field every existing arena, Quell override
     * and save file already writes. `laws` is the plural form; read both
     * through `arenaHasLaw`, never directly.
     */
    law?: ArenaLawId;
    /** §5.1: additional standing rules, stacked on top of `law`. */
    laws?: ArenaLawId[];
    /** The zone a law's "except here"/"only here" clause refers to (`noWaterExceptZone`, `sponsorsFixedZone`). */
    lawZone?: string;
    /** Multiplier on sponsor-gift frequency for this arena. Defaults to 1. */
    sponsorMultiplier?: number;
    /** Per-arena renaming/retuning of the six zone-effect primitives. Absent kinds use the engine defaults. */
    effectVocab?: Partial<Record<ZoneEffectKind, { label: string; severityMult?: number; durationMult?: number }>>;
    /** Traversal rules beyond plain adjacency, keyed by `edgeKey(a,b)` (engine/map.ts). */
    edgeRules?: Record<string, EdgeRule>;
    /** Procedural arenas only: the composed signature dispatched when no hand-authored `SIGNATURES[id]` exists. */
    signatureRule?: SignatureRule;
    /** Procedural arenas only: per-terrain danger/resource ranges for this generated arena, overriding the generator's defaults. */
    terrainVariant?: Partial<Record<Terrain, { danger: [number, number]; resources: [number, number] }>>;
    /** Procedural arenas only: the real mutt kit generated for this specific arena. Takes priority over `ARENA_MUTTS` in `rosterFor`. */
    muttRoster?: Mutt[];
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
    districtCount: number; // 2-16, each district reaps 2 tributes (13-16 are the "expanded Games" outer territories)
    hazardRate: number; // multiplier on random event/mutt attack chance
    betrayalRate: number; // multiplier on alliance betrayal chance
    sponsorGenerosity: number; // multiplier on sponsor gift chance
    enableFeast: boolean;
    enableSanity: boolean;
    /**
     * Pre-Games option: every tribute is named "District # Boy/Girl" instead
     * of drawing from the flavour name pools — for players who want the
     * roster to read like the source material's plainest naming, or who find
     * a hundred invented names per district harder to track than a district
     * number. Purely cosmetic: nothing about generation, stats or behaviour
     * changes, only `Tribute.name`. Optional so a save/config from before
     * this existed defaults to the flavour names it always had.
     */
    plainNames?: boolean;
    /**
     * §Special requests: "Vanilla Games" — the sliders and nothing else.
     *
     * A run's executed config is normally the player's settings multiplied by
     * a randomly drawn temperament (one of nine) and by every standing
     * condition on a randomly rolled twenty-entry calendar, with a Quarter
     * Quell on top. That is the game's best feature and it is also the reason
     * a player who wants to test a specific slider cannot: `gamesProfileFor`
     * rolled a temperament and a calendar unconditionally, and
     * `configForProfile` always multiplied through them, so there was no way
     * to ask for the numbers you actually set.
     *
     * With this on, the profile draws the neutral 1.0/1.0/1.0 temperament, an
     * empty calendar, no Quell and no cast shape, and the executed config is
     * the base config unchanged. Optional so every save and config written
     * before it existed keeps the full-chaos behaviour it was recorded under.
     */
    vanillaRules?: boolean;
}

import type { GamesProfile } from '../engine/gamesProfile';
import type { WeatherFront } from '../engine/weatherFront';

export interface GameState {
    seed: string;
    arena: Arena;
    tributes: Tribute[];
    phase: Phase;
    day: number;
    log: EventLog[];
    gamemakerMode: boolean;
    /** Set when the player picked a random, hidden arena at setup — the identity (name, description, zone names, map) stays out of the UI until the bloodbath phase reveals it. The arena itself is still resolved deterministically from the seed. */
    arenaHidden?: boolean;
    /** The config actually driving the simulation (base config with the games profile's multipliers applied). */
    config: GameConfig;
    /** The player's unmultiplied config, as chosen at setup — what gets shared or archived so a replay starts from the same inputs rather than double-applying the profile. */
    baseConfig: GameConfig;
    collapsedZones?: string[];
    /**
     * §7e: ids of `oncePerRun` arena events that have already fired. A
     * signature beat that is a one-time reveal stops being eligible after it
     * lands rather than becoming this arena's running gag.
     */
    firedEvents?: string[];
    /**
     * §7e: tribute id -> the id of the event queued to fire on them next
     * cycle, set by an event's `chain`. The arena telling a two-part story.
     */
    eventChains?: Record<string, string>;
    epilogueInterview?: EpilogueQA[];
    /** Day the next Gamemaker feast is scheduled for (undefined = none scheduled). Cleared once the feast resolves. */
    feastDay?: number;
    /** Indices into `gamesProfile.calendar` that have already resolved. */
    firedWildcards?: number[];
    /** The storm currently crossing the arena, if any. See `engine/weatherFront.ts`. */
    weatherFront?: WeatherFront;
    /** Alliance id currently holding the Cornucopia. See `engine/zoneControl.ts`. */
    cornucopiaHolder?: string;
    /** §10.1: the longest unbroken Cornucopia hold this run, in cycles. */
    maxHornHold?: number;
    /**
     * §12: two allies who grieved the same death were seen still allied, at
     * some point in the run, while both were alive.
     *
     * 'Both Mourned' used to be evaluated only against the final state — where
     * everyone but the victor is dead and alliances have dissolved — so it
     * could only ever be answered with the wreckage. Recorded live instead.
     */
    sharedGriefAllies?: boolean;
    /** The grieving pair currently being watched, and the cycle they were first seen. */
    sharedGriefPending?: { pair: string; cycle: number };
    /**
     * Cycle the current holder's tenure began.
     *
     * §10.1: this used to double as the payout clock — `tickZoneControl` reset
     * it to the current cycle every time the hold paid out — so the measured
     * hold length could never exceed `ZONE_CONTROL.payoutEveryCycles`, and
     * `maxHornHold` topped out at 2 across every run ever played. Both horn
     * achievements were unreachable by construction. The payout clock is now
     * `cornucopiaPaidAt`, and this field means only what its name says.
     */
    cornucopiaHeldSince?: number;
    /** Cycle the current hold last paid its holders out. See `engine/zoneControl.ts`. */
    cornucopiaPaidAt?: number;
    /** Cycle an extended-darkness wildcard releases the arena on. */
    blackoutUntilCycle?: number;
    /** Tribute the Capitol has put a bounty on, if any. */
    bountyTargetId?: string;
    /** §7.1: set when the Games end with two victors. See engine/victory.ts. */
    victorIds?: string[];
    /** §9.4: remaining purse per sponsor bloc, seeded lazily from generosity. */
    sponsorBlocBudgets?: Record<string, number>;
    /** Day the most recent feast actually convened — guards against two feasts landing on the same day. */
    lastFeastDay?: number;
    /** Feasts already held this run, used to space them out. */
    feastsHeld?: number;
    /**
     * Consecutive cycles the field has sat at finalist count without a victor.
     * Past ESCALATION.finaleAfterFinalistCycles, the Gamemakers force the
     * finale at the Cornucopia — see `forceFinale` in dayNight.ts.
     */
    finalistCycles?: number;
    /**
     * Zone the Gamemakers are driving the finalists to, once the forced finale
     * is on. Read as the top-priority objective in `chooseObjective` — set
     * directly on the tributes it would be overwritten by the objective pass
     * that runs later in the same cycle.
     */
    finaleZone?: string;
    /** Monotonic counter guaranteeing unique event log ids. */
    logCounter?: number;
    /**
     * Anti-repeat memory for `pickText`, keyed by each pool's first line.
     * Serialised with the save so a resumed run picks the same prose the
     * uninterrupted run would have.
     */
    lastPickedText?: Record<string, string>;
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
    /** Guards the Head Gamemaker's one signature intervention per run. */
    gamemakerSignatureFired?: boolean;
    /**
     * REPLAY-01: this year's Games, as announced. Rolled from the seed so a
     * shared seed reproduces the same Games, not merely the same cast.
     */
    gamesProfile?: GamesProfile;
    /**
     * §10.7: extra, unscheduled calendar disruptions fired so far this run.
     * Replaces the never-written `wildcardFired` boolean — a run can now take
     * up to WILDCARD.maxExtraDisruptions additional beats, spaced out and at
     * diminishing odds. See `fireScheduledWildcard` in engine/wildcards.ts.
     */
    extraWildcardsFired?: number;
    /** Cycle the last calendar/extra wildcard resolved on, for spacing. */
    lastWildcardCycle?: number;
    /**
     * Which half of the cycle is currently resolving.
     *
     * REPLAY-07: a night used to differ from a day by a fatigue modifier and
     * one forest bonus. Concealment, awareness and ambush all care what time it
     * is, and they are read from half a dozen call sites that have no business
     * taking a `time` parameter — so the arena's clock lives on the state.
     */
    /**
     * How light it is right now. `dusk` is the movement window of the night
     * phase: tributes travel while there is still enough light to see by, and
     * the encounters that follow resolve in full dark. That half-step is what
     * gives a hunter a genuine window — at dusk they can still see, and their
     * quarry is already on the move.
     */
    timeOfDay?: 'day' | 'dusk' | 'night';
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
    /** Zones a cannon fired in this cycle, with the cycle it happened — reads as "just now" only while `cycle` still matches. Feeds the `scavenger` mutt role. */
    recentCannonZones?: { zone: string; cycle: number }[];
    /**
     * §5.10: zone name -> the deepest depletion it has reached since it last
     * fully recovered. Written by `depleteZone`, cleared by `regenerateZones`
     * when the zone comes back — which is what gates the visible "green
     * returns" beat to once per zone per recovery.
     */
    zoneDepletionPeak?: Record<string, number>;
    /**
     * §7.1: tribute ids who have personally discovered the arena's force
     * field — pressed a hand against the sky at the border and felt it push
     * back. Gates the discovery beat to once per tribute.
     */
    forceFieldSeen?: string[];
    /** 'The Bounty Quell': the currently-named quarry, and the cycle they were last (re)named. */
    quellBounty?: { targetId: string; namedCycle: number };
    /**
     * §10.6: what the Gamemakers put on the table this time. Chosen when a
     * feast is announced (so tributes can weigh the risk against what is
     * actually offered) and consumed by `processFeast`.
     */
    feastTheme?: 'weapons' | 'medical' | 'food' | 'district-gifts';
    /** §6.8: tribute who drew first blood (first tribute-dealt kill). */
    firstBloodId?: string;
    /** §10.1: the longest single fire chain this run produced, in zones. */
    fireChainMax?: number;
    /** §10.1: a renewed truce was still standing when one of its parties died. */
    keptWordSeen?: boolean;
    /** §10.1: a 3+ alliance reached the final eight with a clean charter. */
    charterKeptSeen?: boolean;
    /** §10.1: alliance id -> leaders deposed by coup, kept even if the group later dissolves. */
    allianceDeposals?: Record<string, number>;
    /** §10.1: every distinct mutt name that has attacked someone this run. */
    muttsSeen?: string[];
    /** §10.1: a real debt has existed at some point this run (cycle-sampled). */
    debtsEverIncurred?: boolean;
    /** §10.1: guard so the final-four debt audit runs exactly once. */
    finalFourDebtsChecked?: boolean;
    /** §10.1: debts existed and every one was settled before the final four. */
    paidInFullSeen?: boolean;
    /** §6.8: per-day odds snapshot — day -> tribute id -> shown win %. */
    oddsHistory?: Record<number, Record<string, number>>;
    /** §6.7: per-event Gamemaker usage, for cooldowns, escalating cost and overuse. */
    gamemakerUse?: Record<string, { lastCycle: number; uses: number }>;
    /** §6.6: tribute id -> cycle a player parachute last reached them. Blocs read it as "covered". */
    playerGiftCycle?: Record<string, number>;
    /** §7.6: tribute id -> cycle their mentor pointedly withheld a gift. */
    mentorWithheld?: Record<string, number>;
    /**
     * §6.10: the player's pre-Games coaching of one chosen tribute — a pinned
     * training-floor strategy and/or interview angle, honoured by the phase
     * engines instead of their own rolls.
     */
    playerCoaching?: { tributeId: string; trainingStrategy?: 'showcase' | 'conceal' | 'balanced'; interviewStrategy?: InterviewPersona };
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
    /**
     * The run's Quell, so a replay reproduces it exactly rather than
     * re-drawing from the seed (which could land on a different Quell, or
     * none, than the archived run actually had — especially for a
     * `forceQuell` run, whose whole premise a plain re-draw wouldn't honour).
     * `null` means "this run had no Quell" (still pinned, so an ordinary run
     * doesn't drift into one on replay); `undefined` means the entry predates
     * Quells entirely and there's nothing to pin.
     */
    quellId?: string | null;
    /** True for a Games nobody survived — archived as its own kind of entry. */
    noVictor?: boolean;
    /**
     * Player-pinned: never evicted by the HOF_CAP. A first-ever District 12
     * crown should not be silently deleted by run 51.
     */
    pinned?: boolean;
    winnerName: string;
    winnerDistrict: number;
    kills: number;
    date: string;
    winnerTraits?: string[];
    winnerEndHealth?: number;
    tributeSummaries?: TributeHoFSummary[];
}
