/**
 * Structural check on the hand-authored arenas: every zone reachable, every
 * adjacency symmetric, every arena backed by its own flavour pack.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ARENAS } from '../src/data/constants';
import { ARENA_FLAVOR, GENERIC_ARENA_FLAVOR } from '../src/data/arenaFlavor';
import { NEW_ARENA_FLAVOR } from '../src/data/arenaFlavorNew';
import { DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { ArenaLawId, GameState } from '../src/models/types';
import { ARENA_MUTTS } from '../src/data/mutts';
import { AUDIT12_WAVE2_ARENA } from '../src/data/balance';
import { CLIMATE_LABELS } from '../src/data/arenaBriefing';
import { usesUniversalPack } from '../src/data/arenaEventPacks';
import { OFF_SEASON_SKINS } from '../src/data/offSeason';
import { Simulator } from '../src/engine/simulator';
import { hasSignature } from '../src/engine/arenaSignature';
import { SIGNATURE_BLURBS } from '../src/data/signatureBlurbs';
import { generateTributes } from '../src/engine/generator';
import { gamesProfileFor } from '../src/engine/gamesProfile';
import { generateArena, PROCEDURAL_BIOME_COUNT } from '../src/engine/arenaGenerator';
import { zoneFeatures } from '../src/engine/map';
import { proceduralArenaFlavor } from '../src/data/proceduralFlavor';
import { arenaHasLaw } from '../src/engine/gamesProfile';
import { hasActs } from '../src/engine/arenaDepth';
import { strandedZones } from '../src/engine/arenaRules';

const problems: string[] = [];
/** §5.12: things worth saying out loud that are not build failures. */
const notes: string[] = [];
/** §7.3: packs above the hard floor but still short of the target. */
const underTarget: string[] = [];

/** Every real `ZoneEffectKind`, for the effectVocab key check below. */
const EFFECT_KINDS = new Set<string>([
    'burning', 'flooded', 'frozen', 'contaminated', 'fogbound', 'stripped', 'blooming', 'irradiated',
    // §7: ground instability and infestation.
    'quaking', 'swarming',
]);

/**
 * §7.3: authored events per arena, as a ratchet rather than a flag day.
 *
 * The old shape of this check was a single number, 12, reported as a note.
 * That number became the authoring target: every one of the forty
 * hand-authored arenas landed on exactly twelve events, three landed on
 * thirteen, and none landed anywhere near twenty. The floor was being hit and
 * treated as done — which is what a floor reported as a note will always
 * produce.
 *
 * So it works the way `check-flavor-pools`'s `KNOWN_THIN` allowance and
 * `check-undeclared-knobs` do instead. There are two numbers:
 *
 *  - `AUTHORED_EVENT_FLOOR` is the guaranteed minimum every pack is at or
 *    above *today*. It is a hard build failure, and it may only ever be
 *    raised. Raising it is the whole point: author content, then move it up,
 *    and the improvement can never regress.
 *  - `AUTHORED_EVENT_TARGET` is where the roster is going. Packs below it are
 *    counted, and the count may shrink and may not grow — so a new arena
 *    cannot land under-written and an existing one cannot be trimmed.
 *
 * A ~9.8-day run pulls hundreds of event draws. Twelve authored events means a
 * player sees every one of an arena's own beats several times in a single
 * Games; twenty-four is the point at which an arena can carry a run in its own
 * voice. That is what the target is set to, and the floor walks up to meet it.
 */
const AUTHORED_EVENT_TARGET = 40;
/**
 * The guaranteed minimum. Raise it — never lower it — when the thinnest pack
 * clears a new number. History: 12 (every pack authored to exactly the old
 * note's threshold) -> 18 -> 24 -> 33.
 *
 * AUDIT-7 §1.7/§1.8: 24 was not what the roster guaranteed, it was what the
 * four dead `PROCEDURAL_FLAVOR_PACKS` entries happened to carry — and the floor
 * was computed across every pack at once, so four packs no player could reach
 * were holding the number nine events below what all 45 hand-authored packs
 * actually clear. The dead packs are gone and the floor is the real one.
 */
