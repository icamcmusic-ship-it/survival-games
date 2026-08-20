import { Mutt } from '../models/types';

/**
 * Mutt data model: per-arena rosters.
 *
 * Design flaw being fixed (ARENA-04): every mutt in every arena used to be a
 * flavour string, mechanically identical to every other one. Each roster
 * below gives its three named mutts a distinct kit — a pack hunter, a solo
 * ambusher, and something that isn't really a "creature" at all — so Ice
 * Wolves and Acid Fog stop playing the same encounter with different text.
 *
 * Keyed by the arena id in `ARENAS` (src/data/constants.ts) plus one roster
 * per procedural biome id (src/engine/arenaGenerator.ts).
 */
export const ARENA_MUTTS: Record<string, Mutt[]> = {
    clockwork: [
        {
            id: 'tick-tock-monkeys', name: 'Tick-Tock Monkeys',
            packSize: [2, 5], damage: 14, speed: 7,
            // A pack that swarms rather than mauls: no bleed, just battered.
        },
        {
            id: 'lightning-birds', name: 'Lightning Birds',
            packSize: [1, 2], damage: 22, speed: 9,
            inflicts: { burned: true },
            nocturnal: true,
        },
        {
            id: 'acid-fog', name: 'Acid Fog',
            // Not a creature — a released hazard with a face. Low damage, no
            // pack, but it lingers and it gets in your head just by rolling in.
            packSize: [1, 1], damage: 8, speed: 3,
            inflicts: { infected: true },
            fearAura: 6,
        },
    ],
    frozen: [
        {
            id: 'ice-wolves', name: 'Ice Wolves',
            packSize: [2, 4], damage: 18, speed: 8,
            inflicts: { bleeding: true },
            // Ice wolves don't swim.
            terrainPreference: ['open', 'forest', 'highland', 'ruins'],
        },
        {
            id: 'snow-camouflage-snakes', name: 'Snow Camouflage Snakes',
            packSize: [1, 1], damage: 12, speed: 10,
            inflicts: { poisoned: true },
            // A single ambush striker — speed is what makes it dangerous, not numbers.
        },
        {
            id: 'frostbite-beetles', name: 'Frostbite Beetles',
            packSize: [3, 8], damage: 6, speed: 4,
            inflicts: { frostbitten: true },
            // A swarm: low per-hit damage, but numbers alone push the pack-size roll hard.
        },
    ],
    concrete: [
        {
            id: 'steel-jawed-rats', name: 'Steel-jawed Rats',
            packSize: [3, 6], damage: 10, speed: 6,
            inflicts: { bleeding: true },
            terrainPreference: ['ruins', 'open'],
        },
        {
            id: 'glass-winged-bats', name: 'Glass-winged Bats',
            packSize: [1, 3], damage: 15, speed: 9,
            nocturnal: true,
            terrainPreference: ['ruins', 'highland'],
        },
        {
            id: 'feral-tracker-jackers', name: 'Feral Tracker Jackers',
            // Canon's iconic hallucination mutt: light damage, huge dread.
            packSize: [1, 1], damage: 9, speed: 5,
            inflicts: { poisoned: true },
            fearAura: 10,
        },
    ],
    toxic: [
        {
            id: 'venomous-toads', name: 'Venomous Toads',
            packSize: [1, 2], damage: 10, speed: 3,
            inflicts: { poisoned: true },
            terrainPreference: ['wetland', 'water', 'forest'],
        },
        {
            id: 'leech-swarms', name: 'Leech Swarms',
            packSize: [4, 9], damage: 5, speed: 2,
            inflicts: { bleeding: true, infected: true },
            terrainPreference: ['wetland', 'water'],
        },
        {
            id: 'camouflaged-crocodiles', name: 'Camouflaged Crocodiles',
            packSize: [1, 1], damage: 30, speed: 6,
            inflicts: { bleeding: true },
            terrainPreference: ['water', 'wetland'],
            persistent: true,
        },
    ],
    solar: [
        {
            id: 'sand-vipers', name: 'Sand Vipers',
            packSize: [1, 1], damage: 14, speed: 11,
            inflicts: { poisoned: true },
            terrainPreference: ['open', 'highland'],
        },
        {
            id: 'mirage-scorpions', name: 'Mirage Scorpions',
            packSize: [2, 4], damage: 9, speed: 5,
            inflicts: { infected: true },
        },
        {
            id: 'burrowing-centipedes', name: 'Burrowing Centipedes',
            packSize: [3, 6], damage: 7, speed: 4,
            inflicts: { bleeding: true },
            terrainPreference: ['open', 'wetland'],
        },
    ],
    ashfall: [
        {
            id: 'cinder-hounds', name: 'Cinder Hounds',
            packSize: [2, 4], damage: 20, speed: 8,
            inflicts: { burned: true },
        },
        {
            id: 'ash-wraiths', name: 'Ash Wraiths',
            // Genuinely faceless, but sold as "your dead" by the Gamemakers —
            // high fear, low damage, nocturnal.
            packSize: [1, 2], damage: 6, speed: 6,
            fearAura: 8,
            nocturnal: true,
        },
        {
            id: 'glass-shard-crows', name: 'Glass-Shard Crows',
            packSize: [3, 7], damage: 8, speed: 9,
            inflicts: { bleeding: true },
            terrainPreference: ['open', 'highland', 'ruins'],
        },
    ],
    tempest: [
        {
            id: 'squall-serpents', name: 'Squall Serpents',
            packSize: [1, 2], damage: 24, speed: 9,
            inflicts: { bleeding: true },
            terrainPreference: ['water', 'wetland'],
            persistent: true,
        },
        {
            id: 'barnacle-crabs', name: 'Barnacle Crabs',
            packSize: [3, 6], damage: 8, speed: 3,
            terrainPreference: ['water', 'wetland', 'open'],
        },
        {
            id: 'drowned-gulls', name: 'Drowned Gulls',
            packSize: [2, 5], damage: 6, speed: 10,
            inflicts: { infected: true },
            fearAura: 4,
        },
    ],
    saltflats: [
        {
            id: 'brine-wolves', name: 'Brine Wolves',
            packSize: [2, 4], damage: 17, speed: 8,
            inflicts: { bleeding: true },
            terrainPreference: ['open', 'ruins', 'highland'],
        },
        {
            id: 'salt-locusts', name: 'Salt Locusts',
            packSize: [4, 9], damage: 5, speed: 6,
            inflicts: { infected: true },
        },
        {
            id: 'mirage-stalkers', name: 'Mirage Stalkers',
            // Never seen twice in the same place — the persistent hunter of the arena.
            packSize: [1, 1], damage: 16, speed: 10,
            fearAura: 7,
            persistent: true,
        },
    ],
    sporefields: [
        {
            id: 'spore-moths', name: 'Spore Moths',
            packSize: [3, 7], damage: 5, speed: 5,
            inflicts: { poisoned: true },
            fearAura: 3,
            nocturnal: true,
        },
        {
            id: 'mycelial-hounds', name: 'Mycelial Hounds',
            packSize: [2, 4], damage: 19, speed: 7,
            inflicts: { bleeding: true },
            terrainPreference: ['forest', 'wetland', 'open'],
        },
        {
            id: 'puffball-swarms', name: 'Puffball Swarms',
            // A hazard-shaped mutt: no bite at all, just a lungful of spores.
            packSize: [1, 1], damage: 4, speed: 1,
            inflicts: { infected: true },
            fearAura: 5,
        },
    ],
    canopy: [
        {
            id: 'silk-spiders', name: 'Silk Spiders',
            packSize: [2, 5], damage: 11, speed: 7,
            inflicts: { poisoned: true },
            terrainPreference: ['forest', 'highland'],
        },
        {
            id: 'screech-primates', name: 'Screech Primates',
            packSize: [3, 6], damage: 13, speed: 9,
            fearAura: 5,
        },
        {
            id: 'thornvine-constrictors', name: 'Thornvine Constrictors',
            packSize: [1, 1], damage: 26, speed: 4,
            inflicts: { bleeding: true },
            terrainPreference: ['forest', 'wetland'],
            persistent: true,
        },
    ],
    vault: [
        {
            id: 'pallid-stalkers', name: 'Pallid Stalkers',
            // The arena that literally projects the dead onto the ceiling —
            // its signature mutt is the one built to wear a face.
            packSize: [1, 1], damage: 15, speed: 7,
            fearAura: 9,
            nocturnal: true,
            persistent: true,
        },
        {
            id: 'rebar-hounds', name: 'Rebar Hounds',
            packSize: [2, 4], damage: 18, speed: 6,
            inflicts: { bleeding: true },
            terrainPreference: ['ruins', 'open', 'highland'],
        },
        {
            id: 'circuit-wasps', name: 'Circuit Wasps',
            packSize: [4, 8], damage: 6, speed: 10,
            inflicts: { infected: true },
        },
    ],

    // Procedural biomes (src/engine/arenaGenerator.ts BIOMES ids).
    rainforest: [
        {
            id: 'razor-parrots', name: 'Razor Parrots',
            packSize: [3, 6], damage: 9, speed: 10,
            inflicts: { bleeding: true },
        },
        {
            id: 'constrictor-vines', name: 'Constrictor Vines',
            packSize: [1, 1], damage: 20, speed: 2,
            terrainPreference: ['forest', 'wetland', 'ruins'],
            persistent: true,
        },
        {
            id: 'panther-mutts', name: 'Panther Mutts',
            packSize: [1, 2], damage: 25, speed: 9,
            inflicts: { bleeding: true },
            nocturnal: true,
        },
    ],
    volcanic: [
        {
            id: 'magma-hounds', name: 'Magma Hounds',
            packSize: [2, 4], damage: 22, speed: 8,
            inflicts: { burned: true },
        },
        {
            id: 'ash-wraiths-v', name: 'Ash Wraiths',
            packSize: [1, 2], damage: 7, speed: 6,
            fearAura: 8,
            nocturnal: true,
        },
        {
            id: 'obsidian-beetles', name: 'Obsidian Beetles',
            packSize: [3, 7], damage: 6, speed: 4,
            inflicts: { bleeding: true },
            terrainPreference: ['open', 'highland', 'ruins'],
        },
    ],
    archipelago: [
        {
            id: 'razorfin-sharks', name: 'Razorfin Sharks',
            packSize: [1, 3], damage: 28, speed: 9,
            inflicts: { bleeding: true },
            terrainPreference: ['water'],
        },
        {
            id: 'storm-gulls', name: 'Storm Gulls',
            packSize: [3, 6], damage: 8, speed: 10,
        },
        {
            id: 'coral-crabs', name: 'Coral Crabs',
            packSize: [2, 5], damage: 10, speed: 3,
            inflicts: { infected: true },
            terrainPreference: ['water', 'open'],
        },
    ],
    highlands: [
        {
            id: 'cliff-harpies', name: 'Cliff Harpies',
            packSize: [1, 3], damage: 16, speed: 10,
            inflicts: { bleeding: true },
            terrainPreference: ['highland', 'open'],
        },
        {
            id: 'dire-rams', name: 'Dire Rams',
            packSize: [1, 2], damage: 21, speed: 6,
        },
        {
            id: 'fog-stalkers', name: 'Fog Stalkers',
            packSize: [1, 1], damage: 12, speed: 7,
            fearAura: 6,
            nocturnal: true,
            persistent: true,
        },
    ],
};
