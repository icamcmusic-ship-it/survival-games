import { Attributes } from '../models/types';

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
        ],
    },

    frozen: {
        ambient: [
            'The wind rises to a scream. Visibility across the Wasteland drops to nothing.',
            'A sheet of ice the size of a district calves off the glacier and grinds into the lake.',
            'The temperature drops another ten degrees. The Gamemakers are done being patient.',
            'The aurora over the Wasteland flares Capitol gold. Somewhere, a camera pushes in.',
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
        ],
    },

    concrete: {
        ambient: [
            'A tower somewhere in the grid folds in on itself. The dust cloud takes ten minutes to settle.',
            'Every streetlight in the dead city flickers on at once, then dies.',
            'Rats pour out of a storm drain in a single black wave and vanish.',
            'The Gamemakers cut the water table. Every fountain in the city goes dry at the same moment.',
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
            },
            {
                text: 'A live wire drops across the wet floor of {zone}. {tribute} is thrown ten feet and comes to with burned hands.',
                escapeText: '{tribute} spots the sparking wire in {zone} and steps wide around the puddle.',
                cause: 'Electrocuted by a live wire',
                dodgeStat: 'intelligence',
                damage: 26,
                burned: true,
            },
            {
                text: 'The sewers under {zone} flood without warning. {tribute} is swept along in filth and surfaces retching.',
                escapeText: '{tribute} hears the sewers surge under {zone} and climbs above the waterline.',
                cause: 'Drowned in the sewer flood',
                dodgeStat: 'agility',
                damage: 18,
                infected: true,
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
        ],
    },

    toxic: {
        ambient: [
            'The bog exhales. A green haze settles over the whole arena and refuses to lift.',
            'Something enormous moves under the water and never surfaces.',
            'The Gamemakers seed the swamp with spores. The air begins to glitter.',
            'Every insect in the swamp goes silent at once. Nothing good follows that.',
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
        ],
    },

    solar: {
        ambient: [
            'The sun stalls at its highest point and simply stays there. The Gamemakers are not subtle today.',
            'A dust devil the height of a Capitol tower crosses the dunes and dissolves.',
            'The horizon shimmers with a city that does not exist.',
            'Night falls in minutes and the sand goes from blistering to freezing.',
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
            },
            {
                text: 'A sandstorm buries {zone}. {tribute} rides it out face-down with grit in every wound.',
                escapeText: '{tribute} reads the wind in {zone} and finds cover before the sandstorm lands.',
                cause: 'Buried by the sandstorm',
                dodgeStat: 'intelligence',
                damage: 18,
                infected: true,
                fatigue: 25,
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
        ],
    },
};

export function arenaFlavor(arenaId: string): ArenaFlavor {
    return ARENA_FLAVOR[arenaId] ?? GENERIC_ARENA_FLAVOR;
}
