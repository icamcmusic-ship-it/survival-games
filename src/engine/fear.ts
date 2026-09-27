import { profOf, trainProficiency } from './proficiency';
import { heartenedScale } from './audit13Content';
import { ARCHETYPES } from '../data/archetypes';
import { GameState, Tribute } from '../models/types';
import { AUDIT13_CAREERS, FEAR, MEMORY, PROFICIENCY } from '../data/balance';
import { cyclesSinceContact, ensureMemory, rememberedPlaceOf } from './memory';
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

/**
 * AUDIT-13 K3/K5: how much of a fright from an outsider sticks to a Career.
 * Nothing discounted it before, so by day 2 three Careers in four held >= 30
 * fear of some outsider. A volunteer asked to be here and gets the full
 * discount; a reaped Career about half of it. Career-on-Career fear, and
 * everything an outsider feels, is untouched.
 */
export function careerOutsiderScale(t: Tribute, other: Tribute | undefined, scales: { volunteer: number; reaped: number }): number {
    if (!t.isCareer || !other || other.isCareer) return 1;
    return t.volunteered ? scales.volunteer : scales.reaped;
}

export const CAREER_FEAR_SCALES = {
    volunteer: AUDIT13_CAREERS.volunteerOutsiderFearScale,
    reaped: AUDIT13_CAREERS.reapedOutsiderFearScale,
};

/**
 * `about` is the person the fear is of, when the caller knows it but that
 * person is not frightening anybody on purpose (a kill witnessed, an exchange
 * lost) — so it can be read for the K3 discount without being credited as
 * intimidation. `source`, when it is the same person, serves for both.
 */
export function addFear(t: Tribute, otherId: string, amount: number, source?: Tribute, about?: Tribute) {
    if (t.id === otherId) return;
    // AUDIT-13 K3: a Career's fear of an outsider mostly does not stick.
    const other = source?.id === otherId ? source : about?.id === otherId ? about : undefined;
    amount *= careerOutsiderScale(t, other, CAREER_FEAR_SCALES);
    // §(requests, deferred): being frightening is a skill. `source` is the
    // person doing the frightening, where the caller knows who that is;
    // everything that frightens nobody in particular (a mutt, the border, the
    // dark) leaves it unset and is unaffected.
    // AUDIT-6 §12.2 `intimidation`: read on the same scale as the proficiency,
    // so a trait that makes somebody frightening stacks with having got better
    // at it — the pattern `traitProficiencyFloor` already establishes.
    if (source && source.id === otherId) {
        amount *= 1 + (profOf(source, 'intimidation') + traitMod(source, 'intimidation')) * FEAR.perIntimidationPoint;
    }
    // A2: a Zealot is not frightened — `fearScale: 0` on the archetype sheet,
    // alongside the other extreme-variance archetypes' own scales, rather than
    // a carve-out for one id here. `t` is the tribute *becoming* afraid, so
    // this is how much of a frightening thing sticks to them, which is what the
    // data sheet documents. The comment used to read "does not frighten",
    // describing the opposite direction; the code has always been right.
    amount *= ARCHETYPES[t.archetype].fearScale ?? 1;
    // Temperament decides how much of a frightening thing actually sticks.
    amount *= Math.max(0, 1 + traitMod(t, 'fearGain'));
    // AUDIT-13 N2: a Loud Heart on their side, standing next to them.
    amount *= heartenedScale(t);
    if (amount <= 0) return;
    const mem = ensureMemory(t);
    if (!mem.fear) mem.fear = {};
    mem.fear[otherId] = Math.min(FEAR.max, Math.round((mem.fear[otherId] ?? 0) + amount));
    /*
     * AUDIT-8 §3.5: being frightening is a skill, and it had two training
     * sites — a training-floor beat and the parley standoff (76 per 400 runs,
     * against a field of ~19 a run). 91.7% of tributes never trained it, so
     * the multiplier eleven lines above was reading zero for almost everybody.
     *
     * Fear is put into people constantly and by name: this is the occasion,
     * and it was already here. Partial share, because frightening somebody who
     * was already frightened of you is a smaller lesson than the first time.
     */
    if (source && source.id === otherId) {
        trainProficiency(source, 'intimidation', undefined, PROFICIENCY.intimidationPerFearShare);
    }
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
        // AUDIT-9 B11: only what they believe, and now actually only that.
        //
        // This used to test `o.zone` — the rival's *true* position — gated on
        // recent contact, which reads like a belief and is not one: moving an
        // unseen rival moved 80 points of dread from the zone the observer had
        // last seen them in to the one they had just walked into, with no
        // observation anywhere in between. The observer was tracking an unseen
        // movement. `rememberedPlaceOf` is the sighting they actually made, so
        // it can now be out of date — which is the entire point, and what makes
        // a concealed route, a decoy or a stale report worth anything.
        if (rememberedPlaceOf(state, t, o.id) !== zoneName) return;
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
