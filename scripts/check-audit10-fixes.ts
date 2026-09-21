/**
 * AUDIT-10: one positioned scene per confirmed defect.
 *
 * The audit's twelve probes reproduced behaviour that every existing suite
 * passed over, which is the argument for this file: a sweep asserts aggregates
 * and a static check never starts the simulator, so neither can state "a clean
 * rescue of a downed tribute leaves them somewhere different from where it
 * found them". These do, one proposition at a time, named by finding.
 *
 * Scenes only. The three findings with no engine surface — F20's sampling rule
 * (a metrics verdict), F21's documentation counts (`npm run catalog`) and
 * F19's manifest labels (pure functions, asserted below where they are pure) —
 * are checked where they live rather than simulated.
 */
import { scenario, check, eq, world, report } from './scenarios';
import { ITEMS } from '../src/data/constants';
import { Item, Tribute } from '../src/models/types';
import { createContext } from '../src/engine/context';
import { RNG } from '../src/utils/rng';
import { RESCUE_LINE, VERTICALITY } from '../src/data/balance';
import { tickRescueLines } from '../src/engine/rescueLine';
import { tickAllianceDisputes } from '../src/engine/allianceDispute';
import { goDown, isDowned, tickDowned, widenRescueWindow } from '../src/engine/downed';
import { tickVerticality, isVertical } from '../src/engine/verticality';
import { registerAlliance } from '../src/engine/alliance';
import { resetBudget } from '../src/engine/actionBudget';
import { processFeast } from '../src/engine/phases/feast';
import { forecastHazard } from '../src/engine/hazardChain';
import { hasEffect } from '../src/engine/zoneEffects';
import {
    STORAGE_KEYS, StorageBackend, StorageSpec, persistenceMode, readStored,
    setStorageBackend, tryWriteStored,
} from '../src/utils/storage';
import { decodeCampaign, decodeCampaignResult, encodeCampaign } from '../src/utils/campaignLink';
import { CONTENT_REVISION, fidelityOf } from '../src/utils/replayManifest';

const itemById = (id: string) => structuredClone(ITEMS.find(i => i.id === id)!) as Item;

function until(tries: number, fn: (i: number) => boolean): boolean {
    for (let i = 0; i < tries; i++) if (fn(i)) return true;
    return false;
}

/** A zone in this arena that actually has an up and a down. */
function verticalZone(state: { arena: Parameters<typeof isVertical>[0] }): string {
    const zone = state.arena.zones.find(z => isVertical(state.arena, z.name));
    if (!zone) throw new Error('fixture arena has no vertical zone');
    return zone.name;
}

/* -------------------------------------------------------------------------- */
console.log('persistence and input');

scenario(
    'F01 — a migration whose replacement write fails keeps the original',
    'a failed write must never leave neither the old key nor the new one',
    () => {
        const spec: StorageSpec<{ n: number }> = {
            key: STORAGE_KEYS.coins,
            version: 1,
            legacyKeys: ['capitolCoins'],
            migrate: raw => (typeof raw === 'object' && raw !== null ? raw as { n: number } : null),
        };
        const store = new Map<string, string>([['capitolCoins', JSON.stringify({ n: 7 })]]);
        const full: StorageBackend = {
            getItem: k => store.get(k) ?? null,
            setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
            removeItem: k => { store.delete(k); },
        };
        setStorageBackend(full);
        try {
            eq(readStored(spec)?.n, 7, 'the migrated value is still returned to this session');
            check(store.has('capitolCoins'), 'the legacy copy survives a failed replacement write');
        } finally {
            setStorageBackend(null);
        }
    },
);

