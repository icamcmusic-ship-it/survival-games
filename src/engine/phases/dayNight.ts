import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Tribute } from '../../models/types';
import { ITEMS } from '../../data/constants';
import { ENCOUNTER_TEXTS, SANITY_TEXTS } from '../../data/flavorText';
import { checkDeath, resolveCombat } from '../combat';
import { processSponsors } from '../sponsors';

export function processDayNight(ctx: SimContext, time: 'day' | 'night') {
    ctx.rng = new RNG(`${ctx.state.seed}-${ctx.state.day}-${time}`);
    const alive = getAlive(ctx.state);

    // 0. Hazard Escalation & Safe Zone Shrinking over time (starts Day 5+)
    const isEscalated = ctx.state.day >= 5;
    if (isEscalated) {
        const collapseCount = Math.min(ctx.state.arena.zones.length - 1, ctx.state.day - 4);
        const collapsedList = ctx.state.arena.zones.slice(ctx.state.arena.zones.length - collapseCount);
        ctx.state.collapsedZones = collapsedList;

        alive.forEach(t => {
            if (collapsedList.includes(t.zone)) {
                const damage = 20 + (ctx.state.day - 5) * 10;
                t.health -= damage;
                const safeZones = ctx.state.arena.zones.filter(z => !collapsedList.includes(z));
                const newSafeZone = safeZones[0] || 'The Cornucopia';

                ctx.logEvent(`HAZARD ESCALATION: ${t.name} is trapped inside the collapsing border of ${t.zone}! They sustain ${damage} injury damage and desperately flee into the safe sector of ${newSafeZone}.`, [t.id], true, newSafeZone);
                t.zone = newSafeZone;
                checkDeath(ctx, t);
            }
        });
    }

    // 1. Item Degradation & Spoilage
    alive.forEach(t => {
        t.inventory = t.inventory.filter(item => {
            if (item.type === 'food' && item.spoilage !== undefined) {
                item.spoilage -= 1;
                if (item.spoilage <= 0) {
                    ctx.logEvent(`${t.name}'s ${item.name} has spoiled.`, [t.id]);
                    return false;
                }
            }
            return true;
        });
    });

    // 2. Vitals & Arena Environmental Effects
    alive.forEach(t => {
        let hungerDrain = 10;
        let thirstDrain = 15;
        let fatigueDrain = time === 'day' ? 10 : -20;

        if (ctx.state.arena.id === 'frozen') {
            const hasWarmth = t.inventory.some(i => i.id === 'matches');
            if (!hasWarmth) {
                fatigueDrain += 10;
                t.health -= 5;
            }
        } else if (ctx.state.arena.id === 'solar') {
            thirstDrain *= 2;
        } else if (ctx.state.arena.id === 'toxic') {
            if (ctx.rng.chance(0.2)) t.vitals.sanity -= 15;
        }

        // Trait Effects
        if (t.traits.includes('Hydrophilic')) thirstDrain -= 5;
        if (t.traits.includes('Insomniac') && time === 'night') fatigueDrain += 10;
        if (t.traits.includes('Iron Stomach')) hungerDrain -= 5;
        if (t.traits.includes('Star-Crossed')) {
            t.sponsorTrust = Math.min(100, t.sponsorTrust + 5);
            t.excitementRating += 10;
        }

        t.vitals.hunger += hungerDrain;
        t.vitals.thirst += thirstDrain;
        t.vitals.fatigue += fatigueDrain;
        t.vitals.sanity -= 5; // Base sanity drain

        if (t.vitals.hunger > 80) t.health -= 5;
        if (t.vitals.thirst > 80) t.health -= 10;
        if (t.injuries.bleeding) t.health -= 15;
        if (t.injuries.infected) t.health -= 10;

        if (t.vitals.hunger > 50) {
            const foodIdx = t.inventory.findIndex(i => i.type === 'food');
            if (foodIdx >= 0) {
                t.inventory.splice(foodIdx, 1);
                t.vitals.hunger = Math.max(0, t.vitals.hunger - 40);
                ctx.logEvent(`${t.name} eats some food.`, [t.id]);
            }
        }
        if (t.vitals.thirst > 50) {
            const waterIdx = t.inventory.findIndex(i => i.type === 'water');
            if (waterIdx >= 0) {
                t.inventory.splice(waterIdx, 1);
                t.vitals.thirst = Math.max(0, t.vitals.thirst - 50);
                ctx.logEvent(`${t.name} drinks some water.`, [t.id]);
            }
        }

        // Consume medical items to heal wounds, cure infections, or restore health
        const medkitIdx = t.inventory.findIndex(i => i.id === 'medkit');
        if (medkitIdx >= 0 && (t.health < 70 || Object.values(t.injuries).some(v => v))) {
            t.inventory.splice(medkitIdx, 1);
            t.health = Math.min(100, t.health + 50);
            t.injuries.bleeding = false;
            t.injuries.infected = false;
            t.injuries.head = false;
            t.injuries.torso = false;
            t.injuries.arms = false;
            t.injuries.legs = false;
            ctx.logEvent(`${t.name} uses a First Aid Kit to heal their wounds.`, [t.id], true);
        } else {
            const ointmentIdx = t.inventory.findIndex(i => i.id === 'ointment');
            if (ointmentIdx >= 0 && (t.health < 85 || t.injuries.infected || t.injuries.bleeding)) {
                t.inventory.splice(ointmentIdx, 1);
                t.health = Math.min(100, t.health + 25);
                t.injuries.infected = false;
                t.injuries.bleeding = false;
                ctx.logEvent(`${t.name} applies Burn Ointment, soothing their injuries and infections.`, [t.id], true);
            }
        }

        checkDeath(ctx, t);
    });

    const currentAlive = getAlive(ctx.state);

    // 3. Dynamic Stances, Movement (Zones) & Crafting
    const acted = new Set<string>();
    currentAlive.forEach(t => {
        // Crafting
        const hasRope = t.inventory.findIndex(i => i.id === 'rope');
        const hasKnife = t.inventory.findIndex(i => i.id === 'knife');
        if (hasRope >= 0 && hasKnife >= 0 && !t.inventory.some(i => i.id === 'spear')) {
            t.inventory.splice(Math.max(hasRope, hasKnife), 1);
            t.inventory.splice(Math.min(hasRope, hasKnife), 1);
            const spear = ITEMS.find(i => i.id === 'spear')!;
            t.inventory.push({ ...spear });
            ctx.logEvent(`${t.name} crafts a Spear using a Rope and a Knife.`, [t.id]);
        }

        // Update Stance
        const hasWeapon = t.inventory.some(i => i.type === 'weapon');
        if (t.health < 40 || t.injuries.bleeding) {
            t.stance = 'Evasive';
        } else if (hasWeapon && t.health > 70 && (t.isCareer || t.traits.includes('Bloodthirsty'))) {
            t.stance = 'Aggressive';
        } else {
            t.stance = 'Defensive';
        }

        // Movement
        if (t.vitals.sanity < 30 && ctx.rng.chance(0.4)) {
            handleInsanity(ctx, t);
            acted.add(t.id);
            return;
        }

        if (t.allianceId) {
            // Alliance members move together
            const allianceMembers = currentAlive.filter(m => m.allianceId === t.allianceId);
            const leader = allianceMembers[0]; // Simple leader logic
            if (t.id === leader.id) {
                if (t.stance === 'Evasive' || ctx.rng.chance(0.5)) {
                    const collapsedList = ctx.state.collapsedZones || [];
                    const activeZones = ctx.state.arena.zones.filter(z => !collapsedList.includes(z));
                    const pool = activeZones.length > 0 ? activeZones : ctx.state.arena.zones;
                    const newZone = ctx.rng.pick(pool);
                    if (t.zone !== newZone) {
                        allianceMembers.forEach(m => m.zone = newZone);
                        if (t.stance !== 'Evasive') {
                            ctx.logEvent(`The alliance of ${allianceMembers.map(m => m.name).join(', ')} travels to ${newZone}.`, allianceMembers.map(m => m.id));
                        }
                    }
                }
            }
        } else if (t.stance === 'Evasive' || ctx.rng.chance(0.5)) {
            const collapsedList = ctx.state.collapsedZones || [];
            const activeZones = ctx.state.arena.zones.filter(z => !collapsedList.includes(z));
            const pool = activeZones.length > 0 ? activeZones : ctx.state.arena.zones;
            const newZone = ctx.rng.pick(pool);
            if (t.zone !== newZone) {
                t.zone = newZone;
                if (t.stance !== 'Evasive') {
                    ctx.logEvent(`${t.name} travels to ${newZone}.`, [t.id]);
                }
            }
        }
    });

    const shuffled = [...currentAlive].sort(() => ctx.rng.nextFloat() - 0.5);

    shuffled.forEach(t => {
        if (acted.has(t.id) || t.status === 'dead') return;

        let eventChance = 0.1;
        let muttChance = 0.1;
        if (isEscalated) {
            const multiplier = 1 + (ctx.state.day - 5) * 0.3;
            eventChance = Math.min(0.35, eventChance * multiplier);
            muttChance = Math.min(0.35, muttChance * multiplier);
        }

        if (ctx.rng.chance(eventChance)) {
            const event = ctx.rng.pick(ctx.state.arena.events);
            if (ctx.rng.chance(0.5)) {
                t.health -= 30;
                ctx.logEvent(`${t.name} is caught in a ${event} in ${t.zone} and is severely injured!`, [t.id], true);
            } else {
                ctx.logEvent(`${t.name} barely escapes a ${event} in ${t.zone}.`, [t.id]);
            }
            checkDeath(ctx, t);
            acted.add(t.id);
            return;
        }

        if (ctx.rng.chance(muttChance)) {
            const mutt = ctx.rng.pick(ctx.state.arena.mutts);
            if (t.attributes.agility > 6 && ctx.rng.chance(0.7)) {
                ctx.logEvent(`${t.name} outruns a pack of ${mutt} in ${t.zone}.`, [t.id]);
            } else {
                t.health -= 40;
                t.injuries.bleeding = true;
                ctx.logEvent(`${t.name} is attacked by ${mutt} in ${t.zone} and barely survives.`, [t.id], true);
            }
            checkDeath(ctx, t);
            acted.add(t.id);
            return;
        }

        // Only encounter others in the SAME ZONE
        const others = shuffled.filter(o => o.id !== t.id && !acted.has(o.id) && o.status === 'alive' && o.zone === t.zone);
        if (others.length > 0 && ctx.rng.chance(0.4)) {
            const other = others[0];

            // Alliance Logic
            const inSameAlliance = t.allianceId && t.allianceId === other.allianceId;

            // Grudge/Debt Logic
            const relationship = t.relationships[other.id] || 0;

            if (inSameAlliance) {
                // Share resources within alliance
                const tHungry = t.vitals.hunger > 40;
                const oHasFood = other.inventory.some(i => i.type === 'food');
                if (tHungry && oHasFood) {
                    const foodIdx = other.inventory.findIndex(i => i.type === 'food');
                    const food = other.inventory.splice(foodIdx, 1)[0];
                    t.vitals.hunger = Math.max(0, t.vitals.hunger - 40);
                    ctx.logEvent(`${other.name} shares their ${food.name} with ${t.name}.`, [t.id, other.id]);
                }
                ctx.logEvent(`${t.name} and ${other.name} support each other in ${t.zone}.`, [t.id, other.id]);
            } else if (relationship > 20) {
                const template = ctx.rng.pick(ENCOUNTER_TEXTS.shareResources);
                const text = template.replace('{t1}', t.name).replace('{t2}', other.name).replace('{zone}', t.zone);
                ctx.logEvent(text, [t.id, other.id]);
                t.vitals.hunger = Math.max(0, t.vitals.hunger - 10);
                other.vitals.hunger = Math.max(0, other.vitals.hunger - 10);
            } else if (t.stance === 'Aggressive' || other.stance === 'Aggressive' || relationship < -10) {
                resolveCombat(ctx, t, other);
            } else {
                if (ctx.rng.chance(0.5)) {
                    const template = ctx.rng.pick(ENCOUNTER_TEXTS.peaceful);
                    const text = template.replace('{t1}', t.name).replace('{t2}', other.name).replace('{zone}', t.zone);
                    ctx.logEvent(text, [t.id, other.id]);
                } else {
                    const template = ctx.rng.pick(ENCOUNTER_TEXTS.friendly);
                    const text = template.replace('{t1}', t.name).replace('{t2}', other.name).replace('{zone}', t.zone);
                    ctx.logEvent(text, [t.id, other.id]);
                    t.vitals.sanity = Math.min(100, t.vitals.sanity + 10);
                    other.vitals.sanity = Math.min(100, other.vitals.sanity + 10);
                    t.relationships[other.id] = (t.relationships[other.id] || 0) + 10;
                    other.relationships[t.id] = (other.relationships[t.id] || 0) + 10;
                }
            }
            acted.add(t.id);
            acted.add(other.id);
            return;
        }

        if (t.stance === 'Evasive') {
            ctx.logEvent(`${t.name} hides quietly in ${t.zone}.`, [t.id]);
        } else if (t.stance === 'Defensive') {
            if (ctx.rng.chance(0.4)) {
                const item = ctx.rng.pick(ITEMS.filter(i => i.type === 'food' || i.type === 'water'));
                t.inventory.push(item);
                ctx.logEvent(`${t.name} forages in ${t.zone} and finds a ${item.name}.`, [t.id]);
            } else {
                ctx.logEvent(`${t.name} sets up camp and rests in ${t.zone}.`, [t.id]);
            }
        } else {
            ctx.logEvent(`${t.name} hunts for other tributes in ${t.zone} but finds no one.`, [t.id]);
        }
        acted.add(t.id);
    });

    processSponsors(ctx);
}

