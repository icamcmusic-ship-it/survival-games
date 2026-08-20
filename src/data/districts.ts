import { Proficiency, WeaponClass } from '../models/types';

/**
 * District pedigree: how many Games each district has actually won, and what
 * that buys a tribute before they ever reach the arena.
 *
 * A tribute from District 2 arrives with a mentor who has stood on the victor's
 * podium and a Capitol audience that already expects them to do well. A tribute
 * from District 12 arrives with a mentor who may be the only living victor
 * their district has, and an audience that has never had a reason to learn
 * their district's name. That gap is reputation, and it is worth modelling.
 */

export type LegacyTier = 'storied' | 'strong' | 'modest' | 'thin' | 'forgotten';

export interface DistrictLegacy {
    /** Industry, for flavour and future use. */
    industry: string;
    tier: LegacyTier;
    /** Mentors drawn on at random; the name appears in the reaping and debrief. */
    mentors: string[];
}

export const LEGACY_EFFECTS: Record<LegacyTier, {
    /** Baseline sponsor-trust shift for coming from this district. */
    reputation: number;
    /** Multiplier on the training elite-gate: good coaching shows on the floor. */
    trainingMerit: number;
    /** Description used in the roster and the victor's debrief. */
    blurb: string;
}> = {
    storied:   { reputation: 12, trainingMerit: 0.2,  blurb: 'a wall of past victors and a mentor who has stood on the podium' },
    strong:    { reputation: 7,  trainingMerit: 0.12, blurb: 'a proud record and a mentor who knows exactly what the arena costs' },
    modest:    { reputation: 2,  trainingMerit: 0.05, blurb: 'a handful of victories and a mentor doing their best' },
    thin:      { reputation: -3, trainingMerit: 0,    blurb: 'one or two names on the wall and very little else' },
    forgotten: { reputation: -8, trainingMerit: -0.05, blurb: 'almost nothing — a mentor who barely survived their own Games' },
};

export const DISTRICT_LEGACY: Record<number, DistrictLegacy> = {
    1:  { industry: 'Luxury goods',  tier: 'storied',   mentors: ['Gloss Vane', 'Cashmere Roux', 'Aurelia Sant'] },
    2:  { industry: 'Masonry',       tier: 'storied',   mentors: ['Brutus Kane', 'Lyme Castellan', 'Enobaria Vex'] },
    3:  { industry: 'Technology',    tier: 'thin',      mentors: ['Beetee Ohm', 'Wiress Kell'] },
    4:  { industry: 'Fishing',       tier: 'strong',    mentors: ['Mags Undine', 'Finnick Sable', 'Nerida Quay'] },
    5:  { industry: 'Power',         tier: 'thin',      mentors: ['Volta Reyes', 'Dyno Marsh'] },
    6:  { industry: 'Transport',     tier: 'forgotten', mentors: ['Axel Ferro', 'Piper Lane'] },
    7:  { industry: 'Lumber',        tier: 'modest',    mentors: ['Johanna Bray', 'Blight Aspen', 'Cedar Kolb'] },
    8:  { industry: 'Textiles',      tier: 'thin',      mentors: ['Cecelia Warp', 'Woof Selvedge'] },
    9:  { industry: 'Grain',         tier: 'forgotten', mentors: ['Chaff Rowen', 'Sheaf Kolby'] },
    10: { industry: 'Livestock',     tier: 'thin',      mentors: ['Dalton Rein', 'Brandy Colt'] },
    11: { industry: 'Agriculture',   tier: 'modest',    mentors: ['Seeder Vale', 'Chaff Booker'] },
    12: { industry: 'Mining',        tier: 'forgotten', mentors: ['Haymitch Abernathy', 'Wickham Ash'] },
};

export function legacyOf(district: number): DistrictLegacy {
    return DISTRICT_LEGACY[district] ?? { industry: 'Unknown', tier: 'thin', mentors: ['an unnamed mentor'] };
}

