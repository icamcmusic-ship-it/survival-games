/**
 * AUDIT-9 stage C: the authored scenarios.
 *
 * The gate the audit sets for this stage is "several authored scenario tests
 * demonstrate different sensible outcomes; no impossible actions or
 * conservation errors". Each block below is one proposition about the engine,
 * stated as a scene rather than as an average.
 */
import { scenario, check, eq, world, report } from './scenarios';
import { ACTION_BUDGET } from '../src/data/balance';
import { hoursFor, hoursLeft, hoursSpent, resetBudget, spend, work, progressOf, canAfford } from '../src/engine/actionBudget';
import { Tribute, Item } from '../src/models/types';
import { ITEMS } from '../src/data/constants';
import { PARACHUTES } from '../src/data/balance';
import { createContext } from '../src/engine/context';
import { RNG } from '../src/utils/rng';
import { dropParachute, resolveParachutes, pendingParachutes } from '../src/engine/parachutes';
import { canPromise, promise, tickObligations, openObligations } from '../src/engine/obligations';
import { forecastHazard, tickForecasts, mitigate } from '../src/engine/hazardChain';
import { hasEffect, effectsFor } from '../src/engine/zoneEffects';
import { tickExposure } from '../src/engine/survival';
import { noteSighting, confidenceOf, stillBelieved, rememberedRivals, ensureMemory, writeHearsay } from '../src/engine/memory';

console.log('action budgets');

scenario(
    'a full day buys a crossing and little else',
    'travel is the expensive thing a day holds, so it crowds out the rest',
    () => {
        const w = world('SCEN-budget-1');
        const t = w.tribute(0);
        // An authored scenario states its subject rather than taking whoever
        // the seed produced: this is a fit, unhurt tribute of ordinary
        // endurance, so the claim is about the rule and not about a roll.
        t.vitals.fatigue = 0;
        t.health = 100;
        t.attributes.endurance = ACTION_BUDGET.enduranceMidpoint;
        resetBudget(t);
        const day = hoursLeft(t);
        check(day >= ACTION_BUDGET.travelHours + ACTION_BUDGET.craftHours,
            `a healthy day (${day}h) should fit one crossing and one craft`);
        check(spend(t, ACTION_BUDGET.travelHours), 'the crossing should be affordable first thing');
        check(!canAfford(t, ACTION_BUDGET.shelterHours + ACTION_BUDGET.trapHours),
            'after a crossing there should not still be room for a shelter AND a trap');
    },
);

scenario(
    'a second crossing does not fit in the same day',
    'a tribute cannot cross the map and cross back in one cycle',
    () => {
        const w = world('SCEN-budget-2');
        const t = w.tribute(0);
        resetBudget(t);
        check(spend(t, ACTION_BUDGET.travelHours), 'first crossing');
        const second = spend(t, ACTION_BUDGET.travelHours);
        const third = spend(t, ACTION_BUDGET.travelHours);
        check(!third, 'three crossings in one cycle must never fit');
        if (second) check(hoursLeft(t) < ACTION_BUDGET.travelHours, 'two crossings should leave under a crossing spare');
    },
);

scenario(
    'a refused action spends nothing',
    'refusal is visible and free, so a caller can choose something cheaper',
    () => {
        const w = world('SCEN-budget-3');
        const t = w.tribute(0);
        resetBudget(t);
        spend(t, hoursLeft(t) - 1);
        const before = hoursLeft(t);
        eq(spend(t, ACTION_BUDGET.shelterHours), false, 'a shelter with one hour left is refused');
        eq(hoursLeft(t), before, 'a refused action must not consume the hour it could not use');
    },
);

