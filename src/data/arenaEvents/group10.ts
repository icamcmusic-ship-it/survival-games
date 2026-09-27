import type { ArenaEventDef } from '../arenaFlavor';
import { AUDIT14_ARENA } from '../balance';

/**
 * AUDIT-14 §6: arena-specific deaths A1–A42 and events V31–V72, plus two more
 * deaths for acousticforest (W1 names it over the tribute ceiling but the
 * death table gives it none).
 *
 * Each landmark death is gated to its landmark (`requires.zone`), so it can
 * only happen where the text says it does. The five arenas over the 72 %
 * tribute ceiling (W1) draw theirs at `ceilingArenaDeathWeight`. Every lethal
 * entry declares its `code` and is stamped `signature` at load like every
 * other entry in an arena's own pack (W2).
 */
const W = AUDIT14_ARENA.arenaDeathWeight;
const WC = AUDIT14_ARENA.ceilingArenaDeathWeight;
const WL = AUDIT14_ARENA.lowSignatureArenaDeathWeight;

type Death = Omit<ArenaEventDef, 'weight'> & { weight?: number };
const death = (zone: string[], d: Death, weight: number = W): ArenaEventDef => ({
    dodgeStat: 'agility', dodgeAlt: 'intelligence', dodgeDifficulty: 7,
    ...d, weight: d.weight ?? weight, requires: { ...(d.requires ?? {}), zone },
});
const beat = (id: string, zone: string[] | undefined, text: string, fields: Partial<ArenaEventDef> = {}): ArenaEventDef => ({
    id, text, escapeText: '', cause: 'Worn down by the arena', weight: 0.8, ...fields,
    requires: zone ? { ...(fields.requires ?? {}), zone } : fields.requires,
});

