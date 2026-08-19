import React from 'react';
import { EventLog } from '../models/types';
import { categoryMeta } from '../ui/eventStyles';

export function FeedLine({ log, showTag = true }: { log: EventLog; showTag?: boolean }) {
    const meta = categoryMeta(log.category);
    return (
        <div
            className={`feed-item animate-riseIn ${log.important ? 'is-important' : ''}`}
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
    return (
        <div className="space-y-6">
            {groupLogs(logs).reverse().map(([key, entries]) => (
                <section key={key} className="space-y-2.5">
                    <h3 className="panel-title border-b border-[var(--color-ink-800)] pb-1.5 flex items-center justify-between">
                        <span>{key}</span>
                        <span className="text-[var(--color-ink-600)]">{entries.length} entries</span>
                    </h3>
                    <div className="space-y-1.5">
                        {entries.map(log => (
                            <FeedLine key={log.id} log={log} showTag={showTags} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
