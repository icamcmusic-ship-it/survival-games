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
    Alliance, AlliancePact, Attributes, Build, Condition, EventLog, Frame, Handedness, LimbRatio, GameConfig, GameState, Gender, Injuries, Item,
    Objective, Stance, Tribute, TributeMemory, Vitals,
} from '../models/types';
import { DEFAULT_GAME_CONFIG } from '../data/constants';
import { ALLIANCES } from '../data/balance';
import { conditionOf, frameOf } from '../engine/physique';

/** §3.1: the two body axes, for save normalisation. */
const FRAMES: Frame[] = ['Narrow', 'Spare', 'Even', 'Broad', 'Heavy'];
const CONDITIONS: Condition[] = ['Wasted', 'Lean', 'Conditioned', 'Padded', 'Bulky'];
const LIMB_RATIOS: LimbRatio[] = ['long', 'even', 'compact'];
const HANDEDNESS: Handedness[] = ['left', 'right'];
import {
    StorageSpec, STORAGE_KEYS, asBool, asNum, asNumMap, asObjMap, asRecord, asStr, asStrArray,
} from './storage';

/** A wager placed on a tribute, at the odds shown when it was placed. */
export interface Bet {
    stake: number;
    /** Payout multiplier at the moment the wager was placed. */
    mult: number;
}

/** §6.8: a proposition bet settled from the run itself rather than the crown. */
export type SideBetKind = 'first-blood' | 'no-victor' | 'career-victor';
export interface SideBet {
    kind: SideBetKind;
    stake: number;
    /** Fixed at placement — see SIDE_BETS in balance.ts. */
    mult: number;
    /** 'first-blood' only: the tribute wagered to draw it. */
    targetId?: string;
}

export interface SavedRun {
    gameState: GameState;
    bets: Record<string, Bet>;
    sideBets: SideBet[];
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
const ARCHETYPES = ['career', 'strategist', 'survivalist', 'protector', 'trickster', 'wildcard', 'underdog'];

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
        // §3.1: saves written before endurance and willpower existed resume
        // with a neutral 5 rather than NaN, which is exactly what `attr()`
        // in models/types.ts assumes for anything that slips past here.
        endurance: clamp(asNum(r.endurance, 5), 0, 100),
        willpower: clamp(asNum(r.willpower, 5), 0, 100),
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
        // §3.1: a pre-§3.1 save has only the single-axis `build`. `frameOf`
        // and `conditionOf` know how to read the legacy ladder, so the two
        // axes are derived here once rather than guarded at every read site.
        frame: oneOf<Frame>(r.frame, FRAMES, frameOf({ build: oneOf<Build>(r.build, BUILDS, 'Average') } as Tribute)),
        condition: oneOf<Condition>(r.condition, CONDITIONS, conditionOf({ build: oneOf<Build>(r.build, BUILDS, 'Average') } as Tribute)),
        limbRatio: oneOf<LimbRatio>(r.limbRatio, LIMB_RATIOS, 'even'),
        handedness: oneOf<Handedness>(r.handedness, HANDEDNESS, 'right'),
        conditionPressure: asNum(r.conditionPressure, 0),
        stanceChurn: asNum(r.stanceChurn, 0),
        sleepDebt: asNum(r.sleepDebt, 0),
        tensionStreak: asNum(r.tensionStreak, 0),
        woundedSide: r.woundedSide === 'left' || r.woundedSide === 'right' ? r.woundedSide : undefined,
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
        truceReason: asObjMap(r.truceReason) as Tribute['truceReason'],
        displayedRegard: asNumMap(r.displayedRegard),
        // §4.1: the second stored relationship axis (professional esteem).
        // Saves from before it existed load as an empty map and the axis
        // rebuilds from play.
        respects: asNumMap(r.respects),
        debts: asNumMap(r.debts),
        districtBondNoted: asBool(r.districtBondNoted, false),

