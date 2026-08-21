import { Mutt } from '../models/types';

/**
 * Mutt data model: per-arena rosters.
 *
 * Design flaw being fixed (ARENA-04): every mutt in every arena used to be a
 * flavour string, mechanically identical to every other one. Each roster
 * below gives its named mutts a distinct kit — a pack hunter, a solo
 * ambusher, and something that isn't really a "creature" at all — so Ice
 * Wolves and Acid Fog stop playing the same encounter with different text.
 *
 * Roster size is content too. Every hand-authored arena used to carry exactly
 * three mutts, which made the bestiary read as one template with the nouns
 * swapped. Rosters now vary with what the arena is: the Clockwork Island and
 * the Hanging Gardens are dense with engineered life and carry five; the Salt
 * Mirror is a dead white plain and carries three; the Warren keeps its apex
 * alone, with nothing but the mine's own vermin for company.
 *
 * Keyed by the arena id in `ARENAS` (src/data/constants.ts) plus one roster
 * per procedural biome id (src/engine/arenaGenerator.ts).
 */
export const ARENA_MUTTS: Record<string, Mutt[]> = {
    clockwork: [
        {
            id: 'tick-tock-monkeys', name: 'Tick-Tock Monkeys',
            packSize: [2, 5], damage: 14, speed: 7,
            // A pack that swarms rather than mauls: no bleed, just battered.
        },
        {
            id: 'lightning-birds', name: 'Lightning Birds',
            packSize: [1, 2], damage: 22, speed: 9,
            inflicts: { burned: true },
            nocturnal: true,
        },
        {
            id: 'acid-fog', name: 'Acid Fog',
            // Not a creature — a released hazard with a face. Low damage, no
            // pack, but it lingers and it gets in your head just by rolling in.
            packSize: [1, 1], damage: 8, speed: 3,
            inflicts: { infected: true },
            fearAura: 6,
        },
        {
            id: 'jabberjays', name: 'Jabberjays',
            // The island's oldest trick: a flock that hurts nothing and takes
            // apart the voices of your dead in front of you.
            packSize: [4, 9], damage: 3, speed: 7,
            fearAura: 12,
            terrainPreference: ['forest', 'wetland', 'highland'],
        },
        {
            id: 'reef-barracuda', name: 'Reef Barracuda',
            packSize: [2, 4], damage: 16, speed: 8,
            inflicts: { bleeding: true },
            terrainPreference: ['water'],
        },
    ],
    frozen: [
        {
            id: 'ice-wolves', name: 'Ice Wolves',
            packSize: [2, 4], damage: 18, speed: 8,
            inflicts: { bleeding: true },
            // Ice wolves don't swim.
            terrainPreference: ['open', 'forest', 'highland', 'ruins'],
        },
        {
            id: 'snow-camouflage-snakes', name: 'Snow Camouflage Snakes',
            packSize: [1, 1], damage: 12, speed: 10,
            inflicts: { poisoned: true },
            // A single ambush striker — speed is what makes it dangerous, not numbers.
        },
        {
            id: 'frostbite-beetles', name: 'Frostbite Beetles',
            packSize: [3, 8], damage: 6, speed: 4,
            inflicts: { frostbitten: true },
            // A swarm: low per-hit damage, but numbers alone push the pack-size roll hard.
        },
        {
            id: 'snowblind-owls', name: 'Snowblind Owls',
            // Silent, and only after dark: nobody hears the first one.
            packSize: [1, 3], damage: 13, speed: 10,
            inflicts: { bleeding: true },
            nocturnal: true,
            terrainPreference: ['forest', 'highland', 'open'],
        },
    ],
    concrete: [
        {
            id: 'steel-jawed-rats', name: 'Steel-jawed Rats',
            packSize: [3, 6], damage: 10, speed: 6,
            inflicts: { bleeding: true },
            terrainPreference: ['ruins', 'open'],
        },
        {
            id: 'glass-winged-bats', name: 'Glass-winged Bats',
            packSize: [1, 3], damage: 15, speed: 9,
            nocturnal: true,
            terrainPreference: ['ruins', 'highland'],
        },
        {
            id: 'feral-tracker-jackers', name: 'Feral Tracker Jackers',
            // Canon's iconic hallucination mutt: light damage, huge dread.
            packSize: [1, 1], damage: 9, speed: 5,
            inflicts: { poisoned: true },
            fearAura: 10,
        },
        {
            id: 'sewer-eels', name: 'Sewer Eels',
            packSize: [1, 3], damage: 17, speed: 6,
            inflicts: { infected: true },
            terrainPreference: ['water'],
        },
    ],
    toxic: [
        {
            id: 'venomous-toads', name: 'Venomous Toads',
            packSize: [1, 2], damage: 10, speed: 3,
            inflicts: { poisoned: true },
            terrainPreference: ['wetland', 'water', 'forest'],
        },
        {
            id: 'leech-swarms', name: 'Leech Swarms',
            packSize: [4, 9], damage: 5, speed: 2,
            inflicts: { bleeding: true, infected: true },
            terrainPreference: ['wetland', 'water'],
        },
        {
            id: 'camouflaged-crocodiles', name: 'Camouflaged Crocodiles',
            packSize: [1, 1], damage: 30, speed: 6,
            inflicts: { bleeding: true },
            terrainPreference: ['water', 'wetland'],
            persistent: true,
        },
        {
            id: 'bloatflies', name: 'Bloatflies',
            // A cloud, not a bite: they cost blood and sleep and nothing else.
            packSize: [5, 10], damage: 3, speed: 6,
            terrainPreference: ['wetland', 'water', 'forest', 'ruins'],
        },
    ],
    solar: [
        {
            id: 'sand-vipers', name: 'Sand Vipers',
            packSize: [1, 1], damage: 14, speed: 11,
            inflicts: { poisoned: true },
            terrainPreference: ['open', 'highland'],
        },
        {
            id: 'mirage-scorpions', name: 'Mirage Scorpions',
            packSize: [2, 4], damage: 9, speed: 5,
            inflicts: { infected: true },
        },
        {
            id: 'burrowing-centipedes', name: 'Burrowing Centipedes',
            packSize: [3, 6], damage: 7, speed: 4,
            inflicts: { bleeding: true },
            terrainPreference: ['open', 'wetland'],
        },
        {
            id: 'glass-hawks', name: 'Glass Hawks',
            // Works the open ground at noon, when there is nowhere to stand
            // that is not in full view of the sky.
            packSize: [1, 2], damage: 19, speed: 9,
            inflicts: { bleeding: true },
            terrainPreference: ['open', 'highland'],
        },
    ],
    ashfall: [
        {
            id: 'cinder-hounds', name: 'Cinder Hounds',
            packSize: [2, 4], damage: 20, speed: 8,
            inflicts: { burned: true },
        },
        {
            id: 'ash-wraiths', name: 'Ash Wraiths',
            // Genuinely faceless, but sold as "your dead" by the Gamemakers —
            // high fear, low damage, nocturnal.
            packSize: [1, 2], damage: 6, speed: 6,
            fearAura: 8,
            nocturnal: true,
        },
        {
            id: 'glass-shard-crows', name: 'Glass-Shard Crows',
            packSize: [3, 7], damage: 8, speed: 9,
            inflicts: { bleeding: true },
            terrainPreference: ['open', 'highland', 'ruins'],
        },
        {
            id: 'ember-moths', name: 'Ember Moths',
            packSize: [4, 8], damage: 4, speed: 6,
            inflicts: { burned: true },
            nocturnal: true,
        },
    ],
    tempest: [
        {
            id: 'squall-serpents', name: 'Squall Serpents',
            packSize: [1, 2], damage: 24, speed: 9,
            inflicts: { bleeding: true },
            terrainPreference: ['water', 'wetland'],
            persistent: true,
        },
        {
            id: 'barnacle-crabs', name: 'Barnacle Crabs',
            packSize: [3, 6], damage: 8, speed: 3,
            terrainPreference: ['water', 'wetland', 'open'],
        },
        {
            id: 'drowned-gulls', name: 'Drowned Gulls',
            packSize: [2, 5], damage: 6, speed: 10,
            inflicts: { infected: true },
            fearAura: 4,
        },
        {
            id: 'surge-eels', name: 'Surge Eels',
            // Comes in on the flood and leaves with it: only ever a problem
            // where the water has already been.
            packSize: [2, 5], damage: 12, speed: 7,
            inflicts: { bleeding: true },
            terrainPreference: ['water', 'wetland'],
        },
    ],
    saltflats: [
        {
            id: 'brine-wolves', name: 'Brine Wolves',
            packSize: [2, 4], damage: 17, speed: 8,
            inflicts: { bleeding: true },
            terrainPreference: ['open', 'ruins', 'highland'],
        },
        {
            id: 'salt-locusts', name: 'Salt Locusts',
            packSize: [4, 9], damage: 5, speed: 6,
            inflicts: { infected: true },
        },
        {
            id: 'mirage-stalkers', name: 'Mirage Stalkers',
            // Never seen twice in the same place — the persistent hunter of the arena.
            packSize: [1, 1], damage: 16, speed: 10,
            fearAura: 7,
            persistent: true,
        },
    ],
    sporefields: [
        {
            id: 'spore-moths', name: 'Spore Moths',
            packSize: [3, 7], damage: 5, speed: 5,
            inflicts: { poisoned: true },
            fearAura: 3,
            nocturnal: true,
        },
        {
            id: 'mycelial-hounds', name: 'Mycelial Hounds',
            packSize: [2, 4], damage: 19, speed: 7,
            inflicts: { bleeding: true },
            terrainPreference: ['forest', 'wetland', 'open'],
        },
        {
            id: 'puffball-swarms', name: 'Puffball Swarms',
            // A hazard-shaped mutt: no bite at all, just a lungful of spores.
            packSize: [1, 1], damage: 4, speed: 1,
            inflicts: { infected: true },
            fearAura: 5,
        },
        {
            id: 'cordyceps-ticks', name: 'Cordyceps Ticks',
            // Whatever they carry has never taken in a human host. In numbers
            // they are still a bad hour.
            packSize: [5, 10], damage: 3, speed: 3,
            terrainPreference: ['forest', 'wetland', 'open'],
        },
    ],
    canopy: [
        {
            id: 'silk-spiders', name: 'Silk Spiders',
            packSize: [2, 5], damage: 11, speed: 7,
            inflicts: { poisoned: true },
            terrainPreference: ['forest', 'highland'],
        },
        {
            id: 'screech-primates', name: 'Screech Primates',
            packSize: [3, 6], damage: 13, speed: 9,
            fearAura: 5,
        },
        {
            id: 'thornvine-constrictors', name: 'Thornvine Constrictors',
            packSize: [1, 1], damage: 26, speed: 4,
            inflicts: { bleeding: true },
            terrainPreference: ['forest', 'wetland'],
            persistent: true,
        },
        {
            id: 'needle-hornets', name: 'Needle Hornets',
            packSize: [4, 9], damage: 5, speed: 8,
            inflicts: { poisoned: true },
            terrainPreference: ['forest', 'highland', 'open'],
        },
        {
            id: 'bough-vipers', name: 'Bough Vipers',
            // Lies along the branch a climber is about to put a hand on.
            packSize: [1, 1], damage: 15, speed: 10,
            inflicts: { poisoned: true },
            terrainPreference: ['forest', 'highland', 'ruins'],
        },
    ],
    vault: [
        {
            id: 'pallid-stalkers', name: 'Pallid Stalkers',
            // The arena that literally projects the dead onto the ceiling —
            // its signature mutt is the one built to wear a face.
            packSize: [1, 1], damage: 15, speed: 7,
            fearAura: 9,
            nocturnal: true,
            persistent: true,
        },
        {
            id: 'rebar-hounds', name: 'Rebar Hounds',
            packSize: [2, 4], damage: 18, speed: 6,
            inflicts: { bleeding: true },
            terrainPreference: ['ruins', 'open', 'highland'],
        },
        {
            id: 'circuit-wasps', name: 'Circuit Wasps',
            packSize: [4, 8], damage: 6, speed: 10,
            inflicts: { infected: true },
        },
        {
            id: 'sump-eels', name: 'Sump Eels',
            packSize: [2, 4], damage: 13, speed: 7,
            inflicts: { infected: true },
            terrainPreference: ['water'],
        },
    ],

    warren: [
        {
            id: 'the-warden', name: 'The Warden',
            // §8.3: one arena, one *horror*. The Warden is still the only
            // thing down here that hunts tributes on purpose — the rats are
            // only rats — and it never stops looking. It owns the dark.
            packSize: [1, 1], damage: 24, speed: 6,
            fearAura: 10,
            nocturnal: false,
            persistent: true,
            inflicts: { bleeding: true },
        },
        {
            id: 'pit-rats', name: 'Pit Rats',
            // Not engineered at all — the mine's own vermin, a hundred
            // generations into the dark. A tax on sleep and stores, not a
            // threat: nothing about them was designed.
            packSize: [6, 12], damage: 2, speed: 4,
        },
    ],

    islands: [
        {
            id: 'lodestone-gulls', name: 'Lodestone Gulls',
            // Magnetised flock: they home on anything metal a tribute carries,
            // which is most of what a tribute carries.
            packSize: [3, 7], damage: 8, speed: 10,
            inflicts: { bleeding: true },
            terrainPreference: ['open', 'highland', 'water'],
        },
        {
            id: 'fogline-eels', name: 'Fogline Eels',
            // They swim in the fog itself, below the bridge lines, and take
            // whatever dangles.
            packSize: [2, 4], damage: 15, speed: 7,
            inflicts: { bleeding: true },
            terrainPreference: ['water', 'wetland'],
        },
        {
            id: 'the-ferryman', name: 'The Ferryman',
            // Something man-shaped that poles through the fog between islands
            // and is never on the island you are on until it is.
            packSize: [1, 1], damage: 20, speed: 6,
            fearAura: 10,
            nocturnal: true,
            persistent: true,
        },
        {
            id: 'rust-mites', name: 'Rust Mites',
            // Not interested in flesh so much as the iron in the blood. A tax
            // on gear and skin alike.
            packSize: [5, 10], damage: 3, speed: 5,
            inflicts: { infected: true },
            terrainPreference: ['ruins', 'open'],
        },
    ],
    eclipse: [
        {
            id: 'duskwing-owls', name: 'Duskwing Owls',
            // Permanent dusk means they never stand down — deliberately not
            // nocturnal, because in this arena there is no daylight to hide in.
            packSize: [1, 3], damage: 14, speed: 10,
            inflicts: { bleeding: true },
            terrainPreference: ['forest', 'open', 'highland'],
        },
        {
            id: 'pitch-hounds', name: 'Pitch Hounds',
            // They den in the vents and carry the fire out with them.
            packSize: [2, 4], damage: 19, speed: 7,
            inflicts: { burned: true },
            terrainPreference: ['highland', 'forest', 'ruins'],
        },
        {
            id: 'lantern-beetles', name: 'Lantern Beetles',
            // The only reliable light in the arena, and it bites.
            packSize: [4, 8], damage: 5, speed: 5,
            inflicts: { poisoned: true },
            terrainPreference: ['forest', 'wetland'],
        },
        {
            id: 'the-understory', name: 'The Understory',
            // Something wide and slow that moves through the fern layer like
            // weather. Nobody has seen all of it at once.
            packSize: [1, 1], damage: 24, speed: 4,
            fearAura: 9,
            persistent: true,
            terrainPreference: ['forest', 'wetland'],
        },
        {
            id: 'star-moths', name: 'Star Moths',
            // They roost on the artificial stars and come down in falls of
            // cold light. Harmless-looking right up until they land.
            packSize: [3, 7], damage: 6, speed: 8,
            fearAura: 4,
            nocturnal: true,
        },
    ],
    reef: [
        {
            id: 'trench-morays', name: 'Trench Morays',
            // They never left when the water did. The trenches stayed damp
            // enough, and they learned to wait at the lip.
            packSize: [1, 2], damage: 22, speed: 8,
            inflicts: { bleeding: true },
            terrainPreference: ['water', 'ruins'],
            persistent: true,
        },
        {
            id: 'anemone-colonies', name: 'Anemone Colonies',
            // Not an animal that comes to you — ground that is alive. A field
            // of stinging cells with a century of patience.
            packSize: [1, 1], damage: 9, speed: 1,
            inflicts: { poisoned: true },
            fearAura: 5,
            terrainPreference: ['wetland', 'open'],
        },
        {
            id: 'bonefish-swarms', name: 'Bonefish Swarms',
            // Dried to leather and still moving. They flow over the coral
            // like spilled gravel with teeth.
            packSize: [5, 10], damage: 4, speed: 6,
            inflicts: { bleeding: true },
        },
        {
            id: 'the-dry-shark', name: 'The Dry Shark',
            // The arena's showpiece: it swims through the loose coral rubble
            // the way its ancestors swam through water, and you hear it coming
            // as a hiss of moving shale.
            packSize: [1, 1], damage: 28, speed: 7,
            inflicts: { bleeding: true },
            fearAura: 8,
            persistent: true,
            terrainPreference: ['open', 'ruins', 'wetland'],
        },
    ],
    abattoir: [
        {
            id: 'hook-apes', name: 'Hook Apes',
            // They travel the overhead hook line hand over hand and drop on
            // whatever the conveyors deliver.
            packSize: [2, 4], damage: 17, speed: 8,
            inflicts: { bleeding: true },
            terrainPreference: ['ruins', 'open', 'highland'],
        },
        {
            id: 'scald-rats', name: 'Scald Rats',
            // Boiled hairless by generations in the steam lines, and no less
            // numerous for it.
            packSize: [4, 9], damage: 6, speed: 6,
            inflicts: { burned: true },
            terrainPreference: ['ruins', 'water', 'wetland'],
        },
        {
            id: 'the-line-boss', name: 'The Line Boss',
            // Piston-driven, roughly bull-shaped, and wired into the factory
            // itself: when the machinery starts, so does it.
            packSize: [1, 1], damage: 30, speed: 5,
            fearAura: 8,
            persistent: true,
            terrainPreference: ['ruins', 'open'],
        },
        {
            id: 'grinder-beetles', name: 'Grinder Beetles',
            // Carapaces like gear teeth. They chew through leather, rope and
            // anyone still wearing either.
            packSize: [3, 7], damage: 7, speed: 4,
            inflicts: { bleeding: true },
            terrainPreference: ['ruins', 'open'],
        },
    ],
    carnival: [
        {
            id: 'calliope-jays', name: 'Calliope Jays',
            // Jabberjay stock retuned to the carnival's music: they play the
            // midway organ in the voices of the fallen, note-perfect.
            packSize: [3, 8], damage: 3, speed: 8,
            fearAura: 12,
            terrainPreference: ['forest', 'ruins', 'open'],
        },
        {
            id: 'the-barker', name: 'The Barker',
            // Wears whichever face the audience most wants you to see, and
            // announces you to the park while it follows.
            packSize: [1, 1], damage: 18, speed: 6,
            fearAura: 11,
            nocturnal: true,
            persistent: true,
        },
        {
            id: 'prize-hounds', name: 'Prize Hounds',
            // Stitched plush over real muscle, glass button eyes. They hunt
            // in matched sets, like something won off a shelf.
            packSize: [2, 5], damage: 16, speed: 8,
            inflicts: { bleeding: true },
        },
        {
            id: 'ticket-wasps', name: 'Ticket Wasps',
            // They paper their nests with the park's old ticket rolls, and
            // they defend every booth like it still takes customers.
            packSize: [4, 9], damage: 5, speed: 9,
            inflicts: { poisoned: true },
            terrainPreference: ['ruins', 'forest'],
        },
    ],
    ashwaste: [
        {
            id: 'drift-serpents', name: 'Drift Serpents',
            // They swim under the ash the way eels swim under water, and the
            // only warning is a wake.
            packSize: [1, 2], damage: 18, speed: 9,
            inflicts: { poisoned: true },
            terrainPreference: ['open', 'wetland'],
        },
        {
            id: 'caldera-vultures', name: 'Caldera Vultures',
            // They ride the thermals off the caldera and mark anything that
            // stops moving — for themselves, and for everyone watching the sky.
            packSize: [2, 5], damage: 10, speed: 8,
            inflicts: { bleeding: true },
            fearAura: 4,
            terrainPreference: ['open', 'highland'],
        },
        {
            id: 'cinder-fleas', name: 'Cinder Fleas',
            // They live in the warm ash and board anything warmer.
            packSize: [5, 10], damage: 3, speed: 6,
            inflicts: { burned: true },
        },
        {
            id: 'the-grey-bull', name: 'The Grey Bull',
            // The wasteland's one big animal: ash-coated, half-blind, and
            // convinced the entire basin is its territory. It is not wrong.
            packSize: [1, 1], damage: 27, speed: 6,
            fearAura: 7,
            persistent: true,
            terrainPreference: ['open', 'highland', 'ruins'],
        },
    ],
    quarry: [
        {
            id: 'bench-cats', name: 'Bench Cats',
            // They work the terraces laterally, always one bench above the
            // thing they are following.
            packSize: [1, 2], damage: 21, speed: 9,
            inflicts: { bleeding: true },
            terrainPreference: ['highland', 'open', 'ruins'],
        },
        {
            id: 'blast-bats', name: 'Blast Bats',
            // Deafened stock bred in the powder era: they navigate by touch
            // and come out of the shot-holes at dusk in their hundreds.
            packSize: [4, 8], damage: 6, speed: 10,
            nocturnal: true,
            terrainPreference: ['ruins', 'highland'],
        },
        {
            id: 'the-dredger', name: 'The Dredger',
            // Whatever the Gamemakers sank in the flooded pit. The water is
            // black past a metre down, and it prefers it that way.
            packSize: [1, 1], damage: 29, speed: 6,
            inflicts: { bleeding: true },
            fearAura: 9,
            persistent: true,
            terrainPreference: ['water'],
        },
        {
            id: 'scree-adders', name: 'Scree Adders',
            // Rockfall-coloured, and fond of exactly the loose ground a
            // climber has to put a hand on.
            packSize: [1, 2], damage: 13, speed: 10,
            inflicts: { poisoned: true },
            terrainPreference: ['highland', 'open'],
        },
    ],
    glacier: [
        {
            id: 'blue-ice-bears', name: 'Blue-Ice Bears',
            // Visible through the cave walls as a moving shadow in the ice,
            // right up until the wall is not between you any more.
            packSize: [1, 1], damage: 30, speed: 6,
            inflicts: { bleeding: true },
            fearAura: 7,
            persistent: true,
        },
        {
            id: 'crevasse-worms', name: 'Crevasse Worms',
            // Pale, eyeless, exactly the diameter of a crevasse. They feel
            // footfalls through the ice from a long way off.
            packSize: [1, 3], damage: 16, speed: 5,
            inflicts: { frostbitten: true },
            terrainPreference: ['highland', 'ruins'],
        },
        {
            id: 'echo-bats', name: 'Echo Bats',
            // The tunnels belong to them after dark, and their sonar reads a
            // heartbeat through a metre of ice.
            packSize: [3, 7], damage: 6, speed: 10,
            nocturnal: true,
            terrainPreference: ['ruins', 'water'],
        },
        {
            id: 'rime-foxes', name: 'Rime Foxes',
            // Small, white, and patient: they trail wounded tributes the way
            // their ancestors trailed wounded caribou.
            packSize: [2, 4], damage: 11, speed: 9,
            inflicts: { bleeding: true },
            terrainPreference: ['open', 'highland', 'forest'],
        },
    ],
    floe: [
        {
            id: 'ice-orcas', name: 'Ice Orcas',
            // They spy-hop the leads and hit thin plates from below to tip
            // whatever is standing on them into the black.
            packSize: [1, 3], damage: 26, speed: 8,
            inflicts: { bleeding: true },
            fearAura: 8,
            terrainPreference: ['water', 'wetland'],
        },
        {
            id: 'floe-bears', name: 'Floe Bears',
            // White on white on white. They walk the pack ice like they were
            // commissioned for it, because they were.
            packSize: [1, 1], damage: 28, speed: 7,
            inflicts: { bleeding: true },
            persistent: true,
            terrainPreference: ['open', 'highland', 'ruins'],
        },
        {
            id: 'storm-petrels', name: 'Storm Petrels',
            // A shrieking weather-front of birds that arrives just ahead of
            // the real one.
            packSize: [4, 9], damage: 4, speed: 10,
            fearAura: 5,
        },
        {
            id: 'the-under-thing', name: 'The Under-Thing',
            // Nobody has seen it. What they have seen is the ice flexing from
            // beneath, in a line, patiently, following someone.
            packSize: [1, 1], damage: 14, speed: 5,
            fearAura: 12,
            nocturnal: true,
            persistent: true,
        },
    ],
    alpine: [
        {
            id: 'timberline-wolves', name: 'Timberline Wolves',
            // A classic pack for a classic arena: they push prey uphill, out
            // of the trees, onto the open snow.
            packSize: [3, 5], damage: 17, speed: 8,
            inflicts: { bleeding: true },
            terrainPreference: ['forest', 'open', 'highland'],
        },
        {
            id: 'the-white-stag', name: 'The White Stag',
            // Beautiful, antlered, and wrong: it wants to be followed, and
            // the places it leads to are never survivable.
            packSize: [1, 1], damage: 19, speed: 9,
            fearAura: 8,
            persistent: true,
            terrainPreference: ['forest', 'open', 'highland'],
        },
        {
            id: 'chough-flocks', name: 'Chough Flocks',
            // Mountain crows with a taste for eyes and an instinct for
            // starting the slopes moving above a climber.
            packSize: [4, 8], damage: 5, speed: 10,
            inflicts: { bleeding: true },
            terrainPreference: ['highland', 'open'],
        },
        {
            id: 'marmot-mutts', name: 'Marmot Mutts',
            // Burrowers the size of dogs, and the whistling is a targeting
            // system: one sees you, and every burrow on the slope knows.
            packSize: [2, 5], damage: 9, speed: 5,
            terrainPreference: ['open', 'highland', 'wetland'],
        },
    ],
    terraces: [
        {
            id: 'shaft-swifts', name: 'Shaft Swifts',
            // They nest down the open shafts in their thousands and boil out
            // of them at dusk like smoke with edges.
            packSize: [4, 9], damage: 5, speed: 10,
            inflicts: { bleeding: true },
            nocturnal: true,
            terrainPreference: ['ruins', 'highland', 'open'],
        },
        {
            id: 'terrace-jackals', name: 'Terrace Jackals',
            // They drive prey along a step until the step ends. The mountain
            // does the rest.
            packSize: [2, 4], damage: 16, speed: 8,
            inflicts: { bleeding: true },
            terrainPreference: ['open', 'highland', 'forest'],
        },
        {
            id: 'the-foreman', name: 'The Foreman',
            // It walks the terraces on a schedule, carrying a lamp it does
            // not need, checking work that stopped a century ago.
            packSize: [1, 1], damage: 23, speed: 5,
            fearAura: 11,
            nocturnal: true,
            persistent: true,
            terrainPreference: ['ruins', 'open', 'highland'],
        },
        {
            id: 'cable-spiders', name: 'Cable Spiders',
            // They string the dead cable car lines with silk you can hang a
            // person from, and do.
            packSize: [1, 3], damage: 13, speed: 7,
            inflicts: { poisoned: true },
            terrainPreference: ['ruins', 'highland', 'forest'],
        },
    ],

    // Procedural biomes (src/engine/arenaGenerator.ts BIOMES ids).
    rainforest: [
        {
            id: 'razor-parrots', name: 'Razor Parrots',
            packSize: [3, 6], damage: 9, speed: 10,
            inflicts: { bleeding: true },
        },
        {
            id: 'constrictor-vines', name: 'Constrictor Vines',
            packSize: [1, 1], damage: 20, speed: 2,
            terrainPreference: ['forest', 'wetland', 'ruins'],
            persistent: true,
        },
        {
            id: 'panther-mutts', name: 'Panther Mutts',
            packSize: [1, 2], damage: 25, speed: 9,
            inflicts: { bleeding: true },
            nocturnal: true,
        },
    ],
    volcanic: [
        {
            id: 'magma-hounds', name: 'Magma Hounds',
            packSize: [2, 4], damage: 22, speed: 8,
            inflicts: { burned: true },
        },
        {
            id: 'ash-wraiths-v', name: 'Ash Wraiths',
            packSize: [1, 2], damage: 7, speed: 6,
            fearAura: 8,
            nocturnal: true,
        },
        {
            id: 'obsidian-beetles', name: 'Obsidian Beetles',
            packSize: [3, 7], damage: 6, speed: 4,
            inflicts: { bleeding: true },
            terrainPreference: ['open', 'highland', 'ruins'],
        },
    ],
    archipelago: [
        {
            id: 'razorfin-sharks', name: 'Razorfin Sharks',
            packSize: [1, 3], damage: 28, speed: 9,
            inflicts: { bleeding: true },
            terrainPreference: ['water'],
        },
        {
            id: 'storm-gulls', name: 'Storm Gulls',
            packSize: [3, 6], damage: 8, speed: 10,
        },
        {
            id: 'coral-crabs', name: 'Coral Crabs',
            packSize: [2, 5], damage: 10, speed: 3,
            inflicts: { infected: true },
            terrainPreference: ['water', 'open'],
        },
    ],
    highlands: [
        {
            id: 'cliff-harpies', name: 'Cliff Harpies',
            packSize: [1, 3], damage: 16, speed: 10,
            inflicts: { bleeding: true },
            terrainPreference: ['highland', 'open'],
        },
        {
            id: 'dire-rams', name: 'Dire Rams',
            packSize: [1, 2], damage: 21, speed: 6,
        },
        {
            id: 'fog-stalkers', name: 'Fog Stalkers',
            packSize: [1, 1], damage: 12, speed: 7,
            fearAura: 6,
            nocturnal: true,
            persistent: true,
        },
    ],
};
