import { Tribute } from '../../models/types';
import { AUDIT12_WAVE3 } from '../../data/balance';
import { legacyOf } from '../../data/districts';

/** AUDIT-12 wave 3 §12.8: "called the upset" — the crowns the book did not expect. */
/** Whether a victor counts as an upset: no kills, or a thin district. */
export function isUpsetVictor(t: Tribute): boolean {
    return t.kills === 0 || (AUDIT12_WAVE3.prediction.upsetTiers as readonly string[]).includes(legacyOf(t.district).tier);
}
