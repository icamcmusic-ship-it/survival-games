import type { OffSeasonSkin } from '../offSeason';
import { OFF_SEASON } from '../balance';

/**
 * AUDIT-6 §6.1: the five newest arenas had no seasons at all.
 *
 * Forty of forty-five arenas carried skins and `tidewrack`, `thresher`,
 * `vigil`, `saltworks` and `kiln` carried none — the same coverage hole §5.1
 * found in the signature layer, one authoring pass behind. Three each, on the
 * same rule the existing skins follow: a season is the arena with the thing
 * that makes it *that* arena either switched off, turned up, or answered by a
 * different law.
 */
export const OFF_SEASON_SKINS_EXTRA3: Record<string, OffSeasonSkin[]> = {
    tidewrack: [{
        label: 'the neap year',
        description: 'The same estuary at a tide that barely moves. The channels that used to rearrange themselves twice a night sit where they are for days, the crossings are all the same crossing, and a map that was supposed to be unlearnable is being learned.',
        liftsLaw: true,
        dangerShift: OFF_SEASON.kinder,
    }, {
        label: 'the spring-tide year',
        description: 'The same flats under the biggest tides in living memory. The Deep Cut runs twice a day and runs hard, the Wreck Line goes under to the gunwales, and Gull Rock is an island for eleven hours out of every twenty-four.',
        addLaw: 'shrinkingArena',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the bloom year',
        description: 'The same salt marsh gone green to the horizon. Something the Capitol seeded has taken, the Cockle Beds are thick with it, and for the first time in the history of this arena there is something on the flats a tribute can eat.',
        liftsLaw: true,
        resourceShift: OFF_SEASON.fertile,
    }],
    thresher: [{
        label: 'the shutdown year',
        description: 'The same plant with the line stopped. Nothing turns, nothing screams, the Coolant Race is a standing pool, and a building designed so that no fight in it goes unheard has gone so quiet that a footstep carries the length of the Packing Hall.',
        liftsLaw: true,
        addLaw: 'openMic',
    }, {
        label: 'the double-shift year',
        description: 'The same plant running at a rate nobody has ever run it at. The Intake Chutes do not stop, the Bone Hoppers are full, and the Gamemakers have stopped pretending the machinery is scenery.',
        dangerShift: OFF_SEASON.harsher,
        addLaw: 'shrinkingArena',
    }, {
        label: 'the stocked year',
        description: 'The same sorting floor with the stores still full. Whatever the plant was processing is in the Packing Hall in crates, the Scale House is a pantry, and the one arena whose price of entry was a body has a season where nobody is hungry.',
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.kinder,
    }],
    vigil: [{
        label: 'the standing-down year',
        description: 'The same garrison with the watch dismissed. Whatever was keeping everybody awake has been switched off, the Watchfires are cold, and a map built entirely around the fact that nobody sleeps is being played by people who can.',
        liftsLaw: true,
        resourceShift: OFF_SEASON.fertile,
    }, {
        label: 'the siege year',
        description: 'The same parade ground under a standing alarm. The Bell Tower rings on no schedule anybody can find, the Barrack Rows are barricaded from the inside by people who were not the ones who barricaded them, and first light is the only thing anybody trusts.',
        addLaw: 'deadlyNight',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the overgrown year',
        description: 'The same garrison after a long season of nobody. Sentry Wood has come in over the wall, the Parade Ground is waist-high, and the arena that had nowhere to hide has grown itself somewhere.',
        liftsLaw: true,
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.kinder,
    }],
    saltworks: [{
        label: 'the wet year',
        description: 'The same pans after a season of rain. The Settling Ponds are sweet, the crust has gone soft everywhere rather than only where somebody stood, and the one thing everybody used to have to come back to the Brine Well for is now lying in every hollow on the map.',
        liftsLaw: true,
        resourceShift: OFF_SEASON.fertile,
    }, {
        label: 'the drought year',
        description: 'The same works in a year the rain did not come at all. The Brine Well is down to something that has to be dug for, Broken Pan has spread into Harvest Rows, and the walk everybody has to make has got considerably longer.',
        dangerShift: OFF_SEASON.harsher,
        resourceShift: OFF_SEASON.barren,
    }, {
        label: 'the working year',
        description: 'The same saltworks with the pumps running and the barrows moving. The Pump House is warm, the Barrow Track is firm underfoot for the first time in the arena\'s history, and the Capitol has decided that a working landscape is more interesting than a ruined one.',
        addLaw: 'bountifulGround',
        dangerShift: OFF_SEASON.kinder,
    }],
    kiln: [{
        label: 'the cold-kiln year',
        description: 'The same pottery works with the fires out. One sun instead of two, the Firing Floor merely warm, and the Slip Cellar — the only place in this arena anybody ever wanted to be — is now one cool room among many.',
        liftsLaw: true,
        dangerShift: OFF_SEASON.kinder,
    }, {
        label: 'the firing year',
        description: 'The same works at full heat under both suns. Kilnhead is unwalkable by noon, the Flue Tunnels are running, and the cellar everybody knows about is the only thing on the map worth having and the easiest place in the world to be found.',
        addLaw: 'meltingGround',
        dangerShift: OFF_SEASON.harsher,
        resourceShift: OFF_SEASON.barren,
    }, {
        label: 'the flooded-cellar year',
        description: 'The same pottery with the water table up. The Slip Cellar is thigh-deep and undrinkable, Clay Banks are slurry, and the arena has quietly removed the one answer it had ever offered to the question it asks.',
        liftsLaw: true,
        addLaw: 'twinSuns',
        dangerShift: OFF_SEASON.harsher,
    }],
};
