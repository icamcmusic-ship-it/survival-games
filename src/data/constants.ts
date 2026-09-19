import { Arena, Item, GameConfig, Build } from '../models/types';
import { ROLLABLE_TRAITS } from './traits';
import { withExtraEdgeRules } from './arenaEdges';
import { NEW_ARENAS } from './arenasNew';

export const DEFAULT_GAME_CONFIG: GameConfig = {
    districtCount: 12,
    hazardRate: 1.0,
    betrayalRate: 1.0,
    sponsorGenerosity: 1.0,
    enableFeast: true,
    enableSanity: true,
    sanityDrainRate: 1,
    sanityRecoveryRate: 1,
    enableHallucinations: true,
    enableBreakdowns: true,
    sanityStart: 100,
    plainNames: false,
};

/**
 * §6 (requests): the legacy build ladder, in order, eleven rungs wide. Ordered
 * lightest to heaviest — several UI sites sort by index into this array.
 */
export const BUILDS: Build[] = [
    'Skeletal', 'Frail', 'Slight', 'Wiry', 'Lean', 'Average',
    'Athletic', 'Stocky', 'Burly', 'Muscular', 'Hulking',
];

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
        cornucopiaLayout: 'walled',
        restockBias: ['whetstone', 'rope', 'glow-stick', 'hardtack'],
        effectVocab: { flooded: { label: 'a sector tidal wave', severityMult: 1.25 } },
        name: 'The Clockwork Island',
        description: 'A shifting map layout divided into sectors, each unleashing a different horror at a specific hour.',
        mutts: ['Tick-Tock Monkeys', 'Lightning Birds', 'Acid Fog', 'Jabberjays', 'Reef Barracuda'],
        events: ['Sector Shift', 'Blood Rain', 'Tidal Wave'],
        law: 'cornucopiaRefills',
        // The climb to the Lightning Tree is a scramble up bare rock with a
        // storm generator at the top of it.
        edgeRules: { 'Sector 3 (Cliffs)|Sector 5 (Lightning Tree)': { kind: 'tolled', toll: { fatigue: 6 } } },
        zones: [
            { name: 'The Cornucopia', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['Sector 1 (Jungle)', 'Sector 2 (Beach)', 'Sector 3 (Cliffs)', 'Sector 4 (Swamp)', 'Sector 12 (Blood Rain)'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'Sector 1 (Jungle)', terrain: 'forest', danger: 0.5, resources: 0.7, adjacent: ['The Cornucopia', 'Sector 2 (Beach)', 'Sector 11 (Monkey Wood)'], features: { cover: 0.85, elevation: false, chokepoint: false, acoustics: 0.7, vertical: true } },
            { name: 'Sector 2 (Beach)', terrain: 'water', danger: 0.3, resources: 0.5, adjacent: ['The Cornucopia', 'Sector 1 (Jungle)', 'Sector 3 (Cliffs)'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'Sector 3 (Cliffs)', terrain: 'highland', danger: 0.7, resources: 0.2, adjacent: ['The Cornucopia', 'Sector 2 (Beach)', 'Sector 4 (Swamp)', 'Sector 5 (Lightning Tree)'], features: { cover: 0.2, elevation: true, chokepoint: true, acoustics: 1.35, vertical: true } },
            { name: 'Sector 4 (Swamp)', terrain: 'wetland', danger: 0.6, resources: 0.4, adjacent: ['The Cornucopia', 'Sector 3 (Cliffs)', 'Sector 6 (Insect Hollow)'], features: { cover: 0.6, elevation: false, chokepoint: false, acoustics: 0.75 } },
            { name: 'Sector 5 (Lightning Tree)', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['Sector 3 (Cliffs)', 'Sector 9 (Salt Reef)'], features: { cover: 0.15, elevation: true, chokepoint: false, shelterQuality: 0.1, acoustics: 1.3, vertical: true } },
            { name: 'Sector 6 (Insect Hollow)', terrain: 'wetland', danger: 0.8, resources: 0.35, adjacent: ['Sector 4 (Swamp)', 'Sector 7 (Dry Shelf)'], features: { cover: 0.65, elevation: false, chokepoint: true, acoustics: 0.75 } },
            { name: 'Sector 7 (Dry Shelf)', terrain: 'open', danger: 0.45, resources: 0.25, adjacent: ['Sector 6 (Insect Hollow)', 'Sector 9 (Salt Reef)', 'Sector 12 (Blood Rain)'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'Sector 9 (Salt Reef)', terrain: 'water', danger: 0.55, resources: 0.6, adjacent: ['Sector 5 (Lightning Tree)', 'Sector 7 (Dry Shelf)', 'Sector 11 (Monkey Wood)'], features: { cover: 0.2, elevation: false, chokepoint: true, waterSource: false, shelterQuality: 0.1 } },
            { name: 'Sector 11 (Monkey Wood)', terrain: 'forest', danger: 0.75, resources: 0.55, adjacent: ['Sector 1 (Jungle)', 'Sector 9 (Salt Reef)', 'Sector 12 (Blood Rain)'], features: { cover: 0.8, elevation: false, chokepoint: false, acoustics: 0.75, vertical: true } },
            { name: 'Sector 12 (Blood Rain)', terrain: 'ruins', danger: 0.7, resources: 0.2, adjacent: ['The Cornucopia', 'Sector 7 (Dry Shelf)', 'Sector 11 (Monkey Wood)'], features: { cover: 0.45, elevation: false, chokepoint: false, acoustics: 1.25 } },
        ]
    },
    {
        id: 'frozen',
        cornucopiaLayout: 'plate',
        // §5.2: nothing grows under a metre of snow, and the dark is the thing
        // that actually kills up here — the two rules the arena's own
        // description has always claimed and never enforced.
        laws: ['noForage', 'deadlyNight'],
        // §5.7: the Frozen Wasteland's horn leans toward warmth.
        restockBias: ['sleeping-bag', 'thermal-cloak', 'matches', 'lamb-stew'],
        name: 'The Frozen Wasteland',
        description: 'Lethal cold and blizzards. Finding shelter and warmth is as important as fighting.',
        mutts: ['Ice Wolves', 'Snow Camouflage Snakes', 'Frostbite Beetles', 'Snowblind Owls'],
        events: ['Blizzard', 'Avalanche', 'Thin Ice Collapse'],
        sponsorMultiplier: 1.2,
        // A freeze here is the arena doing what it was built for.
        effectVocab: { frozen: { label: 'a blizzard whiteout', severityMult: 1.2 } },
        edgeRules: { 'Frozen Lake|The Meltwater Channel': { kind: 'timeGated', gatedTime: 'day' } },
        zones: [
            { name: 'The Cornucopia', terrain: 'open', danger: 0.5, resources: 0.3, adjacent: ['Frozen Lake', 'Snowy Pine Forest', 'The Windbreak'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 0.75 } },
            { name: 'Frozen Lake', terrain: 'water', danger: 0.7, resources: 0.4, adjacent: ['The Cornucopia', 'Ice Caves', 'The Meltwater Channel'], features: { cover: 0.05, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 1.25 } },
            { name: 'Ice Caves', terrain: 'ruins', danger: 0.4, resources: 0.2, adjacent: ['Frozen Lake', 'Glacier Peak', 'The Crevasse Field'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.85, acoustics: 1.4, vertical: true } },
            // The one real larder in a starving map — the doc's terrain-skew
            // note for this arena raises the forest resource ceiling to 0.9.
            { name: 'Snowy Pine Forest', terrain: 'forest', danger: 0.3, resources: 0.85, adjacent: ['The Cornucopia', 'Glacier Peak', 'The Trapper\'s Cabin'], features: { cover: 0.8, elevation: false, chokepoint: false, acoustics: 0.65 } },
            { name: 'Glacier Peak', terrain: 'highland', danger: 0.8, resources: 0.1, adjacent: ['Ice Caves', 'Snowy Pine Forest', 'The Crevasse Field'], features: { cover: 0.1, elevation: true, chokepoint: false, shelterQuality: 0.05, acoustics: 1.25, vertical: true } },
            { name: 'The Windbreak', terrain: 'open', danger: 0.55, resources: 0.15, adjacent: ['The Cornucopia', 'The Trapper\'s Cabin', 'The Meltwater Channel'], features: { cover: 0.3, elevation: false, chokepoint: true, shelterQuality: 0.35 } },
            { name: 'The Trapper\'s Cabin', terrain: 'ruins', danger: 0.35, resources: 0.55, adjacent: ['Snowy Pine Forest', 'The Windbreak', 'Buried Timberline'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 0.75 } },
            { name: 'The Crevasse Field', terrain: 'highland', danger: 0.9, resources: 0.05, adjacent: ['Ice Caves', 'Glacier Peak'], features: { cover: 0.15, elevation: true, chokepoint: true, shelterQuality: 0.05, acoustics: 1.3, vertical: true } },
            { name: 'The Meltwater Channel', terrain: 'water', danger: 0.6, resources: 0.5, adjacent: ['Frozen Lake', 'The Windbreak', 'Buried Timberline'], features: { cover: 0.2, elevation: false, chokepoint: true, shelterQuality: 0.1 } },
            { name: 'Buried Timberline', terrain: 'forest', danger: 0.45, resources: 0.8, adjacent: ['The Trapper\'s Cabin', 'The Meltwater Channel'], features: { cover: 0.75, elevation: false, chokepoint: false, acoustics: 0.6 } },
        ]
    },
    {
        id: 'concrete',
        cornucopiaLayout: 'walled',
        restockBias: ['helmet', 'bandages', 'canteen', 'crackers'],
        effectVocab: { quaking: { label: 'a structural failure', severityMult: 1.3 } },
        // §5.2: a fight between two tower blocks is heard by the whole city.
        law: 'openMic',
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
            { name: 'The Cornucopia (City Square)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['Abandoned Subway', 'Skyscraper Ruins', 'Overgrown Park', 'The Flooded Underpass'], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.1, acoustics: 1.25 } },
            { name: 'Abandoned Subway', terrain: 'ruins', danger: 0.7, resources: 0.3, adjacent: ['The Cornucopia (City Square)', 'Industrial District', 'The Flooded Underpass', 'The Storm Drains'], features: { cover: 0.55, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 1.45, vertical: true } },
            { name: 'Skyscraper Ruins', terrain: 'highland', danger: 0.85, resources: 0.4, adjacent: ['The Cornucopia (City Square)', 'Industrial District', 'The Rooftop Gardens'], features: { cover: 0.5, elevation: true, chokepoint: false, shelterQuality: 0.7, acoustics: 1.3, vertical: true } },
            { name: 'Overgrown Park', terrain: 'forest', danger: 0.3, resources: 0.7, adjacent: ['The Cornucopia (City Square)', 'Industrial District', 'The Reservoir'], features: { cover: 0.7, elevation: false, chokepoint: false, acoustics: 0.75 } },
            { name: 'Industrial District', terrain: 'ruins', danger: 0.6, resources: 0.4, adjacent: ['Abandoned Subway', 'Skyscraper Ruins', 'Overgrown Park', 'The Rail Yard'], features: { cover: 0.5, elevation: false, chokepoint: false, acoustics: 1.3, vertical: true } },
            { name: 'The Flooded Underpass', terrain: 'water', danger: 0.65, resources: 0.35, adjacent: ['The Cornucopia (City Square)', 'Abandoned Subway', 'The Reservoir', 'The Storm Drains'], features: { cover: 0.3, elevation: false, chokepoint: true, waterSource: false, acoustics: 1.4 } },
            { name: 'The Rooftop Gardens', terrain: 'forest', danger: 0.45, resources: 0.65, adjacent: ['Skyscraper Ruins', 'The Rail Yard', 'The Botanical Atrium'], features: { cover: 0.6, elevation: true, chokepoint: false, vertical: true } },
            { name: 'The Reservoir', terrain: 'water', danger: 0.4, resources: 0.6, adjacent: ['Overgrown Park', 'The Flooded Underpass', 'The Botanical Atrium'], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'The Rail Yard', terrain: 'open', danger: 0.55, resources: 0.25, adjacent: ['Industrial District', 'The Rooftop Gardens', 'The Clocktower', 'The Collapsed Overpass'], features: { cover: 0.3, elevation: false, chokepoint: false, shelterQuality: 0.2 } },
            // The outer districts: a shattered ring road, a glasshouse gone
            // feral, and the storm sewers under everything.
            { name: 'The Collapsed Overpass', terrain: 'highland', danger: 0.75, resources: 0.2, adjacent: ['The Rail Yard', 'The Storm Drains'], features: { cover: 0.25, elevation: true, chokepoint: true, acoustics: 1.25, vertical: true } },
            { name: 'The Botanical Atrium', terrain: 'forest', danger: 0.35, resources: 0.75, adjacent: ['The Rooftop Gardens', 'The Reservoir'], features: { cover: 0.75, elevation: false, chokepoint: false, shelterQuality: 0.85, acoustics: 1.25, vertical: true } },
            { name: 'The Storm Drains', terrain: 'wetland', danger: 0.6, resources: 0.35, adjacent: ['Abandoned Subway', 'The Flooded Underpass', 'The Collapsed Overpass'], features: { cover: 0.5, elevation: false, chokepoint: true, waterSource: false, acoustics: 1.5 } },
            // A dead end (one edge) and a pure ambush zone by design — high
            // danger, kept low on resources so it's never worth the risk as bait.
            { name: 'The Clocktower', terrain: 'highland', danger: 0.9, resources: 0.15, adjacent: ['The Rail Yard'], features: { cover: 0.35, elevation: true, chokepoint: true, shelterQuality: 0.75, acoustics: 1.35, vertical: true } },
        ]
    },
    {
        id: 'toxic',
        cornucopiaLayout: 'island',
        // §5.2: everything here is wet and everything here is poisoned. The
        // same already-tested stack the Drowned Reef carries, which is the
        // cheapest variety available — a law that exists in one arena is a law
        // nobody meets.
        laws: ['fireImpossible', 'noHealing'],
        // §5.7: a bog arena's drop is what makes its water and air survivable.
        restockBias: ['tablets', 'antidote', 'charcoal-filter', 'iodine'],
        name: 'The Toxic Swamps',
        description: 'Hallucinogenic gas and poison risk. The water is mostly undrinkable without purification.',
        mutts: ['Venomous Toads', 'Leech Swarms', 'Camouflaged Crocodiles', 'Bloatflies', 'Sump Waders'],
        events: ['Hallucinogenic Spores', 'Methane Explosion', 'Quicksand Sinkhole'],
        // The gas is this arena's whole premise — contamination hits harder
        // and hangs around longer here than anywhere.
        effectVocab: { contaminated: { label: 'a methane bloom off the bog', severityMult: 1.2, durationMult: 1.25 } },
        // The bog crossing is only readable while there is light to read it by.
        edgeRules: { 'Glowing Bog|Murky Waters': { kind: 'timeGated', gatedTime: 'day' } },
        // §5.5: trimmed to eight zones — a tight, claustrophobic swamp rather
        // than another ten-zone standard shape.
        zones: [
            { name: 'The Cornucopia', terrain: 'open', danger: 0.5, resources: 0.3, adjacent: ['Murky Waters', 'Dead Tree Grove', 'The Causeway'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            // Undrinkable and barely worth foraging — the danger carries this
            // terrain here, not the resources.
            { name: 'Murky Waters', terrain: 'water', danger: 0.7, resources: 0.15, adjacent: ['The Cornucopia', 'Glowing Bog', 'The Reed Maze'], features: { cover: 0.3, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.1, acoustics: 0.75 } },
            { name: 'Dead Tree Grove', terrain: 'forest', danger: 0.4, resources: 0.5, adjacent: ['The Cornucopia', 'Ruined Shacks', 'The Cypress Stand'], features: { cover: 0.55, elevation: false, chokepoint: false, acoustics: 1.25, vertical: true } },
            { name: 'Glowing Bog', terrain: 'wetland', danger: 0.8, resources: 0.6, adjacent: ['Murky Waters', 'Ruined Shacks'], features: { cover: 0.6, elevation: false, chokepoint: false, waterSource: false, acoustics: 0.75 } },
            { name: 'Ruined Shacks', terrain: 'ruins', danger: 0.3, resources: 0.4, adjacent: ['Dead Tree Grove', 'Glowing Bog'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.7 } },
            { name: 'The Causeway', terrain: 'open', danger: 0.55, resources: 0.2, adjacent: ['The Cornucopia', 'The Reed Maze', 'The Cypress Stand'], features: { cover: 0.1, elevation: false, chokepoint: true, shelterQuality: 0.1 } },
            { name: 'The Reed Maze', terrain: 'wetland', danger: 0.6, resources: 0.55, adjacent: ['Murky Waters', 'The Causeway'], features: { cover: 0.85, elevation: false, chokepoint: true, waterSource: false, acoustics: 0.7 } },
            { name: 'The Cypress Stand', terrain: 'forest', danger: 0.35, resources: 0.75, adjacent: ['Dead Tree Grove', 'The Causeway'], features: { cover: 0.8, elevation: false, chokepoint: false, acoustics: 0.75, vertical: true } },
        ]
    },
    {
        id: 'solar',
        cornucopiaLayout: 'plate',
        // §5.7: in a desert the drop is water and shade, in that order.
        restockBias: ['canteen', 'waterskin', 'tablets', 'iodine'],
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
            { name: 'The Cornucopia', terrain: 'open', danger: 0.5, resources: 0.3, adjacent: ['Endless Dunes', 'Rocky Outcrop', 'The Bone Road'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.05 } },
            { name: 'Endless Dunes', terrain: 'open', danger: 0.7, resources: 0.05, adjacent: ['The Cornucopia', 'Dried Oasis', 'The Glass Sea'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 0.75 } },
            { name: 'Canyon Shadows', terrain: 'highland', danger: 0.4, resources: 0.4, adjacent: ['Dried Oasis', 'Rocky Outcrop', 'The Slot Canyon'], features: { cover: 0.5, elevation: false, chokepoint: true, shelterQuality: 0.5, acoustics: 1.45, vertical: true } },
            { name: 'Dried Oasis', terrain: 'wetland', danger: 0.3, resources: 0.65, adjacent: ['Endless Dunes', 'Canyon Shadows', 'The Palm Ruin'], features: { cover: 0.5, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.4 } },
            { name: 'Rocky Outcrop', terrain: 'highland', danger: 0.6, resources: 0.3, adjacent: ['The Cornucopia', 'Canyon Shadows', 'The Bone Road'], features: { cover: 0.35, elevation: true, chokepoint: false, acoustics: 1.25, vertical: true } },
            { name: 'The Bone Road', terrain: 'ruins', danger: 0.55, resources: 0.25, adjacent: ['The Cornucopia', 'Rocky Outcrop', 'The Glass Sea'], features: { cover: 0.2, elevation: false, chokepoint: true, shelterQuality: 0.1 } },
            { name: 'The Glass Sea', terrain: 'open', danger: 0.85, resources: 0.05, adjacent: ['Endless Dunes', 'The Bone Road'], features: { cover: 0.05, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 1.25 } },
            { name: 'The Slot Canyon', terrain: 'ruins', danger: 0.5, resources: 0.35, adjacent: ['Canyon Shadows', 'The Seep'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.6, acoustics: 1.55, vertical: true } },
            { name: 'The Palm Ruin', terrain: 'forest', danger: 0.35, resources: 0.7, adjacent: ['Dried Oasis', 'The Seep'], features: { cover: 0.6, elevation: false, chokepoint: false, shelterQuality: 0.6 } },
            { name: 'The Seep', terrain: 'water', danger: 0.45, resources: 0.7, adjacent: ['The Slot Canyon', 'The Palm Ruin'], features: { cover: 0.4, elevation: false, chokepoint: true, waterSource: true } },
        ]
    },
    {
        id: 'ashfall',
        cornucopiaLayout: 'plate',
        restockBias: ['charcoal-filter', 'thermal-cloak', 'iodine', 'hardtack'],
        // §5.2: no parachute finds the ground through that much falling ash.
        law: 'noSponsors',
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
            { name: 'The Cornucopia (Caldera Floor)', terrain: 'open', danger: 0.6, resources: 0.25, adjacent: ['Cinder Fields', 'The Obsidian Maze', 'Sulphur Springs'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.1, acoustics: 0.75 } },
            { name: 'Cinder Fields', terrain: 'open', danger: 0.5, resources: 0.15, adjacent: ['The Cornucopia (Caldera Floor)', 'Ashen Woods', 'Sulphur Springs', 'The Scoria Slope'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 0.75 } },
            { name: 'Ashen Woods', terrain: 'forest', danger: 0.4, resources: 0.6, adjacent: ['Cinder Fields', 'The Obsidian Maze', 'The Fern Gully'], features: { cover: 0.6, elevation: false, chokepoint: false, acoustics: 0.7 } },
            { name: 'The Obsidian Maze', terrain: 'ruins', danger: 0.75, resources: 0.3, adjacent: ['The Cornucopia (Caldera Floor)', 'Ashen Woods', 'Magma Vents'], features: { cover: 0.7, elevation: false, chokepoint: true, shelterQuality: 0.6, acoustics: 1.4 } },
            { name: 'Sulphur Springs', terrain: 'water', danger: 0.55, resources: 0.5, adjacent: ['The Cornucopia (Caldera Floor)', 'Cinder Fields', 'Magma Vents'], features: { cover: 0.2, elevation: false, chokepoint: false, waterSource: false } },
            { name: 'Magma Vents', terrain: 'highland', danger: 0.9, resources: 0.1, adjacent: ['The Obsidian Maze', 'Sulphur Springs', 'The Rim Path'], features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.15, acoustics: 1.25, vertical: true } },
            { name: 'The Scoria Slope', terrain: 'highland', danger: 0.7, resources: 0.1, adjacent: ['Cinder Fields', 'The Rim Path'], features: { cover: 0.15, elevation: true, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'The Fern Gully', terrain: 'wetland', danger: 0.35, resources: 0.75, adjacent: ['Ashen Woods', 'The Steam Caves'], features: { cover: 0.7, elevation: false, chokepoint: true, acoustics: 0.75 } },
            { name: 'The Rim Path', terrain: 'highland', danger: 0.8, resources: 0.15, adjacent: ['Magma Vents', 'The Scoria Slope', 'The Steam Caves'], features: { cover: 0.1, elevation: true, chokepoint: true, shelterQuality: 0.05, vertical: true } },
            { name: 'The Steam Caves', terrain: 'ruins', danger: 0.6, resources: 0.4, adjacent: ['The Fern Gully', 'The Rim Path'], features: { cover: 0.7, elevation: false, chokepoint: true, shelterQuality: 0.85, acoustics: 1.35, vertical: true } },
        ]
    },
    {
        id: 'tempest',
        cornucopiaLayout: 'island',
        // §5.2: nothing stays lit in that wind and nothing can be dropped into it.
        laws: ['fireImpossible', 'noSponsors'],
        // §5.7: a flooded arena's horn leans toward water gear.
        restockBias: ['net', 'fishing-kit', 'rope', 'waterskin'],
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
            { name: 'The Cornucopia (Breakwater)', terrain: 'open', danger: 0.65, resources: 0.3, adjacent: ['Flooded Terraces', 'The Lighthouse', 'Kelp Shallows'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.05 } },
            { name: 'Flooded Terraces', terrain: 'wetland', danger: 0.5, resources: 0.6, adjacent: ['The Cornucopia (Breakwater)', 'Mangrove Sprawl', 'The Salt Marsh', 'The Storm Barrens'], features: { cover: 0.3, elevation: false, chokepoint: false, waterSource: false, vertical: true } },
            { name: 'The Lighthouse', terrain: 'highland', danger: 0.7, resources: 0.2, adjacent: ['The Cornucopia (Breakwater)', 'Wreck Graveyard', 'The Cliff Stair'], features: { cover: 0.3, elevation: true, chokepoint: true, shelterQuality: 0.85, acoustics: 1.4, vertical: true } },
            { name: 'Kelp Shallows', terrain: 'water', danger: 0.45, resources: 0.65, adjacent: ['The Cornucopia (Breakwater)', 'Mangrove Sprawl', 'Wreck Graveyard'], features: { cover: 0.3, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.05 } },
            { name: 'Mangrove Sprawl', terrain: 'forest', danger: 0.35, resources: 0.7, adjacent: ['Flooded Terraces', 'Kelp Shallows', 'The Boathouse', 'The Storm Barrens'], features: { cover: 0.85, elevation: false, chokepoint: false, acoustics: 0.7, vertical: true } },
            { name: 'Wreck Graveyard', terrain: 'ruins', danger: 0.8, resources: 0.4, adjacent: ['The Lighthouse', 'Kelp Shallows', 'The Tidal Cave'], features: { cover: 0.6, elevation: false, chokepoint: false, acoustics: 1.3, vertical: true } },
            { name: 'The Salt Marsh', terrain: 'wetland', danger: 0.55, resources: 0.5, adjacent: ['Flooded Terraces', 'The Boathouse', 'The Drowned Quarter'], features: { cover: 0.5, elevation: false, chokepoint: false, waterSource: false, acoustics: 0.75 } },
            { name: 'The Cliff Stair', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The Lighthouse', 'The Tidal Cave', 'The Gull Roost'], features: { cover: 0.15, elevation: true, chokepoint: true, acoustics: 1.4, vertical: true } },
            { name: 'The Boathouse', terrain: 'ruins', danger: 0.4, resources: 0.55, adjacent: ['Mangrove Sprawl', 'The Salt Marsh', 'The Drowned Quarter'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.85 } },
            { name: 'The Tidal Cave', terrain: 'water', danger: 0.75, resources: 0.45, adjacent: ['Wreck Graveyard', 'The Cliff Stair', 'The Gull Roost'], features: { cover: 0.7, elevation: false, chokepoint: true, waterSource: false, shelterQuality: 0.7, acoustics: 1.5 } },
            // The far end of the coast: a drowned town, a bare headland, and
            // the one high roost the storm never quite reaches.
            { name: 'The Drowned Quarter', terrain: 'ruins', danger: 0.6, resources: 0.5, adjacent: ['The Salt Marsh', 'The Boathouse'], features: { cover: 0.55, elevation: false, chokepoint: false, acoustics: 1.25, vertical: true } },
            { name: 'The Storm Barrens', terrain: 'open', danger: 0.7, resources: 0.15, adjacent: ['Flooded Terraces', 'Mangrove Sprawl'], features: { cover: 0.05, elevation: false, chokepoint: false, shelterQuality: 0.05 } },
            { name: 'The Gull Roost', terrain: 'highland', danger: 0.55, resources: 0.35, adjacent: ['The Cliff Stair', 'The Tidal Cave'], features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.1 } },
        ]
    },
    {
        id: 'saltflats',
        cornucopiaLayout: 'plate',
        restockBias: ['waterskin', 'canteen', 'iodine', 'thermal-cloak'],
        effectVocab: { stripped: { label: 'the mirror glare', severityMult: 1.2, durationMult: 1.2 } },
        // §5.2: a salt pan surrounded by water, none of it drinkable. The one
        // seep is in the scrub, and everybody works that out on day two.
        law: 'noWaterExceptZone',
        lawZone: 'Scrub Hollow',
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
            { name: 'The Cornucopia (Salt Pan)', terrain: 'open', danger: 0.6, resources: 0.2, adjacent: ['The Hexagon Flats', 'Brine Pools', 'The Boneyard'], features: { cover: 0.05, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 1.25 } },
            { name: 'The Hexagon Flats', terrain: 'open', danger: 0.7, resources: 0.05, adjacent: ['The Cornucopia (Salt Pan)', 'Crystal Spires'], features: { cover: 0.05, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 1.25 } },
            { name: 'Brine Pools', terrain: 'water', danger: 0.5, resources: 0.45, adjacent: ['The Cornucopia (Salt Pan)', 'The Boneyard', 'Crystal Spires'], features: { cover: 0.1, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.05 } },
            { name: 'The Boneyard', terrain: 'ruins', danger: 0.45, resources: 0.35, adjacent: ['The Cornucopia (Salt Pan)', 'Brine Pools', 'Scrub Hollow'], features: { cover: 0.5, elevation: false, chokepoint: true, shelterQuality: 0.55, acoustics: 1.3, vertical: true } },
            { name: 'Crystal Spires', terrain: 'highland', danger: 0.8, resources: 0.15, adjacent: ['The Hexagon Flats', 'Brine Pools', 'The Evaporation Pans'], features: { cover: 0.4, elevation: true, chokepoint: false, shelterQuality: 0.3, acoustics: 1.45, vertical: true } },
            { name: 'Scrub Hollow', terrain: 'forest', danger: 0.3, resources: 0.6, adjacent: ['The Boneyard', 'The Evaporation Pans'], features: { cover: 0.6, elevation: false, chokepoint: false, shelterQuality: 0.5, acoustics: 0.75 } },
            { name: 'The Evaporation Pans', terrain: 'water', danger: 0.55, resources: 0.4, adjacent: ['Crystal Spires', 'Scrub Hollow'], features: { cover: 0.05, elevation: false, chokepoint: true, waterSource: false, shelterQuality: 0.05 } },
        ]
    },
    {
        id: 'sporefields',
        cornucopiaLayout: 'plate',
        restockBias: ['antidote', 'tablets', 'charcoal-filter', 'crackers'],
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
            { name: 'The Cornucopia (Ring of Caps)', terrain: 'open', danger: 0.55, resources: 0.4, adjacent: ['The Glowcap Wood', 'Rot Hollow', 'Mycelium Steps'], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'The Glowcap Wood', terrain: 'forest', danger: 0.4, resources: 0.85, adjacent: ['The Cornucopia (Ring of Caps)', 'Spore Marsh', 'The Shelf Terraces'], features: { cover: 0.85, elevation: false, chokepoint: false, acoustics: 0.65, vertical: true } },
            { name: 'Rot Hollow', terrain: 'wetland', danger: 0.7, resources: 0.55, adjacent: ['The Cornucopia (Ring of Caps)', 'Spore Marsh', 'The Fruiting Body'], features: { cover: 0.7, elevation: false, chokepoint: true, acoustics: 0.6 } },
            { name: 'Mycelium Steps', terrain: 'highland', danger: 0.6, resources: 0.3, adjacent: ['The Cornucopia (Ring of Caps)', 'The Fruiting Body', 'The Blight Scar'], features: { cover: 0.4, elevation: true, chokepoint: false, acoustics: 0.75, vertical: true } },
            { name: 'Spore Marsh', terrain: 'water', danger: 0.65, resources: 0.5, adjacent: ['The Glowcap Wood', 'Rot Hollow', 'The Cold Cellar'], features: { cover: 0.5, elevation: false, chokepoint: false, waterSource: false, acoustics: 0.7 } },
            { name: 'The Fruiting Body', terrain: 'ruins', danger: 0.85, resources: 0.45, adjacent: ['Rot Hollow', 'Mycelium Steps'], features: { cover: 0.75, elevation: false, chokepoint: true, shelterQuality: 0.85, acoustics: 0.7, vertical: true } },
            { name: 'The Shelf Terraces', terrain: 'highland', danger: 0.5, resources: 0.6, adjacent: ['The Glowcap Wood', 'The Blight Scar'], features: { cover: 0.45, elevation: true, chokepoint: false, vertical: true } },
            { name: 'The Cold Cellar', terrain: 'ruins', danger: 0.35, resources: 0.7, adjacent: ['Spore Marsh', 'The Deadfall'], features: { cover: 0.7, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 1.3 } },
            { name: 'The Blight Scar', terrain: 'open', danger: 0.75, resources: 0.1, adjacent: ['Mycelium Steps', 'The Shelf Terraces', 'The Deadfall'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.05 } },
            { name: 'The Deadfall', terrain: 'forest', danger: 0.45, resources: 0.65, adjacent: ['The Cold Cellar', 'The Blight Scar'], features: { cover: 0.8, elevation: false, chokepoint: true, acoustics: 0.7 } },
        ]
    },
    {
        id: 'canopy',
        cornucopiaLayout: 'island',
        restockBias: ['rope', 'bracers', 'fishing-kit', 'dried-fruit'],
        effectVocab: { fogbound: { label: 'the understory fog', durationMult: 1.3 } },
        // §5.2: `oneWayBorders` was declared by no arena at all — a law with a
        // tested enforcement site and nowhere to happen. A hanging garden is
        // exactly where it belongs: every route is a drop to the next bough,
        // and nothing that goes down comes back up the way it went.
        law: 'oneWayBorders',
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
            { name: 'The Cornucopia (Great Bough)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['The Rope Bridges', 'Orchid Terraces', 'The Undercanopy'], features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.15, vertical: true } },
            { name: 'The Rope Bridges', terrain: 'highland', danger: 0.8, resources: 0.15, adjacent: ['The Cornucopia (Great Bough)', 'The Crown', 'Orchid Terraces', 'The Strangler Fig'], features: { cover: 0.05, elevation: true, chokepoint: true, shelterQuality: 0.05, acoustics: 1.25 } },
            { name: 'Orchid Terraces', terrain: 'forest', danger: 0.35, resources: 0.8, adjacent: ['The Cornucopia (Great Bough)', 'The Rope Bridges', 'Cistern Hollows'], features: { cover: 0.7, elevation: true, chokepoint: false, acoustics: 0.75, vertical: true } },
            { name: 'The Undercanopy', terrain: 'wetland', danger: 0.65, resources: 0.55, adjacent: ['The Cornucopia (Great Bough)', 'Cistern Hollows', 'The Root Cage'], features: { cover: 0.8, elevation: false, chokepoint: false, waterSource: false, acoustics: 0.65, vertical: true } },
            { name: 'Cistern Hollows', terrain: 'water', danger: 0.4, resources: 0.6, adjacent: ['Orchid Terraces', 'The Undercanopy', 'The Epiphyte Shelf'], features: { cover: 0.5, elevation: false, chokepoint: true, waterSource: true, shelterQuality: 0.7, acoustics: 1.35 } },
            { name: 'The Crown', terrain: 'highland', danger: 0.85, resources: 0.2, adjacent: ['The Rope Bridges', 'The Wind Gap'], features: { cover: 0.3, elevation: true, chokepoint: false, shelterQuality: 0.1, acoustics: 1.25, vertical: true } },
            { name: 'The Strangler Fig', terrain: 'ruins', danger: 0.7, resources: 0.4, adjacent: ['The Rope Bridges', 'The Wind Gap', 'The Root Cage'], features: { cover: 0.75, elevation: true, chokepoint: true, shelterQuality: 0.8, acoustics: 0.75, vertical: true } },
            { name: 'The Root Cage', terrain: 'ruins', danger: 0.55, resources: 0.5, adjacent: ['The Undercanopy', 'The Strangler Fig'], features: { cover: 0.85, elevation: false, chokepoint: true, shelterQuality: 0.85, acoustics: 0.7, vertical: true } },
            { name: 'The Epiphyte Shelf', terrain: 'forest', danger: 0.45, resources: 0.75, adjacent: ['Cistern Hollows', 'The Wind Gap'], features: { cover: 0.7, elevation: true, chokepoint: false, vertical: true } },
            { name: 'The Wind Gap', terrain: 'open', danger: 0.75, resources: 0.15, adjacent: ['The Crown', 'The Strangler Fig', 'The Epiphyte Shelf'], features: { cover: 0.05, elevation: true, chokepoint: true, shelterQuality: 0.05, acoustics: 1.25 } },
        ]
    },
    {
        id: 'vault',
        restockBias: ['glow-stick', 'lantern', 'crackers', 'tablets'],
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
        // §5: the horn is in a service bay with one way in. It is a killing box and it looks like one.
        cornucopiaLayout: 'walled',
        zones: [
            { name: 'The Cornucopia (Atrium)', terrain: 'open', danger: 0.65, resources: 0.3, adjacent: ['Service Tunnels', 'The Hydroponics Bay', 'Reactor Level'], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.6, acoustics: 1.5, vertical: true } },
            { name: 'Service Tunnels', terrain: 'ruins', danger: 0.7, resources: 0.25, adjacent: ['The Cornucopia (Atrium)', 'The Cistern', 'Dormitory Block', 'The Ventilation Shafts'], features: { cover: 0.5, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 1.45 } },
            { name: 'The Hydroponics Bay', terrain: 'forest', danger: 0.3, resources: 0.85, adjacent: ['The Cornucopia (Atrium)', 'The Cistern', 'The Seed Vault'], features: { cover: 0.7, elevation: false, chokepoint: false, waterSource: true, shelterQuality: 0.85, acoustics: 0.75, vertical: true } },
            { name: 'Reactor Level', terrain: 'highland', danger: 0.9, resources: 0.2, adjacent: ['The Cornucopia (Atrium)', 'Dormitory Block', 'The Turbine Hall'], features: { cover: 0.4, elevation: true, chokepoint: true, shelterQuality: 0.7, acoustics: 1.4, vertical: true } },
            { name: 'The Cistern', terrain: 'water', danger: 0.5, resources: 0.5, adjacent: ['Service Tunnels', 'The Hydroponics Bay', 'The Sump'], features: { cover: 0.2, elevation: false, chokepoint: true, waterSource: true, acoustics: 1.55 } },
            { name: 'Dormitory Block', terrain: 'ruins', danger: 0.4, resources: 0.4, adjacent: ['Service Tunnels', 'Reactor Level', 'The Commissary'], features: { cover: 0.7, elevation: false, chokepoint: false, shelterQuality: 0.9, acoustics: 0.75 } },
            { name: 'The Ventilation Shafts', terrain: 'highland', danger: 0.75, resources: 0.1, adjacent: ['Service Tunnels', 'The Turbine Hall'], features: { cover: 0.4, elevation: true, chokepoint: true, acoustics: 1.5, vertical: true } },
            { name: 'The Seed Vault', terrain: 'ruins', danger: 0.35, resources: 0.7, adjacent: ['The Hydroponics Bay', 'The Commissary'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.95, acoustics: 1.3 } },
            { name: 'The Turbine Hall', terrain: 'ruins', danger: 0.8, resources: 0.3, adjacent: ['Reactor Level', 'The Ventilation Shafts', 'The Sump'], features: { cover: 0.35, elevation: false, chokepoint: false, acoustics: 1.55, vertical: true } },
            { name: 'The Commissary', terrain: 'open', danger: 0.45, resources: 0.6, adjacent: ['Dormitory Block', 'The Seed Vault'], features: { cover: 0.4, elevation: false, chokepoint: false, shelterQuality: 0.8 } },
            { name: 'The Sump', terrain: 'water', danger: 0.7, resources: 0.35, adjacent: ['The Cistern', 'The Turbine Hall'], features: { cover: 0.3, elevation: false, chokepoint: true, waterSource: false, acoustics: 1.35 } },
        ]
    },
    {
        // §8.3: deliberately a different shape — six zones, no water terrain
        // at all, and the smallest bestiary in the game: one apex predator and
        // the mine's own rats. Claustrophobia as a design, not a smaller copy.
        id: 'warren',
        restockBias: ['lantern', 'glow-stick', 'helmet', 'hardtack'],
        effectVocab: { contaminated: { label: 'rock dust in the galleries', severityMult: 1.15, durationMult: 1.3 } },
        name: 'The Warren',
        description: 'A mine that was old before Panem was young: six chambers of tunnel and dust, no open sky, and no standing water anywhere. Everything a tribute drinks down here, somebody carried in. And something else lives in the dark.',
        mutts: ['The Warden', 'Pit Rats'],
        events: ['Tunnel Collapse', 'Bad Air', 'The Shifting'],
        // No `lawZone` is deliberate: there is no exception, nowhere down
        // here has water at all — see the description above.
        law: 'noWaterExceptZone',
        // §5: the horn is at the bottom of the shaft, walled by the workings themselves.
        cornucopiaLayout: 'walled',
        zones: [
            { name: 'The Cornucopia (The Hub)', terrain: 'open', danger: 0.6, resources: 0.45, adjacent: ['The Choke', 'The Root Gardens', 'The Dust Flats'], features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.7, acoustics: 1.4 } },
            { name: 'The Choke', terrain: 'ruins', danger: 0.8, resources: 0.2, adjacent: ['The Cornucopia (The Hub)', 'The Old Workings', 'The Collapsed Galleries'], features: { cover: 0.5, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 1.5 } },
            // The only reliable food source in a six-zone map with no water
            // anywhere — worth pushing higher than any other arena's forest.
            { name: 'The Root Gardens', terrain: 'forest', danger: 0.3, resources: 0.92, adjacent: ['The Cornucopia (The Hub)', 'The Collapsed Galleries'], features: { cover: 0.75, elevation: false, chokepoint: false, shelterQuality: 0.8, acoustics: 0.7 } },
            { name: 'The Dust Flats', terrain: 'open', danger: 0.45, resources: 0.3, adjacent: ['The Cornucopia (The Hub)', 'The Old Workings'], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.5, acoustics: 0.75 } },
            { name: 'The Old Workings', terrain: 'highland', danger: 0.7, resources: 0.35, adjacent: ['The Choke', 'The Dust Flats'], features: { cover: 0.45, elevation: true, chokepoint: true, shelterQuality: 0.75, acoustics: 1.35, vertical: true } },
            { name: 'The Collapsed Galleries', terrain: 'ruins', danger: 0.65, resources: 0.5, adjacent: ['The Choke', 'The Root Gardens'], features: { cover: 0.7, elevation: false, chokepoint: true, shelterQuality: 0.7, acoustics: 1.3, vertical: true } },
        ]
    },
    {
        id: 'islands',
        // §5.2: the channels between the islands run one way, all week.
        law: 'oneWayBorders',
        name: 'The Shattered Archipelago',
        description: 'Micro-islands adrift in a sea of thick magnetic fog, joined by swaying rope bridges and zip-lines. Compasses spin, the fog below has never been surveyed, and a cut rope is a border redrawn.',
        mutts: ['Lodestone Gulls', 'Fogline Eels', 'The Ferryman', 'Rust Mites'],
        // §5.1 (audit): the arena's own identity — it declared none of these.
        effectVocab: { flooded: { label: 'the fog-tide over the low islets', severityMult: 1.2 }, fogbound: { label: 'the magnetic fog closing in', severityMult: 1.3 } },
        restockBias: ['fishing-kit', 'rope', 'canteen'],
        events: ['Bridge Failure', 'Magnetic Squall', 'The Fog Rises'],
        // Nobody crosses the great bridge blind: after dark the fog owns it.
        edgeRules: { 'The Cornucopia (Anchor Isle)|The Long Span': { kind: 'timeGated', gatedTime: 'day' } },
        // §5: the horn sits on its own sandbar. Getting to it is a crossing, not a sprint.
        cornucopiaLayout: 'island',
        zones: [
            { name: 'The Cornucopia (Anchor Isle)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['The Long Span', 'The Fog Shallows', 'The Orchard Isle'], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.15, acoustics: 0.7 } },
            { name: 'The Long Span', terrain: 'open', danger: 0.75, resources: 0.1, adjacent: ['The Cornucopia (Anchor Isle)', 'Lodestone Crag', 'Gullrock'], features: { cover: 0.05, elevation: true, chokepoint: true, shelterQuality: 0.05, acoustics: 0.75, vertical: true } },
            { name: 'The Fog Shallows', terrain: 'water', danger: 0.7, resources: 0.4, adjacent: ['The Cornucopia (Anchor Isle)', 'The Reed Islet', 'The Wreck of the Ferry'], features: { cover: 0.4, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.05, acoustics: 0.6 } },
            { name: 'The Orchard Isle', terrain: 'forest', danger: 0.3, resources: 0.8, adjacent: ['The Cornucopia (Anchor Isle)', 'Gullrock', 'The Reed Islet'], features: { cover: 0.7, elevation: false, chokepoint: false, acoustics: 0.7 } },
            { name: 'Gullrock', terrain: 'highland', danger: 0.55, resources: 0.35, adjacent: ['The Long Span', 'The Orchard Isle', 'The Tilting Isle'], features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.15, vertical: true } },
            { name: 'Lodestone Crag', terrain: 'highland', danger: 0.85, resources: 0.15, adjacent: ['The Long Span', 'The Compass Rose'], features: { cover: 0.3, elevation: true, chokepoint: true, shelterQuality: 0.3, acoustics: 1.25, vertical: true } },
            { name: 'The Reed Islet', terrain: 'wetland', danger: 0.45, resources: 0.6, adjacent: ['The Fog Shallows', 'The Orchard Isle', 'The Wreck of the Ferry'], features: { cover: 0.7, elevation: false, chokepoint: false, acoustics: 0.65 } },
            { name: 'The Wreck of the Ferry', terrain: 'ruins', danger: 0.65, resources: 0.5, adjacent: ['The Fog Shallows', 'The Reed Islet', 'The Compass Rose'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.7, acoustics: 1.25, vertical: true } },
            { name: 'The Tilting Isle', terrain: 'open', danger: 0.7, resources: 0.2, adjacent: ['Gullrock', 'The Compass Rose'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'The Compass Rose', terrain: 'ruins', danger: 0.6, resources: 0.4, adjacent: ['Lodestone Crag', 'The Wreck of the Ferry', 'The Tilting Isle'], features: { cover: 0.4, elevation: false, chokepoint: false, acoustics: 0.75 } },
        ]
    },
    {
        id: 'eclipse',
        cornucopiaLayout: 'walled',
        // §5.2: an arena named for the dark that had no rule about the dark.
        law: 'deadlyNight',
        name: 'The Perpetual Eclipse Forest',
        description: 'An ancient redwood forest locked in permanent dusk, lit only by glowing fungi, fiery pitch-vents and a ceiling of artificial stars that do not stay still. Nothing here waits for nightfall, because nightfall never quite comes.',
        mutts: ['Duskwing Owls', 'Pitch Hounds', 'Lantern Beetles', 'The Understory', 'Star Moths'],
        // §5.1 (audit): the arena's own identity — it declared none of these.
        effectVocab: { fogbound: { label: 'the lightless hour', severityMult: 1.2 }, blooming: { label: 'a foxfire bloom', severityMult: 1.3 } },
        restockBias: ['lantern', 'glow-stick', 'berries'],
        edgeRules: { 'The Dark Meander|The Duskmoss Flats': { kind: 'timeGated', gatedTime: 'night' } },
        events: ['Star Shift', 'Pitch-Vent Flare', 'Fungal Bloom'],
        // Poor visibility for cameras, similar to the Vault but less severe.
        sponsorMultiplier: 0.9,
        zones: [
            { name: 'The Cornucopia (Clearing of Stars)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['The Redwood Naves', 'Foxfire Creek', 'The Pitch-Vents'], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'The Redwood Naves', terrain: 'forest', danger: 0.4, resources: 0.65, adjacent: ['The Cornucopia (Clearing of Stars)', 'The Glowcap Hollow', 'The Fallen Giant'], features: { cover: 0.9, elevation: false, chokepoint: false, acoustics: 0.65, vertical: true } },
            { name: 'Foxfire Creek', terrain: 'water', danger: 0.35, resources: 0.55, adjacent: ['The Cornucopia (Clearing of Stars)', 'The Duskmoss Flats', 'The Glowcap Hollow'], features: { cover: 0.4, elevation: false, chokepoint: true, waterSource: true } },
            { name: 'The Pitch-Vents', terrain: 'highland', danger: 0.85, resources: 0.15, adjacent: ['The Cornucopia (Clearing of Stars)', 'The Star Gantries', 'The Charcoal Grove'], features: { cover: 0.3, elevation: true, chokepoint: false, shelterQuality: 0.3, acoustics: 1.25 } },
            { name: 'The Glowcap Hollow', terrain: 'forest', danger: 0.45, resources: 0.8, adjacent: ['The Redwood Naves', 'Foxfire Creek', 'The Duskmoss Flats'], features: { cover: 0.85, elevation: false, chokepoint: false, acoustics: 0.7 } },
            { name: 'The Duskmoss Flats', terrain: 'wetland', danger: 0.5, resources: 0.6, adjacent: ['Foxfire Creek', 'The Glowcap Hollow', 'The Dark Meander'], features: { cover: 0.6, elevation: false, chokepoint: false, acoustics: 0.6 } },
            { name: 'The Fallen Giant', terrain: 'ruins', danger: 0.55, resources: 0.45, adjacent: ['The Redwood Naves', 'The Charcoal Grove', 'The Star Gantries'], features: { cover: 0.75, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 0.75, vertical: true } },
            { name: 'The Charcoal Grove', terrain: 'forest', danger: 0.65, resources: 0.35, adjacent: ['The Pitch-Vents', 'The Fallen Giant'], features: { cover: 0.55, elevation: false, chokepoint: false, acoustics: 0.75 } },
            { name: 'The Star Gantries', terrain: 'highland', danger: 0.75, resources: 0.2, adjacent: ['The Pitch-Vents', 'The Fallen Giant', 'The Dark Meander'], features: { cover: 0.2, elevation: true, chokepoint: true, acoustics: 1.25, vertical: true } },
            { name: 'The Dark Meander', terrain: 'water', danger: 0.6, resources: 0.5, adjacent: ['The Duskmoss Flats', 'The Star Gantries'], features: { cover: 0.5, elevation: false, chokepoint: true, acoustics: 0.75 } },
        ]
    },
    {
        id: 'reef',
        restockBias: ['trident', 'net', 'waterskin', 'groosling'],
        effectVocab: { swarming: { label: 'the anemone fields waking', severityMult: 1.25 } },
        name: 'The Dead Coral Reef',
        description: 'A drained ocean floor, bleach-white and razor-edged: fossilised coral heads, deep dry trenches, and vast fields of anemones that did not die when the water left. Everything sharp, nothing soft, and the only water is brine.',
        mutts: ['Trench Morays', 'Anemone Colonies', 'Bonefish Swarms', 'The Dry Shark'],
        events: ['Coral Collapse', 'Anemone Bloom', 'Trench Wind'],
        law: 'fireImpossible',
        // §5.1: no fire, no fresh water, and nothing that cuts on coral heals
        // clean. The reef is the no-healing arena — rest is the only medicine.
        laws: ['noHealing'],
        // §5: the horn is on the coral head, and everything between is water.
        cornucopiaLayout: 'island',
        zones: [
            { name: 'The Cornucopia (Drained Basin)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['The Coral Razors', 'The Urchin Barrens', 'The Dry Kelp Forest'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 1.25 } },
            { name: 'The Coral Razors', terrain: 'ruins', danger: 0.8, resources: 0.25, adjacent: ['The Cornucopia (Drained Basin)', 'The Shelf Break', 'The Anemone Fields'], features: { cover: 0.6, elevation: false, chokepoint: true, acoustics: 1.3, vertical: true } },
            { name: 'The Urchin Barrens', terrain: 'open', danger: 0.6, resources: 0.2, adjacent: ['The Cornucopia (Drained Basin)', 'The Tidepool Terraces', 'The Brine Sumps'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.05 } },
            { name: 'The Dry Kelp Forest', terrain: 'forest', danger: 0.35, resources: 0.6, adjacent: ['The Cornucopia (Drained Basin)', 'The Anemone Fields', 'The Tidepool Terraces'], features: { cover: 0.75, elevation: false, chokepoint: false, acoustics: 0.7, vertical: true } },
            { name: 'The Anemone Fields', terrain: 'wetland', danger: 0.75, resources: 0.5, adjacent: ['The Coral Razors', 'The Dry Kelp Forest', 'The Whale Fall'], features: { cover: 0.5, elevation: false, chokepoint: false, waterSource: false, acoustics: 0.75 } },
            { name: 'The Shelf Break', terrain: 'highland', danger: 0.7, resources: 0.2, adjacent: ['The Coral Razors', 'The Great Trench'], features: { cover: 0.2, elevation: true, chokepoint: true, acoustics: 1.35, vertical: true } },
            { name: 'The Tidepool Terraces', terrain: 'wetland', danger: 0.4, resources: 0.65, adjacent: ['The Urchin Barrens', 'The Dry Kelp Forest'], features: { cover: 0.35, elevation: false, chokepoint: false, waterSource: false, vertical: true } },
            { name: 'The Brine Sumps', terrain: 'water', danger: 0.5, resources: 0.4, adjacent: ['The Urchin Barrens', 'The Great Trench'], features: { cover: 0.2, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.1 } },
            { name: 'The Great Trench', terrain: 'water', danger: 0.9, resources: 0.4, adjacent: ['The Shelf Break', 'The Brine Sumps', 'The Whale Fall'], features: { cover: 0.6, elevation: false, chokepoint: true, waterSource: false, acoustics: 1.5, vertical: true } },
            { name: 'The Whale Fall', terrain: 'ruins', danger: 0.5, resources: 0.55, adjacent: ['The Anemone Fields', 'The Great Trench'], features: { cover: 0.7, elevation: false, chokepoint: true, shelterQuality: 0.75, acoustics: 1.25 } },
        ]
    },
    {
        id: 'abattoir',
        cornucopiaLayout: 'walled',
        restockBias: ['machete', 'bandages', 'vest', 'dried-meat'],
        // §5.2: a killing floor is a tiled room. Everything in it is audible.
        law: 'openMic',
        // Audit 5 §5.4: bodies as supplies is what the place is.
        laws: ['salvage'],
        name: 'The Industrial Abattoir',
        description: 'A multi-level automated factory that never fully shut down: rust-seized gears the size of rooms, conveyor lines that still run, crushing pistons on a schedule, and furnace halls that have not been cold in living memory.',
        mutts: ['Hook Apes', 'Scald Rats', 'The Line Boss', 'Grinder Beetles', 'Loft Swine'],
        events: ['The Line Starts', 'Furnace Backdraft', 'Piston Cycle'],
        // Visually the most "watchable" arena — the Capitol likes the machinery.
        sponsorMultiplier: 1.1,
        // Fire in here comes out of a furnace door, not a lightning strike.
        effectVocab: { burning: { label: 'a furnace backdraft', severityMult: 1.2 } },
        zones: [
            { name: 'The Cornucopia (Kill Floor)', terrain: 'open', danger: 0.65, resources: 0.35, adjacent: ['The Conveyor Deck', 'The Gear Gallery', 'The Coolant Vats'], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.6, acoustics: 1.4 } },
            { name: 'The Conveyor Deck', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['The Cornucopia (Kill Floor)', 'The Piston Hall', 'The Catwalks'], features: { cover: 0.3, elevation: false, chokepoint: true, acoustics: 1.3, vertical: true } },
            { name: 'The Gear Gallery', terrain: 'ruins', danger: 0.7, resources: 0.4, adjacent: ['The Cornucopia (Kill Floor)', 'The Piston Hall', 'The Feed Lofts'], features: { cover: 0.6, elevation: false, chokepoint: false, acoustics: 1.45, vertical: true } },
            { name: 'The Coolant Vats', terrain: 'water', danger: 0.5, resources: 0.45, adjacent: ['The Cornucopia (Kill Floor)', 'The Rendering Pits', 'The Feed Lofts'], features: { cover: 0.35, elevation: false, chokepoint: false, waterSource: false, acoustics: 1.3 } },
            { name: 'The Piston Hall', terrain: 'ruins', danger: 0.85, resources: 0.2, adjacent: ['The Conveyor Deck', 'The Gear Gallery', 'Furnace Row'], features: { cover: 0.3, elevation: false, chokepoint: true, acoustics: 1.5 } },
            { name: 'The Catwalks', terrain: 'highland', danger: 0.75, resources: 0.15, adjacent: ['The Conveyor Deck', 'Furnace Row'], features: { cover: 0.25, elevation: true, chokepoint: true, acoustics: 1.35, vertical: true } },
            { name: 'The Feed Lofts', terrain: 'forest', danger: 0.3, resources: 0.75, adjacent: ['The Gear Gallery', 'The Coolant Vats', 'The Rendering Pits'], features: { cover: 0.8, elevation: true, chokepoint: false, shelterQuality: 0.85, acoustics: 0.7, vertical: true } },
            { name: 'The Rendering Pits', terrain: 'wetland', danger: 0.65, resources: 0.4, adjacent: ['The Coolant Vats', 'The Feed Lofts', 'The Hook Line'], features: { cover: 0.4, elevation: false, chokepoint: true, waterSource: false, acoustics: 1.25, vertical: true } },
            { name: 'Furnace Row', terrain: 'ruins', danger: 0.9, resources: 0.25, adjacent: ['The Piston Hall', 'The Catwalks', 'The Hook Line'], features: { cover: 0.35, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 1.4 } },
            { name: 'The Hook Line', terrain: 'ruins', danger: 0.55, resources: 0.5, adjacent: ['The Rendering Pits', 'Furnace Row'], features: { cover: 0.5, elevation: false, chokepoint: true, acoustics: 1.3 } },
        ]
    },
    {
        id: 'carnival',
        cornucopiaLayout: 'walled',
        name: 'The Forgotten Carnival',
        description: 'A decayed amusement park swallowed by a fog-choked pine forest. The paint is gone, the music boxes are not, and some of the rides still have power from somewhere.',
        mutts: ['Calliope Jays', 'The Barker', 'Prize Hounds', 'Ticket Wasps'],
        // §5.1 (audit): the arena's own identity — it declared none of these.
        effectVocab: { burning: { label: 'a tent fire', severityMult: 1.2 }, fogbound: { label: 'the pine fog through the midway', severityMult: 1.1 } },
        restockBias: ['crackers', 'cheese', 'rope'],
        events: ['The Ride Wakes', 'Fog Bank', 'Structural Rot'],
        // Broken glass floor to ceiling: crossing the maze costs blood as often as not.
        edgeRules: { 'The Carousel|The Mirror Maze': { kind: 'tolled', toll: { woundChance: 0.1 } } },
        // §5.5: widened to twelve zones — a park has more dark corners than this.
        // §5: the Capitol dressed this one as an amusement park and did not put a single blade in it.
        // Audit 3 §5.2: and it is generous in the mornings, on camera, at the
        // one tile everybody else wants. A carnival is a place that gives you
        // things; that is what makes it a carnival and what makes it a trap.
        // Audit 5 §5.4: a fairground has a bell, and an announcer.
        laws: ['noWeapons', 'dawnMercy', 'theBell'],
        zones: [
            { name: 'The Cornucopia (The Midway)', terrain: 'open', danger: 0.6, resources: 0.35, adjacent: ['The Carousel', 'The Big Top', 'The Pine Dark'], features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.15, acoustics: 0.75 } },
            { name: 'The Carousel', terrain: 'ruins', danger: 0.65, resources: 0.3, adjacent: ['The Cornucopia (The Midway)', 'The Mirror Maze', 'The Duck Pond'], features: { cover: 0.5, elevation: false, chokepoint: false, acoustics: 1.25 } },
            { name: 'The Big Top', terrain: 'ruins', danger: 0.55, resources: 0.45, adjacent: ['The Cornucopia (The Midway)', 'The Ferris Wheel', "Fortune Teller's Row"], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 1.3, vertical: true } },
            { name: 'The Pine Dark', terrain: 'forest', danger: 0.45, resources: 0.7, adjacent: ['The Cornucopia (The Midway)', 'The Duck Pond', 'The Overgrown Campground'], features: { cover: 0.9, elevation: false, chokepoint: false, acoustics: 0.6 } },
            { name: 'The Mirror Maze', terrain: 'ruins', danger: 0.8, resources: 0.2, adjacent: ['The Carousel', 'The Ferris Wheel', 'The Haunted Manor'], features: { cover: 0.7, elevation: false, chokepoint: true, acoustics: 1.4 } },
            { name: 'The Duck Pond', terrain: 'water', danger: 0.4, resources: 0.55, adjacent: ['The Carousel', 'The Pine Dark', 'The Sunken Boat Ride', 'The Swan Boat Canal'], features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'The Ferris Wheel', terrain: 'highland', danger: 0.75, resources: 0.15, adjacent: ['The Big Top', 'The Mirror Maze', 'The Haunted Manor'], features: { cover: 0.2, elevation: true, chokepoint: true, shelterQuality: 0.1, acoustics: 1.25, vertical: true } },
            { name: "Fortune Teller's Row", terrain: 'ruins', danger: 0.5, resources: 0.5, adjacent: ['The Big Top', 'The Overgrown Campground'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.7 } },
            { name: 'The Overgrown Campground', terrain: 'forest', danger: 0.35, resources: 0.65, adjacent: ['The Pine Dark', "Fortune Teller's Row", 'The Sunken Boat Ride'], features: { cover: 0.7, elevation: false, chokepoint: false, shelterQuality: 0.6, acoustics: 0.7 } },
            { name: 'The Sunken Boat Ride', terrain: 'wetland', danger: 0.6, resources: 0.45, adjacent: ['The Duck Pond', 'The Overgrown Campground', 'The Swan Boat Canal'], features: { cover: 0.55, elevation: false, chokepoint: true, waterSource: false, acoustics: 1.3 } },
            // The back of the park: the dark ride nobody finished, and the
            // canal that used to carry the swan boats between attractions.
            { name: 'The Haunted Manor', terrain: 'ruins', danger: 0.7, resources: 0.4, adjacent: ['The Mirror Maze', 'The Ferris Wheel'], features: { cover: 0.8, elevation: false, chokepoint: true, shelterQuality: 0.85, acoustics: 1.25, vertical: true } },
            { name: 'The Swan Boat Canal', terrain: 'water', danger: 0.5, resources: 0.4, adjacent: ['The Duck Pond', 'The Sunken Boat Ride'], features: { cover: 0.3, elevation: false, chokepoint: true, acoustics: 0.75 } },
        ]
    },
    {
        id: 'ashwaste',
        cornucopiaLayout: 'plate',
        // §5.2: ash is not soil. Nothing has come up out of it in years.
        law: 'noForage',
        name: 'The Ash Wasteland',
        description: 'A dead land under three feet of volcanic ash, ringed around a caldera that has not finished with anyone. Every step is work, every print is a signature, and the mountain is still deciding.',
        mutts: ['Drift Serpents', 'Caldera Vultures', 'Cinder Fleas', 'The Grey Bull'],
        // §5.1 (audit): the arena's own identity — it declared none of these.
        effectVocab: { burning: { label: 'the drifts catching', severityMult: 1.3 }, contaminated: { label: 'the mudpots boiling over', severityMult: 1.2 } },
        restockBias: ['canteen', 'waterskin', 'charcoal-filter'],
        edgeRules: { 'The Caldera Rim|The Smolder': { kind: 'tolled', toll: { fatigue: 8, woundChance: 0.12 } } },
        events: ['Ash Slide', 'Vent Burst', 'The Mountain Clears Its Throat'],
        zones: [
            { name: 'The Cornucopia (Cinder Ring)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['The Deep Drifts', 'The Burned Forest', 'The Buried Village'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 0.75 } },
            { name: 'The Deep Drifts', terrain: 'open', danger: 0.7, resources: 0.1, adjacent: ['The Cornucopia (Cinder Ring)', 'The Caldera Rim', 'The Mudpots'], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 0.6 } },
            { name: 'The Burned Forest', terrain: 'forest', danger: 0.45, resources: 0.5, adjacent: ['The Cornucopia (Cinder Ring)', 'The Steam Field', 'The Buried Village'], features: { cover: 0.4, elevation: false, chokepoint: false, acoustics: 0.75 } },
            { name: 'The Buried Village', terrain: 'ruins', danger: 0.5, resources: 0.55, adjacent: ['The Cornucopia (Cinder Ring)', 'The Burned Forest', 'The Lava Tubes'], features: { cover: 0.65, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 0.75, vertical: true } },
            { name: 'The Caldera Rim', terrain: 'highland', danger: 0.9, resources: 0.1, adjacent: ['The Deep Drifts', 'The Smolder'], features: { cover: 0.1, elevation: true, chokepoint: true, shelterQuality: 0.05, acoustics: 1.3, vertical: true } },
            { name: 'The Mudpots', terrain: 'wetland', danger: 0.65, resources: 0.45, adjacent: ['The Deep Drifts', 'The Steam Field'], features: { cover: 0.3, elevation: false, chokepoint: false, waterSource: false, acoustics: 0.7 } },
            { name: 'The Steam Field', terrain: 'water', danger: 0.55, resources: 0.4, adjacent: ['The Burned Forest', 'The Mudpots'], features: { cover: 0.35, elevation: false, chokepoint: false, waterSource: false, acoustics: 0.65 } },
            { name: 'The Smolder', terrain: 'highland', danger: 0.85, resources: 0.15, adjacent: ['The Caldera Rim', 'The Lava Tubes'], features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.15 } },
            { name: 'The Lava Tubes', terrain: 'ruins', danger: 0.6, resources: 0.35, adjacent: ['The Buried Village', 'The Smolder'], features: { cover: 0.8, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 1.5, vertical: true } },
        ]
    },
    {
        id: 'quarry',
        cornucopiaLayout: 'walled',
        restockBias: ['rope', 'helmet', 'bandages', 'hardtack'],
        effectVocab: { quaking: { label: 'a bench letting go', severityMult: 1.3 } },
        // §5.2: `shrinkingArena` was the other law no arena declared. A working
        // quarry is the one place where the ground itself is being taken away
        // on a schedule, so the border starts closing from the first morning.
        law: 'shrinkingArena',
        name: 'The Vertical Quarry',
        description: 'A cylindrical open-pit mine, spiral roads cut into sheer stone, dropping bench by bench to a flooded black centre. The only ways down are the ways everyone else knows about.',
        mutts: ['Bench Cats', 'Blast Bats', 'The Dredger', 'Scree Adders', 'Silt Hounds'],
        events: ['Bench Collapse', 'Runaway Cart', 'The Pit Exhales'],
        // The only road down, and every step of it is exposed switchback.
        edgeRules: { 'The Middle Benches|The Spiral Road': { kind: 'tolled', toll: { fatigue: 6 } } },
        // §5.5: trimmed to nine zones — the Blast Face sheared off years ago.
        zones: [
            { name: 'The Cornucopia (Rim Camp)', terrain: 'open', danger: 0.55, resources: 0.35, adjacent: ['The Spiral Road', 'The Upper Benches', 'The Scrub Ledges'], features: { cover: 0.15, elevation: true, chokepoint: false, shelterQuality: 0.1, acoustics: 1.25 } },
            { name: 'The Spiral Road', terrain: 'highland', danger: 0.75, resources: 0.15, adjacent: ['The Cornucopia (Rim Camp)', 'The Middle Benches'], features: { cover: 0.1, elevation: true, chokepoint: true, acoustics: 1.4, vertical: true } },
            { name: 'The Upper Benches', terrain: 'open', danger: 0.5, resources: 0.3, adjacent: ['The Cornucopia (Rim Camp)', 'The Powder Magazine'], features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.1, acoustics: 1.35, vertical: true } },
            { name: 'The Scrub Ledges', terrain: 'forest', danger: 0.35, resources: 0.6, adjacent: ['The Cornucopia (Rim Camp)', 'The Powder Magazine', 'The Seep Wall'], features: { cover: 0.65, elevation: true, chokepoint: false, acoustics: 0.75, vertical: true } },
            { name: 'The Middle Benches', terrain: 'open', danger: 0.6, resources: 0.25, adjacent: ['The Spiral Road', 'The Crusher House', 'The Flooded Pit'], features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.1, acoustics: 1.4, vertical: true } },
            { name: 'The Powder Magazine', terrain: 'ruins', danger: 0.7, resources: 0.45, adjacent: ['The Upper Benches', 'The Scrub Ledges'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 1.3 } },
            { name: 'The Seep Wall', terrain: 'wetland', danger: 0.45, resources: 0.55, adjacent: ['The Scrub Ledges', 'The Flooded Pit'], features: { cover: 0.4, elevation: false, chokepoint: true, waterSource: true, vertical: true } },
            { name: 'The Crusher House', terrain: 'ruins', danger: 0.65, resources: 0.4, adjacent: ['The Middle Benches', 'The Flooded Pit'], features: { cover: 0.55, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 1.45, vertical: true } },
            { name: 'The Flooded Pit', terrain: 'water', danger: 0.8, resources: 0.35, adjacent: ['The Middle Benches', 'The Seep Wall', 'The Crusher House'], features: { cover: 0.1, elevation: false, chokepoint: true, shelterQuality: 0.05, acoustics: 1.5 } },
        ]
    },
    {
        id: 'glacier',
        cornucopiaLayout: 'plate',
        restockBias: ['thermal-cloak', 'sleeping-bag', 'rope', 'lamb-stew'],
        // §5.2: there is nothing on a glacier that will take a flame.
        law: 'fireImpossible',
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
            { name: 'The Cornucopia (Snowfield)', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The Firn Slope', 'The Blue Galleries', 'The Frozen Falls'], features: { cover: 0.05, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 0.7 } },
            { name: 'The Firn Slope', terrain: 'open', danger: 0.6, resources: 0.2, adjacent: ['The Cornucopia (Snowfield)', 'The Serac Field', 'The Pressure Ridge'], features: { cover: 0.1, elevation: true, chokepoint: false, shelterQuality: 0.05, acoustics: 0.7 } },
            { name: 'The Blue Galleries', terrain: 'ruins', danger: 0.5, resources: 0.4, adjacent: ['The Cornucopia (Snowfield)', 'The Slick Tunnels', 'The Green Chimney'], features: { cover: 0.75, elevation: false, chokepoint: false, shelterQuality: 0.8, acoustics: 1.45, vertical: true } },
            { name: 'The Frozen Falls', terrain: 'water', danger: 0.7, resources: 0.45, adjacent: ['The Cornucopia (Snowfield)', 'The Slush Basin', 'The Slick Tunnels'], features: { cover: 0.3, elevation: true, chokepoint: true, waterSource: true, acoustics: 1.3, vertical: true } },
            { name: 'The Serac Field', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The Firn Slope', 'The Pressure Ridge'], features: { cover: 0.4, elevation: true, chokepoint: false, acoustics: 1.25, vertical: true } },
            { name: 'The Pressure Ridge', terrain: 'highland', danger: 0.75, resources: 0.15, adjacent: ['The Firn Slope', 'The Serac Field', 'The Moulin'], features: { cover: 0.2, elevation: true, chokepoint: true, acoustics: 1.25 } },
            { name: 'The Slick Tunnels', terrain: 'ruins', danger: 0.65, resources: 0.3, adjacent: ['The Blue Galleries', 'The Frozen Falls', 'The Meltwater Vault'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 1.5 } },
            { name: 'The Green Chimney', terrain: 'forest', danger: 0.3, resources: 0.7, adjacent: ['The Blue Galleries', 'The Meltwater Vault'], features: { cover: 0.6, elevation: true, chokepoint: true, acoustics: 1.3, vertical: true } },
            { name: 'The Slush Basin', terrain: 'wetland', danger: 0.55, resources: 0.5, adjacent: ['The Frozen Falls', 'The Moulin'], features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.1, acoustics: 0.75 } },
            { name: 'The Moulin', terrain: 'ruins', danger: 0.9, resources: 0.2, adjacent: ['The Pressure Ridge', 'The Slush Basin'], features: { cover: 0.2, elevation: false, chokepoint: true, waterSource: true, acoustics: 1.55, vertical: true } },
            { name: 'The Meltwater Vault', terrain: 'water', danger: 0.6, resources: 0.55, adjacent: ['The Slick Tunnels', 'The Green Chimney'], features: { cover: 0.3, elevation: false, chokepoint: true, waterSource: true, shelterQuality: 0.7, acoustics: 1.5 } },
        ]
    },
    {
        id: 'floe',
        restockBias: ['thermal-cloak', 'rope', 'fishing-kit', 'lamb-stew'],
        effectVocab: { flooded: { label: 'a lead opening in the pack', severityMult: 1.3 } },
        // §5.2: polar summer. The sun goes round the horizon and never sets,
        // which is the second-cruellest thing about the place. Spreads `noNight`
        // off the single arena that was carrying it alone.
        laws: ['noNight'],
        name: 'The Shattered Ice Floe Sea',
        description: 'Open pack ice on a pitch-black frigid ocean, plates grinding and drifting all night, the Cornucopia stranded on the one shelf big enough to trust. The map is provisional. The water is not survivable.',
        mutts: ['Ice Orcas', 'Floe Bears', 'Storm Petrels', 'The Under-Thing'],
        events: ['The Lead Opens', 'Plate Collision', 'Black Water'],
        // Grease ice will hold a careful tribute. Mostly.
        edgeRules: { 'The Black Lead|The Grease Ice': { kind: 'tolled', toll: { fatigue: 7, woundChance: 0.08 } } },
        // §5: nothing edible grows on pack ice. Everything anybody eats here came out of the horn.
        law: 'noForage',
        // §5: the shelf the horn stands on is separated from the pack ice by open leads.
        cornucopiaLayout: 'island',
        zones: [
            { name: 'The Cornucopia (Ice Shelf)', terrain: 'open', danger: 0.55, resources: 0.35, adjacent: ['The Pack Ice', 'The Pressure Ridges', 'The Black Lead'], features: { cover: 0.05, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 0.75 } },
            { name: 'The Pack Ice', terrain: 'open', danger: 0.65, resources: 0.2, adjacent: ['The Cornucopia (Ice Shelf)', 'The Grease Ice', 'The Frozen Wreck'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 0.75 } },
            { name: 'The Pressure Ridges', terrain: 'highland', danger: 0.7, resources: 0.15, adjacent: ['The Cornucopia (Ice Shelf)', 'The Big Berg', 'The Frozen Wreck'], features: { cover: 0.3, elevation: true, chokepoint: true, shelterQuality: 0.2, acoustics: 1.25, vertical: true } },
            { name: 'The Black Lead', terrain: 'water', danger: 0.85, resources: 0.4, adjacent: ['The Cornucopia (Ice Shelf)', 'The Seal Colony', 'The Grease Ice'], features: { cover: 0.05, elevation: false, chokepoint: true, waterSource: false, shelterQuality: 0.05, acoustics: 1.25 } },
            { name: 'The Grease Ice', terrain: 'wetland', danger: 0.75, resources: 0.3, adjacent: ['The Pack Ice', 'The Black Lead'], features: { cover: 0.05, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.05, acoustics: 0.7 } },
            { name: 'The Frozen Wreck', terrain: 'ruins', danger: 0.5, resources: 0.55, adjacent: ['The Pack Ice', 'The Pressure Ridges', 'The Bergy Bits'], features: { cover: 0.65, elevation: false, chokepoint: true, shelterQuality: 0.85, acoustics: 1.35, vertical: true } },
            { name: 'The Big Berg', terrain: 'highland', danger: 0.6, resources: 0.25, adjacent: ['The Pressure Ridges', 'The Bergy Bits'], features: { cover: 0.3, elevation: true, chokepoint: false, shelterQuality: 0.3, acoustics: 1.25, vertical: true } },
            { name: 'The Seal Colony', terrain: 'wetland', danger: 0.4, resources: 0.7, adjacent: ['The Black Lead', 'The Bergy Bits'], features: { cover: 0.2, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.1, acoustics: 1.25 } },
            { name: 'The Bergy Bits', terrain: 'water', danger: 0.7, resources: 0.35, adjacent: ['The Frozen Wreck', 'The Big Berg', 'The Seal Colony'], features: { cover: 0.25, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.05, acoustics: 0.75 } },
        ]
    },
    {
        id: 'alpine',
        cornucopiaLayout: 'plate',
        // §5.2: the updraughts off the faces take every parachute over the ridge.
        law: 'noSponsors',
        name: 'The Pine Forest & Avalanche Peaks',
        description: 'Steep alpine slopes, heavy timber below, bare rock and loaded snowfields above. Everything worth having is downhill; everything that can kill you is up, and it is all one loud noise from coming down.',
        mutts: ['Timberline Wolves', 'The White Stag', 'Chough Flocks', 'Marmot Mutts', 'The Tarn Lurker'],
        // §5.1 (audit): the arena's own identity — it declared none of these.
        effectVocab: { frozen: { label: 'a hard freeze off the peaks', severityMult: 1.3 }, flooded: { label: 'the tarn overtopping', severityMult: 1.1 } },
        restockBias: ['thermal-cloak', 'matches', 'dried-meat'],
        events: ['Avalanche', 'Rockfall', 'Whiteout Front'],
        // The traverse to the summit snows is a knife's edge in crampon weather.
        edgeRules: { 'The Knife Ridge|The Summit Snows': { kind: 'tolled', toll: { fatigue: 8, woundChance: 0.1 } } },
        zones: [
            { name: 'The Cornucopia (Treeline Meadow)', terrain: 'open', danger: 0.55, resources: 0.35, adjacent: ['The Old Growth', 'The Scree Chutes', 'The Tarn'], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'The Old Growth', terrain: 'forest', danger: 0.35, resources: 0.75, adjacent: ['The Cornucopia (Treeline Meadow)', 'The Deadfall Slope', 'The Hunting Lodge'], features: { cover: 0.85, elevation: false, chokepoint: false, acoustics: 0.6, vertical: true } },
            { name: 'The Scree Chutes', terrain: 'highland', danger: 0.7, resources: 0.15, adjacent: ['The Cornucopia (Treeline Meadow)', 'The Knife Ridge', 'The Cirque'], features: { cover: 0.15, elevation: true, chokepoint: true, shelterQuality: 0.05, acoustics: 1.35, vertical: true } },
            { name: 'The Tarn', terrain: 'water', danger: 0.4, resources: 0.6, adjacent: ['The Cornucopia (Treeline Meadow)', 'The Bog Meadow', 'The Hunting Lodge'], features: { cover: 0.15, elevation: false, chokepoint: false, waterSource: true, shelterQuality: 0.1 } },
            { name: 'The Deadfall Slope', terrain: 'forest', danger: 0.55, resources: 0.5, adjacent: ['The Old Growth', 'The Cirque'], features: { cover: 0.7, elevation: true, chokepoint: false, acoustics: 0.75 } },
            { name: 'The Hunting Lodge', terrain: 'ruins', danger: 0.45, resources: 0.55, adjacent: ['The Old Growth', 'The Tarn'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 0.75, vertical: true } },
            { name: 'The Knife Ridge', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The Scree Chutes', 'The Summit Snows'], features: { cover: 0.05, elevation: true, chokepoint: true, shelterQuality: 0.05, acoustics: 1.3 } },
            { name: 'The Cirque', terrain: 'open', danger: 0.65, resources: 0.25, adjacent: ['The Scree Chutes', 'The Deadfall Slope', 'The Summit Snows'], features: { cover: 0.15, elevation: true, chokepoint: false, shelterQuality: 0.1, acoustics: 1.45 } },
            { name: 'The Bog Meadow', terrain: 'wetland', danger: 0.35, resources: 0.65, adjacent: ['The Tarn'], features: { cover: 0.45, elevation: false, chokepoint: false, acoustics: 0.7 } },
            { name: 'The Summit Snows', terrain: 'highland', danger: 0.9, resources: 0.05, adjacent: ['The Knife Ridge', 'The Cirque'], features: { cover: 0.05, elevation: true, chokepoint: false, shelterQuality: 0.05, acoustics: 0.7 } },
        ]
    },
    {
        id: 'terraces',
        cornucopiaLayout: 'walled',
        // §5.2: you go down a terraced mine. You do not go back up one.
        law: 'oneWayBorders',
        name: 'The Abandoned Terraced Mines',
        description: 'A mountain cut into dozens of stepped stone terraces by pre-Dark Days mining, riddled with open shaft mouths and strung with the rusted bones of a cable car system nobody has trusted in a century.',
        mutts: ['Shaft Swifts', 'Terrace Jackals', 'The Foreman', 'Cable Spiders', 'Flume Eels'],
        // §5.1 (audit): the arena's own identity — it declared none of these.
        effectVocab: { flooded: { label: 'a cistern letting go down the steps', severityMult: 1.3 }, quaking: { label: 'a shaft settling', severityMult: 1.2 } },
        restockBias: ['rope', 'wire', 'hardtack'],
        events: ['Terrace Slip', 'The Cable Parts', 'Shaft Breath'],
        // Hand over hand along the counterweight cable to the winch house.
        edgeRules: { 'The Counterweight Span|The Winch House': { kind: 'tolled', toll: { fatigue: 7 } } },
        zones: [
            { name: 'The Cornucopia (Grand Terrace)', terrain: 'open', danger: 0.6, resources: 0.35, adjacent: ['The Upper Steps', 'The Overgrown Steps', 'The Tailings Fans'], features: { cover: 0.15, elevation: true, chokepoint: false, shelterQuality: 0.1, acoustics: 1.3, vertical: true } },
            { name: 'The Upper Steps', terrain: 'highland', danger: 0.65, resources: 0.25, adjacent: ['The Cornucopia (Grand Terrace)', 'The Cable Car Station', 'The Counterweight Span'], features: { cover: 0.25, elevation: true, chokepoint: false, acoustics: 1.3, vertical: true } },
            { name: 'The Overgrown Steps', terrain: 'forest', danger: 0.35, resources: 0.7, adjacent: ['The Cornucopia (Grand Terrace)', 'The Cistern Terrace', 'The Slurry Ponds'], features: { cover: 0.75, elevation: true, chokepoint: false, acoustics: 0.75, vertical: true } },
            { name: 'The Tailings Fans', terrain: 'open', danger: 0.55, resources: 0.2, adjacent: ['The Cornucopia (Grand Terrace)', 'The Slurry Ponds', 'The Shaft Mouths'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.05 } },
            { name: 'The Cable Car Station', terrain: 'ruins', danger: 0.5, resources: 0.5, adjacent: ['The Upper Steps', 'The Winch House'], features: { cover: 0.55, elevation: true, chokepoint: true, shelterQuality: 0.75, acoustics: 1.3, vertical: true } },
            { name: 'The Counterweight Span', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The Upper Steps', 'The Winch House'], features: { cover: 0.05, elevation: true, chokepoint: true, shelterQuality: 0.05, acoustics: 1.25, vertical: true } },
            { name: 'The Cistern Terrace', terrain: 'water', danger: 0.4, resources: 0.55, adjacent: ['The Overgrown Steps', 'The Shaft Mouths'], features: { cover: 0.3, elevation: false, chokepoint: true, waterSource: true, acoustics: 1.4 } },
            { name: 'The Slurry Ponds', terrain: 'wetland', danger: 0.6, resources: 0.4, adjacent: ['The Overgrown Steps', 'The Tailings Fans'], features: { cover: 0.2, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.1 } },
            // A good ambush zone — a resource bonus rewards the risk of using
            // it as a route rather than just its danger punishing it.
            { name: 'The Shaft Mouths', terrain: 'ruins', danger: 0.8, resources: 0.6, adjacent: ['The Tailings Fans', 'The Cistern Terrace', 'The Winch House'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.7, acoustics: 1.55, vertical: true } },
            { name: 'The Winch House', terrain: 'ruins', danger: 0.55, resources: 0.5, adjacent: ['The Cable Car Station', 'The Counterweight Span', 'The Shaft Mouths'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.85, acoustics: 1.25 } },
        ]
    },
    {
        id: 'seapeaks',
        cornucopiaLayout: 'island',
        restockBias: ['rope', 'thermal-cloak', 'bracers', 'hardtack'],
        effectVocab: { frozen: { label: 'rime ice on the faces', severityMult: 1.2, durationMult: 1.2 } },
        // §5.2: peaks in an ocean. Salt water everywhere and one place the ice
        // gives up anything anybody can drink.
        law: 'noWaterExceptZone',
        lawZone: 'The Ice Chimney',
        name: 'The Alpine Archipelago',
        description: 'A chain of sharp mountain peaks thrust directly out of a deep, rough ocean — no coastlines, no beaches, no gradual slopes. Scale the ice or swim the swells; there is no third way between any two peaks.',
        mutts: ['Undertow Serpents', 'Cliff Harriers', 'Deep Current Grapplers'],
        events: ['Rising Tide', 'Ice Shear', 'Rogue Swell'],
        // The chimney is a free climb up sea-slick ice; the sea takes the rest.
        // §11.6: nobody free-climbs the chimney without leaving gear in it.
        edgeRules: { 'The Ice Chimney|The Summit Col': { kind: 'tolled', toll: { fatigue: 8, woundChance: 0.12, itemCost: true } } },
        zones: [
            { name: 'The Cornucopia (The Shelf)', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The First Peak', 'The Drowned Approach', 'Open Water Reach'], features: { cover: 0.1, elevation: true, chokepoint: false, shelterQuality: 0.05, acoustics: 1.25 } },
            { name: 'The First Peak', terrain: 'highland', danger: 0.7, resources: 0.2, adjacent: ['The Cornucopia (The Shelf)', 'The Ice Chimney', 'The Sea Cave'], features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.1, acoustics: 1.3, vertical: true } },
            { name: 'The Drowned Approach', terrain: 'water', danger: 0.65, resources: 0.3, adjacent: ['The Cornucopia (The Shelf)', 'Open Water Reach', 'The Kelp Shallows'], features: { cover: 0.1, elevation: false, chokepoint: true, waterSource: false, shelterQuality: 0.05 } },
            { name: 'The Ice Chimney', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The First Peak', 'The Summit Col'], features: { cover: 0.2, elevation: true, chokepoint: true, acoustics: 1.5, vertical: true } },
            { name: 'Open Water Reach', terrain: 'water', danger: 0.75, resources: 0.35, adjacent: ['The Cornucopia (The Shelf)', 'The Drowned Approach', 'The Kelp Shallows', 'The Sea Cave'], features: { cover: 0.05, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.05 } },
            { name: 'The Sea Cave', terrain: 'ruins', danger: 0.5, resources: 0.5, adjacent: ['The First Peak', 'Open Water Reach', 'The Second Peak'], features: { cover: 0.7, elevation: false, chokepoint: true, waterSource: false, shelterQuality: 0.8, acoustics: 1.45 } },
            { name: 'The Second Peak', terrain: 'highland', danger: 0.75, resources: 0.15, adjacent: ['The Sea Cave', 'The Summit Col', 'The Kelp Shallows'], features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.1, acoustics: 1.3, vertical: true } },
            { name: 'The Kelp Shallows', terrain: 'water', danger: 0.55, resources: 0.55, adjacent: ['The Drowned Approach', 'Open Water Reach', 'The Second Peak'], features: { cover: 0.3, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.05, acoustics: 0.75 } },
            { name: 'The Summit Col', terrain: 'highland', danger: 0.9, resources: 0.05, adjacent: ['The Ice Chimney', 'The Second Peak'], features: { cover: 0.1, elevation: true, chokepoint: true, shelterQuality: 0.05, acoustics: 1.25 } },
        ]
    },
    {
        id: 'canopyweb',
        cornucopiaLayout: 'island',
        name: 'The Suspended Canopy Web',
        description: 'A forest of giant three-hundred-foot conifers, the ground floor buried under a sunless layer of toxic nitrogen fog nobody survives a minute in. Everything worth doing happens hundreds of feet up, on woven needle-bridges and swaying moss webs.',
        mutts: ['Silk-Line Stalkers', 'Needle Wasps', 'The Understory Reach'],
        // §5.1 (audit): the arena's own identity — it declared none of these.
        effectVocab: { fogbound: { label: 'the understory fog rising', severityMult: 1.3 }, swarming: { label: 'the needle wasps', severityMult: 1.2 } },
        restockBias: ['rope', 'net', 'waterskin'],
        edgeRules: { 'The Needle Bridges|The Swaying Reach': { kind: 'collapsing', crossings: 4 } },
        events: ['Needle Storm', 'Web Collapse', 'The Fog Rises'],
        law: 'noWaterExceptZone',
        lawZone: 'The Rain Catch',
        zones: [
            { name: 'The Cornucopia (The Landing)', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The Needle Bridges', 'Moss Hammock Grove', 'The Crown Break'], features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.15, vertical: true } },
            { name: 'The Needle Bridges', terrain: 'highland', danger: 0.8, resources: 0.15, adjacent: ['The Cornucopia (The Landing)', 'The Swaying Reach', 'The Old Nest'], features: { cover: 0.1, elevation: true, chokepoint: true, shelterQuality: 0.05, acoustics: 0.75, vertical: true } },
            { name: 'Moss Hammock Grove', terrain: 'forest', danger: 0.35, resources: 0.75, adjacent: ['The Cornucopia (The Landing)', 'The Rain Catch', 'The Web Anchor'], features: { cover: 0.85, elevation: true, chokepoint: false, acoustics: 0.6, vertical: true } },
            { name: 'The Rain Catch', terrain: 'water', danger: 0.3, resources: 0.5, adjacent: ['Moss Hammock Grove', 'The Web Anchor'], features: { cover: 0.3, elevation: true, chokepoint: false, waterSource: true, acoustics: 0.75 } },
            { name: 'The Swaying Reach', terrain: 'highland', danger: 0.75, resources: 0.2, adjacent: ['The Needle Bridges', 'The Old Nest', 'The Crown Break'], features: { cover: 0.3, elevation: true, chokepoint: true, acoustics: 0.75, vertical: true } },
            { name: 'The Old Nest', terrain: 'ruins', danger: 0.5, resources: 0.55, adjacent: ['The Needle Bridges', 'The Swaying Reach', 'The Understory Fog'], features: { cover: 0.8, elevation: true, chokepoint: true, shelterQuality: 0.8, acoustics: 0.7 } },
            { name: 'The Understory Fog', terrain: 'wetland', danger: 0.85, resources: 0.3, adjacent: ['The Old Nest', 'The Web Anchor'], features: { cover: 0.9, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.2, acoustics: 0.55 } },
            { name: 'The Crown Break', terrain: 'open', danger: 0.6, resources: 0.25, adjacent: ['The Cornucopia (The Landing)', 'The Swaying Reach'], features: { cover: 0.1, elevation: true, chokepoint: false, shelterQuality: 0.05, acoustics: 1.25 } },
            { name: 'The Web Anchor', terrain: 'ruins', danger: 0.45, resources: 0.6, adjacent: ['Moss Hammock Grove', 'The Rain Catch', 'The Understory Fog'], features: { cover: 0.6, elevation: true, chokepoint: true, acoustics: 0.75, vertical: true } },
        ]
    },
    {
        id: 'acousticforest',
        cornucopiaLayout: 'plate',
        name: 'The Whispering Acoustic Forest',
        description: 'A lodgepole pine forest hollowed out by engineered wood-boring insects, the whole canopy one vast wind organ. The breeze through the hollow trunks sounds uncannily human — and drowns out anyone actually trying to sneak.',
        mutts: ['Wind-Throat Owls', 'Resonance Moths', 'Hollow-Bore Beetles'],
        restockBias: ['blowgun', 'bandages', 'berries'],
        events: ['Resonant Shattering', 'The Chorus', 'Dry Grove Collapse'],
        // Acoustic confusion runs through the same primitive fog does —
        // hearing nothing true is its own kind of blindness.
        effectVocab: { fogbound: { label: 'the wind-organ at full voice', severityMult: 1.3 }, swarming: { label: 'the resonance moths', severityMult: 1.2 } },
        // §5: the arena's whole premise, finally a rule — in the Whispering Forest every fight is audible from every other sector.
        law: 'openMic',
        zones: [
            { name: 'The Cornucopia (The Grove Floor)', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The Hollow Boughs', 'The Wind Throat', "Piper's Creek"], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.1, acoustics: 1.3 } },
            { name: 'The Hollow Boughs', terrain: 'forest', danger: 0.4, resources: 0.7, adjacent: ['The Cornucopia (The Grove Floor)', 'The Needle Drift', 'The Deep Organ'], features: { cover: 0.8, elevation: false, chokepoint: false, acoustics: 1.4, vertical: true } },
            { name: 'The Wind Throat', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The Cornucopia (The Grove Floor)', 'The Resonance Chamber', 'The Splinter Field'], features: { cover: 0.3, elevation: true, chokepoint: true, acoustics: 1.6, vertical: true } },
            { name: "Piper's Creek", terrain: 'water', danger: 0.4, resources: 0.55, adjacent: ['The Cornucopia (The Grove Floor)', 'The Needle Drift', 'The Whisper Hollow'], features: { cover: 0.4, elevation: false, chokepoint: true, waterSource: true, acoustics: 1.25 } },
            { name: 'The Needle Drift', terrain: 'forest', danger: 0.35, resources: 0.65, adjacent: ['The Hollow Boughs', "Piper's Creek", 'The Deep Organ'], features: { cover: 0.7, elevation: false, chokepoint: false, acoustics: 0.65 } },
            { name: 'The Deep Organ', terrain: 'forest', danger: 0.55, resources: 0.6, adjacent: ['The Hollow Boughs', 'The Needle Drift', 'Old Sawmill Ruins'], features: { cover: 0.85, elevation: false, chokepoint: false, acoustics: 1.5, vertical: true } },
            { name: 'The Whisper Hollow', terrain: 'wetland', danger: 0.5, resources: 0.5, adjacent: ["Piper's Creek", 'Old Sawmill Ruins'], features: { cover: 0.6, elevation: false, chokepoint: false, acoustics: 0.7 } },
            { name: 'Old Sawmill Ruins', terrain: 'ruins', danger: 0.45, resources: 0.5, adjacent: ['The Deep Organ', 'The Whisper Hollow', 'The Resonance Chamber'], features: { cover: 0.55, elevation: false, chokepoint: true, shelterQuality: 0.7, acoustics: 1.25, vertical: true } },
            { name: 'The Resonance Chamber', terrain: 'ruins', danger: 0.6, resources: 0.4, adjacent: ['The Wind Throat', 'Old Sawmill Ruins', 'The Splinter Field'], features: { cover: 0.5, elevation: false, chokepoint: true, shelterQuality: 0.75, acoustics: 1.6 } },
            { name: 'The Splinter Field', terrain: 'open', danger: 0.65, resources: 0.2, adjacent: ['The Wind Throat', 'The Resonance Chamber'], features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
        ]
    },
    {
        id: 'burnscar',
        cornucopiaLayout: 'plate',
        // §5.2: the fire already came through. There is nothing left to eat and
        // nothing left that will take a flame twice.
        laws: ['fireImpossible', 'noForage'],
        name: 'The Post-Burn Scar & Fireweed Slope',
        description: 'A mountain forest three years burned: blackened snag trees, deep erosion gullies, and thorny fireweed grown up thick over ground that still runs hot. Deadfall drops silently. The mountain is not finished with fire.',
        mutts: ['Cinder-Back Boars', 'Thornvine Jackals', 'The Standing Char'],
        // §5.1 (audit): the arena's own identity — it declared none of these.
        effectVocab: { stripped: { label: 'ash to the horizon', severityMult: 1.2 }, quaking: { label: 'a burned root-mat giving way', severityMult: 1.1 } },
        restockBias: ['charcoal-filter', 'canteen', 'bandages'],
        edgeRules: { 'The Char Ridge|The Snag Field': { kind: 'collapsing', crossings: 3 } },
        events: ['Seed Shrapnel', 'Silent Deadfall', 'Ground Heat Flare'],
        zones: [
            { name: 'The Cornucopia (The Ash Clearing)', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The Snag Field', 'The Fireweed Slope', 'Seep Spring'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 0.75 } },
            { name: 'The Snag Field', terrain: 'ruins', danger: 0.5, resources: 0.3, adjacent: ['The Cornucopia (The Ash Clearing)', 'Deadfall Hollow', 'The Char Ridge'], features: { cover: 0.35, elevation: false, chokepoint: false, acoustics: 1.25, vertical: true } },
            { name: 'The Fireweed Slope', terrain: 'forest', danger: 0.45, resources: 0.65, adjacent: ['The Cornucopia (The Ash Clearing)', 'Bramble Choke', 'Erosion Gully'], features: { cover: 0.6, elevation: true, chokepoint: false, acoustics: 0.75 } },
            { name: 'Seep Spring', terrain: 'water', danger: 0.35, resources: 0.45, adjacent: ['The Cornucopia (The Ash Clearing)', 'Erosion Gully', 'The Standing Dead'], features: { cover: 0.35, elevation: false, chokepoint: true, waterSource: true } },
            { name: 'Deadfall Hollow', terrain: 'forest', danger: 0.6, resources: 0.5, adjacent: ['The Snag Field', 'The Char Ridge', 'The Old Burn Line'], features: { cover: 0.75, elevation: false, chokepoint: true, acoustics: 0.7 } },
            { name: 'The Char Ridge', terrain: 'highland', danger: 0.85, resources: 0.1, adjacent: ['The Snag Field', 'Deadfall Hollow', 'The Old Burn Line'], features: { cover: 0.15, elevation: true, chokepoint: true, shelterQuality: 0.05, acoustics: 1.3, vertical: true } },
            { name: 'Bramble Choke', terrain: 'wetland', danger: 0.7, resources: 0.35, adjacent: ['The Fireweed Slope', 'Erosion Gully'], features: { cover: 0.7, elevation: false, chokepoint: true, acoustics: 0.7 } },
            { name: 'Erosion Gully', terrain: 'wetland', danger: 0.5, resources: 0.4, adjacent: ['The Fireweed Slope', 'Seep Spring', 'Bramble Choke'], features: { cover: 0.5, elevation: false, chokepoint: true, waterSource: false, acoustics: 1.35, vertical: true } },
            { name: 'The Old Burn Line', terrain: 'open', danger: 0.6, resources: 0.25, adjacent: ['Deadfall Hollow', 'The Char Ridge', 'The Standing Dead'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.05 } },
            { name: 'The Standing Dead', terrain: 'ruins', danger: 0.55, resources: 0.45, adjacent: ['Seep Spring', 'The Old Burn Line'], features: { cover: 0.4, elevation: false, chokepoint: false, acoustics: 1.25, vertical: true } },
        ]
    },
    {
        id: 'craterfield',
        cornucopiaLayout: 'plate',
        name: 'The Overgrown Ordnance Crater Field',
        description: 'A former military proving ground, pockmarked with deep overlapping craters flooded into stagnant ponds and choked by fast-growing vines. Unexploded ordnance sleeps under the root mats, and the vines have learned to grow something worse.',
        mutts: ['Bog Adders', 'Root-Mat Crawlers', 'The Salvage Hound'],
        // §5.1 (audit): the arena's own identity — it declared none of these.
        effectVocab: { flooded: { label: 'the craters filling', severityMult: 1.3 }, contaminated: { label: 'old ordnance leaching', severityMult: 1.3 } },
        restockBias: ['helmet', 'vest', 'iodine'],
        edgeRules: { 'Slick Crater Wall|The Deep Craters': { kind: 'tolled', toll: { fatigue: 6, itemCost: true } } },
        events: ['Pressure Pod', 'Crater Collapse', 'Buried Ordnance'],
        // §5: unexploded ordnance under a root mat is worse in the dark, when nobody can see where they are putting their feet.
        law: 'deadlyNight',
        zones: [
            { name: 'The Cornucopia (The Motor Pool)', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The Shallow Craters', 'Rusted Convoy Road', 'The Root Mat Flat'], features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.15 } },
            { name: 'The Shallow Craters', terrain: 'wetland', danger: 0.55, resources: 0.4, adjacent: ['The Cornucopia (The Motor Pool)', 'The Deep Craters', 'The Fruiting Tangle'], features: { cover: 0.35, elevation: false, chokepoint: false, waterSource: false, vertical: true } },
            { name: 'The Deep Craters', terrain: 'water', danger: 0.8, resources: 0.35, adjacent: ['The Shallow Craters', 'Stagnant Pool Marsh', 'Slick Crater Wall'], features: { cover: 0.4, elevation: false, chokepoint: true, waterSource: false, acoustics: 1.35, vertical: true } },
            { name: 'Rusted Convoy Road', terrain: 'open', danger: 0.4, resources: 0.25, adjacent: ['The Cornucopia (The Motor Pool)', 'Vine-Choked Bunker', 'The Old Ammo Dump'], features: { cover: 0.3, elevation: false, chokepoint: true, acoustics: 1.25 } },
            { name: 'The Root Mat Flat', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['The Cornucopia (The Motor Pool)', 'The Fruiting Tangle', 'Vine-Choked Bunker'], features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.1, acoustics: 0.7 } },
            { name: 'Vine-Choked Bunker', terrain: 'ruins', danger: 0.65, resources: 0.45, adjacent: ['Rusted Convoy Road', 'The Root Mat Flat', 'The Old Ammo Dump'], features: { cover: 0.8, elevation: false, chokepoint: true, shelterQuality: 0.95, acoustics: 1.3, vertical: true } },
            { name: 'The Fruiting Tangle', terrain: 'forest', danger: 0.5, resources: 0.75, adjacent: ['The Shallow Craters', 'The Root Mat Flat', 'Stagnant Pool Marsh'], features: { cover: 0.85, elevation: false, chokepoint: false, acoustics: 0.65 } },
            { name: 'Stagnant Pool Marsh', terrain: 'wetland', danger: 0.6, resources: 0.5, adjacent: ['The Deep Craters', 'The Fruiting Tangle', 'Slick Crater Wall'], features: { cover: 0.5, elevation: false, chokepoint: false, waterSource: false, acoustics: 0.75 } },
            { name: 'Slick Crater Wall', terrain: 'highland', danger: 0.75, resources: 0.15, adjacent: ['The Deep Craters', 'Stagnant Pool Marsh'], features: { cover: 0.2, elevation: true, chokepoint: true, shelterQuality: 0.1, acoustics: 1.4, vertical: true } },
            { name: 'The Old Ammo Dump', terrain: 'ruins', danger: 0.7, resources: 0.4, adjacent: ['Rusted Convoy Road', 'Vine-Choked Bunker'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.85, acoustics: 1.35 } },
        ]
    },
    {
        id: 'culdesac',
        cornucopiaLayout: 'walled',
        restockBias: ['matches', 'sleeping-bag', 'crackers', 'cheese'],
        name: 'The Cul-de-Sac',
        description: 'Sixty-two identical houses on a loop road. The lawns are cut, the porch lights work, and the delivery trucks keep coming. The Capitol built somewhere normal, and now it has to be ransacked.',
        mutts: ['The Family Dogs', 'The Meter Reader', 'Wasps in the Eaves', 'Something in the Pool'],
        events: ['The Neighbourhood Watch', 'Gas Leak', 'The Sprinklers'],
        law: 'cornucopiaRefills',
        // §5.2: the cordon around a suburb is a street at a time, from the
        // first morning, and everybody on the loop road can see which street
        // went last night. Gives `shrinkingArena` a second home.
        laws: ['shrinkingArena'],
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
            { name: 'The Cornucopia (Loop Road)', terrain: 'open', danger: 0.6, resources: 0.35, adjacent: ['Number 14', 'Number 27', 'The Show Home', 'The Green', 'The Loading Bay'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'Number 14', terrain: 'ruins', danger: 0.45, resources: 0.6, adjacent: ['The Cornucopia (Loop Road)', 'Number 27', 'Back Gardens'], features: { cover: 0.8, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 0.75, vertical: true } },
            { name: 'Number 27', terrain: 'ruins', danger: 0.55, resources: 0.55, adjacent: ['The Cornucopia (Loop Road)', 'Number 14', 'The Cut-Through'], features: { cover: 0.8, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 0.75, vertical: true } },
            { name: 'The Show Home', terrain: 'ruins', danger: 0.4, resources: 0.65, adjacent: ['The Cornucopia (Loop Road)', 'The Green', 'The Pool Complex'], features: { cover: 0.75, elevation: false, chokepoint: false, shelterQuality: 0.9, acoustics: 1.25, vertical: true } },
            { name: 'The Cut-Through', terrain: 'forest', danger: 0.5, resources: 0.5, adjacent: ['Number 27', 'The Green', 'Back Gardens', 'The Storm Creek'], features: { cover: 0.85, elevation: false, chokepoint: true, acoustics: 0.75 } },
            { name: 'The Green', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The Cornucopia (Loop Road)', 'The Show Home', 'The Cut-Through', 'The Pool Complex'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'Back Gardens', terrain: 'forest', danger: 0.35, resources: 0.7, adjacent: ['Number 14', 'The Cut-Through', 'The Storm Creek'], features: { cover: 0.9, elevation: false, chokepoint: false, acoustics: 0.7 } },
            { name: 'The Pool Complex', terrain: 'water', danger: 0.6, resources: 0.4, adjacent: ['The Show Home', 'The Green', 'The Loading Bay'], features: { cover: 0.3, elevation: false, chokepoint: true, waterSource: false, acoustics: 1.4 } },
            { name: 'The Storm Creek', terrain: 'water', danger: 0.5, resources: 0.5, adjacent: ['The Cut-Through', 'Back Gardens', 'The Substation'], features: { cover: 0.5, elevation: false, chokepoint: true, waterSource: true } },
            { name: 'The Loading Bay', terrain: 'open', danger: 0.65, resources: 0.55, adjacent: ['The Cornucopia (Loop Road)', 'The Pool Complex', 'The Substation'], features: { cover: 0.3, elevation: false, chokepoint: true, shelterQuality: 0.4, acoustics: 1.3 } },
            { name: 'The Substation', terrain: 'ruins', danger: 0.85, resources: 0.2, adjacent: ['The Storm Creek', 'The Loading Bay'], features: { cover: 0.4, elevation: false, chokepoint: true, shelterQuality: 0.7, acoustics: 1.25 } },
        ]
    },
    {
        id: 'labyrinth',
        cornucopiaLayout: 'walled',
        restockBias: ['sickle', 'wire', 'berries', 'waterskin'],
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
            // §5.5: the passage out of the False Centre is genuinely hidden.
            // Nobody walks it until they have stood in the false one long
            // enough to work out which wall is not a wall — the Long Alley is
            // still the honest way in, and it is the long way round.
            'The False Centre|The True Centre': { kind: 'hidden' },
            // The Gardener's Gate is locked after dark. House rules.
            "The Gardener's Gate|The Outer Ring": { kind: 'timeGated', gatedTime: 'day' },
            "The Canal Walk|The Gardener's Gate": { kind: 'timeGated', gatedTime: 'day' },
        },
        zones: [
            { name: 'The Cornucopia (Fountain Court)', terrain: 'open', danger: 0.6, resources: 0.35, adjacent: ['The Outer Ring', 'The Parterre', 'The Canal Walk'], features: { cover: 0.15, elevation: false, chokepoint: false, waterSource: true, shelterQuality: 0.1, acoustics: 1.25 } },
            { name: 'The Outer Ring', terrain: 'forest', danger: 0.45, resources: 0.5, adjacent: ['The Cornucopia (Fountain Court)', 'The North Spiral', 'The South Spiral', "The Gardener's Gate"], features: { cover: 0.85, elevation: false, chokepoint: false, acoustics: 0.7 } },
            { name: 'The North Spiral', terrain: 'forest', danger: 0.55, resources: 0.45, adjacent: ['The Outer Ring', 'The Long Alley', 'The False Centre'], features: { cover: 0.9, elevation: false, chokepoint: true, acoustics: 0.65 } },
            { name: 'The South Spiral', terrain: 'forest', danger: 0.55, resources: 0.45, adjacent: ['The Outer Ring', 'The Dead End', 'The Topiary Garden'], features: { cover: 0.9, elevation: false, chokepoint: true, acoustics: 0.65 } },
            // One way in, the same way out. The maze's oubliette.
            { name: 'The Dead End', terrain: 'forest', danger: 0.7, resources: 0.25, adjacent: ['The South Spiral'], features: { cover: 0.95, elevation: false, chokepoint: true, shelterQuality: 0.7, acoustics: 0.6 } },
            { name: 'The Long Alley', terrain: 'forest', danger: 0.5, resources: 0.4, adjacent: ['The North Spiral', 'The Parterre', 'The True Centre'], features: { cover: 0.8, elevation: false, chokepoint: true, acoustics: 1.25 } },
            { name: 'The Parterre', terrain: 'open', danger: 0.4, resources: 0.6, adjacent: ['The Cornucopia (Fountain Court)', 'The Long Alley', 'The Canal Walk'], features: { cover: 0.3, elevation: true, chokepoint: false, shelterQuality: 0.15, vertical: true } },
            { name: 'The Canal Walk', terrain: 'water', danger: 0.5, resources: 0.55, adjacent: ['The Cornucopia (Fountain Court)', 'The Parterre', "The Gardener's Gate"], features: { cover: 0.4, elevation: false, chokepoint: true, acoustics: 1.25 } },
            { name: 'The Topiary Garden', terrain: 'forest', danger: 0.75, resources: 0.4, adjacent: ['The South Spiral', 'The False Centre'], features: { cover: 0.8, elevation: false, chokepoint: false, acoustics: 0.7, vertical: true } },
            { name: 'The False Centre', terrain: 'forest', danger: 0.65, resources: 0.3, adjacent: ['The North Spiral', 'The Topiary Garden', 'The True Centre'], features: { cover: 0.85, elevation: false, chokepoint: true, acoustics: 0.7 } },
            { name: 'The True Centre', terrain: 'open', danger: 0.35, resources: 0.7, adjacent: ['The Long Alley', 'The False Centre'], features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.15, vertical: true } },
            { name: "The Gardener's Gate", terrain: 'open', danger: 0.55, resources: 0.45, adjacent: ['The Outer Ring', 'The Canal Walk'], features: { cover: 0.3, elevation: false, chokepoint: true, shelterQuality: 0.4 } },
        ]
    },
    {
        id: 'ashgrove',
        cornucopiaLayout: 'walled',
        restockBias: ['knife', 'bandages', 'crackers', 'matches'],
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
            // §5.5: the locker rows are the school's toll gate. A group dug in
            // there owns the way between the gym wing and the spine, and
            // everyone else comes through at a run or comes through fighting.
            'Lockers|Main Corridor': { kind: 'contested' },
        },
        zones: [
            { name: 'The Cornucopia (The Yard)', terrain: 'open', danger: 0.6, resources: 0.35, adjacent: ['Main Corridor', 'The Gymnasium', 'The Playing Field', 'The Roof'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.1, acoustics: 1.25 } },
            // The spine of the school: every wing hangs off it, and everyone
            // has to use it.
            { name: 'Main Corridor', terrain: 'ruins', danger: 0.7, resources: 0.25, adjacent: ['The Cornucopia (The Yard)', 'The Cafeteria', 'The Library', 'Lockers', 'Science Block', 'The Auditorium'], features: { cover: 0.4, elevation: false, chokepoint: true, acoustics: 1.5 } },
            { name: 'The Gymnasium', terrain: 'ruins', danger: 0.5, resources: 0.4, adjacent: ['The Cornucopia (The Yard)', 'Lockers', 'The Flooded Pool'], features: { cover: 0.5, elevation: false, chokepoint: false, acoustics: 1.55, vertical: true } },
            { name: 'The Cafeteria', terrain: 'ruins', danger: 0.45, resources: 0.7, adjacent: ['Main Corridor', 'The Boiler Room'], features: { cover: 0.55, elevation: false, chokepoint: false, shelterQuality: 0.8, acoustics: 1.35 } },
            { name: 'The Library', terrain: 'ruins', danger: 0.3, resources: 0.5, adjacent: ['Main Corridor', 'The Auditorium'], features: { cover: 0.85, elevation: false, chokepoint: false, shelterQuality: 0.85, acoustics: 0.7, vertical: true } },
            { name: 'Science Block', terrain: 'ruins', danger: 0.75, resources: 0.55, adjacent: ['Main Corridor', 'The Boiler Room', 'The Roof'], features: { cover: 0.6, elevation: false, chokepoint: true, acoustics: 1.3, vertical: true } },
            { name: 'The Boiler Room', terrain: 'ruins', danger: 0.85, resources: 0.3, adjacent: ['The Cafeteria', 'Science Block', 'The Flooded Pool'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 1.4 } },
            // Narrow enough to hold with two people — see the `contested`
            // edge above.
            { name: 'Lockers', terrain: 'ruins', danger: 0.65, resources: 0.45, adjacent: ['Main Corridor', 'The Gymnasium'], features: { cover: 0.7, elevation: false, chokepoint: true, acoustics: 1.45 } },
            { name: 'The Auditorium', terrain: 'ruins', danger: 0.55, resources: 0.35, adjacent: ['Main Corridor', 'The Library'], features: { cover: 0.75, elevation: false, chokepoint: false, shelterQuality: 0.8, acoustics: 1.3, vertical: true } },
            { name: 'The Flooded Pool', terrain: 'water', danger: 0.7, resources: 0.4, adjacent: ['The Gymnasium', 'The Boiler Room'], features: { cover: 0.2, elevation: false, chokepoint: true, waterSource: false, acoustics: 1.5 } },
            // The field edge has gone over to scrub and bramble — the arena's
            // only green cover.
            { name: 'The Playing Field', terrain: 'forest', danger: 0.4, resources: 0.65, adjacent: ['The Cornucopia (The Yard)'], features: { cover: 0.3, elevation: false, chokepoint: false, shelterQuality: 0.15, acoustics: 0.75 } },
            { name: 'The Roof', terrain: 'open', danger: 0.8, resources: 0.15, adjacent: ['Science Block', 'The Cornucopia (The Yard)'], features: { cover: 0.2, elevation: true, chokepoint: true, shelterQuality: 0.1, vertical: true } },
        ]
    },
    {
        id: 'kelvin',
        restockBias: ['thermal-cloak', 'lantern', 'lamb-stew', 'sleeping-bag'],
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
        // §5: the horn stands inside the cold store, behind a single blast door.
        cornucopiaLayout: 'walled',
        zones: [
            { name: 'The Cornucopia (The Apron)', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['Generator Hall', 'Habitation Ring', 'The Ice Shelf', 'Fuel Farm'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 0.75 } },
            { name: 'Generator Hall', terrain: 'ruins', danger: 0.5, resources: 0.35, adjacent: ['The Cornucopia (The Apron)', 'Habitation Ring', 'Fuel Farm'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 1.45, vertical: true } },
            { name: 'Habitation Ring', terrain: 'ruins', danger: 0.4, resources: 0.55, adjacent: ['The Cornucopia (The Apron)', 'Generator Hall', 'The Mess', 'Laboratory Module'], features: { cover: 0.7, elevation: false, chokepoint: false, shelterQuality: 0.95, acoustics: 0.75 } },
            // The one real larder on a map that is otherwise snow.
            { name: 'The Mess', terrain: 'ruins', danger: 0.35, resources: 0.85, adjacent: ['Habitation Ring', 'Laboratory Module'], features: { cover: 0.5, elevation: false, chokepoint: false, shelterQuality: 0.9, acoustics: 1.25 } },
            { name: 'Laboratory Module', terrain: 'ruins', danger: 0.55, resources: 0.5, adjacent: ['Habitation Ring', 'The Mess', 'The Isotope Store'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.9 } },
            { name: 'The Isotope Store', terrain: 'ruins', danger: 0.9, resources: 0.4, adjacent: ['Laboratory Module', 'The Ridge'], features: { cover: 0.5, elevation: false, chokepoint: true, shelterQuality: 0.85, acoustics: 1.3 } },
            { name: 'Comms Mast', terrain: 'highland', danger: 0.7, resources: 0.15, adjacent: ['The Ridge', 'The Ice Shelf'], features: { cover: 0.1, elevation: true, chokepoint: false, shelterQuality: 0.05, acoustics: 1.25, vertical: true } },
            { name: 'The Ice Shelf', terrain: 'open', danger: 0.65, resources: 0.1, adjacent: ['The Cornucopia (The Apron)', 'Comms Mast', 'The Open Lead'], features: { cover: 0.05, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 0.7 } },
            { name: 'The Open Lead', terrain: 'water', danger: 0.8, resources: 0.45, adjacent: ['The Ice Shelf', 'Fuel Farm'], features: { cover: 0.05, elevation: false, chokepoint: true, waterSource: false, shelterQuality: 0.05 } },
            { name: 'Fuel Farm', terrain: 'open', danger: 0.5, resources: 0.4, adjacent: ['The Cornucopia (The Apron)', 'Generator Hall', 'The Open Lead'], features: { cover: 0.35, elevation: false, chokepoint: false, shelterQuality: 0.3, acoustics: 1.25 } },
            { name: 'The Ridge', terrain: 'highland', danger: 0.75, resources: 0.1, adjacent: ['The Isotope Store', 'Comms Mast'], features: { cover: 0.1, elevation: true, chokepoint: true, shelterQuality: 0.05, acoustics: 0.75, vertical: true } },
        ]
    },
    {
        id: 'silkwood',
        cornucopiaLayout: 'walled',
        restockBias: ['machete', 'wire', 'antidote', 'dried-fruit'],
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
        edgeRules: {
            // §5.5: the bridge is silk, and silk is a consumable. Three
            // crossings is what the span has in it; the fourth tribute to want
            // the Crag has to go the long way round the Ridge Path.
            "Broodmother's Crag|The Silk Bridge": { kind: 'collapsing', crossings: 3 },
        },
        zones: [
            { name: 'The Cornucopia (The Clearing)', terrain: 'open', danger: 0.55, resources: 0.3, adjacent: ['The Low Wood', 'The Silk Bridge', 'The Ridge Path'], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'The Low Wood', terrain: 'forest', danger: 0.45, resources: 0.7, adjacent: ['The Cornucopia (The Clearing)', 'The Sink', 'Web Hollow', 'The Old Burn'], features: { cover: 0.85, elevation: false, chokepoint: false, acoustics: 0.65 } },
            { name: 'The Sink', terrain: 'wetland', danger: 0.65, resources: 0.5, adjacent: ['The Low Wood', 'Web Hollow'], features: { cover: 0.5, elevation: false, chokepoint: true, acoustics: 0.7 } },
            { name: "Broodmother's Crag", terrain: 'highland', danger: 0.95, resources: 0.35, adjacent: ['The Silk Bridge', 'The Ridge Path', 'The Nursery'], features: { cover: 0.3, elevation: true, chokepoint: true, acoustics: 1.3, vertical: true } },
            { name: 'The Silk Bridge', terrain: 'forest', danger: 0.6, resources: 0.4, adjacent: ['The Cornucopia (The Clearing)', "Broodmother's Crag", 'Deadfall Slope'], features: { cover: 0.5, elevation: true, chokepoint: true, acoustics: 0.75, vertical: true } },
            { name: 'Deadfall Slope', terrain: 'forest', danger: 0.55, resources: 0.55, adjacent: ['The Silk Bridge', "The Collector's Lodge", 'The Old Burn'], features: { cover: 0.7, elevation: true, chokepoint: false, acoustics: 0.75 } },
            { name: "The Collector's Lodge", terrain: 'ruins', danger: 0.4, resources: 0.65, adjacent: ['Deadfall Slope', 'The Old Burn'], features: { cover: 0.7, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 0.75, vertical: true } },
            // The one spider-free ground in the arena: nothing to eat here and
            // nothing eating anyone either.
            { name: 'The Old Burn', terrain: 'open', danger: 0.2, resources: 0.15, adjacent: ['The Low Wood', 'Deadfall Slope', "The Collector's Lodge"], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'Web Hollow', terrain: 'forest', danger: 0.75, resources: 0.6, adjacent: ['The Low Wood', 'The Sink', 'The Nursery'], features: { cover: 0.9, elevation: false, chokepoint: false, acoustics: 0.6 } },
            { name: 'The Ridge Path', terrain: 'highland', danger: 0.5, resources: 0.2, adjacent: ['The Cornucopia (The Clearing)', "Broodmother's Crag"], features: { cover: 0.2, elevation: true, chokepoint: true, shelterQuality: 0.1, acoustics: 1.25 } },
            { name: 'The Nursery', terrain: 'forest', danger: 0.9, resources: 0.75, adjacent: ["Broodmother's Crag", 'Web Hollow'], features: { cover: 0.8, elevation: false, chokepoint: true, acoustics: 0.65, vertical: true } },
        ]
    },
    {
        id: 'nooneplace',
        cornucopiaLayout: 'walled',
        restockBias: ['glow-stick', 'crackers', 'canteen', 'bandages'],
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
            // §5.5: the corridor to the Exit is hidden, which is the only
            // honest way to model a door that is only there for the person who
            // has already noticed it. Nobody else can follow them down it.
            'Exit|The Long Hall': { kind: 'hidden' },
        },
        zones: [
            { name: 'The Cornucopia (Reception)', terrain: 'open', danger: 0.5, resources: 0.35, adjacent: ['The Yellow Halls', 'Office Level', 'The Long Hall'], features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.7, acoustics: 1.3 } },
            { name: 'The Yellow Halls', terrain: 'open', danger: 0.55, resources: 0.2, adjacent: ['The Cornucopia (Reception)', 'The Carpet', 'The Stairwell', 'The Long Hall'], features: { cover: 0.3, elevation: false, chokepoint: true, shelterQuality: 0.7, acoustics: 1.5 } },
            // The carpet is damp. It is always damp. It is genuinely a wetland.
            { name: 'The Carpet', terrain: 'wetland', danger: 0.5, resources: 0.4, adjacent: ['The Yellow Halls', 'Office Level', 'The Room With The Chair'], features: { cover: 0.2, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.6, acoustics: 0.6 } },
            { name: 'Office Level', terrain: 'ruins', danger: 0.45, resources: 0.6, adjacent: ['The Cornucopia (Reception)', 'The Carpet', 'The Stairwell'], features: { cover: 0.7, elevation: false, chokepoint: false, shelterQuality: 0.8, acoustics: 0.75, vertical: true } },
            { name: 'The Stairwell', terrain: 'ruins', danger: 0.6, resources: 0.15, adjacent: ['The Yellow Halls', 'Office Level', 'Sub-Level'], features: { cover: 0.4, elevation: true, chokepoint: true, shelterQuality: 0.7, acoustics: 1.55, vertical: true } },
            { name: 'Sub-Level', terrain: 'ruins', danger: 0.7, resources: 0.45, adjacent: ['The Stairwell', 'The Flooded Floor', 'The Room With The Chair'], features: { cover: 0.5, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 1.4, vertical: true } },
            { name: 'The Flooded Floor', terrain: 'water', danger: 0.75, resources: 0.4, adjacent: ['Sub-Level', 'The Long Hall'], features: { cover: 0.15, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.5, acoustics: 1.35 } },
            { name: 'The Room With The Chair', terrain: 'ruins', danger: 0.85, resources: 0.1, adjacent: ['The Carpet', 'Sub-Level'], features: { cover: 0.2, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 0.7 } },
            { name: 'The Long Hall', terrain: 'open', danger: 0.6, resources: 0.15, adjacent: ['The Cornucopia (Reception)', 'The Yellow Halls', 'The Flooded Floor', 'Exit'], features: { cover: 0.15, elevation: false, chokepoint: true, shelterQuality: 0.7, acoustics: 1.5 } },
            { name: 'Exit', terrain: 'open', danger: 0.3, resources: 0.1, adjacent: ['The Long Hall'], features: { cover: 0.1, elevation: false, chokepoint: true, shelterQuality: 0.5, acoustics: 1.25 } },
        ]
    },
    {
        id: 'redcathedral',
        cornucopiaLayout: 'island',
        restockBias: ['rope', 'waterskin', 'iodine', 'dried-fruit'],
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
            // §5.5: the rope up the Butte is the same rope every time, and it
            // is not getting better. Two crossings, then it is a dead end in
            // the sky with nobody in it — or somebody.
            'The Butte|The South Rim': { kind: 'collapsing', crossings: 2 },
        },
        zones: [
            { name: 'The Cornucopia (The North Rim)', terrain: 'highland', danger: 0.55, resources: 0.3, adjacent: ['Rim Pinyon', 'The Bright Angel Descent'], features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.1, acoustics: 1.3, vertical: true } },
            { name: 'Rim Pinyon', terrain: 'forest', danger: 0.35, resources: 0.7, adjacent: ['The Cornucopia (The North Rim)', 'The Bright Angel Descent'], features: { cover: 0.6, elevation: true, chokepoint: false, acoustics: 0.75 } },
            // The only stair between two worlds. Everyone who wants water
            // walks it, and everyone knows everyone walks it.
            { name: 'The Bright Angel Descent', terrain: 'highland', danger: 0.7, resources: 0.1, adjacent: ['The Cornucopia (The North Rim)', 'Rim Pinyon', 'Upper Bench'], features: { cover: 0.15, elevation: true, chokepoint: true, acoustics: 1.4, vertical: true } },
            { name: 'Upper Bench', terrain: 'open', danger: 0.5, resources: 0.35, adjacent: ['The Bright Angel Descent', 'The Slot', 'Cliff Dwellings'], features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.1, acoustics: 1.3 } },
            { name: 'The Slot', terrain: 'highland', danger: 0.85, resources: 0.15, adjacent: ['Upper Bench', 'The Wash'], features: { cover: 0.6, elevation: false, chokepoint: true, acoustics: 1.55, vertical: true } },
            { name: 'Cliff Dwellings', terrain: 'ruins', danger: 0.45, resources: 0.6, adjacent: ['Upper Bench', 'Lower Bench'], features: { cover: 0.7, elevation: true, chokepoint: true, shelterQuality: 0.85, acoustics: 1.3, vertical: true } },
            { name: 'Lower Bench', terrain: 'open', danger: 0.6, resources: 0.3, adjacent: ['Cliff Dwellings', 'The Wash', 'The River', 'The Seeps', 'The South Rim'], features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.1, acoustics: 1.35 } },
            { name: 'The Wash', terrain: 'open', danger: 0.75, resources: 0.25, adjacent: ['The Slot', 'Lower Bench', 'The River'], features: { cover: 0.3, elevation: false, chokepoint: true, shelterQuality: 0.1, acoustics: 1.4 } },
            // The one legal drink in the arena, and everybody knows it.
            { name: 'The River', terrain: 'water', danger: 0.65, resources: 0.55, adjacent: ['The Wash', 'Lower Bench'], features: { cover: 0.15, elevation: false, chokepoint: false, waterSource: true, shelterQuality: 0.1, acoustics: 1.25 } },
            { name: 'The Seeps', terrain: 'water', danger: 0.7, resources: 0.4, adjacent: ['Lower Bench'], features: { cover: 0.5, elevation: false, chokepoint: true, waterSource: true, acoustics: 1.35 } },
            { name: 'The South Rim', terrain: 'highland', danger: 0.5, resources: 0.25, adjacent: ['Lower Bench', 'The Butte'], features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.1, acoustics: 1.3, vertical: true } },
            // A dead end in the sky. Getting up costs the rope; there is no
            // second rope for getting down.
            { name: 'The Butte', terrain: 'highland', danger: 0.4, resources: 0.2, adjacent: ['The South Rim'], features: { cover: 0.3, elevation: true, chokepoint: true, shelterQuality: 0.15, acoustics: 1.35, vertical: true } },
        ]
    },
    {
        id: 'menagerie',
        cornucopiaLayout: 'walled',
        restockBias: ['net', 'spear', 'antidote', 'groosling'],
        name: 'The Menagerie',
        description: 'A zoo, opening. The keeper\'s release schedule is posted at the gate, and it is accurate — every enclosure in the park opens on time, in order, and everyone knows exactly when.',
        mutts: ['Raptors', 'The Troop', 'Constrictors & Vipers', 'The Bears', 'The Herd', 'The Cats', 'Quarantine'],
        events: ['The Schedule', 'Feeding Time', 'Ahead of Schedule'],
        law: 'cornucopiaRefills',
        // §5.2: the animals are the weapons here, and the keepers never left
        // anything sharp lying around a public park. Spreads `noWeapons` off
        // the one arena that was carrying the whole law by itself.
        laws: ['noWeapons'],
        effectVocab: {
            stripped: { label: 'cleaned out' },
            contaminated: { label: 'the reptile house', durationMult: 1.2 },
            blooming: { label: 'the arboretum' },
        },
        zones: [
            { name: 'The Cornucopia (The Plaza)', terrain: 'open', danger: 0.6, resources: 0.35, adjacent: ['The Feed Store', 'Big Cat Terrace', 'The Aviary', 'Elephant Paddock', 'Keeper\'s Yard'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.1, acoustics: 1.25 } },
            // The larder everything in the park can smell. The refill law is
            // this zone's whole personality.
            { name: 'The Feed Store', terrain: 'ruins', danger: 0.7, resources: 0.9, adjacent: ['The Cornucopia (The Plaza)', 'Keeper\'s Yard'], features: { cover: 0.5, elevation: false, chokepoint: true, shelterQuality: 0.8 } },
            { name: 'Big Cat Terrace', terrain: 'open', danger: 0.75, resources: 0.25, adjacent: ['The Cornucopia (The Plaza)', 'The Primate Wood', 'Bear Moat'], features: { cover: 0.3, elevation: true, chokepoint: false, vertical: true } },
            { name: 'The Primate Wood', terrain: 'forest', danger: 0.55, resources: 0.6, adjacent: ['Big Cat Terrace', 'The Arboretum', 'Reptile House'], features: { cover: 0.75, elevation: false, chokepoint: false, acoustics: 0.75, vertical: true } },
            { name: 'Reptile House', terrain: 'ruins', danger: 0.8, resources: 0.3, adjacent: ['The Primate Wood', 'The Aquarium'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.85, acoustics: 1.3 } },
            { name: 'The Aviary', terrain: 'wetland', danger: 0.5, resources: 0.5, adjacent: ['The Cornucopia (The Plaza)', 'Elephant Paddock', 'The Aquarium'], features: { cover: 0.5, elevation: false, chokepoint: true, waterSource: false, acoustics: 1.25, vertical: true } },
            { name: 'Elephant Paddock', terrain: 'open', danger: 0.45, resources: 0.4, adjacent: ['The Cornucopia (The Plaza)', 'The Aviary', 'The Perimeter Fence'], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'The Aquarium', terrain: 'ruins', danger: 0.6, resources: 0.35, adjacent: ['Reptile House', 'The Aviary', 'Bear Moat'], features: { cover: 0.55, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 1.45, vertical: true } },
            { name: 'Bear Moat', terrain: 'water', danger: 0.7, resources: 0.45, adjacent: ['Big Cat Terrace', 'The Aquarium', 'Quarantine'], features: { cover: 0.3, elevation: false, chokepoint: true, waterSource: false, acoustics: 1.3 } },
            { name: 'The Arboretum', terrain: 'forest', danger: 0.3, resources: 0.8, adjacent: ['The Primate Wood', 'Keeper\'s Yard'], features: { cover: 0.8, elevation: false, chokepoint: false, acoustics: 0.7 } },
            { name: 'Keeper\'s Yard', terrain: 'ruins', danger: 0.4, resources: 0.55, adjacent: ['The Cornucopia (The Plaza)', 'The Feed Store', 'The Arboretum', 'Quarantine'], features: { cover: 0.45, elevation: false, chokepoint: true, shelterQuality: 0.7 } },
            { name: 'The Perimeter Fence', terrain: 'open', danger: 0.5, resources: 0.15, adjacent: ['Elephant Paddock', 'Quarantine'], features: { cover: 0.1, elevation: false, chokepoint: true, shelterQuality: 0.05 } },
            // Unlisted contents. Last on the schedule for a reason.
            { name: 'Quarantine', terrain: 'ruins', danger: 0.9, resources: 0.5, adjacent: ['Bear Moat', 'Keeper\'s Yard', 'The Perimeter Fence'], features: { cover: 0.4, elevation: false, chokepoint: true, shelterQuality: 0.85, acoustics: 1.35 } },
        ]
    },
    {
        id: 'storywood',
        cornucopiaLayout: 'walled',
        restockBias: ['axe', 'matches', 'bread', 'cheese'],
        name: 'The Story Wood',
        description: 'A forest of fairytale cottages, every chimney smoking, every door unlocked. Every one of them opens. Every one of them costs something. The wood is always slightly colder than it should be.',
        mutts: ['The Wolf', 'The Bramble', 'Ravens', 'Something in the Millpond', 'The Sisters'],
        events: ['The Bargain', 'The Telling Mist', 'The Path'],
        // The only medicine in this arena is a bargain, never an item.
        // Audit 3 §5.2: ...and the wood is generous to whoever finds the
        // Gingerbread House, which is the oldest version of this trap there is.
        // `bountifulGround` keeps one sector permanently in flower, so the arena
        // that takes away medicine also offers the one place that gives it
        // back, and everybody knows where it is.
        laws: ['noHealing', 'bountifulGround'],
        lawZone: 'The Gingerbread House',
        effectVocab: {
            blooming: { label: 'the wood is generous' },
            fogbound: { label: 'the telling mist' },
            irradiated: { label: 'a bad bargain' },
        },
        edgeRules: {
            // §5.5: the Tower's stair is a bargain like everything else here.
            // It is a stair twice; after that it only goes up, and whoever is
            // in the best-stocked room in the wood is in it for good.
            'The Spinning House|The Tower': { kind: 'oneWayAfter', from: 'The Spinning House', to: 'The Tower', after: 2 },
        },
        zones: [
            { name: 'The Cornucopia (The Clearing)', terrain: 'open', danger: 0.55, resources: 0.35, adjacent: ['The Path', 'The Deep Wood', 'The Field of Stones'], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            // The one honest road in the arena: low danger, and it goes
            // exactly where it says.
            { name: 'The Path', terrain: 'forest', danger: 0.2, resources: 0.3, adjacent: ['The Cornucopia (The Clearing)', 'The Woodcutter\'s Cottage', 'Grandmother\'s Cottage'], features: { cover: 0.6, elevation: false, chokepoint: true, acoustics: 0.75 } },
            { name: 'The Deep Wood', terrain: 'forest', danger: 0.7, resources: 0.6, adjacent: ['The Cornucopia (The Clearing)', 'The Gingerbread House', 'The Spinning House', 'The Bramble'], features: { cover: 0.8, elevation: false, chokepoint: false, acoustics: 0.6 } },
            { name: 'The Gingerbread House', terrain: 'ruins', danger: 0.75, resources: 0.85, adjacent: ['The Deep Wood', 'The Bramble'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.85 } },
            { name: 'The Woodcutter\'s Cottage', terrain: 'ruins', danger: 0.4, resources: 0.5, adjacent: ['The Path', 'The Millpond'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 0.75 } },
            { name: 'The Spinning House', terrain: 'ruins', danger: 0.6, resources: 0.4, adjacent: ['The Deep Wood', 'The Tower'], features: { cover: 0.5, elevation: false, chokepoint: true, shelterQuality: 0.85, vertical: true } },
            { name: 'The Millpond', terrain: 'water', danger: 0.6, resources: 0.5, adjacent: ['The Woodcutter\'s Cottage', 'The Well'], features: { cover: 0.2, elevation: false, chokepoint: false, waterSource: true, shelterQuality: 0.1 } },
            { name: 'The Well', terrain: 'water', danger: 0.65, resources: 0.3, adjacent: ['The Millpond', 'The Field of Stones', 'Grandmother\'s Cottage'], features: { cover: 0.2, elevation: false, chokepoint: true, waterSource: true, acoustics: 1.5, vertical: true } },
            { name: 'Grandmother\'s Cottage', terrain: 'ruins', danger: 0.5, resources: 0.55, adjacent: ['The Path', 'The Well'], features: { cover: 0.65, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 0.75 } },
            { name: 'The Bramble', terrain: 'forest', danger: 0.9, resources: 0.45, adjacent: ['The Deep Wood', 'The Gingerbread House'], features: { cover: 0.9, elevation: false, chokepoint: true, acoustics: 0.65 } },
            { name: 'The Field of Stones', terrain: 'open', danger: 0.45, resources: 0.2, adjacent: ['The Cornucopia (The Clearing)', 'The Well', 'The Tower'], features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 1.25 } },
            // The Tower's bargain (locking somebody in) has no transit
            // machinery to hang on, so the Tower pays out in resources
            // instead: the best-stocked room in the wood, at the top of the
            // most obvious climb.
            { name: 'The Tower', terrain: 'ruins', danger: 0.55, resources: 0.8, adjacent: ['The Spinning House', 'The Field of Stones'], features: { cover: 0.4, elevation: true, chokepoint: true, shelterQuality: 0.85, acoustics: 1.4, vertical: true } },
        ]
    },
    // ---- §13.3: three hand-authored arenas -------------------------------
    // Each is built against a shape the roster does not already have. The
    // four existing winter arenas (frozen, glacier, floe, alpine) are all
    // sprawling exterior wilderness; the four volcanic ones (ashfall,
    // ashwaste, burnscar, craterfield) are all exterior; and the five
    // underground ones (vault, warren, quarry, terraces, glacier's ice caves)
    // are worked tunnels, a schedule, or lit from above. These are the
    // interior winter siege, the descent, and true darkness.
    {
        id: 'cabin',
        cornucopiaLayout: 'walled',
        // §5.7: a snowbound homestead's drop is cold-weather kit and food.
        restockBias: ['sleeping-bag', 'thermal-cloak', 'lamb-stew', 'hardtack', 'matches'],
        name: 'The Snowbound Homestead',
        description: 'A homestead the drifts have half-buried, a working woodstove behind four thin walls, and a killing cold on the other side of the door. Whoever holds the hearth holds the only warm room within a day\'s walk.',
        mutts: ['The Woodsman', 'Draught Wisps', 'Panicked Draft Horses', 'The Caller in the Storm'],
        events: ['The Woodpile Runs Out', 'A Door Left Open', 'The Storm Breaks'],
        // The Root Cellar is the only part of the property a parachute can
        // reach through the storm — the hatch is the one gap in the drifts.
        law: 'sponsorsFixedZone',
        lawZone: 'The Root Cellar',
        effectVocab: {
            frozen: { label: 'A hearthless night' },
            stripped: { label: 'The larder runs bare' },
        },
        // Breaking trail through chest-high drifts with no cover at all.
        edgeRules: { 'The Snowed Road|Treeline Approach': { kind: 'tolled', toll: { fatigue: 9, woundChance: 0.15 } } },
        zones: [
            { name: 'The Cornucopia (Dooryard)', terrain: 'open', danger: 0.6, resources: 0.35, adjacent: ['The Porch', 'The Woodshed', 'The Frozen Well', 'The Barn'], features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.1, acoustics: 0.75 } },
            { name: 'The Porch', terrain: 'ruins', danger: 0.5, resources: 0.2, adjacent: ['The Cornucopia (Dooryard)', 'Front Room'], features: { cover: 0.3, elevation: false, chokepoint: true, shelterQuality: 0.5 } },
            // The interior: thin walls, a stove that can be lit, and no way in
            // that is not watched from somewhere.
            { name: 'Front Room', terrain: 'ruins', danger: 0.55, resources: 0.4, adjacent: ['The Porch', 'Kitchen', 'The Loft'], features: { cover: 0.55, elevation: false, chokepoint: false, shelterQuality: 0.95, acoustics: 0.8 } },
            { name: 'Kitchen', terrain: 'ruins', danger: 0.45, resources: 0.65, adjacent: ['Front Room', 'The Root Cellar', 'The Back Door'], features: { cover: 0.5, elevation: false, chokepoint: false, shelterQuality: 0.95, acoustics: 0.8 } },
            { name: 'The Root Cellar', terrain: 'ruins', danger: 0.4, resources: 0.9, adjacent: ['Kitchen'], features: { cover: 0.7, elevation: false, chokepoint: true, shelterQuality: 1, acoustics: 0.7, vertical: true } },
            { name: 'The Loft', terrain: 'ruins', danger: 0.35, resources: 0.3, adjacent: ['Front Room'], features: { cover: 0.4, elevation: true, chokepoint: true, shelterQuality: 0.9, acoustics: 0.75, vertical: true } },
            { name: 'The Woodshed', terrain: 'ruins', danger: 0.6, resources: 0.55, adjacent: ['The Cornucopia (Dooryard)', 'The Barn', 'The Back Door'], features: { cover: 0.45, elevation: false, chokepoint: false, shelterQuality: 0.6 } },
            { name: 'The Barn', terrain: 'ruins', danger: 0.7, resources: 0.5, adjacent: ['The Cornucopia (Dooryard)', 'The Woodshed', 'Treeline Approach'], features: { cover: 0.5, elevation: false, chokepoint: false, shelterQuality: 0.7, acoustics: 1.3, vertical: true } },
            { name: 'The Back Door', terrain: 'open', danger: 0.65, resources: 0.15, adjacent: ['Kitchen', 'The Woodshed', 'The Frozen Well'], features: { cover: 0.15, elevation: false, chokepoint: true, shelterQuality: 0.15 } },
            { name: 'The Frozen Well', terrain: 'water', danger: 0.5, resources: 0.45, adjacent: ['The Cornucopia (Dooryard)', 'The Back Door'], features: { cover: 0.1, elevation: false, chokepoint: false, waterSource: true, shelterQuality: 0.1, acoustics: 0.7 } },
            { name: 'Treeline Approach', terrain: 'forest', danger: 0.75, resources: 0.6, adjacent: ['The Barn', 'The Snowed Road'], features: { cover: 0.75, elevation: false, chokepoint: false, shelterQuality: 0.35, acoustics: 0.65 } },
            // The buried way out that isn't one.
            { name: 'The Snowed Road', terrain: 'open', danger: 0.85, resources: 0.05, adjacent: ['Treeline Approach'], features: { cover: 0.05, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 0.65 } },
        ]
    },
    {
        id: 'magmatube',
        // §5.7: the horn in a volcano leans toward what keeps a person
        // alive in one — burn kit, water, and something to filter the air.
        restockBias: ['ointment', 'tablets', 'canteen', 'thermal-cloak', 'charcoal-filter'],
        name: 'The Throat of the Mountain',
        description: 'Not a mountainside — the mountain\'s own throat. Obsidian tube walls, a red glow with no visible source, and a heat gradient that only goes one direction as you go down. The good loot is at the bottom. So is the lake.',
        mutts: ['Cinder Wyrms', 'The Glassblower', 'Sulfur Gnats', 'Thermal Kestrels'],
        events: ['The Deep Exhale', 'Glass Rain', 'The Lake Rises'],
        law: 'noWaterExceptZone',
        lawZone: 'The Condensation Cistern',
        effectVocab: {
            burning: { label: 'A vent flare' },
            contaminated: { label: 'A sulfur choke' },
        },
        // The direct climb back up is sealed by rockfall: anyone who takes the
        // shaft down is committed to finding The Long Way Round.
        edgeRules: { 'Lower Throat|The Ember Shaft': { kind: 'oneWay', from: 'The Ember Shaft', to: 'Lower Throat' } },
        // §5: the crater rim closes around the horn on three sides.
        cornucopiaLayout: 'walled',
        zones: [
            { name: 'The Cornucopia (Crater Rim)', terrain: 'highland', danger: 0.6, resources: 0.3, adjacent: ['The Ash-Choked Stair', 'The Outer Gallery'], features: { cover: 0.15, elevation: true, chokepoint: false, shelterQuality: 0.1, acoustics: 1.25, vertical: true } },
            { name: 'The Ash-Choked Stair', terrain: 'highland', danger: 0.55, resources: 0.15, adjacent: ['The Cornucopia (Crater Rim)', 'The Outer Gallery', 'The Steam Vents'], features: { cover: 0.2, elevation: true, chokepoint: true, acoustics: 1.45, vertical: true } },
            { name: 'The Outer Gallery', terrain: 'ruins', danger: 0.45, resources: 0.4, adjacent: ['The Cornucopia (Crater Rim)', 'The Ash-Choked Stair', 'The Condensation Cistern', 'The Bat Colony', 'The Long Way Round'], features: { cover: 0.5, elevation: false, chokepoint: false, shelterQuality: 0.7, acoustics: 1.4, vertical: true } },
            { name: 'The Condensation Cistern', terrain: 'water', danger: 0.5, resources: 0.55, adjacent: ['The Outer Gallery', 'The Sulfur Shelf'], features: { cover: 0.25, elevation: false, chokepoint: true, waterSource: true, acoustics: 1.4 } },
            { name: 'The Steam Vents', terrain: 'ruins', danger: 0.75, resources: 0.35, adjacent: ['The Ash-Choked Stair', 'The Sulfur Shelf', 'The Upper Throat'], features: { cover: 0.35, elevation: false, chokepoint: true, shelterQuality: 0.5, acoustics: 0.75 } },
            { name: 'The Sulfur Shelf', terrain: 'highland', danger: 0.7, resources: 0.25, adjacent: ['The Condensation Cistern', 'The Steam Vents', 'The Bat Colony'], features: { cover: 0.3, elevation: true, chokepoint: false, acoustics: 1.3, vertical: true } },
            { name: 'The Bat Colony', terrain: 'forest', danger: 0.5, resources: 0.7, adjacent: ['The Outer Gallery', 'The Sulfur Shelf', 'The Upper Throat'], features: { cover: 0.85, elevation: false, chokepoint: false, acoustics: 1.2, vertical: true } },
            { name: 'The Upper Throat', terrain: 'ruins', danger: 0.8, resources: 0.3, adjacent: ['The Steam Vents', 'The Bat Colony', 'The Ember Shaft'], features: { cover: 0.2, elevation: false, chokepoint: true, acoustics: 1.5, vertical: true } },
            // §5.1: one named place with a height to it — the descent happens inside
            // this zone rather than between two of them.
            { name: 'The Ember Shaft', terrain: 'highland', danger: 0.85, resources: 0.2, adjacent: ['The Upper Throat', 'Lower Throat'], features: { cover: 0.1, elevation: true, chokepoint: true, acoustics: 1.5, vertical: true } },
            { name: 'Lower Throat', terrain: 'ruins', danger: 0.9, resources: 0.5, adjacent: ['The Ember Shaft', 'The Lava Lake Antechamber', 'The Long Way Round'], features: { cover: 0.3, elevation: false, chokepoint: true, acoustics: 1.5, vertical: true } },
            // Best resources, worst danger, and only one way back out of it.
            { name: 'The Lava Lake Antechamber', terrain: 'open', danger: 1, resources: 0.95, adjacent: ['Lower Throat'], features: { cover: 0.15, elevation: false, chokepoint: true, shelterQuality: 0.3, acoustics: 1.5 } },
            { name: 'The Long Way Round', terrain: 'ruins', danger: 0.65, resources: 0.35, adjacent: ['Lower Throat', 'The Outer Gallery'], features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.7, acoustics: 1.3 } },
        ]
    },
    {
        id: 'karst',
        cornucopiaLayout: 'walled',
        // §5.7: in a cave with no light, light is the supply drop.
        restockBias: ['lantern', 'glow-stick', 'rope', 'tablets', 'iodine'],
        name: 'The Undermere',
        description: 'No sky, and past the first gallery, no light either — only what a handful of glowing fungus throws, and the sound of water going somewhere in the dark. Rock this thick does not carry a cannon. Down here, you only know somebody is dead if you find them.',
        mutts: ['Glowmoss Weevils', 'The Unseen', 'Chorus Newts', 'The Deep Listener'],
        events: ['The Siphon Floods', 'The Moss Dims', 'The Roof Groans'],
        // A distinct in-fiction reason from `vault`'s technological blackout:
        // solid rock simply does not transmit the sound this deep.
        law: 'noCannons',
        effectVocab: {
            flooded: { label: 'The siphon opens' },
            contaminated: { label: 'A bad air pocket' },
        },
        // A steep, wet flowstone squeeze: a narrow crawl into a vast dark room.
        edgeRules: { 'The Cathedral|The Weeping Wall': { kind: 'tolled', toll: { fatigue: 11 } } },
        zones: [
            { name: 'The Cornucopia (Sinkhole Floor)', terrain: 'open', danger: 0.6, resources: 0.35, adjacent: ['The Drip Gallery', 'The Glowmoss Hollow', 'The Bat Roost'], features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.4, acoustics: 1.4, vertical: true } },
            { name: 'The Drip Gallery', terrain: 'ruins', danger: 0.45, resources: 0.3, adjacent: ['The Cornucopia (Sinkhole Floor)', 'The Bone Passage', 'The Weeping Wall'], features: { cover: 0.35, elevation: false, chokepoint: false, waterSource: true, shelterQuality: 0.8, acoustics: 1.45, vertical: true } },
            { name: 'The Glowmoss Hollow', terrain: 'forest', danger: 0.4, resources: 0.85, adjacent: ['The Cornucopia (Sinkhole Floor)', 'The Bat Roost', 'The Siphon Passage'], features: { cover: 0.6, elevation: false, chokepoint: false, shelterQuality: 0.85, acoustics: 0.75 } },
            { name: 'The Bat Roost', terrain: 'forest', danger: 0.55, resources: 0.6, adjacent: ['The Cornucopia (Sinkhole Floor)', 'The Glowmoss Hollow', 'The Bone Passage'], features: { cover: 0.85, elevation: true, chokepoint: false, shelterQuality: 0.8, acoustics: 1.2, vertical: true } },
            { name: 'The Bone Passage', terrain: 'ruins', danger: 0.65, resources: 0.4, adjacent: ['The Drip Gallery', 'The Bat Roost', 'The Black Gallery'], features: { cover: 0.4, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 1.5 } },
            { name: 'The Weeping Wall', terrain: 'water', danger: 0.6, resources: 0.45, adjacent: ['The Drip Gallery', 'The Cathedral', 'The Undermere'], features: { cover: 0.25, elevation: true, chokepoint: true, waterSource: true, acoustics: 1.1, vertical: true } },
            // §5.1: the flowstone squeeze comes in high; the floor is a long way
            // under it, and in the dark that is two different places.
            { name: 'The Cathedral', terrain: 'open', danger: 0.8, resources: 0.2, adjacent: ['The Weeping Wall', 'The Black Gallery'], features: { cover: 0.05, elevation: false, chokepoint: false, shelterQuality: 0.7, acoustics: 1.6, vertical: true } },
            { name: 'The Black Gallery', terrain: 'ruins', danger: 0.9, resources: 0.55, adjacent: ['The Bone Passage', 'The Cathedral', 'The Undermere'], features: { cover: 0.3, elevation: false, chokepoint: false, shelterQuality: 0.8, acoustics: 1.55, vertical: true } },
            { name: 'The Undermere', terrain: 'water', danger: 0.7, resources: 0.65, adjacent: ['The Weeping Wall', 'The Black Gallery', 'The Siphon Passage'], features: { cover: 0.2, elevation: false, chokepoint: false, waterSource: true, shelterQuality: 0.5, acoustics: 1.3 } },
            { name: 'The Siphon Passage', terrain: 'wetland', danger: 0.75, resources: 0.3, adjacent: ['The Glowmoss Hollow', 'The Undermere'], features: { cover: 0.3, elevation: false, chokepoint: true, waterSource: true, shelterQuality: 0.6, acoustics: 1.2 } },
        ]
    },
];

