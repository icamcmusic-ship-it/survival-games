import { Arena, Terrain } from '../models/types';
import { ArenaActions, ArenaEventDef, ArenaFlavor } from './arenaFlavor';

/**
 * ARENA-08: procedural arenas used to fall back on one of four pre-written
 * flavour packs keyed by biome id, so `procedural-rainforest` always read
 * exactly the same no matter what shape the generator actually rolled for
 * it. This pool replaces that fixed list: events and action lines are
 * tagged, and `proceduralArenaFlavor()` composes a flavour object from
 * whatever terrains/mood actually ended up in the generated arena, so two
 * rainforest rolls with different zones read differently.
 */

export type FlavorTag = Terrain | 'cold' | 'heat' | 'toxic' | 'height' | 'storm' | 'eerie';

export interface TaggedEvent extends ArenaEventDef {
    tags: FlavorTag[];
}

// Aim for broad tag coverage rather than deep per-biome lists — the
// composer below leans on overlap-weighting to pick a plausible subset
// for whatever terrain mix a given arena rolled.
export const PROCEDURAL_EVENTS: TaggedEvent[] = [
    // water
    {
        tags: ['water'],
        text: 'A flash flood surges through {zone}. {tribute} is dragged under and slammed against a snag before the water drops.',
        escapeText: '{tribute} feels the flood coming through {zone} and scrambles for high ground in time.',
        cause: 'Drowned in a flash flood',
        dodgeStat: 'agility',
        damage: 28,
        bleeding: true,
    },
    {
        tags: ['water'],
        text: 'The current in {zone} turns without warning and pulls {tribute} under a fallen trunk.',
        escapeText: '{tribute} reads the current shifting in {zone} and kicks for the bank.',
        cause: 'Drowned in a riptide',
        dodgeStat: 'strength',
        damage: 24,
        fatigue: 15,
    },
    {
        tags: ['water', 'toxic'],
        text: 'The water in {zone} carries something upstream that shouldn\'t be there. {tribute} drinks before noticing the sheen.',
        escapeText: '{tribute} catches the oily sheen on the water in {zone} and pours it out untouched.',
        cause: 'Poisoned by fouled water',
        dodgeStat: 'intelligence',
        damage: 12,
        poisoned: true,
        thirst: -10,
    },
    {
        tags: ['water'],
        text: 'A clean spring surfaces in {zone}. {tribute} drinks their fill before it silts back over.',
        escapeText: '{tribute} passes on the spring in {zone}, wary of a trap that never comes.',
        cause: 'Drowned chasing the spring',
        quench: 45,
    },
    // forest
    {
        tags: ['forest'],
        text: 'A rotten bough lets go above {zone} and comes down across {tribute}\'s shoulders.',
        escapeText: '{tribute} hears the bough crack over {zone} and is clear before it lands.',
        cause: 'Crushed by falling timber',
        dodgeStat: 'stealth',
        damage: 26,
        bleeding: true,
    },
    {
        tags: ['forest'],
        text: 'A column of biting insects sweeps through {zone} and over {tribute} before they can clear the ground.',
        escapeText: '{tribute} smokes the swarm off with green wood in {zone}.',
        cause: 'Stripped by an insect swarm',
        dodgeStat: 'agility',
        damage: 18,
        infected: true,
    },
    {
        tags: ['forest'],
        text: '{tribute} finds a bough of fruit hanging low over {zone}, heavy and unmistakably ripe.',
        escapeText: '{tribute} doesn\'t trust the fruit in {zone} and walks past it hungry.',
        cause: 'Poisoned by wild fruit',
        feed: 50,
        quench: 15,
    },
    {
        tags: ['forest', 'eerie'],
        text: 'Vines close around {tribute}\'s ankle in {zone} and tighten before they can cut free.',
        escapeText: '{tribute} cuts through the vines of {zone} before they close.',
        cause: 'Strangled by vines',
        dodgeStat: 'strength',
        damage: 30,
        fatigue: 18,
    },
    // open
    {
        tags: ['open'],
        text: 'The sun in {zone} has nowhere to hide from. {tribute} pushes on too long before the dizziness hits.',
        escapeText: '{tribute} reads their own shadow in {zone} and pulls back before heatstroke sets in.',
        cause: 'Died of heatstroke',
        dodgeStat: 'intelligence',
        damage: 15,
        thirst: -20,
        fatigue: 20,
    },
    {
        tags: ['open'],
        text: 'A dust squall rakes across {zone}, and {tribute} is caught in the open with no cover.',
        escapeText: '{tribute} sees the dust wall coming across {zone} and gets their back to a rock in time.',
        cause: 'Blinded and battered by a dust squall',
        dodgeStat: 'agility',
        damage: 14,
        bleeding: true,
    },
    {
        tags: ['open'],
        text: 'A supply crate drifts down over {zone} on a scorched parachute. {tribute} reaches it first.',
        escapeText: '{tribute} watches the crate come down over {zone} and decides the risk isn\'t worth it.',
        cause: 'Killed rushing an open drop',
        grantItem: 'ration_pack',
    },
    // highland
    {
        tags: ['highland', 'height'],
        text: 'The scree under {tribute} gives way in {zone} and the drop after it is a long one.',
        escapeText: '{tribute} feels the scree shift underfoot in {zone} and throws their weight uphill in time.',
        cause: 'Fell from a rockslide',
        dodgeStat: 'agility',
        damage: 32,
        bleeding: true,
    },
    {
        tags: ['highland', 'height'],
        text: 'A gust catches {tribute} at the exposed edge of {zone} and nearly takes them off the ledge.',
        escapeText: '{tribute} plants low against the gust at the edge of {zone} and rides it out.',
        cause: 'Fell from a height',
        dodgeStat: 'strength',
        damage: 40,
        bleeding: true,
    },
    {
        tags: ['highland'],
        text: 'Thin air and a hard climb through {zone} leave {tribute} light-headed and stumbling.',
        escapeText: '{tribute} paces the climb through {zone} and keeps their footing.',
        cause: 'Fell from altitude sickness',
        dodgeStat: 'strength',
        damage: 10,
        fatigue: 25,
    },
    // ruins
    {
        tags: ['ruins'],
        text: 'A floor gives way beneath {tribute} in {zone}, and old rebar is waiting below.',
        escapeText: '{tribute} tests the floor of {zone} with a thrown stone before it takes their weight.',
        cause: 'Impaled in a structural collapse',
        dodgeStat: 'intelligence',
        damage: 34,
        bleeding: true,
    },
    {
        tags: ['ruins', 'eerie'],
        text: 'Something in the dark of {zone} has been rewired to hurt. {tribute} finds out the wrong way.',
        escapeText: '{tribute} spots the tripwire threaded through {zone} and steps clean over it.',
        cause: 'Killed by an old arena trap',
        dodgeStat: 'stealth',
        damage: 30,
        bleeding: true,
    },
    {
        tags: ['ruins'],
        text: '{tribute} pries a sealed cache out of the rubble in {zone}.',
        escapeText: '{tribute} leaves a half-buried cache in {zone} alone, spooked by how easy it looks.',
        cause: 'Killed prying open a rigged cache',
        grantItem: 'medkit',
    },
    // wetland
    {
        tags: ['wetland'],
        text: 'The ground in {zone} isn\'t ground at all. {tribute} is waist-deep before the panic sets in.',
        escapeText: '{tribute} feels the mud in {zone} start to pull and backs out along their own tracks.',
        cause: 'Drowned in a bog',
        dodgeStat: 'strength',
        damage: 20,
        fatigue: 22,
    },
    {
        tags: ['wetland', 'toxic'],
        text: 'Leeches find every seam in {tribute}\'s clothing while they cross {zone}.',
        escapeText: '{tribute} keeps to open water crossing {zone} and the leeches can\'t get a hold.',
        cause: 'Bled out to leeches',
        dodgeStat: 'stealth',
        damage: 12,
        bleeding: true,
        infected: true,
    },
    {
        tags: ['wetland'],
        text: 'A stand of reeds in {zone} hides a clean bed of tubers. {tribute} digs them out.',
        escapeText: '{tribute} passes on the reed bed in {zone}, unsure what\'s rooted underneath it.',
        cause: 'Poisoned by a bad tuber',
        feed: 35,
    },
    // cold
    {
        tags: ['cold'],
        text: 'The temperature in {zone} drops hard and fast, and {tribute}\'s hands stop answering.',
        escapeText: '{tribute} gets a fire going in {zone} before the cold really bites.',
        cause: 'Froze to death',
        dodgeStat: 'intelligence',
        damage: 10,
        frostbitten: true,
        fatigue: 15,
    },
    {
        tags: ['cold', 'storm'],
        text: 'A whiteout rolls over {zone} with no warning. {tribute} loses the horizon entirely.',
        escapeText: '{tribute} anchors themselves to a fixed point in {zone} and lets the whiteout pass.',
        cause: 'Lost and frozen in a whiteout',
        dodgeStat: 'agility',
        damage: 16,
        frostbitten: true,
        sanity: 15,
    },
    {
        tags: ['cold', 'water'],
        text: 'The ice over {zone} holds for three steps and then doesn\'t. {tribute} goes through to the chest.',
        escapeText: '{tribute} spreads their weight crossing the ice of {zone} and reaches the far bank dry.',
        cause: 'Drowned under the ice',
        dodgeStat: 'agility',
        damage: 22,
        frostbitten: true,
        fatigue: 20,
    },
    {
        tags: ['cold', 'highland'],
        text: 'Wind strips the warmth out of {tribute} on the exposed shoulder of {zone} faster than they can eat it back.',
        escapeText: '{tribute} traverses below the wind line of {zone} and keeps what heat they have.',
        cause: 'Died of exposure',
        dodgeStat: 'strength',
        damage: 12,
        frostbitten: true,
        hunger: -15,
    },
    // heat
    {
        tags: ['heat'],
        text: 'Something under {zone} catches, and the ground itself starts to smoke around {tribute}\'s boots.',
        escapeText: '{tribute} smells the scorch starting under {zone} and clears it before it flares.',
        cause: 'Burned in a ground fire',
        dodgeStat: 'agility',
        damage: 26,
        burned: true,
    },
    {
        tags: ['heat', 'toxic'],
        text: 'A choking haze settles over {zone} and {tribute} breathes too much of it before moving on.',
        escapeText: '{tribute} ties a wet cloth over their face crossing {zone} and keeps the haze out.',
        cause: 'Suffocated in a toxic haze',
        dodgeStat: 'stealth',
        damage: 20,
        poisoned: true,
    },
    {
        tags: ['heat', 'open'],
        text: 'The flat of {zone} throws the heat straight back up, and {tribute}\'s water is gone by midday.',
        escapeText: '{tribute} lies up in what shade {zone} offers and moves again only once the ground cools.',
        cause: 'Died of thirst in the heat',
        dodgeStat: 'intelligence',
        damage: 14,
        thirst: -30,
        fatigue: 18,
    },
    {
        tags: ['heat', 'ruins'],
        text: 'Old metal in {zone} has been baking all day. {tribute} puts a hand flat on it before they think.',
        escapeText: '{tribute} tests the metal in {zone} with the back of a knuckle and leaves it alone.',
        cause: 'Burned on superheated metal',
        dodgeStat: 'intelligence',
        damage: 16,
        burned: true,
    },
    // storm
    {
        tags: ['storm'],
        text: 'Lightning walks the ridgeline over {zone} and finds the tallest thing standing, which is {tribute}.',
        escapeText: '{tribute} drops flat and unstrung the moment the storm rolls over {zone}.',
        cause: 'Struck by lightning',
        dodgeStat: 'agility',
        damage: 45,
        burned: true,
    },
    {
        tags: ['storm', 'open'],
        text: 'A wind shear tears through {zone} and flings loose debris straight at {tribute}.',
        escapeText: '{tribute} gets low behind cover in {zone} as the wind shear passes over.',
        cause: 'Killed by storm debris',
        dodgeStat: 'agility',
        damage: 22,
        bleeding: true,
    },
    {
        tags: ['storm', 'water'],
        text: 'The swell coming through {zone} stands up without warning and puts {tribute} face-first into the rocks.',
        escapeText: '{tribute} counts the swell in {zone} and is above the waterline when the big one lands.',
        cause: 'Drowned in a storm swell',
        dodgeStat: 'strength',
        damage: 28,
        bleeding: true,
    },
    // toxic
    {
        tags: ['toxic'],
        text: 'A pocket of bad air sits low in {zone}, and {tribute} walks right into it before smelling it.',
        escapeText: '{tribute} catches the sour smell in {zone} and holds their breath through the pocket.',
        cause: 'Poisoned by bad air',
        dodgeStat: 'intelligence',
        damage: 18,
        poisoned: true,
    },
    // height
    {
        tags: ['height'],
        text: 'A handhold shears off under {tribute} at the worst possible point in {zone}.',
        escapeText: '{tribute} tests each hold through {zone} and catches the bad one before it takes their weight.',
        cause: 'Fell to their death',
        dodgeStat: 'agility',
        damage: 50,
        bleeding: true,
    },
    {
        tags: ['height', 'ruins'],
        text: 'A stairwell in {zone} ends in open air, and {tribute} is already committed to the step.',
        escapeText: '{tribute} finds the broken stair in {zone} by touch and stops one tread short of nothing.',
        cause: 'Fell through a broken stairwell',
        dodgeStat: 'stealth',
        damage: 38,
        bleeding: true,
    },
    {
        tags: ['height', 'storm'],
        text: 'Wind pins {tribute} against the face of {zone} with nowhere to go but down.',
        escapeText: '{tribute} finds a scoop of shelter on the face of {zone} and lets the wind wear itself out.',
        cause: 'Blown from a high traverse',
        dodgeStat: 'strength',
        damage: 42,
        fatigue: 20,
    },
    // eerie
    {
        tags: ['eerie'],
        text: 'A jabberjay flock finds {tribute} in {zone} and screams in a voice from home until they can\'t think straight.',
        escapeText: '{tribute} recognises the trick in {zone} and refuses to listen.',
        cause: 'Lost to the jabberjays',
        dodgeStat: 'intelligence',
        damage: 5,
        sanity: 35,
    },
    {
        tags: ['eerie'],
        text: 'Something moves at the edge of {zone} that shouldn\'t be able to move that way. {tribute} doesn\'t sleep after.',
        escapeText: '{tribute} keeps their back to solid rock in {zone} and the thing loses interest.',
        cause: 'Killed by an unnatural mutt',
        dodgeStat: 'stealth',
        damage: 20,
        sanity: 20,
    },
    // generic / open catch-all (low-tag events every arena can still roll)
    {
        tags: ['open', 'forest', 'water', 'highland', 'ruins', 'wetland'],
        text: 'A pack of mutts corners {tribute} in {zone} before they can find an exit.',
        escapeText: '{tribute} spots the mutts circling {zone} early and gets clear before they close in.',
        cause: 'Killed by mutts',
        dodgeStat: 'agility',
        damage: 30,
        bleeding: true,
    },
    {
        tags: ['open', 'forest', 'water', 'highland', 'ruins', 'wetland'],
        text: 'A sponsor drone flares silver over {zone}, and {tribute} breaks cover to reach the fallen gift.',
        escapeText: '{tribute} watches the drone pass over {zone} and lets someone else take the risk.',
        cause: 'Killed rushing a sponsor drop',
        grantItem: 'ration_pack',
    },
];

