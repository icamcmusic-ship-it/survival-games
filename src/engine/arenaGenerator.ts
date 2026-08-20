import { Arena, Terrain, Zone } from '../models/types';
import { RNG } from '../utils/rng';
import { PROCEDURAL_EVENTS, FlavorTag } from '../data/proceduralFlavor';

interface Biome {
    id: string;
    namePrefix: string;
    description: string;
    terrains: Terrain[];
    zoneNames: Record<Terrain, string[]>;
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

function generateMuttNames(rng: RNG, activeTags: string[], count: number): string[] {
    const pools = activeTags.length
        ? activeTags.flatMap(t => MODIFIERS_BY_TAG[t] || [])
        : [];
    const modifierPool = (pools.length ? pools : GENERIC_MODIFIERS).concat(GENERIC_MODIFIERS);
    const names = new Set<string>();
    let attempts = 30;
    while (names.size < count && attempts-- > 0) {
        const name = `${rng.pick(modifierPool)} ${rng.pick(CREATURE_BASES)}`;
        names.add(name);
    }
    return Array.from(names);
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
        const profile = TERRAIN_PROFILES[terrain];
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
    // §8.3: mutt count varies too — one arena with a single persistent horror
    // reads very differently from one with five kinds of teeth.
    const muttCount = rng.nextInt(1, 5);
    const mutts = generateMuttNames(rng, activeTags, muttCount);

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

    const suffix = rng.pick(['Crucible', 'Gauntlet', 'Expanse', 'Labyrinth', 'Proving Grounds']);
    return {
        id: `procedural-${biome.id}`,
        name: `The ${biome.namePrefix} ${suffix}`,
        description: `${biome.description} (Procedurally generated arena — ${topology} layout.)`,
        mutts,
        events: eventNames,
        zones,
    };
}
