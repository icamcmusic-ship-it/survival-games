import { Tribute, attr } from '../models/types';
import { SOCIAL_AXES } from '../data/balance';
import { traitMod } from '../data/traits';
import { effectiveCharisma } from './physique';
import { profOf } from './proficiency';

/**
 * §3.4: momentum and rattled are one mechanic with opposite signs — a
 * signed composure value. Reading them through one helper gives the state
 * more read sites (forage, sponsor appeal, parley willingness) without a
 * save-format change: every existing payload keeps its two counters.
 */
export function composureOf(t: Tribute): number {
    return (t.momentum ?? 0) - (t.rattled ?? 0);
}

/**
 * §3.2: the jobs `sanity` and `charisma` were each doing on their own.
 *
 * The precedent is the endurance split documented on `Attributes`: fatigue
 * used to decide both "can fight" and "can keep walking", so the second job
 * was given its own scalar and the first kept the name. Two cases were left
 * unsplit, and they are the two biggest ones in the model.
 *
 *   sanity     ran breakdown risk, hallucination, alliance affinity and
 *              audience appeal off one number — and it is the largest single
 *              category in the chronicle at 13.6% of all lines, ahead of
 *              combat (7.9%) and survival (9.1%). A stat producing one line in
 *              seven is carrying too much narrative load to also be a
 *              mechanical scalar. `vitals.sanity` keeps the mechanical half:
 *              breakdown, hallucination, `sanityBandOf`. `poiseOf` is the
 *              social half.
 *
 *   charisma   fed interviews, sponsors, alliance recruitment, parley and
 *              rumour credibility with no separation at all between being
 *              liked and being believed. `warmthOf` is the first, `rhetoricOf`
 *              the second.
 *
 * All three are *derived*, not stored. That is the deliberate difference from
 * the endurance split, which could afford a new rolled attribute because it
 * landed with a generator change. These land in a live save format: nothing
 * new is written, `Attributes` is untouched, every existing read of
 * `charisma` or `vitals.sanity` keeps returning exactly what it returned
 * before, and call sites move across one at a time. The weights are in
 * `SOCIAL_AXES`.
 */

/**
 * How intact a tribute *looks*, 0-100.
 *
 * Deliberately not the same number as sanity, and deliberately lagging it: a
 * person coming apart in private holds it together in front of other people,
 * and how much they hold together is willpower plus whatever the last few
 * cycles have done to them. This is what an ally weighing a recruitment and a
 * sponsor weighing a parachute should be reading — not the private number.
 */
export function poiseOf(t: Tribute): number {
    const held = (attr(t, 'willpower') - 5) * SOCIAL_AXES.poisePerWillpower
        + composureOf(t) * SOCIAL_AXES.poisePerComposure;
    return Math.max(0, Math.min(100, t.vitals.sanity + held));
}

/** Poise below the midpoint, in ten-point steps. Zero for anyone holding up. */
function poiseDeficit(t: Tribute): number {
    return Math.max(0, SOCIAL_AXES.poiseMidpoint - poiseOf(t)) / 10;
}

/**
 * The likeable half of charisma: how much other people want this person near
 * them. Alliance affinity, being taken in, being kept.
 *
 * Kills cost warmth and cost nothing else. Being an asset and being a comfort
 * are different currencies, and the tribute who has opened four people up is
 * running out of the second one whatever their sheet says.
 */
export function warmthOf(t: Tribute): number {
    return Math.max(0, effectiveCharisma(t)
        - t.kills * SOCIAL_AXES.warmthPerKill
        + traitMod(t, 'allianceAffinity') * SOCIAL_AXES.warmthPerAffinity
        - poiseDeficit(t) * SOCIAL_AXES.warmthPerPoiseStep);
}

/**
 * The persuasive half: how much weight this person's argument carries. Parley,
 * sponsor pitches, rumour credibility, talking a truce into holding.
 *
 * Reads the *printed* charisma rather than the effective one, and pays no
 * kill penalty. An argument does not stop working because the person making
 * it is frightening or is having a bad week — what it does stop working for
 * is somebody visibly unravelling, which is what the poise term is. Trained
 * `persuasion` is the largest single input, which is the whole reason the
 * charisma training station exists.
 */
export function rhetoricOf(t: Tribute): number {
    return Math.max(0, t.attributes.charisma
        + profOf(t, 'persuasion') * SOCIAL_AXES.rhetoricPerPersuasion
        + attr(t, 'intelligence') * SOCIAL_AXES.rhetoricPerIntelligence
        - poiseDeficit(t) * SOCIAL_AXES.rhetoricPerPoiseStep);
}
