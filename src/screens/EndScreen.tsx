import React, { useMemo, useState } from 'react';
import { GameState } from '../models/types';
import { EventFeed } from '../components/EventFeed';
import { ReplayScrubber } from '../components/ReplayScrubber';
import { ReplayFallenStrip } from '../components/ReplayFallenStrip';
import { ChronicleExport } from '../components/ChronicleExport';
import { VictorArc } from '../components/VictorArc';
import { TributeModal } from '../components/TributeModal';
import { Trophy, MapPin, Swords, Skull, RotateCcw } from 'lucide-react';
import { META_ACHIEVEMENTS, ACHIEVEMENTS } from '../data/achievements';
import { RECORD_DEFS } from '../utils/panemStorage';
import { gameStore } from '../store/gameStore';
import { useStore } from '../store/createStore';

function cleanCause(cause: string): string {
    const c = cause.toLowerCase();
    if (c.includes('killed by')) return 'Killed by another tribute';
    if (c.includes('bled out') || c.includes('bleeding')) return 'Bled out';
    if (c.includes('mutt') || c.includes('torn apart') || c.includes('devoured') || c.includes('taken by')) return 'Mutt attack';
    if (c.includes('infect') || c.includes('sepsis')) return 'Infection';
    if (c.includes('dehydration')) return 'Dehydration';
    if (c.includes('starvation')) return 'Starvation';
    if (c.includes('froze') || c.includes('hypothermia')) return 'Exposure';
    if (c.includes('poison') || c.includes('venom')) return 'Poison';
    if (c.includes('burn') || c.includes('lava') || c.includes('flare') || c.includes('scald')) return 'Burns';
    if (c.includes('drown')) return 'Drowning';
    if (c.includes('collapsing border')) return 'Arena border collapse';
    return 'Arena hazard';
}

