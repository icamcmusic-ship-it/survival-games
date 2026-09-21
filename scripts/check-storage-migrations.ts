/**
 * Exercises the localStorage migration chain against representative legacy
 * payloads.
 *
 *   npm run test:storage
 *
 * The things that must never regress, because there is no server to repair a
 * player's browser after the fact:
 *
 *  - unversioned (v0) data is migrated, not discarded;
 *  - a renamed key is adopted from its old name and the old name cleaned up;
 *  - a save from a build whose `Tribute` predates half the current fields comes
 *    back fully populated;
 *  - corrupt, truncated or hostile data reads as "no saved data" and never throws.
 */
import assert from 'node:assert/strict';
import { HOF_SPEC } from '../src/utils/hofStorage';
import { PANEM_SPEC } from '../src/utils/panemStorage';
import { COINS_SPEC, CONFIG_SPEC, FILTERS_SPEC, readCoins } from '../src/utils/prefsStorage';
import { CONFIG_KEYS, REWIND_PERSIST, SAVED_RUN_SPEC, normalizeConfig, normalizeTribute } from '../src/utils/saveMigrations';
import { normalizeEntry } from '../src/utils/hofStorage';
import { DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameConfig } from '../src/models/types';
import { SHARE_OMITS, shareParams } from '../src/components/ShareButton';
import { ARCHETYPES as ARCHETYPE_DEFS } from '../src/data/archetypes';
import { STANCES } from '../src/data/stances';
import {
    STORAGE_KEYS, StorageBackend, StorageSpec, readStored, setStorageBackend, writeStored,
} from '../src/utils/storage';

let failures = 0;
function test(name: string, fn: () => void) {
    const store = new Map<string, string>();
    const backend: StorageBackend = {
        getItem: k => (store.has(k) ? store.get(k)! : null),
        setItem: (k, v) => { store.set(k, v); },
        removeItem: k => { store.delete(k); },
    };
    setStorageBackend(backend);
    (globalThis as Record<string, unknown>).__store = store;
    try {
        fn();
        console.log(`  ok   ${name}`);
    } catch (err) {
        failures++;
        console.log(`  FAIL ${name}`);
        console.log(`       ${(err as Error).message.split('\n')[0]}`);
    } finally {
        setStorageBackend(null);
    }
}

function raw(): Map<string, string> {
    return (globalThis as Record<string, unknown>).__store as Map<string, string>;
}

/** Seed a key with a bare, unversioned payload, the way old builds wrote it. */
function seedLegacy(key: string, value: unknown) {
    raw().set(key, typeof value === 'string' ? value : JSON.stringify(value));
}

function envelopeVersion(key: string): number | undefined {
    const s = raw().get(key);
    return s === undefined ? undefined : JSON.parse(s).v;
}

/* -------------------------------------------------------------------------- */
/* Representative legacy payloads                                             */
/* -------------------------------------------------------------------------- */

/** A tribute as an early build wrote it: no memory, no resolve, no objective. */
const ANCIENT_TRIBUTE = {
    id: 't1',
    district: 4,
    gender: 'Female',
    name: 'Old Save Tribute',
    age: 16,
    isCareer: true,
    attributes: { strength: 7, agility: 6, intelligence: 5, charisma: 4, stealth: 3 },
    traits: ['Ruthless'],
    vitals: { hunger: 20, thirst: 10, fatigue: 30, sanity: 80 },
    injuries: { bleeding: true },
    health: 72,
    status: 'alive',
    inventory: [{ id: 'i1', name: 'Sword', type: 'weapon', value: 8 }],
    stance: 'Aggressive',
    relationships: { t2: 30 },
    excitementRating: 60,
    sponsorTrust: 55,
    trainingScore: 9,
    kills: 2,
    zone: 'Cornucopia',
};

