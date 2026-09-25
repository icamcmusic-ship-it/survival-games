import type { ArenaEventDef } from '../arenaFlavor';
import { AUDIT11_EVENTS, ENCOUNTERS } from '../balance';

/**
 * AUDIT-11 §7, §9 and §10: new ways to die, and new things to happen.
 *
 * Two halves. `EXTRA_ARENA_EVENTS_GROUP6` deepens the thinnest arenas (the
 * labyrinth, Nooneplace, the Story Wood, Kelvin-9 and the Warren each gain a
 * handful of events and one three-day chain — setup, complication,
 * resolution) and gives the §9 arena-specific deaths to the Salt Mirror,
 * Clockwork Island, the Menagerie, the Carnival and the Vault.
 * `UNIVERSAL_EVENTS_GROUP6` is appended to the shared universal pool: the §9
 * universal causes and the §10 universal beats.
 *
 * Every entry here declares its `code` — the §9 housekeeping point is that an
 * authored event should say what killed somebody rather than leave it to a
 * regex over the obituary.
 */
const AUTHORED_ARENA_EVENTS: Record<string, ArenaEventDef[]> = {
    labyrinth: [
        {
            text: 'The walls of {zone} move in the night, the way they do, and {tribute} is asleep against one of them when it meets the next.',
            escapeText: '{tribute} wakes to the grinding in {zone} and rolls clear as the two walls close on the place they were lying.',
            cause: 'Crushed between shifting walls',
            code: 'collapse',
            dodgeStat: 'agility', dodgeAlt: 'willpower', dodgeDifficulty: 8,
            damage: 44, terrains: ['forest', 'open'], witnesses: true,
            requires: { time: 'night' },
        },
        {
            text: '{tribute} has walked the same dead end in {zone} for most of a day. There is no food in a dead end and there is no way out of this one they can find.',
            escapeText: '{tribute} stops walking in {zone}, sits down, and works out the turn from the sun instead of the hedge.',
            cause: 'Starved lost in a dead end',
            code: 'starvation',
            dodgeStat: 'intelligence', dodgeAlt: 'endurance', dodgeDifficulty: 7,
            damage: 30, hunger: 18, terrains: ['forest', 'open'],
            requires: { hungerAbove: 60 },
        },
        {
            text: 'Somebody has chalked an arrow on the hedge in {zone}. {tribute} follows it, and the next one, and the one after that leads onto a drop.',
            escapeText: '{tribute} checks the chalk in {zone} against their own marks, sees the hand is different, and goes the other way.',
            cause: 'Followed a falsified chalk mark',
            code: 'fall',
            dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 7,
            damage: 32, terrains: ['forest', 'open'],
        },
        {
            text: '{tribute} leaves chalk marks all through {zone}, carefully, and in the morning somebody else is using them.',
            escapeText: '',
            cause: 'Chalk marks',
            sanity: -6, terrains: ['forest', 'open'],
        },
        // ---- chain: the minotaur walk ----
        {
            id: 'labyrinth-the-minotaur-walks',
            oncePerRun: true,
            chain: 'labyrinth-the-minotaur-turns',
            text: 'Something heavy is walking the hedges around {zone}. {tribute} hears it pass on the other side of the wall, slow, patient, going round.',
            escapeText: '{tribute} holds still in {zone} until the footsteps on the far side of the hedge have gone past twice.',
            cause: 'Found by the thing that walks the maze',
            code: 'mutt',
            dodgeStat: 'stealth', dodgeAlt: 'willpower', dodgeDifficulty: 6,
            damage: 10, sanity: 14, terrains: ['forest', 'open'],
        },
        {
            id: 'labyrinth-the-minotaur-turns',
            oncePerRun: true,
            weight: 0.15,
            chain: 'labyrinth-the-minotaur-ends',
            text: 'The footsteps stop on the other side of the hedge in {zone}. Then they start again, coming the way {tribute} came.',
            escapeText: '{tribute} runs {zone} left-handed, the way the old story says, and the footsteps fall behind.',
            cause: 'Run down in the maze',
            code: 'mutt',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 26, bleeding: true, sanity: 10, terrains: ['forest', 'open'],
        },
        {
            id: 'labyrinth-the-minotaur-ends',
            oncePerRun: true,
            weight: 0.15,
            text: 'At the centre of {zone} there is a thing with a bull\'s head waiting, and {tribute} has walked straight to it, because every path does.',
            escapeText: '{tribute} reaches the centre of {zone}, sees what is there, and takes the one path out that the walls forgot to close.',
            cause: 'Gored at the centre of the maze',
            code: 'mutt',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 8,
            damage: 48, bleeding: true, terrains: ['forest', 'open'], witnesses: true,
        },
    ],
    nooneplace: [
        {
            text: '{tribute} walks into {zone} and the way back is not there when they turn round. It is not blocked. It has simply never been.',
            escapeText: '{tribute} ties a strip of cloth at the edge of {zone} before stepping in, and the cloth is still there when they need it.',
            cause: 'Walked into a sector that erased the way back',
            code: 'exposure',
            dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 8,
            damage: 34, fatigue: 16, sanity: 14, terrains: ['open', 'ruins'],
        },
        {
            text: 'Nobody in {zone} remembers {tribute} arriving, including {tribute}.',
            escapeText: '{tribute} says their own name aloud in {zone} every hour, and it keeps.',
            cause: 'Forgotten by the room they were standing in',
            code: 'exposure',
            dodgeStat: 'willpower', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 22, sanity: 22, terrains: ['ruins', 'open'],
            requires: { sanityBand: 'frayed' },
        },
        {
            text: '{tribute} is sure there was somebody else in {zone} yesterday, and cannot say who, and it will not leave them alone.',
            escapeText: '',
            cause: 'The sector forgets',
            sanity: 8, terrains: ['ruins', 'open', 'wetland'],
        },
        {
            text: 'The water in {zone} was there this morning. It is there now. {tribute} cannot, however hard they try, remember where.',
            escapeText: '{tribute} scratches a map of {zone} into their own forearm and drinks where the scratch says.',
            cause: 'Forgot where the water was',
            code: 'dehydration',
            dodgeStat: 'intelligence', dodgeAlt: 'endurance', dodgeDifficulty: 7,
            damage: 28, thirst: 16, terrains: ['ruins', 'open', 'water'],
            requires: { thirstAbove: 58 },
        },
        // ---- chain: the empty chair ----
        {
            id: 'nooneplace-the-empty-chair',
            oncePerRun: true,
            chain: 'nooneplace-the-chair-is-yours',
            text: 'There is a chair in {zone} laid for one, and a place card on it, and the card is blank. {tribute} does not sit down.',
            escapeText: '{tribute} turns the chair in {zone} to the wall and walks away.',
            cause: 'Sat down in the empty chair',
            code: 'exposure',
            dodgeStat: 'willpower', dodgeDifficulty: 6,
            damage: 8, sanity: 12, terrains: ['ruins', 'open'],
        },
        {
            id: 'nooneplace-the-chair-is-yours',
            oncePerRun: true,
            weight: 0.15,
            chain: 'nooneplace-the-card-is-written',
            text: 'The chair is in {zone} too. It has followed {tribute}, or {zone} has followed them. The card still says nothing.',
            escapeText: '{tribute} breaks the chair in {zone} into kindling and burns it, which helps for a surprisingly long time.',
            cause: 'Kept by the chair',
            code: 'exposure',
            dodgeStat: 'willpower', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 18, sanity: 18, terrains: ['ruins', 'open'],
        },
        {
            id: 'nooneplace-the-card-is-written',
            oncePerRun: true,
            weight: 0.15,
            text: 'The card on the chair in {zone} has a name on it now. It is {tribute}\'s, in {tribute}\'s own hand, and they sit down.',
            escapeText: '{tribute} reads their own name on the card in {zone}, crosses it out, and writes somebody else\'s.',
            cause: 'Took their place at the table',
            code: 'exposure',
            dodgeStat: 'willpower', dodgeAlt: 'charisma', dodgeDifficulty: 8,
            damage: 40, sanity: 20, terrains: ['ruins', 'open'], witnesses: true,
        },
    ],
    storywood: [
        {
            text: 'There is a cottage in {zone} made of things to eat, and {tribute} has not eaten in two days, and the story says what it says.',
            escapeText: '{tribute} knows how this one goes and walks past the cottage in {zone} without touching the door.',
            cause: 'Ate from the gingerbread cottage',
            code: 'poison',
            dodgeStat: 'willpower', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 34, poisoned: true, feed: 10, terrains: ['forest', 'ruins'],
            requires: { hungerAbove: 55 },
        },
        {
            text: 'A spinning wheel stands in the tower room in {zone}. {tribute} reaches past it for something on the shelf and the spindle is sharper than it looks.',
            escapeText: '{tribute} sees the spindle in {zone} for what it is and knocks the wheel over with a boot before going near the shelf.',
            cause: 'Pricked on the spindle and slept in the cold',
            code: 'exposure',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 30, fatigue: 30, terrains: ['ruins', 'forest'],
        },
        {
            text: 'The well in {zone} answers when {tribute} calls down it. It gives good advice, and then it asks for something back.',
            escapeText: '{tribute} drinks from the well in {zone} and does not say thank you, which is the one rule the story forgets to mention.',
            cause: 'Paid the well what it asked',
            code: 'drowning',
            dodgeStat: 'willpower', dodgeAlt: 'charisma', dodgeDifficulty: 7,
            damage: 36, quench: 20, terrains: ['water', 'ruins', 'forest'],
        },
        {
            text: '{tribute} finds bread crumbs laid in a line across {zone}, and the birds have not had them, which is the strange part.',
            escapeText: '',
            cause: 'A trail of crumbs',
            feed: 8, terrains: ['forest', 'open'],
        },
        // ---- chain: the tower and the rope of hair ----
        {
            id: 'storywood-the-tower',
            oncePerRun: true,
            chain: 'storywood-the-rope-of-hair',
            text: 'There is a tower in {zone} with no door and one window, and a voice at the window asks {tribute} to call up to it.',
            escapeText: '{tribute} does not call up to the window in {zone}, and the voice goes quiet, and waits.',
            cause: 'Answered the tower',
            code: 'fall',
            dodgeStat: 'willpower', dodgeDifficulty: 6,
            damage: 6, sanity: 10, terrains: ['ruins', 'forest'],
        },
        {
            id: 'storywood-the-rope-of-hair',
            oncePerRun: true,
            weight: 0.15,
            chain: 'storywood-the-hair-is-cut',
            text: 'A rope of golden hair comes down from the tower in {zone}. {tribute} climbs it, because there are supplies at the top, and because it is that kind of story.',
            escapeText: '{tribute} tests the hair in {zone} with their whole weight at the bottom before trusting it at the top.',
            cause: 'Fell from the tower',
            code: 'fall',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 7,
            damage: 26, feed: 12, quench: 12, terrains: ['ruins', 'forest'],
        },
        {
            id: 'storywood-the-hair-is-cut',
            oncePerRun: true,
            weight: 0.15,
            text: 'Somebody cuts the hair while {tribute} is halfway down the tower in {zone}, and every version of the story agrees on what happens next.',
            escapeText: '{tribute} feels the hair go slack above them in {zone} and is on the wall with both hands before it falls.',
            cause: 'Fell when the rope of hair was cut',
            code: 'fall',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 8,
            damage: 46, terrains: ['ruins', 'forest'], witnesses: true,
        },
    ],
    kelvin: [
        {
            text: 'The seal on {zone} goes with a sound like a cough. The air leaves first. {tribute} is between it and the breach.',
            escapeText: '{tribute} hears the seal in {zone} start to whistle and is through the bulkhead before it lets go.',
            cause: 'Decompression',
            code: 'asphyxiation',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 8,
            damage: 48, zoneWide: true, terrains: ['ruins', 'highland'], witnesses: true,
        },
        {
            text: 'The module {tribute} has sealed themselves into in {zone} is safe from everything except its own air, which has been getting thicker for a day.',
            escapeText: '{tribute} notices the headache in {zone} for what it is and cracks the seal, cold and all.',
            cause: 'CO2 build-up in a sealed module',
            code: 'asphyxiation',
            dodgeStat: 'intelligence', dodgeAlt: 'endurance', dodgeDifficulty: 7,
            damage: 36, fatigue: 18, terrains: ['ruins'],
            requires: { stance: ['Fortified', 'Defensive'] },
        },
        {
            text: '{tribute} leans on the outer hull in {zone} to rest, bare-handed, and the metal is a great deal colder than the air.',
            escapeText: '{tribute} feels the hull in {zone} bite and tears the hand away, skin and all, before the rest of them follows.',
            cause: 'Frozen to a hull',
            code: 'hypothermia',
            dodgeStat: 'strength', dodgeAlt: 'willpower', dodgeDifficulty: 7,
            damage: 34, frostbitten: true, terrains: ['ruins', 'highland', 'open'],
        },
        {
            text: 'The oxygen budget for {zone} is posted on the wall and {tribute} has been reading it wrong for two days.',
            escapeText: '',
            cause: 'The oxygen budget',
            fatigue: 8, terrains: ['ruins', 'open'],
        },
        // ---- chain: the reactor leak ----
        {
            id: 'kelvin-the-reactor-ticks',
            oncePerRun: true,
            chain: 'kelvin-the-reactor-leaks',
            text: 'The reactor housing in {zone} has started ticking, the way cooling metal ticks, except that it is getting warmer. {tribute} stays too long working out why.',
            escapeText: '{tribute} does not need to know why the housing in {zone} is ticking and is two modules away by the time it matters.',
            cause: 'Stayed too long by the reactor',
            code: 'burns',
            dodgeStat: 'intelligence', dodgeDifficulty: 6,
            damage: 8, burned: true, terrains: ['ruins'],
        },
        {
            id: 'kelvin-the-reactor-leaks',
            oncePerRun: true,
            weight: 0.15,
            chain: 'kelvin-the-reactor-vents',
            text: 'Something is coming out of the reactor housing in {zone} now, a shimmer in the air, and {tribute} has been breathing it all night.',
            escapeText: '{tribute} wraps their face in wet cloth and crawls out of {zone} under the shimmer.',
            cause: 'Breathed the reactor leak',
            code: 'poison',
            dodgeStat: 'endurance', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
            damage: 24, poisoned: true, terrains: ['ruins'],
        },
        {
            id: 'kelvin-the-reactor-vents',
            oncePerRun: true,
            weight: 0.15,
            text: 'The station vents the reactor on the third day, all at once, through {zone}, and {tribute} is in the one corridor it vents along.',
            escapeText: '{tribute} is at the far end of {zone} with a bulkhead shut behind them when the station vents the core.',
            cause: 'Caught in the reactor vent',
            code: 'burns',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 8,
            damage: 50, burned: true, zoneWide: true, terrains: ['ruins', 'highland'], witnesses: true,
        },
    ],
    warren: [
        {
            text: 'The burrow {tribute} is sleeping in under {zone} sighs, and settles, and settles again, and there is earth where the air was.',
            escapeText: '{tribute} feels grit on their face in {zone} and is out of the burrow on their elbows before the roof comes down.',
            cause: 'Burrow collapse',
            code: 'asphyxiation',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 8,
            damage: 44, terrains: ['ruins', 'forest', 'open'],
            requires: { time: 'night' },
        },
        {
            text: 'The tunnel hounds have the scent of {tribute} in {zone}, and a tunnel is only as wide as a hound.',
            escapeText: '{tribute} goes up a vent shaft in {zone} that no hound can climb and waits for the baying to move on.',
            cause: 'Run down by tunnel hounds',
            code: 'mutt',
            dodgeStat: 'agility', dodgeAlt: 'stealth', dodgeDifficulty: 8,
            damage: 38, bleeding: true, terrains: ['ruins', 'open'], witnesses: true,
        },
        {
            text: 'Something blind is digging towards {tribute} through the wall of {zone}. It has been digging for an hour. It can hear them breathing.',
            escapeText: '{tribute} stops breathing loudly in {zone}, then stops moving, and the digging turns away through the earth.',
            cause: 'Taken through the wall by a blind burrower',
            code: 'mutt',
            dodgeStat: 'stealth', dodgeAlt: 'willpower', dodgeDifficulty: 7,
            damage: 34, sanity: 12, terrains: ['ruins', 'forest'],
        },
        {
            text: '{tribute} counts the tunnels off {zone} and gets a different number every time.',
            escapeText: '',
            cause: 'Counting tunnels',
            sanity: 6, terrains: ['ruins', 'open'],
        },
        // ---- chain: the long dig ----
        {
            id: 'warren-the-dig-starts',
            oncePerRun: true,
            chain: 'warren-the-dig-breaks-through',
            text: '{tribute} starts a tunnel of their own out of {zone}, somewhere nobody else knows about, and the first night\'s work comes down on them once.',
            escapeText: '{tribute} shores the first yard of the new tunnel in {zone} with a broken spear shaft and keeps going.',
            cause: 'Buried in a tunnel of their own',
            code: 'asphyxiation',
            dodgeStat: 'strength', dodgeDifficulty: 6,
            damage: 10, fatigue: 16, terrains: ['ruins', 'forest'],
        },
        {
            id: 'warren-the-dig-breaks-through',
            oncePerRun: true,
            weight: 0.15,
            chain: 'warren-the-dig-is-found',
            text: 'The new tunnel breaks through from {zone} into somebody\'s stores. {tribute} eats for the first time in days.',
            escapeText: '',
            cause: 'Broke through into stores',
            feed: 24, quench: 12, terrains: ['ruins', 'forest'],
        },
        {
            id: 'warren-the-dig-is-found',
            oncePerRun: true,
            weight: 0.15,
            text: 'Whoever owned the stores has found the tunnel into {zone}, and they have filled it in from their end, with {tribute} still inside it.',
            escapeText: '{tribute} hears the shovelling from the far end of the tunnel in {zone} and backs out the way they came, fast.',
            cause: 'Buried in the tunnel by the stores\' owner',
            code: 'asphyxiation',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 8,
            damage: 42, terrains: ['ruins', 'forest'], witnesses: true,
        },
    ],
    saltflats: [
        {
            text: 'The glare off {zone} has been in {tribute}\'s eyes since dawn. By noon they cannot see the brine pools, and by one they are in one.',
            escapeText: '{tribute} ties a strip of dark cloth across their eyes in {zone} and walks the flats by the crunch underfoot.',
            cause: 'Blinded by the glare and walked into a brine pool',
            code: 'drowning',
            dodgeStat: 'intelligence', dodgeAlt: 'endurance', dodgeDifficulty: 7,
            damage: 38, thirst: 12, terrains: ['open', 'water'],
            requires: { time: 'day' },
        },
    ],
    clockwork: [
        {
            text: 'The hour turns over in {zone} and it is the tide\'s hour, and {tribute} was counting the wrong bell.',
            escapeText: '{tribute} counts the strokes over {zone} twice and is on high ground when the water arrives on schedule.',
            cause: 'Caught in a tidal hour',
            code: 'drowning',
            dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 7,
            damage: 42, terrains: ['water', 'wetland', 'open'], zoneWide: true,
        },
        {
            text: '{tribute} takes a shortcut through the gear train under {zone} between two teeth, and the teeth are on the hour.',
            escapeText: '{tribute} times the teeth under {zone} for three full turns before stepping between them.',
            cause: 'Crushed in the gear train',
            code: 'machinery',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 8,
            damage: 46, terrains: ['ruins', 'highland', 'forest'],
        },
    ],
    menagerie: [
        {
            text: 'Somebody has opened the enclosures around {zone}. What comes out of them has been fed on a schedule, and {tribute} is standing where the schedule used to be.',
            escapeText: '{tribute} climbs onto an enclosure roof in {zone} and watches the released animals go past underneath.',
            cause: 'Mauled by a released enclosure animal',
            code: 'mutt',
            dodgeStat: 'agility', dodgeAlt: 'stealth', dodgeDifficulty: 7,
            damage: 40, bleeding: true, terrains: ['open', 'ruins', 'forest'], witnesses: true,
        },
        {
            text: 'The troughs in {zone} are full of clean-looking water, and {tribute} is thirsty enough not to wonder why the animals will not touch it.',
            escapeText: '{tribute} watches the animals in {zone} refuse the trough and goes thirsty a little longer.',
            cause: 'Poisoned at the water troughs',
            code: 'poison',
            dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7,
            damage: 32, poisoned: true, quench: 15, terrains: ['open', 'ruins', 'wetland'],
            requires: { thirstAbove: 50 },
        },
    ],
    carnival: [
        {
            text: 'Every direction in the hall of mirrors in {zone} is {tribute}, and one of the reflections is a doorway onto a drop.',
            escapeText: '{tribute} walks the hall of mirrors in {zone} with a hand out in front, touching glass, and finds the gap by touch.',
            cause: 'Fell through the hall of mirrors',
            code: 'fall',
            dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 7,
            damage: 36, sanity: 10, terrains: ['ruins', 'highland'],
        },
        {
            text: 'The ride in {zone} starts up with {tribute} sheltering in one of its cars, and whoever rigged it rigged it to come apart at the top.',
            escapeText: '{tribute} feels the ride in {zone} lurch and jumps from the car while it is still low enough to survive.',
            cause: 'Killed when a rigged ride collapsed',
            code: 'machinery',
            dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 8,
            damage: 44, terrains: ['ruins', 'open', 'highland'], witnesses: true,
        },
    ],
    vault: [
        {
            text: 'The chamber door in {zone} closes on a timer, and the timer does not open it again. {tribute} reads the dial, and does the arithmetic on the air.',
            escapeText: '{tribute} gets a boot into the chamber door in {zone} before it seats, and holds it until the lock gives up.',
            cause: 'Sealed in a timed chamber',
            code: 'asphyxiation',
            dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 8,
            damage: 44, terrains: ['ruins', 'highland'],
        },
    ],
};

