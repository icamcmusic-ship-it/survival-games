import type { ArenaEventDef } from './arenaFlavor';

/**
 * §5.2 (audit): the procedural arenas' own voice.
 *
 * The twelve-biome "infinite arena" promise was backed by 32 tag-matched
 * event texts, of which a generated arena received eight — none with an id,
 * none once-per-run, none chained, none gated on state. A generated run was
 * ~83% shared universal content by count. Hand-authored arenas carry three
 * once-per-run beats, an event chain and reactive events each; this file
 * gives every biome the same: eight authored events, at least two of them
 * once-per-run, one two-part chain, and gates on time, weather, stance or
 * trait — so a boreal run differs from the last boreal run and from a
 * tundra run, and `validate-arenas` can hold the line.
 *
 * Text placeholders are the same as everywhere else: `{tribute}`, `{zone}`.
 */
export const PROCEDURAL_BIOME_EVENTS: Record<string, ArenaEventDef[]> = {
    rainforest: [
        {
            id: 'proc-rainforest-fever', oncePerRun: true, weight: 0.5,
            text: 'The fever that has been walking the arena finds {tribute} in {zone}: a night of sweats, a morning of not knowing which way the river runs.',
            escapeText: '{tribute} boils every mouthful in {zone} for two days running and the fever, whatever it was, passes them by.',
            cause: 'Died of jungle fever', dodgeStat: 'endurance', dodgeAlt: 'strength', dodgeDifficulty: 7, damage: 22, infected: true, sanity: 12, fatigue: 18,
            terrains: ['forest', 'wetland', 'water'],
        },
        {
            id: 'proc-rainforest-canopy-fall', oncePerRun: true,
            text: 'The kapok that {tribute} has been sleeping under in {zone} has been dying since before the Games. It chooses tonight.',
            escapeText: 'A crack overhead in {zone} sends {tribute} rolling before the crown comes down where their head was.',
            cause: 'Crushed by a falling giant', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 46, bleeding: true, requires: { time: 'night' }, terrains: ['forest'], witnesses: true, zoneWide: true,
        },
        {
            id: 'proc-rainforest-ants-trail', chain: 'proc-rainforest-ants-swarm',
            text: 'A line of army ants crosses {zone} a hand wide and a hundred metres long, and {tribute} steps over it without thinking about where it is going.',
            escapeText: '{tribute} sees the ant column in {zone} and goes the long way around whatever it is heading for.',
            cause: 'Overrun by army ants', dodgeStat: 'intelligence', dodgeAlt: 'willpower', sanity: 4, terrains: ['forest', 'wetland', 'open'],
        },
        {
            id: 'proc-rainforest-ants-swarm', oncePerRun: true, weight: 0.2,
            text: 'The ants have found {tribute}\'s camp in {zone}, and the ants have found {tribute}. There is no fighting a column; there is only running, and they are slower than it.',
            escapeText: '{tribute} abandons everything in {zone} to the column and is stung a hundred times getting clear of it, which is a hundred fewer than staying.',
            cause: 'Overrun by army ants', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 7, damage: 30, infected: true, fatigue: 20, terrains: ['forest', 'wetland', 'open'],
        },
        {
            text: 'The vines in {zone} drip when it rains and {tribute}, dry-mouthed, drinks from the wrong one.',
            escapeText: '{tribute} tastes the vine-water in {zone}, spits, and finds one that runs clear.',
            cause: 'Poisoned by a drinking vine', dodgeStat: 'intelligence', dodgeAlt: 'willpower', poisoned: true, damage: 10, terrains: ['forest'], requires: { storm: true },
        },
        {
            text: 'A caiman that has been the same log for three days is not a log. {tribute} is at the edge of the water in {zone}.',
            escapeText: '{tribute} sees the log in {zone} blink and is already three steps up the bank when it moves.',
            cause: 'Taken by a caiman', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 34, bleeding: true, terrains: ['water', 'wetland'],
        },
        {
            text: 'The rain in {zone} has not stopped in a day and a half and {tribute}\'s feet have gone white and soft inside their boots.',
            escapeText: '{tribute} gets their boots off in {zone} and their feet up, and the rot that was starting does not get its chance.',
            cause: 'Died of trench-foot infection', dodgeStat: 'intelligence', dodgeAlt: 'willpower', infected: true, fatigue: 12, requires: { storm: true }, terrains: ['wetland', 'forest', 'water'],
        },
        {
            text: 'A howler troop screams at {tribute} from every side of {zone} at once, and something in them that has been holding on lets go.',
            escapeText: '{tribute} screams back at the howlers in {zone}, which is not dignified and is the right answer.',
            cause: 'Lost to the canopy', dodgeStat: 'willpower', dodgeAlt: 'endurance', sanity: 24, requires: { sanityBand: 'frayed' }, terrains: ['forest'],
        },
    ],
    volcanic: [
        {
            id: 'proc-volcanic-eruption', oncePerRun: true, weight: 0.4,
            text: 'The mountain that the whole arena is built on clears its throat. Ash comes down on {zone} in a sheet, and {tribute} breathes it before they can cover their face.',
            escapeText: '{tribute} gets a wet cloth over their mouth in {zone} before the ashfall lands, and waits it out in the dark.',
            cause: 'Choked on an eruption', dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7, damage: 28, burned: true, fatigue: 15, zoneWide: true, witnesses: true, startsZoneEffect: 'burning', terrains: ['open', 'highland', 'forest'],
        },
        {
            id: 'proc-volcanic-crust', oncePerRun: true,
            text: 'The ground in {zone} is a crust over something that has not cooled. {tribute} finds the thin place.',
            escapeText: '{tribute} feels the heat through their soles in {zone} and backs off the crust the way they came.',
            cause: 'Went through the crust', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 7, damage: 50, burned: true, terrains: ['open', 'cave'],
        },
        {
            id: 'proc-volcanic-tremor', chain: 'proc-volcanic-tube-collapse',
            text: 'A tremor runs through {zone} that {tribute} feels in their teeth. Dust sifts down from somewhere above.',
            escapeText: '{tribute} counts the tremor in {zone} — long, and deep — and decides not to be underground tomorrow.',
            cause: 'Buried in a lava tube', dodgeStat: 'intelligence', dodgeAlt: 'willpower', sanity: 5, special: 'startsQuaking', terrains: ['cave', 'ruins', 'highland'],
        },
        {
            id: 'proc-volcanic-tube-collapse', oncePerRun: true, weight: 0.2,
            text: 'The second tremor brings the roof of {zone} down. {tribute} is under it.',
            escapeText: '{tribute} is at the mouth of {zone} when the roof goes and is thrown clear by the air the collapse pushes out.',
            cause: 'Buried in a lava tube', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 8, damage: 60, special: 'collapse', terrains: ['cave', 'ruins'],
        },
        {
            text: 'A vent in {zone} opens without warning and the steam that comes out of it has been under pressure for a century.',
            escapeText: '{tribute} hears the vent in {zone} hiss before it blows and gets a rock between themselves and it.',
            cause: 'Scalded by a steam vent', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 26, burned: true, terrains: ['water', 'wetland', 'cave'],
        },
        {
            text: 'The gas that pools in the low ground of {zone} has no smell. {tribute} sits down to rest in it.',
            escapeText: '{tribute} notices the birds are all dead in {zone} and does not sit down.',
            cause: 'Suffocated in a gas pocket', dodgeStat: 'intelligence', dodgeAlt: 'willpower', damage: 32, sanity: 8, requires: { time: 'night' }, terrains: ['wetland', 'cave', 'open'],
        },
        {
            text: 'Someone lit a fire in {zone} on ground that was already warm. {tribute} is fortified there when the ground under the fire pit gives.',
            escapeText: '{tribute} feels the fire pit in {zone} sink an inch and kicks it apart before the crust goes with it.',
            cause: 'Went through the crust', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 36, burned: true, requires: { stance: ['Fortified'] }, terrains: ['open', 'highland'],
        },
        {
            text: 'The glass barrens of {zone} cut through boot leather. {tribute}, moving fast, goes over.',
            escapeText: '{tribute} picks their way across the glass of {zone} one placed step at a time.',
            cause: 'Bled out on the glass', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 16, bleeding: true, requires: { stance: ['Hunting', 'Aggressive'] }, terrains: ['open'],
        },
    ],
    archipelago: [
        {
            id: 'proc-archipelago-king-tide', oncePerRun: true, weight: 0.4,
            text: 'The tide the Gamemakers have been saving arrives at {zone} in one green wall, and {tribute} is between it and the rocks.',
            escapeText: '{tribute} sees the horizon lift beyond {zone} and is on the highest thing in reach when the tide comes through.',
            cause: 'Drowned in the king tide', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 7, damage: 44, zoneWide: true, witnesses: true, startsZoneEffect: 'flooded', terrains: ['water', 'wetland', 'open'],
        },
        {
            id: 'proc-archipelago-rope', oncePerRun: true,
            text: 'The rope span out of {zone} was strung by somebody who expected the Games to be shorter. It lets go with {tribute} halfway.',
            escapeText: 'The span out of {zone} sags under {tribute} and they go hand over hand back the way they came before it drops.',
            cause: 'Fell from a rope span', dodgeStat: 'strength', dodgeAlt: 'agility', damage: 40, bleeding: true, severesRoute: true, terrains: ['highland', 'water'],
        },
        {
            id: 'proc-archipelago-fog-bank', chain: 'proc-archipelago-lost-at-sea',
            text: 'A fog bank rolls over {zone} and the far shore, which {tribute} could see a minute ago, is simply not there.',
            escapeText: '{tribute} sits down in {zone} and waits the fog out rather than trusting a direction they cannot check.',
            cause: 'Lost at sea', dodgeStat: 'intelligence', dodgeAlt: 'willpower', sanity: 6, startsZoneEffect: 'fogbound', terrains: ['water', 'open', 'wetland'],
        },
        {
            id: 'proc-archipelago-lost-at-sea', oncePerRun: true, weight: 0.2,
            text: '{tribute} set out across the water from {zone} in the fog, and the water is wider than it was, and there is no shore in any direction they try.',
            escapeText: '{tribute} follows the sound of surf out of the fog beyond {zone} and comes ashore on the wrong island, alive.',
            cause: 'Lost at sea', dodgeStat: 'endurance', dodgeAlt: 'strength', dodgeDifficulty: 8, damage: 48, fatigue: 30, terrains: ['water'],
        },
        {
            text: 'The shellfish on the rocks of {zone} are free and plentiful and, this month, poisonous.',
            escapeText: '{tribute} notices the gulls are not touching the shellfish in {zone} and leaves them too.',
            cause: 'Poisoned by shellfish', dodgeStat: 'intelligence', dodgeAlt: 'willpower', poisoned: true, damage: 14, feed: 8, terrains: ['water', 'wetland'],
        },
        {
            text: 'A squall hits {zone} with no build-up at all and {tribute}, on the rock, has nothing to hold.',
            escapeText: '{tribute} gets flat on the rock in {zone} and lets the squall go over.',
            cause: 'Blown from the rocks', dodgeStat: 'strength', dodgeAlt: 'agility', damage: 30, requires: { storm: true }, terrains: ['highland', 'open'],
        },
        {
            text: 'The current between {zone} and the next island is faster at night than it was by day. {tribute}, crossing in the dark, finds out.',
            escapeText: '{tribute} feels the night current in {zone} take hold and swims for the island they left rather than the one they wanted.',
            cause: 'Drowned in a night current', dodgeStat: 'strength', dodgeAlt: 'endurance', damage: 36, requires: { time: 'night' }, terrains: ['water'],
        },
        {
            text: 'Somebody watching {tribute} from the next island across from {zone} has a better arm than they thought, and a heavier stone.',
            escapeText: 'A stone comes out of nowhere at {tribute} in {zone} and cracks the rock beside their head. They are off the shore before the second one.',
            cause: 'Killed by a thrown stone', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 18, requires: { minSurvivors: 6 }, terrains: ['water', 'open'],
        },
    ],
    highlands: [
        {
            id: 'proc-highlands-whiteout', oncePerRun: true, weight: 0.4,
            text: 'The whiteout comes over the ridge at {zone} and the world is a metre wide. {tribute} takes one step it cannot afford.',
            escapeText: '{tribute} stops dead when the whiteout takes {zone} and does not move again until it lifts.',
            cause: 'Walked off the ridge in a whiteout', dodgeStat: 'willpower', dodgeAlt: 'endurance', dodgeDifficulty: 7, damage: 52, requires: { storm: true }, zoneWide: true, terrains: ['highland', 'ice', 'open'],
        },
        {
            id: 'proc-highlands-cornice', oncePerRun: true,
            text: 'The snow lip at the edge of {zone} has nothing under it. {tribute} walks out onto the view.',
            escapeText: '{tribute} prods the snow at the edge of {zone} with a stick before they trust it, and the stick goes through into air.',
            cause: 'Fell through a cornice', dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7, damage: 58, terrains: ['highland', 'ice'],
        },
        {
            id: 'proc-highlands-rumble', chain: 'proc-highlands-avalanche',
            text: 'Something high above {zone} shifts with a sound like a door closing in another room. Snow sifts off the face.',
            escapeText: '{tribute} hears the slope above {zone} settle and moves camp to the far side of the valley by dark.',
            cause: 'Buried by an avalanche', dodgeStat: 'intelligence', dodgeAlt: 'willpower', sanity: 4, terrains: ['highland', 'ice'],
        },
        {
            id: 'proc-highlands-avalanche', oncePerRun: true, weight: 0.2,
            text: 'The face above {zone} lets go. {tribute} has three seconds to be somewhere else and is not.',
            escapeText: '{tribute} is at the edge of the runout when the face above {zone} lets go, and the snow stops a body-length short.',
            cause: 'Buried by an avalanche', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 8, damage: 64, zoneWide: true, witnesses: true, terrains: ['highland', 'ice'],
        },
        {
            text: 'The thin air on {zone} has been working on {tribute} for a day and now the headache has a heartbeat.',
            escapeText: '{tribute} drops a few hundred feet from {zone} to sleep and the headache lets go by morning.',
            cause: 'Died of altitude sickness', dodgeStat: 'endurance', dodgeAlt: 'strength', damage: 18, sanity: 10, fatigue: 16, terrains: ['highland'],
        },
        {
            text: 'A goat path across {zone} is a goat path. {tribute}, carrying a pack, is not a goat.',
            escapeText: '{tribute} takes the pack off in {zone} and hauls it across the bad step after them on a line.',
            cause: 'Fell from a goat path', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 34, bleeding: true, terrains: ['highland'],
        },
        {
            text: 'The night on {zone} is colder than any night has a right to be and {tribute} does not have enough on.',
            escapeText: '{tribute} digs into the lee of a boulder in {zone} and shivers till dawn, which is a way of staying alive.',
            cause: 'Froze on the high ground', dodgeStat: 'endurance', dodgeAlt: 'strength', damage: 20, frostbitten: true, requires: { time: 'night' }, terrains: ['highland', 'ice', 'open'],
        },
        {
            text: 'A raptor the size of a door takes a run at {tribute} on the open crown of {zone}, and it has done this to something before.',
            escapeText: '{tribute} throws their pack up as the raptor stoops over {zone} and it takes the pack instead.',
            cause: 'Taken by a mountain raptor', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 28, bleeding: true, requires: { time: 'day' }, terrains: ['highland', 'open'],
        },
    ],
    tundra: [
        {
            id: 'proc-tundra-thaw', oncePerRun: true, weight: 0.4,
            text: 'A warm day, the only one the Games will get, and the lake under {zone} that was a floor is a lid. {tribute} is on it.',
            escapeText: '{tribute} hears the ice of {zone} talking under them on the warm day and gets to the shore on their belly.',
            cause: 'Went through the thawing ice', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 7, damage: 46, frostbitten: true, requires: { time: 'day' }, terrains: ['ice', 'water'],
        },
        {
            id: 'proc-tundra-blizzard', oncePerRun: true, weight: 0.5,
            text: 'The blizzard the sky has been promising arrives at {zone} and does not leave. {tribute} cannot see their own hands for a day.',
            escapeText: '{tribute} builds a wall of snow around themselves in {zone} before the blizzard lands, and the blizzard goes over it.',
            cause: 'Froze in the blizzard', dodgeStat: 'endurance', dodgeAlt: 'strength', dodgeDifficulty: 7, damage: 30, frostbitten: true, fatigue: 25, zoneWide: true, startsZoneEffect: 'frozen', requires: { storm: true }, terrains: ['open', 'ice', 'highland'],
        },
        {
            id: 'proc-tundra-tracks', chain: 'proc-tundra-bear',
            text: 'There are tracks in the fresh snow of {zone} that {tribute} has to put both feet inside to fill. They are new.',
            escapeText: '{tribute} reads the tracks in {zone} for direction and goes the other way, fast, for a day.',
            cause: 'Killed by a white bear', dodgeStat: 'intelligence', dodgeAlt: 'willpower', sanity: 6, terrains: ['open', 'ice', 'forest'],
        },
        {
            id: 'proc-tundra-bear', oncePerRun: true, weight: 0.2,
            text: 'The thing that made the tracks has been following {tribute} since {zone}, upwind, at a walk. It is done walking.',
            escapeText: '{tribute} makes themselves large and loud in {zone} and the bear, which has eaten this week, decides it can wait.',
            cause: 'Killed by a white bear', dodgeStat: 'willpower', dodgeAlt: 'strength', dodgeDifficulty: 8, damage: 62, bleeding: true, terrains: ['open', 'ice', 'forest'],
        },
        {
            text: 'The wind on {zone} finds the gap between {tribute}\'s collar and their neck and works at it for an hour.',
            escapeText: '{tribute} stuffs their collar with moss in {zone} and the wind finds somebody else.',
            cause: 'Died of exposure on the flats', dodgeStat: 'endurance', dodgeAlt: 'strength', damage: 16, frostbitten: true, fatigue: 10, terrains: ['open', 'ice'],
        },
        {
            text: 'The snow in {zone} looks like ground and is a drift with nothing under it. {tribute} goes in to the chest.',
            escapeText: '{tribute} tests the drift in {zone} with a heel before each step and finds the hollow before it finds them.',
            cause: 'Smothered in a snow drift', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 24, fatigue: 22, terrains: ['open', 'ice', 'forest'],
        },
        {
            text: '{tribute} has been staring at white for so long in {zone} that the white has started to move.',
            escapeText: '{tribute} smears charcoal under their eyes in {zone} and the glare, and the shapes in it, back off.',
            cause: 'Wandered off snow-blind', dodgeStat: 'intelligence', dodgeAlt: 'willpower', sanity: 18, damage: 8, requires: { time: 'day' }, terrains: ['open', 'ice'],
        },
        {
            text: 'A hidden tribute in {zone} has been still so long the cold has got into the stillness. {tribute} cannot feel their feet, and then cannot stand.',
            escapeText: '{tribute} breaks cover in {zone} to stamp the blood back into their feet, and takes the risk of being seen over the certainty of losing them.',
            cause: 'Froze in hiding', dodgeStat: 'endurance', dodgeAlt: 'strength', damage: 22, frostbitten: true, requires: { stance: ['Evasive', 'Shadowing'] }, terrains: ['open', 'ice', 'forest', 'highland'],
        },
    ],
    dunes: [
        {
            id: 'proc-dunes-haboob', oncePerRun: true, weight: 0.4,
            text: 'A wall of sand a mile high walks across the arena and over {zone}. {tribute} is in the open when it arrives.',
            escapeText: '{tribute} gets their back to a dune face in {zone} with a cloth over their mouth and lets the wall go by.',
            cause: 'Buried by the sandstorm', dodgeStat: 'endurance', dodgeAlt: 'strength', dodgeDifficulty: 7, damage: 34, fatigue: 24, thirst: 15, zoneWide: true, witnesses: true, startsZoneEffect: 'fogbound', terrains: ['desert', 'open'],
        },
        {
            id: 'proc-dunes-well', oncePerRun: true,
            text: 'The old well in {zone} has water in it, ten metres down, and a rope that has been in the sun for forty years.',
            escapeText: '{tribute} lowers their canteen into the well in {zone} on their own line instead of trusting the rope that is there.',
            cause: 'Fell down a dry well', dodgeStat: 'intelligence', dodgeAlt: 'willpower', damage: 44, bleeding: true, quench: 20, terrains: ['desert', 'ruins', 'open'],
        },
        {
            id: 'proc-dunes-mirage', chain: 'proc-dunes-walked-out',
            text: 'There is water on the horizon beyond {zone}. {tribute} knows what a mirage is and walks toward it anyway.',
            escapeText: '{tribute} looks at the water beyond {zone} for a long minute and turns their back on it.',
            cause: 'Walked into the deep desert', dodgeStat: 'willpower', dodgeAlt: 'endurance', thirst: 8, sanity: 5, terrains: ['desert', 'open'],
        },
        {
            id: 'proc-dunes-walked-out', oncePerRun: true, weight: 0.2,
            text: '{tribute} walked out of {zone} after the water and the water walked with them, and now there is no {zone} behind them either.',
            escapeText: '{tribute} sits down where they are past {zone} and waits for the stars, and the stars bring them back.',
            cause: 'Walked into the deep desert', dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 8, damage: 40, thirst: 30, fatigue: 25, terrains: ['desert', 'open'],
        },
        {
            text: 'The sand of {zone} at noon is hot enough to cook on, and {tribute} has a hole in one boot.',
            escapeText: '{tribute} binds the boot in {zone} with a strip of shirt and keeps to the shadow side of the dunes.',
            cause: 'Died of heatstroke', dodgeStat: 'endurance', dodgeAlt: 'strength', damage: 18, burned: true, thirst: 12, requires: { time: 'day' }, terrains: ['desert', 'open'],
        },
        {
            text: 'The scorpion in {zone} was under the rock {tribute} moved to sit in the shade.',
            escapeText: '{tribute} turns the rock in {zone} over with a stick first, which is what the stick is for.',
            cause: 'Stung by a desert scorpion', dodgeStat: 'agility', dodgeAlt: 'endurance', poisoned: true, damage: 12, terrains: ['desert', 'open', 'ruins'],
        },
        {
            text: 'The dune {tribute} is climbing in {zone} is a slip-face, and slip-faces slip. It takes them down with it and keeps going.',
            escapeText: '{tribute} feels the sand start to run in {zone} and throws themselves sideways off the face.',
            cause: 'Buried by a dune collapse', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 28, fatigue: 18, terrains: ['desert'],
        },
        {
            text: 'The cold in the desert night over {zone} is a different animal from the day, and {tribute} dressed for the day.',
            escapeText: '{tribute} digs into the still-warm sand of {zone} and sleeps buried to the neck.',
            cause: 'Froze in the desert night', dodgeStat: 'endurance', dodgeAlt: 'strength', damage: 16, fatigue: 14, requires: { time: 'night' }, terrains: ['desert', 'open'],
        },
    ],
    bayou: [
        {
            id: 'proc-bayou-gator-hole', oncePerRun: true, weight: 0.5,
            text: 'The deep pool in {zone} is where the big one lives, and the big one has not eaten since the Games began. {tribute} is at the edge of it.',
            escapeText: 'The water in {zone} bulges, and {tribute} is up a cypress with their heart going before they know why.',
            cause: 'Taken by the old alligator', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 7, damage: 52, bleeding: true, terrains: ['water', 'wetland'],
        },
        {
            id: 'proc-bayou-bad-air', oncePerRun: true,
            text: 'The mist that lies on {zone} after dark comes off something rotting, and {tribute} sleeps in it.',
            escapeText: '{tribute} smells the mist in {zone} and moves camp to the high side of the hummock before dark.',
            cause: 'Died of the bayou fever', dodgeStat: 'intelligence', dodgeAlt: 'willpower', infected: true, damage: 18, sanity: 10, requires: { time: 'night' }, terrains: ['wetland', 'water', 'forest'],
        },
        {
            id: 'proc-bayou-lights', chain: 'proc-bayou-followed-lights',
            text: 'There are lights out on the water beyond {zone}, at head height, moving. {tribute} watches them for a long time.',
            escapeText: '{tribute} sees the lights beyond {zone}, says out loud that they are gas, and goes to sleep.',
            cause: 'Followed the lights', dodgeStat: 'willpower', dodgeAlt: 'endurance', sanity: 8, requires: { time: 'night' }, terrains: ['wetland', 'water'],
        },
        {
            id: 'proc-bayou-followed-lights', oncePerRun: true, weight: 0.2,
            text: '{tribute} went out after the lights from {zone} in the night, and the lights went out over deep water, and the water was deeper than the lights.',
            escapeText: '{tribute} is waist-deep beyond {zone} following the lights when a root takes their ankle, and the fall is what saves them.',
            cause: 'Followed the lights', dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 8, damage: 44, sanity: 20, terrains: ['wetland', 'water'],
        },
        {
            text: 'The leeches in {zone} are not the problem. The one {tribute} does not find for two days is.',
            escapeText: '{tribute} strips and checks every inch in {zone} at dusk, which is how you live here.',
            cause: 'Bled out to leeches', dodgeStat: 'intelligence', dodgeAlt: 'willpower', bleeding: true, damage: 10, infected: true, terrains: ['wetland', 'water'],
        },
        {
            text: 'A cottonmouth on the log {tribute} is using to cross {zone} opens its mouth at them, and the white is the last warning it gives.',
            escapeText: '{tribute} sees the white mouth on the log in {zone} and goes into the water instead, which is the lesser bite.',
            cause: 'Bitten by a cottonmouth', dodgeStat: 'agility', dodgeAlt: 'endurance', poisoned: true, damage: 16, terrains: ['wetland', 'water', 'forest'],
        },
        {
            text: 'The quick-mud in {zone} takes {tribute} to the waist, and every move to get out puts them in deeper.',
            escapeText: '{tribute} lies flat on the mud in {zone} and swims it, which is the only thing that works.',
            cause: 'Drowned in quick-mud', dodgeStat: 'intelligence', dodgeAlt: 'strength', damage: 32, fatigue: 24, terrains: ['wetland'],
        },
        {
            text: 'Something in the water of {zone} is singing, and the song is the one {tribute}\'s mother used to sing, and {tribute} is walking into the water.',
            escapeText: '{tribute} hears the song from the water in {zone} and puts mud in their ears.',
            cause: 'Lost to the singing water', dodgeStat: 'willpower', dodgeAlt: 'endurance', sanity: 26, damage: 10, requires: { sanityBand: 'unravelling' }, terrains: ['water', 'wetland'],
        },
    ],
    ruinlands: [
        {
            id: 'proc-ruinlands-tower', oncePerRun: true, weight: 0.4,
            text: 'The tower that has been leaning over {zone} since before anyone alive was born finishes the fall it started. {tribute} is in its shadow.',
            escapeText: '{tribute} hears the tower over {zone} groan the way it has not groaned before, and runs before they know they are running.',
            cause: 'Crushed under the tower', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 7, damage: 58, zoneWide: true, witnesses: true, special: 'collapse', terrains: ['ruins', 'urban', 'open'],
        },
        {
            id: 'proc-ruinlands-vault', oncePerRun: true,
            text: 'There is a door in {zone} that was sealed on purpose, and {tribute} gets it open, and the air that comes out has been waiting.',
            escapeText: '{tribute} gets the door in {zone} open a crack, smells what is behind it, and shuts it again.',
            cause: 'Killed by what was sealed in', dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7, damage: 36, poisoned: true, sanity: 12, grantItem: 'medkit', terrains: ['ruins', 'urban'],
        },
        {
            id: 'proc-ruinlands-hum', chain: 'proc-ruinlands-live-wire',
            text: 'Somewhere under {zone}, something that should have died with the city is still humming.',
            escapeText: '{tribute} feels the hum in {zone} through the soles of their boots and does not touch anything metal.',
            cause: 'Electrocuted in the old works', dodgeStat: 'intelligence', dodgeAlt: 'willpower', sanity: 4, terrains: ['ruins', 'urban'],
        },
        {
            id: 'proc-ruinlands-live-wire', oncePerRun: true, weight: 0.2,
            text: '{tribute} takes hold of a rail in {zone} to pull themselves up, and the rail has been live for a hundred years.',
            escapeText: '{tribute} gets a spark off the rail in {zone} from a hand\'s breadth away and takes the stairs instead.',
            cause: 'Electrocuted in the old works', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 8, damage: 54, burned: true, terrains: ['ruins', 'urban'],
        },
        {
            text: 'The floor of {zone} is a ceiling from underneath. {tribute} finds out which.',
            escapeText: '{tribute} hears the floor in {zone} flex and keeps to the walls.',
            cause: 'Fell through a rotten floor', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 30, bleeding: true, requires: { elevationOrChoke: true }, terrains: ['ruins', 'urban'],
        },
        {
            text: 'The rats of {zone} have not seen a person in a generation and are not afraid of one.',
            escapeText: '{tribute} builds the fire in {zone} up until the rats decide the dark is better.',
            cause: 'Eaten by the rats', dodgeStat: 'willpower', dodgeAlt: 'endurance', damage: 14, infected: true, sanity: 8, requires: { time: 'night' }, terrains: ['ruins', 'urban'],
        },
        {
            text: 'A cache in {zone} that somebody left for a return that never came. Tins, mostly, and one of them has swollen.',
            escapeText: '{tribute} throws the swollen tin in {zone} away and eats the rest.',
            cause: 'Poisoned by a spoiled cache', dodgeStat: 'intelligence', dodgeAlt: 'willpower', poisoned: true, damage: 12, feed: 18, terrains: ['ruins', 'urban'],
        },
        {
            text: 'Someone scratched a warning into the wall of {zone} in a language {tribute} half knows. They stay to read it. That was the warning.',
            escapeText: '{tribute} reads enough of the wall in {zone} to understand the word for RUN.',
            cause: 'Caught in the old city', dodgeStat: 'intelligence', dodgeAlt: 'willpower', damage: 22, sanity: 10, requires: { trait: 'Strategist' }, terrains: ['ruins', 'urban'],
        },
    ],
    steppe: [
        {
            id: 'proc-steppe-grassfire', oncePerRun: true, weight: 0.4,
            text: 'The grass of {zone} has been drying for a month and a spark is all it takes. The fire moves faster than a horse. {tribute} does not have a horse.',
            escapeText: '{tribute} lights the grass in front of them in {zone} and walks onto the burnt ground as the wall arrives.',
            cause: 'Burned in a grass fire', dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7, damage: 40, burned: true, zoneWide: true, witnesses: true, startsZoneEffect: 'burning', terrains: ['open', 'forest'],
        },
        {
            id: 'proc-steppe-stampede', oncePerRun: true,
            text: 'The herd the Gamemakers put on the steppe is a thousand animals, and something behind them has decided they should be in {zone}.',
            escapeText: '{tribute} gets behind the one rock in {zone} and the herd goes around it like water around a post.',
            cause: 'Trampled by the herd', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 7, damage: 46, bleeding: true, zoneWide: true, terrains: ['open'],
        },
        {
            id: 'proc-steppe-horizon', chain: 'proc-steppe-riders',
            text: 'There are shapes on the horizon beyond {zone} that are not tributes and are moving like they have somewhere to be.',
            escapeText: '{tribute} watches the shapes beyond {zone} until they are sure of the direction, and goes the other way.',
            cause: 'Ridden down on the steppe', dodgeStat: 'intelligence', dodgeAlt: 'willpower', sanity: 5, terrains: ['open'],
        },
        {
            id: 'proc-steppe-riders', oncePerRun: true, weight: 0.2,
            text: 'The shapes from the horizon are in {zone} now, and they are hounds, and they have been bred to run down anything that runs.',
            escapeText: '{tribute} does not run in {zone}. The hounds, confused by it, run past.',
            cause: 'Ridden down on the steppe', dodgeStat: 'willpower', dodgeAlt: 'agility', dodgeDifficulty: 8, damage: 50, bleeding: true, terrains: ['open', 'forest'],
        },
        {
            text: 'There is nowhere in {zone} to be out of the wind, and the wind has been blowing for three days.',
            escapeText: '{tribute} digs a scrape in {zone} and lies in it, below the wind.',
            cause: 'Died of exposure on the steppe', dodgeStat: 'endurance', dodgeAlt: 'strength', damage: 14, fatigue: 16, sanity: 8, requires: { storm: true }, terrains: ['open'],
        },
        {
            text: 'The marmot hole in {zone} is exactly ankle-sized and {tribute} is running.',
            escapeText: '{tribute} sees the burrows pocking {zone} and slows to a walk.',
            cause: 'Broke a leg on the flats', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 20, requires: { stance: ['Hunting', 'Aggressive', 'Desperate'] }, terrains: ['open'],
        },
        {
            text: 'Lightning walks across {zone} on legs a mile long, and {tribute} is the tallest thing in it.',
            escapeText: '{tribute} lies flat in the grass of {zone} with their weapon thrown as far as they can throw it.',
            cause: 'Struck by lightning', dodgeStat: 'intelligence', dodgeAlt: 'willpower', damage: 44, burned: true, requires: { storm: true }, terrains: ['open', 'highland'],
        },
        {
            text: 'A spring in {zone} that the herd has been using. {tribute} drinks where the herd drank.',
            escapeText: '{tribute} walks upstream of the trampled bank in {zone} before they drink.',
            cause: 'Died of the trampled spring', dodgeStat: 'intelligence', dodgeAlt: 'willpower', infected: true, damage: 12, quench: 15, terrains: ['water', 'wetland', 'open'],
        },
    ],
    saltmarsh: [
        {
            id: 'proc-saltmarsh-tide-race', oncePerRun: true, weight: 0.4,
            text: 'The tide comes into {zone} through the channels faster than a person can wade, and {tribute} is between two channels.',
            escapeText: '{tribute} reads the channels in {zone} filling and is on the causeway before the two of them meet.',
            cause: 'Drowned in the tide race', dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7, damage: 44, zoneWide: true, startsZoneEffect: 'flooded', terrains: ['wetland', 'water'],
        },
        {
            id: 'proc-saltmarsh-brine', oncePerRun: true,
            text: 'There is water everywhere in {zone} and none of it is water. {tribute}, past caring, drinks.',
            escapeText: '{tribute} builds a still out of a sheet and a hollow in {zone} and gets a cup of clean water out of it by dusk.',
            cause: 'Died of drinking brine', dodgeStat: 'willpower', dodgeAlt: 'endurance', damage: 24, thirst: 25, sanity: 10, terrains: ['wetland', 'water'],
        },
        {
            id: 'proc-saltmarsh-crust', chain: 'proc-saltmarsh-under-the-crust',
            text: 'The salt crust of {zone} rings under {tribute}\'s heel like a drum. It should not ring.',
            escapeText: '{tribute} hears the crust in {zone} ring and retreats to where it does not.',
            cause: 'Went through the salt crust', dodgeStat: 'intelligence', dodgeAlt: 'willpower', sanity: 4, terrains: ['wetland', 'open', 'desert'],
        },
        {
            id: 'proc-saltmarsh-under-the-crust', oncePerRun: true, weight: 0.2,
            text: 'The crust of {zone} gives all at once and what is under it is warm and black and has been waiting a thousand years for somebody to fall in.',
            escapeText: '{tribute} goes through the crust in {zone} to the armpits and gets a knee onto a solid edge before the black takes the rest.',
            cause: 'Went through the salt crust', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 8, damage: 48, poisoned: true, terrains: ['wetland', 'open', 'desert'],
        },
        {
            text: 'The salt in the air of {zone} finds every cut {tribute} has, and keeps finding them.',
            escapeText: '{tribute} wraps every wound in {zone} and keeps them wrapped.',
            cause: 'Died of salt-rot', dodgeStat: 'endurance', dodgeAlt: 'strength', infected: true, damage: 12, sanity: 6, terrains: ['wetland', 'water', 'open'],
        },
        {
            text: 'The birds that live in {zone} nest on the ground, and they have chicks, and they are the size of dogs.',
            escapeText: '{tribute} gives the nesting ground in {zone} a wide berth and the birds shout but do not follow.',
            cause: 'Killed by nesting marsh-birds', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 22, bleeding: true, requires: { time: 'day' }, terrains: ['wetland', 'open'],
        },
        {
            text: 'The fog off the flats of {zone} tastes of salt and gets into {tribute}\'s lungs and stays there.',
            escapeText: '{tribute} breathes through a wet cloth in the fog over {zone} and it passes.',
            cause: 'Choked on the salt fog', dodgeStat: 'endurance', dodgeAlt: 'strength', damage: 14, fatigue: 12, requires: { time: 'night' }, startsZoneEffect: 'fogbound', terrains: ['wetland', 'water', 'open'],
        },
        {
            text: 'The mud of {zone} preserves things. {tribute} finds a tribute from a Games nobody remembers, and does not sleep for two nights.',
            escapeText: '{tribute} covers what the mud of {zone} gave up and walks on without looking again.',
            cause: 'Lost to the marsh', dodgeStat: 'willpower', dodgeAlt: 'endurance', sanity: 22, terrains: ['wetland'],
        },
    ],
    boreal: [
        {
            id: 'proc-boreal-widowmaker', oncePerRun: true, weight: 0.5,
            text: 'The dead spruce over {zone} has been held up by the trees around it for a decade. The wind tonight takes them all.',
            escapeText: '{tribute} camps in the open in {zone} rather than under the standing dead, and the standing dead fall on the empty spot.',
            cause: 'Crushed by a widowmaker', dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7, damage: 50, bleeding: true, requires: { time: 'night' }, zoneWide: true, terrains: ['forest'],
        },
        {
            id: 'proc-boreal-wolves', oncePerRun: true,
            text: 'The howling that has been circling the arena for three nights closes on {zone}. There are more voices in it than {tribute} has counted.',
            escapeText: '{tribute} builds the fire in {zone} into a wall and the eyes stay outside it until dawn.',
            cause: 'Taken by the pack', dodgeStat: 'willpower', dodgeAlt: 'strength', dodgeDifficulty: 7, damage: 44, bleeding: true, requires: { time: 'night' }, terrains: ['forest', 'open'],
        },
        {
            id: 'proc-boreal-smoke', chain: 'proc-boreal-crown-fire',
            text: 'There is smoke over the ridge beyond {zone}, more than a campfire\'s worth, and the wind is from that side.',
            escapeText: '{tribute} sees the smoke beyond {zone}, checks the wind, and moves to the water.',
            cause: 'Burned in the crown fire', dodgeStat: 'intelligence', dodgeAlt: 'willpower', sanity: 4, terrains: ['forest', 'highland', 'open'],
        },
        {
            id: 'proc-boreal-crown-fire', oncePerRun: true, weight: 0.2,
            text: 'The fire has reached the crowns of {zone} and a crown fire does not walk, it flies. {tribute} is under it.',
            escapeText: '{tribute} goes into the lake at {zone} to the chin and holds a wet shirt over their face while the forest goes over their head.',
            cause: 'Burned in the crown fire', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 8, damage: 56, burned: true, zoneWide: true, witnesses: true, startsZoneEffect: 'burning', terrains: ['forest'],
        },
        {
            text: 'The muskeg in {zone} looks like ground and is a mat of moss over four metres of cold water.',
            escapeText: '{tribute} steps from hummock to hummock across {zone} and never trusts the green between them.',
            cause: 'Drowned in the muskeg', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 30, frostbitten: true, terrains: ['wetland', 'forest'],
        },
        {
            text: 'The moose in {zone} has a calf, and {tribute} has walked between them.',
            escapeText: '{tribute} sees the calf in {zone} and backs out of the clearing without turning around.',
            cause: 'Killed by a cow moose', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 38, bleeding: true, requires: { time: 'day' }, terrains: ['forest', 'wetland'],
        },
        {
            text: 'The mushrooms of {zone} are plentiful and the wrong ones look exactly like the right ones.',
            escapeText: '{tribute} eats only the mushrooms in {zone} they can name, which is two kinds.',
            cause: 'Poisoned by a death-cap', dodgeStat: 'intelligence', dodgeAlt: 'willpower', poisoned: true, damage: 20, feed: 12, terrains: ['forest'],
        },
        {
            text: 'The cold in {zone} is the dry kind that does not feel like anything until it is too late, and {tribute} has been out in it too long.',
            escapeText: '{tribute} feels their fingers stop hurting in {zone}, which is the sign, and gets a fire going with the last of the light.',
            cause: 'Froze in the taiga', dodgeStat: 'endurance', dodgeAlt: 'strength', damage: 22, frostbitten: true, fatigue: 14, requires: { time: 'night' }, terrains: ['forest', 'open', 'wetland'],
        },
    ],
    badlands: [
        {
            id: 'proc-badlands-flash-flood', oncePerRun: true, weight: 0.4,
            text: 'It is not raining in {zone}. It is raining somewhere upstream, and the dry wash {tribute} is camped in is about to remember what it is for.',
            escapeText: '{tribute} hears the wash beyond {zone} start to roar and is on the bank with their pack before the water arrives.',
            cause: 'Drowned in a dry wash', dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7, damage: 46, zoneWide: true, startsZoneEffect: 'flooded', terrains: ['open', 'desert', 'highland'],
        },
        {
            id: 'proc-badlands-hoodoo', oncePerRun: true,
            text: 'The rock spire {tribute} has been sheltering under in {zone} has been a spire for ten thousand years and stops being one this afternoon.',
            escapeText: '{tribute} hears the spire over {zone} crack and is out from under it before the top comes down.',
            cause: 'Crushed by a falling hoodoo', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 7, damage: 54, terrains: ['highland', 'open', 'desert'],
        },
        {
            id: 'proc-badlands-bones', chain: 'proc-badlands-the-thing-in-the-bones',
            text: 'The gully in {zone} is floored with bones. Big ones. Recent ones. {tribute} walks up it anyway.',
            escapeText: '{tribute} sees the bones in the gully at {zone}, reads what left them, and goes back the way they came.',
            cause: 'Killed by the thing in the bones', dodgeStat: 'intelligence', dodgeAlt: 'willpower', sanity: 8, terrains: ['highland', 'open', 'cave'],
        },
        {
            id: 'proc-badlands-the-thing-in-the-bones', oncePerRun: true, weight: 0.2,
            text: 'The thing that made the bone gully at {zone} is home. It is bigger than the gully suggested.',
            escapeText: '{tribute} goes up the gully wall at {zone} faster than they have ever climbed anything, and the thing below cannot climb.',
            cause: 'Killed by the thing in the bones', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 8, damage: 60, bleeding: true, terrains: ['highland', 'open', 'cave'],
        },
        {
            text: 'The heat in {zone} at noon is a weight, and {tribute} is carrying enough already.',
            escapeText: '{tribute} lies up in the shade of a cut-bank in {zone} through the worst of it and moves at dusk.',
            cause: 'Died of heatstroke', dodgeStat: 'endurance', dodgeAlt: 'strength', damage: 20, thirst: 14, fatigue: 12, requires: { time: 'day' }, terrains: ['open', 'desert', 'highland'],
        },
        {
            text: 'The rattle in {zone} is the only warning the snake gives, and {tribute} has already put their hand on the ledge.',
            escapeText: '{tribute} freezes at the rattle in {zone} and takes the hand back an inch at a time.',
            cause: 'Bitten by a rattlesnake', dodgeStat: 'agility', dodgeAlt: 'endurance', poisoned: true, damage: 14, terrains: ['highland', 'open', 'desert', 'cave'],
        },
        {
            text: 'The slot canyon at {zone} is cool and dark and the only shade for a mile, and the sky at the top of it has gone black.',
            escapeText: '{tribute} sees the sky over the slot at {zone} turn and climbs out of it before it becomes a drain.',
            cause: 'Drowned in a slot canyon', dodgeStat: 'intelligence', dodgeAlt: 'willpower', damage: 40, requires: { storm: true }, terrains: ['cave', 'highland'],
        },
        {
            text: 'The clay of {zone} after rain is grease. {tribute}, in a hurry, finds the edge.',
            escapeText: '{tribute} slides on the clay of {zone} and stops with their boots over nothing.',
            cause: 'Fell from the clay edge', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 32, bleeding: true, requires: { storm: true, stance: ['Hunting', 'Aggressive', 'Desperate'] }, terrains: ['highland', 'open'],
        },
    ],
};

