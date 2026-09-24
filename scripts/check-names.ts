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
import { DISTRICT_NAMES, NEUTRAL_NAMES } from '../src/data/names';
import { DISTRICT_LEGACY } from '../src/data/districts';
import { generateTributes } from '../src/engine/generator';
import { gamesProfileFor } from '../src/engine/gamesProfile';
import { DEFAULT_GAME_CONFIG } from '../src/data/constants';
import { GameConfig } from '../src/models/types';

/** Set by the cast sweep below, printed with the rest of the summary. */
let castNote = '';

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

// §(requests): tributes go by one name, and nothing may quietly become two.
districts.forEach(d => {
    (['Male', 'Female'] as const).forEach(gender => {
        const bad = DISTRICT_NAMES[d][gender].filter(n => /[\s'-]/.test(n));
        if (bad.length) problems.push(`district ${d} ${gender}: name(s) that read as a surname or a compound — ${bad.join(', ')}`);
    });
});

// AUDIT-11 §15: single given names only. A space, a hyphen, or a second
// capitalised word ("Rook Ashby", "RookAshby") is a surname sneaking in.
{
    const surnameShaped = (n: string) => /\s/.test(n) || /-/.test(n) || /[a-z][A-Z]/.test(n);
    districts.forEach(d => {
        const all = [...DISTRICT_NAMES[d].Male, ...DISTRICT_NAMES[d].Female, ...(NEUTRAL_NAMES[d] ?? [])];
        const bad = all.filter(surnameShaped);
        if (bad.length) problems.push(`district ${d}: entries with a space or a second capitalised word — ${bad.join(', ')}`);
    });
    const probes: Array<[string, boolean]> = [['Rook', false], ['Rook Ashby', true], ['RookAshby', true], ['Rook-Ashby', true]];
    probes.forEach(([n, want]) => { if (surnameShaped(n) !== want) problems.push(`surname rule misreads "${n}"`); });
}

/**
 * §(requests): the third pool, held to the same rules as the gendered two —
 * and to one of its own. `NEUTRAL_NAMES` exists to flatten the initial-letter
 * distribution, so an entry starting with a letter the main pools are already
 * rich in is an entry doing no work.
 */
const NEUTRAL_TARGET = 20;
/** The initials the gendered pools are short of. A neutral name must carry one. */
const SCARCE_INITIALS = 'XUYZQIJKNEOV';
districts.forEach(d => {
    const pool = NEUTRAL_NAMES[d] ?? [];
    if (pool.length < NEUTRAL_TARGET) {
        problems.push(`district ${d} neutral: ${pool.length} names (target ${NEUTRAL_TARGET})`);
    }
    const dupes = pool.filter((n, i) => pool.indexOf(n) !== i);
    if (dupes.length) problems.push(`district ${d} neutral: repeats within its own pool — ${[...new Set(dupes)].join(', ')}`);
    const bad = pool.filter(n => /[\s'-]/.test(n));
    if (bad.length) problems.push(`district ${d} neutral: name(s) that read as a surname or a compound — ${bad.join(', ')}`);
    const wrongInitial = pool.filter(n => !SCARCE_INITIALS.includes(n[0]));
    if (wrongInitial.length) {
        problems.push(`district ${d} neutral: name(s) on an initial the main pools already carry — ${wrongInitial.join(', ')}`);
    }
    const clashGendered = pool.filter(n => districts.some(o =>
        DISTRICT_NAMES[o].Male.includes(n) || DISTRICT_NAMES[o].Female.includes(n)));
    if (clashGendered.length) {
        problems.push(`district ${d} neutral: name(s) already in a gendered pool — ${clashGendered.join(', ')}`);
    }
    pool.forEach(name => {
        if (!homes.has(name)) homes.set(name, []);
        homes.get(name)!.push(d);
    });
});

/**
 * And the reason the pool exists, asserted directly: the commonest initial in
 * the reapable set may not be more than this many times the median one. It
 * measured 356:1 against X before `NEUTRAL_NAMES` was authored.
 */
const MAX_INITIAL_RATIO = 30;
const initials = new Map<string, number>();
districts.forEach(d => {
    [...DISTRICT_NAMES[d].Male, ...DISTRICT_NAMES[d].Female, ...(NEUTRAL_NAMES[d] ?? [])]
        .forEach(n => initials.set(n[0], (initials.get(n[0]) ?? 0) + 1));
});
const counts = [...initials.entries()].sort((a, b) => b[1] - a[1]);
const ratio = counts[0][1] / counts[counts.length - 1][1];
if (ratio > MAX_INITIAL_RATIO) {
    problems.push(`initial-letter spread is ${ratio.toFixed(1)}:1 (${counts[0][0]} ${counts[0][1]} vs ${counts[counts.length - 1][0]} ${counts[counts.length - 1][1]}) — max ${MAX_INITIAL_RATIO}:1`);
}

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

const total = districts.reduce((sum, d) => sum + DISTRICT_NAMES[d].Male.length + DISTRICT_NAMES[d].Female.length + (NEUTRAL_NAMES[d]?.length ?? 0), 0);
const shared = [...homes.values()].filter(ds => ds.length > 1).length;

/**
 * AUDIT-10 B3-04: two tributes a player cannot tell apart.
 *
 * The plan asks for "cast validation with Unicode and visually confusing
 * duplicates, resolved with district badges — not surnames". The right first
 * move is to find out whether the problem exists, because building
 * disambiguation for a collision that never happens is worse than not building
 * it: it is code nobody can test and nobody will notice rotting.
 *
 * Measured across 4,000 casts over four configurations — the default, sixteen
 * districts, plain names, and both — there were no exact duplicates and no
 * confusable pairs. Plain-name casts repeat a *first* name about half the time,
 * which is not a collision: the chronicle names tributes by `t.name`, which is
 * the whole name.
 *
 * So this is a guard rather than a feature. Names are drawn from per-district
 * pools and 288 of them appear in two pools, so a cross-district duplicate is
 * possible in principle; what keeps it from happening is the draw, and a draw
 * is the kind of thing a later change quietly alters. Confusability is folded
 * the way a reader's eye folds it — NFKD, combining marks stripped, case and
 * punctuation ignored — so 'Renée' and 'Renee' count as the same name even
 * though no string comparison would say so.
 */
{
    const fold = (n: string) => n.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const configs: GameConfig[] = [
        DEFAULT_GAME_CONFIG,
        { ...DEFAULT_GAME_CONFIG, districtCount: 16 },
        { ...DEFAULT_GAME_CONFIG, plainNames: true },
        { ...DEFAULT_GAME_CONFIG, districtCount: 16, plainNames: true },
    ];
    /*
     * The sweep below has never found anything, which is the intended state and
     * also the state an inert check is in. So the folding is checked against
     * pairs it must and must not fold, and the check fails if it stops working
     * — otherwise "no collisions" would eventually mean "no comparison".
     */
    const same: Array<[string, string]> = [['Renée', 'Renee'], ['O\u2019Dell', 'ODell'], ['Cato', 'CATO'], ['Marvel ', 'Marvel']];
    const different: Array<[string, string]> = [['Glimmer', 'Glimmerr'], ['Cato', 'Clove'], ['Rue', 'Rye']];
    same.forEach(([a, b]) => { if (fold(a) !== fold(b)) problems.push(`name folding no longer reads "${a}" and "${b}" as the same name`); });
    different.forEach(([a, b]) => { if (fold(a) === fold(b)) problems.push(`name folding now reads "${a}" and "${b}" as the same name, which they are not`); });

    const CASTS = Number(process.env.NAME_CASTS ?? 2000);
    let clashes = 0;
    for (let i = 0; i < CASTS; i++) {
        const seed = `CAST${i}`;
        const profile = gamesProfileFor(seed, false);
        const config = configs[i % configs.length];
        const names = generateTributes(seed, config, 'x', profile.castShape, profile.quell).map(t => t.name);
        const seen = new Map<string, string>();
        for (const name of names) {
            const key = fold(name);
            const first = seen.get(key);
            if (first !== undefined) {
                clashes++;
                if (clashes <= 5) {
                    problems.push(`seed ${seed} (${config.districtCount} districts${config.plainNames ? ', plain names' : ''}) `
                        + `reaped two tributes a reader cannot tell apart: "${first}" and "${name}"`);
                }
            } else seen.set(key, name);
        }
    }
    if (clashes === 0) {
        castNote = `${CASTS} casts drawn across ${configs.length} configurations; no two tributes in any of them share a name a reader would fold together.`;
    }
}

if (problems.length) {
    console.error('PROBLEMS:');
    problems.forEach(p => console.error(` - ${p}`));
    process.exit(1);
}
console.log(castNote);
console.log(`${total} names across ${districts.length} districts; ${shared} appear in more than one pool, none in more than ${MAX_DISTRICTS_PER_NAME}.`);
console.log(`initial-letter spread now ${ratio.toFixed(1)}:1 (${counts[0][0]} ${counts[0][1]} down to ${counts[counts.length - 1][0]} ${counts[counts.length - 1][1]}).`);
console.log(`${mentorTotal} mentors across ${Object.keys(DISTRICT_LEGACY).length} districts; every pool at least ${MENTOR_POOL_TARGET} deep, none shared.`);
if (themeNotes.length === 0) {
    console.log('no themed names have wandered out of the district they belong to.');
} else {
    console.log(`\n${themeNotes.length} themed collision(s) — a note, not a failure:`);
    themeNotes.forEach(n => console.log(` - ${n}`));
}
