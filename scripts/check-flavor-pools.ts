/**
 * Flavour-pool depth guard.
 *
 * §11: a run averages 649 log lines and swears 10.4 vengeance oaths, against
 * pools of 5 and 10 entries — so a single Games was mathematically guaranteed
 * to repeat its own flavour text, and the mentor beats repeated within a
 * handful of cycles. Nothing detects that: a short pool is still a valid pool,
 * it just says the same thing twice.
 *
 * The floor is a target, and the shortfall is a writing backlog rather than a
 * bug, so this works the way `check-undeclared-knobs` does: the count of pools
 * under the floor may go down and may not go up. Topping a pool up is always
 * allowed; adding a new thin one, or trimming an existing pool, is not.
 *
 *   npm run test:flavor
 */
import * as FLAVOR from '../src/data/flavorText';
import { INTERVIEW_SCENARIOS } from '../src/data/flavorText';
import { ARENA_FLAVOR, PROCEDURAL_FLAVOR_PACKS, GENERIC_ARENA_FLAVOR, actionPool } from '../src/data/arenaFlavor';
import { QUIRK_MODS, QUIRKS } from '../src/data/quirks';
import { TRAIT_DEFS } from '../src/data/traits';

/** Entries a pool should carry to outlast a single Games without repeating. */
const POOL_TARGET = 12;
/**
 * Pools still under the target. Lower this when you top one up; it is not
 * allowed to rise. §1.6 cleared the backlog — the nine pools that sat at 10
 * (INTIMIDATION_TEXTS, MENTOR_PARACHUTE_TEXTS, MENTOR_PLEA_FAILED_TEXTS,
 * PROTECTOR_BOND_TEXTS, RELIEF_TEXTS, ROMANCE_TEXTS, SPONSOR_TEXTS,
 * TRAINING_OBSERVATION and TRAINING_TEAMUP) are all past the target now, so
 * the allowance is zero and any new thin pool fails the build.
 */
const KNOWN_THIN = 0;
/** No pool may drop below this, backlog or not — it is repetition within a cycle. */
const HARD_FLOOR = 8;

const pools = Object.entries(FLAVOR)
    .filter((entry): entry is [string, string[]] =>
        Array.isArray(entry[1]) && entry[1].every(v => typeof v === 'string'))
    .sort((a, b) => a[1].length - b[1].length);

// Audit 5 §1.4/§6.5: a pool that is authored and never drawn is the failure
// this checker exists to prevent, and `LEGENDARY_ITEM_TEXTS` sat dead for a
// full audit cycle because the roster only measured depth. Every exported
// pool must be referenced somewhere in `src/` outside its own file.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
function walk(dir: string, out: string[] = []): string[] {
    readdirSync(dir).forEach(name => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.tsx?$/.test(name) && !full.endsWith('data/flavorText.ts')) out.push(full);
    });
    return out;
}
const corpus = walk('src').map(f => readFileSync(f, 'utf8')).join('\n');
const unreferenced = Object.keys(FLAVOR).filter(name => !new RegExp(`\\b${name}\\b`).test(corpus));
if (unreferenced.length > 0) {
    console.error(`\n${unreferenced.length} flavour pool(s) are exported from flavorText.ts and drawn by nothing in src/: ${unreferenced.join(', ')}`);
    process.exit(1);
}

const thin = pools.filter(([, v]) => v.length < POOL_TARGET);
const broken = pools.filter(([, v]) => v.length < HARD_FLOOR);

broken.forEach(([name, v]) => console.error(` - ${name}: ${v.length} entries, under the hard floor of ${HARD_FLOOR}`));

if (thin.length > KNOWN_THIN) {
    console.error(`\n${thin.length} flavour pools are under the target of ${POOL_TARGET}, up from a baseline of ${KNOWN_THIN}:`);
    thin.forEach(([name, v]) => console.error(`   ${name}: ${v.length}`));
    console.error('\nTop the new one up, or lower KNOWN_THIN in this file if you have shortened a pool on purpose.');
}

/**
 * §8/§11.3: the global floor said nothing about *which* pools were thin,
 * because it only ever walked the flat `string[]` exports in `flavorText.ts`.
 * Three of the deepest content surfaces in the game are not flat arrays and
 * were therefore invisible to it: the per-arena event pools, the per-persona
 * interview scenarios, and the per-quirk line variants. All three have exactly
 * the same failure mode — a pool short enough to repeat itself inside a single
 * Games — and none of them had any guard at all.
 *
 * Printed as a per-pool breakdown the way `test:arenas` already prints
 * per-arena zone counts, so the authoring backlog is visible rather than
 * merely aggregate.
 */