        // §1.1/§1.7: the lifetime ledger — the write-once flags and the
        // monotonic counters that exactly one achievement, earned trait or
        // epilogue beat reads at the end of the run.
        //
        // These were the one family of optional fields the normaliser did not
        // materialise, on the reasoning that every read site already says
        // `?? 0` / `=== true`. That is true today and is exactly the shape
        // that breaks quietly: `undefined` reads as falsy either way, so a
        // resumed pre-migration save either replays a one-shot beat it has
        // already fired or skips it forever, and neither shows up as an error.
        // Defaulting them here makes the resumed tribute indistinguishable
        // from one that has played the whole run in this build.
        fullKitSeen: asBool(r.fullKitSeen, false),
        everCarriedWeapon: asBool(r.everCarriedWeapon, false),
        // §3.4: the two contradiction-arc counters.
        betrayalsCommitted: asNum(r.betrayalsCommitted, 0),
        finishingBlows: asNum(r.finishingBlows, 0),
        poisonedByWeapon: asBool(r.poisonedByWeapon, false),
        everDowned: asBool(r.everDowned, false),
        sanityScarred: asBool(r.sanityScarred, false),
        signatureFired: asBool(r.signatureFired, false),
        volunteered: asBool(r.volunteered, false),
        waterCrossings: asNum(r.waterCrossings, 0),
        corpsesLooted: asNum(r.corpsesLooted, 0),
        unseenStreak: asNum(r.unseenStreak, 0),
        trapKills: asNum(r.trapKills, 0),
        trapsDisarmed: asNum(r.trapsDisarmed, 0),
        performingStreak: asNum(r.performingStreak, 0),
        maxPerformingStreak: asNum(r.maxPerformingStreak, 0),
        ghostTrust: asNum(r.ghostTrust, 0),
        retainersHonoured: asNum(r.retainersHonoured, 0),
        trucesBrokeredHeld: asNum(r.trucesBrokeredHeld, 0),
        zoneHeld: asNum(r.zoneHeld, 0),
        fortifiedCycles: asNum(r.fortifiedCycles, 0),
        paradeBuzz: asNum(r.paradeBuzz, 0),
        objectiveQueue: Array.isArray(r.objectiveQueue)
            ? (r.objectiveQueue as unknown[]).map(normalizeObjective)
            : [],
        visitedZones: asStrArray(r.visitedZones),
        extortedIds: asStrArray(r.extortedIds),
        retainerPaidBy: asStrArray(r.retainerPaidBy),
        trainingPact: asStrArray(r.trainingPact),
        shedTraits: asStrArray(r.shedTraits),
        scars: asObjMap<boolean>(r.scars),
        recoveryProgress: asObjMap<number>(r.recoveryProgress),
        // §3.1: the per-site infection record and its incubation clock. A save
        // from before infection existed resumes with clean wounds rather than
        // undefined ones, and `syncInfectedFlag` reconciles the whole-body
        // `injuries.infected` flag against it on the first tick.
        woundInfection: asObjMap<number>(r.woundInfection),
        woundAge: asObjMap<number>(r.woundAge),
        traitAge: asNumMap(r.traitAge),
        truceRenewed: asNumMap(r.truceRenewed),
        stanceCooldown: asObjMap<number>(r.stanceCooldown),
        stanceReady: asObjMap<number>(r.stanceReady),
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
        // §3.2: per-weapon familiarity. A save from before it existed resumes
        // with every weapon cold, which is the honest reading — the engine has
        // no record of what they have been swinging.
        weaponFamiliarity: asNumMap(r.weaponFamiliarity),
        objective: normalizeObjective(r.objective),
        protectorBonds: asStrArray(r.protectorBonds),
        quirks: asStrArray(r.quirks),
        injurySeverity: asObjMap<number>(r.injurySeverity),
        platePosition: clamp(asNum(r.platePosition, 0.5), 0, 1),
    };
}

