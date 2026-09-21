/**
 * AUDIT-10 batch 2: the shared legal-action contract, as positioned scenes.
 *
 * The audit's §4 asks for two things and the second is the one that matters:
 * six named capability queries, and **validation twice** — before committing
 * and immediately before resolution. Its examples are all things that become
 * false in between: the rescue target moved, the rope holder died, the cache
 * emptied, a gate closed, a promise expired while somebody was crossing.
 *
 * A boolean predicate can be checked by inspection. "This was re-checked at
 * the moment of resolution" cannot, so it is checked here.
 */
import { scenario, check, eq, world, report } from './scenarios';
import { createContext } from '../src/engine/context';
import { RNG } from '../src/utils/rng';
import { ITEMS } from '../src/data/constants';
import { Item } from '../src/models/types';
import {
    Verdict, canAct, canCarry, canObserve, canReach, canSpanTo, canSpend, canTransfer, canTravelTo,
    perform, refusalSummary, validate,
} from '../src/engine/actions';

/** The verdict as a word, so a failure reads as the reason rather than "false". */
const said = (v: Verdict) => (v.ok ? 'yes' : v.why);
import { goDown } from '../src/engine/downed';
import { resetBudget } from '../src/engine/actionBudget';
import { isVertical } from '../src/engine/verticality';
import { carryCapacity } from '../src/engine/items';

const itemById = (id: string) => structuredClone(ITEMS.find(i => i.id === id)!) as Item;

console.log('the capability queries');

scenario(
    'canAct is not "alive": a downed tribute and one mid-crossing both fail it',
    'the audit: isActive does not by itself prove a person is not in transit',
    () => {
        const w = world('A-act');
        const [a, b, c] = w.state.tributes;
        w.only(a, b, c);
        [a, b, c].forEach(resetBudget);
        check(canAct(a).ok, 'somebody standing there can act');
        goDown(createContext(w.state, new RNG('A-act-d')), b, 'a fall');
        eq(said(canAct(b)), 'incapable', 'a downed tribute cannot');
        c.transit = { to: w.state.arena.zones[1].name, remaining: 2 };
        eq(said(canAct(c)), 'in-transit', 'nor can somebody two days into a crossing');
    },
);

scenario(
    'canReach is contact and canSpanTo is a rope: they differ exactly at a level',
    'rope reach is different from medical contact',
    () => {
        const w = world('A-reach');
        const [up, down] = w.state.tributes;
        w.only(up, down);
        const zone = w.state.arena.zones.find(z => isVertical(w.state.arena, z.name));
        check(!!zone, 'the fixture arena has a vertical zone');
        up.zone = down.zone = zone!.name;
        up.zoneLevel = 'upper';
        down.zoneLevel = 'lower';
        [up, down].forEach(resetBudget);
        eq(said(canReach(w.state, up, down)), 'out-of-contact', 'no hands on somebody a level below');
        check(canSpanTo(w.state, up, down).ok, 'but a line reaches them');
        // ...and is paid downward only.
        eq(said(canSpanTo(w.state, down, up)), 'out-of-reach', 'a line is not paid upward');
        down.zoneLevel = 'upper';
        check(canReach(w.state, up, down).ok, 'on the same level it is contact again');
    },
);

scenario(
    'canObserve is wider than reach and narrower than omniscience',
    'hearing a scream is different from identifying its speaker',
    () => {
        const w = world('A-see');
        const [t] = w.state.tributes;
        w.only(t);
        resetBudget(t);
        check(canObserve(w.state, t, t.zone).ok, 'they can see where they are standing');
        const elsewhere = w.state.arena.zones.map(z => z.name).filter(n => n !== t.zone);
        const unseen = elsewhere.filter(z => !canObserve(w.state, t, z).ok);
        check(unseen.length > 0, 'and not every sector in the arena');
    },
);

scenario(
    'canSpend, canCarry and canTransfer each refuse for their own reason',
    'a refusal that names itself can be counted, narrated, or worked around',
    () => {
        const w = world('A-cost');
        const [a, b] = w.state.tributes;
        w.only(a, b);
        [a, b].forEach(resetBudget);
        b.zone = a.zone;
        b.zoneLevel = a.zoneLevel;
        check(canSpend(a, 1).ok, 'a fresh day affords an hour');
        a.hoursLeft = 0;
        eq(said(canSpend(a, 1)), 'no-time', 'an empty one does not');
        b.inventory = Array.from({ length: carryCapacity(b) }, () => itemById('sword'));
        eq(said(canCarry(b)), 'no-room', 'full hands are full');
        eq(said(canTransfer(w.state, a, b)), 'no-room',
            'and a hand-over to full hands is refused for that, not for distance');
    },
);

