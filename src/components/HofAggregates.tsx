import React, { useMemo } from 'react';
import { HallOfFameEntry } from '../models/types';
import { BarChart3 } from 'lucide-react';

interface Props {
    entries: HallOfFameEntry[];
}

interface Tally {
    label: string;
    count: number;
}

function topOf(counts: Map<string, number>): Tally | null {
    // Ties break alphabetically so the panel doesn't flicker between equal leaders
    // depending on Map insertion order after an import.
    const tallies: Tally[] = Array.from(counts, ([label, count]) => ({ label, count }));
    tallies.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return tallies[0] ?? null;
}

/**
 * Cross-run statistics.
 *
 * Everything here is derived from the records already on disk — no extra fields were
 * added to HallOfFameEntry — so aggregates work retroactively for archives saved by
 * older builds, and degrade to "—" for runs whose cast summaries were never stored.
 */
export function HofAggregates({ entries }: Props) {
    const stats = useMemo(() => {
        const causes = new Map<string, number>();
        const districtWins = new Map<string, number>();
        const arenaHealth = new Map<string, { total: number; runs: number }>();

        let reaped = 0;
        let fallen = 0;
        let totalKills = 0;

        for (const entry of entries) {
            totalKills += entry.kills;
            districtWins.set(`District ${entry.winnerDistrict}`, (districtWins.get(`District ${entry.winnerDistrict}`) || 0) + 1);

            if (typeof entry.winnerEndHealth === 'number') {
                const bucket = arenaHealth.get(entry.arenaName) || { total: 0, runs: 0 };
                bucket.total += entry.winnerEndHealth;
                bucket.runs += 1;
                arenaHealth.set(entry.arenaName, bucket);
            }

            for (const t of entry.tributeSummaries ?? []) {
                reaped += 1;
                if (t.status === 'dead') {
                    fallen += 1;
                    // Unrecorded causes are counted separately rather than folded into a
                    // real cause, otherwise "unknown" quietly wins the leaderboard.
                    const cause = (t.causeOfDeath || '').trim();
                    if (cause) causes.set(cause, (causes.get(cause) || 0) + 1);
                }
            }
        }

        const arenaAverages = Array.from(arenaHealth, ([name, bucket]) => ({ name, avg: bucket.total / bucket.runs }));
        arenaAverages.sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));
        const luckiestArena = arenaAverages[0] ?? null;

        return {
            runs: entries.length,
            reaped,
            fallen,
            avgKills: entries.length > 0 ? totalKills / entries.length : 0,
            topCause: topOf(causes),
            topDistrict: topOf(districtWins),
            luckiestArena
        };
    }, [entries]);

    return (
        <section className="panel p-5 space-y-4" aria-labelledby="hof-aggregates-title">
            <h3 id="hof-aggregates-title" className="panel-title flex items-center gap-2">
                <BarChart3 className="w-4 h-4" aria-hidden="true" /> Across all {stats.runs} record{stats.runs === 1 ? '' : 's'}
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="stat-tile">
                    <div className="eyebrow">Tributes reaped</div>
                    <div className="font-mono text-[var(--ink)] text-lg">{stats.reaped || '—'}</div>
                </div>
                <div className="stat-tile">
                    <div className="eyebrow">Tributes fallen</div>
                    <div className="font-mono text-[var(--ink)] text-lg">{stats.fallen || '—'}</div>
                </div>
                <div className="stat-tile">
                    <div className="eyebrow">Avg kills per victor</div>
                    <div className="font-mono text-[var(--ink)] text-lg">{stats.avgKills.toFixed(1)}</div>
                </div>
                <div className="stat-tile">
                    <div className="eyebrow">Survival rate</div>
                    <div className="font-mono text-[var(--ink)] text-lg">
                        {stats.reaped > 0 ? `${Math.round(((stats.reaped - stats.fallen) / stats.reaped) * 100)}%` : '—'}
                    </div>
                </div>
            </div>

            <dl className="grid md:grid-cols-3 gap-2.5">
                <div className="panel-flush p-3">
                    <dt className="eyebrow">Most common cause of death</dt>
                    <dd className="mt-1 text-[var(--color-ink-100)] font-bold">
                        {stats.topCause ? stats.topCause.label : 'Not recorded'}
                    </dd>
                    {stats.topCause && (
                        <div className="text-xs text-[var(--color-ink-500)] mt-0.5 font-mono">
                            {stats.topCause.count} of {stats.fallen} deaths
                        </div>
                    )}
                </div>
                <div className="panel-flush p-3">
                    <dt className="eyebrow">Most successful district</dt>
                    <dd className="mt-1 text-[var(--color-ink-100)] font-bold">
                        {stats.topDistrict ? stats.topDistrict.label : '—'}
                    </dd>
                    {stats.topDistrict && (
                        <div className="text-xs text-[var(--color-ink-500)] mt-0.5 font-mono">
                            {stats.topDistrict.count} victor{stats.topDistrict.count === 1 ? '' : 's'} crowned
                        </div>
                    )}
                </div>
                <div className="panel-flush p-3">
                    <dt className="eyebrow">Luckiest arena</dt>
                    <dd className="mt-1 text-[var(--color-ink-100)] font-bold">
                        {stats.luckiestArena ? stats.luckiestArena.name : 'Not recorded'}
                    </dd>
                    {stats.luckiestArena && (
                        <div className="text-xs text-[var(--color-ink-500)] mt-0.5 font-mono">
                            {Math.round(stats.luckiestArena.avg)}% avg victor health
                        </div>
                    )}
                </div>
            </dl>
        </section>
    );
}
