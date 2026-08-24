import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EventCategory, EventLog, GameState, Tribute } from '../models/types';
import { copyMoment } from '../utils/chronicle';
import { categoryMeta } from '../ui/eventStyles';
import { prefsStore } from '../store/prefsStore';
import { useStore } from '../store/createStore';

/** Cap on rendered rows before older entries collapse behind a "show earlier" control (UX-04). */
export const VISIBLE_CAP = 200;

/**
 * Reading density. The old boolean (`important`, at 41% of all lines) filtered
 * almost nothing and muted whole groups as the only other lever. The feed now
 * reads in three tiers derived at render time — no save migration:
 *
 *  - headline: deaths, kills, betrayals, gamemaker moves, and the important
 *    alliance/romance/feast beats. The skeleton of the Games. ~8% of lines.
 *  - scene: combat, mutts, hazards, sponsors, arena and injuries — the action
 *    around the skeleton. ~25%.
 *  - ambient: travel, foraging, loot and broadcast chatter. The connective
 *    tissue, collapsed behind a disclosure by default.
 */
export type FeedTier = 'headline' | 'scene' | 'ambient';
export type FeedDensity = 'headlines' | 'scenes' | 'everything';

const HEADLINE_ALWAYS = new Set<EventCategory>(['death', 'kill', 'betrayal', 'gamemaker']);
const HEADLINE_IF_IMPORTANT = new Set<EventCategory>(['alliance', 'romance', 'feast']);
const SCENE = new Set<EventCategory>(['combat', 'mutt', 'hazard', 'sponsor', 'arena', 'injury', 'alliance', 'romance', 'feast', 'sanity', 'training', 'interview']);

export function tierOf(log: EventLog): FeedTier {
    if (HEADLINE_ALWAYS.has(log.category)) return 'headline';
    if (log.important && HEADLINE_IF_IMPORTANT.has(log.category)) return 'headline';
    if (SCENE.has(log.category)) return 'scene';
    // travel, survival, loot, system — plus anything new — reads as ambient
    // unless the engine flagged it important.
    return log.important ? 'scene' : 'ambient';
}

/**
 * A beat: one scene at one place, involving one set of people. The unit of
 * the feed is no longer a single log line — the engine already emits the
 * structure needed to group them (zone, category group, tributesInvolved),
 * so this is presentation only.
 */
export interface Beat {
    zone?: string;
    group: string;
    logs: EventLog[];
    cast: Set<string>;
}

const BEAT_MAX_LINES = 6;

export function groupBeats(entries: EventLog[]): Beat[] {
    const beats: Beat[] = [];
    let current: Beat | null = null;
    for (const log of entries) {
        const group = categoryMeta(log.category).group;
        const sharesCast = current
            && (log.tributesInvolved.length === 0
                || current.cast.size === 0
                || log.tributesInvolved.some(id => current!.cast.has(id)));
        const sameZone = current && (log.zone ?? undefined) === current.zone;
        if (current && sameZone && group === current.group && sharesCast && current.logs.length < BEAT_MAX_LINES) {
            current.logs.push(log);
            log.tributesInvolved.forEach(id => current!.cast.add(id));
        } else {
            current = { zone: log.zone ?? undefined, group, logs: [log], cast: new Set(log.tributesInvolved) };
            beats.push(current);
        }
    }
    return beats;
}

/**
 * 41.6% of lines repeated their zone inside the prose while the beat header
 * already names it. Strip a trailing locative clause when — and only when —
 * it names exactly the zone the header shows. Conservative by design: an
 * unmatched pattern leaves the text untouched.
 */
export function stripZoneClause(text: string, zone: string): string {
    const z = zone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // " in {zone}", " at {zone}", " near {zone}", " of {zone}" etc., when
    // followed by punctuation or the end of a clause.
    const stripped = text.replace(
        new RegExp(`\\s+(?:in|at|near|inside|around|of|from|through|into) ${z}(?=[,.;:!?)\\s]|$)`, 'g'),
        ''
    );
    // Never strip down to something mangled — a template that *opens* with
    // the zone ("Sector 2 is on fire") keeps its subject.
    return stripped.trim().length >= 12 ? stripped : text;
}

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
        // §2.5: the death interstitial breaks the column visually and was not
        // announced at all — a screen-reader user got the most significant
        // thing that can happen in the Games as an unremarkable paragraph.
        // `role="note"` plus an explicit label names it as what it is; the
        // announcement itself still comes from GameScreen's assertive region,
        // which does not repeat on scroll.
        <div
            role="note"
            aria-label={tribute
                ? `${meta.label}. ${tribute.name} of District ${tribute.district}.`
                : meta.label}
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
                className="font-bold underline decoration-dotted underline-offset-2 hover:text-[var(--red)] focus-visible:outline focus-visible:outline-1"
            >
                {part}
                <span className="font-mono text-[9px] font-black text-[var(--color-ink-500)] ml-0.5 align-super">
                    {person.district}{person.gender === 'Male' ? 'M' : 'F'}
                </span>
            </button>
        );
    });
}

