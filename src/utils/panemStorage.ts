import { CampaignFeud, CampaignSnapshot } from '../models/types';
import { foldCampaignArc } from '../engine/campaign';
import { scorePrediction } from '../engine/prediction';
import { PARLAY, PREDICTION } from '../data/balance';
import { GameState, Tribute } from '../models/types';
import { HEAD_GAMEMAKERS } from '../data/gamemakers';
import { QUELLS } from '../data/gamesProfile';
import { ACHIEVEMENTS, ARCHETYPE_COUNT, CareerTotals, DEATH_CAUSE_CODE_COUNT, evaluateAchievements, evaluateMetaAchievements, evaluateNearMisses, NearMiss } from '../data/achievements';
import { COIN_ECONOMY } from '../data/balance';
import { arenaLaws } from '../engine/gamesProfile';
import { Notable, runDelta, runNotables, victorsOf } from './notables';
import { ARENAS } from '../data/constants';
import { dailySeed } from '../data/replayHooks';
import { ARENA_MUTTS } from '../data/mutts';
import { deathCausesInRun } from '../engine/encounters';
import { deathCodeOf } from '../engine/causes';
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
    /** When each was earned: the run number and the date. Absent for entries earned before this existed. */
    unlockedAt?: Record<string, { run: number; date: string }>;
    /**
     * §6.2: a persistent coin sink. The player can spend Capitol Coins to
     * become the standing patron of one district; its tributes start every
     * future run with a sponsor-trust head start.
     */
    patronDistrict?: number;
    /**
     * §9 (audit): patronage is no longer a single one-off purchase. Every
     * district the player has bought a standing patronage in, cheapest first
     * purchase to dearest — the cost escalates with each one, so coins keep
     * having somewhere to go long after the first 750 are spent.
     * `patronDistrict` remains the first entry, for readers that predate this.
     */
    patronDistricts?: number[];
    /**
     * §9 (audit): arenas bought outright rather than stumbled into through a
     * sealed draw. Kept apart from `arenasSeen` so the picker can say which
     * ones were earned and which were paid for, and so a purchase does not
     * silently satisfy a "played every arena" achievement.
     */
    arenasBought?: string[];
    /**
     * §9 (audit): how many Capitol stipends the player has taken. The stipend
     * exists so a broke player is never locked out of the betting layer, but
     * an unconditional 250 coins a run meant scarcity never arrived. It now
     * tapers with each one taken.
     */
    stipendsTaken?: number;
    /**
     * §9 (audit): the best finish on each daily seed, keyed by the seed. A
     * daily with no way to say how today went is only a shared starting
     * position; this is the local scoreboard that gives it a point.
     */
    dailyBests?: Record<string, { day: number; deaths: number; victorName?: string; victorDistrict?: number; date: string }>;
    /**
     * §9 (audit): victors who came back as mentors, keyed by their district.
     * A crown used to end at the record book. Now the tribute who won returns
     * to the district that reaped them and makes their successors' sponsors
     * answer the phone.
     */
    victorMentors?: Record<number, { name: string; archetype: string; run: number }>;
    /** AUDIT-11 §12: the campaign's rebellion meter, 0-100. */
    rebellion?: number;
    /** AUDIT-11 §8: each district's standing with the audience. */
    districtReputation?: Record<number, number>;
    /** AUDIT-11 §8: rival victor feuds. */
    feuds?: CampaignFeud[];
    /** AUDIT-11 §12: the prediction-slip career. */
    predictions?: PredictionCareer;
    /** AUDIT-11 §8: parlays that paid out. */
    parlaysLanded?: number;
    /** AUDIT-11 §8: the open parlay ticket, carried across Games. */
    parlay?: ParlayTicket;
    /** AUDIT-11 §8: the best bankrolls the player has closed a Games on. */
    bankrollBoard?: BankrollEntry[];
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
    /**
     * Audit 4 §9.3/§9.5: the two completion axes the engine was already
     * computing and nobody was keeping.
     *
     * `quellsSeen`, `muttsSeen`, `arenasSeen`, `lawsWonUnder` and `biomesWon`
     * above were the start of a collection; these close it. The simulation
     * produces 347 distinct death templates and 1,449 identified arena events,
     * and `deathCausesInRun()` in `engine/encounters.ts` — written for exactly
     * this, with a comment saying so — was exported and called by nothing.
     *
     * The point is not a completionist checklist for its own sake. It is that
     * 27 Quells sharing 6% of runs, 196 mutts and 1,449 events are a lottery
     * with no memory: a player has no way to know that the thing that just
     * happened has never happened to them before. A union of ids is the
     * cheapest possible way to turn that into a collection, and it needs no new
     * mechanics and no new simulation state.
     */
    deathsSeen?: string[];
    /** Distinct authored arena-event ids that have fired in a finished run. */
    eventsSeen?: string[];
    /** §10.1: victories brought home by the player's standing patron district. */
    patronWins?: number;
    /**
     * §10.4: small cross-run continuity threads.
     *
     * District number -> a token and a quirk left behind by somebody from that
     * district who died in an earlier Games. A later tribute reaped from the
     * same district may carry it. Purely cosmetic — nothing mechanical reads
     * either field — and the entire point: repeat play should feel like it is
     * building something rather than resetting to zero every run.
     */
    heirlooms?: Record<number, { token: string; quirk?: string; fromName: string; run: number }>;
    /**
     * §10.7: the last few finished runs, newest first, so the end screen can
     * say what was different about this one. Capped — this is a comparison
     * window, not a history.
     */
    recentRuns?: Array<{
        seed: string;
        arenaName: string;
        day: number;
        victorName?: string;
        victorDistrict?: number;
        victorArchetype?: string;
        victorKills?: number;
        deaths: number;
        /** AUDIT-10: how many went in, so a death count can be read as a rate. */
        cast?: number;
        /** AUDIT-10 B08: everyone crowned, so a dual win survives the window. */
        victorNames?: string[];
    }>;
    /**
     * AUDIT-6 §9.3: the Panem calendar — who is running the Games, and for how
     * much longer.
     *
     * The Head Gamemaker was drawn fresh from the seed every single run, so a
     * player's twentieth Games had exactly as much shared history with their
     * nineteenth as with their first. Twenty Head Gamemakers each carried a
     * persistent record that the broadcast read out and nothing else used.
     *
     * A term fixes that for the cost of one stored field: the incumbent keeps
     * the job for a few consecutive Games, so "Seneca's second year" is a thing
     * the player can notice, and a Gamemaker whose Games this player keeps
     * winning stays in post long enough for the grudge in `continuity.ts` to
     * mean something. Absent, or a name no longer in the roster, falls back to
     * drawing one — so an old store and a renamed Gamemaker both degrade to
     * exactly the old behaviour.
     */
    headGamemakerTerm?: { name: string; runsServed: number };
    /** §10.1: the district that won the most recent finished run, and how many consecutive runs it has now won. */
    lastVictorDistrict?: number;
    victorDistrictStreak?: number;
    /** AUDIT-11 §14: every death-cause code ever witnessed, for `meta-every-death`. */
    causeCodesSeen?: string[];
    /** AUDIT-11 §14: distinct seeds that reached a finished run, for `meta-ninety-nine-seeds`. */
    seedsCompleted?: string[];
    /** AUDIT-11 §14: consecutive finished runs without a Career victor, for `meta-no-career-season`. */
    nonCareerStreak?: number;
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
 * AUDIT-9 B03: achievement ids that no longer exist, and what they became.
 *
 * An id is a permanent key into somebody's saved store, so retiring one is not
 * a delete — it is a rename with a forwarding address. `a7-half-at-the-horn`
 * and `bloodbath-massacre` were two entries advertising one condition, and
 * merging them without this map would silently take a card off the shelf of
 * every player who happened to have earned the retired one.
 *
 * The rules this map is applied under, in `migrateUnlocks`:
 *
 *  - A player holding either id ends up holding the survivor.
 *  - A player holding *both* ends up holding it once. That is the point of the
 *    merge — one discovery, one card — and it is why the count on the shelf can
 *    legitimately go down by one for those players.
 *  - The earliest unlock stamp wins, because the run they first did the thing
 *    in is the true answer to "when did I earn this", and the merge must not
 *    move it later.
 *  - Nothing is ever clawed back. Coins were paid at the time, per unlock, and
 *    a player who was historically paid for both keeps both payments; only
 *    future unlocks are paid once.
 *
 * Add to this map rather than editing an id in place. It is applied on every
 * read, so it is idempotent and a store that has already been through it is
 * unchanged by going through it again.
 */
