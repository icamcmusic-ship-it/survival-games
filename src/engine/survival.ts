import { Tribute } from '../models/types';
import { DRIFT, CRAFTING, INJURY_DAMAGE, MEDICAL, RECOVERY, SANITY, TRAIT_EFFECTS, VITALS, WATER } from '../data/balance';
import { SimContext, getAlive } from './context';
import { applyDamage, checkDeath } from './combat';
import { climateOf } from './climate';
import { applyExposure } from './exposure';
import { getZone } from './map';
import { consumeOne, hasTool, spoilageBonus } from './items';
import { clampTribute } from './vitals';
import { bleedDamage, clearBleeding, tickBleeding } from './wounds';
import { rememberedThreat } from './memory';
import { hasCamp } from './fieldcraft';
import { SURVIVAL_TEXTS } from '../data/flavorText';
import { fill } from './encounters';
import { craftOf } from '../data/districts';
import { traitMod } from '../data/traits';
import { addExcitement } from './audience';
import { earnTrait } from './earnedTraits';

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

    // Some districts have been hungry before. District 12 rations better than
    // District 1 does, and that is the whole of what mining and the Seam buy.
    const resilience = craftOf(t.district).hungerResilience;
    if (resilience) hunger *= resilience;

    // Traits, as one table read rather than a growing chain of includes().
    hunger += traitMod(t, 'hungerDrain');
    thirst += traitMod(t, 'thirstDrain');
    fatigue += time === 'night' ? traitMod(t, 'fatigueNight') : traitMod(t, 'fatigueDay');
    // Younger tributes burn through rations faster and sleep worse.
    if (t.age <= TRAIT_EFFECTS.youngAge) {
        hunger += TRAIT_EFFECTS.youngHungerPenalty;
        fatigue += TRAIT_EFFECTS.youngFatiguePenalty;
    }

    return { hunger, thirst, fatigue };
}

/**
 * Finalist protection (see the comment in `combat.ts`) holds a fatal status
 * tick back to 1 HP rather than letting a finalist die of it — but thirst,
 * poison and the rest reapply every single cycle, so a clamp alone would just
 * camp them at 1 HP indefinitely instead of actually saving them, which reads
 * as broken rather than as a near-death survival. When the save fires, this
 * also relieves whatever specifically caused it, so the same tick does not
 * simply refire next cycle — the Gamemakers keeping the show's ending alive,
 * narratively, rather than the arena freezing a health bar.
 */
function reliefFor(t: Tribute, cause: 'hunger' | 'thirst' | 'bleeding' | 'infected' | 'poisoned' | 'burned' | 'frostbitten') {
    switch (cause) {
        case 'hunger': t.vitals.hunger = Math.min(t.vitals.hunger, VITALS.starvingThreshold - 5); break;
        case 'thirst': t.vitals.thirst = Math.min(t.vitals.thirst, VITALS.dehydratedThreshold - 5); break;
        case 'bleeding': clearBleeding(t); break;
        case 'infected': t.injuries.infected = false; break;
        case 'poisoned': t.injuries.poisoned = false; break;
        case 'burned': t.injuries.burned = false; break;
        case 'frostbitten': t.injuries.frostbitten = false; break;
    }
}

/** Untreated wounds and empty canteens, each attributed to what caused them. */
function applyStatusDamage(ctx: SimContext, t: Tribute) {
    if (t.vitals.hunger > VITALS.starvingThreshold) {
        if (applyDamage(ctx, t, VITALS.starvingDamage, { cause: 'Died of starvation', kind: 'status' })) {
            reliefFor(t, 'hunger');
        }
        // Going properly hungry and coming out the other side teaches a thing.
        if (t.status === 'alive' && ctx.rng.chance(VITALS.starvedTraitChance)) earnTrait(ctx, t, 'Starved');
        // §3.1: starvation wasting. Muscle is the first thing the arena takes.
        if (t.status === 'alive' && t.attributes.strength > DRIFT.strengthFloor) {
            t.attributes.strength = Math.max(DRIFT.strengthFloor,
                Math.round((t.attributes.strength - DRIFT.starvationWasting) * 100) / 100);
        }
    }
    if (t.vitals.thirst > VITALS.dehydratedThreshold) {
        if (applyDamage(ctx, t, VITALS.dehydratedDamage, { cause: 'Died of dehydration', kind: 'status' })) {
            reliefFor(t, 'thirst');
        }
    }
    if (t.injuries.bleeding) {
        // Cost scales with how badly the wound is running, and the wound gets a
        // chance to clot down a step at the end of the cycle — see `wounds.ts`.
        if (applyDamage(ctx, t, bleedDamage(t), { cause: 'Bled out from untreated wounds', kind: 'status' })) {
            reliefFor(t, 'bleeding');
        }
    }
    if (t.injuries.infected) {
        if (applyDamage(ctx, t, INJURY_DAMAGE.infected, { cause: 'Succumbed to an infected wound', kind: 'status' })) {
            reliefFor(t, 'infected');
        }
    }
    if (t.injuries.poisoned) {
        if (applyDamage(ctx, t, INJURY_DAMAGE.poisoned, { cause: 'Succumbed to poison', kind: 'status' })) {
            reliefFor(t, 'poisoned');
        }
        t.vitals.sanity -= INJURY_DAMAGE.poisonSanity;
    }
    if (t.injuries.burned) {
        if (applyDamage(ctx, t, INJURY_DAMAGE.burned, { cause: 'Died of untreated burns', kind: 'status' })) {
            reliefFor(t, 'burned');
        }
    }
    if (t.injuries.frostbitten) {
        if (applyDamage(ctx, t, INJURY_DAMAGE.frostbitten, { cause: 'Froze to death', kind: 'status' })) {
            reliefFor(t, 'frostbitten');
        }
    }
    clampTribute(t);
}

