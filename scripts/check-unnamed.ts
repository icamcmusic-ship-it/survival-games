/**
 * §22 (requests): every tribute a line is about must be named in the line.
 *
 * The complaint this answers was specific and correct: "Some events mention a
 * tribute engaging with another tribute, but does not name the other
 * tribute(s)." It is a real defect rather than a stylistic one, because
 * `tributesInvolved` is what the feed uses to link names to profiles, what the
 * per-tribute chronicle filter reads, and what the relationship graph is built
 * from — so a line that involves three people and names one is a line the
 * reader cannot resolve and the filters lie about.
 *
 * This plays whole Games and counts log lines where a tribute on the line's own
 * cast list never appears in its text. The count may fall and may not rise, the
 * same ratchet `check-undeclared-knobs` and `check-flavor-pools` use, so the
 * remaining cases can be worked down without any of them being allowed back.
 *
 * Deliberately measured rather than grepped: the offenders are a mix of
 * authored templates and strings composed in the engine, and only a real run
 * tells you which ones a player actually meets and how often.
 */
import { Simulator } from '../src/engine/simulator';
import { generateTributes } from '../src/engine/generator';
import { gamesProfileFor } from '../src/engine/gamesProfile';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameState } from '../src/models/types';

/**
 * The measured count today, as a share of all multi-tribute log lines. Lower it
 * whenever the real number drops; never raise it.
 *
 * History: 12.4% (the first measurement, before any of this was fixed) -> 5.9%
 * (the five worst offenders named) -> the number below. The floor is not zero and will not be soon — a duel's fourth
 * exchange legitimately names only the two people still swinging while the
 * beat's opening line named the pair — but every line above it that reads as
 * "somebody" where a name belongs is a line to fix.
 */
const KNOWN_SHARE = 0.040;

const RUNS = 40;

let multiTributeLines = 0;
let unnamedLines = 0;
const templates = new Map<string, number>();

for (let i = 0; i < RUNS; i++) {
    const seed = `UNNAMED-${i}`;
    const arena = ARENAS[i % ARENAS.length];
    const gamesProfile = gamesProfileFor(seed);
    const tributes = generateTributes(seed, DEFAULT_GAME_CONFIG, arena.zones[0].name, gamesProfile.castShape);
    const state = {
        seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: false,
        config: DEFAULT_GAME_CONFIG, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile,
        logCounter: 0, feastsHeld: 0, cycle: 0,
    } as unknown as GameState;
    const sim = new Simulator(state);
    let guard = 600;
    while (guard-- > 0) {
        const st = sim.getState();
        if (st.phase === 'ended') break;
        if (st.phase === 'setup') sim.processTraining();
        else if (st.phase === 'training') sim.processInterviews();
        else if (st.phase === 'interviews') sim.startGames();
        else if (st.phase === 'bloodbath') sim.processBloodbath();
        else if (!sim.processTurn()) break;
    }
    const live = sim.getState();
    const byId = new Map(live.tributes.map(t => [t.id, t.name]));
    live.log.forEach(l => {
        if (l.tributesInvolved.length < 2) return;
        multiTributeLines++;
        const missing = l.tributesInvolved.filter(id => {
            const name = byId.get(id);
            return name !== undefined && !l.text.includes(name);
        });
        if (missing.length === 0) return;
        unnamedLines++;
        let key = l.text;
        byId.forEach(n => { key = key.split(n).join('{T}'); });
        key = key.replace(/\b\d+\b/g, '#');
        templates.set(`${l.category}\t${key}`, (templates.get(`${l.category}\t${key}`) ?? 0) + 1);
    });
}

const share = multiTributeLines === 0 ? 0 : unnamedLines / multiTributeLines;
console.log(`\nlines involving two or more tributes: ${multiTributeLines} over ${RUNS} runs`);
console.log(`lines that leave one of them unnamed:  ${unnamedLines} (${(share * 100).toFixed(1)}%, baseline ${(KNOWN_SHARE * 100).toFixed(1)}%)`);
console.log(`distinct templates: ${templates.size}\n`);

const worst = [...templates.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
if (worst.length > 0) {
    console.log('worst offenders:');
    worst.forEach(([k, n]) => {
        const [category, text] = k.split('\t');
        console.log(`  ${String(n).padStart(4)}  ${category.padEnd(10)} ${text.slice(0, 120)}`);
    });
}

if (share > KNOWN_SHARE + 0.005) {
    console.log(
        `\nFAIL: ${(share * 100).toFixed(1)}% of multi-tribute lines leave somebody unnamed, `
        + `up from a baseline of ${(KNOWN_SHARE * 100).toFixed(1)}%.`);
    console.log('Name them, or lower KNOWN_SHARE on purpose in scripts/check-unnamed.ts.');
    process.exit(1);
}
if (share < KNOWN_SHARE - 0.005) {
    console.log(`\nGood — lower KNOWN_SHARE to ${share.toFixed(3)} in scripts/check-unnamed.ts to lock that in.`);
}
console.log('\nEvery tribute a line is about is named in it, to within the known baseline.');
