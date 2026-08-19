import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EventCategory, GameState } from '../models/types';
import { ArenaMap } from '../components/ArenaMap';
import { TributeModal } from '../components/TributeModal';
import { EventFeed, FeedLine } from '../components/EventFeed';
import { CATEGORY_GROUPS } from '../ui/eventStyles';
import { Skull, Heart, Settings, FastForward, MapPin, Users, Swords, Filter, Play, Pause } from 'lucide-react';

type Speed = 'manual' | '1x' | '5x' | 'auto';

const SPEED_DELAY: Record<Exclude<Speed, 'manual'>, number> = { '1x': 1200, '5x': 350, auto: 60 };

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
    const [mutedGroups, setMutedGroups] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const nextPhaseRef = useRef(onNextPhase);
    nextPhaseRef.current = onNextPhase;

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

    // Auto-advance
    useEffect(() => {
        if (speed === 'manual' || isOver) return;
        const timer = setTimeout(() => nextPhaseRef.current(), SPEED_DELAY[speed]);
        return () => clearTimeout(timer);
    }, [speed, isOver, gameState.phase, gameState.day, gameState.log.length]);

    // Keyboard shortcuts: space advances, F toggles filters, M/C swap panes, Esc clears.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
            if (e.key === ' ' && !isOver) {
                e.preventDefault();
                onNextPhase();
            } else if (e.key.toLowerCase() === 'f') {
                setShowFilters(v => !v);
            } else if (e.key.toLowerCase() === 'm') {
                setTacticalTab(t => (t === 'map' ? 'chronicle' : 'map'));
            } else if (e.key === 'Escape') {
                setSelectedTributeId(null);
                setSelectedZone(null);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onNextPhase, isOver]);

    const filteredLogs = useMemo(() => gameState.log.filter(log => {
        if (importantOnly && !log.important) return false;
        if (selectedZone && log.zone !== selectedZone) return false;
        if (mutedCategories.has(log.category)) return false;
        return true;
    }), [gameState.log, importantOnly, selectedZone, mutedCategories]);

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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
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
                            </div>

                            <div className="seg">
                                <button onClick={() => setTacticalTab('chronicle')} aria-pressed={tacticalTab === 'chronicle'} className="seg-item">
                                    Chronicle
                                </button>
                                <button onClick={() => setTacticalTab('map')} aria-pressed={tacticalTab === 'map'} className="seg-item">
                                    Arena Map
                                </button>
                            </div>

                            <button onClick={() => setShowFilters(v => !v)} aria-pressed={showFilters} className="seg-item" title="Toggle filters (F)">
                                <Filter className="w-3 h-3 inline mr-1" /> Filters
                                {(mutedGroups.size > 0 || importantOnly) && <span className="ml-1 text-[var(--red)]">•</span>}
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
                                    {(mutedGroups.size > 0 || importantOnly) && (
                                        <button
                                            onClick={() => { setMutedGroups(new Set()); setImportantOnly(false); }}
                                            className="chip chip-accent"
                                        >
                                            Reset filters
                                        </button>
                                    )}
                                </div>
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
                                        <div className="empty-state">Nothing has happened in this sector yet.</div>
                                    ) : (
                                        [...filteredLogs].reverse().map(l => <FeedLine key={l.id} log={l} />)
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="empty-state">Select a sector above to isolate everything that happened there.</div>
                        )}
                    </div>
                ) : (
                    <div className="panel p-5 space-y-4">
                        {selectedZone && (
                            <div className="flex justify-between items-center panel-flush px-3 py-2 text-xs text-[var(--red)]">
                                <span>Filtered to sector <strong>{selectedZone}</strong></span>
                                <button onClick={() => setSelectedZone(null)} className="btn btn-sm btn-ghost">Clear</button>
                            </div>
                        )}
                        {filteredLogs.length > 0 ? (
                            <EventFeed logs={filteredLogs} />
                        ) : (
                            <div className="empty-state">
                                {gameState.log.length === 0
                                    ? 'Nothing has happened yet. Hit Proceed to begin.'
                                    : 'Every logged event is hidden by your current filters.'}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ---------- sidebar ---------- */}
            <div className="space-y-5">
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
                </div>

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
                    <h3 className="panel-title mb-3">Tributes</h3>
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
                                                <span className="chip">D{t.district}</span>
                                                {!dead && t.allianceId && (
                                                    <span className="chip" style={accent ? { color: accent, borderColor: accent } : undefined}>
                                                        <Users className="w-2.5 h-2.5" /> Pack
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

            {selectedTribute && (
                <TributeModal tribute={selectedTribute} gameState={gameState} onClose={() => setSelectedTributeId(null)} />
            )}
        </div>
    );
}