interface ActionVariant {
    tags: FlavorTag[];
    lines: string[];
}

const FORAGE_VARIANTS: ActionVariant[] = [
    { tags: ['water', 'wetland'], lines: [
        '{tribute} works a hunch along the waterline of {zone} and comes up with {item}.',
        '{tribute} wades the shallows of {zone} and pulls {item} out of the silt.',
        '{tribute} follows the waterline of {zone} to a half-drowned cache and takes {item}.',
    ]},
    { tags: ['forest'], lines: [
        '{tribute} combs the undergrowth of {zone} and turns up {item}.',
        '{tribute} follows a game trail through {zone} and recovers {item}.',
        '{tribute} climbs for a hidden cache in {zone} and comes down with {item}.',
    ]},
    { tags: ['highland', 'height'], lines: [
        '{tribute} works a switchback in {zone} and finds {item} wedged in the rock.',
        '{tribute} picks a line up {zone} and recovers {item} from a ledge.',
        '{tribute} digs through wind-scoured scree in {zone} and pockets {item}.',
    ]},
    { tags: ['ruins'], lines: [
        '{tribute} pries through the rubble of {zone} and salvages {item}.',
        '{tribute} works a collapsed doorway in {zone} and comes out with {item}.',
        '{tribute} searches the old stores of {zone} and finds {item} still sealed.',
    ]},
    { tags: ['open'], lines: [
        '{tribute} digs through the scrub of {zone} and pockets {item}.',
        '{tribute} crosses the open ground of {zone} and finds {item} half-buried in dust.',
        '{tribute} follows a line of old tracks across {zone} and recovers {item}.',
        '{tribute} quarters {zone} in long straight lines and turns up {item}.',
    ]},
    { tags: ['cold'], lines: [
        '{tribute} breaks frozen crust off a cache in {zone} and works {item} loose.',
        '{tribute} digs down through old snow in {zone} and finds {item} underneath.',
        '{tribute} searches {zone} with numb hands and closes them around {item}.',
        '{tribute} follows a windward scour in {zone} to bare ground and recovers {item}.',
    ]},
    { tags: ['heat'], lines: [
        '{tribute} works the shaded side of {zone} in the worst of the heat and finds {item}.',
        '{tribute} sifts the hot grit of {zone} and comes up with {item}.',
        '{tribute} searches {zone} until the light goes flat, then pockets {item}.',
        '{tribute} turns over sun-cracked stone in {zone} and takes {item} from beneath it.',
    ]},
    { tags: ['toxic'], lines: [
        '{tribute} searches {zone} with a cloth over their mouth and comes away with {item}.',
        '{tribute} works fast through the fouled ground of {zone} and takes {item}.',
        '{tribute} holds their breath through the low end of {zone} and recovers {item}.',
        '{tribute} rinses the residue off {item} before pocketing it, well clear of {zone}.',
    ]},
    { tags: ['storm'], lines: [
        '{tribute} picks over what the storm left scattered across {zone} and finds {item}.',
        '{tribute} searches {zone} between gusts and gets {item} into their pack.',
        '{tribute} follows a debris line through {zone} and pulls {item} out of it.',
        '{tribute} works the lee side of {zone} while the weather holds and recovers {item}.',
    ]},
    { tags: ['eerie'], lines: [
        '{tribute} searches {zone} without ever turning their back on it and finds {item}.',
        '{tribute} takes {item} from a pack nobody has come back for in {zone}.',
        '{tribute} works quickly through {zone}, listening the whole time, and recovers {item}.',
        '{tribute} finds {item} laid out too neatly in {zone} and takes it anyway.',
    ]},
];

