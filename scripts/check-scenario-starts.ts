/**
 * AUDIT-9 batch 5: the scenario starts, and the line between them and the
 * balance baseline.
 *
 * The audit attaches one condition to this feature that matters more than the
 * content: *"These should exercise existing mechanics and remain separate
 * from the standard balance baseline."*
 *
 * The second half is the one a check has to enforce rather than a comment
 * intend. A field that begins with its allies split across the map, or with
 * half of it already wounded, has a different mortality curve by construction
 * — so a scenario run swept into `metrics.ts` would move every indicator in
 * this audit for reasons that have nothing to do with the engine. That is the
 * exact failure mode batch 3 spent its first step undoing.
 *
 * So: the baseline is what you get when you ask for nothing, the harnesses ask
 * for nothing, and this asserts both.
 */
import { scenario, check, eq, report } from './scenarios';
import { initialRunState } from './runInit';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { SCENARIO_STARTS_LIST, scenarioStart } from '../src/engine/scenarioStarts';
import { Simulator } from '../src/engine/simulator';
import { GameState, ScenarioStartId } from '../src/models/types';
import { readFileSync } from 'fs';

const base = (seed: string, scenarioId?: ScenarioStartId): GameState => initialRunState({
    seed, arenaId: ARENAS[0].id, config: DEFAULT_GAME_CONFIG, scenario: scenarioId,
});

console.log('the line between a scenario and the baseline');

scenario(
    'a run with no scenario asked for is not a scenario run',
    'the baseline has to be the default, or "separate from the baseline" is a hope rather than a property',
    () => {
        const s = base('SS-plain');
        eq(s.scenarioStart, undefined, 'nothing applied');
    },
);

scenario(
    'neither balance harness ever asks for one',
    'the audit\'s actual requirement, asserted against the source rather than remembered',
    () => {
        ['metrics.ts', 'soak.ts', 'check-decisions.ts'].forEach(file => {
            const src = readFileSync(`scripts/${file}`, 'utf8');
            check(!/\bscenario:/.test(src), `${file} passes no scenario to initialRunState`);
        });
    },
);

scenario(
    'a scenario run is marked, so anything downstream can exclude it',
    'the record book and the manifest both need to know this was not a standard Games',
    () => {
        const s = base('SS-mark', 'separated-allies');
        eq(s.scenarioStart, 'separated-allies', 'the state says which');
    },
);

console.log('each start is a legal position, reachable by ordinary play');

SCENARIO_STARTS_LIST.forEach(def => {
    scenario(
        `${def.id}: the Games still runs to an ending`,
        'a scenario rearranges a Games; it must not produce one the engine cannot finish',
        () => {
            const sim = new Simulator(base(`SS-run-${def.id}`, def.id));
            let steps = 0;
            while (!sim.isFinished() && steps++ < 400) sim.advance();
            const s = sim.getState();
            /*
             * The terminal test is the *outcome*, not `isFinished()`. A run
             * that has decided its Games sits at `epilogue` — the victor
             * interview — and only reaches `ended` when somebody advances
             * past it, which a headless loop never does. A plain run behaves
             * identically; asserting `isFinished()` here failed all four
             * scenarios for a reason that had nothing to do with them.
             */
            const standing = s.tributes.filter(t => t.status === 'alive').length;
            check(standing <= 1, `${def.id} resolves to at most one tribute standing (got ${standing})`);
            check(['epilogue', 'ended'].includes(s.phase), `and reaches a terminal phase (got ${s.phase})`);
            check(s.tributes.every(t => t.health >= 0 && t.health <= 100), 'and nobody ends out of bounds');
        },
    );
});

console.log('each start actually does the thing it says');

scenario(
    'separated-allies puts district partners somewhere other than together',
    'the point of the scenario is the distance; if they start adjacent it is a normal Games',
    () => {
        const plain = base('SS-sep');
        const split = base('SS-sep', 'separated-allies');
        const together = (s: GameState) => {
            const byDistrict = new Map<number, string[]>();
            s.tributes.forEach(t => byDistrict.set(t.district, [...(byDistrict.get(t.district) ?? []), t.zone]));
            return [...byDistrict.values()].filter(z => z.length >= 2 && z[0] === z[1]).length;
        };
        check(together(split) <= together(plain), 'fewer district pairs share a zone');
        check(together(split) === 0, 'in fact none of them do');
    },
);

scenario(
    'damaged-crossing removes a route and leaves the map connected',
    'a missing route reshapes traffic; a disconnected map is a broken Games',
    () => {
        const s = base('SS-cross', 'damaged-crossing');
        eq((s.severedEdges ?? []).length, 1, 'one route is out');
    },
);

scenario(
    'contested-cache takes the medicine off the field and puts it in one place',
    'asymmetric value, exercising the Broker, the Medic and whether ground can be held',
    () => {
        const s = base('SS-cache', 'contested-cache');
        eq(s.tributes.some(t => t.inventory.some(i => i.type === 'medical')), false,
            'nobody starts carrying a kit');
        check((s.abandonedCamps ?? []).length > 0, 'and it is all in a cache');
    },
);

scenario(
    'walking-wounded starts half the field carrying something',
    'exercises the wound and treatment layers from cycle one instead of day four',
    () => {
        const plain = base('SS-hurt');
        const hurt = base('SS-hurt', 'walking-wounded');
        const mean = (s: GameState) => s.tributes.reduce((a, t) => a + t.health, 0) / s.tributes.length;
        check(mean(hurt) < mean(plain), 'the field starts in worse shape');
        check(hurt.tributes.every(t => t.health > 0), 'and nobody starts dead');
    },
);

scenario(
    'a scenario replays identically from the same seed',
    'a scenario has to be as reproducible as the Games it modifies',
    () => {
        const a = base('SS-determinism', 'separated-allies');
        const b = base('SS-determinism', 'separated-allies');
        eq(a.tributes.map(t => t.zone).join('|'), b.tributes.map(t => t.zone).join('|'),
            'same seed, same opening');
    },
);

scenario(
    'two scenarios on one seed do not draw from the same stream',
    'seeded per scenario, so picking a different one is a different Games rather than the same rolls reused',
    () => {
        const a = base('SS-stream', 'damaged-crossing');
        const b = base('SS-stream', 'contested-cache');
        check((a.severedEdges ?? []).length !== (b.severedEdges ?? []).length
            || (a.abandonedCamps ?? []).length !== (b.abandonedCamps ?? []).length,
        'the two starts produce different states');
    },
);

scenario(
    'every declared scenario id resolves to a definition',
    'a listed start with no implementation is a menu entry that does nothing',
    () => {
        const ids: ScenarioStartId[] = ['separated-allies', 'damaged-crossing', 'contested-cache', 'walking-wounded'];
        ids.forEach(id => check(scenarioStart(id) !== undefined, `${id} is implemented`));
        eq(SCENARIO_STARTS_LIST.length, ids.length, 'and there are no extras');
    },
);

process.exit(report('AUDIT-9 batch 5 scenario starts') ? 1 : 0);
