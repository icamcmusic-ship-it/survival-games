import { ArchetypeId, Attributes, Objective, Stance } from '../models/types';

/**
 * A2: an archetype is a character, not a modifier row.
 *
 * The old shape was four scalars plus a stat bias, which is why the measured
 * win rates clustered so tightly: seven archetypes drawing from the same four
 * dials can only ever differ by degree. The hooks below let an archetype
 * differ in *kind* — who it picks a fight with, how its caution moves across a
 * run, which stances it reaches for, and the one beat per run that makes it
 * recognisable on camera.
 */
export interface ArchetypeDef {
    id: ArchetypeId;
    name: string;
    description: string;
    statBias: Partial<Attributes>;
    preferredTraits: string[];
    // Behavior weights, all roughly -0.3..+0.4 modifiers on base chances
    aggression: number;       // seeks fights (bloodbath, hunting stance)
    allianceAffinity: number; // forms/keeps alliances
    treachery: number;        // betrays alliances
    caution: number;          // avoids dangerous zones, flees when hurt

    // ---- behavioural hooks ----
    /** Direct pull toward or away from particular stances. */
    stanceBias?: Partial<Record<Stance, number>>;
    /** Pull toward particular standing intentions when objectives are chosen. */
    objectiveBias?: Partial<Record<Objective['kind'], number>>;
    /** Who they go for when they have a choice. */
    targetPreference?: 'weakest' | 'strongest' | 'nearest' | 'richest' | 'rival';
    /**
     * How caution moves with the day count. `flat` never wavers, `escalating`
     * gets warier as the field narrows, `front-loaded` spends everything early
     * and settles afterwards.
     */
    riskCurve?: 'flat' | 'escalating' | 'front-loaded';
    /**
     * The once-per-run archetype beat, keyed into `ARCHETYPE_SIGNATURES` in
     * `engine/archetypeHooks.ts`. Career already effectively had one (the
     * pack); nobody else did, and it is most of what makes an archetype
     * memorable rather than merely statistical.
     */
    signature?: string;
    /** Seeds backstory dislike at the reaping. */
    hatesArchetypes?: ArchetypeId[];
    /** Sponsor-facing: how the Capitol markets them. */
    tagline?: string;
}

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDef> = {
    career: {
        id: 'career',
        name: 'Career',
        description: 'Trained for the Games since childhood. Hunts in packs and dominates the bloodbath.',
        // §7: this used to stack on top of the Career districts' own raw
        // attribute head start (generator.ts) rather than substituting for
        // it, and the `career` archetype itself is what 7-8 out of ~14 total
        // weight in D1/D2 rolls — so most Career-district tributes were
        // getting the district bonus, the archetype bonus, weapon affinity,
        // and the pack numbers bonus all at once. Trimmed here rather than in
        // the district table, since this is the piece that was genuinely
        // redundant with it.
        statBias: { strength: 1, agility: 1 },
        preferredTraits: ['Bloodthirsty', 'Brute'],
        aggression: 0.25,
        allianceAffinity: 0.2,
        treachery: 0.15,
        caution: -0.2,
        stanceBias: { Aggressive: 0.6, Hunting: 0.5, Evasive: -0.8 },
        objectiveBias: { hunt: 0.4, hold: 0.2 },
        targetPreference: 'weakest',
        riskCurve: 'front-loaded',
        signature: 'careerDeclaration',
        hatesArchetypes: ['underdog', 'ghost'],
        tagline: 'Bred for it.',
    },
    strategist: {
        id: 'strategist',
        name: 'Strategist',
        description: 'Wins with the mind, not the blade. Picks fights only when the odds are stacked.',
        statBias: { intelligence: 2, charisma: 1 },
        preferredTraits: ['Strategist', 'Eagle-Eyed'],
        aggression: -0.1,
        allianceAffinity: 0.15,
        treachery: 0.25,
        caution: 0.2,
        stanceBias: { Fortified: 0.6, Shadowing: 0.4, Desperate: -0.5 },
        objectiveBias: { hold: 0.4, reach: 0.2 },
        targetPreference: 'weakest',
        riskCurve: 'escalating',
        signature: 'strategistGambit',
        tagline: 'Counts the board.',
    },
    survivalist: {
        id: 'survivalist',
        name: 'Survivalist',
        description: 'Lives off the land and outlasts everyone. Avoids fights, never starves.',
        statBias: { stealth: 2, intelligence: 1 },
        preferredTraits: ['Tracker', 'Iron Stomach', 'Hydrophilic'],
        aggression: -0.2,
        allianceAffinity: -0.1,
        treachery: -0.1,
        caution: 0.3,
        stanceBias: { Defensive: 0.5, Evasive: 0.3, Scavenging: 0.3 },
        objectiveBias: { reach: 0.3, survive: 0.3 },
        targetPreference: 'nearest',
        riskCurve: 'flat',
        signature: 'survivalistLarder',
        tagline: 'Outlasts the arena.',
    },
    protector: {
        id: 'protector',
        name: 'Protector',
        description: 'Fights hardest for others. Loyal to a fault and beloved by sponsors.',
        statBias: { strength: 1, charisma: 1 },
        preferredTraits: ['Pacifist', 'Charismatic'],
        aggression: -0.05,
        allianceAffinity: 0.35,
        treachery: -0.3,
        caution: 0.05,
        stanceBias: { Defensive: 0.7, Fortified: 0.4 },
        objectiveBias: { protect: 0.6 },
        targetPreference: 'strongest',
        riskCurve: 'flat',
        signature: 'protectorStand',
        hatesArchetypes: ['saboteur', 'mercenary'],
        tagline: 'Stands in front.',
    },
    trickster: {
        id: 'trickster',
        name: 'Trickster',
        description: 'Traps, ambushes, and broken promises. Nobody sees them coming — twice.',
        statBias: { stealth: 1, agility: 1, intelligence: 1 },
        preferredTraits: ['Pyromaniac', 'Nimble', 'Paranoid'],
        aggression: 0.15,
        allianceAffinity: 0.1,
        treachery: 0.35,
        caution: 0.1,
        stanceBias: { Shadowing: 0.6, Fortified: 0.4, Aggressive: -0.2 },
        objectiveBias: { hold: 0.3, hunt: 0.2 },
        targetPreference: 'richest',
        riskCurve: 'escalating',
        signature: 'tricksterSnare',
        tagline: 'Nobody sees them twice.',
    },
    wildcard: {
        id: 'wildcard',
        name: 'Wildcard',
        description: 'Unpredictable and volatile. Even the Gamemakers cannot model their next move.',
        statBias: { agility: 1 },
        preferredTraits: ['Insomniac', 'Clumsy', 'Pyromaniac'],
        aggression: 0.2,
        allianceAffinity: 0.0,
        treachery: 0.2,
        caution: -0.1,
        stanceBias: { Desperate: 0.6, Aggressive: 0.3, Fortified: -0.4 },
        targetPreference: 'nearest',
        riskCurve: 'flat',
        signature: 'wildcardTurn',
        tagline: 'Unmodellable.',
    },
    underdog: {
        id: 'underdog',
        name: 'Underdog',
        description: 'Overlooked and underestimated. Survives on grit, luck, and the crowd\'s sympathy.',
        statBias: { charisma: 1, stealth: 1 },
        preferredTraits: ['Light Sleeper', 'Nimble'],
        aggression: -0.15,
        allianceAffinity: 0.2,
        treachery: -0.15,
        caution: 0.25,
        stanceBias: { Evasive: 0.4, Scavenging: 0.5, Shadowing: 0.2 },
        objectiveBias: { survive: 0.3, flee: 0.2 },
        targetPreference: 'weakest',
        riskCurve: 'escalating',
        signature: 'underdogRefusal',
        hatesArchetypes: ['career'],
        tagline: 'Written off.',
    },

    // ---- A2: eight archetypes built on the hooks rather than the scalars ----

    mercenary: {
        id: 'mercenary',
        name: 'Mercenary',
        description: 'Allies for payment, not affection. Charges a price to stand with you, and leaves the cycle the cache runs dry.',
        statBias: { strength: 1, charisma: 1 },
        preferredTraits: ['Brute', 'Charismatic'],
        aggression: 0.15,
        allianceAffinity: 0.25,
        treachery: 0.3,
        caution: 0.0,
        stanceBias: { Scavenging: 0.5, Aggressive: 0.3 },
        objectiveBias: { hunt: 0.2, reach: 0.2 },
        targetPreference: 'richest',
        riskCurve: 'flat',
        signature: 'mercenaryContract',
        hatesArchetypes: ['zealot', 'protector'],
        tagline: 'Everything has a price.',
    },
    zealot: {
        id: 'zealot',
        name: 'Zealot',
        description: 'Believes the Games mean something. Does not frighten, does not break, and does not stop.',
        statBias: { strength: 1, charisma: 1 },
        preferredTraits: ['Bloodthirsty', 'Charismatic'],
        aggression: 0.3,
        allianceAffinity: -0.05,
        treachery: -0.1,
        caution: -0.3,
        stanceBias: { Aggressive: 0.5, Desperate: 0.8, Evasive: -1.2 },
        objectiveBias: { hunt: 0.4 },
        targetPreference: 'strongest',
        riskCurve: 'flat',
        signature: 'zealotSermon',
        hatesArchetypes: ['mercenary', 'ghost'],
        tagline: 'It means something.',
    },
    medic: {
        id: 'medic',
        name: 'Medic',
        description: 'The reason an alliance holds together. Doubles field-dressing for the people around them; terrible alone.',
        statBias: { intelligence: 2, charisma: 1 },
        preferredTraits: ['Herbalist', 'Charismatic'],
        aggression: -0.25,
        allianceAffinity: 0.4,
        treachery: -0.35,
        caution: 0.2,
        stanceBias: { Defensive: 0.8, Fortified: 0.3, Aggressive: -0.6 },
        objectiveBias: { protect: 0.5, hold: 0.2 },
        targetPreference: 'nearest',
        riskCurve: 'escalating',
        signature: 'medicTriage',
        tagline: 'Keeps them standing.',
    },
    saboteur: {
        id: 'saboteur',
        name: 'Saboteur',
        description: 'Does not fight. Poisons caches, springs other people\'s traps, and takes the bridge out behind them.',
        statBias: { intelligence: 2, stealth: 1 },
        preferredTraits: ['Pyromaniac', 'Paranoid'],
        aggression: -0.1,
        allianceAffinity: -0.05,
        treachery: 0.3,
        caution: 0.2,
        stanceBias: { Fortified: 0.7, Shadowing: 0.5, Aggressive: -0.7 },
        objectiveBias: { hold: 0.4 },
        targetPreference: 'richest',
        riskCurve: 'flat',
        signature: 'saboteurStrike',
        hatesArchetypes: ['career'],
        tagline: 'Breaks the board, not the pieces.',
    },
    beast: {
        id: 'beast',
        name: 'Beast',
        description: 'A tribute the arena made rather than a district. Unarmed and terrifying; no capacity for company at all.',
        statBias: { strength: 3, intelligence: -2 },
        preferredTraits: ['Brute', 'Bloodthirsty'],
        aggression: 0.35,
        allianceAffinity: -0.4,
        treachery: 0.1,
        caution: -0.25,
        stanceBias: { Aggressive: 0.7, Hunting: 0.5, Desperate: 0.5, Defensive: -0.6 },
        objectiveBias: { hunt: 0.5 },
        targetPreference: 'nearest',
        riskCurve: 'front-loaded',
        signature: 'beastRoar',
        tagline: 'Underestimated on paper.',
    },
    diplomat: {
        id: 'diplomat',
        name: 'Diplomat',
        description: 'Talks people out of it. Brokers truces between others as easily as for themselves — and their death dissolves every one of them.',
        statBias: { charisma: 3, intelligence: 1 },
        preferredTraits: ['Charismatic', 'Strategist'],
        aggression: -0.25,
        allianceAffinity: 0.35,
        treachery: -0.05,
        caution: 0.2,
        stanceBias: { Defensive: 0.6, Evasive: 0.2, Aggressive: -0.6 },
        objectiveBias: { protect: 0.3, reach: 0.2 },
        targetPreference: 'nearest',
        riskCurve: 'escalating',
        signature: 'diplomatAccord',
        hatesArchetypes: ['zealot'],
        tagline: 'Nobody has to die today.',
    },
    scholar: {
        id: 'scholar',
        name: 'Scholar',
        description: 'Reads the arena rather than the tributes. Knows what a zone is about to do a cycle before it does it.',
        statBias: { intelligence: 3 },
        preferredTraits: ['Strategist', 'Eagle-Eyed'],
        aggression: -0.2,
        allianceAffinity: 0.1,
        treachery: 0.05,
        caution: 0.25,
        stanceBias: { Defensive: 0.4, Evasive: 0.3, Scavenging: 0.3 },
        objectiveBias: { reach: 0.4 },
        targetPreference: 'weakest',
        riskCurve: 'flat',
        signature: 'scholarReading',
        tagline: 'Reads the arena.',
    },
    ghost: {
        id: 'ghost',
        name: 'Ghost',
        description: 'Never seen. The crowd cannot love what it cannot find, and the Gamemakers hate that more than anything.',
        statBias: { stealth: 3, agility: 1 },
        preferredTraits: ['Unremarkable', 'Nimble'],
        aggression: -0.3,
        allianceAffinity: -0.25,
        treachery: 0.0,
        caution: 0.35,
        stanceBias: { Evasive: 0.8, Shadowing: 0.9, Aggressive: -1.0 },
        objectiveBias: { survive: 0.4 },
        targetPreference: 'weakest',
        riskCurve: 'flat',
        signature: 'ghostNaming',
        hatesArchetypes: ['career'],
        tagline: 'Nobody has footage.',
    },
};

