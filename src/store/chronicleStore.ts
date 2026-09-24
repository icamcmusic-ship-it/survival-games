import { createStore } from './createStore';
import { FeedDensity } from '../components/EventFeed';
import { StoredFilters, readFilters, writeFilters } from '../utils/prefsStorage';

/**
 * A3/A6: the chronicle's reading state, lifted out of `GameScreen`.
 *
 * Every one of these used to be `useState` inside the 1,493-line GameScreen
 * component, which meant the new full-page Chronicle route could not see any of
 * them — a reader who muted the ambient chatter in the sidebar feed would open
 * the chronicle page and find it unmuted. Both views now read the same store,
 * and the durable half of it persists through `prefsStorage` exactly as the
 * three original filters already did.
 *
 * Deliberately split into *durable* preferences (density, muted groups, text
 * size, which dossier sections are open) and *transient* query state (search
 * text, tribute and day filters, the selected sector). A search string is not a
 * preference; a reading density is.
 */
export interface ChronicleState {
    // ---- durable ----
    density: FeedDensity;
    mutedGroups: string[];
    pauseOnDeath: boolean;
    openSections: string[];
    textScale: 'small' | 'normal' | 'large';
    narrowMeasure: boolean;
    densityHintSeen: boolean;

    // ---- transient ----
    searchText: string;
    filterTributeId: string | null;
    /** A second tribute, OR semantics: "every kill involving Cato or Clove". */
    filterTributeId2: string | null;
    /**
     * §2.2: how the two tribute filters combine. 'either' is the original
     * union; 'both' is the one the UI could not express — every line involving
     * Marvel *and* Rue, which is exactly the question a feud or a romance
     * creates and the only way to read a relationship out of a 650-line feed.
     */
    filterPairMode: 'either' | 'both';
    filterDay: number | null;
    selectedZone: string | null;
    /** §2.12: the one pinned tribute the feed, dossier and brakes foreground. */
    followedId: string | null;
    /**
     * AUDIT-11 §4 follow-cam: up to three pinned tributes, first one being
     * `followedId` (kept in step so everything reading the single id still
     * works). Transient, like `followedId`; nothing about it is in a save.
     */
    pinnedIds: string[];
    /** Narrow the feed to beats involving a pinned tribute. */
    followOnly: boolean;
    /**
     * §2.5: the log line the chronicle should be showing.
     *
     * Written by the "jump to the next death" shortcut (D / Shift+D) and by
     * the command palette's equivalent; the chronicle scrolls to it and it
     * stays put afterwards, because it is also the bookmark those two read to
     * work out what "next" means. Transient — a position, not a preference.
     */
    focusLogId: string | null;
}

function initialState(): ChronicleState {
    const stored: StoredFilters = readFilters();
    return {
        density: stored.density,
        mutedGroups: stored.mutedGroups,
        pauseOnDeath: stored.pauseOnDeath,
        openSections: stored.openSections ?? ['tributes'],
        textScale: stored.textScale ?? 'normal',
        narrowMeasure: stored.narrowMeasure ?? false,
        densityHintSeen: stored.densityHintSeen ?? false,
        searchText: '',
        filterTributeId: null,
        filterTributeId2: null,
        filterPairMode: 'either',
        filterDay: null,
        selectedZone: null,
        followedId: null,
        pinnedIds: [],
        followOnly: false,
        focusLogId: null,
    };
}

export const chronicleStore = createStore<ChronicleState>(initialState());

/** Which keys are written back to storage. Everything else is per-session. */
const DURABLE = ['density', 'mutedGroups', 'pauseOnDeath', 'openSections', 'textScale', 'narrowMeasure', 'densityHintSeen'] as const;

export const MAX_PINNED = 3;

export function setChronicle(patch: Partial<ChronicleState>): void {
    // Keep `followedId` and `pinnedIds` in step whichever one a caller sets.
    if ('pinnedIds' in patch && patch.pinnedIds) {
        patch = { ...patch, pinnedIds: patch.pinnedIds.slice(0, MAX_PINNED), followedId: patch.pinnedIds[0] ?? null };
    } else if ('followedId' in patch) {
        const cur = chronicleStore.getState().pinnedIds;
        const id = patch.followedId ?? null;
        patch = { ...patch, pinnedIds: id === null ? [] : [id, ...cur.filter(x => x !== id)].slice(0, MAX_PINNED) };
    }
    chronicleStore.setState(patch);
    if (!DURABLE.some(k => k in patch)) return;
    const s = chronicleStore.getState();
    // Storage failures are absorbed — the preference simply is not remembered.
    writeFilters({
        mutedGroups: s.mutedGroups,
        density: s.density,
        pauseOnDeath: s.pauseOnDeath,
        openSections: s.openSections,
        textScale: s.textScale,
        narrowMeasure: s.narrowMeasure,
        densityHintSeen: s.densityHintSeen,
    });
}

export function toggleMutedGroup(id: string): void {
    const current = chronicleStore.getState().mutedGroups;
    setChronicle({
        mutedGroups: current.includes(id) ? current.filter(g => g !== id) : [...current, id],
    });
}

export function toggleSection(id: string): void {
    const current = chronicleStore.getState().openSections;
    setChronicle({
        openSections: current.includes(id) ? current.filter(s => s !== id) : [...current, id],
    });
}

/**
 * Pin or unpin a tribute for the follow-cam. Pinning a fourth drops the
 * oldest non-primary pin, so the first pick stays the one the brakes follow.
 */
export function togglePin(id: string): void {
    const cur = chronicleStore.getState().pinnedIds;
    if (cur.includes(id)) {
        const next = cur.filter(x => x !== id);
        setChronicle({ pinnedIds: next, ...(next.length === 0 ? { followOnly: false } : {}) });
        return;
    }
    const next = cur.length >= MAX_PINNED ? [cur[0], ...cur.slice(2), id] : [...cur, id];
    setChronicle({ pinnedIds: next });
}

/** The follow-cam filter: true when the line should stay in a follow-only feed. */
export function passesFollowCam(s: Pick<ChronicleState, 'followOnly' | 'pinnedIds'>, involved: string[]): boolean {
    if (!s.followOnly || s.pinnedIds.length === 0) return true;
    return involved.some(id => s.pinnedIds.includes(id));
}

/** True when anything is narrowing the chronicle right now. */
export function filtersActive(s: ChronicleState): boolean {
    return s.mutedGroups.length > 0
        // Against 'everything', deliberately: the dot means "some of the
        // chronicle is hidden from you", and the shipped default of 'scenes'
        // does hide the ambient tier. It is lit on a fresh install because on a
        // fresh install lines really are being held back.
        || s.density !== 'everything'
        || s.searchText !== ''
        || s.filterTributeId !== null
        || s.filterTributeId2 !== null
        || s.filterDay !== null
        || s.selectedZone !== null
        || (s.followOnly && s.pinnedIds.length > 0);
}

export function resetChronicleFilters(): void {
    setChronicle({
        mutedGroups: [],
        density: 'everything',
        searchText: '',
        filterTributeId: null,
        filterTributeId2: null,
        filterPairMode: 'either',
        filterDay: null,
        selectedZone: null,
        followOnly: false,
    });
}
