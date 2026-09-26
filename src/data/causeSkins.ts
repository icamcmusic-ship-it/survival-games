import type { DeathCauseCode } from '../models/types';

/**
 * AUDIT-13 W3: status deaths in the arena's own words.
 *
 * Measured per 112 runs, the most common non-tribute obituaries were all the
 * same five sentences in every arena — "Died of untreated burns" 83, "Succumbed
 * to poison" 45, "Succumbed to an infected wound" 45, "Froze to death" 42,
 * "Bled out from untreated wounds" 41. The injury layer is arena-blind by
 * design, and it should stay that way; the *sentence* need not be. A kiln burn
 * and a glacier frostbite are the same mechanic and different deaths.
 *
 * Three variants per code per arena. The damage site keeps declaring its own
 * code, so none of these strings has to classify: the words are free to say
 * what the arena would say. An arena or a code with no skin falls back on the
 * shared sentence, which is also what procedural arenas get.
 *
 * The pick is a hash of the tribute and the code rather than an rng draw, for
 * two reasons: a status tick fires every cycle and the wound ledger folds
 * identical rows together, so the variant must hold still for one tribute; and
 * a text change must not move the simulation's random stream.
 */
export type SkinnedCode = Extract<DeathCauseCode, 'burns' | 'hypothermia' | 'poison' | 'infection' | 'bleeding'>;

