import { Arena, Terrain, Zone } from '../models/types';
import { RNG } from '../utils/rng';

interface Biome {
    id: string;
    namePrefix: string;
    description: string;
    terrains: Terrain[];
    zoneNames: Record<Terrain, string[]>;
    mutts: string[];
    events: string[];
}

const BIOMES: Biome[] = [
    {
        id: 'rainforest',
        namePrefix: 'Rainforest',
        description: 'A dense, humid jungle. Food is everywhere — and so are the things that eat it.',
        terrains: ['forest', 'water', 'wetland', 'highland', 'ruins'],
        zoneNames: {
            open: ['The Clearing'],
            forest: ['Strangler Canopy', 'Vine Thicket', 'Fern Hollow', 'Kapok Grove'],
            water: ['Piranha River', 'Waterfall Basin', 'Flooded Grotto'],
            wetland: ['Leech Marsh', 'Mangrove Maze'],
            highland: ['Emerald Ridge', 'Temple Steps'],
            ruins: ['Sunken Temple', 'Overgrown Altar'],
        },
        mutts: ['Razor Parrots', 'Constrictor Vines', 'Panther Mutts'],
        events: ['Flash Flood', 'Insect Swarm', 'Falling Canopy'],
    },
    {
        id: 'volcanic',
        namePrefix: 'Volcanic',
        description: 'Black rock, ash storms, and rivers of magma. Water is scarce, burns are not.',
        terrains: ['open', 'highland', 'ruins', 'water'],
        zoneNames: {
            open: ['Ash Flats', 'Obsidian Plain'],
            forest: ['Charred Woods'],
            water: ['Steam Vents', 'Boiling Spring'],
            wetland: ['Sulfur Pools'],
            highland: ['Caldera Rim', 'Lava Tubes', 'Cinder Cone'],
            ruins: ['Buried Outpost', 'Basalt Columns'],
        },
        mutts: ['Magma Hounds', 'Ash Wraiths', 'Obsidian Beetles'],
        events: ['Eruption', 'Ash Storm', 'Lava Flow'],
    },
    {
        id: 'archipelago',
        namePrefix: 'Archipelago',
        description: 'A chain of storm-lashed islands. Swimming between zones is half the battle.',
        terrains: ['water', 'open', 'forest', 'highland'],
        zoneNames: {
            open: ['Shipwreck Beach', 'Tidal Flats'],
            forest: ['Palm Grove', 'Bamboo Isle'],
            water: ['The Shallows', 'Riptide Channel', 'Coral Reef'],
            wetland: ['Salt Lagoon'],
            highland: ['Lighthouse Rock', 'Sea Cliffs'],
            ruins: ['Drowned Village'],
        },
        mutts: ['Razorfin Sharks', 'Storm Gulls', 'Coral Crabs'],
        events: ['Riptide', 'Tropical Storm', 'Whirlpool'],
    },
    {
        id: 'highlands',
        namePrefix: 'Highland',
        description: 'Windswept moors and treacherous peaks. The cold and the drops kill as surely as blades.',
        terrains: ['highland', 'open', 'forest', 'water', 'ruins'],
        zoneNames: {
            open: ['Windswept Moor', 'Heather Field'],
            forest: ['Stunted Pines', 'Misty Glen'],
            water: ['Black Loch', 'Mountain Spring'],
            wetland: ['Peat Bog'],
            highland: ['Shrouded Summit', 'Scree Slopes', 'Eagle Pass'],
            ruins: ['Broken Watchtower', 'Standing Stones'],
        },
        mutts: ['Cliff Harpies', 'Dire Rams', 'Fog Stalkers'],
        events: ['Rockslide', 'Dense Fog Bank', 'Lightning Storm'],
    },
];

const TERRAIN_PROFILES: Record<Terrain, { danger: [number, number]; resources: [number, number] }> = {
    open: { danger: [0.4, 0.7], resources: [0.1, 0.4] },
    forest: { danger: [0.2, 0.5], resources: [0.5, 0.9] },
    water: { danger: [0.3, 0.7], resources: [0.3, 0.6] },
    highland: { danger: [0.5, 0.9], resources: [0.1, 0.4] },
    ruins: { danger: [0.4, 0.8], resources: [0.2, 0.5] },
    wetland: { danger: [0.4, 0.8], resources: [0.3, 0.7] },
};

function range(rng: RNG, [min, max]: [number, number]): number {
    return Math.round((min + rng.nextFloat() * (max - min)) * 100) / 100;
}

export function generateArena(seed: string): Arena {
    const rng = new RNG(`${seed}-arena`);
    const biome = rng.pick(BIOMES);
    const zoneCount = rng.nextInt(5, 7);

    // The Cornucopia is always the hub
    const zones: Zone[] = [{
        name: 'The Cornucopia',
        terrain: 'open',
        danger: range(rng, [0.5, 0.7]),
        resources: range(rng, [0.2, 0.4]),
        adjacent: [],
    }];

    const usedNames = new Set<string>(['The Cornucopia']);
    while (zones.length < zoneCount) {
        const terrain = rng.pick(biome.terrains);
        const pool = (biome.zoneNames[terrain] || []).filter(n => !usedNames.has(n));
        if (pool.length === 0) continue;
        const name = rng.pick(pool);
        usedNames.add(name);
        const profile = TERRAIN_PROFILES[terrain];
        zones.push({
            name,
            terrain,
            danger: range(rng, profile.danger),
            resources: range(rng, profile.resources),
            adjacent: [],
        });
    }

    // Connectivity: ring through the outer zones guarantees the graph is connected,
    // then spokes to the Cornucopia and a few random chords add route variety.
    const connect = (a: Zone, b: Zone) => {
        if (!a.adjacent.includes(b.name)) a.adjacent.push(b.name);
        if (!b.adjacent.includes(a.name)) b.adjacent.push(a.name);
    };
    const outer = zones.slice(1);
    for (let i = 0; i < outer.length; i++) {
        connect(outer[i], outer[(i + 1) % outer.length]);
    }
    const spokeCount = Math.max(2, Math.floor(outer.length / 2));
    const spokeTargets = [...outer].sort(() => rng.nextFloat() - 0.5).slice(0, spokeCount);
    spokeTargets.forEach(z => connect(zones[0], z));
    if (outer.length >= 4 && rng.chance(0.6)) {
        const a = rng.pick(outer);
        const b = rng.pick(outer.filter(z => z !== a && !z.adjacent.includes(a.name)));
        if (b) connect(a, b);
    }

    const suffix = rng.pick(['Crucible', 'Gauntlet', 'Expanse', 'Labyrinth', 'Proving Grounds']);
    return {
        id: `procedural-${biome.id}`,
        name: `The ${biome.namePrefix} ${suffix}`,
        description: `${biome.description} (Procedurally generated arena.)`,
        mutts: biome.mutts,
        events: biome.events,
        zones,
    };
}
