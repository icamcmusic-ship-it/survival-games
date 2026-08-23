import { EventCategory } from '../models/types';

export interface CategoryMeta {
    label: string;
    /** CSS colour token defined in index.css. */
    color: string;
    /** Grouped filter bucket shown in the chronicle controls. */
    group: 'violence' | 'arena' | 'social' | 'supply' | 'ceremony';
    /**
     * §2.5: a non-colour encoding.
     *
     * Category colour was the only thing distinguishing an event type in the
     * feed — a legend dot and a border stripe, both hue-only — so a
     * colour-blind reader had nothing to scan on at all. One glyph per
     * category, chosen to be distinguishable at 11px in a mono face.
     */
    glyph: string;
}

export const CATEGORY_META: Record<EventCategory, CategoryMeta> = {
    death: { label: 'Death', color: 'var(--cat-death)', group: 'violence', glyph: '†' },
    kill: { label: 'Kill', color: 'var(--cat-kill)', group: 'violence', glyph: '✕' },
    combat: { label: 'Combat', color: 'var(--cat-combat)', group: 'violence', glyph: '⚔' },
    injury: { label: 'Injury', color: 'var(--cat-injury)', group: 'violence', glyph: '✚' },
    hazard: { label: 'Hazard', color: 'var(--cat-hazard)', group: 'arena', glyph: '⚠' },
    mutt: { label: 'Mutt', color: 'var(--cat-mutt)', group: 'arena', glyph: '☣' },
    alliance: { label: 'Alliance', color: 'var(--cat-alliance)', group: 'social', glyph: '⌂' },
    betrayal: { label: 'Betrayal', color: 'var(--cat-betrayal)', group: 'social', glyph: '⤫' },
    romance: { label: 'Romance', color: 'var(--cat-romance)', group: 'social', glyph: '♥' },
    sponsor: { label: 'Sponsor', color: 'var(--cat-sponsor)', group: 'supply', glyph: '⛊' },
    loot: { label: 'Supplies', color: 'var(--cat-loot)', group: 'supply', glyph: '◆' },
    survival: { label: 'Survival', color: 'var(--cat-survival)', group: 'supply', glyph: '≈' },
    travel: { label: 'Movement', color: 'var(--cat-travel)', group: 'arena', glyph: '→' },
    sanity: { label: 'Sanity', color: 'var(--cat-sanity)', group: 'social', glyph: '◐' },
    arena: { label: 'Arena', color: 'var(--cat-arena)', group: 'arena', glyph: '◈' },
    gamemaker: { label: 'Gamemaker', color: 'var(--cat-gamemaker)', group: 'arena', glyph: '⚙' },
    training: { label: 'Training', color: 'var(--cat-training)', group: 'ceremony', glyph: '▲' },
    interview: { label: 'Interview', color: 'var(--cat-interview)', group: 'ceremony', glyph: '☏' },
    feast: { label: 'Feast', color: 'var(--cat-feast)', group: 'ceremony', glyph: '✦' },
    system: { label: 'Broadcast', color: 'var(--cat-system)', group: 'ceremony', glyph: '●' },
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
