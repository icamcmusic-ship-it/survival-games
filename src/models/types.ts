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
    | 'The Wildcard'
    // §(requests 16): five more.
    | 'The Survivor'
    | 'The Professional'
    | 'The Homesick'
    | 'The Volunteer'
    | 'The Provocateur';
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
    | 'Shadowing'
    /*
     * AUDIT-7 §12.6. The roster's three unconditional stances hold 80% of all
     * stance-time and the seven conditional ones share the rest, so an eleventh
     * lands at about 1.5% unless it takes share from somewhere specific. These
     * two are chosen for that: `Tending` takes from Nursing and Evasive (the
     * case of somebody working on *themselves*, which Nursing could never
     * express because it needs a patient who is not you), and `Baiting` takes
     * from Hunting — and is the first stance that makes fieldcraft's 72.7%
     * untriggered traps into a plan rather than a bet.
     */
    | 'Tending'
    | 'Baiting'
    // Audit 5 §12: two more conditional stances — tending an ally, and walking a pack's perimeter.
    | 'Nursing'
    | 'Patrolling';

export type ArchetypeId =
    | 'career' | 'strategist' | 'survivalist' | 'protector' | 'trickster' | 'wildcard' | 'underdog'
    // A2: eight archetypes with behavioural hooks rather than four more bias
    // scalars. See `data/archetypes.ts`.
    | 'mercenary' | 'zealot' | 'medic' | 'saboteur' | 'beast' | 'diplomat' | 'scholar' | 'ghost'
    // Audit 5 §12.4: four more, each holding a stance/objective/target
    // combination no existing archetype does.
    | 'scavenger' | 'captor' | 'bellwether' | 'confessor'
    /*
     * §(requests 3): four more, on the same rule as the last batch — each has
     * to hold a combination of stance bias, objective bias and target
     * preference that nothing already in the table holds.
     */
    | 'quartermaster' | 'martyr' | 'opportunist' | 'tracker'
    /*
     * AUDIT-6 §12.5: six more, on the same rule the last two batches were held
     * to — each has to hold a stance/objective/target combination nothing in
     * the table already holds. Three of them exist because the `wait`
     * objective and the `Patrolling` and `Nursing` stances were reachable by
     * the engine and by nobody's character: `wait` was the top objective bias
     * of zero of twenty-three archetypes, so the one intention in the game
     * that wants nobody else to arrive was something tributes did only by
     * accident.
     */
    | 'warden' | 'herald' | 'penitent' | 'forager' | 'duellist' | 'broker'
    /*
     * AUDIT-7 §12.5: six more, on the rule the last three batches were held to
     * — each holds a stance/objective/target combination nothing already in the
     * table holds — plus one this pass added: **every signature must be
     * reachable by a soloist.** Three of the four lowest-firing set pieces in
     * the roster were alliance-gated (§8.2), so an archetype whose beat needs
     * somebody else standing in the zone is an archetype most players never see
     * do its thing.
     */
    | 'cartographer' | 'debtor' | 'forecaster' | 'understudy' | 'archivist' | 'quiet';

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

/**
 * Audit 4 §1.1: the name half of the chokepoint test, shared.
 *
 * `zoneFeatures()` in `engine/map.ts` is the authority on a zone's interior,
 * but the procedural arena generator has to know whether an edge's endpoint
 * will read as a chokepoint *while it is rolling edge rules* — a `contested`
 * edge with no chokepoint endpoint is inert, because `tickGarrisons` will not
 * look at it. The generator cannot import `map.ts` (it would drag the whole
 * simulation engine onto the setup screen's cold-start path; see the PERF note
 * in `SetupScreen`), so the one predicate they both need lives here, where
 * neither has to duplicate it and it cannot drift.
 *
 * This is deliberately only the *name* half. `zoneFeatures` also derives a
 * chokepoint from a name hash for unnamed cases; that half is an implementation
 * detail of the derivation and is not something the generator should key off.
 */
export function chokepointByName(zoneName: string): boolean {
    return /pass|bridge|ravine|tunnel|gate|causeway|canal|strait|corridor/i.test(zoneName);
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
 *
 * §3.1: six skills was the binding constraint on the whole system. Fifty-two
 * items, forty arenas and eight stances all resolved through six buckets, and
 * two of the things a tribute most obviously gets better at — going up
 * something, crossing water — were expressed *only* as reaping traits
 * (`Climber`, `Swimmer`). The same concept in two systems that could not talk
 * to each other, so a Swimmer never got better at swimming. `climbing`,
 * `swimming` and `crafting` close that: the traits now seed the matching
 * proficiency (see `TRAIT_PROFICIENCY_FLOOR` in engine/proficiency) instead of
 * standing in for it.
 *
 * There is deliberately no `stealth` proficiency. Stealth is already a rolled
 * attribute that `tracking` drifts upward; adding a same-named skill on top
 * would be exactly the doubling this pass exists to remove.
 */
export type Proficiency = 'forage' | 'melee' | 'ranged' | 'medicine' | 'tracking' | 'persuasion'
    | 'climbing' | 'swimming' | 'crafting'
    /*
     * §(requests, deferred from Audit 5 §12.2): the two the engine had the
     * occasions for and no skill behind.
     *
     * `stealth` is an attribute and a whole subsystem — concealment, ambush,
     * unseen streaks — with nothing that improved by doing it, so a tribute
     * who had hidden successfully twenty times was no better at hiding than on
     * day one. `intimidation` is the same story from the other end: fear is
     * modelled per-target, `Feared` is the second-best earned trait, and
     * nothing got better at frightening people.
     */
    | 'stealth' | 'intimidation'
    /*
     * AUDIT-6 §12.4: four more, each splitting an axis that was doing two jobs
     * or naming a competence the engine had occasions for and no skill behind.
     *
     *  - `butchery` — field-dressing a corpse for food. `Butcher`, `Vulture`
     *    and the `salvage` law all describe it and nothing improved at it.
     *  - `navigation` — crossing ground efficiently, and finding the ways
     *    nobody has found. `hidden` edges were discovered on a flat roll, so a
     *    tribute who had spent a week reading the map was no better at it than
     *    one who arrived yesterday.
     *  - `carpentry` — splits from `crafting`: shelters and traps. `crafting`
     *    keeps repair, so the tribute who can fix a blade and the tribute who
     *    can build a deadfall stop being the same person by definition.
     *  - `oratory` — splits from `persuasion`: addressing a *group*.
     *    `persuasion` is one-to-one, and the bloc treaty — the one mechanic
     *    where a single tribute's word binds people who are not present — was
     *    reading the one-to-one skill.
     */
    | 'butchery' | 'navigation' | 'carpentry' | 'oratory'
    /*
     * AUDIT-7 §12.4: four more, each taking over a gate that reads a raw
     * attribute or borrows a proficiency from a different skill. All four read
     * sites were checked before the axis was added, which is the rule the
     * batch above set and this one keeps:
     *
     *  - `signalling` — laying and reading marks, whistles and false trails.
     *    `intent.ts`'s false-trail gate reads raw `intelligence` plus
     *    `tracking` doing borrowed duty.
     *  - `fieldcookery` — turning found food into food that does not turn.
     *    The poison-contraction roll in `exposure.ts` reads a terrain profile
     *    and a trait mod and **no proficiency at all**.
     *  - `pacing` — how far somebody goes before the fatigue curve bites.
     *    `map.ts:travelCost` reads terrain, injury grade, trait mods and
     *    physique, and **no proficiency at all**.
     *  - `readingPeople` — telling a bluff from a threat. `parley.ts`'s
     *    see-through-it roll reads raw `attributes.intelligence`, with
     *    `tracking` standing in again — which is why tracking shows up in
     *    seeing through a bluff.
     */
    | 'signalling' | 'fieldcookery' | 'pacing' | 'readingPeople';

/** Why a tribute is walking somewhere. Drives the chronicle copy as well as the route. */
export type ObjectiveReason = 'water' | 'shelter' | 'feast' | 'ally' | 'forage'
    /** Workstream A §11: the final-four reposition toward the horn or high ground. */
    | 'endgame';

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

/**
 * §3.2 (audit): what happened the last few times they tried this kind of
 * thing. Read by the objective cascade as a per-kind confidence.
 */
export interface ObjectiveOutcome {
    tries: number;
    wins: number;
    /** Consecutive failures, cleared by a win. */
    streak: number;
    /** For hunts and stalks: the target the streak is against. */
    lastTargetId?: string;
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
     * §11.6: kills this specific weapon instance has taken. Every weapon
     * generates as a category instance — a sword is a sword — so nothing about
     * an object ever accumulated. Blood does.
     */
    bloodDrawn?: number;
    /**
     * §11.6: the name this weapon earned by drawing blood more than once.
     * Never rolled at the Cornucopia or by a sponsor; only ever earned in
     * somebody's hand, which is what makes it a different kind of noun from
     * everything in `ITEMS`.
     */
    legendName?: string;
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
    /**
     * AUDIT-6 §6.5: a purifier that is not used up.
     *
     * Every `purifies` item was consumed on use, because tablets were the
     * first one written and `consumeOne` was the only path. A charcoal filter
     * and a solar still are apparatus, not doses: the whole reason to carry
     * the heavier thing is that it is still there tomorrow. Read once, at the
     * foul-water drink in `survival.ts`.
     */
    reusable?: boolean;
    /** Turns the night from a handicap into ordinary ground. */
    light?: boolean;
    /** Sleeping warm: the famous parachute. Improves overnight recovery. */
    warmth?: boolean;
    /** Lets a tribute fish still water rather than forage the bank. */
    fishing?: boolean;
}

/**
 * §3.1: the legacy single-axis body.
 *
 * Retained as a *derived* display alias (`bodyLabel` computes it from the two
 * real axes below) so old saves, the roster's public record and the disclosure
 * rules keep working unchanged.
 */
/**
 * §6 (requests): the legacy one-axis build ladder, widened.
 *
 * Six rungs could not name the bodies the two-axis model already produced — a
 * long, light frame and a short, dense one both collapsed onto 'Slight', and
 * everything past 'Muscular' had nowhere to go. Eleven rungs cover the widened
 * 7x7 frame/condition grid without changing what any of them mean: the ladder
 * is still ordered, still derived, and every old value still exists, so saves
 * written before this keep reading.
 */
export type Build =
    | 'Skeletal' | 'Frail' | 'Slight' | 'Wiry' | 'Lean' | 'Average'
    | 'Athletic' | 'Stocky' | 'Burly' | 'Muscular' | 'Hulking';

/**
 * §3.1: bodies, on two axes instead of one.
 *
 * `massOf()` returned a signed scalar from a six-entry table and `reachBonus()`
 * read height. That was the entire physical model: six builds on a single axis,
 * rolled as a blend of a random frame and strength/2.
 *
 * Frame is skeleton. It is fixed at the reaping, correlates with height, and
 * decides reach, carry capacity, how hard you are to move, and how dangerous
 * you look from across a zone. Condition is soft tissue. It is *mutable*, it
 * degrades as the run goes on, and it decides insulation, starvation buffer,
 * injury absorption — against agility, heat tolerance and water requirement.
 *
 * The two pull in different directions, which is what makes the 5x5 grid worth
 * having: Narrow/Lean is a whippet, Broad/Padded is a solid well-fed frame, and
 * Heavy/Wasted is a big frame gone hollow — still intimidating, no longer able
 * to back it up. A tribute who has been starving for six days walks Padded ->
 * Lean -> Wasted and loses their cold resistance and their starvation buffer at
 * exactly the moment they need both, while their reach is unchanged.
 */
/**
 * §6 (requests): two more rungs on each axis.
 *
 * 'Slender' below 'Narrow' and 'Massive' above 'Heavy' give the frame scale the
 * extremes a twelve-year-old from District 11 and an eighteen-year-old from
 * District 2 actually occupy; 'Skeletal' and 'Hulking' do the same for soft
 * tissue. Forty-nine combinations rather than twenty-five, and the middle of
 * both scales is unchanged, so nothing that reads `frameStep`/`conditionStep`
 * shifts under an existing save.
 */
export type Frame = 'Slender' | 'Narrow' | 'Spare' | 'Even' | 'Broad' | 'Heavy' | 'Massive';
export type Condition = 'Skeletal' | 'Wasted' | 'Lean' | 'Conditioned' | 'Padded' | 'Bulky' | 'Hulking';

/**
 * §3.1: limb length relative to height, independent of it. Long-limbed buys
 * reach and costs you every chokepoint and burrow in the arena; compact is the
 * opposite trade, and the better climber.
 */
export type LimbRatio = 'long' | 'even' | 'compact';

/** §3.1: which hand. Makes `favouring` and arm scars asymmetric. */
export type Handedness = 'left' | 'right';

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
    /**
     * §9.7: this impression was told to them rather than seen. Hearsay is
     * exactly as usable as first-hand knowledge right up until it turns out to
     * have been a lie, which is the entire reason information is worth
     * trading — and worth poisoning.
     */
    hearsay?: boolean;
    /** §9.7: who told them, so a lie has an author to be furious with. */
    toldById?: string;
}

