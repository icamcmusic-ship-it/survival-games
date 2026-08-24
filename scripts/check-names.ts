/**
 * Reaping-pool guard.
 *
 * Two properties, both of which have silently regressed before:
 *
 *   1. Every district pool carries a full stock. Districts 13-16 shipped at 30
 *      entries per gender against the original twelve's 100, so a reaping in
 *      the expanded territories drew from a third of the names and the outer
 *      districts visibly repeated themselves between runs. Nothing failed —
 *      the generator simply drew from whatever was there.
 *   2. No name is a resident of too many districts at once. A name in six
 *      pools is not a coincidence a player reads as flavour; it reads as the
 *      generator being broken. `Sable` was in six.
 *
 *   3. Every district's mentor pool is wide enough that the mentor is not the
 *      most-repeated proper noun in the game. This script only ever checked
 *      the reaping pools, so `DISTRICT_LEGACY.mentors` quietly shipped at two
 *      names for districts 3, 5, 6, 8-16 — one uniform `rng.pick` per tribute
 *      out of two options means a Hall-of-Fame player replaying District 14
 *      sees the same mentor on four tributes in five. No mentor may be shared
 *      between districts either: a mentor belongs to the district that
 *      produced them.
 *
 *   npm run test:names
 */
import { DISTRICT_NAMES } from '../src/data/names';
import { DISTRICT_LEGACY } from '../src/data/districts';

/** Entries every district pool must carry, per gender. */
const POOL_TARGET = 100;
/** How many district pools one name may appear in before it stops reading as flavour. */
const MAX_DISTRICTS_PER_NAME = 2;

const problems: string[] = [];
const districts = Object.keys(DISTRICT_NAMES).map(Number).sort((a, b) => a - b);
const homes = new Map<string, number[]>();

districts.forEach(d => {
    (['Male', 'Female'] as const).forEach(gender => {
        const pool = DISTRICT_NAMES[d][gender];
        if (pool.length < POOL_TARGET) {
            problems.push(`district ${d} ${gender}: ${pool.length} names (target ${POOL_TARGET})`);
        }
        const dupes = pool.filter((n, i) => pool.indexOf(n) !== i);
        if (dupes.length) problems.push(`district ${d} ${gender}: repeats within its own pool — ${[...new Set(dupes)].join(', ')}`);
    });
    const both = new Set([...DISTRICT_NAMES[d].Male, ...DISTRICT_NAMES[d].Female]);
    both.forEach(name => {
        if (!homes.has(name)) homes.set(name, []);
        homes.get(name)!.push(d);
    });
});

const spread = [...homes.entries()]
    .filter(([, ds]) => ds.length > MAX_DISTRICTS_PER_NAME)
    .sort((a, b) => b[1].length - a[1].length);
spread.forEach(([name, ds]) => {
    problems.push(`'${name}' is in ${ds.length} district pools (${ds.join(', ')}) — max ${MAX_DISTRICTS_PER_NAME}`);
});

// Mentor pools: width, no repeats inside a pool, and no name in two pools.
const MENTOR_POOL_TARGET = 6;
const mentorHomes = new Map<string, number[]>();
Object.keys(DISTRICT_LEGACY).map(Number).sort((a, b) => a - b).forEach(d => {
    const pool = DISTRICT_LEGACY[d].mentors;
    if (pool.length < MENTOR_POOL_TARGET) {
        problems.push(`district ${d} mentors: ${pool.length} names (target ${MENTOR_POOL_TARGET})`);
    }
    const dupes = pool.filter((n, i) => pool.indexOf(n) !== i);
    if (dupes.length) problems.push(`district ${d} mentors: repeats within its own pool — ${[...new Set(dupes)].join(', ')}`);
    pool.forEach(name => {
        if (!mentorHomes.has(name)) mentorHomes.set(name, []);
        mentorHomes.get(name)!.push(d);
    });
});
[...mentorHomes.entries()].filter(([, ds]) => ds.length > 1).forEach(([name, ds]) => {
    problems.push(`mentor '${name}' is in ${ds.length} district pools (${ds.join(', ')}) — a mentor belongs to one district`);
});
// A mentor sharing a full name with a reapable tribute reads as a bug, not flavour.
mentorHomes.forEach((ds, name) => {
    const clash = districts.filter(d => DISTRICT_NAMES[d].Male.includes(name) || DISTRICT_NAMES[d].Female.includes(name));
    if (clash.length) problems.push(`mentor '${name}' (district ${ds.join(', ')}) is also a reapable name in district ${clash.join(', ')}`);
});

const mentorTotal = [...mentorHomes.keys()].length;

const total = districts.reduce((sum, d) => sum + DISTRICT_NAMES[d].Male.length + DISTRICT_NAMES[d].Female.length, 0);
const shared = [...homes.values()].filter(ds => ds.length > 1).length;

if (problems.length) {
    console.error('PROBLEMS:');
    problems.forEach(p => console.error(` - ${p}`));
    process.exit(1);
}
console.log(`${total} names across ${districts.length} districts; ${shared} appear in more than one pool, none in more than ${MAX_DISTRICTS_PER_NAME}.`);
console.log(`${mentorTotal} mentors across ${Object.keys(DISTRICT_LEGACY).length} districts; every pool at least ${MENTOR_POOL_TARGET} deep, none shared.`);
