import { Arena, Injuries, Mutt, MuttRole, SignatureRule, Terrain, Zone, ZoneEffectKind } from '../models/types';
import { RNG } from '../utils/rng';
import { PROCEDURAL_EVENTS, FlavorTag } from '../data/proceduralFlavor';
import { PROC_SIGNATURE } from '../data/balance';

interface Biome {
    id: string;
    namePrefix: string;
    description: string;
    terrains: Terrain[];
    zoneNames: Record<Terrain, string[]>;
}

// B3: every biome's zoneNames pool used to be 9-13 names spread across only
// the terrains listed in `terrains` — several pools (Sulfur Pools, Salt
// Lagoon, Peat Bog, The Clearing) were written but dead, because their
// terrain wasn't in that biome's `terrains` array at all, so the generator
// could never roll it. That left every biome short of the 13-16 zone
// "sprawl" tier the shape roll below can request (archipelago and volcanic
// topped out at 10, unable to reach it at all), and a maxed-out arena that
// exhausted its pool mid-generation just came out smaller and reused the
// same handful of names on every large roll. Pools are now sized well past
// 16 per biome, and every terrain with a written pool is actually reachable.
const BIOMES: Biome[] = [
    {
        id: 'rainforest',
        namePrefix: 'Rainforest',
        description: 'A dense, humid jungle. Food is everywhere — and so are the things that eat it.',
        terrains: ['open', 'forest', 'water', 'wetland', 'highland', 'ruins'],
        zoneNames: {
            open: ['The Clearing', 'Sunlit Break', 'Trampled Clearing', 'Fallen Giant'],
            forest: ['Strangler Canopy', 'Vine Thicket', 'Fern Hollow', 'Kapok Grove', 'Howler Canopy', 'Root Tangle'],
            water: ['Piranha River', 'Waterfall Basin', 'Flooded Grotto', 'Blackwater Shallows', 'Rapids Bend'],
            wetland: ['Leech Marsh', 'Mangrove Maze', 'Sinking Flat', 'Mosquito Bog'],
            highland: ['Emerald Ridge', 'Temple Steps', 'Moss-Choked Bluff', 'Canopy Walk'],
            ruins: ['Sunken Temple', 'Overgrown Altar', 'Collapsed Shrine', 'Idol Grove'],
        },
    },
    {
        id: 'volcanic',
        namePrefix: 'Volcanic',
        description: 'Black rock, ash storms, and rivers of magma. Water is scarce, burns are not.',
        terrains: ['open', 'forest', 'wetland', 'highland', 'ruins', 'water'],
        zoneNames: {
            open: ['Ash Flats', 'Obsidian Plain', 'Cinder Wastes', 'Scorched Flat'],
            forest: ['Charred Woods', 'Blackened Grove', 'Smoldering Thicket'],
            water: ['Steam Vents', 'Boiling Spring', 'Mineral Pool'],
            wetland: ['Sulfur Pools', 'Tar Seep', 'Ashen Mudflat'],
            highland: ['Caldera Rim', 'Lava Tubes', 'Cinder Cone', 'Fumarole Terrace', 'Obsidian Spire'],
            ruins: ['Buried Outpost', 'Basalt Columns', 'Ash-Choked Vault', 'Slag Foundry'],
        },
    },
    {
        id: 'archipelago',
        namePrefix: 'Archipelago',
        description: 'A chain of storm-lashed islands. Swimming between zones is half the battle.',
        terrains: ['water', 'open', 'forest', 'wetland', 'highland', 'ruins'],
        zoneNames: {
            open: ['Shipwreck Beach', 'Tidal Flats', 'Driftwood Cove', 'Sandbar Spit'],
            forest: ['Palm Grove', 'Bamboo Isle', 'Windbreak Thicket'],
            water: ['The Shallows', 'Riptide Channel', 'Coral Reef', 'Sunken Reef', 'Whirlpool Strait'],
            wetland: ['Salt Lagoon', 'Mangrove Shoal', 'Tidepool Flat'],
            highland: ['Lighthouse Rock', 'Sea Cliffs', 'Watchtower Bluff'],
            ruins: ['Drowned Village', 'Barnacled Wreck', 'Old Harbor'],
        },
    },
    {
        id: 'highlands',
        namePrefix: 'Highland',
        description: 'Windswept moors and treacherous peaks. The cold and the drops kill as surely as blades.',
        terrains: ['highland', 'open', 'forest', 'water', 'wetland', 'ruins'],
        zoneNames: {
            open: ['Windswept Moor', 'Heather Field', 'Frostbitten Plain'],
            forest: ['Stunted Pines', 'Misty Glen', 'Dead Timber'],
            water: ['Black Loch', 'Mountain Spring', 'Frozen Tarn'],
            wetland: ['Peat Bog', 'Sodden Fen'],
            highland: ['Shrouded Summit', 'Scree Slopes', 'Eagle Pass', 'Wind Gap', 'Frost-Cracked Ridge'],
            ruins: ['Broken Watchtower', 'Standing Stones', 'Cairn Field', 'Abandoned Croft'],
        },
    },
];

