/**
 * AUDIT-13 U1/U7: the chronicle's zone-stripping must not mangle prose, and
 * item phrases must read as English.
 *
 * `stripZoneClause` removed the middle of a comma-bounded clause
 * (", in {zone},") and left ",," behind — about six mangled lines a run. This
 * checks templated samples, then renders every line of seeded runs the way the
 * chronicle does and counts doubled punctuation.
 *
 *   npm run test:zone-strip
 *   ZONE_STRIP_RUNS=30 npm run test:zone-strip
 */
import { stripZoneClause } from '../src/components/EventFeed';
import { capitaliseSentences, itemPhrase } from '../src/engine/items';
import { generateTributes } from '../src/engine/generator';
import { resolveArenaForRun } from '../src/engine/arenaSetup';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG, ITEMS } from '../src/data/constants';
import { GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';

let failures = 0;
function expect(label: string, got: string, want: string) {
    if (got !== want) { failures++; console.error(`FAIL ${label}\n  got:  ${got}\n  want: ${want}`); }
}

const Z = 'the Marsh';
expect('comma-bounded', stripZoneClause('Monocle tells Iron straight out, in the Marsh, that only one can win.', Z),
    'Monocle tells Iron straight out that only one can win.');
expect('comma then stop', stripZoneClause('A sponsor remembers Volmer, in the Marsh. The crate is open.', Z),
    'A sponsor remembers Volmer. The crate is open.');
expect('trailing clause', stripZoneClause('Rue hides in the Marsh for hours.', Z), 'Rue hides for hours.');
expect('mid clause', stripZoneClause('An ampoule for Chandelle, in the Marsh, from a sponsor.', Z), 'An ampoule for Chandelle from a sponsor.');
expect('capitalise', capitaliseSentences('what they raised. a Mace, in the Marsh.'), 'What they raised. A Mace, in the Marsh.');
const axes = ITEMS.find(i => i.id === 'throwing-axes');
if (axes) expect('plural item', itemPhrase(axes), 'some Throwing Axes');

const RUNS = Number(process.env.ZONE_STRIP_RUNS ?? 15);
const arenaIds = ARENAS.map(a => a.id);
let lines = 0, mangled = 0;
const examples: string[] = [];
for (let i = 0; i < RUNS; i++) {
    const seed = `ZS${i}`;
    const gp = gamesProfileFor(seed, false);
    const arena = resolveArenaForRun(seed, arenaIds[i % arenaIds.length], gp);
    const cfg = configForProfile(DEFAULT_GAME_CONFIG, gp);
    const state: GameState = {
        seed, arena, tributes: generateTributes(seed, cfg, arena.zones[0].name, gp.castShape, gp.quell),
        phase: 'setup', day: 0, log: [], gamemakerMode: false,
        config: cfg, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile: gp, logCounter: 0, feastsHeld: 0, cycle: 0,
    };
    const sim = new Simulator(state);
    let guard = 4000;
    while (guard-- > 0 && sim.advance() !== false) {
        const s = sim.getState();
        if (s.phase === 'epilogue' || s.phase === 'ended') break;
    }
    for (const log of sim.getState().log) {
        if (!log.zone) continue;
        lines++;
        const out = stripZoneClause(log.text, log.zone);
        if (/,\s*[,.;]/.test(out) && !/,\s*[,.;]/.test(log.text)) {
            mangled++;
            if (examples.length < 5) examples.push(out);
        }
    }
}
console.log(`zone-strip: ${lines} zoned lines over ${RUNS} runs, ${mangled} mangled by the strip`);
examples.forEach(e => console.log(`  e.g. ${e}`));
if (mangled > 0) failures++;
if (failures > 0) { console.error(`zone-strip: ${failures} failure(s)`); process.exit(1); }
console.log('zone-strip: OK');
