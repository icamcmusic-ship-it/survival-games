import React, { useMemo, useState, useEffect } from 'react';
import { HallOfFameEntry } from '../models/types';
import { readHallOfFame, writeHallOfFame, clearHallOfFame } from '../utils/hofStorage';
import { HofFilters, applyHofQuery, isFiltered, EMPTY_HOF_QUERY, HofQuery } from '../components/HofFilters';
import { HofAggregates } from '../components/HofAggregates';
import { HofTransfer } from '../components/HofTransfer';
import { Trophy, Trash2, Copy, Check, RotateCcw } from 'lucide-react';
import { gameActions, gameStore } from '../store/gameStore';
import { useStore } from '../store/createStore';
import { PanemRecordBook } from '../components/PanemRecordBook';

export function HallOfFameScreen() {
    const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
    const [query, setQuery] = useState<HofQuery>(EMPTY_HOF_QUERY);
    const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
    const [copiedSeed, setCopiedSeed] = useState<string | null>(null);
    const [confirmClear, setConfirmClear] = useState(false);

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

            {entries.length === 0 ? (
                <>
                    <div className="empty-state">Finish a simulation to crown your first victor.</div>
                    {/* Transfer stays available on an empty archive — restoring a backup is
                        exactly what a player with no records is most likely to want. */}
                    <HofTransfer entries={entries} onImported={applyImport} />
                </>
            ) : (
                <>
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
                                    <div key={entry.id} className="panel p-5 space-y-4 animate-riseIn">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
