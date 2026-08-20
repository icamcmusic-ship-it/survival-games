import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EventCategory, GameState } from '../models/types';
import { ArenaMap } from '../components/ArenaMap';
import { TributeModal } from '../components/TributeModal';
import { EventFeed, FeedLine } from '../components/EventFeed';
import { CATEGORY_GROUPS } from '../ui/eventStyles';
import { tributeOdds } from '../engine/odds';
import { objectiveLabel } from '../engine/objectives';
import { Skull, Heart, Settings, FastForward, MapPin, Users, Swords, Filter, Play, Pause, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ESCALATION } from '../data/balance';
import { Explainer } from '../components/Explainer';
import { ordinal } from '../engine/gamesProfile';
import { gameStore } from '../store/gameStore';
import { useStore } from '../store/createStore';

type Speed = 'manual' | '1x' | '5x' | 'auto';

const SPEED_DELAY: Record<Exclude<Speed, 'manual'>, number> = { '1x': 1200, '5x': 350, auto: 60 };

/**
 * UX-14: pacing follows drama, not the phase counter.
 *
 * A quiet night and a twelve-death feast used to take the same wall-clock time
 * because the timer only knew "one phase per tick". The delay now scales with
 * how many lines the phase just produced, so a busy cycle lingers long enough
 * to read. Max speed stays flat — its whole point is to get to the end.
 */
const MAX_PACING_MULTIPLIER = 3;
const LINES_PER_MULTIPLIER_STEP = 6;

function pacedDelay(speed: Exclude<Speed, 'manual'>, linesThisPhase: number): number {
    const base = SPEED_DELAY[speed];
    if (speed === 'auto') return base;
    const multiplier = Math.min(MAX_PACING_MULTIPLIER, 1 + linesThisPhase / LINES_PER_MULTIPLIER_STEP);
    return Math.round(base * multiplier);
}

