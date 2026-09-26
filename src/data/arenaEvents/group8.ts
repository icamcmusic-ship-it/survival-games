import type { ArenaEventDef } from '../arenaFlavor';

/**
 * AUDIT-13 §9.2: arena-specific deaths D33–D76, plus the further deaths the
 * audit asked for in the thinnest arenas (W7) and sporefields' mycelium mutt
 * (W8).
 *
 * Every entry declares its `code`, so the new W5 codes (crush, impact,
 * electrocution, sound, animal, exposure-pressure) are set at the source and
 * none of these reaches the `hazard` catch-all. Terrains are drawn from the
 * arena's own zones so each entry is eligible somewhere real.
 *
 */
export const EXTRA_ARENA_EVENTS_GROUP8: Record<string, ArenaEventDef[]> = {
    clockwork: [
        {
            text: 'The sector boundary ticks over under {zone} and the ladder {tribute} is halfway up goes with the other half of the island.',
            escapeText: '{tribute} feels the tick coming through the rungs in {zone} and jumps for the near side before the ladder is sheared.',
            cause: 'The sector tick sheared the ladder they were on', code: 'fall',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 36, terrains: ['highland', 'ruins'],
        },
        {
            text: 'The great hand of the clock sweeps across {zone} on the hour, and {tribute} is standing in the one place the arena was built to sweep.',
            escapeText: '{tribute} counts the minutes in {zone} and is flat in the gully when the hand goes over.',
            cause: 'Swept by the clock hand', code: 'crush',
            dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 7,
            damage: 40, terrains: ['open', 'forest', 'wetland'], witnesses: true,
        },
    ],
    frozen: [
        {
            text: 'The snow bridge over the crevasse in {zone} has held for four tributes today. {tribute} is the fifth.',
            escapeText: '{tribute} probes ahead with a pole in {zone}, finds nothing where the snow says there is ground, and goes round.',
            cause: 'Went through a snow bridge into a crevasse', code: 'fall',
            dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 7,
            damage: 40, frostbitten: true, terrains: ['open', 'highland'],
        },
        {
            text: 'The whiteout hides everything in {zone}. {tribute} lies down to wait it out, just for a minute, and the snow is warm, which is the last warning.',
            escapeText: '{tribute} makes themselves stand up in the whiteout in {zone} and stamp in a circle all night.',
            cause: 'Lay down in the whiteout and did not get up', code: 'hypothermia',
            dodgeStat: 'willpower', dodgeAlt: 'endurance', dodgeDifficulty: 7,
            damage: 36, frostbitten: true, terrains: ['open', 'highland'],
            requires: { storm: true },
        },
    ],
    concrete: [
        {
            text: '{tribute} jumps down into the rubble in {zone}. There is a rebar spike in it at exactly the wrong angle.',
            escapeText: '{tribute} tests the rubble with a foot in {zone} before trusting it, and finds the rebar with the boot sole instead.',
            cause: 'Impaled on rebar in the rubble', code: 'impact',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 6,
            damage: 36, bleeding: true, terrains: ['ruins'],
        },
        {
            text: 'The stairwell in {zone} has been holding up the building for sixty years and the building for none. It chooses {tribute}\'s weight to stop.',
            escapeText: '{tribute} hears the stairwell in {zone} groan and goes up the outside of it instead, on the pipes.',
            cause: 'The stairwell gave way beneath them', code: 'collapse',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 38, terrains: ['ruins', 'highland'], requires: { elevationOrChoke: true },
        },
    ],
    toxic: [
        {
            text: 'The acid mist comes off the swamp in {zone} with the morning. {tribute} breathes it before they know what it is.',
            escapeText: '{tribute} ties a wet cloth over their mouth in {zone} and walks out of the mist with their eyes shut.',
            cause: 'Lungs burned out by acid mist', code: 'asphyxiation',
            dodgeStat: 'intelligence', dodgeAlt: 'endurance', dodgeDifficulty: 7,
            damage: 36, burned: true, terrains: ['wetland', 'water'], requires: { time: 'day' },
        },
        {
            text: '{tribute} wades the pools in {zone} barefoot to keep the boots dry. The pools are not only wet.',
            escapeText: '{tribute} feels the tingle start on their shins in {zone} and is out and scrubbing with sand before it is more than a tingle.',
            cause: 'Poisoned through the skin by the pools', code: 'poison',
            dodgeStat: 'endurance', dodgeAlt: 'intelligence', dodgeDifficulty: 6,
            damage: 30, poisoned: true, terrains: ['water', 'wetland'],
        },
    ],
    solar: [
        {
            text: 'The glare off the dunes in {zone} has taken {tribute}\'s eyes by noon. They walk toward what they think is shade.',
            escapeText: '{tribute} feels the blindness coming in {zone} and sits down right there with a cloth over their face until evening.',
            cause: 'Blinded by the glare and walked off the edge', code: 'fall',
            dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7,
            damage: 36, terrains: ['open', 'highland'], requires: { time: 'day', elevationOrChoke: true },
        },
        {
            text: 'The mirror array on the ridge above {zone} turns, slowly, and finds {tribute}.',
            escapeText: '{tribute} sees the bright spot sliding over the sand toward them in {zone} and dives behind rock.',
            cause: 'Burned at the focus of the mirror array', code: 'burns',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 40, burned: true, terrains: ['open', 'highland'], requires: { time: 'day' },
        },
    ],
    ashfall: [
        {
            text: 'The mountain sends a cloud down {zone} faster than anything can run. {tribute} runs anyway.',
            escapeText: '{tribute} is in a lava tube in {zone} when the cloud passes over, and comes out into a grey silent world alive.',
            cause: 'Overtaken by a pyroclastic flow', code: 'burns',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 8,
            damage: 48, burned: true, zoneWide: true, terrains: ['open', 'forest', 'highland'],
        },
        {
            text: 'The rain turns the ash on the slopes above {zone} to mud, and the mud comes down as a single grey wave, straight at {tribute}.',
            escapeText: '{tribute} gets up the bank in {zone} as the lahar goes by at the height of a house.',
            cause: 'Carried off by a lahar', code: 'drowning',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 42, terrains: ['water', 'wetland', 'open'], requires: { storm: true },
        },
    ],
    tempest: [
        {
            text: 'A waterspout walks in off the sea across {zone} and picks {tribute} up the way you would pick up a leaf.',
            escapeText: '{tribute} lies flat in a drainage cut in {zone} while the waterspout goes over like a train.',
            cause: 'Lifted by a waterspout and dropped', code: 'impact',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 8,
            damage: 42, terrains: ['water', 'open', 'wetland'], requires: { storm: true },
        },
        {
            text: 'Half a roof comes across {zone} edge-on in the wind. {tribute} sees it about as late as anyone would.',
            escapeText: '{tribute} is behind the lighthouse wall in {zone} when the roof goes by.',
            cause: 'Struck by flying debris in the storm', code: 'impact',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 38, bleeding: true, terrains: ['open', 'ruins', 'highland'], requires: { storm: true },
        },
    ],
    saltflats: [
        {
            text: 'The salt crust in {zone} looks exactly like the salt crust everywhere else. Under the piece {tribute} steps on is brine to the depth of a well.',
            escapeText: '{tribute} feels the crust flex in {zone} and throws themselves flat, spreading the weight, and crawls back.',
            cause: 'Broke through the salt crust into the brine', code: 'drowning',
            dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 7,
            damage: 38, thirst: 10, terrains: ['open', 'water'],
        },
        {
            text: 'The lake on the horizon in {zone} has been there all afternoon. {tribute} walks to it, and it keeps being there, right up until the border.',
            escapeText: '{tribute} checks the sun against the mirage in {zone} and turns round an hour before the border would have.',
            cause: 'Walked into the border chasing a mirage', code: 'border',
            dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7,
            damage: 40, terrains: ['open'], requires: { thirstAbove: 50, time: 'day' },
        },
    ],
    sporefields: [
        {
            text: 'The caps in {zone} release at once, a slow gold fog, and {tribute} breathes it all afternoon without noticing it has started to grow.',
            escapeText: '{tribute} sees the gold rise off the caps in {zone} and gets upwind with their shirt over their face.',
            cause: 'Spore lung', code: 'asphyxiation',
            dodgeStat: 'endurance', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 36, zoneWide: true, terrains: ['forest', 'open', 'wetland'],
        },
        {
            text: 'The wound on {tribute}\'s leg has gone white at the edges in {zone}, and the white has threads, and the threads are reaching.',
            escapeText: '{tribute} cuts the white out of the wound in {zone} with a heated blade and does not scream until afterwards.',
            cause: 'Mycelium grew through a wound', code: 'infection',
            dodgeStat: 'endurance', dodgeAlt: 'willpower', dodgeDifficulty: 7,
            damage: 32, infected: true, requires: { wounded: true },
        },
        {
            // AUDIT-13 W8: sporefields had no mutt deaths at all.
            text: 'Something walks out of the mycelium mat in {zone} that is shaped like a dog and made of the same white threads as the ground. It does not bite {tribute}. It holds on, and grows.',
            escapeText: '{tribute} gets fire between themselves and the white thing in {zone}, and it will not cross it.',
            cause: 'Taken apart by a mycelium mutt', code: 'mutt',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 40, infected: true, terrains: ['forest', 'wetland', 'open'],
            requires: { time: 'night' },
        },
        {
            text: 'A second mycelium mutt comes up out of the ring of caps in {zone} in daylight, slow and pale, and {tribute} is the only warm thing in reach.',
            escapeText: '{tribute} outwalks the pale thing in {zone} — it is not fast, only patient — and leaves the zone to it.',
            cause: 'Overgrown by a mycelium mutt', code: 'mutt',
            dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 6,
            damage: 36, terrains: ['forest', 'open', 'highland'], requires: { daysAbove: 2 },
        },
    ],
    canopy: [
        {
            text: 'A vine in {zone} has been growing toward {tribute}\'s hammock all night, and by morning it has finished.',
            escapeText: '{tribute} wakes with the vine at their throat in {zone} and cuts it with the knife they sleep holding.',
            cause: 'Strangled by a vine in the night', code: 'asphyxiation',
            dodgeStat: 'strength', dodgeAlt: 'agility', dodgeDifficulty: 7,
            damage: 36, terrains: ['forest', 'highland'], requires: { time: 'night' },
        },
    ],
    vault: [
        {
            text: 'The airlock in {zone} cycles with {tribute} inside it. The outer door does not open. The air goes anyway.',
            escapeText: '{tribute} gets the manual release in {zone} on the second try, with the last of the air.',
            cause: 'An airlock cycled with no air', code: 'exposure-pressure',
            dodgeStat: 'intelligence', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 40, terrains: ['ruins'],
        },
        {
            text: 'The laser grid in {zone} comes up without a sound. {tribute} is already standing in the middle of it.',
            escapeText: '{tribute} sees the dust sparkle in {zone} at the height of their knees and freezes.',
            cause: 'Cut by the laser grid', code: 'trap',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 8,
            damage: 40, bleeding: true, terrains: ['ruins', 'open'],
        },
    ],
    warren: [
        {
            text: 'The tunnel in {zone} comes down on the people sleeping in it, which tonight includes {tribute}.',
            escapeText: '{tribute} is sleeping nearest the mouth of the tunnel in {zone} and is dragged out by the ankle by someone they did not know was awake.',
            cause: 'Buried in a tunnel cave-in while asleep', code: 'collapse',
            dodgeStat: 'endurance', dodgeAlt: 'agility', dodgeDifficulty: 8,
            damage: 44, zoneWide: true, terrains: ['ruins'], requires: { time: 'night' },
        },
    ],
    islands: [
        {
            text: 'The sandbar {tribute} is crossing in {zone} was a road at low tide. The tide has decided it is sea.',
            escapeText: '{tribute} reads the water in {zone} and turns back while it is still at their knees.',
            cause: 'Swept off a sandbar at high tide', code: 'drowning',
            dodgeStat: 'intelligence', dodgeAlt: 'endurance', dodgeDifficulty: 7,
            damage: 40, terrains: ['water', 'open'],
        },
    ],
    eclipse: [
        {
            text: 'Totality comes over {zone} and something that only hunts in totality comes out with it, and finds {tribute} first.',
            escapeText: '{tribute} lights everything they have in {zone} and the totality-thing circles once and leaves.',
            cause: 'Taken by a totality mutt', code: 'mutt',
            dodgeStat: 'agility', dodgeAlt: 'willpower', dodgeDifficulty: 7,
            damage: 40, bleeding: true, requires: { time: 'night' },
        },
    ],
    reef: [
        {
            text: 'The coral cut on {tribute}\'s shin in {zone} was nothing. It has gone hot and red to the knee.',
            escapeText: '{tribute} scrubs the coral cut in {zone} raw with sand and fresh water, and it stays a cut.',
            cause: 'A coral cut turned septic', code: 'sepsis',
            dodgeStat: 'endurance', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 32, infected: true, requires: { wounded: true },
        },
        {
            text: '{tribute} steps down in {zone} onto a rock that is not a rock.',
            escapeText: '{tribute} shuffles their feet through the pool in {zone} rather than stepping, and the stonefish moves off.',
            cause: 'Stepped on a stonefish', code: 'animal',
            dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 7,
            damage: 38, poisoned: true, terrains: ['water', 'wetland'],
        },
    ],
    abattoir: [
        {
            text: 'The hook rail in {zone} starts running with {tribute}\'s jacket caught on a hook.',
            escapeText: '{tribute} slips out of the jacket in {zone} and lets the rail take it round without them.',
            cause: 'Carried off by the hook rail', code: 'machinery',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 40, bleeding: true, terrains: ['ruins', 'open'],
        },
        {
            text: 'The cold-store door in {zone} swings shut behind {tribute}. There is no handle on the inside.',
            escapeText: '{tribute} wedges the cold-store door in {zone} with a carcass before going in.',
            cause: 'Locked in the cold store', code: 'hypothermia',
            dodgeStat: 'intelligence', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 38, frostbitten: true, terrains: ['ruins'],
        },
    ],
    carnival: [
        {
            text: 'The mirror maze in {zone} has been showing {tribute} themselves for a day now. The exit is always in the next mirror.',
            escapeText: '{tribute} closes their eyes in the mirror maze in {zone}, puts a hand on the left wall and walks until the air changes.',
            cause: 'Walked themselves to death in the mirror maze', code: 'exhaustion',
            dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7,
            damage: 34, fatigue: 20, sanity: 14, terrains: ['ruins'],
        },
        {
            text: 'The dunk tank in {zone} has water in it and a seat above it, and when {tribute} sits on the seat to rest, something hits the target.',
            escapeText: '{tribute} is on the ladder of the dunk tank in {zone}, not the seat, when it drops.',
            cause: 'Drowned in the dunk tank', code: 'drowning',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 38, terrains: ['water', 'open', 'ruins'],
        },
    ],
    quarry: [
        {
            text: 'The Gamemakers set off a blast charge on the bench above {zone}. {tribute} is on the bench below.',
            escapeText: '{tribute} hears the siren in {zone} and knows what quarry sirens mean.',
            cause: 'Caught in the Gamemakers\' blast charge', code: 'gamemaker',
            dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 7,
            damage: 42, bleeding: true, terrains: ['highland', 'open'], witnesses: true,
        },
    ],
    glacier: [
        {
            text: 'A moulin in {zone} opens its throat in the ice, meltwater pouring into it, and {tribute} slips on the edge.',
            escapeText: '{tribute} feels the ice curve toward the moulin in {zone} and crawls uphill away from it on their belly.',
            cause: 'Plunged down a moulin', code: 'fall',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 44, frostbitten: true, terrains: ['water', 'highland', 'open'],
        },
    ],
    floe: [
        {
            text: 'The floe {tribute} is standing on in {zone} decides, between one foot and the other, to be two floes.',
            escapeText: '{tribute} feels the crack run under them in {zone} and jumps for the bigger half.',
            cause: 'The floe split between their feet', code: 'drowning',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 40, frostbitten: true, terrains: ['water', 'open'],
        },
    ],
    alpine: [
        {
            text: '{tribute} traverses the slope in {zone} in the afternoon sun. The slope has been waiting all winter for a reason.',
            escapeText: '{tribute} crosses the slope in {zone} one at a time, fast, at dawn, and is on the far rock when it goes.',
            cause: 'Caught in an avalanche on the traverse', code: 'collapse',
            dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 8,
            damage: 46, frostbitten: true, terrains: ['highland', 'open'], requires: { time: 'day' },
        },
    ],
    seapeaks: [
        {
            text: 'The sea has been quiet all morning below {zone}. The rogue wave comes up the ledges three times higher than any before it, and {tribute} is on the lowest of them.',
            escapeText: '{tribute} sees the sea go out below {zone} and climbs before it comes back.',
            cause: 'Taken off the ledges by a rogue wave', code: 'drowning',
            dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 7,
            damage: 42, terrains: ['highland', 'water', 'open'],
        },
    ],
    canopyweb: [
        {
            text: 'The anchor strand of the web in {zone} has been fraying for days. It lets go under {tribute}.',
            escapeText: '{tribute} feels the web sag in {zone} and grabs the next strand before the first one goes.',
            cause: 'A web anchor snapped under them', code: 'fall',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 42, terrains: ['highland', 'forest'],
        },
    ],
    acousticforest: [
        {
            text: 'The forest finds a note in {zone} that the glass-bark trees answer to, and every one of them bursts at once around {tribute}.',
            escapeText: '{tribute} hears the note climbing in {zone} and is out from under the glass-bark before it peaks.',
            cause: 'Cut to pieces when the glass trees shattered to the note', code: 'sound',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 40, bleeding: true, terrains: ['forest', 'highland'],
        },
    ],
    burnscar: [
        {
            text: 'The root {tribute} is sitting over in {zone} has been burning underground since the fire. It picks now to come up.',
            escapeText: '{tribute} smells the smoke rising out of the ground in {zone} and moves before the flare-up.',
            cause: 'Caught by a smouldering root flaring up', code: 'burns',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 6,
            damage: 36, burned: true, terrains: ['forest', 'open'],
        },
    ],
    culdesac: [
        {
            text: 'The garage door in {zone} comes down on its motor the way it was designed to. {tribute} is crawling under it.',
            escapeText: '{tribute} hears the motor start in {zone} and rolls out from under the door with a foot to spare.',
            cause: 'Crushed under a garage door', code: 'crush',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 40, terrains: ['ruins', 'open'],
        },
    ],
    labyrinth: [
        {
            text: 'The two hedges in {zone} move toward each other with the patience of a thing that has done this before. {tribute} is between them.',
            escapeText: '{tribute} sees the gap narrowing in {zone} and forces through the thin place in the hedge, leaving skin behind.',
            cause: 'Crushed as the hedges closed', code: 'crush',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 40, terrains: ['forest'],
        },
    ],
    kelvin: [
        {
            text: 'A liquid-nitrogen vent in {zone} blows its seal, and the white cloud comes down the corridor at waist height toward {tribute}.',
            escapeText: '{tribute} climbs the pipes in {zone} and hangs above the white until it thins.',
            cause: 'Caught in a liquid-nitrogen vent', code: 'exposure-pressure',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 42, frostbitten: true, terrains: ['ruins'],
        },
    ],
    silkwood: [
        {
            text: 'Something wraps {tribute} in {zone} while they are sleeping, slowly, and by the time they wake they are a shape on a branch.',
            escapeText: '{tribute} wakes wrapped to the waist in {zone} and saws out with the knife.',
            cause: 'Cocooned in the Silk Wood', code: 'asphyxiation',
            dodgeStat: 'strength', dodgeAlt: 'willpower', dodgeDifficulty: 7,
            damage: 40, terrains: ['forest', 'wetland'], requires: { time: 'night' },
        },
    ],
    magmatube: [
        {
            text: 'The floor of the tube in {zone} is a crust over a skylight, and the skylight is over the lava. {tribute} finds that out with their weight.',
            escapeText: '{tribute} sees the glow through a crack in the floor of {zone} and backs out the way they came.',
            cause: 'Fell through a lava skylight', code: 'burns',
            dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 8,
            damage: 50, burned: true, terrains: ['ruins', 'highland'],
        },
    ],
    menagerie: [
        {
            text: 'The Gamemakers open one enclosure in {zone}. It is the one with the bear, and it is the one {tribute} is standing beside.',
            escapeText: '{tribute} is behind the moat in {zone} when the bear comes out, and bears do not swim moats in a hurry.',
            cause: 'Mauled by a released bear', code: 'animal',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 44, bleeding: true, terrains: ['open', 'ruins', 'forest'], witnesses: true,
        },
    ],
    // ---- W7: the thinnest arenas ----------------------------------------------
    tidewrack: [
        {
            text: 'The kelp in {zone} wraps {tribute}\'s ankle as the tide turns, and the tide is coming in.',
            escapeText: '{tribute} saws through the kelp in {zone} with a shell edge while the water climbs to their chin.',
            cause: 'Held under by a kelp snare on the flood tide', code: 'drowning',
            dodgeStat: 'strength', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 40, terrains: ['water', 'wetland'],
        },
        {
            text: '{tribute} puts a foot into the mud in {zone} and the mud takes it to the knee, and then the other knee, and the tide is two hours out.',
            escapeText: '{tribute} lies flat on the mud in {zone} and swims out of it on their belly.',
            cause: 'Held in the mud until the tide came back', code: 'drowning',
            dodgeStat: 'intelligence', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 38, terrains: ['wetland', 'open'],
        },
    ],
    thresher: [
        {
            text: 'The reel in {zone} starts turning and {tribute}\'s sleeve is on it.',
            escapeText: '{tribute} tears the sleeve off in {zone} and lets the reel have it.',
            cause: 'Pulled into the reel', code: 'machinery',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 42, bleeding: true, terrains: ['urban', 'ruins', 'open'],
        },
        {
            text: 'The whole floor in {zone} starts shaking on its mounts, harder and harder, until the noise is the thing doing the damage, and {tribute} is in the middle of it.',
            escapeText: '{tribute} gets their hands over their ears in {zone} and walks off the floor before the resonance peaks.',
            cause: 'Shaken apart by the thresher\'s resonance', code: 'sound',
            dodgeStat: 'endurance', dodgeAlt: 'willpower', dodgeDifficulty: 7,
            damage: 36, zoneWide: true, terrains: ['urban', 'ruins'],
        },
    ],
    kiln: [
        {
            text: 'The kiln door in {zone} swings shut on {tribute} and seals. Somewhere a burner catches.',
            escapeText: '{tribute} gets the kiln door in {zone} open from the inside with the bar they took in with them for exactly this.',
            cause: 'Sealed in the kiln as it fired', code: 'burns',
            dodgeStat: 'strength', dodgeAlt: 'intelligence', dodgeDifficulty: 8,
            damage: 48, burned: true, terrains: ['cave', 'ruins'],
        },
        {
            text: 'The stack of greenware in {zone} goes over and it is heavier than it looks, all of it, and {tribute} is under it.',
            escapeText: '{tribute} sees the stack lean in {zone} and is out from under it.',
            cause: 'Crushed under a toppled stack of greenware', code: 'crush',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 6,
            damage: 38, terrains: ['open', 'ruins'],
        },
    ],
    vigil: [
        {
            text: 'The candles in {zone} have been burning for three days and the wax has run into every hollow. {tribute} falls asleep face-down in the warm of it.',
            escapeText: '{tribute} wakes with wax at their lips in {zone} and rolls over, spitting.',
            cause: 'Smothered in candle wax', code: 'asphyxiation',
            dodgeStat: 'endurance', dodgeAlt: 'willpower', dodgeDifficulty: 7,
            damage: 36, burned: true, requires: { time: 'night', fatigueAbove: 55 },
        },
        {
            text: 'The watchfire in {zone} has to be kept. {tribute} is keeping it when the wind changes and brings the whole thing down on them.',
            escapeText: '{tribute} steps back from the watchfire in {zone} as the wind changes, and lets it fall.',
            cause: 'The watchfire came down on them', code: 'burns',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 40, burned: true, terrains: ['open', 'highland', 'forest'],
        },
    ],
    malthouse: [
        {
            text: '{tribute} climbs into the grain silo in {zone} for the food in it. The grain moves like water, and it takes them down to the chest, and then further.',
            escapeText: '{tribute} feels the grain start to flow in {zone} and spreads out flat across it, and crawls to the ladder.',
            cause: 'Engulfed in a grain silo', code: 'asphyxiation',
            dodgeStat: 'strength', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 42, feed: 10, terrains: ['urban', 'ruins'],
        },
        {
            text: 'The fermentation vats in {zone} have been breathing out all night, and the air at floor height is not air any more. {tribute} is sleeping on the floor.',
            escapeText: '{tribute} wakes with a thumping head in {zone} and climbs onto the vat gantry, where the air is.',
            cause: 'Suffocated by vat gas on the fermentation floor', code: 'asphyxiation',
            dodgeStat: 'endurance', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 38, terrains: ['open', 'cave', 'urban'], requires: { time: 'night' },
        },
    ],
    glasshouse: [
        {
            text: 'A pane high in the roof over {zone} lets go of its frame. It turns once in the air, edge-down, and {tribute} is under it.',
            escapeText: '{tribute} hears the frame ping in {zone} and is under the potting bench when the pane arrives.',
            cause: 'Cut down by a falling pane', code: 'impact',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 40, bleeding: true, terrains: ['forest', 'desert', 'open', 'ruins'],
        },
        {
            text: 'The vents in {zone} have closed for the day and the heat under the glass climbs past anything a body can shed. {tribute} is in the middle of the Desert Wing.',
            escapeText: '{tribute} breaks a low pane in {zone} with an elbow and lies in the draught.',
            cause: 'Cooked under the glass when the vents closed', code: 'heatstroke',
            dodgeStat: 'endurance', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 36, thirst: 15, terrains: ['desert', 'forest', 'open'], requires: { time: 'day' },
        },
    ],
    undercroft: [
        {
            text: 'The ossuary shelves in {zone} have held the old bones for two hundred years. {tribute} climbs them to get above the water, and they come away from the wall.',
            escapeText: '{tribute} feels the shelf lean in {zone} and jumps clear into the water instead.',
            cause: 'Buried under a collapsing ossuary shelf', code: 'crush',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 40, terrains: ['cave', 'ruins'],
        },
        {
            text: 'The dead rail in {zone} is not dead. {tribute} finds that out with a wet hand.',
            escapeText: '{tribute} sees the blue spark jump in {zone} and steps over the rail without touching it.',
            cause: 'Electrocuted on the third rail', code: 'electrocution',
            dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 7,
            damage: 44, burned: true, terrains: ['urban', 'cave', 'water'],
        },
    ],
};