const AUTHORED_EVENT_FLOOR = 33;
/**
 * Packs still under the target. It is not allowed to rise, so a trimmed pack
 * or a thin new arena fails the build.
 *
 * AUDIT-7 §1.7: this used to read 0, because `AUTHORED_EVENT_TARGET` had been
 * set equal to `AUTHORED_EVENT_FLOOR`. Two numbers that are the same number are
 * one number: `underTarget` was structurally always empty, the distance-to-go
 * was structurally always zero, and the note printed "0 of 44 pack(s) under the
 * target" while `check-flavor-pools` — measuring the same statistic against the
 * 40 the README documents — printed "277 events to go". The target is 40 again
 * and this is the measured backlog.
 */
const KNOWN_UNDER_TARGET = 40;

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
    // Audit 5 §1.1: five arenas shipped with no signature and no blurb, and
    // `runArenaSignature` no-oped in them for the whole run. An arena is not
    // an arena without a rule of its own.
    if (!hasSignature(arena.id, arena.signatureRule)) problems.push(`${arena.id}: no SIGNATURES entry and no signatureRule — runArenaSignature does nothing here`);
    if (!SIGNATURE_BLURBS[arena.id]) problems.push(`${arena.id}: no SIGNATURE_BLURBS entry — the setup screen cannot say what this arena does`);
    // §8.3: mutt count varies by design — one arena with a single persistent
    // horror is a different game from one with five kinds of teeth. An arena
    // does still need at least one.
    if (arena.mutts.length < 1) problems.push(`${arena.id}: no mutts at all`);
    // AUDIT-12 §8.7: the roster floor. Three creatures on a loop for nine days
    // is not a roster.
    if ((ARENA_MUTTS[arena.id] ?? []).length < AUDIT12_WAVE2_ARENA.muttRosterFloor) problems.push(`${arena.id}: ${(ARENA_MUTTS[arena.id] ?? []).length} mutts in ARENA_MUTTS, floor is ${AUDIT12_WAVE2_ARENA.muttRosterFloor}`);
    // §1.11: `Arena.mutts` is flavour the engine ignores — it resolves mutts
    // through ARENA_MUTTS — so it drifted with nothing to notice. Five arenas
    // carried a roster mutt their briefing never named. Both lists must agree.
    const briefingRoster = (ARENA_MUTTS[arena.id] ?? []).map(m => m.name);
    arena.mutts.filter(m => !briefingRoster.includes(m)).forEach(m =>
        problems.push(`${arena.id}: briefing names mutt "${m}" that is not in its ARENA_MUTTS roster`));
    briefingRoster.filter(m => !arena.mutts.includes(m)).forEach(m =>
        problems.push(`${arena.id}: roster mutt "${m}" is missing from the arena's mutts briefing`));
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
    // §5.5: the same failure mode as a bad `lawZone`, and a wider one now that
    // there are seven edge kinds. An `edgeRules` key is `edgeKey(a, b)` — the
    // two zone names sorted and joined — and nothing ever checked that either
    // half names a real zone, that the two are actually adjacent, or that a
    // directional rule's `from`/`to` are the endpoints it claims. Every one of
    // those mistakes is silent: the rule simply never matches an edge anybody
    // walks, and the arena plays as though it were never written.
    Object.entries(arena.edgeRules ?? {}).forEach(([key, rule]) => {
        const parts = key.split('|');
        if (parts.length !== 2) {
            problems.push(`${arena.id}: edgeRules key '${key}' is not 'zone|zone'`);
            return;
        }
        const [a, b] = parts;
        if (!names.has(a) || !names.has(b)) {
            problems.push(`${arena.id}: edgeRules key '${key}' names a zone the arena does not have`);
            return;
        }
        if ([a, b].join('|') !== [a, b].slice().sort().join('|')) {
            problems.push(`${arena.id}: edgeRules key '${key}' is not in edgeKey order (sorted) — it will never match`);
        }
        const za = arena.zones.find(z => z.name === a);
        if (za && !za.adjacent.includes(b)) {
            problems.push(`${arena.id}: edgeRules key '${key}' rules an edge that does not exist in the adjacency graph`);
        }
        if (rule.kind === 'oneWay' || rule.kind === 'oneWayAfter') {
            const ends = new Set([a, b]);
            if (!rule.from || !rule.to || !ends.has(rule.from) || !ends.has(rule.to) || rule.from === rule.to) {
                problems.push(`${arena.id}: edgeRules '${key}' is ${rule.kind} but its from/to are not the two endpoints`);
            }
        }
        if (rule.kind === 'timeGated' && !rule.gatedTime) {
            problems.push(`${arena.id}: edgeRules '${key}' is timeGated with no gatedTime — it gates nothing`);
        }
        if (rule.kind === 'tolled' && !rule.toll) {
            problems.push(`${arena.id}: edgeRules '${key}' is tolled with no toll — it charges nothing`);
        }
        // Audit 4 §1.1, constraint 1: a `hidden` edge is impassable until a
        // tribute has found it, and `tickHiddenEdges` only lets somebody find
        // it while they are *standing on one of its endpoints*. So at least one
        // endpoint must be reachable without it, or the edge can never be
        // discovered by anybody and the zones on both sides are cut off for
        // the whole run.
        //
        // One endpoint is enough, and deliberately so: nooneplace's `Exit` has
        // exactly one adjacency and that adjacency is hidden, which is the
        // arena working as written — a door you find from the corridor, not a
        // room you can wander into.
        if (rule.kind === 'hidden') {
            const reachable = [a, b].some(end => {
                const zone = arena.zones.find(z => z.name === end);
                return (zone?.adjacent ?? []).some(n => n !== (end === a ? b : a));
            });
            if (!reachable) {
                problems.push(`${arena.id}: edgeRules '${key}' is hidden and neither endpoint has another route — nobody can ever stand next to it to discover it`);
            }
        }
        // Audit 4 §1.1, constraint 2: `tickGarrisons` only considers an
        // endpoint where `zoneFeatures(zone).chokepoint` holds. A contested
        // edge between two open zones can never be claimed by anybody.
        if (rule.kind === 'contested') {
            const chokes = [a, b].filter(end => {
                const zone = arena.zones.find(z => z.name === end);
                return !!zone && zoneFeatures(zone).chokepoint;
            });
            if (chokes.length === 0) {
                problems.push(`${arena.id}: edgeRules '${key}' is contested but neither endpoint is a chokepoint — tickGarrisons can never claim it`);
            }
        }
        if (rule.kind === 'collapsing' && (rule.crossings ?? 0) <= 0) {
            problems.push(`${arena.id}: edgeRules '${key}' is collapsing with no positive 'crossings' — it goes on the first use`);
        }
        if (rule.kind === 'oneWayAfter' && (rule.after ?? 0) <= 0) {
            problems.push(`${arena.id}: edgeRules '${key}' is oneWayAfter with no positive 'after' — it is just a oneWay`);
        }
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
    if (!arenaIds.has(id)) problems.push(`${id}: flavour pack has no matching arena (typo, or belongs in data/proceduralBiomeEvents.ts)`);
});
Object.entries(ARENA_FLAVOR).forEach(([id, flavor]) => {
    if (flavor.events.length < 3) problems.push(`${id}: flavour pack has fewer than 3 events`);
    // §7.3: the floor is a build failure — it is the guarantee that no arena
    // in the roster has ever been allowed to fall back below.
    if (flavor.events.length < AUTHORED_EVENT_FLOOR) {
        problems.push(
            `${id}: ${flavor.events.length} authored events, under the guaranteed floor of ${AUTHORED_EVENT_FLOOR}`
            + ' — top it up, or lower AUTHORED_EVENT_FLOOR on purpose (which un-guarantees it for every arena)');
    } else if (flavor.events.length < AUTHORED_EVENT_TARGET) {
        underTarget.push(`${id}: ${flavor.events.length}`);
    }
    if (flavor.ambient.length < 3) problems.push(`${id}: flavour pack has fewer than 3 ambient lines`);
    (['forage', 'rest', 'hide', 'hunt', 'travel'] as const).forEach(k => {
        if (flavor.actions[k].length < 3) problems.push(`${id}: flavour pack ${k} pool is thin`);
    });
    // §7 (audit): an event gated on a law its own arena does not carry can
    // never fire. The warren authored one on `noCannons`. A Quell can force
    // any law onto any arena, so this is a note for a *universal* pool and a
    // problem for an arena's own pack.
    const arena = ARENAS.find(a => a.id === id);
    flavor.events.forEach(e => {
        if (arena && e.requires?.law && !arenaHasLaw({ arena, gamesProfile: undefined } as unknown as GameState, e.requires.law)) {
            problems.push(`${id}: event '${e.cause}' requires law '${e.requires.law}', which the arena does not carry (only a Quell could make it fire)`);
        }
        if (!e.cause) problems.push(`${id}: event without a cause of death`);
        if (!/\{tribute\}/.test(e.text)) problems.push(`${id}: event text never names the tribute`);
        // A pure boon has no escape: nothing rolls against it, so
        // `rollEscape` never reads its escape text and it may be empty.
        const boon = e.escapeText === '' && !e.dodgeStat && !e.dodgeAlt && !(e.damage ?? 0);
        if (!boon && !/\{tribute\}/.test(e.escapeText)) problems.push(`${id}: escape text never names the tribute`);
    });
});

