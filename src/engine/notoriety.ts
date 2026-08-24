/**
 * §3.5: reputation that travels without direct contact.
 *
 * `fear.ts` is per-target and mostly per-witness: you fear the person whose
 * work you actually saw, plus a partial credit for a cannon one zone over.
 * `memory.ts` already carries information about *places* between people — a
 * scout shares a sighting, a false trail poisons `zoneTraffic` — but nothing
 * carried information about *people*. So the field's biggest killer, four
 * zones away, was a complete stranger to anyone who had not personally
 * watched them work, no matter how many cannons had gone off around them.
 *
 * That is the wrong model of an arena with a sky-broadcast every night and
 * nothing to talk about at every meeting. This is the missing channel:
 *
 *  - **The sky.** Everyone learns who died. Nobody is told who did it, but the
 *    faces stop appearing and the same names keep not appearing, and a belief
 *    accumulates about who is doing the work. Slow, diffuse, and applies to
 *    the whole field.
 *  - **Proximity.** A cannon in a zone next to yours, with somebody you know
 *    is over there, sharpens that belief toward a specific person — right or
 *    wrong.
 *  - **Talk.** Two tributes who meet peaceably compare notes, and their
 *    ledgers converge. This is how a name reaches somebody five zones and
 *    three days removed from anything that person has ever done.
 *
 * Notoriety is explicitly *belief*, not fact. It is built from kill counts the
 * believer has no direct access to, damped hard, and it can be wrong — a
 * quiet tribute standing next to a lot of cannons accrues a reputation they
 * have not earned. Meeting the person is what corrects it: `witness` writes the
 * true figure over the rumour.
 *
 * It reads separately from fear on purpose. Fear is "I have seen what this
 * person does to people"; notoriety is "I have heard of them". They stack, and
 * a tribute can hold either without the other.
 */
import { GameState, Tribute } from '../models/types';
import { NOTORIETY } from '../data/balance';
import { SimContext, getAlive } from './context';
import { cycleOf, ensureMemory } from './memory';
import { getZone } from './map';

export function notorietyOf(t: Tribute, otherId: string): number {
    return ensureMemory(t).notoriety?.[otherId] ?? 0;
}

/** As a 0-1 fraction, which is the form every consumer wants. */
export function notorietyFraction(t: Tribute, otherId: string): number {
    return Math.min(1, notorietyOf(t, otherId) / NOTORIETY.max);
}

export function addNotoriety(t: Tribute, otherId: string, amount: number) {
    if (t.id === otherId || amount <= 0) return;
    const mem = ensureMemory(t);
    if (!mem.notoriety) mem.notoriety = {};
    mem.notoriety[otherId] = Math.min(NOTORIETY.max,
        Math.round(((mem.notoriety[otherId] ?? 0) + amount) * 100) / 100);
}

/**
 * Meeting somebody replaces the rumour with the person. A reputation built out
 * of cannons and hearsay is a guess, and standing in front of them is the
 * moment the guess is checked — in either direction, which is the point: a
 * frightening name who turns out to be a starving fifteen-year-old loses their
 * reputation the moment anyone actually looks at them.
 */
export function witnessReputation(t: Tribute, other: Tribute) {
    const mem = ensureMemory(t);
    if (!mem.notoriety) mem.notoriety = {};
    const truth = Math.min(NOTORIETY.max, other.kills * NOTORIETY.perKnownKill);
    const held = mem.notoriety[other.id] ?? 0;
    mem.notoriety[other.id] = Math.round((held + (truth - held) * NOTORIETY.witnessCorrection) * 100) / 100;
}

/**
 * Two people who meet without trying to kill each other compare notes, and
 * what each of them knows partly becomes what the other knows. Deliberately
 * partial and lossy — this is gossip, not a database merge — and it is the
 * mechanism that gets a name across the map.
 */
export function tradeReputations(a: Tribute, b: Tribute) {
    const share = (from: Tribute, to: Tribute) => {
        const ledger = ensureMemory(from).notoriety;
        if (!ledger) return;
        Object.entries(ledger).forEach(([id, value]) => {
            if (id === to.id) return;
            const heard = value * NOTORIETY.gossipShare;
            if (heard <= notorietyOf(to, id)) return;
            addNotoriety(to, id, heard - notorietyOf(to, id));
        });
    };
    share(a, b);
    share(b, a);
}

/**
 * One cycle of the two contactless channels: the sky, and the zone next door.
 * Call once per cycle, after the fighting has resolved.
 */
export function spreadNotoriety(ctx: SimContext) {
    const state = ctx.state;
    const alive = getAlive(state);
    // Nothing to talk about in an arena where nobody has done anything yet.
    const killers = alive.filter(k => k.kills > 0);
    if (killers.length === 0) return;

    alive.forEach(watcher => {
        killers.forEach(killer => {
            if (killer.id === watcher.id) return;
            // The sky. Everyone watches it; nobody is told who did what, so
            // this is slow and it is the same for the whole field.
            let gain = killer.kills * NOTORIETY.perKillFromSky;
            // Being close to where it happened sharpens the guess toward a
            // specific person. `zoneDeaths` is what the arena remembers about
            // the ground, which is exactly what a neighbour would notice.
            if (adjacentTo(state, watcher.zone, killer.zone)) {
                const deathsThere = state.zoneDeaths?.[killer.zone] ?? 0;
                if (deathsThere > 0) gain += NOTORIETY.proximityBonus;
            }
            addNotoriety(watcher, killer.id, gain);
        });
    });
}

function adjacentTo(state: GameState, from: string, to: string): boolean {
    if (from === to) return true;
    const zone = getZone(state.arena, from);
    return !!zone && zone.adjacent.includes(to);
}

/** Decays toward nothing — a name nobody has heard again stops being a name. */
export function decayNotoriety(state: GameState) {
    state.tributes.forEach(t => {
        const ledger = t.memory?.notoriety;
        if (!ledger) return;
        Object.keys(ledger).forEach(id => {
            const next = ledger[id] - NOTORIETY.decayPerCycle;
            if (next <= 0) delete ledger[id];
            else ledger[id] = Math.round(next * 100) / 100;
        });
    });
}

/** The most notorious living tribute believed to be in a given zone. */
export function notorietyInZone(state: GameState, t: Tribute, zoneName: string): number {
    let worst = 0;
    state.tributes.forEach(o => {
        if (o.status !== 'alive' || o.id === t.id) return;
        // Belief about where they are, on the same "recently seen" basis fear
        // uses — this is not a position oracle.
        const seen = ensureMemory(t).lastContact[o.id];
        const believedHere = o.zone === zoneName
            && seen !== undefined && cycleOf(state) - seen <= NOTORIETY.beliefLifetime;
        if (!believedHere) return;
        worst = Math.max(worst, notorietyFraction(t, o.id));
    });
    return worst;
}