const TERRAIN_PROFILES: Record<Terrain, { danger: [number, number]; resources: [number, number] }> = {
    open: { danger: [0.4, 0.7], resources: [0.1, 0.4] },
    forest: { danger: [0.2, 0.5], resources: [0.5, 0.9] },
    water: { danger: [0.3, 0.7], resources: [0.3, 0.6] },
    highland: { danger: [0.5, 0.9], resources: [0.1, 0.4] },
    ruins: { danger: [0.4, 0.8], resources: [0.2, 0.5] },
    wetland: { danger: [0.4, 0.8], resources: [0.3, 0.7] },
};

function range(rng: RNG, [min, max]: [number, number]): number {
    return Math.round((min + rng.nextFloat() * (max - min)) * 100) / 100;
}

// ARENA-08: every procedural arena used to be one ring-plus-spokes graph, so
// no matter what biome or seed rolled, the map *shape* was always identical.
// These are named topology generators the main function picks between with
// the seeded RNG, so a rainforest arena might come out as a river-bisected
// map one roll and a vertical canopy the next.
type Topology = 'linear' | 'hub' | 'ring' | 'bisected' | 'layered';
const TOPOLOGIES: Topology[] = ['linear', 'hub', 'ring', 'bisected', 'layered'];

function connect(a: Zone, b: Zone) {
    if (!a.adjacent.includes(b.name)) a.adjacent.push(b.name);
    if (!b.adjacent.includes(a.name)) b.adjacent.push(a.name);
}

/**
 * After a topology has laid down its intended edges, this guarantees every
 * zone is reachable from the Cornucopia (zone 0) — the one safety property
 * every variant must keep, ported from the original ring generator's
 * connectivity guard. A deliberately sparse topology (hub, bisected) can
 * otherwise strand a zone if the RNG's draws happen to isolate it.
 */
function guaranteeConnectivity(zones: Zone[]) {
    const byName = new Map(zones.map(z => [z.name, z]));
    const seen = new Set<string>([zones[0].name]);
    const queue = [zones[0]];
    while (queue.length) {
        const z = queue.shift()!;
        z.adjacent.forEach(n => {
            if (seen.has(n)) return;
            seen.add(n);
            const next = byName.get(n);
            if (next) queue.push(next);
        });
    }
    zones.forEach(z => {
        if (seen.has(z.name)) return;
        // Stitch the stranded zone onto whatever's already reachable, then
        // fold it into the reachable set so later stragglers can chain off it.
        const anchor = zones.find(o => seen.has(o.name))!;
        connect(anchor, z);
        seen.add(z.name);
    });
}

function buildLinear(zones: Zone[]) {
    // A rough chain — the Cornucopia sits at one end, every other zone
    // connects mainly to its neighbours in sequence (a river or mountain pass).
    for (let i = 0; i < zones.length - 1; i++) {
        connect(zones[i], zones[i + 1]);
    }
}

function buildHub(zones: Zone[], rng: RNG) {
    // Cornucopia at the centre; every outer zone connects to the hub and to
    // at most one neighbour — sparser than the old ring+spokes+chords shape,
    // genuinely reads as a wheel instead of a ring with extra clutter.
    const outer = zones.slice(1);
    outer.forEach(z => connect(zones[0], z));
    const shuffled = rng.shuffle(outer);
    for (let i = 0; i < shuffled.length - 1; i += 2) {
        connect(shuffled[i], shuffled[i + 1]);
    }
}

function buildRing(zones: Zone[]) {
    // A cycle through the outer zones, with the Cornucopia as one extra
    // connected node off the cycle — closer to a pure ring than the old
    // ring+spokes+chords, which blurred into hub-and-spoke anyway.
    const outer = zones.slice(1);
    for (let i = 0; i < outer.length; i++) {
        connect(outer[i], outer[(i + 1) % outer.length]);
    }
    connect(zones[0], outer[0]);
    if (outer.length > 3) connect(zones[0], outer[Math.floor(outer.length / 2)]);
}

