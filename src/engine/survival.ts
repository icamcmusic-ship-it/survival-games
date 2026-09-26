import { Tribute, attr } from '../models/types';
import { ARENA_LAWS, CAREER_APPETITE, ZONES, POISONING, FATIGUE_MISTAKES, SANITY_BANDS, DRIFT, CRAFTING, INJURY_DAMAGE, INVENTORY, MEDICAL, QUELL_MECHANICS, RECOVERY, SANITY, TESSERAE, TOOLS, TRAIT_EFFECTS, UNIVERSAL_DEATHS, VITALS, WATER, SITUATIONAL_KIT , AUDIT12_TRIBUTES } from '../data/balance';
import { SimContext, getAlive } from './context';
import { adjustRel, getRel } from './relationships';
import { samePlace } from './verticality';
import { resolveTreatmentScarcity } from './triage';
import { applyDamage, checkDeath } from './combat';
import { climateOf } from './climate';
import { applyExposure } from './exposure';
import { getZone, zoneFeatures } from './map';
import { hasEffect } from './zoneEffects';
import { cycleOf } from './memory';
import { consumeOne, encumbranceOf, hasTool, spoilageBonus } from './items';
import { clampTribute } from './vitals';
import { warmthOf } from './composure';
import { sanityBandOf } from './sanityBands';
import { decayIdleDrift, profOf, trainProficiency, trainTerrainSkills } from './proficiency';
import { bleedDamage, clearBleeding, gradeDamageScale, healInjury, injure, tickBleeding, tickWoundRecovery, injuryGrade } from './wounds';
import { rememberedThreat } from './memory';
import { fearOf } from './fear';
import { hasCamp } from './fieldcraft';
import { applySepsisDrain, isSeptic, tickInfection, treatInfection } from './infection';
import { SURVIVAL_TEXTS } from '../data/flavorText';
import { fill } from './encounters';
import { craftOf } from '../data/districts';
import { traitMod } from '../data/traits';
import { addExcitement } from './audience';
import { earnTrait } from './earnedTraits';
import { OBJECTIVES, PROFICIENCY, SLEEP, SOCIAL_AXES } from '../data/balance';
import { bodyLabel, driftCondition, effectiveAgility, hungerDrainMultiplier, starvationBuffer, waterNeedMultiplier, youthRecoveryMultiplier } from './physique';
import { arenaHasLaw, wildcardIs } from './gamesProfile';
import { isEvasiveStance } from '../data/stances';
import { loseSanity } from './sanityBands';
import { isStarCrossed, allied } from './alliance';

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

/**
 * 'The Mandatory Alliance': every tribute must stay within one zone of their
 * district partner or pay for it in fatigue and sanity, every cycle they're
 * apart. `board` is already the alive-tributes list `processVitals` built.
 */
function applyMandatoryPartnerDrain(ctx: SimContext, t: Tribute, board: Tribute[]) {
    if (!wildcardIs(ctx.state, 'quell-mandatory-partner')) return;
    const partner = board.find(o => o.id !== t.id && o.district === t.district);
    if (!partner) return; // no living partner left — nothing left to enforce
    const zone = getZone(ctx.state.arena, t.zone);
    const withinOne = t.zone === partner.zone || (zone?.adjacent.includes(partner.zone) ?? false);
    if (withinOne) return;
    loseSanity(t, QUELL_MECHANICS.mandatoryPartnerSanityDrain);
    t.vitals.fatigue += QUELL_MECHANICS.mandatoryPartnerFatigueDrain;
}

