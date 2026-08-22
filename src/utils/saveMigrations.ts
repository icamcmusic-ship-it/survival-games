/**
 * The saved-run payload: its shape, its schema version, and the defensive
 * normalisation that lets a save written by an older build resume in the
 * current engine.
 *
 * `Tribute` has accumulated ~30 optional fields over the life of this project
 * (read the inline comments in `models/types.ts` — half of them say "optional so
 * saves from before it existed still resume"). Relying on `??` at every read
 * site is how that stays true only by accident: one unguarded `t.memory.fear[id]`
 * on a save from before `fear` existed is a white screen mid-run.
 *
 * So a deserialised tribute is normalised *once*, here, on the way in.
 */
import {
    Alliance, Attributes, Build, EventLog, GameConfig, GameState, Gender, Injuries, Item,
    Objective, Stance, Tribute, TributeMemory, Vitals,
} from '../models/types';
import { DEFAULT_GAME_CONFIG } from '../data/constants';
import {
    StorageSpec, STORAGE_KEYS, asBool, asNum, asNumMap, asObjMap, asRecord, asStr, asStrArray,
} from './storage';

/** A wager placed on a tribute, at the odds shown when it was placed. */
export interface Bet {
    stake: number;
    /** Payout multiplier at the moment the wager was placed. */
    mult: number;
}

export interface SavedRun {
    gameState: GameState;
    bets: Record<string, Bet>;
    betsResolved: boolean;
    hofSaved: boolean;
    isReplayedRun: boolean;
    savedAt: string;
}

/**
 * Saved-run schema version.
 *
 * 0 — everything written before versioning existed (a bare `SavedRun`).
 * 1 — envelope + `normalizeTribute` guaranteed shape.
 *
 * Bump this when the payload changes in a way `normalizeSavedRun` alone cannot
 * repair, and add a step to the chain below.
 */
export const SAVED_RUN_VERSION = 1;

const GENDERS: Gender[] = ['Male', 'Female'];
const STANCES: Stance[] = ['Aggressive', 'Defensive', 'Evasive'];
const BUILDS: Build[] = ['Frail', 'Slight', 'Average', 'Athletic', 'Stocky', 'Muscular'];
const ARCHETYPES = [
    'career', 'strategist', 'survivalist', 'protector', 'trickster', 'wildcard', 'underdog',
    'showman', 'pacifist', 'scavenger', 'zealot',
];

function oneOf<T extends string>(value: unknown, allowed: readonly string[], fallback: T): T {
    return typeof value === 'string' && allowed.includes(value) ? (value as T) : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
    return n < lo ? lo : n > hi ? hi : n;
}

function normalizeAttributes(raw: unknown): Attributes {
    const r = asRecord(raw) ?? {};
    return {
        strength: clamp(asNum(r.strength, 5), 0, 100),
        agility: clamp(asNum(r.agility, 5), 0, 100),
        intelligence: clamp(asNum(r.intelligence, 5), 0, 100),
        charisma: clamp(asNum(r.charisma, 5), 0, 100),
        stealth: clamp(asNum(r.stealth, 5), 0, 100),
    };
}

function normalizeVitals(raw: unknown): Vitals {
    const r = asRecord(raw) ?? {};
    return {
        hunger: clamp(asNum(r.hunger, 0), 0, 100),
        thirst: clamp(asNum(r.thirst, 0), 0, 100),
        fatigue: clamp(asNum(r.fatigue, 0), 0, 100),
        sanity: clamp(asNum(r.sanity, 100), 0, 100),
    };
}

function normalizeInjuries(raw: unknown): Injuries {
    const r = asRecord(raw) ?? {};
    return {
        head: asBool(r.head, false),
        torso: asBool(r.torso, false),
        arms: asBool(r.arms, false),
        legs: asBool(r.legs, false),
        bleeding: asBool(r.bleeding, false),
        infected: asBool(r.infected, false),
        poisoned: asBool(r.poisoned, false),
        burned: asBool(r.burned, false),
        frostbitten: asBool(r.frostbitten, false),
    };
}

function normalizeItem(raw: unknown, index: number): Item | null {
    const r = asRecord(raw);
    if (!r) return null;
    const name = asStr(r.name, '');
    if (!name) return null;
    const type = oneOf<Item['type']>(
        r.type, ['weapon', 'food', 'water', 'medical', 'utility', 'armour', 'tool'], 'utility',
    );
    return {
        ...(r as Partial<Item>),
        id: asStr(r.id, `item-${index}-${name}`),
        name,
        type,
        value: asNum(r.value, 1),
    };
}

