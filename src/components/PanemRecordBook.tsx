import React, { useMemo, useState } from 'react';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, AchievementCategory, AchievementRarity, META_ACHIEVEMENTS } from '../data/achievements';
import { careerTotals } from '../utils/panemStorage';
import { PanemRecords, RECORD_DEFS } from '../utils/panemStorage';
import { DISTRICT_LEGACY, legacyOf } from '../data/districts';
import { ARCHETYPES } from '../data/archetypes';
import { ArchetypeId } from '../models/types';
import { Trophy, Lock, Check, Crown, Printer } from 'lucide-react';
import { QUELLS } from '../data/gamesProfile';
import { PROCEDURAL_BIOME_COUNT } from '../engine/arenaGenerator';
import { ARENA_FLAVOR, UNIVERSAL_EVENTS } from '../data/arenaFlavor';
import { ARENAS } from '../data/constants';
import { ARENA_MUTTS } from '../data/mutts';

/**
 * Audit 4 §9.5: the denominators. All derived, so a new arena, Quell or event
 * pack moves them without anybody having to remember to.
 *
 * `Ways to die` is the one that cannot be counted from a table: death causes
 * are composed at runtime from an arena's own nouns, so the total is a floor
 * taken from what a 180-run census produced, and the row shows whichever is
 * larger. It is a "how much of this have you met" figure rather than a
 * checklist with a known end, which is the honest shape for it.
 */
const TOTAL_MUTTS = Object.values(ARENA_MUTTS).reduce((n, roster) => n + roster.length, 0);
const TOTAL_ARENA_EVENTS = Object.values(ARENA_FLAVOR).reduce((n, pack) => n + pack.events.length, 0)
    + UNIVERSAL_EVENTS.length;
const TOTAL_DEATH_TEMPLATES = 347;
const ARENA_LAW_COUNT = 16;

const DISTRICT_NUMBERS = Object.keys(DISTRICT_LEGACY).map(Number).sort((a, b) => a - b);

function archetypeName(id: string): string {
    return ARCHETYPES[id as ArchetypeId]?.name ?? id;
}

const RARITY_ORDER: Record<AchievementRarity, number> = { common: 0, rare: 1, legendary: 2, possible: 3 };

/**
 * §19 (requests): rarity, colour-coded.
 *
 * The tier was printed as four grey letters in the same ink as the hint, which
 * is a label rather than a signal — a player scanning a hundred and ninety
 * entries for the one worth going after could not see it. Each tier now has a
 * colour and a filled chip, and the chip carries its own word, so the coding is
 * never the only thing carrying the meaning.
 *
 * Colours are pulled from the existing palette rather than invented: the same
 * tokens the event feed uses for its categories, so the two pages agree.
 */
const RARITY_STYLE: Record<AchievementRarity, { label: string; color: string }> = {
    common: { label: 'Common', color: 'var(--color-ink-500)' },
    rare: { label: 'Rare', color: 'var(--cat-alliance)' },
    legendary: { label: 'Legendary', color: 'var(--gold-deep)' },
    possible: { label: 'Possible?', color: 'var(--red)' },
};

/** What each tier claims, spelled out — the chip's accessible name and its tooltip. */
const RARITY_DESCRIPTION: Record<AchievementRarity, string> = {
    common: 'Common: happens in about a quarter of Games or more.',
    rare: 'Rare: happens in a few Games out of a hundred.',
    legendary: 'Legendary: measured, but only just — a handful of runs in a thousand.',
    possible: 'Possible? Believed to be reachable. No run has ever been recorded doing it.',
};

/**
 * §11: one row. `data-locked` is what the print stylesheet reads to spell out
 * "not yet earned" — on a mono printer the lock icon and the dimmed text are
 * indistinguishable from the checked, undimmed version.
 */