const REST_VARIANTS: ActionVariant[] = [
    { tags: ['cold', 'highland'], lines: [
        '{tribute} huddles in the lee of a rock in {zone}, working feeling back into their fingers.',
        '{tribute} builds a low wind-break in {zone} and rests inside it.',
        '{tribute} presses close to what warmth they can find in {zone} and waits out the hour.',
    ]},
    { tags: ['water', 'wetland'], lines: [
        '{tribute} finds dry ground above the waterline of {zone} and rests.',
        '{tribute} dries out gear on a rock in {zone} and lets their muscles unknot.',
        '{tribute} listens to the water moving through {zone} and tries to sleep.',
    ]},
    { tags: ['forest'], lines: [
        '{tribute} makes camp under cover in {zone} and lets their muscles unknot.',
        '{tribute} lashes themselves into the branches above {zone} and sleeps.',
        '{tribute} picks ticks off their legs in {zone} and rests.',
        '{tribute} banks leaf litter into a hollow in {zone} and lies down in it.',
    ]},
    { tags: ['open'], lines: [
        '{tribute} scrapes a shallow hollow in {zone} and lies in it out of the wind.',
        '{tribute} rests with their back to the only rock in {zone} and one eye open.',
        '{tribute} rations out a quiet hour in {zone}, watching the horizon in every direction.',
        '{tribute} waits out the worst of the light in {zone} and lets their legs recover.',
    ]},
    { tags: ['ruins', 'height'], lines: [
        '{tribute} sleeps in a doorway in {zone} with a clear line back out.',
        '{tribute} wedges a slab across a gap in {zone} and rests behind it.',
        '{tribute} rests on cold concrete in {zone}, listening to the building settle.',
        '{tribute} takes an hour in the shelter of {zone} and works the ache out of their hands.',
    ]},
    { tags: ['heat', 'toxic'], lines: [
        '{tribute} lies up in shade in {zone} and waits for the air to turn breathable.',
        '{tribute} rests with a damp cloth over their face in {zone}.',
        '{tribute} slows their breathing in {zone} and lets the worst of the hour pass.',
        '{tribute} sits out the heat in {zone}, sipping water they can\'t spare.',
    ]},
    { tags: ['storm', 'eerie'], lines: [
        '{tribute} rigs a lean-to in {zone} and lets the weather hammer it.',
        '{tribute} rests in {zone} with a hand on their weapon and doesn\'t really sleep.',
        '{tribute} counts the gaps between the noise in {zone} and takes what rest they can.',
        '{tribute} puts solid ground at their back in {zone} and closes their eyes for an hour.',
    ]},
];

