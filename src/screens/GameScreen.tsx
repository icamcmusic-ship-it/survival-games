import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EventCategory, GameState, Phase } from '../models/types';
import { ArenaMap } from '../components/ArenaMap';
import { ZoneDossier } from '../components/ZoneDossier';
import { TributeModal } from '../components/TributeModal';
import { EventFeed, FeedLine, VISIBLE_CAP, tierOf } from '../components/EventFeed';
import { ChronicleFilters } from '../components/ChronicleFilters';
import { BroadcastBar } from '../components/BroadcastBar';
import { DossierPanel } from '../components/DossierPanel';
import { StandingsTable } from '../components/StandingsTable';
import { PlayUntil, Speed } from '../components/PlaybackPopover';
import { CATEGORY_GROUPS } from '../ui/eventStyles';
import { tributeOdds } from '../engine/odds';
import { Filter, Star } from 'lucide-react';
import { GAMEMAKER_COSTS } from '../data/balance';
import { evaluateInRunNearMisses } from '../data/achievements';
import { GamemakerEventType, gamemakerCooldownRemaining, gamemakerEventCost } from '../engine/gamemaker';
import { gameActions, gameStore } from '../store/gameStore';
import { pathForView } from '../store/router';
import { chronicleStore, filtersActive, setChronicle, toggleMutedGroup } from '../store/chronicleStore';
import { prefsStore, setPrefs } from '../store/prefsStore';
import { playAnthem, playCannon, playParachute, unlockAudio } from '../utils/sound';
import { canSeeArena, disclosureFor } from '../ui/disclosure';

import { useStore } from '../store/createStore';

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

/**
 * §2.2: and pacing also follows *which* phase it is.
 *
 * Playback was one speed for the whole run. The bloodbath is the densest and
 * most consequential ninety seconds in the Games and the training days are
 * three narrated rotations most viewers want to skim; giving them the same
 * wall-clock treatment is the coarseness the request names. Off by preference
 * for anyone who wants a flat tape.
 */
const PHASE_PACING: Partial<Record<Phase, number>> = {
    bloodbath: 2.2,
    feast: 1.8,
    epilogue: 1.6,
    interviews: 0.75,
    training: 0.6,
    reaping: 0.75,
};

function pacedDelay(
    speed: Exclude<Speed, 'manual'>,
    linesThisPhase: number,
    phase: Phase,
    phasePacing: boolean,
): number {
    const base = SPEED_DELAY[speed];
    if (speed === 'auto') return base;
    const multiplier = Math.min(MAX_PACING_MULTIPLIER, 1 + linesThisPhase / LINES_PER_MULTIPLIER_STEP);
    const perPhase = phasePacing ? (PHASE_PACING[phase] ?? 1) : 1;
    return Math.round(base * multiplier * perPhase);
}

type StageTab = 'chronicle' | 'map' | 'standings';
type MobilePane = StageTab | 'tributes';

