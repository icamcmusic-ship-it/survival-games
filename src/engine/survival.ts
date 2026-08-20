import { Tribute } from '../models/types';
import { INJURY_DAMAGE, MEDICAL, TRAIT_EFFECTS, VITALS } from '../data/balance';
import { SimContext, getAlive } from './context';
import { applyDamage, checkDeath } from './combat';
import { climateOf } from './climate';
import { applyExposure } from './exposure';
import { getZone } from './map';
import { spoilageBonus } from './items';
import { clampTribute } from './vitals';

/**
 * Staying alive between encounters: spoilage, hunger, thirst, exposure, wounds
 * and whatever is left in the medical kit.
 */

/** Food rots. A Backpack keeps it out of the sun a little longer. */
export function processSpoilage(ctx: SimContext) {
    getAlive(ctx.state).forEach(t => {
        const shelf = spoilageBonus(t) > 0 ? 0.5 : 1;
        t.inventory = t.inventory.filter(item => {
            if (item.type === 'food' && item.spoilage !== undefined) {
                item.spoilage -= shelf;
                if (item.spoilage <= 0) {
                    ctx.logEvent(`${t.name} throws away their spoiled ${item.name}.`, [t.id], { category: 'survival' });
                    return false;
                }
            }
            return true;
        });
    });
}

/** Terrain, climate and traits, applied as modifiers to the base drains. */
function drainsFor(ctx: SimContext, t: Tribute, time: 'day' | 'night') {
    let hunger = VITALS.hungerDrain;
    let thirst = VITALS.thirstDrain;
    let fatigue = time === 'day' ? VITALS.fatigueDayDrain : VITALS.fatigueNightRecovery;

    const zone = getZone(ctx.state.arena, t.zone);
    if (zone) {
        if (zone.terrain === 'water' || zone.terrain === 'wetland') thirst -= VITALS.waterThirstRelief;
        if (zone.terrain === 'highland') fatigue += VITALS.highlandFatiguePenalty;
        if (zone.terrain === 'forest' && time === 'night') fatigue -= VITALS.forestNightShelter;
    }

    const climate = climateOf(ctx.state.arena.id);
    if (climate?.drains) {
        if (climate.drains.thirstMultiplier) thirst *= climate.drains.thirstMultiplier;
        if (climate.drains.fatigue) fatigue += climate.drains.fatigue;
    }

    if (t.traits.includes('Hydrophilic')) thirst -= TRAIT_EFFECTS.hydrophilicThirstRelief;
    if (t.traits.includes('Insomniac') && time === 'night') fatigue += TRAIT_EFFECTS.insomniacNightFatigue;
    if (t.traits.includes('Iron Stomach')) hunger -= TRAIT_EFFECTS.ironStomachHungerRelief;
    // Younger tributes burn through rations faster and sleep worse.
    if (t.age <= TRAIT_EFFECTS.youngAge) {
        hunger += TRAIT_EFFECTS.youngHungerPenalty;
        fatigue += TRAIT_EFFECTS.youngFatiguePenalty;
    }

    return { hunger, thirst, fatigue };
}

/** Untreated wounds and empty canteens, each attributed to what caused them. */
function applyStatusDamage(ctx: SimContext, t: Tribute) {
    if (t.vitals.hunger > VITALS.starvingThreshold) {
        applyDamage(ctx, t, VITALS.starvingDamage, { cause: 'Died of starvation', kind: 'status' });
    }
    if (t.vitals.thirst > VITALS.dehydratedThreshold) {
        applyDamage(ctx, t, VITALS.dehydratedDamage, { cause: 'Died of dehydration', kind: 'status' });
    }
    if (t.injuries.bleeding) {
        applyDamage(ctx, t, INJURY_DAMAGE.bleeding, { cause: 'Bled out from untreated wounds', kind: 'status' });
    }
    if (t.injuries.infected) {
        applyDamage(ctx, t, INJURY_DAMAGE.infected, { cause: 'Succumbed to an infected wound', kind: 'status' });
    }
    if (t.injuries.poisoned) {
        applyDamage(ctx, t, INJURY_DAMAGE.poisoned, { cause: 'Succumbed to poison', kind: 'status' });
        t.vitals.sanity -= INJURY_DAMAGE.poisonSanity;
    }
    if (t.injuries.burned) {
        applyDamage(ctx, t, INJURY_DAMAGE.burned, { cause: 'Died of untreated burns', kind: 'status' });
    }
    if (t.injuries.frostbitten) {
        applyDamage(ctx, t, INJURY_DAMAGE.frostbitten, { cause: 'Froze to death', kind: 'status' });
    }
    clampTribute(t);
}

