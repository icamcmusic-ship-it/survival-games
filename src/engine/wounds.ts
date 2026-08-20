import { Tribute } from '../models/types';
import { BLEEDING, VITALS } from '../data/balance';
import { SimContext } from './context';
import { profOf, trainProficiency } from './proficiency';
import { traitMod } from '../data/traits';

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
    if (t.stance === 'Aggressive') chance -= BLEEDING.aggressiveClotPenalty;
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

    trainProficiency(medic, 'medicine');
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