const structuralProblems: string[] = [];

// Per-arena authored event pools, thinnest first.
const arenaPools = Object.entries({ ...ARENA_FLAVOR, ...PROCEDURAL_FLAVOR_PACKS })
    .map(([id, flavor]) => [id, flavor.events.length] as const)
    .sort((a, b) => a[1] - b[1]);
const thinArenas = arenaPools.filter(([, n]) => n < POOL_TARGET);
console.log(`\narena event pools (target ${POOL_TARGET}, ${arenaPools.length} packs):`);
arenaPools.slice(0, 12).forEach(([id, n]) => console.log(`   ${n < POOL_TARGET ? '!' : ' '} ${id.padEnd(16)} ${n}`));
if (arenaPools.length > 12) console.log(`     … ${arenaPools.length - 12} more at or above the thinnest listed`);
console.log(`   ${thinArenas.length} arena pack(s) under the target; generic fallback carries ${GENERIC_ARENA_FLAVOR.events.length}.`);

/**
 * §7.4a (audit): the floor became the target. Thirty-seven of forty packs
 * sat at exactly 24 — the signature of content written to satisfy a check
 * rather than to fill a run of ~650 lines. So the two are split: the hard
 * floor stays a build failure, and a *soft target* above it is reported as
 * distance-to-go, never failed. Once-per-run events are counted separately
 * because they are what makes one run of an arena differ from the next, and
 * 'Every Door' is only reachable in an arena carrying at least two.
 */
const ARENA_EVENT_FLOOR = 24;
const ARENA_EVENT_TARGET = 40;
const ONCE_PER_RUN_FLOOR = 2;
const authoredArenaPools = Object.entries(ARENA_FLAVOR)
    .map(([id, flavor]) => ({
        id,
        events: flavor.events.length,
        once: flavor.events.filter(e => e.oncePerRun && e.id).length,
        chains: flavor.events.filter(e => e.chain).length,
    }))
    .sort((a, b) => a.events - b.events);
const underFloor = authoredArenaPools.filter(p => p.events < ARENA_EVENT_FLOOR);
const underTarget = authoredArenaPools.filter(p => p.events < ARENA_EVENT_TARGET);
const noOnce = authoredArenaPools.filter(p => p.once < ONCE_PER_RUN_FLOOR);
const atFloorExactly = authoredArenaPools.filter(p => p.events === ARENA_EVENT_FLOOR).length;
console.log(`\narena packs: hard floor ${ARENA_EVENT_FLOOR}, soft target ${ARENA_EVENT_TARGET}, once-per-run floor ${ONCE_PER_RUN_FLOOR}`);
console.log(`   thinnest: ${authoredArenaPools.slice(0, 5).map(p => `${p.id} ${p.events} (${p.once} once, ${p.chains} chains)`).join(', ')}`);
console.log(`   ${underTarget.length} pack(s) under the soft target, ${atFloorExactly} sitting exactly on the floor, `
    + `${authoredArenaPools.reduce((s, p) => s + Math.max(0, ARENA_EVENT_TARGET - p.events), 0)} events to go across the roster.`);
underFloor.forEach(p => structuralProblems.push(`arena '${p.id}': ${p.events} authored events, under the hard floor of ${ARENA_EVENT_FLOOR}`));
noOnce.forEach(p => structuralProblems.push(`arena '${p.id}': ${p.once} once-per-run event(s), under the floor of ${ONCE_PER_RUN_FLOOR} — 'Every Door' cannot fire here`));

// §8/§11.3: interview scenarios, bucketed per persona. A persona with a thin
// scenario pool now fails the build exactly the way a thin arena pool does.
/**
 * §10.2: the floor-as-ceiling. All thirteen personas sat at exactly 12/12 —
 * the number this check enforced — which is what happens when a guard becomes
 * the authoring target. The interview is also the single most re-read screen
 * in the game (every run, 24 tributes, one scenario each), so 12 is thinner in
 * practice than the same number would be anywhere else: a player who has run
 * twenty Games has seen most of a persona's pool several times over.
 * Raised to 15 with the pools, and ratcheted the same way.
 */
