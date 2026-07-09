import { RNG } from '../utils/rng';
import { Tribute, Attributes, Build, GameConfig } from '../models/types';
import { TRAITS, BUILDS, DEFAULT_GAME_CONFIG } from '../data/constants';
import { ARCHETYPES } from '../data/archetypes';

const DISTRICT_NAMES: Record<number, { Male: string[]; Female: string[] }> = {
    1: {
        Male: ['Marvel', 'Gloss', 'Cashmere', 'Velvet', 'Suede', 'Jewel', 'Royal', 'Prince', 'Sterling', 'Lux', 'Diamond', 'Emerald', 'Ruby', 'Garnet', 'Amethyst', 'Onyx', 'Sapphire', 'Jasper', 'Gold', 'Silver', 'Aurelius', 'Baron'],
        Female: ['Glimmer', 'Crystal', 'Diamond', 'Emerald', 'Opal', 'Sapphire', 'Silk', 'Lace', 'Amber', 'Pearl', 'Ruby', 'Jade', 'Luster', 'Ivory', 'Tiara', 'Platinum', 'Shimmer', 'Glitter', 'Satin', 'Bijou', 'Sparkle', 'Diva']
    },
    2: {
        Male: ['Cato', 'Brutus', 'Marcus', 'Titus', 'Maximus', 'Rex', 'Leon', 'Victor', 'Justin', 'Caesar', 'Quintus', 'Decimus', 'Cassius', 'Lucius', 'Hector', 'Achilles', 'Valerius', 'Iron', 'Steel', 'Granite', 'Flint', 'Commander'],
        Female: ['Clove', 'Enobaria', 'Livia', 'Diana', 'Victoria', 'Aurelia', 'Octavia', 'Portia', 'Juno', 'Sabina', 'Minerva', 'Vesta', 'Camilla', 'Bellona', 'Drusilla', 'Antonia', 'Valeria', 'Corinna', 'Pax', 'Alexandria', 'Aria']
    },
    3: {
        Male: ['Beetee', 'Circuit', 'Byte', 'Vector', 'Pixel', 'Watt', 'Silicon', 'Analog', 'Turing', 'Helix', 'Pascal', 'Linux', 'Kernel', 'Cache', 'Giga', 'Binary', 'Tera', 'Code', 'Quantum', 'Link', 'Node', 'Cyber'],
        Female: ['Wiress', 'Cyra', 'Nova', 'Matrix', 'Data', 'Glitch', 'Beta', 'Micro', 'Echo', 'Cyber', 'Ada', 'Dot', 'Array', 'Cache', 'Logic', 'Syntax', 'Spark', 'Schema', 'Meg', 'Interface', 'Signal', 'Hedy']
    },
    4: {
        Male: ['Finnick', 'Odair', 'Triton', 'Fisher', 'Reef', 'Tide', 'Wave', 'Hook', 'Anchor', 'Finn', 'Sailor', 'Neptune', 'Drake', 'River', 'Captain', 'Marina', 'Barnacle', 'Gill', 'Marlin', 'Ray', 'Harbour', 'Coast'],
        Female: ['Annie', 'Cresta', 'Mags', 'Nerida', 'Pearl', 'Shelly', 'Coral', 'Siren', 'Delta', 'Coralia', 'Marina', 'Ocean', 'Brooke', 'Sandy', 'Wavelet', 'Aqua', 'Naida', 'Tallulah', 'Undine', 'Kelp', 'Lagoon', 'Cove']
    },
    5: {
        Male: ['Bolt', 'Spark', 'Voltz', 'Cable', 'Ohm', 'Joule', 'Photon', 'Proton', 'Amp', 'Tesla', 'Watts', 'Neutron', 'Fusion', 'Dyno', 'Grid', 'Radar', 'Current', 'Electro', 'Surge', 'Turbine', 'Anode', 'Cathode'],
        Female: ['Electra', 'Tesla', 'Current', 'Nova', 'Astra', 'Ray', 'Flare', 'Aurora', 'Vibe', 'Lumina', 'Static', 'Sparkle', 'Gamma', 'Shocka', 'Solara', 'Dynamo', 'Energy', 'Power', 'Nebula', 'Helix', 'Voltina', 'Solenoid']
    },
    6: {
        Male: ['Axel', 'Gear', 'Diesel', 'Otto', 'Miles', 'Jet', 'Porter', 'Track', 'Rover', 'Buster', 'Gauge', 'Aero', 'Transit', 'Piston', 'Fender', 'Express', 'Driver', 'Coach', 'Pilot', 'Turbo', 'Brake', 'Steer'],
        Female: ['Aero', 'Transit', 'Lane', 'Piper', 'Stella', 'Velocity', 'Siena', 'Mercedes', 'Cheyenne', 'Cab', 'Raven', 'Carline', 'Aviara', 'Jet', 'Highway', 'Subaru', 'Taxi', 'Turbo', 'Rail', 'Glide', 'Siren', 'Odometer']
    },
    7: {
        Male: ['Timber', 'Oak', 'Birch', 'Cedar', 'Ash', 'Forrest', 'Woody', 'Sawyer', 'Bark', 'Lumber', 'Pine', 'Spruce', 'Redwood', 'Branch', 'Axe', 'Chip', 'Log', 'Grover', 'Maple', 'Barky', 'Stump', 'Cutter'],
        Female: ['Johanna', 'Pine', 'Willow', 'Birch', 'Maple', 'Hazel', 'Flora', 'Fern', 'Leaf', 'Branch', 'Clover', 'Ivy', 'Season', 'Sylvan', 'Amber', 'Aspen', 'Sequoia', 'Holly', 'Bloom', 'Autumn', 'Blossom', 'Juniper']
    },
    8: {
        Male: ['Spindle', 'Bobbin', 'Hem', 'Weaver', 'Stitch', 'Wool', 'Cotton', 'Tailor', 'Patches', 'Loom', 'Flax', 'Fiber', 'Needle', 'Shear', 'Pattern', 'Nylon', 'Corduroy', 'Tweed', 'Velvet', 'Silk', 'Jean', 'Twill'],
        Female: ['Cecelia', 'Satin', 'Velvet', 'Needle', 'Thread', 'Lace', 'Pattern', 'Paisley', 'Silk', 'Denim', 'Chiffon', 'Brocade', 'Taffeta', 'Ribbon', 'Yarn', 'Hemmy', 'Gingham', 'Polyester', 'Linen', 'Angora', 'Felt', 'Shear']
    },
    9: {
        Male: ['Rye', 'Wheat', 'Barley', 'Oat', 'Baker', 'Mill', 'Flour', 'Bran', 'Stalk', 'Kernel', 'Straw', 'Reaper', 'Field', 'Loaf', 'Yeast', 'Grits', 'Sieve', 'Paddy', 'Chaff', 'Grain', 'Sower', 'Sheaf'],
        Female: ['Amber', 'Meadow', 'Grain', 'Blossom', 'Cerealia', 'Harvest', 'Clover', 'Poppy', 'Flora', 'Saffron', 'Barley', 'Ceres', 'Autumn', 'Maize', 'Rye', 'Sesame', 'Honey', 'Bread', 'Wheatley', 'Sierra', 'Graine', 'Millet']
    },
    10: {
        Male: ['Shepherd', 'Buck', 'Colt', 'Tanner', 'Herd', 'Drake', 'Hunt', 'Ranger', 'Buster', 'Billy', 'Corral', 'Bovine', 'Steer', 'Lasso', 'Cowboy', 'Leather', 'Spur', 'Wooly', 'Bronc', 'Stallion', 'Calf', 'Groom'],
        Female: ['Brandy', 'Lassie', 'Fawn', 'Doe', 'Filly', 'Flora', 'Sierra', 'Clover', 'Meadow', 'Dixie', 'Bella', 'Daisy', 'Molly', 'Dolly', 'Bessie', 'Wooly', 'Ryder', 'Saddle', 'Ranch', 'Buttercup', 'Heifer', 'Mane']
    },
    11: {
        Male: ['Thresh', 'Chaff', 'Reap', 'Clay', 'Soil', 'Bud', 'Root', 'Sprout', 'Arbor', 'Farmer', 'Booker', 'Branch', 'Seed', 'Harvest', 'Clover', 'Peaches', 'Melon', 'Pete', 'Cotton', 'Grove', 'Scythe', 'Till'],
        Female: ['Rue', 'Seeder', 'Blossom', 'Daisy', 'Holly', 'Lily', 'Rose', 'Petal', 'Flora', 'Rosemary', 'Lavender', 'Poppy', 'Autumn', 'Cherry', 'Peach', 'Berry', 'Clover', 'Olive', 'Marigold', 'Jasmine', 'Fern', 'Bud']
    },
    12: {
        Male: ['Peeta', 'Gale', 'Haymitch', 'Coal', 'Ash', 'Flint', 'Dust', 'Slate', 'Stone', 'Ore', 'Miner', 'Shaft', 'Carbon', 'Pickaxe', 'Shovel', 'Soot', 'Copper', 'Bronze', 'Brick', 'Pebble', 'Lignite', 'Coke'],
        Female: ['Katniss', 'Primrose', 'Ember', 'Cinder', 'Raven', 'Hazel', 'Opal', 'Pearl', 'Iris', 'Violet', 'Onyx', 'Dusty', 'Coalette', 'Seam', 'Healer', 'Sage', 'Myrrh', 'Rue', 'Willow', 'Amber', 'Jewel', 'Diamond']
    }
};