/**
 * Archetype weighting by district.
 *
 * This used to be an if/chance cascade — `if (district === 3 && rng.chance(0.4))`
 * — which meant adding a district flavour or a new archetype required editing
 * control flow rather than data. A weight table says the same thing in a form
 * you can extend, read at a glance, and reason about probabilistically.
 */
export type ArchetypeWeights = Partial<Record<ArchetypeId, number>>;

const BASE_WEIGHTS: ArchetypeWeights = {
    strategist: 1,
    survivalist: 1,
    protector: 1,
    trickster: 1,
    wildcard: 1,
    underdog: 1,
    // A2: the eight added archetypes sit at a lower baseline than the original
    // seven on purpose. They are meant to be *distinctive* rather than common
    // — an arena with two Beasts and two Ghosts in it stops reading as a
    // Reaping and starts reading as a bestiary.
    mercenary: 0.4,
    zealot: 0.4,
    medic: 0.4,
    saboteur: 0.4,
    beast: 0.25,
    diplomat: 0.4,
    scholar: 0.4,
    ghost: 0.4,
};

/** Career districts train for it; everyone else is shaped by their industry. */
export const DISTRICT_ARCHETYPE_WEIGHTS: Record<number, ArchetypeWeights> = {
    1:  { career: 7, trickster: 1.5, strategist: 1, diplomat: 1.2 },
    2:  { career: 8, protector: 1.5, wildcard: 1, zealot: 1.5 },
    3:  { strategist: 4, trickster: 2, underdog: 1.5, saboteur: 1.5, scholar: 1.5 },
    4:  { career: 6, survivalist: 2, protector: 1.5, medic: 1.2 },
    5:  { strategist: 2.5, trickster: 2, wildcard: 1.5, mercenary: 1.5, scholar: 1.5 },
    6:  { wildcard: 2.5, underdog: 2, trickster: 1.5, mercenary: 1.5, ghost: 1.5 },
    7:  { protector: 2.5, survivalist: 2, wildcard: 1.5, beast: 1.2 },
    8:  { underdog: 2.5, trickster: 2, protector: 1.5, saboteur: 1.5 },
    9:  { survivalist: 2.5, underdog: 2, protector: 1.5, ghost: 1.5 },
    10: { protector: 2.5, survivalist: 2, wildcard: 1.5, beast: 1.2 },
    11: { survivalist: 3.5, underdog: 2.5, protector: 1.5, zealot: 1.2, medic: 1.5 },
    12: { survivalist: 3, underdog: 3, trickster: 1.5, diplomat: 1.2, ghost: 1.5 },
    // §1.1: the expanded Games. Districts 13-16 previously had no entry at all,
    // so they fell through to the bare baseline and could never roll a Career
    // — a documented, slider-reachable configuration with an unwritten cast.
    13: { survivalist: 3, saboteur: 2.5, strategist: 2, scholar: 1.5 },
    14: { career: 3, mercenary: 2.5, wildcard: 2, beast: 1.2 },
    15: { protector: 2.5, medic: 2, underdog: 2, zealot: 1.5 },
    16: { ghost: 2.5, trickster: 2, survivalist: 2, diplomat: 1.5 },
};

