import { Tribute } from '../models/types';
import { PHYSIQUE } from '../data/balance';
import { SimContext } from './context';
import { applyDamage, checkDeath } from './combat';
import { clampTribute } from './vitals';
import { massOf } from './physique';
import { traitMod } from '../data/traits';

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
    /** Flat health cost per tick. */
    damage?: number;
    fatigue?: number;
    sanity?: number;
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

    const scale = profile.intensity ?? 1;
    const amount = (value: number | undefined) => Math.round((value ?? 0) * scale);

    // Heat resistance takes the edge off anything that works by exhausting you.
    const heatScale = profile.thirst ? Math.max(0, 1 - traitMod(t, 'heatResist')) : 1;
    if (profile.fatigue) t.vitals.fatigue += Math.round(amount(profile.fatigue) * heatScale);
    if (profile.sanity) t.vitals.sanity -= amount(profile.sanity);
    if (profile.thirst) t.vitals.thirst += Math.round(amount(profile.thirst) * heatScale);
    if (profile.hunger) t.vitals.hunger += amount(profile.hunger);
    if (profile.quench) t.vitals.thirst = Math.max(0, t.vitals.thirst - amount(profile.quench));

    // Mass is insulation: a Stocky tribute holds heat a Frail one cannot.
    // Resistances: mass is insulation, and so is having grown up in it.
    const resist = (key: 'poisonResist' | 'burnResist' | 'coldResist' | 'heatResist') =>
        Math.max(0, 1 - traitMod(t, key));
    const frostbiteChance = profile.frostbite
        ? profile.frostbite * scale * resist('coldResist')
            * Math.max(0.4, 1 - massOf(t) * PHYSIQUE.frostbiteResistPerMass)
        : 0;
    if (frostbiteChance > 0 && !t.injuries.frostbitten && ctx.rng.chance(frostbiteChance)) {
        t.injuries.frostbitten = true;
        ctx.logEvent(
            profile.onFrostbite?.(t) ?? `${t.name}'s fingers blacken with frostbite in ${profile.name}.`,
            [t.id],
            { important: true, category: 'injury' }
        );
    }
    if (profile.burn && !t.injuries.burned && ctx.rng.chance(profile.burn * scale * resist('burnResist'))) {
        t.injuries.burned = true;
        ctx.logEvent(
            profile.onBurn?.(t) ?? `${t.name} blisters badly in ${profile.name}.`,
            [t.id],
            { category: 'injury' }
        );
    }
    if (profile.poison && !t.injuries.poisoned && ctx.rng.chance(profile.poison * scale * resist('poisonResist'))) {
        t.injuries.poisoned = true;
        ctx.logEvent(
            profile.onPoison?.(t) ?? `${t.name} takes in a lungful of ${profile.name} and the toxins take hold.`,
            [t.id],
            { important: true, category: 'injury' }
        );
    }
    if (profile.infection && !t.injuries.infected && ctx.rng.chance(profile.infection * scale)) {
        t.injuries.infected = true;
    }

    if (profile.damage) {
        applyDamage(ctx, t, amount(profile.damage), { cause: profile.cause, kind: 'climate' });
    }

    clampTribute(t);
    checkDeath(ctx, t, profile.cause);
    return true;
}
