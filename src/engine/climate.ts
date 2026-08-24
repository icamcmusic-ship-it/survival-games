import { CLIMATE } from '../data/balance';
import { ExposureProfile } from './exposure';

/**
 * Each arena's standing weather, expressed as an exposure profile so it runs
 * through the same code path as a Gamemaker-triggered storm.
 *
 * `drains` carries the modifiers that belong to the vitals loop rather than to
 * a discrete exposure tick — a desert doubles thirst accumulation, it does not
 * deal thirst damage once per cycle.
 */
export interface ClimateProfile {
    exposure?: (time: 'day' | 'night') => ExposureProfile | undefined;
    drains?: {
        thirstMultiplier?: number;
        fatigue?: number;
    };
    /**
     * Open water here is not safe to drink untreated. The Toxic Swamps' entire
     * premise is undrinkable water and nothing in the simulation expressed it.
     */
    foulWater?: boolean;
}

const FROZEN: ClimateProfile = {
    exposure: time => ({
        name: 'the freezing dark',
        cause: 'Froze to death',
        damage: CLIMATE.frozenChipDamage,
        fatigue: CLIMATE.frozenFatigue,
        // A fire is the whole difference between a cold night and a fatal one.
        wardedBy: 'matches',
        frostbite: time === 'night' ? CLIMATE.frozenFrostbiteChance : 0,
        onFrostbite: t => `${t.name}'s fingers blacken with frostbite in the freezing night.`,
    }),
};

const SOLAR: ClimateProfile = {
    exposure: time => ({
        name: 'the solar glare',
        cause: 'Died of heatstroke',
        burn: time === 'day' ? CLIMATE.solarBurnChance : 0,
        onBurn: t => `${t.name} blisters badly under the merciless solar glare.`,
    }),
    drains: { thirstMultiplier: CLIMATE.solarThirstMultiplier },
};

const TOXIC: ClimateProfile = {
    exposure: () => ({
        name: 'the swamp air',
        cause: 'Succumbed to the swamp',
        sanity: CLIMATE.toxicSanityChance * CLIMATE.toxicSanityLoss,
        poison: CLIMATE.toxicPoisonChance,
        onPoison: t => `${t.name} drinks tainted swamp water and the toxins take hold.`,
    }),
    foulWater: true,
};

const ASHEN: ClimateProfile = {
    exposure: () => ({
        name: 'the ashfall',
        cause: 'Choked on volcanic ash',
        damage: CLIMATE.ashenLungChance * 4,
        sanity: CLIMATE.ashenLungChance * CLIMATE.ashenSanityLoss,
    }),
};

const TEMPEST: ClimateProfile = {
    exposure: () => ({
        name: 'the standing storm',
        cause: 'Died of exposure in the storm',
        fatigue: CLIMATE.stormFatigue,
        // The one upside of permanent rain.
        quench: CLIMATE.tidalDrenchChance * 10,
    }),
};

/** The Shattered Archipelago's magnetic fog: it gets into instruments and heads alike. */
const MAGNETIC_FOG: ClimateProfile = {
    exposure: () => ({
        name: 'the magnetic fog',
        cause: 'Lost to the fog',
        sanity: CLIMATE.fogSanityChance * CLIMATE.fogSanityLoss,
        fatigue: CLIMATE.fogFatigue,
    }),
};

/**
 * The Perpetual Eclipse Forest: permanent dusk. There is no clean way to pin
 * `timeOfDay` at dusk — the day/night loop is the simulation's spine — so the
 * arena expresses it as a climate (light that never resolves, a slow tax on
 * the mind), mutts that never stand down, and flavor throughout.
 */
const PERPETUAL_DUSK: ClimateProfile = {
    exposure: () => ({
        name: 'the unending dusk',
        cause: 'Unravelled in the half-light',
        sanity: CLIMATE.duskSanityChance * CLIMATE.duskSanityLoss,
    }),
};

