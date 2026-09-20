import { Gender } from '../models/types';

/**
 * Reaping pools, one per district and gender.
 *
 * Each pool is deliberately over-stocked (100 entries) so that a full 24-tribute
 * reaping can draw unique names without collisions, and so repeat runs on
 * different seeds feel like a different cast rather than the same twelve faces.
 *
 * Naming follows Panem's conventions: a name is usually a literal descriptor or
 * subtle pun on the district's export. Three formation styles are mixed in every
 * pool so a cast reads as a population rather than a pun list:
 *   - literal nouns used unmodified (Chaff, Spruce, Gloss);
 *   - phonetic twists of industry words (Wiress from wire, Beetee from byte,
 *     Thresh from threshing);
 *   - real names that happen to echo the theme (Primrose, Gale, Cato, Sawyer).
 * Career districts (1, 2, 4) lean ornate, Roman, and shiny; the outer districts
 * lean on grounded everyday nouns. District 12 splits along class lines: Seam
 * names come from wild plants, weather, and the woods, while merchant-class
 * names come from trades, baking, and soft garden flowers.
 */
export const DISTRICT_NAMES: Record<number, Record<Gender, string[]>> = {
    // District 1 — Luxury goods: gemstones, precious metals, finery, ornate
    // real names. The shiniest pool in Panem.
    1: {
        Male: [
            'Marvel', 'Gloss', 'Cashmere', 'Gildas', 'Suede', 'Jewel', 'Sterling', 'Lux', 'Prince', 'Royal',
            'Onyx', 'Jasper', 'Garnet', 'Zircon', 'Topaz', 'Quartz', 'Cobalt', 'Aurick', 'Sardonyx', 'Argent',
            'Aurelius', 'Augustus', 'Baron', 'Marquis', 'Duke', 'Regis', 'Cassio', 'Dorian', 'Valentin', 'Lucian',
            'Bullion', 'Carat', 'Facet', 'Lucrum', 'Ingot', 'Lapis', 'Halo', 'Scepter', 'Solitaire', 'Splendor',
            'Tourmaline', 'Trinket', 'Lacquer', 'Tiaron', 'Aurum', 'Baroque', 'Bezel', 'Cabochon', 'Ermine', 'Gilt',
            'Karat', 'Medallion', 'Mink', 'Ormolu', 'Regal', 'Vermeil', 'Chalice', 'Ducat', 'Finial', 'Gild',
            'Guilder', 'Monocle', 'Plinth', 'Rondel', 'Sovereign', 'Tinsel', 'Crest', 'Dandy', 'Emboss', 'Sheen',
            'Glint', 'Luster', 'Polish', 'Emerald', 'Signet', 'Rhodium', 'Platinum', 'Obsidian', 'Carnelian', 'Opulon',
            'Aurelian', 'Cashton', 'Gleam', 'Burnish', 'Silvano', 'Goldwin', 'Gemson', 'Lazule', 'Satine', 'Clasp',
            'Adorno', 'Bijan', 'Crispin', 'Eston', 'Florian', 'Jareth', 'Luxor', 'Orian', 'Percival', 'Sterlyn',
            'Brocade', 'Lustrine', 'Tessellate', 'Wrought', 'Xantolin',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Ormer', 'Illume', 'Yttrian', 'Orfevre', 'Xoana', 'Yale', 'Oriel', 'Xanthene', 'Ulmira', 'Ouvert',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Miravel',
        ],
        Female: [
            'Glimmer', 'Crystal', 'Diamond', 'Opal', 'Sapphire', 'Silk', 'Solitaria', 'Amber', 'Auriel', 'Ruby',
            'Jade', 'Ivory', 'Tiara', 'Shimmer', 'Glitter', 'Ambrette', 'Bijou', 'Sparkle', 'Sequin', 'Gilda',
            'Ornella', 'Beryl', 'Cameo', 'Charm', 'Duchess', 'Marquise', 'Opaline', 'Pendant', 'Peridot', 'Prism',
            'Regalia', 'Tiarelle', 'Velour', 'Zirconia', 'Brilliance', 'Gemma', 'Iolite', 'Lucent', 'Mirabelle', 'Nacre',
            'Ophira', 'Parure', 'Reverie', 'Seraphine', 'Etoile', 'Perle', 'Diadem', 'Eclat', 'Fleurette', 'Radiance',
            'Riviera', 'Coquette', 'Chandelle', 'Lavaliere', 'Alabaster', 'Cachet', 'Carnelia', 'Aurelie', 'Ambrosia', 'Jewelia',
            'Lustra', 'Facette', 'Opalescence', 'Topaza', 'Vitrine', 'Silhouette', 'Damaris', 'Goldie', 'Gilded', 'Emeraude',
            'Celestine', 'Adorna', 'Bellisima', 'Cascabel', 'Delaine', 'Filigree', 'Garnetta', 'Lumielle', 'Marvella', 'Ondine',
            'Pashmina', 'Preciosa', 'Sabelle', 'Trove', 'Vanity', 'Verity', 'Chiffonne', 'Dazzle', 'Elegance', 'Jacinthe',
            'Bijoux', 'Coronet', 'Estelle', 'Gloriana', 'Lucia', 'Odalys', 'Priscilla', 'Solange', 'Valencia', 'Vermeille',
            'Xanthine', 'Quillonne', 'Nacrissa', 'Verdigris', 'Yardleigh',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Uvarov', 'Ouro', 'Ursine', 'Zendal', 'Quadrille', 'Zibel', 'Yestre', 'Ormolet', 'Xantheon', 'Yvane',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Avelune', 'Cirelle',
        ],
    },
    // District 2 — Masonry & Peacekeepers: Roman names, stone, and
    // fortification. Ornate but blunt-edged.
    2: {
        Male: [
            'Cato', 'Brutus', 'Marcus', 'Titus', 'Maximus', 'Rex', 'Leon', 'Victor', 'Caesar', 'Quintus',
            'Decimus', 'Cassius', 'Lucius', 'Hector', 'Achilles', 'Valerius', 'Cornelius', 'Hadrian', 'Severus', 'Tacitus',
            'Tiberius', 'Trajan', 'Aurelian', 'Caius', 'Corvus', 'Drusus', 'Felix', 'Flavian', 'Gaius', 'Magnus',
            'Octavian', 'Quintilian', 'Vespasian', 'Cassian', 'Valerian', 'Atticus', 'Cicero', 'Crassus', 'Galba', 'Horatius',
            'Lucan', 'Marius', 'Nero', 'Ovid', 'Remus', 'Romulus', 'Rufus', 'Septimus', 'Silus', 'Urban',
            'Iron', 'Steel', 'Granite', 'Flint', 'Anvil', 'Basalt', 'Bastion', 'Bulwark', 'Chisel', 'Garrison',
            'Keystone', 'Legion', 'Marble', 'Mason', 'Obelisk', 'Praetor', 'Quarry', 'Rampart', 'Pillar', 'Turret',
            'Vulcan', 'Warden', 'Centurion', 'Cobble', 'Lintel', 'Mortar', 'Sentinel', 'Crassian', 'Vigil', 'Ashlar',
            'Fortis', 'Ferrus', 'Granius', 'Petram', 'Scutum', 'Aquilo', 'Cordon', 'Cornice', 'Redoubt', 'Wallace',
            'Stone', 'Boulder', 'Crag', 'Ridge', 'Cliff', 'Mace', 'Blade', 'Hammer', 'Spar', 'Wedge',
            'Xanthorn', 'Quarrel', 'Keystonee', 'Voussoir', 'Jambeau',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Zosim', 'Yeomanry', 'Unctor', 'Ossuar', 'Zanthe', 'Oubliette', 'Ingar', 'Yrsa', 'Zorath', 'Yvarr',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Caldrin', 'Torven', 'Bravik', 'Dorsen',
        ],
        Female: [
            'Clove', 'Enobaria', 'Lyme', 'Livia', 'Diana', 'Victoria', 'Aurelia', 'Octavia', 'Portia', 'Juno',
            'Sabina', 'Minerva', 'Vesta', 'Camilla', 'Bellona', 'Drusilla', 'Antonia', 'Valeria', 'Corinna', 'Pax',
            'Agrippina', 'Calpurnia', 'Cornelia', 'Domitia', 'Fortuna', 'Julia', 'Lavinia', 'Lucilla', 'Marcella', 'Nerva',
            'Petra', 'Regula', 'Roma', 'Severa', 'Tullia', 'Verona', 'Volumnia', 'Aquila', 'Aemilia', 'Claudia',
            'Faustina', 'Flavia', 'Helvia', 'Junia', 'Livilla', 'Sabinia', 'Valentia', 'Domitilla', 'Cassia', 'Decima',
            'Hortensia', 'Justina', 'Laelia', 'Lucretia', 'Marciana', 'Maxima', 'Priscilla', 'Quintia', 'Tanaquil', 'Vibia',
            'Citadel', 'Basilica', 'Galena', 'Marmora', 'Quarra', 'Vitrea', 'Terracotta', 'Granita', 'Slatia', 'Basalta',
            'Palatia', 'Sculpta', 'Vigilia', 'Fortitude', 'Limestone', 'Merlona', 'Mortara', 'Arcadia', 'Constance', 'Severina',
            'Sentina', 'Bellira', 'Castella', 'Ferra', 'Gradia', 'Petronia', 'Pillara', 'Rampara', 'Turria', 'Alba',
            'Carrara', 'Gemina', 'Honora', 'Palla', 'Sestia', 'Tremora', 'Valora', 'Vera', 'Vesper', 'Ashlarine',
            'Ashlare', 'Xanthe', 'Quoin', 'Dentil', 'Kerf',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Obdur', 'Zelot', 'Xiphos', 'Ylva', 'Ulfheim', 'Zemin', 'Ogmund', 'Uldric', 'Ostrog', 'Xenos',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Stenra',
        ],
    },
    // District 3 — Technology: circuitry words worn plain, plus Beetee-style
    // phonetic twists and a few inventor-nod real names.
    3: {
        Male: [
            'Beetee', 'Circ', 'Volts', 'Watt', 'Ohm', 'Ampere', 'Diode', 'Relay', 'Servo', 'Solder',
            'Vector', 'Helix', 'Cipher', 'Kernel', 'Cache', 'Binary', 'Quantum', 'Link', 'Node', 'Pascal',
            'Turing', 'Tesler', 'Edison', 'Marconi', 'Faraday', 'Kelvin', 'Hertz', 'Nikola', 'Sturgeon', 'Anders',
            'Byron', 'Cathal', 'Chester', 'Codec', 'Cortex', 'Dalton', 'Ferrite', 'Gilbert', 'Gideon', 'Indro',
            'Ionic', 'Latch', 'Logan', 'Dinesh', 'Micron', 'Modem', 'Ohmar', 'Oswin', 'Pinion', 'Pixel',
            'Plato', 'Quenton', 'Raster', 'Rex', 'Resistor', 'Ripple', 'Router', 'Simeon', 'Sensor', 'Silas',
            'Socket', 'Sparks', 'Stanton', 'Switch', 'Sync', 'Tandem', 'Tessler', 'Toggle', 'Tobin', 'Volney',
            'Wafer', 'Wattson', 'Wyatt', 'Zeno', 'Anten', 'Caspar', 'Chipset', 'Coder', 'Denton', 'Digit',
            'Emmett', 'Filament', 'Gauss', 'Grid', 'Ledger', 'Magnet', 'Neuron', 'Photon', 'Probe', 'Radian',
            'Reboot', 'Signal', 'Solan', 'Static', 'Terminus', 'Vertex', 'Voltaire', 'Weld', 'Widget', 'Rhett',
            'Xenark', 'Kelvinor', 'Quantic', 'Jitteren', 'Verilog',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Ustor', 'Xand', 'Opto', 'Ionn', 'Quibit', 'Zolta', 'Xantic', 'Ondel', 'Uvex', 'Quarz',
        ],
        Female: [
            'Wiress', 'Cyra', 'Nova', 'Beta', 'Echo', 'Ada', 'Dot', 'Logic', 'Spark', 'Meg',
            'Hedy', 'Grace', 'Iris', 'Tessa', 'Gigi', 'Bitsy', 'Pixie', 'Vera', 'Ione', 'Lyla',
            'Alpha', 'Sorina', 'Sigma', 'Zeta', 'Hexa', 'Kilo', 'Nano', 'Octa', 'Quanta', 'Vectra',
            'Ampera', 'Binaria', 'Circuita', 'Codexa', 'Elektra', 'Fibra', 'Luminia', 'Memoria', 'Optica', 'Photonia',
            'Syntara', 'Vectoria', 'Verity', 'Zenobia', 'Databelle', 'Cachette', 'Cyberia', 'Datalyn', 'Encoda', 'Etherea',
            'Logica', 'Microna', 'Nanette', 'Ohmelia', 'Pixa', 'Quantia', 'Wavelet', 'Annelie', 'Antenna', 'Betsy',
            'Cassidy', 'Chiara', 'Cirra', 'Coralie', 'Cora', 'Deidra', 'Ferrin', 'Fila', 'Gretchen', 'Glitch',
            'Indexia', 'Ionie', 'Kira', 'Lattice', 'Ampella', 'Magnetta', 'Matrix', 'Neona', 'Volta', 'Pinna',
            'Polara', 'Query', 'Radia', 'Rhea', 'Reva', 'Schema', 'Senna', 'Servane', 'Simona', 'Solura',
            'Stacia', 'Sinead', 'Tekla', 'Torsion', 'Voltara', 'Wafa', 'Wilda', 'Wren', 'Zetta', 'Solveig',
            'Yottara', 'Xyliane', 'Quantae', 'Nibblet', 'Kibi',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Oscillo', 'Querl', 'Zed', 'Xenna', 'Ulvex', 'Ydris', 'Querin', 'Yttrix', 'Ixel', 'Orbit',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Tivra',
        ],
    },
    // District 4 — Fishing: sea, sail, and shore. Career-polished, so the
    // nouns lean handsome rather than workmanlike.
    4: {
        Male: [
            'Finnick', 'Odair', 'Triton', 'Reef', 'Tide', 'Hook', 'Anchor', 'Finn', 'Neptune', 'Drake',
            'River', 'Gill', 'Marlin', 'Ray', 'Coast', 'Pike', 'Salt', 'Shoal', 'Wharf', 'Ebb',
            'Murray', 'Morgan', 'Dylan', 'Caspian', 'Kai', 'Nereus', 'Delmar', 'Marius', 'Palo', 'Merrick',
            'Beacon', 'Bosun', 'Breaker', 'Compass', 'Current', 'Dorsal', 'Fathom', 'Ferry', 'Keel', 'Mariner',
            'Mast', 'Nautilus', 'Rudder', 'Schooner', 'Skipper', 'Tackle', 'Windward', 'Yawl', 'Brine', 'Buoy',
            'Cleat', 'Dorado', 'Fjord', 'Galleon', 'Gunwale', 'Halyard', 'Jetty', 'Lanyard', 'Quay', 'Sextant',
            'Sturgeon', 'Whaler', 'Undertow', 'Harpoon', 'Pontoon', 'Seaborn', 'Spinnaker', 'Tarpon', 'Chandler', 'Drifter',
            'Albacore', 'Barnacle', 'Cutter', 'Dredge', 'Eddy', 'Gaff', 'Grouper', 'Haddock', 'Herring', 'Kelson',
            'Ketch', 'Kraken', 'Mako', 'Moray', 'Wrasse', 'Oar', 'Pelagius', 'Prow', 'Sailor', 'Scale',
            'Seaton', 'Sinker', 'Skiff', 'Sloop', 'Squall', 'Swells', 'Breakwater', 'Trawl', 'Wake', 'Weir',
            'Xebeck', 'Quarterdeck', 'Yawle', 'Kedge', 'Vang',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Quahog', 'Orca', 'Ulva', 'Zeeman', 'Xandine', 'Zephyral', 'Yolde', 'Yarrowreef', 'Quillara', 'Ostrean',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Coralin', 'Tavil',
        ],
        Female: [
            'Annie', 'Cresta', 'Mags', 'Nerida', 'Trawler', 'Coral', 'Siren', 'Delta', 'Marina', 'Ocean',
            'Brooke', 'Sandy', 'Aqua', 'Naida', 'Tallulah', 'Undine', 'Kelp', 'Lagoon', 'Cove', 'Isla',
            'Cordelia', 'Lorelei', 'Marisol', 'Maren', 'Meredith', 'Nerissa', 'Oceana', 'Thalassa', 'Calypso', 'Anemone',
            'Azura', 'Caspia', 'Cascade', 'Dune', 'Estuary', 'Kelpie', 'Oyster', 'Saline', 'Seaglass', 'Selkie',
            'Sirena', 'Vela', 'Abalone', 'Brinelle', 'Dorada', 'Foam', 'Larimar', 'Meridia', 'Nautica', 'Neptunia',
            'Pelagia', 'Ripple', 'Seaspray', 'Serenity', 'Spindrift', 'Wavelet', 'Bowline', 'Doria', 'Mariel', 'Shell',
            'Sela', 'Coralie', 'Perla', 'Moana', 'Halcyon', 'Amphitrite', 'Bay', 'Marlina', 'Brisa', 'Cariad',
            'Cascabel', 'Clam', 'Cowrie', 'Seiche', 'Darya', 'Drift', 'Finna', 'Galatea', 'Gullwing', 'Harbor',
            'Inlet', 'Jetsam', 'Lira', 'Maritima', 'Minnow', 'Mist', 'Murrel', 'Nixie', 'Reefa', 'Roe',
            'Salara', 'Sardine', 'Scilla', 'Seawyn', 'Shoala', 'Sirenna', 'Tidesse', 'Trilla', 'Wavella', 'Skerry',
            'Xiphia', 'Quayle', 'Yarrowene', 'Nerissae', 'Kelpiee',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Ushant', 'Yare', 'Iselin', 'Ythan', 'Yssel', 'Xebecca', 'Umbriel', 'Ondelle', 'Ulvine', 'Yvelle',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Pelora',
        ],
    },
    // District 5 — Power: current, light, and the grid. Words that hum,
    // plus Foxface-style twists on energy terms.
    5: {
        Male: [
            'Bolt', 'Spark', 'Voltz', 'Cable', 'Ohm', 'Joule', 'Photon', 'Amp', 'Watson', 'Surge',
            'Arc', 'Coil', 'Conduit', 'Dynamo', 'Flux', 'Pylon', 'Reactor', 'Static', 'Terminal', 'Volt',
            'Faraday', 'Tesler', 'Kelvinor', 'Voltaire', 'Wattson', 'Ohmar', 'Julian', 'Anton', 'Sparr', 'Wattford',
            'Anode', 'Cathode', 'Turbine', 'Fusion', 'Fission', 'Halogen', 'Filament', 'Magneto', 'Nucleus', 'Solaris',
            'Thermal', 'Livewire', 'Gigawatt', 'Impulse', 'Polarity', 'Torque', 'Ballard', 'Damon', 'Fedor', 'Garner',
            'Ignitor', 'Lambent', 'Damar', 'Gowan', 'Beam', 'Blaze', 'Charger', 'Circuit', 'Corona', 'Crandall',
            'Dino', 'Edison', 'Electron', 'Emberto', 'Farad', 'Flick', 'Flor', 'Fulton', 'Galvan', 'Gerard',
            'Glen', 'Grid', 'Hydro', 'Ion', 'Kyle', 'Kindle', 'Volmer', 'Lucan', 'Magnar', 'Merritt',
            'Neutron', 'Nimbus', 'Orin', 'Phase', 'Pierce', 'Perrin', 'Radian', 'Rayden', 'Rhys', 'Shock',
            'Solar', 'Steam', 'Strobe', 'Tinder', 'Voltan', 'Whitley', 'Wick', 'Zeb', 'Zephyr', 'Rennick',
            'Xanthol', 'Quench', 'Yokel', 'Kilowatte', 'Vane',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Urd', 'Xelas', 'Xanthin', 'Xerus', 'Yonge', 'Zephyrin', 'Xandor', 'Ohmura', 'Uvolt',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Dynel', 'Arclen', 'Helion',
        ],
        Female: [
            'Electra', 'Nova', 'Astra', 'Flare', 'Aurora', 'Lumina', 'Solara', 'Nebula', 'Helix', 'Voltina',
            'Amperia', 'Amperine', 'Radienne', 'Ionia', 'Joulene', 'Lumen', 'Neon', 'Plasma', 'Pulse', 'Radiance',
            'Solstice', 'Thermia', 'Zenith', 'Voltessa', 'Wyre', 'Fulgora', 'Incandia', 'Luminara', 'Omina', 'Photia',
            'Polara', 'Raditsa', 'Sparkla', 'Voltia', 'Elettra', 'Fila', 'Candela', 'Lucine', 'Stella', 'Soleil',
            'Gia', 'Gleama', 'Glow', 'Halo', 'Kindra', 'Wynne', 'Flora', 'Ignita', 'Hydrona', 'Cascadia',
            'Luxelle', 'Beama', 'Brighte', 'Chispa', 'Cindra', 'Coletta', 'Corra', 'Dyna', 'Edie', 'Emberly',
            'Enya', 'Farah', 'Filippa', 'Flicker', 'Fluorine', 'Fresna', 'Fuchsia', 'Galvana', 'Gamma', 'Glinta',
            'Grier', 'Heliona', 'Ionelle', 'Jolt', 'Kilana', 'Lampyra', 'Luxa', 'Magnetta', 'Merle', 'Fluxine',
            'Ozona', 'Phasia', 'Photona', 'Pietra', 'Reatha', 'Rheona', 'Shimra', 'Sola', 'Sparrow', 'Stasia',
            'Surya', 'Tindra', 'Tabina', 'Vita', 'Voltara', 'Wattie', 'Wilhelmina', 'Zara', 'Zella', 'Retta',
            'Xandra', 'Quiescent', 'Yielda', 'Nernst', 'Kilne',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Zolt', 'Ovolt', 'Oersted', 'Orrey', 'Ionel', 'Ultima', 'Querent', 'Yseult', 'Zinnober',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Lumenna',
        ],
    },
    // District 6 — Transportation: rails, roads, and flight. Grounded nouns
    // and driver-adjacent real names; morphling-grey, not glamorous.
    6: {
        Male: [
            'Axel', 'Gear', 'Diesel', 'Otto', 'Miles', 'Jet', 'Porter', 'Track', 'Rover', 'Gauge',
            'Transit', 'Piston', 'Fender', 'Express', 'Coach', 'Pilot', 'Turbo', 'Brake', 'Wheeler', 'Zephyr',
            'Carter', 'Ferris', 'Kestrel', 'Wells', 'Benz', 'Royce', 'Colby', 'Dray', 'Hitch', 'Wayland',
            'Boyd', 'Cargo', 'Chassis', 'Clutch', 'Convoy', 'Cruiser', 'Depot', 'Freight', 'Hollis', 'Junction',
            'Manfred', 'Motor', 'Pullman', 'Rail', 'Signal', 'Sleeper', 'Sprocket', 'Switch', 'Tandem', 'Throttle',
            'Trestle', 'Camber', 'Chariot', 'Crank', 'Hangar', 'Rotor', 'Skiff', 'Steamer', 'Tarmac', 'Voyager',
            'Overton', 'Bogart', 'Buford', 'Crosby', 'Ferryman', 'Fletcher', 'Gradient', 'Milepost', 'Shane', 'Sidney',
            'Aero', 'Asher', 'Axleton', 'Bearing', 'Cabot', 'Cam', 'Carriage', 'Cody', 'Darrel', 'Drover',
            'Fleet', 'Ford', 'Gantry', 'Glide', 'Hubert', 'Ivor', 'Journey', 'Lorne', 'Mack', 'Navigator',
            'Pace', 'Ramble', 'Rigby', 'Rodrick', 'Rudy', 'Spencer', 'Stratton', 'Tredway', 'Trek', 'Wayne',
            'Xandar', 'Quay', 'Yardarm', 'Klaxonis', 'Vectra',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Unar', 'Onward', 'Ulrich', 'Yancy', 'Xantho', 'Oaklan', 'Ultan', 'Quintin', 'Yarrel',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Railen', 'Tressel',
        ],
        Female: [
            'Lane', 'Piper', 'Stella', 'Velocity', 'Siena', 'Mercedes', 'Cheyenne', 'Carline', 'Aviara', 'Raven',
            'Avia', 'Axela', 'Boulevard', 'Caravan', 'Chrome', 'Cyclone', 'Loretta', 'Jeanette', 'Jetta', 'Mileva',
            'Parkway', 'Skyway', 'Sonic', 'Trolley', 'Voyage', 'Zephyra', 'Aviatrix', 'Colleen', 'Chevron', 'Coupe',
            'Meridian', 'Navia', 'Raelene', 'Runway', 'Tansy', 'Tailwind', 'Whitney', 'Yardley', 'Zephyrine', 'Kestra',
            'Ferrin', 'Wanda', 'Marta', 'Carrie', 'Vela', 'Rhoda', 'Portia', 'Axline', 'Swift', 'Breeze',
            'Amelia', 'Millicent', 'Bessie', 'Aubrey', 'Carmina', 'Clarabelle', 'Shula', 'Costa', 'Compass', 'Della',
            'Axlene', 'Drina', 'Ferelith', 'Fleta', 'Flyte', 'Gantria', 'Glida', 'Harriet', 'Hallie', 'Huberta',
            'Ignitia', 'Jenny', 'Juniper', 'Leonora', 'Lorna', 'Marcia', 'Pacey', 'Petula', 'Pippa', 'Persia',
            'Ramla', 'Rhona', 'Rosetta', 'Ronda', 'Samara', 'Sigrid', 'Susanna', 'Sprig', 'Estelle', 'Strada',
            'Tamsin', 'Terra', 'Tamara', 'Tessa', 'Trixie', 'Tressa', 'Maybell', 'Willa', 'Sloane', 'Caroline',
            'Xeniel', 'Quartermile', 'Yarder', 'Nacellia', 'Kerbside',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Zephyros', 'Yarding', 'Oakum', 'Ulmar', 'Querry', 'Zephyrel', 'Xandry', 'Ostler', 'Urbain',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Axira', 'Trenna',
        ],
    },
    // District 7 — Lumber: trees named straight off the hillside, plus
    // woodcraft words and forest real names.
    7: {
        Male: [
            'Blight', 'Timber', 'Oak', 'Birch', 'Cedar', 'Ash', 'Forrest', 'Sawyer', 'Bark', 'Pine',
            'Spruce', 'Redwood', 'Branch', 'Axe', 'Chip', 'Log', 'Grover', 'Maple', 'Stump', 'Cutter',
            'Alder', 'Balsam', 'Beech', 'Bough', 'Chestnut', 'Cypress', 'Elm', 'Fell', 'Hemlock', 'Hickory',
            'Kindling', 'Knot', 'Larch', 'Mahogany', 'Rosin', 'Sap', 'Splinter', 'Teak', 'Thicket', 'Walnut',
            'Whittle', 'Yew', 'Adze', 'Basswood', 'Bracken', 'Buckthorn', 'Cordwood', 'Fir', 'Greenwood', 'Hardwood',
            'Ironbark', 'Planer', 'Poplar', 'Rafter', 'Ridgepole', 'Shingle', 'Treeline', 'Woodsman', 'Canopy', 'Coppice',
            'Deadwood', 'Feller', 'Kerf', 'Sapwood', 'Skidder', 'Windfall', 'Barkley', 'Boughton', 'Cantwell', 'Sequoyah',
            'Aspen', 'Burl', 'Conifer', 'Dogwood', 'Ebony', 'Bole', 'Hatchet', 'Hew', 'Duramen', 'Crosscut',
            'Linden', 'Lodgepole', 'Moss', 'Mulch', 'Needle', 'Pitch', 'Root', 'Rowan', 'Sylvan', 'Tamarack',
            'Timberlake', 'Torch', 'Trunk', 'Understory', 'Wedge', 'Willows', 'Woody', 'Peavey', 'Yoke', 'Loggan',
            'Xylan', 'Quirtan', 'Yewell', 'Knothole', 'Veneera',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Umbrel', 'Yewen', 'Quickset', 'Ulmus', 'Yarrowood', 'Yewel', 'Undertimber', 'Ordrey', 'Ulmwood',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Aldren', 'Sylven', 'Torrel',
        ],
        Female: [
            'Johanna', 'Knotwood', 'Willow', 'Larchen', 'Alderly', 'Leafwyn', 'Cedarlyn', 'Fern', 'Leaf', 'Cedarly',
            'Sylvenne', 'Ivy', 'Lopper', 'Coniferra', 'Burlwood', 'Sequoia', 'Holly', 'Mapleine', 'Autumn', 'Fellwyn',
            'Juniper', 'Acacia', 'Pinella', 'Arbor', 'Greenbriar', 'Briar', 'Camellia', 'Loggia', 'Dryad', 'Elmira',
            'Grove', 'Hollow', 'Laurel', 'Whipsaw', 'Magnolia', 'Myrtle', 'Olive', 'Kindler', 'Sapling', 'Arborette',
            'Sylva', 'Stavely', 'Ashling', 'Cambium', 'Copse', 'Dendra', 'Evergreen', 'Foliage', 'Glade', 'Greenleaf',
            'Heartwood', 'Larkspur', 'Leaflet', 'Nutmeg', 'Pinecone', 'Resina', 'Rosewood', 'Thistle', 'Woodbine', 'Cedrella',
            'Timbra', 'Aldera', 'Balsa', 'Barkleigh', 'Beechen', 'Boskia', 'Burla', 'Cypressa', 'Elowen', 'Fauna',
            'Ferngale', 'Filbert', 'Firra', 'Forsythia', 'Gladys', 'Hazelene', 'Hemla', 'Hickoree', 'Kindle', 'Knotty',
            'Lignia', 'Mossy', 'Oakleigh', 'Piney', 'Fernwood', 'Sappho', 'Willowen', 'Sprucia', 'Whittlyn', 'Boughetta',
            'Terra', 'Timberly', 'Shakewood', 'Verdance', 'Verna', 'Wilda', 'Woodrow', 'Wrenna', 'Yewberry', 'Zelkova',
            'Xylona', 'Quakena', 'Yewlin', 'Nurselogh', 'Kindlinge',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Zirco', 'Undergrowth', 'Oakhew', 'Ossier', 'Quirin', 'Zephyrwood', 'Quillwood', 'Yarden', 'Iselwood',
        ],
    },
    // District 8 — Textiles: fabric, thread, and the sewing table. Plain
    // working nouns with a few softened twists.
    8: {
        Male: [
            'Wolsey', 'Spindle', 'Bobbin', 'Hem', 'Weaver', 'Stitch', 'Wool', 'Cotton', 'Tailor', 'Loom',
            'Flax', 'Fiber', 'Needle', 'Shear', 'Nylon', 'Corduroy', 'Tweed', 'Seersucker', 'Twine', 'Twill',
            'Bastian', 'Bolt', 'Brocade', 'Buckram', 'Calico', 'Canvas', 'Cambric', 'Dye', 'Fleece', 'Gabardine',
            'Gus', 'Herringbone', 'Jacquard', 'Knit', 'Muslin', 'Pleat', 'Poplin', 'Sateen', 'Selvedge', 'Serge',
            'Spool', 'Thimble', 'Warp', 'Weft', 'Worsted', 'Batik', 'Chambray', 'Crochet', 'Grosgrain', 'Hesse',
            'Jersey', 'Lucas', 'Mendel', 'Quilt', 'Raul', 'Sartor', 'Shuttle', 'Velveteen', 'Carden', 'Dyer',
            'Mercer', 'Trent', 'Fuller', 'Napier', 'Paisley', 'Patch', 'Burlap', 'Cord', 'Darnell', 'Denim',
            'Dimity', 'Felt', 'Frieze', 'Frink', 'Garmon', 'Gauze', 'Hemp', 'Linton', 'Melton', 'Merino',
            'Mohair', 'Oxford', 'Pique', 'Plaid', 'Rayon', 'Orlo', 'Skye', 'Sly', 'Swatch', 'Taylor',
            'Thread', 'Tickell', 'Toile', 'Tuck', 'Vesper', 'Walden', 'Webb', 'Wynn', 'Yarn', 'Ziba',
            'Xandrel', 'Quilte', 'Yarnwelle', 'Kerseye', 'Velvetine',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Zibellin', 'Quiller', 'Yarnell', 'Xestile', 'Ombre', 'Ingram', 'Querda', 'Ysolt', 'Orlon',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Tavilin',
        ],
        Female: [
            'Cecelia', 'Paylor', 'Wilma', 'Nan', 'Taffet', 'Lace', 'Damaris', 'Percale', 'Chiffon', 'Taffeta',
            'Ribbon', 'Gingham', 'Linen', 'Angora', 'Bettina', 'Batiste', 'Cambria', 'Chenille', 'Crepe', 'Damask',
            'Georgette', 'Kersey', 'Lawn', 'Marlena', 'Organza', 'Tulle', 'Voile', 'Weaverly', 'Zibeline', 'Alpaca',
            'Chintz', 'Dobby', 'Faille', 'Flannel', 'Crepeline', 'Hemline', 'Madras', 'Shantung', 'Twillia', 'Calenda',
            'Twyla', 'Tayla', 'Selma', 'Dyanne', 'Bombazine', 'Rosette', 'Frill', 'Tassel', 'Velva', 'Woolsey',
            'Bonnie', 'Cassimere', 'Lacey', 'Nadine', 'Quilla', 'Sarita', 'Stacey', 'Thelma', 'Lomelle', 'Mercy',
            'Aquila', 'Bobbie', 'Braid', 'Brocca', 'Calie', 'Cambrie', 'Carla', 'Cordy', 'Crocetta', 'Darnelle',
            'Denise', 'Paulina', 'Eyelet', 'Twila', 'Gossamer', 'Hettie', 'Jacinta', 'Nita', 'Lindsey', 'Lisle',
            'Marla', 'Mindel', 'Melina', 'Pintuck', 'Plisse', 'Purl', 'Raelyn', 'Satine', 'Selva', 'Sybil',
            'Sheridan', 'Silka', 'Sallie', 'Sacha', 'Tafeta', 'Tessaly', 'Tricot', 'Winnie', 'Wenda', 'Organdy',
            'Xantheya', 'Quiltrey', 'Yarnly', 'Nankeena', 'Kashmir',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Undyed', 'Ottoman', 'Zendale', 'Quinsy', 'Youghal', 'Xanthide', 'Oakweft', 'Ulmine', 'Yardwell',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Wevra', 'Sereva', 'Looma', 'Hemra',
        ],
    },
    // District 9 — Grain: the harvest and the mill. Bread words, field words,
    // and Bram/Ryland-style twists on grain.
    9: {
        Male: [
            'Bannock', 'Wheat', 'Semolina', 'Oat', 'Mill', 'Bran', 'Stalk', 'Kernel', 'Straw', 'Reaper',
            'Field', 'Yeast', 'Sieve', 'Panetta', 'Grain', 'Sower', 'Sheaf', 'Acre', 'Bushel', 'Fallow',
            'Furrow', 'Granary', 'Harrow', 'Husk', 'Miller', 'Plow', 'Quern', 'Rowen', 'Silo', 'Sorghum',
            'Spelt', 'Thresher', 'Tiller', 'Winnow', 'Yield', 'Buckwheat', 'Croft', 'Dougal', 'Einkorn', 'Gleaner',
            'Grist', 'Millstone', 'Sourdough', 'Stook', 'Tares', 'Sifter', 'Binder', 'Hopper', 'Maltster', 'Grainger',
            'Bram', 'Ryland', 'Oatley', 'Wheaton', 'Cropley', 'Milburn', 'Graeme', 'Barrett', 'Sherwin', 'Cornel',
            'Amaranth', 'Awn', 'Baker', 'Bale', 'Bredon', 'Cereus', 'Cornell', 'Crispin', 'Durum', 'Emmer',
            'Farro', 'Flail', 'Florin', 'Glenn', 'Grange', 'Grote', 'Cropsey', 'Hayes', 'Kamut', 'Ned',
            'Leaven', 'Lofton', 'Malton', 'Merle', 'Millard', 'Morrow', 'Paddy', 'Reece', 'Ricker', 'Rylan',
            'Ruskin', 'Scythe', 'Seeley', 'Semyon', 'Sickle', 'Sorley', 'Stubbs', 'Swain', 'Tasso', 'Windrow',
            'Xerophyte', 'Querne', 'Yeoman', 'Kernele', 'Vetch',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Yeld', 'Oryza', 'Undercrop', 'Oakhull', 'Xandel', 'Ostgrain', 'Ultgrain', 'Orsey', 'Umberly',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Barlen', 'Rillan',
        ],
        Female: [
            'Grainne', 'Acacia', 'Bushra', 'Charlene', 'Cerealia', 'Garner', 'Sibella', 'Poppy', 'Ryetta', 'Saffron',
            'Thessaly', 'Ceres', 'Autumn', 'Maize', 'Silonne', 'Sesame', 'Honey', 'Wheatley', 'Sierra', 'Sheafling',
            'Grisel', 'Cornelia', 'Demeter', 'Bolette', 'Farina', 'Goldwyn', 'Hearth', 'Otha', 'Oatlyn', 'Pollen',
            'Quinoa', 'Sile', 'Tillie', 'Wheaten', 'Winona', 'Cornflower', 'Levain', 'Oona', 'Ryebelle', 'Selma',
            'Crumb', 'Theresa', 'Wheatberry', 'Bakewell', 'Chaffron', 'Sunna', 'Marla', 'Freda', 'Granaria', 'Shefa',
            'Bria', 'Millie', 'Gristelle', 'Dawn', 'June', 'Sonelle', 'Blythe', 'Barlow', 'Sowlyn', 'Harrowine',
            'Aoife', 'Bailey', 'Branwen', 'Brea', 'Bree', 'Cerelle', 'Chana', 'Cresta', 'Crocus', 'Dura',
            'Farrah', 'Fleur', 'Gleni', 'Grania', 'Ryeling', 'Gretel', 'Harvestine', 'Haydee', 'Hermione', 'Kasia',
            'Kerna', 'Leanne', 'Lova', 'Maizie', 'Malvina', 'Meala', 'Milla', 'Panna', 'Rae', 'Rikki',
            'Risa', 'Ryanne', 'Scylla', 'Seedra', 'Shea', 'Sicily', 'Sorghina', 'Spelta', 'Swanna', 'Tilly',
            'Xantheia', 'Quinoae', 'Yeasty', 'Nixtamal', 'Kamute',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Zephyrum', 'Zizania', 'Quickgrass', 'Ulmer', 'Querlot', 'Yarrowe', 'Ixil', 'Yestergrain', 'Zolder',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Harlowe', 'Ryeva',
        ],
    },
    // District 10 — Livestock: herd, hide, and range. Ranch-hand real names
    // beside plain barnyard nouns.
    10: {
        Male: [
            'Dalton', 'Shepherd', 'Buck', 'Colt', 'Tanner', 'Drake', 'Ranger', 'Billy', 'Corral', 'Stern',
            'Lasso', 'Lathan', 'Spur', 'Bronc', 'Stallion', 'Calvin', 'Groom', 'Angus', 'Brand', 'Bridle',
            'Bullock', 'Cinch', 'Drover', 'Gelding', 'Hooper', 'Latigo', 'Mustang', 'Paddock', 'Pasture', 'Rawhide',
            'Rodeo', 'Saddler', 'Stirrup', 'Tallow', 'Wrangler', 'Yoke', 'Zebulon', 'Vaquero', 'Barnaby', 'Bellwether',
            'Brahman', 'Byron', 'Farrier', 'Halter', 'Herdsman', 'Longhorn', 'Maverick', 'Oxley', 'Pommel', 'Rancher',
            'Reins', 'Shearling', 'Stockman', 'Weatherby', 'Yeoman', 'Hackamore', 'Penfold', 'Selleck', 'Wendel', 'Cudmore',
            'Wyatt', 'Clint', 'Cody', 'Hank', 'Jesse', 'Levi', 'Rustin', 'Shep', 'Walker', 'Waylon',
            'Briscoe', 'Bellamy', 'Bryson', 'Brander', 'Buller', 'Butch', 'Catlin', 'Chaplin', 'Cole', 'Darby',
            'Dobbin', 'Foster', 'Gaucho', 'Grayson', 'Hurd', 'Hereford', 'Hyde', 'Hitchcock', 'Milton', 'Oxford',
            'Piebald', 'Ramsey', 'Roper', 'Rowdy', 'Shearer', 'Heller', 'Stockton', 'Tate', 'Trowe', 'Woolley',
            'Xerxes', 'Quirtley', 'Yearlingus', 'Kine', 'Vealwell',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Urial', 'Zircol', 'Yarrowmine',
        
            // AUDIT-8 §11.4: short names and the initials the pools are short of.
            'Jeb', 'Hock', 'Nubb', 'Ellum', 'Urnst', 'Yokel', 'Ingle', 'Tupp', 'Kern', 'Branner', 'Jessup', 'Elkin', 'Neatherd', 'Isley', 'Kessel',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Brannoc', 'Herdan', 'Corven', 'Tallowen', 'Avren',
        ],
        Female: [
            'Brandy', 'Lassie', 'Fawn', 'Doe', 'Filly', 'Rodella', 'Sierra', 'Bryanna', 'Meadow', 'Dixie',
            'Bella', 'Daisy', 'Molly', 'Dolly', 'Bessie', 'Buttercup', 'Heffa', 'Mina', 'Angora', 'Fleece',
            'Brindle', 'Cinnamon', 'Creamery', 'Dapple', 'Ewelyn', 'Grazia', 'Holstein', 'Jersey', 'Lariat', 'Corrala',
            'Palomina', 'Prairie', 'Roan', 'Rustica', 'Stamford', 'Willa', 'Yearling', 'Ayrshire', 'Bevina', 'Charolais',
            'Guernsey', 'Herdwick', 'Brandmark', 'Maverine', 'Milkweed', 'Nubian', 'Pastoral', 'Pennyroyal', 'Saanen', 'Shorthorn',
            'Suffolk', 'Woolsey', 'Corrie', 'Felice', 'Weatherly', 'Careen', 'Darlene', 'Hallie', 'Rambouillet', 'Lorna',
            'Annie', 'Belle', 'Birdie', 'Cassidy', 'Georgia', 'Hattie', 'June', 'Loretta', 'Wrenlyn', 'Reba',
            'Bandana', 'Saddleigh', 'Blaze', 'Bonnet', 'Pascale', 'Calida', 'Chaparra', 'Cowslip', 'Crema', 'Dunya',
            'Ewa', 'Fara', 'Gingham', 'Goldie', 'Hedda', 'Heidi', 'Lambie', 'Marabel', 'Milla', 'Mowline',
            'Painter', 'Pinta', 'Rochelle', 'Rhoda', 'Sherrin', 'Drea', 'Spurgeon', 'Tallie', 'Veda', 'Wilona',
            'Xanthia', 'Quirte', 'Yearlynn', 'Nannette', 'Kidling',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Zuccar', 'Ozmun',
        
            // AUDIT-8 §11.4: short names and the initials the pools are short of.
            'Nanser', 'Ewelind', 'Jilla', 'Udra', 'Ivyn', 'Elmet', 'Nella', 'Jenna', 'Urda', 'Ysa', 'Kinelle', 'Renna', 'Edeline', 'Islen',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Marlowe',
        ],
    },
    // District 11 — Agriculture: orchards, row crops, and wildflowers, cut
    // with the biblical-agrarian names of Rue and Thresh's district.
    11: {
        Male: [
            'Thresh', 'Chaff', 'Reap', 'Clay', 'Root', 'Sprout', 'Arbor', 'Seed', 'Taro', 'Jubal',
            'Grove', 'Scythe', 'Till', 'Almond', 'Bramble', 'Cane', 'Citron', 'Furrow', 'Hedge', 'Loam',
            'Mulch', 'Orchard', 'Pecan', 'Rind', 'Sorghum', 'Stalk', 'Tendril', 'Trellis', 'Vine', 'Winnow',
            'Yam', 'Abner', 'Husk', 'Mangold', 'Cider', 'Dill', 'Fennel', 'Gourd', 'Kale', 'Milo',
            'Nectar', 'Okra', 'Tuber', 'Rootstock', 'Plowshare', 'Seedling', 'Scarecrow', 'Fieldhand', 'Pollen', 'Grafton',
            'Amos', 'Boaz', 'Caleb', 'Eli', 'Ezekiel', 'Gideon', 'Hosea', 'Jonah', 'Josiah', 'Levi',
            'Micah', 'Moses', 'Noah', 'Obed', 'Reuben', 'Samson', 'Silas', 'Solomon', 'Tobias', 'Zeke',
            'Barrow', 'Bean', 'Berry', 'Malachi', 'Bud', 'Burr', 'Hiram', 'Cress', 'Damson', 'Fig',
            'Flax', 'Gather', 'Glean', 'Hay', 'Lentil', 'Marrow', 'Melon', 'Peach', 'Pip', 'Pomme',
            'Quince', 'Rake', 'Rush', 'Vetiver', 'Sap', 'Shuck', 'Sow', 'Sugar', 'Ezra', 'Lemuel',
            'Xerant', 'Quincel', 'Yarrowin', 'Kalen', 'Vernalis',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Zebu', 'Undermere', 'Undervein',
        
            // AUDIT-8 §11.4: short names and the initials the pools are short of.
            'Jute', 'Earing', 'Nutley', 'Ishem', 'Urdan', 'Yamm', 'Kenner', 'Bolen', 'Jemmer', 'Emmer', 'Nardel', 'Ilex', 'Ulmar', 'Yarrowell',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Sowen', 'Arliss',
        ],
        Female: [
            'Rue', 'Seeder', 'Blossom', 'Feverfew', 'Holly', 'Lily', 'Rose', 'Petal', 'Flora', 'Rosemary',
            'Lavender', 'Poppy', 'Cherry', 'Cherrily', 'Medlar', 'Clover', 'Olive', 'Marigold', 'Jasmine', 'Marjoram',
            'Apricot', 'Basil', 'Calla', 'Camellia', 'Dahlia', 'Greengage', 'Ginger', 'Hyacinth', 'Loquat', 'Mulberry',
            'Nectarine', 'Persimmon', 'Plum', 'Bramling', 'Sage', 'Sorrel', 'Sunflower', 'Tansy', 'Verbena', 'Zinnia',
            'Yarrow', 'Anise', 'Bergamot', 'Blackberry', 'Cardamom', 'Clementine', 'Cranberry', 'Elderflower', 'Hollyhock', 'Honeydew',
            'Endive', 'Peppermint', 'Pomegranate', 'Rhubarb', 'Tamarind', 'Wisteria', 'Meadowlark', 'Harvestine', 'Orchid', 'Vinelle',
            'Naomi', 'Ruth', 'Abigail', 'Delilah', 'Dinah', 'Esther', 'Hannah', 'Keziah', 'Leah', 'Martha',
            'Miriam', 'Rebekah', 'Selah', 'Tabitha', 'Zilla', 'Ada', 'Beulah', 'Eden', 'Hepzibah', 'Jemima',
            'Pomona', 'Bloom', 'Bounty', 'Bramblerose', 'Cassava', 'Chive', 'Currant', 'Sloe', 'Filbert', 'Gourdine',
            'Chamomile', 'Magnolia', 'Melba', 'Okrah', 'Pearblossom', 'Primula', 'Amaryllis', 'Tulip', 'Vervain', 'Violet',
            'Xylema', 'Quinceta', 'Yarrowyn', 'Nectarina', 'Kumquat',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Ochre', 'Ylsa',
        
            // AUDIT-8 §11.4: short names and the initials the pools are short of.
            'Junell', 'Elaine', 'Nimet', 'Isabeau', 'Ursell', 'Yara', 'Kelda', 'Baylea', 'Jessamy', 'Emmerin', 'Nixen', 'Ivorette', 'Umbelle', 'Yewen', 'Kettel',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Pomelle', 'Sprigga',
        ],
    },
    // District 12 — Coal mining, split by class. Seam names come from wild
    // plants, weather, and the woods (Katniss, Gale, Ash); merchant names come
    // from trades, baking, and soft garden flowers (Peeta, Primrose, Maysilee).
    12: {
        Male: [
            'Gale', 'Haymitch', 'Burdock', 'Ash', 'Corbin', 'Dust', 'Blackwell', 'Brett', 'Coal', 'Ore',
            'Soot', 'Pebble', 'Cinder', 'Tipton', 'Gravel', 'Grit', 'Lantern', 'Lode', 'Mica', 'Pitch',
            'Fielder', 'Tunnel', 'Vein', 'Collier', 'Hewer', 'Nugget', 'Drift', 'Ironstone', 'Carbide', 'Anthracite',
            'Blaine', 'Briar', 'Brooker', 'Buckthorn', 'Chicory', 'Cricket', 'Elk', 'Fenn', 'Fox', 'Hawk',
            'Heron', 'Hollow', 'Hunter', 'Jay', 'Splint', 'Moss', 'Ridge', 'River', 'Sedge', 'Snare',
            'Sumac', 'Tam', 'Teasel', 'Thorn', 'Wilder', 'Wolf', 'Yew', 'Davy', 'Birchen', 'Bracken',
            'Peeta', 'Cage', 'Bannock', 'Barnaby', 'Cobbler', 'Crumb', 'Farley', 'Grady', 'Griffin', 'Lavan',
            'Malt', 'Miller', 'Oren', 'Rounder', 'Rusk', 'Colm', 'Tanner', 'Toby', 'Wick', 'Easton',
            'Aidan', 'Bellamy', 'Canaan', 'Chert', 'Cokey', 'Delvin', 'Galen', 'Hewitt', 'Marl', 'Garrison',
            'Pick', 'Quarrier', 'Seamus', 'Shaft', 'Sledge', 'Smelter', 'Spade', 'Tinder', 'Winch', 'Zinc',
            'Xanthite', 'Quartzon', 'Yieldshaft', 'Kerogen', 'Veinar',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Xolo', 'Orepeak',
        
            // AUDIT-8 §11.4: short names and the initials the pools are short of.
            'Jedd', 'Emberlyn', 'Nixon', 'Inkwell', 'Urnsley', 'Yarrel', 'Kellan', 'Brackin', 'Jorn', 'Eskil', 'Nylen', 'Idris', 'Ulfen', 'Yancey',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Coalyn', 'Cindrel', 'Ashwen', 'Merrow',
        ],
        Female: [
            'Katniss', 'Primrose', 'Maysilee', 'Ember', 'Eglantine', 'Hazel', 'Iris', 'Violet', 'Willow', 'Bramble',
            'Aster', 'Bryony', 'Lanterne', 'Bilberry', 'Heather', 'Ivy', 'Harebell', 'Mistle', 'Mallow', 'Colliera',
            'Nettle', 'Raven', 'Sutton', 'Foxglove', 'Rainelle', 'Thistle', 'Wren', 'Sloe', 'Betony', 'Dove',
            'Fennel', 'Filly', 'Ginger', 'Hyssop', 'Greta', 'Linnet', 'Mim', 'Posy', 'Robin', 'Senna',
            'Sparrow', 'Speedwell', 'Starling', 'Sylvie', 'Colma', 'Vetch', 'Wintergreen', 'Woodruff', 'Bardot', 'Catkin',
            'Madge', 'Delly', 'Ruba', 'Butterly', 'Minette', 'Pansy', 'Peony', 'Rosanna', 'Sweetbriar', 'Tulip',
            'Bakerlee', 'Bunny', 'Candy', 'Clemmie', 'Crumble', 'Dosie', 'Honey', 'Lacey', 'Maybelle', 'Merrilee',
            'Millie', 'Ribbon', 'Sugarly', 'Taffy', 'Thea', 'Antheia', 'Ashlyn', 'Brigitte', 'Collie', 'Cindra',
            'Colette', 'Emberly', 'Flinta', 'Galena', 'Graphite', 'Hearth', 'Lignia', 'Anthea', 'Frostwyn', 'Campion',
            'Seema', 'Shalene', 'Slaine', 'Sootie', 'Tallow', 'Vena', 'Wickie', 'Xanthe', 'Lamplight', 'Fireweed',
            'Xantheline', 'Quarrelle', 'Yieldra', 'Nubbina', 'Kohl',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Yestreen', 'Zephyrion',
        
            // AUDIT-8 §11.4: short names and the initials the pools are short of.
            'Jessa', 'Edana', 'Nyla', 'Isleth', 'Ursela', 'Yarra', 'Kessen', 'Breena', 'Junia', 'Elka', 'Nettleby', 'Ivara', 'Umbra', 'Yewel', 'Kinnow',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Delva',
        ],
    },
    // §BUG-5: these four shipped at 30 entries per gender against the original
    // twelve's 100. With `districtCount` sliding to 16 and the "Expanded Chaos"
    // preset defaulting to 16 districts, the outer territories drew a full
    // reaping from a pool a third the size — visibly the same faces, run after
    // run. They are stocked to 100 now, like everywhere else, and the
    // cross-district duplicates that had one name (Sable) standing in six
    // pools at once are trimmed back to a single home each. `npm run
    // test:names` holds both properties.

    // §1.1: the expanded Games territories. `districtCount` is documented as
    // 2-16 and the setup slider allows it, but 13-16 had no name pool at all —
    // `generator.ts` wrapped them onto `((d - 1) % 12) + 1`, so District 13
    // drew District 1's gemstone-and-finery names, which is exactly the
    // opposite of what a graphite-pit territory should sound like. Each pool
    // below is built from its own industry, the way the original twelve are.

    // District 13 — Graphite and munitions: ordnance, minerals, and the
    // clipped, functional register of a place that measures everything.
    13: {
        Male: [
            'Cordite', 'Bunker', 'Graphite', 'Primer', 'Casing', 'Vector', 'Ordnance', 'Breech', 'Nitre', 'Sulfur',
            'Bore', 'Tracer', 'Fuze', 'Calibre', 'Ramrod', 'Percy', 'Magnus', 'Barrel', 'Charge', 'Ledger',
            'Tallis', 'Corvus', 'Adamant', 'Coriolan', 'Strucker', 'Blast', 'Blenden', 'Hollis', 'Silo', 'Falk',
            'Munro', 'Denton', 'Salvador', 'Cramer', 'Foundry', 'Bittan', 'Culver', 'Slade', 'Rutger', 'Fulmer',
            'Percival', 'Locke', 'Rollo', 'Reuel', 'Enzo', 'Sapper', 'Trench', 'Bunsen', 'Warrick', 'Fisk',
            'Isidore', 'Reardon', 'Halberd', 'Caisson', 'Limber', 'Bandolier', 'Quartus', 'Kelvyn', 'Marek', 'Dalvin',
            'Osric', 'Rurik', 'Gareth', 'Aldous', 'Tobar', 'Emrys', 'Callum', 'Idris', 'Bryn', 'Lorcan',
            'Ewart', 'Rhydian', 'Stannis', 'Corvin', 'Draven', 'Aldric', 'Thaddeus', 'Ellery', 'Verrick', 'Hollan',
            'Stockard', 'Barrick', 'Kegan', 'Torrin', 'Ansel', 'Wendell', 'Pryce', 'Garrick', 'Ormond', 'Gunnar',
            'Roderic', 'Bramwell', 'Fenrick', 'Halvard', 'Torvald', 'Aldwyn', 'Brannock', 'Cadmon', 'Delvin', 'Edric',
            'Xenolithe', 'Quellon', 'Yellowcake', 'Kelvinite', 'Voidwell',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Ovis', 'Yestermine',
        
            // AUDIT-8 §11.4: short names and the initials the pools are short of.
            'Jolt', 'Nimber', 'Ithen', 'Urquet', 'Eandre', 'Kadel', 'Bolgar', 'Jarnen', 'Emmet', 'Nellis', 'Iskander', 'Ulvar', 'Yannick', 'Kirwin', 'Brenner',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Grafen', 'Fulmen', 'Sablit',
        ],
        Female: [
            'Petra', 'Nitya', 'Salvo', 'Cordelia', 'Fusella', 'Mensa', 'Quill', 'Adamanta', 'Emberline', 'Grisel',
            'Powder', 'Calibra', 'Odina', 'Cartridge', 'Corva', 'Sulfia', 'Reckoning', 'Pitcha', 'Avilla', 'Ballista',
            'Muster', 'Argent', 'Volley', 'Lodestone', 'Reserve', 'Cassia', 'Blaise', 'Munira', 'Detta', 'Salvia',
            'Crampa', 'Bastia', 'Fonda', 'Reda', 'Gantry', 'Cherry', 'Bitta', 'Culvia', 'Sladine', 'Rita',
            'Fulvia', 'Persis', 'Locksley', 'Rolla', 'Musta', 'Raquel', 'Bela', 'Enfys', 'Sapphira', 'Trena',
            'Bianca', 'Sila', 'Helma', 'Fiszka', 'Isadora', 'Rhian', 'Halla', 'Cassiel', 'Liberty', 'Bandi',
            'Quartilla', 'Kelva', 'Marika', 'Davina', 'Orsa', 'Rurina', 'Gwenneth', 'Aldis', 'Tobia', 'Emmy',
            'Idra', 'Brynna', 'Lorca', 'Ewa', 'Rhyddwen', 'Stana', 'Corvina', 'Draga', 'Adrica', 'Merrit',
            'Thaddea', 'Ella', 'Cassiana', 'Verrina', 'Holla', 'Stoka', 'Barra', 'Keagan', 'Torin', 'Anselma',
            'Wendla', 'Priya', 'Lucana', 'Garrie', 'Ormsby', 'Gunna', 'Roderika', 'Bramwyn', 'Fenna', 'Halva',
            'Xeniya', 'Quietus', 'Yttriane', 'Nuclide', 'Kilotonne',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Ulmic', 'Ulvaine',
        
            // AUDIT-8 §11.4: short names and the initials the pools are short of.
            'Junaza', 'Nixara', 'Ionelle', 'Urlena', 'Edaline', 'Kaela', 'Briala', 'Jennet', 'Elsanne', 'Nyxen', 'Isarel', 'Ullane', 'Yarana', 'Kessia',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Corda', 'Tessra',
        ],
    },
    // District 14 — Salt and refrigeration: brine, preservation, cold, and the
    // long shelf-life of everything including grudges.
    14: {
        Male: [
            'Derrick', 'Halloran', 'Saltus', 'Marl', 'Frost', 'Rime', 'Curan', 'Barrow', 'Kelvin', 'Pickett',
            'Ossian', 'Winterbourne', 'Cask', 'Hoar', 'Brack', 'Sumner', 'Glaive', 'Cullen', 'Larkin', 'Chilton',
            'Saline', 'Crosby', 'Keeper', 'Cole', 'Halim', 'Freese', 'Pannell', 'Evander', 'Coldwell', 'Stackhouse',
            'Bittern', 'Corwin', 'Iceman', 'Nitram', 'Packard', 'Rackham', 'Saltram', 'Scully', 'Tundras', 'Vault',
            'Whitlaw', 'Boreal', 'Cadogan', 'Drayton', 'Firn', 'Glazier', 'Harding', 'Isham', 'Jarrow', 'Kelder',
            'Lockram', 'Mordant', 'Nivard', 'Ostend', 'Permafrost', 'Quarrel', 'Ravenal', 'Sable', 'Trawley', 'Ullman',
            'Vergil', 'Bitner', 'Calder', 'Dunmore', 'Ellerby', 'Fenwick', 'Garth', 'Holloway', 'Irving', 'Jessup',
            'Kettering', 'Lundy', 'Marbeck', 'Norbury', 'Orrick', 'Prentiss', 'Quillon', 'Rothwell', 'Selwyn', 'Tarrant',
            'Umber', 'Vandry', 'Westmore', 'Zenobar', 'Sarnath', 'Crayle', 'Wold', 'Hesper', 'Corbin', 'Brinkley',
            'Cranmer', 'Dunstan', 'Elsworth', 'Frostmere', 'Gildersleeve', 'Hallam', 'Icewold', 'Jorvik', 'Kelsey', 'Lathrop',
            'Xystus', 'Quadrel', 'Yardstane', 'Kerbwell', 'Verge',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Ungula', 'Ironhew',
        
            // AUDIT-8 §11.4: short names and the initials the pools are short of.
            'Jarrowen', 'Nither', 'Icener', 'Urmond', 'Ellick', 'Kelver', 'Brinlock', 'Jaxen', 'Embrack', 'Nardin', 'Igloe', 'Ulman', 'Yetter', 'Kanewick', 'Brimmer',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Brinel',
        ],
        Female: [
            'Frigga', 'Brinna', 'Rimma', 'Isewell', 'Frosta', 'Marlene', 'Curra', 'Winterly', 'Kelvina', 'Ossa',
            'Lardra', 'Solene', 'Bracca', 'Coldrose', 'Presa', 'Icelin', 'Glacine', 'Salter', 'Hoarfrost', 'Pallas',
            'Crystelle', 'Nivea', 'Chilla', 'Sumwyn', 'Everfrost', 'Panna', 'Keepsake', 'Glacia', 'Cella', 'Bettany',
            'Corina', 'Isolde', 'Nitza', 'Pakita', 'Racha', 'Salma', 'Scarlett', 'Sledwyn', 'Tundra', 'Valta',
            'Whitlow', 'Yardleigh', 'Borealis', 'Cadgewyn', 'Dayton', 'Fern', 'Glaze', 'Harda', 'Isha', 'Jarra',
            'Keldra', 'Lockra', 'Morda', 'Niva', 'Osta', 'Perma', 'Quarra', 'Ravenna', 'Sabella', 'Tara',
            'Ulla', 'Verla', 'Winrow', 'Ashlara', 'Bitta', 'Caldra', 'Dunia', 'Fenna', 'Gartha', 'Hollie',
            'Irvina', 'Jessa', 'Kettle', 'Lunda', 'Marbella', 'Norba', 'Orrie', 'Prentice', 'Quillan', 'Roswell',
            'Selina', 'Taranta', 'Umbra', 'Vanda', 'Westra', 'Yarrow', 'Sarna', 'Crayla', 'Brackenne', 'Wolde',
            'Hesperia', 'Nimba', 'Larcha', 'Corbina', 'Sedge', 'Aldous', 'Brinley', 'Cressida', 'Dunne', 'Elsa',
            'Xanthica', 'Quadra', 'Yardleen', 'Nogging', 'Kerbe',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Xanthate', 'Xanterra',
        
            // AUDIT-8 §11.4: short names and the initials the pools are short of.
            'Julessa', 'Nivelle', 'Islene', 'Ursina', 'Emberine', 'Kilara', 'Brinelle', 'Jessalyn', 'Elrica', 'Nyvelle', 'Ilsen', 'Ulaine', 'Yenna', 'Kessalie',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Rimeve', 'Crysa', 'Gelra',
        ],
    },
    // District 15 — Glassworks: heat, clarity, fragility, and the vocabulary
    // of things that break beautifully.
    15: {
        Male: [
            'Kiln', 'Vitrus', 'Cullet', 'Pane', 'Prism', 'Anneal', 'Silex', 'Bligh', 'Lear', 'Fritz',
            'Crane', 'Obsidian', 'Marver', 'Gaffer', 'Punty', 'Slumper', 'Fusco', 'Facet', 'Shard', 'Crucible',
            'Batchelor', 'Temper', 'Lume', 'Clarion', 'Etch', 'Bevel', 'Flux', 'Glint', 'Refract', 'Borosil',
            'Cristal', 'Devitt', 'Elutan', 'Feldspar', 'Hearthglass', 'Insley', 'Jack', 'Knapp', 'Lampwork', 'Mandrel',
            'Overton', 'Pontil', 'Quench', 'Rondelet', 'Sodor', 'Tessera', 'Underhill', 'Vitrio', 'Wetherby', 'Xystus',
            'Zaffre', 'Ashglass', 'Blowen', 'Dichro', 'Enamel', 'Filigrane', 'Gobind', 'Hyaline', 'Incalmo', 'Jalousie',
            'Kilnwright', 'Latticino', 'Millefior', 'Nipton', 'Opalesce', 'Pyrus', 'Reticello', 'Sagar', 'Threadwell', 'Ultramar',
            'Vetro', 'Whetstone', 'Xanth', 'Zircar', 'Drossel', 'Emberglass', 'Flamework', 'Grozer', 'Halloway', 'Ignis',
            'Kickham', 'Lehrmaster', 'Murrine', 'Nithe', 'Panell', 'Quillon', 'Rakes', 'Sandcast', 'Tinctor', 'Ventwyn',
            'Wheelcut', 'Aventurine', 'Bullseye', 'Chalcedon', 'Craquelure', 'Dalle', 'Emboss', 'Flash', 'Gaffrey', 'Hobnail',
            'Xanthicus', 'Quivera', 'Yielder', 'Kenner', 'Vellum',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Xiphoid', 'Xandric',
        
            // AUDIT-8 §11.4: short names and the initials the pools are short of.
            'Jarric', 'Nimbric', 'Isinglas', 'Urnell', 'Elucid', 'Kilnric', 'Blowick', 'Jaxon', 'Emberic', 'Nardis', 'Igneous', 'Ulmarc', 'Yettrik', 'Kaneal', 'Brittan',
        ],
        Female: [
            'Vitra', 'Prisma', 'Clarity', 'Lumen', 'Silica', 'Annealla', 'Sharda', 'Facette', 'Crazia', 'Collette',
            'Marvella', 'Vitrine', 'Lustra', 'Fritta', 'Obsidia', 'Bevelle', 'Temperance', 'Glinta', 'Cristallo', 'Etcha',
            'Refracta', 'Sulwyn', 'Annelie', 'Sablewyn', 'Fuchsia', 'Bathilde', 'Lehrwyn', 'Opaline', 'Verre', 'Sheen',
            'Borosila', 'Cristalle', 'Devitra', 'Elutra', 'Feldspara', 'Gatha', 'Heartha', 'Insa', 'Jacinta', 'Knappa',
            'Lampa', 'Mandra', 'Nuclea', 'Overa', 'Pontia', 'Quencha', 'Rondella', 'Sodalie', 'Tessaline', 'Undra',
            'Vitria', 'Wetta', 'Xysta', 'Yolande', 'Zaffra', 'Ashlyn', 'Bella', 'Chevrona', 'Dichra', 'Emmeline',
            'Filigree', 'Gabrielle', 'Hyalie', 'Incalma', 'Jalisa', 'Kilna', 'Lattice', 'Millefiore', 'Nipa', 'Opaless',
            'Pyra', 'Retta', 'Sagara', 'Thredwyn', 'Ultra', 'Vetra', 'Whetta', 'Xantha', 'Zircana', 'Drossa',
            'Embra', 'Flama', 'Grozia', 'Hallow', 'Ignisa', 'Jarra', 'Kikina', 'Lehra', 'Murrina', 'Neva',
            'Panella', 'Quilla', 'Raka', 'Sandra', 'Tinctura', 'Venna', 'Wheela', 'Aventura', 'Bulla', 'Chalcedony',
            'Xanthippe', 'Quire', 'Yieldine', 'Nibbe', 'Kalamos',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Quartzel', 'Quarnell',
        
            // AUDIT-8 §11.4: short names and the initials the pools are short of.
            'Julaine', 'Niara', 'Islara', 'Ursana', 'Emberlin', 'Kilana', 'Briala', 'Jessica', 'Elrana', 'Nylana', 'Ilsera', 'Ulara', 'Yennel', 'Kessaline',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Glazelle', 'Anneva', 'Fulgurite', 'Clarune',
        ],
    },
    // District 16 — Deepwater drilling: months offshore, pressure, dark water,
    // and names that sound like equipment because half of them are.
    16: {
        Male: [
            'Derrick', 'Fathom', 'Vaunt', 'Sounder', 'Riser', 'Vane', 'Trawl', 'Bathys', 'Anchor', 'Rig',
            'Drill', 'Marlin', 'Deepwell', 'Gaff', 'Plumb', 'Grapnel', 'Bilge', 'Keel', 'Hawser', 'Cleat',
            'Undertow', 'Barnacle', 'Cordage', 'Windlass', 'Pylon', 'Tiller', 'Nadir', 'Brace', 'Corrie', 'Abyssal',
            'Bollard', 'Chalke', 'Crowther', 'Davit', 'Downing', 'Drayworth', 'Flynn', 'Gimbal', 'Jackson', 'Kelly',
            'Leland', 'Maudlin', 'Outboard', 'Pennant', 'Quayle', 'Reeve', 'Rourke', 'Scarp', 'Semmes', 'Sheave',
            'Slipper', 'Sonny', 'Spurgeon', 'Steever', 'Stockard', 'Swivel', 'Thwart', 'Topham', 'Tourelle', 'Traverse',
            'Trench', 'Buckley', 'Weller', 'Winchell', 'Carew', 'Esmond', 'Fowler', 'Hogan', 'Innes', 'Knotwell',
            'Moorsman', 'Norder', 'Oarlock', 'Pilotman', 'Quaid', 'Rodwell', 'Seaborne', 'Ulster', 'Veerly', 'Waterman',
            'Yardarm', 'Zigmund', 'Brimmer', 'Currach', 'Dowsett', 'Fendall', 'Grimsby', 'Holdfast', 'Amberjack', 'Brailsford',
            'Cardwell', 'Dedric', 'Ebbtide', 'Fairlead', 'Groundswell', 'Hullwright', 'Ironmoor', 'Jibsail', 'Knightshead', 'Longshore',
            'Xericon', 'Quorum', 'Yondar', 'Kestrelin', 'Vantage',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Yester', 'Querhold',
        
            // AUDIT-8 §11.4: short names and the initials the pools are short of.
            'Jibbet', 'Nocken', 'Ironwell', 'Ursten', 'Eolan', 'Kestrel', 'Brantley', 'Jorrik', 'Emmick', 'Nylen', 'Iskell', 'Ulfric', 'Yannis', 'Kadwell', 'Brynmor',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Deepen', 'Pelven', 'Caissin', 'Derricko', 'Thalven',
        ],
        Female: [
            'Phaedra', 'Aurora', 'Nerissa', 'Rosalie', 'Bathsheba', 'Caisson', 'Pontoon', 'Sirena', 'Plumbline', 'Ancora',
            'Trawla', 'Kelpie', 'Hawise', 'Cleta', 'Nadira', 'Shoala', 'Cordelle', 'Bilgen', 'Keelin', 'Marlena',
            'Winda', 'Tilla', 'Brackish', 'Abyssa', 'Benthos', 'Derra', 'Pelagia', 'Graziella', 'Deepa', 'Abyssinia',
            'Balla', 'Bolla', 'Cassona', 'Chalcie', 'Crowna', 'Davida', 'Downa', 'Dawna', 'Flotilla', 'Gimba',
            'Halya', 'Jacqui', 'Kellyn', 'Leda', 'Madeline', 'Nettie', 'Outa', 'Penna', 'Quayla', 'Reeva',
            'Roxanna', 'Scarpa', 'Semira', 'Sheva', 'Slipa', 'Sonora', 'Spinna', 'Steva', 'Stoppa', 'Sibylla',
            'Thwarta', 'Topsy', 'Torella', 'Traversa', 'Trencha', 'Buckla', 'Wella', 'Winifred', 'Yawla', 'Bosuna',
            'Careena', 'Dredgia', 'Escara', 'Gunwale', 'Hoga', 'Inessa', 'Jetsam', 'Nolwenn', 'Lanya', 'Moora',
            'Norda', 'Oarla', 'Pilota', 'Quanda', 'Rowena', 'Seaborn', 'Tacklia', 'Ulsta', 'Waterwyn', 'Yarda',
            'Zigga', 'Brimma', 'Dorothea', 'Fenella', 'Grimsa', 'Holda', 'Amberlee', 'Brails', 'Cardea', 'Dedra',
            'Xerica', 'Quorra', 'Yonda', 'Nimbus', 'Kestrelle',
            // AUDIT-7 §11.6: weighted toward the initials the pools are short of.
            'Oremund', 'Ostrel',
        
            // AUDIT-8 §11.4: short names and the initials the pools are short of.
            'Jarala', 'Nellwyn', 'Isandra', 'Ursalie', 'Eiralyn', 'Kirana', 'Breanne', 'Jennika', 'Elinor', 'Nixara', 'Ilvana', 'Ulanna', 'Yennika', 'Kessandra',
            // AUDIT-9 stage D: vetted candidates from the audit's §11.
            'Rovana',
        ],
    },
};

