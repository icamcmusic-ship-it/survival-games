/**
 * AUDIT-9 (audit §"robustness"): every death the engine produces has a code.
 *
 * The audit's recommendation was to "introduce structured event types and cause
 * codes, then render prose from them", because "several measurements currently
 * depend on matching English text; that makes writing changes capable of
 * breaking telemetry". Cause codes are only worth having if the taxonomy is
 * *complete* — a code layer with a silent `unknown` bucket is the same failure
 * as a regex that stopped matching, wearing better clothes.
 *
 * So this runs the simulation, collects every distinct cause-of-death string it
 * actually writes, and fails if any of them classifies as `unknown`. That is
 * the assertion that makes rewording safe: change an obituary, and either the
 * code still resolves or the build names the string that fell out.
 *
 * It also prints the code distribution, which is the thing no measurement in
 * this repository could previously state without a pile of regexes.
 */
import { Simulator } from '../src/engine/simulator';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameConfig, DeathCauseCode } from '../src/models/types';
import { classifyCause, deathCodeOf, CAUSE_FAMILY } from '../src/engine/causes';
import { coverageCells, coverageReport, initialRunState } from './runInit';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const RUNS = Number(process.env.CAUSE_RUNS ?? 200);

/**
 * The static half of the guarantee: every damage site declares its own code.
 *
 * Classifying the prose was the bridge, not the destination. A site knows what
 * it is doing — the avalanche branch knows it buried somebody — while the
 * classifier only knows the sentence, and the sentence can be edited by
 * somebody who has never heard of the taxonomy. Two of the sites this pass
 * was written for made that concrete: `Buried in a collapse in X` classified
 * as a generic `hazard` and not as `collapse`, purely because the rule reads
 * "buried in *the* collapse"; one indefinite article, and a collapse death
 * stopped being one. Nothing failed. Nothing could have.
 *
 * So the words stop being load-bearing at the sites the engine controls. This
 * walks the engine source and fails on any `applyDamage` call whose damage
 * record does not carry a `code`, which is what stops the annotation being a
 * one-off tidy-up that the next hazard quietly opts out of.
 */
function engineFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) return engineFiles(p);
        return p.endsWith('.ts') ? [p] : [];
    });
}

const uncoded: string[] = [];
for (const file of engineFiles('src/engine')) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
        if (!line.includes('applyDamage(') || line.includes('export function')) return;
        // Gather the call: from here to the line that closes its parentheses.
        let depth = 0;
        const chunk: string[] = [];
        for (let j = i; j < Math.min(i + 16, lines.length); j++) {
            chunk.push(lines[j]);
            depth += (lines[j].match(/\(/g) ?? []).length - (lines[j].match(/\)/g) ?? []).length;
            if (depth <= 0) break;
        }
        // `code: 'fall'` or the shorthand `code` where a variable carries it.
        if (!/\bcode\s*[:,}]/.test(chunk.join(' '))) uncoded.push(`${file}:${i + 1}`);
    });
}

const arenaIds = [...ARENAS.map(a => a.id), 'procedural'];
const configs: GameConfig[] = [
    DEFAULT_GAME_CONFIG,
    { ...DEFAULT_GAME_CONFIG, districtCount: 6 },
    { ...DEFAULT_GAME_CONFIG, districtCount: 12, hazardRate: 1.5 },
    { ...DEFAULT_GAME_CONFIG, districtCount: 8, betrayalRate: 1.5 },
];

const cells = coverageCells(arenaIds, configs.length, RUNS);
console.log(coverageReport(cells, arenaIds, configs.length));

/** Deaths whose code came from the site rather than from reading the prose. */
let declared = 0;

/** code -> deaths, and code -> one example string, for the report. */
const byCode = new Map<DeathCauseCode, number>();
const example = new Map<DeathCauseCode, string>();
/** Distinct strings that classified as `unknown` — the failure set. */
const unclassified = new Map<string, number>();
/** Deaths whose recorded code disagrees with classifying the obituary. */
const disagreements = new Map<string, number>();
let deaths = 0;

