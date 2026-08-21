/**
 * The three small payloads: the coin wallet, the chronicle filter preferences,
 * and the last setup config. All versioned and read/written through
 * `utils/storage`, and the wallet additionally adopts its pre-rename key
 * (`capitolCoins`).
 */
import { GameConfig } from '../models/types';
import { DEFAULT_GAME_CONFIG } from '../data/constants';
import {
    LEGACY_KEYS, STORAGE_KEYS, StorageSpec, asBool, asNum, asRecord, asStrArray,
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

export interface StoredFilters {
    mutedGroups: string[];
    importantOnly: boolean;
    pauseOnDeath: boolean;
}

export const DEFAULT_FILTERS: StoredFilters = { mutedGroups: [], importantOnly: false, pauseOnDeath: false };

export const FILTERS_SPEC: StorageSpec<StoredFilters> = {
    key: STORAGE_KEYS.feedFilters,
    version: 1,
    migrate: raw => {
        const r = asRecord(raw);
        if (!r) return null;
        return {
            mutedGroups: asStrArray(r.mutedGroups),
            importantOnly: asBool(r.importantOnly, false),
            pauseOnDeath: asBool(r.pauseOnDeath, false),
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
            districtCount: Math.min(12, Math.max(1, asNum(r.districtCount, DEFAULT_GAME_CONFIG.districtCount))),
            hazardRate: asNum(r.hazardRate, DEFAULT_GAME_CONFIG.hazardRate),
            betrayalRate: asNum(r.betrayalRate, DEFAULT_GAME_CONFIG.betrayalRate),
            sponsorGenerosity: asNum(r.sponsorGenerosity, DEFAULT_GAME_CONFIG.sponsorGenerosity),
            enableFeast: asBool(r.enableFeast, DEFAULT_GAME_CONFIG.enableFeast),
            enableSanity: asBool(r.enableSanity, DEFAULT_GAME_CONFIG.enableSanity),
        };
    },
};

export function readStoredConfig(): GameConfig {
    return readStored(CONFIG_SPEC) ?? { ...DEFAULT_GAME_CONFIG };
}

export function writeStoredConfig(config: GameConfig): void {
    writeStored(CONFIG_SPEC, config);
}