/** The Dead Coral Reef: full glare off white coral, and only brine to drink. */
const DRAINED_REEF: ClimateProfile = {
    exposure: time => ({
        name: 'the reef glare',
        cause: 'Died of heatstroke on the dead reef',
        burn: time === 'day' ? CLIMATE.solarBurnChance : 0,
        onBurn: t => `${t.name} burns raw under the glare coming off the bleached coral.`,
    }),
    drains: { thirstMultiplier: CLIMATE.furnaceThirstMultiplier },
    foulWater: true,
};

/** The Industrial Abattoir: furnace heat in halls that were never meant for rest. */
const FURNACE_HEAT: ClimateProfile = {
    exposure: () => ({
        name: 'the furnace heat',
        cause: 'Cooked by the factory',
        fatigue: CLIMATE.furnaceFatigue,
        burn: CLIMATE.furnaceBurnChance,
        onBurn: t => `${t.name} takes a scald off a live steam line they never saw.`,
    }),
    drains: { thirstMultiplier: CLIMATE.furnaceThirstMultiplier },
};

/** The Ash Wasteland: the ashfall profile plus the thirst of a hot dead land. */
const ASH_WASTE: ClimateProfile = {
    exposure: () => ({
        name: 'the deep ash',
        cause: 'Choked on the wasteland',
        damage: CLIMATE.ashenLungChance * 4,
        sanity: CLIMATE.ashenLungChance * CLIMATE.ashenSanityLoss,
    }),
    drains: { thirstMultiplier: CLIMATE.solarThirstMultiplier },
};

/** The Vertical Quarry: cold, damp, and the only open water is the dead pit. */
const QUARRY_DAMP: ClimateProfile = {
    exposure: () => ({
        name: 'the pit damp',
        cause: 'Wasted away in the pit',
        fatigue: CLIMATE.quarryDampFatigue,
    }),
    foulWater: true,
};

/** The Shattered Ice Floe Sea: the frozen profile over water nobody can drink. */
const FLOE_SEA: ClimateProfile = {
    exposure: time => ({
        name: 'the black sea cold',
        cause: 'Froze on the pack ice',
        damage: CLIMATE.frozenChipDamage,
        fatigue: CLIMATE.frozenFatigue,
        wardedBy: 'matches',
        frostbite: time === 'night' ? CLIMATE.frozenFrostbiteChance : 0,
        onFrostbite: t => `${t.name}'s hands go white and wooden in the sea wind.`,
    }),
    foulWater: true,
};

/** Arena id -> its standing climate. Ids not listed have a temperate arena. */
const CLIMATES: Record<string, ClimateProfile> = {
    frozen: FROZEN,
    reef: DRAINED_REEF,
    glacier: FROZEN,
    alpine: FROZEN,
    floe: FLOE_SEA,
    islands: MAGNETIC_FOG,
    carnival: MAGNETIC_FOG,
    eclipse: PERPETUAL_DUSK,
    abattoir: FURNACE_HEAT,
    ashwaste: ASH_WASTE,
    quarry: QUARRY_DAMP,
    'procedural-highlands': FROZEN,
    'procedural-rainforest': TOXIC,
    'procedural-tundra': FROZEN,
    'procedural-dunes': SOLAR,
    'procedural-bayou': TOXIC,
    'procedural-ruinlands': MAGNETIC_FOG,
    solar: SOLAR,
    saltflats: SOLAR,
    toxic: TOXIC,
    sporefields: TOXIC,
    ashfall: ASHEN,
    'procedural-volcanic': ASHEN,
    tempest: TEMPEST,
    'procedural-archipelago': TEMPEST,
    seapeaks: FROZEN,
    acousticforest: MAGNETIC_FOG,
    burnscar: ASHEN,
    craterfield: TOXIC,
    kelvin: FROZEN,
    silkwood: TOXIC,
    nooneplace: PERPETUAL_DUSK,
    redcathedral: SOLAR,
    // §13.3: the Snowbound Homestead is a winter arena whose whole argument is
    // that the interior is different from the exterior — so it carries the
    // full freezing profile, and the hearth signature is what buys it back.
    cabin: FROZEN,
    magmatube: FURNACE_HEAT,
    karst: QUARRY_DAMP,
};

export function climateOf(arenaId: string): ClimateProfile | undefined {
    return CLIMATES[arenaId];
}
