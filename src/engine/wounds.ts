import { InjurySite, Tribute } from '../models/types';
import { BLEEDING, VITALS } from '../data/balance';
import { SimContext } from './context';
import { profOf, trainProficiency, observeProficiency } from './proficiency';
import { traitMod } from '../data/traits';
import { isAggressiveStance } from '../data/stances';
import { noteWoundTended, sepsisGrade } from './infection';

/**
 * Bleeding, and what a tribute can do about it.
 *
 * The old model was a boolean and a constant: 15 health per cycle, forever,
 * curable only by one of two loot items. It was by a wide margin the deadliest
 * thing in the arena — a third of all deaths — and it killed people who had
 * never met another tribute, which is the wrong story. Worse, it gave the
 * tribute no move to make. You either had a First Aid Kit or you died.
 *
 * Now a wound has a severity that clots down on its own, faster for a tribute
 * with the wits and the frame to manage it, and much faster if they spend a
 * turn actually dressing it — or if an ally does it for them, which finally
 * gives an alliance a medical reason to exist as well as a tactical one.
 */

/**
 * T-5: the graded-injury layer, generalising `bleedSeverity` to every site.
 * The booleans stay the flags every read site understands; the grade is how
 * bad it is. `injure` on an already-hurt site worsens it a step — a second
 * frost, a second dose of venom, a second blow to the same arm.
 */
const MAX_INJURY_GRADE = 3;

export function injure(t: Tribute, site: Exclude<InjurySite, 'bleeding'>, severity = 1) {
    const current = injuryGrade(t, site);
    // §3.1: an arm wound lands on a side. Deterministic from the tribute's own
    // id so it never consumes an RNG draw (which would change every seeded
    // replay), and biased toward the hand they actually lead with — the arm
    // you put out is the arm that gets opened.
    if (site === 'arms' && !t.woundedSide) {
        const lead = t.handedness ?? 'right';
        t.woundedSide = t.id.charCodeAt(t.id.length - 1) % 3 === 0
            ? (lead === 'left' ? 'right' : 'left')
            : lead;
    }
    t.injuries[site] = true;
    t.injurySeverity = t.injurySeverity ?? {};
    t.injurySeverity[site] = Math.min(MAX_INJURY_GRADE, Math.max(current + 1, severity));
}

/** 0 when the site is sound; 1-3 when it is not. Tolerates pre-grade saves. */
export function injuryGrade(t: Tribute, site: InjurySite): number {
    if (site === 'bleeding') return bleedSeverity(t);
    if (!t.injuries[site]) return 0;
    return Math.max(1, Math.min(MAX_INJURY_GRADE, t.injurySeverity?.[site] ?? 1));
}

/** Heals a site by `steps` grades; the boolean clears when the grade hits 0. */
export function healInjury(t: Tribute, site: Exclude<InjurySite, 'bleeding'>, steps = MAX_INJURY_GRADE) {
    const next = Math.max(0, injuryGrade(t, site) - steps);
    if (t.injurySeverity) t.injurySeverity[site] = next;
    if (next <= 0) {
        t.injuries[site] = false;
        if (t.injurySeverity) delete t.injurySeverity[site];
    }
}

/**
 * §3.6: per-site recovery, scarring, and what the rest of the field can see.
 *
 * Injury severity graded 0-3 and then never moved on its own: outside of bleed
 * clotting, a graded leg either persisted untouched or was dressed. A body
 * does neither. Each site now knits at its own rate — soft tissue faster than
 * a head wound — and each site that was ever taken all the way to grade 3
 * leaves a scar that does not heal at all.
 *
 * The visible half matters as much as the mechanical one: a tribute favouring
 * a leg or an arm is *legible*, and `visiblePower` in stance.ts reads it, so a
 * limp is now a reason somebody picks you.
 */
const RECOVERY_CYCLES: Partial<Record<InjurySite, number>> = {
    // Cycles of not being re-injured before the site steps down one grade.
    arms: 4,
    legs: 5,
    torso: 6,
    head: 8,
    burned: 5,
    frostbitten: 4,
    infected: 7,
    poisoned: 5,
};

/**
 * One cycle of the body doing its own work. Rest, food and a medic all help
 * through the existing paths; this is the floor beneath them — the thing that
 * happens whether or not anybody intervenes.
 */