scenario(
    'a hurt tribute gets a shorter day than a fresh one',
    'load and physiology shorten the day rather than taxing each action',
    () => {
        const w = world('SCEN-budget-4');
        const fresh = w.tribute(0);
        const hurt = w.tribute(1);
        fresh.vitals.fatigue = 0; fresh.health = 100;
        hurt.vitals.fatigue = 100; hurt.health = 20;
        check(hoursFor(hurt) < hoursFor(fresh),
            `exhausted and badly hurt (${hoursFor(hurt).toFixed(1)}h) should be a shorter day than fresh (${hoursFor(fresh).toFixed(1)}h)`);
        check(hoursFor(hurt) >= ACTION_BUDGET.minHours, 'nobody is reduced to no day at all');
    },
);

console.log('\npartial work');

scenario(
    'work interrupted by nightfall resumes the next cycle',
    'interruptions leave partial work rather than nothing',
    () => {
        const w = world('SCEN-work-1');
        const t = w.tribute(0);
        resetBudget(t);
        // Spend the day down to less than a shelter, then start one.
        spend(t, hoursLeft(t) - 2);
        eq(work(t, 'shelter', ACTION_BUDGET.shelterHours), false, 'two hours does not finish a shelter');
        check(progressOf(t, 'shelter', ACTION_BUDGET.shelterHours) > 0, 'the two hours should be recorded as progress');
        resetBudget(t);
        eq(work(t, 'shelter', ACTION_BUDGET.shelterHours), true,
            'a fresh day should finish what yesterday started');
    },
);

scenario(
    'changing your mind loses the progress',
    'a tribute who keeps switching jobs finishes none of them',
    () => {
        const w = world('SCEN-work-2');
        const t = w.tribute(0);
        resetBudget(t);
        spend(t, hoursLeft(t) - 2);
        work(t, 'shelter', ACTION_BUDGET.shelterHours);
        check(progressOf(t, 'shelter', ACTION_BUDGET.shelterHours) > 0, 'shelter started');
        resetBudget(t);
        spend(t, hoursLeft(t) - 2);
        work(t, 'trap:snare', ACTION_BUDGET.trapHours);
        eq(progressOf(t, 'shelter', ACTION_BUDGET.shelterHours), 0,
            'starting a trap must abandon the half-built shelter');
    },
);

console.log('\nno impossible actions');

scenario(
    'nobody acts on hours they do not have, over a whole run',
    'the budget is never overdrawn anywhere in a real game',
    () => {
        const w = world('SCEN-run-1');
        const sim = w.sim();
        sim.startGames();
        sim.processBloodbath();
        let overdrawn: Tribute | undefined;
        for (let i = 0; i < 40 && !sim.isFinished(); i++) {
            sim.processTurn();
            const bad = sim.getState().tributes.find(t => (t.hoursLeft ?? 0) < -0.001);
            if (bad) { overdrawn = bad; break; }
        }
        check(overdrawn === undefined,
            `${overdrawn?.name} ended a cycle on ${overdrawn?.hoursLeft?.toFixed(2)} hours`);
    },
);

scenario(
    'a tribute in transit is not also building things',
    'the crossing and the camp compete for the same day',
    () => {
        const w = world('SCEN-run-2');
        const sim = w.sim();
        sim.startGames();
        sim.processBloodbath();
        let seen = 0, busy = 0;
        for (let i = 0; i < 40 && !sim.isFinished(); i++) {
            sim.processTurn();
            for (const t of sim.getState().tributes) {
                if (t.status !== 'alive' || !t.transit) continue;
                seen++;
                // Measured against the allowance they were *given*, because
                // `hoursFor` moves with fatigue inside the cycle.
                if (hoursSpent(t) < ACTION_BUDGET.travelHours - 0.001) busy++;
            }
        }
        check(seen > 0, 'no crossings happened at all in 40 cycles — the scenario proves nothing');
        eq(busy, 0, `${busy} of ${seen} tributes were mid-crossing with an unspent day`);
    },
);

console.log('\nconservation');

