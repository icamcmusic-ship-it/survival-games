import { Arena, ZoneEffectKind } from '../models/types';

/**
 * §3 (requests): arena event packs.
 *
 * An arena already had three things that could happen to a tribute: the
 * per-cycle signature (`engine/arenaSignature.ts`), the authored encounter
 * pool (`data/arenaFlavor.ts`), and the ambient zone effects. All three are
 * *per tribute* or *per zone*, and all three fire constantly. None of them is
 * the thing a Games is remembered for: the single announced intervention that
 * the whole arena has to react to at once.
 *
 * That is what a pack is. Each arena draws from one — a short list of named,
 * arena-wide set pieces — and a run fires at most two of them, plus the
 * convergence, which is not optional and is not scheduled by day (see
 * `engine/arenaEventPacks.ts`). Laws that say the arena is more active add one
 * more slot each, capped, so a stacked arena is genuinely busier.
 *
 * Deliberately few and deliberately loud. Two big events in a nine-day run is
 * a shape a player can hold in their head; eight is weather.
 *
 * This module is data only and imports nothing from `engine/`, because the
 * setup screen renders the pack in the arena picker and must not drag the
 * simulation into the cold-start path.
 */

/** What a set piece does when it fires. Each maps onto machinery that already exists. */
export type SetPieceKind =
    /** A zone effect started across several zones at once. */
    | 'effectSweep'
    /** Routes cut across the map: the graph is re-shaped mid-run. */
    | 'severRoutes'
    /** Supplies dropped at the Cornucopia, announced, so everybody comes. */
    | 'supplyDrop'
    /** A mutt release: every tribute in the named terrain is engaged. */
    | 'muttRelease'
    /** Flat damage and a status across every tribute not under shelter. */
    | 'exposureSurge'
    /** Zones go out of bounds early, on top of the ordinary collapse. */
    | 'earlyCollapse'
    /** Every living tribute's position is broadcast to every other one. */
    | 'revealAll'
    /** The convergence: the field is driven into one sector. Always last, always fires. */
    | 'convergence';

export interface ArenaSetPiece {
    id: string;
    /** What the broadcast calls it. Shown in the picker once the arena is unlocked. */
    name: string;
    /** One plain line: what it does to a run. Shown in the picker. */
    summary: string;
    kind: SetPieceKind;
    /** Earliest day this may be scheduled for. Default 2. */
    minDay?: number;
    /** Latest day this may be scheduled for. Default 7. */
    maxDay?: number;
    /** 'effectSweep': which effect, and how many zones it takes. */
    effect?: ZoneEffectKind;
    zones?: number;
    /** Magnitude: damage for 'exposureSurge', routes cut for 'severRoutes', zones for 'earlyCollapse'. */
    amount?: number;
    /** The announcement, plain and factual. `{zones}` is filled with the affected zone names. */
    announce: string;
}

export interface ArenaEventPack {
    id: string;
    /** What the pack is called in the picker. */
    name: string;
    /** One line describing the pack as a whole. */
    summary: string;
    events: ArenaSetPiece[];
}

/**
 * The convergence, shared by every pack.
 *
 * §11 (requests): too many runs were won by a tribute who avoided everybody
 * and killed the last person standing. The convergence is the structural fix
 * and it is not optional in any arena — when the field drops into the closing
 * band, the Gamemakers take the rest of the map away and drive whoever is left
 * into one sector. It is listed in every pack so a player reading the picker
 * knows it is coming.
 */
export const CONVERGENCE: ArenaSetPiece = {
    id: 'convergence',
    name: 'The Convergence',
    summary: 'When six or fewer tributes are left, the arena closes to one sector and everyone alive is driven into it. Always happens.',
    kind: 'convergence',
    announce: 'The Gamemakers close the arena to {zones}. Every route out of the remaining sectors is shut. The tributes still alive are being driven to one place.',
};

const UNIVERSAL_EVENTS: ArenaSetPiece[] = [
    {
        id: 'universal-restock',
        name: 'The Resupply',
        summary: 'Crates are dropped at the Cornucopia and the drop is announced. Everyone short of food hears it.',
        kind: 'supplyDrop',
        minDay: 2,
        announce: 'Supply crates land at the Cornucopia. The drop is announced arena-wide.',
    },
    {
        id: 'universal-storm',
        name: 'The Front',
        summary: 'A storm crosses the arena. Every tribute not under cover takes damage and loses a night of rest.',
        kind: 'exposureSurge',
        amount: 14,
        minDay: 2,
        announce: 'A weather front crosses the arena. Tributes without shelter are exposed to it.',
    },
    {
        id: 'universal-mutts',
        name: 'The Release',
        summary: 'Mutts are released across the arena. Every tribute in the open is engaged by one.',
        kind: 'muttRelease',
        minDay: 3,
        announce: 'Mutts are released into the arena. Handlers are not recalling them.',
    },
    {
        id: 'universal-cut',
        name: 'The Severance',
        summary: 'Routes between sectors are cut. Alliances split across the map cannot regroup.',
        kind: 'severRoutes',
        amount: 4,
        minDay: 2,
        announce: 'Four routes between sectors are closed. The affected edges are: {zones}.',
    },
];

