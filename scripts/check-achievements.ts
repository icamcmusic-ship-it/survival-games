/**
 * §11: achievement coverage — what the discovery layer actually hands out.
 *
 * The soak asserts invariants and `test:metrics` measures balance; neither has
 * anything to say about whether an achievement is reachable. Both halves of
 * that matter: an entry nobody can earn is a promise the game does not keep,
 * and one that fires on nearly every run is not a discovery, it is a
 * participation ribbon. A 600-run audit found fourteen of the former and four
 * of the latter, and there was no way to notice either without writing a
 * one-off script — so it lives here now.
 *
 * It also evaluates all 111 predicates against real end-states, which is a
 * crash test in its own right: they run over a finished GameState with
 * arbitrary optional fields missing.
 *
 *   npm run test:achievements            # 200 runs
 *   ACHIEVEMENT_RUNS=600 npm run test:achievements
 */
import { generateTributes } from '../src/engine/generator';
import { generateArena } from '../src/engine/arenaGenerator';
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameConfig, GameState } from '../src/models/types';
import { configForProfile, gamesProfileFor } from '../src/engine/gamesProfile';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, AchievementCategory } from '../src/data/achievements';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Audit 3 §1.6: 500 rather than 200.
 *
 * This sweep does three jobs and 200 runs was too small for two of them. It
 * measures the unlock *rate* (which is what the rarity labels are regenerated
 * from, and what "never unlocks" is asserted against) and the numeric *ceiling*
 * every threshold is checked against — and a legendary is by definition an
 * outcome a short sweep may not see. `turncoat-twice` failed the ceiling check
 * at 200 runs ("never produced more than 1 in a victor") and passes at 500,
 * having not changed: the sample was the problem, exactly as `GUARD_MIN_SAMPLE`
 * documents for the metrics sweep.
 *
 * Raising the sample rather than softening the assertion is deliberate. The
 * ceiling check has found fifteen genuinely unreachable entries across two
 * audits and one that an author introduced mid-fix; it is the last thing in
 * here that should be given a tolerance band.
 */
const RUNS = Number(process.env.ACHIEVEMENT_RUNS ?? 500);

const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];
const configs: GameConfig[] = [
    DEFAULT_GAME_CONFIG,
    { ...DEFAULT_GAME_CONFIG, districtCount: 6 },
    { ...DEFAULT_GAME_CONFIG, districtCount: 12, hazardRate: 1.5 },
];

function start(seed: string, arenaId: string, config: GameConfig, gamemaker = false): GameState {
    const arena = arenaId.startsWith('procedural') ? generateArena(seed) : ARENAS.find(a => a.id === arenaId)!;
    const gamesProfile = gamesProfileFor(seed, seed.endsWith('7'));
    const resolved = configForProfile(config, gamesProfile);
    const tributes = generateTributes(seed, resolved, arena.zones[0].name, gamesProfile.castShape, gamesProfile.quell);
    return {
        seed, arena, tributes, phase: 'setup', day: 0, log: [], gamemakerMode: gamemaker,
        config: resolved, baseConfig: config, gamesProfile, logCounter: 0, feastsHeld: 0, cycle: 0,
    };
}

const unlocks: Record<string, number> = {};
const errors: string[] = [];
let completed = 0;

/**
 * §11.2 (audit 2): the numeric half of `test:predicates`.
 *
 * `check-predicates` catches an achievement comparing an optional *boolean*
 * against a value the engine never writes. The same bug has a numeric form and
 * nothing caught it: an entry asking for `trapKills >= 3` against a counter
 * that has never exceeded 1 in any run is not a hard achievement, it is an
 * unreachable one — and the coverage report below lists it as "never unlocked"
 * alongside the genuinely hard entries, which is exactly what hid
 * `nobodys-ally` before the boolean check existed.
 *
 * It cannot be answered statically: the ceiling on `trapKills` is a fact about
 * the simulation, not about the type. So it is measured here, on the sweep this
 * file is already running, at no extra cost — every optional numeric (and the
 * length of every optional array) on Tribute and GameState, maximised across
 * every tribute of every run.
 */
