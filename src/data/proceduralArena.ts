import { RNG } from '../utils/rng';
import { Arena } from '../models/types';

export type ArenaBiome = 'forest' | 'ice' | 'desert' | 'urban' | 'swamp' | 'volcanic';
export type ArenaSize = 'small' | 'medium' | 'large';
export type HazardDensity = 'low' | 'medium' | 'high';

export const ARENA_BIOMES: ArenaBiome[] = ['forest', 'ice', 'desert', 'urban', 'swamp', 'volcanic'];
export const ARENA_SIZES: ArenaSize[] = ['small', 'medium', 'large'];
export const HAZARD_DENSITIES: HazardDensity[] = ['low', 'medium', 'high'];

interface BiomeData {
    label: string;
    hub: string;
    zoneNouns: string[];
    mutts: string[];
    events: string[];
}

const BIOME_DATA: Record<ArenaBiome, BiomeData> = {
    forest: {
        label: 'Forest', hub: 'The Cornucopia Clearing',
        zoneNouns: ['Pine Thicket', 'Mossy Hollow', 'Fallen Log Bridge', 'Ravine', 'Deer Trail', 'Overgrown Grove', 'Beehive Ridge', 'Thornbush Maze'],
        mutts: ['Wolf Packs', 'Venomous Spiders', 'Rabid Boars', 'Owl Swarms'],
        events: ['Falling Trees', 'Flash Flood', 'Wildfire', 'Landslide'],
    },
    ice: {
        label: 'Glacier', hub: 'The Frozen Cornucopia',
        zoneNouns: ['Ice Cave', 'Frozen Lake', 'Snowdrift', 'Glacier Crevasse', 'Blizzard Ridge', 'Frost Cavern', 'Icicle Forest'],
        mutts: ['Ice Wolves', 'Frostbite Beetles', 'Snow Leopards'],
        events: ['Blizzard', 'Avalanche', 'Thin Ice Collapse'],
    },
    desert: {
        label: 'Desert', hub: 'The Sunbaked Cornucopia',
        zoneNouns: ['Dune Field', 'Rock Canyon', 'Dried Riverbed', 'Cactus Flat', 'Mirage Basin', 'Sand Trench'],
        mutts: ['Sand Vipers', 'Scorpion Swarms', 'Mirage Jackals'],
        events: ['Sandstorm', 'Solar Flare', 'Oasis Mirage'],
    },
    urban: {
        label: 'Ruined City', hub: 'The City Square Cornucopia',
        zoneNouns: ['Subway Tunnel', 'Skyscraper Ruins', 'Parking Garage', 'Collapsed Overpass', 'Sewer Line', 'Rooftop Maze'],
        mutts: ['Steel-Jawed Rats', 'Feral Dogs', 'Glass-Winged Bats'],
        events: ['Building Collapse', 'Live Wire Trap', 'Gas Leak'],
    },
    swamp: {
        label: 'Swamp', hub: 'The Murky Cornucopia',
        zoneNouns: ['Murky Waters', 'Dead Tree Grove', 'Glowing Bog', 'Ruined Shacks', 'Quicksand Flat', 'Reed Maze'],
        mutts: ['Venomous Toads', 'Leech Swarms', 'Camouflaged Crocodiles'],
        events: ['Hallucinogenic Spores', 'Methane Explosion', 'Quicksand Sinkhole'],
    },
    volcanic: {
        label: 'Volcanic Wastes', hub: 'The Ashen Cornucopia',
        zoneNouns: ['Lava Field', 'Ash Plain', 'Obsidian Ridge', 'Sulfur Vent', 'Cinder Cave', 'Scorched Forest'],
        mutts: ['Fire Salamanders', 'Ash Wraiths', 'Molten Beetles'],
        events: ['Lava Flow', 'Ash Fall', 'Volcanic Tremor'],
    },
};

const SIZE_ZONE_COUNT: Record<ArenaSize, number> = { small: 4, medium: 6, large: 8 };
const HAZARD_COUNT: Record<HazardDensity, number> = { low: 2, medium: 3, high: 4 };

export function proceduralArenaId(biome: ArenaBiome, size: ArenaSize, hazard: HazardDensity): string {
    return `procedural-${biome}-${size}-${hazard}`;
}

export function parseProceduralArenaId(id: string): { biome: ArenaBiome, size: ArenaSize, hazard: HazardDensity } | null {
    const parts = id.split('-');
    if (parts.length !== 4 || parts[0] !== 'procedural') return null;
    const [, biome, size, hazard] = parts;
    if (!ARENA_BIOMES.includes(biome as ArenaBiome)) return null;
    if (!ARENA_SIZES.includes(size as ArenaSize)) return null;
    if (!HAZARD_DENSITIES.includes(hazard as HazardDensity)) return null;
    return { biome: biome as ArenaBiome, size: size as ArenaSize, hazard: hazard as HazardDensity };
}

function pickN(rng: RNG, pool: string[], n: number): string[] {
    const copy = [...pool];
    const picked: string[] = [];
    while (picked.length < Math.min(n, copy.length)) {
        picked.push(copy.splice(rng.nextInt(0, copy.length - 1), 1)[0]);
    }
    return picked;
}

export function generateProceduralArena(seed: string, biome: ArenaBiome, size: ArenaSize, hazard: HazardDensity): Arena {
    const rng = new RNG(`${seed}-arena-${biome}-${size}-${hazard}`);
    const data = BIOME_DATA[biome];
    const zoneCount = SIZE_ZONE_COUNT[size];
    const hazardCount = HAZARD_COUNT[hazard];

    const nounPool = [...data.zoneNouns];
    const zones = [data.hub];
    for (let i = 0; i < zoneCount - 1 && nounPool.length > 0; i++) {
        const idx = rng.nextInt(0, nounPool.length - 1);
        zones.push(nounPool.splice(idx, 1)[0]);
    }

    return {
        id: proceduralArenaId(biome, size, hazard),
        name: `The ${data.label} (${size[0].toUpperCase() + size.slice(1)}, ${hazard} hazard)`,
        description: `A procedurally generated ${data.label.toLowerCase()} arena with ${zoneCount} sectors and ${hazard} hazard density.`,
        mutts: pickN(rng, data.mutts, hazardCount),
        events: pickN(rng, data.events, hazardCount),
        zones,
    };
}