/**
 * Drinking straight from the arena.
 *
 * A tribute could previously die of dehydration while standing in a river: the
 * only relief in the game was a Water Canteen from the loot table, and the
 * terrain modifier for standing in water (8) did not even cover the 15/cycle
 * drain. Open water is now a real resource — and in an arena whose water is
 * foul, drinking it untreated is exactly the gamble it ought to be.
 */
function drinkFromZone(ctx: SimContext, t: Tribute) {
    const zone = getZone(ctx.state.arena, t.zone);
    if (!zone || (zone.terrain !== 'water' && zone.terrain !== 'wetland')) return;

    const foul = climateOf(ctx.state.arena.id)?.foulWater === true;
    // Purification is a property of the item now, not a hardcoded id list, so
    // tablets and a fire-and-a-pot both answer the same question.
    const purifier = t.inventory.find(i =>
        i.purifies === true || (WATER.purifiers as readonly string[]).includes(i.id));

    if (foul && !purifier) {
        // Desperate enough to drink it anyway — the thirst is the more urgent
        // problem, and the venom is a chance rather than a certainty.
        t.vitals.thirst = Math.max(0, t.vitals.thirst - WATER.zoneDrinkRelief);
        if (!t.injuries.poisoned && ctx.rng.chance(WATER.foulPoisonChance)) {
            t.injuries.poisoned = true;
            ctx.logEvent(
                `${t.name} is thirsty enough to drink from ${t.zone} untreated. The water goes down foul and stays down worse.`,
                [t.id],
                { important: true, category: 'injury' }
            );
        } else {
            ctx.logEvent(`${t.name} risks a drink from ${t.zone} and gets away with it.`, [t.id], { category: 'survival' });
        }
        return;
    }

    // Tablets are consumed by using them; boiling is not.
    if (foul && purifier?.purifies) consumeOne(t, i => i === purifier);
    t.vitals.thirst = Math.max(0, t.vitals.thirst - WATER.zoneDrinkRelief);
    ctx.logEvent(
        fill(ctx.pickText(foul ? SURVIVAL_TEXTS.drinkTreated : SURVIVAL_TEXTS.drinkClean), { tribute: t.name, zone: t.zone }),
        [t.id],
        { category: 'survival' }
    );
}