/**
 * Long-term social memory. `relationships` holds the raw number; this holds the
 * reasons, which is what betrayal, grief and vengeance actually key off.
 */
export interface TributeMemory {
    /** Zone name -> impression. */
    zones: Record<string, ZoneMemory>;
    /**
     * §3.2: searches of a zone that turned up nothing. `barren` is a modifier
     * on the next roll; this is what makes repeated failure a *decision* —
     * leave, or stop foraging and start trapping.
     */
    forageFailures?: Record<string, number>;
    /**
     * §4.3: what this tribute believes about *other people's* bonds, keyed
     * 'aId|bId' in both orders. Only the two participants in a scene used to
     * update anything, so nobody in the arena could ever learn the single most
     * useful thing available by looking: who would come for whom.
     */
    perceivedBonds?: Record<string, number>;
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
    /**
     * §3.5: what this tribute has *heard* about each other tribute, 0-100.
     *
     * Distinct from `fear`, which is what they have seen. Notoriety is built
     * from the nightly sky, from cannons in the next zone, and from talk at
     * every peaceable meeting — so the field's biggest killer becomes a name
     * to somebody who has never laid eyes on them. It is belief, not fact: it
     * can settle on the wrong person, and meeting them is what corrects it.
     * See `engine/notoriety.ts`.
     */
    notoriety?: Record<string, number>;
    /** §4.7: ids of the rumours this tribute currently believes. */
    heardRumours?: string[];
    /**
     * §4.7: who told them each one. Not who *started* it — that is the whole
     * distinction between a rumour and a lie, and it is why finding out a
     * claim was false costs the person who repeated it rather than the person
     * who invented it.
     */
    rumourSource?: Record<string, string>;
}

/** Where a tribute's most recent wound actually came from. */
/**
 * AUDIT-9 (audit §"robustness"): what killed somebody, as a code rather than a
 * sentence.
 *
 * The audit asked for "structured event types and cause codes, then render
 * prose from them", because "several measurements currently depend on matching
 * English text; that makes writing changes capable of breaking telemetry".
 * Measured: the engine produces 373 distinct cause-of-death strings across 200
 * runs, and six files each grep them with their own regexes.
 *
 * This is the closed set those readers use instead. See `engine/causes.ts` for
 * how a death gets one and `scripts/check-cause-codes.ts` for the guard that
 * keeps the taxonomy complete as the prose changes.
 */
export type DeathCauseCode =
    // Another tribute, by any route the combat layer owns.
    | 'tribute'
    // The body giving out, in roughly the order the injury layer escalates.
    | 'bleeding' | 'infection' | 'sepsis' | 'poison' | 'shock'
    | 'dehydration' | 'starvation' | 'exhaustion'
    | 'hypothermia' | 'heatstroke' | 'burns' | 'asphyxiation' | 'exposure'
    /** A status effect the prose did not name more precisely. */
    | 'status'
    // Chosen endings. Distinct from the physiology that would otherwise claim
    // them, because who decided is the whole point of the beat.
    | 'nightlock' | 'self-inflicted'
    // The arena itself.
    | 'drowning' | 'fall' | 'collapse' | 'border' | 'trap' | 'machinery' | 'hazard'
    // The things the Capitol put in it.
    | 'mutt' | 'gamemaker'
    /** Nothing claimed it. `check-cause-codes` fails the build on this. */
    | 'unknown';

export interface DamageRecord {
    /** Human-readable cause, used verbatim as cause of death. */
    cause: string;
    /**
     * AUDIT-9: the structured counterpart to `cause`, set at the damage site.
     *
     * Optional because the taxonomy was introduced across a hundred-odd
     * existing sites: where it is absent `classifyCause` derives one from the
     * prose, in one place rather than in every reader. A site that sets it
     * explicitly is not guessed at, which is the direction this moves in.
     */
    code?: DeathCauseCode;
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
    /** §3.1: derived display alias for `frame` + `condition`. */
    build: Build;
    /** §3.1: skeleton. Fixed at the reaping. */
    frame: Frame;
    /** §3.1: soft tissue. Degrades under starvation, rebuilds when fed. */
    condition: Condition;
    limbRatio: LimbRatio;
    handedness: Handedness;
    /**
     * §3.1: cycles spent on the wrong side of the starvation line, and the
     * driver of condition loss. Rebuilding runs the other way on a full belly,
     * which is why this is signed rather than a counter.
     */
    conditionPressure?: number;
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
    /**
     * AUDIT-9 stage C §3: hours left in this cycle. See `engine/actionBudget`.
     *
     * Undefined before the first cycle and on states saved before budgets
     * existed; `hoursLeft()` treats that as a full day rather than an empty
     * one, so an old save resumes with everybody able to act.
     */
    hoursLeft?: number;
    /** The allowance this cycle granted, so spending can be reported. */
    hoursToday?: number;
    /**
     * Work carried across cycles: a half-set trap, a half-built shelter.
     * One at a time — starting something else abandons it.
     */
    partialWork?: { kind: string; hoursDone: number };

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
    /**
     * §9 (audit): victor legacy. Set when this district's mentor is a victor
     * the player crowned in an earlier Games rather than a name from the
     * district's own table. A mentor who has actually come out of the arena
     * is worth more than a pedigree, so `mentorGenerosity` and `MENTOR_PULL`
     * both read it — the carry-over is mechanical, not only a name change.
     */
    mentorIsVictor?: boolean;
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
     * §4.3: *why* each standing truce exists.
     *
     * A truce that expires on a cycle counter is a truce that overwhelmingly
     * just lapses — 90% of the 218 truces in a 400-run soak evaporated without
     * resolving into anything, which makes keeping your word a lottery ticket
     * rather than a choice. A truce made because you were both bleeding should
     * come due when you both stop bleeding; one made against a common threat
     * should come due when the threat does. `resolveTruces` reads this.
     */
    truceReason?: Record<string, TruceReason>;
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
     * chronicle; `maxPerformingStreak` feeds 'The Long Con' and the live
     * streak feeds 'Performed to the End'.
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
    /**
     * §4.4: things lent, not things owed.
     *
     * `debts` is created by `stoodBy` — somebody took a real risk for you —
     * and it is priced accordingly: it resists betrayal hard and it is one of
     * the heaviest relationships in the model. That left nothing at all below
     * it. A tribute who lent an ally their spare knife on Tuesday and has not
     * got it back has a real, small, specific grievance, and alliance
     * economics had no way to express it.
     *
     * Keyed by lender id. Settled by giving the thing back; it sours into
     * ordinary resentment, and eventually into theft, if it is not.
     */
    loans?: Record<string, { itemId: string; itemName: string; sinceCycle: number }>;
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
     * Audit 3 §8.2: who opened the wound that is currently bleeding.
     *
     * Bleeding out was 6.1% of all deaths and every one was recorded as a
     * sourceless `status` wound, so a tribute who cut somebody open and walked
     * away had killed nobody as far as the simulation was concerned. That is
     * the same accounting gap that made the Saboteur the worst archetype in the
     * game, and it feeds the one design goal the metrics sweep has never met.
     *
     * Set by `openWound` where a tribute caused it, cleared by `clearBleeding`,
     * read by the bleed-out death in `survival.ts`.
     */
    bleedOpenedById?: string;
    /** The severity that claim was staked at, so a deeper cut supersedes it. */
    bleedOpenedSeverity?: number;
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
    /**
     * §3.2: hands-on familiarity with each specific weapon, keyed by item id.
     *
     * `proficiencies` tracks melee and ranged as two buckets, so a tribute who
     * had spent six days with a spear read as exactly as dangerous the moment
     * they picked up a sword. This is the finer grain underneath: it accrues
     * on use, decays on nothing, and makes swapping kit a real cost rather
     * than a free re-skin of the same numbers.
     */
    weaponFamiliarity?: Record<string, number>;
    /** Skills that improve with successful use. See `Proficiency`. */
    proficiencies?: Partial<Record<Proficiency, number>>;
    /** What they are currently trying to do. See `Objective`. */
    objective?: Objective;
    /** §3.4: what they nearly did instead, and how close it was. */
    /** §3.2 (audit): per-kind outcome ledger. See `engine/objectives.ts`. */
    objectiveOutcomes?: Partial<Record<Objective['kind'], ObjectiveOutcome>>;
    objectiveTension?: ObjectiveTension;
    /**
     * §3.2: the goal this tribute is working toward, behind whatever errand
     * they are running first. Depth two — anything deeper is a planner rather
     * than a person, and an arena is not a place three-step plans survive.
     */
    objectiveQueue?: Objective[];
    /** §3.2: consecutive cycles torn the same way. Long enough, and they snap. */
    tensionStreak?: number;
    /** §3.4: sleep owed, as distinct from being tired right now. */
    sleepDebt?: number;
    /**
     * §3.6: sites that will never fully come back. Written when a grade-3
     * injury heals; read by `visiblePower` (a tribute who favours an arm is
     * read as weaker) and by the epilogue.
     */
    scars?: Partial<Record<InjurySite, boolean>>;
    /** Audit 5 §12.3: earned-trait counters. */
    betrayalsWitnessed?: number;
    frostbitesTaken?: number;
    /**
     * §11: separate standing injuries this tribute has ever taken, counted at
     * the moment a sound site stops being sound. `injuries` is the live state;
     * this is the history, which is what 'Clean Getaway' is actually about.
     */
    woundsLogged?: number;
    /**
     * §3.6: the observable consequence of a bad leg or arm — a limp, a guarded
     * shoulder. Set alongside the severity grade, cleared when the site heals
     * below grade 2, and visible to anyone who can see them.
     */
    /**
     * §1.7: how much this tribute has been flip-flopping lately. Rises on
     * every stance change and decays each cycle; the switch margin scales with
     * it, so a tribute who has already changed their mind twice needs a much
     * bigger reason to do it a third time. This is the piece the score-only
     * hysteresis was missing — it had no memory of its own churn.
     */
    stanceChurn?: number;
    /**
     * §3.1: infection, per wound site, graded 1-3.
     *
     * Distinct from `injuries.infected`, which is the whole-body flag every
     * other system reads and which can also be set from outside (a scavenger
     * mutt, a contaminated zone). This is the record of *which* neglected
     * wound turned and how far it has gone — the state that lets an untreated
     * grade-2 cut become the thing that kills someone on day nine, rather than
     * sitting inertly at grade 2 forever. See `engine/infection.ts`.
     */
    woundInfection?: Partial<Record<InjurySite, number>>;
    /**
     * AUDIT-7 §11.4: the high-water mark of any infection this tribute has
     * carried, kept after the site clears. `woundInfection` is pruned the
     * moment a wound closes, so nothing downstream could tell a tribute who
     * shrugged off a graze from one who came back from grade 3.
     */
    worstInfectionGrade?: number;
    /**
     * §3.1: cycles each open site has gone without closing or being dressed.
     * The incubation clock — an infection that landed with the blow would just
     * be a second damage type, so a wound has to be *neglected* first.
     */
    woundAge?: Partial<Record<InjurySite, number>>;
    favouring?: InjurySite;
    /**
     * §3.1: which arm took it. `injuries.arms` is one site, so handedness had
     * nothing to bite on; recording the side makes a ruined weapon hand a
     * genuinely different injury from a ruined shield side.
     */
    woundedSide?: Handedness;
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
    /**
     * §3.7: people this tribute was in an alliance with that ended *without*
     * anybody being betrayed — a pact clause running out, a Career pack simply
     * coming apart. Ordinary bond decay walks a dissolved alliance back to
     * stranger's odds in a few cycles, which is the wrong ending for it: they
     * carried each other's water for six days. An ex-ally pair decays slower
     * and floors above zero, so they are never quite strangers again.
     *
     * Deliberately not written by the betrayal or expulsion paths. Those have
     * their own, much colder, machinery.
     */
    formerAllies?: string[];
    /**
     * §4: cycles spent in the same group as each former ally. `formerAllies`
     * was a flat set, so six days of sharing a camp and a fire read exactly
     * like one cycle of standing next to each other before it fell apart.
     * Re-forming reads this; a betrayal on the record cancels it.
     */
    sharedHistory?: Record<string, number>;
    protectorBonds?: string[];
    /**
     * How far their launch plate landed from the mouth of the Cornucopia, 0-1.
     * 0 is close enough to touch the horn; 1 is the far edge of the ring.
     * Decided at the reaping so it can be shown on the tribute sheet, and read
     * only by the bloodbath.
     *
     * §1.5: it is not cosmetic, and the four rolls it feeds pull against each
     * other on purpose. A close plate raises the odds of running *at* the horn
     * (`fightChance`), wins the race to the good steel (`reachScore`), and is
     * the reason a runner gets caught from behind (`runDownChance`); it also
     * decides who spent the sixty seconds on the plates staring at whom
     * (`plateNeighbourRange`). Measured over 300 runs, the close third dies in
     * the bloodbath 39.4% of the time against the far third's 29.4%, and comes
     * out armed 40.4% against 11.6% — that is the trade, not a wash: the horn
     * arms you and the horn is where the dying happens.
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
     * §11: set the first time a scarred tribute climbs back out of the `gone`
     * band. `sanityScarred` records that they went down there; this records
     * that they came back, which is the half 'Second Wind' is named for.
     */
    sanityRecovered?: boolean;
    /**
     * §4.1: professional esteem, per tribute id (0-100 scale deltas around 0).
     * Distinct from `relationships` (regard): you can rate someone as a
     * fighter and still never sleep unguarded near them. Written by witnessed
     * kills and the training reveal; read by recruitment and truce restraint.
     */
    respects?: Record<string, number>;
    /**
     * §4.2 (audit): the third stored axis — trust *history*. `trustOf` is
     * still derived from regard and the memory ledger, which is what keeps
     * every old save readable; this is the part of trust that has its own
     * momentum. A kept promise adds to it, a broken one takes from it, and it
     * heals toward zero at its own rate — so "I don't like you any more but
     * I've come to trust you" and "trust that was broken and is mending" are
     * both states the engine can hold. Added the way `respects` was: an
     * optional record, absent on every save written before it existed.
     */
    trusts?: Record<string, number>;
    /**
     * §4.4/§6.3: the angle they took with Caesar. A showmance is a strategy
     * chosen before the arena; so is publicly inviting allies, so is naming
     * the person you intend to kill in front of the whole country.
     */
    interviewAngle?: 'showmance' | 'defiance' | 'grief' | 'alliance-signal' | 'target-callout';
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
    /**
     * §10.5: this tribute is an archived victor reaped again — the arena they
     * won, for the reaping copy and the chronicle. Set only by a Grudge Match.
     */
    veteranOf?: string;
    /**
     * §11.5: an epithet earned in the arena, distinct from the birth name
     * rolled at the reaping. Awarded once and never replaced — the first thing
     * a tribute becomes known for is the thing they stay known for.
     */
    epithet?: string;
    /** Cycle the epithet was awarded, for the chronicle and the epilogue. */
    epithetCycle?: number;
    /** §10.1: the longest performing streak this tribute ever held, for 'The Long Con'. */
    maxPerformingStreak?: number;
    /** §10.1: tribute ids this one has extorted at a parley (item or information). */
    extortedIds?: string[];
    /** §12: tribute ids who have extorted *them*. The other side of the ledger. */
    extortedByIds?: string[];

