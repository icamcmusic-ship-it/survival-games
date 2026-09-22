import { GameState, Tribute } from '../models/types';
import { SimContext } from './context';
import { ACCUSATIONS } from '../data/balance';
import { cycleOf, ensureMemory, raiseSuspicion } from './memory';
import { adjustBelief, credibilityWeight, getRel } from './relationships';
import { addNotoriety } from './notoriety';
import { addFear } from './fear';

/**
 * §16: who is said to have killed whom.
 *
 * AUDIT-10 B5-01 asks for witnessed events held as private, suspected or
 * proven. Every ingredient for that was already built and none of them was it.
 * `applyDeathFallout` works out whether an observer saw the kill, pieced it
 * together from the next zone, or pinned it on the wrong person entirely — and
 * keeps all three as local booleans that die with the call. `suspicion` is
 * graded and persistent but is about a *person*, so you cannot ask what A
 * suspects B *of*. `rumours` are the one place a proposition with a truth
 * value and a planter lives, and they are only ever about a zone.
 *
 * The consequence was that a tribute who stood and watched a killing had no
 * way to tell anybody. Reputation moved by gossip as a scalar — somebody
 * became vaguely more notorious — and the arena never once contained the
 * sentence "it was Cato, I saw him".
 *
 * Corroboration is the design. One mouth is a claim; two mouths that did not
 * get it from each other is as close to proof as an arena with no evidence in
 * it can get, and it is the only honest way to separate `suspected` from
 * `proven` without inventing a forensics system.
 */

/** What this tribute believes, if anything, about who killed a given person. */
export function accusationAgainst(t: Tribute, accusedId: string) {
    return ensureMemory(t).accusations?.[accusedId];
}

/**
 * Record that `witness` knows `killer` killed `victim`, first-hand.
 *
 * `private` rather than `proven` is deliberate on the way in: seeing it makes
 * them certain, but the level here tracks what the *claim* has been through,
 * and a thing nobody has said out loud yet is the one state the audit names
 * that nothing modelled. It is promoted to `proven` the moment they say it,
 * because their own eyes are the second source for themselves.
 */
export function witnessKilling(ctx: SimContext, witness: Tribute, killer: Tribute, victim: Tribute) {
    if (witness.id === killer.id || witness.id === victim.id) return;
    const mem = ensureMemory(witness);
    mem.accusations = mem.accusations ?? {};
    const existing = mem.accusations[killer.id];
    // Seeing it outranks having been told it.
    if (existing && existing.level === 'proven' && existing.toldBy.length === 0) return;
    mem.accusations[killer.id] = {
        victimId: victim.id,
        level: 'private',
        toldBy: [],
        isTrue: true,
        cycle: cycleOf(ctx.state),
    };
}

/**
 * A belief somebody has picked up second-hand and cannot source, which is what
 * misattribution produces. Kept separate from `witnessKilling` so the two
 * cannot be confused at the call site: this one can be false, and is.
 */
export function suspectKilling(ctx: SimContext, holder: Tribute, accusedId: string, victimId: string, isTrue: boolean) {
    if (holder.id === accusedId) return;
    const mem = ensureMemory(holder);
    mem.accusations = mem.accusations ?? {};
    if (mem.accusations[accusedId]) return;
    mem.accusations[accusedId] = {
        victimId, level: 'suspected', toldBy: [], isTrue, cycle: cycleOf(ctx.state),
    };
}

/** Whether `teller` would say this to `listener` at all. */
function willTell(ctx: SimContext, teller: Tribute, listener: Tribute, accusedId: string): boolean {
    if (listener.id === accusedId) return false;
    // You do not tell somebody their own ally is a killer while they are
    // standing in that alliance — that is not a confidence, it is a challenge.
    if (listener.allianceId !== undefined && listener.allianceId === ctx.state.tributes
        .find(o => o.id === accusedId)?.allianceId) return false;
    if (getRel(teller, listener.id) < ACCUSATIONS.tellMinRegard) return false;
    const chance = ACCUSATIONS.tellChance
        + Math.max(0, teller.attributes.charisma - 5) * ACCUSATIONS.tellPerCharisma;
    return ctx.rng.chance(chance);
}

/**
 * One pass: everybody standing together, saying what they know.
 *
 * Called from the day/night loop after movement has settled, so the people in
 * a zone are the people who actually ended up there.
 */
