import { Arena, EdgeRule, Terrain, Zone, ZoneFeatures } from '../models/types';

/**
 * Five authored arenas, each built around a standing mechanic that lives in
 * `engine/arenaRules.ts` rather than in the arena itself — so the thing that
 * makes the map distinct is a rule any other map can reuse:
 *
 *   - The Hippodrome: the soundscape (`acousticsFloor`/`acousticsFlux`), a
 *     disorienting hall, and the arena-wide lit/blackout sightline.
 *   - The Undercroft: one-way tunnels (`oneWay` edge rules) and zone eviction.
 *   - The Long Vintage: slow regrowth on open ground (`regrowthByTerrain`).
 *   - Cinder Peak: the clear/whiteout sightline and the fire beacon.
 *   - The Open Cut: permanent collapse and latent edges (the remap).
 *
 * Kept in their own module, like `arenasNew.ts`, and spread into `ARENAS`.
 */

type ZoneSpec = { name: string; terrain: Terrain; danger: number; resources: number; features?: ZoneFeatures };

/** Builds a symmetric adjacency list from an undirected edge list. */
function link(zones: ZoneSpec[], edges: Array<[number, number]>): Zone[] {
    const adjacency: string[][] = zones.map(() => []);
    edges.forEach(([a, b]) => {
        if (!adjacency[a].includes(zones[b].name)) adjacency[a].push(zones[b].name);
        if (!adjacency[b].includes(zones[a].name)) adjacency[b].push(zones[a].name);
    });
    return zones.map((z, i) => ({ ...z, adjacent: adjacency[i] }));
}

/** `edgeKey` order, computed rather than typed so a key can never be mis-sorted. */
function rule(a: string, b: string, r: EdgeRule): [string, EdgeRule] {
    return [[a, b].sort().join('|'), r];
}

const CORN_HIPPO = 'The Cornucopia (Midway)';
const CORN_UNDER = 'The Cornucopia (Central Platform)';
const CORN_VINT = 'The Cornucopia (Crush Pad)';
const CORN_CINDER = 'The Cornucopia (Observation Deck)';
const CORN_CUT = 'The Cornucopia (Pit Floor)';

