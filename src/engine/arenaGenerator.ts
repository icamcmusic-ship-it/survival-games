import { Arena, ArenaLawId, EdgeRule, Injuries, Mutt, MuttRole, SignatureRule, Terrain, Zone, ZoneEffectKind } from '../models/types';
import { RNG } from '../utils/rng';
import { PROCEDURAL_EVENTS, FlavorTag } from '../data/proceduralFlavor';
import { PROC_SIGNATURE, PROC_TERRAIN } from '../data/balance';

interface Biome {
    id: string;
    /** Display-name prefixes this biome can roll — `The <prefix> <suffix>`. */
    namePrefixes: string[];
    description: string;
    terrains: Terrain[];
    zoneNames: Record<Terrain, string[]>;
}

// B3: every biome's zoneNames pool used to be 9-13 names spread across only
// the terrains listed in `terrains` — several pools (Sulfur Pools, Salt
// Lagoon, Peat Bog, The Clearing) were written but dead, because their
// terrain wasn't in that biome's `terrains` array at all, so the generator
// could never roll it. That left every biome short of the 13-16 zone
// "sprawl" tier the shape roll below can request (archipelago and volcanic
// topped out at 10, unable to reach it at all), and a maxed-out arena that
// exhausted its pool mid-generation just came out smaller and reused the
// same handful of names on every large roll. Pools are now sized well past
// 16 per biome, and every terrain with a written pool is actually reachable.
// §5.1/§8.4: eight biomes (four new — tundra, dunes, bayou, ruinlands), and
// every terrain pool holds at least eight names, so even a 16-zone sprawl
// never runs a pool dry and two same-biome arenas rarely share a map.
const BIOMES: Biome[] = [
    {
        id: 'rainforest',
        namePrefixes: ['Rainforest', 'Jungle', 'Verdant'],
        description: 'A dense, humid jungle. Food is everywhere — and so are the things that eat it.',
        terrains: ['open', 'forest', 'water', 'wetland', 'highland', 'ruins'],
        zoneNames: {
            open: ['The Clearing', 'Sunlit Break', 'Trampled Clearing', 'Fallen Giant', 'The Burn Gap', 'Orchid Meadow', 'The Landslip Scar', 'Elephant Grass Flat'],
            forest: ['Strangler Canopy', 'Vine Thicket', 'Fern Hollow', 'Kapok Grove', 'Howler Canopy', 'Root Tangle', 'The Liana Web', 'Fig Cathedral', 'The Understory Dark'],
            water: ['Piranha River', 'Waterfall Basin', 'Flooded Grotto', 'Blackwater Shallows', 'Rapids Bend', 'The Oxbow', 'Caiman Pool', 'The Silt Delta'],
            wetland: ['Leech Marsh', 'Mangrove Maze', 'Sinking Flat', 'Mosquito Bog', 'The Drowned Grove', 'Heliconia Swamp', 'The Rot Channel', 'Fever Lagoon'],
            highland: ['Emerald Ridge', 'Temple Steps', 'Moss-Choked Bluff', 'Canopy Walk', 'The Mist Terraces', 'Jaguar Ledge', 'The Green Wall', 'Thunder Bluff'],
            ruins: ['Sunken Temple', 'Overgrown Altar', 'Collapsed Shrine', 'Idol Grove', 'The Vine-Bound Gate', 'Serpent Stair', 'The Moss Court', 'Forgotten Terrace'],
        },
    },
    {
        id: 'volcanic',
        namePrefixes: ['Volcanic', 'Cinder', 'Molten'],
        description: 'Black rock, ash storms, and rivers of magma. Water is scarce, burns are not.',
        terrains: ['open', 'forest', 'wetland', 'highland', 'ruins', 'water'],
        zoneNames: {
            open: ['Ash Flats', 'Obsidian Plain', 'Cinder Wastes', 'Scorched Flat', 'The Pumice Field', 'Ember Basin', 'The Glass Barrens', 'Fissure Plain'],
            forest: ['Charred Woods', 'Blackened Grove', 'Smoldering Thicket', 'The Ash Orchard', 'Soot Pines', 'The Half-Burned Stand', 'Cinder Copse', 'The Widowmaker Snags'],
            water: ['Steam Vents', 'Boiling Spring', 'Mineral Pool', 'The Scalding Run', 'Geyser Field', 'The Warm Shallows', 'Acid Tarn', 'The Vapor Channel'],
            wetland: ['Sulfur Pools', 'Tar Seep', 'Ashen Mudflat', 'The Fumarole Marsh', 'Brimstone Bog', 'The Grey Slurry', 'Mudpot Flats', 'The Steaming Fen'],
            highland: ['Caldera Rim', 'Lava Tubes', 'Cinder Cone', 'Fumarole Terrace', 'Obsidian Spire', 'The Basalt Stair', 'Magma Overlook', 'The Shield Slope'],
            ruins: ['Buried Outpost', 'Basalt Columns', 'Ash-Choked Vault', 'Slag Foundry', 'The Entombed Village', 'Pyroclast Quarry', 'The Smelter Bones', 'Vitrified Keep'],
        },
    },
    {
        id: 'archipelago',
        namePrefixes: ['Archipelago', 'Island', 'Tidal'],
        description: 'A chain of storm-lashed islands. Swimming between zones is half the battle.',
        terrains: ['water', 'open', 'forest', 'wetland', 'highland', 'ruins'],
        zoneNames: {
            open: ['Shipwreck Beach', 'Tidal Flats', 'Driftwood Cove', 'Sandbar Spit', 'The Shell Strand', 'Gull Beach', 'The Wind Flats', 'Castaway Point'],
            forest: ['Palm Grove', 'Bamboo Isle', 'Windbreak Thicket', 'The Salt Pines', 'Coconut Stand', 'The Leaning Grove', 'Seagrape Tangle', 'The Green Islet'],
            water: ['The Shallows', 'Riptide Channel', 'Coral Reef', 'Sunken Reef', 'Whirlpool Strait', 'The Deep Passage', 'Shark Sound', 'The Breaker Line'],
            wetland: ['Salt Lagoon', 'Mangrove Shoal', 'Tidepool Flat', 'The Eel Grass Beds', 'Crab Marsh', 'The Brackish Slough', 'Heron Flats', 'The Drowning Sands'],
            highland: ['Lighthouse Rock', 'Sea Cliffs', 'Watchtower Bluff', 'The Basalt Head', 'Cormorant Crag', 'The Storm Stack', 'Signal Hill', 'The Razorback Spine'],
            ruins: ['Drowned Village', 'Barnacled Wreck', 'Old Harbor', 'The Fish Cannery', 'Pirate Stockade', 'The Sea Fort', 'Sunken Pier', 'The Whaler\'s Station'],
        },
    },
    {
        id: 'highlands',
        namePrefixes: ['Highland', 'Moorland', 'Summit'],
        description: 'Windswept moors and treacherous peaks. The cold and the drops kill as surely as blades.',
        terrains: ['highland', 'open', 'forest', 'water', 'wetland', 'ruins'],
        zoneNames: {
            open: ['Windswept Moor', 'Heather Field', 'Frostbitten Plain', 'The Gorse Flats', 'Bracken Slope', 'The High Meadow', 'Thistle Common', 'The Barren Shoulder'],
            forest: ['Stunted Pines', 'Misty Glen', 'Dead Timber', 'The Rowan Stand', 'Crooked Birches', 'The Wolf Wood', 'Larch Hollow', 'The Wind-Bent Grove'],
            water: ['Black Loch', 'Mountain Spring', 'Frozen Tarn', 'The Roaring Burn', 'Kelpie Pool', 'The Grey Falls', 'Corrie Lake', 'The Cold Beck'],
            wetland: ['Peat Bog', 'Sodden Fen', 'The Quaking Moss', 'Curlew Mire', 'The Black Sump', 'Rushes Flat', 'The Drowned Moor', 'Sphagnum Hollow'],
            highland: ['Shrouded Summit', 'Scree Slopes', 'Eagle Pass', 'Wind Gap', 'Frost-Cracked Ridge', 'The Granite Teeth', 'Raven Crag', 'The Saddle'],
            ruins: ['Broken Watchtower', 'Standing Stones', 'Cairn Field', 'Abandoned Croft', 'The Shepherd\'s Bothy', 'Fallen Chapel', 'The Old Sheepfold', 'Beacon Ring'],
        },
    },
    {
        id: 'tundra',
        namePrefixes: ['Tundra', 'Frostbound', 'White'],
        description: 'A treeless white plain under a sky the Gamemakers keep well below freezing. Warmth is the only currency that matters.',
        terrains: ['open', 'forest', 'water', 'wetland', 'highland', 'ruins'],
        zoneNames: {
            open: ['The Snowfields', 'Whiteout Flats', 'The Wind Scour', 'Caribou Plain', 'The Frost Heave', 'Blue Shadow Basin', 'The Drift Sea', 'Bone-Cold Barrens'],
            forest: ['The Krummholz', 'Frozen Spruce Stand', 'The Rime Wood', 'Snow-Bent Willows', 'The Last Timber', 'Hoarfrost Grove', 'The Buried Firs', 'Ptarmigan Thicket'],
            water: ['The Ice Lake', 'Aurora Tarn', 'The Black Polynya', 'Frozen River Braid', 'The Seal Hole', 'Glacier Melt Spring', 'The Slush Channel', 'Winterlock Lagoon'],
            wetland: ['The Frozen Muskeg', 'Tussock Marsh', 'The Icebound Fen', 'Permafrost Sink', 'The Grey Thaw', 'Cottongrass Flats', 'The Cracked Mire', 'Meltpool Maze'],
            highland: ['The Nunatak', 'Windward Ridge', 'The Cornice Line', 'Frost Spire', 'The Icefall Shelf', 'Caribou Lookout', 'The Blue Ice Wall', 'Avalanche Shoulder'],
            ruins: ['The Frozen Camp', 'Buried Research Post', 'The Ice-Locked Convoy', 'Whalebone Circle', 'The Collapsed Lodge', 'Snow-Choked Mine Head', 'The Radio Mast', 'Dead Man\'s Cache'],
        },
    },
    {
        id: 'dunes',
        namePrefixes: ['Dune', 'Desert', 'Sunblasted'],
        description: 'An ocean of red sand under a sun that never blinks. Every shadow is contested, and the water is wherever you are not.',
        terrains: ['open', 'forest', 'water', 'wetland', 'highland', 'ruins'],
        zoneNames: {
            open: ['The Singing Dunes', 'Red Sand Sea', 'The Hardpan', 'Scorpion Flats', 'The Mirage Plain', 'Sun Anvil', 'The Cracked Basin', 'Bone Dust Reach'],
            forest: ['The Cactus Forest', 'Acacia Shade', 'The Thorn Break', 'Date Palm Stand', 'The Tamarisk Belt', 'Joshua Grove', 'The Dry Orchard', 'Saltbush Scrub'],
            water: ['The Hidden Oasis', 'Canyon Spring', 'The Last Well', 'Flash-Flood Wash', 'The Green Pool', 'Buried Cistern Lake', 'The Seep Line', 'Wadi Bend'],
            wetland: ['The Salt Pan Marsh', 'Reed Oasis Fringe', 'The Alkali Flats', 'Tamarisk Slough', 'The Mud Cracks', 'Locust Fen', 'The Bitter Shallows', 'Dust-Storm Delta'],
            highland: ['The Mesa Top', 'Sandstone Arches', 'The Knife Butte', 'Vulture Rim', 'The Slickrock Stair', 'Sunset Cliffs', 'The Hoodoo Maze', 'Rattlesnake Ledge'],
            ruins: ['The Buried Caravan', 'Sandswallowed Town', 'The Broken Aqueduct', 'Ghost Bazaar', 'The Toppled Colossus', 'Wind-Carved Tombs', 'The Dry Fountain Court', 'Caravanserai Shell'],
        },
    },
    {
        id: 'bayou',
        namePrefixes: ['Bayou', 'Blackwater', 'Drowned'],
        description: 'A drowned lowland of black water and grey moss, where the ground is a rumour and everything old is still hungry.',
        terrains: ['open', 'forest', 'water', 'wetland', 'highland', 'ruins'],
        zoneNames: {
            open: ['The Levee Top', 'Cane Field Flat', 'The Burned Landing', 'Egret Meadow', 'The Shell Midden', 'Hurricane Clearing', 'The Dry Hummock', 'Firefly Flats'],
            forest: ['The Cypress Dark', 'Spanish Moss Hall', 'The Tupelo Stand', 'Gator Log Grove', 'The Grey Veil', 'Willow Tangle', 'The Knee Roots', 'Owl Roost Wood'],
            water: ['The Black Channel', 'Snakebird Slough', 'The Slow Water', 'Gar Hole', 'The Green Mirror', 'Moccasin Run', 'The Drowned Ferry Crossing', 'Catfish Deep'],
            wetland: ['The Trembling Prairie', 'Leech Slough', 'The Sucking Mud', 'Cottonmouth Marsh', 'The Fog Flats', 'Crawfish Beds', 'The Rot Garden', 'Widow\'s Mire'],
            highland: ['The Indian Mound', 'Levee Ridge', 'The High Bank', 'Live Oak Knoll', 'The Bluff Cut', 'Heron Watch', 'The Old Railbed', 'Lightning Tree Rise'],
            ruins: ['The Sunken Plantation', 'Rotting Stilt Town', 'The Flooded Chapel', 'Shrimp Boat Graveyard', 'The Moss-Eaten Mill', 'Voodoo Landing', 'The Broken Levee Works', 'Drowned Depot'],
        },
    },
    {
        id: 'ruinlands',
        namePrefixes: ['Ruined', 'Derelict', 'Rustbound'],
        description: 'A pre-Dark Days city gone back to weeds and rust. The buildings remember being taller, and none of them are done falling down.',
        terrains: ['open', 'forest', 'water', 'wetland', 'highland', 'ruins'],
        zoneNames: {
            open: ['The Cracked Plaza', 'Parking Field', 'The Ashphalt Prairie', 'Stadium Floor', 'The Old Runway', 'Market Square', 'The Rubble Flats', 'Monument Green'],
            forest: ['The Street Forest', 'Rooftop Orchard Gone Wild', 'The Park Overgrowth', 'Ivy-Eaten Block', 'The Cemetery Pines', 'Greenhouse Jungle', 'The Median Wood', 'Courtyard Thicket'],
            water: ['The Flooded Metro', 'Reservoir Basin', 'The Canal Locks', 'Fountain Lake', 'The Burst Main', 'Drowned Underpass', 'The Water Treatment Pools', 'Riverwalk Channel'],
            wetland: ['The Sewer Marsh', 'Sunken Block Bog', 'The Storm Drain Fens', 'Collapsed Cellar Pools', 'The Weeping Foundations', 'Rooftop Rain Gardens', 'The Silt Yards', 'Culvert Maze'],
            highland: ['The Tower Skeleton', 'Overpass Spiral', 'The Crane Nest', 'Cathedral Spire', 'The Fire Escape Warren', 'Billboard Ridge', 'The Elevated Line', 'Water Tower Hill'],
            ruins: ['The Gutted Mall', 'Rust Yard', 'The Fallen Library', 'Tenement Maze', 'The Hollow Factory', 'Subway Concourse', 'The Collapsed Theatre', 'Bank Vault Row'],
        },
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

function clampBand([min, max]: [number, number]): [number, number] {
    return [Math.max(0, Math.min(1, min)), Math.max(0, Math.min(1, max))];
}

/**
 * Rolls this arena's own version of every terrain it can contain, shifting
 * the shared `TERRAIN_PROFILES` band up or down (danger and resources roll
 * independently) so "forest" doesn't mean the same larder-or-hunting-ground
 * in every generated arena. Stored on `Arena.terrainVariant` and consulted
 * ahead of `TERRAIN_PROFILES` everywhere a zone's danger/resources are rolled.
 */
type TerrainVariant = Partial<Record<Terrain, { danger: [number, number]; resources: [number, number] }>>;

function rollTerrainVariant(rng: RNG, terrains: Terrain[]): TerrainVariant {
    const variant: TerrainVariant = {};
    terrains.forEach(terrain => {
        const base = TERRAIN_PROFILES[terrain];
        const dangerShift = (rng.nextFloat() * 2 - 1) * PROC_TERRAIN.shiftMax;
        const resourceShift = (rng.nextFloat() * 2 - 1) * PROC_TERRAIN.shiftMax;
        variant[terrain] = {
            danger: clampBand([base.danger[0] + dangerShift, base.danger[1] + dangerShift]),
            resources: clampBand([base.resources[0] + resourceShift, base.resources[1] + resourceShift]),
        };
    });
    return variant;
}

// ARENA-08: every procedural arena used to be one ring-plus-spokes graph, so
// no matter what biome or seed rolled, the map *shape* was always identical.
// These are named topology generators the main function picks between with
// the seeded RNG, so a rainforest arena might come out as a river-bisected
// map one roll and a vertical canopy the next.
type Topology = 'linear' | 'hub' | 'ring' | 'bisected' | 'layered';
const TOPOLOGIES: Topology[] = ['linear', 'hub', 'ring', 'bisected', 'layered'];

function connect(a: Zone, b: Zone) {
    if (!a.adjacent.includes(b.name)) a.adjacent.push(b.name);
    if (!b.adjacent.includes(a.name)) b.adjacent.push(a.name);
}

/**
 * After a topology has laid down its intended edges, this guarantees every
 * zone is reachable from the Cornucopia (zone 0) — the one safety property
 * every variant must keep, ported from the original ring generator's
 * connectivity guard. A deliberately sparse topology (hub, bisected) can
 * otherwise strand a zone if the RNG's draws happen to isolate it.
 */
function guaranteeConnectivity(zones: Zone[]) {
    const byName = new Map(zones.map(z => [z.name, z]));
    const seen = new Set<string>([zones[0].name]);
    const queue = [zones[0]];
    while (queue.length) {
        const z = queue.shift()!;
        z.adjacent.forEach(n => {
            if (seen.has(n)) return;
            seen.add(n);
            const next = byName.get(n);
            if (next) queue.push(next);
        });
    }
    zones.forEach(z => {
        if (seen.has(z.name)) return;
        // Stitch the stranded zone onto whatever's already reachable, then
        // fold it into the reachable set so later stragglers can chain off it.
        const anchor = zones.find(o => seen.has(o.name))!;
        connect(anchor, z);
        seen.add(z.name);
    });
}

function buildLinear(zones: Zone[]) {
    // A rough chain — the Cornucopia sits at one end, every other zone
    // connects mainly to its neighbours in sequence (a river or mountain pass).
    for (let i = 0; i < zones.length - 1; i++) {
        connect(zones[i], zones[i + 1]);
    }
}

function buildHub(zones: Zone[], rng: RNG) {
    // Cornucopia at the centre; every outer zone connects to the hub and to
    // at most one neighbour — sparser than the old ring+spokes+chords shape,
    // genuinely reads as a wheel instead of a ring with extra clutter.
    const outer = zones.slice(1);
    outer.forEach(z => connect(zones[0], z));
    const shuffled = rng.shuffle(outer);
    for (let i = 0; i < shuffled.length - 1; i += 2) {
        connect(shuffled[i], shuffled[i + 1]);
    }
}

function buildRing(zones: Zone[]) {
    // A cycle through the outer zones, with the Cornucopia as one extra
    // connected node off the cycle — closer to a pure ring than the old
    // ring+spokes+chords, which blurred into hub-and-spoke anyway.
    const outer = zones.slice(1);
    for (let i = 0; i < outer.length; i++) {
        connect(outer[i], outer[(i + 1) % outer.length]);
    }
    connect(zones[0], outer[0]);
    if (outer.length > 3) connect(zones[0], outer[Math.floor(outer.length / 2)]);
}

function buildBisected(zones: Zone[], rng: RNG) {
    // Two internally-dense clusters joined by a single crossing zone —
    // a genuine chokepoint, modeling a river or canyon splitting the arena.
    const outer = rng.shuffle(zones.slice(1));
    const mid = Math.floor(outer.length / 2);
    const clusterA = outer.slice(0, mid);
    const clusterB = outer.slice(mid);
    const wireCluster = (cluster: Zone[]) => {
        for (let i = 0; i < cluster.length; i++) {
            connect(cluster[i], cluster[(i + 1) % cluster.length]);
        }
    };
    if (clusterA.length > 1) wireCluster(clusterA);
    if (clusterB.length > 1) wireCluster(clusterB);
    if (clusterA.length && clusterB.length) connect(clusterA[0], clusterB[0]);
    connect(zones[0], clusterA[0] ?? clusterB[0]);
    if (clusterB.length) connect(zones[0], clusterB[0]);
}

function buildLayered(zones: Zone[], rng: RNG) {
    // Zones grouped into tiers (lower/mid/upper), adjacency mostly within a
    // tier and between adjacent tiers only — models vertical arenas like a
    // canopy or a multi-level facility without needing real 3D zone data.
    const outer = zones.slice(1);
    const tierCount = outer.length >= 6 ? 3 : 2;
    const tiers: Zone[][] = Array.from({ length: tierCount }, () => []);
    outer.forEach((z, i) => tiers[i % tierCount].push(z));
    tiers.forEach(tier => {
        for (let i = 0; i < tier.length - 1; i++) connect(tier[i], tier[i + 1]);
    });
    for (let t = 0; t < tiers.length - 1; t++) {
        if (tiers[t].length && tiers[t + 1].length) {
            connect(rng.pick(tiers[t]), rng.pick(tiers[t + 1]));
        }
    }
    // The Cornucopia sits at the base tier, as the ground-level rally point.
    if (tiers[0].length) connect(zones[0], tiers[0][0]);
    else connect(zones[0], outer[0]);
}

function buildTopology(topology: Topology, zones: Zone[], rng: RNG) {
    switch (topology) {
        case 'linear': return buildLinear(zones);
        case 'hub': return buildHub(zones, rng);
        case 'ring': return buildRing(zones);
        case 'bisected': return buildBisected(zones, rng);
        case 'layered': return buildLayered(zones, rng);
    }
}

// ARENA-08: mutt names used to be a fixed 3-per-biome list, so "Razor
// Parrots" was the rainforest's only possible mutt forever. This combines
// tag-matched modifiers with base creature names so the same biome can
// still surprise a returning player.
const MODIFIERS_BY_TAG: Record<string, string[]> = {
    cold: ['Frost-Fanged', 'Rime-Coated', 'Glacial'],
    heat: ['Ash-Wreathed', 'Cinder', 'Smoke-Choked'],
    water: ['Riptide', 'Brine-Slick', 'Undertow'],
    highland: ['Cliff-Born', 'Storm-Wracked', 'Wind-Torn'],
    forest: ['Vine-Wrapped', 'Canopy-Bred', 'Root-Fed'],
    ruins: ['Rust-Eaten', 'Buried', 'Relic-Bound'],
    wetland: ['Marsh-Born', 'Silt-Skinned', 'Bog-Cursed'],
    open: ['Sun-Scarred', 'Dust-Born', 'Bare-Fanged'],
};
const GENERIC_MODIFIERS = ['Iron-Jawed', 'Blood-Eyed', 'Night-Bred', 'Hollow-Eyed'];
const CREATURE_BASES = ['Harpies', 'Wraiths', 'Hounds', 'Stalkers', 'Serpents', 'Mutts', 'Ravagers', 'Screechers', 'Crawlers', 'Reapers'];

/**
 * Arena-native mutts, not just names. `generateMuttNames` used to produce
 * flavour strings for `Arena.mutts` with no kit behind them — the display
 * list and what `rosterFor()` actually resolved (a fixed 3-mutt roster
 * shared by every arena of the same biome) didn't even agree, let alone have
 * roles. This rolls real `Mutt` objects, one role each, so a generated
 * arena's bestiary is specific to that arena and actually has teeth.
 */
interface RoleTemplate {
    role: MuttRole;
    packSize: [number, number];
    damage: number;
    speed: number;
    inflicts?: Partial<Injuries>;
    nocturnal?: boolean;
    fearAura?: number;
}
const ROLE_TEMPLATES: RoleTemplate[] = [
    { role: 'ambusher', packSize: [1, 2], damage: 24, speed: 9, inflicts: { bleeding: true }, nocturnal: true },
    { role: 'herder', packSize: [1, 2], damage: 10, speed: 7 },
    { role: 'scavenger', packSize: [1, 3], damage: 14, speed: 6, inflicts: { infected: true } },
    { role: 'siege', packSize: [1, 1], damage: 26, speed: 5 },
    { role: 'mimic', packSize: [1, 1], damage: 16, speed: 6, fearAura: 10 },
    { role: 'swarm', packSize: [3, 6], damage: 9, speed: 6 },
];

function generateMuttRoster(rng: RNG, biome: Biome, activeTags: string[], count: number, zoneNames: string[]): Mutt[] {
    const pools = activeTags.length
        ? activeTags.flatMap(t => MODIFIERS_BY_TAG[t] || [])
        : [];
    const modifierPool = (pools.length ? pools : GENERIC_MODIFIERS).concat(GENERIC_MODIFIERS);
    const usedNames = new Set<string>();
    const templates = rng.shuffle(ROLE_TEMPLATES).slice(0, count);
    // Siege mutts get a home outside the Cornucopia when there's a choice —
    // pinning one to the one zone every tribute passes through would make it
    // less a territorial horror than a mandatory toll booth.
    const homeOptions = zoneNames.length > 1 ? zoneNames.slice(1) : zoneNames;

    return templates.map((tpl, i) => {
        let name = `${rng.pick(modifierPool)} ${rng.pick(CREATURE_BASES)}`;
        let attempts = 10;
        while (usedNames.has(name) && attempts-- > 0) name = `${rng.pick(modifierPool)} ${rng.pick(CREATURE_BASES)}`;
        usedNames.add(name);
        const mutt: Mutt = {
            id: `${biome.id}-${tpl.role}-${i}`,
            name,
            packSize: tpl.packSize,
            damage: tpl.damage,
            speed: tpl.speed,
            inflicts: tpl.inflicts,
            nocturnal: tpl.nocturnal,
            fearAura: tpl.fearAura,
            role: tpl.role,
        };
        if (tpl.role === 'siege' && homeOptions.length > 0) mutt.homeZone = rng.pick(homeOptions);
        return mutt;
    });
}

// Composes one SignatureRule (trigger × selector × payload × telegraph) per
// generated arena from the same seeded RNG as the rest of the layout, so two
// arenas of the same biome don't necessarily share a mechanic. See
// `runDeclarativeSignature` in engine/arenaSignature.ts for how it executes.
const TRIGGER_KINDS: SignatureRule['trigger']['kind'][] = ['everyCycle', 'everyNth', 'nightsOnly', 'daysOnly', 'afterEscalation', 'lowSurvivors'];
const SELECTOR_KINDS: SignatureRule['selector']['kind'][] = ['fixedRotation', 'busiestZone', 'emptiestZone', 'nearCornucopia', 'lowestDanger', 'allZones'];
const PAYLOAD_KINDS: SignatureRule['payload']['kind'][] = ['damageEffect', 'severEdges', 'invertResources', 'spawnMutt', 'drainVital', 'revealPositions'];
const TELEGRAPH_KINDS: SignatureRule['telegraph']['kind'][] = ['oneAhead', 'none', 'falseChance'];
const SIGNATURE_EFFECT_KINDS: ZoneEffectKind[] = ['burning', 'flooded', 'frozen', 'contaminated', 'fogbound', 'stripped'];

function rollSignatureRule(rng: RNG): SignatureRule {
    const triggerKind = rng.pick(TRIGGER_KINDS);
    const payloadKind = rng.pick(PAYLOAD_KINDS);
    const telegraphKind = rng.pick(TELEGRAPH_KINDS);
    return {
        trigger: {
            kind: triggerKind,
            n: triggerKind === 'everyNth' ? rng.nextInt(PROC_SIGNATURE.everyNthMin, PROC_SIGNATURE.everyNthMax) : undefined,
            threshold: triggerKind === 'lowSurvivors' ? rng.nextInt(PROC_SIGNATURE.lowSurvivorsMin, PROC_SIGNATURE.lowSurvivorsMax) : undefined,
        },
        selector: { kind: rng.pick(SELECTOR_KINDS) },
        payload: {
            kind: payloadKind,
            effect: payloadKind === 'damageEffect' ? rng.pick(SIGNATURE_EFFECT_KINDS) : undefined,
        },
        telegraph: {
            kind: telegraphKind,
            falseChance: telegraphKind === 'falseChance' ? range(rng, [PROC_SIGNATURE.falseChanceMin, PROC_SIGNATURE.falseChanceMax]) : undefined,
        },
    };
}

const ARENA_NAME_SUFFIXES = [
    'Crucible', 'Gauntlet', 'Expanse', 'Labyrinth', 'Proving Grounds',
    'Wilds', 'Reach', 'Maze', 'Killing Ground', 'Hollow', 'Circuit', 'Basin',
    'Crown', 'Verge', 'Sprawl', 'Cauldron', 'Threshing Floor', 'Amphitheatre',
    'Enclosure', 'Preserve', 'Snare', 'Vise', 'Coliseum', 'Frontier', 'Waste',
    'Dominion', 'Theatre', 'Harrow', 'Gyre', 'Cage', 'Spiral', 'Winnowing',
];

// §5.2: the Gamemakers' standing rules for a generated arena — the same
// declarative fields hand-authored arenas set in src/data/constants.ts
// (`law`/`lawZone`, `edgeRules`, `effectVocab`, `sponsorMultiplier`), rolled
// from the arena's own seeded RNG so a shared seed reproduces them exactly.
const PROC_LAWS: ArenaLawId[] = [
    'noCannons', 'cornucopiaRefills', 'sponsorsFixedZone', 'noNight', 'noWaterExceptZone', 'fireImpossible',
];

function rollLaw(rng: RNG, zones: Zone[]): { law?: ArenaLawId; lawZone?: string } {
    // balance-exempt: generation-mix ratio, part of the arena grammar's shape rather than a designer dial
    if (!rng.chance(0.5)) return {};
    const law = rng.pick(PROC_LAWS);
    // Laws with an "only here" clause need a valid zone to point at.
    if (law === 'sponsorsFixedZone') return { law, lawZone: zones[0].name };
    if (law === 'noWaterExceptZone') {
        const watered = zones.filter(z => z.terrain === 'water' || z.terrain === 'wetland');
        // No water anywhere is the Warren's deliberate shape: legal, no lawZone.
        if (watered.length === 0) return { law };
        return { law, lawZone: rng.pick(watered).name };
    }
    return { law };
}

/** Stable key for an undirected edge — must match `edgeKey` in engine/map.ts. */
function procEdgeKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function rollEdgeRules(rng: RNG, zones: Zone[]): Record<string, EdgeRule> | undefined {
    // balance-exempt: generation-mix ratio — how many generated maps carry edge rules at all
    if (!rng.chance(0.4)) return undefined;
    // Every distinct edge in the built graph, in printed order for determinism.
    const seen = new Set<string>();
    const edges: [Zone, Zone][] = [];
    zones.forEach(z => z.adjacent.forEach(n => {
        const key = procEdgeKey(z.name, n);
        if (seen.has(key)) return;
        seen.add(key);
        const other = zones.find(o => o.name === n);
        if (other) edges.push([z, other]);
    }));
    if (edges.length === 0) return undefined;

    const rules: Record<string, EdgeRule> = {};
    const count = rng.nextInt(1, Math.min(3, edges.length));
    const picked = rng.shuffle(edges).slice(0, count);
    picked.forEach(([a, b]) => {
        const roll = rng.nextFloat();
        // balance-exempt: rule-kind mix shares over one roll (tolled/timeGated/oneWay), structural to the grammar
        if (roll < 0.45) {
            rules[procEdgeKey(a.name, b.name)] = {
                kind: 'tolled',
                toll: {
                    fatigue: rng.nextInt(4, 8),
                    // balance-exempt: which tolls carry a wound roll is part of the generation mix, not a lethality dial
                    woundChance: rng.chance(0.4) ? Math.round((0.08 + rng.nextFloat() * 0.07) * 100) / 100 : undefined,
                    // §11.6: some generated crossings also eat time or gear.
                    // balance-exempt: generation-mix share of tolls that also cost time
                    timeCost: rng.chance(0.25) ? 1 : undefined,
                    // balance-exempt: generation-mix share of tolls that also cost gear
                    itemCost: rng.chance(0.15) ? true : undefined,
                },
            };
        // balance-exempt: rule-kind mix share, same roll as above
        } else if (roll < 0.75) {
            // balance-exempt: day/night split of generated gates, structural to the grammar
            rules[procEdgeKey(a.name, b.name)] = { kind: 'timeGated', gatedTime: rng.chance(0.7) ? 'day' : 'night' };
        } else if (a.adjacent.length > 1 && b.adjacent.length > 1) {
            // One-way only between well-connected zones — a oneWay into a
            // dead end would be a pit trap the AI cannot reason about.
            // balance-exempt: fair coin for the one-way direction
            const [from, to] = rng.chance(0.5) ? [a, b] : [b, a];
            rules[procEdgeKey(a.name, b.name)] = { kind: 'oneWay', from: from.name, to: to.name };
        } else {
            rules[procEdgeKey(a.name, b.name)] = { kind: 'tolled', toll: { fatigue: rng.nextInt(4, 8) } };
        }
    });
    return rules;
}

/** Themed renamings of the zone-effect primitives, per biome. */
const EFFECT_VOCAB_BY_BIOME: Record<string, Array<NonNullable<Arena['effectVocab']>>> = {
    rainforest: [
        { contaminated: { label: 'a haze of spore-rot', severityMult: 1.15 } },
        { flooded: { label: 'a flash flood off the canopy', severityMult: 1.2 } },
    ],
    volcanic: [
        { burning: { label: 'a lava surge', severityMult: 1.3, durationMult: 0.8 } },
        { fogbound: { label: 'an ash blackout', durationMult: 1.25 } },
    ],
    archipelago: [
        { flooded: { label: 'a king tide', severityMult: 1.25 } },
        { fogbound: { label: 'a sea fog bank', durationMult: 1.5 } },
    ],
    highlands: [
        { frozen: { label: 'a killing frost', severityMult: 1.2 } },
        { fogbound: { label: 'a cloudbank sitting down on the moor' } },
    ],
    tundra: [
        { frozen: { label: 'a whiteout front', severityMult: 1.3 } },
        { fogbound: { label: 'a wall of ice fog', durationMult: 1.5 } },
    ],
    dunes: [
        { burning: { label: 'a firestorm off the dry scrub', severityMult: 1.2 } },
        { contaminated: { label: 'an alkali dust storm' } },
    ],
    bayou: [
        { contaminated: { label: 'a gas bloom off the black water', severityMult: 1.2 } },
        { flooded: { label: 'the bayou rising', durationMult: 1.3 } },
    ],
    ruinlands: [
        { contaminated: { label: 'a leak from something pre-war', severityMult: 1.15 } },
        { fogbound: { label: 'a concrete-dust whiteout' } },
    ],
};

function rollEffectVocab(rng: RNG, biome: Biome): Arena['effectVocab'] | undefined {
    // balance-exempt: generation-mix ratio for this optional arena feature
    if (!rng.chance(0.35)) return undefined;
    const options = EFFECT_VOCAB_BY_BIOME[biome.id];
    if (!options || options.length === 0) return undefined;
    return rng.pick(options);
}

/** Hand-authored arenas run 0.6-1.3; generated ones roll the same band. */
function rollSponsorMultiplier(rng: RNG): number | undefined {
    // balance-exempt: generation-mix ratio for this optional arena feature
    if (!rng.chance(0.55)) return undefined;
    return Math.round((0.7 + rng.nextFloat() * 0.6) * 20) / 20;
}

export function generateArena(seed: string): Arena {
    const rng = new RNG(`${seed}-arena`);
    const biome = rng.pick(BIOMES);
    // §8.3: the shape varies. Every hand-authored arena is 10-11 zones with 3
    // mutts, which reads to the player as sameness. The Gamemakers now build
    // claustrophobic 7-zone pressure cookers and 16-zone sprawls too — a
    // different game each, not just different scenery. (Below 6, a tribute
    // can never genuinely disappear, which is most of what an arena is for.)
    const shapeRoll = rng.nextFloat();
    const zoneCount = shapeRoll < 0.2 ? rng.nextInt(6, 8)
        : shapeRoll < 0.85 ? rng.nextInt(9, 12)
        : rng.nextInt(13, 16);
    const topology = rng.pick(TOPOLOGIES);
    const terrainVariant = rollTerrainVariant(rng, biome.terrains);

    // The Cornucopia is always the hub
    const zones: Zone[] = [{
        name: 'The Cornucopia',
        terrain: 'open',
        danger: range(rng, [0.5, 0.7]),
        resources: range(rng, [0.2, 0.4]),
        adjacent: [],
    }];

    const usedNames = new Set<string>(['The Cornucopia']);
    // Bounded: if a biome's name pools run dry the arena simply comes out
    // smaller, instead of looping forever looking for an unused name.
    let attempts = zoneCount * 40;
    while (zones.length < zoneCount && attempts-- > 0) {
        const terrain = rng.pick(biome.terrains);
        const pool = (biome.zoneNames[terrain] || []).filter(n => !usedNames.has(n));
        if (pool.length === 0) continue;
        const name = rng.pick(pool);
        usedNames.add(name);
        const profile = terrainVariant[terrain] ?? TERRAIN_PROFILES[terrain];
        zones.push({
            name,
            terrain,
            danger: range(rng, profile.danger),
            resources: range(rng, profile.resources),
            adjacent: [],
        });
    }

    buildTopology(topology, zones, rng);
    guaranteeConnectivity(zones);

    const activeTags = Array.from(new Set(zones.map(z => z.terrain as string)));
    // §8.3 / ARENA-11: mutt count varies too — one arena with a single
    // persistent horror reads very differently from one with three kinds of
    // teeth. `muttRoster` is what the encounter system actually resolves
    // against; `mutts` (display names) is now derived from it directly, so
    // the arena summary never again names a mutt that can't actually appear.
    const muttCount = rng.nextInt(1, 3);
    const muttRoster = generateMuttRoster(rng, biome, activeTags, muttCount, zones.map(z => z.name));
    const mutts = muttRoster.map(m => m.name);

    // `events` here is just the arena's own signature-event *name* list
    // (shown in arena summaries) — the actual event bodies/text come from
    // proceduralArenaFlavor() (src/data/proceduralFlavor.ts), tag-composed
    // from the zones above instead of hardcoded per biome. Derive the names
    // from whichever tagged events would actually be eligible to fire here.
    const tagSet = new Set(activeTags as FlavorTag[]);
    const eligible = PROCEDURAL_EVENTS.filter(e => e.tags.some(t => tagSet.has(t)));
    const eventNames = Array.from(new Set(
        (eligible.length ? eligible : PROCEDURAL_EVENTS).map(e => e.cause.replace(/^(Killed|Drowned|Died|Fell|Poisoned|Burned|Struck|Crushed|Stripped|Suffocated|Bled out to|Froze to death|Lost and frozen in|Lost to|Impaled in|Blinded and battered by)\b\s*(by|in|to|from)?\s*/, '').replace(/^\w/, c => c.toUpperCase()))
    )).slice(0, 5);

    // §8.6: 24 biome prefixes × 32 suffixes — several hundred distinct titles,
    // so returning players stop seeing the same handful regardless of layout.
    // `arena.id` stays exactly `procedural-<biome>` (flavor packs, climate
    // profiles and mutt lists key on it); only the display name widens.
    const prefix = rng.pick(biome.namePrefixes);
    const suffix = rng.pick(ARENA_NAME_SUFFIXES);
    // In-world phrasing per topology — the player is a Capitol viewer, not a
    // level designer, so no "procedurally generated" or engine topology names
    // in the summary (which can surface on a hidden-arena reveal).
    const layoutBlurb: Record<Topology, string> = {
        linear: 'The Gamemakers built it long and narrow this year — one way forward, and everything waiting along it.',
        hub: 'Every path in it bends back toward the Cornucopia, exactly as the Gamemakers intended.',
        ring: 'The arena runs in a great circle; keep walking and you meet whatever is walking the other way.',
        bisected: 'Something vast divides the arena clean in two, and crossing it is the whole question.',
        layered: 'The arena is stacked in tiers, and holding the high ground means something here.',
    };
    // §5.2: the Gamemakers' standing rules, rolled after the map is final so
    // every zone-referencing clause points at a zone that actually exists.
    const { law, lawZone } = rollLaw(rng, zones);
    const edgeRules = rollEdgeRules(rng, zones);
    const effectVocab = rollEffectVocab(rng, biome);
    const sponsorMultiplier = rollSponsorMultiplier(rng);

    return {
        id: `procedural-${biome.id}`,
        // A per-map identity for records and achievements: `id` must stay
        // exactly `procedural-<biome>` (flavour packs, climate profiles and
        // mutt kits key on it), so distinctness lives here instead.
        mapId: `procedural-${biome.id}-${new RNG(`${seed}-arena-map-id`).nextInt(0, 999999).toString(36)}-${topology}`,
        name: `The ${prefix} ${suffix}`,
        description: `${biome.description} ${layoutBlurb[topology]}`,
        mutts,
        events: eventNames,
        zones,
        signatureRule: rollSignatureRule(rng),
        muttRoster,
        terrainVariant,
        law,
        lawZone,
        edgeRules,
        effectVocab,
        sponsorMultiplier,
    };
}