/**
 * Appended to `UNIVERSAL_EVENTS` in `arenaFlavor.ts`, so they inherit the
 * universal pool's share and scaling like every other shared event.
 *
 * A few of §9's triggers ask for state the event schema cannot gate on
 * (a crafted weapon's durability, a mutt encounter, the Cornucopia's head
 * count). Each is gated on the nearest thing `requires` can express, and the
 * one tribute-on-tribute cause ("killed by an ally over the last ration") is
 * authored as the wound it leaves — an arena event has no attacker to name,
 * and a `tribute` code without one would break kill attribution.
 */
const AUTHORED_UNIVERSAL_EVENTS: ArenaEventDef[] = [
    // ---- §9: new universal causes ----------------------------------------
    {
        text: '{tribute} eats a handful of something from {zone} that looked like the berries at home. It is not the berries at home.',
        escapeText: '{tribute} rubs the berry from {zone} on the inside of their wrist first, waits, and throws the rest away.',
        cause: 'Allergic reaction to foraged food',
        code: 'poison',
        dodgeStat: 'intelligence', dodgeAlt: 'endurance', dodgeDifficulty: 6,
        damage: 26, poisoned: true, feed: 6, terrains: ['forest', 'open', 'wetland'],
        requires: { hungerAbove: 50 }, weight: 1,
    },
    {
        text: 'Half the field breaks for the horn at once when the supplies are restocked, and {tribute} goes down in {zone} under everybody else\'s feet.',
        escapeText: '{tribute} lets the crowd in {zone} go past and walks in behind it.',
        cause: 'Crushed in the crowd at the Cornucopia',
        code: 'collapse',
        dodgeStat: 'agility', dodgeAlt: 'strength', dodgeDifficulty: 6,
        damage: 30, terrains: ['open'],
        requires: { minSurvivors: 14 }, weight: 0.6,
    },
    {
        text: '{tribute} is too tired to remember where they set the snare in {zone}, and finds it with their own ankle.',
        escapeText: '{tribute} stops before stepping off the path in {zone}, remembers the snare, and steps round it.',
        cause: 'Caught in their own trap',
        code: 'trap',
        dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 7,
        damage: 30, bleeding: true, terrains: ['forest', 'open', 'wetland'],
        requires: { trait: 'Trapper', fatigueAbove: 50 }, weight: 1,
    },
    {
        text: 'The shaft of {tribute}\'s weapon snaps halfway through a swing at nothing in particular in {zone}, and the broken end goes where the swing was going.',
        escapeText: '{tribute} hears the shaft crack in {zone} and lets go of it before it can finish the job.',
        cause: 'Killed by their own weapon failing',
        code: 'machinery',
        dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 6,
        damage: 26, bleeding: true,
        requires: { carrying: 'weapon', daysAbove: 3 }, weight: 0.8,
    },
    {
        text: '{tribute} has not eaten in days and eats the first ration they find in {zone} all at once, too fast.',
        escapeText: '{tribute} makes themselves eat slowly in {zone}, a mouthful at a time, the way somebody once told them to.',
        cause: 'Choked on rations',
        code: 'asphyxiation',
        dodgeStat: 'willpower', dodgeAlt: 'endurance', dodgeDifficulty: 6,
        damage: 28, feed: 14,
        requires: { hungerAbove: 70, carrying: 'food' }, weight: 0.8,
    },
    {
        text: '{tribute} has not really slept in days, and tonight in {zone} they get up without waking and walk towards the edge.',
        escapeText: '{tribute} wakes in {zone} standing at the drop, and sits down very carefully until the dawn.',
        cause: 'Sleepwalked off a ledge',
        code: 'fall',
        dodgeStat: 'willpower', dodgeAlt: 'agility', dodgeDifficulty: 7,
        damage: 38,
        requires: { trait: 'Insomniac', time: 'night', elevationOrChoke: true }, weight: 1,
    },
    {
        text: 'The storm finds the highest thing in {zone}, and the highest thing is {tribute}.',
        escapeText: '{tribute} feels their hair lift in {zone} and throws themselves flat a heartbeat before the strike.',
        cause: 'Struck by lightning',
        code: 'burns',
        dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 7,
        damage: 40, burned: true, terrains: ['highland', 'open'],
        requires: { storm: true }, weight: 1,
    },
    {
        text: 'The cut {tribute} took on rusted metal in {zone} three days ago has stiffened their jaw, and then their neck.',
        escapeText: '{tribute} opens the rusty cut again in {zone}, cleans it with the last of the water, and screams, and lives.',
        cause: 'Tetanus from a rusty wound',
        code: 'infection',
        dodgeStat: 'endurance', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
        damage: 30, infected: true, terrains: ['ruins', 'urban'],
        requires: { wounded: true, daysAbove: 3 }, weight: 1,
    },
    {
        text: 'Something howls very close to {tribute} in {zone}, and the heart that has been racing for five days stops racing.',
        escapeText: '{tribute} presses both hands over their heart in {zone} and counts, and the howling passes.',
        cause: 'Heart gave out from fear',
        code: 'shock',
        dodgeStat: 'willpower', dodgeAlt: 'endurance', dodgeDifficulty: 7,
        damage: 30, sanity: 16,
        requires: { trait: 'Fragile', sanityBand: 'unravelling' }, weight: 1,
    },
    {
        text: 'A silver parachute lands at {tribute}\'s feet in {zone}. Nobody in their district could have afforded what is in it, and nobody in their district sent it.',
        escapeText: '{tribute} smells the parachute\'s contents in {zone}, looks up at the sky, and buries it.',
        cause: 'Poisoned by a sponsor gift the Capitol had tampered with',
        code: 'gamemaker',
        dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7,
        damage: 34, poisoned: true,
        requires: { daysAbove: 2, maxSurvivors: 10 }, weight: 0.5,
    },
    {
        text: 'There is one ration left in {zone} and two people in the alliance, and {tribute} is the one who comes away from it cut.',
        escapeText: '{tribute} splits the last ration in {zone} down the middle before anybody can ask who deserves it.',
        cause: 'Bled out after a fight with an ally over the last ration',
        code: 'bleeding',
        dodgeStat: 'strength', dodgeAlt: 'charisma', dodgeDifficulty: 7,
        damage: 30, bleeding: true,
        requires: { hungerAbove: 75, alone: false }, weight: 0.7,
    },
    {
        text: '{tribute} lights a fire in the back of the shelter in {zone} and closes the gap against the wind, and the smoke has nowhere else to go.',
        escapeText: '{tribute} coughs once in {zone}, kicks the gap open and sleeps cold.',
        cause: 'Smoke inhalation from their own fire',
        code: 'asphyxiation',
        dodgeStat: 'intelligence', dodgeAlt: 'endurance', dodgeDifficulty: 6,
        damage: 30, terrains: ['ruins', 'forest'],
        requires: { trait: 'Pyromaniac', time: 'night' }, weight: 1,
    },
    {
        text: '{tribute} builds the fire high in the hollow in {zone}, the way they always do, and the hollow fills with smoke while they sleep.',
        escapeText: '{tribute} wakes coughing in {zone} and drags themselves out of the hollow before the smoke finishes the job.',
        cause: 'Smoke inhalation in an enclosed camp',
        code: 'asphyxiation',
        dodgeStat: 'intelligence', dodgeAlt: 'endurance', dodgeDifficulty: 6,
        damage: 28, terrains: ['ruins', 'forest'],
        requires: { trait: 'Kindler', time: 'night' }, weight: 1,
    },

    // ---- §10: new universal beats ----------------------------------------
    {
        text: 'Somebody {tribute} trusts calls their name from the far side of {zone}. {tribute} goes, because it is their voice. It is not them.',
        escapeText: '{tribute} hears the familiar voice in {zone} say something its owner would never say, and does not go.',
        cause: 'Lured by a mutt wearing a friend\'s voice',
        code: 'mutt',
        dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7,
        damage: 30, bleeding: true, sanity: 10,
        requires: { time: 'night' }, weight: 0.8,
    },
    {
        text: 'Two parachutes come down on {zone} at once, from two sponsors who clearly did not coordinate, and {tribute} reaches the better one first.',
        escapeText: '',
        cause: 'A sponsor bidding war',
        heal: 10, feed: 12, quench: 12, weight: 0.6,
    },
    {
        text: 'The feast is announced for {zone}, and {tribute} gets there first, and there is nothing on the table but the table.',
        escapeText: '{tribute} arrives at the empty table in {zone}, understands it at once, and leaves before whatever the table is for.',
        cause: 'Killed at a feast with nothing at it',
        code: 'gamemaker',
        dodgeStat: 'intelligence', dodgeAlt: 'agility', dodgeDifficulty: 7,
        damage: 30, sanity: 8, terrains: ['open', 'ruins'],
        requires: { daysAbove: 3 }, weight: 0.5,
    },
    {
        text: 'The sky over {zone} shows the fallen tonight, and then their families, one after another, and {tribute} cannot look away.',
        escapeText: '{tribute} lies face down in {zone} with their hands over their ears until the sky goes dark.',
        cause: 'Broke under the night of names',
        code: 'shock',
        dodgeStat: 'willpower', dodgeAlt: 'charisma', dodgeDifficulty: 6,
        damage: 14, sanity: 24,
        requires: { time: 'night', daysAbove: 3 }, weight: 0.6,
    },
    {
        text: 'A pulse runs through {zone} and one of its ways out simply ends, permanently, the field folding in on itself with {tribute} too near the fold.',
        escapeText: '{tribute} feels the air in {zone} tighten and steps back from the edge before the sector closes.',
        cause: 'Caught at the border when a sector closed',
        code: 'border',
        dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 6,
        damage: 28, severesRoute: true,
        requires: { daysAbove: 4 }, weight: 0.5,
    },
    {
        text: '{tribute} finds a camp in {zone} with the fire still warm and the owner nowhere to be seen, and takes what is there.',
        escapeText: '',
        cause: 'A borrowed fire',
        heal: 6, feed: 10, fatigue: -10, weight: 0.8,
    },
    {
        text: 'There are two wounded tributes in {zone}, {tribute} and somebody who has spent a week trying to kill them. Neither can stand. They share the water.',
        escapeText: '',
        cause: 'The truce of the wounded',
        heal: 8, quench: 10,
        requires: { wounded: true, alone: false }, weight: 0.6,
    },
    {
        id: 'universal-old-victors-cache',
        oncePerRun: true,
        text: '{tribute} finds a kit wrapped in oilcloth under a stone in {zone}, stamped with the year of a Games long over. Somebody who won once left it for somebody who might.',
        escapeText: '',
        cause: 'An old victor\'s cache',
        grantItem: 'medkit', feed: 10, weight: 0.5,
    },
    {
        text: 'A note comes down on a parachute with a mentor\'s advice for {zone}. {tribute} follows it. It was wrong on purpose.',
        escapeText: '{tribute} reads the mentor\'s note twice in {zone}, notices it is not in the mentor\'s voice, and does the opposite.',
        cause: 'Followed a mentor\'s note the Capitol had written',
        code: 'gamemaker',
        dodgeStat: 'intelligence', dodgeAlt: 'willpower', dodgeDifficulty: 7,
        damage: 26, sanity: 10,
        requires: { daysAbove: 2 }, weight: 0.5,
    },
    {
        text: 'A mentor\'s note comes down on a parachute over {zone} with one line in it, and the line is right, and {tribute} is still alive because of it.',
        escapeText: '',
        cause: 'The echo of a mentor',
        heal: 6, sanity: -8, weight: 0.5,
    },
    {
        text: 'Nobody in {zone} can see further than their own hand tonight, and {tribute} strikes at a shape that turns out to have been on their side.',
        escapeText: '{tribute} holds the blow in {zone} long enough to hear a familiar breath, and lowers the blade.',
        cause: 'Killed in the confusion of paranoia night',
        code: 'shock',
        dodgeStat: 'willpower', dodgeAlt: 'intelligence', dodgeDifficulty: 6,
        damage: 20, sanity: 18,
        requires: { time: 'night', alone: false }, weight: 0.6,
    },
];