function normalizeMemory(raw: unknown): TributeMemory {
    const r = asRecord(raw) ?? {};
    return {
        zones: asObjMap(r.zones),
        vengeance: asStrArray(r.vengeance),
        betrayedBy: asStrArray(r.betrayedBy),
        timesBetrayed: asNum(r.timesBetrayed, 0),
        lastContact: asNumMap(r.lastContact),
        mourned: asStrArray(r.mourned),
        giftsReceived: asNum(r.giftsReceived, 0),
        fear: asNumMap(r.fear),
        rivals: asObjMap(r.rivals),
        stoodBy: asStrArray(r.stoodBy),
        contactStreak: asNumMap(r.contactStreak),
        suspicion: asNumMap(r.suspicion),
    };
}

function normalizeObjective(raw: unknown): Objective {
    const r = asRecord(raw);
    if (!r) return { kind: 'survive' };
    switch (r.kind) {
        case 'hunt':
            return typeof r.targetId === 'string'
                ? { kind: 'hunt', targetId: r.targetId, expires: asNum(r.expires, 0) }
                : { kind: 'survive' };
        case 'reach':
            return typeof r.zone === 'string'
                ? {
                    kind: 'reach',
                    zone: r.zone,
                    reason: oneOf(r.reason, ['water', 'shelter', 'feast', 'ally', 'forage'], 'forage'),
                    expires: asNum(r.expires, 0),
                }
                : { kind: 'survive' };
        case 'hold':
            return typeof r.zone === 'string'
                ? { kind: 'hold', zone: r.zone, expires: asNum(r.expires, 0) }
                : { kind: 'survive' };
        case 'flee':
            return typeof r.from === 'string'
                ? { kind: 'flee', from: r.from, expires: asNum(r.expires, 0) }
                : { kind: 'survive' };
        case 'protect':
            return typeof r.wardId === 'string'
                ? { kind: 'protect', wardId: r.wardId, expires: asNum(r.expires, 0) }
                : { kind: 'survive' };
        default:
            return { kind: 'survive' };
    }
}

/**
 * Coerce one unknown value into a fully-populated `Tribute`, or reject it.
 *
 * Every required field gets a value; every optional field the engine mutates
 * in place (maps, arrays, counters) is materialised so a `t.debts[id] += n`
 * cannot land on `undefined`. Returns null only when the value is not a tribute
 * at all — a record with no id or no name cannot be reconciled against the rest
 * of the save.
 */
export function normalizeTribute(raw: unknown, index = 0): Tribute | null {
    const r = asRecord(raw);
    if (!r) return null;
    const id = asStr(r.id, '');
    const name = asStr(r.name, '');
    if (!id || !name) return null;

    const status: Tribute['status'] = r.status === 'dead' ? 'dead' : 'alive';
    const drift = asRecord(r.attributeDrift) ?? {};
    const transit = asRecord(r.transit);

    return {
        // Unknown extra keys from a *newer* build ride along untouched; the
        // fields below then overwrite everything this build actually reads.
        ...(r as Partial<Tribute>),

        id,
        name,
        district: asNum(r.district, (index % 12) + 1),
        gender: oneOf<Gender>(r.gender, GENDERS, 'Female'),
        age: clamp(asNum(r.age, 16), 1, 99),
        heightCm: asNum(r.heightCm, 165),
        build: oneOf<Build>(r.build, BUILDS, 'Average'),
        isCareer: asBool(r.isCareer, false),
        archetype: oneOf<Tribute['archetype']>(r.archetype, ARCHETYPES, 'wildcard'),
        attributes: normalizeAttributes(r.attributes),
        traits: asStrArray(r.traits),
        vitals: normalizeVitals(r.vitals),
        injuries: normalizeInjuries(r.injuries),
        health: clamp(asNum(r.health, status === 'dead' ? 0 : 100), 0, 100),
        status,
        inventory: Array.isArray(r.inventory)
            ? r.inventory.map(normalizeItem).filter((i): i is Item => i !== null)
            : [],
        stance: oneOf<Stance>(r.stance, STANCES, 'Defensive'),
        relationships: asNumMap(r.relationships),
        excitementRating: asNum(r.excitementRating, 50),
        sponsorTrust: asNum(r.sponsorTrust, 50),
        trainingScore: clamp(asNum(r.trainingScore, 5), 0, 12),
        kills: asNum(r.kills, 0),
        causeOfDeath: typeof r.causeOfDeath === 'string' ? r.causeOfDeath : undefined,
        dayOfDeath: typeof r.dayOfDeath === 'number' ? r.dayOfDeath : undefined,
        zone: asStr(r.zone, 'Cornucopia'),
        allianceId: typeof r.allianceId === 'string' ? r.allianceId : undefined,
        memory: normalizeMemory(r.memory),
        stanceHeld: asNum(r.stanceHeld, 0),
        fanFavourite: asBool(r.fanFavourite, false),
        reputation: asNum(r.reputation, asNum(r.sponsorTrust, 50)),
        daysSurvived: asNum(r.daysSurvived, 0),

        // Optional-but-mutated: materialised so no call site has to guard.
        sanityStealthLoss: asNum(r.sanityStealthLoss, 0),
        resolve: clamp(asNum(r.resolve, 70), 0, 100),
        truces: asNumMap(r.truces),
        displayedRegard: asNumMap(r.displayedRegard),
        debts: asNumMap(r.debts),
        districtBondNoted: asBool(r.districtBondNoted, false),
        bleedSeverity: clamp(asNum(r.bleedSeverity, r.injuries && asBool((asRecord(r.injuries) ?? {}).bleeding, false) ? 1 : 0), 0, 3),
        momentum: asNum(r.momentum, 0),
        rattled: asNum(r.rattled, 0),
        tesserae: asNum(r.tesserae, 0),
        attributeDrift: Object.fromEntries(
            (['strength', 'agility', 'intelligence', 'charisma', 'stealth'] as const)
                .filter(k => typeof drift[k] === 'number')
                .map(k => [k, drift[k] as number])
        ),
        transit: transit && typeof transit.to === 'string'
            ? { to: transit.to, remaining: asNum(transit.remaining, 1) }
            : undefined,
        proficiencies: asObjMap<number>(r.proficiencies),
        objective: normalizeObjective(r.objective),
        protectorBonds: asStrArray(r.protectorBonds),
        quirks: asStrArray(r.quirks),
        sleeplessCycles: asNum(r.sleeplessCycles, 0),
        notoriety: clamp(asNum(r.notoriety, 0), 0, 100),
        injurySeverity: asObjMap<number>(r.injurySeverity),
        platePosition: clamp(asNum(r.platePosition, 0.5), 0, 1),
    };
}