function legacySave(overrides: Record<string, unknown> = {}) {
    return {
        gameState: {
            seed: 'ABC123',
            arena: { id: 'forest', name: 'Old Forest', zones: [{ name: 'Cornucopia' }] },
            tributes: [ANCIENT_TRIBUTE, { ...ANCIENT_TRIBUTE, id: 't2', name: 'Second', status: 'dead', health: 0 }],
            phase: 'day',
            day: 3,
            log: [{ id: 'l1', day: 1, phase: 'bloodbath', text: 'It begins.', tributesInvolved: [], important: true, category: 'combat' }],
            gamemakerMode: false,
            config: { districtCount: 12, hazardRate: 1, betrayalRate: 1, sponsorGenerosity: 1, enableFeast: true, enableSanity: true },
            ...overrides,
        },
        bets: { t1: { stake: 100, mult: 3.5 } },
        savedAt: '2024-01-01T00:00:00.000Z',
    };
}

/* -------------------------------------------------------------------------- */

console.log('storage migrations');

test('v0 saved run migrates and is rewritten at the current version', () => {
    seedLegacy(STORAGE_KEYS.savedRun, legacySave());
    const run = readStored(SAVED_RUN_SPEC);
    assert.ok(run, 'legacy save was discarded');
    assert.equal(run.gameState.seed, 'ABC123');
    assert.equal(run.gameState.tributes.length, 2);
    assert.deepEqual(run.bets, { t1: { stake: 100, mult: 3.5 } });
    assert.equal(envelopeVersion(STORAGE_KEYS.savedRun), SAVED_RUN_SPEC.version, 'not re-stamped');
});

test('a tribute from an old build gets every field the engine expects', () => {
    seedLegacy(STORAGE_KEYS.savedRun, legacySave());
    const t = readStored(SAVED_RUN_SPEC)!.gameState.tributes[0];

    // Required fields the old payload simply did not have.
    assert.equal(typeof t.heightCm, 'number');
    assert.ok(['Frail', 'Slight', 'Average', 'Athletic', 'Stocky', 'Muscular'].includes(t.build));
    assert.equal(typeof t.archetype, 'string');
    assert.equal(typeof t.stanceHeld, 'number');
    assert.equal(typeof t.fanFavourite, 'boolean');
    assert.equal(typeof t.reputation, 'number');
    assert.equal(typeof t.daysSurvived, 'number');

    // Nested records the engine mutates in place.
    assert.deepEqual(t.memory.zones, {});
    assert.deepEqual(t.memory.fear, {});
    assert.deepEqual(t.memory.rivals, {});
    assert.deepEqual(t.memory.vengeance, []);
    assert.equal(t.memory.timesBetrayed, 0);
    assert.deepEqual(t.truces, {});
    assert.deepEqual(t.debts, {});
    assert.deepEqual(t.displayedRegard, {});
    assert.deepEqual(t.proficiencies, {});
    assert.deepEqual(t.protectorBonds, []);
    assert.deepEqual(t.objective, { kind: 'survive' });
    assert.equal(typeof t.resolve, 'number');
    assert.equal(typeof t.momentum, 'number');

    // Partial nested objects are completed, not passed through.
    assert.equal(t.injuries.bleeding, true);
    assert.equal(t.injuries.poisoned, false);
    assert.equal(t.injuries.frostbitten, false);
    // A bleeding tribute from before severities existed bleeds at severity 1.
    assert.equal(t.bleedSeverity, 1);
    // baseConfig did not exist; it falls back to the config that did.
    assert.equal(t.zone, 'Cornucopia');
});