const PERSONA_TARGET = 15;
console.log(`\ninterview scenario pools per persona (target ${PERSONA_TARGET}):`);
INTERVIEW_SCENARIOS.forEach(scenario => {
    const n = Math.min(scenario.success.length, scenario.failure.length);
    console.log(`   ${n < PERSONA_TARGET ? '!' : ' '} ${scenario.strategy.padEnd(26)} ${scenario.success.length} success / ${scenario.failure.length} failure`);
    if (n < PERSONA_TARGET) {
        structuralProblems.push(`interview persona '${scenario.strategy}': ${n} entries in its thinnest half, under the target of ${PERSONA_TARGET}`);
    }
    const dupes = (['success', 'failure'] as const).filter(half => new Set(scenario[half]).size !== scenario[half].length);
    dupes.forEach(half => structuralProblems.push(`interview persona '${scenario.strategy}': a repeated line in its ${half} pool`));
});

/**
 * §11.4: stance-transition depth, which the audit could not verify from a
 * read. It turns out `engine/stanceBeats.ts` carries no pools at all — the
 * beats emit inline strings — and the real per-stance flavour is the four
 * conditional-stance action pools on each arena (`fortify`, `scavenge`,
 * `shadow`, `flail`). `test:arenas` only ever checked the original five
 * (forage/rest/hide/hunt/travel), so the four added with the extended stance
 * roster have never been counted anywhere. They are optional per arena and
 * fall back to the generic set, so a missing one is a note, not a failure —
 * but an authored one that is *thin* is worse than none at all, because it
 * wins over a generic pool that is deeper.
 *
 * Running it for the first time turned up a real and sizeable backlog: most
 * arenas that author these pools author exactly four entries each, against a
 * generic fallback carrying ten to twelve.
 *
 * §5: that backlog is now closed at the mechanism rather than by writing 272
 * lines of filler. `actionPool` merges a short authored pool with the generic
 * one (authored lines weighted to lead, so the arena still sounds like
 * itself) instead of replacing it, so a four-entry pool now *adds* four
 * arena-specific lines on top of twelve rather than cutting variety to four.
 * What this check measures is therefore the effective pool a player actually
 * hears, which is what the floor was always trying to protect — and topping a
 * pool up past the merge target is still worth doing, because past it the
 * arena speaks entirely in its own voice.
 */
/**
 * Audit 4 §7.5: and now every arena has to author all four.
 *
 * "A missing one is a note, not a failure" was the right call while 17 of 40
 * arenas authored them. It stopped being right at 40 of 40: the generic pool
 * means a tribute fortifying in the Red Cathedral and a tribute fortifying in
 * the Salt Flats did the same thing in the same words, and the five
 * conditional stances hold 11.5% of all tribute-time. The arena is supposed to
 * be the thing that sounds different.
 *
 * A note would let the next arena ship without them and nobody would know
 * until an audit counted. This is the whole reason the roster exists.
 */
const STANCE_POOL_COVERAGE_FLOOR = 40;
/** Authored conditional-stance pools whose *effective* pool is under the floor. */
const KNOWN_THIN_STANCE_POOLS = 0;
const CONDITIONAL_POOLS = ['fortify', 'scavenge', 'shadow', 'flail'] as const;
const thinStancePools: string[] = [];
console.log(`\nconditional-stance action pools (authored per arena; generic fallback otherwise):`);
CONDITIONAL_POOLS.forEach(key => {
    const authored = Object.entries(ARENA_FLAVOR).filter(([, f]) => (f.actions[key]?.length ?? 0) > 0);
    // The effective pool: what `actionPool` actually returns for this arena.
    const thinAuthored = authored.filter(([, f]) => actionPool(f, key).length < HARD_FLOOR);
    console.log(`     ${key.padEnd(10)} ${authored.length} arena(s) author it; generic carries ${GENERIC_ARENA_FLAVOR.actions[key]?.length ?? 0}`);
    if (authored.length < STANCE_POOL_COVERAGE_FLOOR) {
        const missing = Object.keys(ARENA_FLAVOR).filter(id => (ARENA_FLAVOR[id].actions[key]?.length ?? 0) === 0);
        structuralProblems.push(
            `only ${authored.length} of ${Object.keys(ARENA_FLAVOR).length} arenas author a '${key}' pool — `
            + `${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ` and ${missing.length - 6} more` : ''} `
            + 'fall back to the generic set, so the stance sounds the same wherever it happens');
    }
    thinStancePools.push(...thinAuthored.map(([id, f]) =>
        `${id}: effective '${key}' pool is ${actionPool(f, key).length} entries (authored ${f.actions[key]!.length}, generic fallback ${GENERIC_ARENA_FLAVOR.actions[key]?.length ?? 0})`));
});
if (thinStancePools.length > KNOWN_THIN_STANCE_POOLS) {
    structuralProblems.push(
        `${thinStancePools.length} authored conditional-stance pools are under the hard floor of ${HARD_FLOOR}, `
        + `up from a baseline of ${KNOWN_THIN_STANCE_POOLS}. Top the new one up, or lower KNOWN_THIN_STANCE_POOLS on purpose.`);
    thinStancePools.slice(0, 10).forEach(p => structuralProblems.push(`   ${p}`));
} else {
    console.log(`   ${thinStancePools.length} authored pool(s) under the hard floor of ${HARD_FLOOR} (baseline ${KNOWN_THIN_STANCE_POOLS}).`);
}