/**
 * The universal pack. Every arena without one of its own draws from this, and
 * every arena's own pack is this plus its bespoke set pieces — an arena should
 * be able to do something nowhere else does, without losing the beats a player
 * has learned to expect.
 */
export const UNIVERSAL_PACK: ArenaEventPack = {
    id: 'universal',
    name: 'Standard Gamemaker Package',
    summary: 'The four interventions the Capitol uses in any arena: a resupply, a storm front, a mutt release and a route closure.',
    events: [...UNIVERSAL_EVENTS, CONVERGENCE],
};

/** An arena-specific pack: its own set pieces, then the universal ones, then the convergence. */
function pack(id: string, name: string, summary: string, own: ArenaSetPiece[]): ArenaEventPack {
    return { id, name, summary, events: [...own, ...UNIVERSAL_EVENTS, CONVERGENCE] };
}

export const ARENA_EVENT_PACKS: Record<string, ArenaEventPack> = {
    clockwork: pack('clockwork', 'The Twelve Hours',
        'The island\'s clock can be made to strike out of sequence, or to stop.', [
        {
            id: 'clockwork-double-strike',
            name: 'The Double Strike',
            summary: 'Two sectors strike at once. Both are flooded and everyone in them is caught.',
            kind: 'effectSweep', effect: 'flooded', zones: 3, minDay: 2,
            announce: 'The clock strikes two hours at once. {zones} go under together.',
        },
        {
            id: 'clockwork-seized',
            name: 'The Seizure',
            summary: 'The island\'s machinery locks. Half the routes between sectors are cut for good.',
            kind: 'severRoutes', amount: 5, minDay: 3,
            announce: 'The drive shaft under the island seizes. These routes are now impassable: {zones}.',
        },
    ]),
    frozen: pack('frozen', 'The Whiteout',
        'Cold, and the two things cold does to an arena: it hides people and it kills them.', [
        {
            id: 'frozen-whiteout',
            name: 'The Whiteout',
            summary: 'A blizzard freezes four sectors. Every tribute in them takes cold damage and cannot travel.',
            kind: 'effectSweep', effect: 'frozen', zones: 4, minDay: 2,
            announce: 'A blizzard closes over {zones}. Visibility in those sectors is nil.',
        },
        {
            id: 'frozen-thaw',
            name: 'The Thaw',
            summary: 'The ice gives way. Routes across the lake and the channel are cut.',
            kind: 'severRoutes', amount: 4, minDay: 4,
            announce: 'The ice breaks up. These crossings are gone: {zones}.',
        },
    ]),
    concrete: pack('concrete', 'The Demolition',
        'A city can be brought down on the people inside it, a block at a time.', [
        {
            id: 'concrete-collapse',
            name: 'The Demolition',
            summary: 'Three sectors are brought down. They go out of bounds immediately, whoever is in them.',
            kind: 'earlyCollapse', amount: 3, minDay: 3,
            announce: 'Demolition charges bring down {zones}. Those sectors are out of bounds as of now.',
        },
        {
            id: 'concrete-floodlights',
            name: 'The Floodlights',
            summary: 'Every light in the city comes on. Every tribute\'s position is broadcast to every other tribute.',
            kind: 'revealAll', minDay: 2,
            announce: 'Every floodlight in the city comes on at once. Nothing in this arena is hidden.',
        },
    ]),
    toxic: pack('toxic', 'The Bloom',
        'The swamp is a chemical system, and the Gamemakers know which valve is which.', [
        {
            id: 'toxic-bloom',
            name: 'The Bloom',
            summary: 'Gas floods five sectors. Everyone in them is poisoned.',
            kind: 'effectSweep', effect: 'contaminated', zones: 5, minDay: 2,
            announce: 'The gas comes up across {zones}. The air in those sectors is not breathable.',
        },
        {
            id: 'toxic-drain',
            name: 'The Drain',
            summary: 'The water level drops. Routes across the swamp close and the map re-shapes.',
            kind: 'severRoutes', amount: 4, minDay: 3,
            announce: 'The swamp drains. These crossings no longer exist: {zones}.',
        },
    ]),
    solar: pack('solar', 'The Glare',
        'There is one resource in a desert and the Gamemakers control all of it.', [
        {
            id: 'solar-scour',
            name: 'The Scour',
            summary: 'A sandstorm strips four sectors of cover. Everyone in the open takes damage.',
            kind: 'effectSweep', effect: 'stripped', zones: 4, minDay: 2,
            announce: 'A sandstorm scours {zones}. There is no cover left in those sectors.',
        },
        {
            id: 'solar-mirage',
            name: 'The Mirage',
            summary: 'Every tribute\'s position is shown to every other. In open ground there is nowhere to go with that.',
            kind: 'revealAll', minDay: 3,
            announce: 'The arena sky shows every tribute where every other tribute is standing.',
        },
    ]),
    ashfall: pack('ashfall', 'The Fall',
        'Ash, fire, and the ground under both giving way.', [
        {
            id: 'ashfall-fall',
            name: 'The Fall',
            summary: 'Ash buries four sectors. Everyone in them is contaminated and blinded.',
            kind: 'effectSweep', effect: 'fogbound', zones: 4, minDay: 2,
            announce: 'Ashfall closes over {zones}. Nobody in those sectors can see more than a few metres.',
        },
        {
            id: 'ashfall-ignition',
            name: 'The Ignition',
            summary: 'Three sectors are set alight. Everyone in them burns.',
            kind: 'effectSweep', effect: 'burning', zones: 3, minDay: 3,
            announce: 'Fire is started in {zones}. It is not being contained.',
        },
    ]),
    // ---- §1 (requests): the five new arenas ----
    tidewrack: pack('tidewrack', 'The Tide Table',
        'The sea is the Gamemakers\' instrument here, and it moves on their schedule rather than the moon\'s.', [
        {
            id: 'tidewrack-spring-tide',
            name: 'The Spring Tide',
            summary: 'Five sectors go under. Everyone in them is swept and takes drowning damage.',
            kind: 'effectSweep', effect: 'flooded', zones: 5, minDay: 2,
            announce: 'The tide is brought in early across {zones}. Those sectors are under water.',
        },
        {
            id: 'tidewrack-neap',
            name: 'The Neap',
            summary: 'The water pulls out and the causeways change. Five routes are cut and the map is a different map.',
            kind: 'severRoutes', amount: 5, minDay: 3,
            announce: 'The water pulls back off the flats. These causeways are gone: {zones}.',
        },
    ]),
    thresher: pack('thresher', 'The Quota',
        'An arena run like a shift: the horn opens for the tributes who have met their number.', [
        {
            id: 'thresher-shift-change',
            name: 'The Shift Change',
            summary: 'The machinery starts. Three sectors become impassable and everyone in them is injured.',
            kind: 'earlyCollapse', amount: 3, minDay: 3,
            announce: 'The floor machinery in {zones} is started. Those sectors are out of bounds.',
        },
        {
            id: 'thresher-tally',
            name: 'The Tally',
            summary: 'Every tribute\'s kill count and position is broadcast. The ones with nothing on the board are named.',
            kind: 'revealAll', minDay: 2,
            announce: 'The tally is read out: every tribute\'s position, and every tribute\'s count.',
        },
    ]),
    vigil: pack('vigil', 'The Long Watch',
        'Nobody sleeps here, and the arena is built to make sure of it.', [
        {
            id: 'vigil-siren',
            name: 'The Siren',
            summary: 'A tone is played across the arena for a full cycle. Every tribute loses a night and takes fatigue damage.',
            kind: 'exposureSurge', amount: 10, minDay: 2,
            announce: 'A tone is played across the arena and not stopped. Nobody rests through it.',
        },
        {
            id: 'vigil-lamps',
            name: 'The Lamps',
            summary: 'Every position in the arena is lit and broadcast. There is no dark to hide in.',
            kind: 'revealAll', minDay: 3,
            announce: 'Every lamp in the arena comes up. Every tribute is visible to every other tribute.',
        },
    ]),
    saltworks: pack('saltworks', 'The Evaporation',
        'Ground that does not grow back, worked by people who have to keep moving across it.', [
        {
            id: 'saltworks-crust',
            name: 'The Crust',
            summary: 'Four sectors are stripped to bare salt. No cover, no forage, and the glare burns.',
            kind: 'effectSweep', effect: 'stripped', zones: 4, minDay: 2,
            announce: 'The pans in {zones} are drained to the crust. There is nothing left on that ground.',
        },
        {
            id: 'saltworks-subsidence',
            name: 'The Subsidence',
            summary: 'The worked ground gives way. Four sectors go out of bounds and the routes through them close.',
            kind: 'earlyCollapse', amount: 4, minDay: 3,
            announce: 'The worked ground under {zones} subsides. Those sectors are out of bounds.',
        },
    ]),
    kiln: pack('kiln', 'The Firing',
        'Two suns, no shade, and a Gamemaker with a hand on the temperature.', [
        {
            id: 'kiln-firing',
            name: 'The Firing',
            summary: 'The temperature is raised arena-wide. Every tribute takes heat damage and their water goes.',
            kind: 'exposureSurge', amount: 16, minDay: 2,
            announce: 'The arena temperature is raised. There is no sector in here that is out of it.',
        },
        {
            id: 'kiln-glaze',
            name: 'The Glaze',
            summary: 'Three sectors are set alight and fused. They go out of bounds with whoever is in them.',
            kind: 'earlyCollapse', amount: 3, minDay: 3,
            announce: 'The ground in {zones} is fired to glass. Those sectors are out of bounds.',
        },
    ]),
};

/** The pack this arena draws from. Every arena has one; most have their own. */
export function packFor(arena: Pick<Arena, 'id' | 'eventPack'>): ArenaEventPack {
    return ARENA_EVENT_PACKS[arena.eventPack ?? arena.id] ?? UNIVERSAL_PACK;
}
