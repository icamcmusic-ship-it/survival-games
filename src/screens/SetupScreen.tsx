import React, { useState } from 'react';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../data/constants';
import { GameConfig } from '../models/types';
import { Play, ChevronDown, ChevronRight, ArrowRight, History } from 'lucide-react';
import { gameActions, gameStore, readSavedRun } from '../store/gameStore';
import { useStore } from '../store/createStore';
import { gamesProfileFor, profileHeadline } from '../engine/gamesProfile';
// PERF: imported from the data module directly, not via `engine/arenaSignature`
// — the setup screen is the app's cold-start path and must not drag the
// simulation engine (and its ~5k lines of flavour/balance tables) in with it.
import { SIGNATURE_BLURBS } from '../data/signatureBlurbs';
import { readStoredConfig, writeStoredConfig } from '../utils/prefsStorage';
import { canSeeArena, disclosureFor } from '../ui/disclosure';

function randomSeed() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/** Versioned read/write lives in `utils/prefsStorage`; this is the local alias. */
const storeConfig = writeStoredConfig;

/** UX-11 named presets: one click sets every slider to a coherent profile. */
const PRESETS: Array<{ name: string; blurb: string; config: GameConfig }> = [
    { name: 'Canon', blurb: 'Balanced, book-accurate pacing.', config: DEFAULT_GAME_CONFIG },
    {
        name: 'Bloodbath',
        blurb: 'Frequent hazards, quick betrayals.',
        config: { districtCount: 12, hazardRate: 2.0, betrayalRate: 2.25, sponsorGenerosity: 0.75, enableFeast: true, enableSanity: true },
    },
    {
        name: 'Slow Burn',
        blurb: 'Calm arena, loyal alliances, generous sponsors.',
        config: { districtCount: 12, hazardRate: 0.5, betrayalRate: 0.25, sponsorGenerosity: 2.0, enableFeast: false, enableSanity: true },
    },
    {
        name: 'Chaos',
        blurb: 'Everything turned up as far as it goes.',
        config: { districtCount: 12, hazardRate: 2.5, betrayalRate: 3.0, sponsorGenerosity: 3.0, enableFeast: true, enableSanity: true },
    },
];

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
    const [config, setConfigState] = useState<GameConfig>(readStoredConfig);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const coins = useStore(gameStore, st => st.coins);
    const panem = useStore(gameStore, st => st.panem);
    const [savedRun, setSavedRun] = useState(readSavedRun);

    const setConfig = (updater: GameConfig | ((c: GameConfig) => GameConfig)) => {
        setConfigState(prev => {
            const next = typeof updater === 'function' ? (updater as (c: GameConfig) => GameConfig)(prev) : updater;
            storeConfig(next);
            return next;
        });
    };

    const trimmedSeed = seed.trim();
    const start = () => {
        // Starting a new Games discards the saved run immediately, and the
        // resume card alone was not a guard on that destructive path.
        if (savedRun && !window.confirm('A Games is already in progress. Starting a new one abandons that run — continue?')) return;
        onStart(trimmedSeed || randomSeed(), arenaId, gamemakerMode, config);
    };

    const arenaOptions = [
        ...ARENAS.map(a => ({ id: a.id, name: a.name, description: a.description })),
        { id: 'procedural', name: '🎲 Procedural Arena', description: 'The Gamemakers build a fresh arena from your seed — biome, sectors, mutts and hazards generated on the spot.' },
        // No SIGNATURE_BLURBS entry on purpose — the whole point is that
        // nothing about this arena is knowable until the bloodbath.
        { id: 'random-hidden', name: '❓ Random Arena (Hidden)', description: 'The Capitol picks. Its name, its layout, its rules — none of it is shown until the tributes are already standing on the plates.' },
    ];

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="masthead dot-texture">
                <span className="masthead-ghost" aria-hidden="true">01</span>
                <span className="masthead-eyebrow">01 — Choose Your Arena</span>
                <h2 className="masthead-title text-5xl md:text-6xl text-balance">May the odds<br />be ever yours</h2>
                <p className="masthead-sub text-sm">Set your parameters, then reap twenty-four tributes for the Capitol's Games.</p>
            </div>

            {savedRun && (
                <div className="panel p-5 flex flex-wrap items-center justify-between gap-4" style={{ borderColor: 'var(--red)', borderWidth: '3px' }}>
                    <div className="flex items-start gap-3 min-w-0">
                        <History className="w-5 h-5 text-[var(--red)] flex-none mt-0.5" />
                        <div className="min-w-0">
                            <div className="font-black text-[var(--ink)] uppercase text-sm">Resume in-progress run</div>
                            <div className="text-xs text-[var(--color-ink-500)] mt-0.5">
                                {savedRun.gameState.arenaHidden && !canSeeArena(disclosureFor(savedRun.gameState.phase))
                                    ? '❓ Arena sealed'
                                    : savedRun.gameState.arena.name} · seed {savedRun.gameState.seed} ·{' '}
                                {savedRun.gameState.day === 0 ? savedRun.gameState.phase : `Day ${savedRun.gameState.day} — ${savedRun.gameState.phase}`} ·{' '}
                                {savedRun.gameState.tributes.filter(t => t.status === 'alive').length} tributes alive
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 flex-none">
                        <button
                            onClick={() => { gameActions.discardSavedRun(); setSavedRun(null); }}
                            className="btn btn-sm btn-ghost"
                        >
                            Discard
                        </button>
                        <button onClick={() => { void gameActions.resumeSavedRun(); }} className="btn btn-primary btn-sm">
                            Resume
                        </button>
                    </div>
                </div>
            )}

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
                    {(() => {
                        // The Games profile is a pure function of the seed, so the
                        // temperament the player is committing to can be shown live.
                        const preview = gamesProfileFor(trimmedSeed || seed);
                        const t = preview.temperament;
                        const mults: string[] = [];
                        if (t.hazardRate !== 1) mults.push(`hazards ×${t.hazardRate}`);
                        if (t.betrayalRate !== 1) mults.push(`betrayal ×${t.betrayalRate}`);
                        if (t.sponsorGenerosity !== 1) mults.push(`sponsors ×${t.sponsorGenerosity}`);
                        return (
                            <div className="panel-flush p-3 mt-2">
                                <div className="text-xs font-bold text-[var(--ink)]">{profileHeadline(preview)}</div>
                                <div className="text-[10px] text-[var(--color-ink-500)] mt-0.5">
                                    {t.blurb}{mults.length > 0 ? ` (${mults.join(', ')})` : ''}
                                    {' '}· The Capitol has something planned: “{preview.wildcard.name}”.
                                </div>
                            </div>
                        );
                    })()}
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
                                    {SIGNATURE_BLURBS[a.id] && (
                                        <div className={`text-[10px] mt-1 font-mono ${selected ? 'text-[var(--red)]' : 'text-[var(--color-ink-600)]'}`}>
                                            ⚙ {SIGNATURE_BLURBS[a.id]}
                                        </div>
                                    )}
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

                {/* §6.2: the standing patronage — a persistent sink for Capitol
                    Coins. Survives across runs via the Panem records. */}
                <div className="p-5 pt-0">
                    <div className="panel-flush p-4 space-y-2">
                        <div className="flex items-baseline justify-between flex-wrap gap-2">
                            <span className="eyebrow">Patron of a district</span>
                            <span className="font-mono text-[11px] text-[var(--color-ink-500)]">{coins} coins held</span>
                        </div>
                        <p className="text-[11px] text-[var(--color-ink-500)]">
                            {panem.patronDistrict !== undefined
                                ? `You are the standing patron of District ${panem.patronDistrict}: its tributes begin every Games with sponsors already warm.`
                                : `Spend ${gameActions.patronCost} coins to become the standing patron of one district — its tributes begin every future Games with a sponsor-trust head start.`}
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(d => (
                                <button
                                    key={d}
                                    className={`chip ${panem.patronDistrict === d ? 'chip-accent' : ''}`}
                                    // "D7" is a label to the eye and nothing to a
                                    // screen reader; aria-pressed carries which one
                                    // is the standing patronage.
                                    aria-pressed={panem.patronDistrict === d}
                                    aria-label={panem.patronDistrict === d
                                        ? `You are District ${d}'s patron`
                                        : `Become District ${d}'s patron for ${gameActions.patronCost} coins`}
                                    disabled={panem.patronDistrict !== d && coins < gameActions.patronCost}
                                    title={panem.patronDistrict === d
                                        ? `You are District ${d}'s patron`
                                        : `Become District ${d}'s patron (${gameActions.patronCost} coins)`}
                                    onClick={() => { if (panem.patronDistrict !== d) gameActions.patronDistrict(d); }}
                                >
                                    D{d}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-5 space-y-3">
                    <button onClick={() => setShowAdvanced(v => !v)} className="btn btn-ghost btn-sm -ml-2">
                        {showAdvanced ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        Advanced simulation settings
                    </button>

                    {showAdvanced && (
                        <div className="panel-flush p-4 space-y-5 animate-fadeIn">
                            <div className="space-y-1.5">
                                <span className="eyebrow">Presets</span>
                                <div className="flex flex-wrap gap-2">
                                    {PRESETS.map(p => {
                                        const active = JSON.stringify(config) === JSON.stringify(p.config);
                                        return (
                                            <button
                                                key={p.name}
                                                onClick={() => setConfig(p.config)}
                                                title={p.blurb}
                                                className={`chip ${active ? 'chip-accent' : ''}`}
                                            >
                                                {p.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
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
