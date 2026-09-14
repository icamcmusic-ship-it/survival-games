/**
 * The inverse of `test:knobs`: fail CI on tunable numbers that live in the
 * engine instead of in `data/balance.ts`.
 *
 * `check-balance-knobs.ts` proves every declared knob is used. It cannot see
 * the other direction — a magic `0.35` typed straight into `chance()` never
 * shows up as a dead knob, it just quietly makes the README's claim that
 * balance.ts "holds every tunable number the engine reads" less true every
 * month. This walks the engine looking for the three shapes a tunable almost
 * always takes:
 *
 *   1. a numeric literal handed to `chance()` / `nextFloat() <` — an odds dial;
 *   2. a numeric literal on the right of `+=` / `-=` — a magnitude dial;
 *   3. a numeric literal on one side of `<`, `<=`, `>`, `>=` — a threshold;
 *   4. a `const` in the engine bound to a number, or to a record of numbers —
 *      a balance table living in the wrong file.
 *
 * Shape 4 was the blind spot that let a whole subsystem's balance sheet sit
 * outside `data/balance.ts`: `mentors.ts` declared MENTOR_GENEROSITY,
 * MENTOR_PULL, MENTOR_TRUST_FLOOR, MENTOR_TRUST_COST, MENTOR_EXCITEMENT_COST
 * and MENTOR_REPEAT_DECAY as exported consts, and an exported const matches
 * none of the three expression shapes above — so the check that exists to stop
 * exactly this reported nothing.
 *
 * Everything else is left alone on purpose. A checker that cries wolf is a
 * checker somebody adds `|| true` to, so the filters below are deliberately
 * generous: array indices, structural 0/1/2/-1, `.length` comparisons, the
 * `Math.round(x * 100) / 100` rounding idiom, percentage conversions, loop
 * bounds, `slice`/`splice`/`padStart` arguments and string formatting are all
 * assumed structural and never reported.
 *
 * Two escape hatches:
 *
 *   - `// balance-exempt: <reason>` on the flagged line, or on the line above
 *     it, silences that one site. A reason is required. Use it for genuine
 *     one-offs — a number that is part of an algorithm's shape rather than
 *     something a designer would ever turn.
 *   - `scripts/undeclared-knobs-baseline.json` is the frozen inventory of the
 *     sites that already existed when this check landed. They still count as
 *     drift; they are simply not new drift. The check fails if any of them
 *     disappears without the baseline being shrunk too, so migrating a file
 *     is a deliberate, reviewable edit rather than a silent ratchet.
 *
 *   npm run test:undeclared-knobs
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SRC = path.join(ROOT, 'src');
const BASELINE_PATH = path.join(HERE, 'undeclared-knobs-baseline.json');

/** Directories scanned. `src/data/` is mostly content tables, not tunables. */
const SCAN_DIRS = [path.join(SRC, 'engine')];

/**
 * Literals that are structural far more often than they are tunable. 0/1/-1
 * are identity and sentinel values, 2 is halving/doubling and pair logic, 100
 * and 0.5 appear overwhelmingly as percent scale and midpoints.
 */
const STRUCTURAL = new Set([0, 1, -1, 2, -2, 100, -100]);

