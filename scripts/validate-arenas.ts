/**
 * Structural check on the hand-authored arenas: every zone reachable, every
 * adjacency symmetric, every arena backed by its own flavour pack.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ARENAS } from '../src/data/constants';
import { ARENA_FLAVOR, GENERIC_ARENA_FLAVOR, PROCEDURAL_FLAVOR_PACKS } from '../src/data/arenaFlavor';
import { DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { ArenaLawId, GameState } from '../src/models/types';
import { ARENA_MUTTS } from '../src/data/mutts';
import { Simulator } from '../src/engine/simulator';
import { generateTributes } from '../src/engine/generator';
import { gamesProfileFor } from '../src/engine/gamesProfile';

const problems: string[] = [];
/** §5.12: things worth saying out loud that are not build failures. */
const notes: string[] = [];

/** Every real `ZoneEffectKind`, for the effectVocab key check below. */
const EFFECT_KINDS = new Set<string>([
    'burning', 'flooded', 'frozen', 'contaminated', 'fogbound', 'stripped', 'blooming', 'irradiated',
]);

/** §5.12: authored events per arena, below which an arena reads as generic. */
const AUTHORED_EVENT_TARGET = 12;

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

    // §5.12: the checks the structural pass was missing. All three are things
    // that fail silently at runtime rather than loudly at authoring time: a
    // law that points at a zone which does not exist simply never applies, and
    // an effectVocab key that is not a real ZoneEffectKind renames nothing.
    if (arena.lawZone && !names.has(arena.lawZone)) {
        problems.push(`${arena.id}: lawZone '${arena.lawZone}' is not one of its zones`);
    }
    // `sponsorsFixedZone` without a drop zone means no gift ever lands, which
    // is a different law wearing this one's name. `noWaterExceptZone` is
    // exempt on purpose: the Warren omits `lawZone` to mean "nowhere at all".
    if ((arena.law === 'sponsorsFixedZone' || (arena.laws ?? []).includes('sponsorsFixedZone'))
        && !arena.lawZone) {
        problems.push(`${arena.id}: sponsorsFixedZone needs a lawZone and has none`);
    }
    Object.keys(arena.effectVocab ?? {}).forEach(kind => {
        if (!EFFECT_KINDS.has(kind)) problems.push(`${arena.id}: effectVocab key '${kind}' is not a ZoneEffectKind`);
    });
    // §5.12: an arena's mutt roster must cover the terrain it is made of, or
    // whole zones are mechanically toothless. `terrainPreference` is a hard
    // filter (engine/mutts), so an uncovered terrain is not "rarely dangerous",
    // it is a permanent safe haven — which is why this is fatal, not a note.
    // (This check was dead for its whole life: it read `m.terrains`, a field
    // that does not exist, so `uncovered` was unconditionally empty.)
    const roster = ARENA_MUTTS[arena.id] ?? [];
    if (roster.length > 0) {
        // A mutt with no `terrainPreference` at all is eligible everywhere, so
        // its presence alone covers the whole arena.
        const universal = roster.some(m => !m.terrainPreference || m.terrainPreference.length === 0);
        const covered = new Set(roster.flatMap(m => m.terrainPreference ?? []));
        const uncovered = universal
            ? []
            : [...new Set(arena.zones.map(z => z.terrain))].filter(terrain => !covered.has(terrain));
        if (uncovered.length > 0) {
            problems.push(`${arena.id}: no mutt eligible on ${uncovered.join(', ')} — those zones are mutt-proof forever`);
        }
    }
});

