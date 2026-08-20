/**
 * Every tunable number the simulation leans on, in one place.
 *
 * These used to be scattered inline across `dayNight.ts`, `combat.ts` and the
 * phase files, so balancing a run meant hunting for `hunger > 80` in six
 * different modules and hoping you found all of them. Anything a designer
 * would plausibly want to twist lives here; anything derived from it stays in
 * the engine.
 */

/** Per-cycle vitals drain and the thresholds that start hurting a tribute. */
export const VITALS = {
    hungerDrain: 10,
    thirstDrain: 15,
    fatigueDayDrain: 10,
    /** Negative: a night of rest gives fatigue back. */
    fatigueNightRecovery: -20,
    baseSanityDrain: 5,

    /** Terrain modifiers applied on top of the base drains. */
    waterThirstRelief: 8,
    highlandFatiguePenalty: 8,
    forestNightShelter: 5,

    /** Above these values the vital starts costing health every cycle. */
    starvingThreshold: 80,
    dehydratedThreshold: 80,
    starvingDamage: 5,
    dehydratedDamage: 10,

    /** A tribute eats/drinks from their pack once past these. */
    eatThreshold: 50,
    drinkThreshold: 50,
    foodRelief: 40,
    waterRelief: 50,

    /** Sanity floor below which a tribute may lose a turn to a breakdown. */
    breakdownThreshold: 30,
    breakdownChance: 0.4,
} as const;

/** Per-cycle health cost of each untreated injury. */
export const INJURY_DAMAGE = {
    bleeding: 15,
    infected: 10,
    poisoned: 12,
    burned: 4,
    frostbitten: 6,
    /** Poison also gnaws at the mind. */
    poisonSanity: 5,
} as const;

/** Climate pressure specific to a named arena id. */
export const CLIMATE = {
    frozenFatigue: 10,
    frozenChipDamage: 5,
    frozenFrostbiteChance: 0.15,
    solarThirstMultiplier: 2,
    solarBurnChance: 0.1,
    toxicSanityChance: 0.2,
    toxicSanityLoss: 15,
    toxicPoisonChance: 0.08,
    ashenLungChance: 0.12,
    ashenSanityLoss: 8,
    tidalDrenchChance: 0.18,
    stormFatigue: 8,
} as const;

/** What each trait is worth, in the units the vitals loop works in. */
export const TRAIT_EFFECTS = {
    hydrophilicThirstRelief: 5,
    insomniacNightFatigue: 10,
    ironStomachHungerRelief: 5,
    starCrossedTrustPerCycle: 5,
    starCrossedExcitementPerCycle: 10,
    trackerForageBonus: 0.08,
    /** The youngest tributes burn rations faster and sleep worse. */
    youngHungerPenalty: 2,
    youngFatiguePenalty: 3,
    youngAge: 13,
} as const;

/** When a tribute reaches for the medical kit, and what it buys them. */
export const MEDICAL = {
    medkitHealthThreshold: 70,
    medkitHeal: 50,
    ointmentHealthThreshold: 85,
    ointmentHeal: 25,
} as const;

/** The shrinking arena, from day 5 onward. */
export const ESCALATION = {
    startDay: 5,
    collapseDamageBase: 20,
    collapseDamagePerDay: 10,
    /** The Gamemakers want a victor: the border stops short of the last two. */
    finalistCollapseDamage: 10,
    finalistCount: 2,
    hazardMultiplierPerDay: 0.3,
    hazardCeiling: 0.35,
} as const;

/** Random encounters, hazards and mutts during a cycle. */
export const ENCOUNTERS = {
    ambientLineChance: 0.35,
    ambientArenaShare: 0.6,
    baseEventChance: 0.1,
    baseMuttChance: 0.1,
    hazardCeiling: 0.9,
    /** Chance two tributes sharing a zone actually interact. */
    meetChance: 0.4,
    /** Chance a crowded zone escalates into a group fight rather than a duel. */
    groupFightChance: 0.7,
    /** Cap on how many tributes are drawn into a single brawl. */
    maxBrawlSize: 5,
    muttDamage: 40,
    muttEvasionAgility: 6,
    muttEvasionChance: 0.7,
    /** Chance a tribute wanders rather than holding position. */
    wanderChance: 0.5,
    /** Depletion at which a forage attempt reports the ground picked clean. */
    strippedZoneNotice: 0.55,
} as const;