export const RETIRED_ACHIEVEMENT_IDS: Record<string, string> = {
    'a7-half-at-the-horn': 'bloodbath-massacre',
    // AUDIT-9 batch 4: "exactly one scar" and "at least one scar" are the same
    // question in a game where a victor has never been observed with two.
    'one-wound': 'scarred-and-standing',
};

/**
 * Rewrite a stored unlock list and its stamps through `RETIRED_ACHIEVEMENT_IDS`.
 *
 * Exported so the storage-migration check can state the propositions above
 * directly rather than inferring them from a round trip.
 */
export function migrateUnlocks(
    unlocked: string[],
    unlockedAt: Record<string, { run: number; date: string }> | undefined,
): { unlocked: string[]; unlockedAt: Record<string, { run: number; date: string }> | undefined } {
    const to = (id: string) => RETIRED_ACHIEVEMENT_IDS[id] ?? id;
    if (!unlocked.some(id => RETIRED_ACHIEVEMENT_IDS[id] !== undefined)) {
        return { unlocked, unlockedAt };
    }
    // Order is preserved on first appearance, so the shelf does not reshuffle
    // under a player who has been collecting for twenty Games.
    const moved: string[] = [];
    unlocked.forEach(id => { if (!moved.includes(to(id))) moved.push(to(id)); });

    let stamps = unlockedAt;
    if (unlockedAt) {
        stamps = {};
        Object.entries(unlockedAt).forEach(([id, stamp]) => {
            const target = to(id);
            const existing = stamps![target];
            // The earlier run is the one they actually did it in. A stamp with
            // an unusable run number loses to one that has a real one.
            const beats = !existing
                || !Number.isFinite(existing.run)
                || (Number.isFinite(stamp.run) && stamp.run < existing.run);
            if (beats) stamps![target] = stamp;
        });
    }
    return { unlocked: moved, unlockedAt: stamps };
}

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
    {
        /*
         * AUDIT-6 §6.2: the legendary-weapon layer works — across 300 runs,
         * 705 weapons had drawn blood and 227 had earned a name across 98
         * distinct names — and nothing in the game ever said so. A named blade
         * travelled with the object, which is a lovely mechanic the inventory
         * rendered as another line item. This is the half of the fix that
         * belongs in the record book: the most-blooded weapon in Panem's
         * history, and who was holding it.
         */
        id: 'most-blooded-weapon',
        label: 'Most lives taken by one weapon',
        extract: state => {
            let best: { value: number; holder: Tribute } | undefined;
            state.tributes.forEach(t => t.inventory.forEach(i => {
                const blood = i.bloodDrawn ?? 0;
                if (blood > 0 && (best === undefined || blood > best.value)) best = { value: blood, holder: t };
            }));
            return best;
        },
        format: v => `${v} ${v === 1 ? 'life' : 'lives'}`,
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
            // AUDIT-9 B03: retired ids forward to their survivor. This runs on
            // every read, not only on a version bump, which is what makes it
            // reach stores already written at the current version.
            ...migrateUnlocks(
                asStrArray(r.unlocked),
                asObjMap<{ run: number; date: string }>(r.unlockedAt),
            ),
            bests: asObjMap<RecordHolder>(r.bests),
            gamemakerRecords: asObjMap<GamemakerRecord>(r.gamemakerRecords),
            patronDistrict: Number.isFinite(patron) ? patron : undefined,
            // §9: a store written before multi-patronage carries only the
            // single field; seeding the list from it keeps the purchase the
            // player already made rather than charging them for it twice.
            patronDistricts: Array.isArray(r.patronDistricts)
                ? (r.patronDistricts as unknown[]).map(d => asNum(d, NaN)).filter(d => Number.isFinite(d))
                : (Number.isFinite(patron) ? [patron] : []),
            arenasBought: asStrArray(r.arenasBought),
            stipendsTaken: Math.max(0, asNum(r.stipendsTaken, 0)),
            dailyBests: asObjMap<{ day: number; deaths: number; victorName?: string; victorDistrict?: number; date: string }>(r.dailyBests),
            victorMentors: asObjMap<{ name: string; archetype: string; run: number }>(r.victorMentors),
            districtCrowns: asObjMap<DistrictCrown>(r.districtCrowns),
            arenasWon: asStrArray(r.arenasWon),
            quellsSeen: asStrArray(r.quellsSeen),
            deathsSeen: asStrArray(r.deathsSeen),
            eventsSeen: asStrArray(r.eventsSeen),
            lawsWonUnder: asStrArray(r.lawsWonUnder),
            biomesWon: asStrArray(r.biomesWon),
            muttsSeen: asStrArray(r.muttsSeen),
            arenasSeen: asStrArray(r.arenasSeen),
            patronWins: Math.max(0, asNum(r.patronWins, 0)),
            lastVictorDistrict: Number.isFinite(asNum(r.lastVictorDistrict, NaN)) ? asNum(r.lastVictorDistrict, 0) : undefined,
            victorDistrictStreak: Math.max(0, asNum(r.victorDistrictStreak, 0)),
            causeCodesSeen: asStrArray(r.causeCodesSeen),
            seedsCompleted: asStrArray(r.seedsCompleted),
            nonCareerStreak: Math.max(0, asNum(r.nonCareerStreak, 0)),
            /*
             * AUDIT-6 §9.3: `recentRuns` was written by `commitRun` and not
             * listed here, and `migrate` runs on *every* read — so the
             * comparison window was silently emptied the first time the store
             * was read back, exactly the bug this spec's own v0 note documents
             * happening to `patronDistrict`. Two things read it and both were
             * quietly wrong across a reload: the end screen's "what was
             * different about this one", and `districtStanding`'s dynasty
             * clause, which needs a district to have won recently and not
             * merely often. `check-storage-migrations` now asserts that no
             * field of a committed record is lost on a round trip, so this
             * cannot happen to the next field either.
             */
            headGamemakerTerm: (() => {
                const term = asRecord(r.headGamemakerTerm);
                if (!term || typeof term.name !== 'string') return undefined;
                return { name: term.name, runsServed: Math.max(0, asNum(term.runsServed, 0)) };
            })(),
            recentRuns: Array.isArray(r.recentRuns)
                ? (r.recentRuns as PanemRecords['recentRuns'])
                : undefined,
            heirlooms: r.heirlooms !== undefined
                ? asObjMap<{ token: string; quirk?: string; fromName: string; run: number }>(r.heirlooms)
                : undefined,
            // AUDIT-11 §8/§12: the campaign arc, predictions, parlays and
            // bankrolls. All optional; a store from before them reads as none.
            rebellion: Number.isFinite(asNum(r.rebellion, NaN)) ? Math.max(0, Math.min(100, asNum(r.rebellion, 0))) : undefined,
            districtReputation: r.districtReputation !== undefined ? asNumRecord(r.districtReputation) : undefined,
            feuds: Array.isArray(r.feuds) ? (r.feuds as unknown[]).flatMap(normalizeFeud) : undefined,
            predictions: normalizePredictionCareer(r.predictions),
            parlay: normalizeParlay(r.parlay),
            parlaysLanded: r.parlaysLanded !== undefined ? Math.max(0, asNum(r.parlaysLanded, 0)) : undefined,
            bankrollBoard: Array.isArray(r.bankrollBoard)
                ? (r.bankrollBoard as unknown[]).flatMap(e => {
                    const x = asRecord(e);
                    if (!x) return [];
                    const coins = asNum(x.coins, NaN);
                    if (!Number.isFinite(coins)) return [];
                    return [{ coins, run: asNum(x.run, 0), seed: typeof x.seed === 'string' ? x.seed : '', date: typeof x.date === 'string' ? x.date : '' }];
                }).slice(0, PARLAY.leaderboardSize)
                : undefined,
        };
    },
};

