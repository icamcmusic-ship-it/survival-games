/**
 * AUDIT-10 batch 1 and 2: one failure fixture per repaired defect.
 *
 * The audit's own objection to the existing test roster is that a large
 * passing suite is not evidence about a specific defect: every check in this
 * repository is either an aggregate over random games or a static scan, and
 * neither can state "a supply promise handed across two levels of a shaft was
 * marked kept". So each scenario below is the *reproduction* from the audit,
 * turned around: it puts the world in the position that produced the wrong
 * answer and asserts the right one.
 *
 * A scenario here failing means a specific sentence in section 2 of the audit
 * has come back.
 */
import { scenario, check, eq, world, report } from './scenarios';
import { ITEMS, ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { Item } from '../src/models/types';
import { createContext } from '../src/engine/context';
import { RNG } from '../src/utils/rng';
import { work, progressOf, resetBudget } from '../src/engine/actionBudget';
import { giveItem } from '../src/engine/items';
import { tickObligations } from '../src/engine/obligations';
import { samePlace } from '../src/engine/verticality';
import { pickTerrainEvent, pendingChain } from '../src/engine/encounters';
import { allNotables, bloodbathDeathCount, runNotables, victorsOf } from '../src/utils/notables';
import { chronicleMarkdown, chronicleText, chronicleProse, arenaTitle, outcomeOf } from '../src/utils/chronicle';
import { EMPTY_PANEM } from '../src/utils/panemStorage';
import { ACHIEVEMENTS } from '../src/data/achievements';
import { recordAllianceState } from '../src/engine/alliance';

const food = () => structuredClone(ITEMS.find(i => i.type === 'food')!) as Item;

console.log('B01/B02 — the bloodbath is a phase, not day zero');

scenario(
    'horn deaths are counted by the phase flag, not by day 0',
    'B01: `dayOfDeath === 0` is unsatisfiable — startGames() sets day = 1 before the bloodbath runs',
    () => {
        const w = world('A10-B01');
        w.state.tributes.forEach((t, i) => {
            if (i >= 8) return;
            t.status = 'dead';
            t.dayOfDeath = 1;
            t.diedInBloodbath = i < 5;
        });
        eq(bloodbathDeathCount(w.state), 5, 'five went down at the horn');
        const notes = runNotables(w.state, EMPTY_PANEM).map(n => n.text);
        check(!notes.some(n => n.includes('nobody died at the Cornucopia')),
            'and the summary does not report a massacre as a quiet opening');
    },
);

scenario(
    'a genuinely bloodless horn still reads as one',
    'B01: the repair must not simply suppress the line',
    () => {
        const w = world('A10-B01b');
        w.state.tributes.forEach((t, i) => {
            if (i >= 3) return;
            t.status = 'dead'; t.dayOfDeath = 1; t.diedInBloodbath = false;
        });
        eq(bloodbathDeathCount(w.state), 0, 'nobody died at the horn');
        const notes = runNotables(w.state, EMPTY_PANEM).map(n => n.text);
        check(!notes.some(n => n.includes('Only nobody')), 'and it is not phrased "Only nobody"');
    },
);

scenario(
    'a record with no phase evidence reports unknown rather than zero',
    'B01: missing historical data must not become a confident zero',
    () => {
        const w = world('A10-B01c');
        w.state.tributes.forEach((t, i) => {
            if (i >= 6) return;
            t.status = 'dead'; t.dayOfDeath = 1; t.diedInBloodbath = undefined;
        });
        eq(bloodbathDeathCount(w.state), undefined, 'the count is not reconstructible');
        const notes = runNotables(w.state, EMPTY_PANEM).map(n => n.text);
        check(!notes.some(n => n.includes('at the Cornucopia')), 'so the line is omitted entirely');
    },
);

scenario(
    'a favourite lost at the horn is found',
    'B02: the early-favourite highlight had the same day-zero mistake',
    () => {
        const w = world('A10-B02');
        const t = w.tribute(0);
        t.fanFavourite = true;
        t.status = 'dead'; t.dayOfDeath = 1; t.diedInBloodbath = true;
        const notes = allNotables(w.state, EMPTY_PANEM).map(n => n.text);
        check(notes.some(n => n.includes(`${t.name} was supposed to be this year's story`)),
            'the Capitol lost its favourite at the horn and the summary says so');
    },
);

console.log('B03 — one idea, one achievement');

scenario(
    'the horn achievement and the opening-day achievement measure what they claim',
    'B03: two entries advertised the same condition and tested different things',
    () => {
        const w = world('A10-B03');
        w.state.tributes.forEach((t, i) => {
            t.status = i < 12 ? 'dead' : 'alive';
            t.dayOfDeath = i < 12 ? 1 : undefined;
            t.diedInBloodbath = i < 3;
        });
        const victor = w.state.tributes.find(t => t.status === 'alive');
        const test = (id: string) => ACHIEVEMENTS.find(a => a.id === id)!.test(w.state, victor);
        const horn = ACHIEVEMENTS.find(a => a.id === 'a7-half-at-the-horn')!;
        const day = ACHIEVEMENTS.find(a => a.id === 'bloodbath-massacre')!;
        check(!test('a7-half-at-the-horn'), '3 of 24 at the horn is not half the field at the horn');
        check(test('bloodbath-massacre'), '12 of 24 on the opening day is half the field on the opening day');
        check(horn.hint !== day.hint, 'and the two no longer advertise the same condition');
        check(day.hint.includes('first night'), 'the day one card says so in its hint');
    },
);

console.log('B04/B07/B08 — who actually won');

scenario(
    'a dual win names both winners in every export',
    'B07: the exports read the first living row of the cast and named one of two',
    () => {
        const w = world('A10-B07');
        const [a, b] = w.state.tributes;
        w.state.tributes.forEach(t => { t.status = 'dead'; t.dayOfDeath = 3; });
        a.status = 'alive'; b.status = 'alive';
        w.state.phase = 'ended';
        w.state.victorIds = [a.id, b.id];
        eq(victorsOf(w.state).length, 2, 'the run crowned two people');
        [chronicleMarkdown(w.state), chronicleText(w.state, false, 'text'), chronicleText(w.state, false, 'bbcode'), chronicleProse(w.state)]
            .forEach((out, i) => {
                check(out.includes(a.name) && out.includes(b.name), `export ${i} names both winners`);
            });
    },
);

scenario(
    'an unfinished run does not crown anybody',
    'B07: a setup-time export named a victor',
    () => {
        const w = world('A10-B07b');
        check(!outcomeOf(w.state).finished, 'the run has not ended');
        eq(outcomeOf(w.state).winners.length, 0, 'so nobody has won');
        check(chronicleMarkdown(w.state).includes('in progress'), 'and the export says so');
        check(!chronicleMarkdown(w.state).includes('**Victor:**'), 'rather than crowning the first row of the cast');
    },
);

scenario(
    'an arena whose name carries the article is not doubled',
    'B07: "The The Vault Games"',
    () => {
        const w = world('A10-B07c');
        w.state.arena = { ...w.state.arena, name: 'The Vault' };
        eq(arenaTitle(w.state), 'The Vault Games', 'one article');
        check(!chronicleMarkdown(w.state).includes('The The'), 'and no export doubles it');
    },
);

scenario(
    'a surviving partner is not reported dead',
    'B04: isStarCrossed(victor) was treated as proof the partner died',
    () => {
        const w = world('A10-B04');
        const [a, b] = w.state.tributes;
        w.state.tributes.forEach(t => { t.status = 'dead'; });
        a.status = 'alive'; b.status = 'alive';
        a.traits = [...a.traits.filter(x => x !== 'Star-Crossed'), 'Star-Crossed'];
        b.traits = [...b.traits.filter(x => x !== 'Star-Crossed'), 'Star-Crossed'];
        a.allianceId = b.allianceId = `lovers-${a.id}-${b.id}`;
        w.state.phase = 'ended';
        w.state.victorIds = [a.id, b.id];
        const notes = runNotables(w.state, EMPTY_PANEM).map(n => n.text);
        check(!notes.some(n => n.includes('came out of them alone')),
            'neither of them came out alone; they both came out');
    },
);

console.log('B05 — a historical claim reads a historical record');

scenario(
    'the largest pack is remembered after it comes apart',
    'B05: the notable read the live alliance registry, which is empty at the end',
    () => {
        const w = world('A10-B05');
        const members = w.state.tributes.slice(0, 6);
        recordAllianceState(w.state, {
            id: 'pack', leaderId: members[0].id, memberIds: members.map(m => m.id),
            formedCycle: 1, sharedCache: [], pact: { kind: 'no-pact' },
        } as never);
        w.state.alliances = {};
        w.state.cycle = 5; w.state.day = 5;
        eq(w.state.allianceChronicle?.[0].peakSize, 6, 'the chronicle kept the peak');
        const notes = allNotables(w.state, EMPTY_PANEM).map(n => n.text);
        check(notes.some(n => n.includes('6')), 'and the summary can still say how big it got');
    },
);

console.log('B06 — an oath is not a hunt');

scenario(
    'swearing vengeance is not reported as having carried it out',
    'B06: the detector matched the oath prose and claimed the pursuit',
    () => {
        const w = world('A10-B06');
        const t = w.tribute(0);
        w.state.log.push({
            id: 'oath', day: 2, phase: 'day', category: 'sanity', type: 'vengeance-sworn',
            important: true, tributesInvolved: [t.id], text: 'VENGEANCE: they will find them.',
        } as never);
        const notes = allNotables(w.state, EMPTY_PANEM).map(n => n.text);
        check(!notes.some(n => n.includes('went and found the specific person')),
            'nobody found anybody; somebody said they would');
        w.state.log.push({
            id: 'paid', day: 4, phase: 'day', category: 'alliance', type: 'vengeance-paid',
            important: true, tributesInvolved: [t.id], text: 'It is paid.',
        } as never);
        check(allNotables(w.state, EMPTY_PANEM).map(n => n.text).some(n => n.includes('went and found the specific person')),
            'and when it is actually paid, the line fires');
    },
);

console.log('B10/B11 — a job has a place and a non-negative remainder');

scenario(
    'a fixed job does not finish somewhere else',
    'B10: two hours of shelter on one ridge plus one hour elsewhere built a shelter wherever you stood',
    () => {
        const w = world('A10-B10');
        const t = w.tribute(0);
        resetBudget(t);
        t.hoursLeft = 2;
        check(!work(t, 'shelter', 3), 'two hours into a three-hour shelter is not a shelter');
        t.zone = w.state.arena.zones[1].name;
        t.hoursLeft = 1;
        check(!work(t, 'shelter', 3), 'and the third hour, somewhere else, starts a new one');
        eq(progressOf(t, 'shelter', 3), 1 / 3, 'with one hour into it, here');
    },
);

scenario(
    'work resumes where it was left',
    'B10: the repair must not make partial work impossible to finish',
    () => {
        const w = world('A10-B10b');
        const t = w.tribute(0);
        resetBudget(t);
        t.hoursLeft = 2;
        check(!work(t, 'shelter', 3), 'two of three');
        t.hoursLeft = 1;
        check(work(t, 'shelter', 3), 'and the third hour, at the same site, finishes it');
        eq(t.partialWork, undefined, 'and the job is closed out');
    },
);

scenario(
    'a job whose cost drops below the work already done finishes',
    'B11: resuming three completed hours against a two-hour total called spendUpTo(-1)',
    () => {
        const w = world('A10-B11');
        const t = w.tribute(0);
        resetBudget(t);
        t.partialWork = { kind: 'mitigate:burning', hoursDone: 3, site: { zone: t.zone, level: t.zoneLevel } };
        t.hoursLeft = 1;
        check(work(t, 'mitigate:burning', 2), 'three hours of work satisfies a two-hour requirement');
        eq(t.hoursLeft, 1, 'and no time is handed back');
        eq(t.partialWork, undefined, 'and nothing is left in progress');
    },
);

console.log('B12/B13 — a promise is kept in person, and a transfer can fail');

scenario(
    'a supply promise is not kept across two levels of a shaft',
    'B12: zone equality said together where samePlace() says a climb apart',
    () => {
        const w = world('A10-B12');
        const [a, b] = w.state.tributes;
        w.only(a, b);
        const zone = w.state.arena.zones[0];
        zone.features = { ...zone.features, vertical: true };
        a.zone = b.zone = zone.name;
        a.zoneLevel = 'upper'; b.zoneLevel = 'lower';
        a.inventory = [food()];
        b.inventory = []; b.vitals.hunger = 100; b.health = 100;
        w.state.obligations = [{ id: 'p', owedById: a.id, owedToId: b.id, kind: 'supply', byCycle: 99, status: 'open' as const }];
        check(!samePlace(w.state.arena, a, b), 'they are not in the same place');
        tickObligations(createContext(w.state, new RNG('A10-B12')));
        eq(w.state.obligations![0].status, 'open', 'so the promise is not discharged');
        eq(b.inventory.length, 0, 'and nothing teleported down the shaft');
    },
);

scenario(
    'the same promise is kept once they are actually together',
    'B12: the repair must not make vertical promises unkeepable',
    () => {
        const w = world('A10-B12b');
        const [a, b] = w.state.tributes;
        w.only(a, b);
        const zone = w.state.arena.zones[0];
        zone.features = { ...zone.features, vertical: true };
        a.zone = b.zone = zone.name;
        a.zoneLevel = b.zoneLevel = 'lower';
        a.inventory = [food()];
        b.inventory = []; b.vitals.hunger = 100; b.health = 100;
        w.state.obligations = [{ id: 'p', owedById: a.id, owedToId: b.id, kind: 'supply', byCycle: 99, status: 'open' as const }];
        tickObligations(createContext(w.state, new RNG('A10-B12b')));
        eq(w.state.obligations![0].status, 'kept', 'standing next to them, it is kept');
        eq(b.inventory.length, 1, 'and the food actually changed hands');
    },
);

console.log('B14 — freshness is conserved');

scenario(
    'old bread does not become fresh by being merged into a fresh stack',
    'B14: giveItem merged by item id alone, and a stack carries one spoilage',
    () => {
        const w = world('A10-B14');
        const t = w.tribute(0);
        t.inventory = [{ ...food(), stack: 1, spoilage: 1 }];
        giveItem(t, { ...food(), stack: 1, spoilage: 9 });
        const units = t.inventory.filter(i => i.type === 'food').reduce((n, i) => n + (i.stack ?? 1), 0);
        eq(units, 2, 'two loaves, still');
        check(t.inventory.some(i => (i.spoilage ?? 0) >= 9), 'and the old one is still old');
    },
);

scenario(
    'the reverse order gives the same answer',
    'B14: arrival order decided whether food gained or lost life',
    () => {
        const w = world('A10-B14b');
        const t = w.tribute(0);
        t.inventory = [{ ...food(), stack: 1, spoilage: 9 }];
        giveItem(t, { ...food(), stack: 1, spoilage: 1 });
        const units = t.inventory.filter(i => i.type === 'food').reduce((n, i) => n + (i.stack ?? 1), 0);
        eq(units, 2, 'two loaves either way');
        check(t.inventory.some(i => (i.spoilage ?? 0) >= 9), 'and the old one is still old either way');
    },
);

scenario(
    'identical fresh batches still stack',
    'B14: the repair must not shatter the inventory into a slot per unit',
    () => {
        const w = world('A10-B14c');
        const t = w.tribute(0);
        t.inventory = [{ ...food(), stack: 1, spoilage: 0 }];
        giveItem(t, { ...food(), stack: 1, spoilage: 0 });
        eq(t.inventory.filter(i => i.type === 'food').length, 1, 'one stack of two');
    },
);

console.log('B15 — a hard requirement is not a preference');

scenario(
    'an event requiring a kit is not handed to an empty pack',
    'B15: the selector restored the events it had just excluded when none passed',
    () => {
        const w = world('A10-B15');
        const t = w.tribute(0);
        t.inventory = [];
        const ctx = createContext(w.state, new RNG('A10-B15'));
        const event = { id: 'fixture-medical', text: 'x', escapeText: 'y', cause: 'fixture', requires: { carrying: 'medical' as const } };
        eq(pickTerrainEvent(ctx, [event], undefined, t), undefined, 'nothing is eligible, so nothing is selected');
    },
);

scenario(
    'a once-per-run event does not get a second turn',
    'B15: an exhausted pool was restored whole',
    () => {
        const w = world('A10-B15b');
        const t = w.tribute(0);
        const ctx = createContext(w.state, new RNG('A10-B15b'));
        const once = { id: 'fixture-once', text: 'x', escapeText: 'y', cause: 'fixture', oncePerRun: true };
        w.state.firedEvents = ['fixture-once'];
        eq(pickTerrainEvent(ctx, [once], undefined, t), undefined, 'the bell does not fall twice');
    },
);

scenario(
    'an eligible event is still selected',
    'B15: the repair must not make authored events unreachable',
    () => {
        const w = world('A10-B15c');
        const t = w.tribute(0);
        const ctx = createContext(w.state, new RNG('A10-B15c'));
        const ok = { id: 'fixture-open', text: 'x', escapeText: 'y', cause: 'fixture' };
        eq(pickTerrainEvent(ctx, [ok], undefined, t)?.id, 'fixture-open', 'an event with no gates fires');
    },
);

scenario(
    'a queued chain is revalidated when it lands',
    'B15: pendingChain did not recheck current requirements',
    () => {
        const w = world('A10-B15d');
        const t = w.tribute(0);
        t.inventory = [];
        const ctx = createContext(w.state, new RNG('A10-B15d'));
        const event = { id: 'fixture-chain', text: 'x', escapeText: 'y', cause: 'fixture', requires: { carrying: 'medical' as const } };
        w.state.eventChains = { [t.id]: 'fixture-chain' };
        eq(pendingChain(ctx, t, [event]), undefined, 'the second half no longer applies, so it does not fire');
    },
);

process.exit(report('AUDIT-10 batch 1 and 2 fixtures') ? 1 : 0);
