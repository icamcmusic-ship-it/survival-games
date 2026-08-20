import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Stance, Tribute, Zone } from '../../models/types';
import { ITEMS } from '../../data/constants';
import { ARCHETYPES } from '../../data/archetypes';
import { CLIMATE, ENCOUNTERS, ESCALATION, INJURY_DAMAGE, MEDICAL, MEMORY, SPONSORS, STANCE, TRAIT_EFFECTS, VITALS, ZONES } from '../../data/balance';
import { ENCOUNTER_TEXTS, SANITY_TEXTS, ALLIANCE_TEXTS, AMBIENT_TEXTS } from '../../data/flavorText';
import { arenaFlavor, ArenaEventDef } from '../../data/arenaFlavor';
import { applyDamage, checkDeath, resolveCombat, resolveGroupCombat } from '../combat';
import { processSponsors } from '../sponsors';
import { zoneNames, getZone, reachableZones, effectiveResources, depleteZone, depletionOf, regenerateZones } from '../map';
import { clampTribute } from '../vitals';
import { itemPhrase } from '../items';
import {
    addZoneThreat, advanceCycle, decayMemories, decayRelationships, ensureMemory,
    hasVengeanceAgainst, noteContact, noteSighting, rememberedBarren, rememberedRivals, rememberedThreat,
} from '../memory';
import { adjustMutual, decayAllianceTrust, driftReputation, getRel } from '../relationships';

function fill(template: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce(
        (text, [key, value]) => text.split(`{${key}}`).join(value),
        template
    );
}

/**
 * Destination scoring with memory.
 *
 * Previously a tribute picked a zone from its printed danger and resource
 * numbers alone — the same choice on day 1 and day 9, with no idea that three
 * people died in the swamp yesterday or that the Careers were camped in the
 * forest an hour ago. Tributes now weigh what they have personally seen, what
 * the sky told them, and how picked-over they believe the ground is.
 */