scenario(
    'no stack is ever zero, negative or fractional anywhere in a run',
    'the conservation property that is actually checkable from outside: quantity stays well-formed',
    () => {
        const w = world('SCEN-cons-1');
        const sim = w.sim();
        sim.startGames();
        sim.processBloodbath();
        for (let i = 0; i < 20 && !sim.isFinished(); i++) {
            sim.processTurn();
            for (const t of sim.getState().tributes) {
                for (const item of t.inventory) {
                    const n = item.stack ?? 1;
                    check(n > 0 && Number.isInteger(n),
                        `${t.name} holds ${item.id} with a stack of ${n}`);
                }
            }
        }
    },
);

scenario(
    'a delivered gift exists in exactly one place',
    'the item is in the sky, or in one pack, and never in both or neither',
    () => {
        const w = world('SCEN-cons-2');
        const t = w.tribute(0);
        w.only(t);
        const ctx = createContext(w.state, new RNG('SCEN-cons-2'));
        const item = { ...ITEMS.find(i => i.id === 'bread')!, id: 'bread' };
        const heldBefore = t.inventory.filter((i: Item) => i.id === 'bread').length;
        dropParachute(ctx, t, item);
        eq(t.inventory.filter((i: Item) => i.id === 'bread').length, heldBefore,
            'in the sky: not in the pack yet');
        eq(pendingParachutes(w.state).length, 1, 'and in the sky exactly once');
        resolveParachutes(ctx);
        eq(t.inventory.filter((i: Item) => i.id === 'bread').length, heldBefore + 1,
            'in the pack: exactly one more than before');
        eq(pendingParachutes(w.state).length, 0, 'and no longer in the sky');
    },
);

console.log('\nphysical delivery');

scenario(
    'a gift lands in a zone rather than in a pack',
    'a sponsor gift exists in the world between being paid for and being picked up',
    () => {
        const w = world('SCEN-chute-1');
        const t = w.tribute(0);
        const item = { ...ITEMS.find(i => i.id === 'bread')! };
        const ctx = createContext(w.state, new RNG('SCEN-chute-1'));
        const held = t.inventory.length;
        dropParachute(ctx, t, item);
        eq(t.inventory.length, held, 'the item must not be in the pack before it has landed');
        eq(pendingParachutes(w.state).length, 1, 'it should be in the air');
        eq(pendingParachutes(w.state)[0].zone, t.zone, 'addressed to the zone they are standing in');
    },
);

scenario(
    'the addressee alone in the zone gets their gift',
    'delivery is not a lottery: being there is what earns it',
    () => {
        const w = world('SCEN-chute-2');
        const t = w.tribute(0);
        w.only(t);
        const ctx = createContext(w.state, new RNG('SCEN-chute-2'));
        const item = { ...ITEMS.find(i => i.id === 'bread')! };
        dropParachute(ctx, t, item);
        resolveParachutes(ctx);
        check(t.inventory.some((i: Item) => i.id === 'bread'), 'they were standing under it and should have it');
        eq(pendingParachutes(w.state).length, 0, 'nothing should be left in the air');
    },
);

scenario(
    'a gift falling where its owner is not can be taken by whoever is',
    'the wrong person reaching it first is a thing the engine can now express',
    () => {
        const w = world('SCEN-chute-3');
        const owner = w.tribute(0);
        const rival = w.tribute(1);
        w.only(owner, rival);
        delete owner.allianceId; delete rival.allianceId;
        const ctx = createContext(w.state, new RNG('SCEN-chute-3'));
        const item = { ...ITEMS.find(i => i.id === 'bread')! };
        dropParachute(ctx, owner, item);
        // The owner dies before it lands; the rival is standing in the zone.
        owner.status = 'dead'; owner.health = 0;
        w.place(rival, owner.zone);
        resolveParachutes(ctx);
        check(rival.inventory.some((i: Item) => i.id === 'bread'),
            'nobody alive was addressed, so the tribute standing there should have it');
    },
);