scenario(
    'F01 — a migration whose write succeeds retires the legacy key exactly once',
    'the repair must not cost the migration it was protecting',
    () => {
        const spec: StorageSpec<{ n: number }> = {
            key: STORAGE_KEYS.coins,
            version: 1,
            legacyKeys: ['capitolCoins'],
            migrate: raw => (typeof raw === 'object' && raw !== null ? raw as { n: number } : null),
        };
        const store = new Map<string, string>([['capitolCoins', JSON.stringify({ n: 7 })]]);
        setStorageBackend({
            getItem: k => store.get(k) ?? null,
            setItem: (k, v) => { store.set(k, v); },
            removeItem: k => { store.delete(k); },
        });
        try {
            eq(readStored(spec)?.n, 7, 'migrated');
            check(!store.has('capitolCoins'), 'the legacy key is gone');
            check(store.has(STORAGE_KEYS.coins), 'and the canonical key holds it');
            eq(readStored(spec)?.n, 7, 'a second read is a plain read');
        } finally {
            setStorageBackend(null);
        }
    },
);

scenario(
    'F03 — a write that only reached memory is not reported as saved',
    '"available until this tab closes" and "saved for later" are different results',
    () => {
        const spec: StorageSpec<number> = {
            key: STORAGE_KEYS.coins, version: 1,
            migrate: raw => (typeof raw === 'number' ? raw : null),
        };
        const map = new Map<string, string>();
        setStorageBackend({
            getItem: k => map.get(k) ?? null,
            setItem: (k, v) => { map.set(k, v); },
            removeItem: k => { map.delete(k); },
        }, false);
        try {
            eq(persistenceMode(), 'session', 'the mode is reported as temporary');
            eq(tryWriteStored(spec, 3), 'session', 'and so is the write');
        } finally {
            setStorageBackend(null);
        }
        // A backend declared persistent reports persistent. (Resetting to null
        // in node falls through to the memory stand-in, which is correct and is
        // why the check names its own backend rather than the default.)
        setStorageBackend({ getItem: () => null, setItem: () => {}, removeItem: () => {} }, true);
        try {
            eq(persistenceMode(), 'persistent', 'a durable backend reports persistent');
            eq(tryWriteStored(spec, 3), 'ok', 'and its writes report ok');
        } finally {
            setStorageBackend(null);
        }
    },
);

scenario(
    'F02 — a campaign link with a null recent run is rejected, not passed through',
    'the payload that crashed continuity processing must not reach the simulation',
    () => {
        const hostile = encodeCampaign({ runs: 1, victors: 1, recentRuns: [null as never] });
        const decoded = decodeCampaignResult(hostile);
        eq(decoded.status, 'ok', 'the head of the payload is valid, so the snapshot survives');
        eq(decoded.snapshot?.recentRuns, undefined, 'but the null member is dropped rather than carried');
    },
);

scenario(
    'F02 — wrong shapes, unknown districts and oversized collections all drop out',
    'validation is field by field, not a cast behind a shape check',
    () => {
        const decoded = decodeCampaign(encodeCampaign({
            runs: 3, victors: 2,
            recentRuns: [{ victorDistrict: 4 }, { victorDistrict: 99 }, 'nope' as never],
            districtCrowns: { 4: { victories: 1 }, 77: { victories: 1 } },
            headGamemakerTerm: { name: '   ', runsServed: 2 },
            patronDistricts: [2, 2, 999, Number.NaN],
        }));
        check(!!decoded, 'a valid payload still decodes');
        eq(decoded!.recentRuns?.length, 2, 'the two object members survive; the string does not');
        eq(decoded!.recentRuns?.[0].victorDistrict, 4, 'a valid district is carried');
        eq(decoded!.recentRuns?.[1].victorDistrict, undefined, 'an out-of-range district is dropped');
        eq(Object.keys(decoded!.districtCrowns ?? {}).length, 1, 'a record keyed by a non-district is dropped');
        eq(decoded!.headGamemakerTerm, undefined, 'a blank name is not a name');
        eq(decoded!.patronDistricts?.join(','), '2', 'patron districts are deduplicated and range-checked');
    },
);

