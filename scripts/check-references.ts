/**
 * Cross-table reference integrity.
 *
 * AUDIT-8 §1.5. The repository guards its data harder than most: 2,364 balance
 * knobs with a check that none goes unread and a second check that no new
 * tunable is typed into the engine instead of into `data/balance.ts`; a check
 * that every `TraitMod` key is carried by something; a check that no
 * achievement compares an optional boolean against a value it never takes.
 *
 * What it had no check for at all was a **string in one data table that is
 * supposed to name a row in another**. There are ten such references and they
 * fail silently in every case — nothing throws, nothing logs, the value simply
 * resolves to `undefined` and the feature it was part of quietly does nothing.
 *
 * That is not hypothetical. `ARCHETYPES.broker.preferredTraits` listed
 * `'HardBargain'`; the trait is `'Hard Bargain'`. The generator does not
 * validate against the table — it assigns the string — so 174 tributes per
 * 1,600 Games walked in carrying a trait with no `TRAIT_DEFS` row: `traitMod`
 * summed nothing, `traitProficiencyFloor` granted nothing, and the tribute
 * sheet rendered `traitInfo`'s fallback, **"No recorded effect."**, to the
 * player. `metrics.ts` printed `Hard Bargain 6.76%` and `HardBargain 3.45%` in
 * the same table for three audits running and nobody read the two rows as one
 * bug. It survived eight full audits.
 *
 * The value of this file is not the one typo it found on the day it was
 * written — that is fixed. It is that this entire class of defect now cannot
 * reach `main` again, at the cost of a check that runs in under a second
 * because it touches no simulation at all.
 *
 *   npm run test:references
 */
import { ARCHETYPES } from '../src/data/archetypes';
import { TRAIT_DEFS } from '../src/data/traits';
import { QUIRKS, QUIRK_MODS } from '../src/data/quirks';
import { ARENAS, INCOMPATIBLE_TRAITS, ITEMS, IMPROVISED_ITEMS } from '../src/data/constants';
import { ARENA_MUTTS } from '../src/data/mutts';
import { DISTRICT_CRAFT } from '../src/data/districts';
import { ARENA_EVENT_PACKS } from '../src/data/arenaEventPacks';
import { STANCE_PROFILES } from '../src/data/stances';
import { ArchetypeId } from '../src/models/types';
import { SIGNATURES } from '../src/engine/archetypeHooks';

const problems: string[] = [];
const checked: string[] = [];

/** One reference table, asserted. `held` is what exists; `used` is what names it. */
function refs(label: string, used: Array<[string, string]>, held: Set<string>) {
    const bad = used.filter(([, value]) => !held.has(value));
    checked.push(`${label.padEnd(46)} ${used.length.toString().padStart(4)} reference(s) -> ${held.size} row(s)`);
    bad.forEach(([where, value]) => problems.push(`${label}: ${where} names '${value}', which is not a row in that table`));
}

const traitNames = new Set(Object.keys(TRAIT_DEFS));
const archetypeIds = new Set(Object.keys(ARCHETYPES));
const quirkLabels = new Set(QUIRKS.map(q => q.label));
const itemIds = new Set([...ITEMS, ...IMPROVISED_ITEMS].map(i => i.id));
const stanceNames = new Set(Object.keys(STANCE_PROFILES));
const eventPackNames = new Set(Object.keys(ARENA_EVENT_PACKS));

// ---- 1. archetype -> trait. The one that was broken. --------------------
refs('ArchetypeDef.preferredTraits -> TRAIT_DEFS',
    Object.entries(ARCHETYPES).flatMap(([id, a]) =>
        (a.preferredTraits ?? []).map(t => [`${id}.preferredTraits`, t] as [string, string])),
    traitNames);

// ---- 2. archetype -> archetype ------------------------------------------
refs('ArchetypeDef.hatesArchetypes -> ARCHETYPES',
    Object.entries(ARCHETYPES).flatMap(([id, a]) =>
        (a.hatesArchetypes ?? []).map(h => [`${id}.hatesArchetypes`, h] as [string, string])),
    archetypeIds);

// ---- 3. archetype -> stance ---------------------------------------------
refs('ArchetypeDef.stanceBias -> STANCE_PROFILES',
    Object.entries(ARCHETYPES).flatMap(([id, a]) =>
        Object.keys(a.stanceBias ?? {}).map(st => [`${id}.stanceBias`, st] as [string, string])),
    stanceNames);

// ---- 4. trait conflicts -> trait ----------------------------------------
refs('INCOMPATIBLE_TRAITS -> TRAIT_DEFS',
    INCOMPATIBLE_TRAITS.flatMap(([a, b], i) =>
        [[`pair ${i}`, a], [`pair ${i}`, b]] as Array<[string, string]>),
    traitNames);

// ---- 5. quirk mods -> quirk ---------------------------------------------
refs('QUIRK_MODS keys -> QUIRKS',
    Object.keys(QUIRK_MODS).map(k => ['QUIRK_MODS', k] as [string, string]),
    quirkLabels);

// ---- 6. arena -> item (restock bias) ------------------------------------
refs('Arena.restockBias -> ITEMS',
    ARENAS.flatMap(a => (a.restockBias ?? []).map(id => [`${a.id}.restockBias`, id] as [string, string])),
    itemIds);

// ---- 6b. district craft -> item -----------------------------------------
/*
 * §(requests)/AUDIT-9: `DISTRICT_CRAFT` names item ids in two places and
 * neither was asserted. District 16 listed `gaff` as an affinity item for
 * several audits and there was no such item — so the one weapon the deepwater
 * district was supposed to have grown up holding conferred nothing at all, and
 * nothing anywhere said so. A signature weapon that does not exist is worse:
 * it is a gravitational pull toward nothing.
 *
 * Both pools are checked, and the improvised table counts — a district may
 * legitimately be known for something it has to make rather than find.
 */