export function GameScreen({
    gameState,
    onNextPhase,
    onRunToEnd,
    onGamemakerEvent,
}: {
    gameState: GameState,
    onNextPhase: () => void,
    onRunToEnd: () => void,
    onGamemakerEvent: (type: 'mutt' | 'weather' | 'feast', targetId?: string) => void,
}) {
    const [selectedTributeId, setSelectedTributeId] = useState<string | null>(null);
    const [speed, setSpeed] = useState<Speed>('manual');
    const [importantOnly, setImportantOnly] = useState(false);
    const [muttTargetId, setMuttTargetId] = useState('');
    const [tacticalTab, setTacticalTab] = useState<'chronicle' | 'map'>('chronicle');
    const [selectedZone, setSelectedZone] = useState<string | null>(null);
    // Below `lg` the two columns stack, which buried the tribute list under a
    // full-height feed. On small screens one pane shows at a time, chosen from a
    // bottom tab bar (UX-12); at `lg` and up both columns render as before.
    const [mobilePane, setMobilePane] = useState<'chronicle' | 'map' | 'tributes'>('chronicle');
    const [mutedGroups, setMutedGroups] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);
    // UX: auto-play at 5x/Max blows straight past major deaths; opt-in brake.
    const [pauseOnDeath, setPauseOnDeath] = useState(false);
    const bets = useStore(gameStore, s => s.bets);
    // Chronicle search and per-tribute filtering.
    const [searchText, setSearchText] = useState('');
    const [filterTributeId, setFilterTributeId] = useState<string | null>(null);
    const nextPhaseRef = useRef(onNextPhase);
    nextPhaseRef.current = onNextPhase;

    // Chronicle scroll tracking (UX-04): entries render newest-first, so "new"
    // means "at the top." Auto-follow the top while the reader is already
    // there; once they've scrolled down to read older material, stop yanking
    // their position and surface a pill instead.
    const chronicleRef = useRef<HTMLDivElement>(null);
    const [scrolledAway, setScrolledAway] = useState(false);
    const prevLogCountRef = useRef(gameState.log.length);

    useEffect(() => {
        const el = chronicleRef.current;
        if (!el) return;
        const grew = gameState.log.length > prevLogCountRef.current;
        prevLogCountRef.current = gameState.log.length;
        if (grew && el.scrollTop <= 24) {
            el.scrollTop = 0;
        } else if (grew && el.scrollTop > 24) {
            setScrolledAway(true);
        }
    }, [gameState.log.length]);

    const jumpToLatest = () => {
        if (chronicleRef.current) chronicleRef.current.scrollTop = 0;
        setScrolledAway(false);
    };

    const aliveCount = gameState.tributes.filter(t => t.status === 'alive').length;
    const deadCount = gameState.tributes.length - aliveCount;
    const isOver = gameState.phase === 'ended';

    // The modal reads live tribute data instead of a snapshot captured on click,
    // so vitals keep updating while the simulation runs behind it.
    const selectedTribute = selectedTributeId
        ? gameState.tributes.find(t => t.id === selectedTributeId) ?? null
        : null;

    const mutedCategories = useMemo(() => {
        const muted = new Set<EventCategory>();
        CATEGORY_GROUPS.forEach(group => {
            if (mutedGroups.has(group.id)) group.categories.forEach(c => muted.add(c));
        });
        return muted;
    }, [mutedGroups]);

    // Auto-advance, paced by how much the phase just produced.
    const lastTickLogCount = useRef(gameState.log.length);
    useEffect(() => {
        if (speed === 'manual' || isOver) return;
        const newCount = Math.max(0, gameState.log.length - lastTickLogCount.current);
        const newLines = newCount > 0 ? gameState.log.slice(-newCount) : [];
        lastTickLogCount.current = gameState.log.length;
        if (pauseOnDeath && newLines.some(l => l.category === 'death' || l.category === 'kill')) {
            setSpeed('manual');
            return;
        }
        const timer = setTimeout(() => nextPhaseRef.current(), pacedDelay(speed, newCount));
        return () => clearTimeout(timer);
    }, [speed, isOver, pauseOnDeath, gameState.phase, gameState.day, gameState.log.length, gameState.log]);

    // Keyboard shortcuts: space advances, F toggles filters, M/C swap panes, Esc clears.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
            if (selectedTributeId) return;
            if (e.key === ' ' && !isOver) {
                e.preventDefault();
                onNextPhase();
            } else if (e.key.toLowerCase() === 'f') {
                setShowFilters(v => !v);
            } else if (e.key.toLowerCase() === 'm') {
                setTacticalTab(t => {
                    const next = t === 'map' ? 'chronicle' : 'map';
                    setMobilePane(next);
                    return next;
                });
            } else if (e.key === 'Escape') {
                setSelectedTributeId(null);
                setSelectedZone(null);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onNextPhase, isOver, selectedTributeId]);

    const filteredLogs = useMemo(() => {
        const needle = searchText.trim().toLowerCase();
        return gameState.log.filter(log => {
            if (importantOnly && !log.important) return false;
            if (selectedZone && log.zone !== selectedZone) return false;
            if (mutedCategories.has(log.category)) return false;
            if (filterTributeId && !log.tributesInvolved.includes(filterTributeId)) return false;
            if (needle && !log.text.toLowerCase().includes(needle)) return false;
            return true;
        });
    }, [gameState.log, importantOnly, selectedZone, mutedCategories, filterTributeId, searchText]);

    /** UX: the chronicle is the artefact people share — offer it as markdown. */
    const exportChronicle = (copy: boolean) => {
        const lines: string[] = [`# ${gameState.arena.name} — seed ${gameState.seed}`, ''];
        let lastDay = -1;
        filteredLogs.forEach(l => {
            if (l.day !== lastDay) {
                lastDay = l.day;
                lines.push('', l.day === 0 ? `## Before the Games` : `## Day ${l.day}`, '');
            }
            lines.push(`- ${l.important ? '**' : ''}${l.text}${l.important ? '**' : ''}`);
        });
        const text = lines.join('\n');
        if (copy && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text);
        } else {
            const blob = new Blob([text], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chronicle-${gameState.seed}.md`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    const sortedSidebarTributes = useMemo(() => [...gameState.tributes].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'alive' ? -1 : 1;
        if (a.status === 'alive') {
            if (a.allianceId && !b.allianceId) return -1;
            if (!a.allianceId && b.allianceId) return 1;
            if (a.allianceId && b.allianceId && a.allianceId !== b.allianceId) {
                return a.allianceId.localeCompare(b.allianceId);
            }
        }
        if (a.district !== b.district) return a.district - b.district;
        return a.gender.localeCompare(b.gender);
    }), [gameState.tributes]);

    // UX-08: the odds board runs live during the Games, not just before the gong.
    // Movement is measured against the previous phase's percentages.
    const prevOddsRef = useRef<Record<string, number>>({});
    const [oddsMovement, setOddsMovement] = useState<Record<string, number>>({});

    const oddsLadder = useMemo(() => {
        const alive = gameState.tributes.filter(t => t.status === 'alive');
        return alive
            .map(t => ({ tribute: t, ...tributeOdds(t, gameState.tributes) }))
            .sort((a, b) => b.pct - a.pct);
    }, [gameState.tributes]);

    useEffect(() => {
        const current: Record<string, number> = {};
        oddsLadder.forEach(({ tribute, pct }) => { current[tribute.id] = pct; });
        const movement: Record<string, number> = {};
        Object.keys(current).forEach(id => {
            const before = prevOddsRef.current[id];
            movement[id] = before === undefined ? 0 : current[id] - before;
        });
        setOddsMovement(movement);
        prevOddsRef.current = current;
        // Recomputed once per phase boundary, not on every render, so the arrows
        // describe the cycle just played rather than flickering to zero.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState.phase, gameState.day]);

    const allianceAccent = (allianceId?: string) => {
        if (!allianceId) return undefined;
        // Reuses the category palette so alliance colours read as part of the
        // same system as the chronicle feed, instead of clashing neon accents.
        const palette = ['#2f7a4f', '#2461a8', '#b3691b', '#5a3f9c', '#b23e78'];
        let hash = 0;
        for (let i = 0; i < allianceId.length; i++) {
            hash = allianceId.charCodeAt(i) + ((hash << 5) - hash);
        }
        return palette[Math.abs(hash) % palette.length];
    };

    const toggleGroup = (id: string) => setMutedGroups(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const phaseLabel = isOver
        ? 'The Games Have Ended'
        : gameState.day === 0
            ? gameState.phase.toUpperCase()
            : `Day ${gameState.day} — ${gameState.phase.toUpperCase()}`;

    const selectMobilePane = (pane: 'chronicle' | 'map' | 'tributes') => {
        setMobilePane(pane);
        if (pane === 'chronicle' || pane === 'map') setTacticalTab(pane);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-24 lg:pb-0">
            <div className={`lg:col-span-2 space-y-5 ${mobilePane === 'tributes' ? 'hidden lg:block' : ''}`}>
                {/* ---------- control deck ---------- */}
                <div className="panel p-5 space-y-4">
                    <div className="flex flex-wrap justify-between items-start gap-4 pb-3 border-b border-[var(--color-ink-800)]">
                        <div>
                            <h2 className="display-title text-2xl">{phaseLabel}</h2>
                            <p className="text-[var(--color-ink-400)] text-sm mt-0.5">{gameState.arena.name}</p>
                        </div>
                        {!isOver && (
                            <div className="flex items-center gap-2">
                                <button onClick={onRunToEnd} className="btn" title="Simulate the entire run at once">
                                    Run to End
                                </button>
                                <button onClick={onNextPhase} className="btn btn-primary" title="Advance one phase (Space)">
                                    Proceed <FastForward className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {!isOver && (
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                            <div className="flex items-center gap-2">
                                <span className="eyebrow">Sim speed</span>
                                <div className="seg">
                                    {(['manual', '1x', '5x', 'auto'] as const).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setSpeed(s)}
                                            aria-pressed={speed === s}
                                            className="seg-item"
                                        >
                                            {s === 'manual' ? <Pause className="w-3 h-3 inline" /> : s === 'auto' ? <Play className="w-3 h-3 inline" /> : null}
                                            <span className="ml-1">{s === 'manual' ? 'Manual' : s === 'auto' ? 'Max' : s}</span>
                                        </button>
                                    ))}
                                </div>
                                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] uppercase tracking-wider text-[var(--color-ink-500)]" title="Drop back to manual whenever a death lands, so auto-play cannot blow past the big moments">
                                    <input
                                        type="checkbox"
                                        checked={pauseOnDeath}
                                        onChange={e => setPauseOnDeath(e.target.checked)}
                                        className="accent-[var(--red)]"
                                    />
                                    Pause on deaths
                                </label>
                            </div>

                            <div className="seg">
                                <button onClick={() => selectMobilePane('chronicle')} aria-pressed={tacticalTab === 'chronicle'} className="seg-item">
                                    Chronicle
                                </button>
                                <button onClick={() => selectMobilePane('map')} aria-pressed={tacticalTab === 'map'} className="seg-item">
                                    Arena Map
                                </button>
                            </div>

                            <button onClick={() => setShowFilters(v => !v)} aria-pressed={showFilters} className="seg-item" title="Toggle filters (F)">
                                <Filter className="w-3 h-3 inline mr-1" /> Filters
                                {(mutedGroups.size > 0 || importantOnly || searchText || filterTributeId) && <span className="ml-1 text-[var(--red)]">•</span>}
                            </button>

                            <span className="ml-auto text-[10px] uppercase tracking-widest text-[var(--color-ink-600)] hidden md:inline">
                                Space · advance &nbsp; F · filters &nbsp; M · map
                            </span>
                        </div>
                    )}

                    {showFilters && (
                        <div className="panel-flush p-4 space-y-3 animate-fadeIn">
                            <label className="flex items-center gap-2 cursor-pointer w-fit">
                                <input
                                    type="checkbox"
                                    checked={importantOnly}
                                    onChange={e => setImportantOnly(e.target.checked)}
                                    className="w-4 h-4 accent-[var(--color-blood-500)] cursor-pointer"
                                />
                                <span className="eyebrow">Headline events only</span>
                            </label>
                            <div>
                                <div className="eyebrow mb-2">Event categories — click to mute</div>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORY_GROUPS.map(group => {
                                        const muted = mutedGroups.has(group.id);
                                        return (
                                            <button
                                                key={group.id}
                                                onClick={() => toggleGroup(group.id)}
                                                className={`chip ${muted ? 'opacity-40 line-through' : ''}`}
                                                title={group.categories.join(', ')}
                                            >
                                                <span className="flex gap-0.5">
                                                    {group.categories.slice(0, 4).map(c => (
                                                        <span key={c} className="legend-dot" style={{ ['--cat' as string]: `var(--cat-${c})` }} />
                                                    ))}
                                                </span>
                                                {group.label}
                                            </button>
                                        );
                                    })}
                                    {(mutedGroups.size > 0 || importantOnly || !!searchText || !!filterTributeId) && (
                                        <button
                                            onClick={() => { setMutedGroups(new Set()); setImportantOnly(false); setSearchText(''); setFilterTributeId(null); }}
                                            className="chip chip-accent"
                                        >
                                            Reset filters
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <input
                                    type="search"
                                    value={searchText}
                                    onChange={e => setSearchText(e.target.value)}
                                    placeholder="Search the chronicle…"
                                    className="field text-xs flex-1 min-w-[140px]"
                                />
                                <select
                                    value={filterTributeId ?? ''}
                                    onChange={e => setFilterTributeId(e.target.value || null)}
                                    className="field text-xs w-auto"
                                    title="Show only events involving one tribute"
                                >
                                    <option value="">All tributes</option>
                                    {sortedSidebarTributes.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} (D{t.district}){t.status === 'dead' ? ' †' : ''}</option>
                                    ))}
                                </select>
                                <button onClick={() => exportChronicle(true)} className="btn btn-sm" title="Copy the filtered chronicle as markdown">Copy MD</button>
                                <button onClick={() => exportChronicle(false)} className="btn btn-sm" title="Download the filtered chronicle as a markdown file">Download</button>
                            </div>
                            <div className="text-[10px] text-[var(--color-ink-500)]">
                                Showing {filteredLogs.length} of {gameState.log.length} logged events.
                            </div>
                        </div>
                    )}
                </div>

                {/* ---------- main pane ---------- */}
                {tacticalTab === 'map' ? (
                    <div className="panel p-5 space-y-4">
                        <ArenaMap
                            gameState={gameState}
                            selectedZone={selectedZone}
                            onSelectZone={setSelectedZone}
                            tributes={gameState.tributes}
                        />

                        {selectedZone ? (
                            <div className="panel-flush p-4 animate-fadeIn">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="panel-title text-[var(--red)]">Sector log — {selectedZone}</span>
                                    <button onClick={() => setSelectedZone(null)} className="btn btn-sm btn-ghost">Clear</button>
                                </div>
                                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                                    {filteredLogs.length === 0 ? (
                                        <div className="empty-state">{gameState.log.some(l => l.zone === selectedZone) ? 'Events in this sector are hidden by your current filters.' : 'Nothing has happened in this sector yet.'}</div>
                                    ) : (
                                        [...filteredLogs].reverse().map(l => <FeedLine key={l.id} log={l} cast={gameState.tributes} onSelectTribute={setSelectedTributeId} />)
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="empty-state">Select a sector above to isolate everything that happened there.</div>
                        )}
                    </div>
                ) : (
                    <div className="panel p-5 space-y-4 relative">
                        {selectedZone && (
                            <div className="flex justify-between items-center panel-flush px-3 py-2 text-xs text-[var(--red)]">
                                <span>Filtered to sector <strong>{selectedZone}</strong></span>
                                <button onClick={() => setSelectedZone(null)} className="btn btn-sm btn-ghost">Clear</button>
                            </div>
                        )}
                        {scrolledAway && (
                            <button
                                onClick={jumpToLatest}
                                className="chip chip-accent absolute top-3 right-5 z-10 shadow-[var(--shadow-ink-sm)]"
                            >
                                ↑ Jump to newest
                            </button>
                        )}
                        {gameState.day >= 2 && (
                            <div className="flex flex-wrap gap-1 items-center">
                                <span className="eyebrow mr-1">Jump to</span>
                                {Array.from(new Set(filteredLogs.map(l => l.day))).sort((a, b) => a - b).map(d => (
                                    <button
                                        key={d}
                                        className="chip"
                                        onClick={() => {
                                            const el = chronicleRef.current?.querySelector(`[data-day="${d}"]`);
                                            el?.scrollIntoView({ block: 'start' });
                                        }}
                                    >
                                        {d === 0 ? 'Pre' : `D${d}`}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div
                            ref={chronicleRef}
                            onScroll={(e) => setScrolledAway(e.currentTarget.scrollTop > 24)}
                            className="max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar"
                        >
                            {filteredLogs.length > 0 ? (
                                <EventFeed logs={filteredLogs} cast={gameState.tributes} onSelectTribute={setSelectedTributeId} />
                            ) : (
                                <div className="empty-state">
                                    {gameState.log.length === 0
                                        ? 'Nothing has happened yet. Hit Proceed to begin.'
                                        : 'Every logged event is hidden by your current filters.'}
                                </div>
                            )}
                        </div>
                        <div aria-live="polite" className="sr-only">
                            {filteredLogs.length > 0 ? filteredLogs[filteredLogs.length - 1].text : ''}
                        </div>
                    </div>
                )}
            </div>

            {/* ---------- sidebar ---------- */}
            <div className={`space-y-5 ${mobilePane === 'tributes' ? '' : 'hidden lg:block'}`}>
                <div className="panel p-4">
                    <h3 className="panel-title mb-3">Status</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="stat-tile">
                            <div className="text-3xl font-black text-[var(--ink)]">{aliveCount}</div>
                            <div className="eyebrow mt-1">Alive</div>
                        </div>
                        <div className="stat-tile">
                            <div className="text-3xl font-black text-[var(--red)]">{deadCount}</div>
                            <div className="eyebrow mt-1">Fallen</div>
                        </div>
                    </div>
                    {gameState.gamesProfile && (
                        <p className="text-[11px] text-[var(--color-ink-500)] mt-3" title={gameState.gamesProfile.temperament.blurb}>
                            <span className="text-[var(--ink)] font-semibold">
                                {ordinal(gameState.gamesProfile.gamesNumber)} Games
                            </span>
                            {' — '}{gameState.gamesProfile.temperament.name}
                            {gameState.gamesProfile.wildcard.kind !== 'nothing' && (
                                <span title={gameState.gamesProfile.wildcard.announcement}>
                                    , with {gameState.gamesProfile.wildcard.name}
                                    {gameState.gamesProfile.wildcard.day > 0
                                        ? ` on day ${gameState.gamesProfile.wildcard.day}`
                                        : ''}
                                </span>
                            )}
                        </p>
                    )}
                    {gameState.headGamemaker && (
                        <p className="text-[11px] text-[var(--color-ink-500)] mt-2" title="Chosen at the reaping. Their patience and their hazard appetite shape the whole run.">
                            Head Gamemaker: <span className="text-[var(--ink)] font-semibold">{gameState.headGamemaker}</span>
                        </p>
                    )}
                    {gameState.audienceInterest !== undefined && (
                        <Explainer
                            align="left"
                            label={
                                <div className="stat-tile mt-3 w-full text-left">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="eyebrow">Audience interest</span>
                                        <span
                                            className="text-lg font-black"
                                            style={{ color: gameState.audienceInterest < ESCALATION.boredomThreshold ? 'var(--red)' : 'var(--ink)' }}
                                        >
                                            {gameState.audienceInterest}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-[var(--color-ink-500)] mt-1">
                                        {gameState.escalationDay !== undefined
                                            ? `Arena closing since day ${gameState.escalationDay}`
                                            : gameState.audienceInterest < ESCALATION.boredomThreshold
                                                ? 'The Capitol is losing patience'
                                                : 'The Capitol is entertained'}
                                    </div>
                                </div>
                            }
                            title="Audience interest"
                        >
                            The average excitement the living field is generating. The Gamemakers are not working
                            to a timetable — they escalate because the feed has gone quiet. If this falls below{' '}
                            {ESCALATION.boredomThreshold} the border starts closing early, herding whoever is left
                            toward each other with fire, mutts and a shrinking arena.
                        </Explainer>
                    )}
                </div>

                {!isOver && oddsLadder.length > 1 && (
                    <div className="panel p-4">
                        <h3 className="panel-title mb-1">Live odds</h3>
                        <p className="text-[10px] text-[var(--color-ink-500)] mb-3">
                            Survival chance and movement since the last phase.
                        </p>
                        {Object.keys(bets).length > 0 && (
                            <div className="panel-flush p-2 mb-2 space-y-0.5">
                                {Object.entries(bets).map(([id, bet]) => {
                                    const t = gameState.tributes.find(o => o.id === id);
                                    if (!t) return null;
                                    const live = oddsLadder.find(o => o.tribute.id === id);
                                    return (
                                        <div key={id} className={`text-[10px] font-mono flex justify-between gap-2 ${t.status === 'dead' ? 'line-through text-[var(--color-ink-500)]' : 'text-[var(--color-ink-200)]'}`}>
                                            <span className="truncate">You hold {bet.stake} on {t.name} @ {bet.mult.toFixed(1)}×</span>
                                            <span className="flex-none">
                                                {t.status === 'dead'
                                                    ? 'lost'
                                                    : live
                                                        ? `now ${live.mult.toFixed(1)}×`
                                                        : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div className="space-y-1 max-h-64 overflow-y-auto pr-1.5 custom-scrollbar">
                            {oddsLadder.slice(0, 10).map(({ tribute, pct, mult }, i) => {
                                const move = oddsMovement[tribute.id] ?? 0;
                                const MoveIcon = move > 0 ? TrendingUp : move < 0 ? TrendingDown : Minus;
                                const moveColor = move > 0 ? 'var(--cat-alliance)' : move < 0 ? 'var(--cat-death)' : 'var(--color-ink-500)';
                                return (
                                    <button
                                        key={tribute.id}
                                        onClick={() => setSelectedTributeId(tribute.id)}
                                        className="w-full text-left flex items-center gap-2 px-1.5 py-1 hover:bg-[var(--paper-flush)] transition-colors"
                                        title={`${tribute.name} — ${pct}% survival chance, ${mult.toFixed(1)}× payout`}
                                    >
                                        <span className="font-mono text-[10px] text-[var(--color-ink-500)] w-4 flex-none">{i + 1}</span>
                                        <span className="text-xs font-bold text-[var(--color-ink-100)] truncate flex-1 min-w-0">
                                            {tribute.name}
                                            {bets[tribute.id] && <span className="ml-1 text-[var(--red)]" title={`Your wager: ${bets[tribute.id].stake} coins at ${bets[tribute.id].mult.toFixed(1)}×`}>●</span>}
                                        </span>
                                        <span className="font-mono text-[11px] font-bold text-[var(--ink)] flex-none">{pct}%</span>
                                        <span className="flex items-center gap-0.5 font-mono text-[10px] flex-none w-10 justify-end" style={{ color: moveColor }}>
                                            <MoveIcon className="w-3 h-3" />
                                            {move !== 0 && (move > 0 ? `+${move}` : move)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {gameState.gamemakerMode && !isOver && (
                    <div className="panel p-4 space-y-3" style={{ borderColor: 'var(--red)', borderWidth: '3px' }}>
                        <h3 className="panel-title text-[var(--red)] flex items-center gap-2">
                            <Settings className="w-3.5 h-3.5" /> Gamemaker Controls
                        </h3>
                        <div className="space-y-1">
                            <label className="eyebrow" htmlFor="mutt-target">Mutt target</label>
                            <select
                                id="mutt-target"
                                value={muttTargetId}
                                onChange={e => setMuttTargetId(e.target.value)}
                                className="field text-xs"
                            >
                                <option value="">Random tribute</option>
                                {gameState.tributes.filter(t => t.status === 'alive').map(t => (
                                    <option key={t.id} value={t.id}>{t.name} (D{t.district})</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => { onGamemakerEvent('mutt', muttTargetId || undefined); setMuttTargetId(''); }}
                            className="btn w-full"
                        >
                            <Skull className="w-4 h-4 text-[var(--red)]" /> Release Mutts
                        </button>
                        <button onClick={() => onGamemakerEvent('weather')} className="btn w-full">Force Weather Event</button>
                        <button
                            onClick={() => onGamemakerEvent('feast')}
                            className="btn w-full"
                            disabled={!gameState.config.enableFeast}
                            title={gameState.config.enableFeast ? 'Call a feast at the Cornucopia' : 'Feasts are disabled in this run\'s settings'}
                        >
                            Announce Feast
                        </button>
                    </div>
                )}

                <div className="panel p-4">
                    <h3 className="panel-title mb-1">Tributes</h3>
                    {!isOver && (
                        <p className="text-[10px] text-[var(--color-ink-500)] mb-3">
                            Open any living tribute to send a sponsor parachute — Capitol Coins buy water, medicine and steel mid-run.
                        </p>
                    )}
                    <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1.5 custom-scrollbar">
                        {sortedSidebarTributes.map(t => {
                            const accent = t.status === 'alive' ? allianceAccent(t.allianceId) : undefined;
                            const dead = t.status === 'dead';
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setSelectedTributeId(t.id)}
                                    className={`w-full text-left panel-flush p-2.5 flex flex-col gap-2 transition-colors hover:border-[var(--color-ink-600)] ${dead ? 'opacity-50' : ''}`}
                                    style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
                                    title={dead ? `${t.name} — deceased` : `${t.name} — open profile`}
                                >
                                    <div className="flex justify-between items-center w-full gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`font-bold text-sm truncate ${dead ? 'line-through text-[var(--color-ink-500)]' : 'text-[var(--color-ink-100)]'}`}>
                                                    {t.name}
                                                </span>
                                                <span
                                                    className="chip"
                                                    title={`District ${t.district} · ${t.gender} · age ${t.age}`}
                                                >
                                                    D{t.district}·{t.gender === 'Male' ? 'M' : 'F'}
                                                </span>
                                                {!dead && t.allianceId && (
                                                    <span className="chip" style={accent ? { color: accent, borderColor: accent } : undefined}>
                                                        <Users className="w-2.5 h-2.5" /> Pack
                                                    </span>
                                                )}
                                                {!dead && !isOver && (t.injuries.bleeding || t.vitals.thirst > 70 || !t.inventory.some(i => i.type === 'weapon')) && (
                                                    <span
                                                        className="chip"
                                                        style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                                                        title={`${t.name} ${t.injuries.bleeding ? 'is bleeding' : t.vitals.thirst > 70 ? 'is badly dehydrated' : 'is unarmed'} — a sponsor parachute would fix this. Open their profile to send one.`}
                                                    >
                                                        🪂 Needs aid
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink-500)] flex flex-wrap gap-2 mt-1">
                                                {dead ? (
                                                    <span className="truncate">Day {t.dayOfDeath ?? '—'} · {t.causeOfDeath ?? 'Eliminated'}</span>
                                                ) : (
                                                    <>
                                                        <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-[var(--cat-death)]" /> {t.health}</span>
                                                        <span className="flex items-center gap-1"><Swords className="w-3 h-3" /> {t.kills}</span>
                                                        <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 text-[var(--cat-travel)]" /> {t.zone}</span>
                                                        {/* What they are actually trying to do, so the sidebar
                                                            explains the movement instead of just reporting it. */}
                                                        <span className="w-full truncate text-[var(--red)]">{objectiveLabel(gameState, t)}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {dead && <Skull className="w-4 h-4 text-[var(--color-ink-600)] flex-none" />}
                                    </div>

                                    {!dead && (
                                        <div className="meter">
                                            <span
                                                style={{
                                                    width: `${t.health}%`,
                                                    background: t.health >= 70 ? 'var(--cat-alliance)' : t.health >= 35 ? 'var(--cat-training)' : 'var(--cat-death)',
                                                }}
                                            />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--ink)] border-t-[3px] border-[var(--red)] flex items-stretch">
                {([
                    { id: 'chronicle', label: 'Chronicle' },
                    { id: 'map', label: 'Map' },
                    { id: 'tributes', label: `Tributes ${aliveCount}` },
                ] as const).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => selectMobilePane(tab.id)}
                        aria-pressed={mobilePane === tab.id}
                        className="flex-1 py-3 text-[10px] font-extrabold uppercase tracking-[0.1em]"
                        style={{ fontFamily: 'var(--font-mono)', color: mobilePane === tab.id ? 'var(--red)' : '#a89a86' }}
                    >
                        {tab.label}
                    </button>
                ))}
                {!isOver && (
                    <button onClick={onNextPhase} className="flex-none px-5 bg-[var(--red)] text-white text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ fontFamily: 'var(--font-mono)' }}>
                        Proceed
                    </button>
                )}
            </nav>

            {selectedTribute && (
                <TributeModal tribute={selectedTribute} gameState={gameState} onClose={() => setSelectedTributeId(null)} />
            )}
        </div>
    );
}