function buildBisected(zones: Zone[], rng: RNG) {
    // Two internally-dense clusters joined by a single crossing zone —
    // a genuine chokepoint, modeling a river or canyon splitting the arena.
    const outer = rng.shuffle(zones.slice(1));
    const mid = Math.floor(outer.length / 2);
    const clusterA = outer.slice(0, mid);
    const clusterB = outer.slice(mid);
    const wireCluster = (cluster: Zone[]) => {
        for (let i = 0; i < cluster.length; i++) {
            connect(cluster[i], cluster[(i + 1) % cluster.length]);
        }
    };
    if (clusterA.length > 1) wireCluster(clusterA);
    if (clusterB.length > 1) wireCluster(clusterB);
    if (clusterA.length && clusterB.length) connect(clusterA[0], clusterB[0]);
    connect(zones[0], clusterA[0] ?? clusterB[0]);
    if (clusterB.length) connect(zones[0], clusterB[0]);
}

function buildLayered(zones: Zone[], rng: RNG) {
    // Zones grouped into tiers (lower/mid/upper), adjacency mostly within a
    // tier and between adjacent tiers only — models vertical arenas like a
    // canopy or a multi-level facility without needing real 3D zone data.
    const outer = zones.slice(1);
    const tierCount = outer.length >= 6 ? 3 : 2;
    const tiers: Zone[][] = Array.from({ length: tierCount }, () => []);
    outer.forEach((z, i) => tiers[i % tierCount].push(z));
    tiers.forEach(tier => {
        for (let i = 0; i < tier.length - 1; i++) connect(tier[i], tier[i + 1]);
    });
    for (let t = 0; t < tiers.length - 1; t++) {
        if (tiers[t].length && tiers[t + 1].length) {
            connect(rng.pick(tiers[t]), rng.pick(tiers[t + 1]));
        }
    }
    // The Cornucopia sits at the base tier, as the ground-level rally point.
    if (tiers[0].length) connect(zones[0], tiers[0][0]);
    else connect(zones[0], outer[0]);
}

function buildTopology(topology: Topology, zones: Zone[], rng: RNG) {
    switch (topology) {
        case 'linear': return buildLinear(zones);
        case 'hub': return buildHub(zones, rng);
        case 'ring': return buildRing(zones);
        case 'bisected': return buildBisected(zones, rng);
        case 'layered': return buildLayered(zones, rng);
    }
}

// ARENA-08: mutt names used to be a fixed 3-per-biome list, so "Razor
// Parrots" was the rainforest's only possible mutt forever. This combines
// tag-matched modifiers with base creature names so the same biome can
// still surprise a returning player.
const MODIFIERS_BY_TAG: Record<string, string[]> = {
    cold: ['Frost-Fanged', 'Rime-Coated', 'Glacial'],
    heat: ['Ash-Wreathed', 'Cinder', 'Smoke-Choked'],
    water: ['Riptide', 'Brine-Slick', 'Undertow'],
    highland: ['Cliff-Born', 'Storm-Wracked', 'Wind-Torn'],
    forest: ['Vine-Wrapped', 'Canopy-Bred', 'Root-Fed'],
    ruins: ['Rust-Eaten', 'Buried', 'Relic-Bound'],
    wetland: ['Marsh-Born', 'Silt-Skinned', 'Bog-Cursed'],
    open: ['Sun-Scarred', 'Dust-Born', 'Bare-Fanged'],
};
const GENERIC_MODIFIERS = ['Iron-Jawed', 'Blood-Eyed', 'Night-Bred', 'Hollow-Eyed'];
const CREATURE_BASES = ['Harpies', 'Wraiths', 'Hounds', 'Stalkers', 'Serpents', 'Mutts', 'Ravagers', 'Screechers', 'Crawlers', 'Reapers'];

/**
 * Arena-native mutts, not just names. `generateMuttNames` used to produce
 * flavour strings for `Arena.mutts` with no kit behind them — the display
 * list and what `rosterFor()` actually resolved (a fixed 3-mutt roster
 * shared by every arena of the same biome) didn't even agree, let alone have
 * roles. This rolls real `Mutt` objects, one role each, so a generated
 * arena's bestiary is specific to that arena and actually has teeth.
 */
