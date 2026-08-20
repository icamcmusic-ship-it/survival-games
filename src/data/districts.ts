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
