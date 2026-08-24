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
    /**
     * §3.1: how much one point of endurance either side of average is worth
     * per cycle, and how much of that carries into the night's recovery. Small
     * on purpose — over a fourteen-day run it is the difference between a
     * tribute who is still walking and one who is not, without ever being the
     * headline number on the sheet.
     */
    endurancePerPoint: 0.6,
    enduranceRecoveryShare: 0.5,
    /**
     * §3.5: the interaction matrix. Each coupling is a fraction of how far
     * past its threshold the driving vital is, applied per cycle.
     */
    interactionThirstFrom: 55,
    thirstFatigueCoupling: 0.06,
    interactionFatigueFrom: 65,
    fatigueSanityCoupling: 0.05,
    interactionHungerFrom: 70,
    starvedClotPenalty: 0.35,
    /** §3.1: willpower's cut of the fatigue-to-sanity coupling, per point. */
    willpowerSanityGuard: 0.08,
    willpowerGuardFloor: 0.4,
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
    /**
     * §7: fatigue existed as a vital with no terminal state of its own. A
     * tribute could sit pinned at 100 fatigue indefinitely and only ever die
     * of something else — so the death breakdown had no exhaustion in it at
     * all, despite the arena having a full stamina system and an endurance
     * attribute feeding it. Above this, with nowhere to rest, the body simply
     * stops. Set above the coupling thresholds so it is genuinely the end of
     * the scale and not a second dehydration.
     */
    exhaustedThreshold: 96,
    exhaustedDamage: 6,
    /** Relief drops fatigue to just under the threshold, as with the other vitals. */
    starvingDamage: 5,
    /** §7.7: 10 -> 8 — dehydration is meant to pressure tributes toward water, not out-kill the mutts. */
    dehydratedDamage: 8,

    /** A tribute eats/drinks from their pack once past these. */
    eatThreshold: 50,
    /** §7.7: 50 -> 42 — drink before the drain arithmetic gets ahead of you. */
    drinkThreshold: 42,
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
    /** A2: the Medic archetype's hands, on somebody else's wound. */
    medicArchetypeMultiplier: 2,
    /** Severity a fresh wound opens at, by source. */
    combatSeverity: 2,
    /** T-5: extra status-damage multiplier per injury grade above 1 (all sites). */
    gradeDamageStep: 0.3,
    muttSeverity: 3,
    hazardSeverity: 2,
    /** Per-cycle health cost, indexed by severity (0 is not bleeding). */
    damageBySeverity: [0, 3, 7, 12],
    /** Base odds a wound drops one severity step at the end of a cycle. */
    baseClotChance: 0.28,
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
    dressBaseChance: 0.35,
    dressPerIntelligence: 0.035,
    dressPerMedicine: 0.2,
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
    /** §7.7: 6 -> 5, paired with the warm-thaw path in survival.ts. */
    frostbitten: 5,
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
    canopywebDodgeBase: 0.3,
    canopywebSeverChance: 0.5,
    acousticforestDodgeBase: 0.28,
    acousticforestSanityLoss: 8,
    burnscarBurnChance: 0.3,
    burnscarSeverChance: 0.5,
    craterfieldDodgeBase: 0.35,
    // The ninth-wave arenas.
    culdesacNamedSanity: 8,
    culdesacRestlessChance: 0.25,
    culdesacRestlessFatigue: 6,
    labyrinthQuietBias: 0.7,
    labyrinthDodgeBase: 0.55,
    labyrinthFalseChance: 0.35,
    ashgroveDodgeBase: 0.4,
    ashgroveEscapeFatigue: 8,
    ashgroveSessionSanity: 10,
    kelvinFailureCycle: 14,
    kelvinColdFatigue: 10,
    kelvinFrostbiteChance: 0.2,
    silkwoodSilkFatigue: 4,
    nooneplaceSlipSanity: 8,
    redcathedralDodgeBase: 0.3,
    redcathedralClearFatigue: 12,
    redcathedralCaughtFatigue: 20,
    storywoodGingerbreadSanity: 15,
    storywoodAxeSanity: 18,
    storywoodWellSanity: 30,
} as const;

/**
 * The declarative signature grammar (procedural arenas only — see
 * `SignatureRule` in models/types.ts and `runDeclarativeSignature` in
 * engine/arenaSignature.ts). Hand-authored arenas' bespoke functions above
 * keep their own inline numbers; this is the shared dial set for every
 * composed rule a generated arena gets instead.
 */
