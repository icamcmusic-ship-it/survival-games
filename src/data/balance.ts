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

    /** Terrain modifiers applied on top of the base drains. */
    waterThirstRelief: 8,
    highlandFatiguePenalty: 8,
    forestNightShelter: 5,

    /** Above these values the vital starts costing health every cycle. */
    /** Chance a cycle of genuine starvation teaches the Starved trait. */
    starvedTraitChance: 0.25,
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

/**
 * Bleeding, with agency.
 *
 * A flat 15 damage per cycle forever, curable only by one of two loot items,
 * made an untreated scratch the single deadliest thing in the arena: a
 * full-health tribute bled out in seven cycles having never seen another
 * person. Real wounds clot. So do these — down through the severities, faster
 * for a tribute who is clever enough and strong enough to do something about
 * it, and faster still if anyone actually dresses the wound.
 *
 * The intent is not to make bleeding harmless. It should be what softens a
 * tribute up for the fight that kills them, which means it needs to hurt now
 * and stop hurting later.
 */
export const BLEEDING = {
    /** Severity a fresh wound opens at, by source. */
    combatSeverity: 2,
    /** T-5: extra status-damage multiplier per injury grade above 1 (all sites). */
    gradeDamageStep: 0.3,
    muttSeverity: 3,
    hazardSeverity: 2,
    /** Per-cycle health cost, indexed by severity (0 is not bleeding). */
    damageBySeverity: [0, 3, 7, 12],
    /** Base odds a wound drops one severity step at the end of a cycle. */
    baseClotChance: 0.4,
    /** Clotting rewards a clear head and a strong frame. */
    clotPerIntelligence: 0.025,
    clotPerStrength: 0.02,
    /** Moving around and fighting keeps a wound open. */
    aggressiveClotPenalty: 0.12,
    /** Exhaustion and starvation stop a body doing its own repairs. */
    exhaustedClotPenalty: 0.1,

    /**
     * Field dressing: the action any tribute can take on a wound, with or
     * without supplies. Costs the turn, rolls against intelligence and the
     * medicine proficiency, and improves a lot if they are holding something
     * to bind with.
     */
    dressBaseChance: 0.3,
    dressPerIntelligence: 0.035,
    dressPerMedicine: 0.12,
    /** Rope, wire or a spare pack to tear into strips. */
    dressBindingBonus: 0.2,
    /** Severity steps a successful dressing removes. */
    dressSeverityDrop: 2,
    /** An ally with free hands is far better at this than you are on your own. */
    allyDressBonus: 0.2,
} as const;

/**
 * Drinking from the arena itself.
 *
 * Thirst drains 15 a cycle and the only relief was a Water Canteen out of the
 * loot table, so a tribute could die of dehydration standing in a river. The
 * terrain relief that did exist (8/cycle) did not even cover the drain. Open
 * water is now genuinely drinkable — which finally gives the Toxic Swamps'
 * premise something to bite on, because there the water is exactly what kills
 * you unless you can boil it.
 */
export const WATER = {
    /** Thirst removed by drinking straight from a stream or a pool. */
    zoneDrinkRelief: 55,
    /** Odds foul water poisons a tribute who drinks it untreated. */
    foulPoisonChance: 0.35,
    /** Anything that can boil or treat a canteen of bad water. */
    purifiers: ['matches', 'medkit', 'antidote'] as const,
} as const;

/** Per-cycle health cost of each untreated injury. */
export const INJURY_DAMAGE = {
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
    // The magnetic fog (Shattered Archipelago) and the carnival's pine fog:
    // a low, steady pressure on the head rather than the body.
    fogSanityChance: 0.15,
    fogSanityLoss: 8,
    fogFatigue: 4,
    // The Perpetual Eclipse Forest: light that never resolves either way.
    duskSanityChance: 0.12,
    duskSanityLoss: 6,
    // The Industrial Abattoir: furnace heat in closed halls.
    furnaceFatigue: 7,
    furnaceBurnChance: 0.06,
    furnaceThirstMultiplier: 1.5,
    // The Vertical Quarry: cold rock damp that never dries.
    quarryDampFatigue: 5,
} as const;

/**
 * Tunables for the new arena signature rules (see engine/arenaSignature.ts).
 * The older signatures carry their numbers in the undeclared-knobs baseline;
 * these landed after that check existed, so they live here from day one.
 */
export const SIGNATURE_RULES = {
    eclipseStumbleChance: 0.25,
    eclipseSanityLoss: 9,
    reefBloomChance: 0.4,
    reefDodgeBase: 0.3,
    reefSanityLoss: 12,
    abattoirDodgeBase: 0.3,
    abattoirFatigue: 15,
    carnivalSanityLoss: 12,
    ashwasteWadeFatigue: 10,
    ashwasteBurnChance: 0.2,
    quarryDodgeBase: 0.3,
    glacierDodgeBase: 0.35,
    floeDunkChance: 0.3,
    floeDunkFatigue: 20,
    alpineDodgeBase: 0.3,
    terracesDodgeBase: 0.35,
    terracesFatigue: 12,
} as const;

/**
 * The declarative signature grammar (procedural arenas only — see
 * `SignatureRule` in models/types.ts and `runDeclarativeSignature` in
 * engine/arenaSignature.ts). Hand-authored arenas' bespoke functions above
 * keep their own inline numbers; this is the shared dial set for every
 * composed rule a generated arena gets instead.
 */
export const PROC_SIGNATURE = {
    /** 'everyNth' trigger: how many cycles between beats, [min, max]. */
    everyNthMin: 2,
    everyNthMax: 4,
    /** 'lowSurvivors' trigger: alive-count threshold, [min, max]. */
    lowSurvivorsMin: 4,
    lowSurvivorsMax: 8,
    /** 'damageEffect' payload base damage and its dodge roll. */
    damageBase: 18,
    dodgeBase: 0.25,
    dodgeAgility: 0.04,
    /** 'drainVital' payload magnitudes. */
    sanityDrain: 8,
    fatigueDrain: 10,
    /** 'invertResources' payload: how far a zone's depletion swings, and the midpoint that decides which way. */
    invertDelta: 0.4,
    invertMidpoint: 0.5,
    /** 'falseChance' telegraph: odds the warning names the wrong zone, [min, max] when rolled at generation. */
    falseChanceMin: 0.15,
    falseChanceMax: 0.35,
} as const;

/**
 * Per-arena terrain variance (procedural arenas only). The generator's base
 * `TERRAIN_PROFILES` is one danger/resource band per terrain shared by every
 * arena ever generated — this is how far a single arena's own version of a
 * terrain is allowed to drift from that shared band, so "forest" can mean a
 * larder in one arena and a hunting ground in another.
 */
export const PROC_TERRAIN = {
    /** Max shift applied to both ends of a terrain's danger/resources band. */
    shiftMax: 0.18,
} as const;

/** What each trait is worth, in the units the vitals loop works in. */
/**
 * What is left here after `data/traits.ts` took over the trait table: the two
 * bespoke effects that are not simple modifiers (Star-Crossed's per-cycle
 * audience drip) and the age profile, which is not a trait at all.
 */
export const TRAIT_EFFECTS = {
    starCrossedTrustPerCycle: 5,
    starCrossedExcitementPerCycle: 10,
    /** The youngest tributes burn rations faster and sleep worse. */
    youngHungerPenalty: 2,
    youngFatiguePenalty: 3,
    youngAge: 13,
} as const;

/**
 * Natural recovery.
 *
 * Before this there were exactly four things in the entire simulation that
 * raised a tribute's health: two loot items, a scripted arena boon, and the
 * feast. Health was a strictly monotonic decline punctuated by luck, which
 * removes the whole "hole up and recover" arc the source material runs on and
 * leaves the Defensive stance with nothing to do but forage.
 *
 * Recovery is deliberately conditional: a night, off your feet, not bleeding,
 * fed and watered and not wrecked with exhaustion. Meeting all of that is a
 * decision, not a default.
 */
export const RECOVERY = {
    /** Health a tribute recovers for spending the dark genuinely hidden. */
    darkAndHiddenBonus: 5,
    /** Health an insulated sleeping bag adds to a night of real rest. */
    sleepingBagBonus: 6,
    /** Health returned by a full night of undisturbed rest. */
    nightHeal: 7,
    /** A tribute holed up in cover mends better than one sleeping in the open. */
    shelteredBonus: 3,
    /** Above these, the body is spending everything it has just running. */
    maxHunger: 45,
    maxThirst: 45,
    /** Recovery scales down to nothing as fatigue approaches this. */
    fatigueCeiling: 80,
    /** Only a tribute who spent the night not looking for a fight heals. */
    restfulStances: ['Defensive', 'Evasive'] as const,
    /** An ally keeping watch means you actually sleep. */
    allyWatchBonus: 3,
} as const;

/**
 * Sanity as a pressure gauge rather than a countdown.
 *
 * A flat 5/cycle drain with four rare recovery paths meant everyone still alive
 * by cycle 14 was below the breakdown threshold and losing turns to it — the
 * stat measured elapsed time, not psychological state. Drain now responds to
 * what is actually happening to them, and rest, safety, food and company push
 * back the other way.
 */
export const SANITY = {
    /** Baseline pressure before anything specific to this tribute. */
    baseDrain: 4,
    /** Night is worse than day, and being alone at night is worse again. */
    nightDrain: 2,
    isolationDrain: 2,
    /** Hunger and thirst gnaw at the mind before they kill the body. */
    deprivationThreshold: 60,
    deprivationDrain: 3,
    /** Standing somewhere they remember people dying. */
    threatDrainPerPoint: 1.6,
    maxThreatDrain: 5,

    /** Rest recovers, and company recovers more. */
    restRecovery: 5,
    allyPresentRecovery: 4,
    /** A well-fed, unhurt tribute in a place they have no bad memory of. */
    safetyRecovery: 3,
    /** Fatigue above this cancels any rest recovery. */
    restFatigueCeiling: 70,
} as const;

/**
 * Hunting: what the Aggressive stance actually does.
 *
 * Aggression was priced out of the game — a hunting tribute could not forage,
 * took the same status damage as everyone else, and still only had a 40% chance
 * of interacting with someone standing in the same zone. It was a strictly
 * dominated choice, which is why only 12% of stance samples were Aggressive.
 */