/** Lines that are structural wholesale, whatever literals they contain. */
const STRUCTURAL_LINE = [
    /\bfor\s*\(/,                       // loop bounds
    /\.(slice|splice|substring|substr|padStart|padEnd|toFixed|repeat|at)\s*\(/,
    /Math\.round\([^)]*\*\s*100\s*\)\s*\/\s*100/, // the two-decimal idiom
    /^\s*(\/\/|\/?\*)/,                 // comments
    /^\s*import\b/,
];

type Finding = { file: string; line: number; kind: string; expr: string };

/** Blank out string and template literal contents so their digits do not count. */
function stripStrings(line: string): string {
    return line
        .replace(/'(?:[^'\\]|\\.)*'/g, s => "'" + ' '.repeat(Math.max(0, s.length - 2)) + "'")
        .replace(/"(?:[^"\\]|\\.)*"/g, s => '"' + ' '.repeat(Math.max(0, s.length - 2)) + '"')
        .replace(/`(?:[^`\\]|\\.)*`/g, s => '`' + ' '.repeat(Math.max(0, s.length - 2)) + '`');
}

const NUM = String.raw`-?\d+(?:\.\d+)?`;

function isStructural(n: number): boolean {
    // Anything below a hundredth is an epsilon or a convergence guard, not a
    // dial a designer would ever reach for.
    return STRUCTURAL.has(n) || (n !== 0 && Math.abs(n) < 0.01);
}

function scanLine(line: string): Array<{ kind: string; expr: string }> {
    const out: Array<{ kind: string; expr: string }> = [];
    const code = stripStrings(line);
    if (STRUCTURAL_LINE.some(re => re.test(code))) return out;

    // 1. Odds handed straight to the RNG.
    const chanceRe = new RegExp(String.raw`\b(?:chance|nextFloat\s*\(\s*\)\s*<=?)\s*\(?\s*(${NUM})`, 'g');
    let m: RegExpExecArray | null;
    while ((m = chanceRe.exec(code)) !== null) {
        const n = Number(m[1]);
        if (!isStructural(n)) out.push({ kind: 'chance', expr: m[0].trim() });
    }

    // 2. Magnitudes accumulated onto state or onto a weight.
    const accRe = new RegExp(String.raw`([\w.\[\]']+)\s*([+\-])=\s*([^;,)]+)`, 'g');
    while ((m = accRe.exec(code)) !== null) {
        const rhs = m[3];
        // Only the literal terms matter; `x += y * FOO.bar` is already declared.
        const lits = rhs.match(new RegExp(String.raw`(?<![\w.])${NUM}`, 'g')) ?? [];
        const tunable = lits.map(Number).filter(n => !isStructural(n));
        if (tunable.length > 0) out.push({ kind: 'accumulate', expr: `${m[1]} ${m[2]}= ${rhs.trim()}` });
    }

    // 3. Thresholds. `.length` comparisons are counting, not balance.
    const cmpRe = new RegExp(String.raw`([\w.\[\]']+)\s*(<=|>=|<|>)\s*(${NUM})\b`, 'g');
    while ((m = cmpRe.exec(code)) !== null) {
        if (/\.length$/.test(m[1])) continue;
        const n = Number(m[3]);
        if (!isStructural(n)) out.push({ kind: 'threshold', expr: `${m[1]} ${m[2]} ${m[3]}` });
    }
    const cmpRevRe = new RegExp(String.raw`(?<![\w.])(${NUM})\s*(<=|>=|<|>)\s*([\w.\[\]']+)`, 'g');
    while ((m = cmpRevRe.exec(code)) !== null) {
        if (/\.length$/.test(m[3])) continue;
        const n = Number(m[1]);
        if (!isStructural(n)) out.push({ kind: 'threshold', expr: `${m[1]} ${m[2]} ${m[3]}` });
    }

    return out;
}

/**
 * Shape 4: a `const` bound to a number, or to a record whose values are
 * numbers, declared inside `src/engine/`. That is a balance table, and balance
 * tables belong in `data/balance.ts`.
 *
 * Scanned over the whole file rather than line by line because the interesting
 * case spans several lines. A record counts when at least two of its entries
 * are plain numeric literals and none of its values are anything else —
 * `Record<Terrain, string>` and lookup tables of functions are not balance.
 */
function scanConsts(text: string): Array<{ line: number; kind: string; expr: string }> {
    const out: Array<{ line: number; kind: string; expr: string }> = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const code = stripStrings(lines[i]);
        if (/^\s*(\/\/|\*)/.test(code)) continue;

        // A scalar: `const FOO = 34;` / `export const FOO: number = 0.5;`
        const scalar = code.match(new RegExp(String.raw`^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(${NUM})\s*;`));
        if (scalar && !isStructural(Number(scalar[2]))) {
            out.push({ line: i + 1, kind: 'const', expr: `const ${scalar[1]} = ${scalar[2]}` });
            continue;
        }

        // A table: `const FOO = { ... }` / `const FOO: Record<X, number> = { ... }`
        const opens = code.match(/^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*\{\s*$/);
        if (!opens) continue;
        let depth = 1;
        let numeric = 0;
        let other = 0;
        let j = i + 1;
        for (; j < lines.length && depth > 0; j++) {
            const inner = stripStrings(lines[j]);
            depth += (inner.match(/\{/g) ?? []).length - (inner.match(/\}/g) ?? []).length;
            if (depth <= 0) break;
            if (/^\s*(\/\/|\*)/.test(inner) || inner.trim() === '') continue;
            const entry = inner.match(new RegExp(String.raw`^\s*(?:\[[^\]]+\]|'[^']*'|"[^"]*"|[\w$]+)\s*:\s*(.+?),?\s*$`));
            if (!entry) continue;
            if (new RegExp(String.raw`^${NUM}$`).test(entry[1].trim())) {
                if (!isStructural(Number(entry[1]))) numeric++;
            } else other++;
        }
        if (numeric >= 2 && other === 0) {
            out.push({ line: i + 1, kind: 'table', expr: `const ${opens[1]} = { ${numeric} numeric entries }` });
        }
        i = j;
    }
    return out;
}

function walk(dir: string, acc: string[] = []): string[] {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full, acc);
        else if (/\.tsx?$/.test(e.name)) acc.push(full);
    });
    return acc;
}

