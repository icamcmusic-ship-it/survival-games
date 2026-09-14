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
    // 4. No name is reapable twice inside the same district. The per-gender
    //    check above cannot see this: `Barley` sitting in District 9's Male
    //    pool AND its Female pool is one district offering the same name
    //    twice, which reads as a copy-paste slip rather than a unisex name —
    //    and it quietly doubles that name's draw weight inside its own
    //    district, which is the part a player actually notices. Sixty of
    //    these had accumulated across thirteen districts.
    const districtPool = [...DISTRICT_NAMES[d].Male, ...DISTRICT_NAMES[d].Female];
    const crossGender = [...new Set(districtPool.filter((n, i) => districtPool.indexOf(n) !== i))];
    if (crossGender.length) {
        problems.push(`district ${d}: name(s) in both the Male and Female pool — ${crossGender.join(', ')}`);
    }
    const both = new Set(districtPool);
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
/**
 * Audit 3 §10.3: twelve rather than six.
 *
 * Mentors are the recurring cast. There are 3,200 tribute names and a player
 * who runs twenty Games never sees the same tribute twice — but they see the
 * same mentor repeatedly, because a district had seven of them. That made the
 * mentor the single most repeated piece of flavour in the game while carrying,
 * per §10.4, the thinnest voice.
 */
const MENTOR_POOL_TARGET = 12;
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

/**
 * §11: themed collisions.
 *
 * The residency cap catches a name living in five districts. It does not catch
 * the subtler drift the pools are actually prone to: District 1's names are
 * gems and luxury goods, District 4's are the sea, District 11's are growing
 * things — and a gem name that has wandered into District 9 reads as an error
 * even though it breaks no rule. Reported rather than enforced, because a
 * borrowed name is sometimes a deliberate joke, and because the fix is a
 * judgement call about tone rather than a mechanical one.
 */
// Exact matches only. A prefix test flags every name *derived* from a themed
// root — District 15's Ashglass is a glassworks name that happens to start
// with "Ash" — and a check that cries wolf is a check somebody silences.
const THEMES: Array<{ home: number; label: string; names: string[] }> = [
    { home: 1, label: 'gem and luxury names', names: ['Opal', 'Onyx', 'Pearl', 'Ruby', 'Jade', 'Topaz', 'Garnet', 'Velvet', 'Satin', 'Cashmere', 'Ivory', 'Sterling', 'Platinum', 'Crystal', 'Diamond', 'Emerald'] },
    { home: 2, label: 'stone and arms names', names: ['Granite', 'Marble', 'Basalt', 'Slate', 'Brutus', 'Cato', 'Flint', 'Anvil', 'Forge', 'Shale'] },
    { home: 4, label: 'sea names', names: ['Marina', 'Coral', 'Tide', 'Nerida', 'Finnick', 'Mags', 'Brine', 'Shoal', 'Reef', 'Undine', 'Kelp', 'Surf'] },
    { home: 11, label: 'growing-season names', names: ['Rue', 'Thresh', 'Chaff', 'Seeder', 'Barley', 'Millet', 'Orchard', 'Harvest', 'Sorrel', 'Clover', 'Rye'] },
    { home: 12, label: 'coal-seam names', names: ['Katniss', 'Gale', 'Prim', 'Hazelle', 'Seam', 'Ember', 'Cinder', 'Soot', 'Collier'] },
];
const themeNotes: string[] = [];
THEMES.forEach(theme => {
    districts.forEach(d => {
        if (d === theme.home) return;
        const strays = [...DISTRICT_NAMES[d].Male, ...DISTRICT_NAMES[d].Female]
            .filter(n => theme.names.some(t => t.toLowerCase() === n.toLowerCase()));
        if (strays.length > 0) {
            themeNotes.push(`district ${d} carries ${theme.label} from district ${theme.home}: ${strays.join(', ')}`);
        }
    });
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
if (themeNotes.length === 0) {
    console.log('no themed names have wandered out of the district they belong to.');
} else {
    console.log(`\n${themeNotes.length} themed collision(s) — a note, not a failure:`);
    themeNotes.forEach(n => console.log(` - ${n}`));
}