scenario(
    'canTravelTo answers with the routes that currently exist',
    'validate connectivity for the capabilities actually present',
    () => {
        const w = world('A-travel');
        const [t] = w.state.tributes;
        w.only(t);
        resetBudget(t);
        check(canTravelTo(w.state, t, t.zone).ok, 'they are already here');
        const far = w.state.arena.zones.map(z => z.name).filter(n => n !== t.zone);
        const oneHop = far.filter(z => canTravelTo(w.state, t, z, 1).ok);
        check(oneHop.length > 0, 'somewhere is one crossing away');
        check(oneHop.length < far.length, 'and somewhere is not');
    },
);

console.log('\nthe double validation');

scenario(
    'an action whose condition fails between intent and resolution does not resolve',
    'the audit: validate before committing AND immediately before resolution',
    () => {
        const w = world('A-twice');
        const [a] = w.state.tributes;
        w.only(a);
        resetBudget(a);
        const hoursBefore = a.hoursLeft;
        let resolved = false;
        /*
         * The audit's own example, in miniature: the cache emptied. `check` is
         * true when the spec is built and false by the time `perform` asks it
         * the second time — which is the only difference between a contract
         * that validates twice and one that validates once.
         */
        let cacheHasBread = true;
        const result = perform(createContext(w.state, new RNG('A-twice')), {
            kind: 'take-from-cache',
            actors: [a],
            hours: 1,
            check: () => {
                const answer = cacheHasBread;
                // Somebody else empties it between the two calls.
                cacheHasBread = false;
                return answer;
            },
        }, () => { resolved = true; });
        check(!result.ok, 'the action is refused');
        eq(result.ok ? 'ok' : result.why, 'gone', 'for the reason the condition failed');
        check(!resolved, 'and its body never ran');
        eq(a.hoursLeft, hoursBefore, 'a refused action costs nothing');
    },
);

scenario(
    'a successful action spends its hours exactly once',
    'reserved time plus elapsed work is conserved',
    () => {
        const w = world('A-spend');
        const [a] = w.state.tributes;
        w.only(a);
        resetBudget(a);
        const before = a.hoursLeft!;
        let ran = 0;
        const result = perform(createContext(w.state, new RNG('A-spend')), {
            kind: 'haul', actors: [a], hours: 2,
        }, () => { ran++; });
        check(result.ok, 'it happens');
        eq(ran, 1, 'once');
        eq(a.hoursLeft, before - 2, 'and two hours are gone, not four');
    },
);

scenario(
    'a participant who died between intent and resolution refuses the action',
    'the audit: the rescue target moved; the rope holder died',
    () => {
        const w = world('A-dead');
        const [a, b] = w.state.tributes;
        w.only(a, b);
        [a, b].forEach(resetBudget);
        b.zone = a.zone;
        b.zoneLevel = a.zoneLevel;
        const spec = { kind: 'hand-over', actors: [a], hours: 1, participants: [b] };
        check(validate(w.state, spec).ok, 'it is legal while they are both standing there');
        b.status = 'dead';
        b.health = 0;
        const after = validate(w.state, spec);
        check(!after.ok, 'and not once one of them is not');
        eq(after.ok ? 'ok' : after.why, 'gone', 'named as such');
        eq(after.ok ? undefined : after.actorId, b.id, 'and attributed to the right person');
    },
);

scenario(
    'every refusal is counted, so an unreachable chain is distinguishable from a rare one',
    'the audit: impossible-action attempts must be countable',
    () => {
        const w = world('A-ledger');
        const [a] = w.state.tributes;
        w.only(a);
        resetBudget(a);
        a.hoursLeft = 0;
        const ctx = createContext(w.state, new RNG('A-ledger'));
        for (let i = 0; i < 3; i++) {
            perform(ctx, { kind: 'haul', actors: [a], hours: 4 }, () => {
                throw new Error('a refused action must not resolve');
            });
        }
        const ledger = refusalSummary(w.state);
        const entry = ledger.find(r => r.key === 'haul:no-time');
        check(!!entry, 'the refusals are on the ledger under their own reason');
        eq(entry!.count, 3, 'all three of them');
        eq(w.state.actionLedger?.attempted.haul, undefined, 'and none of them counted as an attempt');
    },
);

process.exitCode = report('AUDIT-10 action contract') === 0 ? 0 : 1;