export function FeedLine({ log, showTag = true, animate = true, cast, onSelectTribute, stripZone, continuation = false, revealed = false, gameState }: {
    log: EventLog;
    showTag?: boolean;
    animate?: boolean;
    /** Supplied by the chronicle so a death can be rendered with its victim's details. */
    cast?: Tribute[];
    /** Clicking a name in the line opens that tribute's profile. */
    onSelectTribute?: (id: string) => void;
    /** The beat header already names this zone — drop it from the prose. */
    stripZone?: string;
    /** Not the first line of its beat: render as an indented continuation. */
    continuation?: boolean;
    /**
     * §2.5: the run is over, so nothing is a spoiler any more. Set by the
     * chronicle and the end screen; the live sidebar leaves it false.
     */
    revealed?: boolean;
    /** §2.6: needed for the seed and the Games number on a shared moment. */
    gameState?: GameState;
}) {
    const meta = categoryMeta(log.category);
    const spoilerSafe = useStore(prefsStore, p => p.spoilerSafe);

    // §2.5: watching, rather than replaying. A death is still an event on the
    // timeline — hiding it entirely would leave the feed making no sense — but
    // the line that names who and how is held back, so a second person can
    // watch a shared seed without being told the ending three days early.
    if (spoilerSafe && !revealed && (log.category === 'death' || log.category === 'kill')) {
        return (
            <div
                className={`feed-item ${animate ? 'animate-riseIn' : ''} is-important`}
                style={{ ['--cat' as string]: meta.color }}
            >
                {showTag && (
                    <span className="feed-tag">
                        <span className="cat-glyph mr-1" aria-hidden="true">{meta.glyph}</span>
                        {meta.label}
                    </span>
                )}
                <span className="italic text-[var(--color-ink-500)]">
                    A cannon. Hidden while spoiler-safe viewing is on.
                </span>
            </div>
        );
    }

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

    const text = stripZone && log.zone === stripZone ? stripZoneClause(log.text, stripZone) : log.text;

    return (
        <div
            className={`feed-item ${animate ? 'animate-riseIn' : ''} ${log.important ? 'is-important' : ''} ${continuation ? 'ml-4 text-[13px] opacity-90' : ''}`}
            style={{ ['--cat' as string]: meta.color }}
        >
            {showTag && !continuation && (
                <span className="feed-tag">
                    {/* §2.5: the glyph, so the category is legible without colour. */}
                    <span className="cat-glyph mr-1" aria-hidden="true">{meta.glyph}</span>
                    {meta.label}
                </span>
            )}
            {withTributeLinks(text, cast, log.tributesInvolved, onSelectTribute)}
            {/* §2.6: the single-moment share. Only on the lines worth sharing
                on their own — the `important` flag already identifies exactly
                those — so the feed does not grow a button per line. */}
            {log.important && gameState && <MomentShare gameState={gameState} log={log} />}
        </div>
    );
}

/**
 * §2.6: "copy this moment".
 *
 * The whole-chronicle export produces a document; this produces the one line
 * somebody actually wants to paste into a message, with the day, the phase and
 * the seed attached — a moment out of context is just a sentence, and the seed
 * is what turns it into something the reader can go and watch for themselves.
 */
function MomentShare({ gameState, log }: { gameState: GameState; log: EventLog }) {
    const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
    return (
        <button
            type="button"
            className="feed-share"
            title="Copy this moment, with the seed"
            aria-label={state === 'ok' ? 'Moment copied' : 'Copy this moment'}
            onClick={async e => {
                e.stopPropagation();
                setState(await copyMoment(gameState, log) ? 'ok' : 'fail');
                window.setTimeout(() => setState('idle'), 1600);
            }}
        >
            {state === 'ok' ? 'copied' : state === 'fail' ? 'copy failed' : 'copy'}
        </button>
    );
}

/** Groups a log list into "Day N — Phase" sections, in chronological order. */
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