const NUMERIC_FIELDS = new Set<string>();
const ARRAY_FIELDS = new Set<string>();
{
    const types = readFileSync('src/models/types.ts', 'utf8');
    // Scoped to the two interfaces this file actually walks. A global scrape
    // picks up `Alliance.charter` and `Arena.laws` as well, and then reports
    // them as never-written because nothing traverses an Alliance or an Arena
    // here — a false positive that reads exactly like a real finding.
    const body = (name: string): string => {
        const at = types.indexOf(`export interface ${name} {`);
        if (at < 0) return '';
        const open = types.indexOf('{', at);
        let depth = 0;
        for (let i = open; i < types.length; i++) {
            if (types[i] === '{') depth++;
            else if (types[i] === '}' && --depth === 0) return types.slice(open, i);
        }
        return '';
    };
    const scoped = body('Tribute') + '\n' + body('GameState');
    for (const m of scoped.matchAll(/^\s+(\w+)\?: number;/gm)) NUMERIC_FIELDS.add(m[1]);
    for (const m of scoped.matchAll(/^\s+(\w+)\?: (?:\w+)\[\];/gm)) ARRAY_FIELDS.add(m[1]);
}
const ceiling: Record<string, number> = {};
// Kept apart, because most entries are scored on the victor and the victor is
// not the field's best case. Any tribute may reach two trap kills; a *victor*
// who did is a much rarer thing, and an entry testing `v.trapKills >= 2`
// against the all-tributes ceiling of 2 reads as reachable and is not.
const victorCeiling: Record<string, number> = {};
const seeFields = (into: Record<string, number>, o: Record<string, unknown> | undefined) => {
    if (!o) return;
    for (const f of NUMERIC_FIELDS) {
        const v = o[f];
        if (typeof v === 'number' && Number.isFinite(v)) into[f] = Math.max(into[f] ?? -Infinity, v);
    }
    for (const f of ARRAY_FIELDS) {
        const v = o[f];
        if (Array.isArray(v)) into[f + '.length'] = Math.max(into[f + '.length'] ?? -Infinity, v.length);
    }
};

for (let i = 0; i < RUNS; i++) {
    const seed = `ACH${i}`;
    // §11 (audit): a quarter of runs in Gamemaker mode, so the booth's own
    // achievements are measured rather than listed as never-unlocked.
    const sim = new Simulator(start(seed, arenaIds[i % arenaIds.length], configs[i % configs.length], i % 4 === 3));
    let guard = 3000;
    let state = sim.getState();
    while (state.phase !== 'ended' && guard-- > 0) {
        if (state.phase === 'setup') sim.processTraining();
        else if (state.phase === 'training') sim.processInterviews();
        else if (state.phase === 'interviews') sim.startGames();
        else if (state.phase === 'bloodbath') sim.processBloodbath();
        else if (state.phase === 'epilogue') { state.phase = 'ended'; }
        else if (!sim.processTurn()) break;
        state = sim.getState();
    }
    if (state.phase !== 'ended') continue;
    completed++;
    seeFields(ceiling, state as unknown as Record<string, unknown>);
    state.tributes.forEach(t => seeFields(ceiling, t as unknown as Record<string, unknown>));
    const victor = state.tributes.find(t => t.status === 'alive');
    seeFields(victorCeiling, victor as unknown as Record<string, unknown>);
    seeFields(victorCeiling, state as unknown as Record<string, unknown>);
    ACHIEVEMENTS.forEach(a => {
        try {
            if (a.test(state, victor)) unlocks[a.id] = (unlocks[a.id] ?? 0) + 1;
        } catch (e) {
            errors.push(`${a.id}: ${(e as Error).message}`);
        }
        try {
            a.nearMiss?.(state, victor);
        } catch (e) {
            errors.push(`${a.id} (nearMiss): ${(e as Error).message}`);
        }
    });
}

