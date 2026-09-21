/**
 * AUDIT-10 F21: the catalogue and test inventory, generated rather than
 * remembered.
 *
 * The README said UI testing was excluded from CI while `.github/workflows/ci.yml`
 * had a browser job; it said "all 130-odd predicates" against a table of 396;
 * it said "fifteen" archetypes against 36. Every one of those numbers was true
 * when it was written and none of them was true any more, because a prose
 * count of a table is a copy of that table which nothing updates.
 *
 * So the counts come from the tables. Run `npm run catalog` and paste the block
 * it prints, or read it in CI. A number in the README that this script can
 * produce should be produced by this script.
 */
import { ARENAS, ITEMS, TRAITS } from '../src/data/constants';
import { ARCHETYPES } from '../src/data/archetypes';
import { ACHIEVEMENTS, META_ACHIEVEMENTS } from '../src/data/achievements';
import { readFileSync } from 'node:fs';

function count<T>(value: Record<string, T> | readonly T[]): number {
    return Array.isArray(value) ? value.length : Object.keys(value).length;
}

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const scripts = Object.keys(pkg.scripts).filter(k => k.startsWith('test:'));
const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const inCi = scripts.filter(k => ci.includes(`npm run ${k}`));
const notInCi = scripts.filter(k => !inCi.includes(k));

console.log('Catalogue');
console.log(`  arenas (authored)   ${count(ARENAS)}  (plus procedural generation)`);
console.log(`  archetypes          ${count(ARCHETYPES)}`);
console.log(`  traits              ${count(TRAITS)}`);
console.log(`  achievements (run)  ${count(ACHIEVEMENTS)}`);
console.log(`  achievements (meta) ${count(META_ACHIEVEMENTS)}`);
console.log(`  items               ${count(ITEMS)}`);
console.log('');
console.log('Test inventory');
console.log(`  checks defined      ${scripts.length}`);
console.log(`  run in CI           ${inCi.length}  (${inCi.join(', ')})`);
console.log(`  not run in CI       ${notInCi.length}${notInCi.length ? `  (${notInCi.join(', ')})` : ''}`);