/**
 * What a district's industry is actually worth in the arena.
 *
 * `industry` was a display string with a comment promising "future use", and
 * this is that use. A district is a place where children spend twelve years
 * doing one specific kind of work, and the work leaves marks: District 4 has
 * been handling nets and gaffs since they could walk, District 7 has swung an
 * axe every day of their life, District 11 knows on sight which berries are
 * safe, District 12 has been hungry before.
 *
 * Three deliberately small levers, so a district reads as a place rather than
 * as a stat block:
 *
 *  - `proficiencies` seed the same skill system training and use feed, so a
 *    District 11 tribute forages like someone who has done it before.
 *  - `affinity` is weapon familiarity: the item ids and weapon classes that
 *    tribute grew up holding. Read by `combatPower`, so the trident finally
 *    means something in the hands of a District 4 tribute and nothing in
 *    anyone else's.
 *  - `hungerResilience` scales the hunger drain. Only the districts that
 *    actually starve get it.
 */
export interface DistrictCraft {
    proficiencies: Partial<Record<Proficiency, number>>;
    /** Specific item ids this district's children grew up handling. */
    affinityItems: string[];
    /** Broader classes of weapon they are comfortable with. */
    affinityClasses: WeaponClass[];
    /** Multiplier on hunger drain. Below 1 = used to going without. */
    hungerResilience?: number;
    /** One line, for the roster and the tribute sheet. */
    blurb: string;
}

/** Head start a district's trade buys in a skill. Kept below the archetype head start. */
const TRADE = 0.6;
const TRADE_MINOR = 0.35;

export const DISTRICT_CRAFT: Record<number, DistrictCraft> = {
    1:  { proficiencies: { melee: TRADE },                        affinityItems: ['sword', 'machete'],   affinityClasses: ['melee'],            blurb: 'raised on fine steel and the academy floor' },
    2:  { proficiencies: { melee: TRADE, tracking: TRADE_MINOR }, affinityItems: ['mace', 'axe', 'sword'], affinityClasses: ['melee'],          blurb: 'quarry work and the academy: heavy weapons, and the arm to use them' },
    3:  { proficiencies: { tracking: TRADE, medicine: TRADE_MINOR }, affinityItems: ['wire', 'slingshot'], affinityClasses: [],                 blurb: 'factory-raised: traps, wire, and an eye for how the arena is wired together' },
    4:  { proficiencies: { forage: TRADE, melee: TRADE_MINOR },   affinityItems: ['trident', 'spear'],    affinityClasses: ['thrown'],           blurb: 'a childhood on the boats: nets, gaffs, deep water, and the trident' },
    5:  { proficiencies: { tracking: TRADE },                     affinityItems: ['wire'],               affinityClasses: [],                   blurb: 'power-plant shifts: they read machinery the way others read weather' },
    6:  { proficiencies: { tracking: TRADE },                     affinityItems: [],                     affinityClasses: [],                   blurb: 'transport yards: they know how to move and how not to be seen doing it' },
    7:  { proficiencies: { forage: TRADE_MINOR, melee: TRADE },   affinityItems: ['axe', 'machete'],     affinityClasses: ['melee'],            blurb: 'lumber crews: climbing, felling, and an axe that has never been a weapon until now' },
    8:  { proficiencies: { medicine: TRADE },                     affinityItems: ['wire', 'garrote'],    affinityClasses: [],                   blurb: 'textile floors: fast hands, and they can dress a wound properly' },
    9:  { proficiencies: { forage: TRADE },                       affinityItems: ['sickle'],             affinityClasses: [],                   hungerResilience: 0.92, blurb: 'grain country: they know what is edible and what a lean year feels like' },
    10: { proficiencies: { medicine: TRADE_MINOR, melee: TRADE_MINOR }, affinityItems: ['sickle', 'knife'], affinityClasses: [],                blurb: 'stockyards: unsqueamish, steady with a blade, and used to a struggling animal' },
    11: { proficiencies: { forage: TRADE, medicine: TRADE_MINOR }, affinityItems: ['sickle', 'slingshot'], affinityClasses: [],                 hungerResilience: 0.9,  blurb: 'orchard work: they know on sight which plants will kill them' },
    12: { proficiencies: { forage: TRADE_MINOR, tracking: TRADE_MINOR }, affinityItems: ['knife'],       affinityClasses: [],                   hungerResilience: 0.82, blurb: 'the Seam: poaching, the mines, and a lifetime of being hungry' },
};

export function craftOf(district: number): DistrictCraft {
    return DISTRICT_CRAFT[district] ?? { proficiencies: {}, affinityItems: [], affinityClasses: [], blurb: 'no trade the arena cares about' };
}
