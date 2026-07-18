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
        statBias: { strength: 2, agility: 1 },
        preferredTraits: ['Bloodthirsty', 'Brute'],
        aggression: 0.35,
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

// Pairs that get a bonus when considering an alliance
const COMPATIBLE: Array<[ArchetypeId, ArchetypeId]> = [
    ['career', 'career'],
    ['protector', 'underdog'],
    ['strategist', 'trickster'],
    ['survivalist', 'survivalist'],
    ['protector', 'protector'],
    ['strategist', 'protector'],
];

export function archetypeCompatibility(a: ArchetypeId, b: ArchetypeId): number {
    return COMPATIBLE.some(([x, y]) => (x === a && y === b) || (x === b && y === a)) ? 0.15 : 0;
}
