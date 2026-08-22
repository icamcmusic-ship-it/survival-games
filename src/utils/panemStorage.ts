import { GameState, Tribute } from '../models/types';
import { ACHIEVEMENTS, CareerTotals, META_ACHIEVEMENTS, evaluateAchievements, evaluateMetaAchievements, evaluateNearMisses, NearMiss } from '../data/achievements';
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
    /** S-3: distinct arenas a victor has been crowned in, for the career meta-achievements. */
    arenasWon?: string[];
    /**
     * REPLAY-10: Head Gamemakers who persist across runs and accumulate a
     * reputation. Panem was a trophy case — nothing a player did in run 1
     * changed run 2. A Head Gamemaker who ran your last three Games, and whose
     * record you can see, makes the country feel continuous for almost no
     * content. Keyed by name.
     */
    gamemakerRecords?: Record<string, GamemakerRecord>;
    /**
     * REPLAY-12: the one thing the record book could not say.
     *
     * Every other entry here is an aggregate best — the longest Games, the most
     * kills, the youngest crown — so the rarest achievement in the simulation
     * (a District 6 or District 12 tribute actually winning, which happens in a
     * low single-digit percentage of runs) left no specific trace. A player who
     * managed it saw the same record book as a player who has only ever crowned
     * Careers.
     *
     * Keyed by district number. A missing key means "never won with them yet",
     * which is exactly what the UI wants to show as an empty slot, so no
     * placeholder rows are ever written.
     */
    districtCrowns?: Record<number, DistrictCrown>;
}

/** One district's victory, stamped so it reads as a specific thing that happened. */
export interface DistrictVictoryStamp {
    /** The victor. */
    name: string;
    /** Their archetype id, so the crown records *how* it was won. */
    archetype: string;
    /** Which of this player's Games it was — the "year" on the plaque. */
    run: number;
    kills: number;
    days: number;
    seed: string;
    arenaName: string;
    date: string;
}