export function EndScreen({
    gameState,
    onRestart,
    coins,
    betWonMessage
}: {
    gameState: GameState,
    onRestart: () => void,
    coins: number,
    betWonMessage: string | null
}) {
    const [activeTab, setActiveTab] = useState<'stats' | 'replay' | 'logs'>('stats');
    // Full chronicle: clicking a linked name opens the same tribute profile
    // the live Game screen offers, so "who was that?" doesn't require
    // switching screens.
    const [selectedTributeId, setSelectedTributeId] = useState<string | null>(null);
    const selectedTribute = selectedTributeId
        ? gameState.tributes.find(t => t.id === selectedTributeId) ?? null
        : null;
    // REPLAY-03/04: what this run showed the player that no previous run did.
    const outcome = useStore(gameStore, s => s.lastRunOutcome);

    // The day counter can tick one past the last day anything actually happened
    // (the loop increments, then the win check ends the run), so bound the
    // scrubber by the chronicle instead — otherwise it opens on an empty day.
    const finalDay = useMemo(
        () => gameState.log.reduce((max, entry) => Math.max(max, entry.day), 0) || gameState.day,
        [gameState.log, gameState.day]
    );
    const [replayDay, setReplayDay] = useState(finalDay);

    // §7.1: a run can now end with two victors.
    const victors = gameState.tributes.filter(t => t.status === 'alive');
    const winner = victors[0];
    const dead = gameState.tributes.filter(t => t.status === 'dead');

    const killLeaderboard = useMemo(
        () => [...gameState.tributes].filter(t => t.kills > 0).sort((a, b) => b.kills - a.kills),
        [gameState.tributes]
    );

    const districts = useMemo(
        () => Array.from(new Set(gameState.tributes.map(t => t.district))).sort((a, b) => a - b),
        [gameState.tributes]
    );

    const lastStandingPerDistrict = districts.map(dist => {
        const distTributes = gameState.tributes.filter(t => t.district === dist);
        return distTributes.find(t => t.status === 'alive')
            ?? [...distTributes].sort((a, b) => (b.dayOfDeath ?? 0) - (a.dayOfDeath ?? 0))[0];
    }).filter(Boolean);

    const longestNonCareers = useMemo(() => [...gameState.tributes.filter(t => !t.isCareer)].sort((a, b) => {
        if (a.status === 'alive' && b.status !== 'alive') return -1;
        if (a.status !== 'alive' && b.status === 'alive') return 1;
        return (b.dayOfDeath ?? 0) - (a.dayOfDeath ?? 0);
    }).slice(0, 3), [gameState.tributes]);

    const zoneDeaths = useMemo(() => {
        const counts: Record<string, number> = {};
        dead.forEach(t => {
            const zone = t.zone || 'Unknown sector';
            counts[zone] = (counts[zone] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [dead]);

    const causes = useMemo(() => {
        const counts: Record<string, number> = {};
        dead.forEach(t => {
            const key = cleanCause(t.causeOfDeath || 'Eliminated');
            counts[key] = (counts[key] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [dead]);

    const mostDangerousZone = zoneDeaths[0] ? { name: zoneDeaths[0][0], count: zoneDeaths[0][1] } : { name: 'None', count: 0 };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="masthead dot-texture text-center">
                <span className="masthead-ghost" aria-hidden="true">06</span>
                <span className="masthead-eyebrow">06 — {gameState.arena.name} · {gameState.day} days</span>
                <h2 className="masthead-title text-4xl md:text-5xl">The Arena Closes</h2>
                <p className="masthead-sub text-sm mx-auto">Seed {gameState.seed} · detailed debrief of the simulated Games.</p>
                <div className="flex flex-wrap justify-center gap-2 pt-5">
                    <div className="seg" style={{ background: 'var(--paper-panel)' }}>
                        <button onClick={() => setActiveTab('stats')} aria-pressed={activeTab === 'stats'} className="seg-item">Debrief</button>
                        <button onClick={() => setActiveTab('replay')} aria-pressed={activeTab === 'replay'} className="seg-item">Replay</button>
                        <button onClick={() => setActiveTab('logs')} aria-pressed={activeTab === 'logs'} className="seg-item">Full chronicle</button>
                    </div>
                    <button onClick={onRestart} className="btn btn-primary btn-sm">
                        <RotateCcw className="w-3.5 h-3.5" /> New simulation
                    </button>
                </div>
            </div>

            {activeTab === 'replay' ? (
                <div className="space-y-4 animate-fadeIn">
                    <ReplayFallenStrip
                        tributes={gameState.tributes}
                        finalDay={finalDay}
                        selectedDay={replayDay}
                        onSelectDay={setReplayDay}
                    />
                    <ReplayScrubber
                        tributes={gameState.tributes}
                        log={gameState.log}
                        finalDay={finalDay}
                        day={replayDay}
                        onDayChange={setReplayDay}
                    />
                </div>
            ) : activeTab === 'logs' ? (
                <div className="panel p-5 space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <h3 className="panel-title">Chronicle archive — {gameState.log.length} events</h3>
                        <ChronicleExport gameState={gameState} />
                    </div>
                    <div className="max-h-[620px] overflow-y-auto pr-2 custom-scrollbar">
                        <EventFeed logs={gameState.log} cast={gameState.tributes} onSelectTribute={setSelectedTributeId} defaultExpanded />
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                    {/* §2.3: the debrief opened with cause-of-death counts. The run's
                        actual story — the price they carried, what the arena made of
                        them, who they lost — was all on the state and nowhere on the
                        page. It goes first now, because it is the thing a player came
                        back to the page to read. */}
                    {winner && <VictorArc gameState={gameState} victor={winner} />}

                    {/* §2.3: near misses are the strongest replay hook already in the
                        codebase — "2 short of a toll collector" is a better reason to
                        press New Simulation than anything else on this page — and they
                        were the third panel down in default styling. */}
                    {outcome && outcome.nearMisses && outcome.nearMisses.length > 0 && (
                        <div className="md:col-span-2 panel p-5 space-y-2"
                            style={{ borderColor: 'var(--cat-sponsor)', borderWidth: '3px' }}>
                            <span className="eyebrow" style={{ color: 'var(--cat-sponsor)' }}>So close — go again</span>
                            {outcome.nearMisses.map(m => (
                                <div key={m.id} className="panel-flush p-2.5">
                                    <div className="text-sm font-bold text-[var(--ink)]">{m.name}</div>
                                    <div className="text-[11px] text-[var(--color-ink-500)]">{m.detail}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* The record book only ever reacted to a personal best. Most of
                        what makes a run memorable is not a record — it is the two or
                        three unusual things that happened, measured against this
                        player's own Panem. */}
                    {outcome && outcome.notables && outcome.notables.length > 0 && (
                        <div className="md:col-span-2 panel p-5 space-y-2"
                            style={{ borderColor: 'var(--red)', borderWidth: '3px' }}>
                            <span className="eyebrow" style={{ color: 'var(--red)' }}>
                                What made these Games unusual
                            </span>
                            {outcome.notables.map(n => (
                                <p key={n.text} className="text-sm text-[var(--color-ink-200)] leading-relaxed">{n.text}</p>
                            ))}
                        </div>
                    )}

                    {outcome && (outcome.newAchievements.length > 0 || outcome.brokenRecords.length > 0) && (
                        <div className="md:col-span-2 panel p-5 space-y-3"
                            style={{ borderColor: 'var(--cat-alliance)', borderWidth: '3px' }}>
                            <span className="eyebrow" style={{ color: 'var(--cat-alliance)' }}>
                                First time you have seen this
                            </span>
                            {outcome.newAchievements.map(id => {
                                const found = ACHIEVEMENTS.find(a => a.id === id) ?? META_ACHIEVEMENTS.find(a => a.id === id);
                                if (!found) return null;
                                return (
                                    <div key={id} className="panel-flush p-2.5">
                                        <div className="text-sm font-bold text-[var(--ink)]">{found.name}</div>
                                        <div className="text-[11px] text-[var(--color-ink-500)]">{found.hint}</div>
                                    </div>
                                );
                            })}
                            {outcome.brokenRecords.map(id => {
                                const def = RECORD_DEFS.find(r => r.id === id);
                                const held = outcome.records.bests[id];
                                if (!def || !held) return null;
                                return (
                                    <div key={id} className="panel-flush p-2.5">
                                        <div className="text-sm font-bold text-[var(--ink)]">
                                            New record — {def.label}
                                        </div>
                                        <div className="text-[11px] text-[var(--color-ink-500)]">
                                            {held.name} (D{held.district}) · {def.format(held.value)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {betWonMessage && (
                        <div className="md:col-span-2 panel p-5 flex flex-wrap justify-between items-center gap-4"
                            style={{ borderColor: 'var(--color-coin-400)', borderWidth: '3px' }}>
                            <div className="space-y-1">
                                <span className="eyebrow text-[var(--color-coin-400)]">Capitol bet resolution</span>
                                <p className="text-sm text-[var(--color-ink-200)]">{betWonMessage}</p>
                            </div>
                            <div className="stat-tile">
                                <div className="eyebrow">Balance</div>
                                <div className="text-xl font-black text-[var(--color-coin-400)] font-mono">{coins}</div>
                            </div>
                        </div>
                    )}

                    {victors.length > 0 ? (
                        <div className="md:col-span-2 panel p-6 space-y-5"
                            style={{ borderColor: 'var(--gold)', borderWidth: '3px' }}>
                            <span className="eyebrow text-[var(--color-gold-400)] flex items-center gap-1.5">
                                <Trophy className="w-4 h-4" /> {victors.length === 2 ? 'Two crowns — a first in living memory' : 'Crowned victor'}
                            </span>
                            {victors.map(v => (
                                <div key={v.id} className="flex flex-col md:flex-row justify-between items-center gap-6">
                                    <div className="space-y-2">
                                        <h3 className="display-title text-4xl">{v.name}</h3>
                                        <p className="text-[var(--color-ink-400)] text-sm">
                                            District {v.district} · walked out with{' '}
                                            <span className="text-[var(--cat-alliance)] font-bold">{v.health}% health</span>
                                            {v.trainingScore > 0 && <> · training score {v.trainingScore}</>}
                                        </p>
                                        <div className="flex flex-wrap gap-1 pt-1">
                                            {v.traits.map(t => <span key={t} className="chip">{t}</span>)}
                                        </div>
                                    </div>
                                    <div className="stat-tile min-w-[140px]">
                                        <div className="eyebrow">Eliminations</div>
                                        <div className="text-5xl font-black text-[var(--ink)] font-mono mt-1">{v.kills}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="md:col-span-2 panel p-6 text-center space-y-2">
                            <Skull className="w-8 h-8 mx-auto text-[var(--color-blood-500)]" />
                            <h3 className="display-title text-2xl">No Victor</h3>
                            <p className="text-[var(--color-ink-400)] text-sm">
                                The arena took every last tribute. The Capitol will be editing this broadcast for weeks.
                            </p>
                        </div>
                    )}

                    <div className="panel p-5 space-y-3">
                        <h3 className="panel-title flex items-center gap-2 border-b border-[var(--color-ink-800)] pb-2">
                            <Swords className="w-3.5 h-3.5 text-[var(--cat-death)]" /> Kill leaderboard
                        </h3>
                        {killLeaderboard.length === 0 ? (
                            <div className="empty-state">Not one tribute killed another. The arena did all of it.</div>
                        ) : (
                            <div className="space-y-1.5">
                                {killLeaderboard.slice(0, 6).map((t, idx) => (
                                    <div key={t.id} className="panel-flush p-2.5 flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="text-[var(--color-ink-500)] font-bold font-mono">#{idx + 1}</span>
                                            <span className={`font-semibold truncate ${t.status === 'alive' ? 'text-[var(--cat-alliance)]' : 'text-[var(--color-ink-200)]'}`}>
                                                {t.name}
                                            </span>
                                            <span className="chip">D{t.district}</span>
                                        </div>
                                        <span className="chip chip-accent">{t.kills} {t.kills === 1 ? 'kill' : 'kills'}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="panel p-5 space-y-5">
                        <div>
                            <h3 className="panel-title flex items-center gap-2 border-b border-[var(--color-ink-800)] pb-2">
                                <MapPin className="w-3.5 h-3.5 text-[var(--cat-feast)]" /> Deadliest sector
                            </h3>
                            <div className="panel-flush p-3 mt-2.5 flex justify-between items-center gap-3">
                                <div className="min-w-0">
                                    <div className="font-bold text-[var(--ink)] truncate">{mostDangerousZone.name}</div>
                                    <div className="text-xs text-[var(--color-ink-500)] mt-0.5">Most bodies recovered</div>
                                </div>
                                <span className="chip chip-accent">{mostDangerousZone.count} {mostDangerousZone.count === 1 ? 'death' : 'deaths'}</span>
                            </div>
                        </div>

                        <div>
                            <h3 className="panel-title">Cause of death</h3>
                            <div className="mt-2 space-y-1.5 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                                {causes.length === 0 ? (
                                    <div className="text-xs text-[var(--color-ink-500)] py-2">No fatalities recorded.</div>
                                ) : causes.map(([cause, count]) => (
                                    <div key={cause} className="space-y-1">
                                        <div className="flex justify-between text-xs font-mono">
                                            <span className="text-[var(--color-ink-200)]">{cause}</span>
                                            <span className="text-[var(--ink)] font-bold">
                                                {count} ({Math.round((count / Math.max(1, dead.length)) * 100)}%)
                                            </span>
                                        </div>
                                        <div className="meter">
                                            <span style={{ width: `${(count / Math.max(1, dead.length)) * 100}%`, background: 'var(--cat-death)' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="panel p-5 space-y-3 md:col-span-2">
                        <h3 className="panel-title border-b border-[var(--color-ink-800)] pb-2">Last standing, by district</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                            {lastStandingPerDistrict.map(t => (
                                <div key={t.id} className="panel-flush p-2.5 flex flex-col justify-between gap-1 min-h-[66px]">
                                    <div className="flex justify-between font-bold text-[var(--color-ink-400)]">
                                        <span>District {t.district}</span>
                                        <span className="eyebrow">{t.status === 'alive' ? 'Victor' : `Day ${t.dayOfDeath ?? '—'}`}</span>
                                    </div>
                                    <div className={`font-semibold truncate ${t.status === 'alive' ? 'text-[var(--cat-alliance)]' : 'text-[var(--color-ink-200)]'}`}>
                                        {t.name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="panel p-5 space-y-3 md:col-span-2">
                        <h3 className="panel-title border-b border-[var(--color-ink-800)] pb-2">Underdog watch — longest-surviving non-careers</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {longestNonCareers.map((t, index) => (
                                <div key={t.id} className="panel-flush p-3 flex items-center justify-between gap-3 text-sm">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[var(--color-ink-500)] font-bold font-mono text-xs">#{index + 1}</span>
                                            <span className={`font-semibold truncate ${t.status === 'alive' ? 'text-[var(--cat-alliance)]' : 'text-[var(--color-ink-200)]'}`}>
                                                {t.name}
                                            </span>
                                        </div>
                                        <p className="text-[var(--color-ink-500)] text-xs mt-0.5">District {t.district}</p>
                                    </div>
                                    <span className="chip">
                                        {t.status === 'alive' ? 'Survived' : `Day ${t.dayOfDeath ?? '—'}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {selectedTribute && (
                <TributeModal
                    tribute={selectedTribute}
                    gameState={gameState}
                    onClose={() => setSelectedTributeId(null)}
                />
            )}
        </div>
    );
}