/** Terrain, climate and traits, applied as modifiers to the base drains. */
function drainsFor(ctx: SimContext, t: Tribute, time: 'day' | 'night') {
    let hunger = VITALS.hungerDrain;
    let thirst = VITALS.thirstDrain;
    // `noNight`: the sun never sets on this arena, so there is no true rest
    // phase — fatigue drains at the day rate even during the scheduled
    // 'night' phase, and never gets the night's recovery.
    const noNight = arenaHasLaw(ctx.state, 'noNight');
    let fatigue: number = time === 'day' || noNight ? VITALS.fatigueDayDrain : VITALS.fatigueNightRecovery;

    const zone = getZone(ctx.state.arena, t.zone);
    if (zone) {
        // `noWaterExceptZone`: only the arena's one designated water source
        // gives any relief at all — everywhere else is as dry as open ground.
        const wateredHere = !arenaHasLaw(ctx.state, 'noWaterExceptZone') || t.zone === ctx.state.arena.lawZone;
        // §5.6: relief keys on the zone actually holding drinkable water — a
        // moorland spring waters a tribute, a brine pool never did.
        if (zoneFeatures(zone).waterSource && wateredHere) thirst -= VITALS.waterThirstRelief;
        if (zone.terrain === 'highland') fatigue += VITALS.highlandFatiguePenalty;
        if (zone.terrain === 'forest' && time === 'night') fatigue -= VITALS.forestNightShelter;
        // §3.1: the read site for the `swimming` proficiency. A cycle spent in
        // or on water is work, and how much work it is depends on whether the
        // tribute knows how to let the current do some of it. `Swimmer` seeds
        // this (see `TRAIT_PROFICIENCY_FLOOR`) rather than being the whole of
        // it, so a non-swimmer who has spent four days in the shallows is no
        // longer permanently the worse of the two.
        if (zone.terrain === 'water' || zone.terrain === 'wetland') {
            fatigue -= profOf(t, 'swimming') * PROFICIENCY.swimFatigueRelief;
        }
    }

    const climate = climateOf(ctx.state.arena.id);
    if (climate?.drains) {
        if (climate.drains.thirstMultiplier) thirst *= climate.drains.thirstMultiplier;
        if (climate.drains.fatigue) fatigue += climate.drains.fatigue;
    }

    // §1 `twinSuns`: there is nowhere in this arena out of the light. Applied
    // after the climate rather than as part of it, because it is not weather —
    // shade, cover and shelter all still work against being *seen*, and none
    // of them work against this. The one enforcement site for the law.
    if (arenaHasLaw(ctx.state, 'twinSuns')) thirst *= ARENA_LAWS.twinSunsThirstMultiplier;

    // §1 `noRest`: sleep does nothing here. `fatigue` at this point is either
    // the day's drain or the night's recovery; under this law the recovery is
    // cancelled entirely and the day's rest is worth half. Nobody in this
    // arena gets a night back.
    if (arenaHasLaw(ctx.state, 'noRest')) {
        fatigue = fatigue < 0
            ? (time === 'day' ? fatigue * ARENA_LAWS.noRestDayRecoveryFactor : 0)
            : fatigue;
    }

    // Some districts have been hungry before. District 12 rations better than
    // District 1 does, and that is the whole of what mining and the Seam buy.
    const resilience = craftOf(t.district).hungerResilience;
    if (resilience) hunger *= resilience;
    // §9.4: and the academy's bill comes due on a clock. While the horn still
    // has a pile on it a Career eats better than anybody; every cycle after
    // that, the stomach an academy built asks for more than the arena has.
    // See `CAREER_APPETITE` — the Career head start is untouched, the cost is
    // moved onto the part of the run the pack is supposed to lose.
    if (t.isCareer) {
        const past = Math.max(0, ctx.state.day - CAREER_APPETITE.graceDays);
        hunger *= 1 + Math.min(CAREER_APPETITE.multiplierCap, past * CAREER_APPETITE.perDayPastGrace);
    }
    // §7.1: a tribute who took tesserae has been rationing for years — the
    // personal version of the district-level resilience above, and the
    // mechanical teeth the reaping note promises.
    if (t.tesserae) {
        hunger *= Math.max(TESSERAE.resilienceFloorFactor, 1 - t.tesserae * TESSERAE.resiliencePerTessera);
    }

    // §3.3: hauling a laden pack all day is work.
    fatigue += encumbranceOf(t) * INVENTORY.encumbranceFatigueMax;

    // §3.1: endurance is the trait fatigue was doing two jobs for. It scales
    // the day's accumulation and the night's recovery in opposite directions,
    // so a tough tribute is not merely slower to tire but genuinely better at
    // getting a night back — which is what separates "can fight" from "can
    // keep walking on day nine".
    const stamina = (attr(t, 'endurance') - 5) * VITALS.endurancePerPoint;
    fatigue += fatigue > 0 ? -stamina : -stamina * VITALS.enduranceRecoveryShare;

    // §3.3: the young half of the age curve. A recovering night goes further
    // for a younger body; a draining day is unchanged, so this is a faster
    // bounce rather than a flat endurance bonus. The strength ceiling in
    // `strengthCapForAge` is what they pay for it.
    if (fatigue < 0) fatigue *= youthRecoveryMultiplier(t.age);

    // §3.1: the body itself. A bigger skeleton burns more whatever is wrapped
    // around it, and soft tissue is water the arena keeps asking for back.
    hunger *= hungerDrainMultiplier(t);
    thirst *= waterNeedMultiplier(t);

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
 * §3.5: the vitals compound instead of running as four parallel timers.
 *
 * hunger, thirst, fatigue and sanity each drained on their own track and each
 * applied their own penalty, which made a long run four independent clocks
 * rather than attrition. In a body they feed each other: dehydration is
 * exhausting long before it is lethal, exhaustion is what makes the arena
 * start talking to you, and a starving tribute heals from nothing. Applied
 * after the base drains land, so the matrix reads the cycle's real state.
 *
 * Deliberately one-directional and small per cycle — this is a bias on the
 * shape of a long run, not a second drain system on top of the first.
 */
function applyVitalInteractions(ctx: SimContext, t: Tribute) {
    const { hunger, thirst, fatigue } = t.vitals;

    // Dehydration accelerates fatigue. The first thing to go is the legs.
    if (thirst > VITALS.interactionThirstFrom) {
        t.vitals.fatigue += (thirst - VITALS.interactionThirstFrom) * VITALS.thirstFatigueCoupling;
    }
    // Exhaustion accelerates sanity loss — this is where the arena starts
    // making suggestions. Willpower is the trait that decides how much of it
    // actually lands (§3.1), so the two additions to the model meet here.
    if (fatigue > VITALS.interactionFatigueFrom) {
        const grip = 1 - (attr(t, 'willpower') - 5) * VITALS.willpowerSanityGuard;
        loseSanity(t, (fatigue - VITALS.interactionFatigueFrom)
            * VITALS.fatigueSanityCoupling * Math.max(VITALS.willpowerGuardFloor, grip));
    }
    // Starvation slows healing: `applyNaturalRecovery` reads `starving` off
    // the same threshold, and a body with nothing coming in does not close
    // wounds. Bleeding runs a little longer, too — see `tickBleeding`.
    if (hunger > VITALS.interactionHungerFrom && t.injuries.bleeding && ctx.rng.chance(VITALS.starvedClotPenalty)) {
        t.bleedSeverity = Math.max(t.bleedSeverity ?? 1, 1);
    }
    clampTribute(t);
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
function reliefFor(t: Tribute, cause: 'hunger' | 'thirst' | 'fatigue' | 'bleeding' | 'infected' | 'poisoned' | 'burned' | 'frostbitten') {
    switch (cause) {
        case 'hunger': t.vitals.hunger = Math.min(t.vitals.hunger, VITALS.starvingThreshold - 5); break;
        case 'thirst': t.vitals.thirst = Math.min(t.vitals.thirst, VITALS.dehydratedThreshold - 5); break;
        case 'fatigue': t.vitals.fatigue = Math.min(t.vitals.fatigue, VITALS.exhaustedThreshold - 5); break;
        case 'bleeding': clearBleeding(t); break;
        case 'infected': healInjury(t, 'infected'); break;
        case 'poisoned': healInjury(t, 'poisoned'); break;
        case 'burned': healInjury(t, 'burned'); break;
        case 'frostbitten': healInjury(t, 'frostbitten'); break;
    }
}

/**
 * §3.8: sleep debt past the deprivation threshold, as a plain number the three
 * cost sites below share. Zero for anyone who is merely tired.
 */
export function sleepDeprivation(t: Tribute): number {
    return Math.max(0, (t.sleepDebt ?? 0) - SLEEP.deprivedAt);
}

/** §3.8: forage odds a sleep-deprived tribute gives away by not seeing things. */
export function sleepForagePenalty(t: Tribute): number {
    return sleepDeprivation(t) * SLEEP.foragePenaltyPerPoint;
}

/** §3.8: odds this cycle that something goes out of the pack unnoticed. */
export function sleepDropChance(t: Tribute): number {
    return Math.min(SLEEP.maxDropChance, sleepDeprivation(t) * SLEEP.dropChancePerPoint);
}

/** §3.8: extra cycles a tired tribute is slow to leave a stance. */
export function sleepStanceHold(t: Tribute): number {
    return Math.min(SLEEP.maxStanceHold, Math.floor(sleepDeprivation(t) * SLEEP.stanceHoldPerPoint));
}

/** Untreated wounds and empty canteens, each attributed to what caused them. */
function applyStatusDamage(ctx: SimContext, t: Tribute) {
    // §3.1: condition is a starvation buffer. A Padded tribute goes hungry for
    // longer before the arena starts taking health for it; a Wasted one has
    // spent that buffer already, which is precisely when they most need it.
    if (t.vitals.hunger <= VITALS.starvingThreshold + starvationBuffer(t)) t.starvingCycles = 0;
    if (t.vitals.hunger > VITALS.starvingThreshold + starvationBuffer(t)) {
        // AUDIT-12 §5: hunger that bites. A body that has had nothing for days
        // pays more for each further cycle, not the same small toll forever.
        t.starvingCycles = (t.starvingCycles ?? 0) + 1;
        const bite = Math.min(AUDIT12_TRIBUTES.starvingDamageCap,
            VITALS.starvingDamage + (t.starvingCycles - 1) * AUDIT12_TRIBUTES.starvingDamagePerCycle);
        if (applyDamage(ctx, t, bite, { cause: 'Died of starvation', kind: 'status', code: 'starvation' })) {
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
        /*
         * AUDIT-6 §7.2: dying of thirst with the water in sight.
         *
         * Fear is modelled per-target — the whole cast can be terrified of the
         * boy from District 2 while nobody gives the girl from 11 a thought —
         * and nothing in the engine ever let that fear kill anybody. A tribute
         * standing in a zone that has water, too frightened of whoever else is
         * standing at it to go and drink, is the cleanest expression of that
         * model there is, and it was unreachable.
         */
        const zone = getZone(ctx.state.arena, t.zone);
        const scaredOff = zoneFeatures(zone ?? { features: undefined } as never).waterSource !== undefined
            && t.vitals.thirst > UNIVERSAL_DEATHS.thirstNearWaterThirst
            && getAlive(ctx.state).some(o => o.id !== t.id && o.zone === t.zone
                && fearOf(t, o.id) >= UNIVERSAL_DEATHS.thirstNearWaterFear)
            && ctx.rng.chance(UNIVERSAL_DEATHS.thirstNearWaterChance);
        const cause = scaredOff ? `Died of thirst within sight of the water in ${t.zone}` : 'Died of dehydration';
        if (applyDamage(ctx, t, VITALS.dehydratedDamage, { cause, kind: 'status', code: 'dehydration' })) {
            reliefFor(t, 'thirst');
        }
        if (scaredOff && t.status !== 'alive') {
            ctx.logEvent(
                `${t.name} dies of thirst in ${t.zone}, a hundred feet from water, because of who else is standing at it.`,
                [t.id], { important: true, zone: t.zone, category: 'death' },
            );
        }
    }

    /*
     * AUDIT-6 §7.2: eating the thing they knew better than to eat.
     *
     * `forageFailures` counts searches of a zone that turned up nothing, and it
     * existed to make repeated failure a *decision* — leave, or stop foraging
     * and start trapping. This is the third option, and the one the source
     * material is most interested in: a tribute who has come up empty three
     * times running and is genuinely starving eats it anyway. It is a poisoning
     * that is a choice rather than an accident, which nothing else in the
     * death table is.
     */
    if (t.status === 'alive'
        && t.vitals.hunger > UNIVERSAL_DEATHS.desperateForageHunger
        && (t.memory?.forageFailures?.[t.zone] ?? 0) >= UNIVERSAL_DEATHS.desperateForageFailures
        && ctx.rng.chance(UNIVERSAL_DEATHS.desperateForageChance - traitMod(t, 'poisonResist'))) {
        ctx.logEvent(
            `${t.name} has searched ${t.zone} three times and found nothing three times. What they eat in the end, `
            + 'they know about. They eat it looking at it.',
            [t.id], { important: true, zone: t.zone, category: 'survival' },
        );
        injure(t, 'poisoned');
        applyDamage(ctx, t, UNIVERSAL_DEATHS.desperateForageDamage, { cause: 'Ate what they knew better than to eat', kind: 'status', code: 'poison' });
        checkDeath(ctx, t, 'Ate what they knew better than to eat');
    }
    // §7: the body failing rather than the will. Distinct from the nightlock
    // and border-walk endings, which are a tribute deciding to stop — this is
    // one who has not decided anything and cannot go on anyway. Fatigue was
    // the only vital with a cap and no terminal state, so exhaustion never
    // appeared in a death breakdown at all.
    if (t.vitals.fatigue > VITALS.exhaustedThreshold) {
        if (applyDamage(ctx, t, VITALS.exhaustedDamage, { cause: 'Collapsed from exhaustion', kind: 'status', code: 'exhaustion' })) {
            reliefFor(t, 'fatigue');
        }
    }

    /*
     * AUDIT-6 §7.2: not waking up.
     *
     * Distinct from exhaustion above, which is a tribute collapsing awake and
     * on their feet. This is the body giving out in the night, and it is only
     * reachable in an arena whose law has taken sleep away — `noRest` (sleep
     * restores nothing) or `deadlyNight` (the dark is the hazard). The Vigil
     * already has a line for it and no other arena could produce one, which is
     * the wrong way round: the law is universal and the death should be too.
     */
    if (t.status === 'alive'
        && ctx.state.timeOfDay === 'night'
        && t.vitals.fatigue > UNIVERSAL_DEATHS.neverWokeFatigue
        && (arenaHasLaw(ctx.state, 'noRest') || arenaHasLaw(ctx.state, 'deadlyNight'))
        && ctx.rng.chance(UNIVERSAL_DEATHS.neverWokeChance)) {
        applyDamage(ctx, t, UNIVERSAL_DEATHS.neverWokeDamage, { cause: 'Did not wake', kind: 'status', code: 'exhaustion' });
        if (t.status !== 'alive') {
            ctx.logEvent(
                `${t.name} lies down in ${t.zone} and does not get up in the morning. There is no wound on them. `
                + 'Some arenas do not need one.',
                [t.id], { important: true, zone: t.zone, category: 'death' },
            );
        }
        checkDeath(ctx, t, 'Did not wake');
    }
    if (t.injuries.bleeding) {
        // Cost scales with how badly the wound is running, and the wound gets a
        // chance to clot down a step at the end of the cycle — see `wounds.ts`.
        /*
         * Audit 3 §8.2: the wound has an author, and now the death does.
         *
         * This was a sourceless `status` wound, so 6.1% of all deaths — the
         * whole bleeding-out category — were credited to nobody, however
         * clearly somebody had opened the wound. A tribute who cuts somebody
         * and walks away killed them; the arena is not a third party in that.
         *
         * `kind` stays `status` because the *damage* is attrition rather than a
         * blow, which is what the wound-severity and healing layers read it
         * for; `sourceId` is what `checkDeath` needs to find a killer.
         */
        const opener = t.bleedOpenedById
            ? ctx.state.tributes.find(o => o.id === t.bleedOpenedById && o.id !== t.id)
            : undefined;
        const bleedCause = opener
            ? `Bled out from a wound ${opener.name} opened`
            : 'Bled out from untreated wounds';
        if (applyDamage(ctx, t, bleedDamage(t), {
            cause: bleedCause,
            kind: 'status', code: 'bleeding',
            sourceId: opener?.id,
        })) {
            reliefFor(t, 'bleeding');
        }
    }
    if (t.injuries.infected) {
        if (applyDamage(ctx, t, INJURY_DAMAGE.infected * gradeDamageScale(t, 'infected'), { cause: 'Succumbed to an infected wound', kind: 'status', code: 'infection' })) {
            reliefFor(t, 'infected');
        }
    }
    if (t.injuries.poisoned) {
        if (applyDamage(ctx, t, INJURY_DAMAGE.poisoned * gradeDamageScale(t, 'poisoned'), { cause: 'Succumbed to poison', kind: 'status', code: 'poison' })) {
            reliefFor(t, 'poisoned');
        }
        loseSanity(t, INJURY_DAMAGE.poisonSanity);
    }
    if (t.injuries.burned) {
        if (applyDamage(ctx, t, INJURY_DAMAGE.burned * gradeDamageScale(t, 'burned'), { cause: 'Died of untreated burns', kind: 'status', code: 'burns' })) {
            reliefFor(t, 'burned');
        }
    }
    if (t.injuries.frostbitten) {
        // §7.7/§11.5: warmth is self-preservation. A fire or an insulated bag
        // gives frostbite a real chance to thaw before it ticks again.
        const zoneHere = getZone(ctx.state.arena, t.zone);
        const warmGround = zoneHere !== undefined
            && (zoneFeatures(zoneHere).shelterQuality ?? 0) >= TOOLS.shelterWarmHealQuality;
        if ((hasCamp(ctx, t, 'fire') || hasCamp(ctx, t, 'shelter') || hasTool(t, 'warmth') || warmGround)
            && ctx.rng.chance(TOOLS.warmFrostbiteHealChance)) {
            healInjury(t, 'frostbitten');
            ctx.logEvent(
                `${t.name} gets warm enough for long enough, and the frostbite loosens its grip.`,
                [t.id],
                { category: 'survival' }
            );
        } else if (applyDamage(ctx, t, INJURY_DAMAGE.frostbitten * gradeDamageScale(t, 'frostbitten'), { cause: 'Froze to death', kind: 'status', code: 'hypothermia' })) {
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
    // §5.6: `waterSource` is the drinkability question — a spring on a moor
    // counts, a brine sump does not, whatever the printed terrain says.
    if (!zone || !zoneFeatures(zone).waterSource) return;
    // `noWaterExceptZone`: nothing to drink anywhere but the designated zone.
    if (arenaHasLaw(ctx.state, 'noWaterExceptZone') && t.zone !== ctx.state.arena.lawZone) return;

    /*
     * AUDIT-9 stage D chain 2: "getting away with it" is a belief, not a fact.
     *
     * The audit asks this chain for "a cluster of delayed illness" and for the
     * agent's knowledge to be told apart from the world's. A contaminated
     * water source is the vector, whatever the climate does — the first
     * version of this gated on the arena's `foulWater` flag *and* on
     * contamination, which is two rare things at once and fired exactly zero
     * times in 400 runs. Anybody drinking here without something to treat it
     * walks away feeling fine; `tickExposure` decides days later whether they
     * were.
     */
    // Every drink from open water is a judgement about the water — where in
    // the flow to take it from, whether the smell is the pool or the season.
    // The read is on the foul branch below.
    trainProficiency(t, 'waterlore', undefined, PROFICIENCY.waterloreDrinkShare);
    const contaminated = hasEffect(ctx.state, t.zone, 'contaminated');
    const foul = climateOf(ctx.state.arena.id)?.foulWater === true || contaminated;
    // Purification is a property of the item now, not a hardcoded id list, so
    // tablets and a fire-and-a-pot both answer the same question.
    const purifier = t.inventory.find(i =>
        i.purifies === true || (WATER.purifiers as readonly string[]).includes(i.id));

    // §6.3: fire is the fallback purifier. No tablets, no filter — but a
    // fire and something to boil in costs only the hour it takes.
    if (foul && !purifier && hasCamp(ctx, t, 'fire')) {
        t.vitals.thirst = Math.max(0, t.vitals.thirst - WATER.zoneDrinkRelief);
        t.vitals.fatigue = Math.min(100, t.vitals.fatigue + CRAFTING.fireBoilFatigue);
        trainProficiency(t, 'waterlore', ctx);
        ctx.logEvent(
            `${t.name} boils water from ${t.zone} over their fire until it is safe to drink. It costs the hour, and it is worth the hour.`,
            [t.id],
            { type: 'zone-drinks', category: 'survival' }
        );
        return;
    }

    if (foul && !purifier) {
        // Desperate enough to drink it anyway — the thirst is the more urgent
        // problem, and the venom is a chance rather than a certainty.
        t.vitals.thirst = Math.max(0, t.vitals.thirst - WATER.zoneDrinkRelief);
        // AUDIT-9 stage D chain 2: whatever was in it is in them now, felt or
        // not. Set here because this branch returns before the general one.
        if (contaminated && !t.waterborne) {
            t.waterborne = { fromZone: t.zone, dueCycle: cycleOf(ctx.state) + WATER.waterborneIncubationCycles };
        }
        /*
         * The read site. Drinking something questionable was a flat chance
         * with nothing on either side of it, in a game where dehydration is a
         * named cause of death and the fallback for having no tablets is to
         * risk it. Somebody who has been drinking out of this arena for a week
         * has learnt which part of a pool to take it from.
         */
        const risk = WATER.foulPoisonChance
            * Math.max(0, 1 - profOf(t, 'waterlore') * PROFICIENCY.waterlorePoisonResist);
        if (!t.injuries.poisoned && ctx.rng.chance(risk)) {
            injure(t, 'poisoned');
            ctx.logEvent(
                `${t.name} is thirsty enough to drink from ${t.zone} untreated. The water goes down foul and stays down worse.`,
                [t.id],
                { important: true, category: 'injury' }
            );
        } else {
            ctx.logEvent(`${t.name} risks a drink from ${t.zone} and gets away with it.`, [t.id], { type: 'zone-drinks', category: 'survival' });
        }
        return;
    }

    // Tablets are consumed by using them; boiling is not — and §6.5, neither
    // is apparatus. A still and a charcoal filter are the heavier thing you
    // carry precisely because they are still there tomorrow.
    if (foul && purifier?.purifies && !purifier.reusable) consumeOne(t, i => i === purifier);
    t.vitals.thirst = Math.max(0, t.vitals.thirst - WATER.zoneDrinkRelief);
    ctx.logEvent(
        fill(ctx.pickText(foul ? SURVIVAL_TEXTS.drinkTreated : SURVIVAL_TEXTS.drinkClean), { tribute: t.name, zone: t.zone }),
        [t.id],
        { type: 'zone-drinks', category: 'survival' }
    );
}

/** Eating, drinking, and working through whatever medical supplies they have. */
function consumeSupplies(ctx: SimContext, t: Tribute) {
    // §3.1: a septic wound gets worked on before anything else, because it is
    // the thing that is actually killing them. Unlike every other use of a
    // medical item this does not clear the status — it buys one grade, and a
    // bad infection is several days of supplies.
    if (isSeptic(t)) treatInfection(ctx, t);
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
            // §6.3: the same ration cooked over a fire goes further — hot
            // food is one of the things a fire is actually for.
            const cooked = hasCamp(ctx, t, 'fire');
            t.vitals.hunger = Math.max(0, t.vitals.hunger - VITALS.foodRelief - (cooked ? CRAFTING.cookFeedBonus : 0));
            /*
             * AUDIT-10 B5-03: shared cooking.
             *
             * One of the twelve nonlethal events the audit names, and it needed
             * nothing new — a fire, a ration and somebody else standing there
             * were all already here and had never been put together.
             *
             * The generosity is real but it is not a donation: a pot over a
             * fire is not twice the work for two people, so what is shared is
             * the *cooking*, not the ration. The guest gets less than the cook
             * does, the cook still eats, and nobody has to be talked into it —
             * which is why this is a thing that happens between people who
             * merely tolerate each other rather than a favour like a warning.
             *
             * It trains `fieldcookery` in the cook, because feeding two is how
             * you learn to feed anybody, and it moves regard both ways: eating
             * together is the most ordinary thing two people can do in an arena
             * built to stop them.
             *
             * A first version required a fire, which made it dead content.
             * Measured before shipping: 118 tribute-cycles across 40 runs have
             * a fire at all, and the conjunction of fire *and* being hungry
             * *and* carrying a ration happened once. That is exactly the
             * opportunity failure B4-02's funnel was built to name — a beat
             * whose prerequisite is starved several steps before anybody
             * decides anything. Two people eating together is the event; the
             * fire only ever made the meal go further, which it still does.
             */
            const guest = getAlive(ctx.state).find(o => o.id !== t.id
                && samePlace(ctx.state.arena, t, o)
                && o.vitals.hunger > VITALS.eatThreshold
                && getRel(t, o.id) > CRAFTING.shareCookingMinRegard);
            if (guest) {
                guest.vitals.hunger = Math.max(0, guest.vitals.hunger - CRAFTING.sharedCookFeed);
                trainProficiency(t, 'fieldcookery', ctx, CRAFTING.shareCookingTrainShare);
                adjustRel(t, guest.id, CRAFTING.shareCookingRegard);
                adjustRel(guest, t.id, CRAFTING.shareCookingRegard);
                ctx.logEvent(
                    cooked
                        ? `${t.name} cooks their ${food.name} over the fire and puts half of it in front of `
                          + `${guest.name}. Neither of them says much. It is the most ordinary thing either has `
                          + `done since the reaping.`
                        : `${t.name} splits their ${food.name} and hands half to ${guest.name} without being `
                          + `asked. Neither of them says much. It is the most ordinary thing either has done `
                          + `since the reaping.`,
                    [t.id, guest.id],
                    { category: 'survival' },
                );
            } else if (cooked && ctx.rng.chance(CRAFTING.cookLineChance)) {
                ctx.logEvent(`${t.name} cooks their ${food.name} over the fire and eats properly for the first time in days.`, [t.id], { category: 'survival' });
            } else {
                ctx.logEvent(`${t.name} eats their ${food.name}.`, [t.id], { category: 'survival' });
            }
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

    // §5.1 `noHealing`: the arena where the medical kit is a prop. Every item
    // below still exists, still weighs something and is still worth stealing —
    // it simply does nothing when opened, so rest is the only way back up.
    if (arenaHasLaw(ctx.state, 'noHealing')) return;

    /**
     * Audit 4 §3.4: `medicine` trains here too.
     *
     * It was the only proficiency whose median holder sat below 1.0 and whose
     * ceiling across 3,800 tributes was 3.1 against a cap of 6 — on the skill
     * the `medic` archetype is built on and the `medic` alliance role is
     * scored by. The cause was opportunity, not rate: `medicine` trained on a
     * field dressing, an infection treatment, a gift and coating a blade, and
     * field dressings run about 1.7 per run across a cast of 24.
     *
     * Using a medical item on yourself is the commonest medical act in the
     * arena and taught nothing. Somebody who has packed their own wound four
     * times is better at packing a wound; that is the whole premise of the
     * proficiency system, and this is the one place it was not applied.
     */
    /*
     * AUDIT-10 B5-03: treatment scarcity, posed before the kit is spent.
     *
     * It has to run here rather than after. A decision about who gets the last
     * bandage, taken once the holder has already used it, is not a decision —
     * it is a refund.
     *
     * Its result is deliberately ignored. A first version returned early when
     * the kit was given away, which also skipped the splint, the willowbark and
     * everything else below — so a tribute who handed over a bandage could no
     * longer set their own broken arm, which is not what giving away a bandage
     * means. Nothing needs to be skipped: the beat only fires when the holder
     * has exactly one treatment item, so once it is gone every `consumeOne`
     * below finds nothing of its own accord, and treatments for other injuries
     * are untouched.
     */
    resolveTreatmentScarcity(ctx, t);

    // Antidote cures poison before it becomes lethal.
    if (t.injuries.poisoned) {
        /*
         * §6.5: antivenom is the Capitol's version of the same vial — it works
         * on the venom *and* the damage it has already done, which is what
         * separates a sponsor's answer from a scavenged one.
         */
        if (consumeOne(t, i => i.id === 'antivenom')) {
            healInjury(t, 'poisoned');
            t.health = Math.min(100, t.health + MEDICAL.antivenomHeal);
            trainProficiency(t, 'medicine', ctx);
            ctx.logEvent(
                `${t.name} breaks the seal on an antivenom ampoule and puts it in properly, the way somebody showed them once. The shaking stops inside a minute.`,
                [t.id], { important: true, category: 'survival' }
            );
            earnTrait(ctx, t, 'Venom-Wise');
        } else if (consumeOne(t, i => i.id === 'antidote')) {
            healInjury(t, 'poisoned');
            trainProficiency(t, 'medicine', ctx);
            ctx.logEvent(`${t.name} downs an Antidote Vial just in time, purging the venom from their blood.`, [t.id], { important: true, category: 'survival' });
            earnTrait(ctx, t, 'Venom-Wise');
        }
    }

    // §8.3: sterile bandages — the cheap, common answer to an open wound,
    // sitting below the full kit in both value and effect.
    if (t.injuries.bleeding) {
        if (consumeOne(t, i => i.id === 'bandages')) {
            clearBleeding(t);
            trainProficiency(t, 'medicine', ctx);
            ctx.logEvent(`${t.name} winds sterile bandages over the wound until the bleeding gives up.`, [t.id], { category: 'survival' });
        } else if (consumeOne(t, i => i.id === 'sutures')) {
            // §6.5: the good answer. Closes the wound rather than covering it.
            clearBleeding(t);
            t.health = Math.min(100, t.health + MEDICAL.sutureHeal);
            trainProficiency(t, 'medicine', ctx);
            ctx.logEvent(
                `${t.name} sews the wound shut in ${t.zone} with their own hands and their own thread, badly, and it holds.`,
                [t.id], { category: 'survival' }
            );
        } else if (consumeOne(t, i => i.id === 'tourniquet')) {
            // §6.5: the cheap answer. Stops the bleeding and costs the limb
            // some of what it had — a tourniquet is a decision, not a dressing.
            clearBleeding(t);
            // balance-exempt: which limb the wound was on is a coin, not a dial.
            injure(t, ctx.rng.chance(0.5) ? 'arms' : 'legs');
            ctx.logEvent(
                `${t.name} puts a tourniquet on above the wound and winds it until it stops. Everything below it goes cold and stays cold.`,
                [t.id], { important: true, category: 'survival' }
            );
        } else if (consumeOne(t, i => i.id === 'cautery-kit')) {
            // §6.5: the last answer. It always works and it is never free.
            clearBleeding(t);
            t.health = Math.max(1, t.health - MEDICAL.cauteryCost);
            trainProficiency(t, 'medicine', ctx);
            injure(t, 'burned');
            ctx.logEvent(
                `${t.name} heats the iron in ${t.zone}, bites down on a strap, and closes the wound with it. The screaming carries.`,
                [t.id], { important: true, category: 'survival' }
            );
        }
    }

    /*
     * §6.5: a splint. The engine tracks four limb sites and nothing in the
     * medical table addressed one — a broken arm was cleared only by a full
     * First Aid Kit, which is the most valuable item in the game.
     */
    if ((t.injuries.arms || t.injuries.legs) && consumeOne(t, i => i.id === 'splint')) {
        healInjury(t, t.injuries.legs ? 'legs' : 'arms');
        trainProficiency(t, 'medicine', ctx);
        ctx.logEvent(
            `${t.name} splints the limb in ${t.zone} and tests it, carefully, twice, before trusting it with any weight.`,
            [t.id], { category: 'survival' }
        );
    }

    /*
     * §6.5: willowbark. Not a cure — it takes a fever down a grade, which is
     * what a tribute with a turning wound and no kit actually has access to.
     */
    if (t.injuries.infected && consumeOne(t, i => i.id === 'willowbark')) {
        t.health = Math.min(100, t.health + MEDICAL.willowbarkHeal);
        t.vitals.fatigue = Math.max(0, t.vitals.fatigue - MEDICAL.willowbarkRest);
        trainProficiency(t, 'medicine', ctx);
        if (ctx.rng.chance(MEDICAL.willowbarkClearChance)) healInjury(t, 'infected');
        ctx.logEvent(
            `${t.name} boils willowbark down to something bitter in ${t.zone} and drinks it. The fever comes off the top, at least.`,
            [t.id], { category: 'survival' }
        );
    }

    const medkitIdx = t.inventory.findIndex(i => i.id === 'medkit');
    if (medkitIdx >= 0 && (t.health < MEDICAL.medkitHealthThreshold || Object.values(t.injuries).some(v => v))) {
        t.inventory.splice(medkitIdx, 1);
        t.health = Math.min(100, t.health + MEDICAL.medkitHeal);
        t.injuries = { head: false, torso: false, arms: false, legs: false, bleeding: false, infected: false, poisoned: t.injuries.poisoned, burned: false, frostbitten: false };
        // Clearing the flag is not enough — the severity has to go with it, or
        // the next scratch reopens at whatever the old wound was running at.
        clearBleeding(t);
        trainProficiency(t, 'medicine', ctx);
        ctx.logEvent(`${t.name} works through a First Aid Kit, stitching and binding everything they can reach.`, [t.id], { important: true, category: 'survival' });
        return;
    }

    // §8.3: morphling dulls what it cannot mend.
    if (t.health < MEDICAL.morphlingHealthThreshold) {
        if (consumeOne(t, i => i.id === 'morphling')) {
            t.health = Math.min(100, t.health + MEDICAL.morphlingHeal);
            t.vitals.sanity = Math.min(100, t.vitals.sanity + MEDICAL.morphlingSanity);
            ctx.logEvent(`${t.name} presses the morphling vial to their arm and the arena goes soft at the edges for a while.`, [t.id], { category: 'survival' });
        }
    }

    const ointmentIdx = t.inventory.findIndex(i => i.id === 'ointment');
    if (ointmentIdx >= 0 && (t.health < MEDICAL.ointmentHealthThreshold || t.injuries.infected || t.injuries.bleeding || t.injuries.burned)) {
        t.inventory.splice(ointmentIdx, 1);
        t.health = Math.min(100, t.health + MEDICAL.ointmentHeal);
        healInjury(t, 'infected');
        healInjury(t, 'burned');
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
    // A shelter they actually built beats whatever cover the terrain offered —
    // and §3.1, how much better depends on how well they build. This is the
    // read site for the `crafting` proficiency: the same night in the same
    // weather is worth more to somebody who has been keeping a camp alive for
    // a week than to somebody who put up a lean-to this afternoon.
    if (hasCamp(ctx, t, 'shelter')) {
        amount += CRAFTING.shelterRecoveryBonus + profOf(t, 'crafting') * PROFICIENCY.craftRestWeight;
    }
    // The most famous parachute in the source material, doing the thing it is
    // famous for: keeping somebody alive through a night they should not survive.
    if (hasTool(t, 'warmth')) amount += RECOVERY.sleepingBagBonus;
    // REPLAY-07 gave the night real teeth — a concealment bonus for whoever is
    // hunting and an ambush bonus on top of it. This is the other half of that
    // trade, without which the night is a flat tax on everybody: a tribute who
    // deliberately goes to ground in the dark actually sleeps, because the dark
    // is doing the hiding for them.
    if (isEvasiveStance(t.stance) || hasCamp(ctx, t, 'camouflage')) amount += RECOVERY.darkAndHiddenBonus;
    // Someone keeping watch is the difference between sleeping and lying awake.
    if (alliesPresent > 0) amount += RECOVERY.allyWatchBonus;
    // §16: they are not sleeping here by accident — this is the night they
    // set aside for it. A share on top of whatever the night was already
    // worth, so a bad place to rest is still a bad place to rest.
    if (t.objective?.kind === 'recover') amount *= 1 + OBJECTIVES.recoverHealingBonus;
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
    // §(requests 2): the two dials, read once here — this is the only place
    // that both drains and restores, so it is the only place they belong.
    const drainRate = ctx.state.config.sanityDrainRate ?? 1;
    const recoveryRate = ctx.state.config.sanityRecoveryRate ?? 1;
    if (!ctx.state.config.enableSanity) {
        // With sanity disabled the stat must not drift at all, or a config the
        // player turned off still quietly shapes stance scoring.
        return;
    }
    /**
     * Audit 4 §3.2: the distribution this produced was U-shaped and the bottom
     * was a trapdoor. Measured over 18,194 tribute-cycles: **31% of all live
     * tribute-time at sanity 0-9 and 31% at 90+**, with the four middle
     * deciles holding 17% between them; p25 was zero. Half the cast went all
     * the way down and **one tribute in a thousand ever came back up**
     * (`sanityRecovered` on 0.1% of the cast).
     *
     * The cause was not any single number. It was that every recovery term
     * required something a tribute at the bottom does not have — company, or a
     * night's rest they are too exhausted to take, or ground they have no bad
     * memory of — while the drains stack unconditionally. A solo tribute, which
     * is 42% of all zone-samples, could reach a net of -13 a cycle against a
     * best case of +5, so there was no configuration in which they climbed.
     *
     * Three changes below, all of them reading state the engine already keeps:
     * a camp is shelter for the mind as well as the body, being fed is a
     * positive rather than merely the absence of a drain, and exhaustion no
     * longer locks a tribute out of resting their head at exactly the point
     * they most need to.
     */
    const ownCamp = hasCamp(ctx, t, 'fire') || hasCamp(ctx, t, 'shelter');

    let drain = SANITY.baseDrain;
    if (time === 'night') drain += SANITY.nightDrain;
    // Alone in the open is not the same thing as alone somewhere you have made
    // yours. A fire is the difference, and it is the difference the whole
    // fieldcraft layer exists to let a solitary tribute make for themselves.
    if (alliesPresent === 0 && !ownCamp) drain += SANITY.isolationDrain;
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
    if (alliesPresent > 0) {
        recovery += SANITY.allyPresentRecovery;
        // §3.2: company was a flat number — any ally in the zone was worth
        // exactly as much as any other. `warmthOf` is the half of charisma
        // that answers "is this person a comfort to be near", as distinct from
        // "is this person persuasive", and the warmest ally present is the one
        // doing the work.
        const warmest = getAlive(ctx.state)
            .filter(o => o.id !== t.id && o.zone === t.zone
                && allied(o, t))
            .reduce((best, o) => Math.max(best, warmthOf(o)), 0);
        recovery += Math.max(0, warmest - SOCIAL_AXES.attributeMidpoint) * SOCIAL_AXES.allyComfortPerWarmth;
    }
    if (dread < 0.2 && t.health > 60 && t.vitals.hunger < SANITY.deprivationThreshold) {
        recovery += SANITY.safetyRecovery;
    }
    // The design comment above this function has always listed food as one of
    // the four things that push back, and food was only ever the *absence* of
    // the deprivation drain. Somebody who has eaten and drunk is steadier than
    // somebody who merely is not starving.
    if (t.vitals.hunger < SANITY.fedThreshold && t.vitals.thirst < SANITY.fedThreshold) {
        recovery += SANITY.fedRecovery;
    }
    if (ownCamp) recovery += SANITY.campRecovery;

    // Temperament on the way up. On the way down it is applied inside
    // `loseSanity`, with every other loss in the game.
    if (recovery > 0) recovery += traitMod(t, 'sanityRecovery');

    /**
     * Audit 4 §3.2: the gauge and the thirty scattered subtractions are one
     * curve now.
     *
     * Adding the two solitary recovery terms above moved `gone` from 33.0% of
     * tribute-time to 31.3% and the escape rate from 0.1% to 0.4% — almost
     * nothing. The reason turned out not to be this function at all: disabling
     * it outright left the sanity-by-day curve essentially unchanged, because
     * ~95% of all sanity loss in the game was direct writes elsewhere. See the
     * comment on `loseSanity`.
     *
     * So the drain half goes through `loseSanity` like every other loss —
     * which is also where the temperament multiplier and the empty-gauge
     * easing now live, so there is exactly one implementation of each — and
     * the recovery is applied directly, because what pulls somebody back up
     * should not be discounted for being needed.
     */
    if (recovery > 0) t.vitals.sanity = Math.min(100, t.vitals.sanity + recovery * recoveryRate);
    loseSanity(t, drain, drainRate);
}

/**
 * §3.9 / §3.5 / §3.3: the body and the mind make specific mistakes.
 *
 * Fatigue used to gate actions but never cause an error; sanity's bottom end
 * was one stealth hack; earned drift never faded. All three now leave marks a
 * reader can see in the feed.
 */
function applyWearAndTear(ctx: SimContext, t: Tribute) {
    // Fatigue mistake: drop something, or stumble.
    // §3.3: the mistake chance answers to `effectiveAgility`, not to the
    // printed number — so a ruined leg and a wasted frame make a tribute
    // measurably clumsier on day nine than they were on day one, which is the
    // arc `condition` was previously the only attribute allowed to have.
    const slip = Math.max(FATIGUE_MISTAKES.chance / 2, Math.min(FATIGUE_MISTAKES.chance * 2,
        FATIGUE_MISTAKES.chance
        - (effectiveAgility(t) - SOCIAL_AXES.attributeMidpoint) * FATIGUE_MISTAKES.agilityRelief));
    if (t.vitals.fatigue > FATIGUE_MISTAKES.threshold && ctx.rng.chance(slip)) {
        const droppable = t.inventory.filter(i => i.type !== 'weapon' || t.inventory.filter(w => w.type === 'weapon').length > 1);
        if (droppable.length > 0 && ctx.rng.chance(FATIGUE_MISTAKES.dropShare)) {
            const lost = ctx.rng.pick(droppable);
            t.inventory = t.inventory.filter(i => i !== lost);
            ctx.logEvent(
                `${t.name} is too tired to notice the ${lost.name} slip loose somewhere between one camp and the next. It is simply gone.`,
                [t.id],
                { category: 'survival' }
            );
        } else {
            // Through the funnel like every other point of health — armour,
            // shock, the damage record, and yes, a death. A stumble that
            // could only ever take you to one health was a hazard with the
            // teeth filed off.
            const cause = 'Fell badly from exhaustion';
            applyDamage(ctx, t, FATIGUE_MISTAKES.stumbleDamage, { cause, kind: 'hazard', code: 'fall' });
            ctx.logEvent(
                t.health <= 0
                    ? `${t.name} misjudges a step they would have made easily three days ago, goes down hard, and does not get up. The arena did not have to do anything.`
                    : `${t.name} misjudges a step they would have made easily three days ago and goes down hard. Exhaustion is its own hazard now.`,
                [t.id],
                { category: 'injury', important: t.health <= 0 }
            );
            clampTribute(t);
            checkDeath(ctx, t, cause);
        }
    }

    // §3.4: sleep debt, as distinct from being tired right now.
    //
    // Fatigue is a gauge that empties every night; sleep owed is a ledger that
    // does not. Insomniac is a good trait and there was no underlying system
    // for it to be an extreme of — a tribute who has not properly slept in five
    // days is a specific and well-documented kind of ruined, and none of it was
    // representable. Debt accrues on nights spent short of real rest and is
    // paid down only by a night that is actually restful; past the threshold it
    // takes sanity rather than health, because that is what it does.
    // A §10: what this arena makes worth carrying, refreshed each cycle so
    // `enforceCapacity` (which sees only the tribute) can weigh it.
    const climate = climateOf(ctx.state.arena.id);
    const cold = climate?.exposure?.(ctx.state.timeOfDay === 'night' ? 'night' : 'day')?.frostbite !== undefined;
    t.kitPriorities = {
        warmth: cold || undefined,
        water: (climate?.drains?.thirstMultiplier ?? 1) >= SITUATIONAL_KIT.dryThirstMultiplier || undefined,
        purifier: climate?.foulWater || undefined,
    };

    // §7: the venom on your own blade. `poisonedByWeapon` was tracked and no
    // death ever came of it, and the obvious one was missing: a tribute
    // carrying a coated weapon with their hands already opened up is handling
    // the poison, not just the handle.
    const coated = t.inventory.find(i => i.type === 'weapon' && i.poison === true);
    if (coated && injuryGrade(t, 'arms') > 0 && !t.injuries.poisoned
        && ctx.rng.chance(POISONING.ownBladeChance * injuryGrade(t, 'arms'))) {
        injure(t, 'poisoned');
        t.poisonedByWeapon = true;
        ctx.logEvent(
            `${t.name} has been carrying the ${coated.name} in a hand that is already open to the weather. `
            + 'Whatever they coated it with does not care whose blood it gets into.',
            [t.id],
            { important: true, category: 'injury' }
        );
    }

    // §10: the new terrains' own drains. Desert takes water off anybody
    // standing in it; ice takes heat; a cave takes neither and is the reason
    // to be in one.
    const here = getZone(ctx.state.arena, t.zone);
    if (here?.terrain === 'desert') t.vitals.thirst += ZONES.desertThirstPerCycle;
    if (here?.terrain === 'ice') t.vitals.fatigue += ZONES.iceFatiguePerCycle;
    // §25 (requests): clamp them.
    //
    // These two are the only vital writes in the cycle that happen *after*
    // `processVitals` has done its own `clampTribute`, and neither had one of
    // their own — so a tribute already pinned at 100 thirst standing on desert
    // finished the cycle at 106, and if they died in that same cycle nothing
    // ever brought it back. Latent since the terrain drains were written: it
    // needs a tribute at the ceiling, on desert or ice, dying that cycle, which
    // the older desert arenas rarely produced. `twinSuns` holds a whole cast at
    // the ceiling for days and it started showing up immediately.
    clampTribute(t);

    const restedThisCycle = ctx.state.phase === 'night'
        && t.vitals.fatigue < SLEEP.restedFatigue
        && !t.injuries.bleeding
        && (hasCamp(ctx, t, 'shelter') || t.stance === 'Fortified');
    if (ctx.state.phase === 'night') {
        t.sleepDebt = Math.max(0, (t.sleepDebt ?? 0)
            + (restedThisCycle ? -SLEEP.repaidPerGoodNight : SLEEP.accruedPerBadNight)
            + traitMod(t, 'fatigueNight') * SLEEP.debtPerFatigueTrait);
    }
    if ((t.sleepDebt ?? 0) >= SLEEP.deprivedAt) {
        // §3.8: the pack costs something to keep hold of. A tribute who has
        // not slept properly in days loses things out of it — quietly, and
        // usually the thing they will want next.
        if (t.inventory.length > 0 && ctx.rng.chance(sleepDropChance(t))) {
            const idx = ctx.rng.nextInt(0, t.inventory.length - 1);
            const lost = t.inventory.splice(idx, 1)[0];
            ctx.logEvent(
                `${t.name} does not notice their ${lost.name} going. It is somewhere back along the last few hours, `
                + 'and they could not tell you which of them.',
                [t.id],
                { type: 'sleep-drops', category: 'loot' }
            );
        }
        loseSanity(t, SLEEP.sanityPerCycle);
        if (ctx.rng.chance(SLEEP.lineChance)) {
            ctx.logEvent(
                `${t.name} has not properly slept in days. Things at the edge of ${t.zone} keep moving when they are not looked at directly, `
                + 'and they have stopped being certain which of them are real.',
                [t.id],
                { category: 'sanity' }
            );
        }
    }

    // §3.1: the body over the run. Frame never moves; condition does, and it
    // is the one physical arc a player can actually watch happen.
    const drifted = driftCondition(t);
    if (drifted === 'lost') {
        ctx.logEvent(
            `${t.name} is visibly less of themselves than they were — ${bodyLabel(t)} now, and the cold is going to find that out first.`,
            [t.id],
            { category: 'survival' }
        );
    } else if (drifted === 'gained') {
        ctx.logEvent(
            `Days of actually eating have put something back on ${t.name}. ${bodyLabel(t)[0].toUpperCase()}${bodyLabel(t).slice(1)}, and moving like it.`,
            [t.id],
            { category: 'survival' }
        );
    }

    // Sanity residue: the bottom band abandons things, and the first visit
    // down there leaves a permanent mark.
    // §1.3: the scar, as an ongoing state rather than a one-off deduction.
    // Whatever they are from here on is capped below where they started, and
    // the nights cost more than they used to.
    if (t.sanityScarred) {
        t.vitals.sanity = Math.min(t.vitals.sanity, SANITY_BANDS.scarredSanityCeiling);
        if (ctx.state.phase === 'night') loseSanity(t, SANITY_BANDS.scarredNightSanity);
    }

    const band = sanityBandOf(t);
    // §11: 'Second Wind' promises a victor whose mind went all the way and
    // came back. It used to test `sanityScarred` alone, which only records the
    // going — true of 97.3% of victors — and the end state cannot stand in for
    // the coming back either, because the endgame floors nearly every victor's
    // sanity at 0 whatever happened in between. So the climb is recorded when
    // it happens: scarred, then back out of the bottom band under their own
    // steam, at any point in the run.
    if (t.sanityScarred && band !== 'gone') t.sanityRecovered = true;
    if (band === 'gone') {
        if (!t.sanityScarred) {
            t.sanityScarred = true;
            t.attributes.stealth = Math.max(1, t.attributes.stealth - SANITY_BANDS.scarStealthLoss);
            ctx.logEvent(
                `Something in ${t.name} goes quiet and does not come back. Whatever they are from here on, it is not what walked into the arena.`,
                [t.id],
                { important: true, category: 'sanity' }
            );
        }
        if (t.inventory.length > 0 && ctx.rng.chance(SANITY_BANDS.goneDropChance)) {
            const left = ctx.rng.pick(t.inventory);
            t.inventory = t.inventory.filter(i => i !== left);
            ctx.logEvent(
                `${t.name} sets the ${left.name} down carefully, as if putting it away at home, and walks off without it.`,
                [t.id],
                { category: 'sanity' }
            );
        }
    }

    // Earned combat drift fades on idle cycles — a curve, not a ratchet.
    decayIdleDrift(t);
}

/** One cycle of simply existing in the arena. */
export function processVitals(ctx: SimContext, time: 'day' | 'night') {
    // §3.1: the skills nobody decides to practise. Climbing, swimming and
    // keeping a camp are learned by being somewhere and doing the work, so
    // unlike the other six they train off the cycle rather than off a chosen
    // action — which is exactly why they did not exist before.
    trainTerrainSkills(ctx);
    const board = getAlive(ctx.state);
    board.forEach(t => {
        const drains = drainsFor(ctx, t, time);
        // Company, for both recovery and sanity: an ally standing watch in the
        // same zone, not merely an alliance id on a tribute across the map.
        const alliesPresent = board.filter(o =>
            o.id !== t.id && o.status === 'alive' && o.zone === t.zone
            && allied(o, t)).length;

        // The arena's standing weather, through the same path as a Gamemaker storm.
        const climate = climateOf(ctx.state.arena.id);
        const exposure = climate?.exposure?.(time);
        if (exposure) applyExposure(ctx, t, exposure);
        if (t.status !== 'alive') return;

        // Standing with the Capitol drifts by temperament as well as by events.
        const standing = traitMod(t, 'sponsorTrust');
        if (standing !== 0) t.sponsorTrust = Math.max(0, Math.min(100, t.sponsorTrust + standing));

        if (isStarCrossed(t)) {
            t.sponsorTrust = Math.min(100, t.sponsorTrust + TRAIT_EFFECTS.starCrossedTrustPerCycle);
            addExcitement(t, TRAIT_EFFECTS.starCrossedExcitementPerCycle);
        }

        t.vitals.hunger += Math.max(0, drains.hunger);
        t.vitals.thirst += Math.max(0, drains.thirst);
        t.vitals.fatigue += drains.fatigue;
        applyVitalInteractions(ctx, t);
        applyMandatoryPartnerDrain(ctx, t, board);
        applySanityPressure(ctx, t, time, alliesPresent);
        clampTribute(t);

        applyWearAndTear(ctx, t);
        if (t.status !== 'alive') return;

        // §3.1: wounds turn before the arena bills for them. An untreated
        // grade-2 site that has been sitting long enough can go septic here,
        // and an already-septic one can deepen — the one status in the game
        // that gets worse on its own.
        tickInfection(ctx, t);
        applyStatusDamage(ctx, t);
        applySepsisDrain(ctx, t);
        if (t.status !== 'alive') return;
        consumeSupplies(ctx, t);
        // Order matters: the wound costs health first, then gets its chance to
        // close. A fresh cut always draws blood before it starts to clot.
        tickBleeding(ctx, t);
        // §3.6: and every other site gets its own slow, unassisted recovery.
        tickWoundRecovery(ctx, t);
        applyNaturalRecovery(ctx, t, time, alliesPresent);

        clampTribute(t);
        // No priority-chain guessing: the obituary names whatever landed last.
        checkDeath(ctx, t);
    });
}

/**
 * AUDIT-9 stage D chain 2: the delayed half of waterborne illness.
 *
 * The chain the audit specified is "water-source contamination upstream ->
 * cluster of delayed illness", and *delayed* is the whole of it. An instant
 * poison roll at the moment of drinking is a tax on being thirsty; an illness
 * that arrives three cycles later, in a tribute who has since walked two
 * zones and does not necessarily connect it to the water, is a consequence
 * with a history. It also produces the cluster: several tributes who drank
 * from the same bad source fall ill within a cycle of each other, which is
 * the pattern a Gamemaker — or a player — can actually read.
 */
export function tickExposure(ctx: SimContext) {
    const cycle = cycleOf(ctx.state);
    getAlive(ctx.state).forEach(t => {
        const exposure = t.waterborne;
        if (!exposure || cycle < exposure.dueCycle) return;
        delete t.waterborne;
        if (t.injuries.poisoned) return;
        injure(t, 'poisoned');
        ctx.logEvent(
            `${t.name} goes down on one knee in ${t.zone} with something that started three days ago in ${exposure.fromZone}. `
            + 'Whatever was in that water took its time.',
            [t.id],
            { type: 'waterborne-illness', important: true, category: 'injury' },
        );
    });
}
