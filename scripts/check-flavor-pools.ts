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

if (broken.length || thin.length > KNOWN_THIN) process.exit(1);

if (thin.length < KNOWN_THIN) {
    console.log(`${thin.length} pools under ${POOL_TARGET} (baseline ${KNOWN_THIN}) — lower KNOWN_THIN in this file to lock the improvement in.`);
}
console.log(`${pools.length} flavour pools, ${pools[0][1].length} entries in the smallest; ${thin.length} still under the target of ${POOL_TARGET}.`);