    // ---- §12: state the new achievements read ----
    /**
     * §12: fights this tribute opened. Not fights they were in — fights they
     * started, against somebody who had not attacked them first. 'Quiet Storm'
     * is about a victor who never threw the first strike all run, which is a
     * different claim from a low kill count.
     */
    fightsOpened?: number;
    /** §12: times they dropped below the near-death line and came back off it. */
    lowHealthRecoveries?: number;
    /** §12: weather fronts this tribute stood in and walked out of. */
    stormsSurvived?: number;
    /** §12: they took over an alliance whose original leader had died. */
    tookOverAllianceLead?: boolean;
    /** §12: zone effects started by something this tribute personally did. */
    zoneEffectsCaused?: number;
    /** §12: times they knowingly walked into a zone under an active effect. */
    walkedIntoEffect?: number;
    /** §12: how many traits they were reaped with, so shedding one is visible. */
    startingTraitCount?: number;
    /** §12: the lowest their resolve has ever been, for the recovery achievements. */
    minResolve?: number;
    /**
     * §12: they have shared a zone with another living tribute at some point
     * after the bloodbath ended. 'The Unwitnessed' is the run where this stays
     * false — a victor nobody ever stood next to.
     */
    metAnybodyAfterBloodbath?: boolean;
    /** §10.1: set the first time a weapon enters their inventory, ever. */
    /**
     * §3.4: betrayals this tribute has *committed* against someone who trusted
     * them. `memory.timesBetrayed` counts the other direction. Read by the
     * Loyal -> Treacherous arc, which needs to know what they have done rather
     * than what was done to them.
     */
    betrayalsCommitted?: number;
    /**
     * §3.4: killing blows landed on someone who was already finished. Read by
     * the Merciful -> Ruthless arc — it is not the body count that wears
     * mercy off, it is how many times they chose to close it.
     */
    finishingBlows?: number;
    everCarriedWeapon?: boolean;
    /** §10.1: every zone this tribute has personally stood in. */
    visitedZones?: string[];
    /** §10.1: kills credited to this tribute's own traps. */
    trapKills?: number;
    /** Mutt encounters walked away from. Hardened is earned on the second. */
    muttsSurvived?: number;
    /** §11: cycles spent holding a named alliance role, for 'Quartermaster'. */
    roleCycles?: number;
    /** §11: took over an alliance as its named heir. */
    succeededAsHeir?: boolean;
    /** §11: structural collapses walked out of. */
    collapsesSurvived?: number;
    /**
     * AUDIT-9 B16: where in the run's elimination order this tribute fell.
     *
     * 1 is the first tribute out. Undefined for anyone still standing. The
     * side-bet book used to settle "among the last three standing" on
     * day-of-death ties, so seven tributes who died on the same day plus one
     * survivor all settled as top three — eight winners on a three-place
     * market. Deaths inside a cycle are ordered by the sequence the engine
     * resolved them in, which is deterministic for a seed; "simultaneous" is
     * not a state the simulation actually has.
     */
    eliminationIndex?: number;
    /**
     * AUDIT-9: what killed them, as a code.
     *
     * `causeOfDeath` stays exactly as it was — it is the obituary, and it is
     * what a reader reads. This is what the *measurements* read, so rewording
     * an obituary stops being able to break a metric, an achievement or an
     * invariant. Written at `killTribute`, the one funnel every death goes
     * through. See `engine/causes.ts`.
     */
    causeCode?: DeathCauseCode;
    /**
     * AUDIT-9 B04: the zone this tribute was standing in at the end of last
     * cycle, so `tickAbandonedCamps` can notice a departure.
     *
     * Was a module-level `WeakMap`, which is process memory and does not
     * survive a save — a resumed run created no abandoned camp on a flee
     * transition that uninterrupted play created one for.
     */
    lastZone?: string;
    /**
     * AUDIT-9 B04: last cycle's health, zone and weather-front position, for
     * `tickRunRecords` to diff against.
     *
     * Same defect as `lastZone`, found by the sweep the audit asked for: a
     * resumed run could not see the first cycle's change, so a recovery off
     * the near-death line went uncounted and 'Hairsbreadth' and 'Unbroken'
     * became reload-dependent.
     */
    recordWatch?: { health: number; zone: string; frontZone?: string };
    /** §11: forages that turned something up. */
    forageSuccesses?: number;
    /** §11: an infection treated back down from its terminal grade. */
    terminalInfectionBeaten?: boolean;
    /** §11: vertical-zone levels ever stood on. */
    levelsStood?: ZoneLevel[];
    /**
     * §5.2 (audit): the distinct vertical zones they changed level in. Once
     * every arena authored its interiors, "stood on both levels" became true
     * of most victors; the achievement now asks for it in several places.
     */
    verticalZonesStood?: string[];
    /** Consecutive cycles at terminal-grade sepsis. Fatal at INFECTION.terminalCycles. */
    septicCycles?: number;
    /**
     * §4: every way this tribute has gone back on somebody who was counting on
     * them, beyond the alliance betrayals `betrayalsCommitted` counts: a
     * charter clause broken, a vengeance pact walked away from, a downed ally
     * left where they fell. The Loyal -> Treacherous arc reads this, because
     * the arc gated on alliance betrayals alone could effectively never fire —
     * Loyal carries `treachery: -0.3`, which makes its holder the least likely
     * tribute in the arena to commit one.
     */
    faithBroken?: number;
    /** §8.9: traps this tribute has successfully pulled apart. */
    trapsDisarmed?: number;
    /**
     * Traps this tribute has built. `trapKills` counts the ones that closed on
     * somebody; this counts the work, which is what a trapline actually is.
     */
    trapsSet?: number;
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
    /*
     * AUDIT-8 §12.3: state the six new earned traits read.
     *
     * Each is a counter the engine was in a position to keep and did not:
     * the arc was expressible and nothing was expressing it.
     */
    /** Truces this tribute kept all the way to their declared term. */
    trucesKept?: number;
    /** Consecutive nights this tribute has taken their group's watch. */
    watchStreak?: number;
    /** Cycles spent with the group they were last in, once they are its last member. */
    outlivedPackOf?: number;
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
     * §5.1: which level of a vertical zone they are standing on. Undefined
     * everywhere else, which is every zone in every arena that does not
     * declare `ZoneFeatures.vertical`.
     */
    zoneLevel?: ZoneLevel;
    /**
     * Shadowing: who they are one zone behind, and for how many consecutive
     * cycles the target has failed to notice them. Three in a row converts to
     * a free ambush — the payoff `unseenStreak` never had.
     */
    shadowing?: { targetId: string; cycles: number };
    /** A1: cycles the tribute has been dug in — read by the Fortified payoffs. */
    fortifiedCycles?: number;
    /**
     * Whether the "somewhere they own" beat has already been read for this
     * spell of digging in. Cleared alongside `fortifiedCycles` when the stance
     * is left, so a second stand earns the line again.
     */
    fortifiedBeatShown?: boolean;
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
    /**
     * §8: the Scholar's foreknowledge, banked by their signature and spent the
     * next time the arena tries to kill them. Their signature fired for 59% of
     * Scholars and converted into nothing: it moved them one zone and gave
     * them an excitement bump. Being right about the arena should be worth
     * surviving it once.
     */
    arenaForeknowledge?: boolean;
    /** A2: Mercenary — the price of their company, and who has paid it. */
    retainerPaidBy?: string[];
    /** A4: pre-arena agreements struck on the training floor. */
    trainingPact?: string[];
    /** A4: stations worked, per day, so the chronicle can narrate three days. */
    /**
     * §6.2: `witnessIds` is who else was working that rack. The log recorded
     * the station and the outcome and nothing situational, so who watched a
     * tribute excel — or watched them fail — was thrown away, and the training
     * floor could not feed the respect and regard it obviously should.
     */
    trainingLog?: Array<{
        day: number;
        station: string;
        /** The discipline the station drilled. Lets a later floor day know what has already been worked. */
        attr?: keyof Attributes;
        outcome: 'success' | 'struggle' | 'failure';
        witnessIds?: string[];
    }>;
    /** A2: Diplomat — truces this tribute brokered between two other people. */
    brokeredTruces?: Array<[string, string]>;
    /** A2: Ghost — sponsor credit accrued purely for never being seen. */
    ghostTrust?: number;
    /** §1.2: most clients this Mercenary has had alive and paid-for at once. */
    retainersHonoured?: number;
    /** §1.2: truces this Diplomat brokered that ran their full term. */
    trucesBrokeredHeld?: number;