refs('DISTRICT_CRAFT.affinityItems -> ITEMS',
    Object.entries(DISTRICT_CRAFT).flatMap(([d, c]) =>
        c.affinityItems.map(id => [`D${d}.affinityItems`, id] as [string, string])),
    itemIds);
refs('DISTRICT_CRAFT.signatureWeapon -> ITEMS',
    Object.entries(DISTRICT_CRAFT)
        .filter(([, c]) => c.signatureWeapon !== undefined)
        .map(([d, c]) => [`D${d}.signatureWeapon`, c.signatureWeapon!] as [string, string]),
    itemIds);

// ---- 7. arena -> its own zone (law scoping) -----------------------------
// `noWaterExceptZone` and `sponsorsFixedZone` both mean "only here". A
// `lawZone` that names nothing silently turns "only here" into "nowhere".
refs('Arena.lawZone -> Arena.zones',
    ARENAS.filter(a => a.lawZone !== undefined).map(a => [`${a.id}.lawZone`, a.lawZone!] as [string, string]),
    new Set(ARENAS.flatMap(a => a.zones.map(z => z.name))));

// ---- 8. arena -> event pack ---------------------------------------------
refs('Arena.eventPack -> ARENA_EVENT_PACKS',
    ARENAS.filter(a => a.eventPack !== undefined).map(a => [`${a.id}.eventPack`, a.eventPack!] as [string, string]),
    eventPackNames);

// ---- 9. siege mutt -> its home zone -------------------------------------
// A `siege` mutt pins its re-attacks to `homeZone`. One that names a zone no
// arena has is a mutt that can never re-attack anywhere.
{
    const used: Array<[string, string]> = [];
    Object.entries(ARENA_MUTTS).forEach(([arenaId, list]) => list.forEach(m => {
        if (m.homeZone !== undefined) used.push([`${arenaId}/${m.id}.homeZone`, m.homeZone]);
    }));
    refs('Mutt.homeZone -> Arena.zones', used,
        new Set(ARENAS.flatMap(a => a.zones.map(z => z.name))));
}

// ---- 10. arena adjacency closes over its own zones ----------------------
// Not a cross-*table* reference, but the same failure mode and the same
// silence: an edge to a zone that does not exist is an edge nobody can cross
// and `reachableZones` drops without comment.
{
    const used: Array<[string, string]> = [];
    ARENAS.forEach(a => {
        const own = new Set(a.zones.map(z => z.name));
        a.zones.forEach(z => z.adjacent.forEach(n => {
            if (!own.has(n)) used.push([`${a.id}/${z.name}.adjacent`, n]);
        }));
    });
    // Everything legal resolves inside its own arena, so the held set is the
    // union and a genuine miss still fails.
    refs('Zone.adjacent -> Arena.zones', used,
        new Set(ARENAS.flatMap(a => a.zones.map(z => z.name))));
}

// ---- 11. every archetype's signature resolves ---------------------------
// `runArchetypeSignatures` does `const fn = SIGNATURES[key]; if (!fn) return;`
// — a renamed signature function removes an archetype's once-per-run set piece
// with no error anywhere, which is the §1.13 risk register entry.
refs('ArchetypeDef.signature -> SIGNATURES',
    Object.entries(ARCHETYPES)
        .filter(([, a]) => a.signature !== undefined)
        .map(([id, a]) => [`${id}.signature`, a.signature!] as [string, string]),
    new Set(Object.keys(SIGNATURES)));

// ---- and every archetype id in the union has a row ----------------------
// The union is the source of truth for the type; the table is what the engine
// reads. A member of one and not the other is a crash waiting for a seed.
const UNION_IDS: ArchetypeId[] = [
    'career', 'strategist', 'survivalist', 'protector', 'trickster', 'wildcard', 'underdog',
    'mercenary', 'zealot', 'medic', 'saboteur', 'beast', 'diplomat', 'scholar', 'ghost',
    'scavenger', 'captor', 'bellwether', 'confessor',
    'quartermaster', 'martyr', 'opportunist', 'tracker',
    'warden', 'herald', 'penitent', 'forager', 'duellist', 'broker',
    'cartographer', 'debtor', 'forecaster', 'understudy', 'archivist', 'quiet',
    // AUDIT-9 stage D.
    'courier',
    // AUDIT-9 batch 5. Both exist because batch 4 built the systems their core
    // actions read — the rescue line and the cache hearing.
    'rigger', 'arbitrator',
];
UNION_IDS.forEach(id => {
    if (!archetypeIds.has(id)) problems.push(`ArchetypeId union: '${id}' has no row in ARCHETYPES`);
});
Object.keys(ARCHETYPES).forEach(id => {
    if (!UNION_IDS.includes(id as ArchetypeId)) problems.push(`ARCHETYPES: '${id}' is not in the ArchetypeId union`);
});

function finish() {
    console.log('\ncross-table references');
    checked.forEach(line => console.log(`  ${line}`));
    if (problems.length > 0) {
        console.log(`\nFAIL: ${problems.length} broken reference(s):`);
        problems.forEach(p => console.log(`  ${p}`));
        console.log('\n  A string that names a row in another table and does not find one fails silently:');
        console.log('  the feature it belongs to simply stops happening, and nothing says so.');
        process.exit(1);
    }
    console.log(`\nEvery cross-table reference resolves (${checked.length} tables asserted).`);
}

finish();