function asNumRecord(raw: unknown): Record<number, number> {
    const out: Record<number, number> = {};
    Object.entries(asRecord(raw) ?? {}).forEach(([k, v]) => {
        if (typeof v === 'number' && Number.isFinite(v) && Number.isFinite(Number(k))) out[Number(k)] = v;
    });
    return out;
}

function normalizeFeud(raw: unknown): CampaignFeud[] {
    const f = asRecord(raw);
    if (!f || typeof f.aName !== 'string' || typeof f.bName !== 'string') return [];
    const aDistrict = asNum(f.aDistrict, NaN);
    const bDistrict = asNum(f.bDistrict, NaN);
    if (!Number.isFinite(aDistrict) || !Number.isFinite(bDistrict)) return [];
    return [{ aName: f.aName, aDistrict, bName: f.bName, bDistrict, run: asNum(f.run, 0) }];
}

function normalizePredictionCareer(raw: unknown): PredictionCareer | undefined {
    const p = asRecord(raw);
    if (!p) return undefined;
    return {
        scored: Math.max(0, asNum(p.scored, 0)),
        totalScore: Math.max(0, asNum(p.totalScore, 0)),
        best: Math.max(0, asNum(p.best, 0)),
        winnersCalled: Math.max(0, asNum(p.winnersCalled, 0)),
        sharpCalls: Math.max(0, asNum(p.sharpCalls, 0)),
        victorCallStreak: Math.max(0, asNum(p.victorCallStreak, 0)),
    };
}