export const CAUSE_SKINS: Record<string, Partial<Record<SkinnedCode, string[]>>> = {
    clockwork: {
        burns: ['Died of the burns the lightning hour left', 'The burns from the strike sector went bad', 'Burned in one sector and died in the next'],
        hypothermia: ['Froze in the rain sector overnight', 'Went cold in the fog hour and stayed cold', 'Chilled through by the wave sector and never warmed'],
        poison: ['Poisoned by the fog hour', 'The blood-rain sector got into them', 'Died of what the jungle sector put in them'],
        infection: ['A jungle-sector cut went bad on the clock', 'A wound festered through six turns of the hands', 'The tidewater got into a wound and stayed'],
        bleeding: ['Bled out while the hands went round', 'Bled out between one sector and the next', 'Bled out waiting for the clock to turn'],
    },
    frozen: {
        burns: ['The fire that saved them left burns that did not', 'Died of burns from too close to the only fire', 'Frost-burns blackened and took them'],
        hypothermia: ['Froze in the lee of the ice caves', 'Went to sleep in the snow and stayed there', 'The Frozen Lake wind took the last of their heat'],
        poison: ['Poisoned by meltwater that was not clean', 'Died of what they ate because nothing else was there', 'The frozen berries were not berries'],
        infection: ['A frostbitten finger went bad and kept going', 'A wound that would not close in the cold', 'Rot set in under the frozen dressing'],
        bleeding: ['Bled out onto the snow', 'Bled out slowly in the cold', 'The snow went red and then they did not get up'],
    },
    concrete: {
        burns: ['Died of burns from the gas-main fire', 'The subway burns went septic-black', 'Burned in the ruins and died in them'],
        hypothermia: ['Froze in a broken tower overnight', 'Went cold in the flooded subway', 'Died of the cold in a building with no windows'],
        poison: ['Poisoned by the water in the subway', 'Died of something in a dead city\'s pantry', 'The rust-water got them'],
        infection: ['A rebar cut went bad', 'A wound from the rubble festered', 'Tetanus from the city, a week late'],
        bleeding: ['Bled out in a stairwell', 'Bled out on the square\'s broken paving', 'Bled out behind a fallen wall'],
    },
    toxic: {
        burns: ['The swamp-acid burns ate down', 'Died of chemical burns from the Murky Waters', 'The bog-fire burns never dried'],
        hypothermia: ['Went cold in the swamp water and stayed cold', 'Froze wet in the Dead Tree Grove', 'The night fog chilled them past waking'],
        poison: ['The swamp got into the blood at last', 'Died of the Murky Waters', 'Poisoned by a swamp that was built to poison'],
        infection: ['A wound went green in the swamp', 'The swamp water rotted a cut from the inside', 'The rot the swamp is made of got in'],
        bleeding: ['Bled out into the black water', 'Bled out among the dead trees', 'Bled out where the swamp could drink it'],
    },
    solar: {
        burns: ['The sunburn blistered and did not stop', 'Died of burns the glare laid on', 'Cooked by a sun that did not set soon enough'],
        hypothermia: ['Froze in the desert night', 'Went cold in the canyon shadow after dark', 'The dunes lost their heat and so did they'],
        poison: ['Stung by something under the sand', 'Died of the cactus water', 'Poisoned at an oasis that was a lie'],
        infection: ['A sand-packed cut festered', 'A wound went bad in the heat', 'The heat turned a scratch into a fever'],
        bleeding: ['Bled out onto the sand', 'Bled out in the canyon shade', 'Bled out and the dunes drank it'],
    },
    ashfall: {
        burns: ['The cinder burns went black and took them', 'Died of burns from the Cinder Fields', 'Scalded by the caldera and never cooled'],
        hypothermia: ['Went cold under the ash cloud', 'Froze in the ash-dark noon', 'Chilled through when the ash blotted the sun'],
        poison: ['The sulphur water poisoned them', 'Died of the basin\'s bad air, days later', 'Poisoned by ash-rotted food'],
        infection: ['An ash-packed wound festered', 'A cut went bad under grey dressings', 'The wound rotted under the ash'],
        bleeding: ['Bled out on the caldera floor', 'Bled out into the ash', 'Bled out in the Ashen Woods'],
    },
    tempest: {
        burns: ['Lightning burns went bad', 'Died of the lighthouse burns', 'The strike burns wept for days and stopped'],
        hypothermia: ['Froze wet on the breakwater', 'The storm took the last warmth out of them', 'Went cold in the Flooded Terraces'],
        poison: ['Drank storm-surge brine and it poisoned them', 'Poisoned by the drowned larder', 'Died of what the flood left in the water'],
        infection: ['A wound that never dried went bad', 'Salt and storm-muck rotted a cut', 'A cut festered in the wet'],
        bleeding: ['Bled out in the rain', 'Bled out on the breakwater stones', 'Bled out and the storm washed it away'],
    },
    saltflats: {
        burns: ['The salt-glare burns cracked and bled', 'Died of burns from the mirror', 'The brine got into the burns and finished it'],
        hypothermia: ['Froze on the flats after sundown', 'The salt pan gave up its heat and so did they', 'Went cold on the Hexagon Flats'],
        poison: ['Poisoned by the Brine Pools', 'Died of the salt they drank', 'The mineral water stopped their heart'],
        infection: ['Salt packed a cut and it festered anyway', 'A salt-sore went bad', 'A wound cracked open in the salt and rotted'],
        bleeding: ['Bled out onto the white', 'Bled out on the mirror', 'Bled out and the salt drank it'],
    },
    sporefields: {
        burns: ['The glowcap burns spread under the skin', 'Died of spore-rash burns', 'The rot-fire burns would not close'],
        hypothermia: ['Went cold in the damp of Rot Hollow', 'Froze in the wet caps overnight', 'The spore-fog chilled them through'],
        poison: ['A cap they should not have eaten', 'Died of spores in the blood', 'The Glowcap Wood poisoned them'],
        infection: ['The mycelium found a wound', 'A cut went white and furred and killed them', 'Rot from Rot Hollow got into a wound'],
        bleeding: ['Bled out into the moss', 'Bled out among the caps', 'Bled out and the mycelium took it'],
    },
    canopy: {
        burns: ['Rope-burns festered in the heat', 'Died of burns from an orchid sap', 'Sap burns across the palms went bad'],
        hypothermia: ['Went cold in the high wet wind', 'Froze on the Great Bough at night', 'The canopy rain chilled them past waking'],
        poison: ['Poisoned by an orchid they tasted', 'Died of a tree frog they should not have touched', 'The canopy fruit was bait'],
        infection: ['A splinter from the bough festered', 'A wound went bad in the wet leaves', 'A bark cut rotted in the heat'],
        bleeding: ['Bled out on a rope bridge', 'Bled out and it rained down through the leaves', 'Bled out in the Orchid Terraces'],
    },
    vault: {
        burns: ['Died of burns from the reactor bay', 'Steam-line burns went bad', 'The chemical burns from hydroponics would not heal'],
        hypothermia: ['Froze in the cold store', 'The air handlers chilled them past waking', 'Went cold in the dark service tunnels'],
        poison: ['Poisoned by the hydroponic feed', 'Died of the recycled water', 'The ration pack had gone over'],
        infection: ['A wound went bad in recycled air', 'A cut festered under strip light', 'An infection the vault\'s filters could not stop'],
        bleeding: ['Bled out on the atrium tiles', 'Bled out in a service tunnel', 'Bled out behind a sealed door'],
    },
    warren: {
        burns: ['Burns from a tunnel fire went bad', 'Died of burns in the close air', 'The burrow-fire burns never closed'],
        hypothermia: ['Froze in a damp side tunnel', 'Went cold in the dark of the Choke', 'The deep tunnels chilled them past waking'],
        poison: ['Poisoned by the Root Gardens', 'Died of bad water seeping through the roof', 'Ate a root that was not food'],
        infection: ['A wound went bad in the earth', 'Soil got into a cut and stayed', 'A tunnel scrape rotted'],
        bleeding: ['Bled out in the dark of a tunnel', 'Bled out in the Hub', 'Bled out where nobody could find them'],
    },
    islands: {
        burns: ['Sunburn on the Long Span went bad', 'Died of burns from a beach fire', 'The glare off the water burned them down'],
        hypothermia: ['Froze in the Fog Shallows', 'Went cold after the swim and stayed cold', 'The sea wind took their heat'],
        poison: ['Poisoned by a reef fish', 'Died of the island\'s only stream', 'The shellfish were off'],
        infection: ['A coral cut festered', 'A wound went bad in the salt damp', 'A sea-cut rotted in the heat'],
        bleeding: ['Bled out on Anchor Isle', 'Bled out into the shallows', 'Bled out on the sand between two islands'],
    },
    eclipse: {
        burns: ['Burns they could not see went bad in the dark', 'Died of foxfire-burns', 'Burns from a fire lit in the long night festered'],
        hypothermia: ['Froze in the endless dusk', 'Went cold under the Redwood Naves', 'The sunless cold took them'],
        poison: ['Ate something they could not see', 'Poisoned at Foxfire Creek', 'Died of a mushroom picked in the dark'],
        infection: ['A wound went bad in the unending dark', 'A cut festered where they could not see it', 'Rot set in under the redwoods'],
        bleeding: ['Bled out in the dark', 'Bled out in the Clearing of Stars', 'Bled out and nobody saw it'],
    },
    reef: {
        burns: ['Sun-scald on the drained basin went bad', 'Died of fire-coral burns', 'The coral burns wept and would not stop'],
        hypothermia: ['Went cold in a tide pool at night', 'Froze on the reef after dark', 'The sea wind across the barrens chilled them through'],
        poison: ['Stung by a stonefish in the shallows', 'Poisoned by an urchin spine', 'Died of the coral itself'],
        infection: ['A coral cut festered', 'Sepsis from the Coral Razors, days late', 'A reef cut rotted in the heat'],
        bleeding: ['Bled out on the Coral Razors', 'Bled out into a tide pool', 'Bled out in the Urchin Barrens'],
    },
    abattoir: {
        burns: ['Scald-tank burns went bad', 'Died of burns from the rendering line', 'The steam burns never closed'],
        hypothermia: ['Froze in the cold store', 'Went cold on the kill floor overnight', 'The chill rooms took them'],
        poison: ['Poisoned by the drain water', 'Died of meat left on the hooks too long', 'The disinfectant was not water'],
        infection: ['A hook cut festered', 'A wound went bad on the kill floor', 'The abattoir\'s filth got into a cut'],
        bleeding: ['Bled out on the kill floor', 'Bled out into the drains', 'Bled out under the hook line'],
    },
    carnival: {
        burns: ['Burns from the fire-eater\'s booth went bad', 'Died of burns from the big top fire', 'The midway fire burns festered'],
        hypothermia: ['Froze under the carousel', 'Went cold in the Big Top overnight', 'Chilled through on the empty midway'],
        poison: ['Poisoned by the candy floss', 'Died of the prize-booth sweets', 'The funhouse water was not clean'],
        infection: ['A cut from a mirror shard festered', 'A wound went bad in a rusted ride', 'The carousel horse\'s splinter rotted'],
        bleeding: ['Bled out on the midway', 'Bled out under the carousel lights', 'Bled out in the Big Top'],
    },
    ashwaste: {
        burns: ['Ember burns went black', 'Died of burns from the Burned Forest', 'The cinder burns took them'],
        hypothermia: ['Froze in the Deep Drifts', 'Went cold under the ash-winter sky', 'Froze in the grey'],
        poison: ['Poisoned by the ash-water', 'Died of what grows in ash', 'The only water left was not water'],
        infection: ['A wound went bad under ash-caked cloth', 'Ash got into a cut and rotted it', 'A burned forest cut festered'],
        bleeding: ['Bled out in the Cinder Ring', 'Bled out into the drifts', 'Bled out and the ash covered it'],
    },
    quarry: {
        burns: ['Blasting burns went bad', 'Died of powder burns', 'The fuse burns never healed'],
        hypothermia: ['Froze on the Upper Benches', 'Went cold in the quarry pit overnight', 'The stone wind chilled them past waking'],
        poison: ['Poisoned by the pit water', 'Died of stone-dust in the water', 'The quarry lake poisoned them'],
        infection: ['A rock cut festered', 'A wound went bad in the grit', 'Stone dust got into a wound and stayed'],
        bleeding: ['Bled out on the Spiral Road', 'Bled out on a bench', 'Bled out against the quarry face'],
    },
    glacier: {
        burns: ['Frost-burns went black and took them', 'Died of burns from their only fire', 'The snow-glare burns went bad'],
        hypothermia: ['Froze in a crevasse lee', 'Went cold in the Blue Galleries', 'Froze on the Firn Slope'],
        poison: ['Poisoned by glacial meltwater', 'Died of rock-flour in the water', 'The ice-cave fungus poisoned them'],
        infection: ['Frostbite went bad and kept going', 'A wound rotted under frozen dressings', 'A crevasse cut festered'],
        bleeding: ['Bled out onto blue ice', 'Bled out in the galleries', 'Bled out on the Snowfield'],
    },
    floe: {
        burns: ['Frost-burns blackened and spread', 'Died of burns from a seal-fat fire', 'The ice-glare burns went bad'],
        hypothermia: ['Froze on the Pack Ice', 'Went cold after the water and never warmed', 'The Pressure Ridges took their heat'],
        poison: ['Poisoned by seal liver', 'Died of meltwater off bad ice', 'The fish were not safe raw'],
        infection: ['A cut from the ice went bad', 'Frostbite rotted and spread', 'A wound festered under wet furs'],
        bleeding: ['Bled out onto the ice', 'Bled out on the Ice Shelf', 'Bled out between two floes'],
    },
    alpine: {
        burns: ['Pine-fire burns went bad', 'Died of burns from their own fire', 'The snow-glare burns cracked and festered'],
        hypothermia: ['Froze in the Scree Chutes', 'Went cold above the treeline', 'Froze under the Old Growth'],
        poison: ['Poisoned by a mountain mushroom', 'Died of tarn water', 'Ate a berry the mountain keeps for fools'],
        infection: ['A scree cut festered', 'A wound went bad in the cold', 'A pine splinter rotted'],
        bleeding: ['Bled out on the scree', 'Bled out in the Treeline Meadow', 'Bled out under the pines'],
    },
    terraces: {
        burns: ['Died of burns from a lamp-oil fire', 'Mine-gas burns went bad', 'The blasting burns never closed'],
        hypothermia: ['Froze on the Upper Steps', 'Went cold in a flooded adit', 'Froze on the terraces overnight'],
        poison: ['Poisoned by the mine runoff', 'Died of heavy-metal water', 'The paddy water poisoned them'],
        infection: ['A cut from old mine iron festered', 'A wound went bad on the Overgrown Steps', 'Rust got into a wound'],
        bleeding: ['Bled out on the Grand Terrace', 'Bled out in a mine mouth', 'Bled out on the steps'],
    },
    seapeaks: {
        burns: ['Wind-burn and sun-burn together took them', 'Died of burns from a driftwood fire', 'The glare off the sea burned them down'],
        hypothermia: ['Froze on the First Peak', 'Went cold in the spray on the Shelf', 'Froze after the Drowned Approach'],
        poison: ['Poisoned by a gull egg', 'Died of seawater', 'The limpets were bad'],
        infection: ['A barnacle cut festered', 'A wound went bad in the salt spray', 'A rock cut rotted'],
        bleeding: ['Bled out on the Shelf', 'Bled out on a ledge above the sea', 'Bled out in the spray'],
    },
    canopyweb: {
        burns: ['Silk-burns across the hands went bad', 'Died of burns from a lamp in the web', 'The rope-burns festered'],
        hypothermia: ['Froze in a moss hammock', 'Went cold on the Needle Bridges', 'The high wind took their heat'],
        poison: ['Poisoned by a web-spider bite', 'Died of the moss-water', 'A canopy fruit was not one'],
        infection: ['A splinter from a needle bridge festered', 'A wound went bad in the damp moss', 'A web-burn rotted'],
        bleeding: ['Bled out in the web', 'Bled out on the Landing', 'Bled out and it rained down through the silk'],
    },
    acousticforest: {
        burns: ['Burns from a fire lit against the noise went bad', 'Died of burns in the Hollow Boughs', 'The burns festered while the trees sang'],
        hypothermia: ['Froze in the Wind Throat', 'Went cold while the forest hummed', 'The whispering night chilled them through'],
        poison: ['Poisoned by a humming berry', 'Died of the stream water', 'The forest fruit was bad'],
        infection: ['A cut from a hollow bough festered', 'A wound went bad while the trees whispered', 'A splinter rotted'],
        bleeding: ['Bled out on the grove floor', 'Bled out in the Hollow Boughs', 'Bled out and the trees repeated it'],
    },
    burnscar: {
        burns: ['The smouldering-root burns went bad', 'Died of burns from the Snag Field', 'Ember burns from the Ash Clearing took them'],
        hypothermia: ['Froze on the Fireweed Slope', 'Went cold in the burned-out night', 'The scar lost its heat and so did they'],
        poison: ['Poisoned by the ash-water', 'Died of fireweed eaten raw', 'The runoff was poison'],
        infection: ['A char-splinter festered', 'A wound went bad in the ash', 'A snag cut rotted'],
        bleeding: ['Bled out among the snags', 'Bled out in the Ash Clearing', 'Bled out on the Fireweed Slope'],
    },
    craterfield: {
        burns: ['White-phosphorus burns went bad', 'Died of old-ordnance burns', 'Blast burns from the Deep Craters took them'],
        hypothermia: ['Froze in a flooded crater', 'Went cold in the Shallow Craters', 'Froze in the motor pool overnight'],
        poison: ['Poisoned by crater water', 'Died of what leaked from the shells', 'The ration tins had turned'],
        infection: ['A shrapnel cut festered', 'A wound went bad in the crater mud', 'Rusted metal got into a wound'],
        bleeding: ['Bled out in a crater', 'Bled out in the Motor Pool', 'Bled out on the crater rim'],
    },
    culdesac: {
        burns: ['Kitchen-fire burns went bad', 'Died of burns from a house that went up', 'The barbecue burns festered'],
        hypothermia: ['Froze in an empty house', 'Went cold on the Loop Road', 'Froze on somebody\'s porch'],
        poison: ['Poisoned by something under a sink', 'Died of the pool water', 'The fridge had been off for days'],
        infection: ['A cut from a broken window festered', 'A wound went bad in a spare room', 'A garden-tool cut rotted'],
        bleeding: ['Bled out on a front lawn', 'Bled out in Number 14', 'Bled out on the Loop Road'],
    },
    labyrinth: {
        burns: ['Burns from a hedge fire went bad', 'Died of nettle-burns', 'The sun on the Outer Ring burned them down'],
        hypothermia: ['Froze in a dead end', 'Went cold in the North Spiral', 'The dew in the hedges chilled them through'],
        poison: ['Poisoned by a hedge berry', 'Died of the fountain water', 'Ate the wrong leaf in the maze'],
        infection: ['A thorn cut festered', 'A hedge scratch went bad', 'A wound rotted in the green damp'],
        bleeding: ['Bled out in a dead end', 'Bled out in Fountain Court', 'Bled out against the hedge'],
    },
    ashgrove: {
        burns: ['Chemistry-lab burns went bad', 'Died of burns from the boiler room', 'Kitchen burns festered'],
        hypothermia: ['Froze in the Gymnasium', 'Went cold in the Main Corridor', 'Froze in a classroom overnight'],
        poison: ['Poisoned from the science store', 'Died of the canteen food', 'Drank from the wrong lab tap'],
        infection: ['A wound from a broken desk festered', 'A cut went bad in the locker room', 'A wound rotted in the Yard'],
        bleeding: ['Bled out in the Main Corridor', 'Bled out on the gym floor', 'Bled out in the Yard'],
    },
    kelvin: {
        burns: ['Cold-burns from the coolant line went black', 'Died of plasma burns from Generator Hall', 'The cryo-burns took them'],
        hypothermia: ['Froze on the Apron', 'Went cold in the Habitation Ring', 'The station let them freeze'],
        poison: ['Poisoned by coolant', 'Died of the recycled water', 'The station air poisoned them'],
        infection: ['A wound went bad in stale air', 'A cut festered under station light', 'A wound rotted in the Habitation Ring'],
        bleeding: ['Bled out in Generator Hall', 'Bled out on the Apron', 'Bled out in a station corridor'],
    },
    silkwood: {
        burns: ['Silk-burns festered', 'Died of burns from a web fire', 'The glue-silk burns went bad'],
        hypothermia: ['Froze in the Sink', 'Went cold in the Low Wood', 'Froze wrapped in silk'],
        poison: ['A spider bite in the Low Wood', 'Died of venom in the Silk Wood', 'Poisoned by a web-drip'],
        infection: ['A bite went bad', 'A wound festered under a silk dressing', 'The Sink got into a wound'],
        bleeding: ['Bled out in the Low Wood', 'Bled out in the Clearing', 'Bled out in the webs'],
    },
    nooneplace: {
        burns: ['Burns from nowhere went bad', 'Died of carpet burns that did not stop', 'The strip-light burns festered'],
        hypothermia: ['Went cold in the Yellow Halls', 'Froze in a room that was not there yesterday', 'The Carpet was damp, and cold, and endless'],
        poison: ['Poisoned by the water in Reception', 'Died of the humming air', 'Drank from the Carpet'],
        infection: ['A wound went bad in the damp carpet', 'A cut festered under the yellow light', 'An infection in a room with no door'],
        bleeding: ['Bled out on the Carpet', 'Bled out in the Yellow Halls', 'Bled out in Reception'],
    },
    redcathedral: {
        burns: ['Sun-burns on the rim went bad', 'Died of burns from the red rock', 'The canyon sun cooked them down'],
        hypothermia: ['Froze on the North Rim', 'Went cold in the Bright Angel Descent', 'The canyon night took them'],
        poison: ['A scorpion in Rim Pinyon', 'Died of the canyon water', 'Poisoned by a desert seed'],
        infection: ['A rock cut festered', 'A wound went bad in the canyon dust', 'A cactus spine rotted'],
        bleeding: ['Bled out on the red rock', 'Bled out on the Descent', 'Bled out under Rim Pinyon'],
    },
    menagerie: {
        burns: ['Died of burns from the reptile house lamps', 'Burns from the Feed Store fire went bad', 'The burns festered in the heat of the enclosures'],
        hypothermia: ['Froze in an empty enclosure', 'Went cold on the Plaza', 'Froze in the penguin house'],
        poison: ['Poisoned by the Feed Store', 'Died of a reptile-house bite', 'The animal feed was not food'],
        infection: ['A claw scratch festered', 'A bite went bad', 'A wound rotted in the enclosures'],
        bleeding: ['Bled out on Big Cat Terrace', 'Bled out in the Plaza', 'Bled out behind the bars'],
    },
    storywood: {
        burns: ['Burns from the witch\'s oven went bad', 'Died of burns from a lantern', 'The hearth burns festered'],
        hypothermia: ['Froze in the Deep Wood', 'Went cold on the Path', 'Froze like the match girl'],
        poison: ['Ate the apple', 'Poisoned in the Deep Wood', 'Died of the gingerbread'],
        infection: ['A thorn from the briar festered', 'A wolf-bite went bad', 'A spindle prick rotted'],
        bleeding: ['Bled out off the Path', 'Bled out in the Clearing', 'Bled out in the Deep Wood'],
    },
    cabin: {
        burns: ['Stove burns went bad', 'Died of burns from the Front Room fire', 'The hearth burns festered'],
        hypothermia: ['Froze in the Dooryard', 'Went cold on the Porch', 'Froze in a house with no wood left'],
        poison: ['Poisoned by the root cellar', 'Died of the well water', 'The preserves had turned'],
        infection: ['An axe cut festered', 'A wound went bad in the cold house', 'A splinter from the woodpile rotted'],
        bleeding: ['Bled out in the Front Room', 'Bled out on the Porch', 'Bled out into the snow by the door'],
    },
    magmatube: {
        burns: ['Cooked by the burns the tube left', 'Died of lava burns from the Outer Gallery', 'The vent burns went black'],
        hypothermia: ['Went cold in a dead tube', 'Froze on the Crater Rim at night', 'The mountain\'s cold side took them'],
        poison: ['Poisoned by the Ash-Choked Stair', 'Died of sulphur water', 'The vent gases poisoned them slowly'],
        infection: ['A glass-rock cut festered', 'A wound went bad in the ash', 'A burn went septic in the tube'],
        bleeding: ['Bled out on the Stair', 'Bled out on the Crater Rim', 'Bled out in the Outer Gallery'],
    },
    karst: {
        burns: ['Lamp burns went bad in the dark', 'Died of burns from a cave fire', 'The acid-drip burns festered'],
        hypothermia: ['Froze in the Drip Gallery', 'Went cold in the underground river', 'Froze on the Sinkhole Floor'],
        poison: ['Poisoned by the Glowmoss', 'Died of cave water', 'Ate something from the Hollow'],
        infection: ['A cave cut festered', 'A wound went bad in the drip', 'A limestone cut rotted'],
        bleeding: ['Bled out in the Drip Gallery', 'Bled out on the Sinkhole Floor', 'Bled out in the dark'],
    },
    tidewrack: {
        burns: ['Sun-burns on the Sandbar went bad', 'Died of jellyfish burns', 'Salt got into the burns'],
        hypothermia: ['Froze in the Ebb Channel', 'Went cold on the flats at low tide', 'The sea wind across the Mussel Flats chilled them through'],
        poison: ['Poisoned by the mussels', 'Died of red-tide shellfish', 'The tide pool water was not safe'],
        infection: ['A shell cut festered', 'A wound went bad in the mud', 'A barnacle cut rotted'],
        bleeding: ['Bled out on the Sandbar', 'Bled out into the ebb', 'Bled out on the Mussel Flats'],
    },
    thresher: {
        burns: ['Coolant burns went bad', 'Died of burns from the intake', 'The belt-friction burns festered'],
        hypothermia: ['Went cold in the Coolant Race', 'Froze on the Sorting Floor overnight', 'The coolant took their heat'],
        poison: ['Poisoned by coolant', 'Died of the race water', 'The grease got into them'],
        infection: ['A cut from the chutes festered', 'A wound went bad in machine grease', 'A blade-scrape rotted'],
        bleeding: ['Bled out on the Sorting Floor', 'Bled out in an Intake Chute', 'Bled out beside the Race'],
    },
    vigil: {
        burns: ['Watchfire burns went bad', 'Died of burns from the Watchfires', 'The candle burns festered'],
        hypothermia: ['Froze on the Parade Ground', 'Went cold in Sentry Wood', 'Froze on watch'],
        poison: ['Poisoned by the vigil wine', 'Died of the parade-ground water', 'The rations poisoned them'],
        infection: ['A wound went bad on watch', 'A cut festered in Sentry Wood', 'A wound rotted by the fires'],
        bleeding: ['Bled out on the Parade Ground', 'Bled out by the Watchfires', 'Bled out in Sentry Wood'],
    },
    saltworks: {
        burns: ['Brine-burns went bad', 'Died of salt-glare burns', 'The pan burns cracked and festered'],
        hypothermia: ['Froze on the Central Pan overnight', 'Went cold in an evaporation pan', 'The salt night took them'],
        poison: ['Poisoned by the brine', 'Died of the salt they drank', 'The pan water poisoned them'],
        infection: ['A salt-crack wound festered', 'A cut went bad in the pans', 'A salt-sore rotted'],
        bleeding: ['Bled out on the Central Pan', 'Bled out in Evaporation Pan One', 'Bled out onto the salt'],
    },
    kiln: {
        burns: ['The kiln-burns went black and took them', 'Died of burns from the Firing Floor', 'Burns from Chimney Ridge festered'],
        hypothermia: ['Went cold when the kiln went out', 'Froze in the Bisque Yard at night', 'Chilled through between firings'],
        poison: ['Poisoned by glaze', 'Died of the kiln fumes, slowly', 'Drank the slip water'],
        infection: ['A shard cut festered', 'A wound went bad in the clay dust', 'A pottery cut rotted'],
        bleeding: ['Bled out on the Firing Floor', 'Bled out in the Bisque Yard', 'Bled out among broken pots'],
    },
    gallery: {
        burns: ['Stage-light burns went bad', 'Died of burns from the Main Stage fire', 'The limelight burns festered'],
        hypothermia: ['Froze in the Box Seats overnight', 'Went cold in the empty Stalls', 'The dark theatre took their heat'],
        poison: ['Poisoned by the green-room bar', 'Died of the stage paint', 'The props-room water was not clean'],
        infection: ['A splinter from the boards festered', 'A wound went bad in the wings', 'A cut rotted under the stage'],
        bleeding: ['Bled out on the Main Stage', 'Bled out in the Stalls', 'Bled out in a Box Seat with nobody watching'],
    },
    malthouse: {
        burns: ['Kiln-floor burns went bad', 'Died of scalds from the Mash Tun Hall', 'The steam burns festered'],
        hypothermia: ['Went cold in the Grain Silos', 'Froze on the damp Fermentation Floor', 'The cellar chill took them'],
        poison: ['Poisoned by the green mash', 'Died of spoiled grain', 'The ferment got into them'],
        infection: ['A wound went bad in the malt damp', 'A cut festered on the wet floor', 'Grain rot got into a wound'],
        bleeding: ['Bled out on the Fermentation Floor', 'Bled out in the Mash Tun Hall', 'Bled out among the silos'],
    },
    circuit: {
        burns: ['Fuel-fire burns went bad', 'Died of burns from a burning wreck', 'The exhaust burns festered'],
        hypothermia: ['Froze in the pit garages', 'Went cold on Turn One overnight', 'The empty grandstand took their heat'],
        poison: ['Poisoned by fuel in the water', 'Died of the pit-lane coolant', 'Drank from a drum they should not have'],
        infection: ['A cut from a crash barrier festered', 'A wound went bad in the pit lane', 'A carbon-shard cut rotted'],
        bleeding: ['Bled out on the Start/Finish Straight', 'Bled out on Turn Two', 'Bled out behind the barrier'],
    },
    wardblock: {
        burns: ['Burns from a mattress fire went bad', 'Died of burns in Cell Block A', 'The laundry-press burns festered'],
        hypothermia: ['Froze in solitary', 'Went cold in Cell Block B', 'The Yard at night took their heat'],
        poison: ['Poisoned by the infirmary stores', 'Died of the canteen food', 'The cell-block water was bad'],
        infection: ['A shiv cut festered', 'A wound went bad in a cell', 'A wound rotted with nobody to look at it'],
        bleeding: ['Bled out in the Yard', 'Bled out in a cell', 'Bled out on the landing'],
    },
    glasshouse: {
        burns: ['Burns under the glass went bad', 'Died of sun-burns in the Desert Wing', 'The focused-light burns festered'],
        hypothermia: ['Went cold when the heating failed', 'Froze in the Palm Court at night', 'The glass lost its heat and so did they'],
        poison: ['Poisoned by a Tropical Wing plant', 'Died of the irrigation water', 'Ate a fruit that was labelled'],
        infection: ['A glass cut festered', 'A wound went bad in the Tropical Wing heat', 'A thorn from the Desert Wing rotted'],
        bleeding: ['Bled out in the Palm Court', 'Bled out among broken panes', 'Bled out in the Tropical Wing'],
    },
    hippodrome: {
        burns: ['Burns from a sparking ride went bad', 'Died of burns at the Ferris Wheel', 'The generator burns festered'],
        hypothermia: ['Froze at the top of the Ferris Wheel', 'Went cold on the Midway', 'The empty fairground took their heat'],
        poison: ['Poisoned by fairground sweets', 'Died of a stall drink', 'The hot-dog stand had been off for days'],
        infection: ['A cut from the Hall of Mirrors festered', 'A wound went bad on a rusted ride', 'A splinter rotted'],
        bleeding: ['Bled out on the Midway', 'Bled out in the Hall of Mirrors', 'Bled out under the Ferris Wheel'],
    },
    undercroft: {
        burns: ['Third-rail burns went bad', 'Died of burns in a track tunnel', 'The arc burns festered'],
        hypothermia: ['Froze on the Central Platform', 'Went cold in Track Tunnel North', 'The tunnel draught took their heat'],
        poison: ['Poisoned by tunnel seepage', 'Died of the drain water', 'The vending-machine food had turned'],
        infection: ['A wound went bad in the tunnel filth', 'A rat bite festered', 'A cut rotted in the damp'],
        bleeding: ['Bled out on the Central Platform', 'Bled out between the rails', 'Bled out in Track Tunnel South'],
    },
    vintage: {
        burns: ['Burns from a vine fire went bad', 'Died of burns at the Crush Pad', 'The smudge-pot burns festered'],
        hypothermia: ['Froze on Terrace Row One', 'Went cold in the barrel cellar', 'The frost night on the vines took them'],
        poison: ['Poisoned by spray on the grapes', 'Died of the must', 'The cellar wine had turned'],
        infection: ['A pruning-knife cut festered', 'A wound went bad among the vines', 'A barrel splinter rotted'],
        bleeding: ['Bled out on the Crush Pad', 'Bled out between the rows', 'Bled out on Terrace Row Two'],
    },
    cinderpeak: {
        burns: ['Vent burns went bad', 'Died of burns under the Great Dome', 'The sulphur burns festered'],
        hypothermia: ['Froze on the Observation Deck', 'Went cold at the Cable Car Station', 'The summit night took them'],
        poison: ['Poisoned by the summit water', 'Died of the vent gases, slowly', 'The emergency rations had turned'],
        infection: ['An ice cut festered', 'A wound went bad in the cold', 'A glass cut rotted'],
        bleeding: ['Bled out on the Observation Deck', 'Bled out in the Great Dome', 'Bled out at the Cable Car Station'],
    },
    opencut: {
        burns: ['Blasting burns went bad', 'Died of burns on the Pit Floor', 'The fuse burns festered'],
        hypothermia: ['Froze on Terrace Level Two', 'Went cold in the pit overnight', 'The haul road wind took their heat'],
        poison: ['Poisoned by the pit lake', 'Died of tailings water', 'The runoff was poison'],
        infection: ['A rock cut festered', 'A wound went bad in the dust', 'A cut rotted in the grit'],
        bleeding: ['Bled out on the Pit Floor', 'Bled out on Terrace Level One', 'Bled out on the haul road'],
    },
};

function hash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}

/**
 * The arena's version of a status death, or `fallback` when it has none. Stable
 * for one tribute and one code (see the header for why that matters).
 */
export function skinCause(arenaId: string | undefined, code: DeathCauseCode | undefined, key: string, fallback: string): string {
    if (!arenaId || !code) return fallback;
    const pool = CAUSE_SKINS[arenaId]?.[code as SkinnedCode];
    if (!pool || pool.length === 0) return fallback;
    return pool[hash(`${key}:${code}`) % pool.length];
}