function normalizeConfig(raw: unknown): GameConfig {
    const r = asRecord(raw) ?? {};
    return {
        districtCount: clamp(asNum(r.districtCount, DEFAULT_GAME_CONFIG.districtCount), 1, 12),
        hazardRate: asNum(r.hazardRate, DEFAULT_GAME_CONFIG.hazardRate),
        betrayalRate: asNum(r.betrayalRate, DEFAULT_GAME_CONFIG.betrayalRate),
        sponsorGenerosity: asNum(r.sponsorGenerosity, DEFAULT_GAME_CONFIG.sponsorGenerosity),
        enableFeast: asBool(r.enableFeast, DEFAULT_GAME_CONFIG.enableFeast),
        enableSanity: asBool(r.enableSanity, DEFAULT_GAME_CONFIG.enableSanity),
    };
}

function normalizeLog(raw: unknown): EventLog[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry, i) => {
        const r = asRecord(entry);
        if (!r || typeof r.text !== 'string') return [];
        return [{
            ...(r as Partial<EventLog>),
            id: asStr(r.id, `log-${i}`),
            day: asNum(r.day, 0),
            phase: asStr(r.phase, 'day') as EventLog['phase'],
            text: r.text,
            tributesInvolved: asStrArray(r.tributesInvolved),
            important: asBool(r.important, false),
            category: asStr(r.category, 'ambient') as EventLog['category'],
        }];
    });
}

function normalizeAlliances(raw: unknown): Record<string, Alliance> | undefined {
    const rec = asRecord(raw);
    if (!rec) return undefined;
    const out: Record<string, Alliance> = {};
    Object.entries(rec).forEach(([id, value]) => {
        const a = asRecord(value);
        if (!a) return;
        const memberIds = asStrArray(a.memberIds);
        if (memberIds.length === 0) return;
        out[id] = {
            ...(a as Partial<Alliance>),
            id: asStr(a.id, id),
            leaderId: asStr(a.leaderId, memberIds[0]),
            memberIds,
            formedCycle: asNum(a.formedCycle, 0),
            sharedCache: Array.isArray(a.sharedCache)
                ? a.sharedCache.map(normalizeItem).filter((i): i is Item => i !== null)
                : [],
            pact: oneOf(a.pact, ['to-the-end', 'until-the-final-eight', 'no-pact'], 'no-pact'),
            // R-1/R-2: both are mutated in place by the engine, so they are
            // materialised here rather than relying on `??` at each call site.
            roles: asObjMap<string>(a.roles),
            packTruces: asNumMap(a.packTruces),
        };
    });
    return out;
}