export function tradeAccusations(ctx: SimContext) {
    const state = ctx.state;
    const cycle = cycleOf(state);
    const alive = state.tributes.filter(t => t.status === 'alive');
    const byZone = new Map<string, Tribute[]>();
    alive.forEach(t => {
        const list = byZone.get(t.zone) ?? [];
        list.push(t);
        byZone.set(t.zone, list);
    });

    /*
     * One thing, said to one person, per teller per cycle.
     *
     * The first version let everybody tell everybody every claim they held,
     * every cycle. In a pack of six that is thirty tellings a cycle, and the
     * guard caught exactly what it was built to catch: 96.8% of the living
     * field believing the same tribute guilty, and 69% of all beliefs reaching
     * `proven` — corroboration so cheap it meant nothing.
     *
     * Gossip is not a broadcast. Somebody mentions one thing to one person,
     * and it travels because it gets repeated over days rather than because it
     * was announced. Limiting it here rather than by lowering `tellChance` is
     * deliberate: a smaller chance applied thirty times a cycle is still a
     * broadcast, just a noisier one.
     */
    byZone.forEach(here => {
        if (here.length < 2) return;
        here.forEach(teller => {
            const mem = ensureMemory(teller);
            const mine = mem.accusations;
            if (!mine) return;
            const fresh = Object.entries(mine).filter(([, c]) => cycle - c.cycle <= ACCUSATIONS.lifetime);
            if (fresh.length === 0) return;
            const others = here.filter(o => o.id !== teller.id);
            if (others.length === 0) return;
            const [accusedId, claim] = ctx.rng.pick(fresh);
            const listener = ctx.rng.pick(others);
            if (!willTell(ctx, teller, listener, accusedId)) return;
            deliver(ctx, teller, listener, accusedId, claim.victimId, claim.isTrue);
            // Saying it out loud settles it for the teller too: their own eyes
            // plus having committed to it in front of somebody.
            if (claim.level === 'private') claim.level = 'proven';
        });
    });
}

/** One telling, landing (or not) in one listener's head. */
function deliver(ctx: SimContext, teller: Tribute, listener: Tribute,
                 accusedId: string, victimId: string, isTrue: boolean) {
    const state = ctx.state;
    const weight = credibilityWeight(listener, teller.id);
    if (weight < ACCUSATIONS.credibilityFloor) return;
    const mem = ensureMemory(listener);
    mem.accusations = mem.accusations ?? {};
    const held = mem.accusations[accusedId];
    const accused = state.tributes.find(o => o.id === accusedId);
    const name = (id: string) => state.tributes.find(o => o.id === id)?.name ?? 'somebody';

    if (!held) {
        mem.accusations[accusedId] = {
            victimId, level: 'suspected', toldBy: [teller.id], isTrue, cycle: cycleOf(state),
        };
        raiseSuspicion(listener, accusedId, ACCUSATIONS.suspectedSuspicion * weight);
        if (ctx.rng.chance(ACCUSATIONS.lineChance)) {
            ctx.logEvent(
                `${teller.name} tells ${listener.name} what ${name(accusedId)} did to ${name(victimId)}. `
                + `${listener.name} has no way to check it, and files it anyway.`,
                [teller.id, listener.id],
                { category: 'alliance', zone: listener.zone }
            );
        }
        return;
    }

    // Already knew. A second, independent mouth is the only thing in this
    // arena that turns a claim into a fact.
    if (held.level === 'proven') return;
    if (held.toldBy.includes(teller.id)) return;
    held.toldBy.push(teller.id);
    held.level = 'proven';
    held.cycle = cycleOf(state);
    raiseSuspicion(listener, accusedId, ACCUSATIONS.provenSuspicion * weight);
    if (accused) addFear(listener, accusedId, ACCUSATIONS.provenFear);
    addNotoriety(listener, accusedId, ACCUSATIONS.provenNotoriety);
    /*
     * And the cost of being wrong lands here, on both mouths, because this is
     * the first moment the claim has been stated strongly enough to be worth
     * holding somebody to. A tribute who corroborates a killing that did not
     * happen is believed less next time — the same currency `writeHearsay`
     * already docks for a zone claim that did not survive being looked at.
     */
    if (!held.isTrue) {
        held.toldBy.forEach(id => adjustBelief(listener, id, ACCUSATIONS.falseClaimBelief));
    }
    if (ctx.rng.chance(ACCUSATIONS.lineChance)) {
        ctx.logEvent(
            `${teller.name} says the same thing about ${name(accusedId)} that somebody else already told `
            + `${listener.name}. Two mouths and no way to check either, which in here is as good as proof.`,
            [teller.id, listener.id],
            { important: true, category: 'alliance', zone: listener.zone }
        );
    }
}

/** How many people believe, on any level, that this tribute has killed. */
export function accusersOf(state: GameState, accusedId: string): number {
    return state.tributes.filter(t => t.status === 'alive'
        && ensureMemory(t).accusations?.[accusedId] !== undefined).length;
}
