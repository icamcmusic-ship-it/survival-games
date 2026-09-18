import { Arena, Zone, Terrain, ZoneFeatures } from '../models/types';

/**
 * §1 (requests): five new hand-authored arenas, one per new standing law.
 *
 * Kept in their own module rather than appended to the 1,300-line array in
 * `constants.ts`, because the thing that makes an arena roster maintainable is
 * being able to read one arena without scrolling past six. `ARENAS` spreads
 * these in; every consumer sees one list.
 *
 * Each carries a law that exists nowhere else — the point of a new arena is a
 * new question, and a new map with a borrowed rule is a reskin — plus one
 * existing law chosen to argue with it. The Saltworks takes ground away and
 * puts all the water in one place; the Kiln takes shade away and leaves one
 * cellar that feeds you. Neither pairing works out to "harder"; both work out
 * to "somewhere else to stand".
 */

/** Builds a symmetric adjacency list from an undirected edge list. */
function link(
    zones: Array<{ name: string; terrain: Terrain; danger: number; resources: number; features?: ZoneFeatures }>,
    edges: Array<[number, number]>,
): Zone[] {
    const adjacency: string[][] = zones.map(() => []);
    edges.forEach(([a, b]) => {
        if (!adjacency[a].includes(zones[b].name)) adjacency[a].push(zones[b].name);
        if (!adjacency[b].includes(zones[a].name)) adjacency[b].push(zones[a].name);
    });
    return zones.map((z, i) => ({ ...z, adjacent: adjacency[i] }));
}