/** Multi-round duels: how long they last and when someone breaks off. */
export const COMBAT = {
    /** Hard ceiling on exchanges in a single encounter. */
    maxRounds: 4,
    /** Damage a clean hit lands before modifiers. */
    baseHitDamage: 14,
    /** Extra damage per point of power advantage in the round. */
    damagePerPowerPoint: 2.2,
    /** Damage floor and ceiling for any one exchange. */
    minRoundDamage: 5,
    maxRoundDamage: 42,
    /** Chance a round inflicts a localised wound on the loser. */
    woundChance: 0.28,
    bleedChance: 0.34,
    /** Chance a poisoned weapon transfers venom on a landed hit. */
    poisonTransferChance: 0.5,
    /** Chance a Pyromaniac's landed hit leaves the defender burned. */
    pyromaniacBurnChance: 0.2,
    /** Durability burned per round of use. */
    weaponWearPerRound: 6,
    /**
     * Divisors turning an attribute into bonus power for each weapon class.
     * Thrown weapons had no branch at all, so Throwing Knives and the Spear —
     * the one weapon a tribute can craft mid-run — scaled with nothing.
     */
    rangedAgilityDivisor: 3,
    meleeStrengthDivisor: 3,
    thrownStrengthDivisor: 5,
    thrownAgilityDivisor: 5,

    /** Retreat check: base chance to disengage, before health/archetype terms. */
    retreatBase: 0.12,
    /** Extra retreat chance per point of missing health fraction. */
    retreatPerHealthLost: 0.55,
    /** Caution and aggression push the retreat check in opposite directions. */
    retreatCautionWeight: 0.35,
    retreatAggressionWeight: 0.4,
    /** A tribute who is clearly losing the exchange wants out. */
    retreatLosingBonus: 0.18,
    /** Younger tributes break off sooner. */
    retreatYouthWeight: 0.03,
    /** Below this health fraction a tribute will always try to run. */
    routHealthFraction: 0.22,

    /** Numbers advantage in a group brawl. */
    outnumberPowerPerAlly: 2.4,
    outnumberMaxBonus: 7,
    /** Chance per round a gang-up focuses everything on one target. */
    focusFireChance: 0.6,
    /** Group encounters run for at most this many rounds. */
    maxGroupRounds: 5,

    /** Base odds a tribute breaking off eats a parting shot on the way out. */
    partingShotChance: 0.3,

    /** Relationship deltas produced by fighting. */
    grudgePerFight: 20,
    grudgeOnWound: 8,
} as const;

/**
 * Stealth: concealment, awareness, and the ambush that comes out of the gap
 * between them.
 *
 * Stealth was generated with full variance — base roll, district bonus,
 * archetype bias, a training station — and then read by nothing except the
 * dodge check on a handful of scripted hazards. It is the cheapest lever in
 * the game to give teeth to, because every tribute already has a number for it.
 */
export const STEALTH = {
    /** Baseline odds a hidden tribute goes unnoticed before any modifiers. */
    baseConcealment: 0.15,
    /** Weight on the concealment roll per point of stealth over awareness. */
    perPointAdvantage: 0.07,
    /** Ceiling, so nobody is ever truly invisible. */
    maxConcealment: 0.75,
    /** Hiding outright is what stealth is for. */
    evasiveBonus: 0.2,
    /** Sweeping a zone for a fight means making noise. */
    aggressivePenalty: 0.15,
    /** Terrain that hides a body, and terrain that does not. */
    coverBonus: 0.12,
    openPenalty: 0.12,
    /** Being hurt makes you easier to find. */
    bleedingPenalty: 0.1,
    /** An alliance cannot move quietly. */
    groupPenalty: 0.08,

    /** Awareness: what it takes to notice someone who does not want noticing. */
    awarenessFromIntelligence: 0.5,
    eagleEyedBonus: 3,
    trackerBonus: 2,
    lightSleeperBonus: 1.5,
    paranoidBonus: 1.5,
    /** A tribute at the end of their rope stops watching the treeline. */
    exhaustedPenalty: 2,
    lowSanityPenalty: 2,

    /** Ambush: opening a fight from cover. */
    ambushBase: 0.1,
    ambushPerPointAdvantage: 0.08,
    maxAmbushChance: 0.7,
    /** Power edge the ambusher carries into the opening exchange. */
    ambushPowerBonus: 6,
    /** Damage multiplier on the free opening hit. */
    ambushDamageMultiplier: 1.35,
    /** Per point of stealth, how much of a parting shot a fleeing tribute slips. */
    disengagePerPoint: 0.03,
    /** How much of a zone's felt threat a stealthy tribute discounts. */
    threatDiscountPerPoint: 0.05,
    maxThreatDiscount: 0.5,
    /**
     * Endgame reveal. Two tributes who are both good at hiding, both Evasive,
     * and alone in a single un-collapsed zone will otherwise avoid each other
     * indefinitely — the Games never end. The Gamemakers do not permit that:
     * once the field is down to this many, cover stops working.
     */
    endgameRevealAt: 3,
    /** Concealment retained per tribute above the reveal threshold. */
    endgameConcealmentStep: 0.34,
} as const;