/**
 * §7.3: the ratchet's second half. The count of packs short of the target may
 * fall and may not rise, exactly the way `check-flavor-pools` treats its thin
 * pools — so topping a pack up is always allowed, and adding a thin one or
 * trimming an existing one is not.
 */
if (underTarget.length > KNOWN_UNDER_TARGET) {
    problems.push(
        `${underTarget.length} flavour pack(s) are under the authored-event target of ${AUTHORED_EVENT_TARGET}, `
        + `up from a baseline of ${KNOWN_UNDER_TARGET}. Author the new one up, or raise KNOWN_UNDER_TARGET on purpose.`);
    underTarget.slice(0, 12).forEach(u => problems.push(`   ${u}`));
} else {
    const thinnest = Math.min(...Object.values(ARENA_FLAVOR).map(f => f.events.length));
    const eventsToGo = Object.values(ARENA_FLAVOR)
        .reduce((sum, f) => sum + Math.max(0, AUTHORED_EVENT_TARGET - f.events.length), 0);
    notes.push(
        `authored events: floor ${AUTHORED_EVENT_FLOOR} (thinnest pack ${thinnest}), `
        + `${underTarget.length} of ${Object.keys(ARENA_FLAVOR).length} pack(s) under the target of ${AUTHORED_EVENT_TARGET}`
        + ` (baseline ${KNOWN_UNDER_TARGET}, ${eventsToGo} events to go)`);
    if (underTarget.length < KNOWN_UNDER_TARGET) {
        notes.push(`lower KNOWN_UNDER_TARGET to ${underTarget.length} in scripts/validate-arenas.ts to lock that in`);
    }
    if (thinnest > AUTHORED_EVENT_FLOOR) {
        notes.push(`raise AUTHORED_EVENT_FLOOR to ${thinnest} in scripts/validate-arenas.ts to lock that in`);
    }
}