/**
 * §11.2 / §10.2: quirk line variants.
 *
 * The original floor was 2, on the reasoning that one line per quirk is a
 * guaranteed verbatim repeat. Two is the same failure one step further out:
 * a tribute carries one or two quirks for a whole run, the idle beat draws
 * from that tribute's own quirks, and a 780-line run fires a given quirk far
 * more than twice — so every quirk in the game sat at exactly the floor its
 * test enforced and repeated itself verbatim by the middle of day two.
 *
 * All 85 are now at four. The floor is a ratchet in the same style as
 * `KNOWN_THIN`: it may be raised when the pools are raised, and lowering it
 * has to be a deliberate edit to this line.
 */
/**
 * Audit 4 §10.4: depth against *frequency*, which is the thing a floor cannot see.
 *
 * Every pool in the file cleared its floor and the repetition a player actually
 * noticed was elsewhere: in pools large enough to pass and small relative to
 * how often the event occurs. A floor is a statement about the pool; this is a
 * statement about the run.
 *
 * The audit's own arithmetic for this was wrong and the correction is worth
 * keeping. It reasoned that `sanity` is ~11% of ~760 lines a run, therefore
 * ~98 draws split across three pools of ten, therefore heavy repetition. The
 * middle step does not hold: most `sanity`-category lines come from the band
 * beats, the anthem reaction, trait arcs and resolve breakdowns, not from
 * `SANITY_TEXTS` at all. The numbers below are **measured** — each template's
 * longest literal run matched against the run's own log over 60 complete runs —
 * and the real picture was one pool over its depth (`ruinStealth`, 11.7 draws
 * against 10 lines) and one close to it (`SPONSOR_TEXTS`, 16.1 against 19),
 * neither of which the floor could see and neither of which was the one the
 * audit named.
 *
 * The rule: a pool holds at least as many lines as it is drawn in one Games,
 * or the player hears the same sentence twice in a single run. Pools drawn less
 * than once a run are governed by the ordinary floor and are not listed.
 */
const DRAWS_PER_RUN: Array<{ pool: string; lines: number; draws: number }> = [
    { pool: 'SANITY_TEXTS.ruinStealth', lines: FLAVOR.SANITY_TEXTS.ruinStealth.length, draws: 11.7 },
    { pool: 'SANITY_TEXTS.hallucination', lines: FLAVOR.SANITY_TEXTS.hallucination.length, draws: 8.0 },
    { pool: 'SANITY_TEXTS.dropItem', lines: FLAVOR.SANITY_TEXTS.dropItem.length, draws: 4.5 },
    { pool: 'SPONSOR_TEXTS', lines: FLAVOR.SPONSOR_TEXTS.length, draws: 16.1 },
    { pool: 'GRIEF_TEXTS', lines: FLAVOR.GRIEF_TEXTS.length, draws: 13.4 },
    { pool: 'VENGEANCE_TEXTS', lines: FLAVOR.VENGEANCE_TEXTS.length, draws: 12.3 },
    { pool: 'INTIMIDATION_TEXTS', lines: FLAVOR.INTIMIDATION_TEXTS.length, draws: 4.1 },
    { pool: 'BETRAYAL_AFTERMATH_TEXTS', lines: FLAVOR.BETRAYAL_AFTERMATH_TEXTS.length, draws: 3.5 },
    { pool: 'AMBIENT_TEXTS', lines: FLAVOR.AMBIENT_TEXTS.length, draws: 1.6 },
    { pool: 'RELIEF_TEXTS', lines: FLAVOR.RELIEF_TEXTS.length, draws: 1.3 },
];
/*
 * AUDIT-6 §10.3: 1x was the wrong bar and it is now 4x.
 *
 * "At least as many lines as draws" only promises that a player does not hear
 * the same sentence twice inside one Games. It says nothing about the second
 * Games, and the measured picture was that a player read **over half** of
 * `ruinStealth` in a single run and then re-read it every run afterwards. The
 * replay-facing question is how many runs it takes to exhaust a pool, and 4x
 * is "four Games before you have seen all of it", which is the same standard
 * the arena event floors already hold themselves to.
 *
 * Deliberately relative rather than absolute: the existing HARD_FLOOR and
 * POOL_TARGET are line counts, and the problem this measures is a ratio. A
 * twelve-line pool drawn once a run is fine; a twenty-line pool drawn twelve
 * times a run is not, and no fixed line count can tell the two apart.
 */
