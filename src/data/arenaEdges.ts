import { Arena, EdgeRule } from '../models/types';

/**
 * Audit 4 §1.1: the edge-rule kinds nobody authored.
 *
 * `EdgeRule` declares seven kinds. Before this file, the forty authored arenas
 * carried 26 `tolled`, 8 `timeGated`, 5 `oneWay` — and **4 `collapsing`,
 * 2 `hidden`, 1 `contested`, 1 `oneWayAfter`**. Twenty-seven of the thirty-four
 * arenas with any rule at all carried exactly one.
 *
 * That is not a taxonomy with dead members in the sense the last audit found
 * (the kinds construct fine); it is a taxonomy nobody stocked, which reads the
 * same way from the engine's side. `contested = 1` meant `tickGarrisons` ran
 * once per cycle in every run of the game, found nothing in 39 of 40 arenas
 * and returned — **0 garrisons claimed across 160 complete runs**. `collapsing`
 * and `oneWayAfter` are the only two writers of `state.edgeCrossings`, so the
 * rope bridge that spends itself measured **0.0 crossings per run**.
 *
 * The rules live here rather than inline in `constants.ts` for two reasons:
 * they are a single concern that wants reading together, and `check-arena-layout`
 * needs to assert things about them as a set (every kind stocked, and no rule
 * ever the sole route to a zone).
 *
 * Three hard constraints, all checked by `npm run test:arenas`:
 *
 *  1. **A `hidden` edge is never a zone's only way in.** `passableFor` returns
 *     false for an undiscovered hidden edge, so a hidden rule on a leaf edge
 *     strands the zone behind it until somebody happens to settle next to it.
 *  2. **`contested` goes on an edge with a chokepoint endpoint.** `tickGarrisons`
 *     only considers endpoints where `zoneFeatures(zone).chokepoint` holds; a
 *     contested edge between two open zones is inert.
 *  3. **`oneWayAfter` names its surviving direction.** `from`/`to` are required
 *     and must be a real adjacency.
 */

/** Crossings a rope-and-plank thing has in it before it is gone. */
const SPANS = 6;
/** Crossings a rotten structural thing has. Fewer: it was never meant to carry this. */
const ROTTEN = 4;
/** Crossings before a descent has worn into a one-way descent. */
const WORN = 3;

type EdgeMap = Record<string, EdgeRule>;

/**
 * Extra edge rules, keyed by arena id. Merged into `ARENAS` at load; an arena
 * that already declares the same edge keeps its own rule, so nothing here can
 * silently overwrite a hand-placed one in `constants.ts`.
 */
