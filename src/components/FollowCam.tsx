import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import { EventLog, GameState } from '../models/types';
import { ChronicleState, setChronicle, togglePin } from '../store/chronicleStore';
import { gameActions } from '../store/gameStore';
import { dayPhaseLabel } from '../ui/phaseLabels';
import { Hint } from './Hint';

/**
 * AUDIT-11 §4 follow-cam: up to three pinned tributes, a toggle that narrows
 * the feed to beats involving them, and a "their day" card summarising the
 * latest phase from each pinned tribute's side.
 */
export interface TheirPhase {
    id: string;
    beats: number;
    kills: number;
    headline?: string;
}

/** Pure: what each pinned tribute's last logged phase amounted to. */
export function summarisePhase(log: EventLog[], pinnedIds: string[]): { day: number; phase: GameState['phase'] } & { rows: TheirPhase[] } | null {
    const last = log[log.length - 1];
    if (!last || pinnedIds.length === 0) return null;
    const phaseLines: EventLog[] = [];
    for (let i = log.length - 1; i >= 0; i--) {
        const l = log[i];
        if (l.day !== last.day || l.phase !== last.phase) break;
        phaseLines.push(l);
    }
    phaseLines.reverse();
    const rows = pinnedIds.map(id => {
        const mine = phaseLines.filter(l => l.tributesInvolved.includes(id));
        const kills = mine.filter(l => l.category === 'kill' && (l.actorId ?? l.tributesInvolved[0]) === id).length;
        const headline = [...mine].reverse().find(l => l.important)?.text ?? mine[mine.length - 1]?.text;
        return { id, beats: mine.length, kills, headline };
    });
    return { day: last.day, phase: last.phase, rows };
}

export function FollowCam({ gameState, filters }: { gameState: GameState; filters: ChronicleState }) {
    const pinned = filters.pinnedIds
        .map(id => gameState.tributes.find(t => t.id === id))
        .filter((t): t is NonNullable<typeof t> => !!t);
    const summary = useMemo(() => summarisePhase(gameState.log, filters.pinnedIds), [gameState.log, filters.pinnedIds]);
    if (pinned.length === 0) return null;
    return (
        <div className="space-y-2" data-testid="follow-cam">
            <div className="flex flex-wrap items-center gap-2">
                {pinned.map(t => (
                    <span key={t.id} className="chip chip-accent inline-flex items-center gap-1">
                        <Star className="w-3 h-3" aria-hidden="true" />
                        {t.name}{t.status === 'dead' ? ' †' : ''}
                        <Hint text="Open the chronicle filtered to their story">
                            <button
                                className="underline ml-1"
                                onClick={() => {
                                    setChronicle({ filterTributeId: t.id, filterTributeId2: null });
                                    gameActions.setView('chronicle');
                                }}
                            >
                                story
                            </button>
                        </Hint>
                        <button className="underline ml-1" onClick={() => togglePin(t.id)} aria-label={`Stop following ${t.name}`}>×</button>
                    </span>
                ))}
                <button
                    className="seg-item"
                    aria-pressed={filters.followOnly}
                    onClick={() => setChronicle({ followOnly: !filters.followOnly })}
                >
                    {filters.followOnly ? 'Showing only their beats' : 'Only their beats'}
                </button>
                {pinned.length < 3 && <span className="text-micro text-[var(--color-ink-500)]">Pin up to 3 with ★</span>}
            </div>
            {summary && (
                <div className="panel-flush p-2 space-y-1" aria-label="Their day">
                    <div className="eyebrow">Their {dayPhaseLabel(summary.day, summary.phase)}</div>
                    {summary.rows.map(r => {
                        const t = gameState.tributes.find(x => x.id === r.id)!;
                        return (
                            <div key={r.id} className="text-xs text-[var(--color-ink-300)]">
                                <span className="font-bold text-[var(--ink)]">{t.name}</span>
                                {' — '}
                                {t.status === 'dead' ? 'fallen' : `${Math.round(t.health)} hp, ${t.stance.toLowerCase()}${t.zone ? ` in ${t.zone}` : ''}`}
                                {' · '}{r.beats === 0 ? 'off camera' : `${r.beats} beat${r.beats === 1 ? '' : 's'}`}
                                {r.kills > 0 && ` · ${r.kills} kill${r.kills === 1 ? '' : 's'}`}
                                {r.headline && <div className="italic text-[var(--color-ink-400)] truncate">{r.headline}</div>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
