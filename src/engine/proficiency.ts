import { ArchetypeId, Item, Proficiency, Tribute } from '../models/types';
import { DRIFT, PROFICIENCY } from '../data/balance';
import { craftOf } from '../data/districts';
import { strengthCapForAge } from './physique';
import { isAggressiveStance } from '../data/stances';
import { SimContext } from './context';
import { fill } from './encounters';

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
    // A2: the added roster. §1.4's `persuasion` is what makes Diplomat and
    // Mercenary mechanical rather than decorative.
    mercenary: 'melee',
    zealot: 'melee',
    medic: 'medicine',
    saboteur: 'tracking',
    beast: 'melee',
    diplomat: 'persuasion',
    scholar: 'forage',
    ghost: 'tracking',
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
export function trainProficiency(t: Tribute, skill: Proficiency, ctx?: SimContext): number {
    if (!t.proficiencies) t.proficiencies = {};
    const current = profOf(t, skill);
    // Each level already held shrinks the next gain, so the curve flattens
    // toward the cap instead of specialists slamming into a wall by mid-run.
    // §3.7: necessity is the arena's tutor — gains accelerate as the run
    // wears on, so the top of the curve is actually reachable and a
    // survivalist visibly arrives somewhere by the endgame.
    const pressure = 1 + Math.min(PROFICIENCY.lateRunGainCap, t.daysSurvived * PROFICIENCY.lateRunGainPerDay);
    // §3.9: the curve was too flat at the bottom to be felt. Board sampling
    // put the average proficiency at 1.85 against a cap of 6, which meant most
    // tributes spent an entire run inside the noise floor of a system that is
    // supposed to be the visible difference between day one and day eight.
    // The first two levels come fast — that is where real skill acquisition
    // lives — and the diminishing term still binds everything above it.
    const early = current < PROFICIENCY.earlyBand ? PROFICIENCY.earlyGainMultiplier : 1;
    const gain = PROFICIENCY.gainPerUse * pressure * early * Math.pow(1 - PROFICIENCY.diminishingPerLevel, current);
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
    // §3.9: crossing into a named band is a visible thing about a person, and
    // the only part of the proficiency system a viewer can see without a
    // tooltip. Narrated at whichever call sites thread a context through.
    if (ctx) {
        const before = bandOf(current);
        const after = bandOf(next);
        if (after && after !== before) {
            ctx.logEvent(fill(ctx.pickText(BAND_LINES[after][skill] ?? BAND_LINES[after].default), {
                tribute: t.name,
            }), [t.id], { category: 'survival' });
        }
    }
    return t.proficiencies[skill]!;
}

/** §3.9: the three bands a proficiency can read as, or undefined below them all. */
export type ProficiencyBand = 'competent' | 'skilled' | 'expert';

export function bandOf(level: number): ProficiencyBand | undefined {
    if (level >= PROFICIENCY.expertBand) return 'expert';
    if (level >= PROFICIENCY.skilledBand) return 'skilled';
    if (level >= PROFICIENCY.competentBand) return 'competent';
    return undefined;
}

/** Band label for the tribute sheet — "Skilled forager" and so on. */
export function bandLabel(level: number): string | undefined {
    const band = bandOf(level);
    return band ? band.charAt(0).toUpperCase() + band.slice(1) : undefined;
}

/**
 * The line the feed runs when somebody crosses a band. Per skill where the
 * skill has a picture worth painting, and a fallback where it does not.
 */
const BAND_LINES: Record<ProficiencyBand, Partial<Record<Proficiency, string[]>> & { default: string[] }> = {
    competent: {
        forage: ['{tribute} has stopped guessing at which plants are which. They pick, they check, they move on.'],
        melee: ['{tribute} has stopped swinging like someone who has never swung anything.'],
        medicine: ['{tribute} ties off a dressing without having to think about the order of it.'],
        default: ['{tribute} is getting the hang of this, which is not nothing out here.'],
    },
    skilled: {
        forage: ['{tribute} works the treeline the way somebody works a garden they know.'],
        ranged: ['{tribute} looses without checking their grip first. The arrow goes where they were looking.'],
        tracking: ['{tribute} reads the ground for a moment and then walks straight to where somebody stood.'],
        default: ['{tribute} is good at this now. The arena taught them and they were paying attention.'],
    },
    expert: {
        forage: ['{tribute} has done this a hundred times now, and it shows in how little of it they have to look at.'],
        melee: ['{tribute} fights like it has stopped costing them anything to decide.'],
        medicine: ['{tribute} works the wound with the flat competence of somebody who has stopped being frightened of blood.'],
        default: ['{tribute} has done this a hundred times now. Whatever they were on the plate, they are not that.'],
    },
};

/**
 * §3.10: learning by watching.
 *
 * A tribute could watch an ally build a fire, set a snare or purify water every
 * cycle for a week and come away knowing exactly nothing — skill only ever came
 * from doing. Watching somebody who is better than you is most of how anybody
 * learns anything, and it is gated on the attribute that ought to gate it:
 * intelligence decides whether you saw a technique or merely a person crouching.
 *
 * The teacher must actually be ahead of the student, which makes an alliance
 * with a survivalist in it worth something beyond the shared cache, and gives
 * the Scholar and the district-craft head starts somewhere to propagate to.
 */
export function observeProficiency(ctx: SimContext, actor: Tribute, skill: Proficiency) {
    const teaching = profOf(actor, skill);
    if (teaching < PROFICIENCY.observeMinTeacher) return;
    ctx.state.tributes.forEach(watcher => {
        if (watcher.id === actor.id || watcher.status !== 'alive' || watcher.zone !== actor.zone) return;
        if (profOf(watcher, skill) >= teaching - PROFICIENCY.observeMinGap) return;
        const chance = PROFICIENCY.observeBaseChance
            + (watcher.attributes.intelligence - 5) * PROFICIENCY.observePerIntelligence;
        if (!ctx.rng.chance(Math.max(0, chance))) return;
        // Watching is worth a fraction of doing, and it is deliberately not
        // narrated per instance — the band-crossing line above is where it
        // surfaces, which is the only place it is interesting.
        const before = profOf(watcher, skill);
        trainProficiency(watcher, skill);
        const gained = profOf(watcher, skill) - before;
        watcher.proficiencies![skill] = Math.round((before + gained * PROFICIENCY.observeShare) * 100) / 100;
    });
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
    if (isAggressiveStance(t.stance) || (t.momentum ?? 0) > 0) return;
    (['strength', 'agility'] as const).forEach(attr => {
        const held = t.attributeDrift![attr] ?? 0;
        if (held <= 0) return;
        const dec = Math.min(held, DRIFT.decayPerIdleCycle);
        t.attributeDrift![attr] = Math.round((held - dec) * 100) / 100;
        t.attributes[attr] = Math.round((t.attributes[attr] - dec) * 100) / 100;
    });
}