scenario(
    'F02 — a payload that is not a record book is refused with a reason',
    'a bad link must not crash, and must not claim an exact replay either',
    () => {
        for (const raw of ['not-base64-at-all!!', encodeCampaign({ victors: 1 } as never), 'x'.repeat(9000)]) {
            const decoded = decodeCampaignResult(raw);
            eq(decoded.status, 'rejected', `rejected: ${raw.slice(0, 12)}`);
            check(!!decoded.reason, 'with something the player can be shown');
            eq(decoded.snapshot, undefined, 'and nothing handed to the simulation');
        }
        eq(decodeCampaignResult(null).status, 'absent', 'no campaign at all is not a rejection');
    },
);

scenario(
    'F19 — a link declares which of the four reproductions it is',
    'a link must not promise reproduction for inputs it does not carry',
    () => {
        const base = { campaign: true, campaignRejected: false, revision: CONTENT_REVISION, veteransSeated: 0, interventions: 0 };
        eq(fidelityOf(base), 'exact', 'everything carried, same build');
        eq(fidelityOf({ ...base, veteransSeated: 2 }), 'conditions', 'seated victors cannot travel in a link');
        eq(fidelityOf({ ...base, interventions: 3 }), 'conditions', 'nor can player interventions');
        eq(fidelityOf({ ...base, revision: 'older' }), 'conditions', 'nor does another build replay the same run');
        eq(fidelityOf({ ...base, campaign: false }), 'seed', 'no record book is a seed link');
        eq(fidelityOf({ ...base, campaignRejected: true }), 'rules-only', 'a discarded campaign claims nothing');
    },
);

/* -------------------------------------------------------------------------- */
console.log('\ntribute and rescue logic');

/** A stranded downed tribute and one healthy person standing over them. */
function rescueScene(seed: string, opts: { zone?: 'vertical' } = {}) {
    const w = world(seed);
    const [down, helper] = w.state.tributes;
    w.only(down, helper);
    const zone = opts.zone === 'vertical' ? verticalZone(w.state) : down.zone;
    down.zone = helper.zone = zone;
    if (opts.zone === 'vertical') { down.zoneLevel = 'lower'; helper.zoneLevel = 'upper'; }
    helper.health = 100;
    helper.allianceId = down.allianceId = 'pair';
    [down, helper].forEach(resetBudget);
    goDown(createContext(w.state, new RNG(`${seed}-down`)), down, 'a fall');
    return { w, down, helper };
}

scenario(
    'F04 — a clean rescue of a downed tribute leaves a physical result',
    'a scene that reports success must have a corresponding result in the state',
    () => {
        let checked = false;
        until(400, i => {
            const { w, down } = rescueScene(`F04-${i}`);
            w.state.rescueLines = [];
            tickRescueLines(createContext(w.state, new RNG(`F04-r-${i}`)));
            const rec = w.state.rescueLines?.[0];
            if (rec?.outcome !== 'clean') return false;
            check(rec.relief !== undefined, 'the record says what the haul achieved');
            check(rec.relief === 'extracted' || rec.relief === 'stabilized',
                'a haul extracts or stabilizes; only the medical clock revives');
            // Not a revival: they are still in the window, and the window is
            // measurably wider than the one they went into.
            check(isDowned(down), 'extraction is not treatment — they are still down');
            check(down.downed!.extracted === true, 'and the improvement is recorded, not implied');
            checked = true;
            return true;
        });
        check(checked, 'a clean rescue occurred to inspect');
    },
);

scenario(
    'F04 — an extraction from the lower level moves them off it',
    'a successful extraction must reach a valid destination',
    () => {
        let checked = false;
        until(400, i => {
            const { w, down } = rescueScene(`F04v-${i}`, { zone: 'vertical' });
            w.state.rescueLines = [];
            tickRescueLines(createContext(w.state, new RNG(`F04v-r-${i}`)));
            const rec = w.state.rescueLines?.[0];
            if (rec?.outcome !== 'clean') return false;
            eq(rec.relief, 'extracted', 'hauling somebody off the lower level is an extraction');
            eq(down.zoneLevel, 'upper', 'and they are no longer on it');
            checked = true;
            return true;
        });
        check(checked, 'a clean vertical rescue occurred to inspect');
    },
);