// Both directions, exactly: every ARENA_FLAVOR key names a real hand-authored
// arena (a typo'd id can no longer hide among procedural tags — those live in
// PROCEDURAL_FLAVOR_PACKS now), and every procedural pack key is a tag.
const arenaIds = new Set(ARENAS.map(a => a.id));
Object.keys(ARENA_FLAVOR).forEach(id => {
    if (!arenaIds.has(id)) problems.push(`${id}: flavour pack has no matching arena (typo, or belongs in PROCEDURAL_FLAVOR_PACKS)`);
});
Object.keys(PROCEDURAL_FLAVOR_PACKS).forEach(id => {
    if (!id.startsWith('procedural-')) problems.push(`${id}: procedural pack key must start with 'procedural-'`);
    if (arenaIds.has(id)) problems.push(`${id}: procedural pack shadows a hand-authored arena id`);
});

Object.entries({ ...ARENA_FLAVOR, ...PROCEDURAL_FLAVOR_PACKS }).forEach(([id, flavor]) => {
    if (flavor.events.length < 3) problems.push(`${id}: flavour pack has fewer than 3 events`);
    // §7b: every arena should carry a dozen of its own before the universal
    // pool starts speaking for it. A note, not a failure — the gap is an
    // authoring backlog, and failing the build on it helps nobody.
    if (flavor.events.length < AUTHORED_EVENT_TARGET) {
        notes.push(`${id}: ${flavor.events.length} authored events (target ${AUTHORED_EVENT_TARGET})`);
    }
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
 * §1.10: cycles must advance at the same rate under every arena law.
 *
 * `finalistCycles`, `blackoutUntilCycle`, the stance cooldowns and the trap and
 * memory decay clocks are all counted in *cycles*, while the border collapse
 * and the escalation schedule are counted in *days*. That equivalence only
 * holds because every day runs exactly two `processDayNight` calls. The
 * `noNight` law was the case worth checking: it makes the arena never go dark,
 * and if it had been implemented by skipping the night phase rather than by
 * keeping `timeOfDay` at 'day', every cycle-counted clock in the engine would
 * have run at half rate relative to every other arena — silently, and only in
 * the arenas that carry the law.
 *
 * It is implemented the right way. This is the check that keeps it that way.
 */
{
    const LAWS_TO_CHECK: Array<ArenaLawId | undefined> = [undefined, 'noNight', 'noCannons', 'fireImpossible', 'noSponsors', 'noHealing'];
    const DAYS = 4;
    LAWS_TO_CHECK.forEach(law => {
        const base = ARENAS[0];
        const arena = { ...base, zones: base.zones.map(z => ({ ...z })), law };
        const seed = `cycle-law-${law ?? 'none'}`;
        const gamesProfile = gamesProfileFor(seed);
        const tributes = generateTributes(seed, DEFAULT_GAME_CONFIG, arena.zones[0].name, gamesProfile.castShape);
        const state = {
            seed, arena, tributes, phase: 'day', day: 1, log: [], gamemakerMode: false,
            config: DEFAULT_GAME_CONFIG, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile,
            logCounter: 0, feastsHeld: 0, cycle: 0,
        } as unknown as GameState;
        // `Simulator` snapshots the state it is handed, so the live object to
        // read afterwards is the simulator's own, not the literal above.
        const sim = new Simulator(state);
        const live = sim.getState();
        const startDay = live.day;
        let guard = 200;
        while (live.day < startDay + DAYS && guard-- > 0) {
            if (!sim.processTurn()) break;
        }
        const daysElapsed = live.day - startDay;
        const cycles = live.cycle ?? 0;
        // Two cycles a day, every day, whatever the law says about the sky.
        // A run that ends early (a wipeout) is not evidence either way.
        if (daysElapsed > 0 && cycles !== daysElapsed * 2) {
            problems.push(
                `arena law ${law ?? 'none'}: ${cycles} cycles across ${daysElapsed} days — `
                + 'every cycle-counted clock in the engine assumes exactly two per day'
            );
        }
    });
}

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
if (notes.length) {
    console.log('\nNOTES (not failures):\n' + notes.map(n => ' - ' + n).join('\n'));
}
if (problems.length) {
    console.log('\nPROBLEMS:\n' + problems.map(p => ' - ' + p).join('\n'));
    process.exit(1);
}
console.log('\nAll arenas structurally sound.');