export const HUNTING = {
    /** Kills after which the whole arena knows the name. */
    fearedAtKills: 3,
    /** Chance a directed sweep of the zone turns up small game to eat. */
    gameChance: 0.4,
    trackingBonus: 0.06,
    /** Hunger removed by a rabbit on a stick. */
    gameFeed: 35,
    /** Multiplier on the chance a hunter actually finds who they are looking for. */
    meetChanceMultiplier: 2.0,

    /** Bloodlust: what a kill does to the next fight. */
    momentumPerKill: 3,
    momentumMax: 6,
    momentumDecayPerCycle: 1,
    /** Combat power per point of momentum. */
    momentumPowerWeight: 0.8,
    /** Retreat chance shed per point of momentum. */
    momentumRetreatWeight: 0.04,
    /**
     * §3.4: the counterpart mood. Momentum only pointed one way — a tribute
     * who was ambushed, lost their weapon and watched an ally die was
     * mechanically identical to one who had a quiet day. Rattled is the
     * symmetric short-lived state: worse in a fight, far more likely to
     * break off. Raised by fleeing a fight, walking into a trap, and grief;
     * decays alongside momentum.
     */
    rattledMax: 6,
    rattledDecayPerCycle: 1,
    rattledPerFlee: 2,
    rattledPerTrap: 2,
    rattledPerGrief: 3,
    /** Combat power lost per point of rattled. */
    rattledPowerWeight: 0.7,
    /** Retreat chance added per point of rattled. */
    rattledRetreatWeight: 0.05,
} as const;

/**
 * Proficiencies: skills that improve with successful use.
 *
 * Deliberately shallow — a few points of swing over a full run — because the
 * point is visible specialisation, not a second attribute system that
 * out-weighs the first.
 */
export const PROFICIENCY = {
    /** Gained per successful use, before diminishing returns. */
    gainPerUse: 0.35,
    /** Nobody becomes a surgeon in eight days — but the old cap of 4 was hit
     *  by every specialist by mid-run, flattening late-run differentiation.
     *  Raised, with each successive point costing more (see `trainProficiency`),
     *  so the curve binds instead of the wall. */
    max: 6,
    /** Gains shrink by this factor per level already held. */
    diminishingPerLevel: 0.22,
    /** Archetypes start their signature skill slightly ahead. */
    archetypeHeadStart: 1,
    /** Forage chance added per point of forage proficiency. */
    forageWeight: 0.05,
    /** Combat power added per point of the relevant weapon proficiency. */
    combatWeight: 0.7,
    /** Power bonus for a weapon this tribute's district actually raises children on. */
    affinityItemBonus: 2.2,
    /** Smaller bonus for a weapon merely of a familiar class. */
    affinityClassBonus: 1.1,
} as const;

/**
 * Fear: how frightened a tribute is of one specific other tribute.
 *
 * Psychology touched exactly one decision before this — the generic retreat
 * roll — so a tribute who had watched someone butcher their ally walked into
 * that person's zone as happily as anyone else's.
 */
export const FEAR = {
    max: 100,
    /** Watching someone kill, and losing an exchange to them. */
    witnessedKill: 30,
    lostExchange: 14,
    /**
     * A legendary training score frightens people before the gong. Trimmed
     * from 6 (§3.3): the score already feeds odds, sponsor trust and persona
     * threat — four compounding advantages from one roll was too many.
     */
    perTrainingPointOverEight: 4,
    /** Per-cycle fade — terror is not permanent, but it is sticky. */
    decayPerCycle: 0.9,
    /** Retreat chance added at maximum fear. */
    retreatWeight: 0.35,
    /** Destination score subtracted for a feared rival's last known position. */
    avoidWeight: 2.5,
    /**
     * §3.2: beliefs with error. A cannon one zone over is information a
     * tribute acts on — and information they can get wrong. A near-miss
     * observer gains fear of the killer at this reduced rate...
     */
    distantKill: 12,
    /** ...and this often pins it on the wrong person entirely. */
    misattributionChance: 0.3,
    /** Landing a clean hit on someone you feared corrects the belief. */
    realityCorrection: 8,
} as const;

/**
 * Desperation: what the shrinking field does to two strangers meeting.
 *
 * Encounters resolved on stance and relationship alone, which meant two
 * unacquainted, non-aggressive tributes shared berries on day 7 with four
 * people left alive — as though either of them could go home without the other
 * dying. Only one tribute leaves the arena, and everyone in it knows that; the
 * closer the end gets, the less anyone can afford to be civil.
 */
/**
 * §3.3: the endgame self-assessment. Once the field is countable, a tribute
 * asks "do I win a straight fight?" — relative health, kills, arms, allies —
 * and lets the answer steer intention: winners hunt, losers turn to traps
 * and evasion instead of blundering into fights they have already lost.
 */
/**
 * §3.1: attribute drift. Attributes were frozen at the reaping, so a
 * tribute's physical trajectory was monotonically downward with no
 * counterweight. Starvation now wastes strength (the Starved trait already
 * recognised the fiction; this makes it mechanical), and sustained use of a
 * body-led skill earns back fractional agility/stealth.
 */
/**
 * §4.2: suspicion. Betrayal was instantaneous — nothing telegraphed it and no
 * tribute could suspect it. Suspicion is per-pair dread of a specific ally,
 * raised by watching them knife someone and by charter breaches, sharpened by
 * paranoia, decaying with quiet days. High suspicion causes pre-emptive
 * departure — sleeping apart, slipping away before dawn — and makes the
 * suspicious a harder mark for the betrayal they saw coming.
 */
export const SUSPICION = {
    max: 100,
    perWitnessedBetrayal: 35,
    perCharterBreach: 15,
    decayPerCycle: 2,
    /** At or above this, an ally considers getting out first. */
    departThreshold: 60,
    departChance: 0.35,
    /** How much being watched costs a betrayer's target weighting, at full suspicion. */
    hardMarkFactor: 0.5,
    /**
     * §4.2 R-3: suspicion rises from more than witnessed betrayals. An ally
     * whose kill count keeps climbing is an ally the rest of the group starts
     * watching — the cannon and the anthem make kills public knowledge.
     */
    allyKillCountWary: 2,
    perAllyKill: 8,
} as const;

export const DRIFT = {
    /** Strength lost per cycle spent past the starving threshold. */
    starvationWasting: 0.08,
    /** No wasting below this floor — the arena starves you, it does not delete you. */
    strengthFloor: 2,
    /** Fractional agility per whole level of melee/ranged proficiency gained. */
    agilityPerCombatLevel: 0.15,
    /** Fractional stealth per whole level of tracking proficiency gained. */
    stealthPerTrackingLevel: 0.15,
    /** T-1: fighting builds the frame doing it. */
    strengthPerMeleeLevel: 0.1,
    /** T-1: fieldcraft (medicine, forage) sharpens judgement. */
    intelligencePerFieldcraftLevel: 0.1,
    /** Drift ceiling: earned points never exceed this above the printed stat. */
    maxGain: 1,
} as const;

export const ENDGAME = {
    /** Field size at which tributes start counting. */
    fieldSize: 8,
    /** Assessment above this: hunt even outside an Aggressive stance. */
    hunterEdge: 0.25,
    /** Assessment below this: prefer traps, evasion, alliance-seeking. */
    underdogEdge: -0.25,
} as const;

export const DESPERATION = {
    /** Field size at which the arithmetic starts to press on people. The old
     *  gate of 8 produced ~11 desperation fights across 240 runs — most
     *  encounters at that field size are already combat through the stance and
     *  grudge branches, so the endgame's best beat almost never fired. */
    fieldSize: 10,
    /** Odds an otherwise-peaceful meeting turns into a fight, at the threshold. */
    baseHostility: 0.25,
    /** Added per tribute below the threshold. */
    perTributeBelow: 0.13,
    /** A bond this strong still holds when the numbers get ugly. */
    sparedBond: 30,
} as const;

/**
 * Physique. Age already mattered in combat; height and build were display-only
 * strings. Reach decides who lands first, mass decides who gets moved.
 */
export const PHYSIQUE = {
    /** Height that counts as neutral reach; taller gains, shorter loses. */
    neutralHeightCm: 165,
    /** Melee power per cm of reach advantage over the neutral height. */
    reachPerCm: 0.06,
    maxReachBonus: 2.5,
    /** Mass rating per build, used for knockdowns, grappling and cold. */
    massByBuild: { Frail: -2, Slight: -1, Average: 0, Athletic: 1, Stocky: 2, Muscular: 2.5 },
    /** Carry slots added per point of mass — a Frail twelve-year-old carries less. */
    capacityPerMass: 0.5,
    /** Cold resistance per point of mass. */
    frostbiteResistPerMass: 0.04,
} as const;

/** When a tribute reaches for the medical kit, and what it buys them. */
export const MEDICAL = {
    medkitHealthThreshold: 70,
    medkitHeal: 50,
    ointmentHealthThreshold: 85,
    ointmentHeal: 25,
} as const;

/** The shrinking arena, from day 5 onward. */
/**
 * The bloodbath, as its own set of numbers.
 *
 * These used to be literals scattered through `processBloodbath`, tuned for a
 * scrum that killed 0.84 tributes out of 24. In the source material roughly
 * half the field dies at the Cornucopia in the first ten minutes, and every
 * downstream problem — a field of non-combatants surviving to die of thirst on
 * day 6, the environment out-killing the tributes — starts here.
 */
export const BLOODBATH = {
    /** Baseline willingness to go for the Cornucopia rather than the treeline. */
    fightChanceBase: 0.66,
    /** Added for a Career: the pack came here to do exactly this. */
    fightChanceCareer: 0.4,
    /** Weight on how close their plate landed to the horn. Proximity is opportunity. */
    fightChanceProximity: 0.35,
    /** Weight on agility: getting there first is most of getting there. */
    fightChanceAgility: 0.03,
    /** Rounds of the opening scrum in which nobody is thinking clearly enough to run. */
    noRetreatRounds: 3,
    /** Chance a surviving fighter is pulled back into the scrum rather than breaking out. */
    reengageChance: 0.85,
    /** Chance a knot at the mouth of the horn resolves as a group fight, not a duel. */
    groupFightChance: 0.5,
    /** Chance a surviving participant of a group fight stays in the scrum. */
    groupReengageChance: 0.75,
    /** Damage multiplier on hits landed inside the killing zone. */
    killingZoneDamage: 1.7,
    /** Chance a tribute who reached the horn first comes away armed. */
    armedAtHornChance: 0.85,
    /**
     * Turning your back on the Cornucopia is not the same as escaping it. A
     * tribute who ran from a plate near the horn spends several seconds inside
     * the reach of people who came here to kill, and canon's bloodbath is full
     * of tributes cut down with their backs turned. Scaled by how close their
     * plate was.
     */
    runDownChance: 0.5,
} as const;

/**
 * REPLAY-07: the anthem, as a nightly beat with weight rather than a UI card.
 */
export const ANTHEM = {
    /** Excitement the whole field loses on a day that produced no cannon. */
    quietDayExcitementCost: 6,
    /** Relationship at which a name in the sky is a personal loss. */
    grievableBond: 25,
    sanityPerNamedLoss: 6,
    /** Chance a personal loss gets its own line rather than being silent arithmetic. */
    reactionChance: 0.5,
} as const;

