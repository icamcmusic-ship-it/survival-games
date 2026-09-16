import { Tribute } from '../models/types';
import { SANITY, SANITY_BANDS } from '../data/balance';
import { traitMod } from '../data/traits';

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

/**
 * Audit 4 §3.2: the one place sanity is taken.
 *
 * Sanity was written directly by **thirty-odd call sites** — mutt fear auras,
 * exposure, the anthem, betrayal, grief, parley tolls, arena signatures,
 * Gamemaker interventions, training, triangles — each doing
 * `t.vitals.sanity -= N` on its own account. Nothing bounded their sum,
 * nothing knew what band the tribute was in, and `traitMod('sanityDrain')` —
 * the temperament dial that is supposed to decide who falls apart under this
 * and who does not — was applied by `applySanityPressure` and by nothing else.
 *
 * The measurement that found it: disabling `applySanityPressure` *entirely*
 * left the sanity-by-day curve essentially unchanged (mean 94 / 81 / 63 / 53 /
 * 39 / 27 / 18 with the gauge off, against 94 / 81 / 62 / 55 / 40 / 26 / 19
 * with it on). The function carrying all the design reasoning was contributing
 * almost nothing; the scattered subtractions were the whole system. Which is
 * why three audits' worth of tuning the gauge's constants never moved the
 * distribution, and why 31% of all tribute-time sat at sanity 0-9.
 *
 * So every loss now goes through here and gets the two things the gauge always
 * had and the direct writes never did:
 *
 *  1. **Temperament.** Stoic, Cool-Headed, Grim and Broken now apply against
 *     the ~95% of sanity loss they previously did not touch.
 *  2. **The empty-gauge easing.** A mind most of the way gone has less left to
 *     take, so the bottom of the scale is a basin instead of a pit — the same
 *     curve `applySanityPressure` uses, applied to the losses that actually
 *     dominate.
 *
 * Gains stay direct: what pulls somebody back up should not be discounted for
 * being needed, and there are few enough of them to read at a glance.
 */
export function loseSanity(t: Tribute, amount: number): void {
    if (amount <= 0) return;
    const temperament = Math.max(SANITY_BANDS.minTemperamentScale, 1 + traitMod(t, 'sanityDrain'));
    const easing = SANITY.emptyGaugeDrainFloor
        + (1 - SANITY.emptyGaugeDrainFloor) * Math.max(0, Math.min(1, t.vitals.sanity / 100));
    t.vitals.sanity = Math.max(0, t.vitals.sanity - amount * temperament * easing);
}
