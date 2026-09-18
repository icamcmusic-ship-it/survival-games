import React, { useEffect, useMemo, useState } from 'react';
import { EventCategory, EventLog, GameState, Tribute } from '../models/types';
import { CATEGORY_GROUPS, categoryMeta } from '../ui/eventStyles';
import { MomentShare, groupBeats, passesDensity, stripZoneClause, tierOf, withTributeLinks } from '../components/EventFeed';
import { ReplayFallenStrip } from '../components/ReplayFallenStrip';
import { TributeModal } from '../components/TributeModal';
import { TributeCompare } from '../components/TributeCompare';
import { ChronicleFilters } from '../components/ChronicleFilters';
import { chronicleStore, filtersActive, setChronicle } from '../store/chronicleStore';
import { useStore } from '../store/createStore';
import { prefsStore } from '../store/prefsStore';
import { canSeeArena, disclosureFor } from '../ui/disclosure';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTransientFlag } from '../ui/useTransientFlag';
import { PRE_ARENA_PHASE_SET, phaseLabel as prettyPhase } from '../ui/phaseLabels';
import { gameActions, gameStore } from '../store/gameStore';

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
const PRE_ARENA_PHASES = PRE_ARENA_PHASE_SET;

function phaseLabel(phase: string): string {
    return prettyPhase(phase).toUpperCase();
}