test('the rewind stack round-trips, is capped, and survives junk entries', () => {
    // A save written before §2.2 has no `rewind` at all: it must resume with an
    // empty history rather than an undefined one.
    seedLegacy(STORAGE_KEYS.savedRun, legacySave());
    assert.deepEqual(readStored(SAVED_RUN_SPEC)!.rewind, [], 'absent rewind stack not defaulted');

    // Four checkpoints offered, three kept (REWIND_PERSIST), newest last.
    const checkpoint = (day: number) => ({ ...legacySave().gameState, day });
    seedLegacy(STORAGE_KEYS.savedRun, {
        ...legacySave(),
        rewind: [checkpoint(1), checkpoint(2), checkpoint(3), checkpoint(4)],
    });
    const kept = readStored(SAVED_RUN_SPEC)!.rewind!;
    assert.equal(kept.length, REWIND_PERSIST, 'rewind stack not truncated to the persisted tail');
    assert.deepEqual(kept.map(s => s.day), [2, 3, 4], 'wrong end of the stack kept');
    // And each checkpoint is normalised like the live state, not passed through.
    assert.equal(typeof kept[0].tributes[0].resolve, 'number', 'checkpoint tribute not normalised');

    // Hostile or unrepairable entries are dropped; the run itself still loads.
    seedLegacy(STORAGE_KEYS.savedRun, {
        ...legacySave(),
        rewind: [null, 'nope', { arena: null }, checkpoint(9)],
    });
    const salvaged = readStored(SAVED_RUN_SPEC);
    assert.ok(salvaged, 'a broken checkpoint rejected the whole save');
    assert.deepEqual(salvaged!.rewind!.map(s => s.day), [9]);

    seedLegacy(STORAGE_KEYS.savedRun, { ...legacySave(), rewind: 'not-an-array' });
    assert.deepEqual(readStored(SAVED_RUN_SPEC)!.rewind, []);
});

test('stripped checkpoint chronicles are rebuilt from the run being saved', () => {
    // What `packRewind` writes: a checkpoint with no log of its own, plus the
    // number of lines it had. The chronicle is stored once, not once per
    // checkpoint — three copies of a 1,300-line log is 1.5 MB of quota.
    const base = legacySave();
    const line = (n: number) => ({
        id: `l${n}`, day: n, phase: 'day', text: `Line ${n}`,
        tributesInvolved: [], important: false, category: 'ambient',
    });
    const full = { ...base, gameState: { ...base.gameState, log: [line(1), line(2), line(3)] } };
    seedLegacy(STORAGE_KEYS.savedRun, {
        ...full,
        rewind: [
            { ...full.gameState, day: 1, log: [] },
            { ...full.gameState, day: 2, log: [] },
        ],
        rewindLogLengths: [1, 3],
    });
    const run = readStored(SAVED_RUN_SPEC)!;
    assert.equal(run.gameState.log.length, 3);
    assert.deepEqual(run.rewind!.map(s => s.log.length), [1, 3], 'checkpoint chronicles not rebuilt');
    assert.equal(run.rewind![0].log[0].text, 'Line 1');

    // A length the saved chronicle cannot honour drops that checkpoint rather
    // than handing it somebody else's log.
    seedLegacy(STORAGE_KEYS.savedRun, {
        ...full,
        rewind: [{ ...full.gameState, day: 1, log: [] }, { ...full.gameState, day: 2, log: [] }],
        rewindLogLengths: [99, 2],
    });
    const repaired = readStored(SAVED_RUN_SPEC)!;
    assert.equal(repaired.rewind!.length, 1, 'impossible checkpoint length accepted');
    assert.equal(repaired.rewind![0].log.length, 2);
});

test('normalizeTribute rejects non-tributes and survives hostile input', () => {
    assert.equal(normalizeTribute(null), null);
    assert.equal(normalizeTribute('nope'), null);
    assert.equal(normalizeTribute({ id: 'x' }), null, 'nameless record accepted');
    assert.equal(normalizeTribute([]), null);
    const t = normalizeTribute({
        id: 'x', name: 'Y', attributes: 'not-an-object', vitals: 42, memory: [], inventory: 'nope',
        relationships: { a: 'six' }, health: 'lots', status: 'undead', traits: [1, 'Brave'],
    });
    assert.ok(t);
    assert.equal(t.status, 'alive');
    assert.equal(t.health, 100);
    assert.deepEqual(t.inventory, []);
    assert.deepEqual(t.relationships, {});
    assert.deepEqual(t.traits, ['Brave']);
    assert.equal(typeof t.attributes.strength, 'number');
});

