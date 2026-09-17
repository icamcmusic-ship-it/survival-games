import React, { useMemo, useState } from 'react';
import { GameState, Tribute } from '../models/types';

/**
 * §(requests 12): the whole board, one cell per ordered pair.
 *
 * The per-tribute grid answers "how does this person feel about everybody".
 * It cannot answer the question a reader actually has by day four, which is
 * "who is about to turn on whom" — and that lives in the *asymmetry*: A is on
 * +40 with B while B is on -10 with A is the single most predictive fact on
 * the board, and there was nowhere to see it.
 *
 * Rows are the tribute doing the feeling, columns the tribute felt about.
 * Reading across a row is one person's view of the field; reading down a
 * column is what the field thinks of them.
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

/** A short, unambiguous column head: district plus the first letters of the name. */
function shortName(t: Tribute): string {
    return `${t.name.slice(0, 3)}`;
}

export function RelationshipMatrix({ gameState, onSelectTribute }: {
    gameState: GameState;
    onSelectTribute?: (id: string) => void;
}) {
    const [livingOnly, setLivingOnly] = useState(true);

    const cast = useMemo(() => {
        const all = [...gameState.tributes].sort((a, b) =>
            a.district - b.district || a.name.localeCompare(b.name));
        return livingOnly ? all.filter(t => t.status === 'alive') : all;
    }, [gameState.tributes, livingOnly]);

    const sworn = useMemo(() => {
        const map = new Map<string, Set<string>>();
        gameState.tributes.forEach(t => map.set(t.id, new Set(t.memory?.vengeance ?? [])));
        return map;
    }, [gameState.tributes]);

    if (cast.length < 2) {
        return <div className="empty-state">Not enough tributes left for a board.</div>;
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[var(--color-ink-500)] m-0">
                    Each row is what that tribute feels about the others. Read <b>across</b> for one person's view of the
                    field; read <b>down</b> for what the field makes of them.
                </p>
                <button
                    className="btn btn-sm"
                    onClick={() => setLivingOnly(v => !v)}
                    aria-pressed={livingOnly}
                >
                    {livingOnly ? 'Living only' : 'Whole cast'}
                </button>
            </div>

            <div className="overflow-auto max-h-[70vh]">
                <table className="text-[10px]" style={{ borderCollapse: 'collapse', fontFamily: 'var(--font-mono)' }}>
                    <caption className="sr-only">
                        Relationship matrix: every tribute's feeling about every other tribute, from -100 to +100.
                    </caption>
                    <thead>
                        <tr>
                            <th
                                scope="col"
                                className="sticky left-0 z-20 text-left px-1.5 py-1 bg-[var(--paper-panel)] text-[var(--color-ink-500)]"
                            >
                                feels ↓ about →
                            </th>
                            {cast.map(c => (
                                <th
                                    key={c.id}
                                    scope="col"
                                    className="px-1 py-1 text-[var(--color-ink-400)] font-bold"
                                    title={`${c.name} — District ${c.district}`}
                                    aria-label={`${c.name}, District ${c.district}`}
                                >
                                    <span className="block leading-none">{shortName(c)}</span>
                                    <span className="block leading-none opacity-60">{c.district}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {cast.map(row => (
                            <tr key={row.id}>
                                <th
                                    scope="row"
                                    className="sticky left-0 z-10 text-left px-1.5 py-0.5 whitespace-nowrap bg-[var(--paper-panel)]"
                                >
                                    <button
                                        className={`underline-offset-2 ${row.status === 'dead' ? 'line-through text-[var(--color-ink-600)]' : 'text-[var(--color-ink-200)] hover:underline'}`}
                                        onClick={() => onSelectTribute?.(row.id)}
                                    >
                                        <span className="opacity-60 mr-1">D{row.district}</span>{row.name}
                                    </button>
                                </th>
                                {cast.map(col => {
                                    if (col.id === row.id) {
                                        return <td key={col.id} className="text-center opacity-25" aria-hidden="true">—</td>;
                                    }
                                    const raw = row.relationships[col.id];
                                    const known = raw !== undefined;
                                    const value = Math.round((raw as number | undefined) ?? 0);
                                    const isSworn = sworn.get(row.id)?.has(col.id);
                                    const ally = !!row.allianceId && row.allianceId === col.allianceId;
                                    // One string, used as both the hover hint and the cell's
                                    // accessible name — a matrix cell reading "-40" alone tells a
                                    // screen reader nothing about who feels what about whom.
                                    const cellGloss = known
                                        ? `${row.name} → ${col.name}: ${bondLabel(value)} (${value > 0 ? '+' : ''}${value})`
                                            + `${ally ? ', same alliance' : ''}${isSworn ? `, ${row.name} has sworn to kill ${col.name}` : ''}`
                                        : `${row.name} has never met ${col.name}`;
                                    return (
                                        <td
                                            key={col.id}
                                            className="text-center px-1 py-0.5"
                                            style={{
                                                color: known ? bondColor(value) : 'var(--color-ink-700)',
                                                fontWeight: Math.abs(value) >= 40 ? 800 : 500,
                                                background: ally ? 'color-mix(in srgb, var(--cat-alliance) 12%, transparent)' : undefined,
                                                outline: isSworn ? '1px solid var(--cat-death)' : undefined,
                                            }}
                                            title={cellGloss}
                                            aria-label={cellGloss}
                                        >
                                            {known ? value : '·'}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-wider">
                {(['close', 'friendly', 'neutral', 'wary', 'hostile'] as const).map((band, i) => (
                    <span key={band} className="flex items-center gap-1" style={{ color: bondColor([60, 25, 0, -25, -60][i]) }}>
                        <span className="w-2.5 h-2.5 inline-block" style={{ background: bondColor([60, 25, 0, -25, -60][i]) }} aria-hidden="true" />
                        {band}
                    </span>
                ))}
                <span className="text-[var(--color-ink-500)]">· = never met · tinted cell = same alliance · outlined = sworn to kill</span>
            </div>
        </div>
    );
}
