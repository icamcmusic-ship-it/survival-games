import { Tribute } from '../models/types';
import { NOTORIETY } from '../data/balance';
import { SimContext } from './context';
import { addFear } from './fear';
import { addExcitement } from './audience';

/**
 * R-5: reputation among the tributes.
 *
 * `reputation` is the Capitol's opinion — the baseline sponsor trust drifts
 * back toward. `memory.fear` is one observer's private dread of one person.
 * Neither of them can express the thing the arena obviously knows: kills are
 * announced by cannon and read from the sky every night, so by day six the
 * whole field knows which name has four next to it. That was only expressible
 * as N individual fear entries written by N separate witnesses, which meant
 * the tribute nobody happened to *watch* kill anyone stayed anonymous however
 * many they killed.
 *
 * Notoriety is that aggregate: earned publicly, known universally, and paid
 * out as a floor under everyone's fear of them rather than as a second fear
 * system.
 */

export function notorietyOf(t: Tribute): number {
    return t.notoriety ?? 0;
}

export function isNotorious(t: Tribute): boolean {
    return notorietyOf(t) >= NOTORIETY.knownThreshold;
}

/** Something public and frightening. The sky tells everybody. */
export function addNotoriety(ctx: SimContext, t: Tribute, amount: number) {
    const before = notorietyOf(t);
    t.notoriety = Math.min(NOTORIETY.max, before + amount);
    // The Capitol adores a monster, within reason.
    addExcitement(t, Math.round(amount * NOTORIETY.excitementPerPoint));

    if (before < NOTORIETY.knownThreshold && t.notoriety >= NOTORIETY.knownThreshold) {
        ctx.logEvent(
            `There is a name the rest of the field says carefully now, and it is ${t.name}'s. `
            + `Nobody left in this arena needs to have met them to be afraid of them.`,
            [t.id],
            { important: true, category: 'kill' }
        );
    }
}

/**
 * The floor notoriety puts under everyone else's fear. Applied once a cycle
 * rather than at the moment of the kill, because this is the arena catching
 * up with the news rather than anybody witnessing anything.
 */
export function spreadNotoriety(ctx: SimContext) {
    const known = ctx.state.tributes.filter(t => t.status === 'alive' && isNotorious(t));
    if (known.length === 0) return;
    known.forEach(feared => {
        const share = (notorietyOf(feared) / NOTORIETY.max) * NOTORIETY.ambientFearAtMax;
        ctx.state.tributes.forEach(other => {
            if (other.status !== 'alive' || other.id === feared.id) return;
            // Allies are not frightened of their own — they are the ones
            // standing behind the reputation.
            if (other.allianceId !== undefined && other.allianceId === feared.allianceId) return;
            const held = other.memory?.fear?.[feared.id] ?? 0;
            if (held >= share) return;
            addFear(other, feared.id, share - held);
        });
    });
}