test('an unresumable save reads as no save', () => {
    seedLegacy(STORAGE_KEYS.savedRun, legacySave({ tributes: [] }));
    assert.equal(readStored(SAVED_RUN_SPEC), null, 'castless save accepted');

    seedLegacy(STORAGE_KEYS.savedRun, legacySave({ arena: { name: 'Nowhere' } }));
    assert.equal(readStored(SAVED_RUN_SPEC), null, 'arenaless save accepted');

    seedLegacy(STORAGE_KEYS.savedRun, legacySave({ phase: 'ended' }));
    assert.equal(readStored(SAVED_RUN_SPEC), null, 'finished run offered for resume');
});

test('corrupt payloads degrade to no data and are cleaned up', () => {
    const specs: Array<StorageSpec<unknown>> = [
        SAVED_RUN_SPEC as StorageSpec<unknown>, HOF_SPEC as StorageSpec<unknown>,
        PANEM_SPEC as StorageSpec<unknown>, COINS_SPEC as StorageSpec<unknown>,
        FILTERS_SPEC as StorageSpec<unknown>, CONFIG_SPEC as StorageSpec<unknown>,
    ];
    // Truncated writes, non-JSON, empty strings and JSON nulls. (An object of
    // the wrong shape is a different case: each spec's migrate decides whether
    // it can be repaired, which the per-payload tests cover.)
    const junk = ['{"gameState":', 'undefined', '', '[[[[', 'null', ' '];
    specs.forEach(spec => {
        junk.forEach(bad => {
            raw().set(spec.key, bad);
            assert.doesNotThrow(() => readStored(spec), `${spec.key} threw on ${JSON.stringify(bad)}`);
            assert.equal(readStored(spec), null, `${spec.key} accepted ${JSON.stringify(bad)}`);
        });
    });
});

test('a payload from a newer build is left untouched', () => {
    raw().set(STORAGE_KEYS.savedRun, JSON.stringify({ v: 999, data: legacySave() }));
    assert.equal(readStored(SAVED_RUN_SPEC), null, 'future payload was read');
    assert.equal(envelopeVersion(STORAGE_KEYS.savedRun), 999, 'future payload was overwritten');
});

test('hungerGamesHoF is adopted as survivalGamesHallOfFame and retired', () => {
    seedLegacy('hungerGamesHoF', [
        { id: 'a', seed: 'S1', arenaName: 'Forest', winnerName: 'Katniss', winnerDistrict: 12, kills: 3, date: '2024-05-01T00:00:00.000Z' },
        { garbage: true },
    ]);
    const entries = readStored(HOF_SPEC);
    assert.equal(entries?.length, 1, 'legacy Hall of Fame lost');
    assert.equal(entries![0].winnerName, 'Katniss');
    assert.equal(raw().has('hungerGamesHoF'), false, 'old key not cleaned up');
    assert.equal(envelopeVersion(STORAGE_KEYS.hallOfFame), HOF_SPEC.version);
    // And it stays readable on the second load, from the new key alone.
    assert.equal(readStored(HOF_SPEC)?.length, 1);
});

test('capitolCoins is adopted as survivalGamesCoins and retired', () => {
    // The old wallet was a bare number string, not even JSON-object shaped.
    seedLegacy('capitolCoins', '4250');
    assert.equal(readCoins(), 4250, 'legacy balance lost');
    assert.equal(raw().has('capitolCoins'), false, 'old key not cleaned up');
    assert.equal(envelopeVersion(STORAGE_KEYS.coins), COINS_SPEC.version);
});

