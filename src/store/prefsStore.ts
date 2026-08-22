/**
 * App-wide player preferences: display units, audio mute, and the extra
 * "pause on…" brakes. Persisted under `survivalGamesPrefs` through the same
 * versioned envelope as every other payload, and exposed as a store so any
 * component can subscribe with `useStore(prefsStore, ...)`.
 */
import { createStore } from './createStore';
import {
    STORAGE_KEYS, StorageSpec, asBool, asRecord, asStr, readStored, writeStored,
} from '../utils/storage';

export type Units = 'imperial' | 'metric';

export interface Prefs {
    /** How heights (and any future measures) are formatted. */
    units: Units;
    /** Silences the cannon/anthem/parachute cues. */
    muteAudio: boolean;
    /** Extra auto-play brakes, alongside the older pauseOnDeath filter. */
    pauseOnBetrayal: boolean;
    pauseOnAlliance: boolean;
    pauseOnSponsor: boolean;
    /** Pause whenever the followed tribute is involved in an event. */
    pauseOnFollowed: boolean;
}

export const DEFAULT_PREFS: Prefs = {
    units: 'imperial',
    muteAudio: false,
    pauseOnBetrayal: false,
    pauseOnAlliance: false,
    pauseOnSponsor: false,
    pauseOnFollowed: false,
};

export const PREFS_SPEC: StorageSpec<Prefs> = {
    key: STORAGE_KEYS.prefs,
    version: 1,
    migrate: raw => {
        const r = asRecord(raw);
        if (!r) return null;
        const units = asStr(r.units, DEFAULT_PREFS.units);
        return {
            units: units === 'metric' ? 'metric' : 'imperial',
            muteAudio: asBool(r.muteAudio, DEFAULT_PREFS.muteAudio),
            pauseOnBetrayal: asBool(r.pauseOnBetrayal, DEFAULT_PREFS.pauseOnBetrayal),
            pauseOnAlliance: asBool(r.pauseOnAlliance, DEFAULT_PREFS.pauseOnAlliance),
            pauseOnSponsor: asBool(r.pauseOnSponsor, DEFAULT_PREFS.pauseOnSponsor),
            pauseOnFollowed: asBool(r.pauseOnFollowed, DEFAULT_PREFS.pauseOnFollowed),
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
}

export function resetPrefs(): void {
    prefsStore.setState({ ...DEFAULT_PREFS });
    writeStored(PREFS_SPEC, prefsStore.getState());
}
