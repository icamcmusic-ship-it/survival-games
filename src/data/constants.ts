import { Arena, Item, GameConfig, Build } from '../models/types';
import { ROLLABLE_TRAITS } from './traits';

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
        description: 'A shifting map layout divided into sectors, each unleashing a different horror at a specific hour.',
        mutts: ['Tick-Tock Monkeys', 'Lightning Birds', 'Acid Fog'],
        events: ['Sector Shift', 'Blood Rain', 'Tidal Wave'],
        zones: [
            { name: 'The Cornucopia', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['Sector 1 (Jungle)', 'Sector 2 (Beach)', 'Sector 3 (Cliffs)', 'Sector 4 (Swamp)', 'Sector 12 (Blood Rain)'] },
            { name: 'Sector 1 (Jungle)', terrain: 'forest', danger: 0.5, resources: 0.7, adjacent: ['The Cornucopia', 'Sector 2 (Beach)', 'Sector 11 (Monkey Wood)'] },
            { name: 'Sector 2 (Beach)', terrain: 'water', danger: 0.3, resources: 0.5, adjacent: ['The Cornucopia', 'Sector 1 (Jungle)', 'Sector 3 (Cliffs)'] },
            { name: 'Sector 3 (Cliffs)', terrain: 'highland', danger: 0.7, resources: 0.2, adjacent: ['The Cornucopia', 'Sector 2 (Beach)', 'Sector 4 (Swamp)', 'Sector 5 (Lightning Tree)'] },
            { name: 'Sector 4 (Swamp)', terrain: 'wetland', danger: 0.6, resources: 0.4, adjacent: ['The Cornucopia', 'Sector 3 (Cliffs)', 'Sector 6 (Insect Hollow)'] },
            { name: 'Sector 5 (Lightning Tree)', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['Sector 3 (Cliffs)', 'Sector 9 (Salt Reef)'] },
            { name: 'Sector 6 (Insect Hollow)', terrain: 'wetland', danger: 0.8, resources: 0.35, adjacent: ['Sector 4 (Swamp)', 'Sector 7 (Dry Shelf)'] },
            { name: 'Sector 7 (Dry Shelf)', terrain: 'open', danger: 0.45, resources: 0.25, adjacent: ['Sector 6 (Insect Hollow)', 'Sector 9 (Salt Reef)', 'Sector 12 (Blood Rain)'] },
            { name: 'Sector 9 (Salt Reef)', terrain: 'water', danger: 0.55, resources: 0.6, adjacent: ['Sector 5 (Lightning Tree)', 'Sector 7 (Dry Shelf)', 'Sector 11 (Monkey Wood)'] },
            { name: 'Sector 11 (Monkey Wood)', terrain: 'forest', danger: 0.75, resources: 0.55, adjacent: ['Sector 1 (Jungle)', 'Sector 9 (Salt Reef)', 'Sector 12 (Blood Rain)'] },
            { name: 'Sector 12 (Blood Rain)', terrain: 'ruins', danger: 0.7, resources: 0.2, adjacent: ['The Cornucopia', 'Sector 7 (Dry Shelf)', 'Sector 11 (Monkey Wood)'] },
        ]
    },
    {
        id: 'frozen',
        name: 'The Frozen Wasteland',
        description: 'Lethal cold and blizzards. Finding shelter and warmth is as important as fighting.',
        mutts: ['Ice Wolves', 'Snow Camouflage Snakes', 'Frostbite Beetles'],
        events: ['Blizzard', 'Avalanche', 'Thin Ice Collapse'],
        zones: [
            { name: 'The Cornucopia', terrain: 'open', danger: 0.5, resources: 0.3, adjacent: ['Frozen Lake', 'Snowy Pine Forest', 'The Windbreak'] },
            { name: 'Frozen Lake', terrain: 'water', danger: 0.7, resources: 0.4, adjacent: ['The Cornucopia', 'Ice Caves', 'The Meltwater Channel'] },
            { name: 'Ice Caves', terrain: 'ruins', danger: 0.4, resources: 0.2, adjacent: ['Frozen Lake', 'Glacier Peak', 'The Crevasse Field'] },
            { name: 'Snowy Pine Forest', terrain: 'forest', danger: 0.3, resources: 0.7, adjacent: ['The Cornucopia', 'Glacier Peak', 'The Trapper\'s Cabin'] },
            { name: 'Glacier Peak', terrain: 'highland', danger: 0.8, resources: 0.1, adjacent: ['Ice Caves', 'Snowy Pine Forest', 'The Crevasse Field'] },
            { name: 'The Windbreak', terrain: 'open', danger: 0.55, resources: 0.15, adjacent: ['The Cornucopia', 'The Trapper\'s Cabin', 'The Meltwater Channel'] },
            { name: 'The Trapper\'s Cabin', terrain: 'ruins', danger: 0.35, resources: 0.55, adjacent: ['Snowy Pine Forest', 'The Windbreak', 'Buried Timberline'] },
            { name: 'The Crevasse Field', terrain: 'highland', danger: 0.9, resources: 0.05, adjacent: ['Ice Caves', 'Glacier Peak'] },
            { name: 'The Meltwater Channel', terrain: 'water', danger: 0.6, resources: 0.5, adjacent: ['Frozen Lake', 'The Windbreak', 'Buried Timberline'] },
            { name: 'Buried Timberline', terrain: 'forest', danger: 0.45, resources: 0.65, adjacent: ['The Trapper\'s Cabin', 'The Meltwater Channel'] },
        ]
    },
    {
        id: 'concrete',
        name: 'The Concrete Jungle',
        description: 'An abandoned, decaying metropolis. Verticality and structural collapses are constant threats.',
        mutts: ['Steel-jawed Rats', 'Glass-winged Bats', 'Feral Tracker Jackers'],
        events: ['Building Collapse', 'Sewer Flooding', 'Live Wire Trap'],
        zones: [
            { name: 'The Cornucopia (City Square)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['Abandoned Subway', 'Skyscraper Ruins', 'Overgrown Park', 'The Flooded Underpass'] },
            { name: 'Abandoned Subway', terrain: 'ruins', danger: 0.7, resources: 0.3, adjacent: ['The Cornucopia (City Square)', 'Industrial District', 'The Flooded Underpass'] },
            { name: 'Skyscraper Ruins', terrain: 'highland', danger: 0.8, resources: 0.4, adjacent: ['The Cornucopia (City Square)', 'Industrial District', 'The Rooftop Gardens'] },
            { name: 'Overgrown Park', terrain: 'forest', danger: 0.3, resources: 0.7, adjacent: ['The Cornucopia (City Square)', 'Industrial District', 'The Reservoir'] },
            { name: 'Industrial District', terrain: 'ruins', danger: 0.6, resources: 0.4, adjacent: ['Abandoned Subway', 'Skyscraper Ruins', 'Overgrown Park', 'The Rail Yard'] },
            { name: 'The Flooded Underpass', terrain: 'water', danger: 0.65, resources: 0.35, adjacent: ['The Cornucopia (City Square)', 'Abandoned Subway', 'The Reservoir'] },
            { name: 'The Rooftop Gardens', terrain: 'forest', danger: 0.45, resources: 0.65, adjacent: ['Skyscraper Ruins', 'The Rail Yard'] },
            { name: 'The Reservoir', terrain: 'water', danger: 0.4, resources: 0.6, adjacent: ['Overgrown Park', 'The Flooded Underpass'] },
            { name: 'The Rail Yard', terrain: 'open', danger: 0.55, resources: 0.25, adjacent: ['Industrial District', 'The Rooftop Gardens', 'The Clocktower'] },
            { name: 'The Clocktower', terrain: 'highland', danger: 0.85, resources: 0.15, adjacent: ['The Rail Yard'] },
        ]
    },
    {
        id: 'toxic',
        name: 'The Toxic Swamps',
        description: 'Hallucinogenic gas and poison risk. The water is mostly undrinkable without purification.',
        mutts: ['Venomous Toads', 'Leech Swarms', 'Camouflaged Crocodiles'],
        events: ['Hallucinogenic Spores', 'Methane Explosion', 'Quicksand Sinkhole'],
        zones: [
            { name: 'The Cornucopia', terrain: 'open', danger: 0.5, resources: 0.3, adjacent: ['Murky Waters', 'Dead Tree Grove', 'The Causeway'] },
            { name: 'Murky Waters', terrain: 'water', danger: 0.7, resources: 0.4, adjacent: ['The Cornucopia', 'Glowing Bog', 'The Reed Maze'] },
            { name: 'Dead Tree Grove', terrain: 'forest', danger: 0.4, resources: 0.5, adjacent: ['The Cornucopia', 'Ruined Shacks', 'The Cypress Stand'] },
            { name: 'Glowing Bog', terrain: 'wetland', danger: 0.8, resources: 0.6, adjacent: ['Murky Waters', 'Ruined Shacks', 'The Gas Flats'] },
            { name: 'Ruined Shacks', terrain: 'ruins', danger: 0.3, resources: 0.4, adjacent: ['Dead Tree Grove', 'Glowing Bog', 'The Stilt Village'] },
            { name: 'The Causeway', terrain: 'open', danger: 0.55, resources: 0.2, adjacent: ['The Cornucopia', 'The Reed Maze', 'The Cypress Stand'] },
            { name: 'The Reed Maze', terrain: 'wetland', danger: 0.6, resources: 0.55, adjacent: ['Murky Waters', 'The Causeway', 'The Gas Flats'] },
            { name: 'The Cypress Stand', terrain: 'forest', danger: 0.35, resources: 0.75, adjacent: ['Dead Tree Grove', 'The Causeway', 'The Stilt Village'] },
            { name: 'The Gas Flats', terrain: 'wetland', danger: 0.9, resources: 0.25, adjacent: ['Glowing Bog', 'The Reed Maze'] },
            { name: 'The Stilt Village', terrain: 'ruins', danger: 0.45, resources: 0.5, adjacent: ['Ruined Shacks', 'The Cypress Stand'] },
        ]
    },
    {
        id: 'solar',
        name: 'The Solar Desert',
        description: 'Extreme heat, severe water scarcity, and deadly solar flares. Shade is a premium.',
        mutts: ['Sand Vipers', 'Mirage Scorpions', 'Burrowing Centipedes'],
        events: ['Solar Flare', 'Sandstorm', 'Oasis Mirage'],
        zones: [
            { name: 'The Cornucopia', terrain: 'open', danger: 0.5, resources: 0.3, adjacent: ['Endless Dunes', 'Rocky Outcrop', 'The Bone Road'] },
            { name: 'Endless Dunes', terrain: 'open', danger: 0.7, resources: 0.1, adjacent: ['The Cornucopia', 'Dried Oasis', 'The Glass Sea'] },
            { name: 'Canyon Shadows', terrain: 'highland', danger: 0.4, resources: 0.4, adjacent: ['Dried Oasis', 'Rocky Outcrop', 'The Slot Canyon'] },
            { name: 'Dried Oasis', terrain: 'wetland', danger: 0.3, resources: 0.5, adjacent: ['Endless Dunes', 'Canyon Shadows', 'The Palm Ruin'] },
            { name: 'Rocky Outcrop', terrain: 'highland', danger: 0.6, resources: 0.3, adjacent: ['The Cornucopia', 'Canyon Shadows', 'The Bone Road'] },
            { name: 'The Bone Road', terrain: 'ruins', danger: 0.55, resources: 0.25, adjacent: ['The Cornucopia', 'Rocky Outcrop', 'The Glass Sea'] },
            { name: 'The Glass Sea', terrain: 'open', danger: 0.85, resources: 0.05, adjacent: ['Endless Dunes', 'The Bone Road'] },
            { name: 'The Slot Canyon', terrain: 'ruins', danger: 0.5, resources: 0.35, adjacent: ['Canyon Shadows', 'The Seep'] },
            { name: 'The Palm Ruin', terrain: 'forest', danger: 0.35, resources: 0.7, adjacent: ['Dried Oasis', 'The Seep'] },
            { name: 'The Seep', terrain: 'water', danger: 0.45, resources: 0.6, adjacent: ['The Slot Canyon', 'The Palm Ruin'] },
        ]
    },
    {
        id: 'ashfall',
        name: 'The Ashfall Basin',
        description: 'A dead volcanic caldera under permanent grey snowfall. The ash coats the lungs, the ground is warm, and nothing green has grown here in a decade.',
        mutts: ['Cinder Hounds', 'Ash Wraiths', 'Glass-Shard Crows'],
        events: ['Ashfall Surge', 'Ground Fissure', 'Pyroclastic Gust'],
        zones: [
            { name: 'The Cornucopia (Caldera Floor)', terrain: 'open', danger: 0.6, resources: 0.25, adjacent: ['Cinder Fields', 'The Obsidian Maze', 'Sulphur Springs'] },
            { name: 'Cinder Fields', terrain: 'open', danger: 0.5, resources: 0.15, adjacent: ['The Cornucopia (Caldera Floor)', 'Ashen Woods', 'Sulphur Springs', 'The Scoria Slope'] },
            { name: 'Ashen Woods', terrain: 'forest', danger: 0.4, resources: 0.6, adjacent: ['Cinder Fields', 'The Obsidian Maze', 'The Fern Gully'] },
            { name: 'The Obsidian Maze', terrain: 'ruins', danger: 0.75, resources: 0.3, adjacent: ['The Cornucopia (Caldera Floor)', 'Ashen Woods', 'Magma Vents'] },
            { name: 'Sulphur Springs', terrain: 'water', danger: 0.55, resources: 0.5, adjacent: ['The Cornucopia (Caldera Floor)', 'Cinder Fields', 'Magma Vents'] },
            { name: 'Magma Vents', terrain: 'highland', danger: 0.9, resources: 0.1, adjacent: ['The Obsidian Maze', 'Sulphur Springs', 'The Rim Path'] },
            { name: 'The Scoria Slope', terrain: 'highland', danger: 0.7, resources: 0.1, adjacent: ['Cinder Fields', 'The Rim Path'] },
            { name: 'The Fern Gully', terrain: 'wetland', danger: 0.35, resources: 0.75, adjacent: ['Ashen Woods', 'The Steam Caves'] },
            { name: 'The Rim Path', terrain: 'highland', danger: 0.8, resources: 0.15, adjacent: ['Magma Vents', 'The Scoria Slope', 'The Steam Caves'] },
            { name: 'The Steam Caves', terrain: 'ruins', danger: 0.6, resources: 0.4, adjacent: ['The Fern Gully', 'The Rim Path'] },
        ]
    },
    {
        id: 'tempest',
        name: 'The Tempest Reach',
        description: 'A drowned coastline under a storm the Gamemakers refuse to switch off. The tide takes a different zone every night.',
        mutts: ['Squall Serpents', 'Barnacle Crabs', 'Drowned Gulls'],
        events: ['Storm Surge', 'Lightning Barrage', 'King Tide'],
        zones: [
            { name: 'The Cornucopia (Breakwater)', terrain: 'open', danger: 0.65, resources: 0.3, adjacent: ['Flooded Terraces', 'The Lighthouse', 'Kelp Shallows'] },
            { name: 'Flooded Terraces', terrain: 'wetland', danger: 0.5, resources: 0.6, adjacent: ['The Cornucopia (Breakwater)', 'Mangrove Sprawl', 'The Salt Marsh'] },
            { name: 'The Lighthouse', terrain: 'highland', danger: 0.7, resources: 0.2, adjacent: ['The Cornucopia (Breakwater)', 'Wreck Graveyard', 'The Cliff Stair'] },
            { name: 'Kelp Shallows', terrain: 'water', danger: 0.45, resources: 0.65, adjacent: ['The Cornucopia (Breakwater)', 'Mangrove Sprawl', 'Wreck Graveyard'] },
            { name: 'Mangrove Sprawl', terrain: 'forest', danger: 0.35, resources: 0.7, adjacent: ['Flooded Terraces', 'Kelp Shallows', 'The Boathouse'] },
            { name: 'Wreck Graveyard', terrain: 'ruins', danger: 0.8, resources: 0.4, adjacent: ['The Lighthouse', 'Kelp Shallows', 'The Tidal Cave'] },
            { name: 'The Salt Marsh', terrain: 'wetland', danger: 0.55, resources: 0.5, adjacent: ['Flooded Terraces', 'The Boathouse'] },
            { name: 'The Cliff Stair', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The Lighthouse', 'The Tidal Cave'] },
            { name: 'The Boathouse', terrain: 'ruins', danger: 0.4, resources: 0.55, adjacent: ['Mangrove Sprawl', 'The Salt Marsh'] },
            { name: 'The Tidal Cave', terrain: 'water', danger: 0.75, resources: 0.45, adjacent: ['Wreck Graveyard', 'The Cliff Stair'] },
        ]
    },
    {
        id: 'saltflats',
        name: 'The Salt Mirror',
        description: 'A dried inland sea of blinding white crust. There is nowhere to hide, the glare burns from below as well as above, and every horizon lies.',
        mutts: ['Brine Wolves', 'Salt Locusts', 'Mirage Stalkers'],
        events: ['Whiteout Glare', 'Crust Collapse', 'Brine Squall'],
        zones: [
            { name: 'The Cornucopia (Salt Pan)', terrain: 'open', danger: 0.6, resources: 0.2, adjacent: ['The Hexagon Flats', 'Brine Pools', 'The Boneyard'] },
            { name: 'The Hexagon Flats', terrain: 'open', danger: 0.7, resources: 0.05, adjacent: ['The Cornucopia (Salt Pan)', 'Crystal Spires', 'The Mirage Line'] },
            { name: 'Brine Pools', terrain: 'water', danger: 0.5, resources: 0.45, adjacent: ['The Cornucopia (Salt Pan)', 'The Boneyard', 'Crystal Spires'] },
            { name: 'The Boneyard', terrain: 'ruins', danger: 0.45, resources: 0.35, adjacent: ['The Cornucopia (Salt Pan)', 'Brine Pools', 'Scrub Hollow'] },
            { name: 'Crystal Spires', terrain: 'highland', danger: 0.8, resources: 0.15, adjacent: ['The Hexagon Flats', 'Brine Pools', 'The Evaporation Pans'] },
            { name: 'Scrub Hollow', terrain: 'forest', danger: 0.3, resources: 0.6, adjacent: ['The Boneyard', 'The Old Jetty'] },
            { name: 'The Mirage Line', terrain: 'open', danger: 0.85, resources: 0.05, adjacent: ['The Hexagon Flats', 'The Evaporation Pans'] },
            { name: 'The Evaporation Pans', terrain: 'water', danger: 0.55, resources: 0.4, adjacent: ['Crystal Spires', 'The Mirage Line', 'The Sink'] },
            { name: 'The Old Jetty', terrain: 'ruins', danger: 0.5, resources: 0.45, adjacent: ['Scrub Hollow', 'The Sink'] },
            { name: 'The Sink', terrain: 'wetland', danger: 0.65, resources: 0.5, adjacent: ['The Evaporation Pans', 'The Old Jetty'] },
        ]
    },
    {
        id: 'sporefields',
        name: 'The Spore Fields',
        description: 'A fungal forest grown for the occasion. Everything here is edible, and roughly half of it will kill you for trying.',
        mutts: ['Spore Moths', 'Mycelial Hounds', 'Puffball Swarms'],
        events: ['Spore Bloom', 'Collapsing Cap', 'Rot Sink'],
        zones: [
            { name: 'The Cornucopia (Ring of Caps)', terrain: 'open', danger: 0.55, resources: 0.4, adjacent: ['The Glowcap Wood', 'Rot Hollow', 'Mycelium Steps'] },
            { name: 'The Glowcap Wood', terrain: 'forest', danger: 0.4, resources: 0.85, adjacent: ['The Cornucopia (Ring of Caps)', 'Spore Marsh', 'The Shelf Terraces'] },
            { name: 'Rot Hollow', terrain: 'wetland', danger: 0.7, resources: 0.55, adjacent: ['The Cornucopia (Ring of Caps)', 'Spore Marsh', 'The Fruiting Body'] },
            { name: 'Mycelium Steps', terrain: 'highland', danger: 0.6, resources: 0.3, adjacent: ['The Cornucopia (Ring of Caps)', 'The Fruiting Body', 'The Blight Scar'] },
            { name: 'Spore Marsh', terrain: 'water', danger: 0.65, resources: 0.5, adjacent: ['The Glowcap Wood', 'Rot Hollow', 'The Cold Cellar'] },
            { name: 'The Fruiting Body', terrain: 'ruins', danger: 0.85, resources: 0.45, adjacent: ['Rot Hollow', 'Mycelium Steps'] },
            { name: 'The Shelf Terraces', terrain: 'highland', danger: 0.5, resources: 0.6, adjacent: ['The Glowcap Wood', 'The Blight Scar'] },
            { name: 'The Cold Cellar', terrain: 'ruins', danger: 0.35, resources: 0.7, adjacent: ['Spore Marsh', 'The Deadfall'] },
            { name: 'The Blight Scar', terrain: 'open', danger: 0.75, resources: 0.1, adjacent: ['Mycelium Steps', 'The Shelf Terraces', 'The Deadfall'] },
            { name: 'The Deadfall', terrain: 'forest', danger: 0.45, resources: 0.65, adjacent: ['The Cold Cellar', 'The Blight Scar'] },
        ]
    },
    {
        id: 'canopy',
        name: 'The Hanging Gardens',
        description: 'An arena built upward instead of outward. Every zone is a platform in a two-hundred-metre canopy, and the ground is not survivable.',
        mutts: ['Silk Spiders', 'Screech Primates', 'Thornvine Constrictors'],
        events: ['Rope Bridge Failure', 'Canopy Storm', 'Thornvine Snare'],
        zones: [
            { name: 'The Cornucopia (Great Bough)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['The Rope Bridges', 'Orchid Terraces', 'The Undercanopy'] },
            { name: 'The Rope Bridges', terrain: 'highland', danger: 0.8, resources: 0.15, adjacent: ['The Cornucopia (Great Bough)', 'The Crown', 'Orchid Terraces', 'The Strangler Fig'] },
            { name: 'Orchid Terraces', terrain: 'forest', danger: 0.35, resources: 0.8, adjacent: ['The Cornucopia (Great Bough)', 'The Rope Bridges', 'Cistern Hollows'] },
            { name: 'The Undercanopy', terrain: 'wetland', danger: 0.65, resources: 0.55, adjacent: ['The Cornucopia (Great Bough)', 'Cistern Hollows', 'The Root Cage'] },
            { name: 'Cistern Hollows', terrain: 'water', danger: 0.4, resources: 0.6, adjacent: ['Orchid Terraces', 'The Undercanopy', 'The Epiphyte Shelf'] },
            { name: 'The Crown', terrain: 'highland', danger: 0.85, resources: 0.2, adjacent: ['The Rope Bridges', 'The Wind Gap'] },
            { name: 'The Strangler Fig', terrain: 'ruins', danger: 0.7, resources: 0.4, adjacent: ['The Rope Bridges', 'The Wind Gap', 'The Root Cage'] },
            { name: 'The Root Cage', terrain: 'ruins', danger: 0.55, resources: 0.5, adjacent: ['The Undercanopy', 'The Strangler Fig'] },
            { name: 'The Epiphyte Shelf', terrain: 'forest', danger: 0.45, resources: 0.75, adjacent: ['Cistern Hollows', 'The Wind Gap'] },
            { name: 'The Wind Gap', terrain: 'open', danger: 0.75, resources: 0.15, adjacent: ['The Crown', 'The Strangler Fig', 'The Epiphyte Shelf'] },
        ]
    },
    {
        id: 'vault',
        name: 'The Vault',
        description: 'A sealed underground complex with no sky at all. The faces of the fallen are projected onto the ceiling, and the lights go out on a schedule nobody explains.',
        mutts: ['Pallid Stalkers', 'Rebar Hounds', 'Circuit Wasps'],
        events: ['Blackout', 'Flood Valve', 'Ceiling Collapse'],
        zones: [
            { name: 'The Cornucopia (Atrium)', terrain: 'open', danger: 0.65, resources: 0.3, adjacent: ['Service Tunnels', 'The Hydroponics Bay', 'Reactor Level'] },
            { name: 'Service Tunnels', terrain: 'ruins', danger: 0.7, resources: 0.25, adjacent: ['The Cornucopia (Atrium)', 'The Cistern', 'Dormitory Block', 'The Ventilation Shafts'] },
            { name: 'The Hydroponics Bay', terrain: 'forest', danger: 0.3, resources: 0.85, adjacent: ['The Cornucopia (Atrium)', 'The Cistern', 'The Seed Vault'] },
            { name: 'Reactor Level', terrain: 'highland', danger: 0.9, resources: 0.2, adjacent: ['The Cornucopia (Atrium)', 'Dormitory Block', 'The Turbine Hall'] },
            { name: 'The Cistern', terrain: 'water', danger: 0.5, resources: 0.5, adjacent: ['Service Tunnels', 'The Hydroponics Bay', 'The Sump'] },
            { name: 'Dormitory Block', terrain: 'ruins', danger: 0.4, resources: 0.4, adjacent: ['Service Tunnels', 'Reactor Level', 'The Commissary'] },
            { name: 'The Ventilation Shafts', terrain: 'highland', danger: 0.75, resources: 0.1, adjacent: ['Service Tunnels', 'The Turbine Hall'] },
            { name: 'The Seed Vault', terrain: 'ruins', danger: 0.35, resources: 0.7, adjacent: ['The Hydroponics Bay', 'The Commissary'] },
            { name: 'The Turbine Hall', terrain: 'ruins', danger: 0.8, resources: 0.3, adjacent: ['Reactor Level', 'The Ventilation Shafts', 'The Sump'] },
            { name: 'The Commissary', terrain: 'open', danger: 0.45, resources: 0.6, adjacent: ['Dormitory Block', 'The Seed Vault'] },
            { name: 'The Sump', terrain: 'water', danger: 0.7, resources: 0.35, adjacent: ['The Cistern', 'The Turbine Hall'] },
        ]
    }
];

/**
 * The reaping's trait pool. The definitions — and every effect — live in
 * `data/traits.ts`; this is the subset a tribute can be born with, which
 * excludes the traits that have to be earned in the arena.
 */
export const TRAITS = ROLLABLE_TRAITS;

/**
 * Traits that cannot sit on the same tribute.
 *
 * Nothing stopped the generator rolling a Pacifist Bloodthirsty Clumsy Nimble
 * tribute, which reads as a bug in the character sheet even before it produces
 * contradictory behaviour in the sim — a Pacifist who gets an aggression bonus
 * and a sanity penalty for the same kill.
 */
export const INCOMPATIBLE_TRAITS: Array<[string, string]> = [
    ['Pacifist', 'Bloodthirsty'],
    ['Pacifist', 'Brute'],
    ['Pacifist', 'Pyromaniac'],
    ['Pacifist', 'Ruthless'],
    ['Pacifist', 'Butcher'],
    ['Pacifist', 'Wrestler'],
    ['Clumsy', 'Nimble'],
    ['Clumsy', 'Eagle-Eyed'],
    ['Clumsy', 'Climber'],
    ['Clumsy', 'Fleet'],
    ['Clumsy', 'Marksman'],
    ['Insomniac', 'Light Sleeper'],
    ['Brute', 'Nimble'],
    ['Brute', 'Fleet'],
    ['Charismatic', 'Paranoid'],
    ['Charismatic', 'Unremarkable'],
    ['Strategist', 'Clumsy'],
    ['Iron Stomach', 'Hydrophilic'],
    // Added with the expanded pool: a trait table is only worth having if it
    // cannot produce a Stoic Fragile Loyal Treacherous tribute.
    ['Stoic', 'Fragile'],
    ['Cool-Headed', 'Skittish'],
    ['Loyal', 'Treacherous'],
    ['Ruthless', 'Softhearted'],
    ['Ruthless', 'Merciful'],
    ['Bloodthirsty', 'Softhearted'],
    ['Grim', 'Softhearted'],
    ['Grim', 'Fragile'],
    ['Pyromaniac', 'Fire-Shy'],
    ['Sun-Hardened', 'Fire-Shy'],
    ['Frost-Born', 'Sun-Hardened'],
    ['Showman', 'Unremarkable'],
    ['Silver-Tongued', 'Unremarkable'],
    ['Chameleon', 'Clumsy'],
    ['Hardy', 'Fragile'],
    ['Marksman', 'Wrestler'],
    ['Swimmer', 'Climber'],
];

export function traitsConflict(a: string, b: string): boolean {
    return INCOMPATIBLE_TRAITS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** True if `candidate` can join a trait list without contradicting it. */
export function traitFits(existing: string[], candidate: string): boolean {
    if (existing.includes(candidate)) return false;
    return !existing.some(t => traitsConflict(t, candidate));
}

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
    { id: 'water', name: 'Water Bottle', type: 'water', value: 20 , stack: 2 },
    { id: 'bread', name: 'Loaf of Bread', type: 'food', value: 15, spoilage: 3 , stack: 2 },
    { id: 'berries', name: 'Foraged Berries', type: 'food', value: 5, spoilage: 1 , stack: 2 },
    { id: 'dried-meat', name: 'Dried Meat', type: 'food', value: 20, spoilage: 6 , stack: 2 },
    { id: 'medkit', name: 'First Aid Kit', type: 'medical', value: 80 },
    { id: 'ointment', name: 'Burn Ointment', type: 'medical', value: 40 , stack: 2 },
    { id: 'antidote', name: 'Antidote Vial', type: 'medical', value: 60 },
    { id: 'rope', name: 'Rope', type: 'utility', value: 10 },
    { id: 'wire', name: 'Wire', type: 'utility', value: 15 },
    // Deliberately a utility, not a food: nightlock exists to be rendered down
    // and painted onto a blade, and a tribute must never absent-mindedly eat it
    // out of their own pack the way `consumeSupplies` eats anything of type 'food'.
    { id: 'nightlock', name: 'Nightlock Berries', type: 'utility', value: 12 },
    { id: 'matches', name: 'Matches', type: 'utility', value: 25 },
    { id: 'backpack', name: 'Backpack', type: 'utility', value: 30, capacity: 2 },

    // SIDE-01. The table was 23 items, 12 of them weapons that differed only in
    // damage, durability and class — no armour, no containers, no tools, no
    // light, no purification, and no sleeping bag, which is the most famous
    // parachute in the source material.
    { id: 'vest', name: 'Padded Vest', type: 'armour', value: 45, armour: 0.15, durability: 60, maxDurability: 60 },
    { id: 'bracers', name: 'Leather Bracers', type: 'armour', value: 30, armour: 0.08, durability: 70, maxDurability: 70 },
    { id: 'shield', name: 'Buckler', type: 'armour', value: 40, armour: 0.12, durability: 50, maxDurability: 50 },
    { id: 'sleeping-bag', name: 'Insulated Sleeping Bag', type: 'utility', value: 70, warmth: true },
    { id: 'lantern', name: 'Shielded Lantern', type: 'tool', value: 35, light: true },
    { id: 'tablets', name: 'Purification Tablets', type: 'medical', value: 50, purifies: true, stack: 3 },
    { id: 'net', name: 'Fishing Net', type: 'tool', value: 30, fishing: true },
    { id: 'satchel', name: 'Canvas Satchel', type: 'utility', value: 20, capacity: 1 },
    { id: 'whetstone', name: 'Whetstone', type: 'tool', value: 25, stack: 3 },
];

/**
 * Improvised weapons, craftable from the ground and a spare turn.
 *
 * Deliberately kept out of `ITEMS` so they never dilute the Cornucopia, the
 * feast or a sponsor parachute — nobody parachutes a sharpened rock. They exist
 * because only a third of living tributes were ever carrying a weapon, and an
 * unarmed tribute takes a 1.2-point penalty to the Aggressive stance score and
 * so effectively never picks a fight. A cudgel is barely a weapon; it is,
 * crucially, not nothing.
 */
export const IMPROVISED_ITEMS: Item[] = [
    { id: 'club', name: 'Cudgel', type: 'weapon', value: 8, durability: 35, weaponClass: 'melee', damage: 2 },
    { id: 'sharpstone', name: 'Sharpened Stone', type: 'weapon', value: 6, durability: 25, weaponClass: 'melee', damage: 1 },
];