if (GENERIC_ARENA_FLAVOR.events.length < 1) problems.push('generic flavour has no events');

/**
 * §5.2 (audit): what a *generated* arena actually receives. The checks above
 * only ever saw the four static procedural packs; the flavour a live
 * procedural arena is composed from went unmeasured, and a generated run was
 * eight anonymous events and ~83% universal content. Every biome, at three
 * seeds, has to carry what a hand-authored arena does: authored events at
 * the floor, once-per-run beats, a chain, and ambient lines of its own.
 */
{
    const PROC_EVENT_FLOOR = 16;
    const PROC_ONCE_FLOOR = 2;
    const PROC_AMBIENT_FLOOR = 8;
    const biomes = [...new Set(Array.from({ length: PROCEDURAL_BIOME_COUNT * 6 }, (_, i) => generateArena(`VAL-${i}`).id))];
    if (biomes.length < PROCEDURAL_BIOME_COUNT) notes.push(`procedural: ${biomes.length} of ${PROCEDURAL_BIOME_COUNT} biomes drawn in the sample`);
    biomes.forEach(biomeId => {
        ['A', 'B', 'C'].forEach(tag => {
            const arena = generateArena(`VAL-${biomeId}-${tag}`, biomeId.replace(/^procedural-/, ''));
            const flavor = proceduralArenaFlavor(arena);
            const once = flavor.events.filter(e => e.oncePerRun).length;
            const chains = flavor.events.filter(e => e.chain).length;
            if (flavor.events.length < PROC_EVENT_FLOOR) problems.push(`${arena.id} (${tag}): generated arena receives ${flavor.events.length} authored events, under ${PROC_EVENT_FLOOR}`);
            if (once < PROC_ONCE_FLOOR) problems.push(`${arena.id} (${tag}): generated arena has ${once} once-per-run events, under ${PROC_ONCE_FLOOR}`);
            if (chains < 1) problems.push(`${arena.id} (${tag}): generated arena has no event chain`);
            // AUDIT-12 §8.7: the generated roster and the shared biome roster
            // both meet the floor.
            const generatedRoster = arena.muttRoster ?? [];
            if (generatedRoster.length < AUDIT12_WAVE2_ARENA.muttRosterFloor) problems.push(`${arena.id} (${tag}): generated mutt roster has ${generatedRoster.length}, floor is ${AUDIT12_WAVE2_ARENA.muttRosterFloor}`);
            const biomeRoster = ARENA_MUTTS[biomeId.replace(/^procedural-/, '')];
            if (biomeRoster && biomeRoster.length < AUDIT12_WAVE2_ARENA.muttRosterFloor) problems.push(`${biomeId}: biome mutt roster has ${biomeRoster.length}, floor is ${AUDIT12_WAVE2_ARENA.muttRosterFloor}`);
            if (flavor.ambient.length < PROC_AMBIENT_FLOOR) problems.push(`${arena.id} (${tag}): generated arena has ${flavor.ambient.length} ambient lines, under ${PROC_AMBIENT_FLOOR}`);
            const ids = flavor.events.filter(e => e.id).map(e => e.id!);
            if (new Set(ids).size !== ids.length) problems.push(`${arena.id} (${tag}): duplicate event ids in the composed pack`);
            flavor.events.forEach(e => {
                if (e.chain && !flavor.events.some(o => o.id === e.chain)) problems.push(`${arena.id}: chain '${e.chain}' points at an event not in the pack`);
            });
            // Audit 3 §5.5: `check-arena-layout` samples 120 procedural seeds
            // and asserts on every one of them, including the largest, so a
            // 16-zone roll is verified rather than merely noted.
            if (arena.zones.length > 13) notes.push(`${arena.id} (${tag}) rolled ${arena.zones.length} zones — the largest band check-arena-layout reports`);
        });
    });
    notes.push(`procedural: every biome composes ≥${PROC_EVENT_FLOOR} authored events, ≥${PROC_ONCE_FLOOR} once-per-run, a chain, and ≥${PROC_AMBIENT_FLOOR} ambient lines`);
}

