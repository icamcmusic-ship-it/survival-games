import React, { useEffect, useMemo, useState } from 'react';
import { EventCategory, EventLog, GameState, Tribute } from '../models/types';
import { CATEGORY_GROUPS, categoryMeta } from '../ui/eventStyles';
import { Beat, FeedLine, groupBeats, stripZoneClause, tierOf } from '../components/EventFeed';
import { TributeTile } from '../components/TributeTile';
import { ReplayFallenStrip } from '../components/ReplayFallenStrip';
import { TributeModal } from '../components/TributeModal';
import { ChronicleFilters } from '../components/ChronicleFilters';
import { chronicleStore, setChronicle } from '../store/chronicleStore';
import { useStore } from '../store/createStore';
import { canSeeArena, disclosureFor } from '../ui/disclosure';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * A3: the chronicle as its own page.
 *
 * The log used to live inside `GameScreen` in a `lg:col-span-2` column, capped
 * at `max-h-[70vh]` with a 200-row render cap — a five-hundred-line narrative
 * rendered into a scrollbox one third of the viewport wide. `groupBeats` and
 * `PhaseSection` already assembled the structure this page needs; it was simply
 * being drawn in the wrong container.
 *
 * This is an *additional* view. The in-arena sidebar feed is unchanged, and
 * both read the same filter state out of `chronicleStore`, so muting the
 * ambient chatter in one mutes it in the other.
 */

interface Page {
    /** Stable key, also the deep-link target. */
    key: string;
    day: number;
    phase: string;
    label: string;
    entries: EventLog[];
}

/**
 * Phases that happen before anyone is in the arena.
 *
 * `logEvent` resolves a missing zone from the first involved tribute, and a
 * tribute's zone is seeded to the Cornucopia at generation — so every training
 * and interview line carries a zone it has nothing to do with. Harmless in the
 * sidebar feed, where a beat header only appears for multi-line scenes; on a
 * page that puts the zone on every card it reads as the whole cast training
 * inside the Cornucopia.
 */
const PRE_ARENA_PHASES = new Set(['setup', 'reaping', 'training', 'interviews']);

function phaseLabel(phase: string): string {
    return phase.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
}

/** One page per (day, phase), in chronological order. */
function paginate(logs: EventLog[]): Page[] {
    const pages: Page[] = [];
    const index = new Map<string, Page>();
    logs.forEach(log => {
        const key = `${log.day}:${log.phase}`;
        let page = index.get(key);
        if (!page) {
            page = {
                key,
                day: log.day,
                phase: log.phase,
                label: log.day === 0 ? phaseLabel(log.phase) : `DAY ${log.day} — ${phaseLabel(log.phase)}`,
                entries: [],
            };
            index.set(key, page);
            pages.push(page);
        }
        page.entries.push(log);
    });
    return pages;
}

/**
 * Deep links: `#/chronicle?day=4&phase=night` lands on the right page so a
 * shared moment opens where it happened rather than at the start.
 */
function readDeepLink(): { day: number; phase: string } | null {
    const hash = window.location.hash.replace(/^#/, '');
    const q = hash.indexOf('?');
    if (q < 0) return null;
    const params = new URLSearchParams(hash.slice(q + 1));
    const day = Number(params.get('day'));
    const phase = params.get('phase');
    if (!Number.isFinite(day) || !phase) return null;
    return { day, phase };
}

function writeDeepLink(page: Page | undefined) {
    if (!page) return;
    const url = `${window.location.pathname}${window.location.search}#/chronicle?day=${page.day}&phase=${page.phase}`;
    window.history.replaceState(null, '', url);
}

/**
 * One beat as a card: the involved tributes as district tiles, the zone, a
 * category stripe from the existing `--cat-*` variables, and the prose at
 * reading size rather than the 13px the sidebar feed uses.
 */
function BeatCard({ beat, cast, onSelectTribute, showZone }: {
    beat: Beat;
    cast: Tribute[];
    onSelectTribute: (id: string) => void;
    showZone: boolean;
}) {
    const meta = categoryMeta(beat.logs[0].category);
    const people = [...beat.cast]
        .map(id => cast.find(t => t.id === id))
        .filter((t): t is Tribute => !!t)
        .slice(0, 4);

    return (
        <article
            className="panel-flush border-l-[6px] p-4 space-y-2.5 break-inside-avoid"
            style={{ borderLeftColor: meta.color }}
        >
            <header className="flex items-center justify-between gap-3 flex-wrap">
                <span className="eyebrow flex items-center gap-1.5" style={{ color: meta.color }}>
                    <span className="cat-glyph" aria-hidden="true">{meta.glyph}</span>
                    {meta.label}
                </span>
                {showZone && beat.zone && (
                    <span className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[var(--color-ink-500)]">
                        {beat.zone}
                    </span>
                )}
            </header>

            {people.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {people.map(t => (
                        <TributeTile key={t.id} tribute={t} size="sm" onSelect={onSelectTribute} />
                    ))}
                </div>
            )}

            <div className="chronicle-prose space-y-1.5">
                {beat.logs.map(log => (
                    <p key={log.id} className={log.important ? 'font-semibold text-[var(--ink)]' : 'text-[var(--color-ink-200)]'}>
                        {showZone && beat.zone && log.zone === beat.zone
                            ? stripZoneClause(log.text, beat.zone)
                            : log.text}
                    </p>
                ))}
            </div>
        </article>
    );
}

