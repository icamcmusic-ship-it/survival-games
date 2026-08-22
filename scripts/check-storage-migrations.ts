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
import { SAVED_RUN_SPEC, normalizeTribute } from '../src/utils/saveMigrations';
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
    assert.equal(c.districtCount, 12, 'out-of-range district count accepted');
    assert.equal(c.hazardRate, 2);
    assert.equal(c.enableFeast, true, 'missing flag not defaulted');
});

test('every canonical key follows the survivalGames* convention', () => {
    Object.values(STORAGE_KEYS).forEach(key => {
        assert.ok(/^survivalGames[A-Z]/.test(key), `${key} is off-convention`);
    });
});

console.log(failures === 0 ? '\nall storage migration checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
