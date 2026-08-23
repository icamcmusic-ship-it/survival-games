import React from 'react';
import { Tribute } from '../models/types';

/**
 * A3: the district-badge tile, promoted out of `EventFeed`'s `DeathCard`.
 *
 * The death interstitial was the only place in the app that rendered a tribute
 * as a *face* — a bordered district badge plus name, district, gender and age —
 * and the chronicle page needs the same thing on every card, not just the
 * fatal ones. Shared rather than copied so the two never drift apart.
 */
export function TributeTile({
    tribute,
    size = 'md',
    onSelect,
    dimDead = true,
    accent,
}: {
    tribute: Tribute;
    size?: 'sm' | 'md';
    onSelect?: (id: string) => void;
    /** Fallen tributes read back at reduced weight unless the caller says not to. */
    dimDead?: boolean;
    /** Alliance colour, when the caller is showing alliances. */
    accent?: string;
}) {
    const dead = tribute.status === 'dead';
    const box = size === 'sm' ? 'w-8 h-8 text-[9px]' : 'w-11 h-11 text-[11px]';
    const body = (
        <>
            <span
                className={`flex-none ${box} flex items-center justify-center border-2 bg-[var(--paper-flush)] font-mono font-black text-[var(--color-ink-500)]`}
                style={{ borderColor: accent ?? 'var(--ink)' }}
                aria-hidden="true"
            >
                D{tribute.district}
            </span>
            <span className="min-w-0 text-left">
                <span className={`block font-black uppercase leading-tight truncate ${size === 'sm' ? 'text-[11px]' : 'text-sm'} ${dead && dimDead ? 'line-through text-[var(--color-ink-500)]' : 'text-[var(--ink)]'}`}>
                    {tribute.name}
                </span>
                <span className="block font-mono font-bold text-[9px] uppercase tracking-wider text-[var(--color-ink-500)] truncate">
                    D{tribute.district} · {tribute.gender === 'Male' ? 'M' : 'F'} · {tribute.age}
                    {dead ? ' · †' : ''}
                </span>
            </span>
        </>
    );

    if (!onSelect) {
        return (
            <span className={`inline-flex items-center gap-2 ${dead && dimDead ? 'opacity-70' : ''}`}>
                {body}
            </span>
        );
    }
    return (
        <button
            type="button"
            onClick={() => onSelect(tribute.id)}
            title={`${tribute.name} — District ${tribute.district}, ${tribute.gender}, age ${tribute.age}${dead ? ' (deceased)' : ''}`}
            className={`inline-flex items-center gap-2 hover:opacity-80 focus-visible:outline focus-visible:outline-1 ${dead && dimDead ? 'opacity-70' : ''}`}
        >
            {body}
        </button>
    );
}