/** Everything this player has ever won with one district. */
export interface DistrictCrown {
    /** Crowns taken with this district. */
    victories: number;
    /** The first one — the one that was actually an achievement. */
    first: DistrictVictoryStamp;
    /** The most recent one, which may be the same as the first. */
    latest: DistrictVictoryStamp;
    /** Distinct archetype ids this district has won with, in the order first seen. */
    archetypes: string[];
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

export const EMPTY_PANEM: PanemRecords = { runs: 0, victors: 0, unlocked: [], bests: {}, gamemakerRecords: {}, districtCrowns: {} };

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
    // The book grew with the systems: every record below reads a number a
    // newer layer already keeps (notoriety, tesserae, proficiency, feuds,
    // zone memory), so the record book is also a map of what the engine
    // tracks. Fields older saves never wrote simply never qualify.
    {
        id: 'shortest-games',
        label: 'Shortest Games',
        lowerIsBetter: true,
        extract: (state, victor) => victor ? { value: state.day, holder: victor } : undefined,
        format: v => `${v} day${v === 1 ? '' : 's'}`,
    },
    {
        id: 'oldest-victor',
        label: 'Oldest victor',
        extract: (_s, victor) => victor ? { value: victor.age, holder: victor } : undefined,
        format: v => `${v} years old`,
    },
    {
        id: 'biggest-upset',
        label: 'Biggest upset',
        lowerIsBetter: true,
        extract: (_s, victor) => victor && victor.trainingScore > 0
            ? { value: victor.trainingScore, holder: victor }
            : undefined,
        format: v => `won off a training score of ${v}`,
    },
    {
        id: 'deadliest-tribute',
        label: 'Deadliest tribute, crowned or not',
        extract: state => {
            const best = state.tributes.reduce((a, b) => (b.kills > a.kills ? b : a));
            return best.kills > 0 ? { value: best.kills, holder: best } : undefined;
        },
        format: v => `${v} kill${v === 1 ? '' : 's'}`,
    },
    {
        id: 'most-notorious',
        label: 'Most notorious',
        extract: state => {
            const best = state.tributes.reduce((a, b) => ((b.notoriety ?? 0) > (a.notoriety ?? 0) ? b : a));
            return (best.notoriety ?? 0) > 0 ? { value: best.notoriety!, holder: best } : undefined;
        },
        format: v => `notoriety ${v}`,
    },
    {
        id: 'most-gifted',
        label: 'Most parachutes received',
        extract: state => {
            const best = state.tributes.reduce((a, b) =>
                ((b.memory?.giftsReceived ?? 0) > (a.memory?.giftsReceived ?? 0) ? b : a));
            const gifts = best.memory?.giftsReceived ?? 0;
            return gifts > 0 ? { value: gifts, holder: best } : undefined;
        },
        format: v => `${v} parachute${v === 1 ? '' : 's'}`,
    },
    {
        id: 'most-feared',
        label: 'Most feared by the field',
        extract: state => {
            let best: { value: number; holder: Tribute } | undefined;
            state.tributes.forEach(t => {
                const dread = state.tributes.reduce((sum, o) =>
                    o.id === t.id ? sum : sum + (o.memory?.fear?.[t.id] ?? 0), 0);
                if (dread > 0 && (!best || dread > best.value)) best = { value: Math.round(dread), holder: t };
            });
            return best;
        },
        format: v => `${v} points of collective dread`,
    },
    {
        id: 'sharpest-skill',
        label: 'Sharpest skill',
        extract: state => {
            let best: { value: number; holder: Tribute } | undefined;
            state.tributes.forEach(t => {
                const peak = Math.max(0, ...Object.values(t.proficiencies ?? {}).map(v => v ?? 0));
                if (peak > 0 && (!best || peak > best.value)) best = { value: peak, holder: t };
            });
            return best;
        },
        format: v => `level ${v}`,
    },
    {
        id: 'most-betrayed',
        label: 'Most times sold out',
        extract: state => {
            const best = state.tributes.reduce((a, b) =>
                ((b.memory?.timesBetrayed ?? 0) > (a.memory?.timesBetrayed ?? 0) ? b : a));
            const times = best.memory?.timesBetrayed ?? 0;
            return times > 0 ? { value: times, holder: best } : undefined;
        },
        format: v => `betrayed ${v} time${v === 1 ? '' : 's'}`,
    },
    {
        id: 'least-televised',
        label: 'Least televised victor',
        lowerIsBetter: true,
        extract: (state, victor) => victor
            ? { value: state.log.filter(l => l.tributesInvolved.includes(victor.id)).length, holder: victor }
            : undefined,
        format: v => `${v} chronicle entries`,
    },
    {
        id: 'heaviest-bowl',
        label: 'Heaviest name in the bowl to win',
        extract: (_s, victor) => victor && (victor.tesserae ?? 0) > 0
            ? { value: victor.tesserae!, holder: victor }
            : undefined,
        format: v => `${v} tesserae carried home`,
    },
    {
        id: 'widest-wanderer',
        label: 'Most ground covered',
        extract: state => {
            const best = state.tributes.reduce((a, b) =>
                (Object.keys(b.memory?.zones ?? {}).length > Object.keys(a.memory?.zones ?? {}).length ? b : a));
            const seen = Object.keys(best.memory?.zones ?? {}).length;
            return seen > 1 ? { value: seen, holder: best } : undefined;
        },
        format: v => `${v} sectors known`,
    },
    {
        id: 'longest-feud',
        label: 'Longest-running feud',
        extract: state => {
            let best: { value: number; holder: Tribute } | undefined;
            state.tributes.forEach(t => {
                const fights = Math.max(0, ...Object.values(t.memory?.rivals ?? {}).map(r => r.fights));
                if (fights > 1 && (!best || fights > best.value)) best = { value: fights, holder: t };
            });
            return best;
        },
        format: v => `${v} fights with the same rival`,
    },
];