const rate = (id: string) => (unlocks[id] ?? 0) / Math.max(1, completed);

console.log(`achievement coverage: ${ACHIEVEMENTS.length} entries over ${completed} completed runs\n`);

const byCategory: Record<string, number> = {};
ACHIEVEMENTS.forEach(a => { byCategory[a.category] = (byCategory[a.category] ?? 0) + 1; });
console.log('by category:');
(Object.keys(ACHIEVEMENT_CATEGORIES) as AchievementCategory[]).forEach(c => {
    console.log(`  ${c.padEnd(12)} ${String(byCategory[c] ?? 0).padStart(3)}  ${ACHIEVEMENT_CATEGORIES[c]}`);
});

const sorted = [...ACHIEVEMENTS].sort((a, b) => rate(b.id) - rate(a.id));
const never = sorted.filter(a => rate(a.id) === 0);
const nearAutomatic = sorted.filter(a => rate(a.id) >= 0.6);
const usable = sorted.filter(a => rate(a.id) >= 0.05 && rate(a.id) < 0.6);

console.log(`\nnever unlocked (${never.length}):`);
let failed = false;
never.forEach(a => console.log(`  ${a.id.padEnd(24)} ${a.rarity}${a.nearMiss ? '' : '   (no nearMiss — the player learns nothing about it)'}`));
/*
 * Audit 3 §11.4: an entry this sweep never sees unlock MUST carry a nearMiss.
 *
 * Unreachable and invisible is the worst pair: seven of the seventeen entries
 * that never unlocked also said nothing at all about what they wanted, so the
 * player could not even tell they had come close. The sweep already knows which
 * entries it never saw fire; requiring a nearMiss on exactly those costs
 * nothing for the ones that fire often and is not optional for the ones that
 * do not.
 */
const silentAndUnreachable = never.filter(a => !a.nearMiss);
if (silentAndUnreachable.length > 0) {
    console.log(`\nFAIL: ${silentAndUnreachable.length} achievement(s) never unlocked in ${RUNS} runs AND carry no nearMiss:`);
    silentAndUnreachable.forEach(a => console.log(`  ${a.id}`));
    console.log('  (an entry nobody earns and nobody is told about is a promise the game does not keep — give it a nearMiss)');
    failed = true;
}
console.log(`\nnear-automatic, >= 60% of runs (${nearAutomatic.length}):`);
nearAutomatic.forEach(a => console.log(`  ${a.id.padEnd(24)} ${(rate(a.id) * 100).toFixed(1)}%`));
console.log(`\nin the usable 5%-60% band: ${usable.length} of ${ACHIEVEMENTS.length}`);

// Authored rarity against measured rate: the label on the card should not
// contradict what the simulation does.
// §19 (requests): four tiers — Common, Rare, Legendary, Possible? — rather
// than the old Common/Uncommon/Rare/Legendary ladder. The change that matters
// is the top one: 'possible' is not "very hard", it is "this simulation has
// never been observed doing it", which is a different and more honest claim
// than calling something legendary because nobody has seen it. Bands still
// overlap so run-to-run noise cannot flip a label.
const BANDS: Record<string, [number, number]> = {
    common: [0.25, 1],
    rare: [0.03, 0.35],
    legendary: [0.0001, 0.05],
    // Anything measured at all is not 'possible?'; see `mislabelled` below,
    // which only considers entries with a non-zero rate.
    possible: [0, 0],
};
const mislabelled = sorted.filter(a => {
    const [lo, hi] = BANDS[a.rarity];
    const r = rate(a.id);
    return r > 0 && (r < lo || r > hi);
});
console.log(`\nrarity labels contradicted by the measured rate (${mislabelled.length}):`);
mislabelled.forEach(a => console.log(`  ${a.id.padEnd(24)} labelled ${a.rarity.padEnd(10)} measured ${(rate(a.id) * 100).toFixed(1)}%`));