export const EXTRA_ARENA_EVENTS_GROUP10: Record<string, ArenaEventDef[]> = {
    tidewrack: [
        death(['Mussel Flats'], {
            id: 'tw-a14-mussel-cut-tide',
            text: 'The mussels in {zone} slice {tribute}\'s feet to ribbons, and they cannot run the last hundred yards before the tide.',
            escapeText: '{tribute} wraps both feet in a torn shirt in {zone} and walks, not runs, and beats the tide by a stride.',
            cause: 'Cut feet on the mussel beds and lost the race with the tide', code: 'drowning',
            damage: 38, bleeding: true, terrains: ['wetland'],
        }, WC),
        death(['The Wreck Line'], {
            id: 'tw-a14-wreck-shift',
            text: 'The wreck on {zone} rolls in the swell with {tribute} inside the hull.',
            escapeText: '{tribute} feels the hull lift under them in {zone} and dives out through a hole in the planking.',
            cause: 'Crushed when the wreck rolled in the swell', code: 'crush',
            damage: 40, bleeding: true, terrains: ['ruins'], requires: { storm: true },
        }, WC),
        death(['Boathouse Row'], {
            id: 'tw-a14-boathouse-winch',
            text: 'A boathouse winch on {zone} runs by itself in the night, and the cable drags {tribute} down the slip into black water.',
            escapeText: '{tribute} hears the ratchet start on {zone} and kicks free of the cable before it tightens.',
            cause: 'Dragged down the slip by a boathouse winch', code: 'machinery',
            damage: 36, terrains: ['ruins'], requires: { time: 'night' },
        }, WC),
    ],
    thresher: [
        death(['The Coolant Race'], {
            id: 'th-a14-coolant-race-scald',
            text: 'The Coolant Race runs boiling after the shutdown, and {tribute} is wading it in {zone}.',
            escapeText: '{tribute} sees the steam come off {zone} a second early and is up the bank before the hot water reaches them.',
            cause: 'Scalded wading the coolant race', code: 'burns',
            damage: 38, burned: true, terrains: ['water'],
        }, WC),
        death(['The Bone Hoppers'], {
            id: 'th-a14-bone-hopper-bury',
            text: '{tribute} hides in a hopper in {zone}, and the hopper fills.',
            escapeText: '{tribute} hears the chute open over {zone} and is out over the lip before the first load lands.',
            cause: 'Buried alive in a bone hopper', code: 'asphyxiation',
            damage: 40, terrains: ['ruins'], requires: { stance: ['Fortified', 'Defensive', 'Evasive'] },
        }, WC),
        death(['Scale House'], {
            id: 'th-a14-scale-house-weigh',
            text: '{zone} weighs everyone who enters. {tribute} is the heaviest today, and the floor opens.',
            escapeText: '{tribute} feels the floor of {zone} dip under them and jumps for the doorframe.',
            cause: 'Weighed by the Scale House and dropped', code: 'gamemaker',
            damage: 40, terrains: ['urban'],
        }, WC),
    ],
    saltworks: [
        death(['The Brine Well'], {
            id: 'sw-a14-brine-well-descent',
            text: '{tribute} climbs down {zone} for water. The brine is too dense to swim in and too thick to climb out of, and it keeps them.',
            escapeText: '{tribute} tastes the brine at the bottom of {zone} and climbs back up the rope without going in.',
            cause: 'Held in the brine at the bottom of the well', code: 'drowning',
            damage: 38, terrains: ['water'], requires: { thirstAbove: 30 },
        }, WC),
        death(['The Stack Yard'], {
            id: 'sw-a14-stack-avalanche',
            text: 'The wet salt stacks in {zone} slump all at once over {tribute}.',
            escapeText: '{tribute} sees the stack in {zone} begin to lean and runs for the gap between them.',
            cause: 'Buried under a slumping salt stack', code: 'crush',
            damage: 40, terrains: ['ruins'], requires: { storm: true },
        }, WC),
        death(['Crust Ridge'], {
            id: 'sw-a14-salt-eyes-walkoff',
            text: 'Salt-blind in the glare, {tribute} walks off {zone} into the pan.',
            escapeText: '{tribute} ties a strip of cloth over their eyes on {zone} and crawls until the ground is flat.',
            cause: 'Walked off Crust Ridge salt-blind', code: 'fall',
            damage: 36, terrains: ['highland'], requires: { time: 'day' },
        }, WC),
    ],
    kiln: [
        death(['The Slip Cellar'], {
            id: 'kl-a14-slip-cellar-suck',
            text: 'The liquid clay in {zone} holds {tribute} at the waist, then at the chest.',
            escapeText: '{tribute} lies flat on the slip in {zone} and swims out of it like a seal.',
            cause: 'Swallowed by the liquid clay in the Slip Cellar', code: 'asphyxiation',
            damage: 38, terrains: ['cave'],
        }, WL),
        death(['The Cooling Racks'], {
            id: 'kl-a14-cooling-rack-shatter',
            text: 'The pots on {zone} crack in the cold and shower {tribute} with shards.',
            escapeText: '{tribute} hears the first pot ping on {zone} and gets under the rack\'s iron shelf.',
            cause: 'Cut to pieces by shattering pots on the racks', code: 'bleeding',
            damage: 34, bleeding: true, terrains: ['ruins'], requires: { time: 'night' },
        }, WL),
        death(['Glaze Pits'], {
            id: 'kl-a14-glaze-lead',
            text: 'The water pooled in {zone} is sweet. That is the lead. {tribute} drinks it for two days.',
            escapeText: '{tribute} tastes the sweetness in the water of {zone} and spits it out.',
            cause: 'Drank the lead-sweet water in the Glaze Pits', code: 'poison',
            dodgeStat: 'intelligence', dodgeAlt: 'endurance',
            damage: 30, poisoned: true, quench: 15, terrains: ['desert'], requires: { thirstAbove: 40 },
        }, WL),
    ],
    vintage: [
        death(['The Press House'], {
            id: 'vi-a14-press-house',
            text: 'The wine press in {zone} comes down on the loft where {tribute} is sleeping.',
            escapeText: '{tribute} hears the screw turn in {zone} and rolls off the loft edge onto the grape skins.',
            cause: 'Crushed in the wine press', code: 'machinery',
            damage: 42, terrains: ['ruins'], requires: { stance: ['Fortified', 'Defensive', 'Evasive'] },
        }, WC),
        death(['Bell Tower'], {
            id: 'vi-a14-bell-tower-swing',
            text: 'The noon bell in {zone} swings with {tribute} on the beam beside it.',
            escapeText: '{tribute} feels the rope go taut in {zone} and drops flat on the beam as the bell goes over.',
            cause: 'Struck by the swinging noon bell', code: 'impact',
            damage: 40, terrains: ['highland'], requires: { time: 'day' },
        }, WC),
        death(['The Wine Cellar'], {
            id: 'vi-a14-cellar-must-gas',
            text: '{zone} is full of fermenting must, and the air in it is no longer air. {tribute} sleeps there.',
            escapeText: '{tribute} wakes in {zone} with a headache like a nail, and crawls up the stairs.',
            cause: 'Slept in the fermenting cellar and did not wake', code: 'asphyxiation',
            dodgeStat: 'endurance', dodgeAlt: 'intelligence',
            damage: 38, terrains: ['cave'], requires: { daysAbove: 4, time: 'night' },
        }, WC),
    ],
    floe: [
        death(['The Seal Colony'], {
            id: 'fl-a14-seal-colony-bull',
            text: 'A bull seal the weight of a cart takes {tribute} for a rival in {zone}.',
            escapeText: '{tribute} drops the fish in {zone} and backs away, and the bull takes the fish.',
            cause: 'Mauled by a bull seal', code: 'animal',
            damage: 38, bleeding: true, terrains: ['wetland'],
        }),
        death(['The Frozen Wreck'], {
            id: 'fl-a14-frozen-wreck-hold',
            text: 'The hold of {zone} is out of the wind and colder than the wind. {tribute} sleeps there.',
            escapeText: '{tribute} wakes stiff in the hold of {zone} and climbs out into the wind to get warm.',
            cause: 'Froze in the hold of the wreck', code: 'hypothermia',
            dodgeStat: 'endurance', dodgeAlt: 'willpower',
            damage: 36, frostbitten: true, terrains: ['ruins'], requires: { time: 'night' },
        }),
        death(['The Grease Ice'], {
            id: 'fl-a14-grease-ice-swim',
            text: 'Grease ice looks like water and is not. {tribute} cannot swim through {zone}.',
            escapeText: '{tribute} feels the slush grip in {zone} and turns back while they still can.',
            cause: 'Could not swim through the grease ice', code: 'drowning',
            damage: 38, frostbitten: true, terrains: ['wetland'], requires: { stance: ['Evasive', 'Desperate'] },
        }),
    ],
    malthouse: [
        death(['The Cornucopia'], {
            id: 'mh-a14-fermenter-co2',
            text: '{tribute} leans over a vat on {zone} to fill a canteen and breathes the fermenter.',
            escapeText: '{tribute} feels the first breath over the vat on {zone} burn, and pulls back.',
            cause: 'Breathed the fermenter gas over a vat', code: 'asphyxiation',
            damage: 36, quench: 10, terrains: ['open'],
        }, WC),
        death(['The Grain Silos'], {
            id: 'mh-a14-silo-engulf',
            text: 'The grain in {zone} gives under {tribute} like water and closes over their head like sand.',
            escapeText: '{tribute} feels the grain begin to flow in {zone} and grabs the ladder before it takes the knees.',
            cause: 'Engulfed in a grain silo', code: 'asphyxiation',
            damage: 40, terrains: ['urban'],
        }, WC),
        death(['The Spirit Store'], {
            id: 'mh-a14-spirit-flash',
            text: '{zone} only needed a spark. {tribute} brought a torch.',
            escapeText: '{tribute} smells the spirit in {zone} and drops the torch outside the door.',
            cause: 'Went up in the Spirit Store', code: 'burns',
            damage: 42, burned: true, terrains: ['ruins'],
        }, WC),
    ],
    glasshouse: [
        death(['The Shattered Atrium'], {
            id: 'gh-a14-pane-drop',
            text: 'A single loose pane lets go forty feet over {zone}. It is enough for {tribute}.',
            escapeText: '{tribute} hears the frame creak over {zone} and steps sideways as the glass lands.',
            cause: 'Struck by a falling pane of glass', code: 'impact',
            damage: 38, bleeding: true, terrains: ['open'], requires: { storm: true },
        }),
        death(['The Aquatic Wing'], {
            id: 'gh-a14-aquatic-intake',
            text: 'The pond intake in {zone} pulls {tribute} against the grate.',
            escapeText: '{tribute} feels the pull in {zone} and swims across it rather than against it.',
            cause: 'Held against the pond intake grate', code: 'drowning',
            damage: 38, terrains: ['water'],
        }),
        death(['The Boiler House'], {
            id: 'gh-a14-boiler-steam',
            text: 'The boiler in {zone} vents at midnight into the corridor where {tribute} is hiding.',
            escapeText: '{tribute} hears the valve start to scream in {zone} and gets out of the corridor.',
            cause: 'Scalded by the boiler venting at midnight', code: 'burns',
            damage: 38, burned: true, terrains: ['urban'], requires: { time: 'night' },
        }),
    ],
    wardblock: [
        death(['Cell Block A', 'Cell Block B', 'Cell Block C'], {
            id: 'wb-a14-cell-lock',
            text: 'The cell door {tribute} closed in {zone} for safety will not open again.',
            escapeText: '{tribute} works the lock in {zone} with a bent spoon for a day and a night, and it gives.',
            cause: 'Locked in a cell until the thirst took them', code: 'dehydration',
            dodgeStat: 'intelligence', dodgeAlt: 'strength',
            damage: 34, thirst: 30, terrains: ['ruins'], requires: { stance: ['Fortified', 'Defensive'] },
        }),
        death(['The Laundry'], {
            id: 'wb-a14-laundry-mangle',
            text: 'The mangle in {zone} takes {tribute}\'s sleeve, and then {tribute}.',
            escapeText: '{tribute} tears the sleeve off at the shoulder in {zone} and leaves it in the rollers.',
            cause: 'Pulled through the laundry mangle', code: 'machinery',
            damage: 40, terrains: ['urban'], requires: { alone: false },
        }),
        death(['The Cornucopia'], {
            id: 'wb-a14-tower-searchlight',
            text: 'The Guard Tower searchlight finds {tribute} running across {zone}, and so does everyone else.',
            escapeText: '{tribute} freezes in the light in {zone}, then drops behind a bench when it swings on.',
            cause: 'Lit up by the tower searchlight in the Yard', code: 'gamemaker',
            damage: 36, terrains: ['open'], requires: { time: 'night' },
        }),
    ],
    undercroft: [
        death(['The Third Rail'], {
            id: 'uc-a14-third-rail',
            text: '{tribute} steps across the tracks in {zone} and their heel touches the third rail.',
            escapeText: '{tribute} sees the blue spark jump in {zone} and lengthens the stride.',
            cause: 'Stepped on the third rail', code: 'electrocution',
            damage: 44, burned: true, terrains: ['urban'],
        }),
        death(['Track Tunnel North', 'Track Tunnel South'], {
            id: 'uc-a14-ghost-train',
            text: 'A train with no driver and no lights comes down {zone}. {tribute} hears it too late.',
            escapeText: '{tribute} feels the wind push ahead of the train in {zone} and flattens into a refuge niche.',
            cause: 'Hit by the ghost train in the tunnel', code: 'impact',
            damage: 46, terrains: ['cave'], requires: { time: 'night' },
        }),
        death(['The Turnstiles'], {
            id: 'uc-a14-turnstile-crush',
            text: 'Three people try {zone} at once, and {tribute} is the one in the middle.',
            escapeText: '{tribute} climbs over the turnstile in {zone} instead of through it.',
            cause: 'Crushed in the turnstiles', code: 'crush',
            damage: 38, terrains: ['urban'], requires: { alone: false, minSurvivors: 6 },
        }),
    ],
    seapeaks: [
        death(['The Ice Chimney'], {
            id: 'sp-a14-ice-chimney-plug',
            text: 'The ice plug in {zone} lets go above {tribute}.',
            escapeText: '{tribute} hears water running behind the plug in {zone} and climbs out sideways.',
            cause: 'Crushed by the ice plug in the chimney', code: 'crush',
            damage: 42, frostbitten: true, terrains: ['highland'], requires: { time: 'day' },
        }),
        death(['The Sea Cave'], {
            id: 'sp-a14-sea-cave-tide',
            text: '{tribute} sleeps in {zone} and wakes with the tide at the roof.',
            escapeText: '{tribute} wakes with water at the ankles in {zone} and swims for the mouth.',
            cause: 'Drowned asleep in the sea cave', code: 'drowning',
            damage: 40, terrains: ['ruins'], requires: { time: 'night' },
        }),
        death(['The Kelp Shallows'], {
            id: 'sp-a14-kelp-tangle',
            text: 'The kelp wraps {tribute}\'s ankles in the swell of {zone}.',
            escapeText: '{tribute} cuts the kelp away with a knife in {zone} and surfaces coughing.',
            cause: 'Tangled in the kelp and held under', code: 'drowning',
            damage: 38, terrains: ['water'],
        }),
    ],
    burnscar: [
        death(['The Standing Dead', 'The Snag Field'], {
            id: 'bs-a14-standing-dead-fall',
            text: 'A burnt snag the height of a house comes down across {tribute} in {zone}.',
            escapeText: '{tribute} hears the snag crack at the base in {zone} and runs sideways, not away.',
            cause: 'Crushed by a burnt snag in the wind', code: 'crush',
            damage: 42, bleeding: true, terrains: ['ruins'], requires: { storm: true },
        }),
        death(['The Old Burn Line'], {
            id: 'bs-a14-stump-hole',
            text: '{tribute} steps into a burnt-out stump hole in {zone}, still full of embers at the bottom.',
            escapeText: '{tribute} feels the heat through the sole in {zone} and pulls the foot out before it goes in.',
            cause: 'Fell into an ember-filled stump hole', code: 'burns',
            damage: 36, burned: true, terrains: ['open'],
        }),
        death(['Erosion Gully'], {
            id: 'bs-a14-erosion-gully-slide',
            text: 'The bare slope with no roots left slides into {zone} on top of {tribute}.',
            escapeText: '{tribute} sees the slope start to move over {zone} and climbs the far bank.',
            cause: 'Buried when the rootless slope slid', code: 'crush',
            damage: 40, terrains: ['wetland'], requires: { storm: true },
        }),
    ],
    vault: [
        death(['The Turbine Hall'], {
            id: 'va-a14-turbine-hall',
            text: 'The turbines in {zone} spin up for the finale while {tribute} is crossing the catwalk.',
            escapeText: '{tribute} feels the catwalk hum in {zone} and gets to the far door before the blades reach speed.',
            cause: 'Pulled into the turbines', code: 'machinery',
            damage: 44, terrains: ['ruins'], requires: { maxSurvivors: 8 },
        }),
        death(['The Seed Vault'], {
            id: 'va-a14-seed-vault-cold',
            text: '{zone} is kept at minus eighteen. {tribute} meant to stay an hour.',
            escapeText: '{tribute} feels the hands stop working in {zone} and leaves while the legs still do.',
            cause: 'Froze hiding in the Seed Vault', code: 'hypothermia',
            dodgeStat: 'endurance', dodgeAlt: 'willpower',
            damage: 36, frostbitten: true, terrains: ['ruins'], requires: { stance: ['Fortified', 'Defensive', 'Evasive'] },
        }),
        death(['Reactor Level'], {
            id: 'va-a14-reactor-level-sickness',
            text: 'Two days on {zone}, and {tribute}\'s hair is coming out in their hands.',
            escapeText: '{tribute} reads the sign on the wall in {zone} at last, and leaves that hour.',
            cause: 'Sickened by two days on the Reactor Level', code: 'exposure-pressure',
            dodgeStat: 'intelligence', dodgeAlt: 'endurance',
            damage: 32, terrains: ['highland'], requires: { daysAbove: 3 },
        }),
    ],
    canopy: [
        death(['The Strangler Fig'], {
            id: 'cn-a14-strangler-fig',
            text: 'The fig\'s roots have been growing around {tribute}\'s hammock in {zone} all night.',
            escapeText: '{tribute} wakes in {zone} with a root across the throat and cuts it before it tightens.',
            cause: 'Strangled in their hammock by the fig', code: 'asphyxiation',
            damage: 38, terrains: ['ruins'], requires: { time: 'night' },
        }, WL),
        death(['The Epiphyte Shelf'], {
            id: 'cn-a14-epiphyte-shelf-tip',
            text: 'The shelf of orchids and moss in {zone} was holding one person. Now it is holding {tribute} and a stranger.',
            escapeText: '{tribute} feels the shelf in {zone} tilt and jumps for a vine.',
            cause: 'Went down with the epiphyte shelf', code: 'fall',
            damage: 40, terrains: ['forest'], requires: { alone: false },
        }, WL),
        death(['Cistern Hollows'], {
            id: 'cn-a14-cistern-hollow',
            text: '{tribute} crawls into a tree hollow in {zone} to hide. It is full of rainwater to the brim.',
            escapeText: '{tribute} feels the water close over their head in {zone} and pushes back out.',
            cause: 'Drowned in a rain-filled tree hollow', code: 'drowning',
            damage: 36, terrains: ['water'], requires: { wounded: true },
        }, WL),
    ],
    acousticforest: [
        death(['Old Sawmill Ruins'], {
            id: 'af-a14-sawmill-blade',
            text: 'The old saw in {zone} starts to turn in the wind, one tooth at a time, and {tribute} is sitting against the bench.',
            escapeText: '{tribute} hears the blade start to sing in {zone} and is off the bench before it bites.',
            cause: 'Cut by the sawmill blade turning in the wind', code: 'machinery',
            damage: 40, bleeding: true, terrains: ['ruins'],
        }, WC),
        death(['Piper\'s Creek'], {
            id: 'af-a14-creek-echo',
            text: 'The echo off the banks of {zone} makes the water sound shallow. {tribute} jumps in where it is not.',
            escapeText: '{tribute} tests the depth in {zone} with a stick first, and wades where it is honest.',
            cause: 'Misled by the echo into deep water', code: 'drowning',
            damage: 38, terrains: ['water'],
        }, WC),
    ],

    // ---- events V31–V72 ------------------------------------------------------
    // (appended to the same arena keys below)
};

