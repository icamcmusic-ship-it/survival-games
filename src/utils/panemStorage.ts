import { GameState, Tribute } from '../models/types';
import { CareerTotals, evaluateAchievements, evaluateMetaAchievements, evaluateNearMisses, NearMiss } from '../data/achievements';
import { Notable, runNotables } from './notables';
import { ARENAS } from '../data/constants';
import { ARENA_MUTTS } from '../data/mutts';
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
    /** S-4: distinct Quarter Quell ids this player has run, win or lose — for `meta-quell-collector`. */
    quellsSeen?: string[];
    /** §10.1: distinct arena-law ids a victor has been crowned under. */
    lawsWonUnder?: string[];
    /** §10.1: distinct procedural biome ids a victor has been crowned in. */
    biomesWon?: string[];
    /** §10.1: every distinct mutt name ever witnessed attacking somebody. */
    muttsSeen?: string[];
    /** §10.9: every distinct arena (mapId ?? name) ever played, win or lose — the picker marks the rest as new. */
    arenasSeen?: string[];
    /** §10.1: victories brought home by the player's standing patron district. */
    patronWins?: number;
    /** §10.1: the district that won the most recent finished run, and how many consecutive runs it has now won. */
    lastVictorDistrict?: number;
    victorDistrictStreak?: number;
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