/** One rendered beat: a zone-tagged header (when it earns one) plus its lines. */
function BeatBlock({ beat, showTags, cast, onSelectTribute, newIds, hideZones, revealed, gameState }: {
    beat: Beat;
    showTags: boolean;
    cast?: Tribute[];
    onSelectTribute?: (id: string) => void;
    newIds: Set<string>;
    /** §1.9: a sealed arena must not name its sectors in the beat headers. */
    hideZones?: boolean;
    /** §2.5: the run is over — nothing here is a spoiler any more. */
    revealed?: boolean;
    /** §2.6: for the per-moment share. */
    gameState?: GameState;
}) {
    // A beat header earns its row when there is a scene to anchor: a place
    // and more than a single line, or a place and a multi-party cast.
    const showHeader = !hideZones && !!beat.zone && (beat.logs.length > 1 || beat.cast.size > 1);
    return (
        <div className="space-y-1">
            {showHeader && (
                <div className="font-mono text-[9px] font-black uppercase tracking-[0.12em] text-[var(--color-ink-500)] pt-1">
                    {beat.zone}
                </div>
            )}
            {beat.logs.map((log, i) => (
                <FeedLine
                    key={log.id}
                    log={log}
                    showTag={showTags}
                    animate={newIds.has(log.id)}
                    cast={cast}
                    onSelectTribute={onSelectTribute}
                    stripZone={showHeader ? beat.zone : undefined}
                    continuation={showHeader && i > 0}
                    revealed={revealed}
                    gameState={gameState}
                />
            ))}
        </div>
    );
}

/** One "Day N — Phase" section: beats, plus its quiet lines behind a disclosure. */
function PhaseSection({ sectionKey, entries, density, showTags, cast, onSelectTribute, newIds, preGamesCollapsed, hideZones, revealed, gameState }: {
    sectionKey: string;
    entries: EventLog[];
    density: FeedDensity;
    showTags: boolean;
    cast?: Tribute[];
    onSelectTribute?: (id: string) => void;
    newIds: Set<string>;
    /** Day-0 ceremony sections default to headlines with an expander (§pacing). */
    preGamesCollapsed: boolean;
    hideZones?: boolean;
    /**
     * §2.5: the run has finished, so spoiler-safe viewing stops suppressing
     * anything. The live sidebar leaves this false; the post-run chronicle and
     * the debrief set it.
     */
    revealed?: boolean;
    /** §2.6: for the per-moment share on important lines. */
    gameState?: GameState;
}) {
    const [showQuiet, setShowQuiet] = useState(false);
    const [showCeremony, setShowCeremony] = useState(false);

    const dayOfSection = entries[0]?.day ?? 0;
    const isNight = entries[0]?.phase === 'night';
    const fallenToday = isNight && cast
        ? cast.filter(t => t.status === 'dead' && t.dayOfDeath === dayOfSection)
        : [];

    const ceremonyCollapse = preGamesCollapsed && !showCeremony;
    const passesDensity = (log: EventLog): boolean => {
        const tier = tierOf(log);
        if (ceremonyCollapse) return tier === 'headline';
        if (density === 'headlines') return tier === 'headline';
        if (density === 'scenes') return tier !== 'ambient';
        return true;
    };

    const visible = entries.filter(passesDensity);
    const hidden = entries.length - visible.length;
    const beats = useMemo(() => groupBeats(visible), [visible.length, sectionKey, showQuiet, density, ceremonyCollapse]); // eslint-disable-line react-hooks/exhaustive-deps

    const expanded = showQuiet && hidden > 0;
    const expandedBeats = useMemo(() => (expanded ? groupBeats(entries) : null), [expanded, entries.length]); // eslint-disable-line react-hooks/exhaustive-deps
    const rendered = expandedBeats ?? beats;

    return (
        <section data-day={dayOfSection} className="feed-section space-y-2.5">
            <h3 className="panel-title border-b border-[var(--color-ink-800)] pb-1.5 flex items-center justify-between">
                <span>{sectionKey}</span>
                <span className="text-[var(--color-ink-600)]">{entries.length} entries</span>
            </h3>
            <div className="space-y-2">
                {rendered.map((beat, i) => (
                    <BeatBlock
                        key={`${beat.logs[0].id}-${i}`}
                        beat={beat}
                        showTags={showTags}
                        cast={cast}
                        onSelectTribute={onSelectTribute}
                        newIds={newIds}
                        hideZones={hideZones}
                        revealed={revealed}
                        gameState={gameState}
                    />
                ))}
                {hidden > 0 && !expanded && (
                    <button
                        onClick={() => (ceremonyCollapse ? setShowCeremony(true) : setShowQuiet(true))}
                        className="btn btn-sm btn-ghost w-full justify-center text-[10px]"
                    >
                        {ceremonyCollapse
                            ? `Show the ceremonies — ${hidden} more moments`
                            : `${hidden} quiet ${hidden === 1 ? 'moment' : 'moments'} — show`}
                    </button>
                )}
                {expanded && (
                    <button onClick={() => setShowQuiet(false)} className="btn btn-sm btn-ghost w-full justify-center text-[10px]">
                        Hide the quiet moments
                    </button>
                )}
            </div>
            {/* The roll-call belongs at the end of the night it summarises. */}
            {fallenToday.length > 0 && <AnthemCard day={dayOfSection} fallen={fallenToday} />}
        </section>
    );
}

