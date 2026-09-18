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
    /*
     * AUDIT-6 §5.2: thirty-four of the forty-five arenas used to end up here by
     * falling through `packFor`'s `?? UNIVERSAL_PACK`, which meant the Menagerie,
     * the Abattoir, the Labyrinth and thirty-one others offered the identical
     * five Gamemaker interventions — a resupply, a storm, a mutt release, a
     * route closure and the convergence. Three of the eight `SetPieceKind`s
     * (`effectSweep`, `earlyCollapse`, `revealAll`) appeared only in the eleven
     * bespoke packs, so most of the arenas in the game could never produce the
     * three most arena-shaped beats available.
     *
     * Each arena below now declares two of its own, chosen from what that arena
     * already is rather than from what was easy to reuse: the Abattoir starts
     * its lines, the school runs its bell schedule, the Story Wood lights every
     * chimney at once. `validate-arenas` fails on any arena still without one.
     */
    tempest: pack('tempest', 'The Surge',
        'The storm is a dial and the Gamemakers have not finished turning it.', [
        {
            id: 'tempest-surge',
            name: 'The Surge',
            summary: 'A storm surge floods five sectors. Everyone in them is swept and soaked.',
            kind: 'effectSweep', effect: 'flooded', zones: 5, minDay: 2,
            announce: 'The surge comes over the sea wall and takes {zones}. Nothing in those sectors stays dry.',
        },
        {
            id: 'tempest-eye',
            name: 'The Eye',
            summary: 'The storm stops. For one cycle the arena is silent, and everybody can hear everybody.',
            kind: 'revealAll', minDay: 3,
            announce: 'The eye passes over the arena. The wind drops to nothing, and for one cycle every sound carries.',
        },
    ]),
    saltflats: pack('saltflats', 'The Mirror',
        'A flat white plate with a sun on both sides of it.', [
        {
            id: 'saltflats-glare',
            name: 'The Second Sun',
            summary: 'The crust throws the light back. Every tribute in the open burns from below.',
            kind: 'exposureSurge', amount: 16, minDay: 2,
            announce: 'The salt turns mirror-bright. Anyone not under cover is taking the sun twice.',
        },
        {
            id: 'saltflats-crust',
            name: 'The Break',
            summary: 'The crust gives. Four routes across the pan are gone.',
            kind: 'severRoutes', amount: 4, minDay: 3,
            announce: 'The salt crust breaks up under its own weight. These crossings are gone: {zones}.',
        },
    ]),
    sporefields: pack('sporefields', 'The Fruiting',
        'A forest that is one organism, and it has been told to fruit.', [
        {
            id: 'sporefields-fruiting',
            name: 'The Fruiting',
            summary: 'Five sectors go up in spore. Everyone in them breathes it.',
            kind: 'effectSweep', effect: 'contaminated', zones: 5, minDay: 2,
            announce: 'The fruiting bodies open across {zones}. The air in those sectors is more spore than air.',
        },
        {
            id: 'sporefields-bloom',
            name: 'The Flush',
            summary: 'The forest fruits edible. Three sectors are suddenly, briefly, generous.',
            kind: 'effectSweep', effect: 'blooming', zones: 3, minDay: 3,
            announce: 'A clean flush comes up across {zones}. For a while those sectors will feed anyone standing in them.',
        },
    ]),
    canopy: pack('canopy', 'The Long Drop',
        'Everything here is held up by something, and the Gamemakers know what.', [
        {
            id: 'canopy-shear',
            name: 'The Shear',
            summary: 'Four walkways are cut. Whoever is split is split.',
            kind: 'severRoutes', amount: 4, minDay: 2,
            announce: 'The Gamemakers cut four spans. These routes no longer exist: {zones}.',
        },
        {
            id: 'canopy-fall',
            name: 'The Fall',
            summary: 'Three platforms are dropped into the understory. They go out of bounds where they stand.',
            kind: 'earlyCollapse', amount: 3, minDay: 3,
            announce: 'Three platforms are released and go into the understory: {zones}. Those sectors are out of bounds.',
        },
    ]),
    vault: pack('vault', 'The Lights',
        'A sealed box with a switch on the outside of it.', [
        {
            id: 'vault-blackout',
            name: 'The Blackout',
            summary: 'Every light goes out. Four sectors go blind and stay blind.',
            kind: 'effectSweep', effect: 'fogbound', zones: 4, minDay: 2,
            announce: 'The lights go out across {zones}. There is no sky down here to fall back on.',
        },
        {
            id: 'vault-census',
            name: 'The Census',
            summary: 'Every door reports. Every tribute\'s position is put on the ceiling.',
            kind: 'revealAll', minDay: 3,
            announce: 'The complex takes a census. Every position is projected onto the ceiling, in order, by district.',
        },
    ]),
    warren: pack('warren', 'The Dust',
        'Six chambers, no sky, and a great deal of loose rock overhead.', [
        {
            id: 'warren-fall',
            name: 'The Fall',
            summary: 'Two chambers come down. They go out of bounds immediately.',
            kind: 'earlyCollapse', amount: 2, minDay: 3,
            announce: 'Two chambers come down: {zones}. Nobody is going back in for anything.',
        },
        {
            id: 'warren-dust',
            name: 'The Dust',
            summary: 'Rock dust fills three chambers. Everyone in them is choking.',
            kind: 'effectSweep', effect: 'contaminated', zones: 3, minDay: 2,
            announce: 'Rock dust rolls through {zones}. Breathing in those chambers costs something.',
        },
    ]),
    islands: pack('islands', 'The Drift',
        'Islands that are not where they were, joined by ropes that are not all still there.', [
        {
            id: 'islands-cut',
            name: 'The Cutting',
            summary: 'Five bridges are dropped. The archipelago is a different shape.',
            kind: 'severRoutes', amount: 5, minDay: 2,
            announce: 'Five spans are cut and go into the fog: {zones}.',
        },
        {
            id: 'islands-clear',
            name: 'The Clearing',
            summary: 'The magnetic fog lifts. For one cycle everyone can see every island.',
            kind: 'revealAll', minDay: 3,
            announce: 'The fog thins to nothing. Every island is visible from every other, and so is everyone on them.',
        },
    ]),
    eclipse: pack('eclipse', 'The Pitch',
        'A forest lit by things that burn, and things that burn can be opened.', [
        {
            id: 'eclipse-vents',
            name: 'The Vents',
            summary: 'The pitch-vents open. Four sectors catch and stay caught.',
            kind: 'effectSweep', effect: 'burning', zones: 4, minDay: 2,
            announce: 'The pitch-vents under {zones} open together. Those sectors are burning.',
        },
        {
            id: 'eclipse-ceiling',
            name: 'The Ceiling',
            summary: 'The artificial stars go out. Five sectors lose what light they had.',
            kind: 'effectSweep', effect: 'fogbound', zones: 5, minDay: 3,
            announce: 'The ceiling goes dark over {zones}. Whatever the fungus gives is all there is now.',
        },
    ]),
    reef: pack('reef', 'The Return',
        'A sea floor with no sea in it, which is a decision somebody can reverse.', [
        {
            id: 'reef-flood',
            name: 'The Return',
            summary: 'Water comes back into four trenches. Everyone in them is in it.',
            kind: 'effectSweep', effect: 'flooded', zones: 4, minDay: 2,
            announce: 'Water is put back into {zones}. The trenches fill from the bottom.',
        },
        {
            id: 'reef-anemone',
            name: 'The Wake',
            summary: 'The anemone fields wake. Three sectors sting anything that crosses them.',
            kind: 'effectSweep', effect: 'swarming', zones: 3, minDay: 3,
            announce: 'The anemone fields across {zones} come awake together.',
        },
    ]),
    abattoir: pack('abattoir', 'The Line',
        'A factory that never quite stopped, being switched back on.', [
        {
            id: 'abattoir-line',
            name: 'The Line',
            summary: 'The conveyor lines start. Three floors are machinery again.',
            kind: 'effectSweep', effect: 'quaking', zones: 3, minDay: 2,
            announce: 'The lines start up under {zones}. Those floors are moving now.',
        },
        {
            id: 'abattoir-render',
            name: 'The Render',
            summary: 'The rendering pits are lit. Four sectors go to furnace heat.',
            kind: 'effectSweep', effect: 'burning', zones: 4, minDay: 3,
            announce: 'The rendering pits are lit under {zones}. The heat comes up through the floor.',
        },
    ]),
    carnival: pack('carnival', 'The Midway',
        'A park that remembers being a park.', [
        {
            id: 'carnival-open',
            name: 'Opening Night',
            summary: 'Every ride starts. Every tribute is lit and announced.',
            kind: 'revealAll', minDay: 2,
            announce: 'Every ride on the midway starts at once, and the lights come up on everybody.',
        },
        {
            id: 'carnival-fog',
            name: 'The Fog Machines',
            summary: 'The fog machines run. Five sectors go blind.',
            kind: 'effectSweep', effect: 'fogbound', zones: 5, minDay: 3,
            announce: 'The fog machines come on across {zones} and do not stop.',
        },
    ]),
    ashwaste: pack('ashwaste', 'The Caldera',
        'A ring of ash around something that has not finished.', [
        {
            id: 'ashwaste-fall',
            name: 'The Fall',
            summary: 'The ashfall thickens over five sectors. Everyone in them is breathing it.',
            kind: 'effectSweep', effect: 'contaminated', zones: 5, minDay: 2,
            announce: 'The ashfall thickens over {zones}. It is coming down faster than it settles.',
        },
        {
            id: 'ashwaste-rim',
            name: 'The Rim',
            summary: 'The caldera rim gives. Two sectors go out of bounds where they stand.',
            kind: 'earlyCollapse', amount: 2, minDay: 3,
            announce: 'The rim gives under {zones}. Those sectors are gone.',
        },
    ]),
    quarry: pack('quarry', 'The Benches',
        'A hole with roads in it, and the roads are the only way up.', [
        {
            id: 'quarry-bench',
            name: 'The Bench Failure',
            summary: 'Two benches go. The spiral road is cut in two places.',
            kind: 'earlyCollapse', amount: 2, minDay: 3,
            announce: 'Two benches go down the face: {zones}. The road is cut.',
        },
        {
            id: 'quarry-flood',
            name: 'The Rise',
            summary: 'The flooded centre rises. Three of the lowest sectors go under.',
            kind: 'effectSweep', effect: 'flooded', zones: 3, minDay: 2,
            announce: 'The water at the bottom of the pit is coming up through {zones}.',
        },
    ]),
    glacier: pack('glacier', 'The Calving',
        'Ice above, ice below, and a great deal of it ready to move.', [
        {
            id: 'glacier-calve',
            name: 'The Calving',
            summary: 'The face calves. Two cave systems are crushed and closed.',
            kind: 'earlyCollapse', amount: 2, minDay: 3,
            announce: 'The glacier face calves over {zones}. Those caves are closed.',
        },
        {
            id: 'glacier-whiteout',
            name: 'The Surface Whiteout',
            summary: 'The surface goes white. Four sectors freeze and blind together.',
            kind: 'effectSweep', effect: 'frozen', zones: 4, minDay: 2,
            announce: 'A whiteout closes over {zones}. Nobody on the surface can see the next flag.',
        },
    ]),
    floe: pack('floe', 'The Break-Up',
        'Plates of ice on black water, and the plates are not fixed to anything.', [
        {
            id: 'floe-breakup',
            name: 'The Break-Up',
            summary: 'The pack breaks. Five crossings between plates are gone.',
            kind: 'severRoutes', amount: 5, minDay: 2,
            announce: 'The pack breaks up. These crossings are open water now: {zones}.',
        },
        {
            id: 'floe-leads',
            name: 'The Leads',
            summary: 'Open leads appear in four plates. Everyone on them is in the water or near it.',
            kind: 'effectSweep', effect: 'flooded', zones: 4, minDay: 3,
            announce: 'Leads open across {zones}. The ice there will not hold a standing person.',
        },
    ]),
    alpine: pack('alpine', 'The Load',
        'A great deal of snow, held at an angle, above everything worth having.', [
        {
            id: 'alpine-avalanche',
            name: 'The Release',
            summary: 'The loaded slopes are released. Three sectors are buried.',
            kind: 'earlyCollapse', amount: 3, minDay: 3,
            announce: 'The snowfields above {zones} are released. Those sectors are under it.',
        },
        {
            id: 'alpine-timber',
            name: 'The Timber',
            summary: 'Fire is put into the heavy timber. Four sectors burn.',
            kind: 'effectSweep', effect: 'burning', zones: 4, minDay: 2,
            announce: 'Fire goes into the timber across {zones}.',
        },
    ]),
    terraces: pack('terraces', 'The Steps',
        'A mountain cut into steps, and steps can be taken away.', [
        {
            id: 'terraces-drop',
            name: 'The Drop',
            summary: 'Two terraces are dropped. They go out of bounds where they stand.',
            kind: 'earlyCollapse', amount: 2, minDay: 3,
            announce: 'Two terraces are dropped: {zones}. There is no route across them now.',
        },
        {
            id: 'terraces-cables',
            name: 'The Cables',
            summary: 'The cable runs are cut. Four routes between terraces are gone.',
            kind: 'severRoutes', amount: 4, minDay: 2,
            announce: 'The cable runs are cut. These routes are gone: {zones}.',
        },
    ]),
    seapeaks: pack('seapeaks', 'The Weather',
        'Peaks in an ocean, with nothing between them but the weather.', [
        {
            id: 'seapeaks-squall',
            name: 'The Squall Line',
            summary: 'A squall crosses the chain. Everyone above the water line is exposed to it.',
            kind: 'exposureSurge', amount: 15, minDay: 2,
            announce: 'A squall line crosses the chain. There is no lee side on any of these peaks.',
        },
        {
            id: 'seapeaks-ice',
            name: 'The Rime',
            summary: 'Rime ice closes four peaks. Climbing them is a different problem now.',
            kind: 'effectSweep', effect: 'frozen', zones: 4, minDay: 3,
            announce: 'Rime ice closes over {zones}. Every hold on those faces is glazed.',
        },
    ]),
    canopyweb: pack('canopyweb', 'The Web',
        'A forest with no floor, and the floor it does have is poison.', [
        {
            id: 'canopyweb-cut',
            name: 'The Cut Lines',
            summary: 'Five web spans are cut. The canopy is a different graph.',
            kind: 'severRoutes', amount: 5, minDay: 2,
            announce: 'Five spans are cut out of the web: {zones}.',
        },
        {
            id: 'canopyweb-fogrise',
            name: 'The Rise',
            summary: 'The nitrogen fog rises into four sectors. Everyone in them is in it.',
            kind: 'effectSweep', effect: 'contaminated', zones: 4, minDay: 3,
            announce: 'The fog comes up into {zones}. It was never meant to reach that high.',
        },
    ]),
    acousticforest: pack('acousticforest', 'The Organ',
        'A forest built to make noise, played on purpose.', [
        {
            id: 'acousticforest-chord',
            name: 'The Chord',
            summary: 'The canopy is made to sound. Every tribute is located by it.',
            kind: 'revealAll', minDay: 2,
            announce: 'The wind is put through the canopy at pitch. Every tribute in the wood is placed by the sound they make in it.',
        },
        {
            id: 'acousticforest-shatter',
            name: 'The Shatter',
            summary: 'The resonance takes four sectors of hollow timber down.',
            kind: 'earlyCollapse', amount: 4, minDay: 3,
            announce: 'The resonance is held until the timber goes. These sectors are down: {zones}.',
        },
    ]),
    burnscar: pack('burnscar', 'The Second Burn',
        'Ground that has burned once and is dry enough to do it again.', [
        {
            id: 'burnscar-reburn',
            name: 'The Second Burn',
            summary: 'The fireweed takes. Five sectors burn a second time.',
            kind: 'effectSweep', effect: 'burning', zones: 5, minDay: 2,
            announce: 'The fireweed goes up across {zones}. It is drier than it was three years ago.',
        },
        {
            id: 'burnscar-snags',
            name: 'The Snag Fall',
            summary: 'The standing dead come down across three sectors.',
            kind: 'earlyCollapse', amount: 3, minDay: 3,
            announce: 'The standing dead come down across {zones}. Those sectors are not passable.',
        },
    ]),
    craterfield: pack('craterfield', 'The Ordnance',
        'A proving ground that was never cleared.', [
        {
            id: 'craterfield-ordnance',
            name: 'The Ordnance',
            summary: 'Buried ordnance is triggered. Three craters go out of bounds.',
            kind: 'earlyCollapse', amount: 3, minDay: 3,
            announce: 'Buried ordnance is triggered under {zones}. Those craters are out of bounds.',
        },
        {
            id: 'craterfield-gas',
            name: 'The Seep',
            summary: 'The stagnant ponds turn. Four sectors go foul.',
            kind: 'effectSweep', effect: 'contaminated', zones: 4, minDay: 2,
            announce: 'Something in the ponds under {zones} turns over. The air above them is not clean.',
        },
    ]),
    culdesac: pack('culdesac', 'The Neighbourhood',
        'Sixty-two houses, all of them working, none of them yours.', [
        {
            id: 'culdesac-porchlights',
            name: 'The Porch Lights',
            summary: 'Every porch light comes on. Everyone is on somebody\'s doorstep.',
            kind: 'revealAll', minDay: 2,
            announce: 'Every porch light on the loop comes on at once. Everybody is standing somewhere, and now everybody knows where.',
        },
        {
            id: 'culdesac-gas',
            name: 'The Gas Mains',
            summary: 'The mains go. Three houses burn where they stand.',
            kind: 'effectSweep', effect: 'burning', zones: 3, minDay: 3,
            announce: 'The gas mains are opened under {zones}.',
        },
    ]),
    labyrinth: pack('labyrinth', 'The Walls',
        'A hedge that was this shape yesterday.', [
        {
            id: 'labyrinth-shift',
            name: 'The Shift',
            summary: 'The hedges move. Five routes through the maze close.',
            kind: 'severRoutes', amount: 5, minDay: 2,
            announce: 'The walls move on rails. These routes are closed: {zones}.',
        },
        {
            id: 'labyrinth-gardeners',
            name: 'The Gardeners',
            summary: 'The yew is cut back. Four sectors lose every scrap of cover.',
            kind: 'effectSweep', effect: 'stripped', zones: 4, minDay: 3,
            announce: 'The yew across {zones} is cut back to the stem. There is nothing to stand behind.',
        },
    ]),
    ashgrove: pack('ashgrove', 'The Timetable',
        'A school running its bell schedule with nobody to hear it.', [
        {
            id: 'ashgrove-lockdown',
            name: 'The Lockdown',
            summary: 'The lockdown doors close. Five corridors are sealed.',
            kind: 'severRoutes', amount: 5, minDay: 2,
            announce: 'The lockdown doors close on schedule. These routes are sealed: {zones}.',
        },
        {
            id: 'ashgrove-bell',
            name: 'The Bell',
            summary: 'The bell rings for assembly and the address system names everyone present.',
            kind: 'revealAll', minDay: 3,
            announce: 'The bell rings for assembly. The address system reads out every name and every room.',
        },
    ]),
    kelvin: pack('kelvin', 'The Fuel',
        'A station with eleven days of fuel and fewer than that of people.', [
        {
            id: 'kelvin-cut',
            name: 'The Cut',
            summary: 'The generator is cut to four sectors. They go to outside temperature.',
            kind: 'effectSweep', effect: 'frozen', zones: 4, minDay: 2,
            announce: 'Heat is cut to {zones}. Those sections go to outside temperature within the hour.',
        },
        {
            id: 'kelvin-shelf',
            name: 'The Shelf',
            summary: 'The ice shelf fractures. Three routes off the station are gone.',
            kind: 'severRoutes', amount: 3, minDay: 3,
            announce: 'The shelf fractures under the station. These routes are gone: {zones}.',
        },
    ]),
    silkwood: pack('silkwood', 'The Weaving',
        'A wood strung with silk, and the things that strung it.', [
        {
            id: 'silkwood-weave',
            name: 'The Weaving',
            summary: 'The wood is strung shut. Four routes are closed with silk.',
            kind: 'severRoutes', amount: 4, minDay: 2,
            announce: 'The wood is strung shut overnight. These routes are closed: {zones}.',
        },
        {
            id: 'silkwood-hatch',
            name: 'The Hatch',
            summary: 'Three sectors hatch at once.',
            kind: 'effectSweep', effect: 'swarming', zones: 3, minDay: 3,
            announce: 'Everything in {zones} hatches on the same morning.',
        },
    ]),
    nooneplace: pack('nooneplace', 'The Floors',
        'It goes on. That is the whole of it.', [
        {
            id: 'nooneplace-rearrange',
            name: 'The Rearrangement',
            summary: 'The floor plan changes. Five routes no longer connect.',
            kind: 'severRoutes', amount: 5, minDay: 2,
            announce: 'The floor plan is not what it was. These routes do not connect any more: {zones}.',
        },
        {
            id: 'nooneplace-lights',
            name: 'The Fluorescents',
            summary: 'The lights fail in four sections and are not repaired.',
            kind: 'effectSweep', effect: 'fogbound', zones: 4, minDay: 3,
            announce: 'The fluorescents fail across {zones}. Nobody comes to fix them.',
        },
    ]),
    redcathedral: pack('redcathedral', 'The Canyon',
        'Water at the bottom, shade at the top, a mile between them.', [
        {
            id: 'redcathedral-flood',
            name: 'The Flash Flood',
            summary: 'Rain upstream. Four sectors of the floor go under without warning.',
            kind: 'effectSweep', effect: 'flooded', zones: 4, minDay: 2,
            announce: 'It is raining somewhere upstream. {zones} are underwater within the hour.',
        },
        {
            id: 'redcathedral-rockfall',
            name: 'The Rockfall',
            summary: 'The rim gives. Three sectors are closed by it.',
            kind: 'earlyCollapse', amount: 3, minDay: 3,
            announce: 'The rim gives over {zones}. Those sectors are closed.',
        },
    ]),
    menagerie: pack('menagerie', 'The Schedule',
        'The release schedule is posted at the gate, and it is accurate.', [
        {
            id: 'menagerie-release',
            name: 'The General Release',
            summary: 'Every enclosure opens at once.',
            kind: 'muttRelease', minDay: 2,
            announce: 'Every enclosure in the park opens on the same signal. The schedule said it would.',
        },
        {
            id: 'menagerie-habitats',
            name: 'The Habitats',
            summary: 'The habitat systems run to specification. Four sectors go to their design climate.',
            kind: 'effectSweep', effect: 'contaminated', zones: 4, minDay: 3,
            announce: 'The habitat systems in {zones} run to specification. They were never built for people.',
        },
    ]),
    storywood: pack('storywood', 'The Bargains',
        'Every door opens. Every one of them costs something.', [
        {
            id: 'storywood-ovens',
            name: 'The Ovens',
            summary: 'Every chimney draws. Four cottages are burning with their doors open.',
            kind: 'effectSweep', effect: 'burning', zones: 4, minDay: 2,
            announce: 'Every chimney in {zones} draws at once. The doors stay open.',
        },
        {
            id: 'storywood-brambles',
            name: 'The Brambles',
            summary: 'The wood closes four paths with thorn.',
            kind: 'severRoutes', amount: 4, minDay: 3,
            announce: 'The wood closes over these paths in a single night: {zones}.',
        },
    ]),
    cabin: pack('cabin', 'The Cold',
        'Four thin walls, a working stove, and a killing cold outside them.', [
        {
            id: 'cabin-stove',
            name: 'The Stove Out',
            summary: 'The stove is put out. Four sectors go to outside temperature.',
            kind: 'effectSweep', effect: 'frozen', zones: 4, minDay: 2,
            announce: 'The stove goes out, and stays out. {zones} are at outside temperature now.',
        },
        {
            id: 'cabin-drifts',
            name: 'The Drifts',
            summary: 'The drifts close three ways off the homestead.',
            kind: 'severRoutes', amount: 3, minDay: 3,
            announce: 'The drifts come over in the night. These ways off are closed: {zones}.',
        },
    ]),
    magmatube: pack('magmatube', 'The Throat',
        'The mountain has a temperature and it is being adjusted.', [
        {
            id: 'magmatube-surge',
            name: 'The Surge',
            summary: 'The heat comes up. Five sectors go to furnace.',
            kind: 'effectSweep', effect: 'burning', zones: 5, minDay: 2,
            announce: 'The glow comes up through {zones}. Standing still in those sectors is not survivable.',
        },
        {
            id: 'magmatube-collapse',
            name: 'The Throat Closes',
            summary: 'Two galleries close. They go out of bounds where they stand.',
            kind: 'earlyCollapse', amount: 2, minDay: 3,
            announce: 'Two galleries close: {zones}. The mountain does that.',
        },
    ]),
    karst: pack('karst', 'The Water Table',
        'No sky, no light, and a great deal of water that can be moved.', [
        {
            id: 'karst-rise',
            name: 'The Rise',
            summary: 'The water table comes up. Four galleries flood.',
            kind: 'effectSweep', effect: 'flooded', zones: 4, minDay: 2,
            announce: 'The water table comes up into {zones}. It is not going back down.',
        },
        {
            id: 'karst-dark',
            name: 'The Dark',
            summary: 'The glowing fungus is killed off across five galleries.',
            kind: 'effectSweep', effect: 'fogbound', zones: 5, minDay: 3,
            announce: 'The fungus in {zones} is killed off overnight. There was never anything else down there.',
        },
    ]),
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

/**
 * The pack this arena draws from.
 *
 * AUDIT-6 §1.5/§5.2: this comment used to read "Every arena has one; most have
 * their own", and the second half was false by a wide margin — there were
 * eleven packs against forty-five arenas, so thirty-four of them fell through
 * to `UNIVERSAL_PACK` and shared an identical five-item Gamemaker menu. A
 * reader of this function came away believing the arena layer was covered.
 *
 * `validate-arenas` now reports the fallback count, so the number is visible in
 * the check roster instead of only in this file.
 */
export function packFor(arena: Pick<Arena, 'id' | 'eventPack'>): ArenaEventPack {
    return ARENA_EVENT_PACKS[arena.eventPack ?? arena.id] ?? UNIVERSAL_PACK;
}

/** True when this arena has no pack of its own and draws the universal five. */
export function usesUniversalPack(arena: Pick<Arena, 'id' | 'eventPack'>): boolean {
    return ARENA_EVENT_PACKS[arena.eventPack ?? arena.id] === undefined;
}