test('an absent or nonsense wallet falls back to the starting stake, not zero', () => {
    assert.equal(readCoins(), 1000);
    seedLegacy('capitolCoins', 'not-a-number');
    assert.equal(readCoins(), 1000);
    seedLegacy(STORAGE_KEYS.coins, '-40');
    assert.equal(readCoins(), 1000);
    // But a legitimately broke player stays broke.
    writeStored(COINS_SPEC, 0);
    assert.equal(readCoins(), 0);
});

test('v0 Panem keeps patronage and gamemaker records the old reader dropped', () => {
    seedLegacy(STORAGE_KEYS.panem, {
        runs: 7,
        victors: 5,
        unlocked: ['first-blood', 42],
        bests: { 'most-kills': { value: 6, name: 'Cato', district: 2, seed: 'S', arenaName: 'A', date: 'd' } },
        patronDistrict: 11,
        gamemakerRecords: { Seneca: { games: 3, victors: 2, totalDays: 21, deaths: 22 } },
    });
    const p = readStored(PANEM_SPEC)!;
    assert.equal(p.runs, 7);
    assert.deepEqual(p.unlocked, ['first-blood']);
    assert.equal(p.patronDistrict, 11, 'patronage silently dropped');
    assert.equal(p.gamemakerRecords?.Seneca.games, 3, 'gamemaker records silently dropped');
    assert.equal(p.bests['most-kills'].value, 6);
    assert.equal(envelopeVersion(STORAGE_KEYS.panem), PANEM_SPEC.version);
});

/*
 * AUDIT-6 §9.3: the whole-record round trip.
 *
 * `migrate` runs on every read and names the fields it keeps, so a field added
 * to `PanemRecords` and written by `commitRun` but not listed in the spec is
 * silently erased the first time the store is read back. That is precisely the
 * bug the spec's own v0 note records happening to `patronDistrict`, and it had
 * happened again to `recentRuns` — which two readers depend on, both of them
 * quietly wrong across a reload.
 *
 * Testing the fields one at a time cannot catch the next one, because the test
 * would have to be written by the same person who forgot the field. So this
 * asserts the general property instead: every key present on a written record
 * is still present, and equal, after a read.
 */
test('no field of a written Panem record is lost on a round trip', () => {
    const full: Record<string, unknown> = {
        runs: 12,
        victors: 9,
        unlocked: ['first-blood'],
        unlockedAt: { 'first-blood': { run: 3, date: 'd' } },
        bests: { 'most-kills': { value: 6, name: 'Cato', district: 2, seed: 'S', arenaName: 'A', date: 'd' } },
        gamemakerRecords: { Seneca: { games: 3, victors: 2, totalDays: 21, deaths: 22 } },
        patronDistrict: 11,
        patronDistricts: [11, 4],
        arenasBought: ['reef'],
        stipendsTaken: 2,
        dailyBests: { 'daily-1': { day: 9, deaths: 23, victorName: 'Rue', victorDistrict: 11, date: 'd' } },
        victorMentors: { 2: { name: 'Cato', archetype: 'career', run: 4 } },
        districtCrowns: { 11: { victories: 1, lastRun: 4, lastVictorName: 'Rue', lastDate: 'd' } },
        arenasWon: ['reef'],
        quellsSeen: ['the-reflection'],
        deathsSeen: ['bleeding'],
        eventsSeen: ['the-bell'],
        lawsWonUnder: ['openMic'],
        biomesWon: ['tundra'],
        muttsSeen: ['Tracker Jackers'],
        arenasSeen: ['reef'],
        patronWins: 2,
        lastVictorDistrict: 11,
        victorDistrictStreak: 2,
        headGamemakerTerm: { name: 'Seneca', runsServed: 2 },
        recentRuns: [{ seed: 'S1', arenaName: 'A', day: 9, victorName: 'Rue', victorDistrict: 11, victorArchetype: 'underdog', victorKills: 0, deaths: 23 }],
    };
    raw().set(STORAGE_KEYS.panem, JSON.stringify({ v: PANEM_SPEC.version, data: full }));
    const back = readStored(PANEM_SPEC)! as unknown as Record<string, unknown>;
    const lost = Object.keys(full).filter(k => back[k] === undefined);
    assert.deepEqual(lost, [], `Panem fields dropped by migrate: ${lost.join(', ')}`);
    Object.keys(full).forEach(k => {
        assert.deepEqual(back[k], full[k], `Panem field ${k} changed on a round trip`);
    });
});