function normalizeLeg(raw: unknown): ParlayLeg | undefined {
    const l = asRecord(raw);
    if (!l || typeof l.seed !== 'string' || typeof l.tributeId !== 'string') return undefined;
    const mult = asNum(l.mult, NaN);
    if (!Number.isFinite(mult) || mult <= 0) return undefined;
    return { seed: l.seed, tributeId: l.tributeId, name: typeof l.name === 'string' ? l.name : '?', district: asNum(l.district, 0), mult };
}

function normalizeParlay(raw: unknown): ParlayTicket | undefined {
    const p = asRecord(raw);
    if (!p) return undefined;
    const stake = asNum(p.stake, NaN);
    const legs = asNum(p.legs, NaN);
    if (!Number.isFinite(stake) || stake <= 0 || !Number.isFinite(legs)) return undefined;
    const won = Array.isArray(p.won) ? (p.won as unknown[]).map(normalizeLeg).filter((l): l is ParlayLeg => !!l) : [];
    return {
        stake: Math.floor(stake),
        legs: Math.max(PARLAY.minLegs, Math.min(PARLAY.maxLegs, Math.floor(legs))),
        won,
        pending: normalizeLeg(p.pending),
    };
}

export function readPanem(): PanemRecords {
    return readStored(PANEM_SPEC) ?? { ...EMPTY_PANEM, bests: {}, gamemakerRecords: {}, districtCrowns: {} };
}

function writePanem(records: PanemRecords): void {
    writeStored(PANEM_SPEC, records);
}

/** AUDIT-11 §12: what the player's prediction slips have added up to. */
export interface PredictionCareer {
    scored: number;
    totalScore: number;
    best: number;
    /** Slips that named the victor. */
    winnersCalled: number;
    /** Slips that scored at least `PREDICTION.sharpShare` of their maximum. */
    sharpCalls: number;
    /** AUDIT-12 §14 'Parlay': consecutive scored slips that named the victor. */
    victorCallStreak?: number;
}

/** AUDIT-11 §8: one Games' leg of a parlay. */
export interface ParlayLeg {
    seed: string;
    tributeId: string;
    name: string;
    district: number;
    mult: number;
}

/** AUDIT-11 §8: a parlay — one victor pick per Games, all of which must come home. */
export interface ParlayTicket {
    stake: number;
    legs: number;
    won: ParlayLeg[];
    pending?: ParlayLeg;
}

/** AUDIT-11 §8: a bankroll leaderboard row. */
export interface BankrollEntry {
    coins: number;
    run: number;
    seed: string;
    date: string;
}

