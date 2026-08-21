import { ArchetypeId, Attributes } from '../models/types';

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
    },
    showman: {
        id: 'showman',
        name: 'Showman',
        description: 'Plays to the cameras before anything else. Sponsors love them; the arena is unmoved.',
        statBias: { charisma: 2, agility: 1 },
        preferredTraits: ['Showman', 'Charismatic', 'Silver-Tongued'],
        aggression: 0.05,
        allianceAffinity: 0.3,
        treachery: 0.1,
        caution: 0.0,
    },
    pacifist: {
        id: 'pacifist',
        name: 'Pacifist',
        description: 'Will not raise a hand, and has to survive an arena built on the assumption that everyone will.',
        statBias: { intelligence: 1, stealth: 1, charisma: 1 },
        preferredTraits: ['Pacifist', 'Herbalist', 'Softhearted'],
        aggression: -0.35,
        allianceAffinity: 0.25,
        treachery: -0.35,
        caution: 0.35,
    },
    scavenger: {
        id: 'scavenger',
        name: 'Scavenger',
        description: 'Was already living on what other people left. The arena is a harder version of a familiar problem.',
        statBias: { stealth: 1, agility: 1 },
        preferredTraits: ['Scavenger', 'Iron Stomach', 'Hoarder'],
        aggression: -0.1,
        allianceAffinity: -0.05,
        treachery: 0.1,
        caution: 0.2,
    },
    zealot: {
        id: 'zealot',
        name: 'Zealot',
        description: 'Has decided the Capitol is the enemy, and behaves as though the other tributes are not the point.',
        statBias: { strength: 1, intelligence: 1 },
        preferredTraits: ['Vengeful', 'Ruthless'],
        aggression: 0.15,
        allianceAffinity: 0.15,
        treachery: -0.2,
        caution: -0.15,
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
    // §8.2: the four newer archetypes sit slightly below the originals in the
    // baseline. They are meant to be the ones a player notices when they turn
    // up, not four more even slices of the same pie.
    showman: 0.7,
    // Kept the rarest of the four: a tribute who will not raise a hand is a
    // strong story and a direct push on the "victors with zero kills"
    // indicator, which the design goal wants *lower*, not higher.
    pacifist: 0.35,
    scavenger: 0.8,
    zealot: 0.6,
};

/** Career districts train for it; everyone else is shaped by their industry. */
export const DISTRICT_ARCHETYPE_WEIGHTS: Record<number, ArchetypeWeights> = {
    1:  { career: 7, trickster: 1.5, strategist: 1, showman: 2 },
    2:  { career: 8, protector: 1.5, wildcard: 1, zealot: 1 },
    3:  { strategist: 4, trickster: 2, underdog: 1.5, scavenger: 1 },
    4:  { career: 6, survivalist: 2, protector: 1.5, showman: 1.5 },
    5:  { strategist: 2.5, trickster: 2, wildcard: 1.5, scavenger: 1 },
    6:  { wildcard: 2.5, underdog: 2, trickster: 1.5, scavenger: 2 },
    7:  { protector: 2.5, survivalist: 2, wildcard: 1.5, zealot: 1 },
    8:  { underdog: 2.5, trickster: 2, protector: 1.5, pacifist: 1.5, zealot: 1.5 },
    9:  { survivalist: 2.5, underdog: 2, protector: 1.5, scavenger: 1.5 },
    10: { protector: 2.5, survivalist: 2, wildcard: 1.5, scavenger: 1 },
    11: { survivalist: 3.5, underdog: 2.5, protector: 1.5, pacifist: 1.5 },
    12: { survivalist: 3, underdog: 3, trickster: 1.5, scavenger: 2, zealot: 1 },
};

/** Merged weights for a district, with the shared baseline underneath. */
export function archetypeWeightsFor(district: number): Array<[ArchetypeId, number]> {
    const merged: ArchetypeWeights = { ...BASE_WEIGHTS };
    const districtWeights = DISTRICT_ARCHETYPE_WEIGHTS[district] || {};
    (Object.entries(districtWeights) as Array<[ArchetypeId, number]>).forEach(([id, w]) => {
        merged[id] = (merged[id] ?? 0) + w;
    });
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
    // The newer four, paired with whoever they plausibly need: somebody who
    // will not fight wants somebody who will, a showman wants an audience and
    // a foil, a scavenger wants someone who knows the ground, and a zealot
    // wants anyone who will listen.
    ['pacifist', 'protector'],
    ['showman', 'career'],
    ['showman', 'underdog'],
    ['scavenger', 'survivalist'],
    ['zealot', 'underdog'],
    ['zealot', 'zealot'],
];

export function archetypeCompatibility(a: ArchetypeId, b: ArchetypeId): number {
    return COMPATIBLE.some(([x, y]) => (x === a && y === b) || (x === b && y === a)) ? 0.15 : 0;
}