const HIDE_VARIANTS: ActionVariant[] = [
    { tags: ['forest', 'wetland'], lines: [
        '{tribute} vanishes into the undergrowth of {zone}, green on green.',
        '{tribute} slides behind cover in {zone} and stops moving.',
        '{tribute} goes to ground in {zone} and breathes through their sleeve.',
    ]},
    { tags: ['water'], lines: [
        '{tribute} lies flat in the shallows of {zone}, only their eyes above the waterline.',
        '{tribute} slips beneath an overhang along {zone} and waits.',
        '{tribute} floats motionless in the reeds of {zone}.',
    ]},
    { tags: ['ruins', 'highland', 'height'], lines: [
        '{tribute} wedges into a gap in {zone} and waits for the danger to pass.',
        '{tribute} folds themselves into a crevice in {zone} and stops moving.',
        '{tribute} holds absolutely still against cold stone in {zone}.',
        '{tribute} climbs above the sightlines of {zone} and goes quiet.',
    ]},
    { tags: ['open'], lines: [
        '{tribute} goes flat in the scrub of {zone} and lets the grass close over them.',
        '{tribute} lies in a dry channel through {zone} and doesn\'t lift their head.',
        '{tribute} puts the low sun behind them in {zone} and stops moving.',
        '{tribute} pulls dust and dead grass over themselves in {zone} and waits.',
    ]},
    { tags: ['cold'], lines: [
        '{tribute} digs into a drift in {zone} and pulls the hole shut behind them.',
        '{tribute} lies still in the blue shadow of {zone}, breathing shallow to hide the steam.',
        '{tribute} hides where the wind has scoured {zone} clean of tracks.',
        '{tribute} presses into a snow hollow in {zone} and stops moving.',
    ]},
    { tags: ['heat', 'toxic'], lines: [
        '{tribute} hides in the haze of {zone}, trusting the air to blur them.',
        '{tribute} lies motionless in the shade of {zone} with a cloth over their face.',
        '{tribute} lets the shimmer off {zone} do the work and stays perfectly still.',
        '{tribute} tucks into a gap in {zone} and breathes as little of it as they can.',
    ]},
    { tags: ['storm', 'eerie'], lines: [
        '{tribute} lets the noise of {zone} cover them and goes to ground.',
        '{tribute} hides where nothing in {zone} sounds natural anyway.',
        '{tribute} presses into cover in {zone} and waits for the next crash to move.',
        '{tribute} stops moving in {zone} and lets the weather erase their tracks.',
    ]},
];

