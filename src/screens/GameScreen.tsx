import React, { useState, useEffect } from 'react';
import { GameState, Tribute, HallOfFameEntry } from '../models/types';
import { Simulator } from '../engine/simulator';
import { ArenaMap } from '../components/ArenaMap';
import { TributeModal } from '../components/TributeModal';
import { Skull, Heart, Zap as _Zap, Settings, FastForward, MapPin, Users, Swords } from 'lucide-react';

function saveHallOfFame(state: GameState) {
    const winner = state.tributes.find(t => t.status === 'alive');
    if (!winner) return;
    const entry: HallOfFameEntry = {
        id: Math.random().toString(36).substring(2, 9),
        seed: state.seed,
        arenaName: state.arena.name,
        winnerName: winner.name,
        winnerDistrict: winner.district,
        kills: winner.kills,
        date: new Date().toISOString(),
        winnerTraits: winner.traits,
        winnerEndHealth: winner.health,
        tributeSummaries: state.tributes.map(t => ({
            name: t.name,
            district: t.district,
            kills: t.kills,
            status: t.status,
            causeOfDeath: t.causeOfDeath,
            dayOfDeath: t.dayOfDeath
        }))
    };
    let existing = [];
    try {
        existing = JSON.parse(localStorage.getItem('hungerGamesHoF') || '[]');
        if (!Array.isArray(existing)) existing = [];
    } catch (e) {
        existing = [];
    }
    localStorage.setItem('hungerGamesHoF', JSON.stringify([entry, ...existing]));
}