/** §10.7: how many finished runs the end-screen delta compares against. */
export const RECENT_RUN_WINDOW = 8;

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
    /**
     * §20 (requests): Capitol Coins this run's first-time achievements are
     * worth, scaled by rarity. Computed here because this is where
     * `newAchievements` is decided; paid out by `resolveBets` in the store,
     * which owns the wallet.
     */
    achievementCoins: number;
    /**
     * §10.7: how this Games compared with the player's own last few in the
     * same arena. Empty on a first run, and on a run that was unremarkable
     * against its own history — there is no value in "about the same".
     */
    delta: string[];
}

/**
 * Folds one finished run into the record book. Idempotent per run: the caller
 * (gameStore) already guards against committing the same victory twice.
 */
/**
 * The career-wide totals the meta achievements read. Pure over the record
 * book, so the record-book screen can draw progress bars from the same
 * numbers `commitRun` unlocks against.
 */
export function careerTotals(records: PanemRecords): CareerTotals {
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
        gamemakersSeen: Object.keys(records.gamemakerRecords ?? {}).length,
        gamemakerTotal: HEAD_GAMEMAKERS.length,
        maxCrownsUnderOneGamemaker: Math.max(0, ...Object.values(records.gamemakerRecords ?? {}).map(gm => gm.victors)),
        quellTotal: QUELLS.length,
        archetypesCrowned: [...new Set(Object.values(records.districtCrowns ?? {}).flatMap(c => c.archetypes ?? []))],
        archetypeTotal: ARCHETYPE_COUNT,
        causeCodesSeen: records.causeCodesSeen ?? [],
        causeCodeTotal: DEATH_CAUSE_CODE_COUNT,
        seedsCompleted: records.seedsCompleted?.length ?? 0,
        nonCareerStreak: records.nonCareerStreak ?? 0,
        predictionsScored: records.predictions?.scored ?? 0,
        victorsCalled: records.predictions?.winnersCalled ?? 0,
        sharpCalls: records.predictions?.sharpCalls ?? 0,
        victorCallStreak: records.predictions?.victorCallStreak ?? 0,
        parlaysLanded: records.parlaysLanded ?? 0,
    };
    return totals;
}