test('feed filters and setup config round-trip and repair partial v0 data', () => {
    seedLegacy(STORAGE_KEYS.feedFilters, { mutedGroups: ['ambient', 7], importantOnly: 'yes' });
    const f = readStored(FILTERS_SPEC)!;
    assert.deepEqual(f.mutedGroups, ['ambient']);
    // Non-boolean legacy importantOnly reads as false → full density.
    assert.equal(f.density, 'everything');
    assert.equal(f.pauseOnDeath, false);

    // A v1 payload that had headline-only ON migrates to the headline tier.
    seedLegacy(STORAGE_KEYS.feedFilters, { mutedGroups: [], importantOnly: true, pauseOnDeath: true });
    const f2 = readStored(FILTERS_SPEC)!;
    assert.equal(f2.density, 'headlines', 'importantOnly=true not migrated to headlines density');
    assert.equal(f2.pauseOnDeath, true);

    seedLegacy(STORAGE_KEYS.lastConfig, { districtCount: 99, hazardRate: 2 });
    const c = readStored(CONFIG_SPEC)!;
    assert.equal(c.districtCount, 16, 'out-of-range district count accepted');
    assert.equal(c.hazardRate, 2);
    assert.equal(c.enableFeast, true, 'missing flag not defaulted');
});

test('every canonical key follows the survivalGames* convention', () => {
    Object.values(STORAGE_KEYS).forEach(key => {
        assert.ok(/^survivalGames[A-Z]/.test(key), `${key} is off-convention`);
    });
});

test('a resumed tribute keeps every archetype and every stance the data tables define', () => {
    // The allowlists used to be typed by hand and listed 7 of 15 archetypes
    // and 3 of 8 stances, so a Ghost came back a Wildcard and a Hunting
    // tribute came back Defensive on every resume.
    Object.keys(ARCHETYPE_DEFS).forEach(archetype => {
        const t = normalizeTribute({ id: 'x', name: 'X', archetype, stance: 'Defensive' })!;
        assert.equal(t.archetype, archetype, `archetype ${archetype} lost on resume`);
    });
    STANCES.forEach(stance => {
        const t = normalizeTribute({ id: 'x', name: 'X', archetype: 'career', stance })!;
        assert.equal(t.stance, stance, `stance ${stance} lost on resume`);
    });
});

/*
 * AUDIT-7 §1.2: the check that was missing while two normalisers deleted nine
 * fields between them.
 *
 * `normalizeConfig` used to be an object literal naming twelve of `GameConfig`'s
 * sixteen keys, and `hofStorage` carried a second copy naming seven. Everything
 * else here passed, because nothing asserted that a config survives a round
 * trip *whole* — only that individual named fields did. A field added to the
 * type and forgotten in a normaliser was invisible until somebody resumed a
 * one-victor run and got two victors.
 *
 * So the assertion is over `Object.keys` of a fully-populated config rather
 * than over a hand-written list: adding a field to `GameConfig` extends this
 * check automatically, and forgetting it in either path fails the build.
 */
