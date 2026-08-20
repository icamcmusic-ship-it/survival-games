import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EventLog } from '../models/types';
import { categoryMeta } from '../ui/eventStyles';

/** Cap on rendered rows before older entries collapse behind a "show earlier" control (UX-04). */
const VISIBLE_CAP = 200;

export function FeedLine({ log, showTag = true, animate = true }: { log: EventLog; showTag?: boolean; animate?: boolean }) {
    const meta = categoryMeta(log.category);
    return (
        <div
            className={`feed-item ${animate ? 'animate-riseIn' : ''} ${log.important ? 'is-important' : ''}`}
            style={{ ['--cat' as string]: meta.color }}
        >
            {showTag && <span className="feed-tag">{meta.label}</span>}
            {log.text}
        </div>
    );
}

/** Groups a log list into "Day N — Phase" sections, newest section first. */
export function groupLogs(logs: EventLog[]): Array<[string, EventLog[]]> {
    const groups: Array<[string, EventLog[]]> = [];
    const index = new Map<string, EventLog[]>();
    logs.forEach(log => {
        const key = log.day === 0
            ? log.phase.charAt(0).toUpperCase() + log.phase.slice(1)
            : `Day ${log.day} — ${log.phase.charAt(0).toUpperCase() + log.phase.slice(1)}`;
        let bucket = index.get(key);
        if (!bucket) {
            bucket = [];
            index.set(key, bucket);
            groups.push([key, bucket]);
        }
        bucket.push(log);
    });
    return groups;
}

export function EventFeed({ logs, showTags = true }: { logs: EventLog[]; showTags?: boolean }) {
    const [expanded, setExpanded] = useState(false);
    // Only entries that are genuinely new since the last render get the rise-in
    // animation — otherwise every re-render (e.g. an unrelated store update)
    // replays the animation across the whole list and the feed flickers.
    const seenIds = useRef<Set<string>>(new Set());
    const newIds = useMemo(() => {
        const fresh = new Set<string>();
        for (const log of logs) {
            if (!seenIds.current.has(log.id)) fresh.add(log.id);
        }
        return fresh;
    }, [logs]);
    useEffect(() => {
        logs.forEach(log => seenIds.current.add(log.id));
    }, [logs]);

    const visibleLogs = expanded ? logs : logs.slice(Math.max(0, logs.length - VISIBLE_CAP));
    const hiddenCount = logs.length - visibleLogs.length;
    const groups = groupLogs(visibleLogs).reverse();

    return (
        <div className="space-y-6">
            {hiddenCount > 0 && (
                <button onClick={() => setExpanded(true)} className="btn btn-sm btn-ghost w-full justify-center">
                    Show {hiddenCount} earlier entries
                </button>
            )}
            {groups.map(([key, entries]) => (
                <section key={key} className="space-y-2.5">
                    <h3 className="panel-title border-b border-[var(--color-ink-800)] pb-1.5 flex items-center justify-between">
                        <span>{key}</span>
                        <span className="text-[var(--color-ink-600)]">{entries.length} entries</span>
                    </h3>
                    <div className="space-y-1.5">
                        {[...entries].reverse().map(log => (
                            <FeedLine key={log.id} log={log} showTag={showTags} animate={newIds.has(log.id)} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
