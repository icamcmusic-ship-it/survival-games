import { GameState, Tribute } from '../models/types';
import { evaluateAchievements } from '../data/achievements';

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

export const PANEM_STORAGE_KEY = 'survivalGamesPanem';

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
    /** One entry per tracked record, keyed by record id. */
    bests: Record<string, RecordHolder>;
}

export const EMPTY_PANEM: PanemRecords = { runs: 0, victors: 0, unlocked: [], bests: {} };

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

export function readPanem(): PanemRecords {
    try {
        const raw = localStorage.getItem(PANEM_STORAGE_KEY);
        if (!raw) return { ...EMPTY_PANEM, bests: {} };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { ...EMPTY_PANEM, bests: {} };
        return {
            runs: typeof parsed.runs === 'number' ? parsed.runs : 0,
            victors: typeof parsed.victors === 'number' ? parsed.victors : 0,
            unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked.filter((u: unknown) => typeof u === 'string') : [],
            bests: parsed.bests && typeof parsed.bests === 'object' ? parsed.bests : {},
        };
    } catch {
        return { ...EMPTY_PANEM, bests: {} };
    }
}

function writePanem(records: PanemRecords): void {
    try {
        localStorage.setItem(PANEM_STORAGE_KEY, JSON.stringify(records));
    } catch {
        /* quota exhausted or storage disabled — the run still finished correctly */
    }
}

export interface RunOutcome {
    /** Achievement ids this run earned that had never been seen before. */
    newAchievements: string[];
    /** Record ids this run beat. */
    brokenRecords: string[];
    records: PanemRecords;
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
    return { newAchievements, brokenRecords, records };
}

export function clearPanem(): void {
    try {
        localStorage.removeItem(PANEM_STORAGE_KEY);
    } catch {
        /* nothing to do */
    }
}
