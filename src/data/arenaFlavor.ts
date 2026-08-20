import { Arena, Attributes, Terrain, ZoneEffectKind } from '../models/types';
import { proceduralArenaFlavor } from './proceduralFlavor';

/**
 * Arena-specific colour: every arena gets its own hazards, its own idle
 * actions, and its own ambient broadcast lines, so the Frozen Wasteland never
 * reads like the Solar Desert with the nouns swapped.
 *
 * Templates support {tribute}, {zone} and (for forage lines) {item}.
 */

export interface ArenaEventDef {
    /** What happens when the tribute fails to avoid it. */
    text: string;
    /** What the feed says when they slip out of it. */
    escapeText: string;
    /** Cause of death recorded if this kills them. */
    cause: string;
    /** Attribute rolled against to avoid the event entirely. */
    dodgeStat?: keyof Attributes;
    /**
     * A second way out, rolled at a penalty when the primary fails. Left unset
     * on almost every event: heavy physical hazards fall back to strength
     * automatically. See `rollEscape` in `engine/encounters.ts`.
     */
    dodgeAlt?: keyof Attributes;
    /** Flat difficulty of the dodge (higher = harder). Default 6. */
    dodgeDifficulty?: number;
    damage?: number;
    bleeding?: boolean;
    poisoned?: boolean;
    burned?: boolean;
    frostbitten?: boolean;
    infected?: boolean;
    sanity?: number;
    thirst?: number;
    hunger?: number;
    fatigue?: number;
    /** Positive outcomes exist too — not every arena event is a punishment. */
    heal?: number;
    quench?: number;
    feed?: number;
    /** Item id granted by the event, if any. */
    grantItem?: string;
    /**
     * Which terrains this can plausibly happen on. Undefined means "anywhere",
     * which is what every hand-authored event defaulted to before this field
     * existed — a tribute standing on Glacier Peak could trigger "Thin Ice
     * Collapse" on solid rock a thousand feet up. Left optional rather than
     * back-filled across every event by hand; `encounters.ts` falls back to a
     * keyword guess from `cause`/`text` for events that don't set it.
     */
    terrains?: Terrain[];
    /** Hits everyone standing in the zone, not just the tribute who triggered it. */
    zoneWide?: boolean;
    /** Leaves the zone itself in this state for a while — see `ZoneEffect`. */
    startsZoneEffect?: ZoneEffectKind;
    /** Severs one of the zone's adjacency edges — a bridge going out. */
    severesRoute?: boolean;
}

export interface ArenaActions {
    forage: string[];
    rest: string[];
    hide: string[];
    hunt: string[];
    travel: string[];
}

export interface ArenaFlavor {
    /** Broadcast-style scene setting, fired occasionally with no tribute attached. */
    ambient: string[];
    actions: ArenaActions;
    events: ArenaEventDef[];
}

const GENERIC_ACTIONS: ArenaActions = {
    forage: [
        '{tribute} combs {zone} and turns up {item}.',
        '{tribute} works a hunch in {zone} and recovers {item}.',
        '{tribute} digs through the scrub of {zone} and pockets {item}.',
        '{tribute} checks a spot in {zone} they remembered from a day ago and finds {item} still there.',
        '{tribute} works {zone} systematically, corner to corner, and comes away with {item}.',
        '{tribute} gets lucky in {zone} and turns up {item} on the first pass.',
        '{tribute} spends longer than they meant to in {zone} and leaves with {item} to show for it.',
        '{tribute} follows a hunch off the obvious path through {zone} and it pays off: {item}.',
        '{tribute} works {zone} on hands and knees and comes up with {item}.',
        '{tribute} checks the ground in {zone} the way someone taught them once, and finds {item}.',
        '{tribute} takes the long way through {zone} and it turns up {item} nobody else would have found.',
        '{tribute} risks a longer look at {zone} than feels safe, and it turns up {item}.',
    ],
    rest: [
        '{tribute} makes camp in {zone} and lets their muscles unknot.',
        '{tribute} rations out a quiet hour in {zone}, listening for footsteps.',
        '{tribute} sharpens what gear they have and waits out the hour in {zone}.',
        '{tribute} sits with their back against something solid in {zone} and just breathes for a while.',
        '{tribute} takes stock of what they are carrying in {zone} and repacks it more carefully.',
        '{tribute} lets the hour pass in {zone} without doing much of anything, which is its own kind of victory.',
        '{tribute} checks their own injuries in {zone}, methodically, and does what they can about them.',
        '{tribute} watches the light change over {zone} and tries not to think about the day count.',
        '{tribute} goes still in {zone} and lets their heart rate come back down.',
        '{tribute} spends the hour in {zone} rehearsing what they will do if someone finds them.',
        '{tribute} eats slowly in {zone}, making it last longer than it needs to.',
        '{tribute} rests in {zone} with one eye open the entire time.',
    ],
    hide: [
        '{tribute} folds themselves into the cover of {zone} and stops moving.',
        '{tribute} goes to ground in {zone}, breathing through their sleeve.',
        '{tribute} holds absolutely still in {zone} until the danger passes.',
        '{tribute} presses into the deepest cover {zone} has and waits it out.',
        '{tribute} counts their own heartbeats in {zone} to keep from moving.',
        '{tribute} goes quiet in {zone} and lets the world walk past.',
        '{tribute} finds the one spot in {zone} nobody would think to check, and takes it.',
        '{tribute} stays low in {zone}, tracking every sound without moving toward any of them.',
        '{tribute} waits out the hour in {zone}, motionless, letting the arena decide it is empty.',
        '{tribute} tucks into {zone} and does not so much as shift their weight for an hour.',
    ],
    hunt: [
        '{tribute} sweeps {zone} looking for a fight and finds only wind.',
        '{tribute} circles {zone} with a weapon drawn, hunting for prey.',
        '{tribute} sets an ambush in {zone}, but nobody walks into it.',
        '{tribute} works the edges of {zone}, patient, and comes up with nothing.',
        '{tribute} tracks a set of prints through {zone} until they vanish on harder ground.',
        '{tribute} stalks {zone} for the better part of an hour and finds it empty.',
        '{tribute} reads the traffic through {zone} and decides it is not worth the wait today.',
        '{tribute} takes up a position overlooking {zone} and watches nothing happen.',
        '{tribute} hunts {zone} the way they were taught, and the arena simply does not cooperate.',
        '{tribute} moves through {zone} loud on purpose, daring somebody to notice. Nobody does.',
    ],
    travel: [
        '{tribute} moves out toward {zone}.',
        '{tribute} picks a new line and crosses into {zone}.',
        '{tribute} breaks camp and heads for {zone}.',
        '{tribute} covers ground quickly, putting {zone} behind them before the light changes.',
        '{tribute} takes the harder path into {zone} on purpose, because the easy one is too obvious.',
        '{tribute} moves toward {zone} at a pace that will not exhaust them before they get there.',
        '{tribute} crosses into {zone} without incident, which is its own small relief.',
        '{tribute} picks their way carefully toward {zone}, watching the ground as much as the treeline.',
        '{tribute} makes for {zone} with everything they own on their back.',
        '{tribute} leaves the last place behind and does not look back on the way to {zone}.',
    ],
};

export const GENERIC_ARENA_FLAVOR: ArenaFlavor = {
    ambient: [
        'The Gamemakers push a false sunset across the arena sky an hour early.',
        'Somewhere above the treeline, a hovercraft claims another body.',
        'The anthem plays. The faces of the fallen burn across the arena sky.',
        'A distant cannon rolls across the arena. Every tribute counts it.',
    ],
    actions: GENERIC_ACTIONS,
    events: [
        {
            text: '{tribute} is caught in a sudden rockfall in {zone} and is badly battered.',
            escapeText: '{tribute} hears the rock shift in {zone} and throws themselves clear.',
            cause: 'Crushed by a rockfall',
            dodgeStat: 'agility',
            damage: 28,
            bleeding: true,
        },
    ],
};

