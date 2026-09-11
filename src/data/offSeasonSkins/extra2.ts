import type { OffSeasonSkin } from '../offSeason';
import { OFF_SEASON } from '../balance';

/**
 * §6.1: further off-season skins, merged into `OFF_SEASON_SKINS` at load so
 * an arena has several seasons rather than one alternate.
 */
export const OFF_SEASON_SKINS_EXTRA2: Record<string, OffSeasonSkin[]> = {
    floe: [{
        label: 'the break-up year',
        description: 'The same floe sea in a warm spring. The plates are smaller than anyone has seen them, the Black Lead has become half the map, and the Big Berg is rolling a little further every day with people on it.',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the polar-night year',
        description: 'The same pack ice with the sun gone under. The Gamemakers have swung the season the other way, the ice is lit by nothing but the aurora and the wreck\'s emergency strobe, and the seals have hauled out in numbers nobody was ready for.',
        liftsLaw: true,
        addLaw: 'deadlyNight',
        resourceShift: OFF_SEASON.fertile,
    }],
    alpine: [{
        label: 'the avalanche year',
        description: 'The same peaks under a snowpack that will not hold. The Summit Snows have let go twice before the gong, the Scree Chutes are buried, and every loud thing anyone does above the treeline is a wager on the slope above them.',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the relayed year',
        description: 'The same mountain with the Capitol\'s mast finally through the ridge. Gifts fall for the first time in this arena\'s history, the Hunting Lodge has a working stove, and the meadow the Cornucopia sits in is thick with a summer nobody up here has had before.',
        liftsLaw: true,
        resourceShift: OFF_SEASON.fertile,
    }],
    terraces: [{
        label: 'the cable year',
        description: 'The same terraced mountain with the cable car running. Somebody has greased the Counterweight Span, the cars go up and they come back, and a map that only ever flowed downhill can suddenly be climbed by anyone willing to trust a century of rust.',
        liftsLaw: true,
        dangerShift: OFF_SEASON.kinder,
    }, {
        label: 'the subsidence year',
        description: 'The same terraces sinking into their own workings. Shaft mouths are opening in the middle of steps that used to be solid, the Slurry Ponds have gone through into the galleries below, and the Cistern Terrace is the only flat ground anyone still believes in.',
        dangerShift: OFF_SEASON.harsher,
        resourceShift: OFF_SEASON.barren,
    }],
    seapeaks: [{
        label: 'the calm year',
        description: 'The same drowned peaks on a flat sea. The swells that made every crossing a coin toss have laid down, the Kelp Shallows are visible to the bottom, and the tributes who trained to climb are watching the ones who trained to swim.',
        dangerShift: OFF_SEASON.kinder,
        resourceShift: OFF_SEASON.fertile,
    }, {
        label: 'the rimed year',
        description: 'The same peaks glazed from summit to waterline. A freezing spray has cased every rock in ice, the Ice Chimney has become the only surface on the map anyone can get a hold on, and the sponsors have been told to drop nowhere else.',
        addLaw: 'sponsorsFixedZone',
        dangerShift: OFF_SEASON.harsher,
    }],
    canopyweb: [{
        label: 'the fog-lift year',
        description: 'The same giant conifers with the floor breathable. The nitrogen fog has thinned to a knee-deep haze, the Understory is walkable for the first time, and everyone who was fighting for a foothold three hundred feet up is wondering why they still are.',
        dangerShift: OFF_SEASON.kinder,
        resourceShift: OFF_SEASON.fertile,
    }, {
        label: 'the gale year',
        description: 'The same canopy in a wind that has not dropped since the gong. The moss webs are pitching like rigging, the Swaying Reach has earned its name every minute, and nothing thrown or dropped from above lands anywhere near where it was aimed.',
        addLaw: 'noSponsors',
        dangerShift: OFF_SEASON.harsher,
    }],
    acousticforest: [{
        label: 'the infested year',
        description: 'The same hollow forest with the borers back. Whatever the Gamemakers engineered has had a second generation, the trunks are riddled thinner every day, and the Splinter Field is spreading into stands that used to hold.',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the mast year',
        description: 'The same wind organ in a season the pines went to seed. The Needle Drift is deep in cones, the sawmill ruins are running with squirrels, and the forest sounds exactly as human as ever over the noise of things worth eating.',
        resourceShift: OFF_SEASON.fertile,
    }],
    burnscar: [{
        label: 'the reburn year',
        description: 'The same burn scar with the fire back in it. The fireweed has gone up, the Standing Dead are alight one at a time, and the mountain the arena text always said was not finished has, this year, made its point.',
        liftsLaw: true,
        addLaw: 'openMic',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the washout year',
        description: 'The same scar after a wet spring. The Erosion Gully has become a river, Seep Spring is a marsh, and the ground that used to run hot underfoot is cold, black, and moving downhill in sheets.',
        dangerShift: OFF_SEASON.harsher,
        resourceShift: OFF_SEASON.barren,
    }],
    craterfield: [{
        label: 'the cleared year',
        description: 'The same proving ground swept by a Capitol demolition team. The craters have been walked with detectors, the flagged ordnance has been lifted, and the vines that grew something worse have had a whole undisturbed summer to grow it.',
        liftsLaw: true,
        resourceShift: OFF_SEASON.fertile,
    }, {
        label: 'the dry year',
        description: 'The same craters with the ponds gone to mud. Everything that was sleeping under water is sleeping under a cracked crust that a foot goes through, and the Stagnant Pool Marsh has become a scatter of shells with nothing to hide them.',
        dangerShift: OFF_SEASON.harsher,
        resourceShift: OFF_SEASON.barren,
    }],
    culdesac: [{
        label: 'the foreclosed year',
        description: 'The same loop road with the deliveries stopped. The trucks have not come since the reaping, the lawns are ankle-deep, and the fence that used to close in on schedule has been left where it stood.',
        liftsLaw: true,
        resourceShift: OFF_SEASON.barren,
    }, {
        label: 'the block-party year',
        description: 'The same street strung with bunting. Every house has a table on the lawn and every table is laid, the Pool Complex is open, and the delivery trucks are coming twice as often to somewhere that nobody has ever been able to leave.',
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.kinder,
    }],
    labyrinth: [{
        label: 'the fixed year',
        description: 'The same yew maze with the rails seized. The walls have not moved since the gong, the cannon carries over the hedges for the first time anyone remembers, and the tributes are finding out that a maze that stays still is still a maze.',
        liftsLaw: true,
    }, {
        label: 'the overgrown year',
        description: 'The same labyrinth a year unclipped. The Long Alley is a tunnel, the Parterre has gone to seed, and the hedges are thick enough now that the walls do not need to move to close a route.',
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.harsher,
    }],
    ashgrove: [{
        label: 'the term-time year',
        description: 'The same school with the timetable torn down. The bell rings whenever it likes, the sponsors are dropping on the Roof, the Playing Field, anywhere, and nobody in the corridors knows what period it is.',
        liftsLaw: true,
    }, {
        label: 'the burst-pipe year',
        description: 'The same school with the Boiler Room gone. The pool is not the only flooded room any more, the Science Block is running with something the tributes are advised not to taste, and the yard is the driest ground in the building.',
        dangerShift: OFF_SEASON.harsher,
        resourceShift: OFF_SEASON.barren,
    }],
    kelvin: [{
        label: 'the resupply year',
        description: 'The same station with the Fuel Farm full. Somebody topped it before the reaping, the generator will outlast the Games, and the Mess has been stocked for a wintering party of twelve who never arrived.',
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.kinder,
    }, {
        label: 'the dead-fuel year',
        description: 'The same station with the tanks empty on the first morning. No generator, no heat, the Habitation Ring going to the same temperature as the Ridge, and the only fire on the ice shelf is whatever the Gamemakers have decided this year to allow.',
        liftsLaw: true,
        addLaw: 'deadlyNight',
    }],
    silkwood: [{
        label: 'the hatching year',
        description: 'The same wood in the week the Nursery opened. There are more of them than there have ever been, most are small, and the silk is going up between the trunks faster than anyone can cut it down.',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the dormant year',
        description: 'The same silkwood in a cold snap. The spiders have gone deep, the webs are stiff with frost and break at a touch, and the medicine that never worked here is, for one strange season, working.',
        liftsLaw: true,
        dangerShift: OFF_SEASON.kinder,
        resourceShift: OFF_SEASON.barren,
    }],
    nooneplace: [{
        label: 'the wired year',
        description: 'The same nowhere with the phones on. Something has been plugged back in, the cannon carries down the Long Hall for the first time, and the parachutes come down through ceilings that have no floor above them.',
        liftsLaw: true,
    }, {
        label: 'the damp year',
        description: 'The same halls with the Flooded Floor spreading. The carpet squelches three levels up, the hum has a drip in it, and the Sub-Level is somewhere people now go down to and do not come back up from.',
        dangerShift: OFF_SEASON.harsher,
    }],
    redcathedral: [{
        label: 'the spring year',
        description: 'The same canyon after a wet winter. The Seeps are running, the Wash has water in it, and the river at the bottom is no longer the only place on the map worth the climb.',
        liftsLaw: true,
        resourceShift: OFF_SEASON.fertile,
    }, {
        label: 'the heat-dome year',
        description: 'The same red canyon under a sky that does not cool at night. The rim is as hot at midnight as at noon, the Cliff Dwellings are ovens, and the river is the only place anyone has stopped moving since the gong.',
        addLaw: 'noNight',
        dangerShift: OFF_SEASON.harsher,
    }],
    menagerie: [{
        label: 'the off-schedule year',
        description: 'The same zoo with the keeper\'s board wrong. The enclosures are opening, just not when it says, and a park that ran on everybody knowing the order is being played by people who know only that something is out.',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the feeding year',
        description: 'The same park with the Feed Store cleared into every enclosure. Everything in the cages is fed, slow, and uninterested, the Arboretum is in fruit, and the tributes have a day or two before all of that wears off.',
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.kinder,
    }],
    storywood: [{
        label: 'the winter year',
        description: 'The same story wood under snow. The chimneys are the only warm thing for miles, the Millpond is frozen, and every door that was always unlocked now opens onto somebody already inside.',
        dangerShift: OFF_SEASON.harsher,
        resourceShift: OFF_SEASON.barren,
    }, {
        label: 'the happy-ending year',
        description: 'The same cottages with the prices dropped. The Gingerbread House is only gingerbread, the Well gives water, Grandmother is just an old woman, and the cost that every door used to charge has, this one year, been waived.',
        liftsLaw: true,
        resourceShift: OFF_SEASON.fertile,
    }],
    cabin: [{
        label: 'the blizzard year',
        description: 'The same homestead in weather that has not broken since the gong. The Snowed Road is gone, the Barn is a shape in the white, and the cellar the sponsors used to hit has been buried past the door.',
        liftsLaw: true,
        addLaw: 'noSponsors',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the empty-woodshed year',
        description: 'The same cabin with nothing to burn. The Woodshed is a row of bare pegs, the Frozen Well has stayed frozen, and the stove that made the hearth the only thing worth holding is a cold iron box in a room with four thin walls.',
        addLaw: 'fireImpossible',
        resourceShift: OFF_SEASON.barren,
    }],
    magmatube: [{
        label: 'the eruption year',
        description: 'The same throat in the week the mountain woke. The Ember Shaft is throwing sparks to the rim, the Lower Throat is closed by something that used to be a floor, and the Bat Colony has emptied itself into the upper galleries all at once.',
        addLaw: 'shrinkingArena',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the sweating year',
        description: 'The same tube running with condensation. The Steam Vents have gone gentle, every wall in the mountain is beaded with water, and the cistern that was the only place to drink is one of a hundred.',
        liftsLaw: true,
        resourceShift: OFF_SEASON.fertile,
    }],
    karst: [{
        label: 'the high-water year',
        description: 'The same caves after the rains upstream. The Undermere has come up into the Cathedral, the Siphon Passage is a siphon again, and the Bone Passage is the only dry route between the two halves of a map that used to be one.',
        addLaw: 'oneWayBorders',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the bloom year',
        description: 'The same cave lit from end to end. The glowmoss has spread out of its hollow along every damp wall, the Black Gallery is only dim, and the Bat Roost is louder than anyone remembers with the things that eat the things that live on it.',
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.kinder,
    }],
};