export function GameScreen({
    gameState,
    onNextPhase,
    simulator,
    setGameState,
}: {
    gameState: GameState,
    onNextPhase: () => void,
    simulator: Simulator,
    setGameState: (state: GameState) => void,
    coins: number,
    bets: Record<string, number>,
    setCoins: (coins: number) => void,
    setBets: React.Dispatch<React.SetStateAction<Record<string, number>>>
}) {
    const [selectedTribute, setSelectedTribute] = useState<Tribute | null>(null);
    const [speed, setSpeed] = useState<'manual' | '1x' | '5x' | 'auto'>('manual');
    const [importantOnly, setImportantOnly] = useState<boolean>(false);
    const [muttTargetId, setMuttTargetId] = useState<string>('');
    const [tacticalTab, setTacticalTab] = useState<'chronicle' | 'map'>('chronicle');
    const [selectedZone, setSelectedZone] = useState<string | null>(null);

    const aliveCount = gameState.tributes.filter(t => t.status === 'alive').length;
    const deadCount = gameState.tributes.filter(t => t.status === 'dead').length;

    // Auto-advance logic
    useEffect(() => {
        if (speed === 'manual' || gameState.phase === 'ended') return;

        const delay = speed === '1x' ? 1200 : speed === '5x' ? 300 : 50;
        const timer = setTimeout(() => {
            onNextPhase();
        }, delay);

        return () => clearTimeout(timer);
    }, [speed, gameState.phase, gameState.day, onNextPhase]);

    // Run to completion instantly
    const handleRunToEnd = () => {
        let state = simulator.getState();
        let maxCycles = 500;
        while (state.phase !== 'ended' && maxCycles > 0) {
            if (state.phase === 'setup') {
                simulator.processTraining();
            } else if (state.phase === 'training') {
                simulator.processInterviews();
            } else if (state.phase === 'interviews') {
                simulator.startGames();
            } else if (state.phase === 'bloodbath') {
                simulator.processBloodbath();
            } else {
                simulator.processTurn();
            }
            state = simulator.getState();
            maxCycles--;
        }

        if (state.phase === 'ended') {
            saveHallOfFame(state);
        }
        setGameState(JSON.parse(JSON.stringify(simulator.getState())));
    };

    // Group and Filter Logs
    const filteredLogs = gameState.log.filter(log => {
        if (importantOnly && !log.important) return false;
        if (selectedZone && log.zone !== selectedZone) return false;
        return true;
    });

    const groupedLogs = filteredLogs.reduce((acc, log) => {
        const key = `Day ${log.day} - ${log.phase.charAt(0).toUpperCase() + log.phase.slice(1)}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(log);
        return acc;
    }, {} as Record<string, typeof gameState.log>);

    // Sort tributes for sidebar: group alive allied together, alive solo, then deceased
    const sortedSidebarTributes = [...gameState.tributes].sort((a, b) => {
        if (a.status !== b.status) {
            return a.status === 'alive' ? -1 : 1;
        }
        if (a.status === 'alive') {
            if (a.allianceId && !b.allianceId) return -1;
            if (!a.allianceId && b.allianceId) return 1;
            if (a.allianceId && b.allianceId) {
                return a.allianceId.localeCompare(b.allianceId);
            }
        }
        if (a.district !== b.district) {
            return a.district - b.district;
        }
        return a.gender.localeCompare(b.gender);
    });

    const getAllianceBorderClass = (allianceId?: string) => {
        if (!allianceId) return '';
        const colors = [
            'border-l-4 border-l-emerald-500 bg-emerald-950/10 hover:border-r hover:border-zinc-650',
            'border-l-4 border-l-cyan-500 bg-cyan-950/10 hover:border-r hover:border-zinc-650',
            'border-l-4 border-l-amber-500 bg-amber-950/10 hover:border-r hover:border-zinc-650',
            'border-l-4 border-l-purple-500 bg-purple-950/10 hover:border-r hover:border-zinc-650',
            'border-l-4 border-l-pink-500 bg-pink-955/10 hover:border-r hover:border-zinc-650'
        ];
        let hash = 0;
        for (let i = 0; i < allianceId.length; i++) {
            hash = allianceId.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <div className="flex flex-col gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-xl">
                    <div className="flex justify-between items-center pb-3 border-b border-zinc-850">
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-white">
                                {gameState.phase === 'ended' ? 'The Games Have Ended' : `Day ${gameState.day} - ${gameState.phase.toUpperCase()}`}
                            </h2>
                            <p className="text-zinc-400 text-sm">{gameState.arena.name}</p>
                        </div>
                        {gameState.phase !== 'ended' && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleRunToEnd}
                                    className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-bold uppercase tracking-widest rounded-lg text-xs transition-colors"
                                >
                                    Run to End
                                </button>
                                <button
                                    onClick={onNextPhase}
                                    className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-lg text-xs transition-colors flex items-center gap-2"
                                >
                                    Proceed <FastForward className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {gameState.phase !== 'ended' && (
                        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Sim Speed:</span>
                                <div className="inline-flex rounded-lg bg-zinc-950 p-1 border border-zinc-850">
                                    {(['manual', '1x', '5x', 'auto'] as const).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setSpeed(s)}
                                            className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-wider transition-colors ${speed === s ? 'bg-red-600/20 text-red-400 border border-red-900/40' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}
                                        >
                                            {s === 'manual' ? 'Manual' : s === 'auto' ? 'Auto' : s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-1 bg-zinc-950 p-1 border border-zinc-850 rounded-lg">
                                <button
                                    onClick={() => setTacticalTab('chronicle')}
                                    className={`px-3 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all border ${tacticalTab === 'chronicle' ? 'bg-zinc-800 text-white border-zinc-705' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
                                >
                                    Chronicle feed
                                </button>
                                <button
                                    onClick={() => setTacticalTab('map')}
                                    className={`px-3 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all border ${tacticalTab === 'map' ? 'bg-zinc-800 text-white border-zinc-705' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
                                >
                                    Hologram Map
                                </button>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-zinc-200">
                                <input
                                    type="checkbox"
                                    checked={importantOnly}
                                    onChange={(e) => setImportantOnly(e.target.checked)}
                                    className="rounded bg-zinc-950 border-zinc-800 text-red-600 focus:ring-red-600 cursor-pointer w-4 h-4"
                                />
                                <span className="text-[10px] uppercase font-bold tracking-wider">Show Important Events Only</span>
                            </label>
                        </div>
                    )}
                </div>

                {tacticalTab === 'map' ? (
                    <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-xl space-y-4">
                        <ArenaMap
                            gameState={gameState}
                            selectedZone={selectedZone}
                            onSelectZone={setSelectedZone}
                            tributes={gameState.tributes}
                        />

                        {selectedZone ? (
                            <div className="p-4 bg-zinc-950 rounded-xl border border-red-900/40 animate-fadeIn">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-red-400">Decrypted Records: {selectedZone}</span>
                                    <button
                                        onClick={() => setSelectedZone(null)}
                                        className="text-[9px] text-zinc-500 hover:text-zinc-300 uppercase font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800"
                                    >
                                        Clear Filter
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-sm custom-scrollbar">
                                    {filteredLogs.length === 0 ? (
                                        <div className="text-zinc-500 text-xs text-center py-6 font-mono">No telemetry captured in this sector.</div>
                                    ) : (
                                        filteredLogs.map(l => (
                                            <div key={l.id} className="p-2.5 bg-zinc-900/60 rounded border border-zinc-850/40 text-zinc-300">
                                                {l.text}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 bg-zinc-950/20 rounded-xl">
                                💡 Select any sector in the holographic grid above to review activities that occurred there.
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-8 bg-zinc-900/30 p-4 rounded-xl border border-zinc-850/40">
                        {selectedZone && (
                            <div className="flex justify-between items-center bg-red-955/10 border border-red-900/30 px-3 py-1.5 rounded-lg text-xs text-red-400">
                                <span>Displaying coordinates for: <strong>{selectedZone}</strong></span>
                                <button onClick={() => setSelectedZone(null)} className="underline hover:text-white font-bold">Clear Filter</button>
                            </div>
                        )}
                        {Object.entries(groupedLogs).length > 0 ? (
                            Object.entries(groupedLogs).reverse().map(([key, logs]) => (
                                <div key={key} className="space-y-4">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2">{key}</h3>
                                    <div className="space-y-2">
                                        {logs.map(log => (
                                            <div key={log.id} className={`p-3 rounded-lg border transition-all ${log.important ? 'bg-red-955/20 border-red-900/50 text-red-200 shadow-sm shadow-red-950/50' : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-300'}`}>
                                                {log.text}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 text-zinc-505 border border-dashed border-zinc-800 rounded-xl">
                                {importantOnly ? 'No important events logged in this phase. Disable filter to view casual activities.' : 'No events have occurred yet. Proceed to start the games!'}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h3 className="font-bold uppercase tracking-widest text-zinc-500 text-xs mb-4">Status</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-center">
                            <div className="text-3xl font-black text-white">{aliveCount}</div>
                            <div className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Alive</div>
                        </div>
                        <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-center">
                            <div className="text-3xl font-black text-red-500">{deadCount}</div>
                            <div className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Deceased</div>
                        </div>
                    </div>
                </div>

                {gameState.gamemakerMode && gameState.phase !== 'ended' && (
                    <div className="bg-zinc-900 border border-red-900/50 rounded-xl p-4 space-y-4">
                        <h3 className="font-bold uppercase tracking-widest text-red-500 text-xs flex items-center gap-2">
                            <Settings className="w-4 h-4" /> Gamemaker Controls
                        </h3>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Mutt Target</label>
                                <select
                                    value={muttTargetId}
                                    onChange={(e) => setMuttTargetId(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1.5 text-xs text-zinc-350 focus:outline-none focus:border-red-500"
                                >
                                    <option value="">-- Random Tribute --</option>
                                    {gameState.tributes.filter(t => t.status === 'alive').map(t => (
                                        <option key={t.id} value={t.id}>{t.name} (Dist. {t.district})</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={() => {
                                    simulator.triggerGamemakerEvent('mutt', muttTargetId || undefined);
                                    setGameState({ ...simulator.getState() });
                                    setMuttTargetId('');
                                }}
                                className="w-full py-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 hover:border-red-900/50 text-red-400 rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                            >
                                <Skull className="w-4 h-4 text-red-500" /> Release Mutts
                            </button>
                            <button
                                onClick={() => { simulator.triggerGamemakerEvent('weather'); setGameState({ ...simulator.getState() }); }}
                                className="w-full py-2 bg-zinc-950 hover:bg-zinc-805 border border-zinc-800 rounded text-sm font-semibold transition-colors"
                            >
                                Trigger Weather Event
                            </button>
                            <button
                                onClick={() => { simulator.triggerGamemakerEvent('feast'); setGameState({ ...simulator.getState() }); }}
                                className="w-full py-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded text-sm font-semibold transition-colors"
                            >
                                Announce Feast
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h3 className="font-bold uppercase tracking-widest text-zinc-500 text-xs mb-4">Tributes</h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {sortedSidebarTributes.map(t => {
                            const allianceClass = t.status === 'alive' && t.allianceId ? getAllianceBorderClass(t.allianceId) : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600 cursor-pointer';
                            return (
                                <div
                                    key={t.id}
                                    onClick={() => t.status === 'alive' && setSelectedTribute(t)}
                                    className={`p-3 rounded-lg border flex flex-col gap-2 transition-all ${t.status === 'dead' ? 'bg-zinc-950/50 border-zinc-900 opacity-50' : allianceClass}`}
                                >
                                    <div className="flex justify-between items-center w-full">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div className={`font-bold text-sm ${t.status === 'dead' ? 'line-through text-zinc-650' : 'text-zinc-300'}`}>{t.name}</div>
                                                {t.status === 'alive' && t.allianceId && (
                                                    <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                                                        <Users className="w-2.5 h-2.5 text-emerald-400" /> Group
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex gap-2 mt-1">
                                                {t.status === 'alive' ? (
                                                    <>
                                                        <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-500" /> {t.health}</span>
                                                        <span className="flex items-center gap-1"><Swords className="w-3 h-3 text-zinc-400" /> {t.kills}</span>
                                                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-blue-400" /> {t.zone}</span>
                                                    </>
                                                ) : (
                                                    <span>Day {t.dayOfDeath} • {t.causeOfDeath ?? 'Eliminated'}</span>
                                                )}
                                            </div>
                                        </div>
                                        {t.status === 'dead' && <Skull className="w-4 h-4 text-zinc-600" />}
                                    </div>

                                    {t.status === 'alive' && (
                                        <div className="w-full bg-zinc-900/80 h-1 rounded-full overflow-hidden border border-zinc-850">
                                            <div
                                                className={`h-full ${t.health >= 70 ? 'bg-emerald-500' : t.health >= 35 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                style={{ width: `${t.health}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {selectedTribute && (
                <TributeModal tribute={selectedTribute} gameState={gameState} onClose={() => setSelectedTribute(null)} />
            )}
        </div>
    );
}
