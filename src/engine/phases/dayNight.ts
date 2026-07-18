import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Tribute, Zone } from '../../models/types';
import { ITEMS } from '../../data/constants';
import { ARCHETYPES } from '../../data/archetypes';
import { ENCOUNTER_TEXTS, SANITY_TEXTS } from '../../data/flavorText';
import { checkDeath, resolveCombat } from '../combat';
import { processSponsors } from '../sponsors';
import { zoneNames, getZone, reachableZones } from '../map';

function pickDestination(ctx: SimContext, t: Tribute, options: Zone[]): Zone {
    // Cautious tributes prefer safe, resource-rich zones; aggressive ones follow danger (prey gathers there)
    const arch = ARCHETYPES[t.archetype];
    const scored = options.map(z => {
        let score = 1;
        score += z.resources * (1 + arch.caution);
        score += z.danger * (arch.aggression > 0 ? arch.aggression * 2 : -arch.caution * 2);
        if (t.stance === 'Evasive') score -= z.danger * 2;
        return { z, score: Math.max(0.1, score) };
    });
    let roll = ctx.rng.nextFloat() * scored.reduce((s, o) => s + o.score, 0);
    for (const o of scored) {
        roll -= o.score;
        if (roll <= 0) return o.z;
    }
    return scored[scored.length - 1].z;
}

