import { HallOfFameEntry } from '../models/types';
import { CampaignLedger, SeasonLedger, VictorCache } from '../models/seasonTypes';

/**
 * AUDIT-12 wave 3: the season ledger's storage side.
 *
 * `normalizeSeasonLedger` is the migration: it runs on every read of the
 * record book (like the rest of `PANEM_SPEC.migrate`) and turns anything a
 * store, an older build or a hand edit could hold into a valid ledger —
 * unknown shapes are dropped field by field, never the whole ledger.
 * `normalizeCampaignLedger` does the same for the slice a share link carries,
 * which is untrusted input. `campaignLedgerOf` is the one translation from the
 * record book to what a run is created under.
 */
type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? v as Rec : undefined);
const num = (v: unknown, lo = -1e9, hi = 1e9): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined);
const str = (v: unknown, max = 80): string | undefined => (typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined);
const strs = (v: unknown, cap = 20): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, cap) : []);
const nums = (v: unknown, cap = 20): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)).slice(0, cap) : []);

function numRecord<T>(v: unknown, each: (x: unknown) => T | undefined, cap = 64): Record<number, T> | undefined {
    const r = rec(v);
    if (!r) return undefined;
    const out: Record<number, T> = {};
    Object.entries(r).slice(0, cap).forEach(([k, x]) => {
        const d = Number(k);
        const val = each(x);
        if (Number.isFinite(d) && val !== undefined) out[d] = val;
    });
    return out;
}

function strRecord<T>(v: unknown, each: (x: unknown) => T | undefined, cap = 128): Record<string, T> | undefined {
    const r = rec(v);
    if (!r) return undefined;
    const out: Record<string, T> = {};
    Object.entries(r).slice(0, cap).forEach(([k, x]) => {
        const val = each(x);
        if (val !== undefined) out[k] = val;
    });
    return out;
}

function list<T>(v: unknown, each: (x: unknown) => T | undefined, cap = 20): T[] | undefined {
    if (!Array.isArray(v)) return undefined;
    return v.slice(0, cap).map(each).filter((x): x is T => x !== undefined);
}

const apprentice = (x: unknown) => {
    const r = rec(x); const skill = str(r?.skill); const fromName = str(r?.fromName);
    return r && skill && fromName ? { skill, fromName, run: num(r.run, 0) ?? 0 } : undefined;
};
const offer = (x: unknown) => {
    const r = rec(x); const teacher = str(r?.teacher);
    return r && teacher ? { skills: strs(r.skills, 4), teacher, run: num(r.run, 0) ?? 0 } : undefined;
};
const bond = (x: unknown) => {
    const r = rec(x); const a = num(r?.a); const b = num(r?.b);
    return r && a !== undefined && b !== undefined ? { a, b, count: num(r.count, 0) ?? 1, run: num(r.run, 0) ?? 0 } : undefined;
};
const rivalry = (x: unknown) => {
    const r = rec(x); const a = num(r?.aDistrict); const b = num(r?.bDistrict);
    return r && a !== undefined && b !== undefined ? { aDistrict: a, bDistrict: b, heat: num(r.heat, 0, 1000) ?? 0, lastRun: num(r.lastRun, 0) ?? 0 } : undefined;
};
const nemesis = (x: unknown) => {
    const r = rec(x); const name = str(r?.name, 40); const district = num(r?.district);
    return r && name && district !== undefined
        ? { name, district, victimDistricts: nums(r.victimDistricts), kills: num(r.kills, 0) ?? 0, run: num(r.run, 0) ?? 0, arenaName: str(r.arenaName) ?? 'an arena' }
        : undefined;
};
const mastery = (x: unknown) => {
    const r = rec(x);
    return r ? { runs: num(r.runs, 0) ?? 0, crowns: num(r.crowns, 0) ?? 0, longest: num(r.longest, 0) ?? 0, victors: strs(r.victors, 5) } : undefined;
};
const piece = (x: unknown) => {
    const r = rec(x); const name = str(r?.name, 40);
    return r && name
        ? { name, district: num(r.district) ?? 0, cause: str(r.cause, 160) ?? 'unknown', code: str(r.code, 30) ?? 'unknown', day: num(r.day, 0) ?? 0, run: num(r.run, 0) ?? 0 }
        : undefined;
};
const chain = (x: unknown) => {
    const r = rec(x); const chainId = str(r?.chainId, 40);
    return r && chainId ? { chainId, step: num(r.step, 0, 3) ?? 0, run: num(r.run, 0) ?? 0, completed: num(r.completed, 0) ?? 0 } : undefined;
};
const quell = (x: unknown) => {
    const r = rec(x); const forRun = num(r?.forRun, 0); const quellId = str(r?.quellId, 60);
    return r && forRun !== undefined && quellId ? { forRun, quellId, announcedAfter: num(r.announcedAfter, 0) ?? 0 } : undefined;
};
const mentorArena = (x: unknown) => {
    const r = rec(x); const arenaId = str(r?.arenaId, 60); const arenaName = str(r?.arenaName);
    return r && arenaId && arenaName ? { arenaId, arenaName, terrain: str(r.terrain, 20), bestSkill: str(r.bestSkill, 30) } : undefined;
};
const cache = (x: unknown): VictorCache | undefined => {
    const r = rec(x); const fromName = str(r?.fromName, 60);
    return r && fromName ? { fromName, district: num(r.district) ?? 0, arenaName: str(r.arenaName) ?? 'an arena', itemIds: strs(r.itemIds, 6) } : undefined;
};

