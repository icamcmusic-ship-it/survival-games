/**
 * AUDIT-9 stage C: authored scenarios, as distinct from random sweeps.
 *
 * The audit's completion gate for stage C is "several authored scenario tests
 * demonstrate different sensible outcomes; no impossible actions or
 * conservation errors". Nothing in this repository could express that. Every
 * existing check is one of two things: a sweep of whole random games
 * (`soak`, `metrics`, `check-decisions`) that can only ever assert aggregates,
 * or a static check that never starts the simulator at all.
 *
 * Neither can state a proposition like "a tribute who spends the cycle
 * crossing a river does not also craft, forage and negotiate", because both
 * are the wrong shape for it: an aggregate cannot see one tribute's cycle, and
 * a static check cannot see behaviour. The missing instrument is a way to put
 * the world in a known position, run exactly one step, and say what should
 * have happened — which is what this file is.
 *
 * Determinism is the whole point. A scenario names its seed and its cast, so a
 * failure is a sentence about the engine rather than a note that something is
 * rarer than it used to be.
 */
import { Tribute } from '../src/models/types';
import { DEFAULT_GAME_CONFIG, ARENAS } from '../src/data/constants';
import { initialRunState } from './runInit';
import { Simulator } from '../src/engine/simulator';

export interface Scenario {
    name: string;
    /** What this scenario is evidence *for*. Printed on failure. */
    asserts: string;
    run(): void;
}

const failures: string[] = [];
let ran = 0;

export function scenario(name: string, asserts: string, run: () => void) {
    ran++;
    try {
        run();
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failures.push(`${name}\n      asserts: ${asserts}\n      failed:  ${(e as Error).message}`);
        console.log(`  ✗ ${name} — ${(e as Error).message}`);
    }
}

export function check(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

export function eq<T>(actual: T, expected: T, what: string) {
    if (actual !== expected) throw new Error(`${what}: expected ${String(expected)}, got ${String(actual)}`);
}

/**
 * A run positioned by hand.
 *
 * Built on `initialRunState` rather than a literal, so a scenario plays the
 * same initialisation production does — the lesson of B19, where two harnesses
 * hand-rolled their own starting state and both had drifted from the store.
 * The scenario then *moves* things rather than inventing them: the cast, the
 * arena and the config are real, and `place` puts named tributes where the
 * proposition needs them.
 */
export function world(seed: string, opts: { arenaId?: string; day?: number } = {}) {
    const state = initialRunState({
        seed,
        arenaId: opts.arenaId ?? ARENAS[0].id,
        config: DEFAULT_GAME_CONFIG,
    });
    state.phase = 'day';
    state.day = opts.day ?? 1;
    state.cycle = opts.day ?? 1;
    state.timeOfDay = 'day';
    return {
        state,
        /** The nth living tribute, by a stable order rather than by luck. */
        tribute(n: number): Tribute {
            const t = state.tributes.filter(x => x.status === 'alive')[n];
            if (!t) throw new Error(`no living tribute at index ${n}`);
            return t;
        },
        place(t: Tribute, zoneName: string) {
            const zone = state.arena.zones.find(z => z.name === zoneName);
            if (!zone) throw new Error(`no zone named ${zoneName} in ${state.arena.name}`);
            t.zone = zone.name;
            return t;
        },
        /** Everybody except the named ones is removed, so a scene is a scene. */
        only(...keep: Tribute[]) {
            const ids = new Set(keep.map(t => t.id));
            state.tributes.forEach(t => {
                if (!ids.has(t.id)) { t.status = 'dead'; t.health = 0; }
            });
        },
        sim() { return new Simulator(state); },
    };
}

export function report(label: string): number {
    console.log(`\n${label}: ${ran - failures.length}/${ran} scenarios hold.`);
    if (failures.length) {
        console.log('\nFAILURES:');
        failures.forEach(f => console.log(`  - ${f}`));
    }
    return failures.length;
}
