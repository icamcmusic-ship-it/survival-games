import React, { useMemo } from 'react';
import { EventLog, GameState, Tribute } from '../models/types';
import { dayPhaseLabel } from '../ui/phaseLabels';
import { categoryMeta } from '../ui/eventStyles';

/**
 * §(requests): the road out, reworked.
 *
 * The old panel was one assembled paragraph — the book's opening price, a
 * trait shed, a sector count, a rival, somebody mourned — and it read like a
 * horoscope: true of everybody, specific to nobody, and wrong in the joins
 * ("They went in skittish and came out hardened" for a tribute who shed
 * Skittish on day one and earned Hardened on day nine).
 *
 * This is the victor's own record instead: the important lines the chronicle
 * wrote about them, in order, grouped by day, with the facts alongside. Every
 * line is something the engine actually logged with this tribute in it, so
 * nothing here can be wrong about the run. The stat row underneath is the
 * arithmetic the paragraph used to bury.
 */
export function VictorArc({ gameState, victor }: { gameState: GameState; victor: Tribute }) {
    const beats = useMemo(() => {
        const mine = gameState.log.filter(l =>
            l.tributesInvolved.includes(victor.id) && l.important && l.day > 0 && l.phase !== 'epilogue' && l.phase !== 'ended');
        // Kills, injuries, alliances and betrayals first; the rest only if the
        // list is short. A twelve-day run writes forty important lines about a
        // victor and a debrief is not a transcript.
        const weight = (l: EventLog) =>
            l.category === 'kill' || l.category === 'death' ? 3
                : l.category === 'betrayal' || l.category === 'romance' || l.category === 'injury' ? 2
                    : l.category === 'alliance' || l.category === 'combat' || l.category === 'mutt' || l.category === 'arena' ? 1
                        : 0;
        const ranked = [...mine].sort((a, b) => weight(b) - weight(a));
        const keep = new Set(ranked.slice(0, 14).map(l => l.id));
        return mine.filter(l => keep.has(l.id));
    }, [gameState.log, victor.id]);

    const byDay = useMemo(() => {
        const groups: Array<{ label: string; entries: EventLog[] }> = [];
        beats.forEach(l => {
            const label = dayPhaseLabel(l.day, l.phase);
            const last = groups[groups.length - 1];
            if (last && last.label === label) last.entries.push(l);
            else groups.push({ label, entries: [l] });
        });
        return groups;
    }, [beats]);

    const walked = victor.visitedZones?.length ?? 0;
    const total = gameState.arena.zones.length;
    const history = gameState.oddsHistory ?? {};
    const days = Object.keys(history).map(Number).sort((a, b) => a - b);
    const opening = days.length > 0 ? history[days[0]]?.[victor.id] : undefined;
    const earned = Object.entries(victor.traitAge ?? {})
        .filter(([trait, age]) => age < (gameState.cycle ?? 0) - 1 && victor.traits.includes(trait))
        .map(([trait]) => trait);
    const shed = [...new Set(victor.shedTraits ?? [])];

    const facts: Array<[string, string]> = [
        ['Days', String(gameState.day)],
        ['Kills', String(victor.kills)],
        ['Sectors walked', `${walked} of ${total}`],
        ['Came out on', `${Math.round(victor.health)} health`],
    ];
    if (opening !== undefined) facts.push(['Opening odds', `${opening}%`]);
    if (earned.length > 0) facts.push(['Earned', earned.join(', ')]);
    if (shed.length > 0) facts.push(['Shed', shed.join(', ')]);

    return (
        <section
            className="md:col-span-2 panel p-5 space-y-3"
            style={{ borderColor: 'var(--gold)', borderWidth: '3px' }}
            aria-labelledby="victor-arc-title"
        >
            <span id="victor-arc-title" className="eyebrow" style={{ color: 'var(--red)' }}>The road out — {victor.name}</span>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                {facts.map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                        <dt className="font-mono text-micro uppercase tracking-wider text-[var(--color-ink-500)]">{k}</dt>
                        <dd className="text-[var(--color-ink-200)] m-0">{v}</dd>
                    </div>
                ))}
            </dl>
            {byDay.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-400)]">
                    Nothing the broadcast marked as important had {victor.name} in it. They won by never being the story.
                </p>
            ) : (
                <ol className="space-y-2 list-none m-0 p-0">
                    {byDay.map(group => (
                        <li key={group.label}>
                            <div className="font-mono text-micro uppercase tracking-wider text-[var(--color-ink-500)] mb-0.5">{group.label}</div>
                            <ul className="m-0 p-0 list-none space-y-1">
                                {group.entries.map(l => {
                                    const meta = categoryMeta(l.category);
                                    return (
                                        <li key={l.id} className="text-sm text-[var(--color-ink-200)] leading-snug flex gap-2">
                                            <span className="flex-none font-mono text-micro mt-0.5" style={{ color: meta.color }} aria-label={meta.label}>{meta.glyph}</span>
                                            <span>{l.text}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
