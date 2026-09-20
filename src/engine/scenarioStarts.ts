import { GameState, ScenarioStartId, Tribute } from '../models/types';
import { SCENARIO_STARTS } from '../data/balance';
import { ITEMS } from '../data/constants';
import { isVertical } from './verticality';
import { RNG } from '../utils/rng';

/**
 * AUDIT-9 batch 5: Games that start somewhere other than the beginning.
 *
 * The audit's §10 asks for "scenario starts: separated allies, a damaged
 * crossing, a contested medical cache, asymmetric information", with one
 * condition attached that matters more than the content does:
 *
 *   "These should exercise existing mechanics and remain separate from the
 *    standard balance baseline."
 *
 * Both halves are load-bearing. *Exercise existing mechanics* rules out
 * inventing anything: every start below is a legal `GameState` reachable by
 * ordinary play, assembled at cycle zero instead of arrived at on day six.
 * A scenario that needed a new rule would be a new game mode wearing a
 * scenario's clothes.
 *
 * *Separate from the baseline* is the part a balance harness has to enforce
 * rather than intend. A field that starts with its allies split across the map
 * has a different mortality curve by construction, and sweeping those runs
 * into `metrics.ts` would move every indicator in this audit for reasons that
 * have nothing to do with the engine. `initialRunState` takes scenarios only
 * when asked, the harnesses never ask, and `check-scenario-starts` asserts
 * that the baseline sweep is scenario-free.
 */

export interface ScenarioStart {
    id: ScenarioStartId;
    name: string;
    blurb: string;
    /** Rearranges an already-built opening state. Never invents a rule. */
    apply(state: GameState, rng: RNG): void;
}

/** Everybody alive, in a stable order, so a scenario replays identically. */
function cast(state: GameState): Tribute[] {
    return state.tributes.filter(t => t.status === 'alive');
}

function zonesOf(state: GameState): string[] {
    return state.arena.zones.map(z => z.name);
}

export const SCENARIO_STARTS_LIST: ScenarioStart[] = [
    {
        id: 'separated-allies',
        name: 'Separated',
        blurb: 'District partners wake on opposite sides of the map. Everything that would have held them together has to reach across it first.',
        /*
         * Exercises: movement costs, obligations at range, the belief system
         * (a partner you cannot see is a partner you have to guess about),
         * and the rescue line if one of them goes down before they meet.
         */
        apply(state, rng) {
            const zones = zonesOf(state);
            if (zones.length < 2) return;
            const byDistrict = new Map<number, Tribute[]>();
            cast(state).forEach(t => {
                byDistrict.set(t.district, [...(byDistrict.get(t.district) ?? []), t]);
            });
            // Deterministic: districts in order, partners to opposite ends of
            // the zone list, so the same seed lays the map out the same way.
            [...byDistrict.keys()].sort((a, b) => a - b).forEach((district, i) => {
                const pair = byDistrict.get(district)!;
                if (pair.length < 2) return;
                pair[0].zone = zones[i % zones.length];
                pair[1].zone = zones[(i + Math.floor(zones.length / 2)) % zones.length];
                pair.forEach(t => { if (!isVertical(state.arena, t.zone)) t.zoneLevel = undefined; });
            });
            void rng;
        },
    },
    {
        id: 'damaged-crossing',
        name: 'The Crossing Is Out',
        blurb: 'A route is already gone when the gong sounds. The map everybody memorised is not the map they are standing on.',
        /*
         * Exercises: the severed-edge machinery, route planning, and the
         * cartographer's whole reason to exist. Deliberately severs an edge
         * rather than collapsing a zone — a missing route reshapes traffic,
         * a missing zone just makes the arena smaller.
         */
        apply(state, rng) {
            const withNeighbours = state.arena.zones.filter(z => z.adjacent.length > 1);
            if (withNeighbours.length === 0) return;
            const from = rng.pick(withNeighbours);
            const to = rng.pick(from.adjacent.filter(n =>
                (state.arena.zones.find(z => z.name === n)?.adjacent.length ?? 0) > 1));
            if (!to) return;
            state.severedEdges = [...(state.severedEdges ?? []), [from.name, to].sort().join('->')];
        },
    },
    {
        id: 'contested-cache',
        name: 'The Medicine Is In One Place',
        blurb: 'Every kit in the arena is in a single sector, and everybody knows it.',
        /*
         * Exercises: the Broker and the Medic, obligations, the appeal, and
         * the whole question of whether a group can hold ground worth holding.
         * Asymmetric *value* rather than asymmetric information.
         */
        apply(state, rng) {
            const medical = ITEMS.find(i => i.type === 'medical');
            if (!medical) return;
            const zone = rng.pick(zonesOf(state));
            // Strip the field of medicine, then pile it into one sector's
            // abandoned-camp cache, which is an existing object the scavenging
            // and looting layers already understand.
            cast(state).forEach(t => { t.inventory = t.inventory.filter(i => i.type !== 'medical'); });
            state.abandonedCamps = state.abandonedCamps ?? [];
            state.abandonedCamps.push({
                zone,
                ownerId: '',
                ownerName: 'whoever got there first last year',
                cycle: 0,
                items: Array.from({ length: SCENARIO_STARTS.cacheSize }, () => medical.id),
            });
            // And everybody has heard. Asymmetric information would be the
            // other scenario; this one is a race everyone can see.
            state.zoneDeaths = state.zoneDeaths ?? {};
        },
    },
    {
        id: 'walking-wounded',
        name: 'Nobody Came In Whole',
        blurb: 'The reaping was a bad one. Half the field starts carrying something that has not healed.',
        /*
         * Exercises: the wound, infection and treatment layers from the first
         * cycle instead of the fourth, plus the Medic, the appeal and the
         * rescue line. The audit's "asymmetric information" start is not here
         * on purpose — see the note in `check-scenario-starts`.
         */
        apply(state, rng) {
            const hurt = rng.shuffle(cast(state)).slice(0, Math.floor(cast(state).length / 2));
            hurt.forEach(t => {
                t.health = Math.max(SCENARIO_STARTS.woundedFloor, t.health - SCENARIO_STARTS.woundedDamage);
                t.injuries = { ...t.injuries, bleeding: false };
                t.vitals.fatigue = Math.min(100, t.vitals.fatigue + SCENARIO_STARTS.woundedFatigue);
            });
        },
    },
];

export function scenarioStart(id: ScenarioStartId): ScenarioStart | undefined {
    return SCENARIO_STARTS_LIST.find(s => s.id === id);
}

/**
 * Apply a scenario to a freshly built opening state.
 *
 * Seeded off the run's own seed plus the scenario id, so a scenario is as
 * reproducible as the Games it modifies and two different scenarios on one
 * seed do not draw from the same stream.
 */
export function applyScenarioStart(state: GameState, id: ScenarioStartId) {
    const scenario = scenarioStart(id);
    if (!scenario) return;
    scenario.apply(state, new RNG(`${state.seed}-scenario-${id}`));
    state.scenarioStart = id;
}
