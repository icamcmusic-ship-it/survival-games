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
    tempest: [{
        label: 'the doldrum year',
        description: 'The same drowned archipelago in a season the storms forgot. The sea is a sheet of glass, the wind that used to make the crossings lethal has simply stopped, and the silence over the water is doing something to everybody that the gales never managed.',
    }],
    saltflats: [{
        label: 'the flood year',
        description: 'The same salt pan, three inches under water. The whole arena is a mirror from horizon to horizon, every step throws a wake somebody can see from a mile off, and the crust that used to hold a tribute\'s weight has gone to grey porridge.',
    }],
    sporefields: [{
        label: 'the sterile year',
        description: 'The same fungal plain after the Gamemakers burned it back. The air is finally clean, nothing glows, and the tributes are discovering how much of what they had been eating came out of the spore beds.',
    }],
    vault: [{
        label: 'the powered-down year',
        description: 'The same buried vault with the lights off. Emergency strips only, doors that used to cycle on a schedule standing wherever they were left, and the ventilation that made the deep levels survivable running on whatever is left in the batteries.',
    }],
    warren: [{
        label: 'the flood year',
        description: 'The same mine with the pumps off. The lower galleries are filling, everything below the third level is a decision rather than a route, and the sound of water moving somewhere out of sight never stops.',
    }],
    islands: [{
        label: 'the low-tide year',
        description: 'The same island chain at a tide that has gone out and not come back. Land bridges nobody has ever walked stand exposed and stinking, the shallows are a mudflat, and every hidden thing on the sea floor is now scenery.',
    }],
    eclipse: [{
        label: 'the daylight year',
        description: 'The same arena with the shutters open. Whatever the Gamemakers were doing to keep it dark, they have stopped, and a map built entirely around not being able to see is being played in full sun by people who trained for the opposite.',
    }],
    reef: [{
        label: 'the bleached year',
        description: 'The same reef, white from end to end. Everything that lived in it has gone somewhere else, the water is clearer than anybody wants it to be, and there is nowhere on the whole map to be that is not visible from above.',
    }],
    abattoir: [{
        label: 'the disused year',
        description: 'The same yards with the line stopped. The machinery is cold, the drains are dry, and the smell that used to cover everything has faded enough that tributes can smell each other.',
    }],
    carnival: [{
        label: 'the wet year',
        description: 'The same fairground in continuous rain. The sawdust has gone to mud, half the rides will not start, and the painted fronts are sliding off the plywood in long coloured streaks.',
    }],
    ashwaste: [{
        label: 'the green year',
        description: 'The same ash plain, three years further on. Something has started growing in it — thin, grey-green, waist high — and for the first time in the arena\'s history there is cover in it.',
    }],
    quarry: [{
        label: 'the frozen year',
        description: 'The same quarry in a hard freeze. The sumps are lids of ice, the cable runs are furred white, and the loose stone that made every slope a hazard is locked solid until the sun gets round to it.',
    }],
    glacier: [{
        label: 'the calving year',
        description: 'The same glacier coming apart. The ice is working audibly all day, new crevasses open behind people who have just walked over them, and the face at the bottom of the map drops something the size of a house into the water twice an hour.',
    }],
    floe: [{
        label: 'the fast-ice year',
        description: 'The same floe sea frozen into one piece. The leads that made this a map of islands have closed, the whole arena is walkable, and nobody has any idea which parts of it are thick enough for that to be true.',
    }],
    alpine: [{
        label: 'the whiteout year',
        description: 'The same peaks in weather that never lifts. The ridgelines that made this arena readable are gone, the tarns are invisible until somebody is in one, and altitude is the only thing anybody can still navigate by.',
    }],
    terraces: [{
        label: 'the drought year',
        description: 'The same terraced hillside with the flumes dry. The irrigation that fed the whole map is a set of empty stone channels, the crops are standing dead, and the only water left is wherever the system used to end.',
    }],
    seapeaks: [{
        label: 'the fog year',
        description: 'The same drowned peaks under fog that does not lift. The summits that were the whole point of this arena are invisible from each other, and a tribute on one has no way to know whether the next is occupied.',
    }],
    canopyweb: [{
        label: 'the shed year',
        description: 'The same canopy after the silk came down. Whatever spun it has moved up or died off, the walkways are gone, and an arena built to be crossed above the ground is being played on it.',
    }],
    acousticforest: [{
        label: 'the dead-air year',
        description: 'The same forest with the resonance gone. Something in the Gamemakers\' shaping has failed, the trees no longer carry sound, and an arena where everybody could hear everything is suddenly, unnervingly, private.',
    }],
    burnscar: [{
        label: 'the regrowth year',
        description: 'The same burn scar in its third summer. Fireweed to the waist, saplings thick enough to hide a person, and the black standing trunks the arena was named for now surrounded by something green enough to burn again.',
    }],
    craterfield: [{
        label: 'the flooded year',
        description: 'The same ordnance field under standing water. Every crater is a pond, the root mats float, and whatever is buried in the mud has stopped being something you can see and started being something you find.',
    }],
    culdesac: [{
        label: 'the occupied year',
        description: 'The same abandoned street with the lights on. Somebody has been through and switched the power back, the houses read as lived-in, and none of it is any less empty for that.',
    }],
    labyrinth: [{
        label: 'the collapsed year',
        description: 'The same maze with half its walls down. Routes that took a day now take an hour, sightlines run where they never did, and the tribute who memorised this map in training has memorised a different one.',
    }],
    ashgrove: [{
        label: 'the sap year',
        description: 'The same grey grove running with sap. Everything is sticky, everything smells of it, and the ash that used to fall silently now sticks to whatever it lands on, including people.',
    }],
    kelvin: [{
        label: 'the failed-cooling year',
        description: 'The same cold works with the plant losing. Temperatures are climbing through the whole facility, the frost is coming off the pipework in sheets, and the arena is becoming survivable at exactly the rate it is becoming unstable.',
    }],
    silkwood: [{
        label: 'the shorn year',
        description: 'The same wood with the silk cut back. The Gamemakers have cleared it to the trunks, the bridges are gone, and everything that used to hunt from above is on the floor with everybody else.',
    }],
    nooneplace: [{
        label: 'the noon year',
        description: 'The same nowhere at midday. Whatever held it in permanent dusk has been dialled the other way, and eleven days of flat unmoving noon is turning out to be worse.',
    }],
    redcathedral: [{
        label: 'the monsoon year',
        description: 'The same red canyon under water. It rains for an hour every afternoon, hard enough to move stone, and the dry watercourses that were the only shade on the map become the only thing on the map that can kill you quickly.',
    }],
    menagerie: [{
        label: 'the emptied year',
        description: 'The same park with the cages open and nothing in them. Everything has been released or removed, the enclosures are shelter rather than hazard, and the tributes keep checking behind themselves anyway.',
    }],
    storywood: [{
        label: 'the unwritten year',
        description: 'The same story wood with the endings taken out. The set pieces are all still standing, none of them do anything, and a map that ran on knowing what came next is being walked by people who now do not.',
    }],
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
    }, {
        label: 'the overgrown year',
        description: 'The same city block gone green. Root damage has opened the slabs, there is soil in the stairwells, and the sightlines that made this arena a shooting gallery are broken everywhere by things that grew there.',
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
    }, {
        label: 'the seized year',
        description: 'The same island with the mechanism stopped. Nothing rotates, nothing chimes, the sectors that used to shift on a schedule are wherever they stopped, and the silence is the loudest thing on it.',
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
