import { Arena, Item, GameConfig, Build } from '../models/types';
import { ROLLABLE_TRAITS } from './traits';

export const DEFAULT_GAME_CONFIG: GameConfig = {
    districtCount: 12,
    hazardRate: 1.0,
    betrayalRate: 1.0,
    sponsorGenerosity: 1.0,
    enableFeast: true,
    enableSanity: true,
    plainNames: false,
};

export const BUILDS: Build[] = ['Frail', 'Slight', 'Average', 'Athletic', 'Stocky', 'Muscular'];

/**
 * §Special requests: the arenas a brand-new account can pick from.
 *
 * Every other hand-authored arena unlocks the first time the player actually
 * plays it — which `panem.arenasSeen` has always recorded, for the "New to
 * you" badge. Inverting that badge into a gate needs no new plumbing and no
 * new storage key, and because `clearPanem` already wipes `arenasSeen`,
 * "resetting Panem loses your unlocks" falls out for free.
 *
 * The sealed draw ("Random Arena (Hidden)") is never gated: it is the way a
 * player reaches the arenas they have not unlocked yet, so the roster can
 * always grow. Locked arenas are shown, not hidden — a player should be able
 * to see what is out there.
 */
export const STARTER_ARENA_IDS: readonly string[] = [
    'clockwork', 'frozen', 'concrete', 'toxic', 'solar', 'ashfall',
] as const;