export const HIPPODROME_SET_ARENAS: Arena[] = [
    {
        id: 'hippodrome',
        name: 'The Hippodrome',
        description: 'An amusement park shut for thirty years and switched back on for the Games. The music never stops, the animatronics never sleep, and somewhere in the park is the switch for the lights.',
        // `openMic` is the law; the soundscape rule is its engine. Nowhere in
        // the park is quiet, and which rides are hiding your footsteps and
        // which are announcing them changes every cycle.
        laws: ['openMic'],
        eventPack: 'hippodrome',
        cornucopiaLayout: 'plate',
        restockBias: ['glow-stick', 'lantern', 'knife', 'crackers'],
        mutts: ['Animatronic Barkers', 'Carousel Chargers', 'Mirror Mimics', 'Coaster Rats'],
        events: ['Lights Up', 'Lights Fail', 'The Calliope'],
        effectVocab: { fogbound: { label: 'the smoke machines running', durationMult: 1.2 } },
        rules: {
            acousticsFloor: 1.1,
            acousticsFlux: 0.35,
            disorientZones: ['Hall of Mirrors'],
        },
        zones: link([
            { name: CORN_HIPPO, terrain: 'open', danger: 0.65, resources: 0.35, features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.15, acoustics: 1.4 } },
            { name: 'The Ferris Wheel', terrain: 'urban', danger: 0.75, resources: 0.2, features: { cover: 0.2, elevation: true, chokepoint: true, shelterQuality: 0.3, acoustics: 1.8, vertical: true } },
            { name: 'Hall of Mirrors', terrain: 'urban', danger: 0.55, resources: 0.3, features: { cover: 0.95, elevation: false, chokepoint: true, shelterQuality: 0.6, acoustics: 1.3 } },
            { name: 'The Carousel Pit', terrain: 'ruins', danger: 0.6, resources: 0.35, features: { cover: 0.45, elevation: false, chokepoint: false, shelterQuality: 0.4, acoustics: 1.5, vertical: true } },
            { name: 'Funhouse Cellar', terrain: 'cave', danger: 0.45, resources: 0.4, features: { cover: 0.8, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 1.25 } },
            { name: 'The Coaster Spine', terrain: 'highland', danger: 0.8, resources: 0.15, features: { cover: 0.1, elevation: true, chokepoint: true, shelterQuality: 0.1, acoustics: 1.35, vertical: true } },
            { name: 'Ticket Row', terrain: 'urban', danger: 0.45, resources: 0.5, features: { cover: 0.5, elevation: false, chokepoint: false, shelterQuality: 0.6, acoustics: 1.2 } },
            { name: 'The Petting Barn', terrain: 'open', danger: 0.3, resources: 0.45, features: { cover: 0.3, elevation: false, chokepoint: false, shelterQuality: 0.5, acoustics: 0.8 } },
            { name: 'Backstage Storage', terrain: 'ruins', danger: 0.4, resources: 0.75, features: { cover: 0.7, elevation: false, chokepoint: true, shelterQuality: 0.75, acoustics: 1.0 } },
            { name: 'The Midway Games', terrain: 'open', danger: 0.55, resources: 0.3, features: { cover: 0.2, elevation: false, chokepoint: true, shelterQuality: 0.15, acoustics: 1.45 } },
        ], [
            [0, 1], [0, 3], [0, 6], [0, 9], [1, 2], [1, 5], [2, 3], [2, 8],
            [3, 4], [4, 8], [5, 9], [6, 7], [7, 9], [6, 8],
        ]),
        edgeRules: Object.fromEntries([
            rule('Backstage Storage', 'Hall of Mirrors', { kind: 'contested' }),
            rule('Backstage Storage', 'Funhouse Cellar', { kind: 'hidden' }),
            rule('The Coaster Spine', 'The Ferris Wheel', { kind: 'tolled', toll: { fatigue: 6, woundChance: 0.1 } }),
        ]),
    },
    {
        id: 'undercroft',
        name: 'The Undercroft',
        description: 'A derelict subway under a city nobody lives in. The tunnels run one way, the retreat is never the way you came, and a train that has not carried a passenger in fifty years still keeps to its timetable.',
        // `noSponsors`: nothing on a parachute reaches forty metres down. The
        // one-way tunnels are the arena's argument — every run through the
        // loop is a commitment, and the way back is round the long way.
        laws: ['noSponsors'],
        eventPack: 'undercroft',
        cornucopiaLayout: 'walled',
        restockBias: ['lantern', 'glow-stick', 'rope', 'bandages'],
        mutts: ['Tunnel Rats', 'Platform Hounds', 'Sump Leeches', 'The Conductor', 'Yard Crows'],
        events: ['Train Due', 'The Rails Sing', 'Pump Failure'],
        effectVocab: { flooded: { label: 'the sumps backing up', severityMult: 1.2 } },
        zones: link([
            { name: CORN_UNDER, terrain: 'urban', danger: 0.65, resources: 0.35, features: { cover: 0.25, elevation: false, chokepoint: true, shelterQuality: 0.4, acoustics: 1.5 } },
            { name: 'Track Tunnel North', terrain: 'cave', danger: 0.7, resources: 0.2, features: { cover: 0.7, elevation: false, chokepoint: true, shelterQuality: 0.4, acoustics: 1.6 } },
            { name: 'Track Tunnel South', terrain: 'cave', danger: 0.75, resources: 0.2, features: { cover: 0.8, elevation: false, chokepoint: true, shelterQuality: 0.35, acoustics: 1.6 } },
            { name: 'The Turnstiles', terrain: 'urban', danger: 0.5, resources: 0.3, features: { cover: 0.35, elevation: false, chokepoint: true, shelterQuality: 0.3, acoustics: 1.3 } },
            { name: 'Signal Room', terrain: 'urban', danger: 0.5, resources: 0.45, features: { cover: 0.5, elevation: true, chokepoint: true, shelterQuality: 0.75, acoustics: 1.2, vertical: true } },
            { name: 'Flooded Section', terrain: 'water', danger: 0.8, resources: 0.35, features: { cover: 0.3, elevation: false, chokepoint: false, waterSource: true, shelterQuality: 0.1, acoustics: 0.8 } },
            { name: 'Maintenance Ladders', terrain: 'ruins', danger: 0.6, resources: 0.2, features: { cover: 0.4, elevation: true, chokepoint: true, shelterQuality: 0.3, acoustics: 1.4, vertical: true } },
            { name: 'The Depot Yard', terrain: 'open', danger: 0.5, resources: 0.7, features: { cover: 0.2, elevation: false, chokepoint: false, shelterQuality: 0.2, acoustics: 1.0 } },
            { name: 'Emergency Stairwell', terrain: 'urban', danger: 0.45, resources: 0.25, features: { cover: 0.5, elevation: false, chokepoint: true, shelterQuality: 0.5, acoustics: 1.45, vertical: true } },
            { name: 'The Third Rail', terrain: 'urban', danger: 0.95, resources: 0.25, features: { cover: 0.2, elevation: false, chokepoint: true, shelterQuality: 0.05, acoustics: 1.3 } },
            { name: 'Collapsed Platform', terrain: 'ruins', danger: 0.4, resources: 0.45, features: { cover: 0.7, elevation: false, chokepoint: false, shelterQuality: 0.85, acoustics: 1.1 } },
        ], [
            [0, 1], [0, 2], [0, 3], [0, 10], [1, 4], [1, 9], [2, 5], [2, 9],
            [3, 7], [3, 8], [4, 6], [6, 8], [5, 10], [7, 9],
        ]),
        // One-way ground: the main line is a loop that only runs one way —
        // platform, north tunnel, the rail, south tunnel, platform. A tribute
        // who goes in north comes out south, and nobody walks back.
        edgeRules: Object.fromEntries([
            rule(CORN_UNDER, 'Track Tunnel North', { kind: 'oneWay', from: CORN_UNDER, to: 'Track Tunnel North' }),
            rule('Track Tunnel North', 'The Third Rail', { kind: 'oneWay', from: 'Track Tunnel North', to: 'The Third Rail' }),
            rule('The Third Rail', 'Track Tunnel South', { kind: 'oneWay', from: 'The Third Rail', to: 'Track Tunnel South' }),
            rule(CORN_UNDER, 'Track Tunnel South', { kind: 'oneWay', from: 'Track Tunnel South', to: CORN_UNDER }),
            rule('Emergency Stairwell', 'The Turnstiles', { kind: 'contested' }),
            rule('Maintenance Ladders', 'Signal Room', { kind: 'tolled', toll: { fatigue: 5 } }),
        ]),
    },
    {
        id: 'vintage',
        name: 'The Long Vintage',
        description: 'A terraced vineyard in its last autumn. The rows are bare, the frost comes down the slope every night the bell warns of it, and nothing on the open terraces grows back in time to matter.',
        // `deadlyNight` is the frost as law; the regrowth rule is the vineyard
        // being exactly what it is — a crop that took a year and is gone in a
        // week. The cellar is the only place the night cannot reach.
        laws: ['deadlyNight'],
        eventPack: 'vintage',
        cornucopiaLayout: 'plate',
        restockBias: ['thermal-cloak', 'sleeping-bag', 'bread', 'cheese'],
        mutts: ['Harvest Hounds', 'Vine Stranglers', 'Cellar Moths', 'Belfry Bats', 'Channel Pike'],
        events: ['Harvest Bell', 'Frost Warning', 'The Crush'],
        effectVocab: { frozen: { label: 'the frost on the rows', severityMult: 1.2 } },
        rules: {
            regrowthByTerrain: { open: 0.35, highland: 0.5 },
        },
        zones: link([
            { name: CORN_VINT, terrain: 'open', danger: 0.6, resources: 0.35, features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.15, acoustics: 1.2 } },
            { name: 'Terrace Row One', terrain: 'open', danger: 0.45, resources: 0.55, features: { cover: 0.15, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 0.9 } },
            { name: 'Terrace Row Two', terrain: 'open', danger: 0.5, resources: 0.5, features: { cover: 0.15, elevation: true, chokepoint: false, shelterQuality: 0.05, acoustics: 0.9 } },
            { name: 'Terrace Row Three', terrain: 'open', danger: 0.55, resources: 0.45, features: { cover: 0.1, elevation: true, chokepoint: false, shelterQuality: 0.05, acoustics: 0.95 } },
            { name: 'The Wine Cellar', terrain: 'cave', danger: 0.5, resources: 0.5, features: { cover: 0.8, elevation: false, chokepoint: true, waterSource: true, shelterQuality: 0.95, acoustics: 1.45 } },
            { name: 'The Press House', terrain: 'ruins', danger: 0.45, resources: 0.6, features: { cover: 0.55, elevation: false, chokepoint: false, shelterQuality: 0.65, acoustics: 1.3 } },
            { name: 'Bell Tower', terrain: 'highland', danger: 0.75, resources: 0.1, features: { cover: 0.2, elevation: true, chokepoint: true, shelterQuality: 0.4, acoustics: 1.7, vertical: true } },
            { name: 'The Drying Barn', terrain: 'ruins', danger: 0.35, resources: 0.45, features: { cover: 0.6, elevation: false, chokepoint: false, shelterQuality: 0.7, acoustics: 1.15 } },
            { name: 'Irrigation Channel', terrain: 'water', danger: 0.55, resources: 0.35, features: { cover: 0.3, elevation: false, chokepoint: true, waterSource: true, shelterQuality: 0.1, acoustics: 0.8 } },
            { name: 'The Old Chapel Ruins', terrain: 'ruins', danger: 0.5, resources: 0.3, features: { cover: 0.6, elevation: false, chokepoint: false, shelterQuality: 0.6, acoustics: 1.4, vertical: true } },
            { name: 'Barrel Vault', terrain: 'cave', danger: 0.4, resources: 0.8, features: { cover: 0.75, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 1.35 } },
        ], [
            [0, 1], [0, 5], [0, 7], [0, 8], [1, 2], [1, 8], [2, 3], [2, 9],
            [3, 6], [6, 9], [4, 5], [4, 10], [5, 10], [7, 9],
        ]),
        edgeRules: Object.fromEntries([
            rule('Barrel Vault', 'The Wine Cellar', { kind: 'contested' }),
            rule('Bell Tower', 'Terrace Row Three', { kind: 'tolled', toll: { fatigue: 5 } }),
        ]),
    },
    {
        id: 'cinderpeak',
        name: 'Cinder Peak',
        description: 'A mountaintop observatory above the cloud. On a clear day every tribute can see every other from a kilometre away; in a whiteout nobody can see their own hands. It is never anything in between for long.',
        // `shrinkingArena`: the mountain gives the field less of itself every
        // day. The sightline swing is the arena's argument, and the fire
        // beacon is the price of warmth above the treeline.
        laws: ['shrinkingArena'],
        eventPack: 'cinderpeak',
        cornucopiaLayout: 'walled',
        restockBias: ['thermal-cloak', 'matches', 'sleeping-bag', 'rope'],
        mutts: ['Rime Wolves', 'Dome Wraiths', 'Cryo Leeches', 'Scree Ravens'],
        events: ['Clear Sky', 'Whiteout', 'The Dome Opens'],
        effectVocab: { frozen: { label: 'the rime coming down', severityMult: 1.2 } },
        rules: {
            fireBeacon: { maxCover: 0.25, zones: ['The Ridge Line', 'Telescope Array'] },
        },
        zones: link([
            { name: CORN_CINDER, terrain: 'open', danger: 0.65, resources: 0.35, features: { cover: 0.15, elevation: true, chokepoint: false, shelterQuality: 0.2, acoustics: 1.3 } },
            { name: 'The Great Dome', terrain: 'urban', danger: 0.6, resources: 0.4, features: { cover: 0.4, elevation: true, chokepoint: true, shelterQuality: 0.7, acoustics: 1.85, vertical: true } },
            { name: 'Cable Car Station', terrain: 'urban', danger: 0.55, resources: 0.3, features: { cover: 0.4, elevation: false, chokepoint: true, shelterQuality: 0.5, acoustics: 1.3, vertical: true } },
            { name: 'Telescope Array', terrain: 'open', danger: 0.8, resources: 0.3, features: { cover: 0.05, elevation: true, chokepoint: false, shelterQuality: 0.05, acoustics: 1.1 } },
            { name: 'The Cryo-Lab', terrain: 'cave', danger: 0.5, resources: 0.45, features: { cover: 0.75, elevation: false, chokepoint: true, shelterQuality: 0.9, acoustics: 1.3 } },
            { name: 'Switchback Trail', terrain: 'highland', danger: 0.7, resources: 0.15, features: { cover: 0.2, elevation: true, chokepoint: true, shelterQuality: 0.15, acoustics: 1.2, vertical: true } },
            { name: 'Weather Station', terrain: 'urban', danger: 0.45, resources: 0.45, features: { cover: 0.5, elevation: true, chokepoint: false, shelterQuality: 0.7, acoustics: 1.15 } },
            { name: 'Supply Cache Bunker', terrain: 'ruins', danger: 0.45, resources: 0.75, features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.8, acoustics: 1.25 } },
            { name: 'The Ridge Line', terrain: 'highland', danger: 0.75, resources: 0.1, features: { cover: 0.0, elevation: true, chokepoint: false, shelterQuality: 0.0, acoustics: 1.1 } },
            { name: 'Frozen Reservoir', terrain: 'ice', danger: 0.6, resources: 0.35, features: { cover: 0.1, elevation: false, chokepoint: false, waterSource: true, shelterQuality: 0.05, acoustics: 1.35 } },
        ], [
            [0, 1], [0, 2], [0, 3], [0, 6], [1, 3], [1, 4], [2, 5], [2, 7],
            [4, 7], [5, 8], [6, 8], [6, 9], [7, 9], [3, 8],
        ]),
        edgeRules: Object.fromEntries([
            rule('Cable Car Station', 'Supply Cache Bunker', { kind: 'contested' }),
            rule('Switchback Trail', 'The Ridge Line', { kind: 'tolled', toll: { fatigue: 6, woundChance: 0.15 } }),
            rule(CORN_CINDER, 'Cable Car Station', { kind: 'timeGated', gatedTime: 'day' }),
        ]),
    },
    {
        id: 'opencut',
        name: 'The Open Cut',
        description: 'An open-pit mine stepped down into the earth in terraces. The terraces are coming apart one at a time, the way down is never the same way twice, and once a level goes it does not come back.',
        // `cornucopiaRefills`: the pit floor keeps being restocked, because
        // the Gamemakers want the field coming down the terraces towards it.
        // The ground giving is the argument: every fall redraws which levels
        // reach which, and the map only ever gets smaller and stranger.
        laws: ['cornucopiaRefills'],
        eventPack: 'opencut',
        cornucopiaLayout: 'plate',
        restockBias: ['rope', 'helmet', 'bandages', 'hardtack'],
        mutts: ['Pit Jackals', 'Slurry Eels', 'Gantry Rats', 'The Shot-Firer', 'Scree Vultures'],
        events: ['Ground Give', 'The Blast Horn', 'Slurry Surge'],
        effectVocab: { quaking: { label: 'the benches letting go', severityMult: 1.25 } },
        rules: {
            // The rubble ramps a fall leaves behind: shut until a terrace goes.
            latentEdges: [
                ['Terrace Level One', 'Terrace Level Three'],
                [CORN_CUT, 'Terrace Level Two'],
                ['Spoil Heap', 'Flooded Pit Bottom'],
            ],
        },
        zones: link([
            { name: CORN_CUT, terrain: 'open', danger: 0.65, resources: 0.35, features: { cover: 0.1, elevation: false, chokepoint: false, shelterQuality: 0.1, acoustics: 1.4 } },
            { name: 'Terrace Level One', terrain: 'highland', danger: 0.5, resources: 0.35, features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.2, acoustics: 1.3, vertical: true } },
            { name: 'Terrace Level Two', terrain: 'highland', danger: 0.6, resources: 0.3, features: { cover: 0.2, elevation: true, chokepoint: false, shelterQuality: 0.2, acoustics: 1.3, vertical: true } },
            { name: 'Terrace Level Three', terrain: 'highland', danger: 0.7, resources: 0.25, features: { cover: 0.15, elevation: true, chokepoint: true, shelterQuality: 0.15, acoustics: 1.35, vertical: true } },
            { name: 'The Crusher House', terrain: 'ruins', danger: 0.6, resources: 0.45, features: { cover: 0.55, elevation: false, chokepoint: true, shelterQuality: 0.6, acoustics: 1.5 } },
            { name: 'Haul Road', terrain: 'open', danger: 0.55, resources: 0.2, features: { cover: 0.05, elevation: false, chokepoint: false, shelterQuality: 0.05, acoustics: 1.0 } },
            { name: 'Blast Shelter', terrain: 'cave', danger: 0.35, resources: 0.35, features: { cover: 0.8, elevation: false, chokepoint: true, shelterQuality: 0.95, acoustics: 1.3 } },
            { name: 'Flooded Pit Bottom', terrain: 'water', danger: 0.8, resources: 0.3, features: { cover: 0.2, elevation: false, chokepoint: false, waterSource: true, shelterQuality: 0.05, acoustics: 0.8 } },
            { name: 'Conveyor Gantry', terrain: 'urban', danger: 0.7, resources: 0.25, features: { cover: 0.3, elevation: true, chokepoint: true, shelterQuality: 0.25, acoustics: 1.55, vertical: true } },
            { name: 'Explosives Locker', terrain: 'ruins', danger: 0.8, resources: 0.85, features: { cover: 0.6, elevation: false, chokepoint: true, shelterQuality: 0.5, acoustics: 1.2 } },
            { name: 'Spoil Heap', terrain: 'open', danger: 0.6, resources: 0.25, features: { cover: 0.25, elevation: true, chokepoint: false, shelterQuality: 0.1, acoustics: 0.9 } },
        ], [
            [0, 1], [0, 7], [0, 4], [0, 5], [1, 2], [1, 6], [2, 3], [2, 8],
            [3, 9], [3, 10], [4, 8], [5, 10], [5, 6], [8, 9],
            // latent (shut until the ground gives)
            [1, 3], [0, 2], [10, 7],
        ]),
        edgeRules: Object.fromEntries([
            rule('Conveyor Gantry', 'The Crusher House', { kind: 'contested' }),
            rule('Explosives Locker', 'Terrace Level Three', { kind: 'tolled', toll: { fatigue: 4, woundChance: 0.2 } }),
            rule('Blast Shelter', 'Haul Road', { kind: 'hidden' }),
        ]),
    },
];
