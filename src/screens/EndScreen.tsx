import React, { useState } from 'react';
import { GameState } from '../models/types';
import { Trophy, MapPin, Swords } from 'lucide-react';

export function EndScreen({
    gameState,
    onRestart,
    coins,
    betWonMessage
}: {
    gameState: GameState,
    onRestart: () => void,
    coins: number,
    betWonMessage: string | null
}) {
    const [activeTab, setActiveTab] = useState<'stats' | 'logs'>('stats');

    const killLeaderboard = [...gameState.tributes]
        .sort((a, b) => b.kills - a.kills)
        .filter(t => t.kills > 0);

    const lastStandingPerDistrict = Array.from({ length: gameState.config.districtCount }, (_, i) => {
        const dist = i + 1;
        const distTributes = gameState.tributes.filter(t => t.district === dist);
        const survivor = distTributes.find(t => t.status === 'alive');
        if (survivor) return survivor;
        return [...distTributes].sort((a, b) => (b.dayOfDeath || 0) - (a.dayOfDeath || 0))[0];
    });

    const nonCareers = gameState.tributes.filter(t => !t.isCareer);
    const longestNonCareers = [...nonCareers].sort((a, b) => {
        if (a.status === 'alive' && b.status !== 'alive') return -1;
        if (a.status !== 'alive' && b.status === 'alive') return 1;
        return (b.dayOfDeath || 0) - (a.dayOfDeath || 0);
    }).slice(0, 3);

    const zoneDeaths: Record<string, number> = {};
    gameState.tributes.forEach(t => {
        if (t.status === 'dead') {
            const zone = t.zone || 'Cornucopia';
            zoneDeaths[zone] = (zoneDeaths[zone] || 0) + 1;
        }
    });
    const sortedZones = Object.entries(zoneDeaths).sort((a, b) => b[1] - a[1]);
    const mostDangerousZone = sortedZones[0] ? { name: sortedZones[0][0], count: sortedZones[0][1] } : { name: 'None', count: 0 };

    const causeBreakdown: Record<string, number> = {};
    gameState.tributes.forEach(t => {
        if (t.status === 'dead') {
            const cause = t.causeOfDeath || 'Eliminated';
            let cleanCause = cause;
            if (cause.toLowerCase().includes('bleeding')) cleanCause = 'Bled to death';
            else if (cause.toLowerCase().includes('mutt')) cleanCause = 'Mutt attack';
            else if (cause.toLowerCase().includes('tracker jacker')) cleanCause = 'Tracker Jackers';
            else if (cause.toLowerCase().includes('infection')) cleanCause = 'Sepsis / Infection';
            else if (cause.toLowerCase().includes('dehydration')) cleanCause = 'Dehydration';
            else if (cause.toLowerCase().includes('starvation')) cleanCause = 'Starvation';
            else if (cause.toLowerCase().includes('hypothermia')) cleanCause = 'Hypothermia';
            else if (cause.toLowerCase().includes('poison')) cleanCause = 'Poison berries / water';
            else if (cause.toLowerCase().includes('combat') || cause.toLowerCase().includes('killed') || cause.toLowerCase().includes('slain') || cause.toLowerCase().includes('beaten')) cleanCause = 'Eliminated in Combat';

            causeBreakdown[cleanCause] = (causeBreakdown[cleanCause] || 0) + 1;
        }
    });
    const sortedCauses = Object.entries(causeBreakdown).sort((a, b) => b[1] - a[1]);

    const winner = gameState.tributes.find(t => t.status === 'alive');

    const groupedLogs = gameState.log.reduce((acc, log) => {
        const key = `Day ${log.day} - ${log.phase.charAt(0).toUpperCase() + log.phase.slice(1)}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(log);
        return acc;
    }, {} as Record<string, typeof gameState.log>);

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="text-center space-y-4">
                <h2 className="text-5xl font-black uppercase text-red-500 tracking-tighter">The Arena Closes</h2>
                <p className="text-zinc-400 text-lg">Detailed debrief and analytics of the simulated games.</p>
                <div className="flex justify-center gap-3 pt-2">
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`px-4 py-2 text-xs uppercase font-bold tracking-widest rounded-lg transition-colors border ${activeTab === 'stats' ? 'bg-zinc-805 text-white border-zinc-700' : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-300'}`}
                    >
                        Post-Game Stats
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`px-4 py-2 text-xs uppercase font-bold tracking-widest rounded-lg transition-colors border ${activeTab === 'logs' ? 'bg-zinc-805 text-white border-zinc-700' : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-300'}`}
                    >
                        Full Chronology
                    </button>
                    <button
                        onClick={onRestart}
                        className="px-5 py-2 text-xs uppercase font-bold tracking-widest rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
                    >
                        New Battle simulation
                    </button>
                </div>
            </div>

            {activeTab === 'logs' ? (
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-6">
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Chronicle Archive</h3>
                    <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {Object.entries(groupedLogs).reverse().map(([key, logs]) => (
                            <div key={key} className="space-y-3">
                                <h4 className="text-xs font-bold text-zinc-500 border-b border-zinc-800 pb-1.5 uppercase tracking-widest">{key}</h4>
                                <div className="space-y-2">
                                    {logs.map(l => (
                                        <div key={l.id} className={`p-2.5 rounded text-sm transition-all ${l.important ? 'bg-red-955/20 text-red-100 border-l-2 border-l-red-500 shadow-sm' : 'bg-zinc-950/40 text-zinc-400 border border-zinc-900/40'}`}>
                                            {l.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                    {betWonMessage && (
                        <div className="col-span-1 md:col-span-2 bg-zinc-90 w-full bg-zinc-900 border border-teal-500/30 rounded-xl p-5 flex justify-between items-center gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] uppercase font-mono font-bold text-teal-400 tracking-widest flex items-center gap-1">
                                    💰 Capitol Bet Resolution
                                </span>
                                <p className="text-sm text-zinc-300 font-medium">{betWonMessage}</p>
                            </div>
                            <div className="bg-zinc-950 px-4 py-2 border border-zinc-850 rounded-lg text-right">
                                <div className="text-[9px] text-zinc-500 uppercase font-mono font-bold tracking-wider">Current Account Balance</div>
                                <div className="text-xl font-black text-teal-400 font-mono">{coins} COINS</div>
                            </div>
                        </div>
                    )}

                    {winner && (
                        <div className="col-span-1 md:col-span-2 bg-gradient-to-r from-red-950/10 to-zinc-900 border border-yellow-600/30 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-yellow-500" />
                                    <span className="text-xs uppercase font-extrabold text-yellow-500 tracking-wider">Crowned Victor</span>
                                </div>
                                <h3 className="text-4xl font-black text-white">{winner.name}</h3>
                                <p className="text-zinc-400 text-sm">District {winner.district} • Survived Arena with <span className="text-emerald-400 font-bold">{winner.health}% Vitals</span></p>
                                <div className="flex flex-wrap gap-1 pt-1">
                                    {winner.traits.map(t => (
                                        <span key={t} className="px-2 py-0.5 bg-zinc-950 text-zinc-300 border border-zinc-850 text-[9px] uppercase tracking-wider rounded font-mono">{t}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="text-center md:text-right bg-zinc-950 p-4 rounded-xl border border-zinc-850 w-full md:w-auto">
                                <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Eliminated Competitors</div>
                                <div className="text-5xl font-black text-white font-mono mt-0.5">{winner.kills}</div>
                            </div>
                        </div>
                    )}

                    <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-5 space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2 flex items-center gap-2">
                            <Swords className="w-4 h-4 text-red-500" /> Killer Leaderboard
                        </h3>
                        <div className="space-y-2">
                            {killLeaderboard.length === 0 ? (
                                <div className="text-zinc-500 text-xs py-4 text-center">No tributes made combat eliminations in this simulation.</div>
                            ) : (
                                killLeaderboard.slice(0, 5).map((t, idx) => (
                                    <div key={t.id} className="flex justify-between items-center p-2.5 rounded bg-zinc-950 border border-zinc-855 text-sm">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-zinc-500 font-bold font-mono">#{idx + 1}</span>
                                            <span className={`font-semibold ${t.status === 'alive' ? 'text-emerald-400' : 'text-zinc-300'}`}>{t.name}</span>
                                            <span className="text-xs text-zinc-500">(Dist. {t.district})</span>
                                        </div>
                                        <span className="font-mono bg-red-955/20 text-red-400 px-2 py-0.5 border border-red-900/30 rounded text-xs font-bold">{t.kills} KOD</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-5 space-y-5">
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-orange-500" /> Hotspot / Lethal Zone
                            </h3>
                            <div className="mt-2.5 bg-zinc-950 p-3 rounded-lg border border-zinc-850 flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-white text-base">{mostDangerousZone.name}</div>
                                    <div className="text-xs text-zinc-505 mt-0.5">Arena sector with most death incidents</div>
                                </div>
                                <span className="text-sm font-semibold text-rose-500 bg-rose-955/20 border border-rose-900/40 px-3 py-1 rounded-md">{mostDangerousZone.count} Deaths</span>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Elimination Cause Breakdown</h3>
                            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-1 text-xs custom-scrollbar">
                                {sortedCauses.map(([cause, count]) => (
                                    <div key={cause} className="flex justify-between text-zinc-400 py-1.5 border-b border-zinc-800/60 font-mono">
                                        <span className="text-zinc-300">{cause}</span>
                                        <span className="text-white font-bold">{count} tributes ({Math.round(count / gameState.tributes.length * 100)}%)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-5 space-y-4 col-span-1 md:col-span-2">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
                            District Last Tribute Standing Survival
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            {lastStandingPerDistrict.map((t) => {
                                if (!t) return null;
                                return (
                                    <div key={t.id} className="p-2.5 rounded bg-zinc-950 border border-zinc-850 flex flex-col justify-between min-h-[64px]">
                                        <div className="flex justify-between font-bold text-zinc-400">
                                            <span>District {t.district}</span>
                                            <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-500">
                                                {t.status === 'alive' ? 'Victor' : `Day ${t.dayOfDeath}`}
                                            </span>
                                        </div>
                                        <div className={`mt-1 font-semibold truncate ${t.status === 'alive' ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                            {t.name}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-5 space-y-4 col-span-1 md:col-span-2">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
                            Underscore Underdog Achievements (Longest Surviving Non-Careers)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {longestNonCareers.map((t, index) => (
                                <div key={t.id} className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-850 flex items-center justify-between text-sm">
                                    <div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-zinc-505 font-bold font-mono text-xs">#{index + 1}</span>
                                            <span className={`font-semibold ${t.status === 'alive' ? 'text-emerald-400' : 'text-zinc-300'}`}>{t.name}</span>
                                        </div>
                                        <p className="text-zinc-550 text-xs mt-0.5">District {t.district} Tribute</p>
                                    </div>
                                    <span className="text-xs font-mono font-bold bg-zinc-900/50 border border-zinc-800 px-2 py-1 rounded text-zinc-300">
                                        {t.status === 'alive' ? 'Survived Arena' : `Died Day ${t.dayOfDeath}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