export const ARENA_FLAVOR: Record<string, ArenaFlavor> = {
    clockwork: {
        ambient: [
            'The whole island shudders and rotates one sector clockwise. The map every tribute memorised is now wrong.',
            'A bell tolls once from the centre of the island. Somewhere, a sector has just turned lethal.',
            'The tide draws back further than it should, exposing machinery beneath the sand.',
            'Lightning strikes the same dead tree for the twelfth hour in a row, exactly on schedule.',
            'Gears the size of houses grind somewhere beneath the sand, counting toward something.',
            'For one full minute every mechanism on the island stops at once. The silence is worse than the ticking.',
            'The minute hand of a buried clock face breaks the surface of the lagoon, sweeps past, and submerges again.',
            'Steam vents from a seam in the beach in perfect four-second intervals. The arena is breathing on schedule.',
        ],
        actions: {
            forage: [
                '{tribute} cracks open a shellfish along the tideline of {zone} and salvages {item}.',
                '{tribute} taps a vine in {zone} for clean water and finds {item} tangled in the roots.',
                '{tribute} times the sector clock and slips into {zone} between hazards, coming out with {item}.',
            ],
            rest: [
                '{tribute} counts the sector chimes from {zone}, mapping the island\'s schedule in their head.',
                '{tribute} rests against the warm machinery humming under {zone}.',
                '{tribute} scratches a rough clock face into the sand of {zone} and tries to predict the next horror.',
            ],
            hide: [
                '{tribute} buries themselves in the wet sand of {zone} and breathes through a reed.',
                '{tribute} wedges into a machine housing beneath {zone} and waits for the hour to turn.',
                '{tribute} lies flat in the shallows of {zone}, only their eyes above the waterline.',
            ],
            hunt: [
                '{tribute} stalks the sector boundary of {zone}, betting the clock will herd someone to them.',
                '{tribute} prowls {zone} between chimes, blade out, finding nothing but wet sand.',
                '{tribute} waits at a sector seam in {zone} for the rotation to deliver them a target.',
            ],
            travel: GENERIC_ACTIONS.travel,
        },
        events: [
            {
                text: 'THE CLOCK TURNS: a wall of blood rain floods {zone}. {tribute} is left choking, half-blind and shaking.',
                escapeText: '{tribute} reads the chimes right and clears {zone} seconds before the blood rain hits.',
                cause: 'Drowned in the blood rain',
                dodgeStat: 'intelligence',
                dodgeDifficulty: 7,
                damage: 22,
                sanity: 25,
            },
            {
                text: 'A tidal wave detonates across {zone}. {tribute} is dragged under and slammed into the machinery below.',
                escapeText: '{tribute} scrambles to high ground in {zone} as the tidal wave rips past below them.',
                cause: 'Drowned by the sector tidal wave',
                dodgeStat: 'agility',
                dodgeDifficulty: 7,
                damage: 35,
                bleeding: true,
                zoneWide: true,
            },
            {
                text: 'Acid fog rolls through {zone}. {tribute} inhales before they can cover their face and their skin begins to blister.',
                escapeText: '{tribute} smells the acid fog coming and clamps a wet cloth over their face in {zone}.',
                cause: 'Dissolved by the acid fog',
                dodgeStat: 'stealth',
                damage: 18,
                burned: true,
                poisoned: true,
            },
            {
                text: 'The sector containing {zone} rotates without warning. {tribute} is thrown off their feet and wakes up somewhere unfamiliar.',
                escapeText: '{tribute} feels {zone} begin to rotate and rides the shift out on their hands and knees.',
                cause: 'Killed by the sector shift',
                dodgeStat: 'agility',
                damage: 15,
                fatigue: 20,
                sanity: 10,
                zoneWide: true,
            },
            {
                text: 'A jabberjay flock descends on {zone}, screaming in the voices of {tribute}\'s family until they claw at their own ears.',
                escapeText: '{tribute} recognises the jabberjay trick in {zone} and refuses to listen.',
                cause: 'Lost to the jabberjays',
                dodgeStat: 'intelligence',
                damage: 5,
                sanity: 40,
            },
            {
                text: 'A freshwater spring surfaces in {zone} as the sector turns. {tribute} drinks until their head clears.',
                escapeText: '{tribute} finds the spring in {zone} already fouled with salt.',
                cause: 'Poisoned at the spring',
                heal: 10,
                quench: 60,
            },
            {
                text: 'The sector bell rings over {zone} and the ground rotates a full quarter turn. {tribute} is thrown off their feet into a bulkhead.',
                escapeText: '{tribute} counts the bell in {zone} and rides the sector shift standing up.',
                cause: 'Crushed in a sector rotation',
                dodgeStat: 'agility',
                damage: 26,
                bleeding: true,
                zoneWide: true,
            },
            {
                text: 'Jabberjays in {zone} start screaming in the voices of {tribute}\'s family. It goes on for an hour.',
                escapeText: '{tribute} recognises the jabberjays in {zone} for what they are and stops listening.',
                cause: 'Driven mad by the jabberjays',
                dodgeStat: 'intelligence',
                damage: 6,
                sanity: 35,
                fatigue: 20,
            },
            {
                text: 'The clock face over {zone} strikes and a wall of insects pours out of the treeline into {tribute}.',
                escapeText: '{tribute} is out of {zone} before the hour strikes.',
                cause: 'Stung to death by tracker jackers',
                dodgeStat: 'stealth',
                dodgeDifficulty: 7,
                damage: 30,
                poisoned: true,
            },
        ],
    },

    frozen: {
        ambient: [
            'The wind rises to a scream. Visibility across the Wasteland drops to nothing.',
            'A sheet of ice the size of a district calves off the glacier and grinds into the lake.',
            'The temperature drops another ten degrees. The Gamemakers are done being patient.',
            'The aurora over the Wasteland flares Capitol gold. Somewhere, a camera pushes in.',
            'Trees crack like gunshots in the deep cold, one ridge over, then closer.',
            'The snow squeaks underfoot at a pitch that means the temperature has passed something important.',
            'A frozen waterfall groans and shifts. It has been about to fall for days.',
            'Breath hangs in the air long after each tribute has moved on — a trail of ghosts marking every path taken.',
        ],
        actions: {
            forage: [
                '{tribute} chips through the ice crust of {zone} and pulls out {item}.',
                '{tribute} follows fox tracks across {zone} to a buried cache holding {item}.',
                '{tribute} melts snow in cupped hands in {zone} and scavenges {item} from the drift.',
            ],
            rest: [
                '{tribute} digs a snow hollow in {zone} and curls into it for warmth.',
                '{tribute} rubs feeling back into their fingers in the lee of {zone}.',
                '{tribute} packs their boots with moss in {zone} and waits out the cold.',
            ],
            hide: [
                '{tribute} buries themselves in a drift in {zone}, white on white.',
                '{tribute} presses into an ice hollow in {zone} and lets the snow cover their tracks.',
                '{tribute} lies motionless under a pine skirt in {zone} as the snow erases them.',
            ],
            hunt: [
                '{tribute} follows a fresh boot print across {zone} until the wind fills it in.',
                '{tribute} stalks the ice line of {zone}, breath steaming, weapon ready.',
                '{tribute} waits above a snowed-in trail in {zone}, but nobody comes.',
            ],
            travel: GENERIC_ACTIONS.travel,
        },
        events: [
            {
                text: 'A blizzard swallows {zone} whole. {tribute} loses hours to the whiteout and their fingers go dead grey.',
                escapeText: '{tribute} digs in ahead of the blizzard in {zone} and rides it out.',
                cause: 'Lost to the blizzard',
                dodgeStat: 'intelligence',
                damage: 20,
                frostbitten: true,
                fatigue: 25,
                zoneWide: true,
            },
            {
                text: 'The ice under {tribute} gives way in {zone}. They haul themselves out of the black water soaked through and shaking violently.',
                escapeText: '{tribute} tests the ice in {zone} with their weight and backs off before it splits.',
                cause: 'Drowned beneath the ice',
                dodgeStat: 'intelligence',
                dodgeDifficulty: 7,
                damage: 30,
                frostbitten: true,
                fatigue: 20,
            },
            {
                text: 'An avalanche tears down the slope above {zone}. {tribute} is buried to the chest and claws their way out with broken ribs.',
                escapeText: '{tribute} hears the crack above {zone} and sprints out of the avalanche path.',
                cause: 'Buried by an avalanche',
                dodgeStat: 'agility',
                dodgeDifficulty: 7,
                damage: 38,
                bleeding: true,
            },
            {
                text: 'Ice wolves circle {tribute} in {zone} for hours without attacking, and something in them starts to come apart.',
                escapeText: '{tribute} builds a fire ring in {zone} and the ice wolves keep their distance.',
                cause: 'Torn apart by ice wolves',
                dodgeStat: 'charisma',
                damage: 10,
                sanity: 35,
            },
            {
                text: 'A geothermal vent opens under {zone}. {tribute} thaws out beside it, feeling their hands again for the first time in days.',
                escapeText: '{tribute} finds the vent in {zone} already sealed over with fresh ice.',
                cause: 'Scalded by a geothermal vent',
                heal: 18,
                fatigue: -20,
            },
            {
                text: 'A snow bridge over a crevasse in {zone} gives way. {tribute} catches the lip with both arms and hauls themselves out, shaking.',
                escapeText: '{tribute} probes ahead with a pole in {zone} and finds the crevasse before it finds them.',
                cause: 'Fell into a crevasse',
                dodgeStat: 'intelligence',
                damage: 30,
                frostbitten: true,
            },
            {
                text: 'A whiteout closes over {zone}. {tribute} walks in circles until they cannot feel their hands.',
                escapeText: '{tribute} ties off to a fixed point in {zone} and waits the whiteout out.',
                cause: 'Lost in a whiteout',
                dodgeStat: 'intelligence',
                damage: 10,
                frostbitten: true,
                fatigue: 30,
                sanity: 12,
            },
            {
                text: '{tribute} finds a cache surfacing from the melt in {zone}. Someone else did not make it this far.',
                escapeText: '{tribute} searches the melt line in {zone} and turns up nothing at all.',
                cause: 'Froze to death',
                grantItem: 'dried-meat',
                feed: 30,
            },
        ],
    },

    concrete: {
        ambient: [
            'A tower somewhere in the grid folds in on itself. The dust cloud takes ten minutes to settle.',
            'Every streetlight in the dead city flickers on at once, then dies.',
            'Rats pour out of a storm drain in a single black wave and vanish.',
            'The Gamemakers cut the water table. Every fountain in the city goes dry at the same moment.',
            'A traffic signal three blocks away cycles green, amber, red, for nobody.',
            'Wind funnels down an avenue and every empty window whistles a different note.',
            'A billboard peels away from its frame and sails four storeys down into the street.',
            'Deep under the grid a train that has not run in years moves through a tunnel. Everyone hears it. Nobody says so.',
        ],
        actions: {
            forage: [
                '{tribute} pries open a rusted locker in {zone} and finds {item} inside.',
                '{tribute} searches a collapsed storefront in {zone} and salvages {item}.',
                '{tribute} siphons a dripping pipe in {zone} and pockets {item} from the debris.',
            ],
            rest: [
                '{tribute} barricades a stairwell in {zone} with rebar and finally sits down.',
                '{tribute} sleeps in the shell of a burnt-out vehicle in {zone}.',
                '{tribute} listens to the building settle around them in {zone} and lets themselves rest.',
            ],
            hide: [
                '{tribute} drops into a service duct beneath {zone} and pulls the grate shut.',
                '{tribute} flattens into a doorway alcove in {zone}, breathing dust.',
                '{tribute} climbs into a false ceiling in {zone} and goes silent.',
            ],
            hunt: [
                '{tribute} works the rooftops above {zone}, watching the streets for movement.',
                '{tribute} rigs a tripwire across a stairwell in {zone} and waits.',
                '{tribute} sweeps the empty floors of {zone} room by room, finding nothing.',
            ],
            travel: GENERIC_ACTIONS.travel,
        },
        events: [
            {
                text: 'The floor of {zone} gives out under {tribute}. They fall two storeys into rubble and glass.',
                escapeText: '{tribute} feels the concrete flex in {zone} and jumps clear before the floor drops.',
                cause: 'Killed in a building collapse',
                dodgeStat: 'agility',
                damage: 34,
                bleeding: true,
                severesRoute: true,
            },
            {
                text: 'A live wire drops across the wet floor of {zone}. {tribute} is thrown ten feet and comes to with burned hands.',
                escapeText: '{tribute} spots the sparking wire in {zone} and steps wide around the puddle.',
                cause: 'Electrocuted by a live wire',
                dodgeStat: 'intelligence',
                damage: 26,
                burned: true,
                startsZoneEffect: 'burning',
            },
            {
                text: 'The sewers under {zone} flood without warning. {tribute} is swept along in filth and surfaces retching.',
                escapeText: '{tribute} hears the sewers surge under {zone} and climbs above the waterline.',
                cause: 'Drowned in the sewer flood',
                dodgeStat: 'agility',
                damage: 18,
                infected: true,
                startsZoneEffect: 'flooded',
            },
            {
                text: 'Steel-jawed rats boil out of the walls of {zone} and take {tribute} down before they can climb.',
                escapeText: '{tribute} gets above the rat swarm in {zone} with seconds to spare.',
                cause: 'Devoured by steel-jawed rats',
                dodgeStat: 'agility',
                dodgeDifficulty: 7,
                damage: 32,
                bleeding: true,
                infected: true,
            },
            {
                text: 'A rooftop water tank in {zone} still holds clean rain. {tribute} drinks their fill and refills everything they carry.',
                escapeText: '{tribute} finds the water tank in {zone} rusted through and empty.',
                cause: 'Poisoned by tank water',
                quench: 70,
                heal: 5,
            },
            {
                text: 'A stairwell in {zone} pancakes under {tribute}. They ride three floors of rubble down and walk away limping.',
                escapeText: '{tribute} tests the stairwell in {zone} and takes the fire escape instead.',
                cause: 'Crushed in a stairwell collapse',
                dodgeStat: 'agility',
                damage: 32,
                bleeding: true,
            },
            {
                text: 'A gas main under {zone} lets go. The blast throws {tribute} across the street.',
                escapeText: '{tribute} smells the gas in {zone} and is two blocks away when it goes.',
                cause: 'Killed in a gas explosion',
                dodgeStat: 'intelligence',
                dodgeDifficulty: 7,
                damage: 34,
                burned: true,
            },
            {
                text: 'A rooftop water tank in {zone} is still sound, and still full. {tribute} drinks until their stomach hurts.',
                escapeText: '{tribute} finds the tanks in {zone} rusted through and bone dry.',
                cause: 'Drowned in a water tank',
                quench: 65,
            },
        ],
    },

    toxic: {
        ambient: [
            'The bog exhales. A green haze settles over the whole arena and refuses to lift.',
            'Something enormous moves under the water and never surfaces.',
            'The Gamemakers seed the swamp with spores. The air begins to glitter.',
            'Every insect in the swamp goes silent at once. Nothing good follows that.',
            'Bubbles rise in a slow line across the black water, tracing something long that is walking the bottom.',
            'A tree slides into the bog without a sound, upright, like something pulled it by the roots.',
            'The haze thickens until the sun is just a paler patch of green.',
            'Frogs start up in one corner of the swamp and stop in another, passing a message the tributes cannot read.',
        ],
        actions: {
            forage: [
                '{tribute} strains bog water through cloth in {zone} and recovers {item} from the reeds.',
                '{tribute} wades the shallows of {zone} and pulls {item} out of the muck.',
                '{tribute} raids a bird nest above {zone} and comes down with {item}.',
            ],
            rest: [
                '{tribute} builds a platform in the branches above {zone} and sleeps out of the water.',
                '{tribute} smears mud over every bite and scratch in {zone} and rests.',
                '{tribute} wrings out their clothes in {zone} and tries not to think about the smell.',
            ],
            hide: [
                '{tribute} submerges to the eyes in the murk of {zone} and waits.',
                '{tribute} coats themselves in swamp mud in {zone}, invisible against the bank.',
                '{tribute} hides inside a hollow dead trunk in {zone}, holding their breath.',
            ],
            hunt: [
                '{tribute} follows a trail of broken reeds through {zone} and loses it in the water.',
                '{tribute} watches the bog from a root tangle in {zone}, waiting for ripples.',
                '{tribute} stalks {zone} knife-first, but the swamp gives nothing up.',
            ],
            travel: GENERIC_ACTIONS.travel,
        },
        events: [
            {
                text: 'Hallucinogenic spores burst across {zone}. {tribute} spends the hour fighting things that are not there.',
                escapeText: '{tribute} covers their face as the spore cloud rolls over {zone} and comes through it clear-headed.',
                cause: 'Lost their mind to the spores',
                dodgeStat: 'intelligence',
                damage: 8,
                sanity: 45,
            },
            {
                text: 'A methane pocket ignites under {zone}. {tribute} is thrown clear of the blast with their arms scorched raw.',
                escapeText: '{tribute} smells the gas in {zone} and backs out before anything sparks.',
                cause: 'Killed by a methane explosion',
                dodgeStat: 'intelligence',
                dodgeDifficulty: 7,
                damage: 30,
                burned: true,
                startsZoneEffect: 'burning',
            },
            {
                text: 'The ground turns to quicksand under {tribute} in {zone}. They drag themselves out exhausted, having lost an hour and most of their strength.',
                escapeText: '{tribute} probes ahead with a branch in {zone} and skirts the sinkhole entirely.',
                cause: 'Swallowed by a quicksand sinkhole',
                dodgeStat: 'intelligence',
                damage: 15,
                fatigue: 35,
            },
            {
                text: 'A leech swarm finds {tribute} in the water of {zone}. They pull them off for an hour and still miss some.',
                escapeText: '{tribute} crosses {zone} on fallen logs and never touches the water.',
                cause: 'Bled dry by leeches',
                dodgeStat: 'stealth',
                damage: 20,
                bleeding: true,
                infected: true,
            },
            {
                text: 'A stand of clean cattails grows at the edge of {zone}. {tribute} eats properly for the first time in days.',
                escapeText: '{tribute} finds the cattails in {zone} already stripped bare.',
                cause: 'Poisoned by tainted roots',
                feed: 60,
                heal: 8,
            },
            {
                text: 'A leech mat in {zone} finds {tribute} in the water. They spend twenty minutes burning them off and lose blood the whole time.',
                escapeText: '{tribute} crosses {zone} on the fallen logs and keeps out of the water entirely.',
                cause: 'Bled dry by leeches',
                dodgeStat: 'intelligence',
                damage: 22,
                bleeding: true,
                infected: true,
            },
            {
                text: 'The bog in {zone} exhales, and {tribute} breathes in something that makes the trees start talking.',
                escapeText: '{tribute} covers their face as the bog vents in {zone} and keeps walking.',
                cause: 'Lost to the swamp gas',
                dodgeStat: 'stealth',
                damage: 8,
                sanity: 32,
                poisoned: true,
            },
            {
                text: 'A stand of clean cattails in {zone} yields real food and cleaner water than {tribute} has had in days.',
                escapeText: '{tribute} cannot tell the safe cattails in {zone} from the ones that will kill them, and leaves both.',
                cause: 'Poisoned by the swamp',
                feed: 45,
                quench: 35,
            },
        ],
    },

    solar: {
        ambient: [
            'The sun stalls at its highest point and simply stays there. The Gamemakers are not subtle today.',
            'A dust devil the height of a Capitol tower crosses the dunes and dissolves.',
            'The horizon shimmers with a city that does not exist.',
            'Night falls in minutes and the sand goes from blistering to freezing.',
            'The dunes sing — a low hum off the slip faces that goes on for an hour.',
            'Bones surface at the foot of a dune, bleached past knowing what they were.',
            'The wind erases every footprint in the arena in the space of ten minutes.',
            'Far off, a column of sand stands upright and does not disperse. The tributes give it a wide berth on instinct.',
        ],
        actions: {
            forage: [
                '{tribute} splits open a barrel cactus in {zone} and finds {item} stashed in the shade beneath it.',
                '{tribute} digs down to cool sand in {zone} and uncovers {item}.',
                '{tribute} follows a beetle trail across {zone} to a shaded cache holding {item}.',
            ],
            rest: [
                '{tribute} rigs a sunshade from cloth and bone in {zone} and waits out the worst of the heat.',
                '{tribute} lies flat in the shade of a rock shelf in {zone}, conserving everything.',
                '{tribute} scrapes a cooling trench in {zone} and lies in it until dusk.',
            ],
            hide: [
                '{tribute} buries themselves to the neck in the dunes of {zone}.',
                '{tribute} presses into a slot canyon in {zone} where the shadows never move.',
                '{tribute} lies still under a sand-coloured tarp in {zone} and disappears.',
            ],
            hunt: [
                '{tribute} follows a line of footprints across {zone} until the wind erases them.',
                '{tribute} watches the only waterline in {zone}, betting someone has to drink.',
                '{tribute} crosses the open dunes of {zone} hunting, and finds only heat.',
            ],
            travel: GENERIC_ACTIONS.travel,
        },
        events: [
            {
                text: 'A solar flare lights up {zone}. {tribute} is caught in the open and their skin blisters within minutes.',
                escapeText: '{tribute} makes the shade line in {zone} just before the solar flare hits.',
                cause: 'Burned alive by a solar flare',
                dodgeStat: 'agility',
                damage: 28,
                burned: true,
                thirst: 25,
                startsZoneEffect: 'burning',
            },
            {
                text: 'A sandstorm buries {zone}. {tribute} rides it out face-down with grit in every wound.',
                escapeText: '{tribute} reads the wind in {zone} and finds cover before the sandstorm lands.',
                cause: 'Buried by the sandstorm',
                dodgeStat: 'intelligence',
                damage: 18,
                infected: true,
                fatigue: 25,
                zoneWide: true,
            },
            {
                text: 'A mirage draws {tribute} kilometres off course in {zone}. They arrive at nothing, and the walk back nearly finishes them.',
                escapeText: '{tribute} recognises the mirage over {zone} for what it is and does not chase it.',
                cause: 'Died chasing a mirage',
                dodgeStat: 'intelligence',
                damage: 10,
                thirst: 40,
                fatigue: 30,
                sanity: 15,
            },
            {
                text: 'A sand viper strikes {tribute} in {zone} before they see it move.',
                escapeText: '{tribute} spots the coil in the sand of {zone} and steps around the viper.',
                cause: 'Killed by sand viper venom',
                dodgeStat: 'stealth',
                dodgeDifficulty: 7,
                damage: 16,
                poisoned: true,
            },
            {
                text: 'A real spring hides beneath the rocks of {zone}. {tribute} digs down to it and drinks until they can barely stand.',
                escapeText: '{tribute} digs for water in {zone} and finds nothing but hot stone.',
                cause: 'Poisoned at the spring',
                quench: 80,
                heal: 10,
            },
            {
                text: 'A dust devil crosses {zone} and scours {tribute} down to raw skin before it moves on.',
                escapeText: '{tribute} gets flat behind a rock in {zone} and lets the dust devil pass over.',
                cause: 'Flayed by a dust devil',
                dodgeStat: 'agility',
                damage: 22,
                bleeding: true,
                thirst: 20,
            },
            {
                text: 'The sand under {zone} gives way and {tribute} goes into a sinkhole to the chest. Getting out takes everything they have.',
                escapeText: '{tribute} reads the sand in {zone} and walks the firm ground around the sinkhole.',
                cause: 'Swallowed by a sinkhole',
                dodgeStat: 'intelligence',
                damage: 18,
                fatigue: 35,
            },
            {
                text: 'A night bloom opens across {zone} and holds a mouthful of water in every cup. {tribute} works the field until dawn.',
                escapeText: '{tribute} misses the night bloom in {zone} entirely, asleep a hundred metres away.',
                cause: 'Died of thirst',
                quench: 55,
                fatigue: 15,
            },
        ],
    },

    'procedural-rainforest': {
        ambient: [
            'The canopy erupts with alarm calls, then falls dead silent.',
            'Rain hammers the leaf ceiling so hard that nothing else can be heard for an hour.',
            'Something enormous shakes a tree two hundred metres off and moves on.',
        ],
        actions: {
            forage: [
                '{tribute} splits open a seed pod in {zone} and finds {item} inside.',
                '{tribute} climbs for a bromeliad pool in {zone} and comes down with {item}.',
                '{tribute} follows a foraging trail through {zone} and recovers {item}.',
            ],
            rest: [
                '{tribute} lashes themselves into a fork of the canopy above {zone} and sleeps.',
                '{tribute} dries out under a broad leaf in {zone}, listening to the rain.',
                '{tribute} picks ticks off their legs in {zone} and rests.',
            ],
            hide: [
                '{tribute} vanishes into the undergrowth of {zone}, green on green.',
                '{tribute} climbs high into the canopy above {zone} and stops moving.',
                '{tribute} slides behind a buttress root in {zone} and waits.',
            ],
            hunt: [
                '{tribute} tracks a broken vine trail through {zone} and loses it.',
                '{tribute} waits above a game trail in {zone} with a weapon braced.',
                '{tribute} hunts the thickets of {zone} and turns up nothing but insects.',
            ],
            travel: GENERIC_ACTIONS.travel,
        },
        events: [
            {
                text: 'A flash flood tears through {zone}. {tribute} is swept into deadfall and pinned there until the water drops.',
                escapeText: '{tribute} hears the flood coming through {zone} and climbs.',
                cause: 'Drowned in a flash flood',
                dodgeStat: 'agility',
                damage: 30,
                bleeding: true,
            },
            {
                text: 'An insect swarm engulfs {tribute} in {zone}, and the swelling closes one eye entirely.',
                escapeText: '{tribute} smokes the insect swarm off with green wood in {zone}.',
                cause: 'Killed by an insect swarm',
                dodgeStat: 'stealth',
                damage: 20,
                poisoned: true,
            },
            {
                text: 'Constrictor vines take hold of {tribute} in {zone} and tighten before they can cut free.',
                escapeText: '{tribute} cuts through the constrictor vines of {zone} before they close.',
                cause: 'Crushed by constrictor vines',
                dodgeStat: 'strength',
                damage: 32,
                fatigue: 20,
            },
            {
                text: 'A column of army ants sweeps through {zone} and over {tribute} before they can clear the ground.',
                escapeText: '{tribute} hears the ant column coming through {zone} and climbs.',
                cause: 'Stripped by army ants',
                dodgeStat: 'agility',
                damage: 24,
                infected: true,
            },
            {
                text: 'A strangler fig in {zone} drops a limb the width of a torso across {tribute}\'s back.',
                escapeText: '{tribute} hears the fig limb crack over {zone} and is clear before it lands.',
                cause: 'Crushed by falling timber',
                dodgeStat: 'stealth',
                damage: 30,
                bleeding: true,
            },
            {
                text: 'A fruiting bough hangs low over {zone}, heavy and unmistakably safe. {tribute} eats their fill.',
                escapeText: '{tribute} does not trust the fruit in {zone} and walks past it hungry.',
                cause: 'Poisoned by jungle fruit',
                feed: 55,
                quench: 20,
            },
        ],
    },

    'procedural-volcanic': {
        ambient: [
            'Ash falls like grey snow across the whole arena.',
            'The ground shudders. Somewhere, a new vent has opened.',
            'The sky over the caldera glows orange all night. Nobody sleeps well.',
        ],
        actions: {
            forage: [
                '{tribute} scrapes condensation off cool basalt in {zone} and finds {item} wedged in the rock.',
                '{tribute} searches an ash-buried cache in {zone} and pulls free {item}.',
                '{tribute} works a fissure in {zone} and recovers {item}.',
            ],
            rest: [
                '{tribute} sleeps on warm stone in {zone}, the only comfort this arena offers.',
                '{tribute} shakes ash out of everything they own in {zone}.',
                '{tribute} wraps cloth over their mouth in {zone} and rests shallowly.',
            ],
            hide: [
                '{tribute} slips into a lava tube beneath {zone} and goes quiet.',
                '{tribute} lies in the ash of {zone} until they are just another grey shape.',
                '{tribute} wedges between basalt columns in {zone}, unseen.',
            ],
            hunt: [
                '{tribute} follows fresh prints through the ash of {zone} until they stop.',
                '{tribute} watches the only pass out of {zone}, waiting.',
                '{tribute} hunts the cinder fields of {zone} and finds them empty.',
            ],
            travel: GENERIC_ACTIONS.travel,
        },
        events: [
            {
                text: 'A lava flow cuts across {zone}. {tribute} escapes with their boots melted through and their legs scorched.',
                escapeText: '{tribute} reads the flow line in {zone} and gets clear of the lava in time.',
                cause: 'Consumed by the lava flow',
                dodgeStat: 'agility',
                damage: 35,
                burned: true,
            },
            {
                text: 'An ash storm buries {zone}. {tribute} breathes it in and cannot stop coughing.',
                escapeText: '{tribute} seals their face and rides out the ash storm in {zone}.',
                cause: 'Suffocated by the ash storm',
                dodgeStat: 'intelligence',
                damage: 18,
                infected: true,
                fatigue: 20,
            },
            {
                text: 'A steam vent opens directly under {tribute} in {zone}.',
                escapeText: '{tribute} hears the vent building under {zone} and moves off the fissure.',
                cause: 'Scalded to death by a steam vent',
                dodgeStat: 'agility',
                dodgeDifficulty: 7,
                damage: 30,
                burned: true,
            },
            {
                text: 'A lava tube under {zone} collapses. {tribute} drops into the hollow and comes out with their forearms seared.',
                escapeText: '{tribute} sounds the ground in {zone} and skirts the hollow tube entirely.',
                cause: 'Burned alive in a lava tube',
                dodgeStat: 'intelligence',
                damage: 32,
                burned: true,
            },
            {
                text: 'An ash storm buries {zone}. {tribute} spends the hour on their knees, breathing through a sleeve.',
                escapeText: '{tribute} finds a lee in {zone} before the ash storm arrives.',
                cause: 'Choked on volcanic ash',
                dodgeStat: 'stealth',
                damage: 14,
                fatigue: 30,
                sanity: 12,
            },
        ],
    },

    'procedural-archipelago': {
        ambient: [
            'The storm front stalls directly over the arena and simply stays there.',
            'The tide goes out far enough to expose a land bridge that was not there this morning.',
            'Gulls scatter off the water all at once. Something below them is hunting.',
        ],
        actions: {
            forage: [
                '{tribute} works the tide pools of {zone} and comes up with {item}.',
                '{tribute} dives the shallows off {zone} and surfaces holding {item}.',
                '{tribute} picks over the wrack line in {zone} and salvages {item}.',
            ],
            rest: [
                '{tribute} dries salt off their gear on the rocks of {zone}.',
                '{tribute} sleeps above the tide line in {zone}, listening to the surf.',
                '{tribute} rigs a rain catch in {zone} and rests beneath it.',
            ],
            hide: [
                '{tribute} tucks under an overhang in {zone} where the spray hides their tracks.',
                '{tribute} floats motionless in the shallows off {zone}.',
                '{tribute} hides among the wreck timbers of {zone}.',
            ],
            hunt: [
                '{tribute} watches the crossing to {zone} for anyone foolish enough to swim it.',
                '{tribute} patrols the beach of {zone}, weapon in hand.',
                '{tribute} searches the rocks of {zone} for a rival and finds only crabs.',
            ],
            travel: GENERIC_ACTIONS.travel,
        },
        events: [
            {
                text: 'A riptide off {zone} drags {tribute} out past the break. They fight back to shore with nothing left.',
                escapeText: '{tribute} swims parallel to the shore of {zone} and slips the riptide.',
                cause: 'Drowned in the riptide',
                dodgeStat: 'strength',
                damage: 25,
                fatigue: 35,
            },
            {
                text: 'A tropical storm hammers {zone}. {tribute} is thrown against the rocks and cut open.',
                escapeText: '{tribute} finds a lee in {zone} and waits the tropical storm out.',
                cause: 'Killed by the tropical storm',
                dodgeStat: 'intelligence',
                damage: 26,
                bleeding: true,
            },
            {
                text: 'Razorfin sharks find {tribute} in the water off {zone}.',
                escapeText: '{tribute} sees the fins off {zone} and makes shore before they close.',
                cause: 'Taken by razorfin sharks',
                dodgeStat: 'agility',
                dodgeDifficulty: 7,
                damage: 40,
                bleeding: true,
            },
            {
                text: 'A whirlpool opens in the channel off {zone} and takes {tribute} under twice before it lets go.',
                escapeText: '{tribute} sees the water turning off {zone} and swims wide of the whirlpool.',
                cause: 'Drowned in a whirlpool',
                dodgeStat: 'strength',
                dodgeDifficulty: 7,
                damage: 34,
                fatigue: 30,
            },
            {
                text: 'A wreck breaks up on the reef off {zone} and {tribute} walks a week of stores off the sand.',
                escapeText: '{tribute} watches the wreck break up off {zone} and cannot reach any of it.',
                cause: 'Drowned in the surf',
                grantItem: 'water',
                feed: 30,
                quench: 30,
            },
        ],
    },

    'procedural-highlands': {
        ambient: [
            'Fog rolls up the glen and swallows half the arena.',
            'The wind on the ridge line rises to a howl that does not stop all night.',
            'Lightning walks along the summit, striking the same stones over and over.',
        ],
        actions: {
            forage: [
                '{tribute} digs through the heather of {zone} and turns up {item}.',
                '{tribute} follows a spring line in {zone} and finds {item} beside it.',
                '{tribute} searches a shepherd\'s cairn in {zone} and recovers {item}.',
            ],
            rest: [
                '{tribute} shelters behind a drystone wall in {zone} and sleeps.',
                '{tribute} dries their boots over a peat fire in {zone}.',
                '{tribute} lies out of the wind in {zone}, watching the ridge.',
            ],
            hide: [
                '{tribute} lies flat in the heather of {zone} and disappears.',
                '{tribute} slips into the fog bank over {zone} and is gone.',
                '{tribute} crouches in a peat cutting in {zone}, still as stone.',
            ],
            hunt: [
                '{tribute} works the ridge above {zone}, glassing the ground below.',
                '{tribute} tracks bootprints through the peat of {zone} until the rain fills them.',
                '{tribute} hunts the moor of {zone} and finds it empty.',
            ],
            travel: GENERIC_ACTIONS.travel,
        },
        events: [
            {
                text: 'A rockslide comes down the scree above {zone}. {tribute} is caught at the edge of it and carried thirty metres.',
                escapeText: '{tribute} hears the scree go above {zone} and gets behind a boulder.',
                cause: 'Crushed in a rockslide',
                dodgeStat: 'agility',
                damage: 33,
                bleeding: true,
            },
            {
                text: 'A fog bank closes over {zone} and {tribute} walks in circles for hours, freezing and disoriented.',
                escapeText: '{tribute} navigates the fog over {zone} by the slope of the ground alone.',
                cause: 'Lost in the fog',
                dodgeStat: 'intelligence',
                damage: 12,
                frostbitten: true,
                fatigue: 30,
                sanity: 15,
            },
            {
                text: 'Lightning strikes the ridge beside {tribute} in {zone}. They come to face down with their ears ringing and no memory of falling.',
                escapeText: '{tribute} gets off the high ground of {zone} before the lightning walks in.',
                cause: 'Struck by lightning',
                dodgeStat: 'intelligence',
                dodgeDifficulty: 7,
                damage: 34,
                burned: true,
            },
            {
                text: 'A peat bog in {zone} takes {tribute} to the thigh, and the cold water takes everything else.',
                escapeText: '{tribute} tests the peat in {zone} with a staff and finds the firm line across.',
                cause: 'Drowned in a peat bog',
                dodgeStat: 'intelligence',
                damage: 20,
                frostbitten: true,
                fatigue: 25,
            },
            {
                text: 'Dire rams come off the ridge above {zone} at a dead run. {tribute} is caught in the open.',
                escapeText: '{tribute} gets behind a drystone wall in {zone} before the rams reach them.',
                cause: 'Trampled by dire rams',
                dodgeStat: 'agility',
                damage: 30,
                bleeding: true,
            },
        ],
    },

    ashfall: {
        ambient: [
            'Grey snow falls across the whole basin. None of it is cold, and none of it is snow.',
            'The caldera floor shudders once, settles, and goes quiet again.',
            'Ash builds on the shoulders of everything standing still long enough.',
            'The sun comes up brown through the ashfall and never quite finishes the job.',
            'A fumarole opens at the edge of a zone with a sound like a struck bell.',
            'The ash records everything: prints, drag marks, where somebody knelt. The whole arena is a ledger.',
            'Heat lightning flickers inside the ash cloud, lighting it from within like a lamp.',
            'Somewhere upslope, rock cracks in the heat — one report, then its echo, then nothing.',
        ],
        actions: {
            forage: [
                '{tribute} digs through the ash crust of {zone} and turns up {item}.',
                '{tribute} sifts the warm grit of {zone} and comes away with {item}.',
                '{tribute} pries {item} out of a hardened ash drift in {zone}.',
            ],
            rest: [
                '{tribute} scrapes a hollow in the warm ash of {zone} and lies in it.',
                '{tribute} ties a strip of cloth over their mouth and rests in {zone}.',
                '{tribute} sits with their back to a basalt block in {zone}, breathing shallowly.',
            ],
            hide: [
                '{tribute} lets the ashfall bury their outline in {zone} and stops moving.',
                '{tribute} presses into a fissure in {zone} where the heat masks their body.',
                '{tribute} goes still behind a slab of cooled lava in {zone}.',
            ],
            hunt: [
                '{tribute} follows a line of footprints through the ash of {zone} until the fall erases them.',
                '{tribute} works the rim above {zone}, watching for movement in the grey.',
                '{tribute} stalks the vents of {zone} and finds only heat shimmer.',
            ],
            travel: GENERIC_ACTIONS.travel,
        },
        events: [
            {
                text: 'A pyroclastic gust rolls across {zone}. {tribute} is knocked flat and scorched through their clothes.',
                escapeText: '{tribute} drops behind a lava ridge in {zone} as the gust passes overhead.',
                cause: 'Caught in a pyroclastic gust',
                dodgeStat: 'agility',
                dodgeDifficulty: 7,
                damage: 34,
                burned: true,
                startsZoneEffect: 'burning',
            },
            {
                text: 'The ground of {zone} splits without warning. {tribute} goes into the fissure to the shoulder before they stop themselves.',
                escapeText: '{tribute} feels {zone} shift underfoot and is already moving when it opens.',
                cause: 'Swallowed by a ground fissure',
                dodgeStat: 'agility',
                damage: 28,
                bleeding: true,
                severesRoute: true,
            },
            {
                text: 'The ashfall thickens over {zone} until {tribute} cannot breathe without tasting the basin. They cough until something tears.',
                escapeText: '{tribute} rigs a cloth filter and waits out the ashfall surge in {zone}.',
                cause: 'Choked on volcanic ash',
                dodgeStat: 'intelligence',
                damage: 16,
                fatigue: 25,
                sanity: 10,
                zoneWide: true,
            },
            {
                text: 'A vent in {zone} exhales superheated steam directly into {tribute}.',
                escapeText: '{tribute} hears the vent building under {zone} and steps off the fissure line.',
                cause: 'Scalded by a steam vent',
                dodgeStat: 'stealth',
                dodgeDifficulty: 7,
                damage: 30,
                burned: true,
            },
            {
                text: 'A hot spring in {zone} runs clear for once. {tribute} drinks until their stomach aches.',
                escapeText: '{tribute} tests the spring in {zone}, decides against it, and moves on.',
                cause: 'Boiled alive',
                quench: 60,
                heal: 6,
            },
            {
                text: 'A crust of cooled lava over {zone} gives way and drops {tribute} onto rock that is still warm enough to blister.',
                escapeText: '{tribute} taps the crust ahead of them in {zone} and finds the solid line.',
                cause: 'Burned through the lava crust',
                dodgeStat: 'intelligence',
                damage: 26,
                burned: true,
            },
            {
                text: 'Cinder hounds work {zone} in a loose line, driving {tribute} out of cover and into open ground.',
                escapeText: '{tribute} goes upwind of the cinder hounds in {zone} and loses them in the ash.',
                cause: 'Run down by cinder hounds',
                dodgeStat: 'stealth',
                dodgeDifficulty: 7,
                damage: 32,
                bleeding: true,
            },
        ],
    },

    tempest: {
        ambient: [
            'The storm front over the Reach has not moved in three days. It is not going to.',
            'Lightning walks the water offshore, striking the same stretch again and again.',
            'The tide comes in fast enough to hear. Somewhere out there it takes a zone with it.',
            'Rain drives sideways across the whole arena and the cameras give up entirely.',
            'Between squalls comes a stillness so total that every tribute stops to distrust it.',
            'The sea throws something man-sized onto the shingle and takes it back with the next wave.',
            'Salt spray reaches zones that have no view of the water. Nowhere in the Reach is dry.',
            'Thunder arrives before its lightning. The storm has stopped following the rules.',
        ],
        actions: {
            forage: [
                '{tribute} works the wrack line of {zone} in the driving rain and salvages {item}.',
                '{tribute} pries {item} out of a flooded locker in {zone}.',
                '{tribute} wades the shallows off {zone} and comes up holding {item}.',
            ],
            rest: [
                '{tribute} wrings out their clothes in the lee of {zone} and shivers through the hour.',
                '{tribute} rigs a tarp against the wind in {zone} and lets the rain hammer it.',
                '{tribute} sleeps sitting upright in {zone}, above the waterline.',
            ],
            hide: [
                '{tribute} slips under a collapsed hull in {zone} and lets the rain cover the sound.',
                '{tribute} lies in the flooded grass of {zone} with only their face above water.',
                '{tribute} wedges into a drain culvert in {zone} and waits.',
            ],
            hunt: [
                '{tribute} patrols the waterline of {zone} with the wind at their back.',
                '{tribute} watches the crossing into {zone} for anyone stupid enough to swim it.',
                '{tribute} tracks bootprints through the mud of {zone} until the rain fills them.',
            ],
            travel: GENERIC_ACTIONS.travel,
        },
        events: [
            {
                text: 'A storm surge comes over the breakwater at {zone}. {tribute} is picked up, carried, and put down hard.',
                escapeText: '{tribute} reads the swell off {zone} and gets to high ground before the surge lands.',
                cause: 'Drowned in the storm surge',
                dodgeStat: 'strength',
                damage: 32,
                fatigue: 25,
                zoneWide: true,
            },
            {
                text: 'Lightning finds the highest thing in {zone}, and {tribute} is standing next to it.',
                escapeText: '{tribute} gets off the exposed ground of {zone} before the barrage walks in.',
                cause: 'Struck by lightning',
                dodgeStat: 'intelligence',
                dodgeDifficulty: 7,
                damage: 38,
                burned: true,
            },
            {
                text: 'The king tide floods {zone} to the chest in under a minute. {tribute} loses everything they were not holding.',
                escapeText: '{tribute} reads the tide line in {zone} and is above it when the water arrives.',
                cause: 'Taken by the king tide',
                dodgeStat: 'intelligence',
                damage: 14,
                fatigue: 30,
                sanity: 10,
                startsZoneEffect: 'flooded',
            },
            {
                text: 'The rain over {zone} eases just long enough for {tribute} to fill everything they own with fresh water.',
                escapeText: '{tribute} misses the break in the weather over {zone} entirely.',
                cause: 'Drowned',
                quench: 70,
            },
            {
                text: 'The wind over {zone} takes the roof off something and puts it through the air at head height. {tribute} does not see it coming.',
                escapeText: '{tribute} keeps low through {zone} and lets the debris go over them.',
                cause: 'Killed by storm debris',
                dodgeStat: 'agility',
                damage: 30,
                bleeding: true,
            },
            {
                text: 'A drain backs up under {zone} and floods it with brackish water to the knee. Every cut {tribute} has goes bad within hours.',
                escapeText: '{tribute} stays above the waterline in {zone} and keeps their boots dry.',
                cause: 'Killed by a septic wound',
                dodgeStat: 'intelligence',
                damage: 12,
                infected: true,
            },
        ],
    },

    saltflats: {
        ambient: [
            'The glare comes off the salt from below as well as above. There is no shade anywhere in the arena.',
            'Heat shimmer turns the far side of the flats into open water. It has fooled better tributes than these.',
            'The crust ticks and pops all afternoon as it expands.',
            'A wind crosses the Mirror and lifts a haze of salt that stings every open wound in the arena.',
            'The flats double the sky: two suns, two horizons, and tributes walking on both of them.',
            'A pressure ridge buckles somewhere out on the crust with a crack that carries for miles.',
            'By noon every distant tribute is a black flame wavering above the white. Counting them is guesswork.',
            'The salt creeps: overnight it has grown a fine crystal fur on everything left standing still.',
        ],
        actions: {
            forage: [
                '{tribute} breaks through the salt crust in {zone} and recovers {item} from the mud beneath.',
                '{tribute} works a cache someone abandoned in {zone} and takes {item}.',
                '{tribute} finds {item} half-buried in the crust of {zone}.',
            ],
            rest: [
                '{tribute} builds a lean-to from crust slabs in {zone} and crawls under it.',
                '{tribute} lies flat in {zone} with cloth over their face until the sun drops.',
                '{tribute} rations a mouthful of water in {zone} and makes it last an hour.',
            ],
            hide: [
                '{tribute} lies in a salt trench in {zone} and lets the glare do the rest.',
                '{tribute} presses into the only shadow in {zone} and holds absolutely still.',
                '{tribute} crusts themselves white in {zone} until they read as ground.',
            ],
            hunt: [
                '{tribute} sweeps {zone} with a hand over their eyes, hunting movement in the haze.',
                '{tribute} follows a trail of crust footprints across {zone} for a mile before losing it.',
                '{tribute} waits at the only water in {zone} for whoever gets thirsty first.',
            ],
            travel: GENERIC_ACTIONS.travel,
        },
        events: [
            {
                text: 'The whiteout glare over {zone} takes {tribute}\'s sight for the better part of an hour. They walk into everything.',
                escapeText: '{tribute} smears ash under their eyes and works through the glare over {zone}.',
                cause: 'Died blind and lost on the flats',
                dodgeStat: 'intelligence',
                damage: 12,
                sanity: 20,
                fatigue: 20,
                zoneWide: true,
            },
            {
                text: 'The crust gives way under {tribute} in {zone} and drops them into brine to the waist. It burns every cut they have.',
                escapeText: '{tribute} tests the crust ahead of them in {zone} and skirts the thin ground.',
                cause: 'Drowned in a brine sink',
                dodgeStat: 'agility',
                damage: 24,
                infected: true,
                severesRoute: true,
            },
            {
                text: 'A brine squall crosses {zone} and scours {tribute} raw with airborne salt.',
                escapeText: '{tribute} gets downwind of a spire in {zone} before the squall arrives.',
                cause: 'Flayed by a brine squall',
                dodgeStat: 'stealth',
                damage: 20,
                bleeding: true,
                thirst: 25,
            },
            {
                text: 'A mirage draws {tribute} two miles across {zone} to nothing at all. The walk back nearly finishes them.',
                escapeText: '{tribute} recognises the mirage over {zone} for what it is and stays put.',
                cause: 'Died chasing water that was not there',
                dodgeStat: 'intelligence',
                dodgeDifficulty: 7,
                damage: 10,
                thirst: 35,
                fatigue: 30,
                sanity: 12,
            },
            {
                text: 'Salt locusts come across {zone} in a sheet. {tribute} covers their face and takes the rest of it on bare skin.',
                escapeText: '{tribute} gets under a crust slab in {zone} as the locusts pass over.',
                cause: 'Stripped by salt locusts',
                dodgeStat: 'stealth',
                damage: 24,
                bleeding: true,
            },
            {
                text: 'The crystal spires above {zone} focus the sun into a line that crosses {tribute} like a blade.',
                escapeText: '{tribute} tracks the shadow of the spires across {zone} and stays out of the burn line.',
                cause: 'Burned by focused sunlight',
                dodgeStat: 'intelligence',
                dodgeDifficulty: 7,
                damage: 28,
                burned: true,
            },
        ],
    },

    sporefields: {
        ambient: [
            'The caps of the Spore Fields glow faintly once the light drops. It is beautiful, and it is deliberate.',
            'Something releases across the whole arena at once and the air goes gold with it.',
            'The ground gives slightly underfoot everywhere. All of it is alive.',
            'A low, wet sound moves through the mycelium and stops.',
            'A ring of caps has grown overnight around one tribute\'s camp, evenly spaced, facing inward.',
            'Spore-light pulses through the ground in slow waves, passing under the tributes\' feet and moving on.',
            'A stand of stalks leans toward the passing tributes as they go, and rights itself after.',
            'Something in the Fields has learned to mimic a cannon. It is not quite right, and that is worse.',
        ],
        actions: {
            forage: [
                '{tribute} cuts into a cap in {zone} and recovers {item} from the hollow inside.',
                '{tribute} works the mycelial mat of {zone} and turns up {item}.',
                '{tribute} finds {item} caught in the gills of a fallen cap in {zone}.',
            ],
            rest: [
                '{tribute} beds down on the soft mat of {zone} and tries not to breathe deeply.',
                '{tribute} sits with their back against a stalk in {zone}, watching the spores drift.',
                '{tribute} sleeps badly in {zone}, dreaming of things with too many arms.',
            ],
            hide: [
                '{tribute} slips under a cap in {zone} and disappears entirely.',
                '{tribute} lies in the mycelium of {zone} until it grows over their boots.',
                '{tribute} holds still in the glow of {zone}, counting their own heartbeats.',
            ],
            hunt: [
                '{tribute} follows crushed mycelium through {zone} — someone came this way.',
                '{tribute} circles the caps of {zone} with a blade out, listening.',
                '{tribute} sets a snare in the stalks of {zone} and waits for it to sing.',
            ],
            travel: GENERIC_ACTIONS.travel,
        },
        events: [
            {
                text: 'A cap the size of a house bursts over {zone}. {tribute} breathes in a lungful of the bloom and starts seeing the dead.',
                escapeText: '{tribute} covers their face and gets clear of the spore bloom in {zone}.',
                cause: 'Killed by a spore bloom',
                dodgeStat: 'agility',
                damage: 18,
                poisoned: true,
                sanity: 30,
                zoneWide: true,
            },
            {
                text: 'The cap {tribute} is standing on in {zone} gives way. They fall through rot to the ground beneath.',
                escapeText: '{tribute} tests the cap in {zone}, hears it creak, and steps back off it.',
                cause: 'Crushed under a collapsing cap',
                dodgeStat: 'agility',
                damage: 30,
                bleeding: true,
            },
            {
                text: 'A rot sink opens under {tribute} in {zone} and they go in to the chest. Whatever is down there has been digesting for years.',
                escapeText: '{tribute} spots the sag in the mat of {zone} and works around it.',
                cause: 'Swallowed by a rot sink',
                dodgeStat: 'intelligence',
                damage: 22,
                infected: true,
            },
            {
                text: 'A flush of pale, honest mushrooms comes up overnight in {zone}. {tribute} recognises them and eats until they are full.',
                escapeText: '{tribute} does not trust anything growing in {zone} and goes hungry.',
                cause: 'Poisoned by the wrong mushroom',
                feed: 60,
                heal: 8,
            },
            {
                text: 'Spore moths settle on {tribute} in {zone} in their hundreds. What they leave behind gets into the cuts.',
                escapeText: '{tribute} smokes the spore moths off with a smouldering cap in {zone}.',
                cause: 'Killed by spore moth rot',
                dodgeStat: 'agility',
                damage: 18,
                infected: true,
                sanity: 12,
            },
            {
                text: 'The mycelium under {zone} contracts all at once and {tribute} is pulled off their feet into something with a mouth.',
                escapeText: '{tribute} feels the mat under {zone} start to move and is off it before it closes.',
                cause: 'Taken by the mycelium',
                dodgeStat: 'stealth',
                dodgeDifficulty: 7,
                damage: 34,
                bleeding: true,
            },
        ],
    },

    canopy: {
        ambient: [
            'The Hanging Gardens creak all night. Two hundred metres of nothing is doing the creaking.',
            'A rope bridge somewhere in the arena parts on its own. Nobody was on it. This time.',
            'Mist sits in the canopy until midday and hides everything below the third branch.',
            'Something moves along the underside of a bough, and every tribute in earshot goes still.',
            'A flowering vine has closed over a gap that was a path yesterday. The Gardens are editing themselves.',
            'Petals fall for an hour from somewhere too high to see. Nobody trusts them enough to look up long.',
            'A dropped waterskin falls through the canopy for a very long time. Everyone near enough counts the seconds.',
            'Birdsong starts at dusk from a part of the Gardens where no tribute has ever seen a bird.',
        ],
        actions: {
            forage: [
                '{tribute} works an orchid basket in {zone} and recovers {item} from the leaf litter.',
                '{tribute} climbs out along a bough in {zone} and comes back with {item}.',
                '{tribute} taps a water vine in {zone} and finds {item} caught in the fork.',
            ],
            rest: [
                '{tribute} lashes themselves to a branch in {zone} and sleeps above the drop.',
                '{tribute} rests in a bark hollow in {zone}, one hand on the rope the whole time.',
                '{tribute} sits with their legs over the edge in {zone} and does not look down.',
            ],
            hide: [
                '{tribute} folds into a bromeliad the size of a bathtub in {zone}.',
                '{tribute} climbs above the sightlines of {zone} and goes still in the leaves.',
                '{tribute} hangs beneath a bough in {zone}, out of every angle of view.',
            ],
            hunt: [
                '{tribute} works the bridges above {zone}, watching the platforms below.',
                '{tribute} follows fresh cuts in the vines of {zone}.',
                '{tribute} waits at the only crossing into {zone} with a blade across their knees.',
            ],
            travel: [
                '{tribute} crosses a swaying bridge into {zone} without looking down.',
                '{tribute} free-climbs a bough and drops into {zone}.',
                '{tribute} rigs a line and swings across into {zone}.',
            ],
        },
        events: [
            {
                text: 'A rope bridge out of {zone} parts under {tribute}. They catch the far lip with one arm and hang there until they can pull up.',
                escapeText: '{tribute} tests the bridge out of {zone}, finds it cut, and takes the long way.',
                cause: 'Fell from the canopy',
                dodgeStat: 'agility',
                dodgeDifficulty: 7,
                damage: 36,
                bleeding: true,
                severesRoute: true,
            },
            {
                text: 'A thornvine takes {tribute} around the ankle in {zone} and hauls. They cut free leaving a good deal of skin behind.',
                escapeText: '{tribute} sees the thornvine coiled in {zone} and steps wide of it.',
                cause: 'Taken by a thornvine',
                dodgeStat: 'stealth',
                damage: 26,
                bleeding: true,
                infected: true,
            },
            {
                text: 'A storm hits the canopy over {zone}. {tribute} spends the hour clinging to a bough with both arms while the world swings.',
                escapeText: '{tribute} gets into a trunk hollow in {zone} before the canopy storm arrives.',
                cause: 'Blown out of the canopy',
                dodgeStat: 'strength',
                damage: 18,
                fatigue: 35,
                sanity: 12,
            },
            {
                text: 'A cistern bromeliad in {zone} holds a full day of clean rain. {tribute} drinks their fill and refills what they carry.',
                escapeText: '{tribute} finds the cisterns of {zone} already drained by somebody else.',
                cause: 'Drowned in a cistern',
                quench: 65,
                heal: 5,
            },
            {
                text: 'Silk spiders have webbed the gap out of {zone}. {tribute} walks into it face first and cuts their way clear with the venom already working.',
                escapeText: '{tribute} spots the silk across the gap out of {zone} and goes under it.',
                cause: 'Killed by silk spider venom',
                dodgeStat: 'stealth',
                damage: 22,
                poisoned: true,
            },
            {
                text: 'Screech primates mob {tribute} in {zone}, shrieking, and drive them to the very edge of the platform.',
                escapeText: '{tribute} backs out of the primates\' territory in {zone} without turning around.',
                cause: 'Driven off the canopy edge',
                dodgeStat: 'intelligence',
                damage: 24,
                bleeding: true,
                sanity: 15,
            },
        ],
    },

    vault: {
        ambient: [
            'The Vault has no sky. The faces of the fallen are projected onto the ceiling instead, and they stay there.',
            'Somewhere below, a pump cycles on, runs for four minutes, and stops.',
            'The lights step down one bank at a time. Nobody has explained the schedule.',
            'Every sound in the Vault arrives twice — once directly, once off the far wall.',
            'A ventilation fan somewhere changes pitch, and the air in three zones starts moving the other way.',
            'A hairline crack crosses the ceiling projection, and for a moment something true shows through the sky.',
            'Condensation gathers on the ceiling over the warm zones and falls as slow, oily rain.',
            'The Vault\'s lights dim to emergency red for thirty seconds. No explanation is offered, which is the message.',
        ],
        actions: {
            forage: [
                '{tribute} forces a supply locker in {zone} and takes {item}.',
                '{tribute} works the hydroponic racks of {zone} and comes away with {item}.',
                '{tribute} strips {item} out of a maintenance cache in {zone}.',
            ],
            rest: [
                '{tribute} bolts a door behind them in {zone} and sleeps against it.',
                '{tribute} rests under a dead light bank in {zone}, listening to the pumps.',
                '{tribute} sits in the dark of {zone} and lets their eyes adjust.',
            ],
            hide: [
                '{tribute} climbs into a ventilation run above {zone} and stops breathing hard.',
                '{tribute} kills their light in {zone} and becomes part of the wall.',
                '{tribute} folds into a locker in {zone} and pulls it shut.',
            ],
            hunt: [
                '{tribute} sweeps the corridors of {zone} room by room.',
                '{tribute} follows a smear of blood along the floor of {zone} until it stops.',
                '{tribute} waits at the junction into {zone}, listening for footsteps in the double echo.',
            ],
            travel: [
                '{tribute} works a sealed hatch open and moves through into {zone}.',
                '{tribute} takes the service ladder down into {zone}.',
                '{tribute} follows the emergency line on the floor into {zone}.',
            ],
        },
        events: [
            {
                text: 'The lights die across {zone}. {tribute} spends an hour navigating by touch and walks into something with edges.',
                escapeText: '{tribute} has a hand on the wall of {zone} before the blackout finishes falling.',
                cause: 'Died in the dark',
                dodgeStat: 'intelligence',
                damage: 18,
                bleeding: true,
                sanity: 22,
                zoneWide: true,
            },
            {
                text: 'A flood valve blows in {zone} and the corridor fills to the waist in seconds. {tribute} is slammed into a bulkhead getting out.',
                escapeText: '{tribute} hears the valve go in {zone} and is through the hatch before the water is.',
                cause: 'Drowned in a flooded corridor',
                dodgeStat: 'agility',
                damage: 28,
                fatigue: 25,
                startsZoneEffect: 'flooded',
            },
            {
                text: 'The ceiling of {zone} comes down in a slab. {tribute} is at the edge of it and takes the rubble across the back.',
                escapeText: '{tribute} hears the ceiling of {zone} start to go and clears the span.',
                cause: 'Crushed by a ceiling collapse',
                dodgeStat: 'agility',
                dodgeDifficulty: 7,
                damage: 34,
                bleeding: true,
                severesRoute: true,
            },
            {
                text: 'A sealed ration store in {zone} still holds. {tribute} eats properly for the first time since the gong.',
                escapeText: '{tribute} finds the ration store in {zone} already emptied to the shelves.',
                cause: 'Poisoned by spoiled rations',
                feed: 65,
                quench: 30,
                heal: 8,
            },
            {
                text: 'Circuit wasps boil out of a junction box in {zone}. Their stings arc, and {tribute} is still twitching an hour later.',
                escapeText: '{tribute} kills the breaker in {zone} and the wasps go quiet in the walls.',
                cause: 'Killed by circuit wasps',
                dodgeStat: 'intelligence',
                damage: 26,
                burned: true,
            },
            {
                text: 'The air handling in {zone} reverses and pulls something sour through the vents. {tribute} breathes it before they can get the hatch shut.',
                escapeText: '{tribute} hears the handlers reverse in {zone} and gets the hatch closed in time.',
                cause: 'Poisoned by the air handling',
                dodgeStat: 'agility',
                damage: 14,
                poisoned: true,
                sanity: 10,
            },
        ],
    },
};