export const EXTRA_EDGE_RULES: Record<string, EdgeMap> = {
    // ---- contested: ground an alliance can sit on and charge for ----------
    // Every one of these is a real bottleneck with a chokepoint endpoint, so a
    // pack that digs in there is holding something worth holding.
    frozen: {
        'Ice Caves|The Crevasse Field': { kind: 'contested' },
    },
    concrete: {
        'Abandoned Subway|The Storm Drains': { kind: 'contested' },
        // The drains are the back way between the underpass and the subway,
        // and you have to have been down there to know it.
        'The Flooded Underpass|The Storm Drains': { kind: 'hidden' },
    },
    warren: {
        // The zone is called The Choke. If anywhere in the game is a toll
        // booth, it is this.
        'The Choke|The Old Workings': { kind: 'contested' },
        'The Choke|The Collapsed Galleries': { kind: 'hidden' },
    },
    vault: {
        'Service Tunnels|The Ventilation Shafts': { kind: 'contested' },
        // A crawl between two flooded rooms that is not on any plan.
        'The Cistern|The Sump': { kind: 'hidden' },
    },
    canopy: {
        'The Strangler Fig|The Wind Gap': { kind: 'contested' },
        // A rope bridge is the canonical thing that spends itself.
        'The Crown|The Rope Bridges': { kind: 'collapsing', crossings: SPANS },
    },
    abattoir: {
        'The Conveyor Deck|The Piston Hall': { kind: 'contested' },
        'Furnace Row|The Catwalks': { kind: 'collapsing', crossings: ROTTEN },
    },
    terraces: {
        'The Shaft Mouths|The Winch House': { kind: 'contested' },
        'The Counterweight Span|The Winch House': { kind: 'collapsing', crossings: SPANS },
        'The Cable Car Station|The Upper Steps': {
            kind: 'oneWayAfter', after: WORN,
            from: 'The Upper Steps', to: 'The Cable Car Station',
        },
    },
    carnival: {
        "Fortune Teller's Row|The Big Top": { kind: 'contested' },
    },
    labyrinth: {
        "The Canal Walk|The Gardener's Gate": { kind: 'contested' },
        // A gap somebody pushed through the hedge, years ago.
        'The South Spiral|The Topiary Garden': { kind: 'hidden' },
    },
    ashgrove: {
        'Lockers|Main Corridor': { kind: 'contested' },
        'The Boiler Room|The Flooded Pool': { kind: 'collapsing', crossings: ROTTEN },
        'Science Block|The Boiler Room': { kind: 'hidden' },
    },
    nooneplace: {
        // The Exit. Of course somebody is standing on it.
        'Exit|The Long Hall': { kind: 'contested' },
        'Sub-Level|The Stairwell': { kind: 'collapsing', crossings: ROTTEN },
    },
    magmatube: {
        'The Ember Shaft|The Upper Throat': { kind: 'contested' },
        'Lower Throat|The Lava Lake Antechamber': { kind: 'collapsing', crossings: ROTTEN },
        'The Long Way Round|The Outer Gallery': { kind: 'hidden' },
        'The Ash-Choked Stair|The Steam Vents': {
            kind: 'oneWayAfter', after: WORN,
            from: 'The Ash-Choked Stair', to: 'The Steam Vents',
        },
    },
    menagerie: {
        "Keeper's Yard|Quarantine": { kind: 'contested' },
        // The service corridor the keepers used, behind the tanks.
        'The Aquarium|The Aviary': { kind: 'hidden' },
    },
    storywood: {
        "Grandmother's Cottage|The Path": { kind: 'contested' },
        'The Bramble|The Deep Wood': { kind: 'hidden' },
    },
    acousticforest: {
        'The Resonance Chamber|The Wind Throat': { kind: 'contested' },
    },
    craterfield: {
        'Rusted Convoy Road|Vine-Choked Bunker': { kind: 'contested' },
    },
    silkwood: {
        "Broodmother's Crag|The Ridge Path": { kind: 'contested' },
        'The Cornucopia (The Clearing)|The Silk Bridge': { kind: 'collapsing', crossings: SPANS },
        'The Sink|Web Hollow': { kind: 'hidden' },
    },
    kelvin: {
        'Laboratory Module|The Isotope Store': { kind: 'contested' },
    },
    culdesac: {
        'The Cut-Through|The Storm Creek': { kind: 'contested' },
        // The culvert under the gardens. Every child on this street knew.
        'Back Gardens|The Storm Creek': { kind: 'hidden' },
    },
    reef: {
        'The Coral Razors|The Shelf Break': { kind: 'contested' },
    },
    seapeaks: {
        'The Ice Chimney|The Summit Col': { kind: 'contested' },
        'The First Peak|The Ice Chimney': {
            kind: 'oneWayAfter', after: WORN,
            from: 'The First Peak', to: 'The Ice Chimney',
        },
    },
    glacier: {
        'The Meltwater Vault|The Slick Tunnels': { kind: 'contested' },
        'The Moulin|The Pressure Ridge': { kind: 'collapsing', crossings: ROTTEN },
        'The Green Chimney|The Meltwater Vault': {
            kind: 'oneWayAfter', after: WORN,
            from: 'The Green Chimney', to: 'The Meltwater Vault',
        },
    },
    islands: {
        'Lodestone Crag|The Long Span': { kind: 'collapsing', crossings: SPANS },
    },
    canopyweb: {
        'The Needle Bridges|The Swaying Reach': { kind: 'collapsing', crossings: SPANS },
    },
    floe: {
        'The Bergy Bits|The Frozen Wreck': { kind: 'collapsing', crossings: ROTTEN },
    },
    quarry: {
        'The Crusher House|The Flooded Pit': { kind: 'collapsing', crossings: ROTTEN },
        'The Middle Benches|The Spiral Road': {
            kind: 'oneWayAfter', after: WORN,
            from: 'The Spiral Road', to: 'The Middle Benches',
        },
    },
    karst: {
        'The Glowmoss Hollow|The Siphon Passage': { kind: 'hidden' },
        'The Bone Passage|The Drip Gallery': {
            kind: 'oneWayAfter', after: WORN,
            from: 'The Drip Gallery', to: 'The Bone Passage',
        },
    },
    eclipse: {
        'The Charcoal Grove|The Fallen Giant': { kind: 'hidden' },
    },
    alpine: {
        'The Cirque|The Scree Chutes': {
            kind: 'oneWayAfter', after: WORN,
            from: 'The Scree Chutes', to: 'The Cirque',
        },
    },
    redcathedral: {
        'The Bright Angel Descent|Upper Bench': {
            kind: 'oneWayAfter', after: WORN,
            from: 'The Bright Angel Descent', to: 'Upper Bench',
        },
    },
    sporefields: {
        'Mycelium Steps|The Fruiting Body': {
            kind: 'oneWayAfter', after: WORN,
            from: 'Mycelium Steps', to: 'The Fruiting Body',
        },
        'Rot Hollow|The Fruiting Body': { kind: 'contested' },
    },
};

/**
 * Folds the extras into an arena definition. An edge the arena already names
 * wins — `constants.ts` is the authority on the rules it placed by hand.
 */
export function withExtraEdgeRules(arena: Arena): Arena {
    const extra = EXTRA_EDGE_RULES[arena.id];
    if (!extra) return arena;
    return { ...arena, edgeRules: { ...extra, ...(arena.edgeRules ?? {}) } };
}
