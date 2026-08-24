import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { prefsStore, resetPrefs, setPrefs } from '../store/prefsStore';
import { useStore } from '../store/createStore';
import { DEFAULT_FILTERS, writeFilters } from '../utils/prefsStorage';

/**
 * §2.14: the one place every persisted preference can be seen and reset.
 * Config and chronicle filters already persisted, but they were scattered
 * with no way to review them; this collects units, audio, and the auto-play
 * brakes, plus a reset. Panem data export lives with the Hall of Fame
 * (HofTransfer), where the data it moves actually lives.
 */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
    const prefs = useStore(prefsStore, p => p);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        panelRef.current?.focus();
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 bg-black/70 flex items-start md:items-center justify-center p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            onClick={onClose}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                className="panel p-6 max-w-lg w-full space-y-5 my-8"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-start gap-4">
                    <h2 className="display-title text-2xl">Settings</h2>
                    <button onClick={onClose} className="btn btn-sm btn-ghost" aria-label="Close settings">
                        <X className="w-4 h-4" /> Close
                    </button>
                </div>

                {/* §2.1: category colour is a real information channel, and it
                    is the one that breaks first. The chronicle already pairs
                    every category with a glyph, so these modes change what
                    colour is *for* rather than removing it. */}
                <div className="space-y-1.5">
                    <span className="eyebrow">Category colour</span>
                    <div className="seg w-fit flex-wrap">
                        {([
                            ['default', 'Full colour', 'Twenty hues, one per event category.'],
                            ['colourblind', 'Colourblind-safe', 'Five hues, one per category group; the glyph carries the category.'],
                            ['contrast', 'High contrast', 'No colour coding at all — maximum legibility, glyph only.'],
                        ] as const).map(([id, label, hint]) => (
                            <button
                                key={id}
                                onClick={() => setPrefs({ palette: id })}
                                aria-pressed={prefs.palette === id}
                                className="seg-item"
                                title={hint}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-[var(--color-ink-500)]">
                        {prefs.palette === 'colourblind'
                            ? 'Colour now groups events (violence, arena, social, supply, ceremony). The glyph beside each line still names the exact category.'
                            : prefs.palette === 'contrast'
                                ? 'Every category draws in ink. The glyph beside each line is the only category signal, which is the point.'
                                : 'One hue per category, reinforced by the glyph beside each line.'}
                    </p>
                </div>

                {/* §2.5: watching a shared seed with somebody who has not seen
                    it. Suppresses the two things that give the ending away —
                    death and kill text, and the odds board — until the run is
                    over. */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={prefs.spoilerSafe}
                        onChange={e => setPrefs({ spoilerSafe: e.target.checked })}
                        className="mt-1"
                    />
                    <span>
                        <span className="block text-sm">Spoiler-safe viewing</span>
                        <span className="block text-xs text-[var(--color-ink-500)]">
                            Hides death and kill text and the odds board until the epilogue, so a shared run can be watched
                            by somebody seeing it for the first time.
                        </span>
                    </span>
                </label>

                <div className="space-y-1.5">
                    <span className="eyebrow">Units</span>
                    <div className="seg w-fit">
                        {([['imperial', `5'5"`], ['metric', '165 cm']] as const).map(([id, sample]) => (
                            <button
                                key={id}
                                onClick={() => setPrefs({ units: id })}
                                aria-pressed={prefs.units === id}
                                className="seg-item"
                            >
                                {id === 'imperial' ? 'Imperial' : 'Metric'} <span className="font-mono text-[10px] text-[var(--color-ink-500)] ml-1">{sample}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <span className="eyebrow">Sound</span>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--color-ink-300)] font-semibold">
                        <input
                            type="checkbox"
                            checked={!prefs.muteAudio}
                            onChange={e => setPrefs({ muteAudio: !e.target.checked })}
                            className="w-4 h-4 accent-[var(--red)]"
                        />
                        Cannon, anthem and parachute cues
                    </label>
                </div>

                <div className="space-y-1.5">
                    <span className="eyebrow">Auto-play brakes</span>
                    <p className="text-[10px] text-[var(--color-ink-500)]">Auto-advance drops back to manual when any of these land.</p>
                    {([
                        ['pauseOnBetrayal', 'A betrayal'],
                        ['pauseOnAlliance', 'An alliance forming or breaking'],
                        ['pauseOnSponsor', 'A sponsor parachute'],
                        ['pauseOnFollowed', 'Anything involving the tribute you follow'],
                    ] as const).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer text-xs text-[var(--color-ink-300)] font-semibold">
                            <input
                                type="checkbox"
                                checked={prefs[key]}
                                onChange={e => setPrefs({ [key]: e.target.checked })}
                                className="w-4 h-4 accent-[var(--red)]"
                            />
                            {label}
                        </label>
                    ))}
                </div>

                <div className="space-y-1.5 border-t border-[var(--color-ink-800)] pt-4">
                    <span className="eyebrow">Reset</span>
                    <div className="flex flex-wrap gap-2">
                        <button
                            className="btn btn-sm"
                            onClick={() => resetPrefs()}
                            title="Units, sound and brakes back to defaults"
                        >
                            Reset preferences
                        </button>
                        <button
                            className="btn btn-sm"
                            onClick={() => writeFilters({ ...DEFAULT_FILTERS })}
                            title="Chronicle mutes and reading density back to defaults (takes effect next run)"
                        >
                            Reset chronicle filters
                        </button>
                    </div>
                    <p className="text-[10px] text-[var(--color-ink-500)]">
                        Your Panem record book (achievements, records, Hall of Fame) can be exported,
                        imported or wiped from the Hall of Fame screen.
                    </p>
                </div>
            </div>
        </div>
    );
}
