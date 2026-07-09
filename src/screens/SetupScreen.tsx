import React, { useState } from 'react';
import { ARENAS } from '../data/constants';
import { Play } from 'lucide-react';

export function SetupScreen({ onStart }: { onStart: (seed: string, arenaId: string, gamemakerMode: boolean) => void }) {
    const [seed, setSeed] = useState(Math.random().toString(36).substring(2, 8).toUpperCase());
    const [arenaId, setArenaId] = useState(ARENAS[0].id);
    const [gamemakerMode, setGamemakerMode] = useState(false);

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-4 mb-12">
                <h2 className="text-5xl font-black uppercase tracking-tighter text-white">May the odds be ever in your favor.</h2>
                <p className="text-zinc-400 text-lg">Configure your simulation parameters below.</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-6">
                <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500">Simulation Seed</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={seed}
                            onChange={(e) => setSeed(e.target.value.toUpperCase())}
                            className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 w-full font-mono text-white focus:outline-none focus:border-red-500 transition-colors"
                        />
                        <button
                            onClick={() => setSeed(Math.random().toString(36).substring(2, 8).toUpperCase())}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                            Randomize
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500">Select Arena</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {ARENAS.map(a => (
                            <button
                                key={a.id}
                                onClick={() => setArenaId(a.id)}
                                className={`p-4 rounded-lg border text-left transition-all ${arenaId === a.id ? 'bg-red-950/30 border-red-500/50' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600'}`}
                            >
                                <h3 className="font-bold text-white mb-1">{a.name}</h3>
                                <p className="text-xs text-zinc-400 line-clamp-2">{a.description}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-zinc-800">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${gamemakerMode ? 'bg-red-500 border-red-500' : 'bg-zinc-950 border-zinc-700 group-hover:border-zinc-500'}`}>
                            {gamemakerMode && <div className="w-2 h-2 bg-white rounded-sm" />}
                        </div>
                        <div>
                            <div className="font-bold text-white">Gamemaker Mode</div>
                            <div className="text-xs text-zinc-400">Allows manual triggering of events and mutts during the simulation.</div>
                        </div>
                        <input
                            type="checkbox"
                            className="hidden"
                            checked={gamemakerMode}
                            onChange={(e) => setGamemakerMode(e.target.checked)}
                        />
                    </label>
                </div>

                <button
                    onClick={() => onStart(seed, arenaId, gamemakerMode)}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2 mt-8"
                >
                    <Play className="w-5 h-5" />
                    Reap the Tributes
                </button>
            </div>
        </div>
    );
}