interface RoleTemplate {
    role: MuttRole;
    packSize: [number, number];
    damage: number;
    speed: number;
    inflicts?: Partial<Injuries>;
    nocturnal?: boolean;
    fearAura?: number;
}
const ROLE_TEMPLATES: RoleTemplate[] = [
    { role: 'ambusher', packSize: [1, 2], damage: 24, speed: 9, inflicts: { bleeding: true }, nocturnal: true },
    { role: 'herder', packSize: [1, 2], damage: 10, speed: 7 },
    { role: 'scavenger', packSize: [1, 3], damage: 14, speed: 6, inflicts: { infected: true } },
    { role: 'siege', packSize: [1, 1], damage: 26, speed: 5 },
    { role: 'mimic', packSize: [1, 1], damage: 16, speed: 6, fearAura: 10 },
    { role: 'swarm', packSize: [3, 6], damage: 9, speed: 6 },
];

function generateMuttRoster(rng: RNG, biome: Biome, activeTags: string[], count: number, zoneNames: string[]): Mutt[] {
    const pools = activeTags.length
        ? activeTags.flatMap(t => MODIFIERS_BY_TAG[t] || [])
        : [];
    const modifierPool = (pools.length ? pools : GENERIC_MODIFIERS).concat(GENERIC_MODIFIERS);
    const usedNames = new Set<string>();
    const templates = rng.shuffle(ROLE_TEMPLATES).slice(0, count);
    // Siege mutts get a home outside the Cornucopia when there's a choice —
    // pinning one to the one zone every tribute passes through would make it
    // less a territorial horror than a mandatory toll booth.
    const homeOptions = zoneNames.length > 1 ? zoneNames.slice(1) : zoneNames;

    return templates.map((tpl, i) => {
        let name = `${rng.pick(modifierPool)} ${rng.pick(CREATURE_BASES)}`;
        let attempts = 10;
        while (usedNames.has(name) && attempts-- > 0) name = `${rng.pick(modifierPool)} ${rng.pick(CREATURE_BASES)}`;
        usedNames.add(name);
        const mutt: Mutt = {
            id: `${biome.id}-${tpl.role}-${i}`,
            name,
            packSize: tpl.packSize,
            damage: tpl.damage,
            speed: tpl.speed,
            inflicts: tpl.inflicts,
            nocturnal: tpl.nocturnal,
            fearAura: tpl.fearAura,
            role: tpl.role,
        };
        if (tpl.role === 'siege' && homeOptions.length > 0) mutt.homeZone = rng.pick(homeOptions);
        return mutt;
    });
}

// Composes one SignatureRule (trigger × selector × payload × telegraph) per
// generated arena from the same seeded RNG as the rest of the layout, so two
// arenas of the same biome don't necessarily share a mechanic. See
// `runDeclarativeSignature` in engine/arenaSignature.ts for how it executes.
const TRIGGER_KINDS: SignatureRule['trigger']['kind'][] = ['everyCycle', 'everyNth', 'nightsOnly', 'daysOnly', 'afterEscalation', 'lowSurvivors'];
const SELECTOR_KINDS: SignatureRule['selector']['kind'][] = ['fixedRotation', 'busiestZone', 'emptiestZone', 'nearCornucopia', 'lowestDanger', 'allZones'];
const PAYLOAD_KINDS: SignatureRule['payload']['kind'][] = ['damageEffect', 'severEdges', 'invertResources', 'spawnMutt', 'drainVital', 'revealPositions'];
const TELEGRAPH_KINDS: SignatureRule['telegraph']['kind'][] = ['oneAhead', 'none', 'falseChance'];
const SIGNATURE_EFFECT_KINDS: ZoneEffectKind[] = ['burning', 'flooded', 'frozen', 'contaminated', 'fogbound', 'stripped'];

function rollSignatureRule(rng: RNG): SignatureRule {
    const triggerKind = rng.pick(TRIGGER_KINDS);
    const payloadKind = rng.pick(PAYLOAD_KINDS);
    const telegraphKind = rng.pick(TELEGRAPH_KINDS);
    return {
        trigger: {
            kind: triggerKind,
            n: triggerKind === 'everyNth' ? rng.nextInt(PROC_SIGNATURE.everyNthMin, PROC_SIGNATURE.everyNthMax) : undefined,
            threshold: triggerKind === 'lowSurvivors' ? rng.nextInt(PROC_SIGNATURE.lowSurvivorsMin, PROC_SIGNATURE.lowSurvivorsMax) : undefined,
        },
        selector: { kind: rng.pick(SELECTOR_KINDS) },
        payload: {
            kind: payloadKind,
            effect: payloadKind === 'damageEffect' ? rng.pick(SIGNATURE_EFFECT_KINDS) : undefined,
        },
        telegraph: {
            kind: telegraphKind,
            falseChance: telegraphKind === 'falseChance' ? range(rng, [PROC_SIGNATURE.falseChanceMin, PROC_SIGNATURE.falseChanceMax]) : undefined,
        },
    };
}