const EVENTS: Record<string, ArenaEventDef[]> = {
    tidewrack: [
        beat('tw-a14-v-low-low-tide', ['The Drowned Village'], 'The lowest tide of the Games uncovers {zone}. {tribute} walks its streets for an hour.', { sanity: -6, grantItem: 'rope', oncePerRun: true }),
        beat('tw-a14-v-cockle-harvest', ['Cockle Beds'], '{tribute} and a stranger dig cockles side by side in {zone}, and neither of them looks up.', { feed: 25, requires: { alone: false } }),
        beat('tw-a14-v-bottle-message', ['The Wreck Line'], 'A bottle on {zone} holds a note from last year\'s Games. {tribute} reads it twice.', { sanity: 4, oncePerRun: true }),
    ],
    thresher: [
        beat('th-a14-v-shift-whistle', ['Gantry Deck'], 'The shift whistle blows once, twice, and on the third the whole floor starts moving. {tribute} is on {zone}.', { fatigue: 14, sanity: 6, witnesses: true }),
        beat('th-a14-v-foreman-desk', ['The Foreman\'s Gallery'], '{tribute} finds a floor plan in {zone} with the Underfloor Ducts marked.', { sanity: -6, oncePerRun: true }),
        beat('th-a14-v-belt-ride', ['The Packing Hall'], '{tribute} rides the belt in {zone} across the arena in ten minutes.', { fatigue: -12 }),
    ],
    saltworks: [
        beat('sw-a14-v-pan-flood', ['Evaporation Pan Two'], '{tribute} opens the sluice to {zone}, and the pan is a lake by dusk.', { startsZoneEffect: 'flooded', quench: 20, fatigue: 8 }),
        beat('sw-a14-v-salt-trade', ['Harvest Rows'], '{tribute} trades a sack of clean salt from {zone} for a stranger\'s spare knife.', { grantItem: 'knife', requires: { alone: false } }),
        beat('sw-a14-v-pump-house-restart', ['The Pump House'], '{zone} coughs back to life at midnight, and every pan starts to fill. {tribute} drinks from the outflow.', { quench: 30, oncePerRun: true, requires: { time: 'night' } }),
    ],
    kiln: [
        beat('kl-a14-v-firing-schedule', ['Kilnhead'], '{tribute} reads the firing schedule chalked on {zone} and knows which chimney goes next.', { sanity: -6 }),
        beat('kl-a14-v-warm-shards', ['The Shard Field'], '{tribute} sleeps in {zone} on a bed of warm broken pots.', { fatigue: -16, requires: { time: 'night' } }),
        beat('kl-a14-v-clay-armour', ['Clay Banks'], '{tribute} packs wet clay over their forearms in {zone}, and it bakes hard in the sun.', { heal: 4, requires: { time: 'day' } }),
    ],
    vintage: [
        beat('vi-a14-v-harvest-festival', ['Terrace Row Two'], 'The Gamemakers light lanterns along {zone} for a harvest night. {tribute} shares grapes with a stranger under them.', { feed: 20, sanity: -12, oncePerRun: true, requires: { time: 'night' } }),
        beat('vi-a14-v-barrel-rolling', ['Barrel Vault'], '{tribute} knocks the chocks out, and six barrels thunder down the ramp of {zone}.', { fatigue: 8, witnesses: true }),
        beat('vi-a14-v-chapel-bell', ['The Old Chapel Ruins'], 'Someone rings the bell in {zone} at midnight, and every tribute knows where {tribute} is.', { sanity: 10, witnesses: true, requires: { time: 'night' } }),
    ],
    floe: [
        beat('fl-a14-v-floe-drift', ['The Big Berg'], 'Overnight {zone} drifts two zones east, with {tribute} asleep on it.', { sanity: 6, fatigue: -8, requires: { time: 'night' } }),
        beat('fl-a14-v-seal-hunt', ['The Seal Colony'], '{tribute} waits four hours over a breathing hole in {zone} and comes back with a seal.', { feed: 35, fatigue: 10 }),
        beat('fl-a14-v-wreck-stove', ['The Frozen Wreck'], '{tribute} gets the galley stove in {zone} lit with a drawer\'s worth of charts.', { fatigue: -14, heal: 6 }),
    ],
    malthouse: [
        beat('mh-a14-v-bottling-line-run', ['The Bottling Line'], '{zone} starts up by itself. {tribute} rides it past the Careers\' camp.', { fatigue: -8, sanity: 4 }),
        beat('mh-a14-v-hop-yard-cover', ['The Hop Yard'], '{tribute} lies in the bines of {zone}, and the smell covers them from the dogs.', { sanity: -6, requires: { stance: ['Evasive', 'Shadowing', 'Defensive'] } }),
        beat('mh-a14-v-drunk-career', ['The Loading Dock'], 'Two Careers have found the Spirit Store. {tribute} hears them singing at dusk from {zone} and takes the long way round.', { fatigue: 10, requires: { minSurvivors: 6 } }),
    ],
    glasshouse: [
        beat('gh-a14-v-desert-wing-night', ['The Desert Wing'], '{tribute} sleeps in {zone} because the sand stays warm.', { fatigue: -14, requires: { time: 'night' } }),
        beat('gh-a14-v-misters', ['The Tropical Wing'], 'The misting system comes on across {zone}, and {tribute} drinks from the nozzles.', { quench: 30 }),
        beat('gh-a14-v-orchid-vault-lock', ['The Orchid Vault'], '{zone} locks for a day with {tribute} and a stranger inside.', { sanity: 12, thirst: 10, oncePerRun: true, witnesses: true }),
    ],
    wardblock: [
        beat('wb-a14-v-roll-call', undefined, 'The yard speakers call roll by district. {tribute} answers in {zone} before they can stop themselves.', { sanity: 8, oncePerRun: true }),
        beat('wb-a14-v-infirmary-stock', ['The Infirmary'], '{tribute} finds one sealed box of bandages left in {zone}.', { grantItem: 'bandages', oncePerRun: true }),
        beat('wb-a14-v-lockdown', undefined, 'The lockdown siren sounds, every cell door opens, and on the third blast they all close again. {tribute} is in {zone} and counts them.', { sanity: 8, fatigue: 8, witnesses: true }),
    ],
    undercroft: [
        beat('uc-a14-v-timetable', ['Signal Room'], '{tribute} finds a timetable in {zone}. The ghost train keeps it.', { sanity: -8, oncePerRun: true }),
        beat('uc-a14-v-depot-handcar', ['The Depot Yard'], '{tribute} pumps a handcar out of {zone} and down the South tunnel.', { fatigue: -10 }),
        beat('uc-a14-v-platform-echo', ['Collapsed Platform'], 'A shout on {zone} carries down both tunnels, and {tribute} knows exactly where the Careers are.', { sanity: 4, witnesses: true }),
    ],
    seapeaks: [
        beat('sp-a14-v-low-tide-causeway', ['The Drowned Approach'], 'At low tide the causeway through {zone} comes up, and {tribute} crosses dry.', { fatigue: -10 }),
        beat('sp-a14-v-seabird-eggs', ['The Second Peak'], '{tribute} climbs the ledges of {zone} for eggs.', { feed: 25, fatigue: 8 }),
        beat('sp-a14-v-summit-signal', ['The Summit Col'], 'Whoever reaches {zone} first sees every camp. {tribute} gets there at dawn.', { sanity: -8, oncePerRun: true, requires: { time: 'day' } }),
    ],
    burnscar: [
        beat('bs-a14-v-fireweed-bloom', ['The Fireweed Slope'], '{zone} comes out pink overnight, and the bees come with it. {tribute} eats the young shoots.', { feed: 15, startsZoneEffect: 'blooming', oncePerRun: true }),
        beat('bs-a14-v-morels', ['The Old Burn Line', 'The Char Ridge'], '{tribute} finds morels in the ash of {zone}, where the fire was hottest.', { feed: 25 }),
        beat('bs-a14-v-seep-spring-fight', ['Seep Spring'], '{zone} runs one cup an hour. {tribute} and a stranger take turns, watching each other.', { quench: 20, sanity: 6, requires: { alone: false } }),
    ],
    vault: [
        beat('va-a14-v-hydroponics-harvest', ['The Hydroponics Bay'], '{tribute} pulls lettuce from {zone} under blue grow-lights.', { feed: 20 }),
        beat('va-a14-v-dormitory-bunks', ['Dormitory Block'], '{tribute} sleeps in a bunk in {zone}, three rooms from a stranger, and neither knows it.', { fatigue: -16, requires: { time: 'night' } }),
        beat('va-a14-v-intercom', undefined, 'The Vault\'s intercom reads out the air-reserve percentage every hour. {tribute}, in {zone}, starts breathing slower.', { sanity: 6 }),
    ],
    canopy: [
        beat('cn-a14-v-bridge-cut', ['The Rope Bridges'], '{tribute} cuts the bridge behind them in {zone}, and whoever was following is left on the other side.', { severesRoute: true, fatigue: 6, oncePerRun: true }),
        beat('cn-a14-v-orchid-nectar', ['Orchid Terraces'], '{tribute} drinks from the orchids on {zone}.', { quench: 20 }),
        beat('cn-a14-v-crown-view', ['The Crown'], '{tribute} climbs to {zone} and sees the whole arena as a bowl.', { sanity: -8, fatigue: 8, oncePerRun: true }),
    ],
};

for (const [id, list] of Object.entries(EVENTS)) {
    EXTRA_ARENA_EVENTS_GROUP10[id] = [...(EXTRA_ARENA_EVENTS_GROUP10[id] ?? []), ...list];
}
