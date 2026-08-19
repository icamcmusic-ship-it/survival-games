import { Gender } from '../models/types';

/**
 * Reaping pools, one per district and gender.
 *
 * Each pool is deliberately over-stocked (45+ entries) so that a full 24-tribute
 * reaping can draw unique names without collisions, and so repeat runs on
 * different seeds feel like a different cast rather than the same twelve faces.
 * Names lean on each district's industry the way Panem's naming conventions do.
 */
export const DISTRICT_NAMES: Record<number, Record<Gender, string[]>> = {
    // District 1 — Luxury goods
    1: {
        Male: [
            'Marvel', 'Gloss', 'Cashmere', 'Velvet', 'Suede', 'Jewel', 'Royal', 'Prince', 'Sterling', 'Lux',
            'Diamond', 'Emerald', 'Ruby', 'Garnet', 'Amethyst', 'Onyx', 'Sapphire', 'Jasper', 'Gold', 'Silver',
            'Aurelius', 'Baron',
            'Bullion', 'Carat', 'Facet', 'Filigree', 'Gilder', 'Halo', 'Ingot', 'Lacquer', 'Lapis', 'Luxor',
            'Marquis', 'Mirage', 'Obsidian', 'Ornament', 'Plush', 'Regalia', 'Rhodium', 'Scepter', 'Solitaire',
            'Splendor', 'Tourmaline', 'Trinket', 'Vanity', 'Zircon', 'Brocade', 'Chandelier', 'Coronet',
        ],
        Female: [
            'Glimmer', 'Crystal', 'Diamond', 'Emerald', 'Opal', 'Sapphire', 'Silk', 'Lace', 'Amber', 'Pearl',
            'Ruby', 'Jade', 'Luster', 'Ivory', 'Tiara', 'Platinum', 'Shimmer', 'Glitter', 'Satin', 'Bijou',
            'Sparkle', 'Diva',
            'Aurelia', 'Bauble', 'Beryl', 'Cameo', 'Chalice', 'Charm', 'Countess', 'Damask', 'Duchess',
            'Facette', 'Gilda', 'Jewelia', 'Lustra', 'Marquise', 'Opaline', 'Pendant', 'Peridot', 'Prism',
            'Regalia', 'Sequin', 'Silhouette', 'Tulle', 'Velour', 'Vitrine', 'Zirconia', 'Brilliance',
        ],
    },
    // District 2 — Masonry & Peacekeepers
    2: {
        Male: [
            'Cato', 'Brutus', 'Marcus', 'Titus', 'Maximus', 'Rex', 'Leon', 'Victor', 'Justin', 'Caesar',
            'Quintus', 'Decimus', 'Cassius', 'Lucius', 'Hector', 'Achilles', 'Valerius', 'Iron', 'Steel',
            'Granite', 'Flint', 'Commander',
            'Anvil', 'Basalt', 'Bastion', 'Bulwark', 'Chisel', 'Cornelius', 'Fortis', 'Garrison', 'Hadrian',
            'Keystone', 'Legion', 'Marble', 'Mason', 'Obelisk', 'Praetor', 'Quarry', 'Rampart', 'Severus',
            'Slate', 'Tacitus', 'Tiberius', 'Trajan', 'Turret', 'Vulcan', 'Warden', 'Aurelian',
        ],
        Female: [
            'Clove', 'Enobaria', 'Livia', 'Diana', 'Victoria', 'Aurelia', 'Octavia', 'Portia', 'Juno', 'Sabina',
            'Minerva', 'Vesta', 'Camilla', 'Bellona', 'Drusilla', 'Antonia', 'Valeria', 'Corinna', 'Pax',
            'Alexandria', 'Aria',
            'Agrippina', 'Basilica', 'Calpurnia', 'Citadel', 'Cornelia', 'Domitia', 'Fortuna', 'Galena',
            'Julia', 'Lavinia', 'Lucilla', 'Marcella', 'Marmora', 'Nerva', 'Obsidia', 'Paloma', 'Petra',
            'Quarra', 'Regula', 'Roma', 'Severa', 'Tullia', 'Verona', 'Vitrea', 'Volumnia', 'Aquila',
            'Aurora', 'Sentina',
        ],
    },
    // District 3 — Technology
    3: {
        Male: [
            'Beetee', 'Circuit', 'Byte', 'Vector', 'Pixel', 'Watt', 'Silicon', 'Analog', 'Turing', 'Helix',
            'Pascal', 'Linux', 'Kernel', 'Cache', 'Giga', 'Binary', 'Tera', 'Code', 'Quantum', 'Link',
            'Node', 'Cyber',
            'Ampere', 'Boolean', 'Bus', 'Capacitor', 'Chipset', 'Cipher', 'Compiler', 'Diode', 'Firmware',
            'Fuse', 'Hertz', 'Lattice', 'Ledger', 'Modem', 'Nyquist', 'Packet', 'Processor', 'Protocol',
            'Relay', 'Resistor', 'Router', 'Servo', 'Solder', 'Transistor', 'Vertex',
            'Voltaic', 'Waveform',
        ],
        Female: [
            'Wiress', 'Cyra', 'Nova', 'Matrix', 'Data', 'Glitch', 'Beta', 'Micro', 'Echo', 'Cyber',
            'Ada', 'Dot', 'Array', 'Cache', 'Logic', 'Syntax', 'Spark', 'Schema', 'Meg', 'Interface',
            'Signal', 'Hedy',
            'Alpha', 'Ampera', 'Binaria', 'Bitsy', 'Circuita', 'Delta', 'Filament', 'Gigi', 'Grace',
            'Hexa', 'Indexia', 'Iris', 'Kilo', 'Lumen', 'Nano', 'Octa', 'Pixie', 'Quanta', 'Query',
            'Radia', 'Sigma', 'Solstice', 'Tessa', 'Vectra', 'Wavelet', 'Zeta',
        ],
    },
    // District 4 — Fishing
    4: {
        Male: [
            'Finnick', 'Odair', 'Triton', 'Fisher', 'Reef', 'Tide', 'Wave', 'Hook', 'Anchor', 'Finn',
            'Sailor', 'Neptune', 'Drake', 'River', 'Captain', 'Barnacle', 'Gill', 'Marlin', 'Ray',
            'Harbour', 'Coast',
            'Beacon', 'Bosun', 'Breaker', 'Cliffton', 'Compass', 'Current', 'Dorsal', 'Fathom', 'Ferry',
            'Halibut', 'Keel', 'Kraken', 'Mariner', 'Mast', 'Nautilus', 'Netter', 'Pike', 'Rudder',
            'Salt', 'Schooner', 'Shoal', 'Skipper', 'Sterling', 'Tackle', 'Trawler', 'Wharf',
            'Windward', 'Yawl',
        ],
        Female: [
            'Annie', 'Cresta', 'Mags', 'Nerida', 'Pearl', 'Shelly', 'Coral', 'Siren', 'Delta', 'Coralia',
            'Marina', 'Ocean', 'Brooke', 'Sandy', 'Wavelet', 'Aqua', 'Naida', 'Tallulah', 'Undine',
            'Kelp', 'Lagoon', 'Cove',
            'Anemone', 'Aria', 'Azura', 'Beacon', 'Caspia', 'Cascade', 'Dune', 'Estuary', 'Galley',
            'Harbora', 'Isla', 'Jetsam', 'Kelpie', 'Mira', 'Nerissa', 'Oceana', 'Oyster', 'Reefa',
            'Saline', 'Seaglass', 'Selkie', 'Shorewyn', 'Sirena', 'Thalassa', 'Tidal', 'Vela',
        ],
    },
    // District 5 — Power
    5: {
        Male: [
            'Bolt', 'Spark', 'Voltz', 'Cable', 'Ohm', 'Joule', 'Photon', 'Proton', 'Amp', 'Tesla',
            'Watts', 'Neutron', 'Fusion', 'Dyno', 'Grid', 'Radar', 'Current', 'Electro', 'Surge',
            'Turbine', 'Anode', 'Cathode',
            'Arc', 'Breaker', 'Coil', 'Conduit', 'Dynamo', 'Faraday', 'Filament', 'Flux', 'Fission',
            'Generator', 'Halogen', 'Ionis', 'Kilowatt', 'Magneto', 'Nucleus', 'Pylon', 'Reactor',
            'Rectifier', 'Solaris', 'Static', 'Substation', 'Terminal', 'Thermal', 'Transformer', 'Volt',
            'Voltaire', 'Yield',
        ],
        Female: [
            'Electra', 'Tesla', 'Current', 'Nova', 'Astra', 'Ray', 'Flare', 'Aurora', 'Vibe', 'Lumina',
            'Static', 'Sparkle', 'Gamma', 'Shocka', 'Solara', 'Dynamo', 'Energy', 'Power', 'Nebula',
            'Helix', 'Voltina', 'Solenoid',
            'Amperia', 'Arcadia', 'Beacon', 'Circuita', 'Corona', 'Ember', 'Faraday', 'Fissa', 'Fusia',
            'Ionia', 'Joulene', 'Kilowatta', 'Lumen', 'Magnetta', 'Neon', 'Plasma', 'Pulse', 'Radiance',
            'Reactra', 'Solstice', 'Surga', 'Thermia', 'Turbina', 'Watta', 'Zenith',
            'Voltessa', 'Wyre',
        ],
    },
    // District 6 — Transportation
    6: {
        Male: [
            'Axel', 'Gear', 'Diesel', 'Otto', 'Miles', 'Jet', 'Porter', 'Track', 'Rover', 'Buster',
            'Gauge', 'Aero', 'Transit', 'Piston', 'Fender', 'Express', 'Driver', 'Coach', 'Pilot',
            'Turbo', 'Brake', 'Steer',
            'Ballast', 'Boxcar', 'Cargo', 'Chassis', 'Clutch', 'Convoy', 'Cruiser', 'Depot', 'Ferris',
            'Freight', 'Hauler', 'Junction', 'Locomotive', 'Manifold', 'Motor', 'Pullman', 'Rail',
            'Signal', 'Sleeper', 'Sprocket', 'Switch', 'Tandem', 'Throttle', 'Trestle', 'Wheeler',
            'Yardmaster', 'Zephyr',
        ],
        Female: [
            'Aero', 'Transit', 'Lane', 'Piper', 'Stella', 'Velocity', 'Siena', 'Mercedes', 'Cheyenne',
            'Cab', 'Raven', 'Carline', 'Aviara', 'Jet', 'Highway', 'Subaru', 'Taxi', 'Turbo', 'Rail',
            'Glide', 'Odometer',
            'Avia', 'Axela', 'Boulevard', 'Bristol', 'Caravan', 'Carrera', 'Chrome', 'Cyclone', 'Delta',
            'Dashiell', 'Engina', 'Ferria', 'Gearette', 'Jetta', 'Junction', 'Marquis', 'Mileva',
            'Overpass', 'Parkway', 'Pinion', 'Skyway', 'Sonic', 'Terminal', 'Trolley', 'Vespa', 'Voyage',
            'Wagoneer', 'Zephyra',
        ],
    },
    // District 7 — Lumber
    7: {
        Male: [
            'Timber', 'Oak', 'Birch', 'Cedar', 'Ash', 'Forrest', 'Woody', 'Sawyer', 'Bark', 'Lumber',
            'Pine', 'Spruce', 'Redwood', 'Branch', 'Axe', 'Chip', 'Log', 'Grover', 'Maple', 'Barky',
            'Stump', 'Cutter',
            'Alder', 'Amber', 'Balsam', 'Beech', 'Bristlecone', 'Bough', 'Chestnut', 'Cypress', 'Elm',
            'Fell', 'Grain', 'Hemlock', 'Hickory', 'Kindling', 'Knot', 'Larch', 'Mahogany', 'Rosin',
            'Sap', 'Sequoyah', 'Splinter', 'Teak', 'Thicket', 'Walnut', 'Whittle', 'Yew',
        ],
        Female: [
            'Johanna', 'Pine', 'Willow', 'Birch', 'Maple', 'Hazel', 'Flora', 'Fern', 'Leaf', 'Branch',
            'Clover', 'Ivy', 'Season', 'Sylvan', 'Amber', 'Aspen', 'Sequoia', 'Holly', 'Bloom',
            'Autumn', 'Blossom', 'Juniper',
            'Acacia', 'Alder', 'Arbor', 'Bramble', 'Briar', 'Camellia', 'Canopy', 'Cedrella', 'Dryad',
            'Elmira', 'Fernleaf', 'Grove', 'Hollow', 'Laurel', 'Linden', 'Magnolia', 'Mossy', 'Myrtle',
            'Olive', 'Rowan', 'Sapling', 'Sorrel', 'Sylva', 'Tamarack', 'Verdance', 'Woodrow',
        ],
    },
    // District 8 — Textiles
    8: {
        Male: [
            'Spindle', 'Bobbin', 'Hem', 'Weaver', 'Stitch', 'Wool', 'Cotton', 'Tailor', 'Patches', 'Loom',
            'Flax', 'Fiber', 'Needle', 'Shear', 'Pattern', 'Nylon', 'Corduroy', 'Tweed', 'Velvet',
            'Silk', 'Jean', 'Twill',
            'Baste', 'Bolt', 'Brocade', 'Buckram', 'Calico', 'Canvas', 'Cambric', 'Dye', 'Fleece',
            'Gabardine', 'Gusset', 'Herringbone', 'Jacquard', 'Knit', 'Muslin', 'Percale', 'Pleat',
            'Poplin', 'Sateen', 'Selvedge', 'Serge', 'Spool', 'Thimble', 'Warp', 'Weft', 'Worsted',
        ],
        Female: [
            'Cecelia', 'Satin', 'Velvet', 'Needle', 'Thread', 'Lace', 'Pattern', 'Paisley', 'Silk',
            'Denim', 'Chiffon', 'Brocade', 'Taffeta', 'Ribbon', 'Yarn', 'Hemmy', 'Gingham', 'Polyester',
            'Linen', 'Angora', 'Felt', 'Shear',
            'Batiste', 'Bombazine', 'Cambria', 'Chenille', 'Crepe', 'Damask', 'Dyanne', 'Embroidery',
            'Filature', 'Georgette', 'Jacquarda', 'Kersey', 'Lawn', 'Merino', 'Mohair', 'Organza',
            'Percaline', 'Plisse', 'Sarcenet', 'Seam', 'Spindra', 'Tulle', 'Velour', 'Voile', 'Weaverly',
            'Warpwyn', 'Zibeline',
        ],
    },
    // District 9 — Grain
    9: {
        Male: [
            'Rye', 'Wheat', 'Barley', 'Oat', 'Baker', 'Mill', 'Flour', 'Bran', 'Stalk', 'Kernel',
            'Straw', 'Reaper', 'Field', 'Loaf', 'Yeast', 'Grits', 'Sieve', 'Paddy', 'Chaff', 'Grain',
            'Sower', 'Sheaf',
            'Acre', 'Bushel', 'Combine', 'Cornel', 'Fallow', 'Farrow', 'Furrow', 'Granary', 'Harrow',
            'Husk', 'Miller', 'Ordway', 'Plow', 'Quern', 'Ripener', 'Rowen', 'Semolina', 'Silo',
            'Sorghum', 'Spelt', 'Thresher', 'Tiller', 'Winnow', 'Yield',
            'Zephyr', 'Ryeland', 'Cropley',
        ],
        Female: [
            'Amber', 'Meadow', 'Grain', 'Blossom', 'Cerealia', 'Harvest', 'Clover', 'Poppy', 'Flora',
            'Saffron', 'Barley', 'Ceres', 'Autumn', 'Maize', 'Rye', 'Sesame', 'Honey', 'Bread',
            'Wheatley', 'Sierra', 'Graine', 'Millet',
            'Acadia', 'Amaranth', 'Bakerly', 'Bushela', 'Cornsilk', 'Demeter', 'Emmer', 'Farina',
            'Fielda', 'Golden', 'Granaria', 'Hearth', 'Kamut', 'Loafa', 'Marla', 'Oatlyn', 'Pollen',
            'Quinoa', 'Sheafa', 'Silage', 'Sunna', 'Threshia', 'Tillie', 'Wheaten', 'Winnowa',
            'Yeasta', 'Zephyra',
        ],
    },
    // District 10 — Livestock
    10: {
        Male: [
            'Shepherd', 'Buck', 'Colt', 'Tanner', 'Herd', 'Drake', 'Hunt', 'Ranger', 'Buster', 'Billy',
            'Corral', 'Bovine', 'Steer', 'Lasso', 'Cowboy', 'Leather', 'Spur', 'Wooly', 'Bronc',
            'Stallion', 'Calf', 'Groom',
            'Angus', 'Bramble', 'Brand', 'Bridle', 'Bullock', 'Cattle', 'Cinch', 'Drover', 'Fleecer',
            'Gelding', 'Grazer', 'Hoof', 'Latigo', 'Mustang', 'Paddock', 'Pasture', 'Rawhide', 'Rodeo',
            'Saddler', 'Stirrup', 'Tallow', 'Trough', 'Wrangler', 'Yoke',
            'Zebulon', 'Whicker', 'Vaquero',
        ],
        Female: [
            'Brandy', 'Lassie', 'Fawn', 'Doe', 'Filly', 'Flora', 'Sierra', 'Clover', 'Meadow', 'Dixie',
            'Bella', 'Daisy', 'Molly', 'Dolly', 'Bessie', 'Wooly', 'Ryder', 'Saddle', 'Ranch',
            'Buttercup', 'Heifer', 'Mane',
            'Angora', 'Bridle', 'Brindle', 'Cattleya', 'Cinnamon', 'Corrala', 'Creamery', 'Dapple',
            'Ewelyn', 'Grazia', 'Hearthstone', 'Holstein', 'Jersey', 'Lariat', 'Marigold', 'Palomina',
            'Pastura', 'Prairie', 'Roan', 'Rustica', 'Shearla', 'Stampede', 'Tallowyn', 'Willa',
            'Winnowa', 'Yearling', 'Zephyrine',
        ],
    },
    // District 11 — Agriculture
    11: {
        Male: [
            'Thresh', 'Chaff', 'Reap', 'Clay', 'Soil', 'Bud', 'Root', 'Sprout', 'Arbor', 'Farmer',
            'Booker', 'Branch', 'Seed', 'Harvest', 'Clover', 'Peaches', 'Melon', 'Pete', 'Cotton',
            'Grove', 'Scythe', 'Till',
            'Almond', 'Bramble', 'Cane', 'Citron', 'Compost', 'Cornhusk', 'Furrow', 'Grafton', 'Hedge',
            'Hoe', 'Loam', 'Mulch', 'Orchard', 'Pecan', 'Pomel', 'Rind', 'Sorghum', 'Stalk', 'Sunhat',
            'Tendril', 'Trellis', 'Vine', 'Winnow', 'Yam',
            'Zucca', 'Sorrel', 'Husk',
        ],
        Female: [
            'Rue', 'Seeder', 'Blossom', 'Daisy', 'Holly', 'Lily', 'Rose', 'Petal', 'Flora', 'Rosemary',
            'Lavender', 'Poppy', 'Autumn', 'Cherry', 'Peach', 'Berry', 'Clover', 'Olive', 'Marigold',
            'Jasmine', 'Fern', 'Bud',
            'Apricot', 'Basil', 'Bramblewyn', 'Calla', 'Camellia', 'Citrine', 'Dahlia', 'Fig', 'Ginger',
            'Harvestine', 'Hyacinth', 'Juniper', 'Meadowlark', 'Mulberry', 'Nectarine', 'Orchidea',
            'Persimmon', 'Plum', 'Quince', 'Sage', 'Sorrel', 'Sunflower', 'Tansy', 'Verbena', 'Zinnia',
            'Willowbee', 'Yarrow',
        ],
    },
    // District 12 — Mining
    12: {
        Male: [
            'Peeta', 'Gale', 'Haymitch', 'Coal', 'Ash', 'Flint', 'Dust', 'Slate', 'Stone', 'Ore',
            'Miner', 'Shaft', 'Carbon', 'Pickaxe', 'Shovel', 'Soot', 'Copper', 'Bronze', 'Brick',
            'Pebble', 'Lignite', 'Coke',
            'Anthracite', 'Basin', 'Bellows', 'Canary', 'Cinder', 'Collier', 'Cropper', 'Delve',
            'Ember', 'Gravel', 'Grit', 'Hewer', 'Lantern', 'Lode', 'Mica', 'Pitch', 'Quarrier',
            'Seamus', 'Shale', 'Smelt', 'Sooty', 'Tunnel', 'Vein', 'Winch',
            'Wickham', 'Yardley', 'Zinc',
        ],
        Female: [
            'Katniss', 'Primrose', 'Ember', 'Cinder', 'Raven', 'Hazel', 'Opal', 'Pearl', 'Iris', 'Violet',
            'Onyx', 'Dusty', 'Coalette', 'Seam', 'Healer', 'Sage', 'Myrrh', 'Rue', 'Willow', 'Amber',
            'Jewel', 'Diamond',
            'Anthracia', 'Ashlyn', 'Basalt', 'Briquette', 'Canary', 'Cindra', 'Collie', 'Cyndra',
            'Emberly', 'Flinta', 'Galena', 'Graphite', 'Hearth', 'Lantana', 'Lignia', 'Mica', 'Minerva',
            'Obsidia', 'Pitchy', 'Quarra', 'Shalene', 'Sootheart', 'Tallow', 'Veina', 'Wickley',
            'Xanthe', 'Zephyrine',
        ],
    },
};
