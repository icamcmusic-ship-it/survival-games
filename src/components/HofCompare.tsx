import React from 'react';
import { HallOfFameEntry } from '../models/types';
import { DEFAULT_GAME_CONFIG } from '../data/constants';
import { lengthEstimate } from '../data/arenaBriefing';

/**
 * §2.3: two archived runs, side by side.
 *
 * The Hall of Fame stores each entry's `config`, `arenaId` and `quellId` — the
 * whole point of which is that a run can be relaunched exactly — and there was
 * no way to ask the obvious next question: what was different about the one
 * that went well? Comparing two entries is a read over data already on disk.
 *
 * Deliberately a difference list rather than a table: identical settings are
 * the common case and printing twenty matching rows buries the two that moved.
 */
const FIELDS: Array<{ key: keyof typeof DEFAULT_GAME_CONFIG; label: string }> = [
    { key: 'districtCount', label: 'Districts' },
    { key: 'hazardRate', label: 'Hazards' },
    { key: 'betrayalRate', label: 'Betrayal' },
    { key: 'sponsorGenerosity', label: 'Sponsors' },
    { key: 'enableFeast', label: 'Feast' },
    { key: 'enableSanity', label: 'Sanity' },
    { key: 'vanillaRules', label: 'Plain rules' },
    { key: 'plainNames', label: 'Plain names' },
];

const show = (v: unknown): string =>
    v === undefined ? '—' : typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v);

export function HofCompare({ a, b, onClear }: {
    a: HallOfFameEntry;
    b: HallOfFameEntry;
    onClear: () => void;
}) {
    const rows = FIELDS
        .map(f => ({ ...f, left: a.config?.[f.key], right: b.config?.[f.key] }))
        .filter(r => r.left !== r.right);

    const estimate = (e: HallOfFameEntry) => e.config
        ? lengthEstimate(e.config.districtCount, e.config.hazardRate, e.config.betrayalRate)
        : 'unknown';

    const line = (label: string, left: React.ReactNode, right: React.ReactNode, changed = true) => (
        <div className={`grid grid-cols-[7rem_1fr_1fr] gap-2 text-[11px] py-1 ${changed ? '' : 'opacity-60'}`}>
            <span className="eyebrow pt-px">{label}</span>
            <span className="text-[var(--color-ink-200)] truncate">{left}</span>
            <span className="text-[var(--color-ink-200)] truncate">{right}</span>
        </div>
    );

    return (
        <div className="panel p-5 space-y-2" style={{ borderColor: 'var(--red)', borderWidth: '3px' }}>
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span className="eyebrow" style={{ color: 'var(--red)' }}>Comparing two Games</span>
                <button onClick={onClear} className="btn btn-sm btn-ghost">Clear</button>
            </div>
            <div className="grid grid-cols-[7rem_1fr_1fr] gap-2 text-[11px] border-b-2 border-[var(--line-soft)] pb-1">
                <span />
                <span className="font-black uppercase text-[var(--ink)] truncate">{a.winnerName} · {a.arenaName}</span>
                <span className="font-black uppercase text-[var(--ink)] truncate">{b.winnerName} · {b.arenaName}</span>
            </div>
            {line('Seed', a.seed, b.seed)}
            {line('Kills', a.kills, b.kills)}
            {line('End health', typeof a.winnerEndHealth === 'number' ? `${a.winnerEndHealth}%` : '—',
                typeof b.winnerEndHealth === 'number' ? `${b.winnerEndHealth}%` : '—')}
            {line('Quell', a.quellId ?? 'none', b.quellId ?? 'none')}
            {line('Forecast', estimate(a), estimate(b))}
            {rows.length === 0
                ? <p className="text-[11px] text-[var(--color-ink-500)] pt-1">
                    Identical settings. Whatever separated these two Games, it was the seed and the cast, not the dials.
                  </p>
                : rows.map(r => line(r.label, show(r.left), show(r.right)))}
        </div>
    );
}
