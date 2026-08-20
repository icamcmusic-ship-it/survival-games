import { ArchetypeId, Item, Proficiency, Tribute } from '../models/types';
import { PROFICIENCY } from '../data/balance';
import { craftOf } from '../data/districts';

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

/**
 * What a tribute walks in already knowing: their archetype's speciality, plus
 * whatever twelve years of their district's trade taught them. The two stack,
 * capped at the same ceiling as earned skill, so a District 4 survivalist is
 * genuinely the best forager on the plates without being off the scale.
 */
export function blankProficiencies(archetype: ArchetypeId, district?: number): Partial<Record<Proficiency, number>> {
    const start: Partial<Record<Proficiency, number>> = {
        [ARCHETYPE_SPECIALITY[archetype]]: PROFICIENCY.archetypeHeadStart,
    };
    if (district !== undefined) {
        Object.entries(craftOf(district).proficiencies).forEach(([skill, value]) => {
            const key = skill as Proficiency;
            start[key] = Math.min(PROFICIENCY.max, (start[key] ?? 0) + (value ?? 0));
        });
    }
    return start;
}

/**
 * Weapon familiarity, by district of origin.
 *
 * `WEAPON_KILL_TEMPLATES` writes a bespoke death for the trident and the arena
 * then handed it to whoever happened to grab it. A tribute who grew up with a
 * gaff in their hands fights better with a trident than with a mace; a tribute
 * from the Seam is better with a knife than with either. Returns a flat power
 * bonus — familiarity, not mastery, which is what proficiency is for.
 */
export function weaponAffinity(t: Tribute, weapon?: Item): number {
    if (!weapon) return 0;
    const craft = craftOf(t.district);
    if (craft.affinityItems.includes(weapon.id)) return PROFICIENCY.affinityItemBonus;
    if (weapon.weaponClass && craft.affinityClasses.includes(weapon.weaponClass)) return PROFICIENCY.affinityClassBonus;
    return 0;
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