export const ARENAS: Arena[] = [
    {
        id: 'clockwork',
        name: 'The Clockwork Island',
        description: 'A shifting map layout divided into sectors, each unleashing a different horror at a specific hour.',
        mutts: ['Tick-Tock Monkeys', 'Lightning Birds', 'Acid Fog', 'Jabberjays', 'Reef Barracuda'],
        events: ['Sector Shift', 'Blood Rain', 'Tidal Wave'],
        law: 'cornucopiaRefills',
        // The climb to the Lightning Tree is a scramble up bare rock with a
        // storm generator at the top of it.
        edgeRules: { 'Sector 3 (Cliffs)|Sector 5 (Lightning Tree)': { kind: 'tolled', toll: { fatigue: 6 } } },
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
        mutts: ['Ice Wolves', 'Snow Camouflage Snakes', 'Frostbite Beetles', 'Snowblind Owls'],
        events: ['Blizzard', 'Avalanche', 'Thin Ice Collapse'],
        sponsorMultiplier: 1.2,
        // A freeze here is the arena doing what it was built for.
        effectVocab: { frozen: { label: 'a blizzard whiteout', severityMult: 1.2 } },
        edgeRules: { 'Frozen Lake|The Meltwater Channel': { kind: 'timeGated', gatedTime: 'day' } },
        zones: [
            { name: 'The Cornucopia', terrain: 'open', danger: 0.5, resources: 0.3, adjacent: ['Frozen Lake', 'Snowy Pine Forest', 'The Windbreak'] },
            { name: 'Frozen Lake', terrain: 'water', danger: 0.7, resources: 0.4, adjacent: ['The Cornucopia', 'Ice Caves', 'The Meltwater Channel'] },
            { name: 'Ice Caves', terrain: 'ruins', danger: 0.4, resources: 0.2, adjacent: ['Frozen Lake', 'Glacier Peak', 'The Crevasse Field'] },
            // The one real larder in a starving map — the doc's terrain-skew
            // note for this arena raises the forest resource ceiling to 0.9.
            { name: 'Snowy Pine Forest', terrain: 'forest', danger: 0.3, resources: 0.85, adjacent: ['The Cornucopia', 'Glacier Peak', 'The Trapper\'s Cabin'] },
            { name: 'Glacier Peak', terrain: 'highland', danger: 0.8, resources: 0.1, adjacent: ['Ice Caves', 'Snowy Pine Forest', 'The Crevasse Field'] },
            { name: 'The Windbreak', terrain: 'open', danger: 0.55, resources: 0.15, adjacent: ['The Cornucopia', 'The Trapper\'s Cabin', 'The Meltwater Channel'] },
            { name: 'The Trapper\'s Cabin', terrain: 'ruins', danger: 0.35, resources: 0.55, adjacent: ['Snowy Pine Forest', 'The Windbreak', 'Buried Timberline'] },
            { name: 'The Crevasse Field', terrain: 'highland', danger: 0.9, resources: 0.05, adjacent: ['Ice Caves', 'Glacier Peak'] },
            { name: 'The Meltwater Channel', terrain: 'water', danger: 0.6, resources: 0.5, adjacent: ['Frozen Lake', 'The Windbreak', 'Buried Timberline'] },
            { name: 'Buried Timberline', terrain: 'forest', danger: 0.45, resources: 0.8, adjacent: ['The Trapper\'s Cabin', 'The Meltwater Channel'] },
        ]
    },
    {
        id: 'concrete',
        name: 'The Concrete Jungle',
        description: 'An abandoned, decaying metropolis. Verticality and structural collapses are constant threats.',
        mutts: ['Steel-jawed Rats', 'Glass-winged Bats', 'Feral Tracker Jackers', 'Sewer Eels'],
        events: ['Building Collapse', 'Sewer Flooding', 'Live Wire Trap'],
        // Structural collapse risk, not weather — every highland zone here
        // sits in the 0.85-0.95 band city-wide.
        edgeRules: {
            'Skyscraper Ruins|The Cornucopia (City Square)': { kind: 'tolled', toll: { fatigue: 6 } },
            'The Clocktower|The Rail Yard': { kind: 'tolled', toll: { fatigue: 6 } },
        },
        // §5.5: widened to thirteen zones — a metropolis should sprawl, with
        // whole districts a tribute can vanish into for days.
        zones: [
            { name: 'The Cornucopia (City Square)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['Abandoned Subway', 'Skyscraper Ruins', 'Overgrown Park', 'The Flooded Underpass'] },
            { name: 'Abandoned Subway', terrain: 'ruins', danger: 0.7, resources: 0.3, adjacent: ['The Cornucopia (City Square)', 'Industrial District', 'The Flooded Underpass', 'The Storm Drains'] },
            { name: 'Skyscraper Ruins', terrain: 'highland', danger: 0.85, resources: 0.4, adjacent: ['The Cornucopia (City Square)', 'Industrial District', 'The Rooftop Gardens'] },
            { name: 'Overgrown Park', terrain: 'forest', danger: 0.3, resources: 0.7, adjacent: ['The Cornucopia (City Square)', 'Industrial District', 'The Reservoir'] },
            { name: 'Industrial District', terrain: 'ruins', danger: 0.6, resources: 0.4, adjacent: ['Abandoned Subway', 'Skyscraper Ruins', 'Overgrown Park', 'The Rail Yard'] },
            { name: 'The Flooded Underpass', terrain: 'water', danger: 0.65, resources: 0.35, adjacent: ['The Cornucopia (City Square)', 'Abandoned Subway', 'The Reservoir', 'The Storm Drains'] },
            { name: 'The Rooftop Gardens', terrain: 'forest', danger: 0.45, resources: 0.65, adjacent: ['Skyscraper Ruins', 'The Rail Yard', 'The Botanical Atrium'] },
            { name: 'The Reservoir', terrain: 'water', danger: 0.4, resources: 0.6, adjacent: ['Overgrown Park', 'The Flooded Underpass', 'The Botanical Atrium'] },
            { name: 'The Rail Yard', terrain: 'open', danger: 0.55, resources: 0.25, adjacent: ['Industrial District', 'The Rooftop Gardens', 'The Clocktower', 'The Collapsed Overpass'] },
            // The outer districts: a shattered ring road, a glasshouse gone
            // feral, and the storm sewers under everything.
            { name: 'The Collapsed Overpass', terrain: 'highland', danger: 0.75, resources: 0.2, adjacent: ['The Rail Yard', 'The Storm Drains'] },
            { name: 'The Botanical Atrium', terrain: 'forest', danger: 0.35, resources: 0.75, adjacent: ['The Rooftop Gardens', 'The Reservoir'] },
            { name: 'The Storm Drains', terrain: 'wetland', danger: 0.6, resources: 0.35, adjacent: ['Abandoned Subway', 'The Flooded Underpass', 'The Collapsed Overpass'] },
            // A dead end (one edge) and a pure ambush zone by design — high
            // danger, kept low on resources so it's never worth the risk as bait.
            { name: 'The Clocktower', terrain: 'highland', danger: 0.9, resources: 0.15, adjacent: ['The Rail Yard'] },
        ]
    },
    {
        id: 'toxic',
        name: 'The Toxic Swamps',
        description: 'Hallucinogenic gas and poison risk. The water is mostly undrinkable without purification.',
        mutts: ['Venomous Toads', 'Leech Swarms', 'Camouflaged Crocodiles', 'Bloatflies'],
        events: ['Hallucinogenic Spores', 'Methane Explosion', 'Quicksand Sinkhole'],
        // The gas is this arena's whole premise — contamination hits harder
        // and hangs around longer here than anywhere.
        effectVocab: { contaminated: { label: 'a methane bloom off the bog', severityMult: 1.2, durationMult: 1.25 } },
        // The bog crossing is only readable while there is light to read it by.
        edgeRules: { 'Glowing Bog|Murky Waters': { kind: 'timeGated', gatedTime: 'day' } },
        // §5.5: trimmed to eight zones — a tight, claustrophobic swamp rather
        // than another ten-zone standard shape.
        zones: [
            { name: 'The Cornucopia', terrain: 'open', danger: 0.5, resources: 0.3, adjacent: ['Murky Waters', 'Dead Tree Grove', 'The Causeway'] },
            // Undrinkable and barely worth foraging — the danger carries this
            // terrain here, not the resources.
            { name: 'Murky Waters', terrain: 'water', danger: 0.7, resources: 0.15, adjacent: ['The Cornucopia', 'Glowing Bog', 'The Reed Maze'] },
            { name: 'Dead Tree Grove', terrain: 'forest', danger: 0.4, resources: 0.5, adjacent: ['The Cornucopia', 'Ruined Shacks', 'The Cypress Stand'] },
            { name: 'Glowing Bog', terrain: 'wetland', danger: 0.8, resources: 0.6, adjacent: ['Murky Waters', 'Ruined Shacks'] },
            { name: 'Ruined Shacks', terrain: 'ruins', danger: 0.3, resources: 0.4, adjacent: ['Dead Tree Grove', 'Glowing Bog'] },
            { name: 'The Causeway', terrain: 'open', danger: 0.55, resources: 0.2, adjacent: ['The Cornucopia', 'The Reed Maze', 'The Cypress Stand'] },
            { name: 'The Reed Maze', terrain: 'wetland', danger: 0.6, resources: 0.55, adjacent: ['Murky Waters', 'The Causeway'] },
            { name: 'The Cypress Stand', terrain: 'forest', danger: 0.35, resources: 0.75, adjacent: ['Dead Tree Grove', 'The Causeway'] },
        ]
    },
    {
        id: 'solar',
        name: 'The Solar Desert',
        description: 'Extreme heat, severe water scarcity, and deadly solar flares. Shade is a premium.',
        mutts: ['Sand Vipers', 'Mirage Scorpions', 'Burrowing Centipedes', 'Glass Hawks'],
        events: ['Solar Flare', 'Sandstorm', 'Oasis Mirage'],
        law: 'noNight',
        sponsorMultiplier: 0.85,
        edgeRules: { 'Canyon Shadows|The Slot Canyon': { kind: 'timeGated', gatedTime: 'day' } },
        // Under a sun that never sets, a fire is a flare — fierce and brief.
        effectVocab: { burning: { label: 'a solar-flare firestorm', severityMult: 1.25, durationMult: 0.75 } },
        zones: [
            { name: 'The Cornucopia', terrain: 'open', danger: 0.5, resources: 0.3, adjacent: ['Endless Dunes', 'Rocky Outcrop', 'The Bone Road'] },
            { name: 'Endless Dunes', terrain: 'open', danger: 0.7, resources: 0.05, adjacent: ['The Cornucopia', 'Dried Oasis', 'The Glass Sea'] },
            { name: 'Canyon Shadows', terrain: 'highland', danger: 0.4, resources: 0.4, adjacent: ['Dried Oasis', 'Rocky Outcrop', 'The Slot Canyon'] },
            { name: 'Dried Oasis', terrain: 'wetland', danger: 0.3, resources: 0.65, adjacent: ['Endless Dunes', 'Canyon Shadows', 'The Palm Ruin'] },
            { name: 'Rocky Outcrop', terrain: 'highland', danger: 0.6, resources: 0.3, adjacent: ['The Cornucopia', 'Canyon Shadows', 'The Bone Road'] },
            { name: 'The Bone Road', terrain: 'ruins', danger: 0.55, resources: 0.25, adjacent: ['The Cornucopia', 'Rocky Outcrop', 'The Glass Sea'] },
            { name: 'The Glass Sea', terrain: 'open', danger: 0.85, resources: 0.05, adjacent: ['Endless Dunes', 'The Bone Road'] },
            { name: 'The Slot Canyon', terrain: 'ruins', danger: 0.5, resources: 0.35, adjacent: ['Canyon Shadows', 'The Seep'] },
            { name: 'The Palm Ruin', terrain: 'forest', danger: 0.35, resources: 0.7, adjacent: ['Dried Oasis', 'The Seep'] },
            { name: 'The Seep', terrain: 'water', danger: 0.45, resources: 0.7, adjacent: ['The Slot Canyon', 'The Palm Ruin'] },
        ]
    },
    {
        id: 'ashfall',
        name: 'The Ashfall Basin',
        description: 'A dead volcanic caldera under permanent grey snowfall. The ash coats the lungs, the ground is warm, and nothing green has grown here in a decade.',
        mutts: ['Cinder Hounds', 'Ash Wraiths', 'Glass-Shard Crows', 'Ember Moths'],
        events: ['Ashfall Surge', 'Ground Fissure', 'Pyroclastic Gust'],
        // A one-way descent — no route back up without a rope.
        edgeRules: { 'Magma Vents|The Rim Path': { kind: 'oneWay', from: 'Magma Vents', to: 'The Rim Path' } },
        // Fire here comes off the mountain, and the ash swallows what light there is.
        effectVocab: {
            burning: { label: 'a pyroclastic gust', severityMult: 1.3, durationMult: 0.7 },
            fogbound: { label: 'an ash whiteout' },
        },
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
        mutts: ['Squall Serpents', 'Barnacle Crabs', 'Drowned Gulls', 'Surge Eels'],
        events: ['Storm Surge', 'Lightning Barrage', 'King Tide'],
        sponsorMultiplier: 1.15,
        // Flooding here is the storm's own escalation, not an accident.
        effectVocab: { flooded: { label: 'a storm surge', severityMult: 1.25 } },
        // The stair is cut into wet rock in a permanent gale.
        edgeRules: { 'The Cliff Stair|The Lighthouse': { kind: 'tolled', toll: { fatigue: 7 } } },
        // §5.5: widened to thirteen zones — a drowned coastline should feel
        // like a coastline, with room to lose someone along it.
        zones: [
            { name: 'The Cornucopia (Breakwater)', terrain: 'open', danger: 0.65, resources: 0.3, adjacent: ['Flooded Terraces', 'The Lighthouse', 'Kelp Shallows'] },
            { name: 'Flooded Terraces', terrain: 'wetland', danger: 0.5, resources: 0.6, adjacent: ['The Cornucopia (Breakwater)', 'Mangrove Sprawl', 'The Salt Marsh', 'The Storm Barrens'] },
            { name: 'The Lighthouse', terrain: 'highland', danger: 0.7, resources: 0.2, adjacent: ['The Cornucopia (Breakwater)', 'Wreck Graveyard', 'The Cliff Stair'] },
            { name: 'Kelp Shallows', terrain: 'water', danger: 0.45, resources: 0.65, adjacent: ['The Cornucopia (Breakwater)', 'Mangrove Sprawl', 'Wreck Graveyard'] },
            { name: 'Mangrove Sprawl', terrain: 'forest', danger: 0.35, resources: 0.7, adjacent: ['Flooded Terraces', 'Kelp Shallows', 'The Boathouse', 'The Storm Barrens'] },
            { name: 'Wreck Graveyard', terrain: 'ruins', danger: 0.8, resources: 0.4, adjacent: ['The Lighthouse', 'Kelp Shallows', 'The Tidal Cave'] },
            { name: 'The Salt Marsh', terrain: 'wetland', danger: 0.55, resources: 0.5, adjacent: ['Flooded Terraces', 'The Boathouse', 'The Drowned Quarter'] },
            { name: 'The Cliff Stair', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The Lighthouse', 'The Tidal Cave', 'The Gull Roost'] },
            { name: 'The Boathouse', terrain: 'ruins', danger: 0.4, resources: 0.55, adjacent: ['Mangrove Sprawl', 'The Salt Marsh', 'The Drowned Quarter'] },
            { name: 'The Tidal Cave', terrain: 'water', danger: 0.75, resources: 0.45, adjacent: ['Wreck Graveyard', 'The Cliff Stair', 'The Gull Roost'] },
            // The far end of the coast: a drowned town, a bare headland, and
            // the one high roost the storm never quite reaches.
            { name: 'The Drowned Quarter', terrain: 'ruins', danger: 0.6, resources: 0.5, adjacent: ['The Salt Marsh', 'The Boathouse'] },
            { name: 'The Storm Barrens', terrain: 'open', danger: 0.7, resources: 0.15, adjacent: ['Flooded Terraces', 'Mangrove Sprawl'] },
            { name: 'The Gull Roost', terrain: 'highland', danger: 0.55, resources: 0.35, adjacent: ['The Cliff Stair', 'The Tidal Cave'] },
        ]
    },
    {
        id: 'saltflats',
        name: 'The Salt Mirror',
        description: 'A dried inland sea of blinding white crust. There is nowhere to hide, the glare burns from below as well as above, and every horizon lies.',
        mutts: ['Brine Wolves', 'Salt Locusts', 'Mirage Stalkers'],
        events: ['Whiteout Glare', 'Crust Collapse', 'Brine Squall'],
        // Total visibility means the Capitol sees every gift land and every
        // desperate scramble for it — this arena's spectacle.
        sponsorMultiplier: 1.3,
        // The slog across the open crust: no shade, no cover, glare from below.
        edgeRules: { 'The Cornucopia (Salt Pan)|The Hexagon Flats': { kind: 'tolled', toll: { fatigue: 6 } } },
        // §5.5: trimmed to seven zones. A dried sea with nowhere to hide reads
        // truest as a small, merciless map where everyone can see everyone.
        zones: [
            { name: 'The Cornucopia (Salt Pan)', terrain: 'open', danger: 0.6, resources: 0.2, adjacent: ['The Hexagon Flats', 'Brine Pools', 'The Boneyard'] },
            { name: 'The Hexagon Flats', terrain: 'open', danger: 0.7, resources: 0.05, adjacent: ['The Cornucopia (Salt Pan)', 'Crystal Spires'] },
            { name: 'Brine Pools', terrain: 'water', danger: 0.5, resources: 0.45, adjacent: ['The Cornucopia (Salt Pan)', 'The Boneyard', 'Crystal Spires'] },
            { name: 'The Boneyard', terrain: 'ruins', danger: 0.45, resources: 0.35, adjacent: ['The Cornucopia (Salt Pan)', 'Brine Pools', 'Scrub Hollow'] },
            { name: 'Crystal Spires', terrain: 'highland', danger: 0.8, resources: 0.15, adjacent: ['The Hexagon Flats', 'Brine Pools', 'The Evaporation Pans'] },
            { name: 'Scrub Hollow', terrain: 'forest', danger: 0.3, resources: 0.6, adjacent: ['The Boneyard', 'The Evaporation Pans'] },
            { name: 'The Evaporation Pans', terrain: 'water', danger: 0.55, resources: 0.4, adjacent: ['Crystal Spires', 'Scrub Hollow'] },
        ]
    },
    {
        id: 'sporefields',
        name: 'The Spore Fields',
        description: 'A fungal forest grown for the occasion. Everything here is edible, and roughly half of it will kill you for trying.',
        mutts: ['Spore Moths', 'Mycelial Hounds', 'Puffball Swarms', 'Cordyceps Ticks'],
        events: ['Spore Bloom', 'Collapsing Cap', 'Rot Sink'],
        law: 'sponsorsFixedZone',
        lawZone: 'The Cornucopia (Ring of Caps)',
        // Nobody's visibly starving in a forest where everything is
        // technically food, so sponsor interest runs low on top of the law
        // above — until someone gets poisoned.
        sponsorMultiplier: 0.8,
        // Contamination here is the forest doing what it grew to do.
        effectVocab: { contaminated: { label: 'a spore bloom', durationMult: 1.25 } },
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
        mutts: ['Silk Spiders', 'Screech Primates', 'Thornvine Constrictors', 'Needle Hornets', 'Bough Vipers'],
        events: ['Rope Bridge Failure', 'Canopy Storm', 'Thornvine Snare'],
        // Climbing platforms costs fatigue on top of ordinary travel — this
        // is a baseline rule, not just something the signature's bridge cuts add.
        edgeRules: {
            'The Cornucopia (Great Bough)|The Rope Bridges': { kind: 'tolled', toll: { fatigue: 8 } },
            // §11.6: the climb to the Crown takes real time as well as sweat.
            'The Crown|The Rope Bridges': { kind: 'tolled', toll: { fatigue: 8, timeCost: 1 } },
        },
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
        mutts: ['Pallid Stalkers', 'Rebar Hounds', 'Circuit Wasps', 'Sump Eels'],
        events: ['Blackout', 'Flood Valve', 'Ceiling Collapse'],
        law: 'noCannons',
        // §5.1: the Vault is the arena that proves laws stack. No cannon, and
        // nothing gets down here from the Capitol either — the sponsor
        // multiplier was flavour text for a blackout it could not declare.
        laws: ['noSponsors'],
        // No route around the reactor core.
        edgeRules: { 'Reactor Level|The Turbine Hall': { kind: 'tolled', toll: { fatigue: 5, woundChance: 0.12 } } },
        // Down here the dark is a schedule and the water arrives by valve.
        effectVocab: {
            fogbound: { label: 'a rolling blackout', durationMult: 1.5 },
            flooded: { label: 'a flood-valve release' },
        },
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
    },
    {
        // §8.3: deliberately a different shape — six zones, no water terrain
        // at all, and the smallest bestiary in the game: one apex predator and
        // the mine's own rats. Claustrophobia as a design, not a smaller copy.
        id: 'warren',
        name: 'The Warren',
        description: 'A mine that was old before Panem was young: six chambers of tunnel and dust, no open sky, and no standing water anywhere. Everything a tribute drinks down here, somebody carried in. And something else lives in the dark.',
        mutts: ['The Warden', 'Pit Rats'],
        events: ['Tunnel Collapse', 'Bad Air', 'The Shifting'],
        // No `lawZone` is deliberate: there is no exception, nowhere down
        // here has water at all — see the description above.
        law: 'noWaterExceptZone',
        zones: [
            { name: 'The Cornucopia (The Hub)', terrain: 'open', danger: 0.6, resources: 0.45, adjacent: ['The Choke', 'The Root Gardens', 'The Dust Flats'] },
            { name: 'The Choke', terrain: 'ruins', danger: 0.8, resources: 0.2, adjacent: ['The Cornucopia (The Hub)', 'The Old Workings', 'The Collapsed Galleries'] },
            // The only reliable food source in a six-zone map with no water
            // anywhere — worth pushing higher than any other arena's forest.
            { name: 'The Root Gardens', terrain: 'forest', danger: 0.3, resources: 0.92, adjacent: ['The Cornucopia (The Hub)', 'The Collapsed Galleries'] },
            { name: 'The Dust Flats', terrain: 'open', danger: 0.45, resources: 0.3, adjacent: ['The Cornucopia (The Hub)', 'The Old Workings'] },
            { name: 'The Old Workings', terrain: 'highland', danger: 0.7, resources: 0.35, adjacent: ['The Choke', 'The Dust Flats'] },
            { name: 'The Collapsed Galleries', terrain: 'ruins', danger: 0.65, resources: 0.5, adjacent: ['The Choke', 'The Root Gardens'] },
        ]
    },
    {
        id: 'islands',
        name: 'The Shattered Archipelago',
        description: 'Micro-islands adrift in a sea of thick magnetic fog, joined by swaying rope bridges and zip-lines. Compasses spin, the fog below has never been surveyed, and a cut rope is a border redrawn.',
        mutts: ['Lodestone Gulls', 'Fogline Eels', 'The Ferryman', 'Rust Mites'],
        events: ['Bridge Failure', 'Magnetic Squall', 'The Fog Rises'],
        // Nobody crosses the great bridge blind: after dark the fog owns it.
        edgeRules: { 'The Cornucopia (Anchor Isle)|The Long Span': { kind: 'timeGated', gatedTime: 'day' } },
        zones: [
            { name: 'The Cornucopia (Anchor Isle)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['The Long Span', 'The Fog Shallows', 'The Orchard Isle'] },
            { name: 'The Long Span', terrain: 'open', danger: 0.75, resources: 0.1, adjacent: ['The Cornucopia (Anchor Isle)', 'Lodestone Crag', 'Gullrock'], features: { cover: 0.05, elevation: true, chokepoint: true } },
            { name: 'The Fog Shallows', terrain: 'water', danger: 0.7, resources: 0.4, adjacent: ['The Cornucopia (Anchor Isle)', 'The Reed Islet', 'The Wreck of the Ferry'] },
            { name: 'The Orchard Isle', terrain: 'forest', danger: 0.3, resources: 0.8, adjacent: ['The Cornucopia (Anchor Isle)', 'Gullrock', 'The Reed Islet'] },
            { name: 'Gullrock', terrain: 'highland', danger: 0.55, resources: 0.35, adjacent: ['The Long Span', 'The Orchard Isle', 'The Tilting Isle'] },
            { name: 'Lodestone Crag', terrain: 'highland', danger: 0.85, resources: 0.15, adjacent: ['The Long Span', 'The Compass Rose'] },
            { name: 'The Reed Islet', terrain: 'wetland', danger: 0.45, resources: 0.6, adjacent: ['The Fog Shallows', 'The Orchard Isle', 'The Wreck of the Ferry'] },
            { name: 'The Wreck of the Ferry', terrain: 'ruins', danger: 0.65, resources: 0.5, adjacent: ['The Fog Shallows', 'The Reed Islet', 'The Compass Rose'] },
            { name: 'The Tilting Isle', terrain: 'open', danger: 0.7, resources: 0.2, adjacent: ['Gullrock', 'The Compass Rose'] },
            { name: 'The Compass Rose', terrain: 'ruins', danger: 0.6, resources: 0.4, adjacent: ['Lodestone Crag', 'The Wreck of the Ferry', 'The Tilting Isle'] },
        ]
    },
    {
        id: 'eclipse',
        name: 'The Perpetual Eclipse Forest',
        description: 'An ancient redwood forest locked in permanent dusk, lit only by glowing fungi, fiery pitch-vents and a ceiling of artificial stars that do not stay still. Nothing here waits for nightfall, because nightfall never quite comes.',
        mutts: ['Duskwing Owls', 'Pitch Hounds', 'Lantern Beetles', 'The Understory', 'Star Moths'],
        events: ['Star Shift', 'Pitch-Vent Flare', 'Fungal Bloom'],
        // Poor visibility for cameras, similar to the Vault but less severe.
        sponsorMultiplier: 0.9,
        zones: [
            { name: 'The Cornucopia (Clearing of Stars)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['The Redwood Naves', 'Foxfire Creek', 'The Pitch-Vents'] },
            { name: 'The Redwood Naves', terrain: 'forest', danger: 0.4, resources: 0.65, adjacent: ['The Cornucopia (Clearing of Stars)', 'The Glowcap Hollow', 'The Fallen Giant'], features: { cover: 0.9, elevation: false, chokepoint: false } },
            { name: 'Foxfire Creek', terrain: 'water', danger: 0.35, resources: 0.55, adjacent: ['The Cornucopia (Clearing of Stars)', 'The Duskmoss Flats', 'The Glowcap Hollow'] },
            { name: 'The Pitch-Vents', terrain: 'highland', danger: 0.85, resources: 0.15, adjacent: ['The Cornucopia (Clearing of Stars)', 'The Star Gantries', 'The Charcoal Grove'] },
            { name: 'The Glowcap Hollow', terrain: 'forest', danger: 0.45, resources: 0.8, adjacent: ['The Redwood Naves', 'Foxfire Creek', 'The Duskmoss Flats'], features: { cover: 0.85, elevation: false, chokepoint: false } },
            { name: 'The Duskmoss Flats', terrain: 'wetland', danger: 0.5, resources: 0.6, adjacent: ['Foxfire Creek', 'The Glowcap Hollow', 'The Dark Meander'] },
            { name: 'The Fallen Giant', terrain: 'ruins', danger: 0.55, resources: 0.45, adjacent: ['The Redwood Naves', 'The Charcoal Grove', 'The Star Gantries'] },
            { name: 'The Charcoal Grove', terrain: 'forest', danger: 0.65, resources: 0.35, adjacent: ['The Pitch-Vents', 'The Fallen Giant'] },
            { name: 'The Star Gantries', terrain: 'highland', danger: 0.75, resources: 0.2, adjacent: ['The Pitch-Vents', 'The Fallen Giant', 'The Dark Meander'] },
            { name: 'The Dark Meander', terrain: 'water', danger: 0.6, resources: 0.5, adjacent: ['The Duskmoss Flats', 'The Star Gantries'] },
        ]
    },
    {
        id: 'reef',
        name: 'The Dead Coral Reef',
        description: 'A drained ocean floor, bleach-white and razor-edged: fossilised coral heads, deep dry trenches, and vast fields of anemones that did not die when the water left. Everything sharp, nothing soft, and the only water is brine.',
        mutts: ['Trench Morays', 'Anemone Colonies', 'Bonefish Swarms', 'The Dry Shark'],
        events: ['Coral Collapse', 'Anemone Bloom', 'Trench Wind'],
        law: 'fireImpossible',
        // §5.1: no fire, no fresh water, and nothing that cuts on coral heals
        // clean. The reef is the no-healing arena — rest is the only medicine.
        laws: ['noHealing'],
        zones: [
            { name: 'The Cornucopia (Drained Basin)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['The Coral Razors', 'The Urchin Barrens', 'The Dry Kelp Forest'] },
            { name: 'The Coral Razors', terrain: 'ruins', danger: 0.8, resources: 0.25, adjacent: ['The Cornucopia (Drained Basin)', 'The Shelf Break', 'The Anemone Fields'] },
            { name: 'The Urchin Barrens', terrain: 'open', danger: 0.6, resources: 0.2, adjacent: ['The Cornucopia (Drained Basin)', 'The Tidepool Terraces', 'The Brine Sumps'] },
            { name: 'The Dry Kelp Forest', terrain: 'forest', danger: 0.35, resources: 0.6, adjacent: ['The Cornucopia (Drained Basin)', 'The Anemone Fields', 'The Tidepool Terraces'] },
            { name: 'The Anemone Fields', terrain: 'wetland', danger: 0.75, resources: 0.5, adjacent: ['The Coral Razors', 'The Dry Kelp Forest', 'The Whale Fall'] },
            { name: 'The Shelf Break', terrain: 'highland', danger: 0.7, resources: 0.2, adjacent: ['The Coral Razors', 'The Great Trench'] },
            { name: 'The Tidepool Terraces', terrain: 'wetland', danger: 0.4, resources: 0.65, adjacent: ['The Urchin Barrens', 'The Dry Kelp Forest'] },
            { name: 'The Brine Sumps', terrain: 'water', danger: 0.5, resources: 0.4, adjacent: ['The Urchin Barrens', 'The Great Trench'] },
            { name: 'The Great Trench', terrain: 'water', danger: 0.9, resources: 0.4, adjacent: ['The Shelf Break', 'The Brine Sumps', 'The Whale Fall'], features: { cover: 0.6, elevation: false, chokepoint: true } },
            { name: 'The Whale Fall', terrain: 'ruins', danger: 0.5, resources: 0.55, adjacent: ['The Anemone Fields', 'The Great Trench'] },
        ]
    },
    {
        id: 'abattoir',
        name: 'The Industrial Abattoir',
        description: 'A multi-level automated factory that never fully shut down: rust-seized gears the size of rooms, conveyor lines that still run, crushing pistons on a schedule, and furnace halls that have not been cold in living memory.',
        mutts: ['Hook Apes', 'Scald Rats', 'The Line Boss', 'Grinder Beetles'],
        events: ['The Line Starts', 'Furnace Backdraft', 'Piston Cycle'],
        // Visually the most "watchable" arena — the Capitol likes the machinery.
        sponsorMultiplier: 1.1,
        // Fire in here comes out of a furnace door, not a lightning strike.
        effectVocab: { burning: { label: 'a furnace backdraft', severityMult: 1.2 } },
        zones: [
            { name: 'The Cornucopia (Kill Floor)', terrain: 'open', danger: 0.65, resources: 0.35, adjacent: ['The Conveyor Deck', 'The Gear Gallery', 'The Coolant Vats'] },
            { name: 'The Conveyor Deck', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['The Cornucopia (Kill Floor)', 'The Piston Hall', 'The Catwalks'] },
            { name: 'The Gear Gallery', terrain: 'ruins', danger: 0.7, resources: 0.4, adjacent: ['The Cornucopia (Kill Floor)', 'The Piston Hall', 'The Feed Lofts'] },
            { name: 'The Coolant Vats', terrain: 'water', danger: 0.5, resources: 0.45, adjacent: ['The Cornucopia (Kill Floor)', 'The Rendering Pits', 'The Feed Lofts'] },
            { name: 'The Piston Hall', terrain: 'ruins', danger: 0.85, resources: 0.2, adjacent: ['The Conveyor Deck', 'The Gear Gallery', 'Furnace Row'], features: { cover: 0.3, elevation: false, chokepoint: true } },
            { name: 'The Catwalks', terrain: 'highland', danger: 0.75, resources: 0.15, adjacent: ['The Conveyor Deck', 'Furnace Row'] },
            { name: 'The Feed Lofts', terrain: 'forest', danger: 0.3, resources: 0.75, adjacent: ['The Gear Gallery', 'The Coolant Vats', 'The Rendering Pits'] },
            { name: 'The Rendering Pits', terrain: 'wetland', danger: 0.65, resources: 0.4, adjacent: ['The Coolant Vats', 'The Feed Lofts', 'The Hook Line'] },
            { name: 'Furnace Row', terrain: 'ruins', danger: 0.9, resources: 0.25, adjacent: ['The Piston Hall', 'The Catwalks', 'The Hook Line'] },
            { name: 'The Hook Line', terrain: 'ruins', danger: 0.55, resources: 0.5, adjacent: ['The Rendering Pits', 'Furnace Row'] },
        ]
    },
    {
        id: 'carnival',
        name: 'The Forgotten Carnival',
        description: 'A decayed amusement park swallowed by a fog-choked pine forest. The paint is gone, the music boxes are not, and some of the rides still have power from somewhere.',
        mutts: ['Calliope Jays', 'The Barker', 'Prize Hounds', 'Ticket Wasps'],
        events: ['The Ride Wakes', 'Fog Bank', 'Structural Rot'],
        // Broken glass floor to ceiling: crossing the maze costs blood as often as not.
        edgeRules: { 'The Carousel|The Mirror Maze': { kind: 'tolled', toll: { woundChance: 0.1 } } },
        // §5.5: widened to twelve zones — a park has more dark corners than this.
        zones: [
            { name: 'The Cornucopia (The Midway)', terrain: 'open', danger: 0.6, resources: 0.35, adjacent: ['The Carousel', 'The Big Top', 'The Pine Dark'] },
            { name: 'The Carousel', terrain: 'ruins', danger: 0.65, resources: 0.3, adjacent: ['The Cornucopia (The Midway)', 'The Mirror Maze', 'The Duck Pond'] },
            { name: 'The Big Top', terrain: 'ruins', danger: 0.55, resources: 0.45, adjacent: ['The Cornucopia (The Midway)', 'The Ferris Wheel', "Fortune Teller's Row"] },
            { name: 'The Pine Dark', terrain: 'forest', danger: 0.45, resources: 0.7, adjacent: ['The Cornucopia (The Midway)', 'The Duck Pond', 'The Overgrown Campground'], features: { cover: 0.9, elevation: false, chokepoint: false } },
            { name: 'The Mirror Maze', terrain: 'ruins', danger: 0.8, resources: 0.2, adjacent: ['The Carousel', 'The Ferris Wheel', 'The Haunted Manor'], features: { cover: 0.7, elevation: false, chokepoint: true } },
            { name: 'The Duck Pond', terrain: 'water', danger: 0.4, resources: 0.55, adjacent: ['The Carousel', 'The Pine Dark', 'The Sunken Boat Ride', 'The Swan Boat Canal'] },
            { name: 'The Ferris Wheel', terrain: 'highland', danger: 0.75, resources: 0.15, adjacent: ['The Big Top', 'The Mirror Maze', 'The Haunted Manor'] },
            { name: "Fortune Teller's Row", terrain: 'ruins', danger: 0.5, resources: 0.5, adjacent: ['The Big Top', 'The Overgrown Campground'] },
            { name: 'The Overgrown Campground', terrain: 'forest', danger: 0.35, resources: 0.65, adjacent: ['The Pine Dark', "Fortune Teller's Row", 'The Sunken Boat Ride'] },
            { name: 'The Sunken Boat Ride', terrain: 'wetland', danger: 0.6, resources: 0.45, adjacent: ['The Duck Pond', 'The Overgrown Campground', 'The Swan Boat Canal'] },
            // The back of the park: the dark ride nobody finished, and the
            // canal that used to carry the swan boats between attractions.
            { name: 'The Haunted Manor', terrain: 'ruins', danger: 0.7, resources: 0.4, adjacent: ['The Mirror Maze', 'The Ferris Wheel'], features: { cover: 0.8, elevation: false, chokepoint: true } },
            { name: 'The Swan Boat Canal', terrain: 'water', danger: 0.5, resources: 0.4, adjacent: ['The Duck Pond', 'The Sunken Boat Ride'] },
        ]
    },
    {
        id: 'ashwaste',
        name: 'The Ash Wasteland',
        description: 'A dead land under three feet of volcanic ash, ringed around a caldera that has not finished with anyone. Every step is work, every print is a signature, and the mountain is still deciding.',
        mutts: ['Drift Serpents', 'Caldera Vultures', 'Cinder Fleas', 'The Grey Bull'],
        events: ['Ash Slide', 'Vent Burst', 'The Mountain Clears Its Throat'],
        zones: [
            { name: 'The Cornucopia (Cinder Ring)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['The Deep Drifts', 'The Burned Forest', 'The Buried Village'] },
            { name: 'The Deep Drifts', terrain: 'open', danger: 0.7, resources: 0.1, adjacent: ['The Cornucopia (Cinder Ring)', 'The Caldera Rim', 'The Mudpots'] },
            { name: 'The Burned Forest', terrain: 'forest', danger: 0.45, resources: 0.5, adjacent: ['The Cornucopia (Cinder Ring)', 'The Steam Field', 'The Buried Village'] },
            { name: 'The Buried Village', terrain: 'ruins', danger: 0.5, resources: 0.55, adjacent: ['The Cornucopia (Cinder Ring)', 'The Burned Forest', 'The Lava Tubes'] },
            { name: 'The Caldera Rim', terrain: 'highland', danger: 0.9, resources: 0.1, adjacent: ['The Deep Drifts', 'The Smolder'], features: { cover: 0.1, elevation: true, chokepoint: true } },
            { name: 'The Mudpots', terrain: 'wetland', danger: 0.65, resources: 0.45, adjacent: ['The Deep Drifts', 'The Steam Field'] },
            { name: 'The Steam Field', terrain: 'water', danger: 0.55, resources: 0.4, adjacent: ['The Burned Forest', 'The Mudpots'] },
            { name: 'The Smolder', terrain: 'highland', danger: 0.85, resources: 0.15, adjacent: ['The Caldera Rim', 'The Lava Tubes'] },
            { name: 'The Lava Tubes', terrain: 'ruins', danger: 0.6, resources: 0.35, adjacent: ['The Buried Village', 'The Smolder'], features: { cover: 0.8, elevation: false, chokepoint: true } },
        ]
    },
    {
        id: 'quarry',
        name: 'The Vertical Quarry',
        description: 'A cylindrical open-pit mine, spiral roads cut into sheer stone, dropping bench by bench to a flooded black centre. The only ways down are the ways everyone else knows about.',
        mutts: ['Bench Cats', 'Blast Bats', 'The Dredger', 'Scree Adders'],
        events: ['Bench Collapse', 'Runaway Cart', 'The Pit Exhales'],
        // The only road down, and every step of it is exposed switchback.
        edgeRules: { 'The Middle Benches|The Spiral Road': { kind: 'tolled', toll: { fatigue: 6 } } },
        // §5.5: trimmed to nine zones — the Blast Face sheared off years ago.
        zones: [
            { name: 'The Cornucopia (Rim Camp)', terrain: 'open', danger: 0.55, resources: 0.35, adjacent: ['The Spiral Road', 'The Upper Benches', 'The Scrub Ledges'] },
            { name: 'The Spiral Road', terrain: 'highland', danger: 0.75, resources: 0.15, adjacent: ['The Cornucopia (Rim Camp)', 'The Middle Benches'], features: { cover: 0.1, elevation: true, chokepoint: true } },
            { name: 'The Upper Benches', terrain: 'open', danger: 0.5, resources: 0.3, adjacent: ['The Cornucopia (Rim Camp)', 'The Powder Magazine'] },
            { name: 'The Scrub Ledges', terrain: 'forest', danger: 0.35, resources: 0.6, adjacent: ['The Cornucopia (Rim Camp)', 'The Powder Magazine', 'The Seep Wall'] },
            { name: 'The Middle Benches', terrain: 'open', danger: 0.6, resources: 0.25, adjacent: ['The Spiral Road', 'The Crusher House', 'The Flooded Pit'] },
            { name: 'The Powder Magazine', terrain: 'ruins', danger: 0.7, resources: 0.45, adjacent: ['The Upper Benches', 'The Scrub Ledges'] },
            { name: 'The Seep Wall', terrain: 'wetland', danger: 0.45, resources: 0.55, adjacent: ['The Scrub Ledges', 'The Flooded Pit'] },
            { name: 'The Crusher House', terrain: 'ruins', danger: 0.65, resources: 0.4, adjacent: ['The Middle Benches', 'The Flooded Pit'] },
            { name: 'The Flooded Pit', terrain: 'water', danger: 0.8, resources: 0.35, adjacent: ['The Middle Benches', 'The Seep Wall', 'The Crusher House'] },
        ]
    },
    {
        id: 'glacier',
        name: 'The Glacial Cavern Network',
        description: 'A blinding white glacier above, and under it a maze of translucent blue caves, frozen waterfalls and tunnels polished slick as glass. The light comes down through thirty metres of ice, and so does the sound of it moving.',
        mutts: ['Blue-Ice Bears', 'Crevasse Worms', 'Echo Bats', 'Rime Foxes'],
        events: ['Calving', 'Whiteout', 'Tunnel Slip'],
        // A vertical shaft — one-way down only, matching a real moulin's behaviour.
        edgeRules: { 'The Moulin|The Pressure Ridge': { kind: 'oneWay', from: 'The Pressure Ridge', to: 'The Moulin' } },
        // The glacier's own weather, and the water it makes when it moves.
        effectVocab: {
            frozen: { label: 'a calving chill', severityMult: 1.15 },
            flooded: { label: 'a meltwater surge' },
        },
        zones: [
            { name: 'The Cornucopia (Snowfield)', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The Firn Slope', 'The Blue Galleries', 'The Frozen Falls'] },
            { name: 'The Firn Slope', terrain: 'open', danger: 0.6, resources: 0.2, adjacent: ['The Cornucopia (Snowfield)', 'The Serac Field', 'The Pressure Ridge'] },
            { name: 'The Blue Galleries', terrain: 'ruins', danger: 0.5, resources: 0.4, adjacent: ['The Cornucopia (Snowfield)', 'The Slick Tunnels', 'The Green Chimney'], features: { cover: 0.75, elevation: false, chokepoint: false } },
            { name: 'The Frozen Falls', terrain: 'water', danger: 0.7, resources: 0.45, adjacent: ['The Cornucopia (Snowfield)', 'The Slush Basin', 'The Slick Tunnels'] },
            { name: 'The Serac Field', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The Firn Slope', 'The Pressure Ridge'] },
            { name: 'The Pressure Ridge', terrain: 'highland', danger: 0.75, resources: 0.15, adjacent: ['The Firn Slope', 'The Serac Field', 'The Moulin'] },
            { name: 'The Slick Tunnels', terrain: 'ruins', danger: 0.65, resources: 0.3, adjacent: ['The Blue Galleries', 'The Frozen Falls', 'The Meltwater Vault'], features: { cover: 0.6, elevation: false, chokepoint: true } },
            { name: 'The Green Chimney', terrain: 'forest', danger: 0.3, resources: 0.7, adjacent: ['The Blue Galleries', 'The Meltwater Vault'] },
            { name: 'The Slush Basin', terrain: 'wetland', danger: 0.55, resources: 0.5, adjacent: ['The Frozen Falls', 'The Moulin'] },
            { name: 'The Moulin', terrain: 'ruins', danger: 0.9, resources: 0.2, adjacent: ['The Pressure Ridge', 'The Slush Basin'], features: { cover: 0.2, elevation: false, chokepoint: true } },
            { name: 'The Meltwater Vault', terrain: 'water', danger: 0.6, resources: 0.55, adjacent: ['The Slick Tunnels', 'The Green Chimney'] },
        ]
    },
    {
        id: 'floe',
        name: 'The Shattered Ice Floe Sea',
        description: 'Open pack ice on a pitch-black frigid ocean, plates grinding and drifting all night, the Cornucopia stranded on the one shelf big enough to trust. The map is provisional. The water is not survivable.',
        mutts: ['Ice Orcas', 'Floe Bears', 'Storm Petrels', 'The Under-Thing'],
        events: ['The Lead Opens', 'Plate Collision', 'Black Water'],
        // Grease ice will hold a careful tribute. Mostly.
        edgeRules: { 'The Black Lead|The Grease Ice': { kind: 'tolled', toll: { fatigue: 7, woundChance: 0.08 } } },
        zones: [
            { name: 'The Cornucopia (Ice Shelf)', terrain: 'open', danger: 0.55, resources: 0.35, adjacent: ['The Pack Ice', 'The Pressure Ridges', 'The Black Lead'] },
            { name: 'The Pack Ice', terrain: 'open', danger: 0.65, resources: 0.2, adjacent: ['The Cornucopia (Ice Shelf)', 'The Grease Ice', 'The Frozen Wreck'] },
            { name: 'The Pressure Ridges', terrain: 'highland', danger: 0.7, resources: 0.15, adjacent: ['The Cornucopia (Ice Shelf)', 'The Big Berg', 'The Frozen Wreck'] },
            { name: 'The Black Lead', terrain: 'water', danger: 0.85, resources: 0.4, adjacent: ['The Cornucopia (Ice Shelf)', 'The Seal Colony', 'The Grease Ice'] },
            { name: 'The Grease Ice', terrain: 'wetland', danger: 0.75, resources: 0.3, adjacent: ['The Pack Ice', 'The Black Lead'] },
            { name: 'The Frozen Wreck', terrain: 'ruins', danger: 0.5, resources: 0.55, adjacent: ['The Pack Ice', 'The Pressure Ridges', 'The Bergy Bits'] },
            { name: 'The Big Berg', terrain: 'highland', danger: 0.6, resources: 0.25, adjacent: ['The Pressure Ridges', 'The Bergy Bits'], features: { cover: 0.3, elevation: true, chokepoint: false } },
            { name: 'The Seal Colony', terrain: 'wetland', danger: 0.4, resources: 0.7, adjacent: ['The Black Lead', 'The Bergy Bits'] },
            { name: 'The Bergy Bits', terrain: 'water', danger: 0.7, resources: 0.35, adjacent: ['The Frozen Wreck', 'The Big Berg', 'The Seal Colony'] },
        ]
    },
    {
        id: 'alpine',
        name: 'The Pine Forest & Avalanche Peaks',
        description: 'Steep alpine slopes, heavy timber below, bare rock and loaded snowfields above. Everything worth having is downhill; everything that can kill you is up, and it is all one loud noise from coming down.',
        mutts: ['Timberline Wolves', 'The White Stag', 'Chough Flocks', 'Marmot Mutts'],
        events: ['Avalanche', 'Rockfall', 'Whiteout Front'],
        // The traverse to the summit snows is a knife's edge in crampon weather.
        edgeRules: { 'The Knife Ridge|The Summit Snows': { kind: 'tolled', toll: { fatigue: 8, woundChance: 0.1 } } },
        zones: [
            { name: 'The Cornucopia (Treeline Meadow)', terrain: 'open', danger: 0.55, resources: 0.35, adjacent: ['The Old Growth', 'The Scree Chutes', 'The Tarn'] },
            { name: 'The Old Growth', terrain: 'forest', danger: 0.35, resources: 0.75, adjacent: ['The Cornucopia (Treeline Meadow)', 'The Deadfall Slope', 'The Hunting Lodge'], features: { cover: 0.85, elevation: false, chokepoint: false } },
            { name: 'The Scree Chutes', terrain: 'highland', danger: 0.7, resources: 0.15, adjacent: ['The Cornucopia (Treeline Meadow)', 'The Knife Ridge', 'The Cirque'] },
            { name: 'The Tarn', terrain: 'water', danger: 0.4, resources: 0.6, adjacent: ['The Cornucopia (Treeline Meadow)', 'The Bog Meadow', 'The Hunting Lodge'] },
            { name: 'The Deadfall Slope', terrain: 'forest', danger: 0.55, resources: 0.5, adjacent: ['The Old Growth', 'The Cirque'] },
            { name: 'The Hunting Lodge', terrain: 'ruins', danger: 0.45, resources: 0.55, adjacent: ['The Old Growth', 'The Tarn'] },
            { name: 'The Knife Ridge', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The Scree Chutes', 'The Summit Snows'], features: { cover: 0.05, elevation: true, chokepoint: true } },
            { name: 'The Cirque', terrain: 'open', danger: 0.65, resources: 0.25, adjacent: ['The Scree Chutes', 'The Deadfall Slope', 'The Summit Snows'] },
            { name: 'The Bog Meadow', terrain: 'wetland', danger: 0.35, resources: 0.65, adjacent: ['The Tarn'] },
            { name: 'The Summit Snows', terrain: 'highland', danger: 0.9, resources: 0.05, adjacent: ['The Knife Ridge', 'The Cirque'] },
        ]
    },
    {
        id: 'terraces',
        name: 'The Abandoned Terraced Mines',
        description: 'A mountain cut into dozens of stepped stone terraces by pre-Dark Days mining, riddled with open shaft mouths and strung with the rusted bones of a cable car system nobody has trusted in a century.',
        mutts: ['Shaft Swifts', 'Terrace Jackals', 'The Foreman', 'Cable Spiders'],
        events: ['Terrace Slip', 'The Cable Parts', 'Shaft Breath'],
        // Hand over hand along the counterweight cable to the winch house.
        edgeRules: { 'The Counterweight Span|The Winch House': { kind: 'tolled', toll: { fatigue: 7 } } },
        zones: [
            { name: 'The Cornucopia (Grand Terrace)', terrain: 'open', danger: 0.6, resources: 0.35, adjacent: ['The Upper Steps', 'The Overgrown Steps', 'The Tailings Fans'] },
            { name: 'The Upper Steps', terrain: 'highland', danger: 0.65, resources: 0.25, adjacent: ['The Cornucopia (Grand Terrace)', 'The Cable Car Station', 'The Counterweight Span'] },
            { name: 'The Overgrown Steps', terrain: 'forest', danger: 0.35, resources: 0.7, adjacent: ['The Cornucopia (Grand Terrace)', 'The Cistern Terrace', 'The Slurry Ponds'] },
            { name: 'The Tailings Fans', terrain: 'open', danger: 0.55, resources: 0.2, adjacent: ['The Cornucopia (Grand Terrace)', 'The Slurry Ponds', 'The Shaft Mouths'] },
            { name: 'The Cable Car Station', terrain: 'ruins', danger: 0.5, resources: 0.5, adjacent: ['The Upper Steps', 'The Winch House'] },
            { name: 'The Counterweight Span', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The Upper Steps', 'The Winch House'], features: { cover: 0.05, elevation: true, chokepoint: true } },
            { name: 'The Cistern Terrace', terrain: 'water', danger: 0.4, resources: 0.55, adjacent: ['The Overgrown Steps', 'The Shaft Mouths'] },
            { name: 'The Slurry Ponds', terrain: 'wetland', danger: 0.6, resources: 0.4, adjacent: ['The Overgrown Steps', 'The Tailings Fans'] },
            // A good ambush zone — a resource bonus rewards the risk of using
            // it as a route rather than just its danger punishing it.
            { name: 'The Shaft Mouths', terrain: 'ruins', danger: 0.8, resources: 0.6, adjacent: ['The Tailings Fans', 'The Cistern Terrace', 'The Winch House'], features: { cover: 0.6, elevation: false, chokepoint: true } },
            { name: 'The Winch House', terrain: 'ruins', danger: 0.55, resources: 0.5, adjacent: ['The Cable Car Station', 'The Counterweight Span', 'The Shaft Mouths'] },
        ]
    },
    {
        id: 'seapeaks',
        name: 'The Alpine Archipelago',
        description: 'A chain of sharp mountain peaks thrust directly out of a deep, rough ocean — no coastlines, no beaches, no gradual slopes. Scale the ice or swim the swells; there is no third way between any two peaks.',
        mutts: ['Undertow Serpents', 'Cliff Harriers', 'Deep Current Grapplers'],
        events: ['Rising Tide', 'Ice Shear', 'Rogue Swell'],
        // The chimney is a free climb up sea-slick ice; the sea takes the rest.
        // §11.6: nobody free-climbs the chimney without leaving gear in it.
        edgeRules: { 'The Ice Chimney|The Summit Col': { kind: 'tolled', toll: { fatigue: 8, woundChance: 0.12, itemCost: true } } },
        zones: [
            { name: 'The Cornucopia (The Shelf)', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The First Peak', 'The Drowned Approach', 'Open Water Reach'] },
            { name: 'The First Peak', terrain: 'highland', danger: 0.7, resources: 0.2, adjacent: ['The Cornucopia (The Shelf)', 'The Ice Chimney', 'The Sea Cave'] },
            { name: 'The Drowned Approach', terrain: 'water', danger: 0.65, resources: 0.3, adjacent: ['The Cornucopia (The Shelf)', 'Open Water Reach', 'The Kelp Shallows'] },
            { name: 'The Ice Chimney', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The First Peak', 'The Summit Col'] },
            { name: 'Open Water Reach', terrain: 'water', danger: 0.75, resources: 0.35, adjacent: ['The Cornucopia (The Shelf)', 'The Drowned Approach', 'The Kelp Shallows', 'The Sea Cave'] },
            { name: 'The Sea Cave', terrain: 'ruins', danger: 0.5, resources: 0.5, adjacent: ['The First Peak', 'Open Water Reach', 'The Second Peak'] },
            { name: 'The Second Peak', terrain: 'highland', danger: 0.75, resources: 0.15, adjacent: ['The Sea Cave', 'The Summit Col', 'The Kelp Shallows'] },
            { name: 'The Kelp Shallows', terrain: 'water', danger: 0.55, resources: 0.55, adjacent: ['The Drowned Approach', 'Open Water Reach', 'The Second Peak'] },
            { name: 'The Summit Col', terrain: 'highland', danger: 0.9, resources: 0.05, adjacent: ['The Ice Chimney', 'The Second Peak'] },
        ]
    },
    {
        id: 'canopyweb',
        name: 'The Suspended Canopy Web',
        description: 'A forest of giant three-hundred-foot conifers, the ground floor buried under a sunless layer of toxic nitrogen fog nobody survives a minute in. Everything worth doing happens hundreds of feet up, on woven needle-bridges and swaying moss webs.',
        mutts: ['Silk-Line Stalkers', 'Needle Wasps', 'The Understory Reach'],
        events: ['Needle Storm', 'Web Collapse', 'The Fog Rises'],
        law: 'noWaterExceptZone',
        lawZone: 'The Rain Catch',
        zones: [
            { name: 'The Cornucopia (The Landing)', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The Needle Bridges', 'Moss Hammock Grove', 'The Crown Break'] },
            { name: 'The Needle Bridges', terrain: 'highland', danger: 0.8, resources: 0.15, adjacent: ['The Cornucopia (The Landing)', 'The Swaying Reach', 'The Old Nest'], features: { cover: 0.1, elevation: true, chokepoint: true } },
            { name: 'Moss Hammock Grove', terrain: 'forest', danger: 0.35, resources: 0.75, adjacent: ['The Cornucopia (The Landing)', 'The Rain Catch', 'The Web Anchor'] },
            { name: 'The Rain Catch', terrain: 'water', danger: 0.3, resources: 0.5, adjacent: ['Moss Hammock Grove', 'The Web Anchor'] },
            { name: 'The Swaying Reach', terrain: 'highland', danger: 0.75, resources: 0.2, adjacent: ['The Needle Bridges', 'The Old Nest', 'The Crown Break'] },
            { name: 'The Old Nest', terrain: 'ruins', danger: 0.5, resources: 0.55, adjacent: ['The Needle Bridges', 'The Swaying Reach', 'The Understory Fog'] },
            { name: 'The Understory Fog', terrain: 'wetland', danger: 0.85, resources: 0.3, adjacent: ['The Old Nest', 'The Web Anchor'] },
            { name: 'The Crown Break', terrain: 'open', danger: 0.6, resources: 0.25, adjacent: ['The Cornucopia (The Landing)', 'The Swaying Reach'] },
            { name: 'The Web Anchor', terrain: 'ruins', danger: 0.45, resources: 0.6, adjacent: ['Moss Hammock Grove', 'The Rain Catch', 'The Understory Fog'] },
        ]
    },
    {
        id: 'acousticforest',
        name: 'The Whispering Acoustic Forest',
        description: 'A lodgepole pine forest hollowed out by engineered wood-boring insects, the whole canopy one vast wind organ. The breeze through the hollow trunks sounds uncannily human — and drowns out anyone actually trying to sneak.',
        mutts: ['Wind-Throat Owls', 'Resonance Moths', 'Hollow-Bore Beetles'],
        events: ['Resonant Shattering', 'The Chorus', 'Dry Grove Collapse'],
        // Acoustic confusion runs through the same primitive fog does —
        // hearing nothing true is its own kind of blindness.
        effectVocab: { fogbound: { label: 'the wind-organ at full voice', severityMult: 1.3 } },
        zones: [
            { name: 'The Cornucopia (The Grove Floor)', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The Hollow Boughs', 'The Wind Throat', "Piper's Creek"] },
            { name: 'The Hollow Boughs', terrain: 'forest', danger: 0.4, resources: 0.7, adjacent: ['The Cornucopia (The Grove Floor)', 'The Needle Drift', 'The Deep Organ'] },
            { name: 'The Wind Throat', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The Cornucopia (The Grove Floor)', 'The Resonance Chamber', 'The Splinter Field'] },
            { name: "Piper's Creek", terrain: 'water', danger: 0.4, resources: 0.55, adjacent: ['The Cornucopia (The Grove Floor)', 'The Needle Drift', 'The Whisper Hollow'] },
            { name: 'The Needle Drift', terrain: 'forest', danger: 0.35, resources: 0.65, adjacent: ['The Hollow Boughs', "Piper's Creek", 'The Deep Organ'] },
            { name: 'The Deep Organ', terrain: 'forest', danger: 0.55, resources: 0.6, adjacent: ['The Hollow Boughs', 'The Needle Drift', 'Old Sawmill Ruins'] },
            { name: 'The Whisper Hollow', terrain: 'wetland', danger: 0.5, resources: 0.5, adjacent: ["Piper's Creek", 'Old Sawmill Ruins'] },
            { name: 'Old Sawmill Ruins', terrain: 'ruins', danger: 0.45, resources: 0.5, adjacent: ['The Deep Organ', 'The Whisper Hollow', 'The Resonance Chamber'] },
            { name: 'The Resonance Chamber', terrain: 'ruins', danger: 0.6, resources: 0.4, adjacent: ['The Wind Throat', 'Old Sawmill Ruins', 'The Splinter Field'] },
            { name: 'The Splinter Field', terrain: 'open', danger: 0.65, resources: 0.2, adjacent: ['The Wind Throat', 'The Resonance Chamber'] },
        ]
    },
    {
        id: 'burnscar',
        name: 'The Post-Burn Scar & Fireweed Slope',
        description: 'A mountain forest three years burned: blackened snag trees, deep erosion gullies, and thorny fireweed grown up thick over ground that still runs hot. Deadfall drops silently. The mountain is not finished with fire.',
        mutts: ['Cinder-Back Boars', 'Thornvine Jackals', 'The Standing Char'],
        events: ['Seed Shrapnel', 'Silent Deadfall', 'Ground Heat Flare'],
        zones: [
            { name: 'The Cornucopia (The Ash Clearing)', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The Snag Field', 'The Fireweed Slope', 'Seep Spring'] },
            { name: 'The Snag Field', terrain: 'ruins', danger: 0.5, resources: 0.3, adjacent: ['The Cornucopia (The Ash Clearing)', 'Deadfall Hollow', 'The Char Ridge'] },
            { name: 'The Fireweed Slope', terrain: 'forest', danger: 0.45, resources: 0.65, adjacent: ['The Cornucopia (The Ash Clearing)', 'Bramble Choke', 'Erosion Gully'] },
            { name: 'Seep Spring', terrain: 'water', danger: 0.35, resources: 0.45, adjacent: ['The Cornucopia (The Ash Clearing)', 'Erosion Gully', 'The Standing Dead'] },
            { name: 'Deadfall Hollow', terrain: 'forest', danger: 0.6, resources: 0.5, adjacent: ['The Snag Field', 'The Char Ridge', 'The Old Burn Line'] },
            { name: 'The Char Ridge', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The Snag Field', 'Deadfall Hollow', 'The Old Burn Line'] },
            { name: 'Bramble Choke', terrain: 'wetland', danger: 0.7, resources: 0.35, adjacent: ['The Fireweed Slope', 'Erosion Gully'], features: { cover: 0.7, elevation: false, chokepoint: true } },
            { name: 'Erosion Gully', terrain: 'wetland', danger: 0.5, resources: 0.4, adjacent: ['The Fireweed Slope', 'Seep Spring', 'Bramble Choke'] },
            { name: 'The Old Burn Line', terrain: 'open', danger: 0.6, resources: 0.25, adjacent: ['Deadfall Hollow', 'The Char Ridge', 'The Standing Dead'] },
            { name: 'The Standing Dead', terrain: 'ruins', danger: 0.55, resources: 0.45, adjacent: ['Seep Spring', 'The Old Burn Line'] },
        ]
    },
    {
        id: 'craterfield',
        name: 'The Overgrown Ordnance Crater Field',
        description: 'A former military proving ground, pockmarked with deep overlapping craters flooded into stagnant ponds and choked by fast-growing vines. Unexploded ordnance sleeps under the root mats, and the vines have learned to grow something worse.',
        mutts: ['Bog Adders', 'Root-Mat Crawlers', 'The Salvage Hound'],
        events: ['Pressure Pod', 'Crater Collapse', 'Buried Ordnance'],
        zones: [
            { name: 'The Cornucopia (The Motor Pool)', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The Shallow Craters', 'Rusted Convoy Road', 'The Root Mat Flat'] },
            { name: 'The Shallow Craters', terrain: 'wetland', danger: 0.55, resources: 0.4, adjacent: ['The Cornucopia (The Motor Pool)', 'The Deep Craters', 'The Fruiting Tangle'] },
            { name: 'The Deep Craters', terrain: 'water', danger: 0.8, resources: 0.35, adjacent: ['The Shallow Craters', 'Stagnant Pool Marsh', 'Slick Crater Wall'] },
            { name: 'Rusted Convoy Road', terrain: 'open', danger: 0.4, resources: 0.25, adjacent: ['The Cornucopia (The Motor Pool)', 'Vine-Choked Bunker', 'The Old Ammo Dump'] },
            { name: 'The Root Mat Flat', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['The Cornucopia (The Motor Pool)', 'The Fruiting Tangle', 'Vine-Choked Bunker'] },
            { name: 'Vine-Choked Bunker', terrain: 'ruins', danger: 0.65, resources: 0.45, adjacent: ['Rusted Convoy Road', 'The Root Mat Flat', 'The Old Ammo Dump'] },
            { name: 'The Fruiting Tangle', terrain: 'forest', danger: 0.5, resources: 0.75, adjacent: ['The Shallow Craters', 'The Root Mat Flat', 'Stagnant Pool Marsh'] },
            { name: 'Stagnant Pool Marsh', terrain: 'wetland', danger: 0.6, resources: 0.5, adjacent: ['The Deep Craters', 'The Fruiting Tangle', 'Slick Crater Wall'] },
            { name: 'Slick Crater Wall', terrain: 'highland', danger: 0.75, resources: 0.15, adjacent: ['The Deep Craters', 'Stagnant Pool Marsh'] },
            { name: 'The Old Ammo Dump', terrain: 'ruins', danger: 0.7, resources: 0.4, adjacent: ['Rusted Convoy Road', 'Vine-Choked Bunker'] },
        ]
    },
    {
        id: 'culdesac',
        name: 'The Cul-de-Sac',
        description: 'Sixty-two identical houses on a loop road. The lawns are cut, the porch lights work, and the delivery trucks keep coming. The Capitol built somewhere normal, and now it has to be ransacked.',
        mutts: ['The Family Dogs', 'The Meter Reader', 'Wasps in the Eaves', 'Something in the Pool'],
        events: ['The Neighbourhood Watch', 'Gas Leak', 'The Sprinklers'],
        law: 'cornucopiaRefills',
        // The arena's utilities are its hazards: sprinklers instead of fog, a
        // garden left too long instead of a bloom, larders instead of forage.
        effectVocab: {
            stripped: { label: 'picked clean' },
            fogbound: { label: 'the sprinklers' },
            blooming: { label: 'a garden gone over' },
        },
        edgeRules: {
            // A six-foot fence: easy to drop off, nothing to climb back up.
            'Back Gardens|The Cut-Through': { kind: 'oneWay', from: 'The Cut-Through', to: 'Back Gardens' },
            // The substation is crossed on the live rails or not at all.
            'The Loading Bay|The Substation': { kind: 'tolled', toll: { woundChance: 0.15 } },
            'The Storm Creek|The Substation': { kind: 'tolled', toll: { woundChance: 0.15 } },
        },
        zones: [
            { name: 'The Cornucopia (Loop Road)', terrain: 'open', danger: 0.6, resources: 0.35, adjacent: ['Number 14', 'Number 27', 'The Show Home', 'The Green', 'The Loading Bay'] },
            { name: 'Number 14', terrain: 'ruins', danger: 0.45, resources: 0.6, adjacent: ['The Cornucopia (Loop Road)', 'Number 27', 'Back Gardens'], features: { cover: 0.8, elevation: false, chokepoint: true } },
            { name: 'Number 27', terrain: 'ruins', danger: 0.55, resources: 0.55, adjacent: ['The Cornucopia (Loop Road)', 'Number 14', 'The Cut-Through'], features: { cover: 0.8, elevation: false, chokepoint: true } },
            { name: 'The Show Home', terrain: 'ruins', danger: 0.4, resources: 0.65, adjacent: ['The Cornucopia (Loop Road)', 'The Green', 'The Pool Complex'], features: { cover: 0.75, elevation: false, chokepoint: false } },
            { name: 'The Cut-Through', terrain: 'forest', danger: 0.5, resources: 0.5, adjacent: ['Number 27', 'The Green', 'Back Gardens', 'The Storm Creek'], features: { cover: 0.85, elevation: false, chokepoint: true } },
            { name: 'The Green', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The Cornucopia (Loop Road)', 'The Show Home', 'The Cut-Through', 'The Pool Complex'] },
            { name: 'Back Gardens', terrain: 'forest', danger: 0.35, resources: 0.7, adjacent: ['Number 14', 'The Cut-Through', 'The Storm Creek'], features: { cover: 0.9, elevation: false, chokepoint: false } },
            { name: 'The Pool Complex', terrain: 'water', danger: 0.6, resources: 0.4, adjacent: ['The Show Home', 'The Green', 'The Loading Bay'] },
            { name: 'The Storm Creek', terrain: 'water', danger: 0.5, resources: 0.5, adjacent: ['The Cut-Through', 'Back Gardens', 'The Substation'] },
            { name: 'The Loading Bay', terrain: 'open', danger: 0.65, resources: 0.55, adjacent: ['The Cornucopia (Loop Road)', 'The Pool Complex', 'The Substation'] },
            { name: 'The Substation', terrain: 'ruins', danger: 0.85, resources: 0.2, adjacent: ['The Storm Creek', 'The Loading Bay'], features: { cover: 0.4, elevation: false, chokepoint: true } },
        ]
    },
    {
        id: 'labyrinth',
        name: 'The Green Labyrinth',
        description: 'Nine metres of yew in every direction. It was this shape yesterday. The hedges eat the cannon fire, the walls move on rails, and the map itself is the antagonist.',
        mutts: ['The Topiary', 'The Hounds in the Hedge', 'The Gardener', 'Canal Eels'],
        events: ['The Shift', 'The Sound of Shears', 'Petals Out of Season'],
        law: 'noCannons',
        // Yew burns fast and mean, and the mist between the walls is the
        // maze's own weather.
        effectVocab: {
            fogbound: { label: 'the hedge mist' },
            stripped: { label: 'cut back' },
            burning: { label: 'a hedge alight', severityMult: 1.25, durationMult: 0.7 },
        },
        edgeRules: {
            // No 'hidden' edge kind exists — the passage into the True Centre
            // is approximated as night-gated: it is only ever found in the dark.
            'The False Centre|The True Centre': { kind: 'timeGated', gatedTime: 'night' },
            // The Gardener's Gate is locked after dark. House rules.
            "The Gardener's Gate|The Outer Ring": { kind: 'timeGated', gatedTime: 'day' },
            "The Canal Walk|The Gardener's Gate": { kind: 'timeGated', gatedTime: 'day' },
        },
        zones: [
            { name: 'The Cornucopia (Fountain Court)', terrain: 'open', danger: 0.6, resources: 0.35, adjacent: ['The Outer Ring', 'The Parterre', 'The Canal Walk'] },
            { name: 'The Outer Ring', terrain: 'forest', danger: 0.45, resources: 0.5, adjacent: ['The Cornucopia (Fountain Court)', 'The North Spiral', 'The South Spiral', "The Gardener's Gate"], features: { cover: 0.85, elevation: false, chokepoint: false } },
            { name: 'The North Spiral', terrain: 'forest', danger: 0.55, resources: 0.45, adjacent: ['The Outer Ring', 'The Long Alley', 'The False Centre'], features: { cover: 0.9, elevation: false, chokepoint: true } },
            { name: 'The South Spiral', terrain: 'forest', danger: 0.55, resources: 0.45, adjacent: ['The Outer Ring', 'The Dead End', 'The Topiary Garden'], features: { cover: 0.9, elevation: false, chokepoint: true } },
            // One way in, the same way out. The maze's oubliette.
            { name: 'The Dead End', terrain: 'forest', danger: 0.7, resources: 0.25, adjacent: ['The South Spiral'], features: { cover: 0.95, elevation: false, chokepoint: true } },
            { name: 'The Long Alley', terrain: 'forest', danger: 0.5, resources: 0.4, adjacent: ['The North Spiral', 'The Parterre', 'The True Centre'], features: { cover: 0.8, elevation: false, chokepoint: true } },
            { name: 'The Parterre', terrain: 'open', danger: 0.4, resources: 0.6, adjacent: ['The Cornucopia (Fountain Court)', 'The Long Alley', 'The Canal Walk'] },
            { name: 'The Canal Walk', terrain: 'water', danger: 0.5, resources: 0.55, adjacent: ['The Cornucopia (Fountain Court)', 'The Parterre', "The Gardener's Gate"] },
            { name: 'The Topiary Garden', terrain: 'forest', danger: 0.75, resources: 0.4, adjacent: ['The South Spiral', 'The False Centre'], features: { cover: 0.8, elevation: false, chokepoint: false } },
            { name: 'The False Centre', terrain: 'forest', danger: 0.65, resources: 0.3, adjacent: ['The North Spiral', 'The Topiary Garden', 'The True Centre'], features: { cover: 0.85, elevation: false, chokepoint: true } },
            { name: 'The True Centre', terrain: 'open', danger: 0.35, resources: 0.7, adjacent: ['The Long Alley', 'The False Centre'] },
            { name: "The Gardener's Gate", terrain: 'open', danger: 0.55, resources: 0.45, adjacent: ['The Outer Ring', 'The Canal Walk'], features: { cover: 0.3, elevation: false, chokepoint: true } },
        ]
    },
    {
        id: 'ashgrove',
        name: 'Ashgrove Secondary',
        description: 'An abandoned school. The bell still rings; nothing else about it works. Tight corridors, hard chokepoints, and a timetable posted in the main corridor that everyone would do well to read.',
        mutts: ['The Register', 'Lab Escapees', 'Something in the Pool Filter', 'The Field Dogs'],
        events: ['The Bell', 'The Chemistry Store', 'The Boiler'],
        // Parachutes cannot get through a roof: gifts land in the yard or not at all.
        law: 'sponsorsFixedZone',
        lawZone: 'The Cornucopia (The Yard)',
        effectVocab: {
            contaminated: { label: 'the chemistry store' },
            fogbound: { label: 'smoke in the corridor' },
            frozen: { label: 'the failed heating' },
        },
        edgeRules: {
            // The drop from the roof to the yard is survivable. The climb back is not on offer.
            'The Cornucopia (The Yard)|The Roof': { kind: 'oneWay', from: 'The Roof', to: 'The Cornucopia (The Yard)' },
        },
        zones: [
            { name: 'The Cornucopia (The Yard)', terrain: 'open', danger: 0.6, resources: 0.35, adjacent: ['Main Corridor', 'The Gymnasium', 'The Playing Field', 'The Roof'] },
            // The spine of the school: every wing hangs off it, and everyone
            // has to use it.
            { name: 'Main Corridor', terrain: 'ruins', danger: 0.7, resources: 0.25, adjacent: ['The Cornucopia (The Yard)', 'The Cafeteria', 'The Library', 'Lockers', 'Science Block', 'The Auditorium'], features: { cover: 0.4, elevation: false, chokepoint: true } },
            { name: 'The Gymnasium', terrain: 'ruins', danger: 0.5, resources: 0.4, adjacent: ['The Cornucopia (The Yard)', 'Lockers', 'The Flooded Pool'], features: { cover: 0.5, elevation: false, chokepoint: false } },
            { name: 'The Cafeteria', terrain: 'ruins', danger: 0.45, resources: 0.7, adjacent: ['Main Corridor', 'The Boiler Room'] },
            { name: 'The Library', terrain: 'ruins', danger: 0.3, resources: 0.5, adjacent: ['Main Corridor', 'The Auditorium'], features: { cover: 0.85, elevation: false, chokepoint: false } },
            { name: 'Science Block', terrain: 'ruins', danger: 0.75, resources: 0.55, adjacent: ['Main Corridor', 'The Boiler Room', 'The Roof'] },
            { name: 'The Boiler Room', terrain: 'ruins', danger: 0.85, resources: 0.3, adjacent: ['The Cafeteria', 'Science Block', 'The Flooded Pool'], features: { cover: 0.6, elevation: false, chokepoint: true } },
            // No 'contested' edge kind exists — the locker rows are modelled
            // as a chokepoint feature on the zone itself.
            { name: 'Lockers', terrain: 'ruins', danger: 0.65, resources: 0.45, adjacent: ['Main Corridor', 'The Gymnasium'], features: { cover: 0.7, elevation: false, chokepoint: true } },
            { name: 'The Auditorium', terrain: 'ruins', danger: 0.55, resources: 0.35, adjacent: ['Main Corridor', 'The Library'], features: { cover: 0.75, elevation: false, chokepoint: false } },
            { name: 'The Flooded Pool', terrain: 'water', danger: 0.7, resources: 0.4, adjacent: ['The Gymnasium', 'The Boiler Room'] },
            // The field edge has gone over to scrub and bramble — the arena's
            // only green cover.
            { name: 'The Playing Field', terrain: 'forest', danger: 0.4, resources: 0.65, adjacent: ['The Cornucopia (The Yard)'] },
            { name: 'The Roof', terrain: 'open', danger: 0.8, resources: 0.15, adjacent: ['Science Block', 'The Cornucopia (The Yard)'], features: { cover: 0.2, elevation: true, chokepoint: true } },
        ]
    },
    {
        id: 'kelvin',
        name: 'Station Kelvin-9',
        description: 'A polar research station abandoned mid-season, and the ice shelf it stands on. The generator has eleven days of fuel in it. The Games have more than eleven days in them.',
        mutts: ['The Dogs That Were Left', 'Under the Ice', 'The Contamination', 'Whiteout'],
        events: ['The Fuel Gauge', 'The Generator Coughs', 'The Silence'],
        // Nothing outdoors will take a flame, and the station's heaters answer
        // to the generator, not to matches.
        law: 'fireImpossible',
        effectVocab: {
            frozen: { label: 'the cold got in' },
            stripped: { label: 'stores broken open' },
            irradiated: { label: 'the isotope store' },
        },
        edgeRules: {
            // Crossing the lead means meltwater to the waist either side of it.
            'Fuel Farm|The Open Lead': { kind: 'tolled', toll: { fatigue: 8, woundChance: 0.08 } },
            'The Ice Shelf|The Open Lead': { kind: 'tolled', toll: { fatigue: 8, woundChance: 0.08 } },
            // The ridge line to the mast is not survivable in the dark.
            'Comms Mast|The Ridge': { kind: 'timeGated', gatedTime: 'day' },
        },
        zones: [
            { name: 'The Cornucopia (The Apron)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['Generator Hall', 'Habitation Ring', 'The Ice Shelf', 'Fuel Farm'] },
            { name: 'Generator Hall', terrain: 'ruins', danger: 0.5, resources: 0.35, adjacent: ['The Cornucopia (The Apron)', 'Habitation Ring', 'Fuel Farm'], features: { cover: 0.6, elevation: false, chokepoint: true } },
            { name: 'Habitation Ring', terrain: 'ruins', danger: 0.4, resources: 0.55, adjacent: ['The Cornucopia (The Apron)', 'Generator Hall', 'The Mess', 'Laboratory Module'] },
            // The one real larder on a map that is otherwise snow.
            { name: 'The Mess', terrain: 'ruins', danger: 0.35, resources: 0.85, adjacent: ['Habitation Ring', 'Laboratory Module'] },
            { name: 'Laboratory Module', terrain: 'ruins', danger: 0.55, resources: 0.5, adjacent: ['Habitation Ring', 'The Mess', 'The Isotope Store'] },
            { name: 'The Isotope Store', terrain: 'ruins', danger: 0.9, resources: 0.4, adjacent: ['Laboratory Module', 'The Ridge'], features: { cover: 0.5, elevation: false, chokepoint: true } },
            { name: 'Comms Mast', terrain: 'highland', danger: 0.7, resources: 0.15, adjacent: ['The Ridge', 'The Ice Shelf'], features: { cover: 0.1, elevation: true, chokepoint: false } },
            { name: 'The Ice Shelf', terrain: 'open', danger: 0.65, resources: 0.1, adjacent: ['The Cornucopia (The Apron)', 'Comms Mast', 'The Open Lead'] },
            { name: 'The Open Lead', terrain: 'water', danger: 0.8, resources: 0.45, adjacent: ['The Ice Shelf', 'Fuel Farm'] },
            { name: 'Fuel Farm', terrain: 'open', danger: 0.5, resources: 0.4, adjacent: ['The Cornucopia (The Apron)', 'Generator Hall', 'The Open Lead'] },
            { name: 'The Ridge', terrain: 'highland', danger: 0.75, resources: 0.1, adjacent: ['The Isotope Store', 'Comms Mast'], features: { cover: 0.1, elevation: true, chokepoint: true } },
        ]
    },
    {
        id: 'silkwood',
        name: 'The Silk Wood',
        description: 'An old-growth wood strung tree to tree with silk. You will notice the silk before you notice the spiders. Not much before.',
        mutts: ['Trap-Door Spiders', 'The Drift', 'The Broodmother', 'Wolf Spiders', 'The Wrapped'],
        events: ['The Re-Spin', 'The Wood Goes Quiet', 'A Bite You Don\'t Feel'],
        // Nothing in this wood is medicine, and everything in it is venom.
        law: 'noHealing',
        effectVocab: {
            fogbound: { label: 'the drift silk' },
            contaminated: { label: 'an egg field', durationMult: 1.25 },
            stripped: { label: 'spun over' },
        },
        zones: [
            { name: 'The Cornucopia (The Clearing)', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The Low Wood', 'The Silk Bridge', 'The Ridge Path'] },
            { name: 'The Low Wood', terrain: 'forest', danger: 0.45, resources: 0.7, adjacent: ['The Cornucopia (The Clearing)', 'The Sink', 'Web Hollow', 'The Old Burn'], features: { cover: 0.85, elevation: false, chokepoint: false } },
            { name: 'The Sink', terrain: 'wetland', danger: 0.65, resources: 0.5, adjacent: ['The Low Wood', 'Web Hollow'] },
            { name: "Broodmother's Crag", terrain: 'highland', danger: 0.95, resources: 0.35, adjacent: ['The Silk Bridge', 'The Ridge Path', 'The Nursery'], features: { cover: 0.3, elevation: true, chokepoint: true } },
            { name: 'The Silk Bridge', terrain: 'forest', danger: 0.6, resources: 0.4, adjacent: ['The Cornucopia (The Clearing)', "Broodmother's Crag", 'Deadfall Slope'], features: { cover: 0.5, elevation: true, chokepoint: true } },
            { name: 'Deadfall Slope', terrain: 'forest', danger: 0.55, resources: 0.55, adjacent: ['The Silk Bridge', "The Collector's Lodge", 'The Old Burn'] },
            { name: "The Collector's Lodge", terrain: 'ruins', danger: 0.4, resources: 0.65, adjacent: ['Deadfall Slope', 'The Old Burn'], features: { cover: 0.7, elevation: false, chokepoint: true } },
            // The one spider-free ground in the arena: nothing to eat here and
            // nothing eating anyone either.
            { name: 'The Old Burn', terrain: 'open', danger: 0.2, resources: 0.15, adjacent: ['The Low Wood', 'Deadfall Slope', "The Collector's Lodge"] },
            { name: 'Web Hollow', terrain: 'forest', danger: 0.75, resources: 0.6, adjacent: ['The Low Wood', 'The Sink', 'The Nursery'], features: { cover: 0.9, elevation: false, chokepoint: false } },
            { name: 'The Ridge Path', terrain: 'highland', danger: 0.5, resources: 0.2, adjacent: ['The Cornucopia (The Clearing)', "Broodmother's Crag"] },
            { name: 'The Nursery', terrain: 'forest', danger: 0.9, resources: 0.75, adjacent: ["Broodmother's Crag", 'Web Hollow'], features: { cover: 0.8, elevation: false, chokepoint: true } },
        ]
    },
    {
        id: 'nooneplace',
        name: 'The Nooneplace',
        description: 'Halls, offices, stairs, carpet, hum. It goes on. That is the whole of it. It goes on.',
        mutts: ['The Hum', 'Something In The Hall Behind You', 'The Others', 'Wall-Walkers', 'The Filing'],
        events: ['A Door You Already Went Through', 'The Lights, For One Second', 'The Exit Sign'],
        // The heaviest law stack in the game: no cannon reaches in here, no
        // parachute lands, and the lights never change. There is no outside
        // for any of those things to come from.
        law: 'noCannons',
        laws: ['noSponsors', 'noNight'],
        effectVocab: {
            fogbound: { label: 'the hum' },
            stripped: { label: 'emptied' },
            irradiated: { label: 'wrongness', durationMult: 1.5 },
        },
        edgeRules: {
            // The corridor to the Exit is 'hidden': it is only there sometimes,
            // and it re-hides behind you. No hidden edge kind exists, so this
            // approximates it as timeGated — and under noNight the gate never
            // actually shuts, which suits a door that only pretends to be rare.
            'Exit|The Long Hall': { kind: 'timeGated', gatedTime: 'day' },
        },
        zones: [
            { name: 'The Cornucopia (Reception)', terrain: 'open', danger: 0.5, resources: 0.35, adjacent: ['The Yellow Halls', 'Office Level', 'The Long Hall'] },
            { name: 'The Yellow Halls', terrain: 'open', danger: 0.55, resources: 0.2, adjacent: ['The Cornucopia (Reception)', 'The Carpet', 'The Stairwell', 'The Long Hall'] },
            // The carpet is damp. It is always damp. It is genuinely a wetland.
            { name: 'The Carpet', terrain: 'wetland', danger: 0.5, resources: 0.4, adjacent: ['The Yellow Halls', 'Office Level', 'The Room With The Chair'] },
            { name: 'Office Level', terrain: 'ruins', danger: 0.45, resources: 0.6, adjacent: ['The Cornucopia (Reception)', 'The Carpet', 'The Stairwell'], features: { cover: 0.7, elevation: false, chokepoint: false } },
            { name: 'The Stairwell', terrain: 'ruins', danger: 0.6, resources: 0.15, adjacent: ['The Yellow Halls', 'Office Level', 'Sub-Level'], features: { cover: 0.4, elevation: true, chokepoint: true } },
            { name: 'Sub-Level', terrain: 'ruins', danger: 0.7, resources: 0.45, adjacent: ['The Stairwell', 'The Flooded Floor', 'The Room With The Chair'] },
            { name: 'The Flooded Floor', terrain: 'water', danger: 0.75, resources: 0.4, adjacent: ['Sub-Level', 'The Long Hall'] },
            { name: 'The Room With The Chair', terrain: 'ruins', danger: 0.85, resources: 0.1, adjacent: ['The Carpet', 'Sub-Level'], features: { cover: 0.2, elevation: false, chokepoint: true } },
            { name: 'The Long Hall', terrain: 'open', danger: 0.6, resources: 0.15, adjacent: ['The Cornucopia (Reception)', 'The Yellow Halls', 'The Flooded Floor', 'Exit'] },
            { name: 'Exit', terrain: 'open', danger: 0.3, resources: 0.1, adjacent: ['The Long Hall'], features: { cover: 0.1, elevation: false, chokepoint: true } },
        ]
    },
    {
        id: 'redcathedral',
        name: 'The Red Cathedral',
        description: 'A mile-deep canyon. Water at the bottom, shade at the top, and no way to hold both — the rim and the river sit a stone\'s throw apart and days of climbing between them.',
        mutts: ['Condors', 'Rattlers in the Talus', 'Cliff Cats', 'The Thing in the Seeps', 'Pinyon Jays'],
        events: ['The Flash', 'The Temperature Swing', 'The False Route'],
        law: 'noWaterExceptZone',
        lawZone: 'The River',
        // The desert-heat vocabulary: a flood here is over in minutes, and what
        // it leaves behind is ground scraped down to rock.
        effectVocab: {
            flooded: { label: 'the flash', durationMult: 0.6 },
            stripped: { label: 'scoured' },
            blooming: { label: 'after the rain' },
        },
        // Every rim-to-bench edge costs an extra cycle: descent is a commute,
        // not a step. The Butte is a rope climb — you leave the rope behind.
        edgeRules: {
            'The Bright Angel Descent|The Cornucopia (The North Rim)': { kind: 'tolled', toll: { timeCost: 1 } },
            'Rim Pinyon|The Bright Angel Descent': { kind: 'tolled', toll: { timeCost: 1 } },
            'The Bright Angel Descent|Upper Bench': { kind: 'tolled', toll: { timeCost: 1 } },
            'Lower Bench|The South Rim': { kind: 'tolled', toll: { timeCost: 1 } },
            'The Butte|The South Rim': { kind: 'tolled', toll: { itemCost: true, fatigue: 8 } },
        },
        zones: [
            { name: 'The Cornucopia (The North Rim)', terrain: 'highland', danger: 0.55, resources: 0.3, adjacent: ['Rim Pinyon', 'The Bright Angel Descent'], features: { cover: 0.2, elevation: true, chokepoint: false } },
            { name: 'Rim Pinyon', terrain: 'forest', danger: 0.35, resources: 0.7, adjacent: ['The Cornucopia (The North Rim)', 'The Bright Angel Descent'] },
            // The only stair between two worlds. Everyone who wants water
            // walks it, and everyone knows everyone walks it.
            { name: 'The Bright Angel Descent', terrain: 'highland', danger: 0.7, resources: 0.1, adjacent: ['The Cornucopia (The North Rim)', 'Rim Pinyon', 'Upper Bench'], features: { cover: 0.15, elevation: true, chokepoint: true } },
            { name: 'Upper Bench', terrain: 'open', danger: 0.5, resources: 0.35, adjacent: ['The Bright Angel Descent', 'The Slot', 'Cliff Dwellings'] },
            { name: 'The Slot', terrain: 'highland', danger: 0.85, resources: 0.15, adjacent: ['Upper Bench', 'The Wash'], features: { cover: 0.6, elevation: false, chokepoint: true } },
            { name: 'Cliff Dwellings', terrain: 'ruins', danger: 0.45, resources: 0.6, adjacent: ['Upper Bench', 'Lower Bench'], features: { cover: 0.7, elevation: true, chokepoint: true } },
            { name: 'Lower Bench', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['Cliff Dwellings', 'The Wash', 'The River', 'The Seeps', 'The South Rim'] },
            { name: 'The Wash', terrain: 'open', danger: 0.75, resources: 0.25, adjacent: ['The Slot', 'Lower Bench', 'The River'] },
            // The one legal drink in the arena, and everybody knows it.
            { name: 'The River', terrain: 'water', danger: 0.65, resources: 0.55, adjacent: ['The Wash', 'Lower Bench'] },
            { name: 'The Seeps', terrain: 'water', danger: 0.7, resources: 0.4, adjacent: ['Lower Bench'], features: { cover: 0.5, elevation: false, chokepoint: true } },
            { name: 'The South Rim', terrain: 'highland', danger: 0.5, resources: 0.25, adjacent: ['Lower Bench', 'The Butte'], features: { cover: 0.2, elevation: true, chokepoint: false } },
            // A dead end in the sky. Getting up costs the rope; there is no
            // second rope for getting down.
            { name: 'The Butte', terrain: 'highland', danger: 0.4, resources: 0.2, adjacent: ['The South Rim'], features: { cover: 0.3, elevation: true, chokepoint: true } },
        ]
    },
    {
        id: 'menagerie',
        name: 'The Menagerie',
        description: 'A zoo, opening. The keeper\'s release schedule is posted at the gate, and it is accurate — every enclosure in the park opens on time, in order, and everyone knows exactly when.',
        mutts: ['Raptors', 'The Troop', 'Constrictors & Vipers', 'The Bears', 'The Herd', 'The Cats', 'Quarantine'],
        events: ['The Schedule', 'Feeding Time', 'Ahead of Schedule'],
        law: 'cornucopiaRefills',
        effectVocab: {
            stripped: { label: 'cleaned out' },
            contaminated: { label: 'the reptile house', durationMult: 1.2 },
            blooming: { label: 'the arboretum' },
        },
        zones: [
            { name: 'The Cornucopia (The Plaza)', terrain: 'open', danger: 0.6, resources: 0.35, adjacent: ['The Feed Store', 'Big Cat Terrace', 'The Aviary', 'Elephant Paddock', 'Keeper\'s Yard'] },
            // The larder everything in the park can smell. The refill law is
            // this zone's whole personality.
            { name: 'The Feed Store', terrain: 'ruins', danger: 0.7, resources: 0.9, adjacent: ['The Cornucopia (The Plaza)', 'Keeper\'s Yard'], features: { cover: 0.5, elevation: false, chokepoint: true } },
            { name: 'Big Cat Terrace', terrain: 'open', danger: 0.75, resources: 0.25, adjacent: ['The Cornucopia (The Plaza)', 'The Primate Wood', 'Bear Moat'], features: { cover: 0.3, elevation: true, chokepoint: false } },
            { name: 'The Primate Wood', terrain: 'forest', danger: 0.55, resources: 0.6, adjacent: ['Big Cat Terrace', 'The Arboretum', 'Reptile House'] },
            { name: 'Reptile House', terrain: 'ruins', danger: 0.8, resources: 0.3, adjacent: ['The Primate Wood', 'The Aquarium'], features: { cover: 0.6, elevation: false, chokepoint: true } },
            { name: 'The Aviary', terrain: 'wetland', danger: 0.5, resources: 0.5, adjacent: ['The Cornucopia (The Plaza)', 'Elephant Paddock', 'The Aquarium'] },
            { name: 'Elephant Paddock', terrain: 'open', danger: 0.45, resources: 0.4, adjacent: ['The Cornucopia (The Plaza)', 'The Aviary', 'The Perimeter Fence'] },
            { name: 'The Aquarium', terrain: 'ruins', danger: 0.6, resources: 0.35, adjacent: ['Reptile House', 'The Aviary', 'Bear Moat'], features: { cover: 0.55, elevation: false, chokepoint: true } },
            { name: 'Bear Moat', terrain: 'water', danger: 0.7, resources: 0.45, adjacent: ['Big Cat Terrace', 'The Aquarium', 'Quarantine'] },
            { name: 'The Arboretum', terrain: 'forest', danger: 0.3, resources: 0.8, adjacent: ['The Primate Wood', 'Keeper\'s Yard'] },
            { name: 'Keeper\'s Yard', terrain: 'ruins', danger: 0.4, resources: 0.55, adjacent: ['The Cornucopia (The Plaza)', 'The Feed Store', 'The Arboretum', 'Quarantine'] },
            { name: 'The Perimeter Fence', terrain: 'open', danger: 0.5, resources: 0.15, adjacent: ['Elephant Paddock', 'Quarantine'] },
            // Unlisted contents. Last on the schedule for a reason.
            { name: 'Quarantine', terrain: 'ruins', danger: 0.9, resources: 0.5, adjacent: ['Bear Moat', 'Keeper\'s Yard', 'The Perimeter Fence'], features: { cover: 0.4, elevation: false, chokepoint: true } },
        ]
    },
    {
        id: 'storywood',
        name: 'The Story Wood',
        description: 'A forest of fairytale cottages, every chimney smoking, every door unlocked. Every one of them opens. Every one of them costs something. The wood is always slightly colder than it should be.',
        mutts: ['The Wolf', 'The Bramble', 'Ravens', 'Something in the Millpond', 'The Sisters'],
        events: ['The Bargain', 'The Telling Mist', 'The Path'],
        // The only medicine in this arena is a bargain, never an item.
        law: 'noHealing',
        effectVocab: {
            blooming: { label: 'the wood is generous' },
            fogbound: { label: 'the telling mist' },
            irradiated: { label: 'a bad bargain' },
        },
        zones: [
            { name: 'The Cornucopia (The Clearing)', terrain: 'open', danger: 0.55, resources: 0.35, adjacent: ['The Path', 'The Deep Wood', 'The Field of Stones'] },
            // The one honest road in the arena: low danger, and it goes
            // exactly where it says.
            { name: 'The Path', terrain: 'forest', danger: 0.2, resources: 0.3, adjacent: ['The Cornucopia (The Clearing)', 'The Woodcutter\'s Cottage', 'Grandmother\'s Cottage'] },
            { name: 'The Deep Wood', terrain: 'forest', danger: 0.7, resources: 0.6, adjacent: ['The Cornucopia (The Clearing)', 'The Gingerbread House', 'The Spinning House', 'The Bramble'], features: { cover: 0.8, elevation: false, chokepoint: false } },
            { name: 'The Gingerbread House', terrain: 'ruins', danger: 0.75, resources: 0.85, adjacent: ['The Deep Wood', 'The Bramble'], features: { cover: 0.6, elevation: false, chokepoint: true } },
            { name: 'The Woodcutter\'s Cottage', terrain: 'ruins', danger: 0.4, resources: 0.5, adjacent: ['The Path', 'The Millpond'] },
            { name: 'The Spinning House', terrain: 'ruins', danger: 0.6, resources: 0.4, adjacent: ['The Deep Wood', 'The Tower'], features: { cover: 0.5, elevation: false, chokepoint: true } },
            { name: 'The Millpond', terrain: 'water', danger: 0.6, resources: 0.5, adjacent: ['The Woodcutter\'s Cottage', 'The Well'] },
            { name: 'The Well', terrain: 'water', danger: 0.65, resources: 0.3, adjacent: ['The Millpond', 'The Field of Stones', 'Grandmother\'s Cottage'], features: { cover: 0.2, elevation: false, chokepoint: true } },
            { name: 'Grandmother\'s Cottage', terrain: 'ruins', danger: 0.5, resources: 0.55, adjacent: ['The Path', 'The Well'] },
            { name: 'The Bramble', terrain: 'forest', danger: 0.9, resources: 0.45, adjacent: ['The Deep Wood', 'The Gingerbread House'], features: { cover: 0.9, elevation: false, chokepoint: true } },
            { name: 'The Field of Stones', terrain: 'open', danger: 0.45, resources: 0.2, adjacent: ['The Cornucopia (The Clearing)', 'The Well', 'The Tower'] },
            // The Tower's bargain (locking somebody in) has no transit
            // machinery to hang on, so the Tower pays out in resources
            // instead: the best-stocked room in the wood, at the top of the
            // most obvious climb.
            { name: 'The Tower', terrain: 'ruins', danger: 0.55, resources: 0.8, adjacent: ['The Spinning House', 'The Field of Stones'], features: { cover: 0.4, elevation: true, chokepoint: true } },
        ]
    },
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

    // §8.3: the catalogue widened from 33 to ~50, spreading the special
    // properties (purifies/light/warmth/fishing/capacity/armour/poison)
    // across more of the table instead of one item each.
    // Water.
    { id: 'waterskin', name: 'Waterskin', type: 'water', value: 25, stack: 3 },
    { id: 'canteen', name: 'Steel Canteen', type: 'water', value: 30, stack: 2 },
    { id: 'iodine', name: 'Iodine Drops', type: 'medical', value: 45, purifies: true, stack: 2 },
    // Food.
    { id: 'dried-fruit', name: 'Dried Fruit', type: 'food', value: 12, spoilage: 8, stack: 3 },
    { id: 'groosling', name: 'Smoked Groosling', type: 'food', value: 25, spoilage: 5, stack: 2 },
    { id: 'crackers', name: 'District Crackers', type: 'food', value: 10, spoilage: 10, stack: 3 },
    { id: 'cheese', name: 'Goat Cheese', type: 'food', value: 18, spoilage: 4, stack: 2 },
    { id: 'lamb-stew', name: 'Capitol Lamb Stew', type: 'food', value: 40, spoilage: 2 },
    { id: 'hardtack', name: 'Hardtack Ration', type: 'food', value: 14, spoilage: 12, stack: 3 },
    // Medical.
    { id: 'bandages', name: 'Sterile Bandages', type: 'medical', value: 30, stack: 3 },
    { id: 'morphling', name: 'Morphling Vial', type: 'medical', value: 55 },
    // Tools and special properties, each subsystem's second carrier.
    { id: 'fishing-kit', name: 'Line and Hooks', type: 'tool', value: 25, fishing: true },
    { id: 'charcoal-filter', name: 'Charcoal Filter', type: 'tool', value: 35, purifies: true },
    { id: 'glow-stick', name: 'Chemical Glowlight', type: 'tool', value: 20, light: true },
    { id: 'thermal-cloak', name: 'Thermal Cloak', type: 'utility', value: 55, warmth: true },
    { id: 'bandolier', name: 'Leather Bandolier', type: 'utility', value: 22, capacity: 1 },
    { id: 'helmet', name: 'Padded Helmet', type: 'armour', value: 25, armour: 0.06, durability: 50, maxDurability: 50 },
    // Poison sources beyond the berry bushes — see POISONING.sources.
    { id: 'venom-vial', name: 'Venom Vial', type: 'utility', value: 35 },
    { id: 'venom-gland', name: 'Mutt Venom Gland', type: 'utility', value: 18 },
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
    // Tier one: what the ground gives an empty-handed tribute, keyed by terrain.
    // See `craft()` in `phases/dayNight.ts`. Every one of these is worse than
    // every weapon in `ITEMS`, which is the entire design constraint.
    { id: 'club', name: 'Cudgel', type: 'weapon', value: 8, durability: 35, weaponClass: 'melee', damage: 2 },
    { id: 'sharpstone', name: 'Sharpened Stone', type: 'weapon', value: 6, durability: 25, weaponClass: 'melee', damage: 1 },
    /** Marshland: a straight shaft and a fire-dried point. Reach, and nothing else. */
    { id: 'reedspear', name: 'Reed Spear', type: 'weapon', value: 7, durability: 20, weaponClass: 'thrown', damage: 2 },
    /** Ruins: the one thing a collapsed district is still full of. */
    { id: 'rebar', name: 'Length of Rebar', type: 'weapon', value: 10, durability: 40, weaponClass: 'melee', damage: 3 },

    // Tier two: costs a real resource rather than a turn. Still improvised,
    // still crude, but a tribute has given something up to hold it.
    /** Rope cut down to a pouch and two cords. The only ranged option in the tree. */
    { id: 'sling', name: 'Leather Sling', type: 'weapon', value: 7, durability: 25, weaponClass: 'ranged', damage: 2 },
    /** A cudgel and a night at a fire. The upgrade path out of tier one. */
    { id: 'stake', name: 'Fire-Hardened Stake', type: 'weapon', value: 11, durability: 40, weaponClass: 'melee', damage: 3 },
];