export function generateArena(seed: string): Arena {
    const rng = new RNG(`${seed}-arena`);
    const biome = rng.pick(BIOMES);
    // §8.3: the shape varies. Every hand-authored arena is 10-11 zones with 3
    // mutts, which reads to the player as sameness. The Gamemakers now build
    // claustrophobic 7-zone pressure cookers and 16-zone sprawls too — a
    // different game each, not just different scenery. (Below 6, a tribute
    // can never genuinely disappear, which is most of what an arena is for.)
    const shapeRoll = rng.nextFloat();
    const zoneCount = shapeRoll < 0.2 ? rng.nextInt(6, 8)
        : shapeRoll < 0.85 ? rng.nextInt(9, 12)
        : rng.nextInt(13, 16);
    const topology = rng.pick(TOPOLOGIES);

    // The Cornucopia is always the hub
    const zones: Zone[] = [{
        name: 'The Cornucopia',
        terrain: 'open',
        danger: range(rng, [0.5, 0.7]),
        resources: range(rng, [0.2, 0.4]),
        adjacent: [],
    }];

    const usedNames = new Set<string>(['The Cornucopia']);
    // Bounded: if a biome's name pools run dry the arena simply comes out
    // smaller, instead of looping forever looking for an unused name.
    let attempts = zoneCount * 40;
    while (zones.length < zoneCount && attempts-- > 0) {
        const terrain = rng.pick(biome.terrains);
        const pool = (biome.zoneNames[terrain] || []).filter(n => !usedNames.has(n));
        if (pool.length === 0) continue;
        const name = rng.pick(pool);
        usedNames.add(name);
        const profile = TERRAIN_PROFILES[terrain];
        zones.push({
            name,
            terrain,
            danger: range(rng, profile.danger),
            resources: range(rng, profile.resources),
            adjacent: [],
        });
    }

    buildTopology(topology, zones, rng);
    guaranteeConnectivity(zones);

    const activeTags = Array.from(new Set(zones.map(z => z.terrain as string)));
    // §8.3 / ARENA-11: mutt count varies too — one arena with a single
    // persistent horror reads very differently from one with three kinds of
    // teeth. `muttRoster` is what the encounter system actually resolves
    // against; `mutts` (display names) is now derived from it directly, so
    // the arena summary never again names a mutt that can't actually appear.
    const muttCount = rng.nextInt(1, 3);
    const muttRoster = generateMuttRoster(rng, biome, activeTags, muttCount, zones.map(z => z.name));
    const mutts = muttRoster.map(m => m.name);

    // `events` here is just the arena's own signature-event *name* list
    // (shown in arena summaries) — the actual event bodies/text come from
    // proceduralArenaFlavor() (src/data/proceduralFlavor.ts), tag-composed
    // from the zones above instead of hardcoded per biome. Derive the names
    // from whichever tagged events would actually be eligible to fire here.
    const tagSet = new Set(activeTags as FlavorTag[]);
    const eligible = PROCEDURAL_EVENTS.filter(e => e.tags.some(t => tagSet.has(t)));
    const eventNames = Array.from(new Set(
        (eligible.length ? eligible : PROCEDURAL_EVENTS).map(e => e.cause.replace(/^(Killed|Drowned|Died|Fell|Poisoned|Burned|Struck|Crushed|Stripped|Suffocated|Bled out to|Froze to death|Lost and frozen in|Lost to|Impaled in|Blinded and battered by)\b\s*(by|in|to|from)?\s*/, '').replace(/^\w/, c => c.toUpperCase()))
    )).slice(0, 5);

    // B3: 4 biomes × 5 suffixes gave only 20 distinct arena display names in
    // total, so returning players saw the same handful of titles over and
    // over regardless of how different the actual layout was. More than
    // doubling the suffix pool is a cheap way to widen that without touching
    // `arena.id` (which flavor packs, climate profiles and mutt lists key on
    // and must stay exactly `procedural-<biome>`).
    const suffix = rng.pick([
        'Crucible', 'Gauntlet', 'Expanse', 'Labyrinth', 'Proving Grounds',
        'Wilds', 'Reach', 'Maze', 'Killing Ground', 'Hollow', 'Circuit', 'Basin',
    ]);
    return {
        id: `procedural-${biome.id}`,
        name: `The ${biome.namePrefix} ${suffix}`,
        description: `${biome.description} (Procedurally generated arena — ${topology} layout.)`,
        mutts,
        events: eventNames,
        zones,
        signatureRule: rollSignatureRule(rng),
        muttRoster,
    };
}
