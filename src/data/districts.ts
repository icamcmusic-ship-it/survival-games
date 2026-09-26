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
    /**
     * Mentors drawn on at random; the name appears in the reaping and debrief.
     * AUDIT-12 wave 2: one given name each, like every tribute — no surnames.
     * `check-names` fails on any whitespace in this pool.
     */
    mentors: string[];
}

export const LEGACY_EFFECTS: Record<LegacyTier, {
    /** Baseline sponsor-trust shift for coming from this district. */
    reputation: number;
    /** Multiplier on the training elite-gate: good coaching shows on the floor. */
    trainingMerit: number;
    /**
     * AUDIT-6 §8.5: how much the rest of the field bothers about a tribute from
     * this district, on the same hunt-scoring scale as the `targetDraw` trait
     * modifier and the archetype column.
     *
     * Every other number in this table was a penalty, so a legacy tier was
     * purely a statement of how much worse your Games was going to be: two of
     * three columns negative for `forgotten` and nothing anywhere to trade
     * against. Measured per entrant (not per victor — the audit's first pass
     * read share-of-victors and got this badly wrong for districts 13-16, which
     * enter a quarter as often), the outer districts win 2.0-2.9% against 8.0-
     * 8.3% for the three Career districts.
     *
     * This is the column that gives the bottom of the table something the top
     * does not have, and it is the one weakness a storied district cannot
     * train away: the Capitol has a wall of your victors, so the other
     * twenty-three tributes have heard of you. Nobody has heard of District 9.
     * Being unwatched is the only edge an unfancied tribute starts with, and it
     * is exactly the edge the source material gives them.
     */
    targetDraw: number;
    /** Description used in the roster and the victor's debrief. */
    blurb: string;
}> = {
    // Tuning pass: 12 / 0.2 / 3 -> 6 / 0.15 / 4.5 (largest single-district win share 16.3% -> ~15%).
    storied:   { reputation: 6,  trainingMerit: 0.15, targetDraw: 4.5,  blurb: 'a wall of past victors and a mentor who has stood on the podium' },
    strong:    { reputation: 7,  trainingMerit: 0.12, targetDraw: 2,    blurb: 'a proud record and a mentor who knows exactly what the arena costs' },
    modest:    { reputation: 2,  trainingMerit: 0.05, targetDraw: 0,    blurb: 'a handful of victories and a mentor doing their best' },
    thin:      { reputation: -3, trainingMerit: 0,    targetDraw: -1.5, blurb: 'one or two names on the wall and very little else' },
    forgotten: { reputation: -8, trainingMerit: -0.05, targetDraw: -3,   blurb: 'almost nothing — a mentor who barely survived their own Games, and an arena that has never once been told to watch you' },
};