/**
 * CONTENT-01: events every arena gets, on top of its own authored roster.
 *
 * The arena-specific pools ran ~9 events each, thin enough that a full run
 * visibly repeats them, and skewed hard toward punishment. This pool is
 * terrain-general rather than arena-specific — it does not know it is in the
 * Frozen Wasteland or the Toxic Swamps — but it doubles what every arena has
 * to draw from, and about a third of it is a real boon rather than a hazard.
 *
 * Magnitudes are kept modest on purpose: a heal or a hit large enough to swing
 * a tribute across a stance threshold on its own turns this pool into a
 * second, uncoordinated stance system fighting the real one.
 */
const UNIVERSAL_EVENTS: ArenaEventDef[] = [
    {
        text: '{tribute} finds a small cache the Gamemakers clearly meant for someone else in {zone} — a little food, a little water, half-buried and untouched.',
        escapeText: '',
        cause: '',
        heal: 5,
        feed: 18,
        quench: 15,
    },
    {
        text: '{tribute} stumbles onto a pocket of untouched forage in {zone} that nobody else has found yet.',
        escapeText: '',
        cause: '',
        feed: 20,
        quench: 10,
    },
    {
        text: 'A parachute nobody claimed drifts down into {zone} and {tribute} is the only one there to take it.',
        escapeText: '',
        cause: '',
        grantItem: 'water',
    },
    {
        text: '{tribute} finds a sheltered pocket in {zone} and gets a decent hour of rest in.',
        escapeText: '',
        cause: '',
        heal: 6,
        fatigue: -12,
    },
    {
        text: '{tribute} catches sight of the arena from higher ground in {zone} and, for a moment, knows exactly where everyone dangerous probably is.',
        escapeText: '',
        cause: '',
        sanity: -2,
    },
    {
        text: 'A sinkhole opens without warning under {tribute} in {zone}.',
        escapeText: '{tribute} feels the ground give in {zone} and throws themselves clear before it opens fully.',
        cause: 'Fell into a collapsing sinkhole',
        dodgeStat: 'agility',
        damage: 16,
        bleeding: true,
        terrains: ['open', 'wetland', 'ruins'],
    },
    {
        text: 'A swarm of stinging insects finds {tribute} in {zone} and will not be outrun easily.',
        escapeText: '{tribute} gets downwind of the swarm in {zone} before it finds them properly.',
        cause: 'Stung to death by a swarm',
        dodgeStat: 'agility',
        dodgeAlt: 'intelligence',
        damage: 10,
        infected: true,
        terrains: ['forest', 'wetland', 'open'],
    },
    {
        text: 'The ground gives way to old, buried wire in {zone} and {tribute} is caught in it before they see it.',
        escapeText: '{tribute} spots the wire snarled through {zone} and steps wide of it.',
        cause: 'Caught in buried wire',
        dodgeStat: 'intelligence',
        damage: 8,
        bleeding: true,
        terrains: ['ruins', 'open'],
    },
    {
        text: 'Something large moves through {zone} at speed and is gone before {tribute} can be sure what it was. Whatever it was, it was not interested — this time.',
        escapeText: '',
        cause: '',
        sanity: -4,
    },
    {
        text: '{tribute} finds solid tracks through {zone} and makes better time than the terrain should allow.',
        escapeText: '',
        cause: '',
        fatigue: -8,
    },
    {
        text: 'A gust catches {tribute} exposed on high ground in {zone} and very nearly takes them off it.',
        escapeText: '{tribute} gets low in {zone} before the gust hits properly.',
        cause: 'Fell from high ground',
        dodgeStat: 'agility',
        dodgeAlt: 'strength',
        damage: 14,
        bleeding: true,
        terrains: ['highland'],
    },
    {
        text: 'A rockslide catches {tribute} crossing {zone} at exactly the wrong moment.',
        escapeText: '{tribute} hears the slope shift in {zone} and clears it in time.',
        cause: 'Buried in a rockslide',
        dodgeStat: 'agility',
        damage: 18,
        bleeding: true,
        terrains: ['highland', 'ruins'],
    },
    {
        text: '{tribute} finds a patch of wild edibles in {zone} that even the survivalist archetype would call a good day.',
        escapeText: '',
        cause: '',
        feed: 14,
    },
    {
        text: 'A trapdoor of loose brush gives way under {tribute} in {zone}, dropping them hard.',
        escapeText: '{tribute} tests the ground in {zone} before trusting their full weight to it.',
        cause: 'Fell through concealed ground',
        dodgeStat: 'intelligence',
        dodgeAlt: 'agility',
        damage: 12,
        bleeding: true,
        terrains: ['forest', 'wetland', 'ruins'],
    },
    {
        text: 'The temperature drops hard and fast around {tribute} in {zone}, with no warning at all.',
        escapeText: '{tribute} finds cover in {zone} before the cold really sets in.',
        cause: 'Caught in a sudden freeze',
        dodgeStat: 'intelligence',
        frostbitten: true,
        fatigue: 10,
        terrains: ['highland', 'open'],
    },
];

export function arenaFlavor(arenaId: string, arena?: Arena): ArenaFlavor {
    // A procedural arena has no hand-authored entry here — it used to fall
    // back to one of four fixed pre-written packs, so every rainforest arena
    // read as the same rainforest regardless of the zones it actually rolled.
    // `proceduralArenaFlavor` composes flavour from the tags the generated
    // arena's zones actually carry.
    if (arena && arenaId.startsWith('procedural-')) return withUniversalEvents(proceduralArenaFlavor(arena));
    return withUniversalEvents(ARENA_FLAVOR[arenaId] ?? GENERIC_ARENA_FLAVOR);
}

/** Merges the shared event pool into an arena's authored one. Never mutates the source. */
function withUniversalEvents(flavor: ArenaFlavor): ArenaFlavor {
    return { ...flavor, events: [...flavor.events, ...UNIVERSAL_EVENTS] };
}
