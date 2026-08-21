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

/** Arena id -> its standing climate. Ids not listed have a temperate arena. */
const CLIMATES: Record<string, ClimateProfile> = {
    frozen: FROZEN,
    'procedural-highlands': FROZEN,
    solar: SOLAR,
    saltflats: SOLAR,
    toxic: TOXIC,
    sporefields: TOXIC,
    ashfall: ASHEN,
    'procedural-volcanic': ASHEN,
    tempest: TEMPEST,
    'procedural-archipelago': TEMPEST,
};

export function climateOf(arenaId: string): ClimateProfile | undefined {
    return CLIMATES[arenaId];
}
