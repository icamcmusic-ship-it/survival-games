import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EventLog, Tribute } from '../models/types';
import { FeedLine, groupLogs } from './EventFeed';
import { ChevronLeft, ChevronRight, Pause, Play, History } from 'lucide-react';

/** Milliseconds per day while auto-advancing. Slow enough to actually read a day. */
const PLAY_INTERVAL = 1800;

interface Snapshot {
    /** Alive as of the end of the scrubbed day. */
    standing: Tribute[];
    /** Already dead by then, most recent death first. */
    fallen: Tribute[];
    /** Died on this exact day. */
    fellToday: Tribute[];
    /** Tribute id -> last zone the chronicle placed them in, at or before this day. */
    zoneById: Map<string, string>;
    /** Tribute id -> kills the chronicle credits them with by this day. */
    killsById: Map<string, number>;
    logs: EventLog[];
}

/**
 * Rebuilds the board as of the end of a given day.
 *
 * Only three things are honestly recoverable after the fact: who was alive
 * (from `dayOfDeath`), where the chronicle last placed someone (the most recent
 * logged event carrying a zone that involved them), and who they had killed
 * (kill entries name `[killer, victim]`). Health, vitals, inventories and
 * alliances are only stored as end-of-run values, so they are deliberately
 * absent here rather than being back-filled with the final numbers.
 */
function reconstruct(tributes: Tribute[], log: EventLog[], day: number): Snapshot {
    const zoneById = new Map<string, string>();
    // A single kill can emit several log lines (the blow, the looting, a
    // vengeance beat), so count distinct killer->victim pairs, not entries.
    const killPairs = new Set<string>();

    for (const entry of log) {
        if (entry.day > day) break;
        if (entry.zone) {
            entry.tributesInvolved.forEach(id => zoneById.set(id, entry.zone as string));
        }
        if (entry.category === 'kill' && entry.tributesInvolved.length >= 2) {
            killPairs.add(`${entry.tributesInvolved[0]}>${entry.tributesInvolved[1]}`);
        }
    }

    const killsById = new Map<string, number>();
    killPairs.forEach(pair => {
        const killer = pair.split('>')[0];
        killsById.set(killer, (killsById.get(killer) ?? 0) + 1);
    });

    const diedBy = (t: Tribute) => t.status === 'dead' && t.dayOfDeath !== undefined && t.dayOfDeath <= day;
    const fallen = tributes.filter(diedBy).sort((a, b) => (b.dayOfDeath ?? 0) - (a.dayOfDeath ?? 0));

    return {
        // Anyone not yet recorded dead was, as far as the chronicle knows, still standing.
        standing: tributes.filter(t => !diedBy(t)),
        fallen,
        fellToday: fallen.filter(t => t.dayOfDeath === day),
        zoneById,
        killsById,
        logs: log.filter(entry => entry.day === day)
    };
}

