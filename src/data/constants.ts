import { Arena, Item } from '../models/types';

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
    { id: 'sword', name: 'Sword', type: 'weapon', value: 50, durability: 100 },
    { id: 'bow', name: 'Bow and Arrows', type: 'weapon', value: 60, durability: 80 },
    { id: 'axe', name: 'Axe', type: 'weapon', value: 45, durability: 90 },
    { id: 'knife', name: 'Throwing Knives', type: 'weapon', value: 30, durability: 50 },
    { id: 'spear', name: 'Spear', type: 'weapon', value: 40, durability: 70 },
    { id: 'mace', name: 'Mace', type: 'weapon', value: 45, durability: 85 },
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