    // ---- §9.1: the downed state and the rescue window ----
    /**
     * §9.1: at zero health and not dead yet.
     *
     * The health scale used to be binary at the bottom — alive, or dead with a
     * `causeOfDeath` — so there was no moment between the killing blow and the
     * cannon for anything to happen in. A downed tribute keeps
     * `status === 'alive'` on purpose: they are not a corpse, every existing
     * roster filter still counts them, and the systems that must treat them
     * differently ask `isDowned()` rather than reading a third status value
     * that four hundred call sites would have to learn about.
     */
    downed?: {
        /** Cycle they went down, for the feed and for grief timing. */
        sinceCycle: number;
        /** Cycles left before the wound finishes the job unaided. */
        cyclesLeft: number;
        /** What put them here — the cause recorded if nobody reaches them. */
        cause: string;
        /** Who put them here, when it was a person. */
        byId?: string;
    };
    /** §9.1: they have been down once already. Nobody gets the window twice. */
    everDowned?: boolean;
    /** §9.1: who pulled them back from it. */
    revivedBy?: string;
    /** §9.1: downed tributes this one stood over and chose to walk away from. */
    sparedDowned?: string[];
    /** §9.1: downed tributes this one finished where they lay. */
    finishedDowned?: string[];
    /** §9.1: times this tribute was the first to reach a downed ally. */
    reachedDownedFirst?: number;

    // ---- §5.5 / §9.7: what they know about the map, and who they told ----
    /**
     * §5.5: `hidden` edges this tribute has personally found or been told
     * about, by `edgeKey`. A hidden edge is impassable to everyone who does not
     * know it is there, which makes the knowledge itself the most valuable
     * thing in an arena that has one.
     */
    knownEdges?: string[];
    /** §9.7: tribute ids this one has handed honest map intelligence to. */
    sharedIntelWith?: string[];
    /** §9.7: tribute ids this one has deliberately misdirected about the map. */
    liedTo?: string[];
    /** §9.7: times this tribute's map intelligence was bought at a parley. */
    intelSold?: number;

    // ---- §6.2 / §6.3: the pre-arena phases, with teeth ----
    /**
     * §6.2: pre-arena agreements with terms, rather than a bare id list.
     * `trainingPact` above is kept in step as the flat id list every existing
     * reader already uses; this is the same agreement with its conditions
     * attached, which is what makes a day-one handshake and a day-three
     * alliance struck after watching somebody score a ten different objects.
     */
    trainingPacts?: TrainingPact[];
    /**
     * §6.2: the private session with the Gamemakers — the single most
     * memorable pre-arena scene in the source material, which existed here
     * only as the number it produced.
     */
    privateSession?: {
        /** What they chose to show them. */
        station: string;
        /** What they actually did with it. */
        stunt: string;
        /** How the room took it. */
        reaction: string;
        /** The score it produced, mirrored into `trainingScore`. */
        score: number;
    };
    /**
     * §6.2: a concealed tribute's cover has been blown — the first time they
     * fight for real, everybody who sees it revises their estimate at once.
     */
    concealRevealed?: boolean;
    /**
     * §6.3: how far the tribute's arena behaviour has fallen short of the
     * persona they sold Caesar. Accumulates while they play against type and
     * is spent as crowd backlash on sponsor trust.
     */
    personaBacklash?: number;
    /**
     * AUDIT-6 §10.4: the other half of the bet.
     *
     * `personaBacklash` accrued for playing against type and was spent, out
     * loud, in sponsor money. Living up to the persona accrued excitement and
     * nothing else — so the persona was a one-way penalty rather than a
     * wager, and the tribute who spent three minutes promising a short Games
     * and then delivered one got applause and no parachute. This accrues the
     * same way and pays out the same way.
     */
    personaCredit?: number;
    /** §6.3: the rival they named on air, for 'target-callout'. */
    interviewCalloutId?: string;
    /** §6.4: whose named feast pack they walked away with, if not their own. */
    feastPrizeTaken?: string;

    // ---- workstream A: tribute logic ----
    /**
     * A §1: what the decision layer weighed last cycle — the top scored
     * stances with their strongest reasons, the top scored destinations, and
     * the objective candidates. Last cycle only; overwritten every cycle.
     */
    decisionTrace?: DecisionTrace;
    /**
     * A §3: the standing goal. A third objective slot behind the two-deep
     * queue: a feast, a sworn hunt or the endgame reposition that survives
     * errand interruptions across cycles until it completes or is invalidated.
     */
    standingGoal?: StandingGoal;
    /**
     * A §8: shock. A one-cycle status separate from sanity, set by a
     * near-death moment (a single hit carrying them under the line, or a
     * downed recovery). Forces Evasive for the cycle it holds.
     */
    shock?: { untilCycle: number; cause: string };
    /**
     * A §10: what the arena currently makes worth keeping, recomputed each
     * cycle from the climate so `enforceCapacity` — which has no context —
     * can weigh a cloak in the cold and a canteen in the dry.
     */
    kitPriorities?: { warmth?: boolean; water?: boolean; purifier?: boolean };
}

/** A §1: one weighed reason behind a stance score. */
export interface TraceReason {
    label: string;
    weight: number;
}

/** A §1: the per-cycle decision trace. Small on purpose — last cycle only. */
export interface DecisionTrace {
    cycle: number;
    /** Top scored stance options, best first, each with its strongest reasons. */
    stances: Array<{ stance: Stance; score: number; reasons: TraceReason[] }>;
    /** Top scored destinations from the wander scorer, if it ran this cycle. */
    destinations?: Array<{ zone: string; score: number }>;
    /** The objective candidates the cascade produced, chosen first, with their tiers. */
    objectives?: Array<{ label: string; tier: number }>;
    /** Set when the stance was imposed rather than scored. */
    forced?: string;
    /**
     * §3.3 (audit): what the wander scorer actually *picked*, ranked against
     * everything it weighed, so decision quality is measurable rather than
     * inferred from win rates. `rank` is 0 for the best-scored option;
     * `percentile` is the pick's score position across all options (1 = best).
     */
    destinationPick?: { zone: string; rank: number; of: number; percentile: number };
    /**
     * §(requests): how clearly this tribute was thinking when they chose,
     * 0 (rested and lucid) to `CONFUSION.max`.
     *
     * Recorded so an odd-looking decision has a visible cause on the tribute
     * sheet — "they were on their fourth night without sleep, concussed and in
     * the dark" — rather than reading as the simulation misbehaving. See
     * `engine/confusion.ts`.
     */
    confusion?: number;
}

/** A §3: a goal held behind the errand queue. */
export interface StandingGoal {
    goal: Objective;
    /** Why it is standing: the chronicle names it when it is picked back up. */
    reason: 'feast' | 'avenge' | 'endgame';
    setCycle: number;
    /** Cycle it was last picked back up; the resume gate reads this, staleness reads `setCycle`. */
    resumedCycle?: number;
}

/**
 * §6.2: a pre-arena agreement, with the terms it was actually struck on.
 *
 * `trainingPact` was a flat string array — no terms, no confidence, no expiry
 * — so a pact sworn on day one between two frightened strangers and a pact
 * struck on day three after watching somebody score a ten were the same
 * object, and both lasted forever.
 */