export function ReplayScrubber({
    tributes,
    log,
    finalDay,
    day,
    onDayChange
}: {
    tributes: Tribute[];
    log: EventLog[];
    finalDay: number;
    day: number;
    onDayChange: (day: number) => void;
}) {
    const [playing, setPlaying] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const snapshot = useMemo(() => reconstruct(tributes, log, day), [tributes, log, day]);

    useEffect(() => {
        if (!playing) return;
        if (day >= finalDay) { setPlaying(false); return; }
        const timer = window.setTimeout(() => onDayChange(day + 1), PLAY_INTERVAL);
        return () => window.clearTimeout(timer);
    }, [playing, day, finalDay, onDayChange]);

    const label = day === 0 ? 'Pre-Games' : `Day ${day}`;
    const valueText = day === 0
        ? 'Pre-Games — reaping, training and interviews'
        : `Day ${day} of ${finalDay} — ${snapshot.standing.length} standing, ${snapshot.fallen.length} fallen`;

    const step = (delta: number) => {
        setPlaying(false);
        onDayChange(Math.min(finalDay, Math.max(0, day + delta)));
    };

    // Arrow keys anywhere in the replay section scrub the run. The range input
    // handles its own arrows natively, so skip it to avoid double-stepping.
    const onKeyDown = (e: React.KeyboardEvent) => {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    };

    const groups = groupLogs(snapshot.logs);

    return (
        <div ref={containerRef} onKeyDown={onKeyDown} className="panel p-5 space-y-4">
            <h3 className="panel-title flex items-center gap-2 justify-between border-b border-[var(--color-ink-800)] pb-2">
                <span className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-[var(--cat-travel)]" /> Replay the run
                </span>
                <span className="text-[var(--color-ink-600)]">{label}</span>
            </h3>

            <div className="field space-y-2">
                <label htmlFor="replay-day" className="eyebrow block">
                    Rewind to the end of — {label}
                </label>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => step(-1)}
                        disabled={day <= 0}
                        aria-label="Previous day"
                        className="btn btn-ghost btn-sm"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <input
                        id="replay-day"
                        type="range"
                        min={0}
                        max={finalDay}
                        step={1}
                        value={day}
                        onChange={e => { setPlaying(false); onDayChange(Number(e.target.value)); }}
                        aria-valuetext={valueText}
                        className="flex-1"
                        style={{ accentColor: 'var(--red)' }}
                    />
                    <button
                        type="button"
                        onClick={() => step(1)}
                        disabled={day >= finalDay}
                        aria-label="Next day"
                        className="btn btn-ghost btn-sm"
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            // Replaying from the end would sit still, so restart the run.
                            if (!playing && day >= finalDay) onDayChange(0);
                            setPlaying(p => !p);
                        }}
                        disabled={finalDay === 0}
                        aria-label={playing ? 'Pause replay' : 'Play replay'}
                        aria-pressed={playing}
                        className="btn btn-sm btn-gold"
                    >
                        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {playing ? 'Pause' : 'Play'}
                    </button>
                </div>
                <p className="text-[11px] text-[var(--color-ink-500)]">
                    Left and right arrow keys scrub. Health, supplies and alliances aren't recorded per day, so this
                    shows only what the chronicle can prove: who was standing, where they were last seen, and their kills.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
                <div className="stat-tile">
                    <div className="eyebrow">Standing</div>
                    <div className="text-2xl font-black font-mono text-[var(--cat-alliance)]">{snapshot.standing.length}</div>
                </div>
                <div className="stat-tile">
                    <div className="eyebrow">Fallen</div>
                    <div className="text-2xl font-black font-mono text-[var(--cat-death)]">{snapshot.fallen.length}</div>
                </div>
                <div className="stat-tile">
                    <div className="eyebrow">Died {day === 0 ? 'pre-Games' : 'this day'}</div>
                    <div className="text-2xl font-black font-mono text-[var(--ink)]">{snapshot.fellToday.length}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <h4 className="panel-title">Board state — end of {label}</h4>
                    <div className="max-h-72 overflow-y-auto pr-1 custom-scrollbar space-y-1.5">
                        {snapshot.standing.map(t => {
                            const zone = snapshot.zoneById.get(t.id);
                            const kills = snapshot.killsById.get(t.id) ?? 0;
                            return (
                                <div key={t.id} className="panel-flush p-2 flex justify-between items-center gap-2 text-xs">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-[var(--color-ink-200)] truncate">{t.name}</span>
                                            <span className="chip">D{t.district}</span>
                                        </div>
                                        <p className="text-[var(--color-ink-500)] mt-0.5 truncate">
                                            {zone ? `Last seen — ${zone}` : 'Last position unrecorded'}
                                        </p>
                                    </div>
                                    <span className="chip chip-accent whitespace-nowrap">Alive · {kills}k</span>
                                </div>
                            );
                        })}
                        {snapshot.fallen.map(t => (
                            <div key={t.id} className="panel-flush p-2 flex justify-between items-center gap-2 text-xs opacity-70"
                                style={{ borderLeft: '3px solid var(--cat-death)' }}>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-[var(--color-ink-400)] truncate line-through">{t.name}</span>
                                        <span className="chip">D{t.district}</span>
                                    </div>
                                    <p className="text-[var(--color-ink-500)] mt-0.5 truncate">
                                        {t.causeOfDeath || 'Cause unrecorded'}
                                    </p>
                                </div>
                                <span className="chip whitespace-nowrap">
                                    Dead · day {t.dayOfDeath ?? '—'} · {snapshot.killsById.get(t.id) ?? 0}k
                                </span>
                            </div>
                        ))}
                        {snapshot.standing.length === 0 && snapshot.fallen.length === 0 && (
                            <div className="empty-state">No tributes on the board.</div>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <h4 className="panel-title">
                        {label} — {snapshot.logs.length} {snapshot.logs.length === 1 ? 'entry' : 'entries'}
                    </h4>
                    <div className="max-h-72 overflow-y-auto pr-1 custom-scrollbar space-y-4">
                        {groups.length === 0 ? (
                            <div className="empty-state">Nothing was broadcast on this day.</div>
                        ) : groups.map(([key, entries]) => (
                            <section key={key} className="space-y-1.5">
                                <h5 className="eyebrow">{key}</h5>
                                {entries.map(entry => (
                                    <FeedLine key={entry.id} log={entry} animate={false} />
                                ))}
                            </section>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