export const ESCALATION = {
    startDay: 5,
    /**
     * Canon's Gamemakers do not escalate on a timetable; they escalate because
     * the audience is bored. Aggregate excitement across the living field is
     * the boredom meter, and the arena starts closing the moment it drops
     * below this — which can be well before `startDay` in a quiet year, and
     * never later, because `startDay` remains a hard backstop.
     */
    boredomThreshold: 22,
    /** Nothing closes in before this, however dull the Games are. */
    boredomEarliestDay: 3,
    collapseDamageBase: 20,
    collapseDamagePerDay: 10,
    /** The Gamemakers want a victor: the border stops short of the last two. */
    finalistCollapseDamage: 10,
    finalistCount: 2,
    /**
     * The forced finale. Finalist protection (see `applyDamage`) means the
     * arena can no longer finish the last two by attrition — which also means
     * two evasive finalists who keep missing each other could drag a run out
     * indefinitely (a 500-day Games surfaced in the soak the cycle after the
     * protection landed). Canon has the answer: the Gamemakers drive the
     * finalists to the Cornucopia and make them settle it. After this many
     * cycles at finalist count without a resolution, both are herded to the
     * horn every cycle until it ends.
     */
    finaleAfterFinalistCycles: 6,
    hazardMultiplierPerDay: 0.3,
    hazardCeiling: 0.35,
} as const;

/**
 * Volunteering, which the simulation had no concept of at all.
 *
 * "I volunteer as tribute" is the opening beat of the source material and the
 * whole reason Career districts are dangerous: their tributes are not children
 * picked out of a bowl, they are the ones who put their hand up. A volunteer
 * is older, trained, and chose this — so they replace the reaped name with a
 * better one. The rare non-Career volunteer is the opposite: somebody stepping
 * in front of a sibling, which is worth its own line even though it usually
 * gets them killed.
 */
export const VOLUNTEER = {
    /** Chance a Career district's reaping is answered by a volunteer. */
    careerChance: 0.88,
    /**
     * Chance anywhere else. Almost always a sibling, and almost always a
     * disaster.
     *
     * Deliberately tiny. At 0.06 per tribute this fired in 71% of runs across
     * eighteen non-Career tributes, which makes the single most memorable
     * reaping beat in the source material a routine occurrence. At 0.015 it
     * lands in roughly a quarter of Games, which is what "District 12 has not
     * had a volunteer in living memory" is supposed to mean.
     */
    outlyingChance: 0.015,
    /** A volunteer is of age: the floor their age is raised to. */
    minAge: 16,
    /** Attribute points a trained Career volunteer adds over the reaped tribute. */
    careerStrengthBonus: 1,
    careerAgilityBonus: 1,
    /** The crowd notices someone who wanted this. */
    careerTrust: 6,
    careerExcitement: 8,
    /** Stepping in for a sibling buys sympathy the Capitol cannot resist. */
    sacrificeTrust: 10,
    sacrificeExcitement: 14,
} as const;

/** Random encounters, hazards and mutts during a cycle. */
/**
 * Item grades and condition. See `mintItem` in `engine/items.ts`.
 *
 * SIDE-01: the item table was flat — every Sword in every run was the same
 * Sword, and a weapon was at full strength right up to the instant it snapped.
 */
export const QUALITY = {
    /** Roll above this for a fine instance, below the other for a crude one. */
    fineAbove: 0.82,
    crudeBelow: 0.3,
    scale: { crude: 0.7, standard: 1, fine: 1.35 } as Record<string, number>,
    prefix: { crude: 'Crude', fine: 'Fine' } as Record<string, string>,
    /** Damage a weapon still does at zero condition, as a fraction of its printed damage. */
    wornDamageFloor: 0.55,
    /** Ceiling on total damage reduction from worn armour. */
    maxArmour: 0.35,
    /** Durability an armour piece loses per point of damage it absorbs. */
    armourWearPerPoint: 1.5,
} as const;

/**
 * Where an item came from, expressed as a shift on the quality roll. The good
 * steel is stacked at the mouth of the Cornucopia; nobody parachutes a crude
 * anything; and a field-lashed spear is a field-lashed spear.
 */
export const QUALITY_BIAS = {
    hornMouth: 0.25,
    hornScatter: 0,
    feast: 0.15,
    parachute: 0.3,
    scavenged: -0.1,
    improvised: -0.35,
} as const;

export const ENCOUNTERS = {
    /** T-5: dodge penalty per grade of leg injury (was a flat 2 boolean). */
    legsDodgePenaltyPerGrade: 1.25,
    /** Fallback escape difficulty for an event that does not name its own. */
    defaultDodgeDifficulty: 6,
    /**
     * SIDE-09 — the survival lanes for the two attributes the authored arena
     * events almost never asked for. See `rollEscape` in `encounters.ts`.
     */
    /** Damage at which a hazard is heavy enough that bracing for it means something. */
    braceDamageThreshold: 18,
    /** Fraction of a hazard's damage soaked, per point of strength. */
    bracePerStrength: 0.035,
    braceMaxSoak: 0.3,
    /** Added to the escape difficulty for the fallback attribute. */
    altDodgePenalty: 1,
    /** An ally in the same zone hauling someone clear. */
    rescuePerCharisma: 0.035,
    rescuePerHelperStrength: 0.02,
    rescueMaxChance: 0.45,
    /** What being pulled clear is worth to the person who was pulled. */
    rescueGratitude: 10,
    ambientLineChance: 0.35,
    ambientArenaShare: 0.55,
    /** Odds a dynamic ambient line is about a branded alliance rather than an individual. */
    brandedAmbientChance: 0.25,
    /** Odds the "they never noticed each other" near-miss line fires when stealth held. */
    nearMissLineChance: 0.25,
    /** Share of ambient lines that read the run's own state instead of being pure scenery. */
    dynamicAmbientShare: 0.25,
    baseEventChance: 0.1,
    baseMuttChance: 0.1,
    hazardCeiling: 0.9,
    /** Chance two tributes sharing a zone actually interact. */
    meetChance: 0.4,
    /** Chance a crowded zone escalates into a group fight rather than a duel. */
    groupFightChance: 0.7,
    /** Cap on how many tributes are drawn into a single brawl. */
    maxBrawlSize: 5,
    /** Chance a tribute wanders rather than holding position. */
    wanderChance: 0.5,
    /** Depletion at which a forage attempt reports the ground picked clean. */
    strippedZoneNotice: 0.55,
} as const;