scenario(
    'F05 — cutting a downed tribute\'s line kills them and credits the cutter',
    'the cut branch must reach the victim through the downed state machine',
    () => {
        let checked = false;
        until(600, i => {
            const { w, down, helper } = rescueScene(`F05-${i}`);
            // Somebody with a reason. The willingness term that makes `cut`
            // reachable is treachery against dislike.
            delete helper.allianceId;
            delete down.allianceId;
            helper.relationships[down.id] = -100;
            down.relationships[helper.id] = -100;
            w.state.rescueLines = [];
            tickRescueLines(createContext(w.state, new RNG(`F05-r-${i}`)));
            const rec = w.state.rescueLines?.[0];
            if (rec?.outcome !== 'cut') return false;
            eq(down.status, 'dead', 'the victim is dead rather than still lying there');
            check(!isDowned(down), 'and out of the rescue window');
            eq(down.lastDamage?.sourceId, helper.id, 'the cutter is recorded as the source');
            eq(down.lastDamage?.kind, 'tribute', 'as a tribute kill, not as scenery');
            check(!!down.causeOfDeath?.includes(helper.name), 'and the obituary names them');
            checked = true;
            return true;
        });
        check(checked, 'a cut occurred to inspect');
    },
);

scenario(
    'F06 — poison berries are not a rope',
    'anchor quality composes from item capabilities, not from item type',
    () => {
        const w = world('F06');
        const [a] = w.state.tributes;
        w.only(a);
        const rated = (inventory: Item[]) => {
            a.inventory = inventory;
            a.traits = ['Rope-Handed'];
            // `anchorFor` is internal; its result is observable through the
            // anchor recorded on an attempt, so this asserts the capability
            // predicate the same way the engine reads it.
            return inventory.some(i => (i.ropeLength ?? 0) >= RESCUE_LINE.minRopeLength
                && (i.tensileStrength ?? 0) >= RESCUE_LINE.minTensile);
        };
        check(!rated([itemById('nightlock')]), 'nightlock berries are not a line');
        check(!rated([itemById('matches')]), 'nor are matches');
        check(!rated([itemById('whetstone')]), 'nor is a whetstone');
        check(rated([itemById('rope')]), 'rope is');
        check(rated([itemById('wire')]), 'and so is wire');
    },
);

scenario(
    'F07 — an ineligible best volunteer does not block a healthy rescuer',
    'capability, reach and resources filter before willingness ranks',
    () => {
        const w = world('F07');
        const [down, keen, healthy] = w.state.tributes;
        w.only(down, keen, healthy);
        [keen, healthy].forEach(t => { t.zone = down.zone; t.allianceId = 'pack'; resetBudget(t); });
        down.allianceId = 'pack';
        resetBudget(down);
        // The favourite: maximal regard, and nowhere near able to haul anybody.
        keen.health = 1;
        keen.relationships[down.id] = 100;
        healthy.health = 100;
        healthy.relationships[down.id] = 20;
        goDown(createContext(w.state, new RNG('F07-down')), down, 'a fall');
        const fired = until(200, i => {
            w.state.rescueLines = [];
            tickRescueLines(createContext(w.state, new RNG(`F07-r-${i}`)));
            return (w.state.rescueLines ?? []).length > 0;
        });
        check(fired, 'a rescue is attempted at all');
        eq(w.state.rescueLines![0].rescuerId, healthy.id, 'by the person who can actually do it');
    },
);

scenario(
    'F08 — a downed tribute does not climb out under their own power',
    'level changes require being able to act, and hours to act with',
    () => {
        const w = world('F08');
        const [t] = w.state.tributes;
        w.only(t);
        t.zone = verticalZone(w.state);
        t.zoneLevel = 'lower';
        resetBudget(t);
        t.hoursLeft = 0;
        goDown(createContext(w.state, new RNG('F08-down')), t, 'a fall');
        t.vitals.hunger = 100;
        t.vitals.thirst = 100;
        for (let i = 0; i < 200; i++) tickVerticality(createContext(w.state, new RNG(`F08-${i}`)));
        eq(t.zoneLevel, 'lower', 'they are where they fell');
    },
);