const HUNT_VARIANTS: ActionVariant[] = [
    { tags: ['open', 'highland'], lines: [
        '{tribute} sweeps the open ground of {zone} looking for a fight and finds only wind.',
        '{tribute} watches the approaches to {zone} with a weapon drawn, but nobody comes.',
        '{tribute} sets an ambush at the edge of {zone}, and nobody walks into it.',
    ]},
    { tags: ['forest', 'wetland'], lines: [
        '{tribute} tracks a broken trail through {zone} and loses it.',
        '{tribute} waits above a game path in {zone} with a weapon braced.',
        '{tribute} hunts the thickets of {zone} and turns up nothing but insects.',
        '{tribute} follows bent reeds through {zone} until the trail goes cold.',
    ]},
    { tags: ['water'], lines: [
        '{tribute} works the bank of {zone} looking for wet prints, and finds none.',
        '{tribute} watches the crossing at {zone} with a weapon drawn and nobody uses it.',
        '{tribute} follows the waterline of {zone} hunting, and hears only water.',
        '{tribute} lies up above the ford in {zone} and waits for a silhouette that never comes.',
    ]},
    { tags: ['ruins', 'height'], lines: [
        '{tribute} clears the doorways of {zone} one at a time and finds them all empty.',
        '{tribute} hunts the upper floors of {zone} and finds a cold camp, nothing more.',
        '{tribute} watches {zone} from above with a weapon ready, and nobody moves below.',
        '{tribute} follows scuffed dust through {zone} until it stops meaning anything.',
    ]},
    { tags: ['cold'], lines: [
        '{tribute} follows a line of prints across {zone} until the wind fills them in.',
        '{tribute} hunts {zone} for smoke and finds nothing but weather.',
        '{tribute} circles {zone} with a weapon drawn, breath fogging, and turns up no one.',
        '{tribute} waits at a frozen crossing in {zone} and nobody comes to use it.',
    ]},
    { tags: ['heat', 'toxic'], lines: [
        '{tribute} hunts the shaded edges of {zone}, where anyone sane would be lying up.',
        '{tribute} works {zone} for tracks the heat hasn\'t cooked away, and finds none.',
        '{tribute} circles {zone} with a cloth over their face and a weapon drawn.',
        '{tribute} waits out the hour at the only water in {zone} and nobody comes to drink.',
    ]},
    { tags: ['storm', 'eerie'], lines: [
        '{tribute} hunts {zone} under cover of the noise and finds nothing worth killing.',
        '{tribute} sweeps {zone} with a weapon drawn, jumping at every sound it makes.',
        '{tribute} follows something moving through {zone} and decides not to catch it.',
        '{tribute} sets an ambush in {zone} and abandons it when the light goes strange.',
    ]},
];