/**
 * v0 — unversioned `PanemRecords`, written before the envelope existed. Note
 *      that the old reader dropped `patronDistrict` and `gamemakerRecords`
 *      entirely on every read, so a player's standing patronage was quietly
 *      erased the first time the store was read back; the migration keeps them.
 * v1 — versioned envelope, every field carried across. `districtCrowns` is
 *      optional in the payload — a store written before the crowns board
 *      existed simply has none, which normalises to "nothing crowned yet".
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
            districtCrowns: asObjMap<DistrictCrown>(r.districtCrowns),
            arenasWon: asStrArray(r.arenasWon),
        };
    },
};

export function readPanem(): PanemRecords {
    return readStored(PANEM_SPEC) ?? { ...EMPTY_PANEM, bests: {}, gamemakerRecords: {}, districtCrowns: {} };
}

function writePanem(records: PanemRecords): void {
    writeStored(PANEM_SPEC, records);
}

export interface RunOutcome {
    /** The district this run crowned for the very first time, if any. */
    firstCrownDistrict?: number;
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

    // REPLAY-12: the crown is filed under the district that took it, so a
    // District 12 win is a specific thing the player has done rather than a
    // number folded into `victors`.
    let firstCrownDistrict: number | undefined;
    if (victor) {
        records.districtCrowns = records.districtCrowns ?? {};
        const stamp: DistrictVictoryStamp = {
            name: victor.name,
            archetype: victor.archetype,
            run: records.runs,
            kills: victor.kills,
            days: victor.daysSurvived,
            seed: state.seed,
            arenaName: state.arena.name,
            date: new Date().toISOString(),
        };
        // A store that was hand-edited (or written by a future/older build) can
        // hold a partial entry; treat anything unusable as a first crown rather
        // than throwing on the debrief.
        const prior = records.districtCrowns[victor.district];
        const existing = prior && prior.first && Array.isArray(prior.archetypes) ? prior : undefined;
        if (existing) {
            records.districtCrowns[victor.district] = {
                victories: existing.victories + 1,
                first: existing.first,
                latest: stamp,
                archetypes: existing.archetypes.includes(stamp.archetype)
                    ? existing.archetypes
                    : [...existing.archetypes, stamp.archetype],
            };
        } else {
            records.districtCrowns[victor.district] = {
                victories: 1,
                first: stamp,
                latest: stamp,
                archetypes: [stamp.archetype],
            };
            firstCrownDistrict = victor.district;
        }
    }

    if (victor) {
        records.arenasWon = records.arenasWon ?? [];
        if (!records.arenasWon.includes(state.arena.name)) records.arenasWon.push(state.arena.name);
    }

    // S-3: career-wide achievements read the updated records, so cumulative
    // counts and per-district completion unlock the moment they become true.
    const gmGames = Object.values(records.gamemakerRecords ?? {}).map(gm => gm.games);
    const totals: CareerTotals = {
        runs: records.runs,
        victors: records.victors,
        deaths: Object.values(records.gamemakerRecords ?? {}).reduce((sum, gm) => sum + gm.deaths, 0),
        crownedDistricts: Object.keys(records.districtCrowns ?? {}).map(Number),
        arenasWon: records.arenasWon ?? [],
        unlockedCount: records.unlocked.length,
        maxGamemakerGames: gmGames.length > 0 ? Math.max(...gmGames) : 0,
        outerVictories: Object.entries(records.districtCrowns ?? {})
            .filter(([d]) => ![1, 2, 4].includes(Number(d)))
            .reduce((sum, [, crown]) => sum + (crown?.victories ?? 0), 0),
    };

    const earned = [...evaluateAchievements(state), ...evaluateMetaAchievements(totals)];
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
        firstCrownDistrict,
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

/**
 * §10.2: what this player has never seen.
 *
 * The audit's own framing: a dozen implemented systems fire in under 20% of
 * runs, so the *felt* variety is far below the actual variety in the code.
 * Surfacing the gap turns that from a content problem into a discovery
 * feature — "you have never seen a District 10 victor" is both true and an
 * invitation, and it costs nothing but a read of records already kept.
 */
export interface UnseenNote {
    id: string;
    text: string;
}

export function unseenHighlights(records: PanemRecords, limit = 3): UnseenNote[] {
    // Nothing to be missing from an empty archive.
    if (records.runs < UNSEEN_MIN_RUNS) return [];
    const notes: UnseenNote[] = [];
    const crowns = records.districtCrowns ?? {};
    const unlocked = new Set(records.unlocked);

    const districts = Array.from({ length: 12 }, (_, i) => i + 1);
    const uncrowned = districts.filter(d => !crowns[d]?.first?.name);
    if (uncrowned.length > 0 && uncrowned.length <= 11) {
        const d = uncrowned[0];
        notes.push({
            id: `district-${d}`,
            text: uncrowned.length === 1
                ? `District ${d} is the only one that has never sent a victor home for you.`
                : `You have never crowned a victor from District ${d}${uncrowned.length > 2 ? ` — or from ${uncrowned.length - 1} of the others` : ''}.`,
        });
    }

    // Achievements are already phrased as things the simulation can do, so
    // the locked ones are a ready-made list of unseen outcomes.
    [...ACHIEVEMENTS, ...META_ACHIEVEMENTS]
        .filter(a => !unlocked.has(a.id))
        .slice(0, limit)
        .forEach(a => notes.push({ id: a.id, text: a.hint }));

    return notes.slice(0, limit);
}

/** Runs finished before the discovery layer has anything useful to say. */
const UNSEEN_MIN_RUNS = 3;