export function ChronicleScreen({ gameState }: { gameState: GameState }) {
    const filters = useStore(chronicleStore, s => s);
    const [selectedTributeId, setSelectedTributeId] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const arenaSealed = !!gameState.arenaHidden && !canSeeArena(disclosureFor(gameState.phase));

    const mutedCategories = useMemo(() => {
        const muted = new Set<EventCategory>();
        CATEGORY_GROUPS.forEach(group => {
            if (filters.mutedGroups.includes(group.id)) group.categories.forEach(c => muted.add(c));
        });
        return muted;
    }, [filters.mutedGroups]);

    const filteredLogs = useMemo(() => {
        const needle = filters.searchText.trim().toLowerCase();
        return gameState.log.filter(log => {
            if (filters.selectedZone && log.zone !== filters.selectedZone) return false;
            if (mutedCategories.has(log.category)) return false;
            if ((filters.filterTributeId || filters.filterTributeId2)
                && !(filters.filterTributeId && log.tributesInvolved.includes(filters.filterTributeId))
                && !(filters.filterTributeId2 && log.tributesInvolved.includes(filters.filterTributeId2))) return false;
            if (filters.filterDay !== null && log.day !== filters.filterDay) return false;
            if (needle && !log.text.toLowerCase().includes(needle)) return false;
            const tier = tierOf(log);
            if (filters.density === 'headlines' && tier !== 'headline') return false;
            if (filters.density === 'scenes' && tier === 'ambient') return false;
            return true;
        });
    }, [gameState.log, filters, mutedCategories]);

    const pages = useMemo(() => paginate(filteredLogs), [filteredLogs]);

    const [pageIndex, setPageIndex] = useState(() => {
        const deep = readDeepLink();
        if (!deep) return 0;
        return 0; // resolved against `pages` in the effect below
    });

    // Resolve a deep link once the pages exist, then keep the URL in step with
    // whatever page is showing so the address bar is always shareable.
    const [deepLinkApplied, setDeepLinkApplied] = useState(false);
    useEffect(() => {
        if (deepLinkApplied || pages.length === 0) return;
        setDeepLinkApplied(true);
        const deep = readDeepLink();
        if (!deep) return;
        const at = pages.findIndex(p => p.day === deep.day && p.phase === deep.phase);
        if (at >= 0) setPageIndex(at);
    }, [pages, deepLinkApplied]);

    // Filters change the page list underneath the reader; clamp rather than
    // showing an empty page they never navigated to.
    const clamped = Math.min(Math.max(0, pageIndex), Math.max(0, pages.length - 1));
    useEffect(() => {
        if (clamped !== pageIndex) setPageIndex(clamped);
    }, [clamped, pageIndex]);

    const page = pages[clamped];
    useEffect(() => { writeDeepLink(page); }, [page?.key]); // eslint-disable-line react-hooks/exhaustive-deps

    const beats = useMemo(() => (page ? groupBeats(page.entries) : []), [page]);

    const fallenThisPage = useMemo(() => {
        if (!page) return [];
        const ids = new Set(page.entries.flatMap(l => l.tributesInvolved));
        return gameState.tributes.filter(t =>
            t.status === 'dead' && t.dayOfDeath === page.day && ids.has(t.id));
    }, [page, gameState.tributes]);

    const survivorsAtPage = useMemo(() => {
        if (!page) return gameState.tributes.length;
        // Everyone whose recorded day of death is after this page's day is
        // still standing when it happens. Deaths on the same day are counted as
        // having already happened, which is the reading a page header wants.
        return gameState.tributes.filter(t =>
            t.status === 'alive' || (t.dayOfDeath ?? Infinity) > page.day).length;
    }, [page, gameState.tributes]);

    const selectedTribute = selectedTributeId
        ? gameState.tributes.find(t => t.id === selectedTributeId) ?? null
        : null;

    const days = useMemo(() => [...new Set(pages.map(p => p.day))], [pages]);

    const go = (step: number) => setPageIndex(i => Math.min(pages.length - 1, Math.max(0, i + step)));

    // Previous/Next belong on the arrow keys on a page whose entire model is
    // "one phase at a time".
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
            if (e.ctrlKey || e.metaKey || e.altKey || selectedTributeId) return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pages.length, selectedTributeId]);

    const scaleClass = filters.textScale === 'small' ? 'chronicle-text-sm'
        : filters.textScale === 'large' ? 'chronicle-text-lg' : '';

    return (
        <div className={`max-w-5xl mx-auto space-y-5 ${scaleClass} ${filters.narrowMeasure ? 'chronicle-narrow' : ''}`}>
            {/* ---------- header band ---------- */}
            <header className="panel p-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2 className="display-title text-3xl">{page?.label ?? 'THE CHRONICLE'}</h2>
                    <p className="text-[var(--color-ink-400)] text-sm mt-1">
                        {arenaSealed ? '❓ Arena sealed' : gameState.arena.name}
                        {' · '}{survivorsAtPage} still standing
                        {fallenThisPage.length > 0 && (
                            <span className="text-[var(--red)] font-semibold">
                                {' · '}{fallenThisPage.length} fallen here
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="seg-item"
                        aria-pressed={showFilters}
                        onClick={() => setShowFilters(v => !v)}
                        title="Filters, density, search and export"
                    >
                        Filters{pages.length !== paginate(gameState.log).length ? ' •' : ''}
                    </button>
                </div>
            </header>

            {showFilters && (
                <ChronicleFilters
                    gameState={gameState}
                    filteredCount={filteredLogs.length}
                    onSelectTribute={setSelectedTributeId}
                />
            )}

            {/* ---------- the page itself ---------- */}
            {pages.length === 0 ? (
                <div className="panel p-8 empty-state">
                    {gameState.log.length === 0
                        ? 'Nothing has happened yet.'
                        : 'Every logged event is hidden by your current filters.'}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        {beats.map((beat, i) => (
                            <BeatCard
                                key={`${beat.logs[0].id}-${i}`}
                                beat={beat}
                                cast={gameState.tributes}
                                onSelectTribute={setSelectedTributeId}
                                showZone={!arenaSealed && !PRE_ARENA_PHASES.has(page.phase)}
                            />
                        ))}
                    </div>

                    {/* A phase in which somebody died closes with the strip. */}
                    {fallenThisPage.length > 0 && (
                        <section className="space-y-2">
                            <h3 className="panel-title text-[var(--red)]">The fallen</h3>
                            <ReplayFallenStrip
                                tributes={gameState.tributes}
                                finalDay={Math.max(1, ...gameState.tributes.map(t => t.dayOfDeath ?? 1))}
                                selectedDay={page?.day}
                            />
                        </section>
                    )}
                </>
            )}

            {/* ---------- footer: paging ---------- */}
            <footer className="panel p-4 flex flex-wrap items-center justify-between gap-3 sticky bottom-0">
                <button
                    className="btn"
                    onClick={() => go(-1)}
                    disabled={clamped === 0}
                    title="Previous phase (Left arrow)"
                >
                    <ChevronLeft className="w-4 h-4" /> Previous phase
                </button>

                <div className="flex items-center gap-3 flex-wrap justify-center flex-1 min-w-0">
                    {/* Scrubber: one tick per phase, so the whole run's shape is
                        reachable in one gesture rather than N presses. */}
                    <div className="flex gap-0.5 flex-wrap justify-center" role="group" aria-label="Jump to a phase">
                        {pages.map((p, i) => {
                            const deadly = gameState.tributes.some(t => t.status === 'dead' && t.dayOfDeath === p.day)
                                && p.phase === 'night';
                            return (
                                <button
                                    key={p.key}
                                    onClick={() => setPageIndex(i)}
                                    aria-current={i === clamped ? 'true' : undefined}
                                    aria-label={p.label}
                                    title={p.label}
                                    className="w-2.5 h-5 border border-[var(--color-ink-700)]"
                                    style={{
                                        background: i === clamped ? 'var(--red)'
                                            : deadly ? 'var(--cat-death)'
                                            : 'var(--paper-flush)',
                                    }}
                                />
                            );
                        })}
                    </div>
                    <select
                        className="field text-xs w-auto"
                        aria-label="Jump to a day"
                        value={page?.day ?? ''}
                        onChange={e => {
                            const day = Number(e.target.value);
                            const at = pages.findIndex(p => p.day === day);
                            if (at >= 0) setPageIndex(at);
                        }}
                    >
                        {days.map(d => (
                            <option key={d} value={d}>{d === 0 ? 'Before the Games' : `Day ${d}`}</option>
                        ))}
                    </select>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-500)]">
                        {clamped + 1} / {pages.length}
                    </span>
                </div>

                <button
                    className="btn"
                    onClick={() => go(1)}
                    disabled={clamped >= pages.length - 1}
                    title="Next phase (Right arrow)"
                >
                    Next phase <ChevronRight className="w-4 h-4" />
                </button>
            </footer>

            {selectedTribute && (
                <TributeModal
                    tribute={selectedTribute}
                    gameState={gameState}
                    onClose={() => setSelectedTributeId(null)}
                    onShowInChronicle={() => {
                        setChronicle({
                            filterTributeId: selectedTribute.id,
                            filterTributeId2: null,
                            filterDay: null,
                            searchText: '',
                        });
                        setSelectedTributeId(null);
                        setPageIndex(0);
                    }}
                />
            )}
        </div>
    );
}