for (let i = 0; i < RUNS; i++) {
    const cell = cells[i];
    const sim = new Simulator(initialRunState({
        seed: `CAUSE${i}`, arenaId: cell.arenaId, config: configs[cell.configIndex],
    }));
    sim.processTraining();
    let guard = 3000;
    while (!sim.isFinished() && guard-- > 0) if (!sim.advance()) break;

    sim.getState().tributes.forEach(t => {
        if (t.status !== 'dead') return;
        deaths++;
        if (t.causeCode || t.lastDamage?.code) declared++;
        const code = deathCodeOf(t);
        byCode.set(code, (byCode.get(code) ?? 0) + 1);
        if (!example.has(code) && t.causeOfDeath) example.set(code, t.causeOfDeath);
        if (code === 'unknown') {
            const key = t.causeOfDeath ?? '(no cause recorded)';
            unclassified.set(key, (unclassified.get(key) ?? 0) + 1);
        }
        /*
         * A recorded code that disagrees with classifying the obituary means
         * the two have drifted: either a site declared something the prose
         * contradicts, or the prose was reworded away from the rule that used
         * to catch it. Reported rather than failed — an explicit site code is
         * *allowed* to be more specific than the words — but a rise here is
         * the signal that a rule has stopped matching.
         */
        const derived = classifyCause(t.causeOfDeath, t.lastDamage?.kind);
        if (t.causeCode && derived !== t.causeCode) {
            const key = `${t.causeCode} vs ${derived}`;
            disagreements.set(key, (disagreements.get(key) ?? 0) + 1);
        }
    });
}

console.log(`\n${deaths} deaths over ${RUNS} runs, by cause code:`);
[...byCode.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([code, n]) => {
        const share = (100 * n / Math.max(1, deaths)).toFixed(1).padStart(5);
        console.log(`  ${code.padEnd(15)} ${CAUSE_FAMILY[code].padEnd(10)} ${share}%  (${n})  e.g. ${example.get(code) ?? ''}`);
    });

if (disagreements.size > 0) {
    console.log('\nrecorded code vs derived code (an explicit site code may legitimately be more specific):');
    [...disagreements.entries()].sort((a, b) => b[1] - a[1])
        .forEach(([k, n]) => console.log(`  ${k.padEnd(34)} ${n}`));
}

// The families every run should exercise. A family that goes missing entirely
// is either a genuine regression in the simulation or a rule that stopped
// matching, and both are worth failing on.
const REQUIRED_FAMILIES = ['tribute', 'body', 'arena'] as const;
const familiesSeen = new Set([...byCode.keys()].map(c => CAUSE_FAMILY[c]));
const missingFamilies = REQUIRED_FAMILIES.filter(f => !familiesSeen.has(f));

let failed = 0;
if (unclassified.size > 0) {
    failed++;
    console.log(`\nFAIL: ${unclassified.size} cause string(s) fall outside the taxonomy:`);
    [...unclassified.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
        .forEach(([cause, n]) => console.log(`  ${String(n).padStart(5)}  ${cause}`));
    console.log('  (add a rule to engine/causes.ts, or a code at the damage site)');
}
if (uncoded.length > 0) {
    failed++;
    console.log(`\nFAIL: ${uncoded.length} applyDamage site(s) do not declare a cause code:`);
    uncoded.slice(0, 25).forEach(site => console.log(`  ${site}`));
    console.log("  (add `code: '<DeathCauseCode>'` to the damage record — the site knows, the words only imply)");
}
if (missingFamilies.length > 0) {
    failed++;
    console.log(`\nFAIL: no deaths at all in ${missingFamilies.length} required family/families: ${missingFamilies.join(', ')}`);
}

const declaredShare = (100 * declared / Math.max(1, deaths)).toFixed(1);
console.log(`\n${declaredShare}% of deaths carry a code declared at the damage site (the rest classify from the prose);`
    + ` ${uncoded.length} engine damage site(s) without one.`);

console.log(failed ? '\ncause code checks failed.' : '\nEvery death the engine produces carries a cause code.');
process.exit(failed ? 1 : 0);
