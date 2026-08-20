import { ArchetypeId, Proficiency, Tribute } from '../models/types';
import { PROFICIENCY } from '../data/balance';

/**
 * Skills that improve with use.
 *
 * Attributes are rolled at the reaping, nudged once in training, and then
 * frozen for the rest of the run — a tribute who foraged successfully ten times
 * was no better at it on day 8 than on day 1. Proficiencies are the thin layer
 * that fixes that: a few points of swing, earned by doing the thing, feeding
 * back into the roll for the thing.
 *
 * They are deliberately small. The point is that a survivalist visibly becomes
 * a survivalist over a run, not that a second stat system quietly out-weighs
 * the first.
 */

/** The skill each archetype comes into the arena already leaning on. */
const ARCHETYPE_SPECIALITY: Record<ArchetypeId, Proficiency> = {
    career: 'melee',
    strategist: 'tracking',
    survivalist: 'forage',
    protector: 'medicine',
    trickster: 'tracking',
    wildcard: 'ranged',
    underdog: 'forage',
};

export function blankProficiencies(archetype: ArchetypeId): Partial<Record<Proficiency, number>> {
    return { [ARCHETYPE_SPECIALITY[archetype]]: PROFICIENCY.archetypeHeadStart };
}

/** Current level, tolerating states saved before proficiencies existed. */
export function profOf(t: Tribute, skill: Proficiency): number {
    return t.proficiencies?.[skill] ?? 0;
}

/**
 * Records a successful use. Returns the new level so callers can narrate a
 * milestone if they want one.
 */
export function trainProficiency(t: Tribute, skill: Proficiency): number {
    if (!t.proficiencies) t.proficiencies = {};
    const next = Math.min(PROFICIENCY.max, profOf(t, skill) + PROFICIENCY.gainPerUse);
    // Rounded so the value stays legible in a tooltip and in save files.
    t.proficiencies[skill] = Math.round(next * 100) / 100;
    return t.proficiencies[skill]!;
}

/** The weapon skill a given weapon class trains and benefits from. */
export function weaponProficiency(weaponClass: string | undefined): Proficiency {
    return weaponClass === 'ranged' || weaponClass === 'thrown' ? 'ranged' : 'melee';
}
