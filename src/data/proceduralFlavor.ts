import { Arena, Terrain } from '../models/types';
import { ArenaActions, ArenaEventDef, ArenaFlavor, GENERIC_ARENA_FLAVOR } from './arenaFlavor';

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
    { tags: ['ruins', 'highland'], lines: [
        '{tribute} wedges into a gap in {zone} and waits for the danger to pass.',
        '{tribute} folds themselves into a crevice in {zone} and stops moving.',
        '{tribute} holds absolutely still against cold stone in {zone}.',
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
    ]},
];


/**
 * A1: the four conditional-stance pools, composed the same way as the others.
 *
 * A procedural arena has no hand-authored pack, so leaving these to the
 * terrain-general generic set would have made every generated arena read
 * identically the moment a tribute dug in or went scavenging — which is the
 * exact failure `proceduralArenaFlavor` exists to fix for forage and hide.
 */
const FORTIFY_VARIANTS: ActionVariant[] = [
    { tags: ['ruins'], lines: [
        '{tribute} pulls a wall of fallen masonry across the open side of {zone} and settles behind it.',
        '{tribute} finds the one doorway into {zone} that still closes, and closes it.',
        '{tribute} works the rubble of {zone} into something with only one way in.',
        '{tribute} has stopped passing through {zone}. They are living in it now, and they have opinions about the approaches.',
    ]},
    { tags: ['forest', 'wetland'], lines: [
        '{tribute} weaves the undergrowth of {zone} into a wall nobody comes through quietly.',
        '{tribute} lashes deadfall across the two easy paths into {zone} and leaves the hard one open on purpose.',
        '{tribute} has spent long enough in {zone} to know which branch creaks. Now everyone else will find out too.',
        '{tribute} sets another line in {zone}, tests it, and sets it again.',
    ]},
    { tags: ['highland', 'height'], lines: [
        '{tribute} takes the high ground of {zone} properly: sightlines cleared, one approach, and rocks stacked where rocks are useful.',
        '{tribute} holds the ridge in {zone} and turns the climb into a problem.',
        '{tribute} has not come down off {zone} in days and no longer intends to.',
        '{tribute} watches all three approaches to {zone} at once, which is why they chose it.',
    ]},
    { tags: ['water', 'open', 'cold', 'heat'], lines: [
        '{tribute} banks what {zone} has into a berm and puts their back to it.',
        '{tribute} makes {zone} costly to walk into and comfortable to wait in.',
        '{tribute} has turned a stretch of {zone} into somewhere they own rather than somewhere they are hiding.',
        '{tribute} checks their own work across {zone}, finds it holding, and settles back down.',
    ]},
];

const SCAVENGE_VARIANTS: ActionVariant[] = [
    { tags: ['ruins'], lines: [
        '{tribute} goes through the ruins of {zone} the way looters do — fast, low, and in the places nobody thinks to look twice.',
        '{tribute} pulls apart a collapsed room in {zone} and finds what fell behind it.',
        '{tribute} works the debris in {zone} that somebody else already worked, and does it better.',
        '{tribute} finds a cold camp in {zone} and takes everything the last occupant did not bother with.',
    ]},
    { tags: ['forest', 'wetland'], lines: [
        '{tribute} follows the churn in the undergrowth of {zone} to where somebody dropped something.',
        '{tribute} reads the broken stems across {zone} and finds where the fight ended.',
        '{tribute} searches the ground of {zone} that has been picked over twice, and gets lucky the third time.',
        '{tribute} strips a snagged pack out of the branches over {zone}.',
    ]},
    { tags: ['water'], lines: [
        '{tribute} wades the shallows of {zone} feeling for whatever the current dropped there.',
        '{tribute} drags something waterlogged out of {zone} and works out what it used to be.',
        '{tribute} follows the shoreline of {zone} taking whatever the water left.',
        '{tribute} finds a pack half-sunk in {zone} and empties it before it goes under for good.',
    ]},
    { tags: ['highland', 'open', 'cold', 'heat', 'height'], lines: [
        '{tribute} crosses the open ground of {zone} picking up whatever the last people through it dropped.',
        '{tribute} searches {zone} without much hope, and {zone} rewards it anyway.',
        '{tribute} finds where somebody camped in {zone} and takes what was not worth carrying to them.',
        '{tribute} works over a cannon site in {zone} while it is still warm.',
    ]},
];

const SHADOW_VARIANTS: ActionVariant[] = [
    { tags: ['forest', 'wetland'], lines: [
        '{tribute} moves through the green of {zone} at exactly the pace of the footsteps ahead of them.',
        '{tribute} stays a full turning behind, in the cover of {zone}, and does not close.',
        '{tribute} lets the undergrowth of {zone} hold them where they are, watching.',
        '{tribute} follows a broken trail through {zone} and does nothing about it. Not yet.',
    ]},
    { tags: ['ruins', 'eerie'], lines: [
        '{tribute} keeps a wall of {zone} between themselves and the person they are following.',
        '{tribute} counts the footsteps ahead through the empty rooms of {zone} and matches them.',
        '{tribute} moves through {zone} in the gaps between somebody else\'s sounds.',
        '{tribute} could close the distance in {zone} in a breath. They spend the hour not doing it.',
    ]},
    { tags: ['highland', 'open', 'water', 'cold', 'heat', 'height'], lines: [
        '{tribute} hangs back across the open of {zone}, far enough to be nothing, close enough to be there.',
        '{tribute} shadows a line across {zone} at a distance that has not changed in an hour.',
        '{tribute} watches somebody cross {zone} without ever once looking behind them.',
        '{tribute} keeps to the low ground of {zone} and lets the person ahead set the pace.',
    ]},
];

