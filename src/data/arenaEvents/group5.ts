import type { ArenaEventDef } from '../arenaFlavor';

/**
 * AUDIT-7 §7.3: the bottom of the unique-death table, and the three arenas
 * with no water in them.
 *
 * Measured across the 45 hand-authored packs, lethal causes ran 17 (nooneplace,
 * vigil) to 39 (vigil's opposite end) — a 2.3x spread, and the six thinnest were
 * with one exception the six most recently authored. Two deaths each for those,
 * in the arena's own idiom rather than in the shared universal voice.
 *
 * The other half is `validate-arenas`' standing note: **frozen, warren and
 * silkwood have no water source at all.** That is a deliberate design choice
 * and it has a consequence nobody wrote for — those three arenas' thirst deaths
 * came out of the universal pool, in the shared voice, so the one thing that
 * most distinguishes them was the one thing they did not say themselves. Dying
 * of thirst in a frozen waste surrounded by ice you cannot melt is the arena's
 * whole thesis.
 *
 * Every entry gates on state the schema already offers. The thirst ones use
 * `requires.thirstAbove`, added in §7.2 for exactly this.
 */
export const EXTRA_ARENA_EVENTS_GROUP5: Record<string, ArenaEventDef[]> = {
    labyrinth: [
        {
            text: '{tribute} takes the left turn in {zone} for the fourth time. It is the fourth time. They know it is the fourth time. They take it anyway, because the alternative is admitting what that means.',
            escapeText: '{tribute} marks the corner in {zone} with a scrape of a heel, and the next time round they see the mark and go right.',
            cause: 'Took a turn they had already taken', code: 'hazard',
            dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7,
            damage: 26, sanity: 20, fatigue: 18, terrains: ['forest', 'open'],
            requires: { sanityBand: 'frayed' },
        },
        {
            text: 'The hedge {tribute} came through in {zone} is not behind them any more. There is hedge where the way in was, and it is not new hedge.',
            escapeText: '{tribute} keeps one hand on the hedge in {zone} the whole way, the way you would in the dark, and comes out where they went in.',
            cause: 'The hedge closed behind them', code: 'hazard',
            dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 8,
            damage: 30, sanity: 16, terrains: ['forest'], witnesses: true,
        },
        {
            text: 'There is no water in a hedge maze. {tribute} has worked this out in {zone} about two days later than they needed to.',
            escapeText: '{tribute} finds a puddle in {zone} standing in the crook of a root, and does not care what is in it.',
            cause: 'Died of thirst inside a green place', code: 'dehydration',
            dodgeStat: 'endurance', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 30, thirst: 15, terrains: ['forest', 'open'],
            requires: { thirstAbove: 60 },
        },
    ],
    nooneplace: [
        {
            text: 'Somebody says a name in {zone} and {tribute} answers to it. It is not their name. They do not work that out until later, and later is a word that has stopped meaning much here.',
            escapeText: 'Somebody says a name in {zone} that is almost {tribute}\'s, and {tribute} does not turn round, which takes everything they have.',
            cause: 'Answered to a name that was not theirs', code: 'hazard',
            dodgeStat: 'willpower', dodgeAlt: 'intelligence', dodgeDifficulty: 8,
            damage: 24, sanity: 24, terrains: ['open', 'ruins'],
            requires: { sanityBand: 'frayed' },
        },
        {
            text: '{tribute} goes back into the room in {zone} they slept in. It has a window now. It did not have a window.',
            escapeText: '{tribute} counts the doors in {zone} on the way in and counts them again on the way out, and the number holds.',
            cause: 'Walked into a room that was not there yesterday', code: 'hazard',
            dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 8,
            damage: 28, sanity: 20, terrains: ['ruins', 'urban'],
        },
    ],
    kelvin: [
        {
            text: 'The station is breathing through {zone} and it has never once breathed anything a body wanted. {tribute} is in the middle of the room when the scrubbers cycle.',
            escapeText: '{tribute} hears the scrubbers in {zone} start their cycle and is in the corridor before the room finishes changing.',
            cause: 'Killed by the station\'s own atmosphere',
            dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 7,
            damage: 36, poisoned: true, zoneWide: true, terrains: ['ruins'],
        },
        {
            text: 'The bulkhead in {zone} closes the way bulkheads do, which is once. {tribute} is on the side of it with no supplies and no way back.',
            escapeText: '{tribute} jams the bulkhead track in {zone} with a length of something and gets through it.',
            cause: 'Sealed on the wrong side of a bulkhead', code: 'hazard',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 8,
            damage: 32, thirst: 18, hunger: 18, terrains: ['ruins'],
        },
    ],
    storywood: [
        {
            text: 'The wood in {zone} has an ending in mind for {tribute} and it was written before they got here. It is not a good one and it is very well constructed.',
            escapeText: '{tribute} recognises the shape of the story they are standing in, in {zone}, and does the one thing it does not account for.',
            cause: 'Given an ending somebody else had written', code: 'hazard',
            dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 8,
            damage: 34, sanity: 18, terrains: ['forest'], witnesses: true,
        },
        {
            text: 'There is a thing in the second verse that everybody\'s grandmother left out. In {zone}, {tribute} meets the part of the song nobody sings.',
            escapeText: '{tribute} remembers the second verse in {zone} before it remembers them, and goes the other way around the clearing.',
            cause: 'Taken by the thing in the second verse', code: 'hazard',
            dodgeStat: 'willpower', dodgeAlt: 'agility', dodgeDifficulty: 8,
            damage: 40, bleeding: true, sanity: 14, terrains: ['forest'],
            requires: { time: 'night' },
        },
    ],
    karst: [
        {
            text: 'The water table under {zone} comes up in the night, the way it has every spring for ten thousand years, and {tribute} is asleep below it.',
            escapeText: '{tribute} wakes in {zone} with wet boots and moves uphill in the dark without waiting to find out how fast.',
            cause: 'The water table rose while they slept', code: 'hazard',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 8,
            damage: 42, terrains: ['cave', 'water'], zoneWide: true,
            requires: { time: 'night' },
        },
        {
            text: '{tribute} goes down the passage in {zone} head first because there is no other way to go down it, and finds out at the narrow part that it does not widen again.',
            escapeText: '{tribute} tries the passage in {zone} feet first, which is slower and is the reason they come back out of it.',
            cause: 'Went into a passage that only goes one way', code: 'hazard',
            dodgeStat: 'agility', dodgeAlt: 'willpower', dodgeDifficulty: 8,
            damage: 38, fatigue: 22, sanity: 16, terrains: ['cave'],
        },
    ],
    vigil: [
        {
            text: 'The watch {tribute} is keeping in {zone} is the fourth in a row and nobody relieved them, because there is nobody to. The body files the objection eventually.',
            escapeText: '{tribute} hands the watch in {zone} over to nobody, formally, out loud, and then sleeps for six hours.',
            cause: 'Died standing a watch nobody relieved', code: 'hazard',
            dodgeStat: 'endurance', dodgeAlt: 'willpower', dodgeDifficulty: 7,
            damage: 32, fatigue: 25, terrains: ['open', 'ruins'],
            requires: { fatigueAbove: 45 },
        },
        {
            text: 'Something in {zone} has been keeping a vigil far longer than {tribute} has, and tonight it decides the shift is over.',
            escapeText: '{tribute} feels the attention in {zone} shift off them, which is worse than having it, and moves out of the sector before dawn.',
            cause: 'Relieved of the watch', code: 'hazard',
            dodgeStat: 'stealth', dodgeAlt: 'willpower', dodgeDifficulty: 8,
            damage: 40, sanity: 20, terrains: ['open', 'ruins'],
            requires: { time: 'night' },
        },
    ],

    // ---- the three arenas with no water in them -----------------------------
    frozen: [
        {
            text: 'There is nothing to drink in {zone} and everything to drink in {zone}. {tribute} eats snow, which takes more out of a body than it puts in, and keeps eating it.',
            escapeText: '{tribute} melts snow against their own skin in {zone}, a mouthful at a time, the slow way, which is the only way that works.',
            cause: 'Ate snow and died of it', code: 'hypothermia',
            dodgeStat: 'intelligence', dodgeAlt: 'endurance', dodgeDifficulty: 7,
            damage: 26, frostbitten: true, quench: 8, terrains: ['ice', 'open', 'highland'],
            requires: { thirstAbove: 55 },
        },
        {
            text: '{tribute} is standing on more fresh water than any tribute in the history of these Games and cannot get at a mouthful of it.',
            escapeText: '{tribute} works a hollow into the ice of {zone} and gets sun into it, and by afternoon there is an inch of water in the bottom.',
            cause: 'Died of thirst standing on a continent of ice', code: 'dehydration',
            dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 8,
            damage: 34, terrains: ['ice', 'highland'],
            requires: { thirstAbove: 68 },
        },
    ],
    warren: [
        {
            text: 'The run {tribute} is in floods from the far end, and a warren does not have two ends.',
            escapeText: '{tribute} hears the water coming down the run in {zone} and takes the side passage they noted yesterday for exactly this.',
            cause: 'Drowned in a flooded run',
            dodgeStat: 'agility', dodgeAlt: 'endurance', dodgeDifficulty: 8,
            damage: 46, terrains: ['cave', 'ruins'], zoneWide: true,
        },
        {
            text: 'There is a seep two tunnels from where {tribute} is lying in {zone}. They have been past it twice. They are not going to be past it a third time.',
            escapeText: '{tribute} follows the cold on the air in {zone} to the seep, and puts their face in it.',
            cause: 'Died of thirst two tunnels from water', code: 'dehydration',
            dodgeStat: 'intelligence', dodgeAlt: 'endurance', dodgeDifficulty: 7,
            damage: 30, terrains: ['cave', 'ruins'],
            requires: { thirstAbove: 62 },
        },
    ],
    silkwood: [
        {
            text: 'What takes {tribute} in {zone} does not kill them first. That is not how it is done here, and it is not an oversight.',
            escapeText: '{tribute} gets an arm free of the wrapping in {zone} and then the rest of themselves, and does not look at what was doing it.',
            cause: 'Wrapped and kept', code: 'hazard',
            dodgeStat: 'strength', dodgeAlt: 'agility', dodgeDifficulty: 8,
            damage: 44, bleeding: true, sanity: 22, terrains: ['forest'], witnesses: true,
        },
        {
            text: 'Every strand above {zone} is beaded with dew at first light and none of it is {tribute}\'s. They have been watching it for three mornings.',
            escapeText: '{tribute} runs a length of silk through their fingers in {zone} at dawn and licks the dew off them, and does it again, and again.',
            cause: 'Died of thirst under a canopy of dew', code: 'dehydration',
            dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7,
            damage: 28, quench: 6, terrains: ['forest'],
            requires: { thirstAbove: 58 },
        },
    ],
};
