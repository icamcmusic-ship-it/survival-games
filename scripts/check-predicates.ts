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
import { calendarOf, gamesProfileFor } from '../src/engine/gamesProfile';

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

/**
 * Audit 4 §8.6: hard-coded `traits.includes('X')` sites, ratcheted.
 *
 * `data/traits.ts` opens by documenting the failure it exists to remove: "the
 * old table was fifteen strings and a documentation file, consumed by a dozen
 * scattered `traits.includes('...')` checks... the fix is not to add more
 * if-statements". A grep found 56 of them still in the engine three audits
 * later, because nothing counted.
 *
 * They are not all wrong. A trait with genuinely bespoke behaviour — Pacifist
 * refusing a fight, Merciful sparing somebody downed — has to be read by name
 * somewhere, and turning each into a `TraitMod` hook is real design work per
 * trait rather than a rename. What is wrong is the number drifting upward
 * unobserved, and what was *clearly* wrong was `Star-Crossed` at twelve sites:
 * a state flag stored in the trait array, with no `mods` row because there is
 * nothing for one to say, read by name in twelve places. It has a predicate
 * now (`isStarCrossed`), which is what any of these should get once they earn
 * a second read site.
 *
 * The ceiling is a ratchet. Lower it when a conversion lands; never raise it.
 */
{
    const TRAIT_LITERAL_CEILING = 44;
    const files = walk('src');
    const counts = new Map<string, number>();
    let total = 0;
    files.forEach(file => {
        if (file.endsWith('data/traits.ts')) return;
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(/traits\.includes\('([A-Z][A-Za-z' -]*)'\)/g)) {
            counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
            total += 1;
        }
    });
    const heaviest = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`\nhard-coded traits.includes() sites: ${total} (ceiling ${TRAIT_LITERAL_CEILING})`
        + `; heaviest ${heaviest.map(([name, n]) => `${name} ${n}`).join(', ')}`);
    if (total > TRAIT_LITERAL_CEILING) {
        problems.push(
            `${total} hard-coded \`traits.includes('X')\` sites, over the ceiling of ${TRAIT_LITERAL_CEILING}. `
            + 'Give the trait a `mods` row, or a named predicate where it is a state flag rather than a disposition.');
    }
}

/*
 * AUDIT-7: the wildcard calendar must not carry the same beat twice.
 *
 * A Quell's `standingWildcards` are appended to the free draw, and nothing
 * stopped the draw from having produced the same kind on the same day — The
 * Silence stands `silent-arena`, which is also in the pool. The reaping keys
 * its calendar by `day-kind`, so the run rendered two children with the key
 * `0-silent-arena` and React logged it. 50 of 4,000 forced-Quell seeds hit it,
 * which is exactly the density that makes the browser test a coin flip: it
 * caught this one in CI having passed locally on the same commit. This is the
 * deterministic version of that guard.
 */
{
    const CALENDAR_SEEDS = 4000;
    const bad: string[] = [];
    for (let i = 0; i < CALENDAR_SEEDS; i++) {
        const seed = `calendar-${i}`;
        // Forced, because a Quell is the only source of a standing beat that
        // can collide with the draw, and it is rare enough otherwise that a
        // sweep this size would mostly test the uncollidable case.
        const keys = calendarOf(gamesProfileFor(seed, true)).map(w => `${w.day}-${w.kind}`);
        if (new Set(keys).size !== keys.length) bad.push(`${seed}: ${keys.join(', ')}`);
    }
    console.log(`\nwildcard calendars swept: ${CALENDAR_SEEDS}; with a repeated day-kind: ${bad.length}`);
    if (bad.length > 0) {
        problems.push(`${bad.length} seed(s) roll a calendar with the same beat twice — e.g. ${bad[0]}`);
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

