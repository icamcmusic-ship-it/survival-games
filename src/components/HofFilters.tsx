import React, { useId } from 'react';
import { HallOfFameEntry } from '../models/types';
import { Search, X } from 'lucide-react';

export type HofSort = 'newest' | 'oldest' | 'kills' | 'health';

export const HOF_SORTS: { value: HofSort; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'kills', label: 'Most kills' },
    { value: 'health', label: 'Highest health' }
];

export interface HofQuery {
    search: string;
    sort: HofSort;
    arena: string;
    district: string;
}

export const EMPTY_HOF_QUERY: HofQuery = { search: '', sort: 'newest', arena: 'all', district: 'all' };

/** True when anything is narrowing the list — drives whether "Reset" is worth showing. */
export function isFiltered(query: HofQuery): boolean {
    return query.search.trim() !== '' || query.arena !== 'all' || query.district !== 'all';
}

/**
 * Search matches the whole cast, not just the victor.
 *
 * Players remember runs by who *died* in them ("the one where Marcus went out on day 1")
 * at least as often as by who won, so the full tribute summary is part of the haystack.
 */
function haystack(entry: HallOfFameEntry): string {
    const names = (entry.tributeSummaries ?? []).map(t => t.name).join(' ');
    return `${entry.winnerName} ${entry.arenaName} ${entry.seed} D${entry.winnerDistrict} ${names}`.toLowerCase();
}

export function applyHofQuery(entries: HallOfFameEntry[], query: HofQuery): HallOfFameEntry[] {
    const needle = query.search.trim().toLowerCase();

    const filtered = entries.filter(entry => {
        if (query.arena !== 'all' && entry.arenaName !== query.arena) return false;
        if (query.district !== 'all' && String(entry.winnerDistrict) !== query.district) return false;
        return needle === '' || haystack(entry).includes(needle);
    });

    // Sorting a copy: `entries` is the archive state itself and mutating it in place
    // would leave the stored order dependent on whatever sort was last viewed.
    return [...filtered].sort((a, b) => {
        switch (query.sort) {
            case 'oldest':
                return Date.parse(a.date) - Date.parse(b.date);
            case 'kills':
                return b.kills - a.kills || Date.parse(b.date) - Date.parse(a.date);
            case 'health':
                return (b.winnerEndHealth ?? -1) - (a.winnerEndHealth ?? -1) || Date.parse(b.date) - Date.parse(a.date);
            case 'newest':
            default:
                return Date.parse(b.date) - Date.parse(a.date);
        }
    });
}

interface Props {
    entries: HallOfFameEntry[];
    query: HofQuery;
    onChange: (query: HofQuery) => void;
    resultCount: number;
}

export function HofFilters({ entries, query, onChange, resultCount }: Props) {
    const searchId = useId();
    const arenaId = useId();
    const districtId = useId();

    const arenas = Array.from(new Set(entries.map(e => e.arenaName))).sort((a, b) => a.localeCompare(b));
    const districts = Array.from(new Set(entries.map(e => e.winnerDistrict))).sort((a, b) => a - b);

    return (
        <section className="panel p-5 space-y-4" aria-label="Filter victor records">
            <div className="grid md:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                    <label htmlFor={searchId} className="eyebrow block mb-1.5">Search victors, arenas, seeds, cast</label>
                    <div className="relative">
                        <Search
                            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-500)] pointer-events-none"
                            aria-hidden="true"
                        />
                        <input
                            id={searchId}
                            type="search"
                            value={query.search}
                            onChange={e => onChange({ ...query, search: e.target.value })}
                            placeholder="e.g. Marcus, Ashfall Basin, seed-1234"
                            className="field !pl-9"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor={arenaId} className="eyebrow block mb-1.5">Arena</label>
                    <select
                        id={arenaId}
                        value={query.arena}
                        onChange={e => onChange({ ...query, arena: e.target.value })}
                        className="field"
                    >
                        <option value="all">All arenas</option>
                        {arenas.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>

                <div>
                    <label htmlFor={districtId} className="eyebrow block mb-1.5">Victor's district</label>
                    <select
                        id={districtId}
                        value={query.district}
                        onChange={e => onChange({ ...query, district: e.target.value })}
                        className="field"
                    >
                        <option value="all">All districts</option>
                        {districts.map(d => <option key={d} value={String(d)}>District {d}</option>)}
                    </select>
                </div>

                <div>
                    <span className="eyebrow block mb-1.5" id={`${searchId}-sortlabel`}>Sort by</span>
                    <div className="seg flex-wrap" role="group" aria-labelledby={`${searchId}-sortlabel`}>
                        {HOF_SORTS.map(s => (
                            <button
                                key={s.value}
                                type="button"
                                className="seg-item"
                                aria-pressed={query.sort === s.value}
                                onClick={() => onChange({ ...query, sort: s.value })}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-mono text-[var(--color-ink-500)]" role="status" aria-live="polite">
                    Showing {resultCount} of {entries.length} record{entries.length === 1 ? '' : 's'}
                </p>
                {isFiltered(query) && (
                    <button onClick={() => onChange({ ...EMPTY_HOF_QUERY, sort: query.sort })} className="btn btn-sm btn-ghost">
                        <X className="w-3.5 h-3.5" aria-hidden="true" /> Reset filters
                    </button>
                )}
            </div>
        </section>
    );
}