// §1.5 (audit): the report above never failed, so eight labels drifted — one
// 'legendary' fired in a sixth of all runs. A label is a fact about the data,
// so a contradiction is a failure. The bands overlap on purpose, and a label
// is only wrong when the measured rate lands wholly outside its band *and*
// outside the neighbouring one, so ordinary run-to-run noise at 200 runs
// cannot flip the build. Regenerate the labels with ACHIEVEMENT_EMIT_RARITY=1.
const ORDER = ['common', 'rare', 'legendary', 'possible'] as const;
const bandOf = (id: string, r: number) => r >= 0.25 ? 'common' : r >= 0.03 ? 'rare' : (unlocks[id] ?? 0) > 1 ? 'legendary' : 'possible';
const badlyMislabelled = mislabelled.filter(a =>
    Math.abs(ORDER.indexOf(bandOf(a.id, rate(a.id))) - ORDER.indexOf(a.rarity as typeof ORDER[number])) >= 2
    || (a.rarity === 'legendary' && rate(a.id) >= 0.08)
    || (a.rarity === 'common' && rate(a.id) < 0.05)
    // A 'possible?' entry that the simulation demonstrably produces is simply
    // wrong: the tier means nobody has ever seen it happen.
    //
    // With a one-observation tolerance, and that is not slack — it is what
    // makes the tier usable. An entry that fires once in 500 runs sits exactly
    // on the boundary and flips between 'legendary' and 'possible' from one
    // sweep to the next purely on which seeds were drawn, which would make
    // this check fail at random rather than on a regression. Two hits is a
    // thing the simulation demonstrably does; one is noise.
    || (a.rarity === 'possible' && unlocks[a.id] > 1));

/* -------------------------------------------------------------------------- */
/* §2.4: nearMiss is mandatory wherever the test is a matter of degree         */
/* -------------------------------------------------------------------------- */

/**
 * "2 kills from Bloodbath" is the best idea in achievements.ts: it turns a
 * binary into a nudge. It was also applied by hand, which meant it was missing
 * from exactly the entries where the player has no other feedback loop — an
 * achievement whose predicate counts to four and says nothing when you reached
 * three is a locked card with no information in it.
 *
 * So it is mechanical now. An achievement whose `test` compares something
 * against a numeric literal of two or more is *measuring* something, and a run
 * can therefore come close to it: it must carry a `nearMiss`. Comparisons
 * against 0 and 1 are deliberately exempt — those are presence checks ("never
 * foraged", "survived a collapse"), where being one short is the whole of the
 * distance and there is nothing to report.
 *
 * Reading the predicate's own source is crude, and deliberately so: anything
 * declarative would have to be kept in step by hand, which is the failure this
 * replaces. It cannot see a threshold hidden behind an imported constant, so
 * it under-reports rather than crying wolf.
 *
 * `NEAR_MISS_EXEMPT` is a ratchet in the style of the knobs baseline: entries
 * may be removed, never added, and an exemption that is no longer needed fails
 * the check so it cannot quietly rot into a licence.
 */
const NEAR_MISS_EXEMPT: string[] = [];

const THRESHOLD = /(?:>=|<=|>|<)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:>=|<=|>|<)/g;
function thresholdsIn(fn: (...args: never[]) => unknown): number[] {
    const src = fn.toString().replace(/\s+/g, ' ');
    return [...src.matchAll(THRESHOLD)]
        .map(m => Number(m[1] ?? m[2]))
        .filter(n => Number.isFinite(n) && n >= 2);
}

const measured = ACHIEVEMENTS.filter(a => thresholdsIn(a.test).length > 0);
const missingNearMiss = measured.filter(a => !a.nearMiss && !NEAR_MISS_EXEMPT.includes(a.id));
const staleExemptions = NEAR_MISS_EXEMPT.filter(id => {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    return !a || !!a.nearMiss || thresholdsIn(a.test).length === 0;
});

