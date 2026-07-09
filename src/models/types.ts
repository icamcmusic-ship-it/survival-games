export type Gender = 'Male' | 'Female';
export type Stance = 'Aggressive' | 'Defensive' | 'Evasive';

export interface Attributes {
    strength: number;
    agility: number;
    intelligence: number;
    charisma: number;
    stealth: number;
}

export interface Vitals {
    hunger: number; // 0-100, 100 is starving
    thirst: number; // 0-100, 100 is dehydrated
    fatigue: number; // 0-100, 100 is exhausted
    sanity: number; // 0-100, 0 is insane
}

export interface ArchetypeModifiers {
    combatPower?: number; // added to power roll in combat resolution
    sponsorAppeal?: number; // added to sponsor gift chance (percentage points)
    sanityDrainMod?: number; // added to base per-turn sanity drain (negative = drains less)
    trainingBonus?: number; // added to training score
    interviewBonus?: number; // added to interview success roll
    hazardSurvivalBonus?: number; // reduces chance of taking full hazard/mutt damage
}

export interface ArchetypeDef {
    id: string;
    name: string;
    description: string;
    modifiers: ArchetypeModifiers;
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
    concussed: boolean;
    exhausted: boolean;
}

export type WeaponSubtype = 'melee' | 'ranged' | 'thrown';

export interface Item {
    id: string;
    name: string;
    type: 'weapon' | 'food' | 'water' | 'medical' | 'utility';
    subtype?: WeaponSubtype;
    durability?: number;
    spoilage?: number;
    value: number;
}

export type Build = 'Frail' | 'Slight' | 'Average' | 'Athletic' | 'Stocky' | 'Muscular';

export interface Tribute {
    id: string;
    district: number;
    gender: Gender;
    name: string;
    age: number;
    heightCm: number;
    build: Build;
    isCareer: boolean;
    attributes: Attributes;
    traits: string[];
    archetype: string;
    secondaryArchetypes: string[];
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
    dayOfDeath?: number;
    zone: string;
    allianceId?: string;
}

export interface Arena {
    id: string;
    name: string;
    description: string;
    mutts: string[];
    events: string[];
    zones: string[];
}

export type Phase = 'setup' | 'roster' | 'reaping' | 'training' | 'interviews' | 'bloodbath' | 'day' | 'night' | 'feast' | 'epilogue' | 'ended';

export interface GameConfig {
    districtCount: number; // 1-12, each district reaps 2 tributes
    hazardRate: number; // multiplier on random event/mutt attack chance
    betrayalRate: number; // multiplier on alliance betrayal chance
    sponsorGenerosity: number; // multiplier on sponsor gift chance
    enableFeast: boolean;
    enableSanity: boolean;
}

export interface GameState {
    seed: string;
    arena: Arena;
    tributes: Tribute[];
    phase: Phase;
    day: number;
    log: EventLog[];
    gamemakerMode: boolean;
    config: GameConfig;
    collapsedZones?: string[];
    epilogueInterview?: EpilogueQA[];
}

export interface EventLog {
    id: string;
    day: number;
    phase: Phase;
    text: string;
    tributesInvolved: string[];
    important: boolean;
    zone?: string;
}

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
    winnerName: string;
    winnerDistrict: number;
    kills: number;
    date: string;
    winnerTraits?: string[];
    winnerEndHealth?: number;
    tributeSummaries?: TributeHoFSummary[];
}