export const DISTRICT_LEGACY: Record<number, DistrictLegacy> = {
    1:  { industry: 'Luxury goods',  tier: 'storied',   mentors: [
        'Sequinette',
        'Argentine',
        'Perlaine',
        'Onyxia',
        'Giltane',
        'Glossamer',
        'Velourine',
        'Satinette',
        'Lucentia',
        'Aigrette',
        'Pavella',
        'Baguette',
    ] },
    2:  { industry: 'Masonry',       tier: 'storied',   mentors: [
        'Ashlarin',
        'Portico',
        'Corvane',
        'Dolomar',
        'Brutane',
        'Lymestone',
        'Enobar',
        'Granitor',
        'Quarrelin',
        'Cornicus',
        'Plinthus',
        'Architrave',
    ] },
    3:  { industry: 'Technology',    tier: 'thin',      mentors: [
        'Relayne',
        'Belisar',
        'Staticus',
        'Circuitra',
        'Faradine',
        'Soldera',
        'Anodyne',
        'Diodea',
        'Resistra',
        'Transistra',
        'Capacita',
        'Siliconne',
    ] },
    4:  { industry: 'Fishing',       tier: 'strong',    mentors: [
        'Coralind',
        'Tillerman',
        'Magsine',
        'Tritonne',
        'Undina',
        'Scupper',
        'Mizzen',
        'Sculler',
        'Longliner',
        'Trawlie',
        'Gaffney',
        'Shoalie',
    ] },
    5:  { industry: 'Power',         tier: 'thin',      mentors: [
        'Turbina',
        'Voltar',
        'Dynamus',
        'Currentine',
        'Fluxton',
        'Joulette',
        'Rheostan',
        'Megawatt',
        'Gridley',
        'Ohmeric',
        'Substation',
        'Busbar',
    ] },
    6:  { industry: 'Transport',     tier: 'forgotten', mentors: [
        'Sleepwright',
        'Junctia',
        'Signalman',
        'Axelle',
        'Pipelane',
        'Railene',
        'Cambera',
        'Dieseline',
        'Turnout',
        'Ballast',
        'Trackman',
        'Brakesman',
    ] },
    7:  { industry: 'Lumber',        tier: 'modest',    mentors: [
        'Rosina',
        'Jochanna',
        'Blightwood',
        'Cedrick',
        'Rowantree',
        'Aldrin',
        'Stumpage',
        'Treefall',
        'Faller',
        'Bucker',
        'Choker',
        'Splitwood',
    ] },
    8:  { industry: 'Textiles',      tier: 'thin',      mentors: [
        'Warpina',
        'Bobbinet',
        'Twillow',
        'Damasque',
        'Cecilie',
        'Woofe',
        'Cottona',
        'Indigane',
        'Seamstra',
        'Heddle',
        'Treadle',
        'Carder',
    ] },
    9:  { industry: 'Grain',         tier: 'forgotten', mentors: [
        'Threshing',
        'Chaffinch',
        'Sheafton',
        'Winnowa',
        'Milletine',
        'Barleycorn',
        'Ryeland',
        'Silone',
        'Busheline',
        'Gleanor',
        'Threshel',
        'Ryefield',
        'Threshold',
        'Harrowgate',
        'Combine',
        'Stubblefield',
    ] },
    10: { industry: 'Livestock',     tier: 'thin',      mentors: [
        'Byre',
        'Drovera',
        'Tallowin',
        'Brandt',
        'Daltone',
        'Brandywine',
        'Herd',
        'Cull',
        'Bridlewell',
        'Crook',
        'Hurdle',
        'Fleecewell',
    ] },
    11: { industry: 'Agriculture',   tier: 'modest',    mentors: [
        'Orchardine',
        'Stubble',
        'Gleanora',
        'Furrowa',
        'Seederling',
        'Chaffing',
        'Bramblewood',
        'Harvest',
        'Vinetta',
        'Pruner',
        'Hedgerow',
        'Picker',
    ] },
    12: { industry: 'Mining',        tier: 'forgotten', mentors: [
        'Firedamp',
        'Adit',
        'Gallery',
        'Canary',
        'Culmine',
        'Haymish',
        'Wickham',
        'Pitcairn',
        'Galenne',
        'Slatter',
        'Seamore',
        'Anthrax',
        'Marrowe',
        'Pitwright',
        'Lamptoon',
        'Putter',
    ] },
    // §1.1: the expanded Games. `GameConfig.districtCount` is documented as
    // 2-16 and the setup slider allows it, but 13-16 had no row in any of the
    // district tables — so they drew District 1's Career-flavoured names,
    // fell through to `{ industry: 'Unknown', tier: 'thin' }`, had no craft,
    // no archetype weighting (and therefore could never roll a Career), no
    // reaping crowd, and no district token, which silently disabled the
    // 'The Token' achievement for anyone reaped out of them.
    //
    // These are the outer territories: annexed late, worked hard, and sent to
    // the Games as an afterthought that the Capitol has not yet worked out how
    // to sell.
    13: { industry: 'Graphite and munitions', tier: 'forgotten', mentors: [
        'Graphia',
        'Casemate',
        'Primera',
        'Magazine',
        'Coriolane',
        'Petrine',
        'Fulmin',
        'Corditte',
        'Plumbago',
        'Bellonne',
        'Fusillade',
        'Gunner',
    ] },
    14: { industry: 'Salt and refrigeration', tier: 'thin',      mentors: [
        'Brinehild',
        'Rimewell',
        'Halite',
        'Coldstore',
        'Frostane',
        'Marlen',
        'Salinette',
        'Cellar',
        'Icehouse',
        'Rimefrost',
        'Chillwell',
        'Cryo',
    ] },
    15: { industry: 'Glassworks',             tier: 'forgotten', mentors: [
        'Culletta',
        'Anneala',
        'Frit',
        'Batch',
        'Silicane',
        'Silexa',
        'Prismo',
        'Lehr',
        'Furnace',
        'Annealer',
        'Batchhouse',
        'Blowpipe',
        'Parison',
        'Opalite',
        'Stemware',
        'Goblet',
    ] },
    16: { industry: 'Deepwater drilling',     tier: 'forgotten', mentors: [
        'Risera',
        'Derrickson',
        'Blowout',
        'Trawlen',
        'Rigger',
        'Trenchia',
        'Sonde',
        'Caissona',
        'Wellhead',
        'Roughneck',
        'Mudlogger',
        'Drillman',
    ] },
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
    /**
     * §(requests): the one skill this district's children are *already good at*
     * when they step off the train.
     *
     * `proficiencies` above is a nudge — 0.6 on a scale of 6, against a
     * `competentBand` of 2 — so a District 11 tribute who has picked fruit
     * since they could walk arrived a quarter of the way to "competent
     * forager" and read, on the tribute sheet, as having no band at all.
     * Sampled over 40 casts (1,280 tributes) before the change: mean starting
     * grade in the district's own signature skill 0.17, and *no* tribute in
     * the sample arrived with any skill at competent or better — the archetype
     * head start of 1.0 plus a 0.6 trade nudge cannot reach a band of 2, so
     * every tribute in every field started unbanded. Twelve years of doing one
     * thing every day
     * is worth more than that, and it is the cheapest way to make a district
     * read as a place rather than as a number on a jersey.
     *
     * One signature per district, floored at `competentBand` on arrival by
     * `blankProficiencies`, and deliberately *distinct* across all sixteen:
     * the signature is the district's fingerprint, while `proficiencies` stays
     * the broader (and overlapping) spread of what the trade also touches.
     *
     * The two Career districts deliberately do not get `melee` here. Their
     * edge is already the academy, the affinity table and `trainingMerit`, and
     * handing them the one axis that also feeds `combatPower` would compound
     * a lead the metrics already show at 11.3% (storied) against 2.8% (thin).
     * What D1 gets instead is the thing D1 actually is — a district that has
     * been selling itself to the Capitol its whole life.
     */
    signatureSkill?: Proficiency;
    /**
     * §(requests): the one weapon this district is *known* for.
     *
     * `affinityItems` says what a tribute is good with once they have it;
     * nothing said what they reach for. So District 4 fought better with a
     * trident and picked one up exactly as often as District 8 did, which
     * makes the trident a statistic rather than an identity. The signature is
     * the weapon a tribute gravitates to: it is weighted up in the scramble at
     * the horn, in what sponsors send, and in what the training floor puts
     * them in front of. It is always also in `affinityItems`, so gravitating
     * toward it and being good with it are the same fact.
     */
    signatureWeapon?: string;
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
    // §7: the Career districts get `hungerResilience` above 1 — the inverse of
    // what the outer districts get, and the counterweight their training score
    // never had. A tribute from the wealthiest district in Panem has never
    // missed a meal in their life, which is precisely why the Cornucopia
    // matters so much to them and why the pack falls apart once the supplies
    // are gone. The comment on `hungerResilience` in `survival.ts` already
    // said "District 12 rations better than District 1 does"; this is the
    // first version where that is literally true.
    1:  { proficiencies: { melee: TRADE }, signatureSkill: 'persuasion',                        signatureWeapon: 'sword', affinityItems: ['sword', 'machete', 'rapier', 'falchion'],   affinityClasses: ['melee'],            hungerResilience: 1.28, blurb: 'raised on fine steel and the academy floor, and never once hungry' },
    2:  { proficiencies: { melee: TRADE, tracking: TRADE_MINOR }, signatureSkill: 'intimidation', signatureWeapon: 'mace', affinityItems: ['mace', 'axe', 'sword', 'warhammer', 'halberd'], affinityClasses: ['melee'],          hungerResilience: 1.22, blurb: 'quarry work and the academy: heavy weapons, and the arm to use them' },
    3:  { proficiencies: { tracking: TRADE, medicine: TRADE_MINOR }, signatureSkill: 'signalling', signatureWeapon: 'bolas', affinityItems: ['wire', 'slingshot', 'bolas', 'crossbow'], affinityClasses: [],                 blurb: 'factory-raised: traps, wire, and an eye for how the arena is wired together' },
    // District 4 is a Career district that still works for a living, so it
    // sits between the two: the academy, but also the boats.
    4:  { proficiencies: { forage: TRADE, melee: TRADE_MINOR }, signatureSkill: 'swimming',   signatureWeapon: 'trident', affinityItems: ['trident', 'spear', 'harpoon', 'net'],    affinityClasses: ['thrown'],           hungerResilience: 1.08, blurb: 'a childhood on the boats: nets, gaffs, deep water, and the trident' },
    5:  { proficiencies: { tracking: TRADE }, signatureSkill: 'tracking',                     signatureWeapon: 'crossbow', affinityItems: ['wire', 'crossbow'],               affinityClasses: [],                   blurb: 'power-plant shifts: they read machinery the way others read weather' },
    6:  { proficiencies: { tracking: TRADE }, signatureSkill: 'navigation',                     signatureWeapon: 'whip', affinityItems: ['whip', 'bolas'],                     affinityClasses: [],                   blurb: 'transport yards: they know how to move and how not to be seen doing it' },
    7:  { proficiencies: { forage: TRADE_MINOR, melee: TRADE }, signatureSkill: 'climbing',   signatureWeapon: 'axe', affinityItems: ['axe', 'machete', 'throwing-axes', 'billhook'],     affinityClasses: ['melee'],            blurb: 'lumber crews: climbing, felling, and an axe that has never been a weapon until now' },
    8:  { proficiencies: { medicine: TRADE }, signatureSkill: 'medicine',                     signatureWeapon: 'garrote', affinityItems: ['wire', 'garrote', 'whip'],    affinityClasses: [],                   blurb: 'textile floors: fast hands, and they can dress a wound properly' },
    9:  { proficiencies: { forage: TRADE }, signatureSkill: 'fieldcookery',                       signatureWeapon: 'sickle', affinityItems: ['sickle', 'billhook', 'reedspear'],             affinityClasses: [],                   hungerResilience: 0.92, blurb: 'grain country: they know what is edible and what a lean year feels like' },
    // §3.3: D10 was the weakest row in the table (no resilience, no affinity
    // class, two minor skills) and won 0.8% of runs — those two facts are the
    // same fact. Stockyard work is butchery: a real blade trade, the stomach
    // for close work, and animals do not feed themselves in a lean winter.
    10: { proficiencies: { medicine: TRADE_MINOR, melee: TRADE }, signatureSkill: 'butchery',     signatureWeapon: 'cleaver', affinityItems: ['sickle', 'knife', 'machete', 'cleaver', 'boarspear'], affinityClasses: ['melee'], hungerResilience: 0.95, blurb: 'stockyards: unsqueamish, steady with a blade, and used to a struggling animal' },
    11: { proficiencies: { forage: TRADE, medicine: TRADE_MINOR }, signatureSkill: 'forage', signatureWeapon: 'slingshot', affinityItems: ['sickle', 'slingshot', 'billhook'], affinityClasses: [],                 hungerResilience: 0.9,  blurb: 'orchard work: they know on sight which plants will kill them' },
    12: { proficiencies: { forage: TRADE_MINOR, tracking: TRADE_MINOR }, signatureSkill: 'stealth', signatureWeapon: 'bow', affinityItems: ['knife', 'bow', 'dagger'],       affinityClasses: [],                   hungerResilience: 0.82, blurb: 'the Seam: poaching, the mines, and a lifetime of being hungry' },
    // §1.1: the expanded Games territories. Written as real trades rather
    // than filler, because `craftOf` returning an empty craft is the
    // difference between a district and a number.
    13: { proficiencies: { tracking: TRADE, medicine: TRADE_MINOR }, signatureSkill: 'ranged', signatureWeapon: 'dagger', affinityItems: ['wire', 'knife', 'dagger', 'crossbow'],   affinityClasses: [],                   hungerResilience: 0.86, blurb: 'graphite pits and shell lines: steady hands, bad lungs, and a working knowledge of what goes bang' },
    14: { proficiencies: { forage: TRADE_MINOR, melee: TRADE }, signatureSkill: 'pacing',   signatureWeapon: 'kukri', affinityItems: ['machete', 'knife', 'kukri', 'cleaver'],   affinityClasses: ['melee'],            hungerResilience: 1.05, blurb: 'the salt flats and the cold rooms: hard labour, hard water, and meat that keeps' },
    15: { proficiencies: { medicine: TRADE_MINOR, tracking: TRADE_MINOR }, signatureSkill: 'crafting', signatureWeapon: 'rapier', affinityItems: ['knife', 'garrote', 'glass-shiv', 'rapier'], affinityClasses: [],             hungerResilience: 0.9,  blurb: 'the glassworks: heat, patience, and an intimate understanding of how things shatter' },
    16: { proficiencies: { forage: TRADE, melee: TRADE_MINOR }, signatureSkill: 'carpentry',   signatureWeapon: 'gaff', affinityItems: ['spear', 'gaff', 'trident', 'harpoon', 'javelin'], affinityClasses: ['thrown'],      hungerResilience: 0.88, blurb: 'the deepwater rigs: months offshore, and nothing to eat that they did not pull out of the sea themselves' },
};

export function craftOf(district: number): DistrictCraft {
    return DISTRICT_CRAFT[district] ?? { proficiencies: {}, affinityItems: [], affinityClasses: [], blurb: 'no trade the arena cares about' };
}