/** What a tribute can physically carry. */
export const INVENTORY = {
    /**
     * Items carried in hands, pockets and a bedroll. Tributes hold well under
     * one item on average, so this is deliberately tight: a limit that only
     * binds after a kill or a feast is a limit that makes looting a decision,
     * and anything looser leaves the Backpack with nothing to do.
     */
    baseCapacity: 4,
    /** A Backpack is the difference between looting a body and looting it all. */
    backpackCapacity: 3,
    /** A Backpack also keeps food out of the sun. */
    backpackSpoilageBonus: 2,
} as const;

/** Zone economy: foraging strips a zone, and the arena grows it back slowly. */
export const ZONES = {
    /** Fraction of a zone's remaining yield consumed by one successful forage. */
    depletionPerForage: 0.13,
    /** Smaller drain even when a forage comes up empty — the ground is picked over. */
    depletionPerAttempt: 0.03,
    /** Fraction of lost yield that grows back each cycle. */
    regenPerCycle: 0.085,
    /** Depletion can never take a zone below this share of its printed yield. */
    minYieldFraction: 0.1,
    /** Base forage odds before zone yield and archetype are added. */
    baseForageChance: 0.25,
    yieldForageWeight: 0.4,
    survivalistForageBonus: 0.15,
    /** Aggressive/Evasive tributes can still stumble onto food or water while
     *  hunting or hiding — just far less reliably than someone actively foraging. */
    aggressiveForageMultiplier: 0.4,
    evasiveForageMultiplier: 0.25,
} as const;

/** What tributes remember, and how fast they forget it. */
export const MEMORY = {
    /** Threat impression added to a zone by a death witnessed there. */
    deathThreat: 1.0,
    /** Threat added by a death only heard as a cannon (location known from the sky). */
    cannonThreat: 0.45,
    /** Threat added by surviving a fight or hazard in a zone. */
    fightThreat: 0.6,
    hazardThreat: 0.35,
    /** Per-cycle multiplicative decay on remembered threat. */
    threatDecay: 0.82,
    /** Threat above which an evasive tribute treats a zone as a no-go. */
    avoidThreshold: 0.9,
    /** How many cycles a rival sighting stays actionable. */
    sightingLifetime: 3,
    /** Weight of a remembered rival when scoring a destination. */
    rivalSeekWeight: 1.6,
    rivalAvoidWeight: 2.0,
    /** Weight of remembered barrenness when scoring a destination. */
    barrenWeight: 1.2,
} as const;

/** Stance selection: thresholds plus the hysteresis that stops thrashing. */
export const STANCE = {
    /** Minimum cycles a stance is held before it may change again. */
    minHold: 2,
    /** Score margin a challenger stance must beat the current one by. */
    switchMargin: 0.8,
    /** Health fractions that pull a tribute toward each stance. */
    evasiveHealth: 40,
    cautiousEvasiveHealth: 55,
    aggressiveHealth: 70,
    /** Threat ratio (their power vs mine) above which the zone reads as hostile. */
    outmatchedRatio: 1.25,
    dominantRatio: 0.8,
} as const;

