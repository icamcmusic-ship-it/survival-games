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
        zones: ['The Cornucopia', 'Sector 1 (Jungle)', 'Sector 2 (Beach)', 'Sector 3 (Cliffs)', 'Sector 4 (Swamp)']
    },
    {
        id: 'frozen',
        name: 'The Frozen Wasteland',
        description: 'Lethal cold and blizzards. Finding shelter and warmth is as important as fighting.',
        mutts: ['Ice Wolves', 'Snow Camouflage Snakes', 'Frostbite Beetles'],
        events: ['Blizzard', 'Avalanche', 'Thin Ice Collapse'],
        zones: ['The Cornucopia', 'Frozen Lake', 'Ice Caves', 'Snowy Pine Forest', 'Glacier Peak']
    },
    {
        id: 'concrete',
        name: 'The Concrete Jungle',
        description: 'An abandoned, decaying metropolis. Verticality and structural collapses are constant threats.',
        mutts: ['Steel-jawed Rats', 'Glass-winged Bats', 'Feral Tracker Jackers'],
        events: ['Building Collapse', 'Sewer Flooding', 'Live Wire Trap'],
        zones: ['The Cornucopia (City Square)', 'Abandoned Subway', 'Skyscraper Ruins', 'Overgrown Park', 'Industrial District']
    },
    {
        id: 'toxic',
        name: 'The Toxic Swamps',
        description: 'Hallucinogenic gas and poison risk. The water is mostly undrinkable without purification.',
        mutts: ['Venomous Toads', 'Leech Swarms', 'Camouflaged Crocodiles'],
        events: ['Hallucinogenic Spores', 'Methane Explosion', 'Quicksand Sinkhole'],
        zones: ['The Cornucopia', 'Murky Waters', 'Dead Tree Grove', 'Glowing Bog', 'Ruined Shacks']
    },
    {
        id: 'solar',
        name: 'The Solar Desert',
        description: 'Extreme heat, severe water scarcity, and deadly solar flares. Shade is a premium.',
        mutts: ['Sand Vipers', 'Mirage Scorpions', 'Burrowing Centipedes'],
        events: ['Solar Flare', 'Sandstorm', 'Oasis Mirage'],
        zones: ['The Cornucopia', 'Endless Dunes', 'Canyon Shadows', 'Dried Oasis', 'Rocky Outcrop']
    }
];

export const TRAITS = [
    'Hydrophilic', 'Insomniac', 'Paranoid', 'Charismatic', 'Clumsy', 
    'Eagle-Eyed', 'Iron Stomach', 'Light Sleeper', 'Bloodthirsty', 'Pacifist',
    'Pyromaniac', 'Nimble', 'Brute', 'Strategist', 'Tracker'
];

export const ITEMS: Item[] = [
    { id: 'sword', name: 'Sword', type: 'weapon', subtype: 'melee', value: 50, durability: 100 },
    { id: 'bow', name: 'Bow and Arrows', type: 'weapon', subtype: 'ranged', value: 60, durability: 80 },
    { id: 'axe', name: 'Axe', type: 'weapon', subtype: 'melee', value: 45, durability: 90 },
    { id: 'knife', name: 'Throwing Knives', type: 'weapon', subtype: 'thrown', value: 30, durability: 50 },
    { id: 'spear', name: 'Spear', type: 'weapon', subtype: 'thrown', value: 40, durability: 70 },
    { id: 'mace', name: 'Mace', type: 'weapon', subtype: 'melee', value: 45, durability: 85 },
    { id: 'trident', name: 'Trident', type: 'weapon', subtype: 'thrown', value: 55, durability: 65 },
    { id: 'crossbow', name: 'Crossbow', type: 'weapon', subtype: 'ranged', value: 65, durability: 60 },
    { id: 'whip', name: 'Whip', type: 'weapon', subtype: 'melee', value: 35, durability: 75 },
    { id: 'machete', name: 'Machete', type: 'weapon', subtype: 'melee', value: 42, durability: 95 },
    { id: 'sickle', name: 'Sickle', type: 'weapon', subtype: 'melee', value: 32, durability: 60 },
    { id: 'warhammer', name: 'Warhammer', type: 'weapon', subtype: 'melee', value: 58, durability: 55 },
    { id: 'blowgun', name: 'Blowgun', type: 'weapon', subtype: 'ranged', value: 38, durability: 40 },
    { id: 'water', name: 'Water Bottle', type: 'water', value: 20 },
    { id: 'bread', name: 'Loaf of Bread', type: 'food', value: 15, spoilage: 3 },
    { id: 'berries', name: 'Foraged Berries', type: 'food', value: 5, spoilage: 1 },
    { id: 'medkit', name: 'First Aid Kit', type: 'medical', value: 80 },
    { id: 'ointment', name: 'Burn Ointment', type: 'medical', value: 40 },
    { id: 'rope', name: 'Rope', type: 'utility', value: 10 },
    { id: 'wire', name: 'Wire', type: 'utility', value: 15 },
    { id: 'matches', name: 'Matches', type: 'utility', value: 25 },
    { id: 'backpack', name: 'Backpack', type: 'utility', value: 30 },
];