const FULL_CONFIG: Required<GameConfig> = {
    districtCount: 10,
    hazardRate: 1.75,
    betrayalRate: 2,
    naturalDeathRate: 1.4,
    bloodbathDeathShare: 0.5,
    arenaDeathShare: 0.25,
    sponsorGenerosity: 0.5,
    enableFeast: false,
    enableSanity: false,
    sanityDrainRate: 2.25,
    sanityRecoveryRate: 0.5,
    enableHallucinations: false,
    enableBreakdowns: false,
    sanityStart: 55,
    plainNames: true,
    vanillaRules: true,
    singleVictor: true,
    ageMean: 15,
    ageSpread: 2.5,
};

test('CONFIG_KEYS covers every field on GameConfig', () => {
    // `Required<GameConfig>` above is the type-level half; this is the runtime
    // half, so a key present in the type and absent from the rules table is
    // caught even if a future `as` cast hides the compile error.
    const declared = Object.keys(FULL_CONFIG).sort();
    assert.deepEqual([...CONFIG_KEYS].sort(), declared,
        'CONFIG_KEYS and GameConfig have drifted apart');
});

test('a save slot round-trips every config field it was written with', () => {
    const saved = {
        gameState: {
            seed: 'ROUNDTRIP',
            arena: { id: 'frozen', zones: [{ name: 'The Cornucopia' }] },
            tributes: [{ id: 't1', name: 'Test' }],
            phase: 'day', day: 3, log: [], gamemakerMode: false,
            config: FULL_CONFIG, baseConfig: FULL_CONFIG,
        },
    };
    const out = SAVED_RUN_SPEC.migrate!(saved, 0) as { gameState: { config: GameConfig; baseConfig: GameConfig } } | null;
    assert.ok(out, 'a well-formed save was rejected');
    (Object.keys(FULL_CONFIG) as Array<keyof GameConfig>).forEach(key => {
        assert.equal(out!.gameState.baseConfig[key], FULL_CONFIG[key],
            `baseConfig.${key} did not survive a save-slot read`);
        assert.equal(out!.gameState.config[key], FULL_CONFIG[key],
            `config.${key} did not survive a save-slot read`);
    });
});

test('a Hall of Fame entry round-trips every config field it was archived with', () => {
    const entry = normalizeEntry({
        id: 'hof-roundtrip', seed: 'ROUNDTRIP', arenaName: 'The Frozen Wasteland',
        arenaId: 'frozen', quellId: null, winnerName: 'Test', winnerDistrict: 4,
        kills: 2, date: '2026-01-01', config: FULL_CONFIG,
    });
    assert.ok(entry?.config, 'an archived config was dropped entirely');
    (Object.keys(FULL_CONFIG) as Array<keyof GameConfig>).forEach(key => {
        assert.equal(entry!.config![key], FULL_CONFIG[key],
            `config.${key} did not survive a Hall of Fame read`);
    });
    // The replay fields themselves, which the same normaliser used to guard.
    assert.equal(entry!.arenaId, 'frozen');
    assert.equal(entry!.quellId, null, 'an explicit "no Quell" became "unknown"');
});

test('an unset age pair stays unset rather than being defaulted', () => {
    // Absent is a real and different state from any number: it means the canon
    // tesserae-weighted bowl. A normaliser that defaults it silently replaces
    // the draw that decides the whole cast.
    const bare = { ...DEFAULT_GAME_CONFIG };
    delete (bare as Partial<GameConfig>).ageMean;
    delete (bare as Partial<GameConfig>).ageSpread;
    const out = normalizeConfig(bare);
    assert.ok(!('ageMean' in out), 'ageMean was invented on read');
    assert.ok(!('ageSpread' in out), 'ageSpread was invented on read');
});

/*
 * AUDIT-7 §1.1: the Share URL is the other replay path, and it was dropping
 * five fields.
 *
 * `vanillaRules` went missing once, `singleVictor` and the age pair a second
 * time, and the five sanity dials a third — each found by somebody noticing a
 * link that did not replay, never by a check. The assertion below is over
 * `Object.keys(FULL_CONFIG)` rather than a hand-written list, so adding a field
 * to `GameConfig` extends it automatically.
 */
