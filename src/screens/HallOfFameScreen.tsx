import React, { useState, useEffect } from 'react';
import { HallOfFameEntry, RecordsData } from '../models/types';
import { Trophy, Trash2, Award, BarChart3 } from 'lucide-react';
import { gameActions } from '../store/gameStore';
import { ACHIEVEMENTS, loadRecords } from '../data/achievements';

export function HallOfFameScreen() {
    const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
    const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
    const [records, setRecords] = useState<RecordsData>(loadRecords());

    useEffect(() => {
        let saved = [];
        try {
            saved = JSON.parse(localStorage.getItem('hungerGamesHoF') || '[]');
            if (!Array.isArray(saved)) saved = [];
        } catch (e) {
            saved = [];
        }
        setEntries(saved);
        setRecords(loadRecords());
    }, []);

    const hasAnyData = entries.length > 0 || records.gamesPlayed > 0;

    const handleReset = () => {
        const confirmed = confirm('This will permanently erase all Hall of Fame victors, achievements, and records, and reset your Capitol Coins. This cannot be undone. Continue?');
        if (!confirmed) return;
        gameActions.resetRecords();
        setEntries([]);
        setRecords(loadRecords());
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-4 mb-12">
                <h2 className="text-5xl font-black uppercase tracking-tighter text-white flex items-center justify-center gap-4">
                    <Trophy className="w-12 h-12 text-yellow-500" /> Hall of Fame
                </h2>
                <p className="text-zinc-400 text-lg">The historic, legendary victors of past simulations.</p>
                {hasAnyData && (
                    <button
                        onClick={handleReset}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs bg-zinc-900 hover:bg-red-950/40 border border-zinc-800 hover:border-red-900/50 rounded-lg text-zinc-400 hover:text-red-400 font-bold uppercase tracking-wider transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Reset All Achievements & Records
                    </button>
                )}
            </div>

            {records.gamesPlayed > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-cyan-500" /> All-Time Records
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-center">
                            <div className="text-2xl font-black text-white">{records.gamesPlayed}</div>
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Games Played</div>
                        </div>
                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-center">
                            <div className="text-2xl font-black text-white">{records.gamesWon}</div>
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Games with a Victor</div>
                        </div>
                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-center">
                            <div className="text-2xl font-black text-white">{records.totalKills}</div>
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Total Eliminations</div>
                        </div>
                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-center">
                            <div className="text-2xl font-black text-white">{records.longestGameDays}</div>
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Longest Games (Days)</div>
                        </div>
                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-center">
                            <div className="text-2xl font-black text-white">{records.shortestVictoryDays ?? '—'}</div>
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Fastest Victory (Days)</div>
                        </div>
                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-center">
                            <div className="text-2xl font-black text-white">{records.mostKillsByVictor}</div>
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">
                                Most Kills by a Victor{records.mostKillsByVictorName ? ` (${records.mostKillsByVictorName})` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {records.gamesPlayed > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Award className="w-4 h-4 text-yellow-500" /> Achievements ({records.unlockedAchievements.length}/{ACHIEVEMENTS.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {ACHIEVEMENTS.map(a => {
                            const unlocked = records.unlockedAchievements.includes(a.id);
                            return (
                                <div
                                    key={a.id}
                                    className={`p-3 rounded-lg border ${unlocked ? 'bg-yellow-950/10 border-yellow-700/30' : 'bg-zinc-950 border-zinc-850 opacity-50'}`}
                                >
                                    <div className={`font-bold text-sm ${unlocked ? 'text-yellow-400' : 'text-zinc-400'}`}>{a.name}</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">{a.description}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {entries.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                    No victors saved yet in this timeline. Complete a simulation to crown one!
                </div>
            ) : (
                <div className="grid gap-4">
                    {entries.map(entry => (
                        <div key={entry.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h3 className="text-2xl font-black text-white flex items-center gap-2">
                                        {entry.winnerName}
                                    </h3>
                                    <div className="text-zinc-400 text-sm mt-1">
                                        Crowned Victor of the <span className="text-red-400 font-semibold">{entry.arenaName}</span> arena
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm w-full md:w-auto md:justify-end">
                                    <div className="text-center min-w-[60px]">
                                        <div className="text-zinc-500 uppercase tracking-widest text-[9px] font-bold">Arena Kills</div>
                                        <div className="font-mono text-white text-base">{entry.kills}</div>
                                    </div>
                                    <div className="text-center min-w-[60px]">
                                        <div className="text-zinc-500 uppercase tracking-widest text-[9px] font-bold">Seed</div>
                                        <div className="font-mono text-white text-base">{entry.seed}</div>
                                    </div>
                                    <div className="text-center min-w-[80px]">
                                        <div className="text-zinc-500 uppercase tracking-widest text-[9px] font-bold">Crowned On</div>
                                        <div className="font-mono text-white text-base">{new Date(entry.date).toLocaleDateString()}</div>
                                    </div>
                                    <button
                                        onClick={() => setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)}
                                        className="px-4 py-2 text-xs bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 font-bold uppercase tracking-wider ml-auto md:ml-2"
                                    >
                                        {expandedEntryId === entry.id ? 'Collapse Details' : 'Verify Archive'}
                                    </button>
                                </div>
                            </div>

                            {expandedEntryId === entry.id && (
                                <div className="pt-4 border-t border-zinc-800/80 space-y-5 animate-fadeIn">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-850 space-y-2">
                                            <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Victor Attributes</h4>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-zinc-400">Survival Health:</span>
                                                <span className="font-mono text-emerald-400 font-bold">{entry.winnerEndHealth ?? 'N/A'}%</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-zinc-400 text-sm mr-1">District Rank:</span>
                                                <span className="text-white text-xs bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded font-bold">District {entry.winnerDistrict}</span>
                                            </div>
                                            {entry.winnerTraits && entry.winnerTraits.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {entry.winnerTraits.map(t => (
                                                        <span key={t} className="px-2 py-0.5 bg-red-950/20 text-red-400 text-[9px] border border-red-900/30 uppercase tracking-widest rounded">{t}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-850 flex flex-col justify-between">
                                            <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Simulation Metadata</h4>
                                            <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                                                Full statistics recorded of this exact configuration. Total tally of all other participating tributes.
                                            </p>
                                            <button
                                                onClick={() => {
                                                    const conf = confirm('Load this game seed and arena setup again?');
                                                    if (conf) {
                                                        window.location.reload(); // Quick reset
                                                    }
                                                }}
                                                className="mt-3 text-red-400 hover:text-red-300 text-xs font-semibold text-left"
                                            >
                                                Copy Simulation Seed ({entry.seed}) →
                                            </button>
                                        </div>
                                    </div>

                                    {entry.tributeSummaries && (
                                        <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-850 space-y-3">
                                            <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Tribute Status & Score List</h4>
                                            <div className="max-h-60 overflow-y-auto pr-2 text-sm space-y-2 custom-scrollbar">
                                                {entry.tributeSummaries
                                                    .sort((a, b) => b.kills - a.kills || a.district - b.district)
                                                    .map((ts, idx) => (
                                                        <div key={idx} className="flex justify-between items-center bg-zinc-900/40 p-2.5 rounded border border-zinc-800/40">
                                                            <div>
                                                                <span className="font-bold text-zinc-200">{ts.name}</span>
                                                                <span className="text-xs text-zinc-550 ml-2">District {ts.district}</span>
                                                                {ts.status === 'dead' ? (
                                                                    <span className="text-xs text-zinc-500 block mt-0.5">
                                                                        Eliminated Day {ts.dayOfDeath} {ts.causeOfDeath ? `via ${ts.causeOfDeath}` : ''}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-emerald-400 block font-bold mt-0.5 flex items-center gap-1">
                                                                        <Trophy className="w-3 h-3" /> Crowned Victor of Arena
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-bold block">Eliminations</span>
                                                                <span className="font-mono text-zinc-100 font-bold">{ts.kills}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