console.log(`\nnumeric-threshold tests: ${measured.length}; carrying a nearMiss: `
    + `${measured.filter(a => a.nearMiss).length}; exempt: ${NEAR_MISS_EXEMPT.length}`);

if (badlyMislabelled.length > 0) {
    console.log(`\nFAIL: ${badlyMislabelled.length} rarity label(s) are two bands off the measured rate — relabel them:`);
    badlyMislabelled.forEach(a => console.log(`  ${a.id.padEnd(24)} labelled ${a.rarity.padEnd(10)} measured ${(rate(a.id) * 100).toFixed(1)}%`));
    failed = true;
}
if (missingNearMiss.length > 0) {
    console.log(`\nFAIL: ${missingNearMiss.length} achievement(s) test a numeric threshold with no nearMiss —`
        + ' a player who came one short is told nothing:');
    missingNearMiss.forEach(a => console.log(`  ${a.id.padEnd(24)} thresholds ${thresholdsIn(a.test).join(', ')}`));
    failed = true;
}
if (staleExemptions.length > 0) {
    console.log(`\nFAIL: ${staleExemptions.length} stale nearMiss exemption(s) — delete them from NEAR_MISS_EXEMPT:`);
    staleExemptions.forEach(id => console.log(`  ${id}`));
    failed = true;
}

if (errors.length > 0) {
    console.log(`\nFAIL: ${errors.length} predicate error(s):`);
    errors.slice(0, 20).forEach(e => console.log(`  ${e}`));
    failed = true;
}
// §11.2 (audit 2): thresholds that sit above the ceiling the engine produces.
//
// Reads source text rather than types, like `check-predicates`, and is
// deliberately conservative: it only recognises a bare `>=`/`>` against a
// numeric literal on a field it has a measured ceiling for, so it under-reports
// rather than crying wolf. A field the sweep never saw at all is skipped —
// `check-predicates` owns the "nothing ever writes this" case.
const unreachable: string[] = [];
{
    const patterns: RegExp[] = [
        // (v.field ?? 0) >= 3   |   v.field >= 3   |   v.field! > 2
        /(\w+)[!?]?\.(\w+)\s*(?:\?\?\s*0\s*\)?|!)?\s*(>=|>)\s*(\d+(?:\.\d+)?)\b/g,
        // (v.field?.length ?? 0) >= 3
        /(\w+)[!?]?\.(\w+)\?\.length\s*\?\?\s*0\s*\)?\s*(>=|>)\s*(\d+(?:\.\d+)?)\b/g,
    ];
    for (const a of ACHIEVEMENTS) {
        const src = a.test.toString();
        // The victor parameter's name, so a `v.field` read can be told apart
        // from a `t.field` read inside a `.some(t => ...)` over the whole cast.
        const victorParam = /^\s*\(?\s*[\w_]+\s*,\s*([\w_]+)/.exec(src)?.[1];
        const seen = new Set<string>();
        for (const re of patterns) {
            for (const m of src.matchAll(re)) {
                const [, receiver, rawField, op, rawNeed] = m;
                const isLength = m[0].includes('?.length');
                const key = isLength ? `${rawField}.length`
                    : ARRAY_FIELDS.has(rawField) ? `${rawField}.length`
                        : rawField;
                const victorScoped = !!victorParam && receiver === victorParam;
                const table = victorScoped ? victorCeiling : ceiling;
                // A declared optional numeric that no run ever put a number in
                // is the numeric twin of check-predicates' "nothing in src/ ever
                // assigns this": the comparison cannot be satisfied, and
                // skipping it here would let exactly the bug this check exists
                // for through the one door it does not watch.
                if (!(key in table) && !(key in ceiling) && !(key in victorCeiling)) {
                    const declared = NUMERIC_FIELDS.has(rawField) || ARRAY_FIELDS.has(rawField);
                    if (declared) {
                        const sig = `${key}!written`;
                        if (!seen.has(sig)) {
                            seen.add(sig);
                            unreachable.push(`${a.id}: reads ${key}, which ${completed} runs never gave a value`);
                        }
                    }
                    continue;
                }
                if (!(key in table)) continue;
                const need = op === '>' ? Number(rawNeed) + 1 : Number(rawNeed);
                const max = table[key];
                if (max >= need) continue;
                const sig = `${key}>=${need}`;
                if (seen.has(sig)) continue;
                seen.add(sig);
                unreachable.push(`${a.id}: needs ${key} >= ${need}, but ${completed} runs never produced `
                    + `more than ${max}${victorScoped ? ' in a victor' : ''}`);
            }
        }
    }
}
if (unreachable.length > 0) {
    console.log(`\nFAIL: ${unreachable.length} achievement threshold(s) above the ceiling the engine produces:`);
    unreachable.forEach(u => console.log(`  ${u}`));
    console.log('  (lower the threshold, or raise the ceiling — an entry nobody can earn is a promise the game does not keep)');
    failed = true;
}

