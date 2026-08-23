import React from 'react';
import { GameState } from '../models/types';
import { CATEGORY_GROUPS, categoryMeta } from '../ui/eventStyles';
import { ChronicleExport } from './ChronicleExport';
import {
    chronicleStore, filtersActive, resetChronicleFilters, setChronicle, toggleMutedGroup,
} from '../store/chronicleStore';
import { useStore } from '../store/createStore';

/**
 * A6: the filter drawer, extracted from `GameScreen` and shared with the
 * chronicle page.
 *
 * Two changes of substance beyond the move:
 *
 *  - The twenty category chips were a flat list; `ui/eventStyles.ts` already
 *    defines the groups, so they are grouped with a group-level toggle and an
 *    "only this" shortcut, which is what a reader wanting one thread actually
 *    reaches for.
 *  - Search, the two tribute selects and the day select are a *reading* action
 *    rather than a settings action, so they sit in one inline row at the top
 *    instead of at the bottom of a settings panel.
 */
export function ChronicleFilters({ gameState, filteredCount, onSelectTribute }: {
    gameState: GameState;
    filteredCount: number;
    /** Optional: the roster select can double as a way into a profile. */
    onSelectTribute?: (id: string) => void;
}) {
    const f = useStore(chronicleStore, s => s);
    const roster = [...gameState.tributes].sort((a, b) => a.district - b.district || a.name.localeCompare(b.name));
    const days = [...new Set(gameState.log.map(l => l.day))].sort((a, b) => a - b);

    return (
        <div className="panel-flush p-4 space-y-4 animate-fadeIn">
            {/* ---------- reading row ---------- */}
            <div className="flex flex-wrap gap-2 items-center">
                <input
                    type="search"
                    value={f.searchText}
                    onChange={e => setChronicle({ searchText: e.target.value })}
                    placeholder="Search the chronicle…"
                    aria-label="Search the chronicle"
                    className="field text-xs flex-1 min-w-[160px]"
                />
                <select
                    value={f.filterTributeId ?? ''}
                    onChange={e => setChronicle({ filterTributeId: e.target.value || null })}
                    className="field text-xs w-auto"
                    aria-label="Show only events involving one tribute"
                >
                    <option value="">All tributes</option>
                    {roster.map(t => (
                        <option key={t.id} value={t.id}>{t.name} (D{t.district}){t.status === 'dead' ? ' †' : ''}</option>
                    ))}
                </select>
                <select
                    value={f.filterTributeId2 ?? ''}
                    onChange={e => setChronicle({ filterTributeId2: e.target.value || null })}
                    className="field text-xs w-auto"
                    aria-label="Or a second tribute — events involving either are shown"
                >
                    <option value="">…or anyone</option>
                    {roster.map(t => (
                        <option key={t.id} value={t.id}>{t.name} (D{t.district}){t.status === 'dead' ? ' †' : ''}</option>
                    ))}
                </select>
                <select
                    value={f.filterDay === null ? '' : String(f.filterDay)}
                    onChange={e => setChronicle({ filterDay: e.target.value === '' ? null : Number(e.target.value) })}
                    className="field text-xs w-auto"
                    aria-label="Show only one day's events"
                >
                    <option value="">All days</option>
                    {days.map(d => (
                        <option key={d} value={d}>{d === 0 ? 'Before the Games' : `Day ${d}`}</option>
                    ))}
                </select>
                {f.filterTributeId && onSelectTribute && (
                    <button className="btn btn-sm btn-ghost" onClick={() => onSelectTribute(f.filterTributeId!)}>
                        Open profile
                    </button>
                )}
            </div>

            {/* ---------- category groups ---------- */}
            <div>
                <div className="eyebrow mb-2">Event categories — click a group to mute it</div>
                <div className="space-y-2">
                    {CATEGORY_GROUPS.map(group => {
                        const muted = f.mutedGroups.includes(group.id);
                        const soloed = f.mutedGroups.length === CATEGORY_GROUPS.length - 1 && !muted;
                        return (
                            <div key={group.id} className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => toggleMutedGroup(group.id)}
                                    aria-pressed={muted}
                                    aria-label={`${muted ? 'Unmute' : 'Mute'} ${group.label.toLowerCase()} events`}
                                    className={`chip ${muted ? 'opacity-40 line-through' : ''}`}
                                >
                                    {group.label}
                                </button>
                                <button
                                    className="btn btn-sm btn-ghost text-[10px]"
                                    aria-pressed={soloed}
                                    title={`Show only ${group.label.toLowerCase()} events`}
                                    onClick={() => setChronicle({
                                        mutedGroups: soloed
                                            ? []
                                            : CATEGORY_GROUPS.filter(g => g.id !== group.id).map(g => g.id),
                                    })}
                                >
                                    {soloed ? 'show all' : 'only'}
                                </button>
                                <span className="flex flex-wrap gap-1.5 items-center">
                                    {group.categories.map(c => {
                                        const meta = categoryMeta(c);
                                        return (
                                            <span
                                                key={c}
                                                className={`inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider ${muted ? 'opacity-40' : ''}`}
                                                style={{ color: meta.color }}
                                                title={meta.label}
                                            >
                                                <span className="cat-glyph" aria-hidden="true">{meta.glyph}</span>
                                                {meta.label}
                                            </span>
                                        );
                                    })}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ---------- reading comfort (§2.12) ---------- */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="eyebrow">Reading</span>
                <div className="seg">
                    {([['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']] as const).map(([id, label]) => (
                        <button
                            key={id}
                            className="seg-item"
                            aria-pressed={f.textScale === id}
                            onClick={() => setChronicle({ textScale: id })}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] uppercase tracking-wider text-[var(--color-ink-500)]">
                    <input
                        type="checkbox"
                        checked={f.narrowMeasure}
                        onChange={e => setChronicle({ narrowMeasure: e.target.checked })}
                        className="accent-[var(--red)]"
                    />
                    Narrow column
                </label>
                {filtersActive(f) && (
                    <button onClick={resetChronicleFilters} className="chip chip-accent">Reset filters</button>
                )}
            </div>

            <ChronicleExport gameState={gameState} importantOnly={f.density === 'headlines'} />

            <div className="text-[10px] text-[var(--color-ink-500)]">
                Showing {filteredCount} of {gameState.log.length} logged events.
            </div>
        </div>
    );
}