function handleInsanity(ctx: SimContext, t: Tribute) {
    const roll = ctx.rng.nextFloat();
    if (roll < 0.4) {
        // Hallucination
        const template = ctx.rng.pick(SANITY_TEXTS.hallucination);
        const text = template.replace('{tribute}', t.name).replace('{zone}', t.zone);
        ctx.logEvent(text, [t.id], true);
        t.vitals.sanity -= 5;
    } else if (roll < 0.7) {
        // Ruin Stealth
        const template = ctx.rng.pick(SANITY_TEXTS.ruinStealth);
        const text = template.replace('{tribute}', t.name).replace('{zone}', t.zone);
        ctx.logEvent(text, [t.id], true);
        t.attributes.stealth = Math.max(0, t.attributes.stealth - 2);
    } else if (t.inventory.length > 0) {
        // Drop Item
        const itemIdx = ctx.rng.nextInt(0, t.inventory.length - 1);
        const item = t.inventory.splice(itemIdx, 1)[0];
        const template = ctx.rng.pick(SANITY_TEXTS.dropItem);
        const text = template.replace('{tribute}', t.name).replace('{item}', item.name).replace('{zone}', t.zone);
        ctx.logEvent(text, [t.id], true);
    } else {
        // Default to hallucination if no items
        const template = ctx.rng.pick(SANITY_TEXTS.hallucination);
        const text = template.replace('{tribute}', t.name).replace('{zone}', t.zone);
        ctx.logEvent(text, [t.id], true);
    }
}