/**
 * §2.1: the setup screen's arena briefing lives in `data/` so the cold-start
 * path never imports the engine, which means the climate label table is a
 * parallel copy of `engine/climate.ts`'s `CLIMATES` keys. This is what keeps
 * the two in step: an arena with a climate profile and no label would quietly
 * be briefed as temperate when it is not.
 */
{
    const climateSource = readFileSync(join('src', 'engine', 'climate.ts'), 'utf8');
    const table = climateSource.slice(climateSource.indexOf('const CLIMATES'), climateSource.indexOf('export function climateOf'));
    const ids = [...table.matchAll(/^\s+'?([\w-]+)'?:/gm)].map(m => m[1]);
    ids.forEach(id => {
        if (!CLIMATE_LABELS[id]) {
            problems.push(`${id}: has a climate profile but no CLIMATE_LABELS entry (data/arenaBriefing.ts)`);
        }
    });
    Object.keys(CLIMATE_LABELS).forEach(id => {
        if (!ids.includes(id)) problems.push(`${id}: CLIMATE_LABELS entry for an arena with no climate profile`);
    });
}

/**
 * §5.6: every stacked law combination is actually played, not merely declared.
 *
 * `arenaHasLaw` reads `law` and `laws` together, and three arenas now stack
 * two or more. A stacked pair is exactly the kind of thing that is
 * individually correct and jointly untested — `noCannons` plus `noSponsors`
 * means a tribute can neither hear a death nor be sent anything, and nothing
 * anywhere asserted that combination survives a full run. The cycle-rate check
 * below exercises single laws; this exercises every combination the roster
 * actually ships, by playing an arena that carries it to completion.
 */
{
    const combos = new Map<string, { id: string; laws: ArenaLawId[] }>();
    ARENAS.forEach(arena => {
        const laws = [...new Set([...(arena.law ? [arena.law] : []), ...(arena.laws ?? [])])].sort();
        if (laws.length < 2) return;
        const key = laws.join('+');
        if (!combos.has(key)) combos.set(key, { id: arena.id, laws });
    });
    if (combos.size === 0) {
        notes.push('no arena stacks two or more laws — the stacked-law check has nothing to exercise');
    }
    combos.forEach(({ id, laws }, key) => {
        const arena = ARENAS.find(a => a.id === id)!;
        const seed = `stacked-law-${key}`;
        const gamesProfile = gamesProfileFor(seed);
        const tributes = generateTributes(seed, DEFAULT_GAME_CONFIG, arena.zones[0].name, gamesProfile.castShape);
        const state = {
            seed, arena, tributes, phase: 'day', day: 1, log: [], gamemakerMode: false,
            config: DEFAULT_GAME_CONFIG, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile,
            logCounter: 0, feastsHeld: 0, cycle: 0,
        } as unknown as GameState;
        const sim = new Simulator(state);
        const live = sim.getState();
        let guard = 400;
        while (guard-- > 0) {
            if (!sim.processTurn()) break;
        }
        const finished = live.phase === 'ended' || live.phase === 'epilogue'
            || live.tributes.filter(t => t.status === 'alive').length <= 1;
        if (!finished) {
            problems.push(`stacked laws ${key} (${id}): a full run did not resolve in ${400} turns`);
            return;
        }
        // The laws have to have actually been in force, not merely declared.
        // Asserted structurally rather than against the feed: several flavour
        // pools mention parachutes in the abstract (an ally comparing what
        // each of them has, the crowd noting that the gifts have stopped), and
        // a text match on those is a false positive. `giftsReceived` is the
        // count of things that actually landed in a hand.
        if (laws.includes('noSponsors')) {
            const fed = live.tributes.filter(t => (t.memory?.giftsReceived ?? 0) > 0);
            if (fed.length > 0) {
                problems.push(`stacked laws ${key} (${id}): ${fed.length} tribute(s) received a gift under noSponsors`);
            }
        }
        notes.push(`stacked laws ${key}: played to completion in ${id} (${live.day} days, ${live.log.length} log lines)`);
    });
}

