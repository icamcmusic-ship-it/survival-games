import { Tribute } from '../models/types';
import { TraitMod, traitMod } from '../data/traits';
import { ARCHETYPES } from '../data/archetypes';
import { LEGACY_EFFECTS, legacyOf } from '../data/districts';

/**
 * How much the field wants this tribute, summed across everything about them.
 *
 * `targetDraw` started as a trait modifier (Unremarkable is nothing but this)
 * and is now an archetype axis too — §8: Career was dominant on win rate,
 * survival AND kills simultaneously, so it needed a cost that the other
 * fourteen archetypes do not pay. Every site that used to read
 * `traitMod(t, 'targetDraw')` reads this instead, so the two sources apply in
 * exactly the same places and on the same scale.
 *
 * AUDIT-6 §8.5: the district's legacy is the third source, and the first one
 * that is about reputation the tribute did not earn. A storied district's
 * tribute is somebody the other twenty-three have heard of before the gong;
 * a forgotten district's tribute is not, and being unwatched is the only edge
 * an unfancied tribute starts the Games holding.
 */
export function targetDrawOf(t: Tribute): number {
    return traitMod(t, 'targetDraw' as TraitMod)
        + (ARCHETYPES[t.archetype]?.targetDraw ?? 0)
        + LEGACY_EFFECTS[legacyOf(t.district).tier].targetDraw;
}
