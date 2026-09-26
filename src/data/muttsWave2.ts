import type { Mutt } from '../models/types';

/**
 * AUDIT-12 §8.7: the mutt roster floor is four.
 *
 * Six hand-authored arenas and eight procedural biomes carried three, which in
 * a nine-day Games is the same three creatures on a loop. One more each, keyed
 * to what that ground is actually made of. `validate-arenas` now fails any
 * roster under `AUDIT12_WAVE2_ARENA.muttRosterFloor`.
 */
export const WAVE2_MUTTS: Record<string, Mutt[]> = {
    saltflats: [{
        id: 'crust-borers', name: 'Crust Borers',
        packSize: [2, 5], damage: 11, speed: 4,
        inflicts: { infected: true },
        terrainPreference: ['open', 'wetland', 'ruins', 'highland'],
        role: 'ambusher',
    }],
    seapeaks: [{
        id: 'cliff-skuas', name: 'Cliff Skuas',
        packSize: [3, 6], damage: 9, speed: 10,
        inflicts: { bleeding: true },
        terrainPreference: ['highland', 'water', 'open'],
        role: 'scavenger',
    }],
    canopyweb: [{
        id: 'bridge-cutters', name: 'Bridge Cutters',
        packSize: [1, 2], damage: 15, speed: 8,
        inflicts: { bleeding: true },
        terrainPreference: ['forest', 'highland'],
        role: 'herder',
    }],
    acousticforest: [{
        id: 'hollow-callers', name: 'Hollow Callers',
        packSize: [1, 1], damage: 16, speed: 7,
        fearAura: 6,
        terrainPreference: ['forest', 'ruins', 'highland'],
        role: 'mimic',
    }],
    burnscar: [{
        id: 'ember-rats', name: 'Ember Rats',
        packSize: [4, 8], damage: 6, speed: 7,
        inflicts: { burned: true },
        role: 'swarm',
    }],
    craterfield: [{
        id: 'shell-crabs', name: 'Shell Crabs',
        packSize: [2, 4], damage: 13, speed: 3,
        inflicts: { bleeding: true },
        terrainPreference: ['open', 'wetland', 'ruins'],
        role: 'siege',
    }],
    // Procedural biomes: keyed on the biome id, as the roster lookup is.
    rainforest: [{
        id: 'strangler-vipers', name: 'Strangler Vipers',
        packSize: [1, 2], damage: 15, speed: 6,
        inflicts: { poisoned: true },
        terrainPreference: ['forest', 'wetland'],
        role: 'ambusher',
    }],
    archipelago: [{
        id: 'shoal-gulls', name: 'Shoal Gulls',
        packSize: [4, 8], damage: 6, speed: 10,
        inflicts: { infected: true },
        role: 'swarm',
    }],
    highlands: [{
        id: 'moor-hounds', name: 'Moor Hounds',
        packSize: [2, 4], damage: 15, speed: 9,
        inflicts: { bleeding: true },
        terrainPreference: ['highland', 'open', 'wetland'],
        role: 'herder',
    }],
    steppe: [{
        id: 'grass-lurkers', name: 'Grass Lurkers',
        packSize: [1, 2], damage: 16, speed: 8,
        inflicts: { bleeding: true },
        terrainPreference: ['open', 'highland'],
        role: 'ambusher',
    }],
    saltmarsh: [{
        id: 'mudflat-eels', name: 'Mudflat Eels',
        packSize: [2, 4], damage: 12, speed: 5,
        inflicts: { infected: true },
        terrainPreference: ['wetland', 'water', 'open'],
        role: 'ambusher',
    }],
    boreal: [{
        id: 'spruce-wolverines', name: 'Spruce Wolverines',
        packSize: [1, 1], damage: 18, speed: 7,
        inflicts: { bleeding: true },
        persistent: true,
    }],
    bayou: [{
        id: 'moss-snappers', name: 'Moss Snappers',
        packSize: [1, 2], damage: 20, speed: 4,
        inflicts: { bleeding: true },
        terrainPreference: ['wetland', 'water'],
        role: 'siege',
    }],
    badlands: [{
        id: 'wash-rattlers', name: 'Wash Rattlers',
        packSize: [1, 3], damage: 12, speed: 6,
        inflicts: { poisoned: true },
        role: 'ambusher',
    }],
};
