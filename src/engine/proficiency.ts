import { ArchetypeId, Item, Proficiency, Tribute } from '../models/types';
import { DRIFT, PROFICIENCY } from '../data/balance';
import { craftOf } from '../data/districts';
import { strengthCapForAge } from './physique';

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
    const current = profOf(t, skill);
    // Each level already held shrinks the next gain, so the curve flattens
    // toward the cap instead of specialists slamming into a wall by mid-run.
    // §3.7: necessity is the arena's tutor — gains accelerate as the run
    // wears on, so the top of the curve is actually reachable and a
    // survivalist visibly arrives somewhere by the endgame.
    const pressure = 1 + Math.min(PROFICIENCY.lateRunGainCap, t.daysSurvived * PROFICIENCY.lateRunGainPerDay);
    const gain = PROFICIENCY.gainPerUse * pressure * Math.pow(1 - PROFICIENCY.diminishingPerLevel, current);
    const next = Math.min(PROFICIENCY.max, current + gain);
    // Rounded so the value stays legible in a tooltip and in save files.
    t.proficiencies[skill] = Math.round(next * 100) / 100;
    // §3.1: crossing a whole level of a body-led skill earns back a fraction
    // of the matching attribute — the counterweight to injury and starvation.
    if (Math.floor(next) > Math.floor(current)) {
        t.attributeDrift = t.attributeDrift ?? {};
        // Capped both by DRIFT.maxGain and by the attribute scale itself (10).
        // §3.3: per-attribute ceilings — the frame has more room to grow in
        // eight days than judgement does.
        const capFor = (attr: keyof Tribute['attributes']): number =>
            attr === 'strength' ? DRIFT.maxGainStrength
            : attr === 'agility' ? DRIFT.maxGainAgility
            : attr === 'stealth' ? DRIFT.maxGainStealth
            : attr === 'intelligence' ? DRIFT.maxGainIntelligence
            : DRIFT.maxGain;
        const drift = (attr: keyof Tribute['attributes'], per: number) => {
            const held = t.attributeDrift![attr] ?? 0;
            if (held >= capFor(attr)) return;
            // Strength drift also respects the age ceiling — a fourteen-year-old
            // does not train past a fourteen-year-old's frame.
            const ceiling = attr === 'strength' ? Math.min(10, strengthCapForAge(t.age)) : 10;
            const inc = Math.min(per, capFor(attr) - held, ceiling - t.attributes[attr]);
            if (inc <= 0) return;
            t.attributeDrift![attr] = Math.round((held + inc) * 100) / 100;
            t.attributes[attr] = Math.round((t.attributes[attr] + inc) * 100) / 100;
        };
        if (skill === 'melee' || skill === 'ranged') drift('agility', DRIFT.agilityPerCombatLevel);
        else if (skill === 'tracking') drift('stealth', DRIFT.stealthPerTrackingLevel);
        // T-1: the arena plausibly changes everything. Fighting hand-to-hand
        // builds the arm behind the blade; working wounds and reading ground
        // sharpens judgement.
        if (skill === 'melee') drift('strength', DRIFT.strengthPerMeleeLevel);
        if (skill === 'medicine' || skill === 'forage') drift('intelligence', DRIFT.intelligencePerFieldcraftLevel);
    }
    return t.proficiencies[skill]!;
}

/** The weapon skill a given weapon class trains and benefits from. */
export function weaponProficiency(weaponClass: string | undefined): Proficiency {
    return weaponClass === 'ranged' || weaponClass === 'thrown' ? 'ranged' : 'melee';
}

/**
 * §3.3: the decay path. Earned combat drift is a habit, and habits fade — a
 * tribute who spends a cycle neither fighting nor hunting loses a sliver of
 * the strength and agility the arena taught them. Fieldcraft judgement
 * (intelligence, stealth) is knowledge and keeps. Drift is a curve, not a
 * ratchet.
 */
export function decayIdleDrift(t: Tribute): void {
    if (!t.attributeDrift) return;
    if (t.stance === 'Aggressive' || (t.momentum ?? 0) > 0) return;
    (['strength', 'agility'] as const).forEach(attr => {
        const held = t.attributeDrift![attr] ?? 0;
        if (held <= 0) return;
        const dec = Math.min(held, DRIFT.decayPerIdleCycle);
        t.attributeDrift![attr] = Math.round((held - dec) * 100) / 100;
        t.attributes[attr] = Math.round((t.attributes[attr] - dec) * 100) / 100;
    });
}
