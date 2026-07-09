import { Attributes } from '../models/types';

export interface TrainingStation {
    id: string;
    name: string;
    attr: keyof Attributes;
}

export const TRAINING_STATIONS: TrainingStation[] = [
    { id: 'weapons', name: 'Weapons Station', attr: 'strength' },
    { id: 'agility', name: 'Agility Course', attr: 'agility' },
    { id: 'survival', name: 'Survival Skills', attr: 'intelligence' },
    { id: 'camouflage', name: 'Camouflage', attr: 'stealth' },
    { id: 'presentation', name: 'Presentation Coaching', attr: 'charisma' },
];

export const ARCHETYPE_STATION_AFFINITY: Record<string, string> = {
    'berserker': 'weapons',
    'trapper': 'survival',
    'medic': 'survival',
    'silent-predator': 'camouflage',
    'survivalist': 'survival',
    'charmer': 'presentation',
    'tactician': 'survival',
    'scavenger': 'agility',
    'saboteur': 'camouflage',
    'showboat': 'presentation',
};