const DRAWS_DEPTH_FLOOR = 4;
DRAWS_PER_RUN.forEach(row => {
    if (row.lines < row.draws * DRAWS_DEPTH_FLOOR) {
        structuralProblems.push(
            `${row.pool} holds ${row.lines} lines against ${row.draws} draws in an average run `
            + `(${(row.lines / row.draws).toFixed(1)}x, floor ${DRAWS_DEPTH_FLOOR}x) — `
            + 'the player reads the whole pool inside a few Games and every run after that repeats it');
    }
});
console.log('\npool depth against measured draws per run (Audit 4 §10.4):');
[...DRAWS_PER_RUN].sort((a, b) => (a.lines / a.draws) - (b.lines / b.draws)).forEach(row => {
    console.log(`   ${row.pool.padEnd(28)} ${String(row.lines).padStart(3)} lines / ${row.draws.toFixed(1)} draws  (${(row.lines / row.draws).toFixed(1)}x)`);
});

const QUIRK_LINE_FLOOR = 4;
const thinQuirks = QUIRKS.filter(q => q.lines.length < QUIRK_LINE_FLOOR);
if (thinQuirks.length > 0) {
    structuralProblems.push(
        `${thinQuirks.length} quirk(s) carry fewer than ${QUIRK_LINE_FLOOR} lines and will repeat inside one run: `
        + thinQuirks.map(q => `${q.label} (${q.lines.length})`).join(', '));
}
// A pool of four identical lines is a pool of one; the depth has to be real.
QUIRKS.filter(q => new Set(q.lines).size !== q.lines.length).forEach(q => {
    structuralProblems.push(`quirk '${q.label}' repeats a line inside its own pool`);
});
console.log(`\n${QUIRKS.length} quirks, ${Math.min(...QUIRKS.map(q => q.lines.length))} line variants in the thinnest (floor ${QUIRK_LINE_FLOOR}).`);

