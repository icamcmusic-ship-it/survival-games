import { Tribute } from '../models/types';
import { SANITY_BANDS } from '../data/balance';

/**
 * §3.5: sanity reads as four visible behavioural states rather than one
 * number with one hack. Each band has its own residue:
 *
 *  - steady:      nothing.
 *  - frayed:      cover starts slipping (the existing sanityStealthLoss path).
 *  - unravelling: they stop trusting what they forage; parleys get harder.
 *  - gone:        they abandon what they carry, and the first visit down here
 *                 leaves a permanent mark (sanityScarred).
 */
export type SanityBand = 'steady' | 'frayed' | 'unravelling' | 'gone';

export function sanityBandOf(t: Tribute): SanityBand {
    const s = t.vitals.sanity;
    if (s <= SANITY_BANDS.gone) return 'gone';
    if (s <= SANITY_BANDS.unravelling) return 'unravelling';
    if (s <= SANITY_BANDS.frayed) return 'frayed';
    return 'steady';
}