/** Eating, drinking, and working through whatever medical supplies they have. */
function consumeSupplies(ctx: SimContext, t: Tribute) {
    // §4.5: a protector bond changes behaviour, not just numbers. A protector
    // standing with a hungrier ward hands the food over before eating.
    if ((t.protectorBonds?.length ?? 0) > 0 && t.vitals.hunger < 70) {
        const ward = ctx.state.tributes.find(o =>
            o.status === 'alive' && o.zone === t.zone
            && t.protectorBonds!.includes(o.id)
            && o.vitals.hunger > VITALS.eatThreshold
            && o.vitals.hunger > t.vitals.hunger + 15
            && !o.inventory.some(i => i.type === 'food'));
        if (ward) {
            const food = consumeOne(t, i => i.type === 'food');
            if (food) {
                ward.vitals.hunger = Math.max(0, ward.vitals.hunger - VITALS.foodRelief);
                ctx.logEvent(
                    `${t.name} splits their ${food.name} and gives ${ward.name} the larger half without being asked. Neither of them mentions it.`,
                    [t.id, ward.id],
                    { category: 'survival' }
                );
            }
        }
    }
    if (t.vitals.hunger > VITALS.eatThreshold) {
        const food = consumeOne(t, i => i.type === 'food');
        if (food) {
            t.vitals.hunger = Math.max(0, t.vitals.hunger - VITALS.foodRelief);
            ctx.logEvent(`${t.name} eats their ${food.name}.`, [t.id], { category: 'survival' });
        }
    }
    if (t.vitals.thirst > VITALS.drinkThreshold) {
        if (consumeOne(t, i => i.type === 'water')) {
            t.vitals.thirst = Math.max(0, t.vitals.thirst - VITALS.waterRelief);
            ctx.logEvent(`${t.name} drains their water ration.`, [t.id], { category: 'survival' });
        } else {
            drinkFromZone(ctx, t);
        }
    }

    // Antidote cures poison before it becomes lethal.
    if (t.injuries.poisoned) {
        if (consumeOne(t, i => i.id === 'antidote')) {
            t.injuries.poisoned = false;
            ctx.logEvent(`${t.name} downs an Antidote Vial just in time, purging the venom from their blood.`, [t.id], { important: true, category: 'survival' });
            earnTrait(ctx, t, 'Venom-Wise');
        }
    }

    const medkitIdx = t.inventory.findIndex(i => i.id === 'medkit');
    if (medkitIdx >= 0 && (t.health < MEDICAL.medkitHealthThreshold || Object.values(t.injuries).some(v => v))) {
        t.inventory.splice(medkitIdx, 1);
        t.health = Math.min(100, t.health + MEDICAL.medkitHeal);
        t.injuries = { head: false, torso: false, arms: false, legs: false, bleeding: false, infected: false, poisoned: t.injuries.poisoned, burned: false, frostbitten: false };
        // Clearing the flag is not enough — the severity has to go with it, or
        // the next scratch reopens at whatever the old wound was running at.
        clearBleeding(t);
        ctx.logEvent(`${t.name} works through a First Aid Kit, stitching and binding everything they can reach.`, [t.id], { important: true, category: 'survival' });
        return;
    }

    const ointmentIdx = t.inventory.findIndex(i => i.id === 'ointment');
    if (ointmentIdx >= 0 && (t.health < MEDICAL.ointmentHealthThreshold || t.injuries.infected || t.injuries.bleeding || t.injuries.burned)) {
        t.inventory.splice(ointmentIdx, 1);
        t.health = Math.min(100, t.health + MEDICAL.ointmentHeal);
        t.injuries.infected = false;
        t.injuries.burned = false;
        clearBleeding(t);
        ctx.logEvent(`${t.name} works Burn Ointment into their wounds and feels the sting fade.`, [t.id], { important: true, category: 'survival' });
    }
}

/**
 * DESIGN-02: the arc where a tribute goes to ground and mends.
 *
 * Health used to be strictly monotonic — four writes in the whole codebase
 * raised it, all of them loot or scripted events — so the only way to reach the
 * finale in any condition was to find a First Aid Kit. Rest is now a real
 * option, but a demanding one: a night, off your feet, not bleeding, fed,
 * watered and not wrecked with exhaustion.
 */
function applyNaturalRecovery(ctx: SimContext, t: Tribute, time: 'day' | 'night', alliesPresent: number) {
    if (time !== 'night' || t.health >= 100) return;
    if (!(RECOVERY.restfulStances as readonly string[]).includes(t.stance)) return;
    if (t.injuries.bleeding || t.injuries.infected || t.injuries.poisoned) return;
    if (t.vitals.hunger > RECOVERY.maxHunger || t.vitals.thirst > RECOVERY.maxThirst) return;

    let amount = RECOVERY.nightHeal + Math.max(0, traitMod(t, 'sanityRecovery') / 2);
    const zone = getZone(ctx.state.arena, t.zone);
    if (zone && (zone.terrain === 'forest' || zone.terrain === 'ruins')) amount += RECOVERY.shelteredBonus;
    // A shelter they actually built beats whatever cover the terrain offered.
    if (hasCamp(ctx, t, 'shelter')) amount += CRAFTING.shelterRecoveryBonus;
    // The most famous parachute in the source material, doing the thing it is
    // famous for: keeping somebody alive through a night they should not survive.
    if (hasTool(t, 'warmth')) amount += RECOVERY.sleepingBagBonus;
    // REPLAY-07 gave the night real teeth — a concealment bonus for whoever is
    // hunting and an ambush bonus on top of it. This is the other half of that
    // trade, without which the night is a flat tax on everybody: a tribute who
    // deliberately goes to ground in the dark actually sleeps, because the dark
    // is doing the hiding for them.
    if (t.stance === 'Evasive' || hasCamp(ctx, t, 'camouflage')) amount += RECOVERY.darkAndHiddenBonus;
    // Someone keeping watch is the difference between sleeping and lying awake.
    if (alliesPresent > 0) amount += RECOVERY.allyWatchBonus;
    // Exhaustion eats the whole benefit as it approaches the ceiling.
    amount *= Math.max(0, 1 - t.vitals.fatigue / RECOVERY.fatigueCeiling);

    const healed = Math.round(amount);
    if (healed <= 0) return;
    t.health = Math.min(100, t.health + healed);
    ctx.logEvent(
        `${t.name} holds up in ${t.zone} and sleeps properly for the first time in days. The worst of it starts to mend.`,
        [t.id],
        { category: 'survival' }
    );
}

