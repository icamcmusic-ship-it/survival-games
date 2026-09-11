import type { OffSeasonSkin } from '../offSeason';
import { OFF_SEASON } from '../balance';

/**
 * §6.1: further off-season skins, merged into `OFF_SEASON_SKINS` at load so
 * an arena has several seasons rather than one alternate.
 */
export const OFF_SEASON_SKINS_EXTRA1: Record<string, OffSeasonSkin[]> = {
    clockwork: [{
        label: 'the misfiring year',
        description: 'The same island with the schedule broken. The sectors still go off, but the lightning tree fires at the swamp\'s hour and the blood rain comes twice, and the one thing this map ever promised — that you could set your watch by it — is the one thing it no longer does.',
        dangerShift: OFF_SEASON.harsher,
    }],
    frozen: [{
        label: 'the still year',
        description: 'The same wasteland without the wind. The blizzards have not come, the snowpack lies where it fell, and a cold that used to arrive sideways at fifty miles an hour now simply sits on the map and waits. The nights are the same nights; it is the days that have gone quiet enough to travel in.',
        dangerShift: OFF_SEASON.kinder,
    }, {
        label: 'the deep-freeze year',
        description: 'The same wasteland twenty degrees colder. The Meltwater Channel has stopped, the lake is walkable to the far shore, and anything left out overnight — a boot, a cut, a fire that was going to be lit in the morning — is not usable by dawn.',
        addLaw: 'fireImpossible',
        dangerShift: OFF_SEASON.harsher,
    }],
    concrete: [{
        label: 'the demolition year',
        description: 'The same dead city while the Gamemakers bring it down. Charges go off in the Skyscraper Ruins on no schedule anybody can read, the Overpass finished collapsing on day one, and the streets are closing under rubble faster than a tribute can learn them.',
        addLaw: 'shrinkingArena',
        dangerShift: OFF_SEASON.harsher,
    }],
    toxic: [{
        label: 'the clear-water year',
        description: 'The same bog after the Gamemakers flushed it. The water runs almost clean, the gas has thinned to a smell rather than a hallucination, and the reeds and cypress are the greenest anybody has seen them. The poison that made this the Toxic Swamps has been switched off, and nobody in it quite believes that.',
        liftsLaw: true,
        resourceShift: OFF_SEASON.fertile,
    }, {
        label: 'the bloom year',
        description: 'The same swamp under an algal bloom. The Glowing Bog glows in daylight now, the Murky Waters have a skin on them that moves when nothing is touching it, and the gas comes off the surface thick enough to see. Nothing that grows here this year is worth putting in a mouth.',
        addLaw: 'noForage',
        dangerShift: OFF_SEASON.harsher,
    }],
    solar: [{
        label: 'the flare year',
        description: 'The same desert in a season the sun will not behave. The flares come daily rather than weekly, the Glass Sea is too bright to cross before dusk that never arrives, and the Slot Canyon is the only place on the map a tribute can stand at noon without cooking.',
        dangerShift: OFF_SEASON.harsher,
        resourceShift: OFF_SEASON.barren,
    }, {
        label: 'the rain year',
        description: 'The same desert after a storm that should not have reached it. The Dried Oasis is wet, the Seep is a pool, and the Endless Dunes are crusted and walkable for the first time anyone remembers. The sun still does not set; it simply has something to dry out now.',
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.kinder,
    }],
    ashfall: [{
        label: 'the eruption year',
        description: 'The same caldera while the mountain wakes back up. The Magma Vents are running, the Sulphur Springs boil, and the grey snowfall has gone black and hot enough to blister where it lands. The Gamemakers have stopped pretending this is scenery.',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the reseeded year',
        description: 'The same slope with something planted in it. The Fern Gully has spread up the Ashen Woods, moss is taking on the warm ground, and for the first time in a decade there is something in this caldera to eat that was not dropped from the sky — which is fortunate, because nothing is.',
        resourceShift: OFF_SEASON.fertile,
    }],
    tempest: [{
        label: 'the surge year',
        description: 'The same coastline under a storm that has stopped taking turns. The tide does not pick a zone tonight; it takes the Flooded Terraces, the Salt Marsh and the Drowned Quarter together and does not give them back, and what is left of the map is shrinking toward the Lighthouse a night at a time.',
        addLaw: 'shrinkingArena',
    }, {
        label: 'the wreck year',
        description: 'The same drowned shore after the storm brought something in. The Wreck Graveyard has a new hull in it, the Boathouse is stacked with what washed out of the hold, and the mangroves are hung with cargo. The gales have not eased; there is simply, for once, something worth going out in them for.',
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.harsher,
    }],
    saltflats: [{
        label: 'the white-out year',
        description: 'The same salt pan under a sky as white as the ground. Cloud has closed over the Mirror, the glare no longer burns but the horizon has gone entirely, and a tribute standing in the Hexagon Flats cannot tell which way Scrub Hollow lies without a footprint to follow. The water rules have not changed; the finding has.',
        addLaw: 'noSponsors',
        dangerShift: OFF_SEASON.kinder,
    }, {
        label: 'the brine year',
        description: 'The same dried sea with the Brine Pools risen. The Evaporation Pans are full, the Boneyard sits in an inch of pink water, and there is more liquid on this map than in a decade of Games — none of it drinkable, and all of it reflecting. Scrub Hollow is still the only place the rule makes an exception.',
        resourceShift: OFF_SEASON.barren,
    }],
    sporefields: [{
        label: 'the fruiting year',
        description: 'The same fungal plain in a season everything decided to spore at once. The Glowcap Wood is knee-deep in caps, the Shelf Terraces have doubled, and the Fruiting Body is putting out something new every morning. More of it is edible than ever. The same half still is not.',
        resourceShift: OFF_SEASON.fertile,
    }, {
        label: 'the blight year',
        description: 'The same field with the Blight Scar spreading. Whatever the Gamemakers used to burn it back has got loose, the Deadfall is spreading uphill through the Mycelium Steps, and the spore load in the air is thick enough that breathing is a decision. The Ring of Caps is still the only place a parachute comes down.',
        addLaw: 'noHealing',
        dangerShift: OFF_SEASON.harsher,
    }],
    canopy: [{
        label: 'the monsoon year',
        description: 'The same gardens in a rain that does not stop. The Cistern Hollows overflow, the Rope Bridges swing with the weight of the water on them, and the Undercanopy is a mist a tribute cannot see their own feet through. Two hundred metres up, a wet platform is a very short story.',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the rigged year',
        description: 'The same canopy with the ropes re-run. Somebody has been through the Rope Bridges and the Wind Gap in the off-season and doubled every span, and for once a platform can be left the way it was reached. The ground is still not survivable. It is simply no longer the only way back.',
        liftsLaw: true,
    }],
    vault: [{
        label: 'the jubilee year',
        description: 'The same buried complex with the lights on. The faces on the ceiling have been replaced with the Capitol seal, the Commissary is stocked, and the Hydroponics Bay is putting out more than a full roster could eat. Nobody has explained why the Gamemakers are being generous, and the schedule the lights used to go out on has not been cancelled — only postponed.',
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.kinder,
    }, {
        label: 'the flooded-sump year',
        description: 'The same vault with the Sump backing up. The Cistern has crested, the Service Tunnels run ankle-deep and rising, and the Reactor Level has a smell to it that the ventilation is not moving. The cannons still do not fire down here, and now the drains do not either.',
        addLaw: 'oneWayBorders',
        dangerShift: OFF_SEASON.harsher,
    }],
    warren: [{
        label: 'the cave-in year',
        description: 'The same mine after a collapse the Gamemakers did not schedule. The Collapsed Galleries have kept collapsing, the Choke is half its old width, and the map is being sealed off a chamber at a time from the outside in. Nothing down here to drink, and now nowhere much to carry it to.',
        addLaw: 'shrinkingArena',
    }, {
        label: 'the wet-wall year',
        description: 'The same mine with the walls sweating. Something has shifted above the Old Workings and the rock runs with seep, the Root Gardens are the greenest they have been, and for the first time in the Warren\'s history a tribute can lick a wall and get something for it. The thing in the dark drinks too.',
        liftsLaw: true,
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.harsher,
    }],
    islands: [{
        label: 'the clear-fog year',
        description: 'The same archipelago with the fog lifted. The magnetic haze has blown out to sea, compasses point somewhere for the first time, and the Fog Shallows are visible for what they are — which turns out to be shallow. A cut rope is still a border redrawn. It is just that everyone can see it being cut.',
        addLaw: 'openMic',
        dangerShift: OFF_SEASON.kinder,
    }, {
        label: 'the storm-cut year',
        description: 'The same island chain after a gale took the rigging. Half the rope bridges are in the water, the zip-lines hang slack, and the Long Span is a single strand nobody has tested. The fog is exactly as thick as ever, and the way across it has never been thinner.',
        dangerShift: OFF_SEASON.harsher,
        resourceShift: OFF_SEASON.barren,
    }],
    eclipse: [{
        label: 'the vent year',
        description: 'The same forest with the pitch-vents open wide. The Charcoal Grove is burning again, the Redwood Naves are lit orange from below, and a map that used to be dark enough to hide in is dark enough only in the Dark Meander. The stars on the ceiling have stopped moving; the fires are doing that now.',
        addLaw: 'fireImpossible',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the fungal year',
        description: 'The same dusk with the glow turned up. The Glowcap Hollow has spread the length of Foxfire Creek, the Duskmoss Flats give off enough light to read by, and for once a tribute can see what they are picking before they eat it. The nights are no kinder. There are just more of them worth walking through.',
        resourceShift: OFF_SEASON.fertile,
    }],
    reef: [{
        label: 'the returning-tide year',
        description: 'The same drained sea floor with the water coming back. The Great Trench is filling, the Brine Sumps are pools, and the Tidepool Terraces have something alive in them for the first time since the ocean left. Everything is still sharp; it is just that some of it is underwater now, where you cannot see it.',
        dangerShift: OFF_SEASON.harsher,
        resourceShift: OFF_SEASON.fertile,
    }, {
        label: 'the sanded year',
        description: 'The same reef after a season of wind. Sand has drifted over the Coral Razors and filled the Urchin Barrens to the spines, the Anemone Fields are buried, and a map built entirely out of edges has been rounded off. Still no fire, still no medicine. Fewer reasons to need either.',
        dangerShift: OFF_SEASON.kinder,
    }],
    abattoir: [{
        label: 'the overrun year',
        description: 'The same factory with the line running flat out. Somebody has turned the plant up, the Conveyor Deck moves faster than a person can walk, and the Piston Hall has stopped keeping to a schedule anyone can count. Every fight still echoes through the whole works. So does everything else.',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the muffled year',
        description: 'The same yards with the furnaces damped and the gears packed in grease. The Gamemakers have quietened the place for the cameras, Furnace Row is a dull red rather than a roar, and for the first time in the arena\'s history a tribute on the Catwalks cannot hear what is happening on the Kill Floor.',
        liftsLaw: true,
    }],
    carnival: [{
        label: 'the reopened year',
        description: 'The same fairground with the power on. The Ferris Wheel turns, the Carousel plays, the Big Top has lights in it and the Midway has prizes on the stalls again — and among the prizes, this year, are things with edges. Somebody wanted this season to look like the old posters. Somebody else wanted it to end faster.',
        liftsLaw: true,
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the pine year',
        description: 'The same park a decade further into the forest. The Pine Dark has come over the fence and through the Overgrown Campground to the edge of the Midway, the Haunted Manor has a tree through it, and the fog is thicker under the trees than it ever was on the rides. There is still nothing here to fight with. There is, at last, something to eat.',
        resourceShift: OFF_SEASON.fertile,
    }],
    ashwaste: [{
        label: 'the rain year',
        description: 'The same ash plain after a week of rain. Three feet of ash has gone to three feet of grey slurry, the Mudpots have spread to the Deep Drifts, and a print that used to be a signature is now a hole that fills behind you. Nothing grows in it. Nothing was ever going to.',
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the settling year',
        description: 'The same wasteland after a long dry spell packed it down. The Deep Drifts have crusted, the Buried Village has emerged to the lintels, and walking has stopped being work. The caldera has not decided anything. It has just, for now, stopped shouting about it.',
        dangerShift: OFF_SEASON.kinder,
    }],
    quarry: [{
        label: 'the open year',
        description: 'The same pit with the border left where it started. The Gamemakers have not closed a bench all season, the Rim Camp is still in play on the last day, and the Flooded Pit at the bottom is a place a tribute goes by choice rather than by schedule. The roads are the same roads. Nobody is being herded down them.',
        liftsLaw: true,
    }, {
        label: 'the blasting year',
        description: 'The same quarry with the Powder Magazine back in use. Charges go off on the benches a level at a time, the Crusher House runs at night, and the spiral road that was the only way down is being cut shorter behind the tributes as they use it. The border still closes. This year it does so audibly.',
        addLaw: 'openMic',
        dangerShift: OFF_SEASON.harsher,
    }],
    glacier: [{
        label: 'the melt year',
        description: 'The same glacier in a summer it was not built for. The Frozen Falls are running, the Moulin is a torrent, and the Slush Basin has spread through the Blue Galleries to the Slick Tunnels. The Green Chimney is putting out something to eat. The ice overhead is thinner every hour anybody spends under it.',
        resourceShift: OFF_SEASON.fertile,
        dangerShift: OFF_SEASON.harsher,
    }, {
        label: 'the sealed year',
        description: 'The same caves with the entrances closed. Fresh snow has buried the Snowfield to the horn, the Firn Slope has slid over the Blue Galleries, and the Gamemakers have decided this year to run the Games entirely under the ice. The light still comes down through thirty metres of it. Nothing else does.',
        addLaw: 'noSponsors',
    }],
};
