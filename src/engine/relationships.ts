import { Tribute } from '../models/types';

export type RelationshipLabel = 'Star-Crossed Lovers' | 'Sworn Ally' | 'Friendly' | 'Neutral' | 'Tense' | 'Rival' | 'Nemesis';

export function getRelationshipLabel(tribute: Tribute, other: Tribute, score: number): RelationshipLabel {
    const starCrossed = tribute.traits.includes('Star-Crossed') && other.traits.includes('Star-Crossed') && tribute.district === other.district;
    if (starCrossed) return 'Star-Crossed Lovers';

    const sameAlliance = !!tribute.allianceId && tribute.allianceId === other.allianceId;
    if (sameAlliance) return 'Sworn Ally';

    if (score >= 40) return 'Friendly';
    if (score >= 10) return 'Neutral';
    if (score >= -10) return 'Tense';
    if (score >= -30) return 'Rival';
    return 'Nemesis';
}

export const RELATIONSHIP_COLORS: Record<RelationshipLabel, string> = {
    'Star-Crossed Lovers': 'text-pink-400',
    'Sworn Ally': 'text-emerald-400',
    'Friendly': 'text-teal-400',
    'Neutral': 'text-zinc-400',
    'Tense': 'text-amber-400',
    'Rival': 'text-orange-400',
    'Nemesis': 'text-red-400',
};
