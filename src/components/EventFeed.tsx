import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EventLog, Tribute } from '../models/types';
import { categoryMeta } from '../ui/eventStyles';
import { tributeColorVar } from '../ui/tributeColor';

/** Cap on rendered rows before older entries collapse behind a "show earlier" control (UX-04). */
export const VISIBLE_CAP = 200;

/**
 * A cannon-worthy death, given the weight of one.
 *
 * A death used to be one more line in a scrolling list, visually identical to a
 * tribute finding a berry bush. The simulation treats a death as the most
 * significant thing that can happen; the feed did not. The interstitial breaks
 * the column, names the tribute and their district, and carries the portrait
 * slot the roster screens use.
 */
function DeathCard({ log, tribute, animate, cast, onSelectTribute }: {
    log: EventLog;
    tribute?: Tribute;
    animate: boolean;
    cast?: Tribute[];
    onSelectTribute?: (id: string) => void;
}) {
    const meta = categoryMeta(log.category);
    return (
        <div
            className={`panel-flush border-l-[6px] p-3.5 my-2 ${animate ? 'animate-riseIn' : ''}`}
            style={{ borderLeftColor: meta.color, background: 'color-mix(in srgb, var(--cat-death) 8%, var(--paper-panel))' }}
        >
            <div className="flex items-start gap-3">
                <div
                    className="flex-none w-11 h-11 flex items-center justify-center border-2 border-[var(--ink)] bg-[var(--paper-flush)]"
                    aria-hidden="true"
                >
                    <span className="font-mono text-[11px] font-black text-[var(--color-ink-500)]">
                        {tribute ? `D${tribute.district}` : '—'}
                    </span>
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="eyebrow" style={{ color: meta.color }}>{meta.label}</span>
                        {tribute && (
                            <span className="font-black uppercase text-sm text-[var(--ink)]">
                                {tribute.name}
                                <span className="font-mono font-bold text-[10px] text-[var(--color-ink-500)] ml-1.5">
                                    District {tribute.district} · {tribute.gender === 'Male' ? 'M' : 'F'} · age {tribute.age}
                                </span>
                            </span>
                        )}
                    </div>
                    <p className="text-sm mt-1 text-[var(--color-ink-200)] leading-snug">
                        {withTributeLinks(log.text, cast, log.tributesInvolved, onSelectTribute)}
                    </p>
                </div>
            </div>
        </div>
    );
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * §2.2: puts a link to one chronicle line on the clipboard.
 *
 * The existing share button copies the seed, which reproduces the whole run
 * and leaves the reader to find the moment. This addresses the other half:
 * the URL names the entry, and `EventFeed` scrolls to it (expanding past the
 * visible cap first) when somebody follows it.
 */
async function copyLineLink(id: string, onCopied: (id: string | null) => void) {
    // Keep the seed-replay query (`?seed=…&arena=…`) if the current URL has
    // one — without it the recipient has no run to scroll, and `#/arena`
    // would just fall back to setup. The route is `/arena`, not `/game`:
    // the old path matched nothing and every copied link landed on setup.
    const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    try {
        await navigator.clipboard.writeText(`${base}#/arena?line=${encodeURIComponent(id)}`);
        onCopied(id);
        setTimeout(() => onCopied(null), 2000);
    } catch {
        // Clipboard permission refused: nothing useful to say, and a failed
        // copy must not take the chronicle down with it.
    }
}

/**
 * Marks up the tribute names inside a log line.
 *
 * A reader could not tell District 4's girl from District 9's boy anywhere in
 * the chronicle: the feed printed bare names and nothing tied a name to a
 * district, a gender, or a profile. Only names already recorded in
 * `tributesInvolved` are matched, so this can never invent a link out of a
 * coincidental word in the flavour text.
 */
function withTributeLinks(
    text: string,
    cast: Tribute[] | undefined,
    involved: string[],
    onSelect?: (id: string) => void,
): React.ReactNode {
    if (!cast || involved.length === 0) return text;
    const people = involved
        .map(id => cast.find(t => t.id === id))
        .filter((t): t is Tribute => !!t);
    if (people.length === 0) return text;

    // Longest first, so "Anna Marie" is not clipped by a cast member called "Anna".
    const ordered = [...people].sort((a, b) => b.name.length - a.name.length);
    const pattern = new RegExp(`(${ordered.map(p => escapeRegex(p.name)).join('|')})`, 'g');
    const parts = text.split(pattern);

    return parts.map((part, i) => {
        const person = ordered.find(p => p.name === part);
        if (!person) return part;
        return (
            <button
                key={`${person.id}-${i}`}
                type="button"
                onClick={() => onSelect?.(person.id)}
                title={`${person.name} — District ${person.district}, ${person.gender}, age ${person.age}${person.status === 'dead' ? ' (deceased)' : ''}`}
                // §2.2: the colour is the same one this tribute wears on the
                // map, the odds board and the relationship graph.
                style={tributeColorVar(person.district, person.gender)}
                className="tribute-chip font-bold underline decoration-dotted underline-offset-2 hover:text-[var(--red)] focus-visible:outline focus-visible:outline-1"
            >
                {part}
                <span className="font-mono text-[9px] font-black text-[var(--color-ink-500)] ml-0.5 align-super">
                    {person.district}{person.gender === 'Male' ? 'M' : 'F'}
                </span>
            </button>
        );
    });
}

export function FeedLine({ log, showTag = true, animate = true, cast, onSelectTribute }: {
    log: EventLog;
    showTag?: boolean;
    animate?: boolean;
    /** Supplied by the chronicle so a death can be rendered with its victim's details. */
    cast?: Tribute[];
    /** Clicking a name in the line opens that tribute's profile. */
    onSelectTribute?: (id: string) => void;
}) {
    const meta = categoryMeta(log.category);

    if (cast && (log.category === 'death' || log.category === 'kill')) {
        // The victim is the involved tribute who actually died — for a kill the
        // list is [killer, victim], so picking the dead one is more reliable
        // than picking by position.
        const involved = log.tributesInvolved
            .map(id => cast.find(t => t.id === id))
            .filter((t): t is Tribute => !!t);
        const victim = involved.find(t => t.status === 'dead') ?? involved[involved.length - 1];
        return <DeathCard log={log} tribute={victim} animate={animate} cast={cast} onSelectTribute={onSelectTribute} />;
    }

    return (
        <div
            className={`feed-item ${animate ? 'animate-riseIn' : ''} ${log.important ? 'is-important' : ''}`}
            style={{ ['--cat' as string]: meta.color }}
        >
            {showTag && <span className="feed-tag">{meta.label}</span>}
            {withTributeLinks(log.text, cast, log.tributesInvolved, onSelectTribute)}
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

/**
 * The anthem.
 *
 * Canon and good pacing agree here: the day's fallen are read out at nightfall.
 * It is a natural break in a feed that otherwise runs continuously, and it is
 * the one moment the reader gets a roll-call rather than a stream.
 */
function AnthemCard({ day, fallen }: { day: number; fallen: Tribute[] }) {
    return (
        <div className="panel p-4 my-3" style={{ background: 'var(--ink)', borderColor: 'var(--red)' }}>
            <div className="text-center space-y-1 mb-3">
                <div className="eyebrow" style={{ color: 'var(--red)' }}>The anthem plays</div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#a89a86]">
                    Day {day} · {fallen.length} fallen
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {fallen.map(t => (
                    <div key={t.id} className="text-center border border-[#3a332c] py-2 px-1">
                        <div className="font-mono text-[10px] font-black text-[var(--red)]">D{t.district}</div>
                        <div className="text-xs font-bold text-white truncate">{t.name}</div>
                        <div className="text-[9px] font-mono uppercase tracking-wider text-[#a89a86] truncate">
                            {t.gender === 'Male' ? 'Male' : 'Female'} · {t.age}
                        </div>
                        {t.causeOfDeath && (
                            <div className="text-[9px] text-[#8a7d6d] mt-0.5 leading-tight">{t.causeOfDeath}</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export type FeedDensity = 'compact' | 'comfortable' | 'prose';

export function EventFeed({ logs, showTags = true, cast, onSelectTribute, density = 'comfortable', highlightId }: {
    logs: EventLog[];
    showTags?: boolean;
    cast?: Tribute[];
    onSelectTribute?: (id: string) => void;
    /** §2.2: how much room each entry gets. See `.feed-compact` / `.feed-prose`. */
    density?: FeedDensity;
    /** §2.2: a line deep-linked from a shared URL, scrolled to and marked. */
    highlightId?: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
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

    // §2.2: a shared link naming one chronicle line lands on that line.
    useEffect(() => {
        if (!highlightId) return;
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        // The entry may be behind the visible cap; expanding first is what
        // makes a link to an early moment in a long run actually resolve.
        if (!logs.slice(-VISIBLE_CAP).some(l => l.id === highlightId)) setExpanded(true);
        requestAnimationFrame(() => {
            document.getElementById(`line-${highlightId}`)
                ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
        });
    }, [highlightId, logs]);

    const visibleLogs = expanded ? logs : logs.slice(Math.max(0, logs.length - VISIBLE_CAP));
    const hiddenCount = logs.length - visibleLogs.length;
    const groups = groupLogs(visibleLogs).reverse();
    // Distinct days currently visible, newest first, for the jump rail.
    const days = useMemo(
        () => [...new Set(groups.map(([, entries]) => entries[0]?.day ?? 0))],
        // groups derives from visibleLogs; keying on it keeps this cheap.
        [visibleLogs]  // eslint-disable-line react-hooks/exhaustive-deps
    );

    return (
        // §2.3: a continuously-updating feed with auto-advance is exactly the
        // case screen readers need announced. role="log" implies polite
        // announcements of additions without re-reading the whole region.
        <div
            className={`space-y-6 ${density === 'compact' ? 'feed-compact' : density === 'prose' ? 'feed-prose' : ''}`}
            role="log"
            aria-label="Chronicle of the Games"
        >
            {/* §2.2: with ~900 entries across 8+ days there was no way to jump
                to a day — only scroll or search. */}
            {days.length > 2 && (
                <nav aria-label="Jump to day" className="sticky top-0 z-10 flex flex-wrap gap-1 py-1.5 -my-1.5"
                    style={{ background: 'var(--paper, var(--color-paper, transparent))' }}>
                    {days.map(d => (
                        <button
                            key={d}
                            className="btn btn-sm btn-ghost font-mono text-[10px]"
                            aria-label={d === 0 ? 'Jump to before the Games' : `Jump to day ${d}`}
                            onClick={() => {
                                const nodes = document.querySelectorAll(`[data-day="${d}"]`);
                                // A smooth scroll is an animation like any other:
                                // honour the reduced-motion preference here too.
                                const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                                nodes[nodes.length - 1]?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
                            }}
                        >
                            {d === 0 ? 'Start' : `D${d}`}
                        </button>
                    ))}
                </nav>
            )}
            {hiddenCount > 0 && (
                <button onClick={() => setExpanded(true)} className="btn btn-sm btn-ghost w-full justify-center">
                    Show {hiddenCount} earlier entries
                </button>
            )}
            {groups.map(([key, entries]) => {
                // The roll-call belongs at the end of the day it covers. Sections
                // render newest-first, so it sits above the night's entries.
                const dayOfSection = entries[0]?.day ?? 0;
                const isNight = entries[0]?.phase === 'night';
                const fallenToday = isNight && cast
                    ? cast.filter(t => t.status === 'dead' && t.dayOfDeath === dayOfSection)
                    : [];
                return (
                <section key={key} data-day={dayOfSection} className="space-y-2.5">
                    <h3 className="day-divider panel-title border-b border-[var(--color-ink-800)] pb-1.5 flex items-center justify-between">
                        <span>{key}</span>
                        <span className="text-[var(--color-ink-600)]">{entries.length} entries</span>
                    </h3>
                    {fallenToday.length > 0 && <AnthemCard day={dayOfSection} fallen={fallenToday} />}
                    <div className="space-y-1.5">
                        {[...entries].reverse().map(log => (
                            <div
                                key={log.id}
                                id={`line-${log.id}`}
                                className="group relative"
                                style={log.id === highlightId
                                    ? { outline: '2px solid var(--red)', outlineOffset: '2px' }
                                    : undefined}
                            >
                                <FeedLine log={log} showTag={showTags} animate={newIds.has(log.id)} cast={cast} onSelectTribute={onSelectTribute} />
                                {/* §2.2: share the moment, not just the seed.
                                    Hidden until the row is hovered or the
                                    button itself is focused, so the feed does
                                    not grow 500 buttons of visual noise. */}
                                <button
                                    type="button"
                                    onClick={() => copyLineLink(log.id, setCopiedId)}
                                    aria-label="Copy a link to this moment"
                                    title={copiedId === log.id ? 'Link copied' : 'Copy a link to this moment'}
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 btn btn-sm btn-ghost text-[10px] font-mono"
                                >
                                    {copiedId === log.id ? 'copied' : 'link'}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
                );
            })}
        </div>
    );
}
