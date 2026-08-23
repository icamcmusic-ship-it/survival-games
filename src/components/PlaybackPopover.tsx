import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { prefsStore, setPrefs } from '../store/prefsStore';
import { chronicleStore, setChronicle } from '../store/chronicleStore';
import { useStore } from '../store/createStore';

export type Speed = 'manual' | '1x' | '5x' | 'auto';
export type PlayUntil = 'death' | 'feast' | 'final8' | null;

const SPEEDS: Array<[Speed, string]> = [
    ['manual', 'Manual'],
    ['1x', 'Read'],
    ['5x', 'Skim'],
    ['auto', 'Skip'],
];

/**
 * A6: one control for one question — "when do I want to stop?"
 *
 * Pause-on-death lived in the phase panel, "play until…" lived beside it, and
 * the other four pause triggers lived at the bottom of the filter drawer. Three
 * controls answering a single question, in two different places, one of them
 * behind a button labelled Filters. They are now a popover hung off the speed
 * segment they modify.
 */
export function PlaybackPopover({
    speed,
    onSpeed,
    playUntil,
    onPlayUntil,
    feastEnabled,
    aliveCount,
    hasFollowed,
    disabled,
}: {
    speed: Speed;
    onSpeed: (s: Speed) => void;
    playUntil: PlayUntil;
    onPlayUntil: (p: PlayUntil) => void;
    feastEnabled: boolean;
    aliveCount: number;
    hasFollowed: boolean;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const prefs = useStore(prefsStore, p => p);
    const pauseOnDeath = useStore(chronicleStore, s => s.pauseOnDeath);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: PointerEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('pointerdown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('pointerdown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const brakeCount = [pauseOnDeath, prefs.pauseOnBetrayal, prefs.pauseOnAlliance, prefs.pauseOnSponsor, prefs.pauseOnFollowed]
        .filter(Boolean).length;

    return (
        <div className="relative flex items-center gap-1" ref={ref}>
            <div className="seg">
                {SPEEDS.map(([s, label]) => (
                    <button
                        key={s}
                        onClick={() => onSpeed(s)}
                        aria-pressed={speed === s}
                        disabled={disabled}
                        className="seg-item"
                        title={s === 'manual' ? 'Advance by hand'
                            : s === '1x' ? 'Slow enough to read every line'
                            : s === '5x' ? 'Fast enough to skim'
                            : 'As fast as the simulator will go'}
                    >
                        {s === 'manual' ? <Pause className="w-3 h-3 inline" /> : s === 'auto' ? <Play className="w-3 h-3 inline" /> : null}
                        <span className="ml-1">{label}</span>
                    </button>
                ))}
            </div>
            <button
                className="seg-item"
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={() => setOpen(v => !v)}
                title="When to stop: pause triggers and play-until"
            >
                ⏱{brakeCount > 0 || playUntil ? <span className="ml-0.5 text-[var(--red)]">•</span> : null}
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Playback — when to stop"
                    className="absolute top-full right-0 mt-1 z-40 panel p-4 space-y-3 w-[min(20rem,90vw)] shadow-[var(--shadow-ink-sm)]"
                >
                    <div className="space-y-1.5">
                        <span className="eyebrow">Run until…</span>
                        <select
                            className="field text-xs"
                            value={playUntil ?? ''}
                            aria-label="Run at Skim pace until a chosen moment, then hold"
                            onChange={e => {
                                const v = e.target.value as '' | 'death' | 'feast' | 'final8';
                                onPlayUntil(v === '' ? null : v);
                            }}
                        >
                            <option value="">…nothing in particular</option>
                            <option value="death">the next cannon</option>
                            <option value="feast" disabled={!feastEnabled}>the feast</option>
                            <option value="final8" disabled={aliveCount <= 8}>the final eight</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <span className="eyebrow">Or stop whenever there is…</span>
                        {([
                            ['death', 'A cannon', pauseOnDeath, (v: boolean) => setChronicle({ pauseOnDeath: v }), false],
                            ['betrayal', 'A betrayal', prefs.pauseOnBetrayal, (v: boolean) => setPrefs({ pauseOnBetrayal: v }), false],
                            ['alliance', 'An alliance shift', prefs.pauseOnAlliance, (v: boolean) => setPrefs({ pauseOnAlliance: v }), false],
                            ['sponsor', 'A parachute', prefs.pauseOnSponsor, (v: boolean) => setPrefs({ pauseOnSponsor: v }), false],
                            ['followed', 'Your followed tribute', prefs.pauseOnFollowed, (v: boolean) => setPrefs({ pauseOnFollowed: v }), !hasFollowed],
                        ] as const).map(([id, label, checked, set, isDisabled]) => (
                            <label key={id} className="flex items-center gap-2 cursor-pointer text-xs text-[var(--color-ink-300)]">
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={isDisabled}
                                    onChange={e => set(e.target.checked)}
                                    className="accent-[var(--red)]"
                                />
                                {label}
                                {isDisabled && <span className="text-[10px] text-[var(--color-ink-500)]">(follow someone first)</span>}
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
