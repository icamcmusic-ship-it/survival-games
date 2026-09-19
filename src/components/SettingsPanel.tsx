import React from 'react';
import { Hint } from './Hint';
import { useDialogFocus } from '../ui/useDialogFocus';
import { X } from 'lucide-react';
import { prefsStore, resetPrefs, setPrefs } from '../store/prefsStore';
import { useStore } from '../store/createStore';
import { DEFAULT_FILTERS, writeFilters } from '../utils/prefsStorage';
import { SHORTCUTS, ShortcutId, boundKey, keyLabel, shortcutConflict } from '../data/shortcuts';

/**
 * §2.14: the one place every persisted preference can be seen and reset.
 * Config and chronicle filters already persisted, but they were scattered
 * with no way to review them; this collects units, audio, and the auto-play
 * brakes, plus a reset. Panem data export lives with the Hall of Fame
 * (HofTransfer), where the data it moves actually lives.
 */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
    /* AUDIT-8 §2.1: which binding is waiting for a keypress, and what to say
       about the last attempt. `null` is "not listening". */
    const [capturing, setCapturing] = React.useState<ShortcutId | null>(null);
    const [keyNotice, setKeyNotice] = React.useState<string | null>(null);
    const prefs = useStore(prefsStore, p => p);
    const panelRef = useDialogFocus<HTMLDivElement>(onClose);

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

                {/* AUDIT-8 §2.1: rebindable keys. Open since AUDIT-7 §2.4.

                    Twenty keys were bound directly off `e.key` with no
                    indirection at all. That is an accessibility gap rather
                    than a nicety: `[` and `]` need a modifier on most non-US
                    layouts, `?` needs Shift on all of them, and a one-handed
                    player cannot reach Space and Shift+D together. The help
                    overlay taught the map, which made it discoverable and
                    still unchangeable. */}
                {/* Collapsed by default. Sixteen rebindable keys is a lot of
                    vertical space for a control most players never touch, and
                    an always-open list made the Settings panel tall enough
                    that the browser harness could no longer reach the controls
                    below it — which is exactly what it would do to a reader on
                    a short screen. */}
                <details className="space-y-1.5">
                    <summary className="eyebrow cursor-pointer select-none">
                        Keyboard <span className="font-normal normal-case text-[var(--color-ink-500)]">— rebind any shortcut</span>
                    </summary>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 items-center mt-2">
                        {SHORTCUTS.map(sc => {
                            const key = boundKey(sc.id, prefs.shortcutOverrides);
                            const listening = capturing === sc.id;
                            return (
                                <React.Fragment key={sc.id}>
                                    <button
                                        onClick={() => { setCapturing(listening ? null : sc.id); setKeyNotice(null); }}
                                        onKeyDown={e => {
                                            if (!listening) return;
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (e.key === 'Escape') { setCapturing(null); return; }
                                            const why = shortcutConflict(sc.id, e.key, prefs.shortcutOverrides);
                                            if (why) { setKeyNotice(`${keyLabel(e.key)}: ${why}`); return; }
                                            setPrefs({ shortcutOverrides: { ...prefs.shortcutOverrides, [sc.id]: e.key } });
                                            setCapturing(null);
                                            setKeyNotice(`"${sc.label}" is now ${keyLabel(e.key)}.`);
                                        }}
                                        aria-pressed={listening}
                                        aria-label={listening
                                            ? `Press a new key for ${sc.label}, or Escape to cancel`
                                            : `${sc.label} — currently ${keyLabel(key)}. Activate to rebind.`}
                                        className="btn btn-sm font-mono min-w-[5.5rem]"
                                    >
                                        {listening ? 'press a key' : keyLabel(key)}
                                    </button>
                                    <span className="text-xs text-[var(--color-ink-300)]">{sc.label}</span>
                                </React.Fragment>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => { setPrefs({ shortcutOverrides: {} }); setCapturing(null); setKeyNotice('Every key is back to its default.'); }}
                            className="btn btn-sm btn-ghost"
                        >
                            Reset keys
                        </button>
                        <span className="text-xs text-[var(--color-ink-500)]" role="status">
                            {keyNotice ?? 'The digits mute categories and Escape closes panels; neither can be rebound.'}
                        </span>
                    </div>
                </details>

                {/* AUDIT-8 §2.2: reading size. Open since AUDIT-7 §2.3.

                    The chronicle's density control is a *content* filter — it
                    decides which lines exist, not how big they are — so a
                    reader who wanted the text larger had no control at all in a
                    game whose main output is nine hundred lines of prose in a
                    scrolling column. Everything is sized in `rem`, so this is
                    one multiplier on the root, stamped on <html> exactly the
                    way the palette and the theme already are. */}
                <div className="space-y-1.5">
                    <span className="eyebrow">Reading size</span>
                    <div className="seg w-fit flex-wrap">
                        {([
                            ['small', 'Small', 'Tighter; fits more of the chronicle on screen at once.'],
                            ['normal', 'Normal', 'The size the poster layout was drawn at.'],
                            ['large', 'Large', 'Roughly fifteen per cent up, everywhere.'],
                            ['larger', 'Larger', 'About a third up. Past this, the browser\'s own page zoom is the better tool.'],
                        ] as const).map(([id, label, hint]) => (
                            <Hint key={id} text={hint}>
                                <button
                                    onClick={() => setPrefs({ textScale: id })}
                                    aria-pressed={prefs.textScale === id}
                                    className="seg-item"
                                >
                                    {label}
                                </button>
                            </Hint>
                        ))}
                    </div>
                    <p className="text-xs text-[var(--color-ink-500)]">
                        Scales every size in the interface at once, and takes effect immediately.
                    </p>
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
                            <Hint key={id} text={hint}>
                                <button
                                    onClick={() => setPrefs({ palette: id })}
                                    aria-pressed={prefs.palette === id}
                                    className="seg-item"
                                >
                                    {label}
                                </button>
                            </Hint>
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

                {/* §2: dark mode. A newspaper-white page for a long read
                    session is fatiguing; 'System' follows the OS setting. */}
                <div className="space-y-1.5">
                    <span className="eyebrow">Theme</span>
                    <div className="seg w-fit flex-wrap">
                        {([
                            ['system', 'System', 'Follow the operating system\'s light or dark preference.'],
                            ['light', 'Light', 'Cream paper and black ink, whatever the system says.'],
                            ['dark', 'Dark', 'Ink paper and cream type, for long sessions after dark.'],
                        ] as const).map(([id, label, hint]) => (
                            <Hint key={id} text={hint}>
                                <button
                                    onClick={() => setPrefs({ theme: id })}
                                    aria-pressed={prefs.theme === id}
                                    className="seg-item"
                                >
                                    {label}
                                </button>
                            </Hint>
                        ))}
                    </div>
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

                {/* §(requests): "add a stripped down mode that only shows raw
                    facts without prose". A rendering register, not an engine
                    mode — the same seed is the same Games either way, and
                    switching mid-run does not make it a different run. */}
                <div className="space-y-1.5">
                    <span className="eyebrow">Chronicle</span>
                    <div className="seg w-fit">
                        {([['broadcast', 'Broadcast'], ['facts', 'Facts only']] as const).map(([id, label]) => (
                            <button
                                key={id}
                                onClick={() => setPrefs({ chronicleStyle: id })}
                                aria-pressed={prefs.chronicleStyle === id}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <span className="block text-xs text-[var(--color-ink-500)]">
                        Facts only reports the run as a record rather than as Capitol coverage: every event that changed
                        the state, in order, with its cast and its place, and no sentence around it.
                    </span>
                </div>

                {/* §(requests): "remove internal sanity reasoning, but still
                    track it. Only show very important sanity changes." */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={prefs.quietSanity}
                        onChange={e => setPrefs({ quietSanity: e.target.checked })}
                        className="mt-1"
                    />
                    <span>
                        <span className="block text-sm">Quiet the running commentary on sanity</span>
                        <span className="block text-xs text-[var(--color-ink-500)]">
                            Keeps the breakdowns, the hallucinations and the oaths; drops the line-by-line narration of
                            everybody's state of mind. Nothing about how sanity works changes — it is still tracked, still
                            drains, and still decides the endgame.
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

                {/* §15 (requests): fullscreen when the Games begin. Only the
                    reap click can ask for it — the browser refuses anywhere
                    else — so the setting is worded as what actually happens. */}
                <div className="space-y-1.5">
                    <span className="eyebrow">Display</span>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--color-ink-300)] font-semibold">
                        <input
                            type="checkbox"
                            checked={prefs.fullscreenOnStart}
                            onChange={e => setPrefs({ fullscreenOnStart: e.target.checked })}
                            className="w-4 h-4 accent-[var(--red)]"
                        />
                        Go fullscreen when a Games starts
                    </label>
                    <p className="text-[10px] text-[var(--color-ink-500)]">
                        Asked for on the reaping click. Some browsers refuse it — in a frame, or on iOS — and the Games run windowed instead.
                    </p>
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
                        {/* Audit 3 §2.1: two identically-styled reset buttons whose
                            scopes were distinguished only by a hover tooltip — which on
                            a phone meant they were not distinguished at all. */}
                        <Hint text="Units, sound and brakes back to defaults">
                            <button className="btn btn-sm" onClick={() => resetPrefs()}>
                                Reset preferences
                            </button>
                        </Hint>
                        <Hint text="Chronicle mutes and reading density back to defaults (takes effect next run)">
                            <button className="btn btn-sm" onClick={() => writeFilters({ ...DEFAULT_FILTERS })}>
                                Reset chronicle filters
                            </button>
                        </Hint>
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