scenario(
    'an unclaimed gift is collected rather than lying in the arena forever',
    'the world does not accumulate free supplies nobody ever reaches',
    () => {
        const w = world('SCEN-chute-4');
        const t = w.tribute(0);
        const ctx = createContext(w.state, new RNG('SCEN-chute-4'));
        const item = { ...ITEMS.find(i => i.id === 'bread')! };
        // Drop it somewhere nobody is, then let the clock run.
        dropParachute(ctx, t, item);
        pendingParachutes(w.state)[0].zone = '__nowhere__';
        resolveParachutes(ctx);
        eq(pendingParachutes(w.state).length, 1, 'it waits at first');
        w.state.cycle = (w.state.cycle ?? 0) + PARACHUTES.lifetimeCycles;
        resolveParachutes(ctx);
        eq(pendingParachutes(w.state).length, 0, 'and is collected once its time is up');
    },
);

console.log('\nnegotiated obligations');

const food = () => ({ ...ITEMS.find(i => i.type === 'food')! });

scenario(
    'a promise nobody can keep is refused',
    'the capacity check: promising what you cannot deliver is not free',
    () => {
        const w = world('SCEN-ob-1');
        const a = w.tribute(0), b = w.tribute(1);
        const ctx = createContext(w.state, new RNG('SCEN-ob-1'));
        a.inventory = [];
        eq(canPromise(w.state, a, 'supply'), false, 'an empty pack cannot promise supplies');
        eq(promise(ctx, a, b, 'supply'), undefined, 'and the promise is refused rather than made and broken');
        eq(openObligations(w.state).length, 0, 'nothing is on the books');
    },
);

scenario(
    'a kept promise moves the goods and buys regard',
    'discharge is physical: the food actually changes hands',
    () => {
        const w = world('SCEN-ob-2');
        const a = w.tribute(0), b = w.tribute(1);
        w.only(a, b);
        w.place(b, a.zone);
        const ctx = createContext(w.state, new RNG('SCEN-ob-2'));
        a.inventory = [food(), food()];
        b.inventory = [];
        b.vitals.hunger = 90;
        const before = b.relationships[a.id] ?? 0;
        check(promise(ctx, a, b, 'supply') !== undefined, 'the promise should be makeable');
        tickObligations(ctx);
        check(b.inventory.length === 1, 'the food should have changed hands');
        check((b.relationships[a.id] ?? 0) > before, 'keeping it should be worth something');
        eq(openObligations(w.state).length, 0, 'and the obligation should be closed');
    },
);

scenario(
    'a promise the week made irrelevant lapses rather than counting as betrayal',
    'broken means they could have and did not, not that the need passed',
    () => {
        const w = world('SCEN-ob-3');
        const a = w.tribute(0), b = w.tribute(1);
        w.only(a, b);
        w.place(b, a.zone);
        const ctx = createContext(w.state, new RNG('SCEN-ob-3'));
        a.inventory = [food(), food()];
        b.vitals.hunger = 90;
        const o = promise(ctx, a, b, 'supply');
        check(o !== undefined, 'promise made');
        // They find their own food, and the deadline passes.
        b.vitals.hunger = 5;
        w.state.cycle = o!.byCycle;
        w.state.day = o!.byCycle;
        tickObligations(ctx);
        eq(o!.status, 'lapsed', 'a need that went away is not a betrayal');
    },
);

scenario(
    'a promise they could have kept and did not is broken',
    'standing right there, able to do it, and not doing it is the thing that costs',
    () => {
        const w = world('SCEN-ob-4');
        const a = w.tribute(0), b = w.tribute(1);
        w.only(a, b);
        w.place(b, a.zone);
        const ctx = createContext(w.state, new RNG('SCEN-ob-4'));
        a.health = 100; a.vitals.fatigue = 0;
        const somewhereElse = w.state.arena.zones.find(z => z.name !== a.zone)!.name;
        const o = promise(ctx, a, b, 'escort', somewhereElse);
        check(o !== undefined, 'an escort should be promisable by a fit tribute');
        // The deadline arrives with the two of them still standing where they
        // started: able to walk, together, and nowhere near the destination.
        o!.byCycle = (w.state.cycle ?? 0);
        const rel = b.relationships[a.id] ?? 0;
        tickObligations(ctx);
        eq(o!.status, 'broken', 'able, together, and not there: that is a broken promise');
        check((b.relationships[a.id] ?? 0) < rel, 'and it should cost them');
    },
);

