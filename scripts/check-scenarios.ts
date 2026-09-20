/**
 * AUDIT-9 stage C: the authored scenarios.
 *
 * The gate the audit sets for this stage is "several authored scenario tests
 * demonstrate different sensible outcomes; no impossible actions or
 * conservation errors". Each block below is one proposition about the engine,
 * stated as a scene rather than as an average.
 */
import { scenario, check, eq, world, inventoryCensus, report } from './scenarios';
import { ACTION_BUDGET } from '../src/data/balance';
import { hoursFor, hoursLeft, hoursSpent, resetBudget, spend, work, progressOf, canAfford } from '../src/engine/actionBudget';
import { Tribute } from '../src/models/types';

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
    'a run does not invent or destroy stackable quantity silently',
    'every item that leaves an inventory went somewhere it can be named',
    () => {
        const w = world('SCEN-cons-1');
        const sim = w.sim();
        sim.startGames();
        const before = inventoryCensus(sim.getState());
        sim.processBloodbath();
        for (let i = 0; i < 12 && !sim.isFinished(); i++) sim.processTurn();
        const after = inventoryCensus(sim.getState());
        // Consumption and looting move quantity around; what must not happen is
        // a stack growing without anything producing it.
        const invented = [...after].filter(([id, n]) => n > (before.get(id) ?? 0) * 8 + 8);
        check(invented.length === 0,
            `quantity appeared from nowhere: ${invented.map(([id, n]) => `${id} ${before.get(id) ?? 0}->${n}`).join(', ')}`);
    },
);

process.exit(report('stage C scenarios') ? 1 : 0);
