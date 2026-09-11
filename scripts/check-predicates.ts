/**
 * §1.8 (audit): unreachable data predicates.
 *
 * `nobodys-ally` tested `metAnybodyAfterBloodbath === false` against a field
 * that is declared `?: boolean` and only ever assigned `true`, so it could not
 * fire — and `check-achievements` reported it as "never unlocked" alongside
 * the genuinely hard entries, which hid it. The shape generalises: any
 * optional boolean that is only ever written with one value has exactly two
 * states, and a comparison against the value it never takes is either always
 * false (`=== never`) or always true (`!== never`).
 *
 * This walks every optional boolean on `Tribute` and `GameState`, finds which
 * literal values the engine ever writes to it, and then reads every
 * achievement `test` and `nearMiss` source for a comparison against a value
 * that is never written. Crude by design — it reads source text, not types —
 * so it under-reports rather than crying wolf.
 *
 *   npm run test:predicates
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ACHIEVEMENTS, META_ACHIEVEMENTS } from '../src/data/achievements';

function walk(dir: string, out: string[] = []): string[] {
    readdirSync(dir).forEach(name => {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.tsx?$/.test(p)) out.push(p);
    });
    return out;
}

const types = readFileSync('src/models/types.ts', 'utf8');
const optionalBooleans = new Set<string>();
for (const m of types.matchAll(/^\s+(\w+)\?: boolean;/gm)) optionalBooleans.add(m[1]);

// Every literal value the engine writes to each field: `x.field = true`,
// `field: false` in an object literal, `x.field ??= true`.
const written: Record<string, Set<string>> = {};
const sources = walk('src').filter(p => !p.endsWith('achievements.ts'));
for (const p of sources) {
    const src = readFileSync(p, 'utf8');
    for (const field of optionalBooleans) {
        if (!written[field]) written[field] = new Set();
        const re = new RegExp(`(?:\\.|\\b)${field}\\s*(?:=|\\?\\?=|:)\\s*(true|false)\\b`, 'g');
        for (const m of src.matchAll(re)) written[field].add(m[1]);
        // `= !x`, `= cond`, `= rng.chance(...)`: an expression write can be
        // either value, so the field is not single-valued.
        const expr = new RegExp(`\\.${field}\\s*=(?!=)(?!\\s*(?:true|false)\\b)`, 'g');
        if (expr.test(src)) { written[field].add('true'); written[field].add('false'); }
    }
}

const problems: string[] = [];
const all = [...ACHIEVEMENTS.map(a => ({ id: a.id, fns: [['test', a.test], ['nearMiss', a.nearMiss]] as const })),
    ...META_ACHIEVEMENTS.map(a => ({ id: a.id, fns: [['test', a.test]] as const }))];
for (const a of all) {
    for (const [label, fn] of a.fns) {
        if (!fn) continue;
        const src = fn.toString();
        for (const m of src.matchAll(/\.(\w+)\s*(===|!==)\s*(true|false)\b/g)) {
            const [, field, op, value] = m;
            if (!optionalBooleans.has(field)) continue;
            const seen = written[field] ?? new Set();
            if (seen.size === 0) {
                problems.push(`${a.id} (${label}): compares '${field}' which nothing in src/ ever assigns`);
            } else if (!seen.has(value)) {
                const verdict = op === '===' ? 'can never be true' : 'is always true';
                problems.push(`${a.id} (${label}): '${field} ${op} ${value}' ${verdict} — the field is only ever set ${[...seen].join('/')}`);
            }
        }
    }
}

console.log(`predicate check: ${optionalBooleans.size} optional booleans on Tribute/GameState, `
    + `${all.length} achievements read`);
if (problems.length > 0) {
    console.log(`\nFAIL: ${problems.length} unreachable predicate(s):`);
    problems.forEach(p => console.log(`  ${p}`));
    process.exit(1);
}
console.log('No achievement compares an optional boolean against a value it never takes.');