function buildFromStrength(rng: RNG, strength: number): Build {
    // Roughly correlate build with strength while keeping some randomness.
    const idx = Math.min(BUILDS.length - 1, Math.max(0, Math.floor(strength / 2) + rng.nextInt(-1, 1)));
    return BUILDS[idx];
}

export function generateTributes(seed: string, config: GameConfig = DEFAULT_GAME_CONFIG): Tribute[] {
    const rng = new RNG(seed);
    const tributes: Tribute[] = [];
    const districtCount = Math.min(12, Math.max(1, config.districtCount));

    for (let district = 1; district <= districtCount; district++) {
        for (const gender of ['Male', 'Female'] as const) {
            const isCareer = [1, 2, 4].includes(district);

            // Base attributes
            const attributes: Attributes = {
                strength: rng.nextInt(3, 7),
                agility: rng.nextInt(3, 7),
                intelligence: rng.nextInt(3, 7),
                charisma: rng.nextInt(3, 7),
                stealth: rng.nextInt(3, 7),
            };

            // District bonuses
            if (isCareer) {
                attributes.strength += rng.nextInt(1, 3);
                attributes.agility += rng.nextInt(1, 3);
            }
            if (district === 3) {
                attributes.intelligence += rng.nextInt(2, 4);
            }
            if (district === 7) {
                attributes.strength += rng.nextInt(1, 3);
            }
            if (district === 11 || district === 12) {
                attributes.stealth += rng.nextInt(2, 4);
                attributes.agility += rng.nextInt(1, 2);
            }

            // Cap at 10
            (Object.keys(attributes) as Array<keyof Attributes>).forEach(k => {
                attributes[k] = Math.min(10, attributes[k]);
            });

            // Traits
            const numTraits = rng.nextInt(1, 3);
            const traits: string[] = [];
            while (traits.length < numTraits) {
                const trait = rng.pick(TRAITS);
                if (!traits.includes(trait)) {
                    traits.push(trait);
                }
            }

            const chosenName = rng.pick(DISTRICT_NAMES[district][gender]);
            const age = rng.nextInt(12, 18);
            const heightCm = gender === 'Male' ? rng.nextInt(155, 195) : rng.nextInt(148, 185);
            const build = buildFromStrength(rng, attributes.strength);

            const archetype = rng.pick(ARCHETYPES).id;
            const secondaryArchetypes: string[] = [];
            if (rng.chance(0.3)) {
                let secondary = rng.pick(ARCHETYPES).id;
                while (secondary === archetype) {
                    secondary = rng.pick(ARCHETYPES).id;
                }
                secondaryArchetypes.push(secondary);
            }

            tributes.push({
                id: `d${district}-${gender.toLowerCase()}`,
                district,
                gender,
                name: chosenName,
                age,
                heightCm,
                build,
                isCareer,
                attributes,
                traits,
                archetype,
                secondaryArchetypes,
                vitals: { hunger: 0, thirst: 0, fatigue: 0, sanity: 100 },
                injuries: { head: false, torso: false, arms: false, legs: false, bleeding: false, infected: false },
                health: 100,
                status: 'alive',
                inventory: [],
                stance: 'Defensive',
                relationships: {},
                excitementRating: 0,
                sponsorTrust: 50,
                trainingScore: 0,
                kills: 0,
                zone: 'The Cornucopia'
            });
        }
    }

    return tributes;
}