/*
 * AUDIT-7 §1.4 and §1.5: the modifier table, from both ends.
 *
 * `data/traits.ts` opens with a rule — "Every key below is read somewhere. If
 * you add a key, add the read site in the same change; an unread modifier is
 * the bug this file exists to fix." The inverse was unguarded, and one key was
 * in that state: `intimidation` had a read site at `fear.ts:36` and was carried
 * by **no trait and no quirk**, so the whole intimidation term of every fear
 * roll in the game evaluated to a flat zero. A modifier nothing writes is the
 * same bug as a modifier nothing reads, wearing the other hat.
 *
 * The second half is cheaper and just as silent: two quirks shipped
 * `capacity: 0`, a modifier that was written and never given a number.
 */
{
    const unionSource = readFileSync('src/data/traits.ts', 'utf8');
    const union = unionSource.slice(
        unionSource.indexOf('export type TraitMod ='),
        unionSource.indexOf("| 'scavenge';") + "| 'scavenge';".length);
    const declared = [...new Set([...union.matchAll(/'([a-zA-Z]+)'/g)].map(m => m[1]))];

    const written = new Set<string>();
    Object.values(TRAIT_DEFS).forEach(def => Object.keys(def.mods ?? {}).forEach(k => written.add(k)));
    Object.values(QUIRK_MODS).forEach(mods => Object.keys(mods).forEach(k => written.add(k)));

    const unwritten = declared.filter(k => !written.has(k));
    if (unwritten.length > 0) {
        structuralProblems.push(
            `TraitMod key(s) declared and read by the engine but carried by no trait and no quirk — `
            + `every read of them returns a flat zero: ${unwritten.join(', ')}. `
            + 'Put them on a trait, or delete the key and its read site.');
    }

    const noOps: string[] = [];
    Object.entries(TRAIT_DEFS).forEach(([name, def]) =>
        Object.entries(def.mods ?? {}).forEach(([k, v]) => { if (v === 0) noOps.push(`trait '${name}'.${k}`); }));
    Object.entries(QUIRK_MODS).forEach(([label, mods]) =>
        Object.entries(mods).forEach(([k, v]) => { if (v === 0) noOps.push(`quirk '${label}'.${k}`); }));
    if (noOps.length > 0) {
        structuralProblems.push(
            `modifier(s) declared with a value of 0, which is a modifier somebody forgot to fill in: `
            + noOps.join(', '));
    }

    console.log(
        `TraitMod: ${declared.length} keys declared, ${written.size} carried by a trait or quirk, `
        + `${unwritten.length} unwritten (ceiling 0); ${noOps.length} modifier(s) set to zero (ceiling 0).`);
}

/**
 * §10.2 (audit): the nested pools the flat walk could not see.
 *
 * `Object.entries(FLAVOR)` only ever matched `string[]` exports, so every
 * `Record<string, string[]>` in the file — the archetype signature beats, the
 * training failure/struggle/altercation registers, the evening beats, the
 * triangle resolutions, the zone rumour claims — was invisible to the floor
 * that exists to catch exactly their failure mode. Fourteen of them sat under
 * the script's own hard floor of 8, and `ARCHETYPE_SIGNATURE_TEXTS` — the
 * once-per-run beat that is supposed to define an archetype — sat at three or
 * four across all fifteen.
 *
 * Walked here with the same floor and the same ratchet: the count under the
 * floor may fall and may not rise.
 */
const KNOWN_THIN_NESTED = 0;
const nested: Array<[string, string[]]> = [];
Object.entries(FLAVOR as Record<string, unknown>).forEach(([name, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    Object.entries(value as Record<string, unknown>).forEach(([key, inner]) => {
        if (Array.isArray(inner) && inner.every(v => typeof v === 'string')) {
            nested.push([`${name}.${key}`, inner as string[]]);
        }
    });
});
nested.sort((a, b) => a[1].length - b[1].length);
const thinNested = nested.filter(([, v]) => v.length < HARD_FLOOR);
// A pool of repeats is not a pool, whatever its length.
nested.forEach(([name, v]) => {
    if (new Set(v).size !== v.length) structuralProblems.push(`nested pool '${name}' repeats a line inside itself`);
});
console.log(`\nnested flavour pools (floor ${HARD_FLOOR}, ${nested.length} pools): thinnest ${nested[0]?.[0]} at ${nested[0]?.[1].length}`);
if (thinNested.length > KNOWN_THIN_NESTED) {
    structuralProblems.push(
        `${thinNested.length} nested flavour pool(s) are under the hard floor of ${HARD_FLOOR}, `
        + `up from a baseline of ${KNOWN_THIN_NESTED}. Top them up, or raise KNOWN_THIN_NESTED on purpose.`);
    thinNested.slice(0, 14).forEach(([name, v]) => structuralProblems.push(`   ${name}: ${v.length}`));
} else {
    console.log(`   ${thinNested.length} nested pool(s) under the floor (baseline ${KNOWN_THIN_NESTED}).`);
}

if (structuralProblems.length > 0) {
    console.error('');
    structuralProblems.forEach(p => console.error(` - ${p}`));
}

if (broken.length || thin.length > KNOWN_THIN || structuralProblems.length > 0) process.exit(1);

if (thin.length < KNOWN_THIN) {
    console.log(`${thin.length} pools under ${POOL_TARGET} (baseline ${KNOWN_THIN}) — lower KNOWN_THIN in this file to lock the improvement in.`);
}
console.log(`${pools.length} flavour pools, ${pools[0][1].length} entries in the smallest; ${thin.length} still under the target of ${POOL_TARGET}.`);