test('the Share URL carries every GameConfig field, or declares why not', () => {
    const params = shareParams({
        seed: 'SHARE', arenaId: 'frozen', gamemakerMode: false,
        config: FULL_CONFIG, quellId: null,
    });
    const missing = (Object.keys(FULL_CONFIG) as Array<keyof GameConfig>)
        .filter(key => !params.has(key) && !SHARE_OMITS.includes(key));
    assert.deepEqual(missing, [],
        `these settings change the run and are not in the share link: ${missing.join(', ')}`
        + ' — add them to shareParams() and to the parser in App.tsx, or name them in SHARE_OMITS with a reason');
});

test('a shared link round-trips every config field through the parser', () => {
    // Mirrors the parsing block in App.tsx. If the two drift, a link encodes a
    // setting nobody reads back, which is the same failure wearing a hat.
    const params = shareParams({
        seed: 'SHARE', arenaId: 'frozen', gamemakerMode: false,
        config: FULL_CONFIG, quellId: null,
    });
    const num = (key: keyof GameConfig) => Number(params.get(key));
    const bool = (key: keyof GameConfig) => params.get(key) === 'true';
    assert.equal(num('districtCount'), FULL_CONFIG.districtCount);
    assert.equal(num('hazardRate'), FULL_CONFIG.hazardRate);
    assert.equal(num('betrayalRate'), FULL_CONFIG.betrayalRate);
    assert.equal(num('sponsorGenerosity'), FULL_CONFIG.sponsorGenerosity);
    assert.equal(bool('enableFeast'), FULL_CONFIG.enableFeast);
    assert.equal(bool('enableSanity'), FULL_CONFIG.enableSanity);
    assert.equal(bool('plainNames'), FULL_CONFIG.plainNames);
    assert.equal(bool('vanillaRules'), FULL_CONFIG.vanillaRules);
    assert.equal(bool('singleVictor'), FULL_CONFIG.singleVictor);
    assert.equal(num('ageMean'), FULL_CONFIG.ageMean);
    assert.equal(num('ageSpread'), FULL_CONFIG.ageSpread);
    assert.equal(num('sanityDrainRate'), FULL_CONFIG.sanityDrainRate);
    assert.equal(num('sanityRecoveryRate'), FULL_CONFIG.sanityRecoveryRate);
    assert.equal(num('sanityStart'), FULL_CONFIG.sanityStart);
    assert.equal(bool('enableHallucinations'), FULL_CONFIG.enableHallucinations);
    assert.equal(bool('enableBreakdowns'), FULL_CONFIG.enableBreakdowns);
    // The absent age pair encodes as 'bowl', not as a number.
    const bowl = shareParams({
        seed: 'S', arenaId: 'frozen', gamemakerMode: false,
        config: { ...FULL_CONFIG, ageMean: undefined, ageSpread: undefined }, quellId: null,
    });
    assert.equal(bowl.get('ageMean'), 'bowl');
    assert.equal(bowl.get('ageSpread'), 'bowl');
});

test('config values out of range are clamped rather than trusted', () => {
    const hostile = normalizeConfig({
        ...FULL_CONFIG, districtCount: 999, hazardRate: 99, betrayalRate: -5,
        sponsorGenerosity: 99, sanityStart: 1, sanityDrainRate: 99, ageMean: 40, ageSpread: 99,
    });
    assert.equal(hostile.districtCount, 16);
    assert.equal(hostile.hazardRate, 2.5);
    assert.equal(hostile.betrayalRate, 0);
    assert.equal(hostile.sponsorGenerosity, 3);
    assert.equal(hostile.sanityStart, 40);
    assert.equal(hostile.sanityDrainRate, 2.5);
    assert.equal(hostile.ageMean, 18);
    assert.equal(hostile.ageSpread, 4);
});

console.log(failures === 0 ? '\nall storage migration checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
