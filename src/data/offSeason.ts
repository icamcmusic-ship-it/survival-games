import { Arena } from '../models/types';
import { RNG } from '../utils/rng';

/**
 * §5: the off-season skin.
 *
 * The cheapest way to make a familiar arena feel different on a repeat play is
 * not to author another arena — it is to run the same zone graph and the same
 * mechanics under different ambient dressing. A player who has run the Frozen
 * Wasteland six times has run one map six times; the seventh, in the thaw, is
 * the same map and does not read like it.
 *
 * Deliberately and strictly cosmetic. A skin rewrites `Arena.description` and
 * nothing else: no zone, no law, no edge rule, no danger or resource value, no
 * mutt. Anything that changed the simulation would break the promise that a
 * seed replays the same Games, and would make this a second arena roster to
 * balance rather than a coat of paint.
 *
 * One skin per arena at most, rolled from the seed at `OFF_SEASON_CHANCE`, so
 * it is an occasional surprise rather than a coin flip on every run.
 */

export interface OffSeasonSkin {
    /** Shown in place of the arena's own description, and in the brief. */
    label: string;
    description: string;
}

/** Odds a run that could get a skin actually gets one. */
export const OFF_SEASON_CHANCE = 0.18;

export const OFF_SEASON_SKINS: Record<string, OffSeasonSkin[]> = {
    frozen: [{
        label: 'the thaw',
        description: 'The same wasteland, in a year the Gamemakers let it thaw. The snowpack has gone to grey slush and standing meltwater, every horizon is running, and the ice that made half the map walkable is now the reason half the map is not.',
    }],
    solar: [{
        label: 'the overcast year',
        description: 'The same desert under a lid of cloud that never breaks and never rains. Nothing burns, nothing dries, and the glare that used to tell a tribute where they were has been replaced by a flat grey that tells them nothing at all.',
    }],
    toxic: [{
        label: 'the drought',
        description: 'The same bog, drawn down. What was chest-deep is ankle-deep and what was ankle-deep is cracked mud, and every single thing the water was hiding is now lying on the surface of it in the open.',
    }],
    concrete: [{
        label: 'the wet season',
        description: 'The same dead city with a week of rain in it. Every stairwell is a waterfall, every basement is a cistern, and the dust that has lain on this place since it died has finally, comprehensively, turned to mud.',
    }],
    canopy: [{
        label: 'the leaf-fall',
        description: 'The same forest, out of season. The canopy that hid everything has come down into a knee-deep carpet that hides nothing and announces every footstep, and for the first time in the arena\'s history you can see the sky from the floor.',
    }],
    ashfall: [{
        label: 'the clear week',
        description: 'The same slope, between eruptions. The air is breathable, the sun is visible, and everybody in it is behaving as though the mountain has finished — which it has not, and which the Gamemakers are counting on.',
    }],
    clockwork: [{
        label: 'the slow clock',
        description: 'The same island, running at half speed. The sectors still go off in order and each one still does what it has always done; it simply takes twice as long to come around, which changes every calculation anybody has ever made about this map.',
    }],
    cabin: [{
        label: 'the spring melt',
        description: 'The same homestead in the week the drifts go. The road out is mud rather than snow, the well is running, the woodshed is damp through — and the cold that made the hearth the only thing worth holding has eased just enough to make holding it a choice.',
    }],
    karst: [{
        label: 'the low water',
        description: 'The same cave system with the Undermere at its lowest in living memory. Passages that have been sumps since the cave was cut are walkable, the siphon is dry, and the whole map is a size nobody has ever seen it at.',
    }],
    magmatube: [{
        label: 'the cold vent',
        description: 'The same throat, dormant. The lake at the bottom has crusted over, the heat gradient has gone soft, and everything the mountain was doing to keep people out of the deep zones it is currently not doing.',
    }],
};

/**
 * The skin this run's arena wears, if any. Deterministic from the seed, so a
 * shared seed shows the same arena the same way.
 */
export function offSeasonFor(seed: string, arena: Arena): OffSeasonSkin | undefined {
    const skins = OFF_SEASON_SKINS[arena.id];
    if (!skins || skins.length === 0) return undefined;
    const rng = new RNG(`${seed}-off-season-${arena.id}`);
    if (!rng.chance(OFF_SEASON_CHANCE)) return undefined;
    return rng.pick(skins);
}
