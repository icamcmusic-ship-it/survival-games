/**
 * §1.13/§10.3: fail CI on unreferenced exports from balance.ts.
 *
 * balance.ts is documented as the one file you edit to rebalance the game, so
 * a dead knob there is worse than a dead constant elsewhere: it silently
 * absorbs tuning effort. This walks every `export const GROUP = { leafKey: … }`
 * in balance.ts and greps the rest of src/ for `GROUP.leafKey`; any leaf with
 * zero references fails the build.
 *
 *   npm run test:knobs
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const BALANCE = path.join(ROOT, 'data', 'balance.ts');

const source = fs.readFileSync(BALANCE, 'utf8');

// Collect { group -> leaf keys } from `export const GROUP = { ... } as const;`
const groups: Record<string, string[]> = {};
const groupRe = /export const (\w+)\s*=\s*\{/g;
let m: RegExpExecArray | null;
while ((m = groupRe.exec(source)) !== null) {
    const name = m[1];
    // Walk to the matching close brace from the opening one.
    let depth = 0, i = groupRe.lastIndex - 1;
    let end = i;
    for (; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    const body = source.slice(groupRe.lastIndex, end);
    // Top-level keys only: lines like `    key: value,` at one indent level.
    const keys: string[] = [];
    let bodyDepth = 0;
    body.split('\n').forEach(line => {
        const keyMatch = bodyDepth === 0 && /^\s{4}(\w+)\s*:/.exec(line);
        if (keyMatch) keys.push(keyMatch[1]);
        for (const ch of line) {
            if (ch === '{' || ch === '[' || ch === '(') bodyDepth++;
            else if (ch === '}' || ch === ']' || ch === ')') bodyDepth--;
        }
    });
    if (keys.length > 0) groups[name] = keys;
}

// Concatenate every other source file once.
const files: string[] = [];
(function walk(dir: string) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e.name) && full !== BALANCE) files.push(full);
    });
})(ROOT);
const corpus = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');

const dead: string[] = [];
Object.entries(groups).forEach(([group, keys]) => {
    if (!new RegExp(`\\b${group}\\b`).test(corpus)) {
        dead.push(`${group} (entire group unreferenced)`);
        return;
    }
    keys.forEach(key => {
        if (!new RegExp(`${group}\\s*\\.\\s*${key}\\b`).test(corpus)
            // Destructured use: `const { key } = GROUP` or `key } = GROUP`.
            && !new RegExp(`\\{[^}]*\\b${key}\\b[^}]*\\}\\s*=\\s*${group}\\b`).test(corpus)) {
            dead.push(`${group}.${key}`);
        }
    });
});

if (dead.length > 0) {
    console.error(`Dead balance knobs (declared in balance.ts, referenced nowhere in src/):`);
    dead.forEach(d => console.error(`  - ${d}`));
    console.error(`\nDelete the knob or implement the behaviour it promises.`);
    process.exit(1);
}
console.log(`All ${Object.values(groups).reduce((n, k) => n + k.length, 0)} balance knobs across ${Object.keys(groups).length} groups are referenced.`);
