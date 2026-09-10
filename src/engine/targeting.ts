import { Tribute } from '../models/types';
import { TraitMod, traitMod } from '../data/traits';
import { ARCHETYPES } from '../data/archetypes';

/**
 * How much the field wants this tribute, summed across everything about them.
 *
 * `targetDraw` started as a trait modifier (Unremarkable is nothing but this)
 * and is now an archetype axis too — §8: Career was dominant on win rate,
 * survival AND kills simultaneously, so it needed a cost that the other
 * fourteen archetypes do not pay. Every site that used to read
 * `traitMod(t, 'targetDraw')` reads this instead, so the two sources apply in
 * exactly the same places and on the same scale.
 */
export function targetDrawOf(t: Tribute): number {
    return traitMod(t, 'targetDraw' as TraitMod) + (ARCHETYPES[t.archetype]?.targetDraw ?? 0);
}