/**
 * A2: the shape of the year itself pulls on the draw.
 *
 * A "Career-heavy" Games and a "no-pack" Games drew identical archetype mixes
 * before this, which made the cast-shape flag a label on the profile card
 * rather than something the reader could see in the roster.
 */
export const CAST_SHAPE_ARCHETYPE_WEIGHTS: Record<string, ArchetypeWeights> = {
    careerHeavy: { career: 3, zealot: 1, mercenary: 0.8, ghost: -0.2 },
    noPack: { career: -6, underdog: 1.5, ghost: 1.2, survivalist: 1, saboteur: 0.8 },
    young: { underdog: 2, ghost: 1, protector: 1, beast: -0.15 },
    veteran: { strategist: 1.5, scholar: 1.2, mercenary: 1, career: 1 },
    volunteerHeavy: { career: 2, zealot: 1.5, protector: 1.2 },
    brutal: { beast: 1, zealot: 1.2, career: 1, medic: -0.2 },
};

/**
 * Merged weights for a district, with the shared baseline underneath and the
 * year's cast shape on top.
 */
export function archetypeWeightsFor(district: number, castShape?: string): Array<[ArchetypeId, number]> {
    const merged: ArchetypeWeights = { ...BASE_WEIGHTS };
    const layer = (weights: ArchetypeWeights) => {
        (Object.entries(weights) as Array<[ArchetypeId, number]>).forEach(([id, w]) => {
            merged[id] = (merged[id] ?? 0) + w;
        });
    };
    layer(DISTRICT_ARCHETYPE_WEIGHTS[district] || {});
    if (castShape && CAST_SHAPE_ARCHETYPE_WEIGHTS[castShape]) layer(CAST_SHAPE_ARCHETYPE_WEIGHTS[castShape]);
    return (Object.entries(merged) as Array<[ArchetypeId, number]>).filter(([, w]) => w > 0);
}