export interface TrainingPact {
    /** The other party. */
    withId: string;
    /** What was actually agreed. */
    kind: 'arena-alliance' | 'non-aggression' | 'share-supplies' | 'cornucopia-rush';
    /** 0-1: how much they meant it when they shook on it. */
    confidence: number;
    /** Training day it was struck, 1-3. A later pact is a better-informed one. */
    day: number;
    /** Cycle in the Games it lapses on its own terms. */
    expiresCycle: number;
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
    /**
     * §4: how this leader runs the group. Rolled from their temperament when
     * the alliance forms and read at every hearing: a democratic leader puts
     * it to the group and mostly forgives; a tyrant decides alone and mostly
     * expels. Roles already existed; nothing said what having the leader's
     * role actually meant.
     */
    /*
     * AUDIT-6 §4.2: two values for "how is this group run" was the same shape
     * of problem as two useful roles.
     *
     * `absent` is the third, and it is the one the succession data was crying
     * out for — 6 heirs passed over and 11 groups split in 400 runs, both of
     * which are what happens when the person nominally in charge has not been
     * deciding anything. A group with an absent leader holds no hearings,
     * throws nobody out, and comes apart the first time it matters.
     */
    leaderStyle?: 'democratic' | 'tyrant' | 'absent';
    /**
     * §4: what each member's ledger read when the charter was sworn, so
     * 'no-looting-the-fallen' and 'share-intel' catch what somebody did
     * *since* they agreed not to rather than what they had already done.
     */
    lootedAtCharter?: Record<string, number>;
    intelSoldAtCharter?: Record<string, number>;
    /** Cycle each clause was last found broken, so a standing condition is one breach, not one per cycle. */
    lastBreachCycle?: Partial<Record<CharterRule, number>>;
    /**
     * A §6: the night's watch. Set at nightfall for a group sleeping in one
     * zone: who is awake, who is asleep, and the cycle it was posted, so the
     * chronicle names it once rather than every night.
     */
    watch?: { cycle: number; zone: string; watcherId: string; sleeperIds: string[] };
    /**
     * Who last took the watch, and where. Kept separately from `watch` because
     * `watch` is swept clear every cycle — which is what made the "name it once"
     * check above unsatisfiable, and the line fire every single night.
     */
    lastWatch?: { zone: string; watcherId: string };
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

/**
 * §4.3: why two people who are not friends agreed not to kill each other.
 *
 *   mutual-threat  a third party neither can take alone;
 *   both-wounded   neither can afford a fight right now;
 *   brokered       a Diplomat talked them into it and is standing there;
 *   extortion      one of them paid, and the peace lasts as long as the fee.
 */
export type TruceReason = 'mutual-threat' | 'both-wounded' | 'brokered' | 'extortion';

/** §4.4: a job inside an alliance, held by exactly one member. */
/*
 * AUDIT-6 §4.2: four roles, two of which were near-automatic.
 *
 * Measured over 3,384 alliance samples of size two or more: muscle filled 96.5%
 * of the time and medic 90.8%, against scout at 48.1% and quartermaster at
 * 46.8%. So "who are you in this group" had effectively two answers — are you
 * the scout or the quartermaster, or not — and a pack of five looked exactly
 * like a pack of four with somebody standing behind it.
 *
 * Four more, each read at exactly one site that already existed and was being
 * answered by `pickLeader` or by nobody:
 *
 *  - `face` speaks for the group in `parley.ts` and `blocTreaty.ts`. Those both
 *    used `pickLeader`, which means the person best at holding a group together
 *    was automatically also the person best at talking to a rival one — two
 *    quite different jobs collapsed into one.
 *  - `runner` carries the cache. `contributeToCache` had no owner at all, so a
 *    group's supplies belonged to everybody and therefore to nobody.
 *  - `watch` owns the night posting the soak already counts (78 per 400 runs).
 *  - `keeper` holds the group's debts, which `debts.ts` tracked per-person with
 *    nobody responsible for them.
 */
export type AllianceRole = 'quartermaster' | 'scout' | 'muscle' | 'medic'
    | 'face' | 'runner' | 'watch' | 'keeper';

/** One clause of an alliance's charter. See `engine/allianceCharter.ts`. */
export type CharterRule = 'share-food' | 'no-fighting' | 'hold-the-camp' | 'no-hunting-alone' | 'split-at-eight'
    // §4: three more, each with a breach the engine can actually detect.
    | 'no-looting-the-fallen' | 'share-intel' | 'leader-decides-targets';

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
    /**
     * A §5: how well this tribute has this person's measure, 0-1. Improves
     * with every sighting, meeting and fight; read by the threat estimate to
     * blend the visible-power guess toward the truth for known opponents.
     */
    read?: number;
    /**
     * AUDIT-9 B11: where this tribute last *saw* that person, and when.
     *
     * The decision layer used to read the rival's live `zone` — gated on
     * recent contact, which made it look like a belief and is not one. Moving
     * an unseen rival moved the observer's dread with them: 80 points of fear
     * relocated from the old zone to the new one the instant the rival walked,
     * with no observation in between. A belief has to be able to be *wrong*,
     * which means it has to be stored at the moment it was formed.
     *
     * Written by `noteContact` and `noteRivalSighting` (the two places an
     * observation actually happens) and read through `rememberedPlaceOf`,
     * which expires it on the same clock as every other sighting.
     */
    lastSeenZone?: string;
    lastSeenCycle?: number;
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
    | 'irradiated'    // permanent, and it creeps
    /**
     * §7: ground instability. Not an arena's authored collapse event — a
     * standing condition any `highland` or `ruins` zone can carry, in any
     * arena, that makes footing a running risk and eventually drops somebody
     * a level (the "Ground Give" beat). Distinct from `stripped`, which is
     * about what the zone has left; this is about whether it holds.
     */
    | 'quaking'
    /**
     * §7: a vermin/insect infestation as an environmental condition rather
     * than a mutt instance. Closer to `blooming`'s inverse than to the
     * `swarm` mutt role: nothing attacks anybody, but forage and rest are
     * both worse for as long as the zone is crawling.
     */
    | 'swarming';

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
    /**
     * §6: two kinds was one decision — do you have a line or not. A pit is
     * work that pays off in a hole nobody climbs out of quickly; a trip-wire
     * alarm hurts nobody and tells you exactly where somebody is, which is the
     * more valuable of the two for anybody hiding; a poisoned stake is what a
     * tribute with a venom gland and no intention of fighting builds.
     */
    kind: 'snare' | 'deadfall' | 'pit' | 'tripwire' | 'stake';
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
    /**
     * AUDIT-6 §6.3: whether the point was painted.
     *
     * A stake used to require a venom gland, so every stake was poisoned by
     * definition and six were built in 400 runs. A sharpened point in soft
     * ground is a stake whether or not anybody had venom to put on it; the
     * venom is what makes it a *treated* one, and only a treated one poisons.
     */
    treated?: boolean;
}

/**
 * §10: four more first-class terrains. Each has its own band in the procedural
 * generator, its own drains in the movement and survival layers, its own map
 * colour and at least one mutt that will hunt on it — `test:arenas` treats an
 * uncovered terrain as a permanently mutt-free zone rather than a quiet one.
 */
export type Terrain = 'open' | 'forest' | 'water' | 'highland' | 'ruins' | 'wetland'
    | 'cave' | 'ice' | 'desert' | 'urban';

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
 * - `parasite`: does not kill on contact — it attaches or infects, and the
 *   death (if there is one) resolves later through the ordinary vitals and
 *   medicine path. This is the mechanical hook the infection axis hangs off.
 */
export type MuttRole = 'ambusher' | 'herder' | 'scavenger' | 'siege' | 'mimic' | 'swarm' | 'parasite';

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
    /**
     * Audit 4 §1.1: these three used to be required, so a zone that wanted to
     * declare one thing about itself had to restate the other two — and the
     * procedural generator, which knows structurally which of its zones is the
     * single crossing between two halves of a bisected map, could not say so
     * without inventing a cover value. They are now optional and derived when
     * absent, exactly as `waterSource`, `shelterQuality`, `acoustics` and
     * `vertical` already are. `zoneFeatures()` in `engine/map.ts` fills them
     * in; nothing else should read `zone.features` directly.
     */
    /** 0-1: how much of the zone offers real concealment. */
    cover?: number;
    /** High ground: approaches are visible, ambushes harder. */
    elevation?: boolean;
    /** Bottlenecked ways in and out: ambushes easier, retreat harder. */
    chokepoint?: boolean;
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
    /**
     * §5.2: how far sound carries out of, and inside, this zone. 1 is
     * ordinary ground; above 1 is a canyon or a vault that throws every
     * footfall around (noise travels further, stealth is harder); below 1 is
     * deep timber, moss or snow that swallows it. Any arena may set it
     * locally rather than the effect living inside one hand-authored map.
     * Derived from terrain and cover when absent (see `zoneFeatures`).
     */
    acoustics?: number;
    /**
     * §5.1: this zone has an inside with a height to it — a shaft, a gallery
     * over a gallery, a rooftop above a street. Tributes in it stand at
     * `upper` or `lower` and two on different levels are not in the same
     * place. Absent (the default, and every existing arena) means the zone is
     * flat and nothing changes. See `engine/verticality.ts`.
     */
    vertical?: boolean;
}

/**
 * Audit 4 §1.1: what `zoneFeatures()` hands back.
 *
 * `ZoneFeatures` is what a zone may *declare* — every field optional, so a
 * zone states only what it means. This is what the engine *reads*: the same
 * shape with every field resolved, because `zoneFeatures()` derives whatever
 * the data left out. Keeping the two apart is what stops a consumer having to
 * null-check a field that is never actually absent at read time.
 */
export type ResolvedZoneFeatures = Required<Omit<ZoneFeatures, 'waterSource' | 'shelterQuality' | 'acoustics' | 'vertical'>>
    & Pick<ZoneFeatures, 'waterSource' | 'shelterQuality' | 'acoustics' | 'vertical'>;

/** §5.1: where inside a vertical zone a tribute is standing. */
export type ZoneLevel = 'upper' | 'lower';

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
    | 'noHealing'          // medical items do nothing; rest is the only recovery
    // §5: six more. Each is enforced at exactly one site, the way the eight
    // above are, and each is declarable by a hand-authored arena.
    | 'noForage'           // nothing edible grows here; the horn is the only pantry
    | 'deadlyNight'        // the dark is the hazard: night hazard rates double
    | 'oneWayBorders'      // every edge runs one way, and the map is a current
    | 'noWeapons'          // nothing in this arena is a weapon (also a Quell)
    | 'shrinkingArena'     // the border starts closing from the first morning
    | 'openMic'            // every fight is audible arena-wide
    /*
     * Audit 3 §5.2: laws that add rather than subtract.
     *
     * Eleven of the fifteen laws above are subtractions — no cannons, no night,
     * no water, no fire, no sponsors, no healing, no forage, no weapons. Three
     * add or redirect and one compresses. A law that *gives* changes what
     * players do rather than what they cannot do, and it creates contested
     * ground instead of uniform scarcity: `cornucopiaRefills` is the existing
     * proof, and it is the law that most reliably keeps the middle of the map
     * worth fighting over.
     *
     * Both of these are enforced at exactly one site, the way the fifteen above
     * are, and both are declarable by a hand-authored arena.
     */
    | 'bountifulGround'    // `Arena.lawZone` is permanently in bloom: it feeds, heals and settles
    | 'dawnMercy'          // every morning, whoever slept at the horn is treated
    /*
     * §1-2 (requests): five more, one apiece for the five new arenas, each
     * enforced at exactly one site the way the seventeen above are.
     */
    | 'tidalBorders'       // the map re-cuts itself every night: edges sever and re-open on a tide
    | 'bloodPrice'         // the horn only opens for a tribute who has already killed
    | 'noRest'             // sleep restores nothing; fatigue is paid down only by standing still in daylight
    | 'meltingGround'      // every zone a tribute lingers in is depleted permanently behind them
    | 'twinSuns'           // no shade anywhere: heat load applies in every zone, all day
    /*
     * Audit 5 §5.4: two laws that give. Thirteen of twenty subtracted, and
     * the three that gave totalled fewer arena-instances than `noSponsors`
     * alone. Both enforced at exactly one site.
     */
    | 'salvage'            // every corpse leaves its kit where it fell, as a cache anyone can find
    | 'theBell';           // every morning the Gamemakers name a zone; whoever stands in it at nightfall is resupplied

