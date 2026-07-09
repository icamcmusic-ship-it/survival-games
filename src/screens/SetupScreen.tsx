import React, { useState } from 'react';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../data/constants';
import { GameConfig } from '../models/types';
import { Play } from 'lucide-react';

function ConfigSlider({ label, value, min, max, step, format, onChange }: {
    label: string, value: number, min: number, max: number, step: number,
    format: (v: number) => string, onChange: (v: number) => void
}) {
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs">
                <span className="text-zinc-400 font-semibold">{label}</span>
                <span className="text-white font-mono">{format(value)}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-red-500"
            />
        </div>
    );
}

export function SetupScreen({ onStart }: { onStart: (seed: string, arenaId: string, gamemakerMode: boolean, config: GameConfig) => void }) {
    const [seed, setSeed] = useState(Math.random().toString(36).substring(2, 8).toUpperCase());
    const [arenaId, setArenaId] = useState(ARENAS[0].id);
    const [gamemakerMode, setGamemakerMode] = useState(false);
    const [config, setConfig] = useState<GameConfig>(DEFAULT_GAME_CONFIG);
    const [showAdvanced, setShowAdvanced] = useState(false);

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

                <div className="space-y-3 pt-4 border-t border-zinc-800">
                    <button
                        onClick={() => setShowAdvanced(v => !v)}
                        className="text-xs uppercase tracking-widest font-semibold text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        {showAdvanced ? '▾' : '▸'} Advanced Simulation Settings
                    </button>

                    {showAdvanced && (
                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-4">
                            <ConfigSlider
                                label="Districts (2 tributes each)"
                                value={config.districtCount}
                                min={2} max={12} step={1}
                                format={(v) => `${v} districts (${v * 2} tributes)`}
                                onChange={(v) => setConfig(c => ({ ...c, districtCount: v }))}
                            />
                            <ConfigSlider
                                label="Hazard Rate"
                                value={config.hazardRate}
                                min={0.25} max={2.5} step={0.25}
                                format={(v) => `${v.toFixed(2)}x`}
                                onChange={(v) => setConfig(c => ({ ...c, hazardRate: v }))}
                            />
                            <ConfigSlider
                                label="Alliance Betrayal Rate"
                                value={config.betrayalRate}
                                min={0} max={3} step={0.25}
                                format={(v) => `${v.toFixed(2)}x`}
                                onChange={(v) => setConfig(c => ({ ...c, betrayalRate: v }))}
                            />
                            <ConfigSlider
                                label="Sponsor Generosity"
                                value={config.sponsorGenerosity}
                                min={0} max={3} step={0.25}
                                format={(v) => `${v.toFixed(2)}x`}
                                onChange={(v) => setConfig(c => ({ ...c, sponsorGenerosity: v }))}
                            />
                            <div className="flex gap-4 pt-2">
                                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.enableFeast}
                                        onChange={(e) => setConfig(c => ({ ...c, enableFeast: e.target.checked }))}
                                        className="rounded bg-zinc-950 border-zinc-800 text-red-600"
                                    />
                                    Allow Feast Events
                                </label>
                                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.enableSanity}
                                        onChange={(e) => setConfig(c => ({ ...c, enableSanity: e.target.checked }))}
                                        className="rounded bg-zinc-950 border-zinc-800 text-red-600"
                                    />
                                    Enable Sanity Breakdowns
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => onStart(seed, arenaId, gamemakerMode, config)}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2 mt-8"
                >
                    <Play className="w-5 h-5" />
                    Reap the Tributes
                </button>
            </div>
        </div>
    );
}