// Pairs that get a bonus when considering an alliance
const COMPATIBLE: Array<[ArchetypeId, ArchetypeId]> = [
    ['career', 'career'],
    ['protector', 'underdog'],
    ['strategist', 'trickster'],
    ['survivalist', 'survivalist'],
    ['protector', 'protector'],
    ['strategist', 'protector'],
    // A2: the new roster's natural pairings. A Medic is the reason an alliance
    // holds; a Diplomat is the reason it forms in the first place.
    ['medic', 'protector'],
    ['medic', 'underdog'],
    ['medic', 'diplomat'],
    ['diplomat', 'protector'],
    ['diplomat', 'scholar'],
    ['scholar', 'strategist'],
    ['saboteur', 'trickster'],
    ['mercenary', 'career'],
    ['zealot', 'career'],
    ['ghost', 'survivalist'],
];

export function archetypeCompatibility(a: ArchetypeId, b: ArchetypeId): number {
    if (COMPATIBLE.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return 0.15;
    // Declared antipathy is the mirror of it: two archetypes who read each
    // other wrong before they have exchanged a word. Seeds the training-floor
    // altercations (A4) as well as the alliance roll.
    if ((ARCHETYPES[a].hatesArchetypes ?? []).includes(b)
        || (ARCHETYPES[b].hatesArchetypes ?? []).includes(a)) return -0.2;
    return 0;
}

/** True when the two archetypes have a reason to dislike each other on sight. */
export function archetypeAntipathy(a: ArchetypeId, b: ArchetypeId): boolean {
    return (ARCHETYPES[a]?.hatesArchetypes ?? []).includes(b)
        || (ARCHETYPES[b]?.hatesArchetypes ?? []).includes(a);
}
