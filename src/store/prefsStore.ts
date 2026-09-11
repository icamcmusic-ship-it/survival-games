/**
 * App-wide player preferences: display units, audio mute, and the extra
 * "pause on…" brakes. Persisted under `survivalGamesPrefs` through the same
 * versioned envelope as every other payload, and exposed as a store so any
 * component can subscribe with `useStore(prefsStore, ...)`.
 */
import { createStore } from './createStore';
import {
    STORAGE_KEYS, StorageSpec, asBool, asRecord, asStr, asStrArray, readStored, writeStored,
} from '../utils/storage';

export type Units = 'imperial' | 'metric';

/**
 * §2.1: which category palette the chronicle draws with.
 *
 * 'default' is the twenty-hue poster palette. 'colourblind' moves colour from
 * the category to the five filter groups, using hues that survive red-green
 * deficiency. 'contrast' takes colour out of the encoding entirely and leaves
 * the glyph to carry it. See the `data-palette` blocks in index.css.
 */
export type Palette = 'default' | 'colourblind' | 'contrast';
/** §2: light or dark chrome. 'system' follows `prefers-color-scheme`. */
export type Theme = 'system' | 'light' | 'dark';

export interface Prefs {
    /** How heights (and any future measures) are formatted. */
    units: Units;
    /** §2.1: the category palette. */
    palette: Palette;
    /** §2: dark mode. Independent of the category palette. */
    theme: Theme;
    /**
     * §2.5: spoiler-safe viewing. Suppresses death and kill log text and the
     * odds board until the epilogue, so a shared seed can be watched by
     * somebody who has not seen it rather than only replayed by somebody who
     * has.
     */
    spoilerSafe: boolean;
    /**
     * §2.9: contextual first-run tooltips — one line at the first death, the
     * first alliance and the first sponsor gift. Cleared once all three have
     * been seen.
     */
    seenCoachMarks: string[];
    /** Silences the cannon/anthem/parachute cues. */
    muteAudio: boolean;
    /** Extra auto-play brakes, alongside the older pauseOnDeath filter. */
    pauseOnBetrayal: boolean;
    pauseOnAlliance: boolean;
    pauseOnSponsor: boolean;
    /** Pause whenever the followed tribute is involved in an event. */
    pauseOnFollowed: boolean;
    /**
     * §2.2: pace each phase to what it is worth watching. Playback was one
     * speed for the whole run, and most viewers want the bloodbath slow and
     * the quiet day cycles fast.
     */
    phasePacing: boolean;
    /**
     * §2.4: honour the viewer's own reduced-motion setting rather than only
     * the OS media query, so it can be turned on here as well.
     */
    reduceMotion: boolean;
    /**
     * §2.4: the keyboard map is good and undiscoverable outside the ? panel.
     * A hint strip shows once, on the first run, until it is dismissed.
     */
    seenShortcutHint: boolean;
    /**
     * §13.2: the in-fiction arena brief, logged as the tributes rise and
     * immediately before the gong. Default on — it is what was asked for —
     * but a player who would rather discover the map blind can turn it off.
     */
    arenaBriefingOnDrop: boolean;
}

export const DEFAULT_PREFS: Prefs = {
    units: 'imperial',
    palette: 'default',
    theme: 'system',
    spoilerSafe: false,
    seenCoachMarks: [],
    muteAudio: false,
    pauseOnBetrayal: false,
    pauseOnAlliance: false,
    pauseOnSponsor: false,
    pauseOnFollowed: false,
    phasePacing: true,
    reduceMotion: false,
    seenShortcutHint: false,
    arenaBriefingOnDrop: true,
};

/**
 * §1.8 (audit): the toggle used to default to "off" for a user whose OS said
 * otherwise. The CSS media query already honoured the OS; the setting now
 * reads the same way, and a stored explicit choice still wins.
 */
export function systemReduceMotion(): boolean {
    try {
        return typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

export const PREFS_SPEC: StorageSpec<Prefs> = {
    key: STORAGE_KEYS.prefs,
    version: 1,
    migrate: raw => {
        const r = asRecord(raw);
        if (!r) return null;
        const units = asStr(r.units, DEFAULT_PREFS.units);
        const palette = asStr(r.palette, DEFAULT_PREFS.palette);
        const theme = asStr(r.theme, DEFAULT_PREFS.theme);
        return {
            units: units === 'metric' ? 'metric' : 'imperial',
            palette: palette === 'colourblind' || palette === 'contrast' ? palette : 'default',
            theme: theme === 'light' || theme === 'dark' ? theme : 'system',
            spoilerSafe: asBool(r.spoilerSafe, DEFAULT_PREFS.spoilerSafe),
            seenCoachMarks: asStrArray(r.seenCoachMarks),
            muteAudio: asBool(r.muteAudio, DEFAULT_PREFS.muteAudio),
            pauseOnBetrayal: asBool(r.pauseOnBetrayal, DEFAULT_PREFS.pauseOnBetrayal),
            pauseOnAlliance: asBool(r.pauseOnAlliance, DEFAULT_PREFS.pauseOnAlliance),
            pauseOnSponsor: asBool(r.pauseOnSponsor, DEFAULT_PREFS.pauseOnSponsor),
            pauseOnFollowed: asBool(r.pauseOnFollowed, DEFAULT_PREFS.pauseOnFollowed),
            phasePacing: asBool(r.phasePacing, DEFAULT_PREFS.phasePacing),
            reduceMotion: asBool(r.reduceMotion, systemReduceMotion()),
            seenShortcutHint: asBool(r.seenShortcutHint, DEFAULT_PREFS.seenShortcutHint),
            arenaBriefingOnDrop: asBool(r.arenaBriefingOnDrop, DEFAULT_PREFS.arenaBriefingOnDrop),
        };
    },
};

export function readPrefs(): Prefs {
    return readStored(PREFS_SPEC) ?? { ...DEFAULT_PREFS, reduceMotion: systemReduceMotion() };
}

export const prefsStore = createStore<Prefs>(readPrefs());

export function setPrefs(patch: Partial<Prefs>): void {
    prefsStore.setState(patch);
    writeStored(PREFS_SPEC, prefsStore.getState());
    if ('palette' in patch) applyPalette(prefsStore.getState().palette);
    if ('theme' in patch) applyTheme(prefsStore.getState().theme);
}

/**
 * §2: dark mode is a stamp on <html> the same way the palette is. 'system'
 * removes the stamp so the `prefers-color-scheme` block in index.css decides.
 */
export function applyTheme(theme: Theme): void {
    if (typeof document === 'undefined') return;
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
}

/**
 * §2.1: the palette is a stamp on <html>, so the CSS blocks in index.css do
 * the work and no component has to know which palette is active.
 */
export function applyPalette(palette: Palette): void {
    if (typeof document === 'undefined') return;
    if (palette === 'default') document.documentElement.removeAttribute('data-palette');
    else document.documentElement.setAttribute('data-palette', palette);
}

/** §2.9: records that a one-time contextual hint has been shown. */
export function markCoachMarkSeen(id: string): void {
    const seen = prefsStore.getState().seenCoachMarks;
    if (seen.includes(id)) return;
    setPrefs({ seenCoachMarks: [...seen, id] });
}

export function resetPrefs(): void {
    prefsStore.setState({ ...DEFAULT_PREFS });
    writeStored(PREFS_SPEC, prefsStore.getState());
    applyPalette(DEFAULT_PREFS.palette);
    applyTheme(DEFAULT_PREFS.theme);
}