/** A traversal rule layered on top of plain adjacency for one edge. Keyed by `edgeKey(a,b)` on `Arena.edgeRules`. */
export interface EdgeRule {
    /**
     * §5.5: three kinds were not enough to express what a route can be. A
     * rope bridge frays (`collapsing`); a slope you scrambled down ices over
     * behind you (`oneWayAfter`); a pass an alliance is sitting on has to be
     * fought through (`contested`); and a way nobody has found yet is worth
     * more than any of them (`hidden`).
     */
    kind: 'oneWay' | 'tolled' | 'timeGated' | 'collapsing' | 'oneWayAfter' | 'contested' | 'hidden';
    /** 'oneWay'/'oneWayAfter': the one direction this edge may be crossed. */
    from?: string;
    to?: string;
    /** 'collapsing' only: crossings it has left in it before it is gone for good. */
    crossings?: number;
    /** 'oneWayAfter' only: crossings after which `from`->`to` is the only way. */
    after?: number;
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
    /**
     * §3 (requests): the arena-wide set-piece pack this map draws from.
     *
     * Distinct from `events` (flavour strings) and from the per-cycle
     * signature: a pack is a short list of named, arena-wide interventions of
     * which at most two fire in a run, plus the convergence that always closes
     * it. Named here, defined in `data/arenaEventPacks.ts`. Absent means the
     * arena draws from the universal pack.
     */
    eventPack?: string;
    /**
     * §5.7: what this arena's Cornucopia leans toward when it restocks.
     *
     * `cornucopiaRefills` governs the *timing* of a restock and nothing else,
     * so the one universally-recognisable location in every arena dropped
     * identical anonymous supply in all thirty-seven of them. Item ids listed
     * here bias what actually lands — a volcanic arena's horn toward
     * fire-resistant kit, a flooded one's toward water gear — tying the hub
     * back into the arena's own identity. Absent means no bias, which is what
     * every arena did before this existed.
     */
    restockBias?: string[];
    /**
     * §5: what the mouth of the horn is actually shaped like.
     *
     * `restockBias` already said what this arena's horn holds; nothing said
     * what it is to approach. An open plate is the classic bloodbath — a flat
     * ring and a sprint. A walled horn is a killing box: fewer people commit,
     * and the ones who do are committed. An island horn has to be crossed to,
     * so the scramble is slower, wetter and much more selective about who
     * bothers. Cosmetic default is 'plate', which is the behaviour every arena
     * had before this existed.
     */
    cornucopiaLayout?: 'plate' | 'walled' | 'island';
    /**
     * §5: the off-season skin this run is wearing, if any — a purely cosmetic
     * alternate dressing on the same zone graph and the same mechanics. Set at
     * run creation from the seed; see `data/offSeason.ts`.
     */
    offSeason?: string;
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

/**
 * §(requests): the pre-Games are staged rather than dumped.
 *
 * `processTraining` used to run the reaping square, the goodbyes, the train,
 * the parade and three days on the floor in one call, and the chronicle got
 * one 'TRAINING' page with everything in it. Each of those is its own phase
 * now, so the arena screen advances through them one at a time and the
 * chronicle pages them the way it pages a day and a night. `training` is kept
 * as a legacy value for saves written before the split.
 */
export type Phase = 'setup' | 'roster' | 'reaping'
    | 'square' | 'train' | 'parade'
    | 'training' | 'training1' | 'training2' | 'training3' | 'scores'
    | 'interviews' | 'bloodbath' | 'day' | 'night' | 'feast' | 'epilogue' | 'ended';

/** Every phase that happens before anyone is in the arena, in order. */
export const PRE_GAMES_PHASES: Phase[] = ['square', 'train', 'parade', 'training1', 'training2', 'training3', 'scores', 'interviews'];

/** The phase a training-floor day is logged under. */
export const trainingPhaseFor = (day: number): Phase => (`training${Math.min(3, Math.max(1, day))}` as Phase);

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
     * §(requests 2): sanity was one switch, on or off, which is the least
     * interesting thing a whole psychological model can be configured with.
     * These are the dials the model already has behind it.
     *
     *  - `sanityDrainRate`  scales everything that wears a mind down.
     *  - `sanityRecoveryRate` scales rest, food, company and safety.
     *  - `enableHallucinations` the sanity-floor set pieces: seeing the dead,
     *    dropping what they are holding, giving their own position away.
     *  - `enableBreakdowns` whether a tribute far enough gone makes noise in
     *    the dark that the rest of the arena can hear.
     *  - `sanityStart` where the whole cast begins, so a Quell can reap a
     *    field that is already frayed.
     *
     * All optional: a save written before this resolves to the old behaviour.
     */
    sanityDrainRate?: number;
    sanityRecoveryRate?: number;
    enableHallucinations?: boolean;
    enableBreakdowns?: boolean;
    sanityStart?: number;
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
    /**
     * §8 (requests): the shape of the reaping bowl, as the player wants it.
     *
     * Absent (the default) means the canon draw — one slip per year of age
     * plus tesserae, which skews older and skews oldest where the district is
     * poorest. Set, the bowl is replaced by a normal distribution with this
     * mean and `ageSpread` as its standard deviation, clamped to the statutory
     * 12-18 band. Both must be present for either to apply.
     */
    ageMean?: number;
    /** Standard deviation of the age draw. See `ageMean`. */
    ageSpread?: number;
    /**
     * §18 (requests): guarantee exactly one victor.
     *
     * Every dual-victory route — the two-may-win rule change, the district
     * pairs Quell, the lovers' exemption in the forced finale — is closed off
     * for the run, so the Games cannot end with two people standing.
     */
    singleVictor?: boolean;
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
    /**
     * §3 (requests): this run's arena set pieces, drawn once at the bloodbath.
     *
     * At most two ordinary events, each with the day it is scheduled for, plus
     * the convergence, which is not scheduled by day at all — it fires on the
     * field shrinking to the closing band. See `engine/arenaEventPacks.ts`.
     */
    arenaEventPlan?: Array<{ id: string; day: number }>;
    /** Ids from `arenaEventPlan` that have already resolved. */
    arenaEventsFired?: string[];
    /**
     * §3/§11 (requests): the day the convergence was called, and the zone the
     * field is being driven into. Set once and never cleared — the arena does
     * not reopen because the finalists took their time.
     */
    convergenceDay?: number;
    convergenceZone?: string;
    /**
     * AUDIT-6 §9.1: the softer convergence, and why there are two.
     *
     * Measured: 35.4% of the field dies in the bloodbath and the victor
     * averages 2.56 kills, so a typical run is one large opening slaughter and
     * then eight days in which twelve people mostly do not meet. The hard
     * convergence answers that at six alive, which is the last third of the
     * run; the middle of it had nothing.
     *
     * The muster is a *reason* to meet rather than a forced merge: the Capitol
     * puts a standing price on one sector for a few cycles, everybody is told
     * where it is, and anybody who wants the money has to go and stand in it
     * with whoever else wanted the money. Nothing is closed, nothing is
     * herded, and a tribute who would rather keep hiding may.
     */
    musterZone?: string;
    /** Cycle the price comes off the sector again. */
    musterUntilCycle?: number;
    /** Day it was called, so it fires once per run. */
    musterDay?: number;
    /** How many payouts it made, for the soak and the record book. */
    musterPayouts?: number;
    /**
     * §24 (requests): how many tributes the arena itself has killed — mutts,
     * hazards, climate, zone effects and set pieces, but never another
     * tribute. Read by the soft cap in `applyDamage`, which starts sparing
     * tributes from environmental death once the arena has taken more than its
     * share of the cast.
     */
    environmentalDeaths?: number;
    /**
     * §11 (requests): the cycle the field first reached two tributes. The
     * attrition grace in `applyDamage` is measured from here — see
     * `ESCALATION.finalTwoAttritionGraceCycles`.
     */
    finalTwoCycle?: number;
    /** Indices into `gamesProfile.calendar` that have already resolved. */
    firedWildcards?: number[];
    /** The storm currently crossing the arena, if any. See `engine/weatherFront.ts`. */
    weatherFront?: WeatherFront;
    /**
     * AUDIT-6 §11.2: the longest performed bond anybody sustained this run.
     *
     * 'The Long Con' and 'Performed to the End' both read the *victor's*
     * `maxPerformingStreak`, and the conjunction is near-unreachable: a
     * performance only starts from a showmance, only one of the pair performs,
     * `sniffPerformances` can end it at any cycle, and then that specific
     * person has to win. Measured across the whole field, 39 of 46 performers
     * reach a streak of two or more — but only 3% of victors do, so a 500-run
     * sample sees it or does not on a coin flip, which is how an entry becomes
     * a promise the game cannot keep.
     *
     * The act is the achievement. Whether the person running it also happened
     * to win is a second, unrelated lottery.
     */
    longestPerformance?: number;
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
    /** The Feast Quell's one-time proclamation has been made. */
    nightlyFeastProclaimed?: boolean;
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
     * §13 (requests): how many lines the current (day, phase) has already
     * produced, and which (day, phase) that is. The arena clock walks forward
     * through a phase as its lines land, so a stamp is a position in the phase
     * rather than a number pulled out of the air. Reset whenever the phase
     * changes; see `arenaClock` in `engine/context.ts`.
     */
    clockPhaseKey?: string;
    clockPhaseLines?: number;
    /**
     * Anti-repeat memory for `pickText`, keyed by each pool's first line.
     * Serialised with the save so a resumed run picks the same prose the
     * uninterrupted run would have.
     */
    lastPickedText?: Record<string, string>;
    /**
     * AUDIT-9 B12: the narration stream's own draw counter.
     *
     * `pickText` used to draw off `ctx.rng` — the same stream every mechanical
     * decision in the phase draws from — so the *number of lines in a flavour
     * pool* decided what the next combat roll was. A one-entry pool consumed
     * nothing; adding a second sentence to it consumed a draw and shifted every
     * subsequent outcome in the run. Editing prose was a balance change.
     *
     * Narration now runs on its own stream, derived per draw from
     * `seed-prose-<n>` where `n` is this counter. It lives on the state rather
     * than on the context so a resumed run continues the same narration
     * sequence, exactly as `lastPickedText` does.
     */
    proseDraws?: number;
    /**
     * §(requests): which lines of each flavour pool this run has already used.
     *
     * `lastPickedText` remembered one line deep, so a pool of eight produced
     * four sentences on rotation across a whole Games. This is the full used
     * set per pool: nothing repeats until everything else has been said. Reset
     * when a pool is exhausted. Keyed by the pool's first line, like
     * `lastPickedText`, and serialised with the save for the same reason.
     */
    usedText?: Record<string, string[]>;
    /** Zone name -> fraction of its printed yield currently stripped out (0-1). */
    zoneDepletion?: Record<string, number>;
    /** Zone name -> whatever is currently happening to it beyond depletion. */
    zoneEffects?: Record<string, ZoneEffect[]>;
    /** Audit 5 §5.7: the Kiln's signature names a zone one day and fires it the next. */
    kilnFiringZone?: string;
    /** Audit 5 §5.4 `theBell`: the zone named this morning, paid at nightfall. */
    bellZone?: string;
    /**
     * §(requests 17): what the Career pack did, recorded on the plates and
     * reported at the gong. Nobody negotiates on a pedestal, so the pack's
     * shape is a fact the bloodbath observes rather than a scene it plays.
     */
    careerOptOutIds?: string[];
    careerPackCollapsed?: boolean;
    /**
     * Adjacency edges cut by the arena itself — a collapsed bridge, a fire that
     * burned through a crossing. Stored as `map.edgeKey()` strings. The printed
     * `Zone.adjacent` graph is shared/regenerated data and is never mutated;
     * this is the run-local exception list layered on top of it.
     */
    severedEdges?: string[];
    /**
     * AUDIT-9 B06: the record book this run was played under, snapshotted at
     * creation.
     *
     * The engine used to read the player's persistent history straight out of
     * storage during the reaping, so a shared seed did not describe a run: the
     * same link produced different opening sponsor trust for two players, and
     * for the same player after a few more Games. Snapshotting it here makes
     * the campaign an *input* to the simulation like every other input —
     * carried by the save, exportable with a share link, and omittable on
     * purpose when the player wants the seed rather than the run.
     *
     * Undefined means no history, which is what every headless harness and
     * every first run gets. See `engine/campaign.ts`.
     */
    campaign?: CampaignSnapshot;
    /**
     * AUDIT-9 §5: how many structures have come down this Games.
     *
     * Per-run rather than per-tribute. `Tribute.collapsesSurvived` answers
     * "was this person under one"; this answers "is the arena coming apart",
     * which is a different question and the one nothing could ask.
     */
    structuresCollapsed?: number;
    /**
     * AUDIT-9 (audit B20): who dealt the most recent tribute-dealt kill.
     *
     * `firstBloodId` has existed since the side-bet book needed it and there
     * was no counterpart, so "First and Last" — a title the audit lists as
     * shared by two different achievements — could only ever be tested as
     * "first blood, plus some other number", which is not what it says.
     */
    lastKillerId?: string;
    /**
     * AUDIT-9 B16: how many tributes have been eliminated so far.
     *
     * The counter behind `Tribute.eliminationIndex`. Elimination is a
     * *sequence*, and nothing recorded it — only the day, which is far too
     * coarse to settle a last-three-standing market on.
     */
    eliminations?: number;
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
     * §9.3: what the last few Games left behind — the Head Gamemaker's grudge,
     * the district the Gamemakers are watching, and how Panem regards each
     * district this year. Resolved once at the reaping from `PanemRecords`
     * (see `engine/continuity.ts`); absent on a first run and in any headless
     * harness, which is exactly "no history yet".
     */
    continuity?: import('../engine/continuity').RunContinuity;
    /** Guards the grudge intervention to once per run. */
    grudgeFired?: boolean;
    /** §7 (audit): the bloodless-finalist hunt has been sent, once per run. */
    bloodlessHuntFired?: boolean;
    /** §7 (audit): cycle each arena event last fired, keyed by id or text, for the repeat cooldown. */
    eventLastFired?: Record<string, number>;
    /** §5.3 (audit): the Cornucopia's edges are cut until this cycle (seal-the-horn). */
    sealedHornUntilCycle?: number;
    /** Per-run truce accounting. See `engine/parley.ts`. */
    truceLedger?: import('../engine/parley').TruceLedger;
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
     * AUDIT-9 stage C §4: sponsor gifts in the air and on the ground.
     *
     * A gift exists here between the moment somebody pays for it and the
     * moment somebody picks it up, which is the window in which it can land
     * in the wrong zone or be taken by the wrong person. See
     * `engine/parachutes`.
     */
    parachutes?: Array<{
        id: string;
        item: Item;
        zone: string;
        /** Who it was bought for. Not necessarily who gets it. */
        forId: string;
        landedCycle: number;
        seal?: string;
    }>;