const EXEMPT = /\/\/\s*balance-exempt:\s*\S/;

const findings: Finding[] = [];
SCAN_DIRS.filter(d => fs.existsSync(d)).forEach(dir => {
    walk(dir).forEach(file => {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        const text = fs.readFileSync(file, 'utf8');
        const lines = text.split('\n');
        lines.forEach((line, i) => {
            if (EXEMPT.test(line)) return;
            if (i > 0 && EXEMPT.test(lines[i - 1]) && lines[i - 1].trim().startsWith('//')) return;
            scanLine(line).forEach(f => findings.push({ file: rel, line: i + 1, ...f }));
        });
        scanConsts(text).forEach(f => {
            const line = lines[f.line - 1] ?? '';
            const above = lines[f.line - 2] ?? '';
            if (EXEMPT.test(line)) return;
            if (EXEMPT.test(above) && above.trim().startsWith('//')) return;
            findings.push({ file: rel, ...f });
        });
    });
});

/** Baseline key: file + expression text, so reformatting does not churn it. */
const keyOf = (f: Finding) => `${f.file} :: ${f.kind} :: ${f.expr.replace(/\s+/g, ' ')}`;

const counted = new Map<string, number>();
findings.forEach(f => counted.set(keyOf(f), (counted.get(keyOf(f)) ?? 0) + 1));

if (process.argv.includes('--write-baseline')) {
    const obj: Record<string, number> = {};
    [...counted.keys()].sort().forEach(k => { obj[k] = counted.get(k)!; });
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(obj, null, 2) + '\n');
    console.log(`Wrote baseline with ${counted.size} entries (${findings.length} sites).`);
    process.exit(0);
}

const baseline: Record<string, number> = fs.existsSync(BASELINE_PATH)
    ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
    : {};

const added: string[] = [];
const removed: string[] = [];
counted.forEach((n, k) => {
    const was = baseline[k] ?? 0;
    if (n > was) added.push(`${k}${n - was > 1 ? ` (x${n - was} new)` : ''}`);
});
Object.entries(baseline).forEach(([k, was]) => {
    const now = counted.get(k) ?? 0;
    if (now < was) removed.push(`${k}${was - now > 1 ? ` (x${was - now})` : ''}`);
});

if (added.length > 0) {
    console.error('Undeclared tunables in the engine (move them into src/data/balance.ts):');
    added.forEach(a => console.error(`  + ${a}`));
    console.error(
        '\nIf the number really is structural rather than tunable, annotate the line with'
        + '\n  // balance-exempt: <why this is not a knob>');
}
if (removed.length > 0) {
    console.error(`${added.length > 0 ? '\n' : ''}Baseline entries no longer present:`);
    removed.forEach(r => console.error(`  - ${r}`));
    console.error('\nGood — you migrated them. Shrink the baseline to match:'
        + '\n  npx tsx scripts/check-undeclared-knobs.ts --write-baseline');
}
if (added.length > 0 || removed.length > 0) process.exit(1);

console.log(
    `No new undeclared tunables. ${findings.length} known site${findings.length === 1 ? '' : 's'} `
    + `across ${new Set(findings.map(f => f.file)).size} files remain in the baseline.`);