/** Relationship graph: bounds, decay, and the deltas life in the arena applies. */
export const RELATIONSHIPS = {
    min: -100,
    max: 100,
    /** Per-cycle pull toward zero for pairs with no contact. */
    decayPerCycle: 2.5,
    /** Bonds and rivalries this strong are sticky and decay at half rate. */
    stickyMagnitude: 60,
    /** Contact within this many cycles counts as "recent" and blocks decay. */
    contactWindow: 1,

    /** Backstory: district partners know each other before the reaping. */
    districtPartnerBase: 22,
    districtPartnerSpread: 14,
    /** Careers have trained alongside each other for years. */
    careerPackBase: 45,
    careerPackSpread: 15,
    /** Careers from rival career districts still size each other up. */
    careerRivalPenalty: 10,
    /** Same-archetype kinship / opposed-archetype friction. */
    archetypeKinship: 8,
    /** Similar ages cluster together; a big age gap reads as protective or dismissive. */
    ageAffinity: 6,
    /** Fan favourites draw envy from everyone else. */
    fanFavouriteEnvy: 8,

    /** Grief: what a death does to the victim's friends and enemies. */
    griefTowardKiller: 45,
    griefTowardKillerAllyBonus: 30,
    /** Vengeance is sworn when grief pushes the relationship past this. */
    vengeanceThreshold: -55,
    /** Sanity cost scales with how strong the lost bond was. */
    griefSanityMax: 45,
    griefSanityMin: 8,
    /** Bond strength at which a death registers as a personal loss at all. */
    grievableBond: 25,
    /** An enemy's death is a relief — a small sanity refund. */
    reliefSanity: 6,
    enemyBond: -35,

    /** Betrayal: what turning on an ally costs, socially. */
    betrayalDirectPenalty: 70,
    /** Everyone else in the alliance sees it happen. */
    betrayalWitnessPenalty: 35,
    /** A betrayed survivor trusts nobody for a while. */
    betrayedDistrustPenalty: 15,
    /**
     * Ceiling on the distrust multiplier. It scales the alliance relationship
     * threshold, so without a cap a repeatedly-betrayed tribute needs a bond
     * above the maximum possible value and can never ally again.
     */
    maxDistrustFactor: 2.2,
    /** Alliance trust erodes as the field thins and rations run short. */
    trustDecayPerCycle: 1.5,
    lateGameTrustDecay: 4,
    lateGameAliveCount: 6,
} as const;

/** Alliance formation and dissolution. */
export const ALLIANCES = {
    baseFormChance: 0.2,
    minFormChance: 0.02,
    baseRelThreshold: 40,
    /** Field size above which new alliances still form at all. */
    formationFieldSize: 4,
    /**
     * Largest a group can grow. Dynamic formation only ever paired two
     * alliance-free tributes, so the Career pack was the only group of three
     * or more that could exist in a run — every organic alliance was a duo,
     * for the whole game, by construction.
     */
    maxSize: 4,
    /** Base odds a group takes in a loner they get on with. */
    recruitChance: 0.35,
    /**
     * Mutual regard a recruit and the group each need. Deliberately lower than
     * the pair-formation threshold — joining a standing group is a lower bar
     * than founding one, and bonds between a loner and a group decay toward
     * zero, so a +30 gate cleared roughly 0.3% of real candidate pairs.
     */
    recruitThreshold: 15,
    /** Each existing member past the second makes the group warier of outsiders. */
    recruitSizePenalty: 0.08,
    /** Betrayal odds, before the config multiplier. */
    betrayalBase: 0.05,
    betrayalEndgame: 0.3,
    betrayalEndgameFieldSize: 4,
    /** Weights used to pick who gets knifed. */
    betrayalLootWeight: 0.02,
    betrayalDislikeWeight: 0.03,
    betrayalWeaknessWeight: 0.02,
    /** A tribute who has already been betrayed is far likelier to strike first. */
    betrayedFirstStrikeWeight: 6,
} as const;