/**
 * AUDIT-11 tuning: the lethal half of this file, as authored, killed about one
 * death in 3,000 — the weights were written against the arena pools they
 * joined and the damage against a full-health tribute. Both are scaled here
 * from `AUDIT11_EVENTS` so the new deaths are a visible share of the arena's
 * vocabulary without editing a hundred literals. Boons and beats are untouched.
 */
function tuned(events: ArenaEventDef[], weightScale: number): ArenaEventDef[] {
    return events.map(e => (e.damage ?? 0) > 0
        ? {
            ...e,
            weight: (e.weight ?? 1) * weightScale,
            damage: Math.round(e.damage! * AUDIT11_EVENTS.damageScale),
            dodgeDifficulty: (e.dodgeDifficulty ?? ENCOUNTERS.defaultDodgeDifficulty) + AUDIT11_EVENTS.dodgeDifficultyBonus,
        }
        : e);
}

export const EXTRA_ARENA_EVENTS_GROUP6: Record<string, ArenaEventDef[]> = Object.fromEntries(
    Object.entries(AUTHORED_ARENA_EVENTS).map(([id, events]) => [id, tuned(events, AUDIT11_EVENTS.arenaWeightScale)]));

export const UNIVERSAL_EVENTS_GROUP6: ArenaEventDef[] = tuned(AUTHORED_UNIVERSAL_EVENTS, AUDIT11_EVENTS.universalWeightScale);

/** Every lethal cause authored in this file — read by the `unrecorded-cause` achievement. */
export const AUDIT11_CAUSES: string[] = [
    ...Object.values(EXTRA_ARENA_EVENTS_GROUP6).flat(),
    ...UNIVERSAL_EVENTS_GROUP6,
].filter(e => (e.damage ?? 0) > 0).map(e => e.cause);
