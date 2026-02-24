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

export interface Injuries {
    head: boolean;
    torso: boolean;
    arms: boolean;
    legs: boolean;
    bleeding: boolean;
    infected: boolean;
}

export interface Item {
    id: string;
    name: string;
    type: 'weapon' | 'food' | 'water' | 'medical' | 'utility';
    durability?: number;
    spoilage?: number;
    value: number;
}

export interface Tribute {
    id: string;
    district: number;
    gender: Gender;
    name: string;
    isCareer: boolean;
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
    dayOfDeath?: number;
    zone: string;
}

export interface Arena {
    id: string;
    name: string;
    description: string;
    mutts: string[];
    events: string[];
    zones: string[];
}

export type Phase = 'setup' | 'roster' | 'training' | 'interviews' | 'bloodbath' | 'day' | 'night' | 'feast' | 'ended';

export interface GameState {
    seed: string;
    arena: Arena;
    tributes: Tribute[];
    phase: Phase;
    day: number;
    log: EventLog[];
    gamemakerMode: boolean;
}

export interface EventLog {
    id: string;
    day: number;
    phase: Phase;
    text: string;
    tributesInvolved: string[];
    important: boolean;
}

export interface HallOfFameEntry {
    id: string;
    seed: string;
    arenaName: string;
    winnerName: string;
    winnerDistrict: number;
    kills: number;
    date: string;
}
