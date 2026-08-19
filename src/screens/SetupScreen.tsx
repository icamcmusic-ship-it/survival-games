import React, { useState } from 'react';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../data/constants';
import { GameConfig } from '../models/types';
import { Play, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';

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
                <span className="text-[var(--color-ink-200)] font-bold">{label}</span>
                <span className="text-[var(--ink)] font-mono text-[11px] font-bold">{format(value)}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-[var(--red)] cursor-pointer"
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

    const arenaOptions = [
        ...ARENAS.map(a => ({ id: a.id, name: a.name, description: a.description })),
        { id: 'procedural', name: '🎲 Procedural Arena', description: 'The Gamemakers build a fresh arena from your seed — biome, sectors, mutts and hazards generated on the spot.' },
    ];

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="masthead dot-texture">
                <span className="masthead-ghost" aria-hidden="true">01</span>
                <span className="masthead-eyebrow">01 — Choose Your Arena</span>
                <h2 className="masthead-title text-5xl md:text-6xl text-balance">May the odds<br />be ever yours</h2>
                <p className="masthead-sub text-sm">Set your parameters, then reap twenty-four tributes for the Capitol's Games.</p>
            </div>

            <div className="panel p-0 divide-y-2 divide-[var(--line-soft)]">
                <div className="p-5 space-y-2">
                    <label className="eyebrow" htmlFor="seed-input">Simulation seed</label>
                    <div className="flex gap-0 border-2 border-[var(--line)]">
                        <span className="hidden sm:flex items-center pl-3 pr-2 eyebrow flex-none">Seed</span>
                        <input
                            id="seed-input"
                            type="text"
                            value={seed}
                            maxLength={24}
                            placeholder="Any word or code"
                            onChange={(e) => setSeed(e.target.value.toUpperCase())}
                            onKeyDown={(e) => { if (e.key === 'Enter') start(); }}
                            className="flex-1 bg-[var(--paper-panel)] px-3 py-2.5 font-mono font-bold text-[var(--ink)] focus:outline-none focus:bg-white"
                        />
                        <button
                            onClick={() => setSeed(randomSeed())}
                            className="px-4 font-mono text-[11px] font-extrabold uppercase tracking-wider text-[var(--red)] hover:bg-[var(--paper-flush)] transition-colors flex-none"
                        >
                            Randomize
                        </button>
                    </div>
                    <p className="text-[10px] text-[var(--color-ink-500)]">
                        The same seed and arena always produce the same Games — share the link afterwards to let someone else watch the identical run.
                    </p>
                </div>

                <div className="p-5 space-y-1">
                    <span className="eyebrow">Select arena</span>
                    <div className="mt-2">
                        {arenaOptions.map(a => {
                            const selected = arenaId === a.id;
                            return (
                                <button
                                    key={a.id}
                                    onClick={() => setArenaId(a.id)}
                                    aria-pressed={selected}
                                    className={`w-full text-left flex items-center justify-between gap-4 transition-colors ${
                                        selected
                                            ? 'bg-[var(--ink)] px-4 py-3.5'
                                            : 'px-1 py-3.5 border-b-2 border-[var(--line)] last:border-0 hover:bg-[var(--paper-flush)]'
                                    }`}
                                >
                                    <div className="min-w-0">
                                        <div className={`font-black uppercase text-base ${selected ? 'text-white' : 'text-[var(--ink)]'}`}>{a.name}</div>
                                        <div className={`text-xs mt-0.5 ${selected ? 'text-[#c9b8a0]' : 'text-[var(--color-ink-500)]'}`}>{a.description}</div>
                                    </div>
                                    {selected ? (
                                        <span className="flex-none text-[var(--red)] font-mono text-[11px] font-extrabold uppercase tracking-wider">Selected</span>
                                    ) : (
                                        <ArrowRight className="w-4 h-4 flex-none text-[var(--color-ink-500)]" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="p-5">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 border-2 flex items-center justify-center transition-colors flex-none ${
                            gamemakerMode ? 'bg-[var(--red)] border-[var(--ink)]' : 'bg-[var(--paper-panel)] border-[var(--line)]'
                        }`}>
                            {gamemakerMode && <div className="w-2 h-2 bg-white" />}
                        </div>
                        <div>
                            <div className="font-black text-[var(--ink)] text-sm uppercase">Gamemaker Mode</div>
                            <div className="text-xs text-[var(--color-ink-500)]">Release mutts, force weather, and call feasts by hand mid-run.</div>
                        </div>
                        <input type="checkbox" className="sr-only" checked={gamemakerMode} onChange={(e) => setGamemakerMode(e.target.checked)} />
                    </label>
                </div>

                <div className="p-5 space-y-3">
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
                                <label className="flex items-center gap-2 text-xs text-[var(--color-ink-300)] cursor-pointer font-semibold">
                                    <input
                                        type="checkbox"
                                        checked={config.enableFeast}
                                        onChange={(e) => setConfig(c => ({ ...c, enableFeast: e.target.checked }))}
                                        className="w-4 h-4 accent-[var(--red)]"
                                    />
                                    Allow feasts
                                </label>
                                <label className="flex items-center gap-2 text-xs text-[var(--color-ink-300)] cursor-pointer font-semibold">
                                    <input
                                        type="checkbox"
                                        checked={config.enableSanity}
                                        onChange={(e) => setConfig(c => ({ ...c, enableSanity: e.target.checked }))}
                                        className="w-4 h-4 accent-[var(--red)]"
                                    />
                                    Enable sanity breakdowns
                                </label>
                            </div>
                            <button onClick={() => setConfig(DEFAULT_GAME_CONFIG)} className="btn btn-sm btn-ghost -ml-2">
                                Reset to defaults
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <button onClick={start} className="btn btn-primary w-full py-4 text-sm">
                <Play className="w-4 h-4" /> Reap the Tributes
            </button>
        </div>
    );
}
