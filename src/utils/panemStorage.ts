import { GameState, Tribute } from '../models/types';
import { NearMiss, evaluateAchievements, evaluateNearMisses } from '../data/achievements';
import { Notable, runNotables } from './notables';
import {
    STORAGE_KEYS, StorageSpec, asNum, asObjMap, asRecord, asStrArray, readStored, removeStored,
    writeStored,
} from './storage';

/**
 * REPLAY-03: the thing that persists between runs.
 *
 * Every run used to start from zero — no records, no history, nothing to beat.
 * For a spectator simulator that is a real loss, because the second-best reason
 * to run it again is to see whether this cast can beat something the last one
 * did.
 *
 * Deliberately light. No unlock gating (nothing is withheld from a new player),
 * no currency, no levels — just a record book and a set of things the player has
 * now seen the simulation do. Both are derived from finished runs and written in
 * one place, so a corrupt or absent store degrades to "no records yet" rather
 * than breaking a screen.
 */

export const PANEM_STORAGE_KEY = STORAGE_KEYS.panem;

export interface RecordHolder {
    /** The number this record is for. */
    value: number;
    /** Who did it. */
    name: string;
    district: number;
    /** Which run, so it can be replayed. */
    seed: string;
    arenaName: string;
    date: string;
}

export interface PanemRecords {
    /** Runs finished, ever. */
    runs: number;
    /** Total tributes crowned, which is `runs` minus the Games nobody survived. */
    victors: number;
    /** Achievement ids the player has now seen happen. */
    unlocked: string[];
    /**
     * §6.2: a persistent coin sink. The player can spend Capitol Coins to
     * become the standing patron of one district; its tributes start every
     * future run with a sponsor-trust head start.
     */
    patronDistrict?: number;
    /** One entry per tracked record, keyed by record id. */
    bests: Record<string, RecordHolder>;
    /**
     * REPLAY-10: Head Gamemakers who persist across runs and accumulate a
     * reputation. Panem was a trophy case — nothing a player did in run 1
     * changed run 2. A Head Gamemaker who ran your last three Games, and whose
     * record you can see, makes the country feel continuous for almost no
     * content. Keyed by name.
     */
    gamemakerRecords?: Record<string, GamemakerRecord>;
}

/** One Head Gamemaker's running record across this player's Panem. */
export interface GamemakerRecord {
    /** Games they have run. */
    games: number;
    /** Of those, how many produced a victor. */
    victors: number;
    /** Total days across all their Games — the crowd notices a slow one. */
    totalDays: number;
    /** Total tributes killed across all their Games. */
    deaths: number;
}

export const EMPTY_PANEM: PanemRecords = { runs: 0, victors: 0, unlocked: [], bests: {}, gamemakerRecords: {} };

/**
 * The record book. Each entry says what it measures and which direction is
 * better, so `commitRun` does not need to know anything about them.
 */
export const RECORD_DEFS: Array<{
    id: string;
    label: string;
    /** Higher is better unless this is set. */
    lowerIsBetter?: boolean;
    /** The value this run scored, or undefined if the run does not qualify. */
    extract: (state: GameState, victor: Tribute | undefined) => { value: number; holder: Tribute } | undefined;
    /** How the number reads in the UI. */
    format: (value: number) => string;
}> = [
    {
        id: 'longest-run',
        label: 'Longest Games',
        extract: (state, victor) => victor ? { value: state.day, holder: victor } : undefined,
        format: v => `${v} days`,
    },
    {
        id: 'most-kills',
        label: 'Most kills by a victor',
        extract: (_s, victor) => victor ? { value: victor.kills, holder: victor } : undefined,
        format: v => `${v} kill${v === 1 ? '' : 's'}`,
    },
    {
        id: 'youngest-victor',
        label: 'Youngest victor',
        lowerIsBetter: true,
        extract: (_s, victor) => victor ? { value: victor.age, holder: victor } : undefined,
        format: v => `${v} years old`,
    },
    {
        id: 'most-kills-young',
        label: 'Most kills by a tribute under fifteen',
        extract: state => {
            const young = state.tributes.filter(t => t.age < 15);
            if (young.length === 0) return undefined;
            const best = young.reduce((a, b) => (b.kills > a.kills ? b : a));
            return best.kills > 0 ? { value: best.kills, holder: best } : undefined;
        },
        format: v => `${v} kill${v === 1 ? '' : 's'}`,
    },
    {
        id: 'healthiest-victor',
        label: 'Least scratched victor',
        extract: (_s, victor) => victor ? { value: victor.health, holder: victor } : undefined,
        format: v => `${v} health remaining`,
    },
    {
        id: 'narrowest-win',
        label: 'Narrowest win',
        lowerIsBetter: true,
        extract: (_s, victor) => victor ? { value: victor.health, holder: victor } : undefined,
        format: v => `${v} health remaining`,
    },
    {
        id: 'longest-survivor-no-kills',
        label: 'Longest run without a kill',
        extract: state => {
            const pacifists = state.tributes.filter(t => t.kills === 0);
            if (pacifists.length === 0) return undefined;
            const best = pacifists.reduce((a, b) => (b.daysSurvived > a.daysSurvived ? b : a));
            return { value: best.daysSurvived, holder: best };
        },
        format: v => `${v} days`,
    },
    {
        id: 'highest-training',
        label: 'Highest training score',
        extract: state => {
            const best = state.tributes.reduce((a, b) => (b.trainingScore > a.trainingScore ? b : a));
            return { value: best.trainingScore, holder: best };
        },
        format: v => `a ${v}`,
    },
];

