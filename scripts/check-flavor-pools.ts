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
import { ARENA_FLAVOR, PROCEDURAL_FLAVOR_PACKS, GENERIC_ARENA_FLAVOR } from '../src/data/arenaFlavor';
import { QUIRKS } from '../src/data/quirks';

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

// §8/§11.3: interview scenarios, bucketed per persona. A persona with a thin
// scenario pool now fails the build exactly the way a thin arena pool does.
console.log(`\ninterview scenario pools per persona (target ${POOL_TARGET}):`);
INTERVIEW_SCENARIOS.forEach(scenario => {
    const n = Math.min(scenario.success.length, scenario.failure.length);
    console.log(`   ${n < POOL_TARGET ? '!' : ' '} ${scenario.strategy.padEnd(26)} ${scenario.success.length} success / ${scenario.failure.length} failure`);
    // §11.3: all thirteen are at the target as of this change, so the guard is
    // the target rather than the hard floor — the improvement is locked in and
    // a new persona cannot land under-written.
    if (n < POOL_TARGET) {
        structuralProblems.push(`interview persona '${scenario.strategy}': ${n} entries in its thinnest half, under the target of ${POOL_TARGET}`);
    }
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
 * generic fallback carrying ten to twelve. That is a writing job, not a bug,
 * so it ratchets the way `KNOWN_THIN` does — the count may fall and may not
 * rise, which stops the backlog growing while somebody works through it.
 */
/** Authored conditional-stance pools currently under the hard floor. */
const KNOWN_THIN_STANCE_POOLS = 68;
const CONDITIONAL_POOLS = ['fortify', 'scavenge', 'shadow', 'flail'] as const;
const thinStancePools: string[] = [];
console.log(`\nconditional-stance action pools (authored per arena; generic fallback otherwise):`);
CONDITIONAL_POOLS.forEach(key => {
    const authored = Object.entries(ARENA_FLAVOR).filter(([, f]) => (f.actions[key]?.length ?? 0) > 0);
    const thinAuthored = authored.filter(([, f]) => (f.actions[key]!.length) < HARD_FLOOR);
    console.log(`     ${key.padEnd(10)} ${authored.length} arena(s) author it; generic carries ${GENERIC_ARENA_FLAVOR.actions[key]?.length ?? 0}`);
    thinStancePools.push(...thinAuthored.map(([id, f]) =>
        `${id}: authored '${key}' pool has ${f.actions[key]!.length} entries against a generic fallback of ${GENERIC_ARENA_FLAVOR.actions[key]?.length ?? 0}`));
});
if (thinStancePools.length > KNOWN_THIN_STANCE_POOLS) {
    structuralProblems.push(
        `${thinStancePools.length} authored conditional-stance pools are under the hard floor of ${HARD_FLOOR}, `
        + `up from a baseline of ${KNOWN_THIN_STANCE_POOLS}. Top the new one up, or lower KNOWN_THIN_STANCE_POOLS on purpose.`);
    thinStancePools.slice(0, 10).forEach(p => structuralProblems.push(`   ${p}`));
} else {
    console.log(`   ${thinStancePools.length} authored pool(s) under the hard floor of ${HARD_FLOOR} (baseline ${KNOWN_THIN_STANCE_POOLS}).`);
}

// §11.2: quirk line variants. One line per quirk is a guaranteed verbatim
// repeat for any tribute who idles more than once.
const thinQuirks = QUIRKS.filter(q => q.lines.length < 2);
if (thinQuirks.length > 0) {
    structuralProblems.push(`${thinQuirks.length} quirk(s) carry a single line and will repeat verbatim: ${thinQuirks.map(q => q.label).join(', ')}`);
}
console.log(`\n${QUIRKS.length} quirks, ${Math.min(...QUIRKS.map(q => q.lines.length))} line variants in the thinnest.`);

if (structuralProblems.length > 0) {
    console.error('');
    structuralProblems.forEach(p => console.error(` - ${p}`));
}

if (broken.length || thin.length > KNOWN_THIN || structuralProblems.length > 0) process.exit(1);

if (thin.length < KNOWN_THIN) {
    console.log(`${thin.length} pools under ${POOL_TARGET} (baseline ${KNOWN_THIN}) — lower KNOWN_THIN in this file to lock the improvement in.`);
}
console.log(`${pools.length} flavour pools, ${pools[0][1].length} entries in the smallest; ${thin.length} still under the target of ${POOL_TARGET}.`);
