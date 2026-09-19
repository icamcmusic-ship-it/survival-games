import { earnTrait } from './earnedTraits';
import { DeathCauseCode, Tribute } from '../models/types';
import { injure } from './wounds';
import { CLIMATE, CRAFTING, PHYSIQUE, PROFICIENCY, TOOLS , EARNED_TRAIT_RULES } from '../data/balance';
import { profOf, trainProficiency } from './proficiency';
import { hasTool } from './items';
import { hasCamp } from './fieldcraft';
import { getZone, zoneFeatures } from './map';
import { SimContext } from './context';
import { applyDamage, checkDeath } from './combat';
import { clampTribute } from './vitals';
import { heatBurden, insulation, massOf } from './physique';
import { traitMod } from '../data/traits';
import { loseSanity } from './sanityBands';

/**
 * One exposure system, used by both the arena's own climate and the
 * Gamemakers' weather controls.
 *
 * These were two independent damage-over-time implementations that never
 * shared a line: a manually triggered cold snap on the Frozen Wasteland ran its
 * own freeze logic and stacked on top of the arena's, with a different frostbite
 * roll, a different damage number and a different cause of death string. An
 * `ExposureProfile` is now the single description of "what this weather does to
 * a body", and both callers build one.
 */
export interface ExposureProfile {
    /** Human-readable name, used in the cause of death. */
    name: string;
    /** Cause recorded if the exposure itself is what kills them. */
    cause: string;
    /**
     * AUDIT-9: the structured cause, where this profile's own wording does not
     * classify. Optional across the authored profiles on purpose —
     * `classifyCause` resolves the overwhelming majority from the prose, and
     * `check-cause-codes` fails the build on any that resolve to `unknown`.
     * Setting it here is how an entry opts out of being read for its words.
     */
    code?: DeathCauseCode;
    /** Flat health cost per tick. */
    damage?: number;
    /**
     * Odds the `damage` lands at all this tick. A climate whose harm is a
     * *chance* of a real hit (a lungful of ash) used to be written as
     * `chance * hit` — a fractional expected value that `Math.round` turned
     * into zero every single tick, so two arenas' signature deaths could
     * never fire. Roll the odds, then land the full amount.
     */
    damageChance?: number;
    fatigue?: number;
    sanity?: number;
    /** Same shape for sanity: odds the full `sanity` loss lands this tick. */
    sanityChance?: number;
    /**
     * A heat profile: it works by exhausting and drying a body. Enables the
     * heatstroke collapse and the heat-resistance scaling. Set this on any
     * climate whose thirst is charged through `drains.thirstMultiplier`
     * rather than a per-tick `thirst` figure — otherwise the desert could
     * not give anyone heatstroke.
     */
    heat?: boolean;
    thirst?: number;
    hunger?: number;
    /** Relief, for weather that is actually useful (rain, shade). */
    quench?: number;
    /** Status effects, each with its own odds of taking hold. */
    frostbite?: number;
    burn?: number;
    poison?: number;
    infection?: number;
    /** Item id that negates the exposure entirely (matches keeps the cold off). */
    wardedBy?: string;
    /** Multiplier on everything, so a Gamemaker event can hit harder. */
    intensity?: number;
    /** Log lines for a status effect taking hold, keyed by effect. */
    onFrostbite?: (t: Tribute) => string;
    onBurn?: (t: Tribute) => string;
    onPoison?: (t: Tribute) => string;
}

/**
 * Applies one tick of exposure. Returns false if the tribute was warded and
 * nothing happened, so callers can skip their own follow-up effects.
 */