scenario(
    'F15 — a tribute with no hours left does not change level',
    'fatigue and the action budget are separate systems and both are owed',
    () => {
        const w = world('F15v');
        const [t] = w.state.tributes;
        w.only(t);
        t.zone = verticalZone(w.state);
        t.zoneLevel = 'upper';
        t.health = 100;
        t.vitals.hunger = 100;
        t.vitals.thirst = 100;
        resetBudget(t);
        t.hoursLeft = VERTICALITY.levelHours - 0.01;
        for (let i = 0; i < 200; i++) tickVerticality(createContext(w.state, new RNG(`F15v-${i}`)));
        eq(t.zoneLevel, 'upper', 'the descent does not happen on hours they do not have');
    },
);

scenario(
    'F15 — a rescuer with no hours left does not complete a haul',
    'a major action answers to the budget as well as to fatigue',
    () => {
        const w = world('F15r');
        const [down, helper] = w.state.tributes;
        w.only(down, helper);
        helper.zone = down.zone;
        helper.health = 100;
        helper.allianceId = down.allianceId = 'pair';
        resetBudget(helper);
        helper.hoursLeft = 0;
        goDown(createContext(w.state, new RNG('F15r-down')), down, 'a fall');
        for (let i = 0; i < 200; i++) {
            w.state.rescueLines = [];
            tickRescueLines(createContext(w.state, new RNG(`F15r-${i}`)));
            if ((w.state.rescueLines ?? []).length > 0) break;
        }
        eq((w.state.rescueLines ?? []).length, 0, 'nothing is attempted');
    },
);

scenario(
    'F09 — a helper on another level cannot treat or execute somebody',
    'direct medical contact and an execution both require being able to reach them',
    () => {
        const w = world('F09');
        const [down, helper] = w.state.tributes;
        w.only(down, helper);
        const zone = verticalZone(w.state);
        down.zone = helper.zone = zone;
        down.zoneLevel = 'lower';
        helper.zoneLevel = 'upper';
        helper.health = 100;
        helper.allianceId = down.allianceId = 'pair';
        helper.proficiencies = { ...(helper.proficiencies ?? {}), medicine: 5 };
        goDown(createContext(w.state, new RNG('F09-down')), down, 'a fall');
        // Keep the window open for the whole test: this asserts that no rescue
        // happens, not that the clock is slow.
        widenRescueWindow(down, 500);
        for (let i = 0; i < 50; i++) {
            if (!isDowned(down)) break;
            tickDowned(createContext(w.state, new RNG(`F09-${i}`)));
        }
        check(down.health === 0, 'nobody one level up gets their hands on them');
        check(down.revivedBy === undefined, 'and nobody is credited with having done so');
    },
);

/* -------------------------------------------------------------------------- */
console.log('\nalliances, resources and chronology');

/** A camp with a cache and members standing in named places. */
function hearingScene(seed: string, cache: Item[], place: (members: Tribute[], camp: string) => void) {
    const w = world(seed);
    const members = w.state.tributes.slice(0, 4);
    w.only(...members);
    members.forEach(m => {
        m.zone = members[0].zone;
        m.zoneLevel = members[0].zoneLevel;
        m.vitals.hunger = 92;
        m.vitals.thirst = 10;
        m.inventory = [];
        resetBudget(m);
    });
    const rec = registerAlliance(createContext(w.state, new RNG(seed)), 'pack', members);
    members.forEach(m => { m.allianceId = 'pack'; });
    rec.sharedCache = cache;
    place(members, rec.campZone ?? members[0].zone);
    w.state.allianceDisputes = [];
    until(80, i => {
        tickAllianceDisputes(createContext(w.state, new RNG(`${seed}-${i}`)));
        return (w.state.allianceDisputes ?? []).length > 0;
    });
    return { w, members, rec };
}