function season(x: unknown): SeasonLedger['season'] {
    const r = rec(x);
    if (!r) return undefined;
    return {
        number: Math.max(1, num(r.number, 1) ?? 1),
        played: Math.max(0, num(r.played, 0) ?? 0),
        points: numRecord(r.points, v => num(v, -1000, 1e6)) ?? {},
        mutator: str(r.mutator, 40),
        nextMutator: str(r.nextMutator, 40),
        champions: list(r.champions, c => {
            const cr = rec(c); const n = num(cr?.number); const d = num(cr?.district);
            return n !== undefined && d !== undefined ? { number: n, district: d } : undefined;
        }, 10),
    };
}

function bank(x: unknown): SeasonLedger['predictionBank'] {
    const r = rec(x);
    if (!r) return undefined;
    const n = (k: string) => Math.max(0, num(r[k], 0) ?? 0);
    return { bankroll: n('bankroll'), streak: n('streak'), bestStreak: n('bestStreak'), upsetsCalled: n('upsetsCalled'), causeCalls: n('causeCalls'), overUnderCalls: n('overUnderCalls') };
}

function gauntlet(x: unknown): SeasonLedger['gauntletBest'] {
    const r = rec(x); const score = num(r?.score, 0);
    return r && score !== undefined ? { score, mutators: strs(r.mutators, 4), seed: str(r.seed) ?? '', date: str(r.date, 40) ?? '' } : undefined;
}

/** Drops `undefined` members so a round trip is exact. */
function compact<T extends object>(o: T): T {
    Object.keys(o).forEach(k => { if ((o as Rec)[k] === undefined) delete (o as Rec)[k]; });
    return o;
}

export function normalizeSeasonLedger(raw: unknown): SeasonLedger | undefined {
    const r = rec(raw);
    if (!r) return undefined;
    return clean(compact<SeasonLedger>({
        apprenticeships: numRecord(r.apprenticeships, apprentice),
        apprenticeOffers: numRecord(r.apprenticeOffers, offer),
        reunions: list(r.reunions, bond, 12),
        veteranRespect: numRecord(r.veteranRespect, v => num(v, 0, 100)),
        rivalries: list(r.rivalries, rivalry, 12),
        nemeses: list(r.nemeses, nemesis, 8),
        arenaMastery: strRecord(r.arenaMastery, mastery, 256),
        museum: strRecord(r.museum, v => list(v, piece, 5), 256),
        storyChains: strRecord(r.storyChains, chain, 256),
        season: season(r.season),
        predictionBank: bank(r.predictionBank),
        gauntletBest: gauntlet(r.gauntletBest),
        announcedQuell: quell(r.announcedQuell),
        mentorArenas: numRecord(r.mentorArenas, mentorArena),
        upsetRewards: num(r.upsetRewards, 0),
    }));
}

/** A JSON round trip, so absent and `undefined` members read the same way everywhere. */
function clean<T>(o: T): T {
    return JSON.parse(JSON.stringify(o)) as T;
}

export function normalizeCampaignLedger(raw: unknown): CampaignLedger | undefined {
    const r = rec(raw);
    if (!r) return undefined;
    const out = compact<CampaignLedger>({
        apprenticeships: numRecord(r.apprenticeships, apprentice, 16),
        reunions: list(r.reunions, bond, 8),
        veteranRespect: numRecord(r.veteranRespect, v => num(v, 0, 100), 16),
        rivalries: list(r.rivalries, rivalry, 8),
        nemeses: list(r.nemeses, nemesis, 4),
        storyChains: strRecord(r.storyChains, chain, 64),
        announcedQuell: quell(r.announcedQuell),
        seasonMutator: str(r.seasonMutator, 40),
        mentorArenas: numRecord(r.mentorArenas, mentorArena, 16),
        oldVictorCache: cache(r.oldVictorCache),
    });
    return Object.keys(out).length > 0 ? clean(out) : undefined;
}

/**
 * The victor whose kit an old victor's cache holds: the most recent archived
 * crown that carried anything. Deterministic over the archive.
 */
export function victorCacheFrom(archive: HallOfFameEntry[]): VictorCache | undefined {
    const e = archive.find(x => !x.noVictor && (x.winnerItems?.length ?? 0) > 0 && !x.winnerName.includes('&'));
    if (!e) return undefined;
    return { fromName: e.winnerName.split(/\s+/)[0], district: e.winnerDistrict, arenaName: e.arenaName, itemIds: e.winnerItems!.slice(0, 3) };
}

/** The slice of the ledger a new run is created under. */
export function campaignLedgerOf(ledger: SeasonLedger | undefined, archive: HallOfFameEntry[] = []): CampaignLedger | undefined {
    const out = compact<CampaignLedger>({
        apprenticeships: ledger?.apprenticeships,
        reunions: ledger?.reunions,
        veteranRespect: ledger?.veteranRespect,
        rivalries: ledger?.rivalries,
        nemeses: ledger?.nemeses,
        storyChains: ledger?.storyChains,
        announcedQuell: ledger?.announcedQuell,
        seasonMutator: ledger?.season?.mutator,
        mentorArenas: ledger?.mentorArenas,
        oldVictorCache: victorCacheFrom(archive),
    });
    return Object.keys(out).length > 0 ? out : undefined;
}
