import type { Mutt } from '../models/types';

/**
 * The registry entries for the five arenas in `arenasSetHippodrome.ts` — mutt
 * rosters, signature blurbs, reveals and climate labels — kept together and
 * folded into each shared table with a one-line `Object.assign`, so adding the
 * set touches every registry by one line rather than by a block.
 *
 * Data only: imports nothing but types, so every registry can pull it in
 * without dragging the engine into the cold-start path.
 */

export const HIPPODROME_SET_MUTTS: Record<string, Mutt[]> = {
    // Every terrain an arena contains is covered by at least one mutt.
    hippodrome: [
        {
            // The barkers on the booths: they talk to you, and then they
            // step down off the booth.
            id: 'animatronic-barkers', name: 'Animatronic Barkers',
            packSize: [2, 4], damage: 16, speed: 6,
            inflicts: { bleeding: true, arms: true },
            terrainPreference: ['open', 'urban'],
            role: 'herder',
            fearAura: 8,
        },
        {
            id: 'carousel-chargers', name: 'Carousel Chargers',
            packSize: [2, 5], damage: 20, speed: 9,
            inflicts: { bleeding: true, legs: true },
            terrainPreference: ['ruins', 'open'],
            persistent: true,
            fearAura: 6,
        },
        {
            // The hall of mirrors has something in it that is only ever a
            // reflection until it is not.
            id: 'mirror-mimics', name: 'Mirror Mimics',
            packSize: [1, 2], damage: 22, speed: 8,
            inflicts: { bleeding: true },
            terrainPreference: ['urban', 'cave'],
            role: 'mimic',
            nocturnal: true,
            fearAura: 12,
        },
        {
            id: 'coaster-rats', name: 'Coaster Rats',
            packSize: [6, 14], damage: 5, speed: 7,
            inflicts: { bleeding: true },
            terrainPreference: ['highland', 'cave', 'ruins'],
            role: 'swarm',
            fearAura: 3,
        },
    ],
    undercroft: [
        {
            id: 'tunnel-rats', name: 'Tunnel Rats',
            packSize: [8, 16], damage: 5, speed: 7,
            inflicts: { bleeding: true, infected: true },
            terrainPreference: ['cave', 'ruins', 'urban'],
            role: 'swarm',
            fearAura: 4,
        },
        {
            id: 'platform-hounds', name: 'Platform Hounds',
            packSize: [2, 4], damage: 18, speed: 9,
            inflicts: { bleeding: true, legs: true },
            terrainPreference: ['urban', 'open'],
            persistent: true,
            fearAura: 7,
        },
        {
            id: 'sump-leeches', name: 'Sump Leeches',
            packSize: [4, 9], damage: 7, speed: 4,
            inflicts: { bleeding: true, infected: true },
            terrainPreference: ['water'],
            role: 'parasite',
            fearAura: 5,
        },
        {
            // Walks the line in a uniform, checking tickets. Nobody has one.
            id: 'the-conductor', name: 'The Conductor',
            packSize: [1, 1], damage: 26, speed: 7,
            inflicts: { bleeding: true, head: true },
            terrainPreference: ['cave', 'urban'],
            role: 'ambusher',
            nocturnal: true,
            fearAura: 14,
        },
        {
            id: 'yard-crows', name: 'Yard Crows',
            packSize: [5, 10], damage: 6, speed: 10,
            inflicts: { head: true },
            terrainPreference: ['open', 'ruins'],
            role: 'scavenger',
            fearAura: 3,
        },
    ],
    vintage: [
        {
            id: 'harvest-hounds', name: 'Harvest Hounds',
            packSize: [3, 6], damage: 15, speed: 9,
            inflicts: { bleeding: true, legs: true },
            terrainPreference: ['open', 'highland'],
            role: 'herder',
            fearAura: 6,
        },
        {
            // The dead vines on the terraces, which are not all dead.
            id: 'vine-stranglers', name: 'Vine Stranglers',
            packSize: [2, 5], damage: 12, speed: 3,
            inflicts: { legs: true },
            terrainPreference: ['open', 'ruins'],
            role: 'ambusher',
            nocturnal: true,
            fearAura: 7,
        },
        {
            id: 'cellar-moths', name: 'Cellar Moths',
            packSize: [10, 20], damage: 3, speed: 6,
            inflicts: { poisoned: true },
            terrainPreference: ['cave', 'ruins'],
            role: 'swarm',
            fearAura: 4,
        },
        {
            id: 'belfry-bats', name: 'Belfry Bats',
            packSize: [6, 12], damage: 5, speed: 10,
            inflicts: { infected: true },
            terrainPreference: ['highland', 'cave'],
            role: 'swarm',
            nocturnal: true,
            fearAura: 5,
        },
        {
            id: 'channel-pike', name: 'Channel Pike',
            packSize: [1, 3], damage: 17, speed: 8,
            inflicts: { bleeding: true },
            terrainPreference: ['water'],
            fearAura: 6,
        },
    ],
    cinderpeak: [
        {
            id: 'rime-wolves', name: 'Rime Wolves',
            packSize: [3, 6], damage: 18, speed: 9,
            inflicts: { bleeding: true, frostbitten: true },
            terrainPreference: ['highland', 'ice', 'open'],
            persistent: true,
            role: 'herder',
            fearAura: 8,
        },
        {
            // The dome's acoustics make it sound like there are a dozen.
            id: 'dome-wraiths', name: 'Dome Wraiths',
            packSize: [1, 2], damage: 20, speed: 7,
            inflicts: { bleeding: true },
            terrainPreference: ['urban', 'ruins'],
            role: 'mimic',
            nocturnal: true,
            fearAura: 12,
        },
        {
            id: 'cryo-leeches', name: 'Cryo Leeches',
            packSize: [4, 8], damage: 6, speed: 4,
            inflicts: { frostbitten: true },
            terrainPreference: ['cave', 'ice'],
            role: 'parasite',
            fearAura: 5,
        },
        {
            id: 'scree-ravens', name: 'Scree Ravens',
            packSize: [5, 10], damage: 6, speed: 10,
            inflicts: { head: true },
            terrainPreference: ['highland', 'open', 'urban'],
            role: 'scavenger',
            fearAura: 3,
        },
    ],
    opencut: [
        {
            id: 'pit-jackals', name: 'Pit Jackals',
            packSize: [3, 6], damage: 14, speed: 9,
            inflicts: { bleeding: true, legs: true },
            terrainPreference: ['open', 'highland'],
            role: 'herder',
            fearAura: 6,
        },
        {
            id: 'slurry-eels', name: 'Slurry Eels',
            packSize: [2, 4], damage: 17, speed: 8,
            inflicts: { bleeding: true },
            terrainPreference: ['water'],
            fearAura: 6,
        },
        {
            id: 'gantry-rats', name: 'Gantry Rats',
            packSize: [8, 16], damage: 4, speed: 7,
            inflicts: { infected: true },
            terrainPreference: ['urban', 'ruins', 'cave'],
            role: 'swarm',
            fearAura: 3,
        },
        {
            // Something that knows where every charge in the locker is.
            id: 'the-shot-firer', name: 'The Shot-Firer',
            packSize: [1, 1], damage: 28, speed: 6,
            inflicts: { burned: true, bleeding: true },
            terrainPreference: ['ruins', 'cave', 'urban'],
            role: 'ambusher',
            persistent: true,
            fearAura: 13,
        },
        {
            id: 'scree-vultures', name: 'Scree Vultures',
            packSize: [3, 7], damage: 7, speed: 9,
            inflicts: { head: true },
            terrainPreference: ['highland', 'open'],
            role: 'scavenger',
            fearAura: 4,
        },
    ],
};