const TRAVEL_VARIANTS: ActionVariant[] = [
    { tags: ['water', 'wetland'], lines: [
        '{tribute} wades a crossing and comes up dripping in {zone}.',
        '{tribute} works along the bank until the ground firms up in {zone}.',
        '{tribute} picks a line between the channels and reaches {zone}.',
        '{tribute} follows the water down and lets it carry them toward {zone}.',
    ]},
    { tags: ['forest'], lines: [
        '{tribute} cuts through the undergrowth and comes out in {zone}.',
        '{tribute} follows a game trail until it opens into {zone}.',
        '{tribute} moves tree to tree and crosses into {zone}.',
        '{tribute} keeps the light on their left through the canopy and reaches {zone}.',
    ]},
    { tags: ['highland', 'height'], lines: [
        '{tribute} works a switchback up into {zone}.',
        '{tribute} traverses the loose slope and comes over the lip into {zone}.',
        '{tribute} climbs until their legs burn and drops into {zone}.',
        '{tribute} follows the ridgeline round toward {zone}.',
    ]},
    { tags: ['ruins'], lines: [
        '{tribute} picks a route through the rubble into {zone}.',
        '{tribute} follows a collapsed corridor until it lets out in {zone}.',
        '{tribute} keeps to the walls and works their way into {zone}.',
        '{tribute} crosses open floor fast and reaches cover in {zone}.',
    ]},
    { tags: ['open'], lines: [
        '{tribute} crosses open ground at a hard pace toward {zone}.',
        '{tribute} takes the long way round the flat and comes into {zone}.',
        '{tribute} keeps low across the scrub and reaches {zone}.',
        '{tribute} walks a straight line and doesn\'t stop until {zone}.',
    ]},
    { tags: ['cold'], lines: [
        '{tribute} breaks trail through deep snow into {zone}.',
        '{tribute} moves to stay warm and doesn\'t stop before {zone}.',
        '{tribute} follows the frozen course of a stream into {zone}.',
        '{tribute} walks into the wind with their face wrapped and reaches {zone}.',
    ]},
    { tags: ['heat', 'toxic'], lines: [
        '{tribute} moves in the cool of the hour and reaches {zone}.',
        '{tribute} crosses the bad air fast, breathing through a cloth, into {zone}.',
        '{tribute} rests, moves, rests again, and finally makes {zone}.',
        '{tribute} keeps to high ground out of the haze and comes down into {zone}.',
    ]},
    { tags: ['storm', 'eerie'], lines: [
        '{tribute} moves while the weather covers the sound of it and reaches {zone}.',
        '{tribute} pushes through the worst of it into {zone}.',
        '{tribute} takes a route they don\'t like at all and comes out in {zone}.',
        '{tribute} counts their own steps the whole way to {zone} to keep their head straight.',
    ]},
];