/** Eating, drinking, and working through whatever medical supplies they have. */
function consumeSupplies(ctx: SimContext, t: Tribute) {
    if (t.vitals.hunger > VITALS.eatThreshold) {
        const foodIdx = t.inventory.findIndex(i => i.type === 'food');
        if (foodIdx >= 0) {
            const food = t.inventory.splice(foodIdx, 1)[0];
            t.vitals.hunger = Math.max(0, t.vitals.hunger - VITALS.foodRelief);
            ctx.logEvent(`${t.name} eats their ${food.name}.`, [t.id], { category: 'survival' });
        }
    }
    if (t.vitals.thirst > VITALS.drinkThreshold) {
        const waterIdx = t.inventory.findIndex(i => i.type === 'water');
        if (waterIdx >= 0) {
            t.inventory.splice(waterIdx, 1);
            t.vitals.thirst = Math.max(0, t.vitals.thirst - VITALS.waterRelief);
            ctx.logEvent(`${t.name} drains their water ration.`, [t.id], { category: 'survival' });
        }
    }

    // Antidote cures poison before it becomes lethal.
    if (t.injuries.poisoned) {
        const antidoteIdx = t.inventory.findIndex(i => i.id === 'antidote');
        if (antidoteIdx >= 0) {
            t.inventory.splice(antidoteIdx, 1);
            t.injuries.poisoned = false;
            ctx.logEvent(`${t.name} downs an Antidote Vial just in time, purging the venom from their blood.`, [t.id], { important: true, category: 'survival' });
        }
    }

    const medkitIdx = t.inventory.findIndex(i => i.id === 'medkit');
    if (medkitIdx >= 0 && (t.health < MEDICAL.medkitHealthThreshold || Object.values(t.injuries).some(v => v))) {
        t.inventory.splice(medkitIdx, 1);
        t.health = Math.min(100, t.health + MEDICAL.medkitHeal);
        t.injuries = { head: false, torso: false, arms: false, legs: false, bleeding: false, infected: false, poisoned: t.injuries.poisoned, burned: false, frostbitten: false };
        ctx.logEvent(`${t.name} works through a First Aid Kit, stitching and binding everything they can reach.`, [t.id], { important: true, category: 'survival' });
        return;
    }

    const ointmentIdx = t.inventory.findIndex(i => i.id === 'ointment');
    if (ointmentIdx >= 0 && (t.health < MEDICAL.ointmentHealthThreshold || t.injuries.infected || t.injuries.bleeding || t.injuries.burned)) {
        t.inventory.splice(ointmentIdx, 1);
        t.health = Math.min(100, t.health + MEDICAL.ointmentHeal);
        t.injuries.infected = false;
        t.injuries.bleeding = false;
        t.injuries.burned = false;
        ctx.logEvent(`${t.name} works Burn Ointment into their wounds and feels the sting fade.`, [t.id], { important: true, category: 'survival' });
    }
}

/** One cycle of simply existing in the arena. */
export function processVitals(ctx: SimContext, time: 'day' | 'night') {
    getAlive(ctx.state).forEach(t => {
        const drains = drainsFor(ctx, t, time);

        // The arena's standing weather, through the same path as a Gamemaker storm.
        const climate = climateOf(ctx.state.arena.id);
        const exposure = climate?.exposure?.(time);
        if (exposure) applyExposure(ctx, t, exposure);
        if (t.status !== 'alive') return;

        if (t.traits.includes('Star-Crossed')) {
            t.sponsorTrust = Math.min(100, t.sponsorTrust + TRAIT_EFFECTS.starCrossedTrustPerCycle);
            t.excitementRating += TRAIT_EFFECTS.starCrossedExcitementPerCycle;
        }

        t.vitals.hunger += Math.max(0, drains.hunger);
        t.vitals.thirst += Math.max(0, drains.thirst);
        t.vitals.fatigue += drains.fatigue;
        t.vitals.sanity -= VITALS.baseSanityDrain;
        clampTribute(t);

        applyStatusDamage(ctx, t);
        consumeSupplies(ctx, t);

        clampTribute(t);
        // No priority-chain guessing: the obituary names whatever landed last.
        checkDeath(ctx, t);
    });
}