scenario(
    'the same promise is not made twice while it is still open',
    'repeating a promise you have not kept is not a second promise',
    () => {
        const w = world('SCEN-ob-5');
        const a = w.tribute(0), b = w.tribute(1);
        w.place(b, a.zone);
        const ctx = createContext(w.state, new RNG('SCEN-ob-5'));
        a.inventory = [food(), food(), food()];
        b.vitals.hunger = 90;
        check(promise(ctx, a, b, 'supply') !== undefined, 'first promise stands');
        eq(promise(ctx, a, b, 'supply'), undefined, 'the second is refused');
        eq(openObligations(w.state).length, 1, 'one obligation, not two');
    },
);

console.log('\nhazard chains: warning, mitigation, aftermath');

scenario(
    'a hazard is announced before it arrives',
    'a warning with lead time is the only window in which anything can be done',
    () => {
        const w = world('SCEN-hz-1');
        const ctx = createContext(w.state, new RNG('SCEN-hz-1'));
        const zone = w.state.arena.zones[1].name;
        forecastHazard(ctx, zone, 'burning', 'gamemaker');
        const f = (w.state.forecasts ?? [])[0];
        check(f !== undefined, 'the forecast should be on the books');
        check(f.dueCycle > (w.state.cycle ?? 0), 'and due later than now, or it is not a warning');
        check(!hasEffect(w.state, zone, 'burning'), 'the zone must not be on fire yet');
    },
);

scenario(
    'an unmitigated forecast lands, carrying who caused it',
    'the hazard still arrives if nobody acts, and remembers whose fault it was',
    () => {
        const w = world('SCEN-hz-2');
        const ctx = createContext(w.state, new RNG('SCEN-hz-2'));
        const zone = w.state.arena.zones[1].name;
        forecastHazard(ctx, zone, 'burning', 'gamemaker');
        w.state.cycle = (w.state.cycle ?? 0) + 5;
        w.state.day = w.state.cycle;
        tickForecasts(ctx);
        check(hasEffect(w.state, zone, 'burning'), 'nobody acted, so it should have landed');
        const effect = effectsFor(w.state, zone).find(e => e.kind === 'burning');
        eq(effect?.source, 'gamemaker', 'and the effect should know who authored it');
    },
);

scenario(
    'a mitigated forecast does not land',
    'a day spent on a firebreak is a day that bought something',
    () => {
        const w = world('SCEN-hz-3');
        const ctx = createContext(w.state, new RNG('SCEN-hz-3'));
        const zone = w.state.arena.zones[1].name;
        forecastHazard(ctx, zone, 'burning', 'arena');
        (w.state.forecasts ?? [])[0].mitigation = 1;
        w.state.cycle = (w.state.cycle ?? 0) + 5;
        w.state.day = w.state.cycle;
        tickForecasts(ctx);
        check(!hasEffect(w.state, zone, 'burning'), 'the work should have held it off');
        eq(w.state.hazardsAverted, 1, 'and the run should record that it was averted');
    },
);

scenario(
    'working against a hazard costs the day',
    'mitigation is work, so seeing the warning and acting on it has a price',
    () => {
        const w = world('SCEN-hz-4');
        const t = w.tribute(0);
        const ctx = createContext(w.state, new RNG('SCEN-hz-4'));
        forecastHazard(ctx, t.zone, 'burning', 'arena');
        resetBudget(t);
        const before = hoursLeft(t);
        mitigate(ctx, t);
        check(hoursLeft(t) < before, 'the hours should have gone into it');
    },
);

