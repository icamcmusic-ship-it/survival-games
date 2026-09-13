import type { ArenaEventDef } from '../arenaFlavor';

/**
 * §7 (audit): the seven arenas at the bottom of the unique-death table —
 * fourteen to eighteen exclusive causes where the median was twenty-five.
 * Four more each, and every one uses a gate the schema already offered
 * and almost nothing used: `requires.trait` had zero users across 1,391
 * events, `requires.stance` one. A tribute's own nature is the cheapest
 * source of variety the event layer has.
 */
export const EXTRA_ARENA_EVENTS_GROUP4: Record<string, ArenaEventDef[]> = {
    culdesac: [
        {
            text: 'The swing set in {zone} still works. {tribute}, alone, sits on it, and the chain that has held a child\'s weight for twenty years holds an adult\'s for four seconds.',
            escapeText: '{tribute} pushes the swing in {zone} once, watches the chain, and leaves it.',
            cause: 'Killed by a playground', dodgeStat: 'intelligence', damage: 26, bleeding: true, requires: { sanityBand: 'frayed' }, terrains: ['open'],
        },
        {
            text: 'Every house on the loop has a dog door, and {tribute}, hunting, goes through one head first into a kitchen that has been sealed since the estate emptied.',
            escapeText: '{tribute} puts an arm through the dog door in {zone}, smells the kitchen, and pulls the arm back.',
            cause: 'Killed by what was in the kitchen', dodgeStat: 'agility', damage: 24, poisoned: true, requires: { stance: ['Hunting', 'Aggressive'] }, terrains: ['ruins'],
        },
        {
            text: 'The sprinklers in {zone} come on at six, as they have every evening for two decades, and {tribute} is on the lawn when water that has stood in the pipes for two decades comes up.',
            escapeText: '{tribute} hears the pipes in {zone} knock and is out of the lawn before the heads rise.',
            cause: 'Poisoned by the sprinklers', dodgeStat: 'agility', poisoned: true, damage: 12, requires: { time: 'night' }, terrains: ['open', 'ruins'],
        },
        {
            text: '{tribute}, Loyal to a fault, goes back into the burning garage in {zone} for a pack that is not theirs.',
            escapeText: '{tribute} gets to the garage door in {zone} and the heat makes the decision for them.',
            cause: 'Burned going back for a friend\'s pack', dodgeStat: 'endurance', damage: 34, burned: true, requires: { trait: 'Loyal', effect: 'burning' }, terrains: ['ruins'],
        },
    ],
    ashgrove: [
        {
            text: 'The columbarium in {zone} has a thousand niches, and {tribute}, Haunted, reads the names on them until one of them is theirs.',
            escapeText: '{tribute} stops reading the niches in {zone} at the third name they know.',
            cause: 'Lost among the names', dodgeStat: 'willpower', sanity: 28, damage: 6, requires: { trait: 'Haunted' }, terrains: ['ruins'],
        },
        {
            text: 'The crematory chimney in {zone} still draws, and the Gamemakers have lit it. The ash that comes down on {tribute} is not from anything burned this century.',
            escapeText: '{tribute} sees the chimney in {zone} start to smoke and gets upwind.',
            cause: 'Choked on the old ash', dodgeStat: 'endurance', damage: 18, sanity: 10, requires: { time: 'day' }, terrains: ['ruins', 'open'],
        },
        {
            text: '{tribute} has dug in among the urns of {zone}, and the shelves they built their wall from were never load-bearing.',
            escapeText: '{tribute} hears the urn wall in {zone} shift and steps out from behind it before it comes down.',
            cause: 'Crushed by an urn wall', dodgeStat: 'agility', damage: 30, requires: { stance: ['Fortified'] }, terrains: ['ruins'],
        },
        {
            text: 'The grove\'s oldest yew in {zone} has berries, and yew berries are sweet, and {tribute} does not know that the seed inside them is not.',
            escapeText: '{tribute} eats the yew flesh in {zone} and spits every seed, which is the one way to eat a yew.',
            cause: 'Poisoned by the yew', dodgeStat: 'intelligence', poisoned: true, damage: 20, feed: 6, terrains: ['forest', 'open'],
        },
    ],
    kelvin: [
        {
            text: 'The cryo-lockers in {zone} have a manual override, and {tribute}, Clumsy, leans on it.',
            escapeText: '{tribute} feels the locker in {zone} start to cycle and gets an arm out before the seal.',
            cause: 'Sealed in a cryo-locker', dodgeStat: 'agility', dodgeDifficulty: 7, damage: 40, frostbitten: true, requires: { trait: 'Clumsy' }, terrains: ['ruins'],
        },
        {
            text: 'The liquid in the lab flasks of {zone} boils at the touch of a hand. {tribute} touches one.',
            escapeText: '{tribute} sees the frost on the flasks in {zone} and keeps their gloves on.',
            cause: 'Burned by cold', dodgeStat: 'intelligence', damage: 22, frostbitten: true, terrains: ['ruins'],
        },
        {
            text: 'The station\'s emergency lights in {zone} come on at once, and every tribute in the arena can see {tribute} standing in them.',
            escapeText: '{tribute} is under the catwalk when the lights in {zone} come on, and stays there.',
            cause: 'Caught in the emergency lights', dodgeStat: 'stealth', damage: 8, sanity: 8, requires: { time: 'night', stance: ['Evasive', 'Shadowing'] }, terrains: ['ruins', 'open'],
        },
        {
            text: '{tribute} puts a Brute\'s shoulder to the frozen bulkhead in {zone}, and the bulkhead was holding back the cold.',
            escapeText: '{tribute} feels the bulkhead in {zone} give a quarter-inch and lets it be.',
            cause: 'Froze when the bulkhead gave', dodgeStat: 'agility', damage: 36, frostbitten: true, zoneWide: true, startsZoneEffect: 'frozen', requires: { trait: 'Brute' }, terrains: ['ruins'],
        },
    ],
    silkwood: [
        {
            text: '{tribute}, Nimble and sure of it, takes the silk-bridge across {zone} at a run, and silk stretches.',
            escapeText: '{tribute} feels the silk in {zone} give and drops to all fours before it bounces them off.',
            cause: 'Thrown from a silk-bridge', dodgeStat: 'agility', damage: 32, bleeding: true, requires: { trait: 'Nimble' }, terrains: ['forest', 'highland'],
        },
        {
            text: 'The egg-sacs in {zone} hatch on the warmest day of the Games, all of them, and {tribute} is asleep under them.',
            escapeText: '{tribute} sees the sacs in {zone} twitch and is a zone away before the first one splits.',
            cause: 'Eaten by the hatching', dodgeStat: 'intelligence', damage: 30, poisoned: true, sanity: 16, requires: { time: 'day' }, terrains: ['forest'],
        },
        {
            text: '{tribute}, scavenging, pulls a pack out of the silk in {zone}, and the pack was bait.',
            escapeText: '{tribute} sees the silk around the pack in {zone} is fresh and leaves it.',
            cause: 'Taken from the silk', dodgeStat: 'intelligence', damage: 34, bleeding: true, poisoned: true, requires: { stance: ['Scavenging'] }, terrains: ['forest', 'ruins'],
        },
        {
            text: 'The silk in {zone} carries sound, and {tribute}, a Showman, has been talking to themselves.',
            escapeText: '{tribute} realises the silk in {zone} is humming with their own voice and shuts up.',
            cause: 'Found by their own voice', dodgeStat: 'stealth', damage: 20, requires: { trait: 'Showman', minSurvivors: 4 }, terrains: ['forest'],
        },
    ],
    nooneplace: [
        {
            text: '{tribute}, Paranoid, has been counting the doors in {zone}, and the count has changed, and they go to find the new one.',
            escapeText: '{tribute} counts the doors in {zone} again, gets the old number, and decides they were wrong the first time.',
            cause: 'Went through the new door', dodgeStat: 'willpower', damage: 26, sanity: 18, requires: { trait: 'Paranoid' }, terrains: ['ruins', 'open'],
        },
        {
            text: 'The water in {zone} reflects a sky that is not the one overhead. {tribute}, Fragile, looks too long.',
            escapeText: '{tribute} sees the wrong sky in the water of {zone} and does not look again.',
            cause: 'Lost in the reflection', dodgeStat: 'willpower', sanity: 30, requires: { trait: 'Fragile' }, terrains: ['water', 'wetland'],
        },
        {
            text: '{tribute}, desperate, runs the corridor in {zone} that does not end, and it does not end.',
            escapeText: '{tribute} stops running in {zone}, turns around, and the way back is one step long.',
            cause: 'Ran out of corridor', dodgeStat: 'intelligence', damage: 24, fatigue: 30, sanity: 12, requires: { stance: ['Desperate'] }, terrains: ['ruins'],
        },
        {
            text: 'The dark in {zone} after the anthem is total, and something in it is breathing in time with {tribute}.',
            escapeText: '{tribute} holds their breath in {zone} and the other breathing stops too.',
            cause: 'Taken by the thing that breathes', dodgeStat: 'stealth', dodgeAlt: 'willpower', damage: 28, sanity: 14, requires: { time: 'night', maxSurvivors: 8 }, terrains: ['ruins', 'open'],
        },
    ],
    redcathedral: [
        {
            text: 'The bell in {zone} has not rung since the Games began. {tribute}, Bloodthirsty, rings it to see who comes.',
            escapeText: '{tribute} has a hand on the bell-rope in {zone} and lets go of it.',
            cause: 'Killed by whoever came to the bell', dodgeStat: 'strength', damage: 30, bleeding: true, requires: { trait: 'Bloodthirsty', minSurvivors: 5 }, terrains: ['highland', 'ruins'],
        },
        {
            text: 'The red glass of {zone} focuses the noon sun onto one flagstone, and {tribute}, Fortified, has chosen that flagstone.',
            escapeText: '{tribute} feels the flagstone in {zone} start to cook and moves camp into the shadow of the pillar.',
            cause: 'Burned by the red glass', dodgeStat: 'intelligence', damage: 22, burned: true, requires: { time: 'day', stance: ['Fortified'] }, terrains: ['ruins', 'highland'],
        },
        {
            text: 'The choir loft in {zone} is reachable by one stair, and {tribute}, a Climber, takes the stair it has been waiting for.',
            escapeText: '{tribute} tests the loft stair in {zone} and the third tread comes away in their hand.',
            cause: 'Fell from the choir loft', dodgeStat: 'agility', damage: 38, bleeding: true, requires: { trait: 'Climber' }, terrains: ['ruins', 'highland'],
        },
        {
            text: '{tribute}, Softhearted, stops to close the eyes of the dead in {zone}, and the dead in {zone} were left as bait.',
            escapeText: '{tribute} kneels by the body in {zone}, sees the wire, and stands up very slowly.',
            cause: 'Killed at a baited corpse', dodgeStat: 'intelligence', damage: 32, bleeding: true, requires: { trait: 'Softhearted' }, terrains: ['ruins', 'open', 'highland'],
        },
    ],
    menagerie: [
        {
            text: 'The big-cat house in {zone} has a keeper\'s door, and {tribute}, Eagle-Eyed, spots the key still in it, and goes in.',
            escapeText: '{tribute} sees the key in {zone}, and sees the scratches on the inside of the door, and leaves the key where it is.',
            cause: 'Killed in the cat house', dodgeStat: 'agility', dodgeDifficulty: 7, damage: 44, bleeding: true, requires: { trait: 'Eagle-Eyed' }, terrains: ['ruins'],
        },
        {
            text: 'The feeding bell in {zone} rings at dusk as it has every dusk for years, and everything in the arena that was ever fed to it comes, and {tribute} is standing where the food used to be.',
            escapeText: '{tribute} hears the feeding bell in {zone} and is up the enclosure wall before the first thing arrives.',
            cause: 'Eaten at feeding time', dodgeStat: 'agility', damage: 34, bleeding: true, requires: { time: 'night' }, zoneWide: true, terrains: ['open', 'ruins'],
        },
        {
            text: 'The reptile house in {zone} is warm, and {tribute}, shadowing, waits in it for their quarry to pass, and the reptile house is warm for a reason.',
            escapeText: '{tribute} feels the floor of the reptile house in {zone} move and is not in it any more.',
            cause: 'Killed in the reptile house', dodgeStat: 'stealth', damage: 28, poisoned: true, requires: { stance: ['Shadowing', 'Evasive'] }, terrains: ['ruins'],
        },
        {
            text: 'The aviary net over {zone} has a tear in it, and the things that have been kept under the net for a generation have found it, and then they find {tribute}.',
            escapeText: '{tribute} sees the net over {zone} sag and stays under the walkway roof.',
            cause: 'Taken by the aviary', dodgeStat: 'agility', damage: 26, bleeding: true, requires: { time: 'day' }, terrains: ['open', 'forest'],
        },
    ],
};
