import React, { useMemo, useState } from 'react';
import { HallOfFameEntry } from '../models/types';
import { GitCompareArrows } from 'lucide-react';

/**
 * S-4: "The Hall of Fame lists entries; it cannot diff two Games or chart
 * trends across a career."
 *
 * Two halves, both derived from records already on disk so they work
 * retroactively on archives written by older builds:
 *
 *  - a side-by-side of any two archived Games, which is what a player
 *    actually wants when they say "was that the one where…";
 *  - a trend strip over the last N victories, so a career reads as a
 *    direction rather than as a list.
 *
 * Fields the older archive format never stored render as an em dash rather
 * than as a zero — a run with no recorded end health is unknown, not a run
 * whose victor finished on nothing.
 */

interface Props {
    entries: HallOfFameEntry[];
}

const DASH = '—';

function label(entry: HallOfFameEntry): string {
    return `${entry.winnerName} · ${entry.arenaName}`;
}

function fallen(entry: HallOfFameEntry): number | undefined {
    if (!entry.tributeSummaries) return undefined;
    return entry.tributeSummaries.filter(t => t.status === 'dead').length;
}

function lastDay(entry: HallOfFameEntry): number | undefined {
    const days = (entry.tributeSummaries ?? [])
        .map(t => t.dayOfDeath)
        .filter((d): d is number => typeof d === 'number');
    return days.length > 0 ? Math.max(...days) : undefined;
}

/** A compact sparkline over up to 12 recent values, oldest first. */
function Trend({ values, title }: { values: Array<number | undefined>; title: string }) {
    const known = values.filter((v): v is number => typeof v === 'number');
    if (known.length < 2) {
        return <div className="text-[11px] text-[var(--color-ink-500)]">{title}: not enough archived runs yet.</div>;
    }
    const min = Math.min(...known);
    const max = Math.max(...known);
    const span = max - min || 1;
    const first = known[0];
    const latest = known[known.length - 1];
    const direction = latest > first ? 'rising' : latest < first ? 'falling' : 'flat';

    return (
        <div
            className="space-y-1"
            role="img"
            aria-label={`${title} across your last ${known.length} archived victories: ${known.join(', ')} — ${direction}.`}
        >
            <div className="flex items-baseline justify-between gap-2">
                <span className="eyebrow">{title}</span>
                <span className="font-mono text-[10px] text-[var(--color-ink-500)]">
                    {first} → {latest}
                </span>
            </div>
            <div className="flex items-end gap-0.5 h-8" aria-hidden="true">
                {known.map((v, i) => (
                    <span
                        key={i}
                        className="flex-1 min-w-[3px]"
                        style={{
                            height: `${10 + ((v - min) / span) * 90}%`,
                            background: i === known.length - 1 ? 'var(--red)' : 'var(--color-ink-600)',
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

export function HofCompare({ entries }: Props) {
    const [leftId, setLeftId] = useState<string>(entries[0]?.id ?? '');
    const [rightId, setRightId] = useState<string>(entries[1]?.id ?? '');

    const left = entries.find(e => e.id === leftId);
    const right = entries.find(e => e.id === rightId);

    // Oldest first, so a trend reads left to right the way a chart should.
    const chronological = useMemo(() => [...entries].reverse().slice(-12), [entries]);

    if (entries.length < 2) {
        return (
            <div className="panel p-5">
                <h3 className="panel-title mb-2">Compare Games</h3>
                <p className="text-sm text-[var(--color-ink-500)]">
                    Archive two Games and they can be set side by side here, with the trend of your victories
                    across a whole career.
                </p>
            </div>
        );
    }

    const rows: Array<[string, string, string]> = [
        ['Victor', left ? left.winnerName : DASH, right ? right.winnerName : DASH],
        ['District', left ? `District ${left.winnerDistrict}` : DASH, right ? `District ${right.winnerDistrict}` : DASH],
        ['Arena', left?.arenaName ?? DASH, right?.arenaName ?? DASH],
        ['Kills', left ? String(left.kills) : DASH, right ? String(right.kills) : DASH],
        [
            'End health',
            typeof left?.winnerEndHealth === 'number' ? String(left.winnerEndHealth) : DASH,
            typeof right?.winnerEndHealth === 'number' ? String(right.winnerEndHealth) : DASH,
        ],
        [
            'Tributes fallen',
            fallen(left ?? ({} as HallOfFameEntry))?.toString() ?? DASH,
            fallen(right ?? ({} as HallOfFameEntry))?.toString() ?? DASH,
        ],
        [
            'Last death on day',
            lastDay(left ?? ({} as HallOfFameEntry))?.toString() ?? DASH,
            lastDay(right ?? ({} as HallOfFameEntry))?.toString() ?? DASH,
        ],
        ['Seed', left?.seed ?? DASH, right?.seed ?? DASH],
    ];

    return (
        <div className="panel p-5 space-y-4">
            <div className="flex items-center gap-2">
                <GitCompareArrows className="w-4 h-4 text-[var(--red)]" aria-hidden="true" />
                <h3 className="panel-title">Compare Games</h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <select
                    className="field text-xs"
                    aria-label="First Games to compare"
                    value={leftId}
                    onChange={e => setLeftId(e.target.value)}
                >
                    {entries.map(e => <option key={e.id} value={e.id}>{label(e)}</option>)}
                </select>
                <select
                    className="field text-xs"
                    aria-label="Second Games to compare"
                    value={rightId}
                    onChange={e => setRightId(e.target.value)}
                >
                    {entries.map(e => <option key={e.id} value={e.id}>{label(e)}</option>)}
                </select>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <caption className="sr-only">The two selected Games, side by side</caption>
                    <tbody>
                        {rows.map(([field, a, b]) => (
                            <tr key={field} className="border-b border-[var(--color-ink-800)]">
                                <th scope="row" className="text-left py-1.5 pr-2 eyebrow font-normal">{field}</th>
                                <td className="py-1.5 pr-2 text-[var(--ink)]">{a}</td>
                                <td className="py-1.5 text-[var(--ink)]">{b}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <Trend title="Victor kills" values={chronological.map(e => e.kills)} />
                <Trend title="End health" values={chronological.map(e => e.winnerEndHealth)} />
                <Trend title="Tributes fallen" values={chronological.map(e => fallen(e))} />
            </div>
        </div>
    );
}