export const NEW_ARENAS: Arena[] = [
    {
        id: 'tidewrack',
        name: 'The Tidewrack Flats',
        description: 'A tidal estuary that rearranges itself every night. Nothing edible grows in the salt, and the route you walked at noon may not exist at midnight.',
        // §1: the tide is the map, and the map is the law. `noForage` is the
        // argument with it — a tribute who cannot live off the flats has to
        // keep crossing them, and the crossings are what the tide controls.
        laws: ['tidalBorders', 'noForage'],
        eventPack: 'tidewrack',
        cornucopiaLayout: 'island',
        restockBias: ['rope', 'canteen', 'dried-fruit', 'net'],
        mutts: ['Wrack Crabs', 'Channel Eels', 'Tide Callers', 'Gull Mutts'],
        events: ['Spring Tide', 'The Neap', 'Channel Surge'],
        effectVocab: { flooded: { label: 'the tide coming in', severityMult: 1.25 } },
        zones: link([
            { name: 'The Cornucopia (Sandbar)', terrain: 'open', danger: 0.6, resources: 0.3, features: { cover: 0.05, elevation: false, chokepoint: true, shelterQuality: 0.05, acoustics: 1.2 } },
            { name: 'The Ebb Channel', terrain: 'water', danger: 0.7, resources: 0.45, features: { cover: 0.1, elevation: false, chokepoint: true, waterSource: false, shelterQuality: 0.05 } },
            { name: 'Mussel Flats', terrain: 'wetland', danger: 0.45, resources: 0.35, features: { cover: 0.25, elevation: false, chokepoint: false, acoustics: 0.8 } },
            { name: 'The Wreck Line', terrain: 'ruins', danger: 0.55, resources: 0.5, features: { cover: 0.6, elevation: false, chokepoint: false, shelterQuality: 0.6, acoustics: 1.3 } },
            { name: 'Gull Rock', terrain: 'highland', danger: 0.65, resources: 0.15, features: { cover: 0.2, elevation: true, chokepoint: true, shelterQuality: 0.35, acoustics: 1.35, vertical: true } },
            { name: 'The Salt Marsh', terrain: 'wetland', danger: 0.5, resources: 0.3, features: { cover: 0.7, elevation: false, chokepoint: false, acoustics: 0.7 } },
            { name: 'The Deep Cut', terrain: 'water', danger: 0.8, resources: 0.4, features: { cover: 0.05, elevation: false, chokepoint: true, waterSource: false, shelterQuality: 0.05 } },
            { name: 'Boathouse Row', terrain: 'ruins', danger: 0.4, resources: 0.55, features: { cover: 0.65, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 1.25 } },
            { name: 'The Spit', terrain: 'open', danger: 0.5, resources: 0.2, features: { cover: 0.1, elevation: false, chokepoint: true, shelterQuality: 0.1 } },
            { name: 'Cockle Beds', terrain: 'wetland', danger: 0.35, resources: 0.4, features: { cover: 0.35, elevation: false, chokepoint: false, acoustics: 0.75 } },
            { name: 'The Drowned Village', terrain: 'ruins', danger: 0.7, resources: 0.45, features: { cover: 0.55, elevation: false, chokepoint: false, shelterQuality: 0.55, acoustics: 1.45, vertical: true } },
        ], [
            [0, 1], [0, 2], [0, 3], [0, 8], [1, 2], [1, 6], [2, 5], [2, 9],
            [3, 4], [3, 7], [4, 6], [4, 10], [5, 9], [6, 10], [7, 8], [7, 10],
        ]),
    },
    {
        id: 'thresher',
        effectVocab: { quaking: { label: 'the floor running again', severityMult: 1.25 } },
        name: 'The Thresher Floor',
        description: 'A working processing plant. The Cornucopia opens only for tributes who have already killed, and every fight on the floor is heard from every other part of it.',
        // §1: `bloodPrice` is the arena's whole argument, and `openMic` is what
        // makes paying it expensive — you cannot kill quietly in a building
        // with this much steel in it.
        laws: ['bloodPrice', 'openMic'],
        eventPack: 'thresher',
        cornucopiaLayout: 'walled',
        restockBias: ['machete', 'hardtack', 'bandages', 'wire'],
        mutts: ['Floor Hounds', 'Duct Swarm', 'The Shift Boss', 'Scale Rats'],
        events: ['Shift Change', 'The Tally', 'Line Restart'],
        zones: link([
            { name: 'The Cornucopia (Sorting Floor)', terrain: 'open', danger: 0.7, resources: 0.35, features: { cover: 0.2, elevation: false, chokepoint: true, shelterQuality: 0.4, acoustics: 1.5 } },
            { name: 'Intake Chutes', terrain: 'ruins', danger: 0.65, resources: 0.4, features: { cover: 0.5, elevation: false, chokepoint: true, shelterQuality: 0.5, acoustics: 1.4, vertical: true } },
            { name: 'The Coolant Race', terrain: 'water', danger: 0.6, resources: 0.35, features: { cover: 0.15, elevation: false, chokepoint: true, waterSource: true, shelterQuality: 0.2, acoustics: 1.35 } },
            { name: 'Gantry Deck', terrain: 'urban', danger: 0.75, resources: 0.25, features: { cover: 0.3, elevation: true, chokepoint: false, shelterQuality: 0.3, acoustics: 1.5, vertical: true } },
            { name: 'The Bone Hoppers', terrain: 'ruins', danger: 0.8, resources: 0.3, features: { cover: 0.55, elevation: false, chokepoint: true, shelterQuality: 0.45, acoustics: 1.45 } },
            { name: 'Underfloor Ducts', terrain: 'cave', danger: 0.5, resources: 0.2, features: { cover: 0.8, elevation: false, chokepoint: true, shelterQuality: 0.75, acoustics: 1.6 } },
            { name: 'The Packing Hall', terrain: 'urban', danger: 0.45, resources: 0.6, features: { cover: 0.45, elevation: false, chokepoint: false, shelterQuality: 0.65, acoustics: 1.4 } },
            { name: 'Scale House', terrain: 'urban', danger: 0.35, resources: 0.5, features: { cover: 0.4, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 1.2 } },
            { name: 'The Slag Yard', terrain: 'open', danger: 0.55, resources: 0.2, features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'Kiln Row', terrain: 'ruins', danger: 0.7, resources: 0.3, features: { cover: 0.5, elevation: false, chokepoint: false, shelterQuality: 0.55, acoustics: 1.35 } },
            { name: 'The Foreman\'s Gallery', terrain: 'urban', danger: 0.85, resources: 0.45, features: { cover: 0.35, elevation: true, chokepoint: true, shelterQuality: 0.7, acoustics: 1.55, vertical: true } },
        ], [
            [0, 1], [0, 3], [0, 4], [0, 8], [1, 2], [1, 5], [2, 5], [2, 6],
            [3, 6], [3, 7], [4, 8], [4, 9], [5, 9], [6, 10], [7, 8], [7, 9],
        ]),
    },
    {
        id: 'vigil',
        effectVocab: { fogbound: { label: 'the watch fires going out', durationMult: 1.25 } },
        name: 'The Vigil',
        description: 'A garrison ground where sleep does nothing at all. Anyone who spends the night at the Cornucopia is treated at first light, which is the only mercy in it.',
        // §1: `noRest` takes the night away as a resource; `dawnMercy` puts one
        // back, in the most dangerous sector on the map, at a fixed hour. The
        // arena is a standing question about whether the walk is worth it.
        laws: ['noRest', 'dawnMercy'],
        eventPack: 'vigil',
        cornucopiaLayout: 'plate',
        restockBias: ['morphling', 'lantern', 'bandages', 'hardtack'],
        mutts: ['Watch Hounds', 'Reveille Wasps', 'The Sentry', 'Fen Crawlers'],
        events: ['The Siren', 'The Lamps', 'Roll Call'],
        zones: link([
            { name: 'The Cornucopia (Parade Ground)', terrain: 'open', danger: 0.65, resources: 0.35, features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.15, acoustics: 1.3 } },
            { name: 'The Watchfires', terrain: 'open', danger: 0.5, resources: 0.25, features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.3 } },
            { name: 'Sentry Wood', terrain: 'forest', danger: 0.4, resources: 0.7, features: { cover: 0.8, elevation: false, chokepoint: false, acoustics: 0.7 } },
            { name: 'The Bell Tower', terrain: 'highland', danger: 0.8, resources: 0.15, features: { cover: 0.25, elevation: true, chokepoint: true, shelterQuality: 0.6, acoustics: 1.5, vertical: true } },
            { name: 'Barrack Rows', terrain: 'ruins', danger: 0.45, resources: 0.5, features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.85, acoustics: 1.25 } },
            { name: 'The Long Field', terrain: 'open', danger: 0.55, resources: 0.4, features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'Drainage Cut', terrain: 'wetland', danger: 0.6, resources: 0.35, features: { cover: 0.55, elevation: false, chokepoint: true, acoustics: 0.8 } },
            { name: 'The Picket Line', terrain: 'forest', danger: 0.5, resources: 0.6, features: { cover: 0.75, elevation: false, chokepoint: false, acoustics: 0.75 } },
            { name: 'Signal Hill', terrain: 'highland', danger: 0.7, resources: 0.2, features: { cover: 0.3, elevation: true, chokepoint: false, shelterQuality: 0.25, acoustics: 1.4, vertical: true } },
            { name: 'The Quiet Ward', terrain: 'ruins', danger: 0.35, resources: 0.55, features: { cover: 0.65, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 1.2 } },
            { name: 'The Reservoir Bank', terrain: 'wetland', danger: 0.45, resources: 0.45, features: { cover: 0.5, elevation: false, chokepoint: false, waterSource: true, acoustics: 0.75 } },
        ], [
            [0, 1], [0, 2], [0, 4], [0, 5], [1, 3], [1, 8], [2, 6], [2, 7],
            [3, 8], [3, 9], [4, 6], [4, 9], [5, 7], [5, 10], [6, 10], [7, 8],
        ]),
    },
    {
        id: 'saltworks',
        name: 'The Saltworks',
        description: 'Evaporation pans that do not recover once they have been walked. There is exactly one source of fresh water on the map and everybody finds out where.',
        // §1: `meltingGround` makes standing still expensive and moving
        // expensive for everybody afterwards; `noWaterExceptZone` means one
        // sector everybody has to come back to. The map eats itself from the
        // traffic outward, and the traffic has one destination.
        laws: ['meltingGround', 'noWaterExceptZone'],
        lawZone: 'The Brine Well',
        eventPack: 'saltworks',
        cornucopiaLayout: 'plate',
        restockBias: ['canteen', 'tablets', 'iodine', 'waterskin'],
        mutts: ['Pan Scuttlers', 'Brine Wraiths', 'Salt Hounds', 'Stack Shrikes'],
        events: ['The Crust', 'Subsidence', 'Harvest Bell'],
        effectVocab: { stripped: { label: 'the pans going to crust', severityMult: 1.2 } },
        zones: link([
            { name: 'The Cornucopia (Central Pan)', terrain: 'open', danger: 0.6, resources: 0.3, features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.1, acoustics: 1.2 } },
            { name: 'Evaporation Pan One', terrain: 'desert', danger: 0.5, resources: 0.2, features: { cover: 0.05, elevation: false, chokepoint: false, shelterQuality: 0.05 } },
            { name: 'Evaporation Pan Two', terrain: 'desert', danger: 0.55, resources: 0.2, features: { cover: 0.05, elevation: false, chokepoint: false, shelterQuality: 0.05 } },
            { name: 'The Brine Well', terrain: 'water', danger: 0.75, resources: 0.6, features: { cover: 0.2, elevation: false, chokepoint: true, waterSource: true, shelterQuality: 0.25, acoustics: 1.3 } },
            { name: 'Crust Ridge', terrain: 'highland', danger: 0.7, resources: 0.15, features: { cover: 0.15, elevation: true, chokepoint: true, shelterQuality: 0.2, acoustics: 1.35, vertical: true } },
            { name: 'The Pump House', terrain: 'ruins', danger: 0.4, resources: 0.5, features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.85, acoustics: 1.3 } },
            { name: 'Harvest Rows', terrain: 'desert', danger: 0.45, resources: 0.35, features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'The Barrow Track', terrain: 'open', danger: 0.5, resources: 0.25, features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'Settling Ponds', terrain: 'water', danger: 0.6, resources: 0.4, features: { cover: 0.25, elevation: false, chokepoint: false, waterSource: false, shelterQuality: 0.15 } },
            { name: 'The Stack Yard', terrain: 'ruins', danger: 0.65, resources: 0.45, features: { cover: 0.55, elevation: false, chokepoint: false, shelterQuality: 0.6, acoustics: 1.25, vertical: true } },
            { name: 'Broken Pan', terrain: 'desert', danger: 0.8, resources: 0.1, features: { cover: 0.1, elevation: false, chokepoint: true, shelterQuality: 0.05 } },
        ], [
            [0, 1], [0, 2], [0, 5], [0, 7], [1, 4], [1, 6], [2, 3], [2, 10],
            [3, 8], [4, 7], [4, 9], [5, 8], [5, 9], [6, 7], [6, 10],
        ]),
    },
    {
        id: 'kiln',
        name: 'The Kiln',
        description: 'A pottery works under two suns, with no shade anywhere above ground. One cellar under it stays cool, stays wet and stays worth killing for.',
        // §1: `twinSuns` means cover hides you from people and from nothing
        // else; `bountifulGround` puts the only relief in the arena in a cave
        // with one way in. Everybody knows where it is. That is the arena.
        laws: ['twinSuns', 'bountifulGround'],
        lawZone: 'The Slip Cellar',
        eventPack: 'kiln',
        cornucopiaLayout: 'walled',
        restockBias: ['canteen', 'waterskin', 'tablets', 'bandages'],
        mutts: ['Kiln Beetles', 'Flue Stalkers', 'Shard Hounds', 'Chimney Swifts'],
        events: ['The Firing', 'The Glaze', 'Draw Day'],
        effectVocab: { burning: { label: 'the kilns being drawn', severityMult: 1.2 } },
        zones: link([
            { name: 'The Cornucopia (Firing Floor)', terrain: 'open', danger: 0.7, resources: 0.35, features: { cover: 0.15, elevation: false, chokepoint: true, shelterQuality: 0.2, acoustics: 1.35 } },
            { name: 'The Bisque Yard', terrain: 'desert', danger: 0.5, resources: 0.25, features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'Chimney Ridge', terrain: 'highland', danger: 0.75, resources: 0.15, features: { cover: 0.2, elevation: true, chokepoint: true, shelterQuality: 0.15, acoustics: 1.4, vertical: true } },
            { name: 'The Slip Cellar', terrain: 'cave', danger: 0.55, resources: 0.75, features: { cover: 0.75, elevation: false, chokepoint: true, waterSource: true, shelterQuality: 0.9, acoustics: 1.5 } },
            { name: 'Glaze Pits', terrain: 'desert', danger: 0.65, resources: 0.3, features: { cover: 0.25, elevation: false, chokepoint: false, shelterQuality: 0.1 } },
            { name: 'The Drying Sheds', terrain: 'ruins', danger: 0.4, resources: 0.5, features: { cover: 0.6, elevation: false, chokepoint: false, shelterQuality: 0.55, acoustics: 1.2 } },
            { name: 'Clay Banks', terrain: 'open', danger: 0.45, resources: 0.55, features: { cover: 0.3, elevation: false, chokepoint: false, shelterQuality: 0.15 } },
            { name: 'The Flue Tunnels', terrain: 'cave', danger: 0.8, resources: 0.2, features: { cover: 0.8, elevation: false, chokepoint: true, shelterQuality: 0.7, acoustics: 1.6 } },
            { name: 'Kilnhead', terrain: 'highland', danger: 0.85, resources: 0.2, features: { cover: 0.15, elevation: true, chokepoint: false, shelterQuality: 0.1, acoustics: 1.45, vertical: true } },
            { name: 'The Shard Field', terrain: 'desert', danger: 0.6, resources: 0.15, features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.05 } },
            { name: 'The Cooling Racks', terrain: 'ruins', danger: 0.35, resources: 0.45, features: { cover: 0.55, elevation: false, chokepoint: false, shelterQuality: 0.6, acoustics: 1.25 } },
        ], [
            [0, 1], [0, 5], [0, 6], [0, 9], [1, 2], [1, 4], [2, 8], [3, 6],
            [3, 7], [4, 7], [4, 9], [5, 10], [6, 10], [7, 8], [8, 9],
        ]),
    },
];
