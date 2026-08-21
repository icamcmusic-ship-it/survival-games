import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EventCategory, GameState } from '../models/types';
import { ArenaMap } from '../components/ArenaMap';
import { TributeModal } from '../components/TributeModal';
import { EventFeed, FeedLine, VISIBLE_CAP } from '../components/EventFeed';
import { ChronicleExport } from '../components/ChronicleExport';
import { CATEGORY_GROUPS } from '../ui/eventStyles';
import { tributeOdds } from '../engine/odds';
import { objectiveLabel } from '../engine/objectives';
import { Skull, Heart, Settings, FastForward, MapPin, Users, Swords, Filter, Play, Pause, TrendingUp, TrendingDown, Minus, Undo2 } from 'lucide-react';
import { ESCALATION, GAMEMAKER_COSTS } from '../data/balance';
import { evaluateInRunNearMisses } from '../data/achievements';
import { GamemakerEventType } from '../engine/gamemaker';
import { Explainer } from '../components/Explainer';
import { ordinal } from '../engine/gamesProfile';
import { gameActions, gameStore } from '../store/gameStore';
import { readFilters, writeFilters } from '../utils/prefsStorage';

import { useStore } from '../store/createStore';

type Speed = 'manual' | '1x' | '5x' | 'auto';

/**
 * Chronicle filter preferences persist, like the setup config already does —
 * a reader who mutes the ambient chatter every run should not have to do it
 * again every run.
 */