    /**
     * Movement along each edge of the zone graph, keyed by the two zone names
     * sorted and joined with '|'. Decays every cycle, so it reads as "where the
     * traffic is right now" rather than a cumulative total.
     */
    zoneTraffic?: Record<string, number>;
    /** Tribute id -> cycle their fire/shelter/camouflage lapses. */
    camps?: Record<string, { fire?: number; shelter?: number; camouflage?: number }>;
    /**
     * Audit 3 §1.3: the cycle the Cornucopia was last restocked.
     *
     * Read by `mintTrueRumours`: "the horn came back" is only a true thing to
     * say for a cycle or two after it did.
     */
    lastRestockCycle?: number;
    /**
     * Audit 3 §1.6: high-water marks for state that does not survive to the end
     * of a run, written by `tickRunRecords` and read by the achievement table.
     *
     * The table is evaluated once, against the final state. Rumours expire and
     * are pruned; alliances belong to the dead; sponsor purses are only
     * meaningful against what they opened with. Five achievements were asking
     * the wreckage and never unlocked once in 200 runs.
     */
    /** Most planted claims in circulation at one time. */
    maxPlantedInCirculation?: number;
    /** A planted lie was walked to and found out by somebody. */
    plantedRumourExposed?: boolean;
    /** Tributes whose planted lie was, at some point, still standing and still believed. */
    liarsAtLarge?: string[];
    /** The most clauses any charter sworn this run carried. */
    deepestCharter?: number;
    /** Each bloc's purse the first cycle it was seen, so "spent" has a baseline. */
    openingBlocBudgets?: Record<string, number>;
    /** Every sponsor bloc was, at some point, down to a fraction of its opening purse. */
    everySponsorBlocExhausted?: boolean;
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
    /**
     * Audit 3 §5.4: what the table actually holds.
     *
     * The feast is the single most anticipated scheduled event in the format
     * and it had four flavours, one of which accounted for two feasts in five.
     * The four added here need no new mechanics — each is a different pool, a
     * different announcement and a different reason to go or not go, which is
     * the whole decision the feast exists to pose.
     */
    feastTheme?: 'weapons' | 'medical' | 'food' | 'district-gifts'
        /** One pack, on an empty table. Whoever gets there first has it. */
        | 'single-pack'
        /** Nothing but the tokens taken at the reaping. Worth nothing, and everybody comes. */
        | 'tokens'
        /** Rope, wire, flint, kits — nothing that kills, everything that keeps you alive. */
        | 'fieldcraft'
        /** The Gamemakers lied. There is no table. */
        | 'empty';
    /** §6.8: tribute who drew first blood (first tribute-dealt kill). */
    firstBloodId?: string;
    /**
     * §5.5: crossings made per edge, by `edgeKey`. A `collapsing` edge counts
     * down to nothing against this; an `oneWayAfter` edge reads it to decide
     * whether the slope has iced over yet.
     */
    edgeCrossings?: Record<string, number>;
    /**
     * §5.5: `contested` edges an alliance has actually garrisoned, by
     * `edgeKey` -> alliance id. Set by a group dug in on one side of it;
     * anybody else pays a combat check to come through.
     */
    garrisonedEdges?: Record<string, string>;
    /**
     * §25 (requests): every contested edge that has *ever* been garrisoned this
     * run, by `edgeKey`.
     *
     * `garrisonedEdges` is a live map — an entry is deleted the moment the
     * holders stop standing on the ground — so anything asking "did an
     * alliance hold a pass this year?" against it was really asking "is one
     * being held at this exact instant?". That is the wrong question at the
     * end of a run by construction, because by then the field is down to one
     * or two people and nobody is garrisoning anything. This is the historical
     * record, and it is never cleared.
     */
    garrisonsFormed?: string[];
    /** §9.1: tributes who bled out with an ally standing one zone away. */
    diedWithinReach?: number;
    /** §9.7: map intelligence handed over at a parley or in camp, honest or not. */
    intelTrades?: number;
    /**
     * §6.4: this feast's named packs — `tributeId` is whose name is on it.
     * A pack with somebody else's name on it is still worth taking, and taking
     * it is a different beat from claiming your own.
     */
    feastPrizes?: Array<{ tributeId: string; label: string }>;
    /**
     * §13.2: whether to log the in-fiction arena brief as the tributes rise.
     * Copied off the player's prefs at run creation rather than read from the
     * store inside the engine — the engine has never imported the UI layer and
     * must not start, and a resumed save should brief the way it originally
     * did. Undefined means on, so every save from before this existed is
     * unchanged in behaviour.
     */
    arenaBriefingOnDrop?: boolean;
    /**
     * §10.5: names of archived victors reaped again into this run. Set at
     * creation by a Grudge Match; read by the reaping copy.
     */
    veteransSeated?: string[];
    /** §13.3: the Undermere — cycle the bioluminescence comes back on. */
    mossDimUntilCycle?: number;
    /** §10.1: the longest single fire chain this run produced, in zones. */
    fireChainMax?: number;
    /**
     * §5.8: structural fatigue per `ruins` zone, 0-1.
     *
     * A shared engine primitive rather than one more hand-authored collapse
     * event: time spent standing in a ruin and violence done inside it both
     * load the structure, and a loaded structure is what the universal
     * "Load-Bearing" event fires out of. Any arena with `ruins` terrain gets
     * it for free; nothing has to opt in.
     */
    structuralFatigue?: Record<string, number>;
    /**
     * §5.5: camps abandoned in a hurry, keyed by zone. A zone somebody fled
     * used to reset to its ambient state the moment they left; this is the
     * trace they did not have time to pick up, discoverable by anyone who
     * comes through after.
     */
    abandonedCamps?: Array<{
        zone: string;
        /** Who left it, so the finder learns something about who is where. */
        ownerId: string;
        ownerName: string;
        cycle: number;
        /** Item ids left behind, minted for whoever finds them. */
        items: string[];
        /** Set once somebody has found it — it is not found twice. */
        foundBy?: string;
    }>;
    /**
     * §5.4: the extreme this run's weather is drifting toward, and how far
     * along that drift is. Weather used to be an independent roll every
     * cycle; a run now has a season.
     */
    climateDrift?: { toward: 'heat' | 'cold' | 'wet' | 'dry'; progress: number };
    /** §5.3: consecutive cycles the audience's excitement has sat flat. */
    excitementFlatCycles?: number;
    /** §5.3: last cycle's excitement total, so "flat" can mean unchanged. */
    lastExcitementTotal?: number;
    /** §7: tributes poisoned at the feast, and who tampered with the supplies. */
    feastTampering?: Array<{ byId: string; cycle: number }>;
    /** §10.1: a renewed truce was still standing when one of its parties died. */
    /**
     * §4.6: love triangles, as their own tracked shape.
     *
     * Two overlapping romances that happen to share a member were previously
     * two independent pairs, and the simulation had no idea they were the same
     * story. A triangle has beats a pair does not — the jealousy that is
     * legible in the feed long before anything happens, and the forced choice
     * at a pressure point — and none of them are expressible as "these two
     * records both mention Cato".
     */
    loveTriangles?: Array<{
        /** The one both of them are attached to. */
        apexId: string;
        aId: string;
        bId: string;
        formedCycle: number;
        /** Cycles the two rivals have spent visibly aware of each other. */
        heat: number;
        /** Set once the apex has been made to choose. */
        resolved?: boolean;
        /**
         * Audit 3 §6/§10.1: how it stopped being a live triangle.
         *
         * `tickTriangles` used to *delete* a triangle the moment any of the
         * three died, on the reasonable mechanical grounds that there is
         * nothing left to tick. But a Games ends with one tribute alive, so
         * every triangle that ever formed was erased before anybody could read
         * the record: four were live at once in a sampled run and one survived
         * to the end across 80 runs, which is why the whole subsystem measured
         * as "happens in 1 run in 132" when it actually happens far more often.
         * Ended, not deleted.
         */
        endedBy?: 'choice' | 'death';
    }>;
    /**
     * §4.1: standing non-aggression between two whole alliances.
     *
     * A truce is between two people; this is between two groups, agreed by
     * whoever speaks for each, binding on members who were not at the table,
     * and dissolving for reasons about the blocs rather than about any pair.
     * See `engine/blocTreaty.ts`.
     */
    /** §11.3 (audit): treaties sworn this run. Treaties are pruned as they end, so the count is the only record. */
    blocTreatiesSworn?: number;
    /**
     * Audit 3 §4.7: a bloc treaty ran its term, or lasted until the field was
     * too small to sustain it, without either side breaking it.
     *
     * `blocTreaties` is the *live* list and is emptied by every ending a treaty
     * can have — a bloc wiped out, the field closing, the clock running out —
     * so at the end of a run, with one tribute standing, it is always empty.
     * 'The Treaty Year' asked it for a treaty "still standing when the Games
     * end" and could never once be answered yes in 132 runs.
     */
    blocTreatyHeld?: boolean;
    /** ...and the other outcome: somebody killed across one. */
    blocTreatyBroken?: boolean;
    blocTreaties?: Array<{
        /** Cycle a member last decided the treaty did not bind them. Log de-dup only. */
        strainedCycle?: number;
        /**
         * AUDIT-7 §4.5: how many times both sides have come back and said
         * again. A treaty used to have exactly one possible history — it was
         * sworn and then something happened to it — and 80.6% of the time the
         * something was one side ceasing to exist. A renewal count is what
         * makes "these two packs have held this for a fortnight" a fact the
         * feed can state.
         */
        renewals?: number;
        aId: string;
        bId: string;
        /** Cycle it lapses on its own. */
        until: number;
        sworn: number;
        /** Field size at or below which the arithmetic ends it early. */
        fieldFloor: number;
    }>;
    /**
     * §4.3: vengeance sworn together — a kill-target objective held by more
     * than one tribute at once. Distinct from the individual grudge in
     * `memory.vengeance`, which is private and which two people who lost the
     * same person each held separately with no idea the other one had it.
     * See `engine/vengeancePact.ts`.
     */
    vengeancePacts?: Array<{
        targetId: string;
        memberIds: string[];
        sworn: number;
        /** Who they both lost, when the engine could identify them. */
        overWhomId?: string;
    }>;
    /**
     * §4.7: the rumour pool — claims in circulation about the arena, each of
     * which is either so or not. Distinct from the zone-threat hearsay in
     * `memory.ts`, which trades numbers about places; a rumour is a
     * proposition with a subject, and it can be checked by standing in it.
     * See `engine/rumours.ts`.
     */
    rumours?: Array<{
        id: string;
        kind: 'restock' | 'holed-up' | 'cache' | 'empty';
        zone: string;
        /** The tribute a 'holed-up' claim is about, when there is one. */
        aboutId?: string;
        isTrue: boolean;
        /** Set when somebody made it up, as opposed to it being observed. */
        plantedById?: string;
        bornCycle: number;
        /** Set once somebody has stood in it and found it false. */
        exposed?: boolean;
    }>;
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
    /**
     * AUDIT-9 B05: how many manual/scheduled interventions this run has fired.
     *
     * Interventions do not enter through a phase, so they have no (seed,
     * phase, day) to reseed from; this counter is what makes their stream
     * reproducible across a save and resume. See `triggerGamemakerEvent`.
     */
    gamemakerCommands?: number;
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
    /**
     * §13 (requests): the in-arena timestamp, as `D3 21:40` — arena clock, not
     * wall clock. Derived at log time from the day, the phase and how far into
     * the phase the line landed, so it is stable across a replay of the same
     * seed. Optional: entries written before this existed have no stamp and
     * the feed falls back to the day/phase header.
     */
    clock?: string;
    text: string;
    tributesInvolved: string[];
    important: boolean;
    zone?: string;
    category: EventCategory;
    /**
     * §(requests): the same event, stated as a fact.
     *
     * The stripped-down chronicle renders this instead of `text`. Supplied at
     * the sites where the prose is hiding something the record should state
     * outright — who killed whom with what, what was taken, who joined what —
     * and derived from the entry's own fields everywhere else. Optional by
     * design: an event with no `fact` is one whose category, cast and zone
     * already say everything the record needs.
     */
    fact?: string;
    /**
     * AUDIT-9 B18: involved tributes who are *not* at this entry's zone.
     *
     * Being named in an event and being present at it are different things,
     * and the replay reconstruction could not tell them apart — it assigned
     * `entry.zone` to everybody in `tributesInvolved`, so a feast announcement
     * naming the tributes who *declined* to come teleported them to the
     * Cornucopia on the scrubber.
     *
     * Most events do imply presence, so this names the exception rather than
     * the rule: a site that talks about people somewhere else says so.
     */
    absentIds?: string[];
    /**
     * AUDIT-9 B18: who acted, where the reconstruction would otherwise infer
     * it from list position.
     *
     * Kill credit was read as `tributesInvolved[0]` killed `[1]`, which is a
     * convention rather than a fact. Set explicitly on the kill path.
     */
    actorId?: string;
    /**
     * AUDIT-9: the structured kind, for the beats something measures.
     *
     * See `EventType`. Absent on the great majority of lines, which nothing
     * counts and which therefore do not need one.
     */
    type?: EventType;
}