export function applyExposure(ctx: SimContext, t: Tribute, profile: ExposureProfile): boolean {
    if (profile.wardedBy && t.inventory.some(i => i.id === profile.wardedBy)) return false;

    // A built shelter is protection from the weather, not just a better
    // night's sleep — without this, CRAFTING.shelterExposureReduction was a
    // declared knob that nothing read, and building a shelter in the Frozen
    // Wasteland did nothing about the thing actually killing you.
    const shelterScale = hasCamp(ctx, t, 'shelter') ? 1 - CRAFTING.shelterExposureReduction : 1;
    // §5.6: the ground itself shelters. A cave system or deep timber takes a
    // real edge off the weather even with no built camp; bare flats take none.
    const zone = getZone(ctx.state.arena, t.zone);
    const zoneShelterScale = zone ? 1 - (zoneFeatures(zone).shelterQuality ?? 0) * PHYSIQUE.zoneShelterExposureReduction : 1;
    const scale = (profile.intensity ?? 1) * shelterScale * zoneShelterScale;
    const amount = (value: number | undefined) => Math.round((value ?? 0) * scale);
    const isHeat = !!profile.thirst || !!profile.heat;

    // Heat resistance takes the edge off anything that works by exhausting you.
    const heatScale = isHeat ? Math.max(0, 1 - traitMod(t, 'heatResist')) : 1;
    if (profile.fatigue) t.vitals.fatigue += Math.round(amount(profile.fatigue) * heatScale);
    if (profile.sanity && (profile.sanityChance === undefined || ctx.rng.chance(profile.sanityChance * scale))) {
        loseSanity(t, amount(profile.sanity));
    }
    // §3.1: a well-padded tribute suffers in the heat in a way a lean one does
    // not, and pays for it in water.
    if (profile.thirst) t.vitals.thirst += Math.round(amount(profile.thirst) * heatScale * (1 + heatBurden(t)));
    if (profile.hunger) t.vitals.hunger += amount(profile.hunger);
    if (profile.quench) t.vitals.thirst = Math.max(0, t.vitals.thirst - amount(profile.quench));

    // Mass is insulation: a Stocky tribute holds heat a Frail one cannot.
    // Resistances: mass is insulation, and so is having grown up in it.
    const resist = (key: 'poisonResist' | 'burnResist' | 'coldResist' | 'heatResist') =>
        Math.max(0, 1 - traitMod(t, key));
    const frostbiteChance = profile.frostbite
        ? profile.frostbite * scale * resist('coldResist')
            // §3.1: mass is insulation, and so is condition specifically —
            // the soft tissue starvation strips first.
            * Math.max(0.4, 1 - massOf(t) * PHYSIQUE.frostbiteResistPerMass - insulation(t))
            // §11.5: warmth gear does the thing it is famous for.
            * (hasTool(t, 'warmth') ? TOOLS.warmthFrostbiteMultiplier : 1)
        : 0;
    if (frostbiteChance > 0 && !t.injuries.frostbitten && ctx.rng.chance(frostbiteChance)) {
        injure(t, 'frostbitten');
        ctx.logEvent(
            profile.onFrostbite?.(t) ?? `${t.name}'s fingers blacken with frostbite in ${profile.name}.`,
            [t.id],
            { important: true, category: 'injury' }
        );
        // Audit 5 §12.3: the second time the cold gets into them, the body learns.
        t.frostbitesTaken = (t.frostbitesTaken ?? 0) + 1;
        if (t.frostbitesTaken >= EARNED_TRAIT_RULES.frostbittenAt) earnTrait(ctx, t, 'Frostbitten');
    }
    if (profile.burn && !t.injuries.burned && ctx.rng.chance(profile.burn * scale * resist('burnResist'))) {
        injure(t, 'burned');
        ctx.logEvent(
            profile.onBurn?.(t) ?? `${t.name} blisters badly in ${profile.name}.`,
            [t.id],
            { category: 'injury' }
        );
    }
    /*
     * AUDIT-7 §12.4: `fieldcookery` is what stands between found food and
     * poisoning, and this roll read a terrain profile and a trait mod and no
     * proficiency at all. Somebody who has spent a week making questionable
     * things safe should be better at it than somebody who has not.
     */
    const cookery = Math.max(0, 1 - profOf(t, 'fieldcookery') * PROFICIENCY.fieldcookeryPoisonResist);
    if (profile.poison) trainProficiency(t, 'fieldcookery', undefined, PROFICIENCY.fieldcookeryExposureShare);
    if (profile.poison && !t.injuries.poisoned && ctx.rng.chance(profile.poison * scale * resist('poisonResist') * cookery)) {
        injure(t, 'poisoned');
        ctx.logEvent(
            profile.onPoison?.(t) ?? `${t.name} takes in a lungful of ${profile.name} and the toxins take hold.`,
            [t.id],
            { important: true, category: 'injury' }
        );
    }
    if (profile.infection && !t.injuries.infected && ctx.rng.chance(profile.infection * scale)) {
        injure(t, 'infected');
    }

    if (profile.damage && (profile.damageChance === undefined || ctx.rng.chance(profile.damageChance * scale))) {
        applyDamage(ctx, t, amount(profile.damage), { cause: profile.cause, code: profile.code, kind: 'climate' });
    }
    // §7: heatstroke. A heat profile is one that works by taking water; a
    // tribute already parched and spent under it can collapse outright.
    if (isHeat && t.status === 'alive'
        && t.vitals.thirst >= CLIMATE.heatstrokeThirst && t.vitals.fatigue >= CLIMATE.heatstrokeFatigue
        && ctx.rng.chance(CLIMATE.heatstrokeChance * scale * resist('heatResist'))) {
        applyDamage(ctx, t, CLIMATE.heatstrokeDamage, { cause: `Heatstroke in ${profile.name}`, kind: 'climate', code: 'heatstroke' });
        ctx.logEvent(
            t.health <= 0
                ? `${t.name} sits down in ${t.zone} to get their breath back and does not get up. The heat has finished what the thirst started.`
                : `${t.name} stops sweating in ${t.zone}, which is the wrong thing to stop doing. They go down hard and come round slowly.`,
            [t.id],
            { important: true, category: 'hazard' }
        );
        clampTribute(t);
        checkDeath(ctx, t, `Heatstroke in ${profile.name}`);
        if (t.status !== 'alive') return true;
    }

    clampTribute(t);
    checkDeath(ctx, t, profile.cause);
    return true;
}