export function processDayNight(ctx: SimContext, time: 'day' | 'night') {
    ctx.rng = new RNG(`${ctx.state.seed}-${ctx.state.day}-${time}`);
    const alive = getAlive(ctx.state);
    const allZoneNames = zoneNames(ctx.state.arena);

    // 0. Hazard Escalation & Safe Zone Shrinking over time (starts Day 5+)
    const isEscalated = ctx.state.day >= 5;
    if (isEscalated) {
        const collapseCount = Math.min(allZoneNames.length - 1, ctx.state.day - 4);
        const collapsedList = allZoneNames.slice(allZoneNames.length - collapseCount);
        ctx.state.collapsedZones = collapsedList;

        alive.forEach(t => {
            if (collapsedList.includes(t.zone)) {
                const damage = 20 + (ctx.state.day - 5) * 10;
                t.health -= damage;
                const safeZones = allZoneNames.filter(z => !collapsedList.includes(z));
                const newSafeZone = safeZones[0] || allZoneNames[0];

                const trappedZone = t.zone;
                ctx.logEvent(`HAZARD ESCALATION: ${t.name} is trapped inside the collapsing border of ${trappedZone}! They sustain ${damage} injury damage and desperately flee into the safe sector of ${newSafeZone}.`, [t.id], true, newSafeZone);
                t.zone = newSafeZone;
                checkDeath(ctx, t, `Caught in the collapsing border of ${trappedZone}`);
            }
        });
    }
    const collapsed = ctx.state.collapsedZones || [];

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

    // 2. Vitals, Terrain & Status Effects
    alive.forEach(t => {
        const zone = getZone(ctx.state.arena, t.zone);
        let hungerDrain = 10;
        let thirstDrain = 15;
        let fatigueDrain = time === 'day' ? 10 : -20;

        // Terrain effects
        if (zone) {
            if (zone.terrain === 'water' || zone.terrain === 'wetland') thirstDrain -= 8;
            if (zone.terrain === 'highland') fatigueDrain += 8;
            if (zone.terrain === 'forest' && time === 'night') fatigueDrain -= 5; // shelter
        }

        // Arena climate effects
        if (ctx.state.arena.id === 'frozen') {
            const hasWarmth = t.inventory.some(i => i.id === 'matches');
            if (!hasWarmth) {
                fatigueDrain += 10;
                t.health -= 5;
                if (time === 'night' && ctx.rng.chance(0.15) && !t.injuries.frostbitten) {
                    t.injuries.frostbitten = true;
                    ctx.logEvent(`${t.name}'s fingers blacken with frostbite in the freezing night.`, [t.id], true);
                }
            }
        } else if (ctx.state.arena.id === 'solar') {
            thirstDrain *= 2;
            if (time === 'day' && ctx.rng.chance(0.1) && !t.injuries.burned) {
                t.injuries.burned = true;
                ctx.logEvent(`${t.name} suffers severe sunburns under the merciless solar glare.`, [t.id]);
            }
        } else if (ctx.state.arena.id === 'toxic') {
            if (ctx.rng.chance(0.2)) t.vitals.sanity -= 15;
            if (ctx.rng.chance(0.08) && !t.injuries.poisoned) {
                t.injuries.poisoned = true;
                ctx.logEvent(`${t.name} drinks tainted water and is poisoned by the toxins.`, [t.id], true);
            }
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
        t.vitals.thirst += Math.max(0, thirstDrain);
        t.vitals.fatigue += fatigueDrain;
        t.vitals.sanity -= 5; // Base sanity drain

        if (t.vitals.hunger > 80) t.health -= 5;
        if (t.vitals.thirst > 80) t.health -= 10;
        if (t.injuries.bleeding) t.health -= 15;
        if (t.injuries.infected) t.health -= 10;
        if (t.injuries.poisoned) { t.health -= 12; t.vitals.sanity -= 5; }
        if (t.injuries.burned) t.health -= 4;
        if (t.injuries.frostbitten) t.health -= 6;

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

        // Antidote cures poison before it becomes lethal
        if (t.injuries.poisoned) {
            const antidoteIdx = t.inventory.findIndex(i => i.id === 'antidote');
            if (antidoteIdx >= 0) {
                t.inventory.splice(antidoteIdx, 1);
                t.injuries.poisoned = false;
                ctx.logEvent(`${t.name} downs an Antidote Vial just in time, purging the venom from their blood.`, [t.id], true);
            }
        }

        // Consume medical items to heal wounds, cure infections, or restore health
        const medkitIdx = t.inventory.findIndex(i => i.id === 'medkit');
        if (medkitIdx >= 0 && (t.health < 70 || Object.values(t.injuries).some(v => v))) {
            t.inventory.splice(medkitIdx, 1);
            t.health = Math.min(100, t.health + 50);
            t.injuries = { head: false, torso: false, arms: false, legs: false, bleeding: false, infected: false, poisoned: t.injuries.poisoned, burned: false, frostbitten: false };
            ctx.logEvent(`${t.name} uses a First Aid Kit to heal their wounds.`, [t.id], true);
        } else {
            const ointmentIdx = t.inventory.findIndex(i => i.id === 'ointment');
            if (ointmentIdx >= 0 && (t.health < 85 || t.injuries.infected || t.injuries.bleeding || t.injuries.burned)) {
                t.inventory.splice(ointmentIdx, 1);
                t.health = Math.min(100, t.health + 25);
                t.injuries.infected = false;
                t.injuries.bleeding = false;
                t.injuries.burned = false;
                ctx.logEvent(`${t.name} applies Burn Ointment, soothing their injuries and infections.`, [t.id], true);
            }
        }

        const cause = t.injuries.poisoned ? 'Succumbed to poison'
            : t.injuries.frostbitten ? 'Froze to death'
            : t.vitals.thirst > 80 ? 'Died of dehydration'
            : t.vitals.hunger > 80 ? 'Died of starvation'
            : t.injuries.bleeding ? 'Bled out from untreated wounds'
            : t.injuries.infected ? 'Succumbed to an infected wound'
            : undefined;
        checkDeath(ctx, t, cause);
    });

    const currentAlive = getAlive(ctx.state);

    // 3. Dynamic Stances, Movement (Zone Graph) & Crafting
    const acted = new Set<string>();
    currentAlive.forEach(t => {
        const arch = ARCHETYPES[t.archetype];

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
        // Tricksters can improvise a garrote from wire
        if (t.archetype === 'trickster') {
            const hasWire = t.inventory.findIndex(i => i.id === 'wire');
            if (hasWire >= 0 && !t.inventory.some(i => i.id === 'garrote')) {
                t.inventory.splice(hasWire, 1);
                const garrote = ITEMS.find(i => i.id === 'garrote')!;
                t.inventory.push({ ...garrote });
                ctx.logEvent(`${t.name} twists a length of wire into a deadly garrote.`, [t.id]);
            }
        }

        // Update Stance (archetype-aware)
        const hasWeapon = t.inventory.some(i => i.type === 'weapon');
        if (t.health < 40 || t.injuries.bleeding || (arch.caution > 0.2 && t.health < 55)) {
            t.stance = 'Evasive';
        } else if (hasWeapon && t.health > 70 && (t.isCareer || t.traits.includes('Bloodthirsty') || (arch.aggression > 0.1 && ctx.rng.chance(0.5 + arch.aggression)))) {
            t.stance = 'Aggressive';
        } else {
            t.stance = 'Defensive';
        }

        // Movement
        if (ctx.state.config.enableSanity && t.vitals.sanity < 30 && ctx.rng.chance(0.4)) {
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
                    const options = reachableZones(ctx.state.arena, t.zone, collapsed);
                    if (options.length > 0) {
                        const newZone = pickDestination(ctx, t, options).name;
                        if (t.zone !== newZone) {
                            allianceMembers.forEach(m => m.zone = newZone);
                            if (t.stance !== 'Evasive') {
                                ctx.logEvent(`The alliance of ${allianceMembers.map(m => m.name).join(', ')} travels to ${newZone}.`, allianceMembers.map(m => m.id));
                            }
                        }
                    }
                }
            }
        } else if (t.stance === 'Evasive' || ctx.rng.chance(0.5)) {
            const options = reachableZones(ctx.state.arena, t.zone, collapsed);
            if (options.length > 0) {
                const newZone = pickDestination(ctx, t, options).name;
                if (t.zone !== newZone) {
                    t.zone = newZone;
                    if (t.stance !== 'Evasive') {
                        ctx.logEvent(`${t.name} travels to ${newZone}.`, [t.id]);
                    }
                }
            }
        }
    });

    const shuffled = [...currentAlive].sort(() => ctx.rng.nextFloat() - 0.5);

    shuffled.forEach(t => {
        if (acted.has(t.id) || t.status === 'dead') return;

        const zone = getZone(ctx.state.arena, t.zone);
        const zoneDanger = zone ? 0.5 + zone.danger : 1; // 0.5x-1.5x from zone danger
        let eventChance = 0.1 * zoneDanger;
        let muttChance = 0.1 * zoneDanger;
        if (isEscalated) {
            const multiplier = 1 + (ctx.state.day - 5) * 0.3;
            eventChance = Math.min(0.35, eventChance * multiplier);
            muttChance = Math.min(0.35, muttChance * multiplier);
        }
        eventChance = Math.min(0.9, eventChance * ctx.state.config.hazardRate);
        muttChance = Math.min(0.9, muttChance * ctx.state.config.hazardRate);

        if (ctx.rng.chance(eventChance)) {
            const event = ctx.rng.pick(ctx.state.arena.events);
            if (ctx.rng.chance(0.5)) {
                t.health -= 30;
                ctx.logEvent(`${t.name} is caught in a ${event} in ${t.zone} and is severely injured!`, [t.id], true);
                checkDeath(ctx, t, `Killed by a ${event} in ${t.zone}`);
            } else {
                ctx.logEvent(`${t.name} barely escapes a ${event} in ${t.zone}.`, [t.id]);
            }
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
            checkDeath(ctx, t, `Torn apart by ${mutt} in ${t.zone}`);
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
                // Fighting side by side deepens the bond
                t.relationships[other.id] = Math.min(100, (t.relationships[other.id] || 0) + 5);
                other.relationships[t.id] = Math.min(100, (other.relationships[t.id] || 0) + 5);
                ctx.logEvent(`${t.name} and ${other.name} support each other in ${t.zone}.`, [t.id, other.id]);
            } else if (relationship > 20) {
                const template = ctx.rng.pick(ENCOUNTER_TEXTS.shareResources);
                const text = template.replace('{t1}', t.name).replace('{t2}', other.name).replace('{zone}', t.zone);
                ctx.logEvent(text, [t.id, other.id]);
                t.vitals.hunger = Math.max(0, t.vitals.hunger - 10);
                other.vitals.hunger = Math.max(0, other.vitals.hunger - 10);
                t.relationships[other.id] = Math.min(100, relationship + 5);
                other.relationships[t.id] = Math.min(100, (other.relationships[t.id] || 0) + 5);
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
            const forageChance = 0.25 + (zone ? zone.resources * 0.4 : 0.15) + (t.archetype === 'survivalist' ? 0.15 : 0);
            if (ctx.rng.chance(forageChance)) {
                const item = ctx.rng.pick(ITEMS.filter(i => i.type === 'food' || i.type === 'water'));
                t.inventory.push({ ...item });
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