/**
 * Tributes go by one name.
 *
 * There used to be a per-district surname pool here, and a tribute's `name`
 * was "First Surname". Nothing downstream wanted the second half: the feed,
 * the kill log, the chronicle and the alliance brands all split it back off
 * again, and the one mechanic that read it — two slips out of the same family
 * — recognised kin by string-comparing the suffix. That roll now stands on its
 * own in `generateTributes`, and the pool is gone with the surnames.
 */

/**
 * The third pool: names either tribute of a district can be given.
 *
 * Two problems, one table. The first is that `DISTRICT_NAMES` is keyed by
 * `Gender`, so every themed name in the game had to be sorted into one of two
 * boxes — and a great many district words ("Kernel", "Klaxon", "Verglas") do
 * not belong in either. The second is measurable: the initial letter of a
 * reaped name was wildly lopsided, 356 names starting with S and 5 with X,
 * so a cast of 24 read as the same alphabet every run.
 *
 * Every entry below is authored to an initial the main pools are short of
 * (X, U, Y, Z, Q, I, J, K, N, E, O, V), is exclusive to its district, and is
 * drawn by both genders. `drawName` concatenates it onto the gendered pool,
 * so a tribute is roughly one in three likely to carry one.
 *
 * Same rule as everywhere else: one token, no spaces, no apostrophes, no
 * hyphens. There are no surnames in this game and there is no pool for them.
 */