function normalizeConfig(raw: unknown): GameConfig {
    const r = asRecord(raw) ?? {};
    return {
        districtCount: clamp(asNum(r.districtCount, DEFAULT_GAME_CONFIG.districtCount), 1, 16),
        hazardRate: asNum(r.hazardRate, DEFAULT_GAME_CONFIG.hazardRate),
        betrayalRate: asNum(r.betrayalRate, DEFAULT_GAME_CONFIG.betrayalRate),
        sponsorGenerosity: asNum(r.sponsorGenerosity, DEFAULT_GAME_CONFIG.sponsorGenerosity),
        enableFeast: asBool(r.enableFeast, DEFAULT_GAME_CONFIG.enableFeast),
        enableSanity: asBool(r.enableSanity, DEFAULT_GAME_CONFIG.enableSanity),
        plainNames: asBool(r.plainNames, DEFAULT_GAME_CONFIG.plainNames ?? false),
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

/**
 * §4.1: the pact union, from anything a save might hold.
 *
 * Pre-§4.1 saves store one of three strings; the field-threshold shape is the
 * one that carries the old 'until-the-final-eight' meaning forwards without
 * changing what those groups agreed to.
 */
function migratePact(raw: unknown): AlliancePact {
    if (typeof raw === 'string') {
        if (raw === 'to-the-end') return { kind: 'to-the-end' };
        if (raw === 'until-the-final-eight') return { kind: 'until-field', threshold: ALLIANCES.finalEightSize };
        return { kind: 'no-pact' };
    }
    const rec = asRecord(raw);
    const kind = rec ? asStr(rec.kind, 'no-pact') : 'no-pact';
    switch (kind) {
        case 'to-the-end': return { kind: 'to-the-end' };
        case 'until-field': return { kind: 'until-field', threshold: asNum(rec!.threshold, ALLIANCES.finalEightSize) };
        case 'until-day': return { kind: 'until-day', day: asNum(rec!.day, 1) };
        case 'until-event': return {
            kind: 'until-event',
            event: oneOf(rec!.event, ['feast', 'first-blood', 'career-pack-falls', 'arena-closes', 'first-hurt'], 'feast'),
        };
        case 'until-goal': {
            const targetId = asStr(rec!.targetId, '');
            return targetId ? { kind: 'until-goal', goal: 'kill-target', targetId } : { kind: 'no-pact' };
        }
        default: return { kind: 'no-pact' };
    }
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
            // §4.1: pacts became a discriminated union. A pre-§4.1 save holds
            // the old string; 'until-the-final-eight' maps onto the shape that
            // now expresses it, and anything unrecognised lapses to no pact.
            pact: migratePact(a.pact),
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

function normalizeSideBets(raw: unknown): SideBet[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap(entry => {
        const b = asRecord(entry);
        if (!b) return [];
        const kind = b.kind;
        if (kind !== 'first-blood' && kind !== 'no-victor' && kind !== 'career-victor') return [];
        const stake = asNum(b.stake, 0);
        if (stake <= 0) return [];
        return [{
            kind,
            stake,
            mult: Math.max(1, asNum(b.mult, 1)),
            targetId: typeof b.targetId === 'string' ? b.targetId : undefined,
        }];
    });
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
        sideBets: normalizeSideBets(r.sideBets),
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

/**
 * UX: named save slots. Slot 1 is the rolling autosave (`SAVED_RUN_SPEC`,
 * unchanged); slots 2 and 3 are manual — a run parked mid-decision while
 * another is played, or a branch point kept to revisit. Same schema, same
 * migration chain, separate keys.
 */
export const SAVE_SLOT_SPECS: ReadonlyArray<StorageSpec<SavedRun>> = [
    SAVED_RUN_SPEC,
    { key: STORAGE_KEYS.saveSlot2, version: SAVED_RUN_VERSION, migrate: raw => normalizeSavedRun(raw) },
    { key: STORAGE_KEYS.saveSlot3, version: SAVED_RUN_VERSION, migrate: raw => normalizeSavedRun(raw) },
];