/**
 * Coerce one unknown value into a resumable `GameState`, or reject it.
 *
 * A save with no arena or no living cast is not resumable at all, so it is
 * rejected rather than patched into something that would crash the first time
 * the simulator asked for a zone.
 */
export function normalizeGameState(raw: unknown): GameState | null {
    const r = asRecord(raw);
    if (!r) return null;

    const arena = asRecord(r.arena);
    if (!arena || !Array.isArray(arena.zones) || arena.zones.length === 0) return null;

    const tributes = Array.isArray(r.tributes)
        ? r.tributes.map((t, i) => normalizeTribute(t, i)).filter((t): t is Tribute => t !== null)
        : [];
    if (tributes.length === 0) return null;

    const baseConfig = normalizeConfig(r.baseConfig ?? r.config);

    return {
        ...(r as Partial<GameState>),
        seed: asStr(r.seed, 'UNKNOWN'),
        arena: arena as unknown as GameState['arena'],
        tributes,
        phase: asStr(r.phase, 'bloodbath') as GameState['phase'],
        day: Math.max(0, asNum(r.day, 1)),
        log: normalizeLog(r.log),
        gamemakerMode: asBool(r.gamemakerMode, false),
        config: normalizeConfig(r.config ?? r.baseConfig),
        baseConfig,

        // Optional collections the engine reads and writes without guarding.
        collapsedZones: asStrArray(r.collapsedZones),
        firedWildcards: Array.isArray(r.firedWildcards)
            ? r.firedWildcards.filter((n): n is number => typeof n === 'number')
            : [],
        logCounter: asNum(r.logCounter, normalizeLog(r.log).length),
        lastPickedText: asObjMap<string>(r.lastPickedText),
        zoneDepletion: asNumMap(r.zoneDepletion),
        zoneEffects: asObjMap(r.zoneEffects),
        severedEdges: asStrArray(r.severedEdges),
        cycle: asNum(r.cycle, 0),
        timeOfDay: oneOf(r.timeOfDay, ['day', 'dusk', 'night'], 'day'),
        zoneDeaths: asNumMap(r.zoneDeaths),
        zoneTraffic: asNumMap(r.zoneTraffic),
        traps: Array.isArray(r.traps) ? (r.traps as GameState['traps']) : [],
        alliances: normalizeAlliances(r.alliances) ?? {},
        scarredZones: asStrArray(r.scarredZones),
        preClosedZones: asStrArray(r.preClosedZones),
        broadcastBeats: asStrArray(r.broadcastBeats),
        camps: asObjMap(r.camps),
        activeMutts: Array.isArray(r.activeMutts) ? (r.activeMutts as GameState['activeMutts']) : [],
        sponsorBlocBudgets: asNumMap(r.sponsorBlocBudgets),
    };
}

function normalizeBets(raw: unknown): Record<string, Bet> {
    const rec = asRecord(raw);
    if (!rec) return {};
    const out: Record<string, Bet> = {};
    Object.entries(rec).forEach(([id, value]) => {
        const b = asRecord(value);
        if (!b) return;
        const stake = asNum(b.stake, 0);
        if (stake <= 0) return;
        out[id] = { stake, mult: Math.max(0, asNum(b.mult, 1)) };
    });
    return out;
}

/** Total, non-throwing coercion of an unknown payload into a `SavedRun`. */
export function normalizeSavedRun(raw: unknown): SavedRun | null {
    const r = asRecord(raw);
    if (!r) return null;
    const gameState = normalizeGameState(r.gameState);
    if (!gameState) return null;
    // A finished run is not worth resuming, and resuming one would re-run the
    // end-of-game payouts. Treat it as no save.
    if (gameState.phase === 'ended') return null;

    const savedAt = asStr(r.savedAt, '');
    return {
        gameState,
        bets: normalizeBets(r.bets),
        betsResolved: asBool(r.betsResolved, false),
        hofSaved: asBool(r.hofSaved, false),
        isReplayedRun: asBool(r.isReplayedRun, false),
        savedAt: Number.isNaN(Date.parse(savedAt)) ? new Date(0).toISOString() : savedAt,
    };
}

export const SAVED_RUN_SPEC: StorageSpec<SavedRun> = {
    key: STORAGE_KEYS.savedRun,
    version: SAVED_RUN_VERSION,
    // v0 (unversioned) and v1 differ only in the envelope: the whole point of
    // normalising on every read is that the shape repair is version-agnostic.
    migrate: raw => normalizeSavedRun(raw),
};