export function tickWoundRecovery(ctx: SimContext, t: Tribute) {
    t.recoveryProgress = t.recoveryProgress ?? {};
    (Object.keys(RECOVERY_CYCLES) as InjurySite[]).forEach(site => {
        const grade = injuryGrade(t, site);
        if (grade <= 0) {
            delete t.recoveryProgress![site];
            return;
        }
        // §3.6: grade 3 is the threshold at which a wound stops being an
        // injury and starts being a fact about this person.
        if (grade >= MAX_INJURY_GRADE) {
            t.scars = t.scars ?? {};
            t.scars[site] = true;
        }
        // Starving and exhausted bodies do not knit. §3.5's interaction matrix
        // says the same thing from the other end.
        const stalled = t.vitals.hunger > VITALS.interactionHungerFrom
            || t.vitals.fatigue > VITALS.interactionFatigueFrom;
        if (stalled) return;
        const needed = RECOVERY_CYCLES[site]!;
        const progress = (t.recoveryProgress![site] ?? 0) + 1;
        if (progress < needed) {
            t.recoveryProgress![site] = progress;
            return;
        }
        t.recoveryProgress![site] = 0;
        // A scarred site never comes all the way back: it knits down to grade
        // 1 and stops there, permanently.
        //
        // §3.1: so does a septic one, for as long as it is septic. This is the
        // interaction that makes infection lethal rather than decorative —
        // without it the ordinary recovery pass quietly closed infected wounds
        // on its own schedule, the infection record went with them, and sepsis
        // could never reach the grade that kills. An infected wound does not
        // knit shut; it has to be treated first.
        const floor = (t.scars?.[site] || sepsisGrade(t, site) > 0) ? 1 : 0;
        if (grade - 1 < floor) return;
        healInjury(t, site as Exclude<InjurySite, 'bleeding'>, 1);
        if (injuryGrade(t, site) === 0) {
            ctx.logEvent(
                `${t.name}'s ${site === 'burned' ? 'burns' : site === 'frostbitten' ? 'frostbite' : `${site} wound`} has closed over. It took as long as it took.`,
                [t.id],
                { category: 'survival' }
            );
        }
    });
    updateFavouring(t);
}

/**
 * §3.6: the limb they are protecting, if any — the visible tell. Set from the
 * worst of arms and legs, cleared when both drop below the threshold.
 */
export function updateFavouring(t: Tribute) {
    const legs = injuryGrade(t, 'legs');
    const arms = injuryGrade(t, 'arms');
    const worst = Math.max(legs, arms);
    if (worst < 2) {
        delete t.favouring;
        return;
    }
    t.favouring = legs >= arms ? 'legs' : 'arms';
}

/** Multiplier a site's grade puts on its per-cycle status damage. */
export function gradeDamageScale(t: Tribute, site: InjurySite): number {
    return 1 + (injuryGrade(t, site) - 1) * BLEEDING.gradeDamageStep;
}

/** How badly `t` is bleeding right now. */
export function bleedSeverity(t: Tribute): number {
    if (!t.injuries.bleeding) return 0;
    // States written before severities existed still have to bleed sensibly:
    // an open wound with no recorded severity is treated as a moderate one.
    return t.bleedSeverity ?? BLEEDING.combatSeverity;
}

/** Opens (or worsens) a bleeding wound. A second cut does not stack forever. */
export function openWound(t: Tribute, severity: number) {
    t.injuries.bleeding = true;
    t.bleedSeverity = Math.min(
        BLEEDING.damageBySeverity.length - 1,
        Math.max(bleedSeverity(t), severity)
    );
}

/** Closes a wound completely. */
export function clearBleeding(t: Tribute) {
    t.injuries.bleeding = false;
    t.bleedSeverity = 0;
}

/** Per-cycle health cost of whatever is currently open. */
export function bleedDamage(t: Tribute): number {
    const raw = BLEEDING.damageBySeverity[bleedSeverity(t)] ?? 0;
    // Some people clot. Hardy is the difference between a wound that kills you
    // and a wound you walk four days with.
    return Math.max(0, raw * Math.max(0, 1 - traitMod(t, 'bleedResist')));
}

/** Odds the body closes one severity step by itself this cycle. */
function clotChance(t: Tribute): number {
    let chance = BLEEDING.baseClotChance
        + t.attributes.intelligence * BLEEDING.clotPerIntelligence
        + t.attributes.strength * BLEEDING.clotPerStrength;
    // Running and fighting tears a closing wound back open.
    if (isAggressiveStance(t.stance)) chance -= BLEEDING.aggressiveClotPenalty;
    // A body with nothing left cannot spend anything on repairs.
    if (t.vitals.fatigue > 80 || t.vitals.hunger > VITALS.starvingThreshold) {
        chance -= BLEEDING.exhaustedClotPenalty;
    }
    chance += traitMod(t, 'bleedResist') * 0.4;
    return Math.max(0.05, Math.min(0.85, chance));
}

/**
 * End-of-cycle clotting. Called once per tribute per cycle, after the wound has
 * taken its toll — so a fresh wound always costs something before it starts to
 * close.
 */
