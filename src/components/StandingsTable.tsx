import React, { useMemo, useState } from 'react';
import { GameState, Tribute } from '../models/types';
import { objectiveLabel } from '../engine/objectives';
import { tributeOdds } from '../engine/odds';
import { STANCE_PROFILES } from '../data/stances';
import { ARCHETYPES } from '../data/archetypes';
import { ArrowDown, ArrowUp } from 'lucide-react';

/**
 * A6: the standings table.
 *
 * The only way to compare two tributes was to open their modals one at a time
 * and remember the first one. Every column here is data the app already holds;
 * none of it had a surface that put two tributes on the same row.
 */
type Column =
    | 'name' | 'district' | 'status' | 'health' | 'kills' | 'days'
    | 'zone' | 'stance' | 'archetype' | 'alliance' | 'odds';

const COLUMNS: Array<{ id: Column; label: string; numeric?: boolean; className?: string }> = [
    { id: 'name', label: 'Tribute' },
    { id: 'district', label: 'D', numeric: true },
    { id: 'archetype', label: 'Archetype' },
    { id: 'health', label: 'Health', numeric: true },
    { id: 'kills', label: 'Kills', numeric: true },
    { id: 'days', label: 'Days', numeric: true },
    { id: 'stance', label: 'Stance' },
    { id: 'zone', label: 'Sector' },
    { id: 'alliance', label: 'Alliance' },
    { id: 'odds', label: 'Odds', numeric: true },
];

export function StandingsTable({
    gameState,
    onSelectTribute,
    allianceAccent,
    arenaSealed,
    followedId,
    onFollow,
}: {
    gameState: GameState;
    onSelectTribute: (id: string) => void;
    allianceAccent: (allianceId?: string) => string | undefined;
    arenaSealed: boolean;
    followedId: string | null;
    onFollow: (id: string | null) => void;
}) {
    const [sort, setSort] = useState<{ column: Column; desc: boolean }>({ column: 'odds', desc: true });
    const [aliveOnly, setAliveOnly] = useState(false);

    const odds = useMemo(() => {
        const map: Record<string, number> = {};
        gameState.tributes
            .filter(t => t.status === 'alive')
            .forEach(t => { map[t.id] = tributeOdds(t, gameState.tributes).pct; });
        return map;
    }, [gameState.tributes]);

    const value = (t: Tribute, column: Column): string | number => {
        switch (column) {
            case 'name': return t.name;
            case 'district': return t.district;
            case 'status': return t.status;
            case 'health': return t.status === 'alive' ? t.health : -1;
            case 'kills': return t.kills;
            case 'days': return t.daysSurvived;
            case 'zone': return arenaSealed ? '' : t.zone;
            case 'stance': return t.status === 'alive' ? t.stance : '';
            case 'archetype': return ARCHETYPES[t.archetype]?.name ?? t.archetype;
            case 'alliance': return t.allianceId ?? '';
            case 'odds': return odds[t.id] ?? -1;
        }
    };

    const rows = useMemo(() => {
        const list = gameState.tributes.filter(t => !aliveOnly || t.status === 'alive');
        return [...list].sort((a, b) => {
            // The dead always sort below the living, whatever the column —
            // a table topped by corpses is not a standings table.
            if (a.status !== b.status) return a.status === 'alive' ? -1 : 1;
            const av = value(a, sort.column);
            const bv = value(b, sort.column);
            const cmp = typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : String(av).localeCompare(String(bv));
            return sort.desc ? -cmp : cmp;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState.tributes, sort, aliveOnly, odds, arenaSealed]);

    const toggleSort = (column: Column) => setSort(s =>
        s.column === column ? { column, desc: !s.desc } : { column, desc: column !== 'name' && column !== 'archetype' });

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="panel-title">Standings</h3>
                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] uppercase tracking-wider text-[var(--color-ink-500)]">
                    <input
                        type="checkbox"
                        checked={aliveOnly}
                        onChange={e => setAliveOnly(e.target.checked)}
                        className="accent-[var(--red)]"
                    />
                    Living only
                </label>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr>
                            <th scope="col" className="p-1 w-6" />
                            {COLUMNS.map(col => {
                                const active = sort.column === col.id;
                                return (
                                    <th
                                        key={col.id}
                                        scope="col"
                                        aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}
                                        className={`p-1 text-left border-b-2 border-[var(--color-ink-800)] ${col.numeric ? 'text-right' : ''}`}
                                    >
                                        <button
                                            onClick={() => toggleSort(col.id)}
                                            className="eyebrow inline-flex items-center gap-0.5 hover:text-[var(--red)]"
                                        >
                                            {col.label}
                                            {active && (sort.desc
                                                ? <ArrowDown className="w-3 h-3" aria-hidden="true" />
                                                : <ArrowUp className="w-3 h-3" aria-hidden="true" />)}
                                        </button>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(t => {
                            const dead = t.status === 'dead';
                            const accent = dead ? undefined : allianceAccent(t.allianceId);
                            return (
                                <tr
                                    key={t.id}
                                    className={`border-b border-[var(--line-soft)] hover:bg-[var(--paper-flush)] ${dead ? 'opacity-50' : ''}`}
                                >
                                    <td className="p-1">
                                        <button
                                            onClick={() => onFollow(followedId === t.id ? null : t.id)}
                                            aria-pressed={followedId === t.id}
                                            aria-label={followedId === t.id ? `Stop following ${t.name}` : `Follow ${t.name}`}
                                            title={followedId === t.id ? 'Following' : 'Follow this tribute'}
                                            className={followedId === t.id ? 'text-[var(--red)]' : 'text-[var(--color-ink-600)]'}
                                            disabled={dead}
                                        >
                                            ★
                                        </button>
                                    </td>
                                    <td className="p-1">
                                        <button
                                            onClick={() => onSelectTribute(t.id)}
                                            className={`font-bold text-left hover:text-[var(--red)] ${dead ? 'line-through' : ''}`}
                                            style={accent ? { borderLeft: `3px solid ${accent}`, paddingLeft: 4 } : undefined}
                                        >
                                            {t.name}
                                        </button>
                                    </td>
                                    <td className="p-1 text-right font-mono">{t.district}</td>
                                    <td className="p-1">{ARCHETYPES[t.archetype]?.name ?? t.archetype}</td>
                                    <td className="p-1 text-right font-mono">{dead ? '—' : t.health}</td>
                                    <td className="p-1 text-right font-mono">{t.kills}</td>
                                    <td className="p-1 text-right font-mono">{t.daysSurvived}</td>
                                    <td className="p-1" title={dead ? undefined : STANCE_PROFILES[t.stance]?.blurb}>
                                        {dead ? '—' : t.stance}
                                    </td>
                                    <td className="p-1 truncate max-w-[10rem]" title={dead ? (t.causeOfDeath ?? '') : objectiveLabel(gameState, t)}>
                                        {dead ? (t.causeOfDeath ?? 'Eliminated') : arenaSealed ? '❓' : t.zone}
                                    </td>
                                    <td className="p-1">
                                        {dead || !t.allianceId ? '—' : (
                                            <span className="chip" style={accent ? { color: accent, borderColor: accent } : undefined}>Pack</span>
                                        )}
                                    </td>
                                    <td className="p-1 text-right font-mono">{dead ? '—' : `${odds[t.id] ?? 0}%`}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