export interface LogOptions {
    important?: boolean;
    zone?: string;
    category?: EventCategory;
    /** §(requests): the factual restatement for the stripped-down chronicle. */
    fact?: string;
    /** AUDIT-9 B18: involved tributes who are not at `zone`. */
    absentIds?: string[];
    /** AUDIT-9 B18: who acted, for kill credit that does not guess from order. */
    actorId?: string;
    /** AUDIT-9: the structured kind. See `EventType`. */
    type?: EventType;
}

/**
 * AUDIT-9 (audit §"robustness"): what kind of thing happened, as a value.
 *
 * `EventCategory` is the *channel* a line goes out on — it drives colour,
 * filtering and the feed's glyphs, and it is deliberately coarse: `combat`
 * covers an ambush, a group fight and a standoff alike.
 *
 * This is the other axis: the specific beat. It exists because the engine has
 * been encoding exactly this information as an English prefix inside the prose
 * — `'VENGEANCE: {mourner} learns that {killer} killed {victim}.'` — and both
 * harnesses read it back out with `text.startsWith('VENGEANCE:')`. That is a
 * structured field stored as a substring of a sentence, and it breaks the
 * moment anybody rewrites the sentence. `soak.ts` documents two probes that
 * did exactly that and read zero for several commits.
 *
 * Only the beats something actually measures are typed. This is not an
 * attempt to enumerate every line in the game; it is the set where a number
 * somewhere depends on recognising the event, which is precisely the set that
 * must not depend on its wording.
 */
export type EventType =
    | 'vengeance-sworn'
    | 'group-fight'
    | 'ambush'
    | 'betrayal'
    | 'truce'
    | 'standoff'
    | 'romance'
    | 'bond'
    | 'border-warning'
    | 'border-collapse'
    /*
     * AUDIT-9, second pass: the rest of what the soak measures.
     *
     * The first pass typed the ten beats whose kind was encoded as an English
     * prefix. It left a much larger set alone: 107 regex probes in `soak.ts`
     * counting alliance politics, debts, treaties, rumours, succession,
     * infection and the rest by matching their sentences. Those probes were
     * exactly as fragile — the file's own header documents two of them reading
     * zero for several commits after their strings were edited out — and the
     * dead-probe assertion added then can only catch a probe that reaches
     * *zero*. A reword that costs a counter half its hits is still silent.
     *
     * So each measured beat is a value here, and the probe counts the value.
     */
    | 'bluff-caught'
    | 'bluff-landed'
    | 'brokered-held'
    | 'cache-contributions'
    | 'camouflaged'
    | 'career-defections'
    | 'charter-breaches'
    | 'cold-weapon-swings'
    | 'cornucopia-held'
    | 'cornucopia-payouts'
    | 'debt-repaid'
    | 'desperation-fights'
    | 'district-bonds'
    | 'exotic-betrayals'
    | 'expulsion'
    | 'faction-coups'
    | 'faction-expulsions'
    | 'faction-walkouts'
    | 'feud'
    | 'fever-lines'
    | 'field-dressings'
    | 'fire-lit'
    | 'fracture'
    | 'free-for-alls'
    | 'gamemaker-signatures'
    | 'grief-events'
    | 'haunted-grants'
    | 'hearing'
    | 'hidden-moments'
    | 'hollow-grants'
    | 'hunt-or-craft'
    | 'inheritance'
    | 'investigation-cleared'
    | 'investigation-guilty'
    | 'leadership-changes'
    | 'loan-borrower-died'
    | 'loan-defaulted'
    | 'loan-lender-died'
    | 'loan-lost'
    | 'loan-made'
    | 'loan-returned'
    | 'loyal-broke'
    | 'mentor-cross-talk'
    | 'mercy-broke'
    | 'merge'
    | 'muster-calls'
    | 'muster-scenes'
    | 'nightlock-deaths'
    | 'objective-formed'
    | 'pacifist-broke'
    | 'pact-declared'
    | 'pact-honoured'
    | 'performed-bonds'
    | 'preemptive-betrayals'
    | 'preemptive-departures'
    | 'reconciliation'
    | 'recruitment'
    | 'resolve-breakdowns'
    | 'retreat'
    | 'romance-tragedy'
    | 'rumour-caught-planted'
    | 'rumour-caught-repeated'
    | 'rumour-dead-end'
    | 'rumour-planted'
    | 'schism'
    | 'sepsis-deepened'
    | 'sepsis-treated'
    | 'shelter-built'
    | 'signature-beats'
    | 'sleep-drops'
    | 'sleeping-apart'
    | 'solo-departures'
    | 'succession-heir'
    | 'succession-passed-over'
    | 'succession-split'
    | 'succession-unnamed'
    | 'trap-destroyed'
    | 'parachute-claimed'
    | 'parachute-stolen'
    | 'parachute-collected'
    | 'parachute-lost'
    | 'partial-work'
    | 'trap-set-snare'
    | 'trap-set-deadfall'
    | 'trap-set-pit'
    | 'trap-set-tripwire'
    | 'trap-set-stake'
    | 'trap-triggered'
    | 'treaty-lapsed'
    | 'treaty-outgrown'
    | 'treaty-outlived-a-side'
    | 'treaty-renewed'
    | 'treaty-sworn'
    | 'triangle-choices'
    | 'triangle-formed'
    | 'triangle-jealousy'
    | 'tribute-paid'
    | 'tribute-paid-information'
    | 'truce-held'
    | 'truce-outlived'
    | 'vengeance-abandoned'
    | 'vengeance-outlived'
    | 'vengeance-pacts'
    | 'vengeance-paid'
    | 'vengeance-soloed'
    | 'vengeance-stolen'
    | 'watch-posted'
    | 'weapon-poisoned'
    | 'weather-fronts'
    | 'wound-turned'
    | 'zone-drinks';

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

/**
 * AUDIT-9 B06: everything a career of Games contributes to a run.
 *
 * Declared here rather than in the engine so the model layer stays the one
 * place a `GameState` field is defined; `engine/campaign.ts` holds the
 * behaviour and the rationale. The shape is deliberately structural — it
 * mirrors the subset of the stored record book the simulation reads, and
 * nothing in the engine may import the storage layer.
 */
export interface CampaignSnapshot {
    runs: number;
    victors: number;
    patronDistrict?: number;
    patronWins?: number;
    victorDistrictStreak?: number;
    lastVictorDistrict?: number;
    districtCrowns?: Record<number, { victories: number }>;
    gamemakerRecords?: Record<string, { games: number; victors: number; deaths: number; totalDays?: number }>;
    recentRuns?: Array<{ victorDistrict?: number }>;
    /** The incumbent Head Gamemaker and how many Games they have run. */
    headGamemakerTerm?: { name: string; runsServed: number };
    /** §6.2: districts the player is paying to patronise this run. */
    patronDistricts?: number[];
    /** §9: districts whose last victor is alive to sit in the mentor's chair. */
    victorMentors?: Record<number, { name: string; archetype: string; run: number }>;
    /** §10.4: a keepsake an earlier tribute of that district did not bring home. */
    heirlooms?: Record<number, { token: string; quirk?: string; fromName: string; run: number }>;
}