export const EMPTY_PANEM: PanemRecords = { runs: 0, victors: 0, unlocked: [], bests: {}, gamemakerRecords: {}, districtCrowns: {}, quellsSeen: [] };

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
    {
        id: 'most-sponsor-gifts',
        label: 'Most sponsor gifts to a victor',
        extract: (state, victor) => victor
            ? { value: state.log.filter(l => l.category === 'sponsor' && l.tributesInvolved.includes(victor.id)).length, holder: victor }
            : undefined,
        format: v => `${v} gift${v === 1 ? '' : 's'}`,
    },
    {
        id: 'longest-survival-no-crown',
        label: 'Longest survival without winning',
        extract: state => {
            const fallen = state.tributes.filter(t => t.status === 'dead');
            if (fallen.length === 0) return undefined;
            const best = fallen.reduce((a, b) => (b.daysSurvived > a.daysSurvived ? b : a));
            return { value: best.daysSurvived, holder: best };
        },
        format: v => `${v} days`,
    },
    {
        id: 'most-tesserae-victor',
        label: 'Most tesserae slips carried by a victor',
        extract: (_s, victor) => (victor && (victor.tesserae ?? 0) > 0) ? { value: victor.tesserae!, holder: victor } : undefined,
        format: v => `${v} slip${v === 1 ? '' : 's'}`,
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
            quellsSeen: asStrArray(r.quellsSeen),
            lawsWonUnder: asStrArray(r.lawsWonUnder),
            biomesWon: asStrArray(r.biomesWon),
            muttsSeen: asStrArray(r.muttsSeen),
            arenasSeen: asStrArray(r.arenasSeen),
            patronWins: Math.max(0, asNum(r.patronWins, 0)),
            lastVictorDistrict: Number.isFinite(asNum(r.lastVictorDistrict, NaN)) ? asNum(r.lastVictorDistrict, 0) : undefined,
            victorDistrictStreak: Math.max(0, asNum(r.victorDistrictStreak, 0)),
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
        // Procedural arenas: key on the per-map identity, not the display
        // name — 4 biomes × 12 name suffixes collapsed genuinely distinct
        // generated maps into a handful of entries.
        const arenaKey = state.arena.mapId ?? state.arena.name;
        if (!records.arenasWon.includes(arenaKey)) records.arenasWon.push(arenaKey);

        // §10.1: the collector shelves — which arena law this crown was won
        // under, and which procedural biome the arena was built from.
        if (state.arena.law) {
            records.lawsWonUnder = records.lawsWonUnder ?? [];
            if (!records.lawsWonUnder.includes(state.arena.law)) records.lawsWonUnder.push(state.arena.law);
        }
        if (state.arena.id.startsWith('procedural-')) {
            const biome = state.arena.id.slice('procedural-'.length);
            records.biomesWon = records.biomesWon ?? [];
            if (!records.biomesWon.includes(biome)) records.biomesWon.push(biome);
        }

        // §10.1: patronage paying off, and the dynasty streak.
        if (records.patronDistrict !== undefined && victor.district === records.patronDistrict) {
            records.patronWins = (records.patronWins ?? 0) + 1;
        }
        records.victorDistrictStreak = records.lastVictorDistrict === victor.district
            ? (records.victorDistrictStreak ?? 0) + 1
            : 1;
        records.lastVictorDistrict = victor.district;
    } else {
        // A wipeout is nobody's dynasty.
        records.victorDistrictStreak = 0;
        records.lastVictorDistrict = undefined;
    }

    // §10.9: the arena was played, victor or not — the picker reads this to
    // mark what the player has never seen.
    records.arenasSeen = records.arenasSeen ?? [];
    const seenKey = state.arena.mapId ?? state.arena.name;
    if (!records.arenasSeen.includes(seenKey)) records.arenasSeen.push(seenKey);

    // §10.1: the bestiary — every mutt somebody met this run, by name.
    if (state.muttsSeen && state.muttsSeen.length > 0) {
        records.muttsSeen = records.muttsSeen ?? [];
        state.muttsSeen.forEach(name => {
            if (!records.muttsSeen!.includes(name)) records.muttsSeen!.push(name);
        });
    }

    // S-4: a Quell counts toward `meta-quell-collector` whether or not it
    // produced a victor — the point is having seen it, not having won it.
    if (state.gamesProfile?.quell) {
        records.quellsSeen = records.quellsSeen ?? [];
        if (!records.quellsSeen.includes(state.gamesProfile.quell.id)) records.quellsSeen.push(state.gamesProfile.quell.id);
    }

    // S-3: career-wide achievements read the updated records, so cumulative
    // counts and per-district completion unlock the moment they become true.
    // §10.1: the hand-authored shelf and the canonical bestiary, measured
    // against what actually exists rather than a hardcoded count.
    const handAuthoredNames = ARENAS.map(a => a.name);
    const canonicalMutts = new Set<string>();
    Object.values(ARENA_MUTTS).forEach(list => list.forEach(m => canonicalMutts.add(m.name)));
    // The most simultaneous bests held by one tribute right now (keyed by
    // name + seed so two same-named tributes across runs don't merge).
    const bestsByHolder = new Map<string, number>();
    Object.values(records.bests).forEach(b => {
        const key = `${b.name}|${b.seed}`;
        bestsByHolder.set(key, (bestsByHolder.get(key) ?? 0) + 1);
    });

    const totals: CareerTotals = {
        runs: records.runs,
        victors: records.victors,
        deaths: Object.values(records.gamemakerRecords ?? {}).reduce((sum, gm) => sum + gm.deaths, 0),
        crownedDistricts: Object.keys(records.districtCrowns ?? {}).map(Number),
        arenasWon: records.arenasWon ?? [],
        quellsSeen: records.quellsSeen ?? [],
        lawsWonUnder: records.lawsWonUnder ?? [],
        biomesWon: records.biomesWon ?? [],
        handAuthoredWon: handAuthoredNames.filter(n => (records.arenasWon ?? []).includes(n)).length,
        handAuthoredTotal: handAuthoredNames.length,
        canonicalMuttsSeen: (records.muttsSeen ?? []).filter(n => canonicalMutts.has(n)).length,
        canonicalMuttTotal: canonicalMutts.size,
        patronWins: records.patronWins ?? 0,
        dynastyStreak: records.victorDistrictStreak ?? 0,
        maxSimultaneousBests: Math.max(0, ...bestsByHolder.values()),
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