const readStoredFilters = readFilters;

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
    onGamemakerEvent: (type: GamemakerEventType, targetId?: string) => void,
}) {
    const storedFilters = useRef(readStoredFilters());
    const [selectedTributeId, setSelectedTributeId] = useState<string | null>(null);
    const [speed, setSpeed] = useState<Speed>('manual');
    const [importantOnly, setImportantOnly] = useState(storedFilters.current.importantOnly);
    const [muttTargetId, setMuttTargetId] = useState('');
    const [gmZone, setGmZone] = useState('');
    const coins = useStore(gameStore, s => s.coins);
    // Non-null only while Run to End is fast-forwarding; drives the progress
    // readout and swaps the button for a working Cancel.
    const runProgress = useStore(gameStore, s => s.runProgress);
    // U-1: restore points behind the play head, for the step-back control.
    const rewindPoints = useStore(gameStore, s => s.rewindPoints);
    const [showRewind, setShowRewind] = useState(false);
    const spendGamemaker = (type: GamemakerEventType, cost: number, targetId?: string) => {
        if (coins < cost) return;
        gameActions.setCoins(c => c - cost);
        onGamemakerEvent(type, targetId);
    };
    const [tacticalTab, setTacticalTab] = useState<'chronicle' | 'map'>('chronicle');
    const [selectedZone, setSelectedZone] = useState<string | null>(null);
    // Below `lg` the two columns stack, which buried the tribute list under a
    // full-height feed. On small screens one pane shows at a time, chosen from a
    // bottom tab bar (UX-12); at `lg` and up both columns render as before.
    const [mobilePane, setMobilePane] = useState<'chronicle' | 'map' | 'tributes'>('chronicle');
    // Which of the sidebar's modules is showing, below `lg` only.
    const [sidebarPane, setSidebarPane] = useState<'status' | 'odds' | 'tributes'>('status');
    const [mutedGroups, setMutedGroups] = useState<Set<string>>(() => new Set(storedFilters.current.mutedGroups));
    const [showFilters, setShowFilters] = useState(false);
    // UX: auto-play at 5x/Skip blows straight past major deaths; opt-in brake.
    const [pauseOnDeath, setPauseOnDeath] = useState(storedFilters.current.pauseOnDeath);
    /** A toast explaining why auto-advance just stopped. */
    const [pauseNotice, setPauseNotice] = useState(false);
    const bets = useStore(gameStore, s => s.bets);
    // §6.5: achievements the run is close to, shown while they still matter.
    const panem = useStore(gameStore, s => s.panem);
    const nearMisses = useMemo(
        () => evaluateInRunNearMisses(gameState, panem?.unlocked ?? []),
        [gameState, panem]
    );
    // Chronicle search and per-tribute filtering.
    const [searchText, setSearchText] = useState('');
    const [filterTributeId, setFilterTributeId] = useState<string | null>(null);
    // U-2: structured filters — a second tribute (OR semantics, so "every
    // kill involving Cato or Clove" is expressible) and a specific day.
    const [filterTributeId2, setFilterTributeId2] = useState<string | null>(null);
    const [filterDay, setFilterDay] = useState<number | null>(null);
    // Keyboard help was a single hidden line, desktop-only (md:inline), which is
    // no help at all on the devices that most need it explained.
    const [showHelp, setShowHelp] = useState(false);
    const nextPhaseRef = useRef(onNextPhase);
    nextPhaseRef.current = onNextPhase;

    // Chronicle scroll tracking (UX-04): entries render newest-first, so "new"
    // means "at the top." Auto-follow the top while the reader is already
    // there; once they've scrolled down to read older material, stop yanking
    // their position and surface a pill instead.
    const chronicleRef = useRef<HTMLDivElement>(null);
    /** Where the [ / ] day-jump last landed, so repeats step rather than restart. */
    const currentDayInViewRef = useRef<number | null>(null);
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

    useEffect(() => {
        // Storage failures are absorbed — the preference simply won't be remembered.
        writeFilters({ mutedGroups: [...mutedGroups], importantOnly, pauseOnDeath });
    }, [mutedGroups, importantOnly, pauseOnDeath]);

    // Auto-advance, paced by how much the phase just produced.
    const lastTickLogCount = useRef(gameState.log.length);
    useEffect(() => {
        // A fast-forward is already stepping the simulator; auto-advance must
        // not interleave with it.
        if (speed === 'manual' || isOver || runProgress) return;
        const newCount = Math.max(0, gameState.log.length - lastTickLogCount.current);
        const newLines = newCount > 0 ? gameState.log.slice(-newCount) : [];
        lastTickLogCount.current = gameState.log.length;
        if (pauseOnDeath && newLines.some(l => l.category === 'death' || l.category === 'kill')) {
            setSpeed('manual');
            // Without an explanation the silent drop to manual reads as the
            // auto-advance breaking, especially to a first-time player.
            setPauseNotice(true);
            return;
        }
        const timer = setTimeout(() => nextPhaseRef.current(), pacedDelay(speed, newCount));
        return () => clearTimeout(timer);
    }, [speed, isOver, pauseOnDeath, runProgress, gameState.phase, gameState.day, gameState.log.length, gameState.log]);

    /**
     * §2.3: the keyboard path covered five keys — advance, filters, map, help,
     * close — while everything the eye can reach (sector filter, tribute
     * filter, day jump, category mutes, auto-advance) was mouse-only. The set
     * below covers those, and every key in it is listed in the help panel.
     *
     * Rules the whole set obeys: nothing fires while a text field or a select
     * has focus, nothing fires while the tribute modal is open, and nothing
     * binds a modifier — Ctrl/Cmd/Alt combinations belong to the browser.
     */
    const shortcutHintRef = useRef<HTMLDivElement>(null);
    const announceShortcut = (message: string) => {
        // Spoken, not drawn: the visible state (a chip, a highlighted sector)
        // already shows sighted users what changed.
        if (shortcutHintRef.current) shortcutHintRef.current.textContent = message;
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (selectedTributeId) return;

            // The help panel is modal: only the keys that close it respond.
            if (showHelp && e.key !== 'Escape' && e.key !== '?') return;

            const zones = gameState.arena.zones.map(z => z.name);
            const cycle = <T,>(list: T[], current: T | null, step: number): T | null => {
                if (list.length === 0) return null;
                if (current === null) return step > 0 ? list[0] : list[list.length - 1];
                const at = list.indexOf(current);
                const next = at + step;
                // Falling off either end clears the filter, so every cycle has
                // a way back to "everything" without reaching for the mouse.
                if (at === -1) return list[0];
                return next < 0 || next >= list.length ? null : list[next];
            };
            const days = [...new Set(gameState.log.map(l => l.day))].sort((a, b) => a - b);
            const jumpDay = (step: number) => {
                if (days.length === 0) return;
                setTacticalTab('chronicle');
                setMobilePane('chronicle');
                const currentDay = currentDayInViewRef.current ?? days[days.length - 1];
                const at = days.indexOf(currentDay);
                const target = days[Math.min(days.length - 1, Math.max(0, (at === -1 ? days.length - 1 : at) + step))];
                currentDayInViewRef.current = target;
                requestAnimationFrame(() => {
                    const el = chronicleRef.current?.querySelector(`[data-day="${target}"]`);
                    el?.scrollIntoView({ block: 'start' });
                });
                announceShortcut(target === 0 ? 'Jumped to before the Games' : `Jumped to day ${target}`);
            };

            const key = e.key;
            const lower = key.toLowerCase();

            // Space stays inert while Run to End is fast-forwarding — a
            // stray advance mid-fast-forward double-steps the simulator.
            if (key === ' ' && !isOver && !runningRef.current) {
                e.preventDefault();
                onNextPhase();
            } else if (key === 'Backspace' && !isOver && !runningRef.current) {
                // U-1: step the board back one position.
                e.preventDefault();
                const points = gameStore.getState().rewindPoints;
                if (points.length === 0) {
                    announceShortcut('Nothing to step back to');
                } else {
                    announceShortcut(`Stepped back to ${points[points.length - 1].label}`);
                    gameActions.stepBack();
                }
            } else if (lower === 'f') {
                setShowFilters(v => !v);
            } else if (lower === 'm') {
                setTacticalTab(t => {
                    const next = t === 'map' ? 'chronicle' : 'map';
                    setMobilePane(next);
                    return next;
                });
            } else if (key === '?') {
                setShowHelp(v => !v);
            } else if (key === 'Escape') {
                setShowHelp(false);
                setSelectedTributeId(null);
                setSelectedZone(null);
            } else if (lower === 'z') {
                setSelectedZone(z => {
                    const next = cycle(zones, z, e.shiftKey ? -1 : 1);
                    announceShortcut(next ? `Sector filter: ${next}` : 'Sector filter cleared');
                    return next;
                });
            } else if (lower === 't') {
                const ids = sortedSidebarTributes.map(t => t.id);
                setFilterTributeId(current => {
                    const next = cycle(ids, current, e.shiftKey ? -1 : 1);
                    const name = next ? sortedSidebarTributes.find(t => t.id === next)?.name : null;
                    announceShortcut(name ? `Tribute filter: ${name}` : 'Tribute filter cleared');
                    return next;
                });
            } else if (key === '[') {
                jumpDay(-1);
            } else if (key === ']') {
                jumpDay(1);
            } else if (key === 'i') {
                setImportantOnly(v => {
                    announceShortcut(v ? 'Showing every event' : 'Showing headline events only');
                    return !v;
                });
            } else if (key === 'p' && !isOver) {
                setSpeed(s => {
                    const next = s === 'manual' ? '1x' : 'manual';
                    announceShortcut(next === 'manual' ? 'Auto-advance paused' : 'Auto-advance running');
                    setPauseNotice(false);
                    return next;
                });
            } else if (key >= '1' && key <= String(Math.min(9, CATEGORY_GROUPS.length))) {
                const group = CATEGORY_GROUPS[Number(key) - 1];
                if (group) {
                    toggleGroup(group.id);
                    announceShortcut(`${group.label} events ${mutedGroups.has(group.id) ? 'unmuted' : 'muted'}`);
                }
            } else if (key === '0') {
                setMutedGroups(new Set());
                setImportantOnly(false);
                setSearchText('');
                setFilterTributeId(null);
                setSelectedZone(null);
                announceShortcut('All chronicle filters reset');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onNextPhase, isOver, selectedTributeId, showHelp, gameState, mutedGroups]);

    // A run left fast-forwarding when this screen goes away would otherwise
    // keep stepping a simulator nobody is watching.
    const runningRef = useRef(false);
    runningRef.current = !!runProgress;
    useEffect(() => () => gameActions.cancelRunToEnd(), []);

    const filteredLogs = useMemo(() => {
        const needle = searchText.trim().toLowerCase();
        return gameState.log.filter(log => {
            if (importantOnly && !log.important) return false;
            if (selectedZone && log.zone !== selectedZone) return false;
            if (mutedCategories.has(log.category)) return false;
            // Two tribute filters combine as OR: "everything involving A or B".
            if ((filterTributeId || filterTributeId2)
                && !(filterTributeId && log.tributesInvolved.includes(filterTributeId))
                && !(filterTributeId2 && log.tributesInvolved.includes(filterTributeId2))) return false;
            if (filterDay !== null && log.day !== filterDay) return false;
            if (needle && !log.text.toLowerCase().includes(needle)) return false;
            return true;
        });
    }, [gameState.log, importantOnly, selectedZone, mutedCategories, filterTributeId, filterTributeId2, filterDay, searchText]);

    /**
     * PERF: the sector log is newest-first and capped, like the main chronicle.
     *
     * It used to do `[...filteredLogs].reverse().map(...)` inline in JSX — a
     * full copy and reverse of an unbounded array on every render, i.e. on
     * every tick of auto-play. Now it slices the tail first (so the copy is
     * bounded by `VISIBLE_CAP`, matching `EventFeed`) and memoises the result.
     */
    const sectorLogRows = useMemo(
        () => filteredLogs.slice(Math.max(0, filteredLogs.length - VISIBLE_CAP)).reverse(),
        [filteredLogs],
    );

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
    const [oddsExpanded, setOddsExpanded] = useState(false);

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

    // Reuses the category palette so alliance colours read as part of the same
    // system as the chronicle feed, instead of clashing neon accents.
    //
    // Assigned by position among the alliances actually standing, not hashed
    // from the id: a hash can and does collide, and two concurrent alliances
    // rendering in the same colour is worse than either of them being a colour
    // the player did not expect. Falls back to the hash only past the palette.
    const allianceColours = useMemo(() => {
        const palette = ['#2f7a4f', '#2461a8', '#b3691b', '#5a3f9c', '#b23e78', '#1f7a78'];
        const ids = [...new Set(
            gameState.tributes.filter(t => t.status === 'alive' && t.allianceId).map(t => t.allianceId!)
        )].sort();
        const map: Record<string, string> = {};
        ids.forEach((id, i) => { map[id] = palette[i % palette.length]; });
        return map;
    }, [gameState.tributes]);

    const allianceAccent = (allianceId?: string) => (allianceId ? allianceColours[allianceId] : undefined);

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

    /** The newest headline line, and nothing else — see the live regions below. */
    const latestHeadline = useMemo(() => {
        for (let i = gameState.log.length - 1; i >= 0; i--) {
            const line = gameState.log[i];
            if (line.important && line.category !== 'death' && line.category !== 'kill') return line.text;
        }
        return '';
    }, [gameState.log]);

    /** Phase changes and the latest death: the two things worth interrupting for. */
    const urgentAnnouncement = useMemo(() => {
        const lastDeath = [...gameState.log]
            .reverse()
            .find(l => l.day === gameState.day && (l.category === 'death' || l.category === 'kill'));
        return `${phaseLabel}.${lastDeath ? ` ${lastDeath.text}` : ''}`;
    }, [phaseLabel, gameState.log, gameState.day]);

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
                                {runProgress ? (
                                    <>
                                        <div
                                            className="text-[10px] uppercase tracking-wider text-[var(--color-ink-500)] font-mono text-right leading-tight"
                                            role="status"
                                            aria-live="polite"
                                        >
                                            <div>Simulating — {runProgress.day === 0 ? runProgress.phase : `Day ${runProgress.day} · ${runProgress.phase}`}</div>
                                            <div>{runProgress.tributesAlive} alive · {runProgress.logLines} lines</div>
                                            {runProgress.wagered?.length > 0 && (
                                                <div aria-live="polite">
                                                    {runProgress.wagered.map(w => (
                                                        <span key={w.name} className={`mr-2 ${w.alive ? '' : 'line-through opacity-60'}`}>
                                                            {w.alive ? '● ' : '† '}{w.name} (D{w.district})
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => gameActions.cancelRunToEnd()} className="btn" title="Stop the fast-forward and keep what has happened so far">
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={onRunToEnd} className="btn" title="Simulate the entire run at once">
                                        Run to End
                                    </button>
                                )}
                                {/* U-1: the board could not be put back — an
                                    unattended skip past a moment you wanted to
                                    read was unrecoverable. */}
                                <div className="relative">
                                    <button
                                        onClick={() => gameActions.stepBack()}
                                        className="btn"
                                        disabled={!!runProgress || rewindPoints.length === 0}
                                        aria-disabled={!!runProgress || rewindPoints.length === 0}
                                        title={rewindPoints.length === 0
                                            ? 'Nothing to step back to yet'
                                            : `Step back to ${rewindPoints[rewindPoints.length - 1].label} (Backspace)`}
                                    >
                                        <Undo2 className="w-4 h-4" /> Back
                                    </button>
                                    {rewindPoints.length > 1 && (
                                        <button
                                            onClick={() => setShowRewind(v => !v)}
                                            className="btn btn-sm btn-ghost ml-1"
                                            aria-expanded={showRewind}
                                            title="Rewind further back"
                                        >
                                            ⌄
                                        </button>
                                    )}
                                    {showRewind && (
                                        <div className="absolute right-0 top-full mt-1 z-20 panel p-2 space-y-1 max-h-64 overflow-y-auto custom-scrollbar min-w-[190px]">
                                            {[...rewindPoints].reverse().map(p => (
                                                <button
                                                    key={p.index}
                                                    onClick={() => { gameActions.rewindTo(p.index); setShowRewind(false); }}
                                                    className="btn btn-sm btn-ghost w-full justify-between"
                                                    title={`Rewind to ${p.label} — discards ${gameState.log.length - p.logLength} chronicle entries`}
                                                >
                                                    <span>{p.label}</span>
                                                    <span className="font-mono text-[10px] text-[var(--color-ink-500)]">
                                                        −{gameState.log.length - p.logLength}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button onClick={onNextPhase} className="btn btn-primary" disabled={!!runProgress} title="Advance one phase (Space)">
                                    Proceed <FastForward className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {!isOver && (
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                            {/* flex-wrap: the speed segment plus the "pause on
                                deaths" checkbox is wider than a phone, and the
                                row used to push the whole page sideways. */}
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="eyebrow">Sim speed</span>
                                <div className="seg">
                                    {(['manual', '1x', '5x', 'auto'] as const).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => { setSpeed(s); setPauseNotice(false); }}
                                            aria-pressed={speed === s}
                                            className="seg-item"
                                        >
                                            {s === 'manual' ? <Pause className="w-3 h-3 inline" /> : s === 'auto' ? <Play className="w-3 h-3 inline" /> : null}
                                            {/* "1x / 5x / auto" told the player nothing about pace; these read as what they do. */}
                                            <span className="ml-1">{s === 'manual' ? 'Manual' : s === '1x' ? 'Read' : s === '5x' ? 'Skim' : 'Skip'}</span>
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
                                {pauseNotice && (
                                    <span role="status" aria-live="polite" className="text-[10px] uppercase tracking-wider text-[var(--red)] font-bold">
                                        A cannon fired — auto-advance paused.
                                        <button className="underline ml-1.5" onClick={() => setPauseNotice(false)}>Dismiss</button>
                                    </span>
                                )}
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
                                {(mutedGroups.size > 0 || importantOnly || searchText || filterTributeId || filterTributeId2 || filterDay !== null) && <span className="ml-1 text-[var(--red)]">•</span>}
                            </button>

                            <button
                                onClick={() => setShowHelp(true)}
                                className="seg-item ml-auto"
                                title="Keyboard shortcuts and what the panels mean (?)"
                                aria-haspopup="dialog"
                            >
                                ? Help
                            </button>
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
                                                aria-pressed={muted}
                                                aria-label={`${muted ? 'Unmute' : 'Mute'} ${group.label.toLowerCase()} events (${group.categories.join(', ')})`}
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
                                    {(mutedGroups.size > 0 || importantOnly || !!searchText || !!filterTributeId || !!filterTributeId2 || filterDay !== null) && (
                                        <button
                                            onClick={() => { setMutedGroups(new Set()); setImportantOnly(false); setSearchText(''); setFilterTributeId(null); setFilterTributeId2(null); setFilterDay(null); }}
                                            className="chip chip-accent"
                                        >
                                            Reset filters
                                        </button>
                                    )}
                                </div>
                            </div>
                            <ChronicleExport gameState={gameState} importantOnly={importantOnly} />
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
                                <select
                                    value={filterTributeId2 ?? ''}
                                    onChange={e => setFilterTributeId2(e.target.value || null)}
                                    className="field text-xs w-auto"
                                    title="Or a second tribute — events involving either are shown"
                                    aria-label="Or a second tribute — events involving either are shown"
                                >
                                    <option value="">…or anyone</option>
                                    {sortedSidebarTributes.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} (D{t.district}){t.status === 'dead' ? ' †' : ''}</option>
                                    ))}
                                </select>
                                <select
                                    value={filterDay === null ? '' : String(filterDay)}
                                    onChange={e => setFilterDay(e.target.value === '' ? null : Number(e.target.value))}
                                    className="field text-xs w-auto"
                                    title="Show only one day's events"
                                    aria-label="Show only one day's events"
                                >
                                    <option value="">All days</option>
                                    {[...new Set(gameState.log.map(l => l.day))].sort((a, b) => a - b).map(d => (
                                        <option key={d} value={d}>{d === 0 ? 'Before the Games' : `Day ${d}`}</option>
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
                                        <>
                                            {sectorLogRows.map(l => <FeedLine key={l.id} log={l} cast={gameState.tributes} onSelectTribute={setSelectedTributeId} />)}
                                            {filteredLogs.length > sectorLogRows.length && (
                                                <div className="text-[10px] text-[var(--color-ink-500)] pt-1">
                                                    Showing the most recent {sectorLogRows.length} of {filteredLogs.length} matching events — open the Chronicle tab for the full record.
                                                </div>
                                            )}
                                        </>
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
                                        aria-label={d === 0 ? 'Jump to before the Games' : `Jump to day ${d}`}
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
                    </div>
                )}
            </div>

            {/* ---------- sidebar ---------- */}
            <div className={`space-y-5 ${mobilePane === 'tributes' ? '' : 'hidden lg:block'}`}>
                {/* Below `lg` this column carried the odds ladder, the run status,
                    the Gamemaker controls and the full tribute list stacked into a
                    single scrolling pane — four unrelated modules behind one tab.
                    On mobile they are separate; at `lg` and up every panel renders
                    as before. */}
                <div className="seg lg:hidden w-full">
                    {([
                        { id: 'status', label: 'Status' },
                        { id: 'odds', label: 'Odds' },
                        { id: 'tributes', label: 'Tributes' },
                    ] as const).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSidebarPane(tab.id)}
                            aria-pressed={sidebarPane === tab.id}
                            className="seg-item flex-1"
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className={`panel p-4 ${sidebarPane === 'status' ? '' : 'hidden lg:block'}`}>
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
                    {nearMisses.length > 0 && (
                        <div className="mt-3 space-y-1" title="Achievements this run is close to earning">
                            {nearMisses.map(m => (
                                <p key={m.id} className="text-[11px] text-[var(--color-ink-500)]">
                                    <span className="text-[var(--ink)] font-semibold">{m.name}</span>
                                    {' — '}{m.detail}
                                </p>
                            ))}
                        </div>
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
                    <div className={`panel p-4 ${sidebarPane === 'odds' ? '' : 'hidden lg:block'}`}>
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
                            {(oddsExpanded ? oddsLadder : oddsLadder.slice(0, 10)).map(({ tribute, pct, mult }, i) => {
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
                            {oddsLadder.length > 10 && (
                                <button
                                    onClick={() => setOddsExpanded(v => !v)}
                                    className="btn btn-sm btn-ghost w-full justify-center"
                                >
                                    {oddsExpanded ? 'Show top 10' : `Show all ${oddsLadder.length}`}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {gameState.gamemakerMode && !isOver && (
                    <div
                        className={`panel p-4 space-y-3 ${sidebarPane === 'status' ? '' : 'hidden lg:block'}`}
                        style={{ borderColor: 'var(--red)', borderWidth: '3px' }}
                    >
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

                        {/* §6.4: the engine already supported zone effects, severed
                            routes, bounties and supply drops — this exposes them,
                            each priced in the same Capitol Coins sponsorship spends,
                            which turns Gamemaker mode into resource management. */}
                        <div className="border-t border-[var(--color-ink-800)] pt-3 space-y-2">
                            <div className="flex items-baseline justify-between">
                                <span className="eyebrow">Arena controls</span>
                                <span className="font-mono text-[11px] text-[var(--color-ink-500)]">{coins} coins</span>
                            </div>
                            <div className="space-y-1">
                                <label className="eyebrow" htmlFor="gm-zone">Target zone</label>
                                <select
                                    id="gm-zone"
                                    value={gmZone}
                                    onChange={e => setGmZone(e.target.value)}
                                    className="field text-xs"
                                >
                                    <option value="">Random zone</option>
                                    {gameState.arena.zones
                                        .filter(z => !(gameState.collapsedZones ?? []).includes(z.name))
                                        .map(z => <option key={z.name} value={z.name}>{z.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {([
                                    ['burn', 'Ignite', GAMEMAKER_COSTS.burn, 'Set the zone burning — and fire spreads'],
                                    ['flood', 'Flood', GAMEMAKER_COSTS.flood, 'Put the zone under water'],
                                    ['fog', 'Fog', GAMEMAKER_COSTS.fog, 'Blind everyone in the zone'],
                                    ['sever', 'Cut route', GAMEMAKER_COSTS.sever, 'Destroy one path out of the zone'],
                                ] as const).map(([type, label, cost, tip]) => (
                                    <button
                                        key={type}
                                        onClick={() => spendGamemaker(type, cost, gmZone || undefined)}
                                        className="btn btn-sm w-full"
                                        disabled={coins < cost}
                                        aria-disabled={coins < cost}
                                        title={coins < cost
                                            ? `${tip} — costs ${cost} coins and you have ${coins}. You need ${cost - coins} more.`
                                            : `${tip} (${cost} coins)`}
                                    >
                                        {label} <span className="font-mono text-[10px] text-[var(--color-ink-500)]">{cost}</span>
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => spendGamemaker('drop', GAMEMAKER_COSTS.drop)}
                                className="btn btn-sm w-full"
                                disabled={coins < GAMEMAKER_COSTS.drop}
                                aria-disabled={coins < GAMEMAKER_COSTS.drop}
                                title={coins < GAMEMAKER_COSTS.drop
                                    ? `A supply drop costs ${GAMEMAKER_COSTS.drop} coins and you have ${coins}. You need ${GAMEMAKER_COSTS.drop - coins} more.`
                                    : `Restock the Cornucopia with a supply drop (${GAMEMAKER_COSTS.drop} coins)`}
                            >
                                Supply drop <span className="font-mono text-[10px] text-[var(--color-ink-500)]">{GAMEMAKER_COSTS.drop}</span>
                            </button>
                            <button
                                onClick={() => spendGamemaker('bounty', GAMEMAKER_COSTS.bounty, muttTargetId || undefined)}
                                className="btn btn-sm w-full"
                                disabled={coins < GAMEMAKER_COSTS.bounty || !!gameState.bountyTargetId}
                                aria-disabled={coins < GAMEMAKER_COSTS.bounty || !!gameState.bountyTargetId}
                                title={gameState.bountyTargetId
                                    ? 'A bounty already stands'
                                    : coins < GAMEMAKER_COSTS.bounty
                                        ? `A bounty costs ${GAMEMAKER_COSTS.bounty} coins and you have ${coins}. You need ${GAMEMAKER_COSTS.bounty - coins} more.`
                                        : `Place a bounty on the selected tribute — or the dullest one — and point the whole field at them (${GAMEMAKER_COSTS.bounty} coins)`}
                            >
                                Place bounty <span className="font-mono text-[10px] text-[var(--color-ink-500)]">{GAMEMAKER_COSTS.bounty}</span>
                            </button>
                        </div>
                    </div>
                )}

                <div className={`panel p-4 ${sidebarPane === 'tributes' ? '' : 'hidden lg:block'}`}>
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

            <nav aria-label="Arena panes" className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--ink)] border-t-[3px] border-[var(--red)] flex items-stretch">
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
                        style={{ fontFamily: 'var(--font-mono)', color: mobilePane === tab.id ? 'var(--red-on-ink)' : '#a89a86' }}
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

            {/* Three live regions, and they sit outside the chronicle pane so
                they keep announcing while the arena map is showing.

                The polite feed used to carry every line the simulation emitted,
                which at 5x is a wall of ambient scenery nobody can follow — so
                it now carries only headline events, the same lines the
                "headline events only" filter keeps. Deaths and phase changes
                interrupt; the third region speaks the result of a keyboard
                shortcut, which otherwise has no spoken feedback at all. */}
            <div aria-live="polite" className="sr-only">{latestHeadline}</div>
            <div aria-live="assertive" className="sr-only">{urgentAnnouncement}</div>
            <div ref={shortcutHintRef} role="status" aria-live="polite" className="sr-only" />

            {showHelp && (
                <div
                    className="fixed inset-0 z-50 bg-black/70 flex items-start md:items-center justify-center p-4 overflow-y-auto"
                    role="dialog"
                    aria-modal="true"
                    aria-label="How to read the Games"
                    onClick={() => setShowHelp(false)}
                >
                    <div
                        className="panel p-6 max-w-2xl w-full space-y-5 my-8"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start gap-4">
                            <h2 className="display-title text-2xl">How to read the Games</h2>
                            <button onClick={() => setShowHelp(false)} className="btn btn-sm btn-ghost">Close (Esc)</button>
                        </div>

                        <div className="space-y-1.5">
                            <span className="eyebrow">Keyboard</span>
                            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-[var(--color-ink-200)]">
                                {[
                                    ['Space', 'Advance one phase'],
                                    ['P', 'Start or stop auto-advance'],
                                    ['Backspace', 'Step the board back one phase — the whole board, not just the feed'],
                                    ['F', 'Show or hide the chronicle filters'],
                                    ['M', 'Switch between the chronicle and the arena map'],
                                    ['Z / Shift+Z', 'Cycle the sector filter forward or back — past the last sector clears it'],
                                    ['T / Shift+T', 'Cycle the tribute filter forward or back — past the last tribute clears it'],
                                    ['[ / ]', 'Jump the chronicle to the previous or next day'],
                                    ['I', 'Headline events only, on or off'],
                                    ...CATEGORY_GROUPS.slice(0, 9).map((g, i) => [String(i + 1), `Mute or unmute ${g.label.toLowerCase()} events`]),
                                    ['0', 'Reset every chronicle filter'],
                                    ['?', 'Open this panel'],
                                    ['Esc', 'Close a panel, clear the selected sector'],
                                ].map(([key, what]) => (
                                    <React.Fragment key={key}>
                                        <dt className="font-mono font-bold text-[var(--red)]">{key}</dt>
                                        <dd>{what}</dd>
                                    </React.Fragment>
                                ))}
                            </dl>
                            <p className="text-[11px] text-[var(--color-ink-500)]">
                                Shortcuts stand down while you are typing in a search box or a menu, so nothing
                                is hijacked mid-word.
                            </p>
                        </div>

                        {/* The systems a first-time reader has no way to infer from
                            the feed alone. Each of these is a real mechanic driving
                            what they are watching, and none of them were explained. */}
                        <div className="space-y-1.5">
                            <span className="eyebrow">What the numbers mean</span>
                            <dl className="space-y-2 text-xs text-[var(--color-ink-200)]">
                                {[
                                    ['Stance', 'Aggressive, Defensive or Evasive — how a tribute is playing right now. It is held for several cycles rather than re-rolled, so a change of stance is a real change of mind.'],
                                    ['Objective', 'What they are actually trying to do: reach water, hunt somebody, guard an ally, hold ground. It is why they move where they move, and it is shown under each tribute in the sidebar.'],
                                    ['Sanity', 'How well they are holding together. Low sanity means hallucinations, dropped kit and blown cover.'],
                                    ['Resolve', 'Whether they still want to win — separate from sanity. Allies, a debt to collect and the crowd’s attention hold it up; grief, isolation and wounds pull it down. At the bottom, tributes stop playing.'],
                                    ['Momentum and Rattled', 'Two short-lived states either side of a fight. A kill leaves a tribute keyed up — harder to beat, less willing to break off. Fleeing, a trap or a death they cared about leaves them rattled: softer, and quicker to run. Both bleed off over a few cycles, and both show on the tribute sheet.'],
                                    ['Truce', 'An expiring non-aggression pact negotiated when two tributes meet and neither likes the odds. It is not an alliance — no shared camp, no shared supplies — but they will not fight while it stands.'],
                                    ['Debt', 'What being saved costs. Somebody who took a real risk for a tribute is owed, and that debt makes turning on them much harder until it is settled.'],
                                    ['Suspicion', 'How much a tribute distrusts one specific ally. Witnessed betrayals and broken alliance terms raise it; it decays on its own. High enough, and they walk out before anything is done to them.'],
                                    ['Proficiency', 'Skills that improve with use — foraging, melee, medicine, tracking. A survivalist visibly becomes one over a run.'],
                                    ['Quality', 'Items come in crude, standard and fine. It shows in the name and it changes the damage and durability.'],
                                    ['Alliance colour', 'The stripe down the left of a tribute card. Every standing alliance gets its own colour for as long as it exists.'],
                                ].map(([term, what]) => (
                                    <div key={term}>
                                        <dt className="font-bold text-[var(--ink)] inline">{term}. </dt>
                                        <dd className="inline">{what}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>

                        <p className="text-[11px] text-[var(--color-ink-500)] italic">
                            Everything in the chronicle is generated from the simulation — no line is written in
                            advance for a particular run. The same seed and arena always produce the same Games.
                        </p>
                    </div>
                </div>
            )}

            {selectedTribute && (
                <TributeModal
                    tribute={selectedTribute}
                    gameState={gameState}
                    onClose={() => setSelectedTributeId(null)}
                    onShowInChronicle={() => {
                        // U-3: "what happened to X?" — filter the chronicle to
                        // them. Entries render newest-first, so their death (or
                        // latest moment) sits right at the top.
                        setFilterTributeId(selectedTribute.id);
                        setFilterTributeId2(null);
                        setFilterDay(null);
                        setSearchText('');
                        setTacticalTab('chronicle');
                        setMobilePane('chronicle');
                        setSelectedTributeId(null);
                    }}
                />
            )}
        </div>
    );
}
