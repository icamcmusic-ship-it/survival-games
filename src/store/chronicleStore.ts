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
    filterDay: number | null;
    selectedZone: string | null;
    /** §2.12: the one pinned tribute the feed, dossier and brakes foreground. */
    followedId: string | null;
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
        filterDay: null,
        selectedZone: null,
        followedId: null,
    };
}

export const chronicleStore = createStore<ChronicleState>(initialState());

/** Which keys are written back to storage. Everything else is per-session. */
const DURABLE = ['density', 'mutedGroups', 'pauseOnDeath', 'openSections', 'textScale', 'narrowMeasure', 'densityHintSeen'] as const;

export function setChronicle(patch: Partial<ChronicleState>): void {
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

/** True when anything is narrowing the chronicle right now. */
export function filtersActive(s: ChronicleState): boolean {
    return s.mutedGroups.length > 0
        || s.density !== 'everything'
        || s.searchText !== ''
        || s.filterTributeId !== null
        || s.filterTributeId2 !== null
        || s.filterDay !== null
        || s.selectedZone !== null;
}

export function resetChronicleFilters(): void {
    setChronicle({
        mutedGroups: [],
        density: 'everything',
        searchText: '',
        filterTributeId: null,
        filterTributeId2: null,
        filterDay: null,
        selectedZone: null,
    });
}