/**
 * Audit 4 §1.1: the `contested`, `collapsing`, `hidden` and `oneWayAfter`
 * edges nobody had authored, folded in from `data/arenaEdges.ts`.
 *
 * Applied here rather than written inline above so the whole set reads
 * together and so `check-arena-layout` can assert things about it as a set.
 * An edge an arena declares for itself always wins — see `withExtraEdgeRules`.
 */
// §1 (requests): the five new arenas, spread in before the edge-rule pass so
// they are subject to exactly the same treatment as every arena above them.
ARENAS.push(...NEW_ARENAS);

ARENAS.forEach((arena, i) => { ARENAS[i] = withExtraEdgeRules(arena); });

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
    /*
     * AUDIT-7 §12.3: the thirty new traits, held to the same rule — the table
     * is only worth having if it cannot produce somebody who contradicts
     * themselves on their own character sheet.
     */
    ['Watchful', 'Takes People As They Come'],
    ['Watchful', 'Paranoid'],
    ['Straight Story', 'Fabulist'],
    ['Straight Story', 'Horse Trader'],
    ['Horse Trader', 'Hard Bargain'],
    ['Finisher', 'Pacifist'],
    ['Finisher', 'Merciful'],
    ['Finisher', 'Softhearted'],
    ['Long Sight', 'Wrestler'],
    ['Long Sight', 'Brute'],
    ['First Off The Plate', 'Skittish'],
    ['First Off The Plate', 'Sworn Off'],
    ['Cinder-Handed', 'Fire-Shy'],
    ['Grudge-Fed', 'Peacemaker'],
    ['Grudge-Fed', 'Sworn Off'],
    ['Takes People As They Come', 'Paranoid'],
    ['Takes People As They Come', 'Prickly'],
    ['Good For It', 'Treacherous'],
    ['Good For It', 'Owes Nobody'],
    ['Letter Of The Law', 'Treacherous'],
    ['Thrifty', 'Hollow Leg'],
    ['Thrifty', 'Iron Stomach'],
    ['Sun-Fed', 'Frost-Born'],
    ['Sun-Fed', 'Sun-Blind'],
    ['Sun-Fed', 'Cold-Blooded'],
    ['Slow Burn', 'Insomniac'],
    ['Slow Burn', 'Second Wind'],
    ['Hollow Leg', 'Hydrophilic'],
    ['Hollow Leg', 'Camel'],
    ['Set Bones', 'Thin-Blooded'],
    ['Set Bones', 'Fragile'],
    ['Left-Guard', 'Clumsy'],
    ['Overreach', 'Cool-Headed'],
    ['Overreach', 'Counterpuncher'],
    ['Counterpuncher', 'Bloodthirsty'],
    ['Reads The Room', 'Unremarkable'],
    ['Reads The Room', 'Stone-Faced'],
    ['Owes Nobody', 'Barterer'],
    ['Owes Nobody', 'Vouched'],
    ['Keeps Books', 'Clumsy'],
    ['Spoken For', 'Unremarkable'],
    ['Reads Ground', 'Gut-Wise'],
    ['Night Ear', 'Night-Sighted'],
    ['Night Ear', 'Sun-Blind'],
    ['Steady Hand', 'Clumsy'],
    ['Steady Hand', 'Rope-Handed'],

    /*
     * AUDIT-8 §12.3: the thirty new traits, and the contradictions among them.
     *
     * A trait pair that says opposite things about the same tribute is the
     * one thing `traitFits` exists to prevent, and a new batch is where they
     * get introduced. Every pair below is either a direct contradiction
     * between two of the new rows or between a new row and something the
     * table already carried.
     */
    ['Straight Dealer', 'Known Liar'],
    ['Straight Dealer', 'Fabulist'],
    ['Trusted Voice', 'Known Liar'],
    ['Known Liar', 'Straight Story'],
    ['Slow To Doubt', 'Paranoid'],
    ['Slow To Doubt', 'Tallyman'],
    ['Never Renegotiates', 'Hard Bargain'],
    ['Never Renegotiates', 'Horse Trader'],
    ['Clause-Minded', 'Contrarian'],
    ['Owes The Room', 'Owes Nobody'],
    ['Settles Up', 'Hoarder'],
    ['Takes The Floor', 'Unremarkable'],
    ['Takes The Floor', 'Quiet Room'],
    ['Hard Look', 'Unremarkable'],
    ['Pack Sense', 'Prickly'],
    ['First Through', 'Hangs Back'],
    ['First Through', 'First Off The Plate'],
    ['Hangs Back', 'Cold Opener'],
    ['Finishes It', 'Cannot Finish It'],
    ['Finishes It', 'Merciful'],
    ['Cannot Finish It', 'Finisher'],
    ['Cannot Finish It', 'Ruthless'],
    ['Fights Wounded', 'Thin-Skinned'],
    ['Fights Wounded', 'Fragile'],
    ['Grips Hard', 'Clumsy'],
    ['Heat-Bred', 'Runs Cold'],
    ['Heat-Bred', 'Sunburnt'],
    ['Heat-Bred', 'Frost-Born'],
    ['Runs Cold', 'Sun-Hardened'],
    ['Runs Cold', 'Thin-Blooded'],
    ['Thin Sleeper', 'Light Sleeper'],
    ['Thin Sleeper', 'Hollow Leg'],
    ['Heavy Bones', 'Lightfooted'],
    ['Heavy Bones', 'Nimble'],
    ['Heavy Bones', 'Fleet'],
    ['Long Wind', 'Fragile'],
    ['Eats Late', 'Hollow Leg'],
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

    /*
     * AUDIT-6 §6.5: the table ran eighteen weapons against three water items
     * and seven medical ones, in a game where dehydration is 4.7% of deaths
     * and the fourth-largest cause. Six more of each, and every one of them
     * has a read site — a medical item the engine does not look for by id is
     * a heavier bandage with a different name on it.
     */
    // Water. Two of these are apparatus rather than doses: see `reusable`.
    { id: 'still', name: 'Solar Still', type: 'water', value: 55, purifies: true, reusable: true },
    { id: 'condenser', name: 'Capitol Condenser', type: 'water', value: 70, purifies: true, reusable: true },
    { id: 'gourd', name: 'Sealed Gourd', type: 'water', value: 18, stack: 3 },
    { id: 'rain-tarp', name: 'Rain Tarp', type: 'water', value: 32, stack: 2 },
    { id: 'snowmelt', name: 'Flask of Snowmelt', type: 'water', value: 22, stack: 2 },
    { id: 'birch-tap', name: 'Birch Tap', type: 'water', value: 26, stack: 2 },
    // Medical, each answering a specific injury the engine tracks.
    { id: 'tourniquet', name: 'Field Tourniquet', type: 'medical', value: 28, stack: 2 },
    { id: 'sutures', name: 'Suture Thread', type: 'medical', value: 42, stack: 2 },
    { id: 'cautery-kit', name: 'Cautery Kit', type: 'medical', value: 50 },
    { id: 'antivenom', name: 'Antivenom Ampoule', type: 'medical', value: 65 },
    { id: 'splint', name: 'Field Splint', type: 'medical', value: 35 },
    { id: 'willowbark', name: 'Willowbark Tea', type: 'medical', value: 24, stack: 3 },
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
