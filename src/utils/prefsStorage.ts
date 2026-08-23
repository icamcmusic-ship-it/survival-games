/**
 * The three small payloads: the coin wallet, the chronicle filter preferences,
 * and the last setup config. All versioned and read/written through
 * `utils/storage`, and the wallet additionally adopts its pre-rename key
 * (`capitolCoins`).
 */
import { GameConfig } from '../models/types';
import { DEFAULT_GAME_CONFIG } from '../data/constants';
import {
    LEGACY_KEYS, STORAGE_KEYS, StorageSpec, asBool, asNum, asRecord, asStr, asStrArray,
    readStored, writeStored,
} from './storage';

export const STARTING_COINS = 1000;

/**
 * The wallet used to be stored as a bare number *string* under `capitolCoins`,
 * hence the `typeof raw === 'number' || 'string'` branch: v0 data is whatever
 * `Number(localStorage.getItem(...))` used to be handed.
 */
export const COINS_SPEC: StorageSpec<number> = {
    key: STORAGE_KEYS.coins,
    version: 1,
    legacyKeys: LEGACY_KEYS.coins,
    migrate: raw => {
        const n = typeof raw === 'string' ? Number(raw) : raw;
        // Note the explicit finite/negative check: `Number(null)` is 0, which
        // would silently hand a player an empty wallet.
        return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    },
};

export function readCoins(): number {
    const coins = readStored(COINS_SPEC);
    return coins === null ? STARTING_COINS : coins;
}

export function writeCoins(coins: number): void {
    writeStored(COINS_SPEC, Math.max(0, Math.floor(coins)));
}

/** Reading density for the chronicle — mirrors FeedDensity in EventFeed. */
export type StoredDensity = 'headlines' | 'scenes' | 'everything';

export interface StoredFilters {
    mutedGroups: string[];
    /**
     * Replaces the old `importantOnly` boolean: at 41% of lines flagged
     * important it removed barely half the feed and was the only lever.
     * v0/v1 payloads with `importantOnly: true` migrate to 'headlines'.
     */
    density: StoredDensity;
    pauseOnDeath: boolean;
    /**
     * A6: which of the dossier column's accordion sections are open. The
     * sidebar used to be three panes behind a mobile-only segmented control
     * with no memory at all; now that it is five sections a reader can open
     * independently, which ones they keep open is a preference.
     */
    openSections?: string[];
    /**
     * §2.12: reading comfort for a chronicle that runs to ~600 lines. Text
     * size and a measure cap are the two settings a long-form reader actually
     * reaches for.
     */
    textScale?: 'small' | 'normal' | 'large';
    narrowMeasure?: boolean;
    /** §2.7: whether the one-time density hint has been dismissed. */
    densityHintSeen?: boolean;
}

export const DEFAULT_FILTERS: StoredFilters = {
    mutedGroups: [],
    // §2.7: a first run at 'everything' is 568 lines at 13px in a third of the
    // viewport. 'scenes' is the density a first-time reader can actually
    // follow; the one-time hint explains the other two.
    density: 'scenes',
    pauseOnDeath: false,
    openSections: ['tributes'],
    textScale: 'normal',
    narrowMeasure: false,
    densityHintSeen: false,
};

export const FILTERS_SPEC: StorageSpec<StoredFilters> = {
    key: STORAGE_KEYS.feedFilters,
    version: 3,
    migrate: raw => {
        const r = asRecord(raw);
        if (!r) return null;
        const d = asStr(r.density, '');
        const density: StoredDensity = d === 'headlines' || d === 'scenes' || d === 'everything'
            ? d
            // A v0/v1 payload predates the three-tier density entirely. It also
            // predates the 'scenes' default, so an existing reader keeps the
            // "show me everything" behaviour they already had rather than
            // silently losing two thirds of their feed on upgrade.
            : asBool(r.importantOnly, false) ? 'headlines' : 'everything';
        const scale = asStr(r.textScale, 'normal');
        return {
            mutedGroups: asStrArray(r.mutedGroups),
            density,
            pauseOnDeath: asBool(r.pauseOnDeath, false),
            openSections: r.openSections === undefined
                ? [...DEFAULT_FILTERS.openSections!]
                : asStrArray(r.openSections),
            textScale: scale === 'small' || scale === 'large' ? scale : 'normal',
            narrowMeasure: asBool(r.narrowMeasure, false),
            densityHintSeen: asBool(r.densityHintSeen, false),
        };
    },
};

export function readFilters(): StoredFilters {
    return readStored(FILTERS_SPEC) ?? { ...DEFAULT_FILTERS };
}

export function writeFilters(filters: StoredFilters): void {
    writeStored(FILTERS_SPEC, filters);
}

export const CONFIG_SPEC: StorageSpec<GameConfig> = {
    key: STORAGE_KEYS.lastConfig,
    version: 1,
    migrate: raw => {
        const r = asRecord(raw);
        if (!r) return null;
        return {
            districtCount: Math.min(16, Math.max(2, asNum(r.districtCount, DEFAULT_GAME_CONFIG.districtCount))),
            hazardRate: asNum(r.hazardRate, DEFAULT_GAME_CONFIG.hazardRate),
            betrayalRate: asNum(r.betrayalRate, DEFAULT_GAME_CONFIG.betrayalRate),
            sponsorGenerosity: asNum(r.sponsorGenerosity, DEFAULT_GAME_CONFIG.sponsorGenerosity),
            enableFeast: asBool(r.enableFeast, DEFAULT_GAME_CONFIG.enableFeast),
            enableSanity: asBool(r.enableSanity, DEFAULT_GAME_CONFIG.enableSanity),
            // Dropped here in v1's first cut, which silently reset the
            // player's plain-names choice on every reload.
            plainNames: asBool(r.plainNames, !!DEFAULT_GAME_CONFIG.plainNames),
        };
    },
};

export function readStoredConfig(): GameConfig {
    return readStored(CONFIG_SPEC) ?? { ...DEFAULT_GAME_CONFIG };
}

export function writeStoredConfig(config: GameConfig): void {
    writeStored(CONFIG_SPEC, config);
}