const FLAIL_VARIANTS: ActionVariant[] = [
    { tags: ['ruins', 'eerie'], lines: [
        '{tribute} shouts once into the empty of {zone}, and the echo comes back and nothing else does.',
        '{tribute} puts a fist through something in {zone} that did not deserve it.',
        '{tribute} walks the middle of {zone} in the open, past caring who is watching.',
        '{tribute} stops checking corners in {zone}. Checking corners stopped working days ago.',
    ]},
    { tags: ['forest', 'wetland', 'water'], lines: [
        '{tribute} tears through {zone} without care for the noise, looking for anything at all.',
        '{tribute} drinks from {zone} without checking it. They are past checking.',
        '{tribute} crashes through {zone} at a pace nothing in their condition should manage.',
        '{tribute} eats something out of {zone} they would not have touched on day one.',
    ]},
    { tags: ['highland', 'open', 'cold', 'heat', 'height', 'storm', 'toxic'], lines: [
        '{tribute} crosses the open of {zone} without once looking for cover.',
        '{tribute} sits down in the middle of {zone} and then gets up again, and neither was a decision.',
        '{tribute} moves through {zone} like somebody who has already worked out how this ends.',
        '{tribute} has nothing left in {zone} and does not slow down for it.',
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
    ],
    cold: [
        'The Gamemakers push the temperature down another few degrees, just to see who notices first.',
        'Frost creeps across every exposed surface an hour before the anthem plays.',
    ],
    heat: [
        'Heat shimmers off the ground in sheets, bending the horizon into something unreliable.',
        'The Gamemakers hold the sun in place an hour past when it should have set.',
    ],
    height: [
        'Wind keens across the high ground, loud enough to cover a scream from below.',
        'Cloud sits low over the ridgeline, swallowing anyone who climbs into it.',
    ],
    ruins: [
        'Something structural groans deep in the old stone, right on schedule.',
        'A section of wall the Gamemakers marked stable gives way with no one near it.',
    ],
    storm: [
        'The sky over the arena goes the wrong colour, and everyone who has seen it before starts moving.',
        'Distant thunder rolls for the third hour straight without ever quite arriving.',
    ],
    eerie: [
        'A sound plays from the treeline that is almost, but not quite, a human voice.',
        'The arena falls unnaturally quiet, the way it does right before something happens.',
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
    const matches = variants.filter(v => v.tags.some(t => active.has(t)));
    if (matches.length === 0) return generic;
    // Deterministic pick among tied-best variants (by overlap), not the
    // first alphabetical/array match, so different arenas with the same
    // active tag set can still land different flavour if more than one
    // variant matches equally.
    const best = matches.reduce((a, b) => overlapScore(b.tags, active) > overlapScore(a.tags, active) ? b : a);
    return best.lines;
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
        tundra: ['cold', 'storm'],
        dunes: ['heat'],
        bayou: ['toxic', 'eerie', 'water'],
        ruinlands: ['eerie', 'ruins'],
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
        .slice(0, 8)
        .map(({ tags, ...rest }) => rest);

    const ambient = [
        ...GENERIC_AMBIENT.slice(0, 2),
        ...Array.from(active).flatMap(t => AMBIENT_BY_TAG[t] || []).slice(0, 3),
    ];

    const actions: ArenaActions = {
        forage: pickActions(active, FORAGE_VARIANTS, GENERIC_PROCEDURAL_ACTIONS.forage),
        rest: pickActions(active, REST_VARIANTS, GENERIC_PROCEDURAL_ACTIONS.rest),
        hide: pickActions(active, HIDE_VARIANTS, GENERIC_PROCEDURAL_ACTIONS.hide),
        hunt: pickActions(active, HUNT_VARIANTS, GENERIC_PROCEDURAL_ACTIONS.hunt),
        travel: GENERIC_PROCEDURAL_ACTIONS.travel,
        // A1: the conditional stances get the same treatment. `actionPool`
        // would fall back to the generic set without these, which would make
        // every generated arena read identically the moment somebody dug in.
        fortify: pickActions(active, FORTIFY_VARIANTS, GENERIC_ARENA_FLAVOR.actions.fortify ?? []),
        scavenge: pickActions(active, SCAVENGE_VARIANTS, GENERIC_ARENA_FLAVOR.actions.scavenge ?? []),
        shadow: pickActions(active, SHADOW_VARIANTS, GENERIC_ARENA_FLAVOR.actions.shadow ?? []),
        flail: pickActions(active, FLAIL_VARIANTS, GENERIC_ARENA_FLAVOR.actions.flail ?? []),
    };

    return { ambient, actions, events };
}