export const NEUTRAL_NAMES: Record<number, string[]> = {
    // 1 — luxury: the stones and finishes, unsexed.
    1: ['Xanthis', 'Xerine', 'Ulric', 'Umbric', 'Yvain', 'Ysolde', 'Zircole', 'Zenobite',
        'Quillard', 'Quintessa', 'Ivorine', 'Indigo', 'Jetstone', 'Jacinth', 'Kyanite', 'Nacrelle',
        'Niello', 'Emerault', 'Electrum', 'Opalis', 'Ormole', 'Verdite', 'Vermeilla', 'Ziris',
        // AUDIT-9 stage D: vetted candidates from the audit's §11.
        'Orelise', 'Vantelle', 'Zorielle',
    ],
    // 2 — masonry: the parts of a wall and the Romans who ordered it.
    2: ['Xanthus', 'Xantia', 'Ulpius', 'Urbica', 'Yardstone', 'Yokestone', 'Zenon', 'Zosima',
        'Quarrus', 'Quirina', 'Ironsill', 'Iulia', 'Jamb', 'Jointer', 'Keystile', 'Kilnward',
        'Nervia', 'Nummus', 'Egeria', 'Eburnus', 'Obelisca', 'Ovilia', 'Vaultis', 'Vespera',
        // AUDIT-9 stage D: vetted candidates from the audit's §11.
        'Varric',
    ],
    // 3 — technology: the vocabulary of the bench, worn plain.
    3: ['Xenon', 'Xylo', 'Ultrix', 'Uplink', 'Yotta', 'Ytter', 'Zener', 'Zettar',
        'Quantile', 'Qubit', 'Inductor', 'Ingress', 'Jitter', 'Jumper', 'Kelvix', 'Kilobit',
        'Nibble', 'Nodal', 'Echolon', 'Ether', 'Ohmic', 'Optic', 'Vectrix', 'Vidicon',
        // AUDIT-9 stage D: vetted candidates from the audit's §11.
        'Kelbit', 'Nodel', 'Vexel', 'Orbin',
    ],
    // 4 — fishing: hull, tackle and the things in the water.
    4: ['Xebec', 'Xiphias', 'Undertide', 'Urchin', 'Yawler', 'Yardline', 'Zostera', 'Zander',
        'Quayside', 'Quillback', 'Isinglass', 'Islet', 'Jetsail', 'Jibhead', 'Kelpling', 'Keelson',
        'Nereid', 'Netter', 'Ebbrise', 'Estuar', 'Oarline', 'Oysterel', 'Veer', 'Velan',
        // AUDIT-9 stage D: vetted candidates from the audit's §11.
        'Nerune', 'Veymar', 'Ondrel',
    ],
    // 5 — power: the grid's own words.
    5: ['Xanthic', 'Xelia', 'Ultravolt', 'Umbrion', 'Yttrium', 'Ylem', 'Zenithe', 'Zaria',
        'Quenchline', 'Quicksilver', 'Induct', 'Ionis', 'Jouler', 'Junctor', 'Kilowatt', 'Kindlewick',
        'Neonis', 'Nimbral', 'Emberlight', 'Electrine', 'Ohmes', 'Outage', 'Voltaic', 'Vanelight',
        // AUDIT-9 stage D: vetted candidates from the audit's §11.
        'Voltra', 'Edrin',
    ],
    // 6 — transport: rail, road and air.
    6: ['Xing', 'Xela', 'Underpass', 'Upline', 'Yaw', 'Yardrail', 'Zephyrline', 'Zeppelin',
        'Quickline', 'Quadrant', 'Ignition', 'Inbound', 'Jitney', 'Juncture', 'Klaxon', 'Kinetic',
        'Nomad', 'Nacelle', 'Expressway', 'Embark', 'Omnibus', 'Overland', 'Viaduct', 'Voyageur',
        // AUDIT-9 stage D: vetted candidates from the audit's §11.
        'Veylor', 'Orlan',
    ],
    // 7 — lumber: species and the parts of a tree.
    7: ['Xylem', 'Xanthium', 'Underwood', 'Upland', 'Yewbark', 'Yellowpine', 'Zelkow', 'Ziricote',
        'Quercus', 'Quaking', 'Ironwood', 'Ironroot', 'Junipine', 'Jarrah', 'Knotgrain', 'Kindlewood',
        'Notch', 'Nurselog', 'Elmwood', 'Ebonwood', 'Oakenshaw', 'Osier', 'Veneer', 'Verdure',
        // AUDIT-9 stage D: vetted candidates from the audit's §11.
        'Oakenna',
    ],
    // 8 — textiles: cloths, mostly, and the tools that make them.
    8: ['Xylon', 'Xantilly', 'Unspun', 'Underhem', 'Yarnwell', 'Yardage', 'Zibelin', 'Zigzag',
        'Quiltwork', 'Quilling', 'Interlock', 'Inkle', 'Jacquarde', 'Jerseline', 'Kerseymere', 'Kapok',
        'Nankeen', 'Needlepoint', 'Eyelette', 'Ecru', 'Organzine', 'Oilcloth', 'Velouria', 'Voilette',
        // AUDIT-9 stage D: vetted candidates from the audit's §11.
        'Velisse',
    ],
    // 9 — grain: cultivars, the mill, and what comes off the field.
    9: ['Xanthan', 'Xanthea', 'Ullage', 'Upsheaf', 'Yeastling', 'Yielding', 'Zea', 'Zerna',
        'Quernstone', 'Quinoah', 'Iva', 'Ingrain', 'Jowar', 'Jasmara', 'Kamutel', 'Kernelle',
        'Nubbin', 'Norin', 'Einkorne', 'Emmerwheat', 'Oatlin', 'Orzo', 'Vetchling', 'Vernal',
        // AUDIT-9 stage D: vetted candidates from the audit's §11.
        'Kernan', 'Oathel',
    ],
    // 10 — livestock: ranch-hand names, the way the district's pools already lean.
    10: ['Xander', 'Xenia', 'Ute', 'Ullen', 'Yearman', 'Yuma', 'Zeburn', 'Zora',
        'Quirt', 'Quincy', 'Ira', 'Isom', 'Jess', 'Jubel', 'Kip', 'Kade',
        'Nell', 'Nate', 'Elko', 'Enid', 'Orley', 'Oxbow', 'Vance', 'Verl'],
    // 11 — agriculture: orchard, row crop and wildflower.
    11: ['Xeranth', 'Xylia', 'Umbel', 'Underleaf', 'Yampa', 'Yarrowen', 'Zinnial', 'Zephyranth',
        'Quincewood', 'Quickthorn', 'Isatis', 'Ivywood', 'Jonquil', 'Jujube', 'Kudzu', 'Kalewild',
        'Nettlewood', 'Nasturtium', 'Elder', 'Endivia', 'Orchardleigh', 'Okrel', 'Vervaine', 'Vinewood',
        // AUDIT-9 stage D: vetted candidates from the audit's §11.
        'Orlina', 'Virelle',
    ],
    // 12 — coal: Seam weather and merchant-class plainness, both.
    12: ['Xara', 'Xen', 'Underbough', 'Usher', 'Yule', 'Yestin', 'Zev', 'Zola',
        'Quillet', 'Quinn', 'Irisel', 'Ilsa', 'Jorah', 'Junon', 'Kettlewell', 'Kess',
        'Nessa', 'Nyle', 'Ellerwick', 'Eben', 'Orrin', 'Ottilie', 'Vesperine', 'Veritas',
        // AUDIT-9 stage D: vetted candidates from the audit's §11.
        'Emberin',
    ],
    // 13 — graphite and munitions: the mineral index and the ordnance list.
    13: ['Xenolith', 'Xylonite', 'Uranite', 'Ulexite', 'Yttria', 'Ytterbite', 'Zincite', 'Zeolite',
        'Quartzite', 'Quicklime', 'Ilmenite', 'Iridium', 'Jarosite', 'Javelin', 'Kaolin', 'Kiloton',
        'Nitrel', 'Nitron', 'Epsom', 'Erbium', 'Olivine', 'Ordnant', 'Vanadium', 'Vermiculite',
        // AUDIT-9 stage D: vetted candidates from the audit's §11.
        'Nitrin',
    ],
    // 14 — salt and cold: brine, frost, and the far north.
    14: ['Xeric', 'Xanthar', 'Umiak', 'Ural', 'Yukon', 'Yakut', 'Zero', 'Zirka',
        'Quillane', 'Quillock', 'Icicle', 'Isohaline', 'Jotun', 'Jokul', 'Kryos', 'Krill',
        'Nivose', 'Natron', 'Evaporite', 'Everfrore', 'Ozone', 'Osmose', 'Verglas', 'Vinegar',
        // AUDIT-9 stage D: vetted candidates from the audit's §11.
        'Nivren',
    ],
    // 15 — glass: the furnace, the pigment and the finished pane.
    15: ['Xenoglass', 'Xanthel', 'Uviol', 'Urania', 'Yris', 'Yvaine', 'Zaffrine', 'Zirconil',
        'Quarl', 'Quicklight', 'Irid', 'Intaglio', 'Jena', 'Jaspis', 'Kalium', 'Krystal',
        'Nitor', 'Novalux', 'Etchglass', 'Enamelle', 'Opalette', 'Obsidine', 'Vitrelle', 'Vitreous',
        // AUDIT-9 stage D: vetted candidates from the audit's §11.
        'Vitrin',
    ],
    // 16 — deepwater: pressure, the rig, and what lives under it.
    16: ['Xenobath', 'Xanthid', 'Upthrust', 'Umbral', 'Ymir', 'Yonder', 'Zabel', 'Zorin',
        'Quiver', 'Quintal', 'Isobar', 'Ironhold', 'Jackup', 'Jetspar', 'Kellybar', 'Kicker',
        'Nadiren', 'Neap', 'Erebus', 'Ebbline', 'Offshore', 'Ooze', 'Vent', 'Void'],
};