export const HIPPODROME_SET_BLURBS: Record<string, string> = {
    hippodrome: 'Lights up, lights fail: at an hour nobody announces the park\'s power comes on and every zone is lit and loud; two cycles later it fails into a blackout the animatronics like better.',
    undercroft: 'Train due: every third cycle the ghost train runs the main line, telegraphed by the rails a cycle ahead. Anyone on the tracks is hit and thrown clear to the nearest platform.',
    vintage: 'Harvest bell, frost warning: by day the bell names the terraces the frost will take tonight; by night anyone on them without walls around them pays for it.',
    cinderpeak: 'Clear sky, whiteout: the summit swings between sightlines where every bow is king and a storm where nobody sees past arm\'s length and every crossing takes twice as long.',
    opencut: 'Ground give: every few days a terrace comes apart. It is gone for the rest of the Games, and the rubble it leaves reconnects the levels around it in a new shape.',
};

export const HIPPODROME_SET_REVEALS: Record<string, string> = {
    hippodrome: 'Music first. The plates rise on a midway under a dead sky, and a calliope somewhere is playing a waltz at the wrong speed. There is a Ferris wheel against the clouds, a roller coaster whose spine runs the length of the park, a carousel sunk in a pit, and a hall of mirrors with its doors open. Every booth on the midway has a barker in it. None of them are people. The music does not stop when the gong goes, and it will not stop after.',
    undercroft: 'Tile and echo. The plates rise on a subway platform lit by one working strip light, and the tunnels open on either side into perfect dark. There is a timetable on the wall. It has been updated. Somewhere far down the north tunnel, the rails are humming.',
    vintage: 'A hillside of bare vines under a pale autumn sky, stepped down in terraces to a crush pad where the plates rise among empty picking crates. There is a bell tower above the top row and a cellar door in the hill below it. The air is still and very clear. It is the kind of clear that means frost.',
    cinderpeak: 'Above the cloud. The plates come up on an observation deck at the top of a mountain with the whole world laid out below in white, and the sky is so clear that every tribute can see every other tribute\'s face. There is a great dome behind them, a telescope array along the ridge, and on the horizon, low and grey and moving, weather.',
    opencut: 'A hole in the world. The plates rise on the floor of an open-pit mine, and the pit walls go up in terraces on every side, each one a bench of broken rock with a haul road cut into it. There is a conveyor gantry across the sky, a crusher house on the far bench, a flooded sump at the bottom, and a locker with a hazard sign on the door. Somewhere up on the third terrace a stone comes loose, and the whole field watches it fall.',
};

export const HIPPODROME_SET_CLIMATE_LABELS: Record<string, string> = {
    hippodrome: 'Perpetual dusk, under a sky that never quite gets dark. The park lights are the only weather.',
    undercroft: 'Cold, damp, and underground. The water in the tunnels is not fit to drink without treating.',
    vintage: 'Clear, still autumn. Warm by day; the frost comes down the slope every night.',
    cinderpeak: 'Freezing, and above the cloud. The cold is the whole climate and the sky decides how far anybody can see.',
    opencut: 'Pit damp. Cold, wet rock and standing water nobody should drink untreated.',
};