/** Multi-round duels: how long they last and when someone breaks off. */
export const COMBAT = {
    /** Hard ceiling on exchanges in a single encounter. */
    maxRounds: 4,
    /**
     * Extra exchanges in the bloodbath. Nowhere else in the arena are two
     * people fighting with no line of retreat and a dozen others in arm's
     * reach; a scrum at the horn runs until somebody is on the ground.
     */
    bloodbathExtraRounds: 3,
    /** Damage a clean hit lands before modifiers. */
    baseHitDamage: 14,
    /** Extra damage per point of power advantage in the round. */
    damagePerPowerPoint: 2.2,
    /** Damage floor and ceiling for any one exchange. */
    /** T-5: combat-power penalty per grade of arm/leg injury (was a flat 2). */
    limbPowerPenaltyPerGrade: 1.25,
    minRoundDamage: 5,
    maxRoundDamage: 42,
    /**
     * What a kill costs the killer, in sanity, before their traits scale it.
     * A Career has been prepared for this since they were ten; nobody else has.
     */
    killSanity: 14,
    careerKillSanity: 4,
    /** A toll this size is a visible breakdown, not a bad night. */
    killSanityBreakdown: 25,
    /** A fleeing opponent this far gone was spared, not merely escaped. */
    mercyHealth: 25,
    /** Below this, a landed hit reads as finishing the fight rather than opening it. */
    finishingHealthThreshold: 30,
    /** Power a Vengeful tribute brings against the specific person they hate. */
    vengefulEdge: 3,
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
    /**
     * Action economy for numbers: every attacker beyond the lead presses the
     * same target each round, at this flat power penalty so a six-strong pack
     * is frightening without instantly deleting anyone it corners.
     */
    supportAttackPenalty: 4,
    /**
     * In a free-for-all, how much a sworn grudge outweighs pure opportunism
     * when picking who to swing at. Target selection there is a weighted draw
     * leaning on who is hurt worst; this is the thumb on the scale for someone
     * the attacker has a specific reason to want.
     */
    freeForAllVengeanceWeight: 60,

    /** Base odds a tribute breaking off eats a parting shot on the way out. */
    partingShotChance: 0.3,

    /** Relationship deltas produced by fighting. */
    grudgePerFight: 20,
    /** Health below which an ally who fought beside you genuinely saved you. */
    savedHealthThreshold: 35,
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
    /** §5.2: concealment/ambush per unit of zone cover above the 0.35 baseline. */
    coverGradeScale: 0.5,
    /** §5.2: ambush chance lost against a zone with commanding high ground. */
    elevationAmbushPenalty: 0.1,
    /** §5.2: ambush chance gained where the ways in and out bottleneck. */
    chokepointAmbushBonus: 0.12,
    /** §5.2: extra reluctance-to-flee where the exits bottleneck. */
    chokepointRetreatPenalty: 0.1,
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
    /** Being hurt makes you easier to find. */
    bleedingPenalty: 0.1,
    /** An alliance cannot move quietly. */
    groupPenalty: 0.08,

    /** Awareness: what it takes to notice someone who does not want noticing. */
    awarenessFromIntelligence: 0.5,
    /**
     * REPLAY-07: what the dark is worth. Deliberately the largest situational
     * modifier in the system — a night should feel like a different game, not
     * like a day with a fatigue penalty.
     */
    nightConcealment: 0.18,
    nightAwarenessPenalty: 2.5,
    /** Dusk: the hunter's window. Their quarry is moving and still visible. */
    duskAmbushBonus: 0.14,
    /** Half the night's cover, since there is still light to be seen by. */
    duskConcealment: 0.1,
    nightAmbushBonus: 0.12,
    /** A lantern: you can see, and so can everyone else. */
    lightAwarenessBonus: 2,
    lightConcealmentPenalty: 0.12,
    // The per-trait awareness bonuses that used to live here are now rows in
    // `data/traits.ts`, alongside every other effect the same trait has.
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

/**
 * Need-driven movement.
 *
 * Destination scoring read terrain, danger and memory but never the tribute's
 * own body, so someone at 90 thirst wandered by forage score alone and died two
 * zones from open water. These are the standing intentions a tribute actually
 * carries between cycles: find water, find somewhere to sleep.
 */
export const MOVEMENT = {
    /** §5.3: extra fatigue for completing a two-cycle crossing or climb. */
    crossingFatigue: 8,
    /** Thirst above which finding water outranks everything else. */
    thirstUrgency: 45,
    waterSeekWeight: 7,
    /** Hunger above which walking somewhere that still has food becomes a plan. */
    hungerUrgency: 55,
    /** A zone this stripped (believed) is not worth foraging in. */
    forageBarrenThreshold: 0.5,
    /** A destination zone needs at least this much printed forage to be worth the walk. */
    forageMinResources: 0.45,
    /** Fatigue above which cover is worth walking to. */
    shelterUrgency: 60,
    shelterSeekWeight: 1.5,
} as const;

/**
 * Standing intentions. See `engine/objectives.ts`.
 *
 * The lifetimes are the important numbers here: an objective that expires every
 * cycle is not an objective, and one that never expires is a tribute who cannot
 * change their mind. These are tuned so a plan survives long enough to be
 * legible in the chronicle without outliving the situation that produced it.
 */
export const OBJECTIVES = {
    /** How long each kind of intention survives before it is re-evaluated. */
    huntCycles: 4,
    reachCycles: 4,
    holdCycles: 3,
    fleeCycles: 2,
    protectCycles: 5,

    /** Fear of someone standing next to you that makes leaving the plan. */
    fleeFear: 45,
    /** Fear at which a hunter gives up on their quarry. */
    huntAbandonFear: 70,
    /** An ally this hurt, or this close, is worth guarding. */
    wardHealth: 55,
    wardBond: 45,
    /** Health below which finding somewhere to hole up becomes the priority. */
    holeUpHealth: 45,
    /** Ground worth standing on: good forage and no bad memories. */
    holdMinResources: 0.5,
    holdMaxThreat: 0.4,
} as const;

/**
 * Field-expedient making.
 *
 * `craft()` supported exactly two recipes: rope+knife makes a spear, and a
 * Trickster with wire makes a garrote. There was no snare, no deadfall, no fire
 * despite matches existing and warding cold, no shelter, no water purification
 * despite the Toxic Swamps' entire premise being undrinkable water, no poison
 * application and no camouflage. Traps in particular were the obvious missing
 * verb: the Trickster archetype's `treachery: 0.35` had exactly one expression
 * in the whole simulation.
 */
/**
 * Zone effects: the arena in a state other than its printed one.
 *
 * `Zone.danger` and `.resources` were immutable printed numbers; only
 * `zoneDepletion` ever moved. A fire that spreads along the adjacency graph
 * over a few cycles is the single most evocative arena mechanic available and
 * the graph already exists — nothing used it for anything but pathing.
 */
/**
 * Mutts.
 *
 * These lived as a module-local `const MUTTS` inside `engine/mutts.ts` with a
 * comment noting they were "documented the way balance.ts documents its own" —
 * which is exactly the drift the README's "every tunable number the engine
 * reads" claim is supposed to prevent. Moved here so they are tunable where
 * everything else is.
 *
 * §5: the lethality problem. Mutts caused 2.0% of measured deaths across
 * ~1,400 encounters per 240 runs — the overwhelming majority resolved as a
 * wound and a scare. Gamemaker mutts are one of the two most iconic threats in
 * the source material and they were mechanically decorative. The fix is not to
 * make every bite fatal: it is to make a *pack* genuinely dangerous (the
 * falloff and cap were throttling exactly the thing that should frighten
 * people) and to let the Gamemakers put real teeth on them once the audience
 * is owed a finish.
 */
export const MUTTS = {
    /** Evasion roll: tribute agility + spread vs mutt speed. Wider spread than
     *  the old fixed threshold, so a slow tribute can still get lucky. */
    evasionRollSpread: 4,
    /** Extra hits beyond the first do less each time, so a pack raises danger
     *  without one-shotting a whole tribute in a single roll. */
    packDamageFalloff: 0.7,
    /** A pack can never deal more than this multiple of the lead mutt's base
     *  damage in one encounter, however many extra mutts connect. */
    packDamageCap: 3.4,
    /**
     * Flat multiplier on every mutt's printed damage. A single dial beats
     * editing 46 roster entries, and keeps each mutt's *relative* danger — the
     * careful part of that data — exactly as authored.
     */
    damageScale: 1.55,
    /**
     * Escalation teeth. Once the Gamemakers have started closing the arena,
     * what they release is not what they released on day two. Scales with days
     * since escalation began, capped so a long run does not produce mutts that
     * delete a healthy tribute outright.
     */
    escalationDamagePerDay: 0.12,
    escalationDamageCap: 0.6,
    /** How many cycles a persistent mutt keeps hunting once it finds someone. */
    persistentDuration: 3,
    /** Chance a persistent mutt's tracked target gets caught again on a given tick. */
    persistentReattackChance: 0.55,
    /**
     * "Wearing the faces of the fallen" — canon's most disturbing mutt beat.
     * Kept rare and gated on there actually being a death someone in the zone
     * mourned; this is not a roll on every mutt attack, it is a distinct
     * horror event layered on top of one.
     */
    facesOfFallenChance: 0.08,
    facesOfFallenSanityLoss: 30,
    /** `herder` role: a connecting hit relocates instead of damaging. Sanity cost for the shove, no health cost. */
    herderSanityLoss: 6,
    /** `swarm` role: extra damage multiplier per additional tribute present in the zone, beyond the first. */
    swarmDamagePerAlly: 0.25,
    swarmDamageCap: 2.5,
} as const;

export const ZONE_EFFECTS = {
    /** How long each effect lasts before lifting on its own. */
    burningDuration: 3,
    floodedDuration: 4,
    frozenDuration: 3,
    contaminatedDuration: 4,
    fogboundDuration: 2,
    /** A burned-out zone is stripped for a long while — the ground is ash. */
    strippedDuration: 6,
    strippedDepletion: 0.85,

    /** Fire: per-cycle damage to anyone still standing in it, and its spread. */
    burningDamage: 10,
    burningBurnChance: 0.6,
    /** Cycles between spread attempts, and the terrain that can catch. */
    spreadEveryCycles: 1,
    /**
     * §5.1 A-1: a spreading wildfire is the most cinematic thing this system
     * can do and it happened in 5% of Games — spread reached a neighbour 12
     * times in 240 runs. Chance up, and open ground (dry grass, scrub, dunes)
     * burns too.
     */
    spreadChance: 0.55,
    flammableTerrain: ['forest', 'wetland', 'open'] as const,

    /** Flooding: drowning risk for anyone who lingers instead of leaving. */
    floodDamage: 14,
    floodDrownChance: 0.12,

    /** A localised freeze on top of whatever the arena's own climate is doing. */
    frozenFatigue: 6,
    frozenFrostbiteChance: 0.12,

    /** Contamination: a toxin in the ground or the air, zone-scoped. */
    contaminatedPoisonChance: 0.1,
    contaminatedSanityLoss: 4,

    /** Fog: awareness is suppressed for everyone in the zone, hiders and
     *  seekers alike — nobody can see much of anything in it. */
    fogAwarenessPenalty: 3,

    /** How often the Cornucopia gets a fresh drop, and how much it restocks. */
    cornucopiaRestockEveryCycles: 5,
    cornucopiaRestockChance: 0.5,
    cornucopiaRestockAmount: 0.6,

    /**
     * Ambient origination: the arena itself starting something, independent of
     * any one tribute's per-cycle hazard roll. This is what actually lights the
     * first fire, floods the first zone, freezes the first ridge — without it
     * the whole zone-effect system only ever fires through a hand-authored
     * event flag, and none of the existing hazard text sets one.
     */
    ambientEscalatedOnly: true,
    ambientFireChance: 0.045,
    ambientFloodChance: 0.03,
    ambientFreezeChance: 0.02,
    ambientContaminateChance: 0.02,
    ambientFogChance: 0.03,
    ambientSeverChance: 0.012,
} as const;

export const CRAFTING = {
    /** A blade below this condition is worth an hour with a whetstone. */
    sharpenBelowCondition: 0.7,
    /** Fraction of maximum durability a sharpening restores. */
    sharpenRestore: 0.35,
    /** Per-cycle odds an empty-handed tribute improvises something to swing. */
    improviseChance: 0.12,
    /** Odds a free turn is spent preparing rather than foraging. */
    fieldcraftChance: 0.35,

    /** Fire: wards cold, cooks, purifies — and is visible for miles. */
    fireCycles: 2,
    fireConcealmentPenalty: 0.25,
    fireSanityRecovery: 4,
    /** A whetstone and a blade can strike sparks — a discount off the normal
     *  build chance rather than requiring matches outright. */
    fireWhetstoneMultiplier: 0.6,
    /** Bare-handed: a bow-drill attempt. Rare, and better with intelligence
     *  and forage proficiency, but never requires an item at all. */
    fireNoToolBaseChance: 0.06,
    fireNoToolPerIntelligence: 0.015,
    fireNoToolPerForageProficiency: 0.03,
    /** Shelter: somewhere to actually sleep. Needs cover to build in. */
    shelterCycles: 3,
    shelterRecoveryBonus: 4,
    shelterExposureReduction: 0.5,
    /** Camouflage: mud, ash and foliage. The cheapest concealment in the arena. */
    camouflageCycles: 2,
    camouflageConcealment: 0.18,

    /** Base odds a build attempt succeeds, before intelligence. */
    buildBaseChance: 0.45,
    buildPerIntelligence: 0.04,
} as const;

/**
 * Traps: the missing verb.
 *
 * A trap is the one thing in the arena that keeps working while its owner is
 * somewhere else, which is what makes it the Trickster's whole argument. It is
 * also the only mechanic here that can kill without either party being present,
 * so the numbers are deliberately modest.
 */
export const TRAPS = {
    /** Cycles before an unsprung trap rots, is found by the arena, or is stepped over. */
    lifetime: 6,
    /** How many a single tribute can have set at once. */
    maxPerTribute: 2,
    /** Base odds a build attempt produces a working trap. */
    buildBaseChance: 0.5,
    buildPerIntelligence: 0.045,
    buildPerTracking: 0.08,
    /** Tricksters have been thinking about this their whole lives. */
    trickeryBonus: 0.2,

    /** Concealment the trap is set with, rolled against a passer-by's awareness. */
    baseConcealment: 0.45,
    concealmentPerIntelligence: 0.03,
    maxConcealment: 0.85,
    /** Cover to hide a snare in, and open ground that will not. */
    coverConcealmentBonus: 0.12,
    openConcealmentPenalty: 0.15,

    /** Damage when someone walks into one. */
    snareDamage: 12,
    deadfallDamage: 34,
    /** Odds the victim is left bleeding. */
    snareBleedChance: 0.3,
    deadfallBleedChance: 0.6,
    /** A snare holds someone in place; a deadfall just hurts them. */
    snareLegInjuryChance: 0.45,

    /** Odds an unsprung snare catches an animal instead, feeding its owner. */
    gameCatchChance: 0.22,
    gameFeed: 30,
} as const;

/** Applying venom to a blade — the Trickster's other unspoken speciality. */
export const POISONING = {
    /** Items that can be rendered down into something to coat a blade with. */
    sources: ['nightlock', 'berries'] as const,
    baseChance: 0.4,
    perIntelligence: 0.05,
    /** Odds a botched attempt poisons the poisoner. */
    selfPoisonChance: 0.25,
} as const;

/** What a tribute can physically carry. */
export const INVENTORY = {
    /** Ceiling on a single stack of a consumable. */
    maxStack: 4,
    /**
     * Items carried in hands, pockets and a bedroll. Tributes hold well under
     * one item on average, so this is deliberately tight: a limit that only
     * binds after a kill or a feast is a limit that makes looting a decision,
     * and anything looser leaves the Backpack with nothing to do.
     */
    baseCapacity: 4,
    /** A Backpack also keeps food out of the sun. */
    backpackSpoilageBonus: 2,

    /**
     * §3.3: encumbrance — the fast Career counterweight the balance goals
     * needed. Careers win the bloodbath, take the Cornucopia, and used to pay
     * nothing for hauling it: `enforceCapacity` was the only cost of being
     * over-equipped. A pack laden with the horn's contents is now slower in a
     * fight, louder in the brush, and wearier at the end of the day — which is
     * exactly the canon dynamic.
     */
    /** Load fraction of carrying capacity below which nothing is felt. */
    encumbranceFreeFraction: 0.6,
    /** Combat-power penalty at a completely full pack. */
    encumbrancePowerPenaltyMax: 3.5,
    /** Concealment penalty at a completely full pack. */
    encumbranceStealthPenaltyMax: 1.5,
    /** Extra fatigue per cycle at a completely full pack. */
    encumbranceFatigueMax: 5,
} as const;

/** Zone economy: foraging strips a zone, and the arena grows it back slowly. */
export const ZONES = {
    /** A fishing net in still water, added to the forage chance. */
    fishingBonus: 0.25,
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
    /** T-7: odds a quiet cycle surfaces one of a tribute's quirks as colour. */
    quirkLineChance: 0.06,
    yieldForageWeight: 0.4,
    survivalistForageBonus: 0.15,
    /** Aggressive/Evasive tributes can still stumble onto food or water while
     *  hunting or hiding — just far less reliably than someone actively foraging. */
    aggressiveForageMultiplier: 0.4,
    evasiveForageMultiplier: 0.25,
    /** Share of successful forages that turn up nightlock instead of a meal. */
    nightlockChance: 0.12,
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
    /**
     * How much of their apparent threat a tribute who played the training floor
     * quiet keeps hidden. The whole payoff of `trainingStrategy: 'conceal'`:
     * strangers read them as ~30% less dangerous than they are, until a kill or
     * a fight gives the game away.
     */
    concealDiscount: 0.7,
    /** Minimum cycles a stance is held before it may change again. */
    minHold: 3,
    /** Score margin a challenger stance must beat the current one by. */
    switchMargin: 0.8,
    /** Health fractions that pull a tribute toward each stance. */
    evasiveHealth: 40,
    cautiousEvasiveHealth: 55,
    aggressiveHealth: 70,
    /** Threat ratio (their power vs mine) above which the zone reads as hostile. */
    outmatchedRatio: 1.25,
    dominantRatio: 0.8,
    /** Hunger above which hunting is worth it for the food alone. */
    huntingHunger: 55,
    /**
     * Once the field is this small, hiding stops being a strategy: somebody has
     * to force the issue and the Gamemakers will make sure somebody does.
     */
    endgameFieldSize: 5,
    endgameAggression: 1.4,
    /** §3.2: momentum's pull toward Aggressive (was an undeclared 0.35). */
    momentumAggressionWeight: 0.25,
    /** §3.2: the reasons Defensive exists — a ward, claimed ground, a built camp. */
    protectDefensive: 1.2,
    holdDefensive: 1.0,
    campDefensive: 0.6,
} as const;

/** Relationship graph: bounds, decay, and the deltas life in the arena applies. */
export const RELATIONSHIPS = {
    /** §4.3: trust corrections applied on top of regard. See `trustOf`. */
    trustStoodByBonus: 15,
    trustBetrayedPenalty: 40,
    trustSuspicionWeight: 0.4,
    trustCreditorBonus: 10,
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
    /**
     * ...or, far more often, when the death was personal: an ally, a lover, or
     * anyone this tribute was this close to. See `propagateDeathFallout`.
     */
    vengeanceBond: 40,
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

/**
 * Romance.
 *
 * Star-crossed lovers formed in the overwhelming majority of runs, on roughly
 * day 3. It is supposed to be the rarest and most memorable outcome in the
 * game. The cause was arithmetic: district partners start around +22, romance
 * grew +4..10 every cycle merely for standing in the same zone, everybody
 * starts in the Cornucopia together, and the threshold of 80 therefore fell in
 * five to eight calls before anything had actually happened between them.
 *
 * The fix is to stop paying for proximity and start paying for conduct: they
 * have to have survived the bloodbath, been in sustained contact, and one of
 * them has to have taken a real risk for the other. Even then it is a roll, not
 * a promotion at a number.
 */
/**
 * CONTENT-06: the protective bond. See `growProtectorBond` in `phases/alliances.ts`.
 */
export const PROTECTOR_BOND = {
    /** Years apart before this reads as protective rather than merely allied. */
    minAgeGap: 4,
    /** Bond required, on the same relationship scale romance uses. */
    threshold: 70,
    chancePerCycle: 0.18,
} as const;

export const ROMANCE = {
    /**
     * Odds a one-sided attachment gets played for the cameras instead.
     * §6.1: at 0.07 behind five conjunctive gates the performed bond fired
     * 1-2 times across 240 runs — one of the best ideas in the codebase,
     * effectively unreachable. Loosened with performedMinRegard and
     * performerCharisma so it lands a few times per soak. Loosened again when
     * alliance formation gained its same-zone gate: fewer organic alliances
     * means less sustained contact for the streak to build on.
     */
    performedChance: 0.2,
    /**
     * Regard the smitten party needs. Deliberately below `threshold`: a
     * performed bond does not need the mutual devotion a real one does, only
     * one person who has fallen far enough to be convincing about it.
     */
    performedMinRegard: 62,
    /** Charisma needed to sell a romance you are not feeling. */
    performerCharisma: 5,
    /** What the performer shows, as opposed to what they feel. */
    performedDisplayedRegard: 75,
    /** Nothing before the bloodbath is over and the cast is real. */
    minDay: 2,
    /** Bond required before a romance is even considered. */
    threshold: 92,
    /**
     * How many pairs may convert in a single cycle.
     *
     * `growRomance` and `growProtectorBond` each returned on their first
     * success, cast-wide — so if two eligible pairs existed in the same cycle,
     * the second was silently not evaluated at all, and its pair had to stay
     * eligible until a cycle where nobody beat them to it. That is a throttle
     * on the rarest events in the game, applied at the worst possible moment.
     * A small cap keeps a cast from pairing off all at once without discarding
     * everyone who is not first in the iteration order.
     */
    maxPerCycle: 2,
    /** Cycles of recent contact required, tracked as a streak. */
    sustainedCycles: 3,
    /** Contact this stale breaks the streak. */
    contactWindow: 2,
    /**
     * Odds per cycle once every condition holds. Romance is never automatic.
     * Retuned 0.1 -> 0.04 at integration: removing the one-per-cycle romance
     * throttle and loosening the performed-bond gates each passed the 5%-22%
     * lover-runs guard alone, and stacked to 23.3% together. 0.04 lands the
     * combined system at ~15%, the top of the 10%-15% design goal, with the
     * performed-bond firing floor still comfortably clear.
     */
    chancePerCycle: 0.04,
    /**
     * Per-day decay on that chance. Keeps the romance rate a property of the
     * cast rather than a property of how long the Games happened to run.
     */
    latenessDecay: 0.72,
    /** Growth from an actual shared scene — not merely from co-location. */
    contactGrowth: 5,
    /** Standing by someone is worth far more than standing near them. */
    stoodByGrowth: 14,
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
    maxSize: 6,
    /**
     * Average regard below which a group simply stops being one. Was an
     * undeclared `-15` sitting in `phases/alliances.ts` — the same balance
     * drift the README's "every tunable number the engine reads" claim is
     * meant to prevent.
     */
    rotDissolveTrust: -15,

    /**
     * Factions inside a large group.
     *
     * §4: alliance size was capped and nothing distinguished a six-person
     * pack's internal politics from a pair's beyond leader-challenge maths.
     * A big group had no way to be a *coalition* — it was either intact or
     * evaporated, and the interesting middle (the pack that splits along the
     * lines everyone could already see) could not happen at all.
     *
     * A schism is checked before the rot-dissolve above, so a group that has
     * two coherent halves splits into two standing alliances rather than
     * scattering into loners. The split follows the regard graph, so it lands
     * where the audience has been watching it build.
     */
    schismMinSize: 4,
    /** Each side of the split has to be a viable group on its own. */
    schismMinFaction: 2,
    /**
     * Average cross-faction regard at or below this means two camps rather
     * than one group.
     *
     * Deliberately *not* a hostility threshold. Set to -5 initially, this
     * never fired once across 240 runs, and the reason is structural: people
     * in an alliance like each other — that is why they are in it — so a group
     * whose halves genuinely resent each other has already crossed
     * `rotDissolveTrust` and dissolved. A schism is not a group that hates
     * itself; it is a group where one half is much closer to each other than
     * to anyone else, and the shared bond has gone lukewarm. That is the real
     * shape of a pack splitting, and it is reachable.
     */
    schismCrossRegard: 25,
    /** Within a faction, regard has to be genuinely better than across it, by this much. */
    schismCohesionGap: 12,
    schismChance: 0.4,
    /**
     * Leadership coup: the two dials that decide whether the pack's internal
     * drama actually happens. The challenger needs this much more collective
     * backing than the standing leader, and then the coup still only lands on
     * this roll. Both used to be literals buried in `reconcileAlliances`.
     */
    coupBackingMargin: 20,
    coupChance: 0.25,
    /**
     * §3.3: the crown rivalry. The two leading killers in a Career-majority
     * pack erode each other's regard every cycle — the structural fault line
     * that makes the pack brittle from inside rather than only from hunger.
     */
    crownRivalryMinKills: 2,
    crownRivalryPerCycle: 3,
    crownRivalryLineChance: 0.12,
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

    /**
     * Mergers. Two duos who trust each other should be able to become a four,
     * which is the missing path that left almost every organic alliance a pair
     * for the whole run.
     */
    /** §6.1: 0.35/12 produced ~9 merges per 240 runs. */
    mergeChance: 0.5,
    mergeThreshold: 5,
    /**
     * Mergers resolvable per cycle. `mergeAlliances` returned on its first
     * success, so a cast with three merge-eligible pairings resolved one per
     * cycle regardless of how ready the others were.
     */
    maxMergesPerCycle: 2,

    /**
     * Walking away from a group you have no complaint about.
     *
     * Every existing exit from an alliance is a grievance: suspicion-driven
     * pre-emptive departure, betrayal, romance defection, pact expiry. There
     * was no path for a tribute who trusts their group fine and simply intends
     * to win alone — which is a real and very canon shape, and the reason a
     * loner archetype in a comfortable pack had no way to act like a loner.
     * Gated on the field being small enough that the arithmetic is visible to
     * everyone, so it reads as a decision about the endgame rather than
     * random churn.
     */
    soloDepartureFieldSize: 8,
    soloDepartureBase: 0.05,
    /** How much the tribute's own independence pushes them out the door. */
    soloDepartureAffinityWeight: 0.35,
    /** Somebody who thinks they win a straight fight has least reason to share. */
    soloDepartureConfidenceBonus: 0.1,
    /** Leaving people who like you costs something on the way out. */
    soloDepartureRegard: 12,
    /** A member whose average regard for the other group is below this walks
     *  out of a negotiated merge rather than blocking it. */
    mergeDissentThreshold: -10,

    /**
     * The Career pack is a marriage of convenience, and it should look like one.
     * A small chance somebody never joins at all, and a rare chance the whole
     * thing comes apart before the bloodbath is even over.
     */
    careerOptOutChance: 0.18,
    careerMaxOptOuts: 2,
    careerEarlyCollapseChance: 0.06,

    /** Pacts, declared at formation. A scheduled split is a telegraphed betrayal. */
    pactFinalEightChance: 0.35,
    pactToTheEndChance: 0.25,
    /** Field size at which an 'until-the-final-eight' pact comes due. */
    finalEightSize: 8,

    /** Pooled supplies: what a member will contribute, and what a thief takes. */
    cacheContributeSurplus: 2,
    cacheMaxSize: 8,
} as const;

/**
 * Betrayal, in more than one flavour.
 *
 * The targeting logic was genuinely good — opportunistic, weighted by payday,
 * grudge and winnability — but the only thing it could ever produce was "attack
 * them now". Each of these reads differently in the chronicle and differently
 * again in the epilogue.
 */
export const BETRAYAL = {
    /** Relative weights for what form the betrayal takes. */
    weights: {
        knife: 1,
        steal: 0.8,
        lure: 0.6,
        abandon: 0.5,
        withhold: 0.5,
    },
    /** A thief needs something worth taking. */
    minCacheValueToSteal: 15,
    /** Leading someone into ground you know is lethal needs you to know it. */
    lureMinRememberedThreat: 0.8,
    /** Withholding only means anything if they are actually dying. */
    withholdMaxHealth: 45,
} as const;

/**
 * Rivalries with an arc.
 *
 * Two tributes who fight three times over a run had no escalation — the third
 * fight was mechanically identical to the first. A rematch should feel like a
 * rematch: the loser has studied them, and neither of them wants to be the one
 * who runs again.
 */
export const RIVALRY = {
    /** Combat power the previous loser brings to a rematch, per prior fight. */
    revengeStudyBonus: 1.1,
    maxStudyBonus: 3.5,
    /** Retreat chance shed by both sides once a feud is established. */
    rematchResolve: 0.08,
    /** Fights after which the pair reads as a genuine feud in the chronicle. */
    feudAtFights: 2,
} as const;

/** Sponsor economy. */
/**
 * SIDE-03: what the Capitol charges a paying sponsor. See `playerSponsor.ts`.
 *
 * Priced to be a real decision rather than a shop: a parachute costs a
 * meaningful slice of a wager's winnings, and every subsequent one to the same
 * tribute costs half again as much.
 */
export const SPONSOR_MARKET = {
    /** Coins per point of an item's arena value. */
    valueMultiplier: 4,
    /** The Capitol charges more the longer the Games run. */
    perDay: 0.18,
    /** Multiplier per parachute this tribute has already received, from any source. */
    repeatMultiplier: 1.6,
    /** How sharply crowd favour moves the price. Higher = flatter. */
    trustDivisor: 90,
    minCost: 25,
    /** Knowing somebody out there is paying attention is worth something. */
    trustGain: 6,
    sanityGain: 8,
} as const;

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
    /** Points on the betting line per point of a trait's `odds` modifier. */
    traitWeight: 8,
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
    /**
     * Exponent applied to scores before normalising into win probabilities.
     * The raw scores only span about a 2x spread while realised win rates
     * span >20x — at 1 the board barely discriminated (everything priced
     * 3-6%) and, worse, was monotonically mispriced: high-rated tributes
     * were systematically underpriced, so betting the favourite every run
     * multiplied a bankroll 22x over 300 runs. Raising the exponent spreads
     * the shares toward the measured distribution: at 5, a 400-run probe put
     * every shown-percentage decile's EV at or below break-even and the
     * bet-the-favourite strategy lost money.
     */
    discrimination: 5,
    /**
     * The house's cut, applied to the payout multiplier — not to the shown
     * percentage. The payout used to be derived straight from the display
     * number (mult = 100/pct), which set EV by accident. With the margin the
     * expected value of a fairly-priced wager is deliberately slightly
     * negative, as any real book prices it.
     */
    houseMargin: 0.85,
} as const;

/** The Gamemakers' direct interventions. */
/** REPLAY-01: the scheduled wildcard. See `engine/wildcards.ts`. */
export const WILDCARD = {
    /** Floor on what an unaddressed supply drop is worth picking up. */
    dropMinValue: 15,
    /** Excitement the crowd has banked while sponsorship was frozen. */
    freezeLiftExcitement: 25,
    /** Sanity cost of watching the arena's own machinery fail. */
    malfunctionSanity: 12,
    /** What a bounty is worth to the tribute it lands on. */
    bountyExcitement: 60,
    bountyTrust: 25,
    /** How thoroughly a scheduled drought strips the arena's water. */
    droughtDepletion: 0.85,
    /** Cycles an "extended darkness" actually extends for. */
    blackoutCycles: 3,
    /** How far a crowd revolt swings sponsor trust, in both directions. */
    revoltTrustSwing: 30,
} as const;

export const GAMEMAKER = {
    /**
     * Multiplier applied to a manually triggered weather profile. A Gamemaker
     * storm is the same kind of thing as the arena's standing weather — it is
     * just turned up, which is what makes it an intervention.
     */
    weatherIntensity: 1.6,
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
    /** T-7: odds a tribute carries a second quirk. */
    secondQuirkChance: 0.35,
    /** Baseline sponsor trust before reputation modifiers. */
    baseSponsorTrust: 50,
    trustSpread: 12,
} as const;

/**
 * §7.1: tesserae — the mechanic that makes the reaping political rather than
 * random. A child's name goes in once per eligible year by law; a poor child
 * takes tesserae — extra entries in exchange for grain — every year a family
 * needs feeding, so the bowl is rigged against the districts that are already
 * starving. Two effects: the reaping draw skews older (entries compound with
 * age), and it skews older *faster* in poor districts (tesserae compound too).
 * A tribute who carries tessera slips has been hungry for years, which in this
 * engine's inversion is worth something: they know how to ration.
 */
export const TESSERAE = {
    /**
     * Average tesserae a typical child of this legacy tier takes per eligible
     * year. Storied districts feed their children; forgotten ones cannot.
     */
    ratePerTier: { storied: 0.05, strong: 0.15, modest: 0.45, thin: 0.75, forgotten: 1.1 } as Record<string, number>,
    /** Hunger-drain multiplier improvement per tessera carried. */
    resiliencePerTessera: 0.025,
    /** Floor on what rationing experience can buy. */
    resilienceFloorFactor: 0.8,
    /** Tesserae at or above this earn the reaping-day note. */
    notedAt: 3,
} as const;

/** Training visibility: what the rest of the cast makes of a big score. */
/**
 * SIDE-05: the interview, as three beats. See `phases/interviews.ts`.
 *
 * The whole segment used to be one charisma roll against 5, which made the
 * persona — the most consequential value the pre-Games produces — a coin flip.
 */
export const INTERVIEWS = {
    /** Poise needed to land the opening angle at all. */
    openingThreshold: 5,
    /** Holding the angle under Caesar's follow-up. */
    holdBase: 0.25,
    holdPerCharisma: 0.06,
    holdOpenedBonus: 0.12,
    openedExcitement: 20,
    fumbledTrust: 10,
    heldTrust: 8,
    heldExcitement: 12,
    brokeTrust: 6,

    /**
     * Poise is charisma plus nerve on the night. The jitter is deliberately
     * wider upward than downward: a nervous tribute rarely does *worse* than
     * their charisma suggests, but the stage occasionally makes somebody.
     */
    poiseJitterMin: -2,
    poiseJitterMax: 3,
    /** Being a known face before you sit down is worth a point of poise. */
    poiseFanFavourite: 1,
    /** How hard the excitement-flavoured traits (Showman, Grim) push poise. */
    poiseExcitementWeight: 2,

    /** The hold roll is clamped: nobody is certain, nobody is hopeless. */
    holdChanceFloor: 0.1,
    holdChanceCeiling: 0.95,

    /** A landed angle raises charisma, but not past the human ceiling. */
    charismaCeiling: 10,
    /** Reputation moves with the sponsor multiplier the angle earned. */
    reputationPerTrustMultiplier: 30,
    reputationCeiling: 95,
    reputationFloor: 5,
    /** Fumbling the opening costs standing as well as money. */
    fumbledReputation: 5,

    /**
     * What the other twenty-three made of it. A tribute who spends three
     * minutes promising a short Games has made twenty-three first impressions
     * and only the Careers liked any of them — which is most of why the
     * bloodbath alliances form the way they do.
     */
    hostileDistrust: 10,
    /** Careers file a threat under 'rival', not under 'enemy'. */
    hostileCareerRespect: 4,
    warmRapport: 6,
} as const;

/**
 * Which angle a tribute takes on Caesar's couch.
 *
 * The persona is not a costume: `interviewChemistry` and `personaThreat` both
 * read it back, so it needs to come out of who the tribute actually is. These
 * are the weights in a weighted pick — a tribute can still land somewhere
 * surprising, they are just unlikely to.
 *
 * Read the numbers as multiples of the flat base weight of 1 that every angle
 * starts from: a `+1.5` roughly triples an angle's odds, a `-1` all but rules
 * it out. The attribute coefficients are per point on a 1-10 scale, so a
 * `0.15` is worth up to 1.5 at charisma 10 — the same size as one strong
 * trait, which is the intended trade.
 */
export const INTERVIEW_ANGLES = {
    /** Floor so no angle is ever strictly impossible for anyone. */
    minWeight: 0.15,

    starCrossed: {
        perCharisma: 0.15,
        softhearted: 1.5,
        ruthless: -0.8,
    },
    ruthlessWarrior: {
        /** Measured against a middling training score. */
        trainingPivot: 5,
        perTrainingPointOverPivot: 0.3,
        perStrength: 0.12,
        career: 1.5,
        bloodthirsty: 1.2,
        pacifist: -1.5,
    },
    humbleUnderdog: {
        /** Inverted: the further *below* the pivot they scored, the better it plays. */
        trainingPivot: 7,
        perTrainingPointUnderPivot: 0.25,
        /** The youngest tributes do not have to act this one. */
        youngAge: 14,
        young: 1,
        career: -1,
    },
    mysteriousEnigma: {
        perStealth: 0.18,
        /** Somebody who already hid in training has the story ready-made. */
        concealed: 1.5,
        paranoid: 0.6,
    },
    charmingFlirt: {
        perCharisma: 0.3,
        charismatic: 1.2,
        unremarkable: -1,
    },
    arrogantBrute: {
        perStrength: 0.2,
        brute: 1.4,
        /** Charm undercuts it — a likeable tribute cannot sell menace. */
        charismaCutoff: 7,
        charismatic: -0.8,
    },
    quirkyOddball: {
        perIntelligence: 0.12,
        showman: 1.5,
    },
    silentThreat: {
        perStealth: 0.15,
        perStrength: 0.08,
        concealed: 1,
        /** Being bad at talking is the qualification here, not a handicap. */
        quietCharisma: 4,
        quiet: 0.8,
    },
    grievingSibling: {
        mourner: 1.3,
        youngAge: 15,
        young: 0.6,
        ruthless: -1,
    },
    coldStrategist: {
        perIntelligence: 0.2,
        strategistArchetype: 1.5,
        strategistTrait: 1,
    },
    reluctantHero: {
        pacifist: 1.5,
        /** Reaped, not volunteered: the story tells itself. */
        conscript: 0.6,
        career: -0.8,
    },
    districtLoyalist: {
        /** A non-Career volunteer did it for somebody, and everyone knows it. */
        volunteer: 1.8,
        /** A tribute with nothing else to trade on falls back on home. */
        lowReputation: 40,
        lowReputationBonus: 0.8,
        career: 0.4,
    },
    wildcard: {
        archetype: 1.5,
        /** Rewards charisma at either extreme; the middle is not a wildcard. */
        perCharismaDeviation: 0.1,
        charismaMidpoint: 5,
    },
} as const;

/**
 * SIDE-06: the pre-Games ceremonies. See `phases/pregames.ts`.
 *
 * Everything here feeds `sponsorTrust`, `reputation` and `excitementRating`,
 * which are read by the sponsor stream, the odds board and — since CANON-07 —
 * by the Gamemakers deciding when to start closing the arena. The pageantry is
 * not decoration; it is where the audience is won.
 */
export const PREGAMES = {
    /** Age at which a reaping is a national incident rather than a formality. */
    childAge: 13,
    childReactionExcitement: 12,
    volunteerExcitement: 10,
    /** Three minutes with your family, or three minutes without them. */
    goodbyeSanity: 5,
    aloneGoodbyeSanity: 8,
    aloneGoodbyeTrust: 5,
    /**
     * Two days on a train with the only other person from home.
     *
     * Kept small on purpose: romance is gated on the district pair, so this is
     * a direct dial on how many runs produce star-crossed lovers. At 8 it put
     * the rate at 17%, well past the 10-15% the design wants.
     */
    trainPartnerBond: 2,
    /** The parade. `pull` is the stylist's angle; the rest is the tribute. */
    paradeCharismaWeight: 0.35,
    paradeLegacyBonus: 0.5,
    paradeTrustPerPull: 4,
    paradeReputationPerPull: 3,
    paradeExcitementPerPull: 7,
} as const;

export const TRAINING = {
    /**
     * SIDE-04. Training used to be one line: +1 to a random attribute and a
     * score from total stats. No station choice, no private session, no
     * strategy, and the number appeared the instant it was rolled.
     */
    /** Days on the training floor before the private sessions. */
    days: 3,
    /** Attribute points a day at a station is worth, before aptitude. */
    stationAttributeGain: 0.5,
    /** Proficiency a day at a station is worth. */
    stationProficiencyGain: 0.4,
    /** Chance a tribute deliberately hides what they can do. */
    concealChance: 0.22,
    /** Chance they play to the gallery instead. */
    showcaseChance: 0.3,
    /** Score swing for each strategy in the private session. */
    concealPenalty: 2,
    showcaseBonus: 1,
    /** Sponsor trust a showcase buys, and the price of hiding. */
    showcaseTrust: 6,
    concealTrust: -4,
    /**
     * The private session is not a fair examination — the Gamemakers have been
     * watching tributes all day and are bored by the end of it. A tribute who
     * does something genuinely unexpected while the gallery is distracted can
     * land far above their merit, which is the single most famous training
     * score in the source material.
     */
    stuntChance: 0.08,
    stuntBonus: 3,
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

    /** Excitement the broadcast itself buys, per point of the score read out. */
    broadcastExcitementPerPoint: 5,
    /** Sponsors chase the top of the board before anyone has swung anything. */
    eliteTrustScore: 10,
    eliteTrust: 15,
    strongTrustScore: 9,
    strongTrust: 8,
    /**
     * How fast intimidation scales past the notice threshold. A 9 lands at
     * quarter weight and a 12 at full: the divisor is the width of the elite
     * band, so the top of the board hits exactly as hard as the raw numbers
     * below say it does.
     */
    intimidationSeverityBand: 4,
    /** Verdict copy tiers on the broadcast. */
    legendaryVerdictScore: 11,
    eliteVerdictScore: 9,
    solidVerdictScore: 6,
    /** A concealer this far down the board has hidden successfully. */
    hiddenScore: 4,
} as const;

/**
 * The private session, from the inside.
 *
 * Training scores 1-8 are earned on merit; every point above 8 is a separate
 * gate, each exponentially harder than the last. That shape is the whole
 * design: it is why an 11 is a talking point rather than a common outcome,
 * and why merit shifts the *odds* of the elite band rather than the band
 * itself. See the training-score distribution band in `scripts/soak.ts`.
 */
export const TRAINING_SCORE = {
    /** Base odds of clearing the first gate (an 8 becoming a 9). */
    eliteGateBase: 0.3,
    /**
     * 0.3 measured out to one 11 every ~18 Games and a 12 every ~140 —
     * canon's 11 is remarkable but happens; 0.42 keeps the exponential shape
     * one notch gentler than a straight halving.
     */
    eliteGateDecay: 0.42,
    eliteGateCap: 0.55,
    /** Points above 8 that are reachable at all: 9 through 12. */
    eliteGates: 4,
    /** A tribute who just startled the panel is far likelier to clear a gate. */
    stuntGateMultiplier: 1.8,

    /** Base band, from what they can do in front of a panel. */
    statsPerPoint: 5,
    skillPerPoint: 3,
    /** Panel mood: the same performance is not scored the same twice. */
    jitterMin: -1,
    jitterMax: 1,
    careerBonus: 1,
    /** The merit band tops out at 8; everything above it is a gate. */
    baseFloor: 1,
    baseCeiling: 8,

    /**
     * Merit multiplier: what the Gamemakers already believe walking in.
     * Multiplies the elite-gate odds only, so it can never hand out a score
     * on its own.
     */
    meritCareer: 0.45,
    meritCareerArchetype: 0.2,
    meritBrute: 0.15,
    meritStrategist: 0.15,
    meritEagleEyed: 0.1,
    meritNimble: 0.1,
    meritClumsy: -0.25,
    meritPacifist: -0.2,
    /**
     * A twelve-year-old does not out-score the Careers on the gauntlet,
     * however fast they are — age is a real ceiling on the elite band.
     */
    meritAgePivot: 15,
    meritPerYear: 0.08,
    /** Nobody's odds fall to nothing; the panel can always be surprised. */
    meritFloor: 0.15,
} as const;

/**
 * Three days on the floor: what a tribute works on, and who they let watch.
 *
 * The gap between "train what you are already good at" and "train what will
 * actually keep you alive" is most of what separates a Career from everybody
 * else, so these two weight sets are where that difference is dialled.
 */
export const TRAINING_FLOOR = {
    /** Station pick, as weights over the five attributes. */
    perAttributePoint: 0.25,
    /** District trade: a District 7 tribute goes to the heavy blades. */
    craftAffinity: 1.2,
    forageCraftAffinity: 1,
    /** Careers do not spend three days learning which berries are safe. */
    careerCombat: 1.5,
    careerSurvival: -0.5,
    /** Everyone else knows the arena kills more people than the Careers do. */
    outsiderSurvival: 0.8,
    /** Repeating a station has diminishing appeal: halved each time. */
    repeatDecay: 0.5,
    minWeight: 0.1,

    /**
     * Aptitude compounds: a day on something you are already good at gets you
     * further than a day on something you are not. At attribute 1 a day is
     * worth 65% of the base gain, at 10 it is 110%.
     */
    aptitudeBase: 0.6,
    /** Divisor, not a coefficient: attribute points spread over this range. */
    aptitudeDivisor: 20,
    /** Attribute ceiling for anything that is not gated on age. */
    attributeCeiling: 10,
    attributeFloor: 1,
    /**
     * `trainProficiency` moves a fixed step, so a day's proficiency gain is
     * spent as a whole number of reps against that step.
     */
    proficiencyStep: 0.35,

    /** Strategy pick: how visible to be, before any of it is scored. */
    careerShowcase: 0.4,
    careerConceal: -0.18,
    schemerConceal: 0.25,
    underdogConceal: 0.15,
    /** Bright tributes work out on their own that a low number is cover. */
    cleverIntelligence: 8,
    cleverConceal: 0.1,
    showmanShowcase: 0.3,
    unremarkableConceal: 0.2,
    fanFavouriteShowcase: 0.15,
} as const;

/**
 * Resolve: the will to keep going, as distinct from sanity.
 *
 * Sanity is perception coming apart. Resolve is intent — whether a tribute
 * still wants to win. Nothing modelled that, so nobody could ever *choose* to
 * stop, and the source material's most famous ending was unreachable.
 *
 * Deliberately slow: the drift numbers are per cycle and small, because a stat
 * that swings inside one cycle is a mood rather than an arc.
 */
export const RESOLVE = {
    start: 70,
    max: 100,
    /**
     * T-6: a breakdown needed more than one shape. Odds of the two new
     * expressions — walking into the border once the arena is closing, and
     * putting the weapons down in front of a hostile.
     */
    borderWalkChance: 0.12,
    surrenderChance: 0.3,
    /**
     * Baseline erosion. The arena wears people down by default; the bonuses
     * below are what holds a tribute up. Positive drift made resolve sit
     * pinned at its starting value for ~90% of the field, which is a stat that
     * exists rather than a stat that does anything.
     */
    driftPerCycle: -1.5,

    /** Reasons to keep standing. */
    allyBonus: 2,
    vengeanceBonus: 1.5,
    momentumBonus: 2,
    watchedBonus: 1,
    watchedExcitement: 45,

    /** Reasons to stop. */
    griefPenalty: 4,
    griefWindow: 3,
    isolationPenalty: 2,
    /**
     * What counts as having nobody. The gate used to require `getRel <= 0`
     * against every single living tribute simultaneously — with relationship
     * decay pulling toward zero and backstory seeding leaving small positive
     * residues, that almost never opened even for a tribute who genuinely has
     * no one. Isolation is not "everyone dislikes you", it is "nobody is
     * warm to you", so the bar is a real relationship rather than a positive
     * residue, and it is measured against people they have actually met.
     */
    isolationWarmthThreshold: 15,
    woundedPenalty: 2.5,
    woundedHealth: 40,
    deprivationPenalty: 2,
    deprivationThreshold: 70,
    endgamePenalty: 1.5,
    endgameFieldSize: 5,

    /** Below this a tribute has stopped playing to win. */
    brokenThreshold: 20,
    /** Per-cycle odds a broken tribute actually acts on it. */
    breakdownChance: 0.35,
    /** Walking into the open is cathartic: it buys back a little will. */
    breakdownRebound: 12,
    /** Sitting down and stopping is not, and compounds instead. */
    sittingDownPenalty: 4,
    /** Taking the nightlock needs to be genuinely final, and is still rare —
     *  but 14/0.3 meant 1-4 firings per 240 runs, an ending players would
     *  never see (§6.1). */
    nightlockThreshold: 18,
    nightlockChance: 0.5,
    /** A tribute with nothing left can go looking for it where things grow. */
    nightlockForageResources: 0.35,
    nightlockFindChance: 0.6,
} as const;

/**
 * Parley: talking instead of fighting.
 *
 * Two strangers meeting in a clearing had exactly two possibilities — a fight
 * or a pleasantry. The far more common real outcome is a negotiation: backing
 * out of it, paying to leave, or agreeing not to do this today. See
 * `engine/parley.ts`.
 */
export const PARLEY = {
    /** A power ratio below this means a tribute genuinely likes their odds. */
    confidentRatio: 0.8,
    /**
     * A power ratio above this means they know they are losing. 1.25 left the
     * pay-your-way-out path effectively dead (≤5 firings across 240 runs, and
     * whole soaks with zero) — a matchup lopsided enough to read as clearly
     * outmatched through the perception layer almost never met the other
     * gates too.
     */
    outmatchedRatio: 1.12,

    /** Paying to be allowed to leave. */
    tributeChance: 0.6,
    tributeResentment: 12,
    tributeExcitement: 8,
    tributeSanityCost: 8,

    /**
     * What the outmatched party hands over when they are carrying nothing
     * spare. `tributePayment` returns undefined for most tributes — they
     * simply have no loose item — which was the real reason extortion was
     * measured dead content (2 firings across 240 runs) rather than the
     * ratio gate. Someone with empty hands still has something to trade:
     * where they last saw people, and where the water is.
     */
    /** On `ZoneMemory.threat`'s own 0-6 scale, not a percentage. */
    tollInfoMinThreat: 1.5,
    tollInfoResentment: 8,
    tollInfoSanityCost: 5,

    /** An explicit, expiring non-aggression pact. */
    truceChance: 0.4,
    truceCycles: 4,
    truceMinRegard: -5,
    truceRegard: 8,

    /**
     * Breaking one.
     *
     * `parley.ts` described a truce as "the one that can later be broken" and
     * then no code path ever broke one — it simply expired. A truce nobody
     * can betray is a timer, not a promise. Breaking is opportunism, same as
     * betrayal: treachery, plus how winnable this specific fight looks, plus
     * the arithmetic of a closing field.
     */
    truceBreakBase: 0.18,
    truceBreakTreacheryWeight: 0.8,
    /** A field this small makes every standing agreement provisional. */
    truceBreakEndgameFieldSize: 8,
    truceBreakEndgameBonus: 0.35,
    /**
     * How badly the other party has to be losing to tempt a knife. Retuned
     * down alongside the §7 district rebalance, which deliberately narrowed
     * the spread of combat power across the cast — "clearly winning" is a
     * smaller edge than it used to be, so the threshold that reads as an
     * opening has to move with it.
     */
    truceBreakOpportunismRatio: 1.08,
    truceBreakOpportunismBonus: 0.16,
    /** A tribute who has already been sold out does not break their word lightly. */
    truceBreakBetrayedRestraint: 0.5,
    truceBreakRegard: 45,
    truceBreakSuspicion: 30,
    truceBreakReputationCost: 10,
    truceBreakExcitement: 25,

    /**
     * §4.1: expiry is a decision point, not a garbage-collection pass. 80 of
     * 84 negotiated truces used to evaporate silently; every truce now
     * resolves on-screen as one of renew / lapse / turn-on-them.
     */
    /** Odds the pair rolls the agreement over, given real mutual regard. */
    truceRenewChance: 0.35,
    truceRenewMinRegard: 10,
    /** Base odds the lapse becomes a hunt; treachery is added on top. */
    truceTurnChance: 0.12,
    truceTurnTreacheryWeight: 0.5,
    /** Cycles the striker commits to hunting the person they let walk. */
    truceTurnHuntCycles: 3,

    /** Both armed, neither willing to move first. */
    standoffChance: 0.4,
    standoffPerFear: 0.004,
    standoffFatigue: 6,
} as const;

/**
 * Debts and district bonds.
 *
 * `memory.stoodBy` recorded that somebody took a real risk for you and then
 * nothing ever charged for it — a tribute pulled out of a fire on day two could
 * knife their rescuer on day three at stranger's odds. And
 * `RELATIONSHIPS.districtPartnerBase` seeded a district pair as acquaintances
 * that the arena never escalated, so the strongest story the simulation could
 * tell had no machinery behind it. See `engine/debts.ts`.
 */
export const DEBTS = {
    max: 3,
    /** What each kind of help is worth on the ledger. */
    savedInFight: 2,
    patchedUp: 1.5,
    gaveSupplies: 1,

    /** Turning on a creditor: multiplier on betrayal willingness, per point owed. */
    betrayalResistPerPoint: 0.3,
    minBetrayalMultiplier: 0.25,

    /** Settling up. */
    repayThreshold: 1,
    repayChance: 0.25,
    repayRegard: 12,
    repayExcitement: 10,
    repayRestRelief: 15,

    /**
     * §4.2 R-4: debts flowed one way — help was recorded, refusal never was.
     * An ally close enough to haul you clear who chooses not to reach is as
     * socially informative as one who does, and the victim sees it.
     */
    /** Regard below which an ally may simply not reach for you. */
    refusalRegardThreshold: 0,
    refusalChance: 0.25,
    refusalResentment: 12,
    refusalSuspicion: 12,

    /** District partners, simply for both still being here. */
    districtBondPerCycle: 0.6,
    districtLateBond: 2,
    districtLateFieldSize: 8,
    districtMilestoneRegard: 45,
} as const;

/**
 * Alliance charters: the rules a group agrees to keep, and the fallout short of
 * a betrayal when somebody breaks one. See `engine/allianceCharter.ts` — an
 * alliance previously had only three exits (death, betrayal, pact expiry), so
 * every disagreement had to escalate to a knife or not exist.
 */
export const CHARTER = {
    /** Odds a group agrees to two clauses rather than one. */
    twoClauseChance: 0.35,
    /** Odds a given breach is actually noticed this cycle. */
    noticeChance: 0.4,
    /** What every other member's regard drops by when it is. */
    breachRegardCost: 9,
    /** Food items held privately that counts as hoarding. */
    hoardingFood: 2,
    /** Regard below which two members of the same group are visibly at odds. */
    hostileRegard: -15,
} as const;

/**
 * The Head Gamemaker's one intervention per run. Nine named Gamemakers
 * previously differed only by two multipliers, which made the whole roster a
 * tooltip. See `engine/gamemakerAgency.ts`.
 */
export const GAMEMAKER_AGENCY = {
    /** Not while the cast is still enormous — this rescues the middle of a run. */
    /** A-6: the signature is the roster's whole payoff — it fired in only 65%
     * of runs. Wider window and better unprompted odds get it near-every-run. */
    maxFieldSize: 16,
    earliestDay: 3,
    /** Audience interest below which the Head Gamemaker feels obliged to act. */
    boredomThreshold: 45,
    /** Odds they act anyway, on a day the feed is fine. */
    unpromptedChance: 0.2,
    /** Ainsel's grind: everything slightly worse, everywhere. */
    grindDepletion: 0.2,
    grindThirst: 12,
    grindFatigue: 10,
} as const;

/**
 * Weather with a position. Climate was static per arena and the only transient
 * weather hit everywhere at once for exactly one phase, so weather could never
 * be something you saw coming and got out of the way of. See
 * `engine/weatherFront.ts`.
 */
export const WEATHER_FRONT = {
    /** Not in the opening days — the bloodbath is busy enough. */
    earliestDay: 2,
    /** Per-cycle odds a new front builds when there isn't one. */
    spawnChance: 0.18,
    minCycles: 3,
    maxCycles: 6,
    /** How many zones back a front remembers, so it does not pace on the spot. */
    memoryZones: 2,
} as const;

/**
 * Holding the Cornucopia. It was special exactly twice — the bloodbath and a
 * feast — and empty the rest of every run. See `engine/zoneControl.ts`.
 */
export const ZONE_CONTROL = {
    /** Bodies on the ground needed to count as holding it. */
    minHolders: 2,
    /** Cycles held before the first payout, and every payout after. */
    payoutEveryCycles: 2,
    minItemValue: 20,
    excitement: 6,
    supplyRelief: 15,
} as const;

/**
 * U-7: Gamemaker-mode arena interventions, priced in the sponsorship
 * economy's Capitol Coins. Lived as a bare const in GameScreen.tsx — an
 * economy-balance table in a view file, invisible to test:knobs.
 */
export const GAMEMAKER_COSTS = {
    burn: 150,
    flood: 150,
    fog: 120,
    sever: 100,
    drop: 200,
    bounty: 300,
} as const;
