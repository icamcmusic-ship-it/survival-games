import { GameState, Tribute } from '../models/types';
import { FEAR, MEMORY } from '../data/balance';
import { cyclesSinceContact, ensureMemory } from './memory';
import { traitMod } from '../data/traits';

/**
 * Fear.
 *
 * Psychology used to touch exactly one decision in the whole simulation — the
 * generic per-round retreat roll — so a tribute who had watched someone butcher
 * their district partner walked into that person's zone as cheerfully as into
 * anyone else's. Training-score intimidation moved relationships and sanity and
 * then evaporated.
 *
 * Fear is per-target and it persists. It makes the Careers genuinely
 * frightening — their reputation precedes them — and it gives a tribute a
 * reason to run that is about a person rather than a health bar.
 */

export function fearOf(t: Tribute, otherId: string): number {
    return ensureMemory(t).fear?.[otherId] ?? 0;
}

export function addFear(t: Tribute, otherId: string, amount: number) {
    if (t.id === otherId) return;
    // Temperament decides how much of a frightening thing actually sticks.
    amount *= Math.max(0, 1 + traitMod(t, 'fearGain'));
    if (amount <= 0) return;
    const mem = ensureMemory(t);
    if (!mem.fear) mem.fear = {};
    mem.fear[otherId] = Math.min(FEAR.max, Math.round((mem.fear[otherId] ?? 0) + amount));
}

/**
 * §3.2: reality correcting a belief. Fear is partly rumour — a misheard
 * cannon, a training score, a story — and landing a clean hit on the person
 * is the moment the rumour is tested against the fact of them.
 */
export function reduceFear(t: Tribute, otherId: string, amount: number) {
    const mem = ensureMemory(t);
    if (!mem.fear?.[otherId]) return;
    mem.fear[otherId] = Math.max(0, mem.fear[otherId] - amount);
}

/** Fear as a 0-1 fraction, which is the form every consumer actually wants. */
export function fearFraction(t: Tribute, otherId: string): number {
    return fearOf(t, otherId) / FEAR.max;
}

/** The most frightening living tribute believed to be in a given zone. */
export function fearInZone(state: GameState, t: Tribute, zoneName: string): number {
    let worst = 0;
    state.tributes.forEach(o => {
        if (o.status !== 'alive' || o.id === t.id) return;
        // Only what they believe: a tribute's true position is not the test —
        // dread of a *specific* person requires having actually crossed paths
        // with them recently, not merely a stale "someone hostile was here"
        // count for the zone that happens to still be true of whoever is
        // standing here now.
        if (o.zone !== zoneName) return;
        if (cyclesSinceContact(state, t, o.id) > MEMORY.sightingLifetime) return;
        worst = Math.max(worst, fearOf(t, o.id));
    });
    return worst;
}

/** Terror fades, but slowly — it is one of the stickier things in the arena. */
export function decayFear(state: GameState) {
    state.tributes.forEach(t => {
        if (t.status !== 'alive') return;
        const mem = ensureMemory(t);
        if (!mem.fear) return;
        Object.keys(mem.fear).forEach(id => {
            const next = mem.fear[id] * FEAR.decayPerCycle;
            if (next < 1) delete mem.fear[id];
            else mem.fear[id] = Math.round(next);
        });
    });
}