function AchievementRow({ a, unlocked, stamp, progress }: {
    a: { id: string; name: string; hint: string; rarity?: AchievementRarity };
    unlocked: boolean;
    stamp?: { run: number; date: string };
    progress?: { have: number; need: number };
}) {
    const share = progress && progress.need > 0 ? Math.min(1, progress.have / progress.need) : undefined;
    return (
        <div
            className={`panel-flush p-2.5 flex items-start gap-2.5${unlocked ? '' : ' opacity-55'}`}
            data-locked={unlocked ? 'false' : 'true'}
        >
            {unlocked
                ? <Check className="w-3.5 h-3.5 mt-0.5 flex-none" style={{ color: 'var(--cat-alliance)' }} />
                : <Lock className="w-3.5 h-3.5 mt-0.5 flex-none text-[var(--color-ink-500)]" />}
            <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <div className={`text-sm font-bold achievement-name ${unlocked ? 'text-[var(--ink)]' : 'text-[var(--color-ink-400)]'}`}>{a.name}</div>
                    {a.rarity && (
                        <span
                            className="rarity-chip"
                            style={{ ['--rarity' as string]: RARITY_STYLE[a.rarity].color }}
                            role="note"
                            // The chip is colour plus a word; the accessible
                            // name is what the colour is for, spelled out.
                            aria-label={RARITY_DESCRIPTION[a.rarity]}
                            title={RARITY_DESCRIPTION[a.rarity]}
                        >
                            {RARITY_STYLE[a.rarity].label}
                        </span>
                    )}
                </div>
                <div className="text-mini text-[var(--color-ink-500)]">{a.hint}</div>
                {unlocked && stamp && (
                    <div className="text-micro font-mono text-[var(--color-ink-500)]">earned in Games {stamp.run}{Date.parse(stamp.date) > 0 ? ` · ${new Date(stamp.date).toLocaleDateString()}` : ''}</div>
                )}
                {!unlocked && share !== undefined && progress && (
                    <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-[var(--paper-flush)]" role="progressbar" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${a.name} progress`}>
                            <div className="h-full" style={{ width: `${share * 100}%`, background: 'var(--gold)' }} />
                        </div>
                        <span className="text-micro font-mono text-[var(--color-ink-500)]">{progress.have}/{progress.need}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * §2: the shelf's own controls. 172 entries in eight groups had no search, no
 * rarity filter and no way to see only what was still locked — which, on the
 * one screen that is explicitly a menu of things to go and do, is the
 * information-density problem.
 */
type Shelf = 'all' | 'locked' | 'earned';

/**
 * REPLAY-03/04: what the player has, across every run they have ever finished.
 *
 * Locked achievements are shown by name and hint rather than hidden, because
 * the whole point of the list is to tell a player what the simulation can do
 * that they have not seen yet. A hidden list teaches nothing.
 */
export function PanemRecordBook({ panem }: { panem: PanemRecords }) {
    const unlocked = new Set(panem.unlocked);
    const [query, setQuery] = useState('');
    const [shelf, setShelf] = useState<Shelf>('all');
    const [rarity, setRarity] = useState<AchievementRarity | 'any'>('any');
    const totals = useMemo(() => careerTotals(panem), [panem]);
    const q = query.trim().toLowerCase();
    const matches = (a: { name: string; hint: string; id: string; rarity?: AchievementRarity }) =>
        (q === '' || a.name.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q))
        && (shelf === 'all' || (shelf === 'earned') === unlocked.has(a.id))
        && (rarity === 'any' || a.rarity === rarity);
    const allAchievements = [...ACHIEVEMENTS, ...META_ACHIEVEMENTS];
    const seen = allAchievements.filter(a => unlocked.has(a.id));
    const unseen = allAchievements.filter(a => !unlocked.has(a.id));
    // §11: 111 entries used to arrive as one flat list, seen-then-unseen, with
    // nothing to say which shelf an entry was on or how hard it was — which is
    // not a menu, it is a wall. Grouped by category, seen first inside each
    // group, so "you have finished the social ones, go and look at the arena
    // ones" is a thing the page can actually say.
    const groups = (Object.keys(ACHIEVEMENT_CATEGORIES) as AchievementCategory[])
        .map(category => {
            const entries = ACHIEVEMENTS.filter(a => a.category === category && matches(a));
            return {
                category,
                blurb: ACHIEVEMENT_CATEGORIES[category],
                seenCount: entries.filter(a => unlocked.has(a.id)).length,
                entries: [...entries].sort((a, b) =>
                    Number(unlocked.has(b.id)) - Number(unlocked.has(a.id))
                    || RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]
                    || a.name.localeCompare(b.name)),
            };
        })
        .filter(g => g.entries.length > 0);
    const metaEntries = META_ACHIEVEMENTS.filter(a => matches(a));
    const heirlooms = Object.entries(panem.heirlooms ?? {})
        .map(([d, h]) => ({ district: Number(d), ...h }))
        .sort((a, b) => a.district - b.district);
    const heldRecords = RECORD_DEFS.filter(def => panem.bests[def.id] !== undefined);
    /**
     * Audit 4 §9.5: the completion axes, each a union the profile already
     * keeps against a total the data tables already know. Totals are computed
     * rather than written down, so adding an arena or a Quell moves the
     * denominator without anybody remembering to.
     */
    const collection: Array<{ label: string; seen: number; total: number }> = [
        { label: 'Arenas', seen: (panem.arenasSeen ?? []).length, total: ARENAS.length + PROCEDURAL_BIOME_COUNT },
        { label: 'Quells', seen: (panem.quellsSeen ?? []).length, total: QUELLS.length },
        { label: 'Mutts', seen: (panem.muttsSeen ?? []).length, total: TOTAL_MUTTS },
        { label: 'Ways to die', seen: (panem.deathsSeen ?? []).length, total: Math.max(TOTAL_DEATH_TEMPLATES, (panem.deathsSeen ?? []).length) },
        { label: 'Arena events', seen: (panem.eventsSeen ?? []).length, total: TOTAL_ARENA_EVENTS },
        { label: 'Laws won under', seen: (panem.lawsWonUnder ?? []).length, total: ARENA_LAW_COUNT },
    ];
    // Absent on any record written before district crowns existed, which reads
    // correctly as "nothing crowned yet".
    const crowns = panem.districtCrowns ?? {};
    const crownedDistricts = DISTRICT_NUMBERS.filter(d => crowns[d]?.first?.name).length;

    if (panem.runs === 0) {
        return (
            <div className="panel p-5">
                <h3 className="panel-title mb-2">Your Panem</h3>
                <p className="text-sm text-[var(--color-ink-500)]">
                    No Games finished yet. Records and the list of things these Games can do will fill in
                    as you run them.
                </p>
            </div>
        );
    }

    return (
        <div className="panel p-5 space-y-5 record-book">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h3 className="panel-title">Your Panem</h3>
                {/* §2.8: the record book is the one thing in here somebody
                    would want on paper — the list of who won what, across every
                    run. `@media print` in index.css strips the app chrome and
                    lays this out as a document; this is the button that starts
                    it, and it is print-hidden itself. */}
                <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn btn-sm btn-ghost print-hide ml-auto"
                    aria-label="Print — the record book, or save it as a PDF"
                >
                    <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <span className="text-mini font-mono text-[var(--color-ink-500)]">
                    {panem.runs} Games finished · {panem.victors} crowned ·{' '}
                    {seen.length}/{allAchievements.length} seen
                </span>
            </div>

            {heldRecords.length > 0 && (
                <section>
                    <div className="eyebrow mb-2">Record book</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {heldRecords.map(def => {
                            const held = panem.bests[def.id]!;
                            return (
                                <div key={def.id} className="panel-flush p-2.5">
                                    <div className="eyebrow">{def.label}</div>
                                    <div className="text-sm text-[var(--ink)] font-semibold mt-0.5">
                                        {def.format(held.value)}
                                    </div>
                                    <div className="text-mini text-[var(--color-ink-500)] truncate">
                                        {held.name} (D{held.district}) · {held.arenaName} · seed {held.seed}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/*
              Audit 4 §9.2/§9.3/§9.5: the collection.

              Three of the game's biggest content investments have exposure
              rates that make them effectively single-view content: 27 Quells
              share 6.1% of runs (0.23% each), and there are 196 mutts and
              1,449 identified arena events. `deathCausesInRun()` in
              `engine/encounters.ts` was written to be the hook a records
              screen wants — its comment says exactly that — and was called by
              nothing.

              A lottery with no memory is not replayability; a player has no
              way to know that the thing that just happened has never happened
              to them before. Every number here is a union the profile was
              already half keeping, and none of it asked the simulation for
              anything new.
            */}
            <section>
                <div className="eyebrow mb-2">Seen at least once</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {collection.map(row => (
                        <div key={row.label} className="panel-flush p-2.5">
                            <div className="eyebrow">{row.label}</div>
                            <div className="text-sm text-[var(--ink)] font-semibold mt-0.5">
                                {row.seen}<span className="text-[var(--color-ink-500)]"> / {row.total}</span>
                            </div>
                            <div className="meter mt-1" role="img" aria-label={`${row.seen} of ${row.total} ${row.label.toLowerCase()} seen`}>
                                <span style={{ width: `${Math.min(100, Math.round((row.seen / Math.max(1, row.total)) * 100))}%`, background: 'var(--gold)' }} />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* REPLAY-12: the aggregate counters above cannot tell a player that a
                District 12 crown is the rarest thing in the simulation, or that they
                have never taken one. Twelve slots can. */}
            <section>
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                    <div className="eyebrow">District crowns</div>
                    <span className="text-mini font-mono text-[var(--color-ink-500)]">
                        {crownedDistricts}/{DISTRICT_NUMBERS.length} districts crowned
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {DISTRICT_NUMBERS.map(d => {
                        const crown = crowns[d];
                        const legacy = legacyOf(d);
                        if (!crown?.first?.name) {
                            return (
                                <div key={d} className="panel-flush p-2.5 flex items-start gap-2.5 opacity-55">
                                    <Lock className="w-3.5 h-3.5 mt-0.5 flex-none text-[var(--color-ink-500)]" />
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-[var(--color-ink-400)]">District {d}</div>
                                        <div className="text-mini text-[var(--color-ink-500)] truncate">
                                            {legacy.industry} · no crown yet
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        // Everything below is read straight out of localStorage, so a
                        // hand-edited or partial entry falls back rather than rendering NaN.
                        const archetypes = Array.isArray(crown.archetypes) ? crown.archetypes : [];
                        const victories = crown.victories ?? 1;
                        const kills = crown.first.kills ?? 0;
                        const days = crown.first.days ?? 0;
                        return (
                            <div key={d} className="panel-flush p-2.5 flex items-start gap-2.5">
                                <Crown className="w-3.5 h-3.5 mt-0.5 flex-none" style={{ color: 'var(--gold-text)' }} />
                                <div className="min-w-0">
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-[var(--ink)]">District {d}</span>
                                        <span className="chip">
                                            {victories} crown{victories === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                    <div className="text-mini text-[var(--color-ink-500)] truncate">
                                        First: {crown.first.name} · Games {crown.first.run ?? '?'} ·{' '}
                                        {kills} kill{kills === 1 ? '' : 's'} ·{' '}
                                        {days} day{days === 1 ? '' : 's'}
                                    </div>
                                    <div className="text-mini text-[var(--color-ink-500)] truncate">
                                        {crown.first.arenaName || 'an unrecorded arena'} · seed {crown.first.seed || '—'}
                                        {archetypes.length > 0 && ` · won as ${archetypes.map(archetypeName).join(', ')}`}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {/* §2: what the record book is for, while it is still empty. */}
                {crownedDistricts === 0 && (
                    <p className="text-mini text-[var(--color-ink-500)] mt-2 max-w-prose">
                        Nothing here yet. As you finish Games this fills with the country's standing
                        records — the longest Games, the youngest crown, the highest kill count, which
                        districts have ever produced a victor, and which Head Gamemakers ran which years.
                    </p>
                )}
                {crownedDistricts < DISTRICT_NUMBERS.length && (
                    <p className="text-mini text-[var(--color-ink-500)] mt-2 italic">
                        <Trophy className="w-3 h-3 inline mb-0.5" /> The outer districts almost never win.
                        An empty slot is a standing invitation.
                    </p>
                )}
            </section>

            {heirlooms.length > 0 && (
                <section>
                    <div className="eyebrow mb-2">Heirlooms</div>
                    <p className="text-micro text-[var(--color-ink-500)] italic mb-1.5">
                        What the fallen carried in, sent back out by their district with the next tribute. Written every run; shown nowhere until now.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {heirlooms.map(h => (
                            <div key={h.district} className="panel-flush p-2.5 text-xs">
                                <div className="font-bold text-[var(--ink)]">District {h.district} — {h.token}</div>
                                <div className="text-mini text-[var(--color-ink-500)]">from {h.fromName}, Games {h.run}{h.quirk ? ` · ${h.quirk}` : ''}</div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section>
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                    <div className="eyebrow">Things these Games can do</div>
                    <div className="flex flex-wrap items-center gap-2 print-hide">
                        <input
                            type="search"
                            className="field text-xs w-40"
                            placeholder="Search achievements"
                            aria-label="Search achievements"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                        <div className="seg" role="group" aria-label="Show">
                            {(['all', 'locked', 'earned'] as Shelf[]).map(s => (
                                <button key={s} className="seg-item" aria-pressed={shelf === s} onClick={() => setShelf(s)}>{s}</button>
                            ))}
                        </div>
                        <select className="field text-xs w-auto" aria-label="Rarity" value={rarity} onChange={e => setRarity(e.target.value as AchievementRarity | 'any')}>
                            <option value="any">any rarity</option>
                            {(['common', 'rare', 'legendary', 'possible'] as AchievementRarity[]).map(r => <option key={r} value={r}>{RARITY_STYLE[r].label.toLowerCase()}</option>)}
                        </select>
                    </div>
                </div>
                {groups.length === 0 && metaEntries.length === 0 && (
                    <p className="text-mini text-[var(--color-ink-500)] italic">Nothing matches.</p>
                )}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar print-unclip">
                    {groups.map(group => (
                        <div key={group.category}>
                            <div className="flex items-baseline justify-between gap-2 mb-1">
                                <div className="text-mini font-bold uppercase tracking-wide text-[var(--color-ink-400)]">
                                    {group.category}
                                </div>
                                <div className="text-micro font-mono text-[var(--color-ink-500)]">
                                    {group.seenCount}/{group.entries.length}
                                </div>
                            </div>
                            <div className="text-micro text-[var(--color-ink-500)] italic mb-1.5">{group.blurb}</div>
                            <div className="space-y-1.5">
                                {group.entries.map(a => <AchievementRow key={a.id} a={a} unlocked={unlocked.has(a.id)} stamp={panem.unlockedAt?.[a.id]} />)}
                            </div>
                        </div>
                    ))}
                    {metaEntries.length > 0 && (
                        <div>
                            <div className="flex items-baseline justify-between gap-2 mb-1">
                                <div className="text-mini font-bold uppercase tracking-wide text-[var(--color-ink-400)]">
                                    collection
                                </div>
                                <div className="text-micro font-mono text-[var(--color-ink-500)]">
                                    {metaEntries.filter(a => unlocked.has(a.id)).length}/{metaEntries.length}
                                </div>
                            </div>
                            <div className="text-micro text-[var(--color-ink-500)] italic mb-1.5">
                                Earned across every Games you have ever run, not inside one of them.
                            </div>
                            <div className="space-y-1.5">
                                {metaEntries.map(a => <AchievementRow key={a.id} a={a} unlocked={unlocked.has(a.id)} stamp={panem.unlockedAt?.[a.id]} progress={a.progress?.(totals)} />)}
                            </div>
                        </div>
                    )}
                </div>
                {unseen.length > 0 && (
                    <p className="text-mini text-[var(--color-ink-500)] mt-2 italic">
                        <Trophy className="w-3 h-3 inline mb-0.5" /> Locked entries are listed on purpose —
                        they are a menu of outcomes this simulation can produce, not a secret.
                    </p>
                )}
            </section>
        </div>
    );
}