export function tickBleeding(ctx: SimContext, t: Tribute) {
    const severity = bleedSeverity(t);
    if (severity <= 0) return;
    if (!ctx.rng.chance(clotChance(t))) return;

    const next = severity - 1;
    if (next <= 0) {
        clearBleeding(t);
        ctx.logEvent(
            `${t.name}'s wound finally stops running. The bleeding has clotted.`,
            [t.id],
            { category: 'survival' }
        );
    } else {
        t.bleedSeverity = next;
    }
}

/** Anything a tribute could tear into strips and bind a wound with. */
function hasBinding(t: Tribute): boolean {
    return t.inventory.some(i => i.id === 'rope' || i.id === 'wire' || i.id === 'backpack' || i.type === 'medical');
}

function dressChance(medic: Tribute, isAlly: boolean): number {
    let chance = BLEEDING.dressBaseChance
        + medic.attributes.intelligence * BLEEDING.dressPerIntelligence
        + profOf(medic, 'medicine') * BLEEDING.dressPerMedicine;
    if (hasBinding(medic)) chance += BLEEDING.dressBindingBonus;
    // A2: the Medic archetype is the reason an alliance holds together. Their
    // hands on somebody else's wound are worth double — and, deliberately,
    // worth nothing extra on their own, which is what makes them terrible
    // alone and indispensable in company.
    if (medic.archetype === 'medic' && isAlly) chance *= BLEEDING.medicArchetypeMultiplier;
    // Someone else's steady hands beat your own on a wound you cannot see.
    if (isAlly) chance += BLEEDING.allyDressBonus;
    chance += traitMod(medic, 'medicine');
    return Math.max(0.05, Math.min(0.95, chance));
}

/**
 * A tribute spends their turn dressing a wound — their own, or an ally's.
 * Requires no item, which is the point: this is the move that was missing.
 * Returns whether the attempt succeeded.
 */
export function attemptFieldDressing(ctx: SimContext, patient: Tribute, medic: Tribute = patient): boolean {
    const severity = bleedSeverity(patient);
    if (severity <= 0) return false;
    // §3.1: a dressing is attention paid to the wound, so it restarts the
    // neglect clock on every open site whether or not the roll lands. It
    // deliberately does *not* touch an infection that has already taken hold —
    // that needs a medical kit and several days, not a bandage.

    const isAlly = medic.id !== patient.id;
    if (!ctx.rng.chance(dressChance(medic, isAlly))) {
        ctx.logEvent(
            isAlly
                ? `${medic.name} works at ${patient.name}'s wound and cannot get it to close.`
                : `${patient.name} tries to bind their own wound one-handed and only makes the bleeding worse.`,
            isAlly ? [patient.id, medic.id] : [patient.id],
            { category: 'survival' }
        );
        return false;
    }

    trainProficiency(medic, 'medicine', ctx);
    // §3.10: field medicine is the most watchable skill in the arena.
    observeProficiency(ctx, medic, 'medicine');
    // §3.1: a wound that has been cleaned and bound is not a neglected wound.
    // The incubation clock restarts on every open site, but only on a dressing
    // that actually landed — fumbling with a bandage is not care. It does not
    // touch an infection that has already taken hold; that needs a medical kit
    // and several days, which is the whole distinction the infection axis is
    // there to draw.
    (['arms', 'legs', 'torso', 'head', 'burned'] as InjurySite[]).forEach(site => noteWoundTended(patient, site));
    const next = Math.max(0, severity - BLEEDING.dressSeverityDrop);
    if (next <= 0) {
        clearBleeding(patient);
        ctx.logEvent(
            isAlly
                ? `${medic.name} packs and binds ${patient.name}'s wound properly. The bleeding stops.`
                : `${patient.name} tears a strip off and binds their wound tight. The bleeding stops.`,
            isAlly ? [patient.id, medic.id] : [patient.id],
            { important: true, category: 'survival' }
        );
    } else {
        patient.bleedSeverity = next;
        ctx.logEvent(
            isAlly
                ? `${medic.name} gets a dressing onto ${patient.name}'s wound. It is still running, but slower.`
                : `${patient.name} gets a rough dressing onto the wound. It is still running, but slower.`,
            isAlly ? [patient.id, medic.id] : [patient.id],
            { category: 'survival' }
        );
    }
    return true;
}

/**
 * Whether a tribute should spend this turn on the wound instead of foraging or
 * hunting. A slow trickle is worth ignoring; a severity-3 wound is the most
 * urgent thing in their life.
 */
export function shouldDressWound(t: Tribute): boolean {
    const severity = bleedSeverity(t);
    if (severity <= 0) return false;
    return severity >= 2 || t.health < 60;
}
