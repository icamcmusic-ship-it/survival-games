import React, { useMemo, useState } from 'react';
import { Tribute } from '../models/types';
import { Skull } from 'lucide-react';

/**
 * The shape of a run is a story the aggregate panels can't tell: a bloodbath
 * spike, a quiet middle, an endgame cluster. This strip plots one marker per
 * death against the day it happened, so the run's rhythm is legible at a glance
 * and each body is still individually identifiable.
 */
export function ReplayFallenStrip({
    tributes,
    finalDay,
    selectedDay,
    onSelectDay
}: {
    tributes: Tribute[];
    finalDay: number;
    selectedDay?: number;
    onSelectDay?: (day: number) => void;
}) {
    // Hover and click both feed one selection slot — hovering previews, clicking
    // pins — so a keyboard user (who gets focus, not hover) sees the same detail.
    const [active, setActive] = useState<string | null>(null);

    const byDay = useMemo(() => {
        const map = new Map<number, Tribute[]>();
        tributes
            .filter(t => t.status === 'dead')
            .forEach(t => {
                // A dead tribute with no recorded day can't be placed on a timeline;
                // bucket them separately rather than inventing a day for them.
                const day = t.dayOfDeath ?? -1;
                const bucket = map.get(day);
                if (bucket) bucket.push(t);
                else map.set(day, [t]);
            });
        return map;
    }, [tributes]);

    const undated = byDay.get(-1) ?? [];
    const days = Array.from({ length: Math.max(1, finalDay) }, (_, i) => i + 1);
    const peak = Math.max(1, ...days.map(d => (byDay.get(d) ?? []).length));
    const totalDead = tributes.filter(t => t.status === 'dead').length;

    const activeTribute = active ? tributes.find(t => t.id === active) : undefined;

    if (totalDead === 0) {
        return (
            <div className="panel p-5 space-y-3">
                <h3 className="panel-title flex items-center gap-2 border-b border-[var(--color-ink-800)] pb-2">
                    <Skull className="w-3.5 h-3.5 text-[var(--cat-death)]" /> The fallen — timeline
                </h3>
                <div className="empty-state">Nobody died. The Capitol is not amused.</div>
            </div>
        );
    }

    return (
        <div className="panel p-5 space-y-3">
            <h3 className="panel-title flex items-center gap-2 justify-between border-b border-[var(--color-ink-800)] pb-2">
                <span className="flex items-center gap-2">
                    <Skull className="w-3.5 h-3.5 text-[var(--cat-death)]" /> The fallen — timeline
                </span>
                <span className="text-[var(--color-ink-600)]">{totalDead} dead over {finalDay} {finalDay === 1 ? 'day' : 'days'}</span>
            </h3>

            <div className="overflow-x-auto pb-1 custom-scrollbar">
                <ul className="flex items-end gap-1.5 min-w-full" style={{ listStyle: 'none' }}>
                    {days.map(day => {
                        const fallen = byDay.get(day) ?? [];
                        const isSelected = selectedDay === day;
                        return (
                            <li
                                key={day}
                                className="flex flex-col justify-end gap-1 flex-1"
                                style={{ minWidth: '104px' }}
                            >
                                <div className="flex flex-col gap-1 justify-end" style={{ minHeight: `${peak * 30}px` }}>
                                    {fallen.map(t => {
                                        const isActive = active === t.id;
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onMouseEnter={() => setActive(t.id)}
                                                onFocus={() => setActive(t.id)}
                                                onClick={() => { setActive(t.id); onSelectDay?.(day); }}
                                                aria-pressed={isActive}
                                                aria-label={`${t.name}, District ${t.district}, died day ${day}. Cause: ${t.causeOfDeath || 'unrecorded'}.`}
                                                className="panel-flush px-1.5 py-1 text-left text-[11px] leading-tight w-full truncate"
                                                style={{
                                                    borderLeft: '3px solid var(--cat-death)',
                                                    background: isActive ? 'var(--paper-panel)' : undefined,
                                                    outline: isActive ? '2px solid var(--cat-death)' : undefined
                                                }}
                                            >
                                                <span className="font-mono text-[var(--color-ink-500)]">D{t.district}</span>{' '}
                                                <span className="text-[var(--color-ink-200)] font-semibold">{t.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onSelectDay?.(day)}
                                    aria-label={`Jump to day ${day} — ${fallen.length} ${fallen.length === 1 ? 'death' : 'deaths'}`}
                                    className="text-[11px] font-mono px-1 py-0.5 border-t"
                                    style={{
                                        borderColor: isSelected ? 'var(--red)' : 'var(--line-soft)',
                                        borderTopWidth: isSelected ? '3px' : '2px',
                                        color: isSelected ? 'var(--red)' : 'var(--color-ink-500)'
                                    }}
                                >
                                    Day {day} · {fallen.length}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {undated.length > 0 && (
                <p className="text-xs text-[var(--color-ink-500)]">
                    {undated.length} {undated.length === 1 ? 'death has' : 'deaths have'} no recorded day and cannot be placed on the timeline:{' '}
                    {undated.map(t => t.name).join(', ')}.
                </p>
            )}

            <div className="panel-flush p-3 text-sm min-h-[64px]">
                {activeTribute ? (
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[var(--color-ink-200)]">{activeTribute.name}</span>
                            <span className="chip">D{activeTribute.district}</span>
                            <span className="chip chip-accent">Day {activeTribute.dayOfDeath ?? '—'}</span>
                            {activeTribute.kills > 0 && <span className="chip">{activeTribute.kills} {activeTribute.kills === 1 ? 'kill' : 'kills'}</span>}
                        </div>
                        <p className="text-xs text-[var(--color-ink-400)]">
                            {activeTribute.causeOfDeath || 'Cause of death unrecorded.'}
                        </p>
                        {activeTribute.zone && (
                            <p className="text-xs text-[var(--color-ink-500)]">Body recovered in {activeTribute.zone}.</p>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-[var(--color-ink-500)]">
                        Hover or select a marker for the cause of death. Column height is the day's body count.
                    </p>
                )}
            </div>
        </div>
    );
}
