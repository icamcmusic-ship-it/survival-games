import { EventCategory } from '../models/types';

export interface CategoryMeta {
    label: string;
    /** CSS colour token defined in index.css. */
    color: string;
    /** Grouped filter bucket shown in the chronicle controls. */
    group: 'violence' | 'arena' | 'social' | 'supply' | 'ceremony';
}

export const CATEGORY_META: Record<EventCategory, CategoryMeta> = {
    death: { label: 'Death', color: 'var(--cat-death)', group: 'violence' },
    kill: { label: 'Kill', color: 'var(--cat-kill)', group: 'violence' },
    combat: { label: 'Combat', color: 'var(--cat-combat)', group: 'violence' },
    injury: { label: 'Injury', color: 'var(--cat-injury)', group: 'violence' },
    hazard: { label: 'Hazard', color: 'var(--cat-hazard)', group: 'arena' },
    mutt: { label: 'Mutt', color: 'var(--cat-mutt)', group: 'arena' },
    alliance: { label: 'Alliance', color: 'var(--cat-alliance)', group: 'social' },
    betrayal: { label: 'Betrayal', color: 'var(--cat-betrayal)', group: 'social' },
    romance: { label: 'Romance', color: 'var(--cat-romance)', group: 'social' },
    sponsor: { label: 'Sponsor', color: 'var(--cat-sponsor)', group: 'supply' },
    loot: { label: 'Supplies', color: 'var(--cat-loot)', group: 'supply' },
    survival: { label: 'Survival', color: 'var(--cat-survival)', group: 'supply' },
    travel: { label: 'Movement', color: 'var(--cat-travel)', group: 'arena' },
    sanity: { label: 'Sanity', color: 'var(--cat-sanity)', group: 'social' },
    arena: { label: 'Arena', color: 'var(--cat-arena)', group: 'arena' },
    gamemaker: { label: 'Gamemaker', color: 'var(--cat-gamemaker)', group: 'arena' },
    training: { label: 'Training', color: 'var(--cat-training)', group: 'ceremony' },
    interview: { label: 'Interview', color: 'var(--cat-interview)', group: 'ceremony' },
    feast: { label: 'Feast', color: 'var(--cat-feast)', group: 'ceremony' },
    system: { label: 'Broadcast', color: 'var(--cat-system)', group: 'ceremony' },
};

export const CATEGORY_GROUPS: Array<{ id: CategoryMeta['group']; label: string; categories: EventCategory[] }> = [
    { id: 'violence', label: 'Violence', categories: ['death', 'kill', 'combat', 'injury'] },
    { id: 'arena', label: 'Arena', categories: ['hazard', 'mutt', 'travel', 'arena', 'gamemaker'] },
    { id: 'social', label: 'Social', categories: ['alliance', 'betrayal', 'romance', 'sanity'] },
    { id: 'supply', label: 'Supply', categories: ['sponsor', 'loot', 'survival'] },
    { id: 'ceremony', label: 'Ceremony', categories: ['training', 'interview', 'feast', 'system'] },
];

export function categoryMeta(category?: EventCategory): CategoryMeta {
    return (category && CATEGORY_META[category]) || CATEGORY_META.system;
}