/** What pressing Advance will run next, as the button's own label. */
function nextStageLabel(phase: string): string {
    switch (phase) {
        case 'setup': case 'roster': case 'reaping': return 'Hold the reaping';
        case 'square': return 'Board the train';
        case 'train': return 'Run the parade';
        case 'parade': return 'Open the training floor';
        case 'training1': return 'Training day 2';
        case 'training2': return 'Training day 3';
        case 'training3': return 'Read the scores';
        case 'training': case 'scores': return 'Start the interviews';
        case 'interviews': return 'Sound the gong';
        case 'bloodbath': return 'Run the bloodbath';
        case 'day': return 'Into the night';
        case 'night': return 'Next day';
        case 'feast': return 'After the feast';
        case 'epilogue': return 'Close the Games';
        default: return 'Advance';
    }
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

function CopyPageLink({ page }: { page: Page }) {
    const [state, setState] = useTransientFlag<'idle' | 'ok' | 'fail'>('idle', 1500);
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#/chronicle?day=${page.day}&phase=${page.phase}`;
    return (
        <button
            type="button"
            className="btn btn-sm btn-ghost text-[11px]"
            aria-label={`Copy a link to ${page.label}`}
            onClick={() => {
                navigator.clipboard?.writeText(url).then(() => setState('ok')).catch(() => setState('fail'));
            }}
        >
            {state === 'ok' ? 'Link copied' : state === 'fail' ? 'Copy failed' : 'Copy link'}
        </button>
    );
}

function writeDeepLink(page: Page | undefined) {
    if (!page) return;
    const url = `${window.location.pathname}${window.location.search}#/chronicle?day=${page.day}&phase=${page.phase}`;
    window.history.replaceState(null, '', url);
}

/**
 * §14 (requests): one line at a time.
 *
 * The page used to render `groupBeats` into a two-column grid of cards, each
 * with its own category header, its own row of tribute tiles and its own
 * paragraph block. Two columns of variable-height blocks do not line up with
 * each other by construction, so the archive of a run read as a ragged
 * masonry wall in which nothing was in order: the left column ran ahead of the
 * right, a two-line beat sat beside a nine-line one, and a reader looking for
 * what happened next had to scan both columns and compare.
 *
 * A chronicle is a log. It wants one entry per line, in order, in columns that
 * line up — the time, the category, the place, and what happened. That is what
 * this is. The beat grouping is still what decides which lines belong together
 * (it indents continuations and suppresses a repeated zone), but it no longer
 * decides the layout.
 */
function LogRow({ log, cast, onSelectTribute, showZone, continuation, revealed, zone, gameState }: {
    log: EventLog;
    cast: Tribute[];
    onSelectTribute: (id: string) => void;
    showZone: boolean;
    /** Not the first line of its beat: the zone is already on the row above. */
    continuation: boolean;
    revealed: boolean;
    zone?: string;
    /**
     * AUDIT-6 §2.6: needed for the per-moment copy, which is the whole reason
     * this prop exists on a row that otherwise needs nothing but its own log.
     */
    gameState: GameState;
}) {
    const meta = categoryMeta(log.category);
    const hidden = !revealed && (log.category === 'death' || log.category === 'kill');
    const text = !continuation && showZone && zone && log.zone === zone
        ? stripZoneClause(log.text, zone)
        : log.text;
    return (
        <div
            className={`log-row${log.important ? ' is-important' : ''}${continuation ? ' is-continuation' : ''}`}
            style={{ ['--cat' as string]: meta.color }}
            data-log-id={log.id}
        >
            <span className="log-time">{log.clock ?? ''}</span>
            <span className="log-cat">
                <span className="cat-glyph" aria-hidden="true">{meta.glyph}</span>
                <span className="log-cat-label">{meta.label}</span>
            </span>
            <span className="log-zone">{showZone && !continuation ? (log.zone ?? '') : ''}</span>
            <span className="log-text">
                {hidden
                    ? <span className="italic text-[var(--color-ink-500)]">A cannon. Hidden while spoiler-safe viewing is on.</span>
                    : withTributeLinks(text, cast, log.tributesInvolved, onSelectTribute)}
                {/*
                 * AUDIT-6 §2.6: the single-moment copy.
                 *
                 * `MomentShare` has existed in `EventFeed` since the audit that
                 * asked for it, wired into `FeedLine` — and a walkthrough of
                 * the live app found **zero** of them on any screen, because
                 * the chronicle renders `LogRow` and the arena's sidebar no
                 * longer renders `FeedLine` at all. A run produces around a
                 * thousand lines and the only export granularity was the whole
                 * chronicle. This is the reading surface; this is where it
                 * belongs.
                 *
                 * Only on `important` lines, which is the set the headline
                 * density already uses, so the page does not grow a button per
                 * row. Hidden lines get none: there is nothing to copy yet.
                 */}
                {log.important && !hidden && <MomentShare gameState={gameState} log={log} />}
            </span>
        </div>
    );
}

export function ChronicleScreen({ gameState }: { gameState: GameState }) {
    const filters = useStore(chronicleStore, s => s);
    const [selectedTributeId, setSelectedTributeId] = useState<string | null>(null);
    const [compareTributeId, setCompareTributeId] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const arenaSealed = !!gameState.arenaHidden && !canSeeArena(disclosureFor(gameState.phase));
    // §2.5: once the run has ended there is nothing left to spoil, so the
    // suppression lifts on its own rather than needing to be switched off.
    const spoilerSafe = useStore(prefsStore, p => p.spoilerSafe);
    const revealed = !spoilerSafe || gameState.phase === 'ended';

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
            // §2.2: 'both' is the relationship read — every line the two of them
            // are in together — which the union-only filter could not ask for.
            if (filters.filterPairMode === 'both' && filters.filterTributeId && filters.filterTributeId2) {
                if (!log.tributesInvolved.includes(filters.filterTributeId)
                    || !log.tributesInvolved.includes(filters.filterTributeId2)) return false;
            } else if ((filters.filterTributeId || filters.filterTributeId2)
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
    /**
     * Counted the way the feed reads it — category filters *and* the reading
     * density — so "Showing N of M" is the number on the page. The filter dot
     * beside the control now asks `filtersActive` rather than re-paginating the
     * entire log inline on every render to compare two page counts, which was
     * both the most expensive thing in this render and wrong: a filter that
     * removes lines without emptying a whole phase leaves the page count
     * identical and lit nothing.
     */
    const readableCount = useMemo(
        () => filteredLogs.reduce((n, log) => n + (passesDensity(log, filters.density) ? 1 : 0), 0),
        [filteredLogs, filters.density],
    );

    // Always 0: a deep link cannot be resolved until `pages` exists, which is
    // what the effect below is for. The initialiser used to call
    // `readDeepLink()` and then return 0 on both branches regardless.
    const [pageIndex, setPageIndex] = useState(0);

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

    // §(requests): a new page starts at the top of the log. Paging forward
    // used to leave the reader wherever the previous page had scrolled them,
    // which on a long night was the footer.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.scrollTo({ top: 0, behavior: 'auto' });
    }, [page?.key]);

    // §(requests): the Games can be advanced from here. The chronicle used to
    // be read-only — reaching the last page meant going back to the arena
    // screen to press Next, then returning. One button, and it lands on the
    // page it just wrote.
    const simulator = useStore(gameStore, s => s.simulator);
    const runProgress = useStore(gameStore, s => s.runProgress);
    const canAdvance = !!simulator && gameState.phase !== 'ended' && !runProgress;
    const onLastPage = clamped >= pages.length - 1;
    const [advanceArmed, setAdvanceArmed] = useState(false);
    useEffect(() => {
        if (!advanceArmed) return;
        setAdvanceArmed(false);
        setPageIndex(Math.max(0, pages.length - 1));
    }, [pages.length, advanceArmed]);
    const advanceGames = () => {
        if (!canAdvance) return;
        setAdvanceArmed(true);
        gameActions.nextPhase();
    };

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
    const compareTribute = compareTributeId
        ? gameState.tributes.find(t => t.id === compareTributeId) ?? null
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
                    {/* §2.4 (audit): the deep link existed and nothing pointed
                        at it. One button per page, so a moment in the record
                        is a thing that can be sent. */}
                    {page && <CopyPageLink page={page} />}
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
                    {/* AUDIT-6 §2.6: the bullet was the only statement that
                        filters were active, which a screen reader does not read
                        as anything and a reader has to already know. The count
                        says it out loud, and the name stops colliding with
                        "Reset filters" inside the panel. */}
                    <button
                        className="seg-item"
                        aria-pressed={showFilters}
                        onClick={() => setShowFilters(v => !v)}
                        aria-label={filtersActive(filters)
                            ? 'Filters, density, search and export — filters are active'
                            : 'Filters, density, search and export'}
                    >
                        Filters{filtersActive(filters) ? ' •' : ''}
                    </button>
                </div>
            </header>

            {showFilters && (
                <ChronicleFilters
                    gameState={gameState}
                    filteredCount={readableCount}
                    onSelectTribute={setSelectedTributeId}
                />
            )}

            {/* ---------- the page itself ---------- */}
            {pages.length === 0 ? (
                <div className="panel p-8 empty-state">
                    {gameState.log.length === 0
                        // §(requests 7): confirming the reaping lands here, with
                        // nothing written yet and the button below waiting.
                        ? 'The cast is confirmed and the record is empty. Start the Games with the button below — every stage writes its own page here.'
                        : 'Every logged event is hidden by your current filters.'}
                </div>
            ) : (
                <>
                    {/* §14: one column, one line per entry, columns that line
                        up. The header row is the key to the four columns. */}
                    <div className="log-table" role="table" aria-label={`${page.label} — event log`}>
                        <div className="log-row log-head" role="row">
                            <span className="log-time">Time</span>
                            <span className="log-cat">Kind</span>
                            <span className="log-zone">Where</span>
                            <span className="log-text">What happened</span>
                        </div>
                        {beats.map((beat, bi) => beat.logs.map((log, li) => (
                            <LogRow
                                key={log.id}
                                log={log}
                                cast={gameState.tributes}
                                onSelectTribute={setSelectedTributeId}
                                showZone={!arenaSealed && !PRE_ARENA_PHASES.has(page.phase)}
                                continuation={li > 0 && beat.logs.length > 1}
                                zone={beat.zone}
                                revealed={revealed}
                                gameState={gameState}
                            />
                        )))}
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
                    aria-label="Previous page (Left arrow)"
                >
                    <ChevronLeft className="w-4 h-4" /> Previous page
                </button>

                <div className="flex items-center gap-3 flex-wrap justify-center flex-1 min-w-0">
                    {/* Scrubber: one tick per phase, so the whole run's shape is
                        reachable in one gesture rather than N presses. */}
                    {/* AUDIT-6 §1.4: an empty scrubber and a day picker with
                        nothing to pick are both announced to a screen reader as
                        real controls. With no pages there is nothing to jump to. */}
                    <div className="flex gap-0.5 flex-wrap justify-center" role="group" aria-label="Jump to a phase" hidden={pages.length === 0}>
                        {pages.map((p, i) => {
                            const deadly = gameState.tributes.some(t => t.status === 'dead' && t.dayOfDeath === p.day)
                                && p.phase === 'night';
                            return (
                                <button
                                    key={p.key}
                                    onClick={() => setPageIndex(i)}
                                    aria-current={i === clamped ? 'true' : undefined}
                                    aria-label={p.label}
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
                        hidden={pages.length === 0}
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
                    {/* AUDIT-6 §1.4: `{clamped + 1} / {pages.length}` printed
                        `1 / 0` on the screen the player lands on straight after
                        confirming the reaping, when the record is empty by
                        design. "Page one of none" is arithmetic that cannot be
                        true, and it sat directly under the empty-state copy
                        that correctly explains there is nothing here yet. */}
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-500)]">
                        {pages.length === 0 ? 'No pages yet' : `${clamped + 1} / ${pages.length}`}
                    </span>
                </div>

                {onLastPage && canAdvance ? (
                    <button
                        className="btn"
                        onClick={advanceGames}
                        style={{ background: 'var(--red)', color: '#fff', borderColor: 'var(--red)' }}
                        aria-label={`Advance the Games: ${nextStageLabel(gameState.phase)}`}
                    >
                        {nextStageLabel(gameState.phase)} <ChevronRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button
                        className="btn"
                        onClick={() => go(1)}
                        disabled={clamped >= pages.length - 1}
                        aria-label="Next page (Right arrow)"
                    >
                        Next page <ChevronRight className="w-4 h-4" />
                    </button>
                )}
            </footer>

            {/* §2.5: paging is a navigation event with no visual anchor for a
                screen-reader user — say which page they landed on. */}
            <div aria-live="polite" className="sr-only">
                {page ? `${page.label}. ${beats.length} moments. ${survivorsAtPage} still standing.` : ''}
            </div>

            {/*
              * AUDIT-6 §2: side-by-side comparison was wired only on the arena
              * screen, so the reader who most wants it — somebody paging back
              * through the chronicle asking "how did those two differ" — could
              * not reach it. The arena's own comment says the moment somebody
              * wants this is the moment a rivalry sharpens; that moment is
              * usually being *read about*, not watched live.
              */}
            {selectedTribute && compareTribute && (
                <TributeCompare
                    a={selectedTribute}
                    b={compareTribute}
                    gameState={gameState}
                    onClose={() => { setCompareTributeId(null); setSelectedTributeId(null); }}
                    onSwap={() => setCompareTributeId(null)}
                />
            )}

            {selectedTribute && !compareTribute && (
                <TributeModal
                    tribute={selectedTribute}
                    gameState={gameState}
                    onCompare={setCompareTributeId}
                    onClose={() => { setSelectedTributeId(null); setCompareTributeId(null); }}
                    onShowInChronicle={() => {
                        setChronicle({
                            filterTributeId: selectedTribute.id,
                            filterTributeId2: null,
                            filterPairMode: 'either',
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