/**
 * v0 — unversioned `PanemRecords`, written before the envelope existed. Note
 *      that the old reader dropped `patronDistrict` and `gamemakerRecords`
 *      entirely on every read, so a player's standing patronage was quietly
 *      erased the first time the store was read back; the migration keeps them.
 * v1 — versioned envelope, every field carried across.
 */
export const PANEM_SPEC: StorageSpec<PanemRecords> = {
    key: STORAGE_KEYS.panem,
    version: 1,
    migrate: raw => {
        const r = asRecord(raw);
        if (!r) return null;
        const patron = asNum(r.patronDistrict, NaN);
        return {
            runs: Math.max(0, asNum(r.runs, 0)),
            victors: Math.max(0, asNum(r.victors, 0)),
            unlocked: asStrArray(r.unlocked),
            bests: asObjMap<RecordHolder>(r.bests),
            gamemakerRecords: asObjMap<GamemakerRecord>(r.gamemakerRecords),
            patronDistrict: Number.isFinite(patron) ? patron : undefined,
        };
    },
};

export function readPanem(): PanemRecords {
    return readStored(PANEM_SPEC) ?? { ...EMPTY_PANEM, bests: {}, gamemakerRecords: {} };
}

function writePanem(records: PanemRecords): void {
    writeStored(PANEM_SPEC, records);
}

export interface RunOutcome {
    /** Achievement ids this run earned that had never been seen before. */
    newAchievements: string[];
    /** Record ids this run beat. */
    brokenRecords: string[];
    records: PanemRecords;
    /**
     * The two or three statistically unusual things about this run, phrased for
     * the end screen. The record book only ever reacted to a personal best;
     * most of what makes a run memorable is not a record. See `utils/notables.ts`.
     */
    notables: Notable[];
    /** Achievements the run came close to but did not earn. See `data/achievements.ts`. */
    nearMisses: NearMiss[];
}

/**
 * Folds one finished run into the record book. Idempotent per run: the caller
 * (gameStore) already guards against committing the same victory twice.
 */
export function commitRun(state: GameState): RunOutcome {
    const records = readPanem();
    const victor = state.tributes.find(t => t.status === 'alive');

    records.runs += 1;
    if (victor) records.victors += 1;

    // The Head Gamemaker who ran these Games carries the result forward.
    const gmName = state.headGamemaker;
    if (gmName) {
        records.gamemakerRecords = records.gamemakerRecords ?? {};
        const gm = records.gamemakerRecords[gmName]
            ?? { games: 0, victors: 0, totalDays: 0, deaths: 0 };
        gm.games += 1;
        if (victor) gm.victors += 1;
        gm.totalDays += state.day;
        gm.deaths += state.tributes.filter(t => t.status === 'dead').length;
        records.gamemakerRecords[gmName] = gm;
    }

    const earned = evaluateAchievements(state);
    const newAchievements = earned.filter(id => !records.unlocked.includes(id));
    records.unlocked = [...records.unlocked, ...newAchievements];

    const brokenRecords: string[] = [];
    RECORD_DEFS.forEach(def => {
        const scored = def.extract(state, victor);
        if (!scored) return;
        const current = records.bests[def.id];
        const beats = current === undefined
            || (def.lowerIsBetter ? scored.value < current.value : scored.value > current.value);
        if (!beats) return;
        records.bests[def.id] = {
            value: scored.value,
            name: scored.holder.name,
            district: scored.holder.district,
            seed: state.seed,
            arenaName: state.arena.name,
            date: new Date().toISOString(),
        };
        // The first run in an empty book sets every record by definition, which
        // is not worth telling the player about.
        if (current !== undefined) brokenRecords.push(def.id);
    });

    writePanem(records);
    return {
        newAchievements,
        brokenRecords,
        records,
        notables: runNotables(state, records),
        nearMisses: evaluateNearMisses(state, records.unlocked),
    };
}

/** §6.2: records (and persists) the player's standing district patronage. */
export function setPatronDistrict(district: number | undefined): PanemRecords {
    const records = readPanem();
    records.patronDistrict = district;
    writePanem(records);
    return records;
}

export function clearPanem(): void {
    removeStored(PANEM_SPEC);
}
