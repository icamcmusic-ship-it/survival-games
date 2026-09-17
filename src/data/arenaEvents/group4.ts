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
            text: 'The swing set in {zone} still moves. {tribute} sits on it and the chain, which has carried a child\'s weight for twenty years, parts under theirs.',
            escapeText: '{tribute} pushes the swing in {zone} once, watches the chain, and leaves it.',
            cause: 'Killed by a playground', dodgeStat: 'intelligence', dodgeAlt: 'willpower', damage: 26, bleeding: true, requires: { sanityBand: 'frayed' }, terrains: ['open'],
        },
        {
            text: 'Every house on the loop has a dog door. {tribute} goes through one head first into a kitchen that has been sealed since the estate emptied.',
            escapeText: '{tribute} puts an arm through the dog door in {zone}, smells the kitchen, and pulls the arm back.',
            cause: 'Killed by what was in the kitchen', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 24, poisoned: true, requires: { stance: ['Hunting', 'Aggressive'] }, terrains: ['ruins'],
        },
        {
            text: 'The sprinklers in {zone} come on at six as they have every evening for two decades. {tribute} is on the lawn when twenty years of standing water comes up.',
            escapeText: '{tribute} hears the pipes in {zone} knock and is out of the lawn before the heads rise.',
            cause: 'Poisoned by the sprinklers', dodgeStat: 'agility', dodgeAlt: 'endurance', poisoned: true, damage: 12, requires: { time: 'night' }, terrains: ['open', 'ruins'],
        },
        {
            text: '{tribute} goes back into the burning garage in {zone} for a pack belonging to somebody else.',
            escapeText: '{tribute} gets to the garage door in {zone} and the heat makes the decision for them.',
            cause: 'Burned going back for a friend\'s pack', dodgeStat: 'endurance', dodgeAlt: 'strength', damage: 34, burned: true, requires: { trait: 'Loyal', effect: 'burning' }, terrains: ['ruins'],
        },
    ],
    ashgrove: [
        {
            text: 'The columbarium in {zone} has a thousand niches. {tribute} reads the names on them until they find their own.',
            escapeText: '{tribute} stops reading the niches in {zone} at the third name they know.',
            cause: 'Lost among the names', dodgeStat: 'willpower', dodgeAlt: 'endurance', sanity: 28, damage: 6, requires: { trait: 'Haunted' }, terrains: ['ruins'],
        },
        {
            text: 'The Gamemakers light the crematory chimney in {zone}. What comes down on {tribute} is a century of old ash out of the flue.',
            escapeText: '{tribute} sees the chimney in {zone} start to smoke and gets upwind.',
            cause: 'Choked on the old ash', dodgeStat: 'endurance', dodgeAlt: 'strength', damage: 18, sanity: 10, requires: { time: 'day' }, terrains: ['ruins', 'open'],
        },
        {
            text: '{tribute} has built a wall out of the urn shelving in {zone}. It was not built to carry anything and it comes down on them.',
            escapeText: '{tribute} hears the urn wall in {zone} shift and steps out from behind it before it comes down.',
            cause: 'Crushed by an urn wall', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 30, requires: { stance: ['Fortified'] }, terrains: ['ruins'],
        },
        {
            text: 'The oldest yew in {zone} is in berry. The flesh is sweet and the seed inside it is not, and {tribute} eats both.',
            escapeText: '{tribute} eats the yew flesh in {zone} and spits every seed, which is the one way to eat a yew.',
            cause: 'Poisoned by the yew', dodgeStat: 'intelligence', dodgeAlt: 'willpower', poisoned: true, damage: 20, feed: 6, terrains: ['forest', 'open'],
        },
    ],
    kelvin: [
        {
            text: 'The cryo-lockers in {zone} have a manual override at waist height. {tribute} leans on it.',
            escapeText: '{tribute} feels the locker in {zone} start to cycle and gets an arm out before the seal.',
            cause: 'Sealed in a cryo-locker', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 7, damage: 40, frostbitten: true, requires: { trait: 'Clumsy' }, terrains: ['ruins'],
        },
        {
            text: 'The liquid in the lab flasks of {zone} boils at blood heat. {tribute} puts a hand round one.',
            escapeText: '{tribute} sees the frost on the flasks in {zone} and keeps their gloves on.',
            cause: 'Burned by cold', dodgeStat: 'intelligence', dodgeAlt: 'willpower', damage: 22, frostbitten: true, terrains: ['ruins'],
        },
        {
            text: 'The station\'s emergency lights in {zone} come on at once with {tribute} standing in them, in view of the whole shelf.',
            escapeText: '{tribute} is under the catwalk when the lights in {zone} come on, and stays there.',
            cause: 'Caught in the emergency lights', dodgeStat: 'stealth', dodgeAlt: 'agility', damage: 8, sanity: 8, requires: { time: 'night', stance: ['Evasive', 'Shadowing'] }, terrains: ['ruins', 'open'],
        },
        {
            text: '{tribute} puts a shoulder to the frozen bulkhead in {zone}. It was holding the outside out.',
            escapeText: '{tribute} feels the bulkhead in {zone} give a quarter-inch and lets it be.',
            cause: 'Froze when the bulkhead gave', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 36, frostbitten: true, zoneWide: true, startsZoneEffect: 'frozen', requires: { trait: 'Brute' }, terrains: ['ruins'],
        },
    ],
    silkwood: [
        {
            text: '{tribute} takes the silk-bridge across {zone} at a run. Silk stretches under a running weight and the far anchor comes out.',
            escapeText: '{tribute} feels the silk in {zone} give and drops to all fours before it bounces them off.',
            cause: 'Thrown from a silk-bridge', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 32, bleeding: true, requires: { trait: 'Nimble' }, terrains: ['forest', 'highland'],
        },
        {
            text: 'Every egg-sac in {zone} hatches on the warmest day of the Games. {tribute} is asleep under them.',
            escapeText: '{tribute} sees the sacs in {zone} twitch and is a zone away before the first one splits.',
            cause: 'Eaten by the hatching', dodgeStat: 'intelligence', dodgeAlt: 'willpower', damage: 30, poisoned: true, sanity: 16, requires: { time: 'day' }, terrains: ['forest'],
        },
        {
            text: '{tribute} pulls a pack out of the silk in {zone}. It was tied in rather than caught.',
            escapeText: '{tribute} sees the silk around the pack in {zone} is fresh and leaves it.',
            cause: 'Taken from the silk', dodgeStat: 'intelligence', dodgeAlt: 'willpower', damage: 34, bleeding: true, poisoned: true, requires: { stance: ['Scavenging'] }, terrains: ['forest', 'ruins'],
        },
        {
            text: 'The silk in {zone} carries sound the length of the wood, and {tribute} has been talking aloud all morning.',
            escapeText: '{tribute} realises the silk in {zone} is humming with their own voice and shuts up.',
            cause: 'Found by their own voice', dodgeStat: 'stealth', dodgeAlt: 'agility', damage: 20, requires: { trait: 'Showman', minSurvivors: 4 }, terrains: ['forest'],
        },
    ],
    nooneplace: [
        {
            text: '{tribute} has counted the doors in {zone} every day. Today the count is one higher, and they go looking for the new one.',
            escapeText: '{tribute} counts the doors in {zone} again, gets the old number, and decides they were wrong the first time.',
            cause: 'Went through the new door', dodgeStat: 'willpower', dodgeAlt: 'endurance', damage: 26, sanity: 18, requires: { trait: 'Paranoid' }, terrains: ['ruins', 'open'],
        },
        {
            text: 'The water in {zone} reflects a sky that is not the one overhead. {tribute} looks into it for a quarter of an hour.',
            escapeText: '{tribute} sees the wrong sky in the water of {zone} and does not look again.',
            cause: 'Lost in the reflection', dodgeStat: 'willpower', dodgeAlt: 'endurance', sanity: 30, requires: { trait: 'Fragile' }, terrains: ['water', 'wetland'],
        },
        {
            text: '{tribute} runs the corridor in {zone} for forty minutes without reaching the end of it.',
            escapeText: '{tribute} stops running in {zone}, turns around, and the way back is one step long.',
            cause: 'Ran out of corridor', dodgeStat: 'intelligence', dodgeAlt: 'willpower', damage: 24, fatigue: 30, sanity: 12, requires: { stance: ['Desperate'] }, terrains: ['ruins'],
        },
        {
            text: 'The dark in {zone} after the anthem is total, and something in it is breathing at {tribute}\'s rate.',
            escapeText: '{tribute} holds their breath in {zone} and the other breathing stops too.',
            cause: 'Taken by the thing that breathes', dodgeStat: 'stealth', dodgeAlt: 'willpower', damage: 28, sanity: 14, requires: { time: 'night', maxSurvivors: 8 }, terrains: ['ruins', 'open'],
        },
    ],
    redcathedral: [
        {
            text: 'The bell in {zone} has not rung since the Games began. {tribute} rings it.',
            escapeText: '{tribute} has a hand on the bell-rope in {zone} and lets go of it.',
            cause: 'Killed by whoever came to the bell', dodgeStat: 'strength', dodgeAlt: 'agility', damage: 30, bleeding: true, requires: { trait: 'Bloodthirsty', minSurvivors: 5 }, terrains: ['highland', 'ruins'],
        },
        {
            text: 'The red glass of {zone} focuses the noon sun onto one flagstone. {tribute} has built their position on it.',
            escapeText: '{tribute} feels the flagstone in {zone} start to cook and moves camp into the shadow of the pillar.',
            cause: 'Burned by the red glass', dodgeStat: 'intelligence', dodgeAlt: 'willpower', damage: 22, burned: true, requires: { time: 'day', stance: ['Fortified'] }, terrains: ['ruins', 'highland'],
        },
        {
            text: 'The choir loft in {zone} is reached by one stair. {tribute} takes it and the treads go under them.',
            escapeText: '{tribute} tests the loft stair in {zone} and the third tread comes away in their hand.',
            cause: 'Fell from the choir loft', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 38, bleeding: true, requires: { trait: 'Climber' }, terrains: ['ruins', 'highland'],
        },
        {
            text: '{tribute} stops to close the eyes of the dead in {zone}. The body was laid out where it is on purpose.',
            escapeText: '{tribute} kneels by the body in {zone}, sees the wire, and stands up very slowly.',
            cause: 'Killed at a baited corpse', dodgeStat: 'intelligence', dodgeAlt: 'willpower', damage: 32, bleeding: true, requires: { trait: 'Softhearted' }, terrains: ['ruins', 'open', 'highland'],
        },
    ],
    menagerie: [
        {
            text: 'The keeper\'s door to the big-cat house in {zone} still has the key in it. {tribute} sees it and goes in.',
            escapeText: '{tribute} sees the key in {zone}, and sees the scratches on the inside of the door, and leaves the key where it is.',
            cause: 'Killed in the cat house', dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 7, damage: 44, bleeding: true, requires: { trait: 'Eagle-Eyed' }, terrains: ['ruins'],
        },
        {
            text: 'The feeding bell in {zone} rings at dusk as it has for years. Everything that was ever fed to it comes, and {tribute} is standing where the food used to go.',
            escapeText: '{tribute} hears the feeding bell in {zone} and is up the enclosure wall before the first thing arrives.',
            cause: 'Eaten at feeding time', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 34, bleeding: true, requires: { time: 'night' }, zoneWide: true, terrains: ['open', 'ruins'],
        },
        {
            text: 'The reptile house in {zone} is still heated. {tribute} waits inside it for their quarry to pass.',
            escapeText: '{tribute} feels the floor of the reptile house in {zone} move and is not in it any more.',
            cause: 'Killed in the reptile house', dodgeStat: 'stealth', dodgeAlt: 'agility', damage: 28, poisoned: true, requires: { stance: ['Shadowing', 'Evasive'] }, terrains: ['ruins'],
        },
        {
            text: 'The aviary net over {zone} has torn and what was under it has been out for days. It comes down on {tribute}.',
            escapeText: '{tribute} sees the net over {zone} sag and stays under the walkway roof.',
            cause: 'Taken by the aviary', dodgeStat: 'agility', dodgeAlt: 'endurance', damage: 26, bleeding: true, requires: { time: 'day' }, terrains: ['open', 'forest'],
        },
    ],
};
