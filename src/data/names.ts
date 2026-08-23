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
        ],
        Female: [
            'Glimmer', 'Crystal', 'Diamond', 'Opal', 'Sapphire', 'Silk', 'Solitaria', 'Amber', 'Auriel', 'Ruby',
            'Jade', 'Ivory', 'Tiara', 'Shimmer', 'Glitter', 'Ambrette', 'Bijou', 'Sparkle', 'Sequin', 'Gilda',
            'Ornella', 'Beryl', 'Cameo', 'Charm', 'Duchess', 'Marquise', 'Opaline', 'Pendant', 'Peridot', 'Prism',
            'Regalia', 'Tiarelle', 'Velour', 'Zirconia', 'Brilliance', 'Gemma', 'Iolite', 'Lucent', 'Mirabelle', 'Nacre',
            'Ophira', 'Parure', 'Reverie', 'Sable', 'Seraphine', 'Etoile', 'Perle', 'Diadem', 'Eclat', 'Fleurette',
            'Radiance', 'Riviera', 'Coquette', 'Chandelle', 'Lavaliere', 'Alabaster', 'Cachet', 'Carnelia', 'Aurelie', 'Ambrosia',
            'Jewelia', 'Lustra', 'Facette', 'Opalescence', 'Topaza', 'Vitrine', 'Silhouette', 'Damaris', 'Goldie', 'Gilded',
            'Emeraude', 'Celestine', 'Adorna', 'Bellisima', 'Cascabel', 'Delaine', 'Filigree', 'Garnetta', 'Lumielle', 'Marvella',
            'Ondine', 'Pashmina', 'Preciosa', 'Sabelle', 'Trove', 'Vanity', 'Verity', 'Chiffonne', 'Dazzle', 'Elegance',
            'Jacinthe', 'Bijoux', 'Coronet', 'Estelle', 'Gloriana', 'Lucia', 'Odalys', 'Priscilla', 'Solange', 'Valencia',
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
        ],
        Female: [
            'Clove', 'Enobaria', 'Lyme', 'Livia', 'Diana', 'Victoria', 'Aurelia', 'Octavia', 'Portia', 'Juno',
            'Sabina', 'Minerva', 'Vesta', 'Camilla', 'Bellona', 'Drusilla', 'Antonia', 'Valeria', 'Corinna', 'Pax',
            'Agrippina', 'Calpurnia', 'Cornelia', 'Domitia', 'Fortuna', 'Julia', 'Lavinia', 'Lucilla', 'Marcella', 'Nerva',
            'Petra', 'Regula', 'Roma', 'Severa', 'Tullia', 'Verona', 'Volumnia', 'Aquila', 'Aemilia', 'Claudia',
            'Faustina', 'Flavia', 'Helvia', 'Junia', 'Livilla', 'Sabinia', 'Valentia', 'Domitilla', 'Cassia', 'Decima',
            'Hortensia', 'Justina', 'Laelia', 'Lucretia', 'Marciana', 'Maxima', 'Priscilla', 'Quintia', 'Tanaquil', 'Vibia',
            'Citadel', 'Basilica', 'Galena', 'Marmora', 'Obsidia', 'Quarra', 'Vitrea', 'Terracotta', 'Granita', 'Slatia',
            'Basalta', 'Palatia', 'Sculpta', 'Vigilia', 'Fortitude', 'Limestone', 'Merlona', 'Mortara', 'Arcadia', 'Constance',
            'Severina', 'Sentina', 'Bellira', 'Castella', 'Ferra', 'Gradia', 'Petronia', 'Pillara', 'Rampara', 'Turria',
            'Alba', 'Carrara', 'Gemina', 'Honora', 'Palla', 'Sestia', 'Tremora', 'Valora', 'Vera', 'Vesper',
        ],
    },
    // District 3 — Technology: circuitry words worn plain, plus Beetee-style
    // phonetic twists and a few inventor-nod real names.
    3: {
        Male: [
            'Beetee', 'Circ', 'Volts', 'Watt', 'Ohm', 'Ampere', 'Diode', 'Relay', 'Servo', 'Solder',
            'Vector', 'Helix', 'Cipher', 'Kernel', 'Cache', 'Binary', 'Quantum', 'Link', 'Node', 'Fuse',
            'Pascal', 'Turing', 'Tesler', 'Edison', 'Marconi', 'Faraday', 'Kelvin', 'Hertz', 'Nikola', 'Sturgeon',
            'Anod', 'Bytel', 'Cathon', 'Chipp', 'Codec', 'Cortex', 'Datton', 'Ferrite', 'Gidget', 'Gizmond',
            'Induc', 'Ionic', 'Latch', 'Logus', 'Dynode', 'Micron', 'Modem', 'Ohmes', 'Oscill', 'Pinion',
            'Pixel', 'Plasm', 'Quartzon', 'Raster', 'Rectus', 'Resistor', 'Ripple', 'Router', 'Semicon', 'Sensor',
            'Silicus', 'Socket', 'Sparks', 'Statix', 'Switch', 'Sync', 'Tandem', 'Teslin', 'Toggle', 'Transitor',
            'Voltan', 'Wafer', 'Wattson', 'Wyre', 'Zeno', 'Anten', 'Capaz', 'Chipset', 'Coder', 'Daton',
            'Digit', 'Emitt', 'Filament', 'Gauss', 'Grid', 'Ledger', 'Magnet', 'Neuron', 'Photon', 'Probe',
            'Radian', 'Reboot', 'Signal', 'Solen', 'Static', 'Terminus', 'Vertex', 'Voltaire', 'Weld', 'Widget',
        ],
        Female: [
            'Wiress', 'Cyra', 'Nova', 'Beta', 'Echo', 'Ada', 'Dot', 'Logic', 'Spark', 'Meg',
            'Hedy', 'Grace', 'Iris', 'Tessa', 'Gigi', 'Bitsy', 'Pixie', 'Vera', 'Ione', 'Lyla',
            'Alpha', 'Solderine', 'Sigma', 'Zeta', 'Hexa', 'Kilo', 'Nano', 'Octa', 'Quanta', 'Vectra',
            'Ampera', 'Binaria', 'Circuita', 'Codexa', 'Elektra', 'Fibra', 'Luminia', 'Memoria', 'Optica', 'Photonia',
            'Prisma', 'Syntara', 'Vectoria', 'Verity', 'Zenobia', 'Databelle', 'Cachette', 'Cyberia', 'Datalyn', 'Encoda',
            'Etherea', 'Logica', 'Microna', 'Nanette', 'Ohmelia', 'Pixella', 'Quantia', 'Wavelet', 'Anneal', 'Antenna',
            'Bytelle', 'Capacita', 'Chippa', 'Cirra', 'Coila', 'Cursora', 'Diodra', 'Ferrita', 'Filamenta', 'Gadgetta',
            'Glitch', 'Indexia', 'Ionelle', 'Kilowatta', 'Lattice', 'Ampella', 'Magnetta', 'Matrix', 'Neona', 'Voltique',
            'Pinna', 'Polara', 'Query', 'Radia', 'Relaya', 'Resista', 'Schema', 'Sensora', 'Servella', 'Socketta',
            'Solura', 'Statica', 'Synca', 'Tekla', 'Torsion', 'Voltara', 'Wafera', 'Weldia', 'Wyrelle', 'Zetta',
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
        ],
        Female: [
            'Annie', 'Cresta', 'Mags', 'Nerida', 'Pearl', 'Coral', 'Siren', 'Delta', 'Marina', 'Ocean',
            'Brooke', 'Sandy', 'Aqua', 'Naida', 'Tallulah', 'Undine', 'Kelp', 'Lagoon', 'Cove', 'Isla',
            'Cordelia', 'Lorelei', 'Marisol', 'Maren', 'Meredith', 'Mira', 'Nerissa', 'Oceana', 'Thalassa', 'Calypso',
            'Anemone', 'Azura', 'Caspia', 'Cascade', 'Dune', 'Estuary', 'Kelpie', 'Oyster', 'Saline', 'Seaglass',
            'Selkie', 'Sirena', 'Vela', 'Abalone', 'Brinelle', 'Dorada', 'Foam', 'Larimar', 'Meridia', 'Nautica',
            'Neptunia', 'Pelagia', 'Ripple', 'Seaspray', 'Serenity', 'Spindrift', 'Wavelet', 'Bowline', 'Doria', 'Mariel',
            'Shell', 'Sela', 'Coralie', 'Perla', 'Moana', 'Halcyon', 'Amphitrite', 'Bay', 'Marlina', 'Brisa',
            'Cariad', 'Cascabel', 'Clam', 'Cowrie', 'Current', 'Darya', 'Drift', 'Finna', 'Galatea', 'Gullwing',
            'Harbor', 'Inlet', 'Jetsam', 'Lira', 'Maritima', 'Minnow', 'Mist', 'Murrel', 'Nixie', 'Reefa',
            'Roe', 'Salara', 'Sardine', 'Scilla', 'Seawyn', 'Shoala', 'Sirenna', 'Tidesse', 'Trilla', 'Wavella',
        ],
    },
    // District 5 — Power: current, light, and the grid. Words that hum,
    // plus Foxface-style twists on energy terms.
    5: {
        Male: [
            'Bolt', 'Spark', 'Voltz', 'Cable', 'Ohm', 'Joule', 'Photon', 'Amp', 'Watts', 'Surge',
            'Arc', 'Coil', 'Conduit', 'Dynamo', 'Flux', 'Pylon', 'Reactor', 'Static', 'Terminal', 'Volt',
            'Faraday', 'Tesler', 'Kelvinor', 'Voltaire', 'Wattson', 'Ohmar', 'Joules', 'Ampton', 'Sparrow', 'Wattford',
            'Anode', 'Cathode', 'Turbine', 'Fusion', 'Fission', 'Halogen', 'Filament', 'Magneto', 'Nucleus', 'Solaris',
            'Thermal', 'Livewire', 'Gigawatt', 'Impulse', 'Polarity', 'Torque', 'Ballast', 'Damper', 'Feeder', 'Governor',
            'Ignitor', 'Lambent', 'Dimmer', 'Glowen', 'Beam', 'Blaze', 'Charger', 'Circuit', 'Corona', 'Crackle',
            'Dyno', 'Edison', 'Electron', 'Emberon', 'Farad', 'Flick', 'Fluor', 'Fuller', 'Fuse', 'Galvan',
            'Generatt', 'Glower', 'Grid', 'Hydro', 'Ion', 'Kilo', 'Kindle', 'Voltmer', 'Luxon', 'Megger',
            'Meter', 'Neutron', 'Nimbus', 'Outlet', 'Phase', 'Piezo', 'Plug', 'Radian', 'Rayton', 'Rheo',
            'Shock', 'Solar', 'Steam', 'Strobe', 'Tinder', 'Voltan', 'Wattley', 'Wick', 'Zapp', 'Zephyr',
        ],
        Female: [
            'Electra', 'Nova', 'Astra', 'Flare', 'Aurora', 'Lumina', 'Solara', 'Nebula', 'Helix', 'Voltina',
            'Amperia', 'Corona', 'Radienne', 'Ionia', 'Joulene', 'Lumen', 'Neon', 'Plasma', 'Pulse', 'Radiance',
            'Solstice', 'Thermia', 'Zenith', 'Voltessa', 'Wyre', 'Fulgora', 'Incandia', 'Luminara', 'Ohmina', 'Photia',
            'Polara', 'Radiata', 'Sparkla', 'Voltia', 'Elettra', 'Fila', 'Candela', 'Lucine', 'Stella', 'Soleil',
            'Gigawatta', 'Gleama', 'Glow', 'Halo', 'Kindra', 'Wattine', 'Fluxelle', 'Ignita', 'Hydrona', 'Cascadia',
            'Luxelle', 'Beama', 'Brighte', 'Chispa', 'Cindra', 'Coilette', 'Currenta', 'Dyna', 'Edisa', 'Emberly',
            'Energa', 'Farada', 'Filamenta', 'Flicker', 'Fluorine', 'Fresna', 'Fusia', 'Galvana', 'Gamma', 'Glinta',
            'Gridelle', 'Heliona', 'Ionelle', 'Jolt', 'Kilowatts', 'Lampyra', 'Luxa', 'Magnetta', 'Meterly', 'Fluxine',
            'Ozona', 'Phasia', 'Photona', 'Piezetta', 'Prisma', 'Reactra', 'Rheona', 'Shimmerwatt', 'Sola', 'Sparkes',
            'Statica', 'Surga', 'Tindra', 'Turbina', 'Vatta', 'Voltara', 'Wattsy', 'Wickella', 'Zapria', 'Zella',
        ],
    },
    // District 6 — Transportation: rails, roads, and flight. Grounded nouns
    // and driver-adjacent real names; morphling-grey, not glamorous.
    6: {
        Male: [
            'Axel', 'Gear', 'Diesel', 'Otto', 'Miles', 'Jet', 'Porter', 'Track', 'Rover', 'Gauge',
            'Transit', 'Piston', 'Fender', 'Express', 'Coach', 'Pilot', 'Turbo', 'Brake', 'Wheeler', 'Zephyr',
            'Carter', 'Ferris', 'Kestrel', 'Wells', 'Benz', 'Royce', 'Colby', 'Dray', 'Hitch', 'Wayland',
            'Boxcar', 'Cargo', 'Chassis', 'Clutch', 'Convoy', 'Cruiser', 'Depot', 'Freight', 'Hauler', 'Junction',
            'Manifold', 'Motor', 'Pullman', 'Rail', 'Signal', 'Sleeper', 'Sprocket', 'Switch', 'Tandem', 'Throttle',
            'Trestle', 'Camber', 'Chariot', 'Crank', 'Hangar', 'Rotor', 'Skiff', 'Steamer', 'Tarmac', 'Voyager',
            'Overpass', 'Bogie', 'Buffer', 'Crossing', 'Ferryman', 'Flatbed', 'Gradient', 'Milepost', 'Shunter', 'Sidecar',
            'Aero', 'Ashfalt', 'Axleton', 'Bearing', 'Caboose', 'Cam', 'Carriage', 'Cog', 'Derail', 'Drover',
            'Fleet', 'Ford', 'Gantry', 'Glide', 'Hub', 'Idler', 'Journey', 'Lorry', 'Mach', 'Navigator',
            'Pace', 'Ramble', 'Rig', 'Roader', 'Rudd', 'Spoke', 'Strut', 'Tread', 'Trek', 'Wain',
        ],
        Female: [
            'Lane', 'Piper', 'Stella', 'Velocity', 'Siena', 'Mercedes', 'Cheyenne', 'Carline', 'Aviara', 'Raven',
            'Avia', 'Axela', 'Boulevard', 'Caravan', 'Chrome', 'Cyclone', 'Motoretta', 'Gearette', 'Jetta', 'Mileva',
            'Parkway', 'Skyway', 'Sonic', 'Trolley', 'Voyage', 'Zephyra', 'Aviatrix', 'Carriage', 'Chevron', 'Coupe',
            'Meridian', 'Navia', 'Railene', 'Runway', 'Transita', 'Tailwind', 'Wheelhouse', 'Yardley', 'Zephyrine', 'Kestra',
            'Journey', 'Wanda', 'Marta', 'Carrie', 'Vela', 'Rhoda', 'Portia', 'Axline', 'Swift', 'Breeze',
            'Amelia', 'Milesta', 'Bessie', 'Cabrey', 'Camina', 'Charabelle', 'Shuttla', 'Coasta', 'Compass', 'Derailla',
            'Dray', 'Driva', 'Ferrilyn', 'Fleeta', 'Flyte', 'Gantria', 'Glida', 'Harriet', 'Haulie', 'Hubbell',
            'Ignitia', 'Jitney', 'Junctia', 'Locomora', 'Lorrie', 'Macha', 'Mira', 'Pacey', 'Pedala', 'Pinion',
            'Pistonia', 'Ramla', 'Roada', 'Rotora', 'Rounda', 'Semora', 'Signa', 'Spoketta', 'Sprinta', 'Steama',
            'Strada', 'Tarma', 'Terminal', 'Tramway', 'Treadle', 'Trekka', 'Trestla', 'Vesta', 'Waybill', 'Wheela',
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
        ],
        Female: [
            'Johanna', 'Pine', 'Willow', 'Birch', 'Maple', 'Leafwyn', 'Cedarlyn', 'Fern', 'Leaf', 'Branch',
            'Sylvenne', 'Ivy', 'Sylvan', 'Coniferra', 'Aspen', 'Sequoia', 'Holly', 'Mapleine', 'Autumn', 'Fellwyn',
            'Juniper', 'Acacia', 'Pinella', 'Arbor', 'Greenbriar', 'Briar', 'Camellia', 'Canopy', 'Dryad', 'Elmira',
            'Grove', 'Hollow', 'Laurel', 'Linden', 'Magnolia', 'Myrtle', 'Olive', 'Rowan', 'Sapling', 'Arborette',
            'Sylva', 'Tamarack', 'Ashling', 'Cambium', 'Copse', 'Dendra', 'Evergreen', 'Foliage', 'Glade', 'Greenleaf',
            'Heartwood', 'Larkspur', 'Leaflet', 'Nutmeg', 'Pinecone', 'Resina', 'Rosewood', 'Thistle', 'Woodbine', 'Cedrella',
            'Timbra', 'Aldera', 'Balsa', 'Barkleigh', 'Beechen', 'Boskia', 'Burla', 'Cypressa', 'Elowen', 'Fauna',
            'Ferngale', 'Filbert', 'Firra', 'Forsythia', 'Gladys', 'Hazelene', 'Hemla', 'Hickoree', 'Kindle', 'Knotty',
            'Lignia', 'Mossy', 'Oakleigh', 'Piney', 'Poplar', 'Sappho', 'Sawyer', 'Sprucia', 'Whittlyn', 'Boughetta',
            'Terra', 'Timberly', 'Understory', 'Verdance', 'Verna', 'Wilda', 'Woodrow', 'Wrenna', 'Yewberry', 'Zelkova',
        ],
    },
    // District 8 — Textiles: fabric, thread, and the sewing table. Plain
    // working nouns with a few softened twists.
    8: {
        Male: [
            'Woof', 'Spindle', 'Bobbin', 'Hem', 'Weaver', 'Stitch', 'Wool', 'Cotton', 'Tailor', 'Loom',
            'Flax', 'Fiber', 'Needle', 'Shear', 'Nylon', 'Corduroy', 'Tweed', 'Seersucker', 'Twine', 'Twill',
            'Baste', 'Bolt', 'Brocade', 'Buckram', 'Calico', 'Canvas', 'Cambric', 'Dye', 'Fleece', 'Gabardine',
            'Gusset', 'Herringbone', 'Jacquard', 'Knit', 'Muslin', 'Pleat', 'Poplin', 'Sateen', 'Selvedge', 'Serge',
            'Spool', 'Thimble', 'Warp', 'Weft', 'Worsted', 'Batik', 'Chambray', 'Crochet', 'Grosgrain', 'Hessian',
            'Jersey', 'Loomis', 'Mender', 'Quilt', 'Ravel', 'Sartor', 'Shuttle', 'Velveteen', 'Carder', 'Dyer',
            'Mercer', 'Tenter', 'Fuller', 'Napp', 'Paisley', 'Patch', 'Burlap', 'Cord', 'Darner', 'Denim',
            'Dimity', 'Felt', 'Frieze', 'Fringe', 'Garment', 'Gauze', 'Hemp', 'Lint', 'Melton', 'Merino',
            'Mohair', 'Oxford', 'Pique', 'Plaid', 'Rayon', 'Seam', 'Skein', 'Sley', 'Swatch', 'Taylor',
            'Thread', 'Ticking', 'Toile', 'Tucker', 'Vestman', 'Wale', 'Webb', 'Winder', 'Yarn', 'Zibel',
        ],
        Female: [
            'Cecelia', 'Paylor', 'Satin', 'Velvet', 'Thread', 'Lace', 'Paisley', 'Percale', 'Chiffon', 'Taffeta',
            'Ribbon', 'Gingham', 'Linen', 'Angora', 'Felt', 'Batiste', 'Cambria', 'Chenille', 'Crepe', 'Damask',
            'Georgette', 'Kersey', 'Lawn', 'Merino', 'Organza', 'Tulle', 'Voile', 'Weaverly', 'Zibeline', 'Alpaca',
            'Chintz', 'Dobby', 'Faille', 'Flannel', 'Gauze', 'Hemline', 'Madras', 'Shantung', 'Twillia', 'Calenda',
            'Twyla', 'Tayla', 'Seamly', 'Dyanne', 'Bombazine', 'Rosette', 'Frill', 'Tassel', 'Velva', 'Woolsey',
            'Bobbinelle', 'Cashmira', 'Lacewyn', 'Needlina', 'Quilta', 'Sarita', 'Stitchery', 'Threadleigh', 'Loomelle', 'Mercerine',
            'Appliqua', 'Battina', 'Braid', 'Brocada', 'Calica', 'Cambrelle', 'Carda', 'Corda', 'Crocheta', 'Darnelle',
            'Denima', 'Dimity', 'Eyelet', 'Fringe', 'Gossamer', 'Hemmy', 'Jacquarda', 'Knitta', 'Lindsey', 'Lisle',
            'Marla', 'Mendella', 'Muslinne', 'Pintuck', 'Plisse', 'Purl', 'Raveline', 'Sateena', 'Selvage', 'Sewell',
            'Shears', 'Silka', 'Spoolie', 'Swatcha', 'Tafeta', 'Textilia', 'Tricot', 'Weftly', 'Wefta', 'Organdy',
        ],
    },
    // District 9 — Grain: the harvest and the mill. Bread words, field words,
    // and Bram/Ryland-style twists on grain.
    9: {
        Male: [
            'Rye', 'Wheat', 'Barley', 'Oat', 'Mill', 'Bran', 'Stalk', 'Kernel', 'Straw', 'Reaper',
            'Field', 'Yeast', 'Sieve', 'Chaff', 'Grain', 'Sower', 'Sheaf', 'Acre', 'Bushel', 'Fallow',
            'Furrow', 'Granary', 'Harrow', 'Husk', 'Miller', 'Plow', 'Quern', 'Rowen', 'Silo', 'Sorghum',
            'Spelt', 'Thresher', 'Tiller', 'Winnow', 'Yield', 'Buckwheat', 'Croft', 'Dough', 'Einkorn', 'Gleaner',
            'Grist', 'Millstone', 'Sourdough', 'Stook', 'Tares', 'Sifter', 'Binder', 'Hopper', 'Maltster', 'Grainger',
            'Bram', 'Ryland', 'Oatley', 'Wheaton', 'Cropley', 'Milburn', 'Graeme', 'Barrett', 'Sherwin', 'Cornel',
            'Amaranth', 'Awn', 'Baker', 'Bale', 'Bread', 'Cereus', 'Corn', 'Crust', 'Durum', 'Emmer',
            'Farro', 'Flail', 'Flour', 'Gluten', 'Grange', 'Groat', 'Cropper', 'Hay', 'Kamut', 'Knead',
            'Leaven', 'Loaf', 'Malt', 'Meal', 'Millet', 'Mow', 'Paddy', 'Reap', 'Rick', 'Rise',
            'Rusk', 'Scythe', 'Seed', 'Semolino', 'Sickle', 'Sorgo', 'Stubble', 'Swath', 'Tassel', 'Windrow',
        ],
        Female: [
            'Grainne', 'Acrelyn', 'Bushelle', 'Chaffina', 'Cerealia', 'Harvest', 'Siftella', 'Poppy', 'Ryetta', 'Saffron',
            'Barley', 'Ceres', 'Autumn', 'Maize', 'Silonne', 'Sesame', 'Honey', 'Wheatley', 'Sierra', 'Millet',
            'Amaranth', 'Cornsilk', 'Demeter', 'Emmer', 'Farina', 'Golden', 'Hearth', 'Kamut', 'Oatlyn', 'Pollen',
            'Quinoa', 'Silage', 'Tillie', 'Wheaten', 'Winnowa', 'Cornflower', 'Levain', 'Oatmeal', 'Ryebelle', 'Semolia',
            'Stubble', 'Thresha', 'Wheatberry', 'Windrow', 'Chaffron', 'Sunna', 'Marla', 'Fielda', 'Granaria', 'Sheafa',
            'Bria', 'Milletta', 'Gristelle', 'Dawn', 'June', 'Sconelle', 'Blythe', 'Barlette', 'Sowlyn', 'Harrowine',
            'Awna', 'Baila', 'Branwen', 'Breadie', 'Brioche', 'Cerelle', 'Challah', 'Cresta', 'Crocus', 'Durra',
            'Farrina', 'Flourette', 'Gleana', 'Graina', 'Grange', 'Grista', 'Harvestine', 'Haydee', 'Hominy', 'Kasha',
            'Kerna', 'Leavenne', 'Loafa', 'Maizie', 'Malting', 'Mealla', 'Milla', 'Panna', 'Reaplyn', 'Ricotta',
            'Risa', 'Ryanne', 'Scylla', 'Seedra', 'Sheavia', 'Sicklyn', 'Sorghina', 'Speltie', 'Swatha', 'Tilling',
        ],
    },
    // District 10 — Livestock: herd, hide, and range. Ranch-hand real names
    // beside plain barnyard nouns.
    10: {
        Male: [
            'Dalton', 'Shepherd', 'Buck', 'Colt', 'Tanner', 'Drake', 'Ranger', 'Billy', 'Corral', 'Steer',
            'Lasso', 'Leather', 'Spur', 'Bronc', 'Stallion', 'Calf', 'Groom', 'Angus', 'Brand', 'Bridle',
            'Bullock', 'Cinch', 'Drover', 'Gelding', 'Hoof', 'Latigo', 'Mustang', 'Paddock', 'Pasture', 'Rawhide',
            'Rodeo', 'Saddler', 'Stirrup', 'Tallow', 'Wrangler', 'Yoke', 'Zebulon', 'Vaquero', 'Barnaby', 'Bellwether',
            'Brahman', 'Byre', 'Farrier', 'Halter', 'Herdsman', 'Longhorn', 'Maverick', 'Oxley', 'Pommel', 'Rancher',
            'Reins', 'Shearling', 'Stockman', 'Wether', 'Yeoman', 'Hackamore', 'Penfold', 'Saltlick', 'Weanling', 'Cudworth',
            'Wyatt', 'Clint', 'Cody', 'Hank', 'Jesse', 'Levi', 'Rustin', 'Shep', 'Walker', 'Waylon',
            'Brisket', 'Bellow', 'Bison', 'Brander', 'Bull', 'Butcher', 'Cattle', 'Chap', 'Cowl', 'Dairy',
            'Dobbin', 'Fodder', 'Gaucho', 'Graze', 'Herd', 'Hereford', 'Hide', 'Hitch', 'Mutton', 'Ox',
            'Piebald', 'Ram', 'Roper', 'Rowdy', 'Shear', 'Heeler', 'Stock', 'Tether', 'Trough', 'Wool',
        ],
        Female: [
            'Brandy', 'Lassie', 'Fawn', 'Doe', 'Filly', 'Rodella', 'Sierra', 'Bovanna', 'Meadow', 'Dixie',
            'Bella', 'Daisy', 'Molly', 'Dolly', 'Bessie', 'Buttercup', 'Heifer', 'Mane', 'Angora', 'Bridle',
            'Brindle', 'Cinnamon', 'Creamery', 'Dapple', 'Ewelyn', 'Grazia', 'Holstein', 'Jersey', 'Lariat', 'Corrala',
            'Palomina', 'Prairie', 'Roan', 'Rustica', 'Stampede', 'Willa', 'Yearling', 'Ayrshire', 'Bovina', 'Charolais',
            'Guernsey', 'Herdwick', 'Hereford', 'Maverine', 'Milkweed', 'Nubian', 'Pastoral', 'Pennyroyal', 'Saanen', 'Shorthorn',
            'Suffolk', 'Woolsey', 'Curry', 'Fleecy', 'Wetherly', 'Creamline', 'Dairylyn', 'Halterlyn', 'Rambouillet', 'Longhorna',
            'Annie', 'Belle', 'Birdie', 'Cassidy', 'Georgia', 'Hattie', 'June', 'Loretta', 'Wranglyn', 'Reba',
            'Bandana', 'Saddleigh', 'Blaze', 'Bonnet', 'Pastura', 'Calfa', 'Chapparal', 'Cowslip', 'Cream', 'Dun',
            'Ewe', 'Farrow', 'Gingham', 'Goldie', 'Heford', 'Hidey', 'Lamb', 'Mare', 'Milka', 'Mowline',
            'Paint', 'Pinto', 'Ranchelle', 'Rodea', 'Shears', 'Sorrel', 'Spurette', 'Tally', 'Vealia', 'Wooly',
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
        ],
        Female: [
            'Rue', 'Seeder', 'Blossom', 'Feverfew', 'Holly', 'Lily', 'Rose', 'Petal', 'Flora', 'Rosemary',
            'Lavender', 'Poppy', 'Cherry', 'Peach', 'Berry', 'Clover', 'Olive', 'Marigold', 'Jasmine', 'Marjoram',
            'Apricot', 'Basil', 'Calla', 'Camellia', 'Dahlia', 'Fig', 'Ginger', 'Hyacinth', 'Loquat', 'Mulberry',
            'Nectarine', 'Persimmon', 'Plum', 'Quince', 'Sage', 'Sorrel', 'Sunflower', 'Tansy', 'Verbena', 'Zinnia',
            'Yarrow', 'Anise', 'Bergamot', 'Blackberry', 'Cardamom', 'Clementine', 'Cranberry', 'Elderflower', 'Hollyhock', 'Honeydew',
            'Endive', 'Peppermint', 'Pomegranate', 'Rhubarb', 'Tamarind', 'Wisteria', 'Meadowlark', 'Harvestine', 'Orchid', 'Vinelle',
            'Naomi', 'Ruth', 'Abigail', 'Delilah', 'Dinah', 'Esther', 'Hannah', 'Keziah', 'Leah', 'Martha',
            'Miriam', 'Rebekah', 'Selah', 'Tabitha', 'Zilla', 'Ada', 'Beulah', 'Eden', 'Hepzibah', 'Jemima',
            'Almond', 'Bloom', 'Bounty', 'Bramblerose', 'Cassava', 'Chive', 'Currant', 'Damson', 'Filbert', 'Gourdine',
            'Chamomile', 'Magnolia', 'Melba', 'Okrah', 'Pearblossom', 'Primula', 'Amaryllis', 'Tulip', 'Vervain', 'Violet',
        ],
    },
    // District 12 — Coal mining, split by class. Seam names come from wild
    // plants, weather, and the woods (Katniss, Gale, Ash); merchant names come
    // from trades, baking, and soft garden flowers (Peeta, Primrose, Maysilee).
    12: {
        Male: [
            'Gale', 'Haymitch', 'Burdock', 'Ash', 'Corf', 'Dust', 'Slate', 'Brattice', 'Coal', 'Ore',
            'Soot', 'Pebble', 'Cinder', 'Tipple', 'Gravel', 'Grit', 'Lantern', 'Lode', 'Mica', 'Pitch',
            'Shale', 'Tunnel', 'Vein', 'Collier', 'Hewer', 'Nugget', 'Drift', 'Ironstone', 'Carbide', 'Anthracite',
            'Blaine', 'Briar', 'Brooker', 'Buckthorn', 'Chicory', 'Cricket', 'Elk', 'Fenn', 'Fox', 'Hawk',
            'Heron', 'Hollow', 'Hunter', 'Jay', 'Splint', 'Moss', 'Ridge', 'River', 'Sedge', 'Snare',
            'Sumac', 'Tam', 'Teasel', 'Thorn', 'Wilder', 'Wolf', 'Yew', 'Davy', 'Birchen', 'Bracken',
            'Peeta', 'Cager', 'Bannock', 'Barm', 'Cobbler', 'Crumb', 'Farl', 'Grady', 'Griddle', 'Loaven',
            'Malt', 'Miller', 'Oren', 'Rounds', 'Rusk', 'Culm', 'Tanner', 'Toby', 'Wick', 'Yeaston',
            'Adit', 'Bellows', 'Canary', 'Chert', 'Coke', 'Delve', 'Galen', 'Hewitt', 'Marl', 'Ganister',
            'Pick', 'Quarrier', 'Seamus', 'Shaft', 'Sledge', 'Smelt', 'Spade', 'Tinder', 'Winch', 'Zinc',
        ],
        Female: [
            'Katniss', 'Primrose', 'Maysilee', 'Ember', 'Eglantine', 'Hazel', 'Iris', 'Violet', 'Willow', 'Rue',
            'Aster', 'Bryony', 'Lanterne', 'Bilberry', 'Heather', 'Ivy', 'Harebell', 'Mistle', 'Mallow', 'Colliera',
            'Nettle', 'Raven', 'Sootwyn', 'Foxglove', 'Rainelle', 'Thistle', 'Wren', 'Sloe', 'Betony', 'Dove',
            'Fennel', 'Filly', 'Ginger', 'Hyssop', 'Gritta', 'Linnet', 'Mim', 'Posy', 'Robin', 'Senna',
            'Sparrow', 'Speedwell', 'Starling', 'Sylvie', 'Teasel', 'Vetch', 'Wintergreen', 'Woodruff', 'Burdocka', 'Catkin',
            'Madge', 'Delly', 'Rooba', 'Butterlee', 'Minetta', 'Pansy', 'Peony', 'Rosanna', 'Sweetbriar', 'Tulip',
            'Bakerly', 'Bunny', 'Candy', 'Clemmie', 'Crumbelle', 'Doughsie', 'Honey', 'Lacey', 'Maybelle', 'Merrilee',
            'Millie', 'Ribbon', 'Sugarlee', 'Taffy', 'Threadgold', 'Anthracia', 'Ashlyn', 'Briquette', 'Canary', 'Cindra',
            'Coalette', 'Emberly', 'Flinta', 'Galena', 'Graphite', 'Hearth', 'Lignia', 'Mica', 'Obsidia', 'Frostwyn',
            'Campion', 'Seam', 'Shalene', 'Slatewyn', 'Sootrose', 'Tallow', 'Veina', 'Wickley', 'Xanthe', 'Lamplight',
        ],
    },
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
            'Cordite', 'Flint', 'Graphite', 'Primer', 'Casing', 'Vector', 'Ordnance', 'Breech',
            'Nitre', 'Sulfur', 'Bore', 'Tracer', 'Fuze', 'Calibre', 'Ramrod', 'Percy',
            'Magnus', 'Barrel', 'Charge', 'Ledger', 'Tallis', 'Corvus', 'Adamant', 'Coriolan',
            'Struck', 'Blast', 'Pitchblende', 'Hollis', 'Anvil', 'Cinder',
        ],
        Female: [
            'Petra', 'Nitra', 'Salvo', 'Cordelia', 'Vesta', 'Fuselle', 'Mensura', 'Quill',
            'Adamanta', 'Emberline', 'Grisel', 'Powder', 'Calibra', 'Sable', 'Ordina', 'Tallis',
            'Corva', 'Sulfa', 'Reckoning', 'Pitchara', 'Anvilla', 'Struck', 'Muster', 'Argent',
            'Volley', 'Lodestone', 'Mira', 'Reserve', 'Cassia', 'Blastine',
        ],
    },
    // District 14 — Salt and refrigeration: brine, preservation, cold, and the
    // long shelf-life of everything including grudges.
    14: {
        Male: [
            'Brine', 'Halloran', 'Saltus', 'Marl', 'Frost', 'Rime', 'Cured', 'Barrow',
            'Kelvin', 'Pickett', 'Ossian', 'Winterbourne', 'Cask', 'Hoar', 'Brack', 'Sump',
            'Glaive', 'Cullen', 'Larder', 'Chill', 'Saline', 'Crust', 'Keeper', 'Cole',
            'Halite', 'Freeze', 'Pan', 'Evapor', 'Coldwell', 'Stack',
        ],
        Female: [
            'Saline', 'Brinna', 'Rimewyn', 'Halite', 'Frosta', 'Marlene', 'Cura', 'Winterly',
            'Kelvina', 'Ossa', 'Larderly', 'Solene', 'Brackwyn', 'Coldrose', 'Preserva', 'Icelin',
            'Cask', 'Salterly', 'Hoarfrost', 'Pallas', 'Crystelle', 'Nivea', 'Chilla', 'Sumpwyn',
            'Sable', 'Everfrost', 'Panne', 'Keepsake', 'Glacia', 'Cellara',
        ],
    },
    // District 15 — Glassworks: heat, clarity, fragility, and the vocabulary
    // of things that break beautifully.
    15: {
        Male: [
            'Kiln', 'Vitrus', 'Cullet', 'Pane', 'Prism', 'Anneal', 'Silex', 'Blowpipe',
            'Lehr', 'Frit', 'Crazing', 'Obsidian', 'Marver', 'Gaffer', 'Punty', 'Slump',
            'Fuse', 'Facet', 'Shard', 'Crucible', 'Batch', 'Temper', 'Lume', 'Clarion',
            'Sable', 'Etch', 'Bevel', 'Flux', 'Glint', 'Refract',
        ],
        Female: [
            'Vitra', 'Prisma', 'Clarity', 'Lumen', 'Silica', 'Annealla', 'Shardis', 'Facette',
            'Crazia', 'Cullette', 'Marvella', 'Pane', 'Lustra', 'Fritte', 'Obsidia', 'Bevelle',
            'Temperance', 'Glinta', 'Crucible', 'Etcha', 'Refracta', 'Slumpwyn', 'Clarion', 'Sablewyn',
            'Fusia', 'Batchel', 'Lehrwyn', 'Opaline', 'Verre', 'Sheen',
        ],
    },
    // District 16 — Deepwater drilling: months offshore, pressure, dark water,
    // and names that sound like equipment because half of them are.
    16: {
        Male: [
            'Derrick', 'Fathom', 'Vaunt', 'Sounder', 'Riser', 'Kelp', 'Trawl', 'Bathys',
            'Anchor', 'Rig', 'Drill', 'Marlin', 'Deepwell', 'Gaff', 'Plumb', 'Grapnel',
            'Bilge', 'Keel', 'Hawser', 'Cleat', 'Undertow', 'Barnacle', 'Cordage', 'Sable',
            'Windlass', 'Shoal', 'Tiller', 'Nadir', 'Brace', 'Corrie',
        ],
        Female: [
            'Fathoma', 'Marina', 'Nerissa', 'Riserly', 'Bathya', 'Undertow', 'Corrie', 'Sirena',
            'Plumbline', 'Anchora', 'Trawla', 'Kelpie', 'Hawsell', 'Cleatwyn', 'Nadira', 'Shoala',
            'Cordelle', 'Bilgewyn', 'Keelin', 'Marlena', 'Sable', 'Windlassa', 'Tillera', 'Brackish',
            'Abyssa', 'Sounder', 'Derricka', 'Pelagia', 'Grapnelle', 'Deepwyn',
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