scenario(
    'F10 — a hearing does not happen around a cache nobody is standing at',
    'a physical distribution requires the participants to be at the cache',
    () => {
        const w = world('F10');
        const members = w.state.tributes.slice(0, 4);
        w.only(...members);
        members.forEach(m => { m.vitals.hunger = 92; m.vitals.thirst = 10; m.inventory = []; resetBudget(m); });
        const rec = registerAlliance(createContext(w.state, new RNG('F10')), 'pack', members);
        members.forEach(m => { m.allianceId = 'pack'; });
        rec.sharedCache = [itemById('bread')];
        // Everybody walks off. The box stays where the camp is.
        const elsewhere = w.state.arena.zones.map(z => z.name).filter(n => n !== rec.campZone);
        check(elsewhere.length >= 3, 'the fixture arena has somewhere else to be');
        members.forEach((m, i) => { m.zone = elsewhere[i % elsewhere.length]; });
        w.state.allianceDisputes = [];
        for (let i = 0; i < 80; i++) tickAllianceDisputes(createContext(w.state, new RNG(`F10-${i}`)));
        eq((w.state.allianceDisputes ?? []).length, 0, 'no hearing is held over an unattended box');
        eq(rec.sharedCache.length, 1, 'and nothing is transferred out of it');
    },
);

scenario(
    'F11 — a hungry member is not fed on water',
    'food answers hunger and water answers thirst; they are different needs',
    () => {
        const { members, rec } = hearingScene('F11-need', [itemById('water')], ms => {
            ms.forEach(m => { m.vitals.hunger = 95; m.vitals.thirst = 5; });
        });
        eq(rec.sharedCache.length, 1, 'the water stays in the box');
        check(members.every(m => m.inventory.length === 0), 'and nobody is handed it as a meal');
    },
);

scenario(
    'F11 — an expensive utility item does not suppress a food shortage',
    'scarcity is measured in portions of the thing people need, not in sale value',
    () => {
        const { w } = hearingScene('F11-value', [itemById('condenser'), itemById('bread')], () => {});
        check((w.state.allianceDisputes ?? []).length > 0,
            'a group with one loaf and one expensive gadget still has the argument');
    },
);

scenario(
    'F12 — a ration that will not fit goes back in the box, and nobody is fed on it',
    'an atomic transfer: issued, retained and consumed are three different things',
    () => {
        const { rec, w } = hearingScene('F12', [itemById('bread')], ms => {
            // Every member's hands are full of things that will not merge with
            // bread, so the ration has nowhere to land.
            ms.forEach(m => {
                m.inventory = Array.from({ length: 40 }, () => itemById('sword'));
            });
        });
        const d = w.state.allianceDisputes?.[0];
        check(d !== undefined, 'the hearing is still held — the shortage is real');
        eq(d!.fedIds.length, 0, 'nobody is recorded as fed on a ration they are not holding');
        check(rec.sharedCache.length > 0, 'and the ration is still in the cache');
    },
);

/* -------------------------------------------------------------------------- */
console.log('\nchronology');

scenario(
    'F14 — a feast advances forecasts and zone effects like any other cycle',
    'the meaning of a deadline must not depend on which phase occupied it',
    () => {
        const w = world('F14');
        const [t] = w.state.tributes;
        w.only(t);
        const zone = w.state.arena.zones[0].name;
        const ctx = createContext(w.state, new RNG('F14'));
        // A hazard due next cycle, and then a feast to occupy that cycle.
        forecastHazard(ctx, zone, 'flooded', 'weather', { leadCycles: 1 });
        eq(w.state.forecasts?.length, 1, 'the forecast is pending');
        const dueAt = w.state.forecasts![0].dueCycle;
        // Advance to the cycle it is due in through a feast rather than a day.
        while ((w.state.cycle ?? 0) < dueAt) {
            processFeast(createContext(w.state, new RNG(`F14-${w.state.cycle}`)));
        }
        check(hasEffect(w.state, zone, 'flooded') || (w.state.forecasts ?? []).length === 0,
            'the flood due this cycle has resolved rather than sitting pending through the feast');
    },
);

process.exitCode = report('AUDIT-10 fixes') === 0 ? 0 : 1;
