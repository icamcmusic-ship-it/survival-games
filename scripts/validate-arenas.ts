/**
 * Structural check on the hand-authored arenas: every zone reachable, every
 * adjacency symmetric, every arena backed by its own flavour pack.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ARENAS } from '../src/data/constants';
import { ARENA_FLAVOR, GENERIC_ARENA_FLAVOR } from '../src/data/arenaFlavor';

const problems: string[] = [];

ARENAS.forEach(arena => {
    const names = new Set(arena.zones.map(z => z.name));
    if (names.size !== arena.zones.length) problems.push(`${arena.id}: duplicate zone names`);

    arena.zones.forEach(z => {
        z.adjacent.forEach(n => {
            if (!names.has(n)) problems.push(`${arena.id}: ${z.name} points at unknown zone ${n}`);
            const other = arena.zones.find(o => o.name === n);
            if (other && !other.adjacent.includes(z.name)) {
                problems.push(`${arena.id}: ${z.name} -> ${n} is not symmetric`);
            }
        });
        if (z.danger < 0 || z.danger > 1) problems.push(`${arena.id}: ${z.name} danger out of range`);
        if (z.resources < 0 || z.resources > 1) problems.push(`${arena.id}: ${z.name} resources out of range`);
    });

    // Connectivity from the Cornucopia (zone 0).
    const seen = new Set<string>([arena.zones[0].name]);
    const queue = [arena.zones[0]];
    while (queue.length) {
        const z = queue.shift()!;
        z.adjacent.forEach(n => {
            if (seen.has(n)) return;
            seen.add(n);
            const next = arena.zones.find(o => o.name === n);
            if (next) queue.push(next);
        });
    }
    if (seen.size !== arena.zones.length) {
        problems.push(`${arena.id}: ${arena.zones.length - seen.size} zone(s) unreachable from the Cornucopia`);
    }

    if (!ARENA_FLAVOR[arena.id]) problems.push(`${arena.id}: no arena flavour pack (falls back to generic)`);
    // §8.3: mutt count varies by design — one arena with a single persistent
    // horror is a different game from one with five kinds of teeth. An arena
    // does still need at least one.
    if (arena.mutts.length < 1) problems.push(`${arena.id}: no mutts at all`);
    if (arena.events.length < 3) problems.push(`${arena.id}: fewer than 3 signature events`);
});

Object.entries(ARENA_FLAVOR).forEach(([id, flavor]) => {
    if (flavor.events.length < 3) problems.push(`${id}: flavour pack has fewer than 3 events`);
    if (flavor.ambient.length < 3) problems.push(`${id}: flavour pack has fewer than 3 ambient lines`);
    (['forage', 'rest', 'hide', 'hunt', 'travel'] as const).forEach(k => {
        if (flavor.actions[k].length < 3) problems.push(`${id}: flavour pack ${k} pool is thin`);
    });
    flavor.events.forEach(e => {
        if (!e.cause) problems.push(`${id}: event without a cause of death`);
        if (!/\{tribute\}/.test(e.text)) problems.push(`${id}: event text never names the tribute`);
        if (!/\{tribute\}/.test(e.escapeText)) problems.push(`${id}: escape text never names the tribute`);
    });
});

if (GENERIC_ARENA_FLAVOR.events.length < 1) problems.push('generic flavour has no events');

/**
 * Source guard: no seeded shuffle may go through a random sort comparator.
 *
 * `[...arr].sort(() => rng() - 0.5)` is deterministic *within* one JS engine,
 * so a same-process replay check can never catch it — but it consumes a
 * different number of RNG draws depending on the engine's sort algorithm, so
 * the same seed builds a different arena in a different browser. That silently
 * breaks the "same seed always replays the same Games" promise the Share URL
 * rests on. `RNG.shuffle()` exists precisely to avoid it; this check is what
 * stops a new call site from reintroducing it.
 */
const RANDOM_SORT = /\.sort\s*\(\s*\(\s*\)\s*=>[^)]*(?:rng|random|Math\.random)/i;
function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(entry => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return walk(full);
        return /\.tsx?$/.test(entry) ? [full] : [];
    });
}
walk('src').forEach(file => {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return;
        if (RANDOM_SORT.test(line)) {
            problems.push(`${file}:${i + 1} sorts with a random comparator — use RNG.shuffle() instead`);
        }
    });
});

console.log(`arenas=${ARENAS.length} flavourPacks=${Object.keys(ARENA_FLAVOR).length} sourcesScanned=${walk('src').length}`);
console.log(ARENAS.map(a => `  ${a.id.padEnd(12)} ${a.zones.length} zones  ${a.name}`).join('\n'));
if (problems.length) {
    console.log('\nPROBLEMS:\n' + problems.map(p => ' - ' + p).join('\n'));
    process.exit(1);
}
console.log('\nAll arenas structurally sound.');
