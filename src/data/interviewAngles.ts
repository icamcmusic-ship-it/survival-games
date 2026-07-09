export interface InterviewAngle {
    id: string;
    name: string;
    charismaBonus: number;
    trustMultiplier: number;
}

export const INTERVIEW_ANGLES: InterviewAngle[] = [
    { id: 'aggressive', name: 'Aggressive', charismaBonus: 1, trustMultiplier: 1.15 },
    { id: 'humble', name: 'Humble', charismaBonus: 0, trustMultiplier: 1.3 },
    { id: 'mysterious', name: 'Mysterious', charismaBonus: -1, trustMultiplier: 1.4 },
    { id: 'charming', name: 'Charming', charismaBonus: 2, trustMultiplier: 1.1 },
];

export const ARCHETYPE_ANGLE_AFFINITY: Record<string, string> = {
    'berserker': 'aggressive',
    'trapper': 'mysterious',
    'medic': 'humble',
    'silent-predator': 'mysterious',
    'survivalist': 'humble',
    'charmer': 'charming',
    'tactician': 'mysterious',
    'scavenger': 'humble',
    'saboteur': 'mysterious',
    'showboat': 'charming',
};
