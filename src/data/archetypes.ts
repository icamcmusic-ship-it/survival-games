import { ArchetypeDef, ArchetypeModifiers, Tribute } from '../models/types';

export const ARCHETYPES: ArchetypeDef[] = [
    {
        id: 'berserker',
        name: 'Berserker',
        description: 'Fights with reckless, overwhelming aggression.',
        modifiers: { combatPower: 3, sanityDrainMod: 3, sponsorAppeal: 4 },
    },
    {
        id: 'trapper',
        name: 'Trapper',
        description: 'Prefers to let the arena do the killing.',
        modifiers: { hazardSurvivalBonus: 3, combatPower: 1 },
    },
    {
        id: 'medic',
        name: 'Medic',
        description: 'Trained in field triage and survival medicine.',
        modifiers: { sanityDrainMod: -2, sponsorAppeal: 3, hazardSurvivalBonus: 1 },
    },
    {
        id: 'silent-predator',
        name: 'Silent Predator',
        description: 'Strikes from the shadows before anyone notices.',
        modifiers: { combatPower: 2, hazardSurvivalBonus: 2 },
    },
    {
        id: 'survivalist',
        name: 'Survivalist',
        description: 'Can wring resources out of almost anything.',
        modifiers: { sanityDrainMod: -3, hazardSurvivalBonus: 2 },
    },
    {
        id: 'charmer',
        name: 'Charmer',
        description: 'Captivates sponsors and rivals alike.',
        modifiers: { sponsorAppeal: 6, interviewBonus: 2 },
    },
    {
        id: 'tactician',
        name: 'Tactician',
        description: 'Reads the arena like a battlefield map.',
        modifiers: { combatPower: 1, trainingBonus: 2, interviewBonus: 1 },
    },
    {
        id: 'scavenger',
        name: 'Scavenger',
        description: 'Never comes back from a search empty-handed.',
        modifiers: { sponsorAppeal: 2, hazardSurvivalBonus: 1 },
    },
    {
        id: 'saboteur',
        name: 'Saboteur',
        description: 'Undermines alliances and traps from within.',
        modifiers: { combatPower: 2, sanityDrainMod: 1 },
    },
    {
        id: 'showboat',
        name: 'Showboat',
        description: 'Plays every moment for the cameras.',
        modifiers: { sponsorAppeal: 5, trainingBonus: 1, sanityDrainMod: 1 },
    },
];

export const ARCHETYPE_BY_ID: Record<string, ArchetypeDef> = Object.fromEntries(
    ARCHETYPES.map(a => [a.id, a])
);

const SECONDARY_WEIGHT = 0.5;

export function getArchetypeModifiers(tribute: Pick<Tribute, 'archetype' | 'secondaryArchetypes'>): Required<ArchetypeModifiers> {
    const total: Required<ArchetypeModifiers> = {
        combatPower: 0,
        sponsorAppeal: 0,
        sanityDrainMod: 0,
        trainingBonus: 0,
        interviewBonus: 0,
        hazardSurvivalBonus: 0,
    };

    const add = (mods: ArchetypeModifiers, weight: number) => {
        (Object.keys(total) as Array<keyof ArchetypeModifiers>).forEach(key => {
            total[key] += (mods[key] || 0) * weight;
        });
    };

    const primary = ARCHETYPE_BY_ID[tribute.archetype];
    if (primary) add(primary.modifiers, 1);

    tribute.secondaryArchetypes.forEach(id => {
        const secondary = ARCHETYPE_BY_ID[id];
        if (secondary) add(secondary.modifiers, SECONDARY_WEIGHT);
    });

    return total;
}