const GENERIC_PROCEDURAL_ACTIONS: ArenaActions = {
    forage: [
        '{tribute} combs {zone} and turns up {item}.',
        '{tribute} works a hunch in {zone} and recovers {item}.',
        '{tribute} digs through the scrub of {zone} and pockets {item}.',
    ],
    rest: [
        '{tribute} makes camp in {zone} and lets their muscles unknot.',
        '{tribute} rations out a quiet hour in {zone}, listening for footsteps.',
        '{tribute} sharpens what gear they have and waits out the hour in {zone}.',
    ],
    hide: [
        '{tribute} folds themselves into the cover of {zone} and stops moving.',
        '{tribute} goes to ground in {zone}, breathing through their sleeve.',
        '{tribute} holds absolutely still in {zone} until the danger passes.',
    ],
    hunt: [
        '{tribute} sweeps {zone} looking for a fight and finds only wind.',
        '{tribute} circles {zone} with a weapon drawn, hunting for prey.',
        '{tribute} sets an ambush in {zone}, but nobody walks into it.',
    ],
    travel: [
        '{tribute} moves out toward {zone}.',
        '{tribute} picks a new line and crosses into {zone}.',
        '{tribute} breaks camp and heads for {zone}.',
    ],
};

const AMBIENT_BY_TAG: Partial<Record<FlavorTag, string[]>> = {
    water: [
        'The sound of moving water never quite stops, even at the arena\'s dead centre.',
        'A hovercraft skims low over open water, dredging for something the cameras cut away from.',
        'The waterline creeps up a hand\'s width overnight, and none of the maps say why.',
        'Something large turns over below the surface and goes down again without breaking it.',
    ],
    forest: [
        'The birds in the canopy stop all at once, and the silence spreads outward.',
        'A whole stand of trees is dead on one side and green on the other, cut clean as a line on a map.',
        'The undergrowth has grown a foot since the Games opened. It was not built to grow that fast.',
    ],
    open: [
        'Nothing moves across the flats for an hour, and the cameras hold the shot anyway.',
        'Dust hangs in the air long after whatever raised it has gone.',
        'The horizon is close enough to see everything and far enough that none of it helps.',
    ],
    highland: [
        'Rock cracks somewhere above the treeline, sharp as a shot, and the echo takes its time.',
        'The high ground stands clear all morning and then vanishes into cloud within minutes.',
        'Loose stone comes down a gully with nothing at the top of it to have started it.',
    ],
    wetland: [
        'The bog exhales somewhere out in the dark, one slow bubble at a time.',
        'Insects rise off the standing water in a column tall enough to see from the ridge.',
        'The mud holds every footprint the arena has ever taken, and keeps them.',
    ],
    toxic: [
        'The air carries a chemical sweetness that no one wants to breathe twice.',
        'A low haze pools in the hollows overnight and burns off wherever the cameras are pointed.',
        'Everything green at the water\'s edge has died back in a neat, deliberate band.',
    ],
    cold: [
        'The Gamemakers push the temperature down another few degrees, just to see who notices first.',
        'Frost creeps across every exposed surface an hour before the anthem plays.',
        'Breath hangs in the air long enough to mark where someone stood.',
        'The cold comes up through the ground now, which is worse than the wind.',
    ],
    heat: [
        'Heat shimmers off the ground in sheets, bending the horizon into something unreliable.',
        'The Gamemakers hold the sun in place an hour past when it should have set.',
        'The ground ticks as it cools, loud enough to sound like footsteps.',
        'Nothing has moved in the open since midday, and nothing will until the light goes.',
    ],
    height: [
        'Wind keens across the high ground, loud enough to cover a scream from below.',
        'Cloud sits low over the ridgeline, swallowing anyone who climbs into it.',
        'From the high ground the whole arena is visible, which cuts both ways.',
        'Something falls a long way out of sight and takes a long time to land.',
    ],
    ruins: [
        'Something structural groans deep in the old stone, right on schedule.',
        'A section of wall the Gamemakers marked stable gives way with no one near it.',
        'Dust drifts down from a ceiling nobody has touched in a hundred years.',
        'A door swings somewhere in the ruins, in a building with no wind in it.',
    ],
    storm: [
        'The sky over the arena goes the wrong colour, and everyone who has seen it before starts moving.',
        'Distant thunder rolls for the third hour straight without ever quite arriving.',
        'The rain comes down in one wall and stops at a line you could walk along.',
        'Wind pushes the whole treeline flat and holds it there a beat too long.',
    ],
    eerie: [
        'A sound plays from the treeline that is almost, but not quite, a human voice.',
        'The arena falls unnaturally quiet, the way it does right before something happens.',
        'Every animal in the arena moves the same direction at the same hour.',
        'A light shows through the trees at a height nothing should be carrying it.',
    ],
};

