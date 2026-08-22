import { Zone } from '../models/types';

/**
 * §8.3: named landmarks within zones.
 *
 * "Sector 4" is a broadcast label; nobody lost in it thinks in those terms.
 * Survivors navigate by the specific thing — the split tree, the wrecked
 * hovercraft, the white boulder — and the chronicle had no vocabulary for
 * that, so every zone was an undifferentiated volume with a name on it.
 *
 * A landmark is derived, not stored: the same FNV hash `zoneFeatures` uses
 * picks one from the zone's terrain pool, so the same arena always has the
 * same landmarks (a shared seed shows both players the same drowned bus),
 * saves need no new field, and hand-authored and procedural arenas get them
 * for free. Prose reads them through `landmarkOf`; nothing mechanical hangs
 * off them, which is what keeps them safe to sprinkle anywhere.
 */

const LANDMARKS: Record<Zone['terrain'], string[]> = {
    forest: [
        'the split oak', 'the lightning tree', 'the deer skull nailed to a trunk',
        'the mossed-over foundation', 'the three pines that grew as one', 'the hollow log big enough to sleep in',
    ],
    water: [
        'the drowned jetty', 'the rust-red buoy', 'the sandbar shaped like a sickle',
        'the wreck showing its ribs at low water', 'the flat stone a metre under the surface',
    ],
    wetland: [
        'the sunken fence line', 'the heron roost', 'the bus swallowed to its windows',
        'the duckboard path that ends nowhere', 'the dead willow full of bottles',
    ],
    highland: [
        'the white boulder', 'the wind-bent cairn', 'the ledge with the long view',
        'the chimney of stacked stone', 'the scree fan below the notch',
    ],
    ruins: [
        'the staircase to a missing floor', 'the mural nobody finished', 'the clock stopped at ten past four',
        'the doorway standing without its wall', 'the fountain full of dry leaves',
    ],
    open: [
        'the lone fence post', 'the burnt circle in the grass', 'the plough rusted into the ground',
        'the animal track that runs dead straight', 'the low mound that is too regular to be natural',
    ],
};

/** FNV-1a over the zone name, mirroring `zoneFeatures`' derivation. */
function hash(name: string): number {
    let h = 2166136261;
    for (let i = 0; i < name.length; i++) {
        h ^= name.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** The one thing everyone who has crossed this zone remembers about it. */
export function landmarkOf(zone: Zone): string {
    const pool = LANDMARKS[zone.terrain];
    return pool[hash(zone.name) % pool.length];
}