export const PROC_SIGNATURE = {
    /** A2: how long a Scholar's early read of the arena holds as an intention. */
    scholarForesightCycles: 3,
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
 * Numeric dials for the Quell-specific mechanics in src/data/gamesProfile.ts
 * (QUELLS) that need more than a temperament/config multiplier — see each
 * consumer for exactly where it's read.
 */
export const QUELL_MECHANICS = {
    /** 'No Alliances': hard cap on alliance size, and the per-cycle tax on anyone still in a group over it. */
    allianceCapSize: 2,
    allianceCapHazardDamage: 8,
    /** 'The Mandatory Alliance': vitals cost per cycle spent apart from your district partner. */
    mandatoryPartnerSanityDrain: 5,
    mandatoryPartnerFatigueDrain: 4,
    /** 'Two Victors': odds the Capitol's promise holds at the final moment (a literal coin flip). */
    twoVictorsHoldChance: 0.5,
    /** 'The Bounty Quell': how often the target rotates, and the standing sponsor boost for whoever collects it. */
    bountyRetargetEveryCycles: 6,
    bountySponsorTrustBonus: 30,
    /** 'The Blood Debt': sponsor-generosity multiplier applied to any tribute who has killed. */
    bloodDebtGenerosityMult: 0.4,
    /** 'The Reflection': how a tribute's own attributes translate into their mirror mutt's kit. */
    reflectionDamageScale: 1.1,
    reflectionSpeedScale: 1.0,
    reflectionFearAura: 12,
    /** 'The Moving Arena': how often two zones trade terrain/danger/resources. */
    movingArenaEveryCycles: 5,
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
    /**
     * §1.2: `rattled` was documented as the symmetric counterpart to momentum
     * and was written from almost nothing — losing an exchange, being
     * ambushed, surviving a mutt and walking away from a near-death all left a
     * tribute completely unshaken. These are the missing writes.
     */
    rattledPerLostExchange: 1,
    rattledPerAmbushed: 3,
    rattledPerMutt: 2,
    rattledPerNearDeath: 3,
    /** A1: a shadow whose quarry turns around at the wrong moment. */
    rattledPerSpotted: 2,
    /** Health below which surviving the cycle counts as a near-death. */
    nearDeathHealth: 15,
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
    /**
     * §3.7: learning under pressure. Board-sample best proficiency averaged
     * 1.79 against a cap of 6 — the top of the curve was unreachable. Gains
     * accelerate as the run wears on (necessity is the arena's tutor), so a
     * survivalist visibly arrives somewhere by the endgame.
     */
    lateRunGainPerDay: 0.09,
    lateRunGainCap: 0.9,
    /**
     * §3.9: the bottom of the curve. Proficiency averaged 1.85 against a cap
     * of 6 across 400 runs — flat enough that most tributes never felt a
     * skill. The first two levels now come roughly twice as fast, which is
     * both how skill acquisition actually works and what makes the bands
     * below reachable inside an eight-day run.
     */
    earlyBand: 2,
    earlyGainMultiplier: 1.9,
    /** §3.9: the visible bands, in prose and on the tribute sheet. */
    competentBand: 2,
    skilledBand: 3.5,
    expertBand: 5,
    /**
     * §3.10: learning by watching somebody who knows how. Gated on
     * intelligence, worth a fraction of doing it yourself, and only from
     * somebody genuinely ahead of you.
     */
    observeMinTeacher: 2,
    observeMinGap: 1,
    observeBaseChance: 0.18,
    observePerIntelligence: 0.05,
    observeShare: 0.5,
    /** Forage chance added per point of forage proficiency. */
    forageWeight: 0.05,
    /** Combat power added per point of the relevant weapon proficiency. */
    combatWeight: 0.7,
    /** Power bonus for a weapon this tribute's district actually raises children on. */
    affinityItemBonus: 2.2,
    /** Smaller bonus for a weapon merely of a familiar class. */
    affinityClassBonus: 1.1,
    /**
     * §1.4: the charisma station trained nothing at all.
     *
     * `STATION_SKILL` mapped four of the five attributes onto a proficiency and
     * silently omitted charisma, so a tribute who spent all three training days
     * at the sponsor pitch booth and the mock-interview couch came out with raw
     * charisma and no skill, no sponsor effect, and no social consequence. The
     * weights below are every place `persuasion` is now read.
     */
    /** Truce chance added per point of persuasion (best of the two parties). */
    persuasionTruceWeight: 0.05,
    /** Toll-extraction chance added per point, for whoever is doing the asking. */
    persuasionTollWeight: 0.04,
    /** Sponsor appeal added per point. */
    persuasionSponsorWeight: 2.5,
    /** Alliance recruitment chance added per point. */
    persuasionRecruitWeight: 0.04,
    /** Regard granted per point when a persuasion-led negotiation lands. */
    persuasionRegardWeight: 1.5,
    /**
     * §8: renewal chance added per point of persuasion, and the fraction of a
     * partner's break chance talked down per point.
     *
     * Persuasion used to buy only the *striking* of a truce — every read site
     * above is a one-shot negotiation. So a charisma build paid three training
     * days for a handshake and then had exactly the same odds as anyone else
     * of that handshake surviving contact, which is most of why persuasion did
     * not pay rent: 216 truces struck across 400 runs, 16 held. A talker's
     * edge is keeping people at the table, not getting them to it.
     */
    persuasionRenewWeight: 0.06,
    persuasionRestraintWeight: 0.05,
    /**
     * §3.3: teaching. An alliance with a medic and a member sitting on
     * medicine:5 could not transfer a single point of it.
     */
    teachMinLevel: 3,
    teachMinGap: 1.5,
    teachChance: 0.12,
    teachGain: 0.35,
    teachRespectWeight: 2,
    /**
     * §3.3: skills can be lost. A shattered arm took a combat penalty and left
     * every point of melee proficiency intact, so a healed arm restored a
     * fighter exactly as they were.
     */
    skillLossGrade: 3,
    skillLossPerCycle: 0.25,
    skillLossFloor: 0.5,
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
    /** §4.8: suspicion high enough to be worth testing, but short of walking out. */
    investigateThreshold: 35,
    investigateChance: 0.25,
    /** How much a test that finds nothing buys back. */
    investigateClearAmount: 20,
    /** How much a test that finds something adds. */
    investigateConfirmAmount: 25,
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
    /**
     * §3: and talking to people is a skill that improves with use.
     *
     * Strength, agility, stealth and intelligence all grew over a run;
     * charisma was the one attribute fixed at the reaping forever, so a
     * social build could not compound its way back into relevance the way a
     * physical one could. `persuasion` was already a trained proficiency with
     * a level curve — it simply had no attribute behind it.
     */
    charismaPerPersuasionLevel: 0.12,
    /** Drift ceiling: earned points never exceed this above the printed stat. */
    maxGain: 1,
    /**
     * §3.3: per-attribute ceilings — the body has more room to grow than
     * judgement does in eight days — and a decay path: a tribute who stops
     * fighting loses the edge, so drift is a curve rather than a ratchet.
     */
    maxGainStrength: 1.5,
    maxGainAgility: 1.2,
    maxGainStealth: 1.2,
    maxGainIntelligence: 0.8,
    maxGainCharisma: 1,
    /** Earned combat drift lost per idle cycle (no fight, no aggression). */
    decayPerIdleCycle: 0.03,
} as const;

/**
 * §3.4: composure — momentum and rattled read as one signed value. A tribute
 * keyed up from a kill forages worse but projects better; a rattled one sues
 * for peace and reads as damaged goods to the sponsor blocs.
 */
export const COMPOSURE = {
    /** Forage success per point of composure (steady hands find food). */
    forageWeight: 0.015,
    /** Sponsor gift-tier merit per point of composure. */
    sponsorMeritWeight: 0.02,
    /** Extra truce willingness when either party is rattled. */
    rattledParleyBonus: 0.15,
} as const;

/**
 * §3.5: sanity thresholds with distinct, visible behavioural states. The
 * bands read from `sanityBandOf`; each has its own residue.
 */
export const SANITY_BANDS = {
    frayed: 70,
    unravelling: 40,
    gone: 15,
    /** Forage penalty while unravelling — they stop trusting what they pick. */
    unravellingForagePenalty: 0.1,
    /** Odds per cycle that a tribute who is gone abandons an item where they stood. */
    goneDropChance: 0.15,
    /** Crossing the bottom band leaves a permanent mark (once per run). */
    scarStealthLoss: 1,
    /**
     * §1.3: the mark is permanent in the one way that matters — a tribute who
     * has been all the way down never fully comes back up. Sanity is capped
     * here for the rest of the run, so 'steady' is somewhere they used to live.
     */
    scarredSanityCeiling: 78,
    /** ...and the nights are worse, permanently. */
    scarredNightSanity: 2,
    /**
     * §11.4: low sanity makes noise. A tribute far enough gone (or already
     * carrying stealth damage from breakdowns) can blow their own cover at
     * night — a scream, a dropped pot, a fire fed too high — and everyone
     * one zone over learns exactly where they are.
     */
    noisyNightChance: 0.18,
    /** Sanity below which the night mistakes start. */
    noisyNightSanity: 40,
} as const;

/**
 * §3.9: fatigue causes specific mistakes, not just gated actions — the
 * cheapest available source of emergent narrative.
 */
export const FATIGUE_MISTAKES = {
    /** Fatigue above this rolls for a mistake each cycle. */
    threshold: 82,
    chance: 0.12,
    /** Of the mistakes: odds it is a dropped item (else a stumble). */
    dropShare: 0.5,
    stumbleDamage: 6,
} as const;

/**
 * §3.10: private motives, assigned at the reaping. Not another stat — a bias
 * on why this tribute keeps standing, paid off in the epilogue.
 */
export const MOTIVES = {
    /** Extra positive resolve drift for a tribute holding onto someone at home. */
    familyResolveBonus: 0.75,
    /** Vengeance weighs heavier for a tribute whose motive is their partner. */
    avengeVengeanceMultiplier: 1.6,
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
    /**
     * A1/§1.11: chance a meeting involving somebody in the Desperate stance
     * goes straight to violence, at any field size. Desperation used to be an
     * endgame coin flip that fired 15 times across 400 runs; it is now a state
     * with an entry condition, and this is what being in it means when you
     * walk into somebody.
     */
    stanceHostility: 0.55,
    /** Field size at which the arithmetic starts to press on people. The old
     *  gate of 8 produced ~11 desperation fights across 240 runs — most
     *  encounters at that field size are already combat through the stance and
     *  grudge branches, so the endgame's best beat almost never fired. */
    fieldSize: 10,
    /** Odds an otherwise-peaceful meeting turns into a fight, at the threshold.
     *  §10.3: 0.25 -> 0.28, the other half of the zero-kill-victor nudge. */
    baseHostility: 0.28,
    /** Added per tribute below the threshold. §10.3: 0.13 -> 0.18 — the
     *  endgame squeeze, nudged so fewer victors coast to a bloodless crown. */
    perTributeBelow: 0.18,
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
    /**
     * §3.1: mass is now the sum of two ratings rather than one table lookup.
     * Frame is the skeleton (fixed); condition is the soft tissue (mutable).
     * `massByBuild` remains for saves written before the split, where only the
     * legacy single-axis build survives.
     */
    massByBuild: { Frail: -2, Slight: -1, Average: 0, Athletic: 1, Stocky: 2, Muscular: 2.5 },
    massByFrame: { Narrow: -1.6, Spare: -0.8, Even: 0, Broad: 0.9, Heavy: 1.8 },
    massByCondition: { Wasted: -1.2, Lean: -0.4, Conditioned: 0, Padded: 0.6, Bulky: 1.2 },
    /** Frame index, for the axis reads that want an ordinal rather than a mass. */
    frameOrder: { Narrow: 0, Spare: 1, Even: 2, Broad: 3, Heavy: 4 },
    conditionOrder: { Wasted: 0, Lean: 1, Conditioned: 2, Padded: 3, Bulky: 4 },
    /**
     * §3.1: what each axis buys and costs, per step away from the middle of
     * its scale. Frame raises reach, carry, grapple resistance and the damage
     * floor while costing concealment, chokepoint passage, climb speed and
     * hunger drain. Condition raises insulation, starvation buffer and injury
     * absorption while costing agility, heat tolerance and water need.
     */
    framePerStep: {
        grappleResist: 0.09,
        damageFloor: 0.6,
        concealment: 0.07,
        chokepoint: 0.08,
        climb: 0.05,
        hungerDrain: 0.035,
    },
    conditionPerStep: {
        insulation: 0.06,
        starvationBuffer: 4,
        injuryAbsorb: 0.025,
        agility: 0.28,
        heatTolerance: 0.06,
        waterNeed: 0.03,
    },
    /** Reach, in cm-equivalents, from limb length rather than standing height. */
    limbReachCm: { long: 6, even: 0, compact: -5 },
    /** Chokepoints, burrows and climbs, per limb ratio. */
    limbChokepoint: { long: -0.1, even: 0, compact: 0.08 },
    limbClimb: { long: -0.05, even: 0, compact: 0.1 },
    /**
     * §3.1: condition drift. Pressure accumulates while past the starvation
     * line and unwinds on a full belly; a full step of condition costs (or
     * buys back) `conditionStepPressure` of it.
     */
    starvingHunger: 70,
    fedHunger: 25,
    conditionPressurePerStarvingCycle: 1,
    conditionPressurePerFedCycle: 0.6,
    conditionStepPressure: 6,
    /** How much a frame reads as threatening across a zone, per step. */
    visibleFramePerStep: 0.5,
    /** ...and how little of that a hollowed-out condition takes back. */
    visibleConditionPerStep: 0.2,
    /** A wound on the dominant side costs this much more than the other one. */
    dominantSideMultiplier: 1.5,
    /** Growth spurt: a young tribute on a big frame reads as future, not present. */
    spurtMaxAge: 14,
    /** Carry slots added per point of mass — a Frail twelve-year-old carries less. */
    capacityPerMass: 0.5,
    /** Cold resistance per point of mass. */
    frostbiteResistPerMass: 0.04,
    /** §5.6: max fraction of an exposure tick a full-shelter zone (quality 1) absorbs. */
    zoneShelterExposureReduction: 0.35,
} as const;

/** When a tribute reaches for the medical kit, and what it buys them. */
export const MEDICAL = {
    medkitHealthThreshold: 70,
    medkitHeal: 50,
    ointmentHealthThreshold: 85,
    ointmentHeal: 25,
    /** §8.3: the morphling vial — a painkiller, not a cure. */
    morphlingHealthThreshold: 55,
    morphlingHeal: 15,
    morphlingSanity: 18,
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
    /**
     * §6.1: the plates before the gong. Two tributes whose plates landed
     * within this fraction of the ring of each other spend the sixty seconds
     * looking at each other — they start the Games having genuinely seen one
     * another (a real contact in the sighting memory), and a frightening
     * neighbour is frightening before anyone moves.
     */
    plateNeighbourRange: 0.12,
    /** Training score at or above which a plate neighbour is worth dreading. */
    plateNeighbourFearScore: 9,
    /** Fear per training point over eight, felt across two metres of gravel. */
    plateNeighbourFearPerPoint: 5,
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

/**
 * §10.1: the middle game is where every long-running system in this engine
 * was supposed to pay off, and it was too short to.
 *
 * Traits evolve (`traitArcs`), proficiencies grow toward a cap of 6,
 * `attributeDrift` accumulates, condition degrades and rivalries escalate
 * through `RivalRecord` — and at an average run of seven to nine days almost
 * none of that had room to complete. Nearly half of all runs never saw a
 * feast at all.
 *
 * The fix is deliberately *not* a gentler bloodbath: the share of the field
 * lost at the Cornucopia measures 35.4%, which is inside its design goal and
 * is the most recognisable single event in the source material. What was too
 * fast is everything after it, so the arena takes a day longer to start
 * closing in, is harder to bore, and ramps its hazard curve slightly more
 * gently once it does.
 *
 * Sized by measurement. A bigger version of this same change (day 7, boredom
 * at 18, a 0.22 ramp) pushed the archetype spread, zero-kill victors and
 * surviving lovers past their bounds — a longer middle game is more cycles
 * for everything else in the engine to happen in, and run length turns out to
 * be the denominator under most of the lethality ratios in the metrics table.
 * A day is worth about as much depth and costs none of the guards.
 */
export const ESCALATION = {
    startDay: 6,
    /**
     * Canon's Gamemakers do not escalate on a timetable; they escalate because
     * the audience is bored. Aggregate excitement across the living field is
     * the boredom meter, and the arena starts closing the moment it drops
     * below this — which can be well before `startDay` in a quiet year, and
     * never later, because `startDay` remains a hard backstop.
     */
    boredomThreshold: 20,
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
    finaleAfterFinalistCycles: 4,
    hazardMultiplierPerDay: 0.27,
    hazardCeiling: 0.33,
    /**
     * §10.5: odds the forced finale convenes somewhere other than the
     * Cornucopia — the arena's law zone or its high ground — so the endgame
     * set-piece is not always the same stage. Rolled once per run, seeded.
     */
    altFinaleChance: 0.35,
} as const;

/**
 * §8.9: acquisition thresholds for the earned traits that key off counters
 * rather than single events — how many times a tribute has to do the thing
 * before the arena has visibly changed them.
 */
export const EARNED_TRAIT_RULES = {
    /** Traps pulled apart before they read as Trapwise. */
    trapwiseDisarms: 2,
    /** Hard water crossings begun before they read as Waterborn. */
    waterbornCrossings: 3,
    /** Consecutive cycles with no hostile in their zone for Silent Step. */
    silentStepCycles: 5,
    /** Bodies stripped before the cameras call it what it is. */
    vultureCorpses: 4,

    /**
     * §3.2: traits stop being one-way.
     *
     * A trait list used to only ever grow, which made the earned-trait system —
     * the closest thing the game has to an arc — a set of badges rather than a
     * character changing. Three shapes, all resolved in `engine/traitArcs.ts`:
     *
     *   decay      a trait the run has disproved burns off (Softhearted, after
     *              the third kill; Skittish, once they stop being afraid);
     *   conflict   two traits that cannot both be true resolve into a third
     *              (Pacifist + Bloodied -> Broken);
     *   evolution  a chain a tribute walks down as it keeps happening
     *              (Skittish -> Haunted -> Hollow).
     */
    softheartedShedKills: 3,
    /** Consecutive cycles carrying Haunted before it can become Hollow. */
    hollowCycles: 6,
    /** Sanity at or below which Haunted is eligible to become Hollow. */
    hollowSanity: 35,
    /** Cycles a Skittish tribute must hold high resolve before the fear burns off. */
    skittishShedCycles: 5,
    skittishShedResolve: 70,
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
    /** Attribute points a trained Career volunteer adds over the reaped tribute.
     *  §10.2: the agility half dropped — the academy volunteer stacking +1/+1
     *  on top of the district bonus was most of why D1/D2/D4 owned the win
     *  column; strength alone keeps the volunteer visibly trained. */
    careerStrengthBonus: 1,
    careerAgilityBonus: 0,
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

/**
 * §1.8: the encounter-branch dials, migrated out of `encounters.ts`.
 *
 * The meeting resolver is one long `else if` chain, and the thresholds that
 * decide which branch a meeting takes — how thirsty is "in need", how warm is
 * "friendly", how cold is "hostile" — were bare literals inside the conditions.
 * They are the shape of every social encounter in the game and were the third
 * densest patch of balance debt. Values unchanged.
 */
export const ENCOUNTER_BRANCH = {
    /** Vitals at which an ally's need is visible enough to act on. */
    needThirst: 40,
    needHunger: 40,
    /** How much a shared ration actually restores. */
    sharedWaterRelief: 40,
    sharedFoodRelief: 40,
    /** Vitals above which the giver was genuinely going without — the debt only
     *  lands when the gift cost the giver something. */
    givingCostsThirst: 30,
    givingCostsHunger: 30,
    /** Regard at or above which a meeting is warm enough to share a meal. */
    friendlyRegard: 20,
    /** Regard at or below which a meeting starts from hostility. */
    hostileRegard: -10,
    /** Hunger a shared meal takes off both parties, and the regard it buys. */
    sharedMealRelief: 10,
    sharedMealRegard: 5,
    /** Split between the two flavours of an uneventful meeting. */
    peacefulRatherThanFriendly: 0.5,
    /** Sanity a friendly meeting restores. */
    friendlySanity: 10,

    /** A breakdown: hallucinate, lose an edge, or drop something. */
    breakdownHallucinate: 0.4,
    breakdownRuinStealth: 0.7,
    breakdownSanityCost: 5,
    /** Lifetime cap on stealth a breakdown can strip, and the per-episode bite. */
    breakdownStealthCap: 2,
    breakdownStealthLoss: 2,
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
    /**
     * Depletion at which a forage attempt reports the ground picked clean.
     * §1.6: lowered with the zone-economy retune — the notice is the only
     * on-screen signal that the system exists, and at 0.55 it was firing
     * later than the point where the yield had already stopped being worth
     * the walk.
     */
    strippedZoneNotice: 0.45,
} as const;

/** Multi-round duels: how long they last and when someone breaks off. */
export const COMBAT = {
    /**
     * §8a: the numbers advantage decays with the pack's own trust. A group
     * that has stopped trusting each other still outnumbers you — it simply
     * stops fighting like one animal. Floor keeps a hostile pack dangerous.
     */
    packCohesionFloor: 0.45,
    packCohesionFullRegard: 55,
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
    /** A1/§1.5: awareness swing from posture, migrated out of `stealth.ts`. */
    aggressiveAwareness: 1.5,
    evasiveAwareness: 1,
    /** A trickster has been setting this up since the gong. */
    tricksterAmbushBonus: 0.12,
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
    /** A1: fatigue a plain move costs, used by the Fortified movement penalty. */
    baseMoveFatigue: 4,
    // ---- A1: how the conditional stances route ----
    /** Cycles a cannon stays worth walking toward for a scavenger. */
    scavengeCannonMemory: 3,
    scavengeCannonWeight: 3.5,
    /** Stripped ground is stripped of food, not of kit. */
    scavengeBarrenWeight: 1.5,
    scavengeBodyWeight: 2.5,
    /** A shadow goes where their quarry went and nowhere else. */
    shadowFollowWeight: 8,
    /** §5.3: extra fatigue for completing a two-cycle crossing or climb. */
    crossingFatigue: 8,
    /** Thirst above which finding water outranks everything else.
     *  §7.7: lowered 45 -> 38 — dehydration was outranking mutts as a killer,
     *  and the fix is tributes moving toward water a cycle earlier. */
    thirstUrgency: 38,
    waterSeekWeight: 9,
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
/**
 * §3.2: planning, commitment, exhaustion, dread and deception. The five pieces
 * the individual decision layer was missing.
 */
/**
 * §3.4: sleep owed, as distinct from being tired right now. Fatigue empties
 * every night; this does not. Insomniac was an extreme of a system that did
 * not exist.
 */
export const SLEEP = {
    /** Fatigue below which a night counts as actual rest. */
    restedFatigue: 55,
    repaidPerGoodNight: 1.5,
    accruedPerBadNight: 1,
    /** Traits that wreck the night wreck the ledger faster. */
    debtPerFatigueTrait: 0.05,
    /** Debt at which the arena starts arriving through the edges of vision. */
    deprivedAt: 4,
    sanityPerCycle: 3,
    lineChance: 0.18,
} as const;

export const PLANNING = {
    /** Depth of the objective queue. Two is a person; three is a planner. */
    queueDepth: 2,
    /** Vitals at which a goal needs an errand run in front of it. */
    prerequisiteThirst: 72,
    prerequisiteHunger: 76,
    /** Cycles of being torn the same way before the runner-up wins outright. */
    snapCycles: 3,
    /** Failed searches in one zone before the tribute stops trying it. */
    exhaustionFailures: 3,
    /** Tracking at which "there is nothing here" becomes "then I will set snares". */
    exhaustionTrapSkill: 1.5,
    /** Fear of one person that counts toward the aggregate. */
    dreadPerTargetFloor: 25,
    /** Share of the living field that has to frighten them for dread to max out. */
    dreadSaturation: 0.6,
    dreadCowedAt: 0.6,
    /** §3.2: what it takes to lay a trail that is not where you went. */
    falseTrailIntelligence: 6,
    falseTrailSkill: 1.5,
    falseTrailChance: 0.3,
    falseTrailTraffic: 3,
    /** Intelligence at which somebody reads the ground rather than the story. */
    falseTrailSeeThrough: 8,
} as const;

export const OBJECTIVES = {
    /**
     * §3.3: stalking — following without engaging. Taken instead of a hunt by
     * anyone who has found somebody they are not confident of beating today.
     */
    stalkHealth: 55,
    stalkFear: 35,
    stalkCycles: 3,
    /** §3.3: waiting at a chokepoint. Cheap, patient, and not the same as holding. */
    waitFatigue: 45,
    waitCycles: 2,
    /**
     * §3.4: goal conflict. When the winning objective's priority tier is
     * within this of the runner-up's, the tribute is genuinely torn — worth a
     * hesitation beat, and liable to flip under pressure.
     */
    tensionMargin: 10,
    /** Odds a torn tribute takes the other option instead, per re-evaluation. */
    tensionFlipChance: 0.3,
    /** Extra flip odds when they are already coming apart (low resolve, low sanity). */
    tensionFlipUnderPressure: 0.3,
    /** Resolve/sanity at or below which "under pressure" applies. */
    tensionPressureBelow: 40,
    // ---- A2: how far an archetype's declared objective bias may move a gate ----
    /** Ward-noticing threshold shift, per point of `objectiveBias.protect`. */
    wardBiasHealth: 25,
    wardBiasBond: 25,
    /** Ground-worth-holding threshold shift, per point of `objectiveBias.hold`. */
    holdBiasResources: 0.3,
    /** Willingness-to-walk shift, per point of `objectiveBias.reach`. */
    reachBiasUrgency: 25,
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
    /** §4.3: how much a believed bond to somebody present deters a hunter. */
    avengerDeterrent: 0.05,
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
    packDamageCap: 3.8,
    /**
     * Flat multiplier on every mutt's printed damage. A single dial beats
     * editing 46 roster entries, and keeps each mutt's *relative* danger — the
     * careful part of that data — exactly as authored.
     */
    /** §7.7: raised 1.55 -> 2.3 — mutts out-killed by dehydration is backwards. */
    damageScale: 2.3,
    /**
     * Escalation teeth. Once the Gamemakers have started closing the arena,
     * what they release is not what they released on day two. Scales with days
     * since escalation began, capped so a long run does not produce mutts that
     * delete a healthy tribute outright.
     */
    escalationDamagePerDay: 0.16,
    escalationDamageCap: 0.7,
    /** How many cycles a persistent mutt keeps hunting once it finds someone. */
    persistentDuration: 3,
    /** Chance a persistent mutt's tracked target gets caught again on a given tick. */
    persistentReattackChance: 0.65,
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
    /**
     * §5.8: spread compounds with dryness and adjacency instead of staying a
     * flat coin. A hot/dry standing climate multiplies the base chance, each
     * burning front beyond the first adds flat odds, and a hard cap keeps a
     * conflagration possible without making it a certainty.
     */
    spreadDrynessHotClimate: 1.35,
    spreadPerExtraFront: 0.15,
    spreadChanceMax: 0.9,
    flammableTerrain: ['forest', 'wetland', 'open'] as const,

    /** Flooding: drowning risk for anyone who lingers instead of leaving. */
    floodDamage: 14,
    floodDrownChance: 0.12,
    /**
     * §7: whether the water is survivable is a question about the swimmer.
     *
     * Flooding used to hit everybody identically and record it as
     * "Caught in the flooding of X" — a generic hazard death — so there was no
     * drowning in the cause breakdown at all, despite `water` terrain, a
     * Swimmer trait and swimming being a named skill requirement across
     * several arenas. Someone who can swim gets swept and comes out of it;
     * someone who cannot, in deep water, does not.
     *
     * The check is strength and agility against the flood, with the Swimmer
     * trait's `water` affinity on top and fatigue against it — a tired
     * non-swimmer in a flooded sector is the case this exists for.
     */
    drownBase: 0.55,
    drownPerAttribute: 0.055,
    drownSwimmerBonus: 0.11,
    drownFatiguePenalty: 0.003,
    /** Failing the swim outright, rather than merely being battered by it. */
    drownDamage: 42,

    /** A localised freeze on top of whatever the arena's own climate is doing. */
    frozenFatigue: 6,
    frozenFrostbiteChance: 0.12,

    /**
     * §5.2: abundance, the effect the set was missing. Every other kind is a
     * punishment, which meant the arena could only ever take. A bloom is a
     * short window where a zone genuinely feeds people — and it is exactly as
     * dangerous as good ground always is, because everyone else can see it too.
     */
    bloomingDuration: 3,
    bloomingResourceLift: 0.35,
    bloomingSanityRelief: 3,

    /**
     * §5.2: contamination that never lifts and slowly widens. Modelled with a
     * very long expiry rather than a true infinity so nothing downstream has to
     * special-case an effect list that never shrinks.
     */
    irradiatedDuration: 999,
    irradiatedDamage: 6,
    irradiatedSanityLoss: 3,
    irradiatedCreepChance: 0.06,

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

    /**
     * §7.1: the force field at the arena's border zones. Discovery is common
     * enough to happen most runs; the rebound and the cooking exploit are
     * rare beats, not a tax on standing near the edge.
     */
    forceFieldDiscoverChance: 0.12,
    forceFieldReboundChance: 0.03,
    forceFieldReboundDamage: 9,
    forceFieldExploitIntellect: 8,
    forceFieldExploitChance: 0.05,
    forceFieldExploitHungerRelief: 25,
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
    /**
     * §6.5: camouflage is only as good as the ground it copies. The
     * concealment it grants scales with the zone's cover (deep forest and
     * wetland carry it; open crust and water give it nothing to imitate),
     * pivoting around this cover level at weight `camouflageCoverWeight`.
     */
    camouflageCoverPivot: 0.35,
    camouflageCoverWeight: 1.2,
    /** Extra cycles the work lasts in terrain that grows the materials. */
    camouflageRichTerrainBonusCycles: 1,
    /** Rain scrubs mud and ash off: odds per cycle a weather front over the zone ends it early. */
    camouflageRainWashChance: 0.6,

    /**
     * §6.3: what a fire is actually for. Cooking turns the same forage into a
     * better meal; a pot over the flames purifies foul water at the cost of
     * the time it takes; and by daylight the smoke column is a signal every
     * ridge in range can read.
     */
    cookFeedBonus: 12,
    cookLineChance: 0.3,
    /** Boiling foul water works with no purifier at all — it just takes the hour. */
    fireBoilFatigue: 8,
    /** Odds per day cycle an adjacent watcher reads the smoke column. */
    smokeRevealChance: 0.35,
    /** Odds per cycle a campfire in dry terrain escapes into the zone itself. */
    fireEscapeChance: 0.02,
    /** Multiplier on that escape under a hot, dry standing climate. */
    fireEscapeDryMultiplier: 2,

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

    /**
     * §6.2: detection with choices. A perceptive tribute who spots a trap no
     * longer automatically dismantles it — they decide: disarm it (a
     * trapping/fieldcraft roll that can go badly wrong), step around it, or
     * leave it standing on purpose and remember exactly where it is.
     */
    disarmBaseChance: 0.4,
    disarmPerIntelligence: 0.035,
    disarmPerTracking: 0.09,
    /** A botched disarm is a hand on the tripline. */
    failedDisarmTriggerChance: 0.45,
    /** Odds a spotter attempts the disarm at all rather than walking around it. */
    attemptDisarmChance: 0.55,
    /** Dread filed against the zone by knowingly leaving a live trap in it. */
    knownTrapThreat: 0.4,
    /** Per-cycle odds a standing trap simply rots, slips or is sprung by weather. */
    rotChancePerCycle: 0.09,
} as const;

/** Applying venom to a blade — the Trickster's other unspoken speciality. */
export const POISONING = {
    /** Items that can be rendered down into something to coat a blade with. */
    sources: ['nightlock', 'berries', 'venom-vial', 'venom-gland'] as const,
    baseChance: 0.45,
    perIntelligence: 0.05,
    /** Odds a botched attempt poisons the poisoner. */
    selfPoisonChance: 0.25,
    /** §6.4: odds an idle turn is spent coating right away when both halves are in hand. */
    coatOpportunityChance: 0.65,
    /**
     * §6.4: venom comes off the arena's own animals. Surviving an encounter
     * with a venomous mutt sometimes leaves a tribute holding the gland that
     * nearly killed them — the second source path beyond forage.
     */
    muttGlandChance: 0.3,
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
    /**
     * How much depletion one successful forage adds to a zone.
     *
     * §1.6: the zone economy was correctly modelled and almost never
     * load-bearing. At 0.13 taken against 0.085 grown back, a single forager
     * netted +0.045 a cycle — and `wanderChance` means sustained pressure on
     * one zone is rare — so across 400 runs the median zone sat at 0.12
     * depletion, only 0.6% ever reached the floor, and the "picked clean"
     * notice fired ten times. Foraging out a zone was a system nobody could
     * observe, let alone plan around.
     *
     * These three numbers are the whole knob. Taking more per visit and
     * growing back slower makes two tributes camped in the same forest a
     * decision — `movement.ts` scores a destination on `effectiveResources`,
     * so stripped ground actually pushes people off it — while the regen rate
     * stays high enough that an abandoned zone is worth returning to within a
     * few days, which is the property the soak asserts.
     */
    depletionPerForage: 0.2,
    /** Smaller drain even when a forage comes up empty — the ground is picked over. */
    depletionPerAttempt: 0.05,
    /** Fraction of lost yield that grows back each cycle. */
    regenPerCycle: 0.06,
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
    /** §6.4: raised 0.12 -> 0.16 so blade-poison material actually circulates. */
    nightlockChance: 0.16,
} as const;

/** What tributes remember, and how fast they forget it. */
/** §1.2: thresholds for the victor's interview reading the run's own ledgers. */
export const EPILOGUE = {
    /** Sponsor credit earned purely by being unfindable, worth Caesar asking about. */
    ghostTrustNotable: 12,
} as const;

export const MEMORY = {
    /**
     * §3.4: how badly a dissociating tribute misremembers a place. `Blank` is
     * the share of zones whose remembered threat reads as nothing at all;
     * `invent` is the share that read as terrible with no cause.
     */
    dissociationBlankShare: 0.3,
    dissociationInventShare: 0.2,
    dissociationInventedThreat: 4,
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
    /** §3.6: how much a visible limp or guarded arm marks somebody as prey. */
    visibleFavouringPenalty: 1.4,
    /** §3.6: and how much old scarring reads as somebody who has survived worse. */
    visibleScarBonus: 0.8,
    /**
     * How much of their apparent threat a tribute who played the training floor
     * quiet keeps hidden. The whole payoff of `trainingStrategy: 'conceal'`:
     * strangers read them as ~30% less dangerous than they are, until a kill or
     * a fight gives the game away.
     */
    concealDiscount: 0.7,
    /** Minimum cycles a stance is held before it may change again. */
    minHold: 3,
    /**
     * Score margin a challenger stance must beat the current one by.
     *
     * A1: raised from 0.8 alongside the roster expansion. Eight scored stances
     * sit closer together than three did, so the margin that separated them
     * cleanly no longer does.
     */
    /** §3.2: how far generalised dread pushes a tribute toward getting out. */
    dreadEvasive: 3,
    cowedAggression: 1.5,
    switchMargin: 1.1,
    /**
     * §1.7: how much the switch margin widens per recent stance change. The
     * score-only hysteresis left a worst-case tribute changing stance on half
     * of their cycles; this gives the machinery a memory of its own churn.
     */
    churnMarginPerSwitch: 2.2,
    churnDecayPerCycle: 0.25,
    churnMax: 4,
    /** Extra cycles of hold per unit of accumulated churn. */
    churnHoldPerSwitch: 1,
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
    /**
     * §1.7: a victor who never killed anybody is usually a victor the arena
     * handed the crown to — the last few were never in the same place at the
     * same time. The endgame push was too small to reliably close that gap, so
     * a third of all victors finished with a clean sheet.
     */
    endgameAggression: 4.2,
    /** §3.2: momentum's pull toward Aggressive (was an undeclared 0.35). */
    momentumAggressionWeight: 0.25,
    /** §3.2: the reasons Defensive exists — a ward, claimed ground, a built camp. */
    protectDefensive: 1.2,
    holdDefensive: 1.0,
    campDefensive: 0.6,

    // ---- A1/§1.5: the fifteen knobs that used to be typed straight into
    // `engine/stance.ts`. Migrated wholesale as part of the stance expansion,
    // because doubling the size of the scoring table on top of undeclared
    // literals would have doubled the drift with it.

    /** Threat estimate: what an observer reads off a stranger. */
    visibleBase: 5,
    visibleMassWeight: 1.2,
    visibleWeaponBonus: 4,
    visibleBleedingPenalty: 1.5,
    visibleLegPenalty: 1,
    /** §1.6: exact health is not observable. Read as a band, not a number. */
    visibleHurtHealth: 40,
    visibleHurtPenalty: 2,
    /** ...unless the observer is genuinely good at reading people. */
    visibleFineReadAwareness: 7,
    visibleFineReadDivisor: 25,
    /** A2: what the Beast archetype adds to a stranger's read of them. */
    beastVisibleBonus: 4,
    /** Reputation: the training score is public, and it precedes them. */
    trainingScorePivot: 5,
    trainingScoreWeight: 0.5,
    careerVisibleBonus: 1.5,
    /** How much of the estimate personal fear of them accounts for. */
    fearVisibleWeight: 4,
    /** Regression toward "average tribute" for a stale sighting. */
    staleConfidenceFloor: 0.35,
    staleConfidencePerCycle: 0.15,
    staleAveragePower: 8,
    ownWeaponBonus: 4,
    ownHealthDivisor: 25,
    friendRegardThreshold: 25,

    /** Scoring weights, shared by every stance row in `STANCE_SCORERS`. */
    archetypeWeight: 3,
    weaponAggression: 1.2,
    aggressiveHealthDivisor: 30,
    careerAggression: 0.8,
    vengeanceAggression: 1.5,
    dominantAggression: 1.2,
    huntingHungerAggression: 0.8,
    evasiveHealthDivisor: 25,
    woundedEvasive: 1.0,
    unarmedEvasive: 0.6,
    outmatchedEvasive: 1.6,
    cautiousArchetypeThreshold: 0.2,
    cautiousEvasive: 1.0,
    lowSanityEvasive: 0.8,
    stealthPivot: 5,
    stealthEvasiveWeight: 0.06,
    defensiveBase: 1,
    defensiveTemperament: 0.5,
    allianceDefensive: 0.5,
    /**
     * A1: cycles a conditional stance is locked out for after being vacated.
     * A lapsed precondition must vacate immediately, which is exactly the
     * shape that thrashes when the precondition flickers; the lockout is what
     * makes leaving one stick.
     */
    conditionalCooldown: 4,
    /** A genuine emergency overrides the hold. */
    emergencyHealthFactor: 0.6,
    emergencyRatioFactor: 1.6,
} as const;

/**
 * A1: the five conditional stances — what it takes to enter each one and what
 * being in it is actually worth. Kept separate from `STANCE` so the entry
 * conditions read next to the payoffs they gate.
 */
export const STANCE_MODES = {
    /** How much of the archetype's temperament a conditional stance inherits. */
    conditionalArchetypeWeight: 0.5,
    hunting: {
        /**
         * Tracking proficiency floor: this is a skill, not a mood. Set at 1
         * rather than 2 because best-proficiency across a run averages 1.8 —
         * at 2 the stance was reachable by almost nobody who also held a hunt
         * objective, and measured 0.2% of cycles.
         */
        trackingMin: 1,
        /**
         * Base pull once the precondition holds.
         *
         * §8: 2.4 lost to Aggressive nearly every time it was available —
         * Hunting held 1.6% of cycles, so a tribute with a named quarry and
         * the tracking to follow them mostly just swept the zone like anybody
         * else. Committing to one person should beat looking for anyone.
         */
        base: 4.0,
        /** Extra pull per point of remembered fear of the quarry. */
        vengeanceBonus: 1.2,
        /** Ambush edge while working a named target. */
        ambushBonus: 0.14,
        /** ...paid for by being loud on the way there. */
        concealmentPenalty: 0.12,
        /** Awareness edge: they are looking for exactly one person. */
        awarenessBonus: 1,
        /** Cycles of travel budget per turn — a hunter covers two zones. */
        zonesPerCycle: 2,
        /** Pull per point of tracking proficiency. */
        perTrackingPoint: 0.2,
    },
    fortified: {
        /** Cycles a tribute must have held the same zone before digging in. */
        holdCycles: 2,
        /**
         * §8: 2.2 against Aggressive and Evasive, which start at 0 but
         * accumulate a dozen terms apiece and routinely reach 5-6. Fortified
         * was reachable in 0.48% of alive-cycles and *chosen* in 0.03% — one
         * cycle in a thousand — so the README's headline conditional-stance
         * system had a member nobody has ever seen. Digging in on prepared,
         * defensible ground you have already held for two cycles should beat
         * wandering off it; this is what that costs.
         */
        base: 4.2,
        /** Extra pull per trap already set in the zone. */
        perTrapBonus: 0.5,
        /** ...and for ground worth holding. */
        chokepointBonus: 1.2,
        elevationBonus: 1.0,
        /** Trap trigger multiplier against anyone entering their ground. */
        trapTriggerMultiplier: 1.5,
        /** Movement costs double fatigue: leaving a position is expensive. */
        moveFatigueMultiplier: 2,
        /** Damage soak from prepared ground, as a fraction. */
        armourEffect: 0.12,
        /** Pull from having somewhere and someone to hold it for. */
        alliedBonus: 0.5,
    },
    desperate: {
        healthThreshold: 25,
        /** Both hunger and thirst above this is a body out of options. */
        vitalThreshold: 80,
        base: 3.6,
        /** Combat power added by having nothing left to lose. */
        powerBonus: 2.5,
        /** ...and the tunnel vision that comes with it. */
        awarenessPenalty: 2,
        concealmentPenalty: 0.1,
        /**
         * Hysteresis on the way out: the entry threshold is multiplied by this
         * while the tribute is already Desperate, so recovering one point of
         * health does not immediately end the state.
         */
        exitBand: 1.8,
        /** Chance per cycle of robbing an ally for supplies. */
        robAllyChance: 0.3,
        /** Extra pull per ten health below the threshold. */
        perTenHealthBelow: 1,
        /** Extra pull from a broken resolve, and from each ruined vital. */
        brokenBonus: 1,
        vitalBonus: 0.6,
        /** What robbing an ally costs, socially. */
        victimRegard: 30,
        thiefRegard: 10,
        victimFear: 8,
        victimSuspicion: 20,
    },
    scavenging: {
        /** Inventory value below which a tribute has nothing worth having. */
        inventoryValue: 8,
        base: 1.8,
        /** Pull from a cannon in an adjacent zone: someone dropped their kit. */
        cannonBonus: 1.6,
        /** Corpse-looting edge. */
        lootBonus: 0.35,
        /** Forage edge on ground others have already worked. */
        pickingsBonus: 0.18,
        /** ...paid for in a fight they did not want. */
        combatPenalty: 1.5,
        /** Pull from carrying no weapon at all. */
        unarmedBonus: 0.8,
        /** Pull per point of kit value they are short of the threshold. */
        perMissingValue: 0.08,
        /** ...and the discount for a cannon site with people still on it. */
        contestedPenalty: 1.5,
        /** Chance of successfully stripping a body already in the zone. */
        bodyStripChance: 0.75,
        /** Hysteresis on the way out. See `desperate.exitBand`. */
        exitBand: 2,
    },
    shadowing: {
        // §8: 7 of 10 stealth, on a cast whose stealth averages nearer 5, on
        // top of an unbroken unseen streak and a valid quarry one zone over.
        // Shadowing fired in 0.5% of cycles.
        stealthMin: 6,
        base: 4.4,
        /** Consecutive unnoticed cycles that convert into a free ambush. */
        cyclesToAmbush: 3,
        /** Concealment edge while trailing rather than closing. */
        concealmentBonus: 0.1,
        /** The free opener, once the count lands. */
        ambushPowerBonus: 4,
        ambushDamageMultiplier: 1.7,
        /** Pull per point of stealth above the floor. */
        perStealthPoint: 0.25,
        /** ...and per cycle already invested in this particular trail. */
        perTrailCycle: 0.5,
        armedBonus: 0.5,
        woundedPenalty: 1,
        /** What being spotted mid-trail does to the quarry. */
        spottedFear: 6,
        /** Awareness a bystander needs to register a fortified position. */
        positionNoticeAwareness: 5,
        positionFear: 3,
    },
} as const;

/** Relationship graph: bounds, decay, and the deltas life in the arena applies. */
export const RELATIONSHIPS = {
    /** §4.3: how far a third party's read on a pair can go, either way. */
    perceivedBondMax: 100,
    perceivedBondPerScene: 18,
    /** §4.9: two people who both loved the victim, grieving in the same
     *  place, bond over it. */
    sharedGriefBond: 6,
    /** §4.6: the leader's authority slows their members' doubt of them; a
     *  member out of sight of the camp is doubted faster. */
    leaderDecayFactor: 0.6,
    absentDecayFactor: 1.4,
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
    /** Odds that relief at an enemy's cannon is visible enough to narrate. */
    reliefLineChance: 0.4,

    /**
     * §1.8: the reaping-table and fallout dials, migrated out of the engine.
     *
     * These were the twelve highest-density undeclared sites in the codebase —
     * the file where balance is hardest to tune was also the file where the
     * numbers were hardest to find. Nothing here changes value.
     */
    /** Archetype treachery/caution above which a pair starts wary of each other. */
    warinessTreachery: 0.2,
    warinessCaution: 0.2,
    /** Age at or below which a protective archetype cannot stay neutral. */
    wardAge: 13,
    /** Alliance affinity an older tribute needs before a young one moves them. */
    wardAffinity: 0.15,
    /** Grief intensity above which a close loss leaves a permanent mark. */
    hauntedIntensity: 0.5,
    /** Grief intensity above which an ordinary mourning gets its own line. */
    griefLineIntensity: 0.45,
    /** Sponsor trust the crowd hands back for visibly grieving, per intensity point. */
    griefTrustPerIntensity: 6,
    /** Sponsor trust at which a tribute counts as a crowd favourite for kill fallout. */
    favouriteTrust: 75,
    /** What putting a favourite down costs the killer, and pays them in spectacle. */
    favouriteKillTrustCost: 12,
    favouriteKillExcitement: 25,
    /** Betrayal fallout on the person who took the knife, and on the one who held it. */
    betrayalSanityCost: 15,
    betrayalExcitement: 30,
    betrayalTrustCost: 8,

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
    /** §4.4: odds an eligible tribute plans the showmance at the interview. */
    showmanceInterviewChance: 0.12,
    /** Multiplier on performedChance for a tribute who planned it. */
    showmanceMultiplier: 2,
    /**
     * Odds a one-sided attachment gets played for the cameras instead.
     * §6.1: at 0.07 behind five conjunctive gates the performed bond fired
     * 1-2 times across 240 runs — one of the best ideas in the codebase,
     * effectively unreachable. Loosened with performedMinRegard and
     * performerCharisma so it lands a few times per soak. Loosened again when
     * alliance formation gained its same-zone gate: fewer organic alliances
     * means less sustained contact for the streak to build on.
     */
    /**
     * §4.3: Star-Crossed-as-strategy is one of the best ideas in the social
     * layer, and at 0.13 behind these gates it fired in roughly 5% of runs —
     * effectively it did not ship. Raised substantially, and paired with
     * `performedSniff*` below so the strategy carries the risk that makes it a
     * strategy rather than free sponsor money.
     */
    performedChance: 0.24,
    /** Per-cycle odds a sharp observer in the same zone reads the act. */
    performedSniffChance: 0.22,
    /** Intelligence at or above which a tribute can read a performance at all. */
    performedSniffIntelligence: 7,
    /** ...and what the crowd does about it once somebody says it out loud. */
    performedExposedTrust: 22,
    performedExposedRegard: 30,
    /** Excitement above which the cameras are close enough to catch it too. */
    performedExposedExcitement: 55,
    /**
     * Regard the smitten party needs. Deliberately below `threshold`: a
     * performed bond does not need the mutual devotion a real one does, only
     * one person who has fallen far enough to be convincing about it.
     */
    performedMinRegard: 50,
    /**
     * §4.1: the gate that was missing. A performed bond is not "somebody likes
     * you a great deal", it is asymmetry — one person who has fallen and one
     * who has noticed. Requiring the *gap* rather than an absolute ceiling is
     * both the actual dramatic condition and reachable: the old 72-regard
     * floor behind four other conjunctive gates fired 8 times in 400 runs.
     */
    performedMinAsymmetry: 30,
    /** Regard that carries a performance on its own, with no asymmetry to it. */
    performedHighRegard: 72,
    /** Charisma needed to sell a romance you are not feeling. */
    performerCharisma: 5,
    /** What the performer shows, as opposed to what they feel. */
    performedDisplayedRegard: 75,
    /** §11.1: displayed-regard refresh per social scene the performer plays warm. */
    performedUpkeep: 2,
    /** Nothing before the bloodbath is over and the cast is real. */
    minDay: 2,
    /** Bond required before a romance is even considered. */
    threshold: 96,
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
    sustainedCycles: 4,
    /** Contact this stale breaks the streak. */
    contactWindow: 2,
    /**
     * Odds per cycle once every condition holds. Romance is never automatic.
     * Retuned 0.1 -> 0.04 at integration, then 0.04 -> 0.02 when §4.2 made
     * truces actually keepable: far more sustained peaceful contact means
     * far more pairs holding the streak and the regard gates, so the same
     * per-cycle odds produced 30%+ lover-runs. 0.02 (with sustainedCycles 4
     * and performedChance 0.08) lands the combined system at ~11%, inside
     * the 10%-15% design goal.
     */
    /**
     * §4.3: retuned again when the performed bond was raised from 0.13 to a
     * rate that actually ships. Genuine and performed bonds both mint the
     * Star-Crossed trait, so they share one budget — the design goal is a
     * 10-15% lover-run rate with a far larger *share* of it performed, not a
     * larger total. Genuine romance gives up the room the performance takes.
     */
    chancePerCycle: 0.002,
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
    /** §4.4: how much more attractive a mark the member holding the cache is. */
    betrayalQuartermasterWeight: 1.6,
    /**
     * A2: the cache value at or below which a Mercenary considers the contract
     * finished. Zero would mean literally empty, which almost never happens;
     * this is "nothing worth staying for".
     */
    mercenaryRetainer: 6,
    /** §4.7: the Career pack recruits hard in the early game — that is its
     *  narrative function. Days it stays hungry, and how much hungrier. */
    careerRecruitEarlyDays: 3,
    careerRecruitMultiplier: 2.5,
    careerRecruitThresholdFactor: 0.6,
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
    /**
     * §12: was 0.25, which produced at most one coup in an entire Games and
     * frequently none — 'Mutiny' had never fired for anybody. Alliances break
     * up long before a second challenger can gather the backing, so the roll
     * has to land more often for a contested pack to be a thing a viewer ever
     * sees twice.
     */
    coupChance: 0.45,
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

    /**
     * §4.1: pacts, declared at formation. A scheduled split is a telegraphed
     * betrayal, which is the point — but the deadline has to be *reachable*.
     * `pactKindWeights` picks the shape; the field-threshold shape then rolls
     * its number relative to the live field, so it can never be a deadline the
     * group is already past. `finalEightSize` remains the ceremonial default
     * for a full 24-tribute field and the anchor for the charter's
     * split-at-eight clause.
     */
    pactChanceAtAll: 0.6,
    pactKindWeights: {
        'until-field': 8,
        'to-the-end': 6,
        'until-day': 3,
        'until-event': 4,
        'until-goal': 2,
    },
    /** Field thresholds a pact may name, filtered to `n <= field - pactThresholdSlack`. */
    pactFieldThresholds: [16, 12, 10, 8, 6, 4, 2],
    /** How far in the future a field threshold must be to be worth swearing to. */
    pactThresholdSlack: 2,
    /** Days a `until-day` pact runs for, before clamping to the run's length. */
    pactDayHorizon: 7,
    /** Health at or below which a member counts as "badly hurt" for a pact. */
    pactHurtHealth: 35,
    /** Field size at which the charter's split-at-eight clause comes due. */
    finalEightSize: 8,
    /**
     * The dissolution ceremony ("the field is down to four…") only reads as
     * ceremony if the field actually came down. Below this much attrition
     * since the pact was sworn, the group just quietly goes its own way.
     */
    pactCeremonyAttrition: 6,

    /**
     * §4.2: politics inside the group.
     *
     * A faction forms when two or more members' suspicion of the same third
     * party is all above `factionSuspicion`. `factionHeat*` decides whether it
     * ends in a coup, a walk-out, or nothing at all.
     */
    factionSuspicion: 14,
    factionMinMembers: 2,
    factionHeatPerCycle: 6,
    factionCoupHeat: 24,
    factionSplitHeat: 12,
    factionCoupRegard: -14,
    /** A second breach of the same clause by the same member is a hearing. */
    hearingBreachCount: 2,
    hearingExpelChance: 0.45,
    hearingDemoteChance: 0.3,
    expulsionRegardCost: 18,
    /** A member who fed the group has a claim on the cache when it splits. */
    cacheClaimShare: 0.5,
    /** The leader names an heir once the group is this big. */
    successorMinSize: 3,

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
    /**
     * §4.3: the way down. A rivalry that only ever escalated meant two
     * tributes who fought twice and then survived a mutt attack together were
     * enemies for the rest of the run by arithmetic.
     */
    coolingCycles: 3,
    coolingPerWindow: 0.34,
    coolingSharedDanger: 1.2,
    sharedDangerHealth: 55,
    coolingFear: 4,
    reconcileRegard: 14,
    /** Fights that make a rival's death a loss rather than a relief. */
    grievableFights: 2,
    /** Somebody else finishing the person you had promised yourself. */
    stolenKillSanity: 8,
    stolenKillRegard: 12,
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
    /**
     * §6.6: one economy, not two. The blocs' interest in a tribute is demand
     * pressure on the player's quote — a tribute the old-money families are
     * already eyeing costs more to reach first...
     */
    blocDemandPressure: 0.05,
    blocDemandCap: 0.5,
    /** ...and after a player parachute lands, the blocs read the tribute as
     *  covered and sit on their purses for a while. */
    coveredCycles: 4,
    coveredGiftMultiplier: 0.35,
} as const;

/**
 * §1.8: the parachute need-weighting table, migrated out of `sponsors.ts`.
 *
 * `needWeight` is the function that decides which item a tribute actually
 * receives, and every divisor and bonus in it was a bare literal — eleven
 * undeclared sites in one 25-line function, and the second-densest patch of
 * balance debt in the engine. A designer retuning "how badly does thirst
 * outrank hunger" had to read the engine to find out that it was `/12` against
 * `/14`. Values are unchanged.
 */
export const GIFT_NEED = {
    /** Vitals divisors: a smaller number means that need shouts louder. */
    thirstDivisor: 12,
    hungerDivisor: 14,
    purifierThirstDivisor: 20,
    warmthFatigueDivisor: 25,
    /** Medical: the specific answer to a specific injury outranks a general one. */
    bleedingOrInfected: 6,
    matchedAntidote: 8,
    matchedOintment: 6,
    /** Health below which a wound starts pulling medical weight, and how fast. */
    woundedBelowHealth: 70,
    woundedPerTenHealth: 10,
    /** A weapon matters far more to someone holding nothing. */
    weaponWhenArmed: 0.2,
    weaponWhenUnarmed: 3,
    /** The crowd arms a tribute it has watched fight — capped, so it is not a snowball. */
    weaponPerKillCap: 3,
    /** Armour is for someone who has already been hit. */
    armourWhenHurt: 2,
    armourWhenWhole: 0.5,
    lightBonus: 0.5,
    /** A second copy of something already carried is nearly worthless. */
    duplicateMultiplier: 0.35,
    /** Floor so no item is ever strictly impossible to draw. */
    minWeight: 0.05,
    /** Value floor for the fallback gift pool when a tier's own pool is empty. */
    fallbackItemValue: 20,
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
    /**
     * The chariot parade's afterglow: for the first days of the Games a
     * memorable entrance keeps the sponsor phones ringing. Multiplier on the
     * gift chance per point of parade pull, and how many days it lasts —
     * the Capitol's attention span, not the tribute's merit.
     */
    paradeBuzzPerPull: 0.06,
    paradeBuzzDays: 3,
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
    /**
     * §10.7: the calendar is not the whole of the Capitol's patience. Beyond
     * the scheduled beats, up to this many extra disruptions can fire per
     * run, each at diminishing odds and never within the spacing window of
     * the last one — so a long Games stays alive without a short one being
     * buried under interventions.
     */
    maxExtraDisruptions: 2,
    extraDisruptionBaseChance: 0.06,
    extraDisruptionDecay: 0.5,
    extraDisruptionSpacingCycles: 5,
    /** No extra disruptions before this day — the opening days are busy enough. */
    extraDisruptionEarliestDay: 4,
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
    /**
     * §6.7: intervention discipline. Each event type has a cooldown, each
     * repeat use of the same lever costs more (the sponsor market's repeat^n
     * shape), and an audience that keeps being shown the same trick gets
     * bored of it — or turns on the booth outright.
     */
    eventCooldownCycles: 2,
    repeatCostMultiplier: 1.5,
    /** Uses of one lever within the boredom window before the crowd sours. */
    overuseThreshold: 3,
    /** Excitement the whole field sheds when the crowd sours on the booth. */
    overuseExcitementPenalty: 5,
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
    /**
     * §10.6: the table is themed, and the announcement says so — which is
     * what lets a tribute decide differently. A wounded tribute risks the
     * medical feast they would skip on an ordinary year; a well-armed Career
     * shrugs at a food table; an unarmed underdog eyes the weapons cache.
     */
    medicalThemeWoundedDraw: 0.35,
    weaponsThemeUnarmedDraw: 0.25,
    weaponsThemeArmedDeter: 0.1,
    foodThemeHungerDraw: 0.2,
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
    /**
     * §3.1: the endurance and willpower age curves.
     *
     * Endurance rises gently with age and never spikes — it is years of
     * walking, not a growth spurt. Willpower is flat across most of the band
     * and dips hard at the bottom of it: the twelve- and thirteen-year-olds
     * are the ones who break under grief, which is the whole reason the trait
     * was split out of per-run resolve.
     */
    endurancePerYear: 0.35,
    willpowerYoungAge: 13,
    willpowerYoungPenalty: 1,
    willpowerPlateauYears: 2,
    willpowerPerYear: 0.5,
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
    /**
     * §3.2: archetype-specific variance shapes. A Career and an underdog no
     * longer share one variance profile: Careers are narrow and high (the
     * academy filters out the outliers), wildcards genuinely bimodal (double
     * spikes and dumps, talent that is never merely average).
     */
    careerTalentSpread: 2,
    careerTalentShift: 1,
    careerSpikeSize: 1,
    wildcardTalentMin: 2,
    wildcardSpikeCount: 2,
    wildcardSpikeSize: 3,
    /**
     * §3.1: build is a real second axis now — an independent frame roll
     * blended with strength at this weight (1.0 would make it a strength
     * alias again; 0 would decouple them entirely).
     */
    buildFrameWeight: 0.6,
    /** §3.1: roughly one tribute in ten leads with the other hand. */
    leftHandedShare: 0.11,
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
export const ACHIEVEMENT_BARS = {
    /**
     * §12: how many of armour / light / warmth / purifier a tribute must hold
     * at once for 'Full Kit'. Was effectively 4 (all of them) and nobody ever
     * managed it — carry capacity puts a fourth utility slot in competition
     * with food, water and a weapon.
     */
    fullKitSlots: 3,
    /**
     * §12: cycles a pair who grieved the same death must stay allied before
     * 'Both Mourned' counts. Without a hold requirement the pairing is simply
     * "an alliance that has been in the Games a while", and it fired on nearly
     * every run.
     */
    sharedGriefCycles: 4,
} as const;

export const PREGAMES = {
    /**
     * §12: share of tributes whose district token clears the review board.
     *
     * Every tribute used to be issued one, which made 'The Token' — crown a
     * victor still carrying the one thing they brought from home — fire on
     * 98.8% of runs. It was measuring the goodbye-room scene, not the victor.
     */
    tokenAllowedChance: 0.62,
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

    // ---- A4: the three days, narrated ----
    /**
     * The station gain used to be unconditional: every day at every station
     * simply worked. Rolling it against the attribute is what makes
     * `trainingStrategy: 'conceal'` a real gamble rather than a flat score
     * penalty, and what gives the floor a public record to react to.
     */
    stationBaseSuccess: 0.45,
    stationPerAttributePoint: 0.055,
    /** Each day on the floor is more tiring than the last. */
    stationFatiguePerDay: 0.06,
    /** A district that raised them on this work has an easier time of it. */
    stationCraftBonus: 0.12,
    /** Concealers deliberately underperform, and are sometimes believed. */
    stationConcealPenalty: 0.2,
    /** Below the success band but above this, they got through it badly. */
    stationStruggleBand: 0.22,
    /** Fraction of the ordinary gain a struggle is worth. */
    struggleGainFactor: 0.5,
    /** Respect the room withdraws from somebody it watched flounder. */
    struggleRespect: 4,
    failureRespect: 9,
    /** What a public failure costs the tribute themselves. */
    failureSanity: 5,
    /** ...and what a Career takes from watching it. */
    failureCareerFearDrop: 6,
    /** Respect the room grants somebody it watched succeed visibly. */
    successRespect: 5,
    /** ...more, if they were showcasing. */
    showcaseRespectBonus: 4,

    /** Warmth between two tributes who worked the same station all day. */
    mingleWarmth: 6,
    /** Chance a shared station actually turns into a conversation. */
    mingleChance: 0.55,
    /** Chance two tributes who have been mingling strike a pre-agreement. */
    pactChance: 0.3,
    /** Regard a pre-agreement needs before it is even offered. */
    pactMinRegard: 12,
    /** ...and the regard striking one is worth. */
    pactWarmth: 12,
    /** Careers form theirs on day one and it is visible. */
    careerPactDay: 1,
    /** What watching a pack assemble itself does to everybody else. */
    careerPactFear: 6,
    /** How much a pre-agreement raises the odds of converging at the gong. */
    pactBloodbathPull: 0.45,

    /** Regard below which two tributes at the same station may come to blows. */
    altercationRegard: -12,
    /** Chance a hostile pairing at a station actually goes off. */
    altercationChance: 0.45,
    /** Fear each direction after a confrontation the trainers broke up. */
    altercationFear: 9,
    /** Sponsor swing: the crowd loves a feud and distrusts a brawler. */
    altercationExcitement: 20,
    altercationTrust: -3,

    /** Fear written by watching somebody be frightening at a combat station. */
    observationFear: 5,
    /** Respect written by watching somebody be visibly good at anything. */
    observationRespect: 4,
    /** Attribute at or above which a combat-station showing reads as a threat. */
    observationThreatAttribute: 8,
    /** Chance a tribute's observation of the floor produces a line. */
    observationLineChance: 0.18,
    /** Chance the evening beat draws from that day's own pool rather than the general one. */
    eveningDayPoolChance: 0.5,
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
    eliteGateBase: 0.38,
    /**
     * §7.5: 0.3/0.42 measured out to 11s at 0.59% and 12s at 0.03% of all
     * scores — "unprecedented" had drifted into "unseen". 0.36/0.52 keeps the
     * exponential shape but lands 11s around 1.5-2.5% and 12s around
     * 0.2-0.4%: an 11 is a talking point most Games have one of, a 12 is a
     * story a Games *can* have.
     */
    eliteGateDecay: 0.55,
    eliteGateCap: 0.55,
    /** Points above 8 that are reachable at all: 9 through 12. */
    eliteGates: 4,
    /** A tribute who just startled the panel is far likelier to clear a gate. */
    stuntGateMultiplier: 1.8,

    /**
     * Base band, from what they can do in front of a panel.
     *
     * §8: this is the divisor on the *sum* of a tribute's attributes, and it
     * was calibrated at 5 when `Attributes` had five fields. §3.1 added
     * endurance and willpower without retuning it, so the same tribute's
     * `totalStats` grew by two whole attributes' worth — roughly 40% — and the
     * base band stopped discriminating: `floor(totalStats / 5)` pinned almost
     * everybody at or above the ceiling of 8 before the skill term or the
     * jitter was even added. Measured consequence: mode 8 at 35.4% of all
     * scores, 9-or-better at 37.3% against a regression guard of 7-24% and a
     * design intent of 12-18%, and scores of 1-6 accounting for 14.9% of the
     * board combined. A 10 is supposed to be remarkable; it was happening
     * 10.4% of the time.
     *
     * 7 restores the five-attribute calibration: attribute *count* times the
     * original per-point cost divided by the original count.
     */
    statsPerPoint: 7,
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
    /**
     * §3.1: willpower's grip on the per-cycle drift. A bad day costs less and
     * a good day is worth a little more; the downside share is capped at the
     * drift itself so willpower can blunt a collapse but never invert it.
     */
    willpowerPerPoint: 0.35,
    willpowerUpsideShare: 0.5,
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
    /**
     * §12: chance a breakdown costs the tribute their district token.
     *
     * Tokens used to be indestructible flavour — issued to everyone at the
     * goodbye room and never taken away — which made the 'The Token'
     * achievement ("crown a victor still carrying the one thing they brought
     * from home") fire on 98.8% of runs, because it reduced to "win". A token
     * you can put down is a token that means something when you do not.
     */
    tokenLostOnBreakdown: 0.18,
    /** Walking into the open is cathartic: it buys back a little will. */
    breakdownRebound: 12,
    /** Sitting down and stopping is not, and compounds instead. */
    sittingDownPenalty: 4,
    /** Taking the nightlock needs to be genuinely final, and is still rare —
     *  but 14/0.3 meant 1-4 firings per 240 runs, an ending players would
     *  never see (§6.1). */
    nightlockThreshold: 24,
    nightlockChance: 0.6,
    /** A tribute with nothing left can go looking for it where things grow. */
    nightlockForageResources: 0.25,
    nightlockFindChance: 0.75,
} as const;

/**
 * Parley: talking instead of fighting.
 *
 * Two strangers meeting in a clearing had exactly two possibilities — a fight
 * or a pleasantry. The far more common real outcome is a negotiation: backing
 * out of it, paying to leave, or agreeing not to do this today. See
 * `engine/parley.ts`.
 */
/**
 * §4.1: the second stored axis. `relationships` is regard; `respects` is
 * professional esteem — "I rate them as a fighter" — which regard cannot
 * express (you can respect someone you would never sleep near). Written by
 * witnessed kills and the training-score reveal; read by recruitment and by
 * truce restraint.
 */
export const RESPECT = {
    /** §3.3: watching somebody do skilled work properly, in front of you. */
    witnessCompetence: 1.5,
    /** What survives a reconciliation even when the liking does not. */
    reconcile: 3,
    /** §4.3: how much being rated buys you in somebody else's target list. */
    targetReluctanceDivisor: 50,
    targetReluctanceMax: 0.12,
    /** Respect at which a warning from this person is information, not noise. */
    credibilityThreshold: 6,
    /** ...and below which even your own group stops acting on what you say. */
    dismissedThreshold: -4,
    max: 100,
    /** Respect earned by everyone watching a clean kill. */
    witnessKill: 6,
    /** Respect per point of training score above the middle of the band. */
    trainingWeight: 2.5,
    /** Weight of respect in a group's recruitment read of a candidate. */
    recruitWeight: 0.3,
    /** You do not cross someone you rate: divisor for the truce-break restraint. */
    truceRestraintDivisor: 250,
} as const;

export const PARLEY = {
    /** A power ratio below this means a tribute genuinely likes their odds. */
    // §1.11: read against the same measured distribution as `outmatchedRatio`
    // — at 0.8 nine hostile meetings in ten counted as "confident", so the
    // no-negotiation guard fired almost unconditionally.
    confidentRatio: 0.22,
    /**
     * A power ratio above this means they know they are losing. 1.25 left the
     * pay-your-way-out path effectively dead (≤5 firings across 240 runs, and
     * whole soaks with zero) — a matchup lopsided enough to read as clearly
     * outmatched through the perception layer almost never met the other
     * gates too.
     */
    // §1.11: loosened twice before (1.12 -> 1.08) without ever fixing the
    // cause. `assessZone`'s ratio is not on a 1.0-is-even scale: the estimate
    // side is a visible-power reading regressed toward "average tribute" by
    // the confidence term, while the denominator is the observer's own known
    // sheet. Measured across a 60-run probe the ratio two strangers read of
    // each other is p25 0.21, p50 0.31, p95 0.70 — so *every* pair read as
    // mutually un-outmatched at 1.08 and the XOR below could never be true.
    // That is the whole reason `tributesPaid` measured 1 across 400 runs.
    // Set at the measured median, where an asymmetric matchup genuinely
    // straddles it.
    outmatchedRatio: 0.32,

    /** Paying to be allowed to leave. */
    tributeChance: 0.6,
    /**
     * Chance a confident Aggressive party takes the toll instead of the
     * fight. §10.3's aggression push had squeezed every negotiated outcome
     * out of hostile meetings; this keeps the shakedown a living branch.
     */
    aggressiveExtortChance: 0.3,
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
    /**
     * §1.11: threat a remembered zone needs before it is worth trading.
     *
     * At 1.5 this needed a tribute to have accumulated more than a witnessed
     * death's worth of dread on one zone *and* survive to be shaken down over
     * it, which fired six times across 400 runs. 0.8 is "somewhere they
     * watched something happen", which is what the beat is actually about.
     */
    tollInfoMinThreat: 0.8,
    /**
     * Chance the stronger party wants directions rather than the weaker's
     * loose item even when there is one to take. The wider item catalogue
     * (§8.3) made genuinely empty hands rare, which had quietly starved the
     * information branch back to zero — knowledge is the toll a Career
     * actually values once everyone is carrying something.
     */
    tollInfoPreferenceChance: 0.35,
    tollInfoResentment: 8,
    tollInfoSanityCost: 5,

    /** §4.3: health at which "we are both too hurt for this" stops being true. */
    truceHealedHealth: 70,
    /** Kills that make a third party a threat worth agreeing about. */
    truceThreatKills: 2,
    /** §1.2: what a brokered truce running its full term pays its broker. */
    brokerHeldTrust: 8,
    brokerHeldExcitement: 12,
    brokerHeldRegard: 6,
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
    /**
     * §1.2: turning on a *paying client*. A contract holds harder than a
     * favour — a mercenary who knifes the person who hired them is a mercenary
     * nobody else in the arena will ever hire.
     */
    retainerBetrayalResist: 0.45,
    retainerRegardPerCycle: 2,
    retainerTrustPerCycle: 1,
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
    /**
     * §11.3: the partner's death is a bigger loss than an ally's. Extra
     * sanity torn off on top of the ordinary grief arithmetic, and the bond
     * above which the survivor swears it will mean something.
     */
    partnerGriefSanity: 10,
    partnerGriefBond: 20,
} as const;

/**
 * Alliance charters: the rules a group agrees to keep, and the fallout short of
 * a betrayal when somebody breaks one. See `engine/allianceCharter.ts` — an
 * alliance previously had only three exits (death, betrayal, pact expiry), so
 * every disagreement had to escalate to a knife or not exist.
 */
export const CHARTER = {
    /** §4.5: odds a breach hardens the terms instead of only costing regard. */
    renegotiateChance: 0.3,
    /** §4.5: odds a forming alliance writes the endgame into its terms. */
    endgameClauseChance: 0.25,
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
/**
 * §7.6: the withheld gift — mentorship as dramaturgy. A mentor who *could*
 * afford a parachute watches their tribute make a survivable mistake (dry
 * mouth two hundred metres from a stream; starving in a zone still green) and
 * deliberately sends nothing: the silence is the note. When the tribute then
 * fixes it themselves, the parachute arrives with the point attached.
 */
export const MENTOR_DRAMA = {
    /** Thirst at which sitting near water reads as the mistake. */
    withholdThirst: 62,
    /** Hunger at which starving in a green zone reads as the mistake. */
    withholdHunger: 72,
    /** Zone resources above which "there is food here, use it" applies. */
    withholdZoneResources: 0.45,
    /** Odds the mentor plays it this way rather than simply pleading. */
    withholdChance: 0.5,
    /** Odds the silence gets its own line the cycle it happens. */
    withholdLineChance: 0.6,
    /** Once the tribute self-corrects: odds the pointed gift actually flies. */
    correctedGiftChance: 0.55,
    /** Vitals level the tribute must get back under to count as corrected. */
    correctedBelow: 45,
    /** Cycles the lesson stays live before the mentor lets it drop. */
    lessonWindowCycles: 6,
} as const;

/**
 * §11.6: what a tolled crossing costs different bodies. The printed toll is
 * the base; a heavy frame hauls itself up the same rope for more, and a bad
 * leg pays again.
 */
/**
 * §9.1: the downed state and the rescue window.
 *
 * The health scale was binary at the bottom — a tribute was alive, or dead
 * with a cause attached — so the most dramatic moment available to this
 * simulation, the one where somebody is lying at your feet and you decide,
 * simply had nowhere to happen. These are the numbers that govern who gets
 * that window, how long it stays open, and what closes it.
 */
export const DOWNED = {
    /** Base chance a killing blow puts them down instead of finishing them. */
    baseChance: 0.42,
    /** Added to that chance per point of endurance. */
    perEndurance: 0.03,
    /** Ceiling on the combined chance, so a killing blow is always a real risk. */
    maxChance: 0.7,
    /** Cycles the window stays open before the wound finishes the job. */
    baseCycles: 2,
    /** Endurance at or above which the body buys itself one more cycle. */
    toughEndurance: 7,
    /** Field size at or below which the Gamemakers stop allowing the mercy. */
    finalistFloor: 3,
    /** Health a successful rescue brings them back on. */
    reviveHealth: 22,
    /** Base chance an ally's rescue attempt works at all. */
    rescueBase: 0.3,
    /** Added per point of the rescuer's medicine proficiency. */
    rescuePerMedicine: 0.14,
    /** Added per point of the rescuer's intelligence. */
    rescuePerIntelligence: 0.02,
    /** A medical item in the rescuer's pack, spent on the attempt. */
    rescueItemBonus: 0.25,
    /** Fatigue the rescuer pays for the attempt, successful or not. */
    rescueFatigue: 12,
    /** Sanity the rescued tribute recovers from not having died alone. */
    rescueSanityRelief: 14,
    /** Sanity a failed rescue costs the ally who was holding them. */
    failedRescueSanity: 18,
    /** Relationship the rescued tribute owes their rescuer. */
    rescueBond: 30,
    /** Base chance an enemy standing over them finishes it. */
    executeBase: 0.55,
    /** Shifted by the killer's aggression and mercy traits. */
    executePerAggression: 0.3,
    /** Fear every witness gains toward somebody who finished a helpless tribute. */
    executeFear: 22,
    /** Respect a witness loses for it. Killing the helpless is not fighting. */
    executeRespect: 8,
    /** Sanity the executioner pays on top of the ordinary kill toll. */
    executeSanity: 10,
    /** Respect a witness gains for somebody who walked away from it. */
    spareRespect: 14,
    /** Relationship the spared tribute feels toward whoever let them live. */
    spareGratitude: 35,
} as const;

/**
 * §5.5: the edge kinds beyond one-way, tolled and time-gated.
 *
 * `EdgeRule` described three things a route could be. These are the numbers
 * for the four it could not: a crossing that wears out, a slope that ices over
 * behind you, a pass somebody is sitting on, and a way nobody has found.
 */
export const EDGE_RULES = {
    /** Chance a tribute standing at a hidden edge notices it at all, per cycle. */
    discoverBase: 0.08,
    /** Added per point of intelligence. */
    discoverPerIntelligence: 0.02,
    /** Added per point of awareness from traits and stance. */
    discoverPerAwareness: 0.03,
    /** Cycles a tribute must have held the zone before a hidden way opens up to them. */
    discoverSettledCycles: 1,
    /** Chance an ally is simply told about a hidden edge each cycle they share a camp. */
    tellAllyChance: 0.35,
    /** Crossings a `collapsing` edge has by default when its rule omits a count. */
    defaultCrossings: 3,
    /** Crossings after which an `oneWayAfter` edge sets, when its rule omits one. */
    defaultAfter: 2,
    /** Chance a garrisoned `contested` edge actually intercepts a crosser. */
    garrisonInterceptBase: 0.65,
    /** Reduced per point of the crosser's stealth. */
    garrisonInterceptPerStealth: 0.05,
    /** Fatigue a forced crossing costs even when nobody catches them. */
    forcedCrossingFatigue: 8,
    /** Cycles an alliance must hold a chokepoint zone before it counts as garrisoned. */
    garrisonHoldCycles: 2,
} as const;

/**
 * §9.7: map knowledge as a thing you can hand over, sell, or poison.
 *
 * `memory.zones` was per-tribute and unshareable, which left the outer
 * districts with nothing to trade against Career combat power. Telling
 * somebody where the water is — or telling them wrong — is the counterweight.
 */
export const INTEL = {
    /** Chance allies sharing a camp trade honest map knowledge in a cycle. */
    shareChance: 0.3,
    /** Zones handed over in one exchange. */
    zonesPerShare: 2,
    /** Chance a treacherous tribute poisons what they hand over instead. */
    lieChanceBase: 0.12,
    /** Added per point of the teller's treachery bias. */
    lieChancePerTreachery: 0.35,
    /**
     * Threat a lie invents about a zone that is actually safe.
     *
     * On `ZoneMemory.threat`'s own 0-6 scale, not the 0-100 one the
     * relationship knobs above use — `addZoneThreat` caps at 6 and the soak
     * asserts the bound, so a value written straight into the slot has to
     * respect it. Four is 'somebody died there', which is exactly the story
     * a liar wants told about ground they want kept empty.
     */
    lieThreat: 4,
    /** Relationship lost when a lie is found out. */
    lieDiscoveredCost: 45,
    /** Chance per cycle a tribute standing in a lied-about zone works it out. */
    lieDiscoveryChance: 0.4,
    /** Relationship gained by the receiver of genuinely useful intelligence. */
    honestIntelBond: 12,
    /** Sponsor trust a tribute earns for visibly brokering knowledge on camera. */
    intelSponsorTrust: 4,
    /** Cycles a piece of hearsay stays trusted before it decays faster than sight. */
    hearsayDecayMultiplier: 1.8,
} as const;

/**
 * §6.2/§6.3/§6.4: depth in the three pre-arena and mid-arena set pieces —
 * the private session, the persona the crowd holds them to, and a feast with
 * names on the packs.
 */
export const PRE_ARENA = {
    /** Chance a training pact is struck with real terms rather than a handshake. */
    pactTermsChance: 0.6,
    /** Base confidence in a pact struck on training day 1. */
    pactConfidenceDay1: 0.35,
    /** Added per training day it is struck after the first. */
    pactConfidencePerDay: 0.18,
    /** Added when the other party scored well and it is public knowledge. */
    pactConfidencePerScorePoint: 0.03,
    /** Cycles into the Games a pact lapses on its own terms, by default. */
    pactExpiryCycles: 8,
    /** Extra cycles a high-confidence pact runs for. */
    pactExpiryPerConfidence: 10,
    /** Private session: score swing a spectacular stunt is worth. */
    privateSessionSwing: 2,
    /** Private session: chance a tribute does something the room will remember. */
    privateSessionStuntChance: 0.35,
    /** Respect every tribute gains toward a concealed tribute when the cover breaks. */
    concealRevealRespect: 22,
    /** Fear every witness gains at the same moment. */
    concealRevealFear: 18,
    /** Sponsor trust the reveal is worth — the crowd loves being wrong-footed. */
    concealRevealTrust: 10,
    /** Backlash accrued per cycle a tribute plays against the persona they sold. */
    backlashPerCycle: 1.6,
    /** Backlash at which the crowd says so out loud and sponsor trust pays for it. */
    backlashThreshold: 12,
    /** Sponsor trust lost when the backlash lands. */
    backlashTrustCost: 14,
    /** Excitement a tribute who lives up to their persona is worth instead. */
    personaHeldExcitement: 8,
    /** Feast: cycles of head start the first arrivals get to set up in. */
    feastEarlyArrivalEdge: 1,
    /** Feast: ambush advantage an early arrival carries into the first exchange. */
    feastEarlyAmbushBonus: 0.18,
    /** Feast: chance a tribute takes a pack with somebody else's name on it. */
    feastStealPackChance: 0.4,
    /** Feast: sanity cost of watching your own named pack walk away. */
    feastPackLostSanity: 12,
} as const;

export const EDGE_TOLL = {
    /** Extra fatigue per point of mass (build) on top of the printed toll. */
    fatiguePerMass: 1.2,
    /** Extra fatigue per grade of leg/arm injury. */
    fatiguePerInjuryGrade: 2,
    /** `timeCost` crossings: extra fatigue per additional cycle spent on the edge. */
    recoveryFatiguePerCycle: 4,
} as const;

/**
 * §11.5: the tool subsystems' second read sites. Light turns night searching
 * back into searching; warmth blunts the cold's teeth at night; a fishing kit
 * makes still water a larder for a hunter too.
 */
export const TOOLS = {
    /** Forage chance a light source adds after dark. */
    lightNightForageBonus: 0.12,
    /** Multiplier on frostbite exposure odds while carrying warmth. */
    warmthFrostbiteMultiplier: 0.5,
    /** Chance a warm night (fire or warmth gear) thaws frostbite before it worsens. */
    warmFrostbiteHealChance: 0.55,
    /** Zone shelterQuality at which the ground itself (caves, deep timber) counts as warmth. */
    shelterWarmHealQuality: 0.5,
    /** Hunting near water with a fishing tool: added small-game odds. */
    fishingHuntBonus: 0.15,
} as const;

/**
 * §6.8: side bets — settled from the run itself rather than from who wins.
 * Multipliers are fixed at placement; `cashOutMargin` is the book's cut on
 * settling a victory wager early at its current implied value.
 */
export const SIDE_BETS = {
    firstBloodMult: 8,
    noVictorMult: 30,
    careerVictorMult: 2.2,
    /** Fraction of fair implied value paid on an early cash-out. */
    cashOutMargin: 0.8,
} as const;

export const GAMEMAKER_COSTS = {
    burn: 150,
    flood: 150,
    fog: 120,
    sever: 100,
    drop: 200,
    bounty: 300,
} as const;


/**
 * A2: the numbers behind the archetype behavioural hooks.
 *
 * Kept in one group rather than scattered through `archetypeHooks.ts`, because
 * the whole point of the hook model is that an archetype's identity is data —
 * putting its magnitudes back into the engine would have given the new roster
 * the same undeclared-knob problem the stance table just got out of.
 */
export const ARCHETYPE_HOOKS = {
    // ---- riskCurve ----
    /** `escalating`: warier every day, up to a ceiling. */
    escalatingPerDay: 0.03,
    escalatingCap: 0.25,
    /** `front-loaded`: spends it all at the gong and settles afterwards. */
    frontLoadedPerDay: 0.05,
    frontLoadedCap: 0.3,

    // ---- targetPreference ----
    /** Scale on the preference term, against the shared opportunism score. */
    targetPreferenceWeight: 0.5,
    strongestPerTrainingPoint: 4,
    nearestPerHop: 12,
    richestPerValue: 1.2,

    // ---- signatures ----
    /** Per-cycle chance the beat lands, once its conditions hold. */
    signatureChancePerCycle: 0.25,
    /** How long a signature-set objective is held for. */
    signatureObjectiveCycles: 6,
    signatureExcitement: 25,
    signatureTrust: 8,
    /** Career: the pack names somebody, out loud. */
    declarationFear: 8,
    /** Trickster: the snare nobody watched them build. */
    snareFear: 6,
    /** Wildcard: the turn, and what it costs them. */
    wildcardMomentum: 3,
    wildcardSanity: 8,
    /** Underdog: the moment they stop apologising for being here. */
    refusalResolve: 25,
    /** Survivalist: the larder nobody noticed. */
    larderRelief: 40,
    /** Protector: standing in front of somebody. */
    standRegard: 30,
    standBond: 15,
    /** Mercenary: the contract, and how long it buys. */
    contractTruceCycles: 8,
    /** Zealot: the sermon. */
    sermonFear: 7,
    sermonSanity: 6,
    /** Medic: triage in the open. */
    triageHealth: 45,
    triageHeal: 25,
    triageBond: 20,
    /** Saboteur: one arena-scale act of vandalism. */
    sabotageTraps: 3,
    /** Beast: the sound. */
    roarFear: 12,
    roarSanity: 9,
    /** Diplomat: an agreement between two people who are not them. */
    brokeredTruceCycles: 10,
    accordGratitude: 18,
    /** Ghost: sponsor credit for going unfilmed, and the crowd's answer to it. */
    ghostTrustPerCycle: 0.4,
    ghostTrustCap: 2.5,
    ghostExcitementDrain: 3,
    /** Ghost: named personally, at the field size where it stings. */
    ghostNamingField: 8,
    namingFear: 5,
} as const;


/**
 * §1.5: the hand-authored arena signatures' own numbers.
 *
 * `arenaSignature.ts` was the single worst offender in the undeclared-knob
 * baseline — 21 sites, more than any other file — and it is one of the two
 * files A1/A2 expanded most, so leaving it undeclared would have doubled the
 * drift alongside the new work. Each signature is a named arena mechanic, so
 * the knobs are grouped by the arena rather than by what they do to a vital:
 * tuning "the tide" means editing one block.
 */
export const ARENA_SIGNATURES = {
    /** The Clockwork Island: the hour turns and one sector pays for it. */
    clock: {
        dodgeBase: 0.25,
        dodgePerAgility: 0.04,
    },
    /** The Vault: every light fails at once, on a schedule. */
    vault: {
        stumbleChance: 0.3,
        stumbleSanity: 8,
    },
    /** The Drowned Islands: the tide comes up over a sector in the dark. */
    tide: {
        /** Chance the tide takes the busiest sector rather than a random one. */
        busiestChance: 0.6,
        swimBase: 0.3,
        swimPerStrength: 0.05,
        swimFatigue: 15,
        caughtFatigue: 25,
    },
    /** The Solar Desert: the Gamemakers hold noon in place. */
    stalledSun: {
        thirst: 22,
        fatigue: 12,
        burnChance: 0.25,
    },
    /** The Frozen Wasteland: the cold snap. */
    freeze: {
        fatigue: 18,
        frostbiteChance: 0.3,
    },
    /** The Concrete Jungle: something enormous comes down. */
    collapse: {
        dodgeBase: 0.35,
        dodgePerAgility: 0.04,
    },
    /** The Toxic Bog: the swamp exhales. */
    bog: {
        /** Chance the bog exhales at all this cycle. */
        fireChance: 0.5,
        sanity: 22,
    },
    /** The Ashfall Basin: the fall thickens. */
    ashfall: {
        filteredFatigue: 4,
        unfilteredFatigue: 12,
        thirst: 8,
        chokeChance: 0.2,
    },
    /** The Salt Flats: nowhere at all to stand out of the light. */
    saltFlats: {
        thirst: 10,
        glareChance: 0.2,
        glareSanity: 6,
    },
    /** The Spore Fields: the bloom, and the gamble it is. */
    bloom: {
        /** Chance the bloom happens at all this cycle. */
        fireChance: 0.55,
        /** Chance a tribute standing in it eats. */
        eatChance: 0.7,
        safeBase: 0.4,
        safePerIntelligence: 0.06,
        poisonSanity: 18,
    },
} as const;