/** Sponsor economy. */
export const SPONSORS = {
    /** Combined excitement + trust needed before a parachute is even considered. */
    giftThreshold: 100,
    baseGiftChance: 0.3,
    maxGiftChance: 0.9,
    /** Excitement spent by a delivered gift. */
    giftExcitementCost: 50,
    /** Repeat gifts to the same tribute get exponentially rarer (elite-gate pattern). */
    repeatDecay: 0.55,
    repeatFloor: 0.05,
    /** Rare, high-value gifts sit behind their own decaying gate. */
    rarityGateBase: 0.35,
    rarityGateDecay: 0.4,
    /** Excitement bleeds away when nothing interesting happens. */
    excitementDecayPerCycle: 0.12,
    excitementFloorDecay: 3,
    /** Trust drifts back toward the tribute's baseline reputation. */
    trustDriftPerCycle: 1.5,
} as const;

/** Live betting odds. */
export const ODDS = {
    base: 40,
    strengthWeight: 2,
    agilityWeight: 2,
    trainingWeight: 4,
    /** In-run performance terms. */
    killWeight: 9,
    healthWeight: 0.35,
    allianceBonus: 8,
    woundedPenalty: 12,
    sanityPenalty: 10,
    /**
     * Survivors get credit for lasting, but only relative to what was expected
     * of them: the favourite reaching day 6 tells the bookmakers nothing, and
     * the tribute who scored a 3 in training reaching day 6 tells them a lot.
     * Without the expectation term the bonus is identical for every living
     * tribute and cancels out of the normalised percentage entirely.
     */
    survivalDayWeight: 3,
    survivalExpectationDamping: 0.7,
    /** The crowd's darling gets a nudge. */
    fanFavouriteBonus: 10,
    minScore: 10,
} as const;

/** The Gamemakers' direct interventions. */
export const GAMEMAKER = {
    /**
     * Multiplier applied to a manually triggered weather profile. A Gamemaker
     * storm is the same kind of thing as the arena's standing weather — it is
     * just turned up, which is what makes it an intervention.
     */
    weatherIntensity: 1.6,
    muttTargetedDamage: 50,
    muttSweepBaseDamage: 20,
    muttSweepVariance: 15,
    muttSweepBaseChance: 0.2,
    muttSweepDangerWeight: 0.3,
} as const;

/** Feast attendance. */
export const FEAST = {
    baseAttendChance: 0.6,
    desperateHunger: 70,
    desperateThirst: 70,
    /** Trusted allies come as a group; rivals stay away from each other. */
    allyDrawWeight: 0.25,
    rivalDeterWeight: 0.3,
    woundedDeterrent: 0.25,
    aggressionDraw: 0.3,
} as const;

/** Tribute generation. */
export const GENERATION = {
    /** Age band that gets reaped. */
    minAge: 12,
    maxAge: 18,
    /** Per-year physical scaling either side of the 15-year-old midpoint. */
    ageMidpoint: 15,
    strengthPerYear: 0.55,
    agilityPeakAge: 16,
    /** The youngest tributes get a sympathy bump with the crowd. */
    youthSympathy: 6,
    /**
     * Hard ceiling on raw strength by age: 5 at twelve, rising one per year.
     * A twelve-year-old can be fast, clever, invisible and beloved — they
     * cannot out-muscle an eighteen-year-old from District 2, whatever the
     * dice say.
     */
    strengthCapAtMinAge: 5,
    strengthCapPerYear: 1,
    /** Spread of the per-tribute talent roll, on top of archetype and district. */
    talentSpread: 3,
    /** How many attributes get the "spike / dump" treatment for identity. */
    spikeCount: 1,
    dumpCount: 1,
    spikeSize: 2,
    dumpSize: 2,
    /** Fan favourites — pre-Games audience bias. */
    fanFavouriteCount: 2,
    fanFavouriteTrust: 22,
    fanFavouriteExcitement: 25,
    /** Baseline sponsor trust before reputation modifiers. */
    baseSponsorTrust: 50,
    trustSpread: 12,
} as const;

/** Training visibility: what the rest of the cast makes of a big score. */
export const TRAINING = {
    /** Score at or above which the field takes notice. */
    intimidationScore: 9,
    /** Sanity shaved off everyone else by a legendary score. */
    intimidationSanity: 5,
    /** Relationship shift toward a frightening rival. */
    intimidationRelationship: 12,
    /** Careers respect a high score instead of fearing it. */
    careerRespect: 8,
    /** How much a high scorer's own confidence rises. */
    confidenceSanity: 6,
} as const;
