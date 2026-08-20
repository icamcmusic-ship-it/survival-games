import React, { useMemo } from 'react';
import { GameState, Tribute } from '../models/types';

/**
 * The social graph, drawn.
 *
 * The relationship system is the most interesting thing in the engine —
 * backstory bonds, grief, betrayal, sworn vengeance, alliance trust decay — and
 * the interface showed it as a flat list of numbers next to names. A list tells
 * you Marvel is on +40 with Cato. It cannot tell you that Marvel, Cato and Clove
 * are a closed triangle and everyone else in the arena is outside it, which is
 * the thing a reader actually wants to see.
 *
 * Laid out radially around the subject rather than force-directed: the subject
 * is always the centre, distance from them encodes bond strength, and that is
 * both more readable and more stable than letting a physics simulation decide.
 */

const VIEW = 320;
const CENTRE = VIEW / 2;

function bondColor(value: number): string {
    if (value >= 40) return 'var(--cat-alliance)';
    if (value > 10) return '#6f9a5a';
    if (value > -10) return 'var(--color-ink-500)';
    if (value > -40) return 'var(--cat-training)';
    return 'var(--cat-death)';
}

function bondLabel(value: number): string {
    if (value >= 40) return 'close';
    if (value > 10) return 'friendly';
    if (value > -10) return 'neutral';
    if (value > -40) return 'wary';
    return 'hostile';
}

export function RelationshipGraph({ tribute, gameState }: { tribute: Tribute; gameState: GameState }) {
    const sworn = useMemo(() => new Set(tribute.memory?.vengeance ?? []), [tribute.memory]);

    const links = useMemo(() => {
        const entries = Object.entries(tribute.relationships)
            .map(([id, raw]) => {
                const other = gameState.tributes.find(t => t.id === id);
                return other ? { other, value: Math.round(raw as number) } : null;
            })
            .filter((l): l is { other: Tribute; value: number } => l !== null)
            // Everyone the subject has any recorded feeling about, strongest first.
            .filter(l => Math.abs(l.value) > 2 || l.other.allianceId === tribute.allianceId)
            .sort((a, b) => b.value - a.value)
            .slice(0, 11);
        return entries;
    }, [tribute, gameState.tributes]);

    if (links.length === 0) {
        return <div className="empty-state">No recorded feeling about anyone yet.</div>;
    }

    const strongest = Math.max(40, ...links.map(l => Math.abs(l.value)));
    // Sort into a stable ring so the layout does not jump as values change.
    const placed = links.map((link, i) => {
        const angle = (i / links.length) * Math.PI * 2 - Math.PI / 2;
        // Close bonds sit near the subject; hostility is pushed to the rim.
        const closeness = (link.value + strongest) / (strongest * 2); // 0..1
        const radius = 46 + (1 - closeness) * 88;
        return {
            ...link,
            x: CENTRE + Math.cos(angle) * radius,
            y: CENTRE + Math.sin(angle) * radius,
        };
    });

    const allianceMates = placed.filter(l =>
        l.other.allianceId !== undefined && l.other.allianceId === tribute.allianceId && l.other.status === 'alive');

    return (
        <div className="space-y-2">
            <svg
                viewBox={`0 0 ${VIEW} ${VIEW}`}
                className="w-full h-auto"
                role="img"
                aria-label={`Relationship map for ${tribute.name}. ${links.length} recorded bonds.`}
            >
                {/* Alliance hull: a ring binding everyone currently in the pack with
                    the subject, so a group reads as a group and not as N separate lines. */}
                {/* With a single ally the polygon degenerates to a line, which the
                    bond line already draws — a hull is only meaningful for a group. */}
                {allianceMates.length >= 2 && (
                    <polygon
                        points={[[CENTRE, CENTRE], ...allianceMates.map(m => [m.x, m.y])]
                            .map(([x, y]) => `${x},${y}`).join(' ')}
                        fill="var(--cat-alliance)"
                        opacity={0.12}
                        stroke="var(--cat-alliance)"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                    />
                )}

                {placed.map(link => (
                    <line
                        key={`line-${link.other.id}`}
                        x1={CENTRE} y1={CENTRE} x2={link.x} y2={link.y}
                        stroke={bondColor(link.value)}
                        strokeWidth={1 + (Math.abs(link.value) / strongest) * 3.5}
                        opacity={link.other.status === 'dead' ? 0.3 : 0.8}
                        strokeDasharray={link.other.status === 'dead' ? '3 3' : undefined}
                    />
                ))}

                {placed.map(link => {
                    const dead = link.other.status === 'dead';
                    return (
                        <g key={link.other.id}>
                            <title>
                                {`${link.other.name} (District ${link.other.district}) — ${bondLabel(link.value)}, ${link.value > 0 ? '+' : ''}${link.value}` +
                                    `${sworn.has(link.other.id) ? ', sworn to kill' : ''}${dead ? ', deceased' : ''}`}
                            </title>
                            <circle
                                cx={link.x} cy={link.y} r={15}
                                fill={dead ? 'var(--paper-flush)' : 'var(--paper-panel)'}
                                stroke={bondColor(link.value)}
                                strokeWidth={2}
                                opacity={dead ? 0.5 : 1}
                            />
                            <text
                                x={link.x} y={link.y + 1}
                                textAnchor="middle" dominantBaseline="middle"
                                style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800 }}
                                fill={dead ? 'var(--color-ink-600)' : 'var(--ink)'}
                            >
                                D{link.other.district}
                            </text>
                            {sworn.has(link.other.id) && (
                                <text
                                    x={link.x + 13} y={link.y - 11}
                                    textAnchor="middle"
                                    style={{ fontSize: 11 }}
                                >⚔</text>
                            )}
                            <text
                                x={link.x} y={link.y + 26}
                                textAnchor="middle"
                                style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700 }}
                                fill="var(--color-ink-500)"
                            >
                                {link.other.name.length > 10 ? `${link.other.name.slice(0, 9)}…` : link.other.name}
                            </text>
                        </g>
                    );
                })}

                {/* The subject, always dead centre. */}
                <circle cx={CENTRE} cy={CENTRE} r={20} fill="var(--ink)" stroke="var(--red)" strokeWidth={3} />
                <text
                    x={CENTRE} y={CENTRE + 1}
                    textAnchor="middle" dominantBaseline="middle"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800 }}
                    fill="#fff"
                >
                    D{tribute.district}
                </text>
            </svg>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-wider">
                {(['close', 'friendly', 'neutral', 'wary', 'hostile'] as const).map((band, i) => (
                    <span key={band} className="flex items-center gap-1" style={{ color: bondColor([60, 25, 0, -25, -60][i]) }}>
                        <span className="w-2.5 h-2.5 inline-block" style={{ background: bondColor([60, 25, 0, -25, -60][i]) }} />
                        {band}
                    </span>
                ))}
                <span className="text-[var(--color-ink-500)]">⚔ sworn · dashed ring = alliance · faded = dead</span>
            </div>
        </div>
    );
}