function pickDestination(ctx: SimContext, t: Tribute, options: Zone[]): Zone {
    const arch = ARCHETYPES[t.archetype];
    const state = ctx.state;

    const scored = options.map(z => {
        let score = 1;

        // Printed terrain qualities, adjusted for what has actually been eaten.
        score += effectiveResources(state, z) * (1 + arch.caution) * 1.4;
        score += z.danger * (arch.aggression > 0 ? arch.aggression * 2 : -arch.caution * 2);

        // Remembered dread: bodies, ambushes and hazards leave a mark.
        const threat = rememberedThreat(state, t, z.name);
        score -= threat * (1 + arch.caution) * 1.5;
        if (t.stance === 'Evasive' && threat > MEMORY.avoidThreshold) score -= 3;

        // Remembered company: hunters follow it, hiders run from it.
        const rivals = rememberedRivals(state, t, z.name);
        if (rivals > 0) {
            const seeking = t.stance === 'Aggressive' || arch.aggression > 0.1;
            score += seeking
                ? rivals * MEMORY.rivalSeekWeight
                : -rivals * MEMORY.rivalAvoidWeight * (1 + arch.caution);
        }

        // A vengeance target's last known position beats every other consideration.
        if (ensureMemory(t).vengeance.length > 0) {
            const hunted = state.tributes.filter(o =>
                o.status === 'alive' && hasVengeanceAgainst(t, o.id) && o.zone === z.name);
            if (hunted.length > 0 && rivals > 0) score += 4;
        }

        // Ground they believe they already stripped is not worth walking back to.
        score -= rememberedBarren(state, t, z.name) * MEMORY.barrenWeight;

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

/** Applies one arena-specific event to a tribute, honouring their dodge stat. */
function applyArenaEvent(ctx: SimContext, t: Tribute, event: ArenaEventDef) {
    const isBoon = (event.heal ?? 0) > 0 || (event.quench ?? 0) > 0 || (event.feed ?? 0) > 0;
    const vars = { tribute: t.name, zone: t.zone };

    if (event.dodgeStat) {
        const difficulty = event.dodgeDifficulty ?? 6;
        const roll = t.attributes[event.dodgeStat] + ctx.rng.nextInt(0, 4) - (t.injuries.legs ? 2 : 0);
        if (roll > difficulty) {
            ctx.logEvent(fill(event.escapeText, vars), [t.id], { category: isBoon ? 'survival' : 'hazard' });
            return;
        }
    }

    if (event.damage) applyDamage(ctx, t, event.damage, { cause: event.cause, kind: 'hazard' });
    if (event.heal) t.health = Math.min(100, t.health + event.heal);
    if (event.bleeding) t.injuries.bleeding = true;
    if (event.poisoned) t.injuries.poisoned = true;
    if (event.burned) t.injuries.burned = true;
    if (event.frostbitten) t.injuries.frostbitten = true;
    if (event.infected) t.injuries.infected = true;
    if (event.sanity) t.vitals.sanity -= event.sanity;
    if (event.thirst) t.vitals.thirst += event.thirst;
    if (event.hunger) t.vitals.hunger += event.hunger;
    if (event.fatigue) t.vitals.fatigue += event.fatigue;
    if (event.quench) t.vitals.thirst = Math.max(0, t.vitals.thirst - event.quench);
    if (event.feed) t.vitals.hunger = Math.max(0, t.vitals.hunger - event.feed);
    if (event.grantItem) {
        const item = ITEMS.find(i => i.id === event.grantItem);
        if (item) t.inventory.push({ ...item });
    }
    clampTribute(t);

    if (!isBoon) addZoneThreat(ctx.state, t, t.zone, MEMORY.hazardThreat);

    ctx.logEvent(fill(event.text, vars), [t.id], {
        important: !isBoon,
        category: isBoon ? 'survival' : 'hazard',
    });
    if (!isBoon) checkDeath(ctx, t, event.cause);
}

/**
 * Threat assessment: who else is standing here, and can I take them?
 * Returns the ratio of hostile power to the tribute's own, allies included.
 */
function assessZone(t: Tribute, occupants: Tribute[]) {
    const power = (o: Tribute) => o.attributes.strength + o.attributes.agility
        + (o.inventory.some(i => i.type === 'weapon') ? 4 : 0) + o.health / 25;

    let hostile = 0;
    let friendly = 0;
    occupants.forEach(o => {
        if (o.id === t.id) return;
        const allied = t.allianceId !== undefined && t.allianceId === o.allianceId;
        const friend = allied || getRel(t, o.id) > 25;
        if (friend) friendly += power(o);
        else hostile += power(o);
    });

    const own = power(t) + friendly;
    return { ratio: own > 0 ? hostile / own : 0, hostile, friendly };
}

/**
 * Stance selection with hysteresis.
 *
 * The old rule recomputed stance from health and archetype every single cycle,
 * so a tribute hovering around 40 health flipped Evasive/Defensive on alternate
 * turns forever, and nobody ever noticed the four Careers standing next to
 * them. Stance is now scored — including who else is in the zone — and a
 * challenger has to clearly beat the incumbent to take over.
 */
function updateStance(ctx: SimContext, t: Tribute, occupants: Tribute[]) {
    const arch = ARCHETYPES[t.archetype];
    const hasWeapon = t.inventory.some(i => i.type === 'weapon');
    const { ratio } = assessZone(t, occupants);
    const wounded = t.injuries.bleeding || t.injuries.infected || t.injuries.poisoned;

    const scores: Record<Stance, number> = { Aggressive: 0, Defensive: 1, Evasive: 0 };

    scores.Aggressive += arch.aggression * 3;
    scores.Aggressive += hasWeapon ? 1.2 : -1.2;
    scores.Aggressive += (t.health - STANCE.aggressiveHealth) / 30;
    if (t.isCareer) scores.Aggressive += 0.8;
    if (t.traits.includes('Bloodthirsty')) scores.Aggressive += 1;
    if (t.traits.includes('Pacifist')) scores.Aggressive -= 1.5;
    if (ensureMemory(t).vengeance.length > 0) scores.Aggressive += 1.5;
    if (ratio > 0 && ratio < STANCE.dominantRatio) scores.Aggressive += 1.2;

    scores.Evasive += arch.caution * 3;
    scores.Evasive += (STANCE.evasiveHealth - t.health) / 25;
    if (wounded) scores.Evasive += 1;
    if (!hasWeapon) scores.Evasive += 0.6;
    if (ratio > STANCE.outmatchedRatio) scores.Evasive += 1.6;
    if (arch.caution > 0.2 && t.health < STANCE.cautiousEvasiveHealth) scores.Evasive += 1;
    if (ctx.state.config.enableSanity && t.vitals.sanity < VITALS.breakdownThreshold) scores.Evasive += 0.8;

    scores.Defensive += 0.5 - Math.abs(arch.aggression) - Math.abs(arch.caution);
    if (t.allianceId) scores.Defensive += 0.5;

    // A genuine emergency overrides the hold: nobody stands their ground bleeding out.
    const emergency = t.health < STANCE.evasiveHealth * 0.6 || ratio > STANCE.outmatchedRatio * 1.6;

    const ranked = (Object.entries(scores) as Array<[Stance, number]>).sort((a, b) => b[1] - a[1]);
    const [bestStance, bestScore] = ranked[0];

    if (bestStance === t.stance) {
        t.stanceHeld += 1;
        return;
    }
    if (!emergency && t.stanceHeld < STANCE.minHold) {
        t.stanceHeld += 1;
        return;
    }
    if (!emergency && bestScore < scores[t.stance] + STANCE.switchMargin) {
        t.stanceHeld += 1;
        return;
    }

    t.stance = bestStance;
    t.stanceHeld = 0;
}

export function processDayNight(ctx: SimContext, time: 'day' | 'night') {
    ctx.rng = new RNG(`${ctx.state.seed}-${ctx.state.day}-${time}`);
    advanceCycle(ctx.state);
    const alive = getAlive(ctx.state);
    const allZoneNames = zoneNames(ctx.state.arena);
    const flavor = arenaFlavor(ctx.state.arena.id);

    // Occasional scene-setting line so the feed reads like a broadcast, not a spreadsheet.
    if (ctx.rng.chance(ENCOUNTERS.ambientLineChance)) {
        const pool = ctx.rng.chance(ENCOUNTERS.ambientArenaShare) ? flavor.ambient : AMBIENT_TEXTS;
        ctx.logEvent(ctx.pickText(pool), [], { category: 'arena' });
    }

    // 0. Hazard Escalation & Safe Zone Shrinking over time (starts Day 5+)
    const isEscalated = ctx.state.day >= ESCALATION.startDay;
    if (isEscalated) {
        const collapseCount = Math.min(allZoneNames.length - 1, ctx.state.day - (ESCALATION.startDay - 1));
        const collapsedList = allZoneNames.slice(allZoneNames.length - collapseCount);
        ctx.state.collapsedZones = collapsedList;

        alive.forEach(t => {
            if (collapsedList.includes(t.zone)) {
                // The Gamemakers want a victor, not an empty arena: the border
                // herds the last survivors together rather than finishing them.
                const finalists = getAlive(ctx.state).length <= ESCALATION.finalistCount;
                const damage = finalists
                    ? ESCALATION.finalistCollapseDamage
                    : ESCALATION.collapseDamageBase + (ctx.state.day - ESCALATION.startDay) * ESCALATION.collapseDamagePerDay;
                const safeZones = allZoneNames.filter(z => !collapsedList.includes(z));
                const newSafeZone = safeZones[0] || allZoneNames[0];
                const trappedZone = t.zone;

                applyDamage(ctx, t, damage, {
                    cause: `Caught in the collapsing border of ${trappedZone}`,
                    kind: 'arena',
                });
                ctx.logEvent(
                    `BORDER COLLAPSE: ${t.name} is caught inside the failing border of ${trappedZone}. They take ${damage} damage clawing their way into ${newSafeZone}.`,
                    [t.id],
                    { important: true, zone: newSafeZone, category: 'hazard' }
                );
                t.zone = newSafeZone;
                addZoneThreat(ctx.state, t, trappedZone, MEMORY.deathThreat);
                checkDeath(ctx, t, `Caught in the collapsing border of ${trappedZone}`);
            }
        });
    }
    const collapsed = ctx.state.collapsedZones || [];

    // 1. Item Degradation & Spoilage
    getAlive(ctx.state).forEach(t => {
        t.inventory = t.inventory.filter(item => {
            if (item.type === 'food' && item.spoilage !== undefined) {
                item.spoilage -= 1;
                if (item.spoilage <= 0) {
                    ctx.logEvent(`${t.name} throws away their spoiled ${item.name}.`, [t.id], { category: 'survival' });
                    return false;
                }
            }
            return true;
        });
    });

    // 2. Vitals, Terrain & Status Effects
    getAlive(ctx.state).forEach(t => {
        const zone = getZone(ctx.state.arena, t.zone);
        let hungerDrain = VITALS.hungerDrain;
        let thirstDrain = VITALS.thirstDrain;
        let fatigueDrain = time === 'day' ? VITALS.fatigueDayDrain : VITALS.fatigueNightRecovery;

        // Terrain effects
        if (zone) {
            if (zone.terrain === 'water' || zone.terrain === 'wetland') thirstDrain -= VITALS.waterThirstRelief;
            if (zone.terrain === 'highland') fatigueDrain += VITALS.highlandFatiguePenalty;
            if (zone.terrain === 'forest' && time === 'night') fatigueDrain -= VITALS.forestNightShelter;
        }

        // Arena climate effects
        applyClimate(ctx, t, time, () => { fatigueDrain += CLIMATE.frozenFatigue; }, () => { thirstDrain *= CLIMATE.solarThirstMultiplier; }, () => { fatigueDrain += CLIMATE.stormFatigue; });

        // Trait Effects
        if (t.traits.includes('Hydrophilic')) thirstDrain -= TRAIT_EFFECTS.hydrophilicThirstRelief;
        if (t.traits.includes('Insomniac') && time === 'night') fatigueDrain += TRAIT_EFFECTS.insomniacNightFatigue;
        if (t.traits.includes('Iron Stomach')) hungerDrain -= TRAIT_EFFECTS.ironStomachHungerRelief;
        if (t.traits.includes('Star-Crossed')) {
            t.sponsorTrust = Math.min(100, t.sponsorTrust + TRAIT_EFFECTS.starCrossedTrustPerCycle);
            t.excitementRating += TRAIT_EFFECTS.starCrossedExcitementPerCycle;
        }
        // Younger tributes burn through rations faster and sleep worse.
        if (t.age <= TRAIT_EFFECTS.youngAge) {
            hungerDrain += TRAIT_EFFECTS.youngHungerPenalty;
            fatigueDrain += TRAIT_EFFECTS.youngFatiguePenalty;
        }

        t.vitals.hunger += Math.max(0, hungerDrain);
        t.vitals.thirst += Math.max(0, thirstDrain);
        t.vitals.fatigue += fatigueDrain;
        t.vitals.sanity -= VITALS.baseSanityDrain;
        clampTribute(t);

        // Status damage, each attributed to what actually caused it.
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

        // Antidote cures poison before it becomes lethal
        if (t.injuries.poisoned) {
            const antidoteIdx = t.inventory.findIndex(i => i.id === 'antidote');
            if (antidoteIdx >= 0) {
                t.inventory.splice(antidoteIdx, 1);
                t.injuries.poisoned = false;
                ctx.logEvent(`${t.name} downs an Antidote Vial just in time, purging the venom from their blood.`, [t.id], { important: true, category: 'survival' });
            }
        }

        // Consume medical items to heal wounds, cure infections, or restore health
        const medkitIdx = t.inventory.findIndex(i => i.id === 'medkit');
        if (medkitIdx >= 0 && (t.health < MEDICAL.medkitHealthThreshold || Object.values(t.injuries).some(v => v))) {
            t.inventory.splice(medkitIdx, 1);
            t.health = Math.min(100, t.health + MEDICAL.medkitHeal);
            t.injuries = { head: false, torso: false, arms: false, legs: false, bleeding: false, infected: false, poisoned: t.injuries.poisoned, burned: false, frostbitten: false };
            ctx.logEvent(`${t.name} works through a First Aid Kit, stitching and binding everything they can reach.`, [t.id], { important: true, category: 'survival' });
        } else {
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

        clampTribute(t);
        // No priority-chain guessing: the obituary names whatever landed last.
        checkDeath(ctx, t);
    });

    const currentAlive = getAlive(ctx.state);
    const occupantsOf = (zoneName: string) => currentAlive.filter(o => o.status === 'alive' && o.zone === zoneName);

    // 3. Dynamic Stances, Movement (Zone Graph) & Crafting
    const acted = new Set<string>();
    currentAlive.forEach(t => {
        if (t.status !== 'alive') return;

        // Crafting
        const hasRope = t.inventory.findIndex(i => i.id === 'rope');
        const hasKnife = t.inventory.findIndex(i => i.id === 'knife');
        if (hasRope >= 0 && hasKnife >= 0 && !t.inventory.some(i => i.id === 'spear')) {
            t.inventory.splice(Math.max(hasRope, hasKnife), 1);
            t.inventory.splice(Math.min(hasRope, hasKnife), 1);
            const spear = ITEMS.find(i => i.id === 'spear')!;
            t.inventory.push({ ...spear });
            ctx.logEvent(`${t.name} lashes a knife to a shaft with rope and walks away holding a Spear.`, [t.id], { category: 'loot' });
        }
        // Tricksters can improvise a garrote from wire
        if (t.archetype === 'trickster') {
            const hasWire = t.inventory.findIndex(i => i.id === 'wire');
            if (hasWire >= 0 && !t.inventory.some(i => i.id === 'garrote')) {
                t.inventory.splice(hasWire, 1);
                const garrote = ITEMS.find(i => i.id === 'garrote')!;
                t.inventory.push({ ...garrote });
                ctx.logEvent(`${t.name} twists a length of wire into a garrote and tests it on a branch.`, [t.id], { category: 'loot' });
            }
        }

        // What they can see from where they stand, before they decide anything.
        const here = occupantsOf(t.zone);
        const hostiles = here.filter(o => o.id !== t.id && o.allianceId !== t.allianceId).length;
        noteSighting(ctx.state, t, t.zone, hostiles, depletionOf(ctx.state, t.zone));

        updateStance(ctx, t, here);

        // Movement
        if (ctx.state.config.enableSanity && t.vitals.sanity < VITALS.breakdownThreshold && ctx.rng.chance(VITALS.breakdownChance)) {
            handleInsanity(ctx, t);
            acted.add(t.id);
            return;
        }

        if (t.allianceId) {
            // Alliance members move together
            const allianceMembers = currentAlive.filter(m => m.allianceId === t.allianceId && m.status === 'alive');
            const leader = allianceMembers[0];
            if (leader && t.id === leader.id) {
                if (t.stance === 'Evasive' || ctx.rng.chance(ENCOUNTERS.wanderChance)) {
                    const options = reachableZones(ctx.state.arena, t.zone, collapsed);
                    if (options.length > 0) {
                        const newZone = pickDestination(ctx, t, options).name;
                        if (t.zone !== newZone) {
                            allianceMembers.forEach(m => m.zone = newZone);
                            if (t.stance !== 'Evasive') {
                                ctx.logEvent(
                                    `The alliance of ${allianceMembers.map(m => m.name).join(', ')} moves out to ${newZone}.`,
                                    allianceMembers.map(m => m.id),
                                    { zone: newZone, category: 'travel' }
                                );
                            }
                        }
                    }
                }
            }
        } else if (t.stance === 'Evasive' || ctx.rng.chance(ENCOUNTERS.wanderChance)) {
            const options = reachableZones(ctx.state.arena, t.zone, collapsed);
            if (options.length > 0) {
                const newZone = pickDestination(ctx, t, options).name;
                if (t.zone !== newZone) {
                    t.zone = newZone;
                    if (t.stance !== 'Evasive') {
                        ctx.logEvent(
                            fill(ctx.pickText(flavor.actions.travel), { tribute: t.name, zone: newZone }),
                            [t.id],
                            { zone: newZone, category: 'travel' }
                        );
                    }
                }
            }
        }
    });

    const shuffled = ctx.rng.shuffle(currentAlive);

    shuffled.forEach(t => {
        if (acted.has(t.id) || t.status === 'dead') return;

        const zone = getZone(ctx.state.arena, t.zone);
        const zoneDanger = zone ? 0.5 + zone.danger : 1; // 0.5x-1.5x from zone danger
        let eventChance = ENCOUNTERS.baseEventChance * zoneDanger;
        let muttChance = ENCOUNTERS.baseMuttChance * zoneDanger;
        if (isEscalated) {
            const multiplier = 1 + (ctx.state.day - ESCALATION.startDay) * ESCALATION.hazardMultiplierPerDay;
            eventChance = Math.min(ESCALATION.hazardCeiling, eventChance * multiplier);
            muttChance = Math.min(ESCALATION.hazardCeiling, muttChance * multiplier);
        }
        eventChance = Math.min(ENCOUNTERS.hazardCeiling, eventChance * ctx.state.config.hazardRate);
        muttChance = Math.min(ENCOUNTERS.hazardCeiling, muttChance * ctx.state.config.hazardRate);

        if (ctx.rng.chance(eventChance)) {
            applyArenaEvent(ctx, t, ctx.rng.pick(flavor.events));
            acted.add(t.id);
            return;
        }

        if (ctx.rng.chance(muttChance)) {
            const mutt = ctx.rng.pick(ctx.state.arena.mutts);
            if (t.attributes.agility > ENCOUNTERS.muttEvasionAgility && ctx.rng.chance(ENCOUNTERS.muttEvasionChance)) {
                ctx.logEvent(`${t.name} outruns a pack of ${mutt} through ${t.zone}.`, [t.id], { category: 'mutt' });
            } else {
                applyDamage(ctx, t, ENCOUNTERS.muttDamage, { cause: `Torn apart by ${mutt}`, kind: 'mutt' });
                t.injuries.bleeding = true;
                addZoneThreat(ctx.state, t, t.zone, MEMORY.hazardThreat * 2);
                ctx.logEvent(`${t.name} is set upon by ${mutt} in ${t.zone} and barely breaks free.`, [t.id], { important: true, category: 'mutt' });
                checkDeath(ctx, t, `Torn apart by ${mutt}`);
            }
            acted.add(t.id);
            return;
        }

        // Only encounter others in the SAME ZONE
        const others = shuffled.filter(o => o.id !== t.id && !acted.has(o.id) && o.status === 'alive' && o.zone === t.zone);
        if (others.length === 0) {
            idleAction(ctx, t, flavor);
            acted.add(t.id);
            return;
        }

        if (ctx.rng.chance(ENCOUNTERS.meetChance)) {
            // Three or more free bodies in one zone is a group problem.
            const hostilePresent = others.filter(o => o.allianceId === undefined || o.allianceId !== t.allianceId);
            if (others.length >= 2 && hostilePresent.length >= 1 && ctx.rng.chance(ENCOUNTERS.groupFightChance)) {
                const party = [t, ...others].slice(0, ENCOUNTERS.maxBrawlSize);
                const anyAggressive = party.some(p => p.stance === 'Aggressive');
                const anyGrudge = party.some(p => party.some(q => q.id !== p.id && getRel(p, q.id) < -10));
                if (anyAggressive || anyGrudge) {
                    party.forEach(p => acted.add(p.id));
                    resolveGroupCombat(ctx, party);
                    return;
                }
            }
            resolvePairEncounter(ctx, t, others[0]);
            acted.add(t.id);
            acted.add(others[0].id);
            return;
        }

        idleAction(ctx, t, flavor);
        acted.add(t.id);
    });

    // 4. Cycle upkeep: the arena restocks, memories fade, bonds cool, the
    // crowd's attention wanders. Systems that only ever wrote to state now
    // have something reading back out of it.
    regenerateZones(ctx.state);
    decayMemories(ctx.state);
    decayRelationships(ctx.state);
    decayAllianceTrust(ctx.state);
    getAlive(ctx.state).forEach(t => {
        // Excitement is a decaying asset — you cannot coast on a day-1 highlight
        // reel while someone else is having a far more eventful day 6.
        t.excitementRating = Math.max(0, Math.round(
            t.excitementRating * (1 - SPONSORS.excitementDecayPerCycle) - SPONSORS.excitementFloorDecay
        ));
        driftReputation(t, SPONSORS.trustDriftPerCycle);
        clampTribute(t);
    });

    processSponsors(ctx);
}

/** Arena-specific climate pressure, kept out of the main vitals loop. */
function applyClimate(
    ctx: SimContext,
    t: Tribute,
    time: 'day' | 'night',
    onFrozen: () => void,
    onSolar: () => void,
    onStorm: () => void,
) {
    const arenaId = ctx.state.arena.id;

    if (arenaId === 'frozen' || arenaId === 'procedural-highlands') {
        const hasWarmth = t.inventory.some(i => i.id === 'matches');
        if (!hasWarmth) {
            onFrozen();
            applyDamage(ctx, t, CLIMATE.frozenChipDamage, { cause: 'Froze to death', kind: 'climate' });
            if (time === 'night' && ctx.rng.chance(CLIMATE.frozenFrostbiteChance) && !t.injuries.frostbitten) {
                t.injuries.frostbitten = true;
                ctx.logEvent(`${t.name}'s fingers blacken with frostbite in the freezing night.`, [t.id], { important: true, category: 'injury' });
            }
        }
    } else if (arenaId === 'solar' || arenaId === 'saltflats') {
        onSolar();
        if (time === 'day' && ctx.rng.chance(CLIMATE.solarBurnChance) && !t.injuries.burned) {
            t.injuries.burned = true;
            ctx.logEvent(`${t.name} blisters badly under the merciless solar glare.`, [t.id], { category: 'injury' });
        }
    } else if (arenaId === 'toxic' || arenaId === 'sporefields') {
        if (ctx.rng.chance(CLIMATE.toxicSanityChance)) t.vitals.sanity -= CLIMATE.toxicSanityLoss;
        if (ctx.rng.chance(CLIMATE.toxicPoisonChance) && !t.injuries.poisoned) {
            t.injuries.poisoned = true;
            ctx.logEvent(`${t.name} drinks tainted swamp water and the toxins take hold.`, [t.id], { important: true, category: 'injury' });
        }
    } else if (arenaId === 'ashfall' || arenaId === 'procedural-volcanic') {
        if (ctx.rng.chance(CLIMATE.ashenLungChance)) {
            t.vitals.sanity -= CLIMATE.ashenSanityLoss;
            applyDamage(ctx, t, 4, { cause: 'Choked on volcanic ash', kind: 'climate' });
        }
    } else if (arenaId === 'tempest' || arenaId === 'procedural-archipelago') {
        onStorm();
        if (ctx.rng.chance(CLIMATE.tidalDrenchChance)) {
            t.vitals.thirst = Math.max(0, t.vitals.thirst - 10);
            t.vitals.fatigue += 6;
        }
    }
    clampTribute(t);
}

/** A pair who happen to be standing in the same zone with time on their hands. */
function resolvePairEncounter(ctx: SimContext, t: Tribute, other: Tribute) {
    const inSameAlliance = t.allianceId !== undefined && t.allianceId === other.allianceId;
    const relationship = getRel(t, other.id);
    const vars = { t1: t.name, t2: other.name, zone: t.zone };
    noteContact(ctx.state, t, other);

    // A sworn debt overrides everything else in the arena.
    if (hasVengeanceAgainst(t, other.id) || hasVengeanceAgainst(other, t.id)) {
        resolveCombat(ctx, t, other);
        return;
    }

    if (inSameAlliance) {
        // Share resources within alliance
        const tHungry = t.vitals.hunger > 40;
        const oHasFood = other.inventory.some(i => i.type === 'food');
        if (tHungry && oHasFood) {
            const foodIdx = other.inventory.findIndex(i => i.type === 'food');
            const food = other.inventory.splice(foodIdx, 1)[0];
            t.vitals.hunger = Math.max(0, t.vitals.hunger - 40);
            ctx.logEvent(`${other.name} hands ${t.name} their ${food.name} without being asked.`, [t.id, other.id], { category: 'alliance' });
        }
        adjustMutual(ctx.state, t, other, 5);
        ctx.logEvent(fill(ctx.pickText(ALLIANCE_TEXTS.support), vars), [t.id, other.id], { category: 'alliance' });
    } else if (relationship > 20) {
        ctx.logEvent(fill(ctx.pickText(ENCOUNTER_TEXTS.shareResources), vars), [t.id, other.id], { category: 'alliance' });
        t.vitals.hunger = Math.max(0, t.vitals.hunger - 10);
        other.vitals.hunger = Math.max(0, other.vitals.hunger - 10);
        adjustMutual(ctx.state, t, other, 5);
    } else if (t.stance === 'Aggressive' || other.stance === 'Aggressive' || relationship < -10) {
        resolveCombat(ctx, t, other);
    } else if (ctx.rng.chance(0.5)) {
        ctx.logEvent(fill(ctx.pickText(ENCOUNTER_TEXTS.peaceful), vars), [t.id, other.id], { category: 'survival' });
    } else {
        ctx.logEvent(fill(ctx.pickText(ENCOUNTER_TEXTS.friendly), vars), [t.id, other.id], { category: 'alliance' });
        t.vitals.sanity = Math.min(100, t.vitals.sanity + 10);
        other.vitals.sanity = Math.min(100, other.vitals.sanity + 10);
        adjustMutual(ctx.state, t, other, 10);
    }
    clampTribute(t);
    clampTribute(other);
}

/**
 * Idle turn. Foraging now draws a zone down, so a rich forest is a
 * prize two tributes can strip between them rather than an infinite larder.
 */
function idleAction(ctx: SimContext, t: Tribute, flavor: ReturnType<typeof arenaFlavor>) {
    const zone = getZone(ctx.state.arena, t.zone);

    if (t.stance === 'Evasive') {
        ctx.logEvent(fill(ctx.pickText(flavor.actions.hide), { tribute: t.name, zone: t.zone }), [t.id], { category: 'survival' });
        return;
    }

    if (t.stance === 'Defensive') {
        const yield_ = effectiveResources(ctx.state, zone);
        const forageChance = ZONES.baseForageChance
            + yield_ * ZONES.yieldForageWeight
            + (t.archetype === 'survivalist' ? ZONES.survivalistForageBonus : 0)
            + (t.traits.includes('Tracker') ? TRAIT_EFFECTS.trackerForageBonus : 0);

        if (ctx.rng.chance(forageChance)) {
            const item = ctx.rng.pick(ITEMS.filter(i => i.type === 'food' || i.type === 'water'));
            t.inventory.push({ ...item });
            depleteZone(ctx.state, t.zone, ZONES.depletionPerForage);
            ctx.logEvent(
                fill(ctx.pickText(flavor.actions.forage), { tribute: t.name, zone: t.zone, item: itemPhrase(item) }),
                [t.id],
                { category: 'loot' }
            );
        } else {
            depleteZone(ctx.state, t.zone, ZONES.depletionPerAttempt);
            const stripped = depletionOf(ctx.state, t.zone) > ENCOUNTERS.strippedZoneNotice;
            ctx.logEvent(
                stripped
                    ? `${t.name} works over ${t.zone} and finds it already stripped bare. Someone has been here first.`
                    : fill(ctx.pickText(flavor.actions.rest), { tribute: t.name, zone: t.zone }),
                [t.id],
                { category: 'survival' }
            );
        }
        noteSighting(ctx.state, t, t.zone, 0, depletionOf(ctx.state, t.zone));
        return;
    }

    ctx.logEvent(fill(ctx.pickText(flavor.actions.hunt), { tribute: t.name, zone: t.zone }), [t.id], { category: 'survival' });
}

function handleInsanity(ctx: SimContext, t: Tribute) {
    const roll = ctx.rng.nextFloat();
    const vars = { tribute: t.name, zone: t.zone };
    if (roll < 0.4) {
        ctx.logEvent(fill(ctx.pickText(SANITY_TEXTS.hallucination), vars), [t.id], { important: true, category: 'sanity' });
        t.vitals.sanity -= 5;
    } else if (roll < 0.7) {
        ctx.logEvent(fill(ctx.pickText(SANITY_TEXTS.ruinStealth), vars), [t.id], { important: true, category: 'sanity' });
        t.attributes.stealth = Math.max(0, t.attributes.stealth - 2);
    } else if (t.inventory.length > 0) {
        const itemIdx = ctx.rng.nextInt(0, t.inventory.length - 1);
        const item = t.inventory.splice(itemIdx, 1)[0];
        ctx.logEvent(fill(ctx.pickText(SANITY_TEXTS.dropItem), { ...vars, item: item.name }), [t.id], { important: true, category: 'sanity' });
    } else {
        ctx.logEvent(fill(ctx.pickText(SANITY_TEXTS.hallucination), vars), [t.id], { important: true, category: 'sanity' });
    }
    clampTribute(t);
}