/**
 * DESIGN-06: sanity as a pressure gauge rather than a countdown.
 *
 * A flat 5/cycle drain meant the stat measured elapsed time and nothing else —
 * by roughly cycle 14 every survivor was below the breakdown threshold and
 * losing turns to it regardless of how their run had actually gone. Drain now
 * answers to isolation, hunger, darkness and standing somewhere they remember
 * people dying; rest, food, safety and company push back.
 */
function applySanityPressure(ctx: SimContext, t: Tribute, time: 'day' | 'night', alliesPresent: number) {
    if (!ctx.state.config.enableSanity) {
        // With sanity disabled the stat must not drift at all, or a config the
        // player turned off still quietly shapes stance scoring.
        return;
    }
    let drain = SANITY.baseDrain;
    if (time === 'night') drain += SANITY.nightDrain;
    if (alliesPresent === 0) drain += SANITY.isolationDrain;
    if (t.vitals.hunger > SANITY.deprivationThreshold || t.vitals.thirst > SANITY.deprivationThreshold) {
        drain += SANITY.deprivationDrain;
    }
    // The zone-memory system already tracks exactly this: how much dread this
    // specific tribute attaches to the ground they are standing on.
    const dread = rememberedThreat(ctx.state, t, t.zone);
    drain += Math.min(SANITY.maxThreatDrain, dread * SANITY.threatDrainPerPoint);

    let recovery = 0;
    const resting = time === 'night'
        && (RECOVERY.restfulStances as readonly string[]).includes(t.stance)
        && t.vitals.fatigue < SANITY.restFatigueCeiling;
    if (resting) recovery += SANITY.restRecovery;
    if (alliesPresent > 0) recovery += SANITY.allyPresentRecovery;
    if (dread < 0.2 && t.health > 60 && t.vitals.hunger < SANITY.deprivationThreshold) {
        recovery += SANITY.safetyRecovery;
    }

    // Temperament: who falls apart under this and who does not.
    drain *= Math.max(0.1, 1 + traitMod(t, 'sanityDrain'));
    if (recovery > 0) recovery += traitMod(t, 'sanityRecovery');

    t.vitals.sanity += recovery - drain;
}

/** One cycle of simply existing in the arena. */
export function processVitals(ctx: SimContext, time: 'day' | 'night') {
    const board = getAlive(ctx.state);
    board.forEach(t => {
        const drains = drainsFor(ctx, t, time);
        // Company, for both recovery and sanity: an ally standing watch in the
        // same zone, not merely an alliance id on a tribute across the map.
        const alliesPresent = board.filter(o =>
            o.id !== t.id && o.status === 'alive' && o.zone === t.zone
            && o.allianceId !== undefined && o.allianceId === t.allianceId).length;

        // The arena's standing weather, through the same path as a Gamemaker storm.
        const climate = climateOf(ctx.state.arena.id);
        const exposure = climate?.exposure?.(time);
        if (exposure) applyExposure(ctx, t, exposure);
        if (t.status !== 'alive') return;

        // Standing with the Capitol drifts by temperament as well as by events.
        const standing = traitMod(t, 'sponsorTrust');
        if (standing !== 0) t.sponsorTrust = Math.max(0, Math.min(100, t.sponsorTrust + standing));

        if (t.traits.includes('Star-Crossed')) {
            t.sponsorTrust = Math.min(100, t.sponsorTrust + TRAIT_EFFECTS.starCrossedTrustPerCycle);
            addExcitement(t, TRAIT_EFFECTS.starCrossedExcitementPerCycle);
        }

        t.vitals.hunger += Math.max(0, drains.hunger);
        t.vitals.thirst += Math.max(0, drains.thirst);
        t.vitals.fatigue += drains.fatigue;
        applySanityPressure(ctx, t, time, alliesPresent);
        clampTribute(t);

        applyStatusDamage(ctx, t);
        consumeSupplies(ctx, t);
        // Order matters: the wound costs health first, then gets its chance to
        // close. A fresh cut always draws blood before it starts to clot.
        tickBleeding(ctx, t);
        applyNaturalRecovery(ctx, t, time, alliesPresent);

        clampTribute(t);
        // No priority-chain guessing: the obituary names whatever landed last.
        checkDeath(ctx, t);
    });
}
