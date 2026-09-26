import React, { useMemo } from 'react';
import { GameState, Tribute } from '../models/types';
import { areLovers } from '../engine/alliance';
import { ROMANCE } from '../data/balance';

/**
 * The social board, as a grid.
 *
 * §(requests): the radial graph — the subject in the middle, eleven of the
 * strongest feelings arranged by angle, distance for bond strength — was
 * clever and nobody could read it. Which tributes were *missing* from it was
 * not knowable, and D-numbers in circles are not names.
 *
 * This is the whole living field, one row each, in district order, with the
 * subject's feeling about them as a labelled chip and every standing fact
 * (ally, sworn, truce, lovers, sustained contact) as a badge. The dead drop
 * off it: a relationship with a corpse is grief, and grief has its own panel.
 * Every cell is text, so a reader on a phone or a screen reader gets the same
 * board as everybody else.
 */

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

interface Row {
    other: Tribute;
    value: number;
    known: boolean;
    ally: boolean;
    sworn: boolean;
    truce?: string;
    lovers: boolean;
    streak: number;
    /** AUDIT-11 §6: training days at the same station. */
    stations: number;
    /** AUDIT-11 §6: revealed only once the Games are over. */
    performed?: boolean;
}

export function RelationshipGraph({ tribute, gameState }: { tribute: Tribute; gameState: GameState }) {
    const rows = useMemo<Row[]>(() => {
        const sworn = new Set(tribute.memory?.vengeance ?? []);
        return gameState.tributes
            .filter(t => t.id !== tribute.id && t.status === 'alive')
            .map(other => {
                const raw = tribute.relationships[other.id];
                return {
                    other,
                    value: Math.round((raw as number | undefined) ?? 0),
                    known: raw !== undefined,
                    ally: !!tribute.allianceId && tribute.allianceId === other.allianceId,
                    sworn: sworn.has(other.id),
                    truce: tribute.truces?.[other.id] !== undefined
                        ? (tribute.truceReason?.[other.id] ?? 'truce standing')
                        : undefined,
                    lovers: areLovers(tribute, other),
                    stations: tribute.stationMates?.[other.id] ?? 0,
                    performed: gameState.phase === 'ended'
                        ? gameState.romances?.find(x => (x.aId === tribute.id && x.bId === other.id) || (x.bId === tribute.id && x.aId === other.id))?.sincere[tribute.id] === false
                        : undefined,
                    // The streak is only stored on one side of each pair, so read both.
                    streak: Math.max(
                        tribute.memory?.contactStreak?.[other.id] ?? 0,
                        other.memory?.contactStreak?.[tribute.id] ?? 0,
                    ),
                };
            })
            .sort((a, b) => a.other.district - b.other.district || a.other.name.localeCompare(b.other.name));
    }, [tribute, gameState.tributes, gameState.phase, gameState.romances]);

    const fallen = gameState.tributes.filter(t => t.id !== tribute.id && t.status === 'dead').length;

    if (rows.length === 0) {
        return <div className="empty-state">Nobody else is left standing.</div>;
    }

    return (
        <div className="space-y-2">
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <caption className="sr-only">
                    How {tribute.name} feels about everyone still alive, and what stands between them.
                </caption>
                <thead>
                    <tr className="text-micro font-mono uppercase tracking-wider text-[var(--color-ink-500)]">
                        <th scope="col" className="text-left py-1 pr-2 font-bold">Tribute</th>
                        <th scope="col" className="text-left py-1 pr-2 font-bold">Feeling</th>
                        <th scope="col" className="text-left py-1 font-bold">Standing</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={r.other.id} className="border-t border-[var(--color-ink-800)]">
                            <th scope="row" className="text-left py-1.5 pr-2 font-normal">
                                <span className="font-mono text-micro text-[var(--color-ink-500)] mr-1.5">D{r.other.district}</span>
                                <span className={r.ally ? 'text-[var(--cat-alliance)] font-bold' : 'text-[var(--color-ink-200)]'}>
                                    {r.other.name}
                                </span>
                            </th>
                            <td className="py-1.5 pr-2">
                                {r.known ? (
                                    <span
                                        className="inline-flex items-center gap-1.5 font-mono"
                                        style={{ color: bondColor(r.value) }}
                                    >
                                        <span className="w-2 h-2 inline-block" style={{ background: bondColor(r.value) }} aria-hidden="true" />
                                        {bondLabel(r.value)}
                                        <span className="text-micro opacity-80">{r.value > 0 ? `+${r.value}` : r.value}</span>
                                    </span>
                                ) : (
                                    <span className="font-mono text-[var(--color-ink-600)]">never met</span>
                                )}
                            </td>
                            <td className="py-1.5">
                                <span className="flex flex-wrap gap-1">
                                    {r.ally && <span className="chip chip-sm" style={{ borderColor: 'var(--cat-alliance)', color: 'var(--cat-alliance)' }}>ally</span>}
                                    {r.lovers && <span className="chip chip-sm" style={{ borderColor: 'var(--cat-romance, var(--red))', color: 'var(--cat-romance, var(--red))' }}>lovers</span>}
                                    {r.performed && <span className="chip chip-sm text-[var(--color-ink-400)]">was performing</span>}
                                    {r.stations >= 2 && <span className="chip chip-sm text-[var(--color-ink-400)]">{r.stations} days at one station</span>}
                                    {r.sworn && <span className="chip chip-sm" style={{ borderColor: 'var(--cat-death)', color: 'var(--cat-death)' }}>⚔ sworn to kill</span>}
                                    {r.truce && <span className="chip chip-sm" style={{ borderColor: 'var(--cat-alliance)', color: 'var(--color-ink-300)' }}>truce · {r.truce}</span>}
                                    {r.streak >= ROMANCE.sustainedCycles && (
                                        <span className="chip chip-sm text-[var(--color-ink-400)]">{r.streak} cycles together</span>
                                    )}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-micro font-mono uppercase tracking-wider">
                {(['close', 'friendly', 'neutral', 'wary', 'hostile'] as const).map((band, i) => (
                    <span key={band} className="flex items-center gap-1" style={{ color: bondColor([60, 25, 0, -25, -60][i]) }}>
                        <span className="w-2.5 h-2.5 inline-block" style={{ background: bondColor([60, 25, 0, -25, -60][i]) }} aria-hidden="true" />
                        {band}
                    </span>
                ))}
                {fallen > 0 && (
                    <span className="text-[var(--color-ink-500)]">{fallen} fallen not shown</span>
                )}
            </div>
        </div>
    );
}