export function commitRun(state: GameState): RunOutcome {
    const records = readPanem();
    /*
     * AUDIT-10 B08: three different questions, three different answers.
     *
     * `find(t => t.status === 'alive')` was standing in for all of them — the
     * run's outcome, the people crowned, and the districts that won — so a dual
     * victory credited one tribute, one district crown and one mentor seat, and
     * which of the two got them was decided by cast array order. The store
     * archives both winners elsewhere, so the record systems disagreed with
     * each other about the same run.
     *
     * `winners` is everyone crowned. `victor` is retained only for the places
     * that genuinely want a single representative row (the recent-run window's
     * headline, the record book's holder), and is now explicitly the first of
     * the list rather than an accident of iteration order.
     */
    const winners = victorsOf(state);
    const victor = winners[0];
    const hasVictor = winners.length > 0;

    const priorMentors = { ...(records.victorMentors ?? {}) };
    records.runs += 1;
    // Games that produced a victor, not people crowned — a dual win is one
    // Games with a winner, and `careerTotals` reads this as a run count.
    if (hasVictor) records.victors += 1;

    // §10.4: what the fallen leave behind for their district. One tribute per
    // district per run at most, and only somebody who actually died carrying
    // something — a victor takes their token home, which is the whole point of
    // a token, so they never leave one.
    records.heirlooms = records.heirlooms ?? {};
    state.tributes
        .filter(t => t.status === 'dead' && t.token)
        .forEach(t => {
            const existing = records.heirlooms![t.district];
            // The most recent loss is the one the district is still talking
            // about, so a newer one displaces an older.
            if (existing && existing.run >= records.runs) return;
            records.heirlooms![t.district] = {
                token: t.token!,
                quirk: t.quirks?.[0],
                fromName: t.name,
                run: records.runs,
            };
        });

    // §10.7: the comparison window the end screen's delta reads.
    // §9 (audit): the daily seed's local scoreboard. A daily that cannot say
    // how today went is only a shared starting position. Better is a longer
    // run; a run that crowned somebody beats one that did not, whatever the
    // day count, because surviving the Games is the result the daily is for.
    if (state.seed === dailySeed()) {
        records.dailyBests = records.dailyBests ?? {};
        const prior = records.dailyBests[state.seed];
        const betterThanPrior = !prior
            || (hasVictor && prior.victorName === undefined)
            || (hasVictor === (prior.victorName !== undefined) && state.day > prior.day);
        if (betterThanPrior) {
            records.dailyBests[state.seed] = {
                day: state.day,
                deaths: state.tributes.filter(t => t.status === 'dead').length,
                victorName: victor?.name,
                victorDistrict: victor?.district,
                date: new Date().toISOString(),
            };
        }
    }

    // Audit 4 §9.5: union this run's death templates and fired event ids into
    // the collection. Both are already computed by the simulation; nothing
    // here asks it for anything new.
    records.deathsSeen = [...new Set([...(records.deathsSeen ?? []), ...deathCausesInRun(state)])].sort();
    records.eventsSeen = [...new Set([
        ...(records.eventsSeen ?? []),
        ...Object.keys(state.eventLastFired ?? {}),
    ])].sort();

    records.recentRuns = [
        {
            seed: state.seed,
            arenaName: state.arena.name,
            day: state.day,
            victorName: victor?.name,
            victorDistrict: victor?.district,
            victorArchetype: victor?.archetype,
            victorKills: victor?.kills,
            victorNames: winners.map(w => w.name),
            deaths: state.tributes.filter(t => t.status === 'dead').length,
            cast: state.tributes.length,
        },
        ...(records.recentRuns ?? []),
    ].slice(0, RECENT_RUN_WINDOW);

    // §9.3: and the term they are serving advances with it.
    if (state.headGamemaker) {
        const term = records.headGamemakerTerm;
        records.headGamemakerTerm = term && term.name === state.headGamemaker
            ? { name: term.name, runsServed: term.runsServed + 1 }
            : { name: state.headGamemaker, runsServed: 1 };
    }

    // The Head Gamemaker who ran these Games carries the result forward.
    const gmName = state.headGamemaker;
    if (gmName) {
        records.gamemakerRecords = records.gamemakerRecords ?? {};
        const gm = records.gamemakerRecords[gmName]
            ?? { games: 0, victors: 0, totalDays: 0, deaths: 0 };
        gm.games += 1;
        // A Gamemaker's record counts Games that produced a victor.
        if (hasVictor) gm.victors += 1;
        gm.totalDays += state.day;
        gm.deaths += state.tributes.filter(t => t.status === 'dead').length;
        records.gamemakerRecords[gmName] = gm;
    }

    // REPLAY-12: the crown is filed under the district that took it, so a
    // District 12 win is a specific thing the player has done rather than a
    // number folded into `victors`.
    let firstCrownDistrict: number | undefined;
    // AUDIT-10 B08: every district that took a crown this run takes it once.
    // Two winners from different districts are two crowns; two winners from
    // the *same* district are one Games their district won, credited once,
    // with both names on it.
    const winningDistricts = [...new Set(winners.map(w => w.district))];
    winningDistricts.forEach(district => {
        const crowned = winners.filter(w => w.district === district);
        const headline = crowned[0];
        records.districtCrowns = records.districtCrowns ?? {};
        const stamp: DistrictVictoryStamp = {
            name: crowned.map(w => w.name).join(' & '),
            archetype: headline.archetype,
            run: records.runs,
            kills: crowned.reduce((sum, w) => sum + w.kills, 0),
            days: Math.max(...crowned.map(w => w.daysSurvived)),
            seed: state.seed,
            arenaName: state.arena.name,
            date: new Date().toISOString(),
        };
        // A store that was hand-edited (or written by a future/older build) can
        // hold a partial entry; treat anything unusable as a first crown rather
        // than throwing on the debrief.
        const prior = records.districtCrowns[district];
        const existing = prior && prior.first && Array.isArray(prior.archetypes) ? prior : undefined;
        const archetypes = crowned.map(w => w.archetype);
        if (existing) {
            records.districtCrowns[district] = {
                victories: existing.victories + 1,
                first: existing.first,
                latest: stamp,
                archetypes: [...new Set([...existing.archetypes, ...archetypes])],
            };
        } else {
            records.districtCrowns[district] = {
                victories: 1,
                first: stamp,
                latest: stamp,
                archetypes: [...new Set(archetypes)],
            };
            firstCrownDistrict = firstCrownDistrict ?? district;
        }
        // §9 (audit): the victor comes back as their district's mentor. A
        // crown used to end at the record book; now it changes how the next
        // tributes reaped from that district are sponsored. The most recent
        // victor holds the post — a district that keeps winning keeps
        // replacing its mentor, which is exactly what a career of Games
        // should look like from the outside.
        records.victorMentors = records.victorMentors ?? {};
        records.victorMentors[district] = {
            name: headline.name,
            archetype: headline.archetype,
            run: records.runs,
        };
    });

    if (hasVictor) {
        records.arenasWon = records.arenasWon ?? [];
        // Procedural arenas: key on the per-map identity, not the display
        // name — 4 biomes × 12 name suffixes collapsed genuinely distinct
        // generated maps into a handful of entries.
        const arenaKey = state.arena.mapId ?? state.arena.name;
        if (!records.arenasWon.includes(arenaKey)) records.arenasWon.push(arenaKey);

        // §10.1: the collector shelves — which arena law this crown was won
        // under, and which procedural biome the arena was built from.
        // §5.1: an arena can run under more than one law now, and a crown won
        // under a stacked arena counts for each of them.
        arenaLaws(state).forEach(law => {
            records.lawsWonUnder = records.lawsWonUnder ?? [];
            if (!records.lawsWonUnder.includes(law)) records.lawsWonUnder.push(law);
        });
        if (state.arena.id.startsWith('procedural-')) {
            const biome = state.arena.id.slice('procedural-'.length);
            records.biomesWon = records.biomesWon ?? [];
            if (!records.biomesWon.includes(biome)) records.biomesWon.push(biome);
        }

        /*
         * §10.1: patronage paying off, and the dynasty streak.
         *
         * AUDIT-10 B08: the patron is paid for the *Games* their district won,
         * once, however many of its tributes came home — two winners from the
         * patronised district is still one Games that went their way, and
         * paying it twice would make a dual win a patronage exploit.
         */
        if (records.patronDistrict !== undefined && winningDistricts.includes(records.patronDistrict)) {
            records.patronWins = (records.patronWins ?? 0) + 1;
        }
        // A dynasty is one district winning consecutively. A split dual win has
        // no single winning district, so it breaks any streak rather than
        // arbitrarily continuing one of them.
        const dynasty = winningDistricts.length === 1 ? winningDistricts[0] : undefined;
        records.victorDistrictStreak = dynasty !== undefined && records.lastVictorDistrict === dynasty
            ? (records.victorDistrictStreak ?? 0) + 1
            : dynasty !== undefined ? 1 : 0;
        records.lastVictorDistrict = dynasty;
    } else {
        // A wipeout is nobody's dynasty.
        records.victorDistrictStreak = 0;
        records.lastVictorDistrict = undefined;
    }

    // AUDIT-11 §14: the three career shelves the new meta achievements read.
    records.causeCodesSeen = [...new Set([
        ...(records.causeCodesSeen ?? []),
        ...state.tributes.filter(t => t.status === 'dead').map(t => deathCodeOf(t)).filter(c => c !== 'unknown'),
    ])].sort();
    if (!(records.seedsCompleted ?? []).includes(state.seed)) {
        records.seedsCompleted = [...(records.seedsCompleted ?? []), state.seed].slice(-500);
    }
    records.nonCareerStreak = hasVictor && winners.every(w => !w.isCareer)
        ? (records.nonCareerStreak ?? 0) + 1
        : hasVictor ? 0 : (records.nonCareerStreak ?? 0);

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

    // AUDIT-11 §8/§12: the campaign arc moves on by one Games. The mentors
    // read are the ones from *before* this run's crowns were seated, which is
    // what makes a feud a rivalry between two victors rather than one.
    const arc = foldCampaignArc({
        rebellion: records.rebellion,
        districtReputation: records.districtReputation,
        feuds: records.feuds,
        victorMentors: priorMentors,
    }, state, records.runs);
    records.rebellion = arc.rebellion;
    records.districtReputation = arc.districtReputation;
    records.feuds = arc.feuds;

    // AUDIT-11 §12: the prediction slip, scored.
    const slip = scorePrediction(state, state.prediction);
    if (slip) {
        const p = records.predictions ?? { scored: 0, totalScore: 0, best: 0, winnersCalled: 0, sharpCalls: 0 };
        p.scored += 1;
        p.totalScore += slip.score;
        p.best = Math.max(p.best, slip.score);
        if (slip.hits.includes('winner')) p.winnersCalled += 1;
        p.victorCallStreak = slip.hits.includes('winner') ? (p.victorCallStreak ?? 0) + 1 : 0;
        if (slip.max > 0 && slip.score / slip.max >= PREDICTION.sharpShare) p.sharpCalls += 1;
        records.predictions = p;
    }

    // S-3: career-wide achievements read the updated records, so cumulative
    // counts and per-district completion unlock the moment they become true.
    const totals = careerTotals(records);

    const earned = [...evaluateAchievements(state), ...evaluateMetaAchievements(totals)];
    const newAchievements = earned.filter(id => !records.unlocked.includes(id));
    records.unlocked = [...records.unlocked, ...newAchievements];
    records.unlockedAt = records.unlockedAt ?? {};
    const stamp = { run: records.runs, date: new Date().toISOString() };
    newAchievements.forEach(id => { records.unlockedAt![id] = stamp; });

    const brokenRecords: string[] = [];
    RECORD_DEFS.forEach(def => {
        // The record book holds one holder per record; `victor` is the
        // designated representative of the winners for that purpose.
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

    // §20 (requests): what the Capitol owes for this run's discoveries. Only
    // the first time each one is earned — they are a discovery layer, and
    // paying repeatedly for the same unlock would make them a grind.
    const achievementCoins = newAchievements.reduce((sum, id) => {
        const entry = ACHIEVEMENTS.find(a => a.id === id);
        return sum + (entry ? COIN_ECONOMY.achievementReward[entry.rarity] : COIN_ECONOMY.achievementReward.common);
    }, 0);

    writePanem(records);
    return {
        firstCrownDistrict,
        newAchievements,
        achievementCoins,
        brokenRecords,
        records,
        notables: runNotables(state, records),
        nearMisses: evaluateNearMisses(state, records.unlocked),
        delta: runDelta(state, records),
    };
}

/** §6.2: records (and persists) the player's standing district patronage. */
export function setPatronDistrict(district: number | undefined): PanemRecords {
    const records = readPanem();
    records.patronDistrict = district;
    records.patronDistricts = district === undefined ? [] : [district];
    writePanem(records);
    return records;
}

/**
 * §9 (audit): add a district to the standing patronage list. The caller has
 * already taken the coins; this only records it. Returns the updated book.
 */
export function addPatronDistrict(district: number): PanemRecords {
    const records = readPanem();
    const list = records.patronDistricts ?? (records.patronDistrict === undefined ? [] : [records.patronDistrict]);
    if (!list.includes(district)) list.push(district);
    records.patronDistricts = list;
    records.patronDistrict = list[0];
    writePanem(records);
    return records;
}

/** §9 (audit): drop one standing patronage. No refund — the Capitol does not give coins back. */
export function dropPatronDistrict(district: number): PanemRecords {
    const records = readPanem();
    const list = (records.patronDistricts ?? []).filter(d => d !== district);
    records.patronDistricts = list;
    records.patronDistrict = list[0];
    writePanem(records);
    return records;
}

/** §9 (audit): records an arena bought outright, so the picker unlocks it. */
export function buyArena(name: string): PanemRecords {
    const records = readPanem();
    const bought = records.arenasBought ?? [];
    if (!bought.includes(name)) bought.push(name);
    records.arenasBought = bought;
    writePanem(records);
    return records;
}

/** §9 (audit): records a stipend taken, which is what makes the next one smaller. */
export function noteStipendTaken(): PanemRecords {
    const records = readPanem();
    records.stipendsTaken = (records.stipendsTaken ?? 0) + 1;
    writePanem(records);
    return records;
}

export function clearPanem(): void {
    removeStored(PANEM_SPEC);
}

/**
 * AUDIT-9 B06: the record book, translated into the shape the simulation reads.
 *
 * The engine must not import this module — it must not know that a career of
 * Games is stored in a browser at all — so this is the one crossing point.
 * Everything the simulation actually consults is listed explicitly rather than
 * spread, which keeps the snapshot small enough to travel in a share link and
 * makes it obvious when a new continuity feature widens what a seed depends on.
 */
export function campaignSnapshotOf(records: PanemRecords): CampaignSnapshot {
    return {
        runs: records.runs,
        victors: records.victors,
        patronDistrict: records.patronDistrict,
        patronDistricts: records.patronDistricts,
        patronWins: records.patronWins,
        victorDistrictStreak: records.victorDistrictStreak,
        lastVictorDistrict: records.lastVictorDistrict,
        districtCrowns: records.districtCrowns,
        gamemakerRecords: records.gamemakerRecords,
        recentRuns: records.recentRuns,
        headGamemakerTerm: records.headGamemakerTerm,
        victorMentors: records.victorMentors,
        heirlooms: records.heirlooms,
        rebellion: records.rebellion,
        districtReputation: records.districtReputation,
        feuds: records.feuds,
    };
}

/** AUDIT-11 §8: open a parlay ticket. The caller has already taken the stake. */
export function openParlay(stake: number, legs: number): PanemRecords {
    const records = readPanem();
    records.parlay = { stake, legs: Math.max(PARLAY.minLegs, Math.min(PARLAY.maxLegs, legs)), won: [] };
    writePanem(records);
    return records;
}

/** AUDIT-11 §8: name this Games' leg of the open parlay (or clear it). */
export function setParlayLeg(leg: ParlayLeg | undefined): PanemRecords {
    const records = readPanem();
    if (records.parlay) {
        records.parlay = { ...records.parlay, pending: leg };
        writePanem(records);
    }
    return records;
}

/**
 * AUDIT-11 §8: settle the parlay's leg for a finished Games. Returns the payout
 * (0 unless the final leg just came in) and a line for the end screen. A
 * ticket with no leg on this run's seed is untouched — a Games sat out does
 * not break the chain.
 */
export function settleParlay(state: GameState): { records: PanemRecords; payout: number; line?: string } {
    const records = readPanem();
    const ticket = records.parlay;
    if (!ticket?.pending || ticket.pending.seed !== state.seed) return { records, payout: 0 };
    const leg = ticket.pending;
    const home = state.tributes.some(t => t.id === leg.tributeId && t.status === 'alive');
    if (!home) {
        records.parlay = undefined;
        writePanem(records);
        return { records, payout: 0, line: `Your parlay dies with ${leg.name}: ${ticket.won.length} of ${ticket.legs} legs came in, and the ${ticket.stake}-coin stake is gone.` };
    }
    const won = [...ticket.won, leg];
    if (won.length >= ticket.legs) {
        const mult = won.reduce((m, l) => m * Math.min(PARLAY.legMultCap, l.mult), 1);
        const payout = Math.floor(ticket.stake * mult);
        records.parlay = undefined;
        records.parlaysLanded = (records.parlaysLanded ?? 0) + 1;
        writePanem(records);
        return { records, payout, line: `Your ${ticket.legs}-leg parlay lands — ${won.map(l => l.name).join(', ')} all came home. ${ticket.stake} coins pay ${payout}.` };
    }
    records.parlay = { ...ticket, won, pending: undefined };
    writePanem(records);
    return { records, payout: 0, line: `Parlay leg ${won.length} of ${ticket.legs} comes in: ${leg.name} came home. Name the next leg before the next bloodbath.` };
}

/** AUDIT-11 §8: record the bankroll a Games closed on, for the leaderboard. */
export function noteBankroll(coins: number, seed: string): PanemRecords {
    const records = readPanem();
    const board = [...(records.bankrollBoard ?? []), { coins, run: records.runs, seed, date: new Date().toISOString() }]
        .sort((a, b) => b.coins - a.coins)
        .slice(0, PARLAY.leaderboardSize);
    records.bankrollBoard = board;
    writePanem(records);
    return records;
}
