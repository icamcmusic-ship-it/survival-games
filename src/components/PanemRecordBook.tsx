import React, { useMemo, useState } from 'react';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, AchievementCategory, AchievementRarity, META_ACHIEVEMENTS } from '../data/achievements';
import { careerTotals } from '../utils/panemStorage';
import { PanemRecords, RECORD_DEFS } from '../utils/panemStorage';
import { DISTRICT_LEGACY, legacyOf } from '../data/districts';
import { ARCHETYPES } from '../data/archetypes';
import { ArchetypeId } from '../models/types';
import { Trophy, Lock, Check, Crown, Printer } from 'lucide-react';

const DISTRICT_NUMBERS = Object.keys(DISTRICT_LEGACY).map(Number).sort((a, b) => a - b);

function archetypeName(id: string): string {
    return ARCHETYPES[id as ArchetypeId]?.name ?? id;
}

const RARITY_ORDER: Record<AchievementRarity, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

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
                        <span className="text-[9px] font-mono uppercase tracking-wide text-[var(--color-ink-500)]">{a.rarity}</span>
                    )}
                </div>
                <div className="text-[11px] text-[var(--color-ink-500)]">{a.hint}</div>
                {unlocked && stamp && (
                    <div className="text-[10px] font-mono text-[var(--color-ink-500)]">earned in Games {stamp.run}{Date.parse(stamp.date) > 0 ? ` · ${new Date(stamp.date).toLocaleDateString()}` : ''}</div>
                )}
                {!unlocked && share !== undefined && progress && (
                    <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-[var(--paper-flush)]" role="progressbar" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${a.name} progress`}>
                            <div className="h-full" style={{ width: `${share * 100}%`, background: 'var(--gold)' }} />
                        </div>
                        <span className="text-[10px] font-mono text-[var(--color-ink-500)]">{progress.have}/{progress.need}</span>
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
                    title="Print the record book, or save it as a PDF"
                >
                    <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <span className="text-[11px] font-mono text-[var(--color-ink-500)]">
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
                                    <div className="text-[11px] text-[var(--color-ink-500)] truncate">
                                        {held.name} (D{held.district}) · {held.arenaName} · seed {held.seed}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* REPLAY-12: the aggregate counters above cannot tell a player that a
                District 12 crown is the rarest thing in the simulation, or that they
                have never taken one. Twelve slots can. */}
            <section>
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                    <div className="eyebrow">District crowns</div>
                    <span className="text-[11px] font-mono text-[var(--color-ink-500)]">
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
                                        <div className="text-[11px] text-[var(--color-ink-500)] truncate">
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
                                <Crown className="w-3.5 h-3.5 mt-0.5 flex-none" style={{ color: 'var(--gold)' }} />
                                <div className="min-w-0">
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-[var(--ink)]">District {d}</span>
                                        <span className="chip">
                                            {victories} crown{victories === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-[var(--color-ink-500)] truncate">
                                        First: {crown.first.name} · Games {crown.first.run ?? '?'} ·{' '}
                                        {kills} kill{kills === 1 ? '' : 's'} ·{' '}
                                        {days} day{days === 1 ? '' : 's'}
                                    </div>
                                    <div className="text-[11px] text-[var(--color-ink-500)] truncate">
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
                    <p className="text-[11px] text-[var(--color-ink-500)] mt-2 max-w-prose">
                        Nothing here yet. As you finish Games this fills with the country's standing
                        records — the longest Games, the youngest crown, the highest kill count, which
                        districts have ever produced a victor, and which Head Gamemakers ran which years.
                    </p>
                )}
                {crownedDistricts < DISTRICT_NUMBERS.length && (
                    <p className="text-[11px] text-[var(--color-ink-500)] mt-2 italic">
                        <Trophy className="w-3 h-3 inline mb-0.5" /> The outer districts almost never win.
                        An empty slot is a standing invitation.
                    </p>
                )}
            </section>

            {heirlooms.length > 0 && (
                <section>
                    <div className="eyebrow mb-2">Heirlooms</div>
                    <p className="text-[10px] text-[var(--color-ink-500)] italic mb-1.5">
                        What the fallen carried in, sent back out by their district with the next tribute. Written every run; shown nowhere until now.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {heirlooms.map(h => (
                            <div key={h.district} className="panel-flush p-2.5 text-xs">
                                <div className="font-bold text-[var(--ink)]">District {h.district} — {h.token}</div>
                                <div className="text-[11px] text-[var(--color-ink-500)]">from {h.fromName}, Games {h.run}{h.quirk ? ` · ${h.quirk}` : ''}</div>
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
                            {(['common', 'uncommon', 'rare', 'legendary'] as AchievementRarity[]).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                </div>
                {groups.length === 0 && metaEntries.length === 0 && (
                    <p className="text-[11px] text-[var(--color-ink-500)] italic">Nothing matches.</p>
                )}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar print-unclip">
                    {groups.map(group => (
                        <div key={group.category}>
                            <div className="flex items-baseline justify-between gap-2 mb-1">
                                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-400)]">
                                    {group.category}
                                </div>
                                <div className="text-[10px] font-mono text-[var(--color-ink-500)]">
                                    {group.seenCount}/{group.entries.length}
                                </div>
                            </div>
                            <div className="text-[10px] text-[var(--color-ink-500)] italic mb-1.5">{group.blurb}</div>
                            <div className="space-y-1.5">
                                {group.entries.map(a => <AchievementRow key={a.id} a={a} unlocked={unlocked.has(a.id)} stamp={panem.unlockedAt?.[a.id]} />)}
                            </div>
                        </div>
                    ))}
                    {metaEntries.length > 0 && (
                        <div>
                            <div className="flex items-baseline justify-between gap-2 mb-1">
                                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-400)]">
                                    collection
                                </div>
                                <div className="text-[10px] font-mono text-[var(--color-ink-500)]">
                                    {metaEntries.filter(a => unlocked.has(a.id)).length}/{metaEntries.length}
                                </div>
                            </div>
                            <div className="text-[10px] text-[var(--color-ink-500)] italic mb-1.5">
                                Earned across every Games you have ever run, not inside one of them.
                            </div>
                            <div className="space-y-1.5">
                                {metaEntries.map(a => <AchievementRow key={a.id} a={a} unlocked={unlocked.has(a.id)} stamp={panem.unlockedAt?.[a.id]} progress={a.progress?.(totals)} />)}
                            </div>
                        </div>
                    )}
                </div>
                {unseen.length > 0 && (
                    <p className="text-[11px] text-[var(--color-ink-500)] mt-2 italic">
                        <Trophy className="w-3 h-3 inline mb-0.5" /> Locked entries are listed on purpose —
                        they are a menu of outcomes this simulation can produce, not a secret.
                    </p>
                )}
            </section>
        </div>
    );
}