/**
 * A6: three fixed regions instead of one wall.
 *
 * This component was 1,493 lines holding the phase header, four segmented
 * controls, two tab bars, a filter drawer containing twenty category chips and
 * the exports, and a three-module sidebar — which is the underlying reason the
 * layout was hard to change at all. It is now a broadcast bar, a stage and a
 * dossier column, each in its own file, over a filter state that lives in
 * `chronicleStore` so the standalone chronicle page reads the same one.
 */
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
    // A "Random Arena (Hidden)" pick at setup: identity, zone names and the
    // map itself stay out of the UI until the bloodbath phase reveals them.
    const arenaSealed = !!gameState.arenaHidden && !canSeeArena(disclosureFor(gameState.phase));
    const filters = useStore(chronicleStore, s => s);
    const [selectedTributeId, setSelectedTributeId] = useState<string | null>(null);
    const [speed, setSpeed] = useState<Speed>('manual');
    const coins = useStore(gameStore, s => s.coins);
    const runProgress = useStore(gameStore, s => s.runProgress);

    /**
     * §6.7: repeat uses of the same lever cost more, and a lever still on
     * cooldown takes no coins — the booth refuses the order in the feed.
     *
     * The free levers (mutts, weather, a feast) have no entry in
     * `GAMEMAKER_COSTS` and are charged nothing, exactly as before.
     */
    const spendGamemaker = (type: GamemakerEventType, targetId?: string) => {
        const base = (GAMEMAKER_COSTS as Partial<Record<GamemakerEventType, number>>)[type];
        if (base !== undefined) {
            const escalated = gamemakerEventCost(gameState, type, base);
            if (coins < escalated) return;
            if (gamemakerCooldownRemaining(gameState, type) > 0) {
                onGamemakerEvent(type, targetId); // logs the refusal, charges nothing
                return;
            }
            gameActions.setCoins(c => c - escalated);
        }
        onGamemakerEvent(type, targetId);
    };

    const [stageTab, setStageTab] = useState<StageTab>('chronicle');
    const [mobilePane, setMobilePane] = useState<MobilePane>('chronicle');
    const [showFilters, setShowFilters] = useState(false);
    const [pauseNotice, setPauseNotice] = useState<string | null>(null);
    const [playUntil, setPlayUntil] = useState<PlayUntil>(null);
    const [showHelp, setShowHelp] = useState(false);
    const prefs = useStore(prefsStore, p => p);
    const panem = useStore(gameStore, s => s.panem);
    const nearMisses = useMemo(
        () => evaluateInRunNearMisses(gameState, panem?.unlocked ?? []),
        [gameState, panem]
    );
    const nextPhaseRef = useRef(onNextPhase);
    nextPhaseRef.current = onNextPhase;

    // Browsers refuse audio before a user gesture; the first click anywhere
    // unlocks the shared context.
    useEffect(() => {
        const unlock = () => unlockAudio();
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        return () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
    }, []);

    // §2.2: the cannon and the parachute, cued off new log lines regardless of
    // whether the phase advanced by hand or on the timer.
    const soundLogCount = useRef(gameState.log.length);
    useEffect(() => {
        const newCount = Math.max(0, gameState.log.length - soundLogCount.current);
        const fresh = newCount > 0 ? gameState.log.slice(-newCount) : [];
        soundLogCount.current = gameState.log.length;
        if (fresh.some(l => l.category === 'death' || l.category === 'kill')) playCannon();
        else if (fresh.some(l => l.category === 'sponsor')) playParachute();
    }, [gameState.log.length]); // eslint-disable-line react-hooks/exhaustive-deps

    // The anthem plays as night falls on a day that took someone.
    const lastAnthemDay = useRef(-1);
    useEffect(() => {
        if (gameState.phase !== 'night' || gameState.day === lastAnthemDay.current) return;
        if (gameState.tributes.some(t => t.status === 'dead' && t.dayOfDeath === gameState.day)) {
            lastAnthemDay.current = gameState.day;
            playAnthem();
        }
    }, [gameState.phase, gameState.day]); // eslint-disable-line react-hooks/exhaustive-deps

    // Chronicle scroll tracking (UX-04): auto-follow the bottom while the
    // reader is already there; once they have scrolled up, surface a pill.
    const chronicleRef = useRef<HTMLDivElement>(null);
    const currentDayInViewRef = useRef<number | null>(null);
    const [scrolledAway, setScrolledAway] = useState(false);
    const prevLogCountRef = useRef(gameState.log.length);

    const nearBottom = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight <= 24;
    useEffect(() => {
        const el = chronicleRef.current;
        if (!el) return;
        const grew = gameState.log.length > prevLogCountRef.current;
        prevLogCountRef.current = gameState.log.length;
        if (grew && nearBottom(el)) el.scrollTop = el.scrollHeight;
        else if (grew) setScrolledAway(true);
    }, [gameState.log.length]);

    const jumpToLatest = () => {
        const el = chronicleRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        setScrolledAway(false);
    };

    const aliveCount = gameState.tributes.filter(t => t.status === 'alive').length;
    const deadCount = gameState.tributes.length - aliveCount;
    const isOver = gameState.phase === 'ended';

    const selectedTribute = selectedTributeId
        ? gameState.tributes.find(t => t.id === selectedTributeId) ?? null
        : null;

    const mutedCategories = useMemo(() => {
        const muted = new Set<EventCategory>();
        CATEGORY_GROUPS.forEach(group => {
            if (filters.mutedGroups.includes(group.id)) group.categories.forEach(c => muted.add(c));
        });
        return muted;
    }, [filters.mutedGroups]);

    // Auto-advance, paced by how much the phase just produced.
    const lastTickLogCount = useRef(gameState.log.length);
    useEffect(() => {
        const running = speed !== 'manual' || playUntil !== null;
        if (!running || isOver || runProgress) return;
        const newCount = Math.max(0, gameState.log.length - lastTickLogCount.current);
        const newLines = newCount > 0 ? gameState.log.slice(-newCount) : [];
        lastTickLogCount.current = gameState.log.length;

        const aliveNow = gameState.tributes.filter(t => t.status === 'alive').length;
        const untilHit = playUntil === 'death'
            ? newLines.some(l => l.category === 'death' || l.category === 'kill')
            : playUntil === 'feast'
                ? gameState.phase === 'feast' || newLines.some(l => l.category === 'feast')
                : playUntil === 'final8'
                    ? aliveNow <= 8
                    : false;
        if (untilHit) {
            setPlayUntil(null);
            setSpeed('manual');
            setPauseNotice(playUntil === 'death' ? 'A cannon fired — holding here.'
                : playUntil === 'feast' ? 'The feast is called — holding here.'
                : 'The final eight stand — holding here.');
            return;
        }

        // §2.11: the brakes. Each is opt-in; any hit drops back to manual.
        const brake = (() => {
            if (filters.pauseOnDeath && newLines.some(l => l.category === 'death' || l.category === 'kill')) {
                return 'A cannon fired — auto-advance paused.';
            }
            if (prefs.pauseOnBetrayal && newLines.some(l => l.category === 'betrayal')) {
                return 'A betrayal — auto-advance paused.';
            }
            if (prefs.pauseOnAlliance && newLines.some(l => l.category === 'alliance' && l.important)) {
                return 'An alliance shifted — auto-advance paused.';
            }
            if (prefs.pauseOnSponsor && newLines.some(l => l.category === 'sponsor')) {
                return 'A parachute came down — auto-advance paused.';
            }
            if (prefs.pauseOnFollowed && filters.followedId && newLines.some(l => l.tributesInvolved.includes(filters.followedId!))) {
                const name = gameState.tributes.find(t => t.id === filters.followedId)?.name ?? 'Your tribute';
                return `${name} was involved — auto-advance paused.`;
            }
            return null;
        })();
        if (brake) {
            setPlayUntil(null);
            setSpeed('manual');
            setPauseNotice(brake);
            return;
        }
        // Pace on beats, not raw lines.
        let beatCount = 0;
        let prevKey: string | null = null;
        for (const l of newLines) {
            const key = `${l.zone ?? ''}|${l.category}`;
            if (key !== prevKey) beatCount++;
            prevKey = key;
        }
        const holdForDeath = newLines.some(l => tierOf(l) === 'headline') ? 2 : 0;
        const effectiveSpeed = speed === 'manual' ? '5x' : speed;
        const timer = setTimeout(() => nextPhaseRef.current(), pacedDelay(effectiveSpeed, beatCount + holdForDeath, gameState.phase, prefs.phasePacing));
        return () => clearTimeout(timer);
    }, [speed, playUntil, isOver, filters.pauseOnDeath, filters.followedId, prefs, runProgress, gameState.phase, gameState.day, gameState.log.length, gameState.log, gameState.tributes]);

    /**
     * §2.3: every binding is listed in the help overlay, and the overlay is
     * reachable from the `?` key rather than being a hidden desktop-only line.
     */
    const shortcutHintRef = useRef<HTMLDivElement>(null);
    const announceShortcut = (message: string) => {
        if (shortcutHintRef.current) shortcutHintRef.current.textContent = message;
    };

    const sortedRoster = useMemo(() => [...gameState.tributes].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'alive' ? -1 : 1;
        if (a.district !== b.district) return a.district - b.district;
        return a.gender.localeCompare(b.gender);
    }), [gameState.tributes]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (selectedTributeId) return;
            if (showHelp && e.key !== 'Escape' && e.key !== '?') return;

            const zones = arenaSealed ? [] : gameState.arena.zones.map(z => z.name);
            const cycle = <T,>(list: T[], current: T | null, step: number): T | null => {
                if (list.length === 0) return null;
                if (current === null) return step > 0 ? list[0] : list[list.length - 1];
                const at = list.indexOf(current);
                const next = at + step;
                if (at === -1) return list[0];
                return next < 0 || next >= list.length ? null : list[next];
            };
            const days = [...new Set(gameState.log.map(l => l.day))].sort((a, b) => a - b);
            const jumpDay = (step: number) => {
                if (days.length === 0) return;
                setStageTab('chronicle');
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

            if (key === ' ' && !isOver && !runningRef.current) {
                e.preventDefault();
                onNextPhase();
            } else if (lower === 'f') {
                setShowFilters(v => !v);
            } else if (lower === 'm') {
                setStageTab(t => {
                    const next = t === 'map' ? 'chronicle' : 'map';
                    setMobilePane(next);
                    return next;
                });
            } else if (lower === 'c') {
                setStageTab('chronicle');
                setMobilePane('chronicle');
                announceShortcut('Chronicle');
            } else if (lower === 's') {
                setStageTab('standings');
                setMobilePane('standings');
                announceShortcut('Standings');
            } else if (key === '?') {
                setShowHelp(v => !v);
            } else if (key === 'Escape') {
                setShowHelp(false);
                setSelectedTributeId(null);
                setChronicle({ selectedZone: null });
            } else if (lower === 'z') {
                const next = cycle(zones, filters.selectedZone, e.shiftKey ? -1 : 1);
                setChronicle({ selectedZone: next });
                announceShortcut(next ? `Sector filter: ${next}` : 'Sector filter cleared');
            } else if (lower === 't') {
                const ids = sortedRoster.map(t => t.id);
                const next = cycle(ids, filters.filterTributeId, e.shiftKey ? -1 : 1);
                setChronicle({ filterTributeId: next });
                const name = next ? sortedRoster.find(t => t.id === next)?.name : null;
                announceShortcut(name ? `Tribute filter: ${name}` : 'Tribute filter cleared');
            } else if (key === '[') {
                jumpDay(-1);
            } else if (key === ']') {
                jumpDay(1);
            } else if (key === 'i') {
                const next = filters.density === 'everything' ? 'scenes'
                    : filters.density === 'scenes' ? 'headlines' : 'everything';
                setChronicle({ density: next });
                announceShortcut(next === 'everything' ? 'Showing every event' : next === 'scenes' ? 'Showing headlines and scenes' : 'Showing headlines only');
            } else if (key === 'p' && !isOver) {
                setSpeed(s => {
                    const next = s === 'manual' ? '1x' : 'manual';
                    announceShortcut(next === 'manual' ? 'Auto-advance paused' : 'Auto-advance running');
                    setPauseNotice(null);
                    setPlayUntil(null);
                    return next;
                });
            } else if (key >= '1' && key <= String(Math.min(9, CATEGORY_GROUPS.length))) {
                const group = CATEGORY_GROUPS[Number(key) - 1];
                if (group) {
                    toggleMutedGroup(group.id);
                    announceShortcut(`${group.label} events ${filters.mutedGroups.includes(group.id) ? 'unmuted' : 'muted'}`);
                }
            } else if (key === '0') {
                setChronicle({
                    mutedGroups: [], density: 'everything', searchText: '',
                    filterTributeId: null, filterTributeId2: null, filterPairMode: 'either', filterDay: null, selectedZone: null,
                });
                announceShortcut('All chronicle filters reset');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onNextPhase, isOver, selectedTributeId, showHelp, gameState, filters, sortedRoster]);

    const runningRef = useRef(false);
    runningRef.current = !!runProgress;
    useEffect(() => () => gameActions.cancelRunToEnd(), []);

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
            return true;
        });
    }, [gameState.log, filters, mutedCategories]);

    /** PERF: the sector rail is newest-first and capped, like the main chronicle. */
    const sectorLogRows = useMemo(
        () => filteredLogs.slice(Math.max(0, filteredLogs.length - VISIBLE_CAP)).reverse(),
        [filteredLogs],
    );

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState.phase, gameState.day]);

    /**
     * Reuses the category palette so alliance colours read as part of the same
     * system as the chronicle feed. Assigned by position among the alliances
     * actually standing, not hashed from the id.
     */
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

    const phaseLabel = isOver
        ? 'The Games Have Ended'
        : gameState.day === 0
            ? gameState.phase.toUpperCase()
            : `Day ${gameState.day} — ${gameState.phase.toUpperCase()}`;

    const latestHeadline = useMemo(() => {
        for (let i = gameState.log.length - 1; i >= 0; i--) {
            const line = gameState.log[i];
            if (line.important && line.category !== 'death' && line.category !== 'kill') return line.text;
        }
        return '';
    }, [gameState.log]);

    const urgentAnnouncement = useMemo(() => {
        const lastDeath = [...gameState.log]
            .reverse()
            .find(l => l.day === gameState.day && (l.category === 'death' || l.category === 'kill'));
        return `${phaseLabel}.${lastDeath ? ` ${lastDeath.text}` : ''}`;
    }, [phaseLabel, gameState.log, gameState.day]);

    const selectMobilePane = (pane: MobilePane) => {
        setMobilePane(pane);
        if (pane !== 'tributes') setStageTab(pane);
    };

    const followed = filters.followedId
        ? gameState.tributes.find(t => t.id === filters.followedId)
        : undefined;

    return (
        <div className="pb-24 lg:pb-0">
            {/* ================= BROADCAST BAR ================= */}
            <BroadcastBar
                gameState={gameState}
                phaseLabel={phaseLabel}
                aliveCount={aliveCount}
                deadCount={deadCount}
                isOver={isOver}
                onNextPhase={onNextPhase}
                onRunToEnd={onRunToEnd}
                speed={speed}
                onSpeed={s => { setSpeed(s); setPauseNotice(null); setPlayUntil(null); }}
                playUntil={playUntil}
                onPlayUntil={p => { setPauseNotice(null); setPlayUntil(p); }}
                hasFollowed={!!filters.followedId}
                pauseNotice={pauseNotice}
                onDismissNotice={() => setPauseNotice(null)}
                arenaSealed={arenaSealed}
            />

            {/* §2.4: the keyboard map is genuinely good and completely
                undiscoverable unless you already know to press ?. Shown once,
                on the first run, and never again after it is dismissed. */}
            {!prefs.seenShortcutHint && (
                <div className="panel-flush px-4 py-2 mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                    <span className="eyebrow flex-none">Keyboard</span>
                    <span className="text-[var(--color-ink-300)]">
                        <kbd className="font-mono font-bold text-[var(--ink)]">space</kbd> advance
                        {' · '}<kbd className="font-mono font-bold text-[var(--ink)]">[</kbd>/<kbd className="font-mono font-bold text-[var(--ink)]">]</kbd> speed
                        {' · '}<kbd className="font-mono font-bold text-[var(--ink)]">m</kbd> map
                        {' · '}<kbd className="font-mono font-bold text-[var(--ink)]">i</kbd> standings
                        {' · '}<kbd className="font-mono font-bold text-[var(--ink)]">?</kbd> all of them
                    </span>
                    <button
                        onClick={() => setPrefs({ seenShortcutHint: true })}
                        className="btn btn-sm btn-ghost ml-auto flex-none"
                    >
                        Got it
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ================= STAGE ================= */}
                <div className={`lg:col-span-2 space-y-4 ${mobilePane === 'tributes' ? 'hidden lg:block' : ''}`}>
                    <div className="panel p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="seg">
                                {([
                                    ['chronicle', 'Chronicle'],
                                    ['map', 'Map'],
                                    ['standings', 'Standings'],
                                ] as const).map(([id, label]) => (
                                    <button
                                        key={id}
                                        onClick={() => selectMobilePane(id)}
                                        aria-pressed={stageTab === id}
                                        className="seg-item"
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                {/* A6: density is the highest-value reading control
                                    and it was two clicks deep in a filter drawer. */}
                                {stageTab === 'chronicle' && (
                                    <div className="seg" role="group" aria-label="Reading density">
                                        {([
                                            ['headlines', 'Headlines', 'Deaths, kills, betrayals and the Gamemakers — the skeleton of the Games'],
                                            ['scenes', 'Scenes', 'Headlines plus combat, mutts, hazards and sponsors'],
                                            ['everything', 'Everything', 'Every logged line, with the quiet moments folded per phase'],
                                        ] as const).map(([id, label, tip]) => (
                                            <button
                                                key={id}
                                                onClick={() => setChronicle({ density: id })}
                                                aria-pressed={filters.density === id}
                                                className="seg-item"
                                                title={tip}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <a
                                    href={`#${pathForView('chronicle')}`}
                                    onClick={() => gameActions.setView('chronicle')}
                                    className="seg-item no-underline"
                                    title="Open the chronicle as a full page, one phase at a time"
                                >
                                    Full page ↗
                                </a>
                                <button
                                    onClick={() => setShowFilters(v => !v)}
                                    aria-pressed={showFilters}
                                    className="seg-item"
                                    title="Toggle filters (F)"
                                >
                                    <Filter className="w-3 h-3 inline mr-1" /> Filters
                                    {filtersActive(filters) && <span className="ml-1 text-[var(--red)]">•</span>}
                                </button>
                                <button
                                    onClick={() => setShowHelp(true)}
                                    className="seg-item"
                                    title="Keyboard shortcuts and what the panels mean (?)"
                                    aria-haspopup="dialog"
                                >
                                    ?
                                </button>
                            </div>
                        </div>

                        {/* §2.7: the density tiers are invisible until somebody
                            finds the control, so say it once. */}
                        {!filters.densityHintSeen && stageTab === 'chronicle' && (
                            <div className="panel-flush p-3 text-[11px] text-[var(--color-ink-300)] flex items-start gap-3">
                                <span className="flex-1">
                                    A run produces around six hundred lines. <strong>Scenes</strong> shows the action,
                                    <strong> Headlines</strong> shows only the deaths and the turns, and <strong>Everything</strong>{' '}
                                    keeps the quiet moments too. You can change it any time — the control is right there.
                                </span>
                                <button className="btn btn-sm btn-ghost flex-none" onClick={() => setChronicle({ densityHintSeen: true })}>
                                    Got it
                                </button>
                            </div>
                        )}

                        {followed && (
                            <span className="chip chip-accent inline-flex items-center gap-1">
                                <Star className="w-3 h-3" aria-hidden="true" />
                                Following {followed.name}{followed.status === 'dead' ? ' †' : ''}
                                <button
                                    className="underline ml-1"
                                    onClick={() => {
                                        setChronicle({ filterTributeId: filters.followedId, filterTributeId2: null });
                                        setStageTab('chronicle');
                                        setMobilePane('chronicle');
                                    }}
                                    title="Filter the chronicle to their story"
                                >
                                    story
                                </button>
                                <button
                                    className="underline ml-1"
                                    onClick={() => setChronicle({ followedId: null })}
                                    aria-label={`Stop following ${followed.name}`}
                                >
                                    ×
                                </button>
                            </span>
                        )}

                        {showFilters && (
                            <ChronicleFilters
                                gameState={gameState}
                                filteredCount={filteredLogs.length}
                                onSelectTribute={setSelectedTributeId}
                            />
                        )}
                    </div>

                    {stageTab === 'standings' ? (
                        <div className="panel p-4">
                            <StandingsTable
                                gameState={gameState}
                                onSelectTribute={setSelectedTributeId}
                                allianceAccent={allianceAccent}
                                arenaSealed={arenaSealed}
                                followedId={filters.followedId}
                                onFollow={id => setChronicle({ followedId: id })}
                            />
                        </div>
                    ) : stageTab === 'map' ? (
                        // The side rail only splits off at very wide viewports: the
                        // stage is already two thirds of the page, and halving that
                        // again left the graph unreadably small.
                        <div className="panel p-4 grid grid-cols-1 2xl:grid-cols-[3fr_2fr] gap-4 items-start">
                            <div>
                                {arenaSealed ? (
                                    <div className="empty-state py-12">
                                        ❓ The Capitol has not shown this arena to anyone yet. The map unseals at the bloodbath.
                                    </div>
                                ) : (
                                    <ArenaMap
                                        gameState={gameState}
                                        selectedZone={filters.selectedZone}
                                        onSelectZone={z => setChronicle({ selectedZone: z })}
                                        tributes={gameState.tributes}
                                    />
                                )}
                            </div>
                            {/* A6: the sector log is only meaningful with the map
                                open, so it is the map tab's side rail rather than
                                its own conditional panel below the fold. */}
                            <div className="panel-flush p-3">
                                <div className="flex justify-between items-center mb-2 gap-2">
                                    <span className="panel-title text-[var(--red)]">
                                        {filters.selectedZone ? `Sector log — ${filters.selectedZone}` : 'Sector log'}
                                    </span>
                                    {filters.selectedZone && (
                                        <button onClick={() => setChronicle({ selectedZone: null })} className="btn btn-sm btn-ghost">Clear</button>
                                    )}
                                </div>
                                {arenaSealed ? (
                                    <div className="empty-state">Sealed until the Games begin.</div>
                                ) : !filters.selectedZone ? (
                                    <div className="empty-state">Select a sector to isolate everything that happened there.</div>
                                ) : (
                                    <div className="space-y-2">
                                    {/* §2.2: the map showed positions and nothing else.
                                        zoneDeaths, zoneTraffic, zoneDepletionPeak and
                                        zoneEffects were all on the state with no surface. */}
                                    <ZoneDossier gameState={gameState} zone={filters.selectedZone} />
                                    <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                                        {sectorLogRows.length === 0 ? (
                                            <div className="empty-state">Nothing has happened in this sector yet.</div>
                                        ) : (
                                            sectorLogRows.map(l => (
                                                <FeedLine key={l.id} log={l} cast={gameState.tributes} onSelectTribute={setSelectedTributeId} gameState={gameState} />
                                            ))
                                        )}
                                    </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="panel p-4 relative">
                            {filters.selectedZone && (
                                <div className="flex justify-between items-center panel-flush px-3 py-2 text-xs text-[var(--red)] mb-3">
                                    <span>Filtered to sector <strong>{filters.selectedZone}</strong></span>
                                    <button onClick={() => setChronicle({ selectedZone: null })} className="btn btn-sm btn-ghost">Clear</button>
                                </div>
                            )}
                            {scrolledAway && (
                                <button
                                    onClick={jumpToLatest}
                                    className="chip chip-accent absolute top-3 right-5 z-10 shadow-[var(--shadow-ink-sm)]"
                                >
                                    ↓ Jump to newest
                                </button>
                            )}
                            <div
                                ref={chronicleRef}
                                onScroll={(e) => setScrolledAway(!nearBottom(e.currentTarget))}
                                className={`max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar ${
                                    filters.textScale === 'small' ? 'chronicle-text-sm' : filters.textScale === 'large' ? 'chronicle-text-lg' : ''
                                }`}
                            >
                                {filteredLogs.length > 0 ? (
                                    <EventFeed
                                        logs={filteredLogs}
                                        cast={gameState.tributes}
                                        onSelectTribute={setSelectedTributeId}
                                        density={filters.density}
                                        hideZones={arenaSealed}
                                        gameState={gameState}
                                    />
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

                {/* ================= DOSSIER ================= */}
                <div className={mobilePane === 'tributes' ? '' : 'hidden lg:block'}>
                    <DossierPanel
                        gameState={gameState}
                        isOver={isOver}
                        arenaSealed={arenaSealed}
                        onSelectTribute={setSelectedTributeId}
                        allianceAccent={allianceAccent}
                        oddsLadder={oddsLadder}
                        oddsMovement={oddsMovement}
                        nearMisses={nearMisses}
                        onGamemakerEvent={spendGamemaker}
                    />
                </div>
            </div>

            {/* A6: on mobile, one bottom tab bar rather than two segmented
                controls and a tab bar all at once. */}
            <nav aria-label="Arena panes" className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--ink)] border-t-[3px] border-[var(--red)] flex items-stretch">
                {([
                    { id: 'chronicle', label: 'Chronicle' },
                    { id: 'map', label: 'Map' },
                    { id: 'standings', label: 'Table' },
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

            {/* Three live regions, outside the chronicle pane so they keep
                announcing while the map is showing. */}
            <div aria-live="polite" className="sr-only">{latestHeadline}</div>
            <div aria-live="assertive" className="sr-only">{urgentAnnouncement}</div>
            <div ref={shortcutHintRef} role="status" aria-live="polite" className="sr-only" />

            {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

            {selectedTribute && (
                <TributeModal
                    tribute={selectedTribute}
                    gameState={gameState}
                    onClose={() => setSelectedTributeId(null)}
                    onShowInChronicle={() => {
                        setChronicle({
                            filterTributeId: selectedTribute.id,
                            filterTributeId2: null,
                            filterPairMode: 'either',
                            filterDay: null,
                            searchText: '',
                        });
                        setStageTab('chronicle');
                        setMobilePane('chronicle');
                        setSelectedTributeId(null);
                    }}
                />
            )}
        </div>
    );
}

/** §2.3: every binding, in one overlay, reachable from `?`. */
function HelpOverlay({ onClose }: { onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 z-50 bg-black/70 flex items-start md:items-center justify-center p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="How to read the Games"
            onClick={onClose}
        >
            <div className="panel p-6 max-w-2xl w-full space-y-5 my-8" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start gap-4">
                    <h2 className="display-title text-2xl">How to read the Games</h2>
                    <button onClick={onClose} className="btn btn-sm btn-ghost">Close (Esc)</button>
                </div>

                <div className="space-y-1.5">
                    <span className="eyebrow">Keyboard</span>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-[var(--color-ink-200)]">
                        {[
                            ['Space', 'Advance one phase'],
                            ['P', 'Start or stop auto-advance'],
                            ['C', 'Show the chronicle'],
                            ['M', 'Switch between the chronicle and the arena map'],
                            ['S', 'Show the standings table'],
                            ['T / Shift+T', 'Cycle the tribute filter forward or back — past the last tribute clears it'],
                            ['F', 'Show or hide the chronicle filters'],
                            ['Z / Shift+Z', 'Cycle the sector filter forward or back — past the last sector clears it'],
                            ['[ / ]', 'Jump the chronicle to the previous or next day'],
                            ['I', 'Cycle reading density — everything, scenes, headlines'],
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
                        On the full-page chronicle, the left and right arrows page between phases.
                    </p>
                    <p className="text-[11px] text-[var(--color-ink-500)]">
                        Shortcuts stand down while you are typing in a search box or a menu, so nothing
                        is hijacked mid-word.
                    </p>
                </div>

                <div className="space-y-1.5">
                    <span className="eyebrow">What the numbers mean</span>
                    <dl className="space-y-2 text-xs text-[var(--color-ink-200)]">
                        {[
                            ['Stance', 'How a tribute is playing right now, from a roster of eight. Aggressive, Defensive and Evasive are always available; Hunting, Fortified, Desperate, Scavenging and Shadowing are only reachable in a specific situation, and each is vacated the moment that situation passes.'],
                            ['Objective', 'What they are actually trying to do: reach water, hunt somebody, guard an ally, hold ground. It is why they move where they move.'],
                            ['Archetype', 'Fifteen of them, and each has a behavioural signature rather than only a set of bias numbers — who they pick a fight with, how their caution moves across a run, and one set piece per Games.'],
                            ['Sanity', 'How well they are holding together. Low sanity means hallucinations, dropped kit and blown cover.'],
                            ['Resolve', 'Whether they still want to win — separate from sanity. At the bottom, tributes stop playing.'],
                            ['Momentum and Rattled', 'Two short-lived states either side of a fight. A kill leaves a tribute keyed up; losing an exchange, an ambush, a mutt or a near-death leaves them rattled. Both bleed off over a few cycles.'],
                            ['Truce', 'An expiring non-aggression pact negotiated when two tributes meet and neither likes the odds. Not an alliance — no shared camp — but they will not fight while it stands.'],
                            ['Debt', 'What being saved costs. Somebody who took a real risk for a tribute is owed, and that debt makes turning on them much harder.'],
                            ['Proficiency', 'Skills that improve with use — foraging, melee, medicine, tracking, persuasion. A survivalist visibly becomes one over a run.'],
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
    );
}