const GENERIC_AMBIENT = [
    'The anthem plays. The faces of the fallen burn across the arena sky.',
    'A distant cannon rolls across the arena. Every tribute counts it.',
    'The Gamemakers push a false sunset across the arena sky an hour early.',
    'Somewhere out of sight, a hovercraft claims another body.',
];

function overlapScore(tags: FlavorTag[], active: Set<FlavorTag>): number {
    return tags.reduce((n, t) => n + (active.has(t) ? 1 : 0), 0);
}

function pickActions(active: Set<FlavorTag>, variants: ActionVariant[], generic: string[]): string[] {
    const matches = variants
        .filter(v => v.tags.some(t => active.has(t)))
        .map(v => ({ v, score: overlapScore(v.tags, active) / v.tags.length }))
        .sort((a, b) => b.score - a.score);
    if (matches.length === 0) return generic;
    // Blend the two best-scoring variants rather than returning a single
    // one: a highland arena that is also cold should read as both, and an
    // eight-line pool stops a long Games repeating the same three lines.
    // Scored by overlap fraction for the same reason the events are —
    // a tight two-tag variant should outrank a broad one that happens to
    // share a tag. Deterministic: no RNG, stable input order.
    const lines = matches.slice(0, 2).flatMap(m => m.v.lines);
    return Array.from(new Set(lines)).slice(0, 8);
}

/**
 * Composes a full ArenaFlavor from whatever terrain/mood tags the generated
 * arena actually contains, instead of the old fixed-pack-per-biome lookup.
 * Deterministic given the arena's own zone data — no RNG needed here, the
 * generator already baked all its randomness into the zones/name/mutts.
 */
export function proceduralArenaFlavor(arena: Arena): ArenaFlavor {
    const active = new Set<FlavorTag>();
    arena.zones.forEach(z => active.add(z.terrain));
    // Biome mood tags, inferred from the arena id the generator assigned
    // (`procedural-<biome>`), so the same terrain (e.g. `open`) still reads
    // differently between a volcanic and a highland arena.
    const moodByBiome: Record<string, FlavorTag[]> = {
        rainforest: ['toxic', 'eerie'],
        volcanic: ['heat', 'toxic'],
        archipelago: ['storm', 'water'],
        highlands: ['cold', 'height', 'storm'],
    };
    const biomeId = arena.id.replace(/^procedural-/, '');
    (moodByBiome[biomeId] || []).forEach(t => active.add(t));

    // Score by overlap fraction rather than raw overlap count, so the
    // catch-all entries (tagged with every terrain, so they always match)
    // don't crowd out the tag-specific events that actually make an arena
    // distinctive — a single-tag exact match should outrank a six-tag entry
    // that merely happens to include one active tag.
    const weighted = PROCEDURAL_EVENTS
        .map(e => ({ e, score: overlapScore(e.tags, active) / e.tags.length }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score);

    // Guarantee at least a handful of events even for a sparse tag set —
    // fall back to the catch-all entries (tagged with every terrain) if a
    // biome+terrain combo somehow scores nothing.
    const events: ArenaEventDef[] = (weighted.length >= 4 ? weighted : PROCEDURAL_EVENTS.map(e => ({ e, score: 1 })))
        .map(x => x.e)
        .slice(0, 10)
        .map(({ tags, ...rest }) => rest);

    const ambient = [
        ...GENERIC_AMBIENT.slice(0, 2),
        ...Array.from(active).flatMap(t => AMBIENT_BY_TAG[t] || []).slice(0, 6),
    ];

    const actions: ArenaActions = {
        forage: pickActions(active, FORAGE_VARIANTS, GENERIC_PROCEDURAL_ACTIONS.forage),
        rest: pickActions(active, REST_VARIANTS, GENERIC_PROCEDURAL_ACTIONS.rest),
        hide: pickActions(active, HIDE_VARIANTS, GENERIC_PROCEDURAL_ACTIONS.hide),
        hunt: pickActions(active, HUNT_VARIANTS, GENERIC_PROCEDURAL_ACTIONS.hunt),
        travel: pickActions(active, TRAVEL_VARIANTS, GENERIC_PROCEDURAL_ACTIONS.travel),
    };

    return { ambient, actions, events };
}
