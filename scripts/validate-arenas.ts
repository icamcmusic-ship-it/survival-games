/**
 * Structural check on the hand-authored arenas: every zone reachable, every
 * adjacency symmetric, every arena backed by its own flavour pack.
 */
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
    if (arena.mutts.length < 3) problems.push(`${arena.id}: fewer than 3 mutts`);
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

console.log(`arenas=${ARENAS.length} flavourPacks=${Object.keys(ARENA_FLAVOR).length}`);
console.log(ARENAS.map(a => `  ${a.id.padEnd(12)} ${a.zones.length} zones  ${a.name}`).join('\n'));
if (problems.length) {
    console.log('\nPROBLEMS:\n' + problems.map(p => ' - ' + p).join('\n'));
    process.exit(1);
}
console.log('\nAll arenas structurally sound.');
