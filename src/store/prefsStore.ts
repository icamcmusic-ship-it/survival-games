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

export interface Prefs {
    /** How heights (and any future measures) are formatted. */
    units: Units;
    /** §2.1: the category palette. */
    palette: Palette;
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
}

export const DEFAULT_PREFS: Prefs = {
    units: 'imperial',
    palette: 'default',
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
};

export const PREFS_SPEC: StorageSpec<Prefs> = {
    key: STORAGE_KEYS.prefs,
    version: 1,
    migrate: raw => {
        const r = asRecord(raw);
        if (!r) return null;
        const units = asStr(r.units, DEFAULT_PREFS.units);
        const palette = asStr(r.palette, DEFAULT_PREFS.palette);
        return {
            units: units === 'metric' ? 'metric' : 'imperial',
            palette: palette === 'colourblind' || palette === 'contrast' ? palette : 'default',
            spoilerSafe: asBool(r.spoilerSafe, DEFAULT_PREFS.spoilerSafe),
            seenCoachMarks: asStrArray(r.seenCoachMarks),
            muteAudio: asBool(r.muteAudio, DEFAULT_PREFS.muteAudio),
            pauseOnBetrayal: asBool(r.pauseOnBetrayal, DEFAULT_PREFS.pauseOnBetrayal),
            pauseOnAlliance: asBool(r.pauseOnAlliance, DEFAULT_PREFS.pauseOnAlliance),
            pauseOnSponsor: asBool(r.pauseOnSponsor, DEFAULT_PREFS.pauseOnSponsor),
            pauseOnFollowed: asBool(r.pauseOnFollowed, DEFAULT_PREFS.pauseOnFollowed),
            phasePacing: asBool(r.phasePacing, DEFAULT_PREFS.phasePacing),
            reduceMotion: asBool(r.reduceMotion, DEFAULT_PREFS.reduceMotion),
            seenShortcutHint: asBool(r.seenShortcutHint, DEFAULT_PREFS.seenShortcutHint),
        };
    },
};

export function readPrefs(): Prefs {
    return readStored(PREFS_SPEC) ?? { ...DEFAULT_PREFS };
}

export const prefsStore = createStore<Prefs>(readPrefs());

export function setPrefs(patch: Partial<Prefs>): void {
    prefsStore.setState(patch);
    writeStored(PREFS_SPEC, prefsStore.getState());
    if ('palette' in patch) applyPalette(prefsStore.getState().palette);
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
}