const uncategorised = ACHIEVEMENTS.filter(a => !ACHIEVEMENT_CATEGORIES[a.category]);
if (uncategorised.length > 0) {
    console.log(`\nFAIL: ${uncategorised.length} achievement(s) carry an unknown category.`);
    failed = true;
}
const ids = new Set<string>();
const duplicates = ACHIEVEMENTS.filter(a => ids.size === ids.add(a.id).size);
if (duplicates.length > 0) {
    console.log(`\nFAIL: duplicate achievement id(s): ${duplicates.map(a => a.id).join(', ')}`);
    failed = true;
}

if (process.env.ACHIEVEMENT_EMIT_RARITY === '1') {
    /*
     * Audit 3 §1.6: writes the labels back into `achievements.ts` rather than
     * printing JSON to paste by hand.
     *
     * A rarity label is a fact about the data, and every audit so far has found
     * it drifted — 45 wrong in one pass, regenerated, and 7 wrong again one
     * release later. The reason is that regenerating meant reading a blob off
     * stdout and hand-editing 157 entries, so it happened exactly as often as
     * somebody was willing to do that. `npm run fix:rarity` now does it, and
     * the check that follows still fails on anything two bands out, so the
     * regeneration is a convenience rather than a way to launder a real drift.
     */
    // Mirrors `bandOf` and the fail condition above, including the
    // one-observation tolerance on 'possible?' — the writer and the check have
    // to agree about the boundary or `fix:rarity` writes labels that fail.
    const label = (id: string, r: number) =>
        r >= 0.25 ? 'common' : r >= 0.03 ? 'rare' : (unlocks[id] ?? 0) > 1 ? 'legendary' : 'possible';
    const path = 'src/data/achievements.ts';
    let src = readFileSync(path, 'utf8');
    let rewritten = 0;
    ACHIEVEMENTS.forEach(a => {
        const want = label(a.id, rate(a.id));
        if (want === a.rarity) return;
        // Anchored on the id so the replacement cannot wander to another entry:
        // `id: 'x',` ... the next `rarity: '...'` after it.
        const at = src.indexOf(`id: '${a.id}',`);
        if (at < 0) return;
        const field = src.indexOf('rarity: ', at);
        if (field < 0) return;
        const end = src.indexOf('\n', field);
        src = src.slice(0, field) + `rarity: '${want}',` + src.slice(end);
        rewritten++;
    });
    writeFileSync(path, src);
    console.log(`\nrewrote ${rewritten} rarity label(s) in ${path} from the measured rate.`);
}

console.log(failed ? '\nachievement checks failed.' : '\nAll achievement predicates evaluated without error.');
process.exit(failed ? 1 : 0);