/**
 * AUDIT-12 E1 / §8.9: the strand invariant, played out. An arena act cuts the
 * edges around its terrain; it must never leave a live zone with no way out.
 */
{
    ARENAS.filter(a => hasActs(a.id)).forEach(arena => {
        for (let i = 0; i < 4; i++) {
            const seed = `strand-${arena.id}-${i}`;
            const gamesProfile = gamesProfileFor(seed);
            const tributes = generateTributes(seed, DEFAULT_GAME_CONFIG, arena.zones[0].name, gamesProfile.castShape);
            const state = {
                seed, arena, tributes, phase: 'day', day: 1, log: [], gamemakerMode: false,
                config: DEFAULT_GAME_CONFIG, baseConfig: DEFAULT_GAME_CONFIG, gamesProfile,
                logCounter: 0, feastsHeld: 0, cycle: 0,
            } as unknown as GameState;
            const sim = new Simulator(state);
            const live = sim.getState();
            const stranded = new Set<string>();
            let guard = 400;
            while (guard-- > 0) {
                if (!sim.processTurn()) break;
                strandedZones(live).forEach(z => stranded.add(z));
            }
            if (stranded.size > 0) problems.push(`${arena.id} (${seed}): stranded zone(s) ${[...stranded].join(', ')} — no open edge`);
        }
    });
}

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
 * Audit 3 §1.1: mutt ids and display names must be unique across every roster.
 *
 * `GameState.muttsSeen` is a `string[]` of ids, so two creatures sharing one id
 * collapse into a single entry and whichever the player met second records as a
 * repeat of the first. Two rosters shipped a duplicate `crevasse-worms` for a
 * release and the only thing that noticed was an audit probe. Names are held to
 * the same rule for a softer reason: a bestiary that lists the same name twice
 * with two different stat blocks reads as a content bug whatever the ids say.
 */
{
    const everyMutt = Object.entries(ARENA_MUTTS).flatMap(([roster, list]) =>
        list.map(m => ({ roster, id: m.id, name: m.name })));
    const byId = new Map<string, string[]>();
    const byName = new Map<string, string[]>();
    everyMutt.forEach(m => {
        byId.set(m.id, [...(byId.get(m.id) ?? []), m.roster]);
        byName.set(m.name, [...(byName.get(m.name) ?? []), m.roster]);
    });
    byId.forEach((rosters, id) => {
        if (rosters.length > 1) problems.push(`mutt id "${id}" is declared in ${rosters.length} rosters (${rosters.join(', ')}) — muttsSeen keys on id`);
    });
    byName.forEach((rosters, name) => {
        if (rosters.length > 1) problems.push(`mutt name "${name}" is declared in ${rosters.length} rosters (${rosters.join(', ')}) — two stat blocks, one name`);
    });
    notes.push(`mutts: ${everyMutt.length} across ${Object.keys(ARENA_MUTTS).length} rosters, every id and name unique`);
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

/**
 * Audit 4 §1.1: every edge kind has to be stocked across the roster.
 *
 * The bug this exists to stop is not a malformed rule — the per-arena checks
 * above catch those. It is a kind that nobody ever authored, so the engine
 * built on it runs in every game and does nothing. Measured before the fix:
 * `contested` existed on one edge in one arena of forty, and garrisons were
 * claimed zero times in 160 complete runs.
 *
 * The floor is deliberately low. It is a "somebody stocked this" assertion,
 * not a design target.
 */
{
    const EDGE_KIND_FLOOR = 4;
    const counts: Record<string, number> = {
        oneWay: 0, tolled: 0, timeGated: 0, collapsing: 0, oneWayAfter: 0, contested: 0, hidden: 0,
    };
    ARENAS.forEach(a => Object.values(a.edgeRules ?? {}).forEach(r => { counts[r.kind] = (counts[r.kind] ?? 0) + 1; }));
    const total = Object.values(counts).reduce((x, y) => x + y, 0);
    notes.push(`edge rules: ${total} across the roster — `
        + Object.entries(counts).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ${n}`).join(', '));
    Object.entries(counts).forEach(([kind, n]) => {
        if (n < EDGE_KIND_FLOOR) {
            problems.push(`edge kind '${kind}' is authored ${n} time(s) across all ${ARENAS.length} arenas, under the floor of ${EDGE_KIND_FLOOR} — the engine behind it effectively never runs`);
        }
    });
}

console.log(`arenas=${ARENAS.length} flavourPacks=${Object.keys(ARENA_FLAVOR).length} sourcesScanned=${walk('src').length}`);
console.log(ARENAS.map(a => `  ${a.id.padEnd(12)} ${a.zones.length} zones  ${a.name}`).join('\n'));
/*
 * AUDIT-6 §1.5/§5.1/§5.2: the authored-layer census.
 *
 * Every column below is optional in the type and each one is the difference
 * between an arena that is a place and an arena that is a zone list. Nothing
 * reported them, so they drifted: thirty-four of forty-five arenas shared one
 * Gamemaker menu and `packFor`'s own docstring claimed "most have their own".
 *
 * Reported rather than asserted for now, with a hard floor on the one that
 * matters most. A number in the roster is what stops the next arena shipping
 * without its layer.
 */
{
    const cols: Array<[string, (a: typeof ARENAS[number]) => boolean]> = [
        ['own event pack', a => !usesUniversalPack(a)],
        ['effectVocab', a => a.effectVocab !== undefined],
        ['restockBias', a => a.restockBias !== undefined && a.restockBias.length > 0],
        ['cornucopiaLayout', a => a.cornucopiaLayout !== undefined],
        ['off-season skins', a => (OFF_SEASON_SKINS[a.id]?.length ?? 0) > 0],
        /*
         * AUDIT-8 §1.6: resolve it, do not read the raw field.
         *
         * This tested `z.features?.waterSource !== undefined` — whether a zone
         * *declares* the field — and `zoneFeatures()` derives it from terrain
         * and name when absent. So the census named `frozen` and `silkwood`,
         * both of which resolve water sources perfectly well (Frozen Lake, The
         * Meltwater Channel, The Sink), and said nothing about the thirteen
         * arenas where the hydration layer genuinely finds nothing drinkable.
         * An audit read the old line at face value and nearly "fixed" two
         * arenas that were not broken.
         *
         * Thirteen dry arenas is not a fault — 48 zones across 26 arenas
         * declare `waterSource: false` and every one is right to: sea water,
         * brine pans, coolant vats, sea ice. The scarcity is the design. But
         * the number the roster reports should be the one the engine reads.
         */
        ['a water source', a => a.zones.some(z => zoneFeatures(z).waterSource === true)],
    ];
    notes.push('authored-layer coverage across ' + ARENAS.length + ' arenas:');
    /*
     * AUDIT-6 §5.1: every column here is now complete, so every column is now
     * required. These were 34/45, 34/45, 22/45 and 12/45 when the audit
     * measured them — an arena could ship without the layer that makes it a
     * place rather than a zone list, and nothing said so. A water source is the
     * one exception: the Frozen Wasteland, the Warren and the Silk Wood have
     * none by design, and that is the point of all three.
     */
    const REQUIRED = new Set(['own event pack', 'effectVocab', 'restockBias', 'cornucopiaLayout']);
    for (const [label, has] of cols) {
        const missing = ARENAS.filter(a => !has(a));
        notes.push(`    ${label}: ${ARENAS.length - missing.length}/${ARENAS.length}`
            + (missing.length ? ` — missing: ${missing.map(a => a.id).join(' ')}` : ''));
        if (REQUIRED.has(label) && missing.length > 0) {
            problems.push(`${missing.length} arena(s) declare no ${label}: ${missing.map(a => a.id).join(' ')}`);
        }
    }
    /*
     * The ratchet. Every arena is meant to have a set piece of its own; the
     * count only ever comes down. Lower `UNIVERSAL_PACK_CEILING` whenever a
     * pack lands, and never raise it.
     */
    const UNIVERSAL_PACK_CEILING = 0;
    const universal = ARENAS.filter(a => usesUniversalPack(a));
    notes.push(`    arenas on the universal Gamemaker pack: ${universal.length} (ceiling ${UNIVERSAL_PACK_CEILING})`);
    if (universal.length > UNIVERSAL_PACK_CEILING) {
        problems.push(`${universal.length} arena(s) draw the universal Gamemaker pack and have no set piece of their own `
            + `(ceiling ${UNIVERSAL_PACK_CEILING}): ` + universal.map(a => a.id).join(' '));
    }
}

/*
 * AUDIT-6 §7.3: every arena has to be able to kill you in a way that is its own.
 *
 * A census over twenty runs of each of the forty-six arenas found eight that
 * produced no death shape belonging to them. Four had signatures that only ever
 * logged and adjusted a vital — the Warren moved the map without ever bringing
 * it down on anybody, the Carnival started a ride nobody could be caught in,
 * the Cul-de-Sac's houses announced their guests and then let them leave, the
 * Silk Wood spun a road shut and never spun over a person. The other four could
 * kill in principle and never did, because a flat 22-30 damage does not finish
 * a tribute who walked in healthy.
 *
 * This is the static half of the guarantee: a signature that contains no death
 * cause at all cannot possibly produce one, and that is checkable by reading
 * rather than by sampling. The sampled half is the count reported below it,
 * which is about *rate* rather than existence and is deliberately not a
 * failure — a rare arena death is a design choice; an impossible one is a bug.
 */
{
    const source = readFileSync('src/engine/arenaSignature.ts', 'utf8');
    const allFlavor = { ...ARENA_FLAVOR, ...NEW_ARENA_FLAVOR } as Record<string, { events: Array<{ cause: string; damage?: number }> }>;
    const silent: string[] = [];
    let viaSignature = 0;
    for (const arena of ARENAS) {
        // (a) the per-cycle signature.
        const start = source.indexOf(`function ${arena.id}Signature`);
        let lethalSignature = false;
        if (start >= 0) {
            const end = source.indexOf('\n}', start);
            lethalSignature = /checkDeath\(/.test(source.slice(start, end < 0 ? undefined : end));
        }
        if (lethalSignature) viaSignature++;
        // (b) the authored event pool. An event with a `cause` and real damage
        // is a death this arena can produce, and four arenas — the Salt Mirror,
        // the Hanging Gardens, the Shattered Archipelago and the Menagerie —
        // do all their killing this way rather than through the signature.
        const lethalEvent = (allFlavor[arena.id]?.events ?? [])
            .some(e => !!e.cause && (e.damage ?? 0) > 0);
        if (!lethalSignature && !lethalEvent) silent.push(arena.id);
    }
    notes.push(`arenas that can produce a death of their own: ${ARENAS.length - silent.length}/${ARENAS.length}`
        + ` (${viaSignature} through the signature, the rest through authored events)`);
    if (silent.length > 0) {
        problems.push(`${silent.length} arena(s) cannot kill anybody in a way that is theirs, so the most distinctive `
            + `thing about each can never appear on an obituary: ${silent.join(' ')}`);
    }
}

if (notes.length) {
    console.log('\nNOTES (not failures):\n' + notes.map(n => ' - ' + n).join('\n'));
}
if (problems.length) {
    console.log('\nPROBLEMS:\n' + problems.map(p => ' - ' + p).join('\n'));
    process.exit(1);
}
console.log('\nAll arenas structurally sound.');