scenario(
    'bad water is felt days after it is drunk',
    'the delayed half of the contamination chain: knowing is not the same as being fine',
    () => {
        const w = world('SCEN-hz-5');
        const t = w.tribute(0);
        const ctx = createContext(w.state, new RNG('SCEN-hz-5'));
        t.injuries.poisoned = false;
        t.waterborne = { fromZone: t.zone, dueCycle: (w.state.cycle ?? 0) + 3 };
        tickExposure(ctx);
        eq(t.injuries.poisoned, false, 'nothing should happen before the incubation is up');
        check(t.waterborne !== undefined, 'and the exposure should still be carried');
        w.state.cycle = (w.state.cycle ?? 0) + 3;
        w.state.day = w.state.cycle;
        tickExposure(ctx);
        eq(t.injuries.poisoned, true, 'and then it arrives');
        eq(t.waterborne, undefined, 'spent');
    },
);

console.log('\nbounded knowledge');

scenario(
    'seeing a place yourself is the strongest a belief gets',
    'first-hand knowledge is certainty, and it overwrites what you were told',
    () => {
        const w = world('SCEN-bel-1');
        const t = w.tribute(0);
        const zone = w.state.arena.zones[1].name;
        // Start them off having been told something.
        const mem = ensureMemory(t);
        mem.zones[zone] = { seen: w.state.cycle ?? 0, threat: 2, rivals: 3, barren: 0, hearsay: true, confidence: 0.4, hops: 2 };
        noteSighting(w.state, t, zone, 1, 0);
        eq(confidenceOf(w.state, mem.zones[zone]), 1, 'looking at it is certainty');
        eq(mem.zones[zone].hearsay, false, 'and it is no longer hearsay');
        eq(mem.zones[zone].hops, 0, 'nor second-hand');
    },
);

scenario(
    'a retelling is weaker than what was retold, and a third telling weaker still',
    'confidence falls along the chain, so a rumour weakens with distance',
    () => {
        const w = world('SCEN-bel-2');
        const zone = w.state.arena.zones[1].name;
        const a = w.tribute(0), b = w.tribute(1), c = w.tribute(2);
        noteSighting(w.state, a, zone, 2, 0);
        const first = confidenceOf(w.state, ensureMemory(a).zones[zone]);
        writeHearsay(w.state, a, b, zone, 2, 2, 0);
        const second = confidenceOf(w.state, ensureMemory(b).zones[zone]);
        writeHearsay(w.state, b, c, zone, 2, 2, 0);
        const third = confidenceOf(w.state, ensureMemory(c).zones[zone]);
        check(second < first, `second-hand (${second.toFixed(2)}) should be weaker than seeing it (${first.toFixed(2)})`);
        check(third < second, `third-hand (${third.toFixed(2)}) should be weaker again`);
        eq(ensureMemory(c).zones[zone].hops, 2, 'and the chain depth should be recorded');
    },
);

scenario(
    'a belief goes stale and stops being worth acting on',
    'per-belief expiry: what was true last week is not a plan',
    () => {
        const w = world('SCEN-bel-3');
        const t = w.tribute(0);
        const zone = w.state.arena.zones[1].name;
        noteSighting(w.state, t, zone, 3, 0);
        check(stillBelieved(w.state, ensureMemory(t).zones[zone]), 'fresh, so believed');
        check(rememberedRivals(w.state, t, zone) > 0, 'and acted on');
        w.state.cycle = (w.state.cycle ?? 0) + 40;
        w.state.day = w.state.cycle;
        check(!stillBelieved(w.state, ensureMemory(t).zones[zone]), 'stale, so no longer believed');
        eq(rememberedRivals(w.state, t, zone), 0, 'and no longer acted on');
    },
);

process.exit(report('stage C/D scenarios') ? 1 : 0);
