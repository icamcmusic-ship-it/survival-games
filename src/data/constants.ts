import { Arena, Item, GameConfig, Build } from '../models/types';

export const DEFAULT_GAME_CONFIG: GameConfig = {
    districtCount: 12,
    hazardRate: 1.0,
    betrayalRate: 1.0,
    sponsorGenerosity: 1.0,
    enableFeast: true,
    enableSanity: true,
};

export const BUILDS: Build[] = ['Frail', 'Slight', 'Average', 'Athletic', 'Stocky', 'Muscular'];

export const ARENAS: Arena[] = [
    {
        id: 'clockwork',
        name: 'The Clockwork Island',
        description: 'A shifting map layout divided into 12 sectors, each unleashing a different horror at a specific hour.',
        mutts: ['Tick-Tock Monkeys', 'Lightning Birds', 'Acid Fog'],
        events: ['Sector Shift', 'Blood Rain', 'Tidal Wave'],
        zones: [
            { name: 'The Cornucopia', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['Sector 1 (Jungle)', 'Sector 2 (Beach)', 'Sector 3 (Cliffs)', 'Sector 4 (Swamp)'] },
            { name: 'Sector 1 (Jungle)', terrain: 'forest', danger: 0.5, resources: 0.7, adjacent: ['The Cornucopia', 'Sector 2 (Beach)'] },
            { name: 'Sector 2 (Beach)', terrain: 'water', danger: 0.3, resources: 0.5, adjacent: ['The Cornucopia', 'Sector 1 (Jungle)', 'Sector 3 (Cliffs)'] },
            { name: 'Sector 3 (Cliffs)', terrain: 'highland', danger: 0.7, resources: 0.2, adjacent: ['The Cornucopia', 'Sector 2 (Beach)', 'Sector 4 (Swamp)'] },
            { name: 'Sector 4 (Swamp)', terrain: 'wetland', danger: 0.6, resources: 0.4, adjacent: ['The Cornucopia', 'Sector 3 (Cliffs)'] },
        ]
    },
    {
        id: 'frozen',
        name: 'The Frozen Wasteland',
        description: 'Lethal cold and blizzards. Finding shelter and warmth is as important as fighting.',
        mutts: ['Ice Wolves', 'Snow Camouflage Snakes', 'Frostbite Beetles'],
        events: ['Blizzard', 'Avalanche', 'Thin Ice Collapse'],
        zones: [
            { name: 'The Cornucopia', terrain: 'open', danger: 0.5, resources: 0.3, adjacent: ['Frozen Lake', 'Snowy Pine Forest'] },
            { name: 'Frozen Lake', terrain: 'water', danger: 0.7, resources: 0.4, adjacent: ['The Cornucopia', 'Ice Caves'] },
            { name: 'Ice Caves', terrain: 'ruins', danger: 0.4, resources: 0.2, adjacent: ['Frozen Lake', 'Glacier Peak'] },
            { name: 'Snowy Pine Forest', terrain: 'forest', danger: 0.3, resources: 0.7, adjacent: ['The Cornucopia', 'Glacier Peak'] },
            { name: 'Glacier Peak', terrain: 'highland', danger: 0.8, resources: 0.1, adjacent: ['Ice Caves', 'Snowy Pine Forest'] },
        ]
    },
    {
        id: 'concrete',
        name: 'The Concrete Jungle',
        description: 'An abandoned, decaying metropolis. Verticality and structural collapses are constant threats.',
        mutts: ['Steel-jawed Rats', 'Glass-winged Bats', 'Feral Tracker Jackers'],
        events: ['Building Collapse', 'Sewer Flooding', 'Live Wire Trap'],
        zones: [
            { name: 'The Cornucopia (City Square)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['Abandoned Subway', 'Skyscraper Ruins', 'Overgrown Park'] },
            { name: 'Abandoned Subway', terrain: 'ruins', danger: 0.7, resources: 0.3, adjacent: ['The Cornucopia (City Square)', 'Industrial District'] },
            { name: 'Skyscraper Ruins', terrain: 'highland', danger: 0.8, resources: 0.4, adjacent: ['The Cornucopia (City Square)', 'Industrial District'] },
            { name: 'Overgrown Park', terrain: 'forest', danger: 0.3, resources: 0.7, adjacent: ['The Cornucopia (City Square)', 'Industrial District'] },
            { name: 'Industrial District', terrain: 'ruins', danger: 0.6, resources: 0.4, adjacent: ['Abandoned Subway', 'Skyscraper Ruins', 'Overgrown Park'] },
        ]
    },
    {
        id: 'toxic',
        name: 'The Toxic Swamps',
        description: 'Hallucinogenic gas and poison risk. The water is mostly undrinkable without purification.',
        mutts: ['Venomous Toads', 'Leech Swarms', 'Camouflaged Crocodiles'],
        events: ['Hallucinogenic Spores', 'Methane Explosion', 'Quicksand Sinkhole'],
        zones: [
            { name: 'The Cornucopia', terrain: 'open', danger: 0.5, resources: 0.3, adjacent: ['Murky Waters', 'Dead Tree Grove'] },
            { name: 'Murky Waters', terrain: 'water', danger: 0.7, resources: 0.4, adjacent: ['The Cornucopia', 'Glowing Bog'] },
            { name: 'Dead Tree Grove', terrain: 'forest', danger: 0.4, resources: 0.5, adjacent: ['The Cornucopia', 'Ruined Shacks'] },
            { name: 'Glowing Bog', terrain: 'wetland', danger: 0.8, resources: 0.6, adjacent: ['Murky Waters', 'Ruined Shacks'] },
            { name: 'Ruined Shacks', terrain: 'ruins', danger: 0.3, resources: 0.4, adjacent: ['Dead Tree Grove', 'Glowing Bog'] },
        ]
    },
    {
        id: 'solar',
        name: 'The Solar Desert',
        description: 'Extreme heat, severe water scarcity, and deadly solar flares. Shade is a premium.',
        mutts: ['Sand Vipers', 'Mirage Scorpions', 'Burrowing Centipedes'],
        events: ['Solar Flare', 'Sandstorm', 'Oasis Mirage'],
        zones: [
            { name: 'The Cornucopia', terrain: 'open', danger: 0.5, resources: 0.3, adjacent: ['Endless Dunes', 'Rocky Outcrop'] },
            { name: 'Endless Dunes', terrain: 'open', danger: 0.7, resources: 0.1, adjacent: ['The Cornucopia', 'Dried Oasis'] },
            { name: 'Canyon Shadows', terrain: 'highland', danger: 0.4, resources: 0.4, adjacent: ['Dried Oasis', 'Rocky Outcrop'] },
            { name: 'Dried Oasis', terrain: 'wetland', danger: 0.3, resources: 0.5, adjacent: ['Endless Dunes', 'Canyon Shadows'] },
            { name: 'Rocky Outcrop', terrain: 'highland', danger: 0.6, resources: 0.3, adjacent: ['The Cornucopia', 'Canyon Shadows'] },
        ]
    }
];

export const TRAITS = [
    'Hydrophilic', 'Insomniac', 'Paranoid', 'Charismatic', 'Clumsy',
    'Eagle-Eyed', 'Iron Stomach', 'Light Sleeper', 'Bloodthirsty', 'Pacifist',
    'Pyromaniac', 'Nimble', 'Brute', 'Strategist', 'Tracker'
];

export const ITEMS: Item[] = [
    { id: 'sword', name: 'Sword', type: 'weapon', value: 50, durability: 100, weaponClass: 'melee', damage: 6 },
    { id: 'bow', name: 'Bow and Arrows', type: 'weapon', value: 60, durability: 80, weaponClass: 'ranged', damage: 6 },
    { id: 'axe', name: 'Axe', type: 'weapon', value: 45, durability: 90, weaponClass: 'melee', damage: 5 },
    { id: 'knife', name: 'Throwing Knives', type: 'weapon', value: 30, durability: 50, weaponClass: 'thrown', damage: 3 },
    { id: 'spear', name: 'Spear', type: 'weapon', value: 40, durability: 70, weaponClass: 'thrown', damage: 4 },
    { id: 'mace', name: 'Mace', type: 'weapon', value: 45, durability: 85, weaponClass: 'melee', damage: 5 },
    { id: 'trident', name: 'Trident', type: 'weapon', value: 65, durability: 90, weaponClass: 'melee', damage: 7 },
    { id: 'machete', name: 'Machete', type: 'weapon', value: 40, durability: 80, weaponClass: 'melee', damage: 4 },
    { id: 'sickle', name: 'Sickle', type: 'weapon', value: 35, durability: 70, weaponClass: 'melee', damage: 4 },
    { id: 'blowgun', name: 'Blowgun with Darts', type: 'weapon', value: 35, durability: 40, weaponClass: 'ranged', damage: 2, poison: true },
    { id: 'garrote', name: 'Wire Garrote', type: 'weapon', value: 25, durability: 30, weaponClass: 'melee', damage: 3 },
    { id: 'slingshot', name: 'Slingshot', type: 'weapon', value: 20, durability: 60, weaponClass: 'ranged', damage: 2 },
    { id: 'water', name: 'Water Bottle', type: 'water', value: 20 },
    { id: 'bread', name: 'Loaf of Bread', type: 'food', value: 15, spoilage: 3 },
    { id: 'berries', name: 'Foraged Berries', type: 'food', value: 5, spoilage: 1 },
    { id: 'dried-meat', name: 'Dried Meat', type: 'food', value: 20, spoilage: 6 },
    { id: 'medkit', name: 'First Aid Kit', type: 'medical', value: 80 },
    { id: 'ointment', name: 'Burn Ointment', type: 'medical', value: 40 },
    { id: 'antidote', name: 'Antidote Vial', type: 'medical', value: 60 },
    { id: 'rope', name: 'Rope', type: 'utility', value: 10 },
    { id: 'wire', name: 'Wire', type: 'utility', value: 15 },
    { id: 'matches', name: 'Matches', type: 'utility', value: 25 },
    { id: 'backpack', name: 'Backpack', type: 'utility', value: 30 },
];