export function EventFeed({ logs, showTags = true, cast, onSelectTribute, defaultExpanded = false, density = 'everything', hideZones = false, revealed = false, gameState }: {
    logs: EventLog[];
    showTags?: boolean;
    cast?: Tribute[];
    onSelectTribute?: (id: string) => void;
    /**
     * Show the whole chronicle from the first render instead of capping to
     * the newest `VISIBLE_CAP` entries behind a "show earlier" button.
     *
     * The cap exists for the live, auto-advancing chronicle during a run,
     * where only the newest lines matter and re-rendering ~900 entries on
     * every tick would be wasted work. The finished run's "Full chronicle"
     * tab is a different reader with a different goal — its entire point is
     * to be the complete archive — and defaulting it to the same 200-line
     * cap read as the archive silently dropping most of the Games, with the
     * only way back a small ghost button easy to miss entirely.
     */
    defaultExpanded?: boolean;
    /** Reading density — see FeedDensity. */
    density?: FeedDensity;
    /**
     * §1.9: `canSeeArena(disclosureFor(phase))` gated the header and the
     * tribute sheet's zone but not the feed's own beat headers, so a sealed
     * arena named its sectors in the chronicle anyway.
     */
    hideZones?: boolean;
    /**
     * §2.5: the run has finished, so spoiler-safe viewing stops suppressing
     * anything. The live sidebar leaves this false; the post-run chronicle and
     * the debrief set it.
     */
    revealed?: boolean;
    /** §2.6: for the per-moment share on important lines. */
    gameState?: GameState;
}) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const containerRef = useRef<HTMLDivElement>(null);
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
    // Chronological: the chronicle reads forward, oldest first — a narrative,
    // not a notification tray. The parachute lands *after* the fight that
    // earned it. (Both `.reverse()` calls this feed used to make are gone.)
    const groups = groupLogs(visibleLogs);
    // Distinct days currently visible, ascending, for the jump rail — the
    // single day-jump control (the [ / ] keys share the same data-day markers).
    const days = useMemo(
        () => [...new Set(groups.map(([, entries]) => entries[0]?.day ?? 0))],
        // groups derives from visibleLogs; keying on it keeps this cheap.
        [visibleLogs]  // eslint-disable-line react-hooks/exhaustive-deps
    );

    // The final section of the pre-Games ceremony block should not swallow the
    // reveal: collapse day-0 training/interview sections to headlines only.
    const CEREMONY_PHASES = new Set(['training', 'interviews']);

    return (
        // Deliberately NOT role="log": announcing every rendered line drowned
        // screen readers in ambient scenery during auto-play. GameScreen's
        // dedicated sr-only live regions announce headlines and deaths.
        <div ref={containerRef} className="space-y-6" aria-label="Chronicle of the Games">
            {days.length > 2 && (
                <nav aria-label="Jump to day" className="sticky top-0 z-10 flex flex-wrap gap-1 py-1.5 -my-1.5"
                    style={{ background: 'var(--paper)' }}>
                    {days.map(d => (
                        <button
                            key={d}
                            className="btn btn-sm btn-ghost font-mono text-[10px]"
                            aria-label={d === 0 ? 'Jump to before the Games' : `Jump to day ${d}`}
                            onClick={() => {
                                // Scoped to this feed's own container — EndScreen
                                // renders an EventFeed too, and an unscoped
                                // document query could land in the wrong one.
                                const node = containerRef.current?.querySelector(`[data-day="${d}"]`);
                                // A smooth scroll is an animation like any other:
                                // honour the reduced-motion preference here too.
                                const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                                node?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
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
            {groups.map(([key, entries]) => (
                <PhaseSection
                    key={key}
                    sectionKey={key}
                    entries={entries}
                    density={density}
                    showTags={showTags}
                    cast={cast}
                    onSelectTribute={onSelectTribute}
                    newIds={newIds}
                    hideZones={hideZones}
                    revealed={revealed}
                    gameState={gameState}
                    preGamesCollapsed={entries[0]?.day === 0 && CEREMONY_PHASES.has(entries[0]?.phase ?? '') && density === 'everything'}
                />
            ))}
        </div>
    );
}
