import React, { useState } from 'react';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../data/constants';
import { GameConfig } from '../models/types';
import { Play, Dices, ChevronDown, ChevronRight } from 'lucide-react';

function randomSeed() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function ConfigSlider({ label, hint, value, min, max, step, format, onChange }: {
    label: string, hint?: string, value: number, min: number, max: number, step: number,
    format: (v: number) => string, onChange: (v: number) => void
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-baseline text-xs gap-3">
                <span className="text-[var(--color-ink-200)] font-semibold">{label}</span>
                <span className="text-white font-mono text-[11px]">{format(value)}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-[var(--color-blood-500)] cursor-pointer"
            />
            {hint && <p className="text-[10px] text-[var(--color-ink-500)]">{hint}</p>}
        </div>
    );
}

export function SetupScreen({ onStart }: { onStart: (seed: string, arenaId: string, gamemakerMode: boolean, config: GameConfig) => void }) {
    const [seed, setSeed] = useState(randomSeed());
    const [arenaId, setArenaId] = useState(ARENAS[0].id);
    const [gamemakerMode, setGamemakerMode] = useState(false);
    const [config, setConfig] = useState<GameConfig>(DEFAULT_GAME_CONFIG);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const trimmedSeed = seed.trim();

    const start = () => onStart(trimmedSeed || randomSeed(), arenaId, gamemakerMode, config);

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-3">
                <span className="eyebrow">Capitol Simulation Network</span>
                <h2 className="display-title text-4xl md:text-5xl text-balance">May the odds be ever in your favour.</h2>
                <p className="text-[var(--color-ink-400)]">Set your parameters, then reap twenty-four tributes.</p>
            </div>

            <div className="panel p-6 space-y-7">
                <div className="space-y-2">
                    <label className="eyebrow" htmlFor="seed-input">Simulation seed</label>
                    <div className="flex gap-2">
                        <input
                            id="seed-input"
                            type="text"
                            value={seed}
                            maxLength={24}
                            placeholder="Any word or code"
                            onChange={(e) => setSeed(e.target.value.toUpperCase())}
                            onKeyDown={(e) => { if (e.key === 'Enter') start(); }}
                            className="field font-mono"
                        />
                        <button onClick={() => setSeed(randomSeed())} className="btn" title="Roll a new seed">
                            <Dices className="w-4 h-4" /> Roll
                        </button>
                    </div>
                    <p className="text-[10px] text-[var(--color-ink-500)]">
                        The same seed and arena always produce the same Games — share the link afterwards to let someone else watch the identical run.
                    </p>
                </div>

                <div className="space-y-2">
                    <span className="eyebrow">Select arena</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ARENAS.map(a => (
                            <button
                                key={a.id}
                                onClick={() => setArenaId(a.id)}
                                aria-pressed={arenaId === a.id}
                                className={`panel-flush p-4 text-left transition-all hover:border-[var(--color-ink-600)] ${
                                    arenaId === a.id ? 'border-[var(--color-blood-500)] bg-[rgba(220,36,64,0.08)]' : ''
                                }`}
                            >
                                <h3 className="font-bold text-white mb-1 text-sm">{a.name}</h3>
                                <p className="text-xs text-[var(--color-ink-400)] leading-snug">{a.description}</p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {a.events.map(e => <span key={e} className="chip">{e}</span>)}
                                </div>
                            </button>
                        ))}
                        <button
                            onClick={() => setArenaId('procedural')}
                            aria-pressed={arenaId === 'procedural'}
                            className={`panel-flush p-4 text-left transition-all hover:border-[var(--color-ink-600)] ${
                                arenaId === 'procedural' ? 'border-[var(--color-blood-500)] bg-[rgba(220,36,64,0.08)]' : ''
                            }`}
                        >
                            <h3 className="font-bold text-white mb-1 text-sm">🎲 Procedural Arena</h3>
                            <p className="text-xs text-[var(--color-ink-400)] leading-snug">
                                The Gamemakers build a fresh arena from your seed — biome, sectors, mutts and hazards all generated on the spot.
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                                {['Rainforest', 'Volcanic', 'Archipelago', 'Highland'].map(b => <span key={b} className="chip">{b}</span>)}
                            </div>
                        </button>
                    </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer group pt-1">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors flex-none ${
                        gamemakerMode
                            ? 'bg-[var(--color-blood-500)] border-[var(--color-blood-500)]'
                            : 'bg-[var(--color-ink-950)] border-[var(--color-ink-600)] group-hover:border-[var(--color-ink-500)]'
                    }`}>
                        {gamemakerMode && <div className="w-2 h-2 bg-white rounded-sm" />}
                    </div>
                    <div>
                        <div className="font-bold text-white text-sm">Gamemaker Mode</div>
                        <div className="text-xs text-[var(--color-ink-400)]">Release mutts, force weather, and call feasts by hand mid-run.</div>
                    </div>
                    <input type="checkbox" className="sr-only" checked={gamemakerMode} onChange={(e) => setGamemakerMode(e.target.checked)} />
                </label>

                <div className="space-y-3 pt-1 border-t border-[var(--color-ink-800)]">
                    <button onClick={() => setShowAdvanced(v => !v)} className="btn btn-ghost btn-sm -ml-2">
                        {showAdvanced ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        Advanced simulation settings
                    </button>

                    {showAdvanced && (
                        <div className="panel-flush p-4 space-y-5 animate-fadeIn">
                            <ConfigSlider
                                label="Districts"
                                hint="Two tributes are reaped from every district."
                                value={config.districtCount}
                                min={2} max={12} step={1}
                                format={(v) => `${v} districts · ${v * 2} tributes`}
                                onChange={(v) => setConfig(c => ({ ...c, districtCount: v }))}
                            />
                            <ConfigSlider
                                label="Hazard rate"
                                hint="Frequency of arena events and mutt attacks."
                                value={config.hazardRate}
                                min={0.25} max={2.5} step={0.25}
                                format={(v) => `${v.toFixed(2)}×`}
                                onChange={(v) => setConfig(c => ({ ...c, hazardRate: v }))}
                            />
                            <ConfigSlider
                                label="Alliance betrayal rate"
                                hint="How readily allies turn on each other."
                                value={config.betrayalRate}
                                min={0} max={3} step={0.25}
                                format={(v) => `${v.toFixed(2)}×`}
                                onChange={(v) => setConfig(c => ({ ...c, betrayalRate: v }))}
                            />
                            <ConfigSlider
                                label="Sponsor generosity"
                                hint="Chance of silver parachutes reaching popular tributes."
                                value={config.sponsorGenerosity}
                                min={0} max={3} step={0.25}
                                format={(v) => `${v.toFixed(2)}×`}
                                onChange={(v) => setConfig(c => ({ ...c, sponsorGenerosity: v }))}
                            />
                            <div className="flex flex-wrap gap-5 pt-1">
                                <label className="flex items-center gap-2 text-xs text-[var(--color-ink-300)] cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.enableFeast}
                                        onChange={(e) => setConfig(c => ({ ...c, enableFeast: e.target.checked }))}
                                        className="w-4 h-4 accent-[var(--color-blood-500)]"
                                    />
                                    Allow feasts
                                </label>
                                <label className="flex items-center gap-2 text-xs text-[var(--color-ink-300)] cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.enableSanity}
                                        onChange={(e) => setConfig(c => ({ ...c, enableSanity: e.target.checked }))}
                                        className="w-4 h-4 accent-[var(--color-blood-500)]"
                                    />
                                    Enable sanity breakdowns
                                </label>
                            </div>
                            <button
                                onClick={() => setConfig(DEFAULT_GAME_CONFIG)}
                                className="btn btn-sm btn-ghost -ml-2"
                            >
                                Reset to defaults
                            </button>
                        </div>
                    )}
                </div>

                <button onClick={start} className="btn btn-primary w-full py-4 text-sm">
                    <Play className="w-4 h-4" /> Reap the tributes
                </button>
            </div>
        </div>
    );
}
