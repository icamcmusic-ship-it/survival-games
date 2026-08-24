import React, { useMemo, useState, useEffect } from 'react';
import { HallOfFameEntry } from '../models/types';
import { readHallOfFame, writeHallOfFame, clearHallOfFame, serializeHallOfFame } from '../utils/hofStorage';
import { HofFilters, applyHofQuery, isFiltered, EMPTY_HOF_QUERY, HofQuery } from '../components/HofFilters';
import { HofAggregates } from '../components/HofAggregates';
import { HofCompare } from '../components/HofCompare';
import { HofTransfer } from '../components/HofTransfer';
import { Trophy, Trash2, Copy, Check, RotateCcw, Pin } from 'lucide-react';
import { gameActions, gameStore } from '../store/gameStore';
import { useStore } from '../store/createStore';
import { PanemRecordBook } from '../components/PanemRecordBook';

export function HallOfFameScreen() {
    const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
    const [query, setQuery] = useState<HofQuery>(EMPTY_HOF_QUERY);
    const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
    // §2.3: two entries at a time — a comparison, not a multi-select.
    const [compareIds, setCompareIds] = useState<string[]>([]);
    const [copiedSeed, setCopiedSeed] = useState<string | null>(null);
    const [confirmClear, setConfirmClear] = useState(false);
    const [confirmResetPanem, setConfirmResetPanem] = useState(false);
    const [confirmResetAll, setConfirmResetAll] = useState(false);
    /**
     * §2.7: bulk selection.
     *
     * The archive holds up to 50 runs and every action on it was single-entry:
     * pin one, delete the lot, or nothing in between. A player pruning a
     * season's worth of runs had to open and confirm each one, and there was
     * no way to export a chosen handful — only all of them. This is a separate
     * axis from `compareIds`, which is deliberately capped at two because a
     * comparison of five runs is a table, not a comparison.
     */
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);

    useEffect(() => {
        setEntries(readHallOfFame());
    }, []);

    const visible = useMemo(() => applyHofQuery(entries, query), [entries, query]);

    const copySeed = async (seed: string) => {
        try {
            await navigator.clipboard?.writeText(seed);
            setCopiedSeed(seed);
            setTimeout(() => setCopiedSeed(null), 1800);
        } catch {
            /* clipboard unavailable — the seed is on screen anyway */
        }
    };

    const clearArchive = () => {
        clearHallOfFame();
        setEntries([]);
        setConfirmClear(false);
    };

    const resetPanem = () => {
        gameActions.resetPanem();
        setConfirmResetPanem(false);
    };

    /**
     * The real one. `resetPanem` above clears the record book only — one of the
     * nine stored keys — so this is the button for a player who means it: the
     * archive, coins, prefs, feed filters, last config and every save slot too.
     */
    const resetEverything = () => {
        gameActions.resetEverything();
        clearHallOfFame();
        setEntries([]);
        setQuery(EMPTY_HOF_QUERY);
        setConfirmResetAll(false);
        setConfirmResetPanem(false);
        setConfirmClear(false);
    };

    const toggleSelected = (id: string) => setSelectedIds(ids =>
        ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);

    /** Everything the current filters are showing — not the whole archive. */
    const selectAllVisible = () => setSelectedIds(visible.map(e => e.id));
    const clearSelection = () => setSelectedIds([]);

    /**
     * §2.7: delete the selection. Pinned entries are deliberately *not*
     * exempt — a pin protects against the archive's own eviction cap, which is
     * automatic, not against the player deliberately choosing the entry. The
     * confirmation names how many are pinned so the choice is informed.
     */
    const deleteSelected = () => {
        const next = entries.filter(e => !selectedIds.includes(e.id));
        writeHallOfFame(next);
        setEntries(readHallOfFame());
        setSelectedIds([]);
        setConfirmDeleteSelected(false);
        setCompareIds(ids => ids.filter(id => next.some(e => e.id === id)));
        if (expandedEntryId && !next.some(e => e.id === expandedEntryId)) setExpandedEntryId(null);
    };

    /** §2.7: pin or unpin the whole selection in one write. */
    const setSelectedPinned = (pinned: boolean) => {
        const next = entries.map(e =>
            selectedIds.includes(e.id) ? { ...e, pinned: pinned || undefined } : e);
        writeHallOfFame(next);
        setEntries(readHallOfFame());
    };

    /** §2.7: export just the selection, in the same envelope a full export uses. */
    const exportSelected = () => {
        const chosen = entries.filter(e => selectedIds.includes(e.id));
        if (chosen.length === 0) return;
        const blob = new Blob([serializeHallOfFame(chosen)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hall-of-fame-${chosen.length}-selected.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    /** Imports are persisted immediately: a merge the player can't see survive a reload is worse than no merge. */
    const applyImport = (imported: HallOfFameEntry[]) => {
        writeHallOfFame(imported);
        setEntries(imported);
    };

    const totalKills = entries.reduce((sum, e) => sum + e.kills, 0);
    // Read live rather than from the store so the book is correct even when the
    // screen is opened without a run in progress.
    const panem = useStore(gameStore, s => s.panem);

    return (
        <div className="max-w-4xl mx-auto space-y-7">
            <div className="masthead dot-texture text-center">
                <span className="masthead-ghost" aria-hidden="true">★</span>
                <span className="masthead-eyebrow">Capitol Records Division</span>
                <h2 className="masthead-title text-4xl md:text-5xl flex items-center justify-center gap-3">
                    <Trophy className="w-9 h-9" /> Hall of Fame
                </h2>
                <p className="masthead-sub text-sm mx-auto">
                    {entries.length === 0
                        ? 'No victors on record yet.'
                        : `${entries.length} victor${entries.length === 1 ? '' : 's'} · ${totalKills} total eliminations`}
                </p>
            </div>

            <PanemRecordBook panem={panem} />

            {panem.runs > 0 && (
                <div className="flex justify-end -mt-4">
                    {confirmResetPanem ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--color-ink-400)]">Erase every achievement and record?</span>
                            <button onClick={resetPanem} className="btn btn-sm btn-primary">Erase</button>
                            <button onClick={() => setConfirmResetPanem(false)} className="btn btn-sm btn-ghost">Cancel</button>
                        </div>
                    ) : (
                        <button onClick={() => setConfirmResetPanem(true)} className="btn btn-sm btn-ghost">
                            <Trash2 className="w-3.5 h-3.5" /> Reset achievements &amp; records
                        </button>
                    )}
                </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
                {confirmResetAll ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="text-xs text-[var(--color-ink-400)]">
                            Erase <em>everything</em> — records, victors, coins, unlocked arenas, preferences and all three
                            save slots? This cannot be undone.
                        </span>
                        <button
                            onClick={resetEverything}
                            className="btn btn-sm btn-primary"
                            aria-label="Confirm erasing all saved data"
                        >
                            Erase everything
                        </button>
                        <button onClick={() => setConfirmResetAll(false)} className="btn btn-sm btn-ghost">Cancel</button>
                    </div>
                ) : (
                    <button
                        onClick={() => setConfirmResetAll(true)}
                        className="btn btn-sm btn-ghost"
                        aria-label="Erase all saved data and start over"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Erase all saved data
                    </button>
                )}
            </div>

            {entries.length === 0 ? (
                <>
                    <div className="empty-state">Finish a simulation to crown your first victor.</div>
                    {/* Transfer stays available on an empty archive — restoring a backup is
                        exactly what a player with no records is most likely to want. */}
                    <HofTransfer entries={entries} onImported={applyImport} />
                </>
            ) : (
                <>
                    {compareIds.length === 2 && (() => {
                        const a = entries.find(e => e.id === compareIds[0]);
                        const b = entries.find(e => e.id === compareIds[1]);
                        return a && b ? <HofCompare a={a} b={b} onClear={() => setCompareIds([])} /> : null;
                    })()}
                    <HofAggregates entries={entries} />
                    <HofFilters entries={entries} query={query} onChange={setQuery} resultCount={visible.length} />
                    <HofTransfer entries={entries} onImported={applyImport} />

                    <div className="flex justify-end">
                        {confirmClear ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--color-ink-400)]">Erase all {entries.length} records?</span>
                                <button onClick={clearArchive} className="btn btn-sm btn-primary">Erase</button>
                                <button onClick={() => setConfirmClear(false)} className="btn btn-sm btn-ghost">Cancel</button>
                            </div>
                        ) : (
                            <button onClick={() => setConfirmClear(true)} className="btn btn-sm btn-ghost">
                                <Trash2 className="w-3.5 h-3.5" /> Clear archive
                            </button>
                        )}
                    </div>

                    {/* §2.7: bulk actions. Everything here operates on the
                        current selection, and "select all" means everything the
                        filters are currently showing rather than the whole
                        archive — otherwise filtering to District 12 and hitting
                        select-all would quietly stage 50 records for deletion. */}
                    {visible.length > 1 && (
                        <div className="panel-flush p-3 flex flex-wrap items-center gap-2 text-xs">
                            <button
                                onClick={selectedIds.length === visible.length ? clearSelection : selectAllVisible}
                                className="btn btn-sm btn-ghost"
                            >
                                {selectedIds.length === visible.length ? 'Select none' : `Select all ${visible.length} shown`}
                            </button>
                            <span className="text-[var(--color-ink-500)]" role="status">
                                {selectedIds.length === 0 ? 'Nothing selected' : `${selectedIds.length} selected`}
                            </span>
                            {selectedIds.length > 0 && (
                                <>
                                    <span className="text-[var(--line-soft)]" aria-hidden="true">·</span>
                                    <button onClick={() => setSelectedPinned(true)} className="btn btn-sm">
                                        <Pin className="w-3.5 h-3.5" /> Pin
                                    </button>
                                    <button onClick={() => setSelectedPinned(false)} className="btn btn-sm btn-ghost">
                                        Unpin
                                    </button>
                                    <button onClick={exportSelected} className="btn btn-sm btn-ghost">
                                        Export selected
                                    </button>
                                    {confirmDeleteSelected ? (
                                        <span className="flex items-center gap-2">
                                            <span className="text-[var(--red)] font-semibold">
                                                Delete {selectedIds.length}
                                                {(() => {
                                                    const pinned = entries.filter(e => selectedIds.includes(e.id) && e.pinned).length;
                                                    return pinned > 0 ? `, ${pinned} of them pinned` : '';
                                                })()}?
                                            </span>
                                            <button onClick={deleteSelected} className="btn btn-sm btn-primary">Delete</button>
                                            <button onClick={() => setConfirmDeleteSelected(false)} className="btn btn-sm btn-ghost">Cancel</button>
                                        </span>
                                    ) : (
                                        <button onClick={() => setConfirmDeleteSelected(true)} className="btn btn-sm btn-ghost">
                                            <Trash2 className="w-3.5 h-3.5" /> Delete selected
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {visible.length === 0 ? (
                        <div className="empty-state">
                            No records match {isFiltered(query) ? 'those filters' : 'your search'}.
                            <div className="mt-3">
                                <button onClick={() => setQuery({ ...EMPTY_HOF_QUERY, sort: query.sort })} className="btn btn-sm">
                                    Clear filters
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {visible.map(entry => {
                                const expanded = expandedEntryId === entry.id;
                                const summaries = entry.tributeSummaries
                                    ? [...entry.tributeSummaries].sort((a, b) => b.kills - a.kills || a.district - b.district)
                                    : [];

                                return (
                                    <div
                                        key={entry.id}
                                        className={`panel p-5 space-y-4 animate-riseIn ${selectedIds.includes(entry.id) ? 'ring-2 ring-[var(--red)]' : ''}`}
                                    >
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div className="min-w-0 flex items-start gap-3">
                                                {/* §2.7: a 44px target, because this is the
                                                    control a player uses forty times in a row. */}
                                                <label className="flex items-center justify-center w-11 h-11 -m-2 cursor-pointer flex-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(entry.id)}
                                                        onChange={() => toggleSelected(entry.id)}
                                                        aria-label={`Select the ${entry.arenaName} run${entry.noVictor ? '' : ` won by ${entry.winnerName}`}`}
                                                    />
                                                </label>
                                            <div className="min-w-0">
                                                <h3 className="display-title text-2xl">
                                                    {entry.noVictor ? 'No victor' : entry.winnerName}
                                                </h3>
                                                <div className="text-[var(--color-ink-400)] text-sm mt-1">
                                                    {entry.noVictor ? (
                                                        <>The <span className="text-[var(--red)] font-semibold">{entry.arenaName}</span> kept everybody</>
                                                    ) : (
                                                        <>District {entry.winnerDistrict} · victor of the{' '}
                                                        <span className="text-[var(--red)] font-semibold">{entry.arenaName}</span></>
                                                    )}
                                                </div>
                                                {entry.winnerTraits && entry.winnerTraits.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {entry.winnerTraits.map(t => <span key={t} className="chip">{t}</span>)}
                                                    </div>
                                                )}
                                            </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2.5 items-center">
                                                <div className="stat-tile !py-2 !px-3">
                                                    <div className="eyebrow">Kills</div>
                                                    <div className="font-mono text-[var(--ink)]">{entry.kills}</div>
                                                </div>
                                                {typeof entry.winnerEndHealth === 'number' && (
                                                    <div className="stat-tile !py-2 !px-3">
                                                        <div className="eyebrow">Health</div>
                                                        <div className="font-mono text-[var(--ink)]">{entry.winnerEndHealth}%</div>
                                                    </div>
                                                )}
                                                <div className="stat-tile !py-2 !px-3">
                                                    <div className="eyebrow">Crowned</div>
                                                    <div className="font-mono text-[var(--ink)] text-xs">
                                                        {new Date(entry.date).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setExpandedEntryId(expanded ? null : entry.id)}
                                                    className="btn btn-sm"
                                                    aria-expanded={expanded}
                                                >
                                                    {expanded ? 'Hide' : 'Details'}
                                                    <span className="sr-only"> for {entry.winnerName}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {expanded && (
                                            <div className="pt-4 border-t border-[var(--color-ink-800)] space-y-4 animate-fadeIn">
                                                <div className="flex flex-wrap gap-2">
                                                    <button onClick={() => copySeed(entry.seed)} className="btn btn-sm">
                                                        {copiedSeed === entry.seed
                                                            ? <><Check className="w-3.5 h-3.5 text-[var(--color-coin-400)]" /> Seed copied</>
                                                            : <><Copy className="w-3.5 h-3.5" /> Copy seed ({entry.seed})</>}
                                                    </button>
                                                    <button
                                                        onClick={() => { void gameActions.replayHallOfFameEntry(entry); }}
                                                        className="btn btn-sm btn-primary"
                                                        title={`Run the ${entry.arenaName} Games again on seed ${entry.seed}`}
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" /> Run these Games again
                                                    </button>
                                                    {/* §2.3: the archive stored each run's whole config so
                                                        it could be relaunched, and there was no way to ask
                                                        what was different about the one that went well. */}
                                                    <button
                                                        onClick={() => setCompareIds(ids => {
                                                            if (ids.includes(entry.id)) return ids.filter(i => i !== entry.id);
                                                            return [...ids, entry.id].slice(-2);
                                                        })}
                                                        className={`btn btn-sm ${compareIds.includes(entry.id) ? 'btn-primary' : ''}`}
                                                        aria-pressed={compareIds.includes(entry.id)}
                                                        title="Pick two runs to compare their settings and outcomes"
                                                    >
                                                        {compareIds.includes(entry.id) ? 'Comparing' : 'Compare'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            // §2.13: pinned entries are never evicted by the
                                                            // 50-record cap — a first D12 crown should not be
                                                            // silently deleted by run 51.
                                                            const next = entries.map(e => e.id === entry.id ? { ...e, pinned: !e.pinned || undefined } : e);
                                                            writeHallOfFame(next);
                                                            setEntries(readHallOfFame());
                                                        }}
                                                        className={`btn btn-sm ${entry.pinned ? 'btn-primary' : ''}`}
                                                        aria-pressed={!!entry.pinned}
                                                        title={entry.pinned
                                                            ? 'Pinned — protected from the archive cap. Click to unpin.'
                                                            : 'Pin this entry so the oldest-evicted archive cap can never delete it'}
                                                    >
                                                        <Pin className="w-3.5 h-3.5" /> {entry.pinned ? 'Pinned' : 'Pin'}
                                                    </button>
                                                </div>

                                                {summaries.length > 0 && (
                                                    <div className="panel-flush p-4 space-y-2.5">
                                                        <h4 className="panel-title">Full cast</h4>
                                                        <div className="max-h-64 overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
                                                            {summaries.map((ts, idx) => (
                                                                <div key={`${ts.name}-${idx}`} className="flex justify-between items-center gap-3 panel-flush p-2.5">
                                                                    <div className="min-w-0">
                                                                        <span className="font-bold text-[var(--color-ink-100)]">{ts.name}</span>
                                                                        <span className="chip ml-2">D{ts.district}</span>
                                                                        {ts.status === 'dead' ? (
                                                                            <div className="text-xs text-[var(--color-ink-500)] mt-0.5 truncate">
                                                                                Day {ts.dayOfDeath ?? '—'}
                                                                                {ts.causeOfDeath ? ` · ${ts.causeOfDeath}` : ''}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-xs text-[var(--cat-alliance)] font-bold mt-0.5 flex items-center gap-1">
                                                                                <Trophy className="w-3 h-3" /> Victor
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-right flex-none">
                                                                        <div className="eyebrow">Kills</div>
                                                                        <div className="font-mono text-[var(--color-ink-100)] font-bold">{ts.kills}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