/** Four ambient lines per biome, on top of the generic and tag-based ones. */
export const PROCEDURAL_BIOME_AMBIENT: Record<string, string[]> = {
    rainforest: [
        'The rain stops, and the drip from a billion leaves goes on for an hour after it.',
        'A troop of something crashes through the canopy overhead and is gone before anyone sees it.',
        'The Gamemakers turn the humidity up until breathing feels like drinking.',
        'Somewhere in the green, a tree the size of a building lets go of a branch the size of a tree.',
    ],
    volcanic: [
        'The mountain exhales, and every tribute in the arena stops to listen to it.',
        'Ash sifts down through the evening light like grey snow.',
        'A vent on the far side of the arena blows white for ten minutes and stops.',
        'The ground is warm through the soles of every boot in the arena tonight.',
    ],
    archipelago: [
        'The tide turns, and every channel in the arena changes its mind about which way it runs.',
        'Gulls wheel over one island in particular. Everyone notes which one.',
        'A hovercraft comes in low over the water and takes something off a rock.',
        'The sea fog comes in at dusk and takes the far islands one by one.',
    ],
    highlands: [
        'Cloud sits on the summits all day, and the summits are where the water is.',
        'A rockfall on a far face goes on for a full minute. Nobody was on it. Everybody checked.',
        'The wind up here has an edge that it did not have at the horn.',
        'Something with a wingspan crosses the sun and every tribute in the open looks up.',
    ],
    tundra: [
        'The sun does not so much set as give up.',
        'The wind has been blowing from the same quarter for four days and nobody has found the lee of it.',
        'A herd of something crosses the far horizon, a mile long and moving.',
        'The Gamemakers drop the temperature another notch and the ice on the lake talks about it all night.',
    ],
    dunes: [
        'The dunes have moved in the night. The map every tribute carries in their head is wrong now.',
        'Heat shimmer turns the far edge of the arena into water that is not there.',
        'A single cloud crosses the arena and every tribute walks in its shadow for as long as it lasts.',
        'Sand gets into everything: the food, the wounds, the last of the water.',
    ],
    bayou: [
        'Frogs, a million of them, all at once, and then none.',
        'Something big rolls in the black water and the ripples take a full minute to reach the bank.',
        'The mist lies in the low ground after dark and does not lift till the sun is high.',
        'A cypress lets go of a limb into the water with a crack like a cannon, and half the arena flinches.',
    ],
    ruinlands: [
        'A wall that stood for a century picks tonight to come down, with nobody near it.',
        'Wind through a thousand empty windows sounds like a crowd that is not there.',
        'A door bangs somewhere in the dead city, and keeps banging.',
        'The Gamemakers light one tower at the far edge of the arena and leave it lit all night.',
    ],
    steppe: [
        'The grass moves in waves to the horizon and there is nowhere in it to hide from anything.',
        'A dust column stands on the far edge of the arena for an hour and walks off.',
        'The herd the Gamemakers put here is somewhere out there. The ground tells you when it moves.',
        'Lightning walks along the horizon all night without ever coming closer.',
    ],
    saltmarsh: [
        'The tide comes in through a hundred channels at once and the arena is half the size it was at noon.',
        'Salt crusts on every wound, every strap, every lip.',
        'Birds by the thousand lift off the flats at once, for a reason nobody on the ground can see.',
        'The fog off the flats tastes of the sea, and there is no sea.',
    ],
    boreal: [
        'The howling starts at dusk, a long way off, and by midnight it is not a long way off.',
        'Snow falls off a spruce with a sound like a body dropping, and everybody within earshot stops.',
        'Smoke from somebody\'s fire hangs in the trees for a mile, which is the same as a flag.',
        'The cold tonight is the dry, quiet kind that does not feel like anything until morning.',
    ],
    badlands: [
        'The rock spires throw shadows at dusk like a city that was never built.',
        'A dry wash on the far side of the arena runs for ten minutes and is dry again.',
        'Heat stands in the gullies like water.',
        'Something screams once from a canyon, and the echo takes longer to die than the scream did.',
    ],
};
