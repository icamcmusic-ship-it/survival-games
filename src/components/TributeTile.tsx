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
    /**
     * Audit 4 §2.1: `Tribute.downed` was named by no component in the app.
     *
     * A tribute lying downed — with a rescue window, a cause and, usually, the
     * name of whoever put them there — is the most dramatic state the
     * simulation can hold. It occupies 1.5% of all tribute-cycles and resolves
     * 174 times to a finishing blow, 137 to a rescue and 135 to mercy across
     * 160 runs. The feed narrated it; every surface that draws a tribute —
     * this tile, the standings, the map — drew somebody standing up.
     *
     * It goes here because this is the one component every one of those
     * surfaces already renders through.
     */
    const downed = !dead && !!tribute.downed;
    const box = size === 'sm' ? 'w-8 h-8 text-nano' : 'w-11 h-11 text-mini';
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
                <span className={`block font-black uppercase leading-tight truncate ${size === 'sm' ? 'text-mini' : 'text-sm'} ${dead && dimDead ? 'line-through text-[var(--color-ink-500)]' : 'text-[var(--ink)]'}`}>
                    {tribute.name}
                    {/* §11.5: the name the country gave them. Awarded once and
                        permanent, and until now visible only in the line that
                        awarded it. */}
                    {tribute.epithet && size !== 'sm' && (
                        <span className="ml-1 font-bold normal-case text-micro text-[var(--gold)]">{tribute.epithet}</span>
                    )}
                </span>
                <span className="block font-mono font-bold text-nano uppercase tracking-wider text-[var(--color-ink-500)] truncate">
                    D{tribute.district} · {tribute.gender === 'Male' ? 'M' : 'F'} · {tribute.age}
                    {dead ? ' · †' : ''}
                    {downed && (
                        <span className="ml-1 text-[var(--red)]">
                            · down, {tribute.downed!.cyclesLeft} left
                        </span>
                    )}
                    {!dead && !downed && tribute.transit && (
                        <span className="ml-1 text-[var(--color-ink-400)]">· in transit</span>
                    )}
                </span>
            </span>
        </>
    );

    /**
     * Audit 4 §2.2/§2.4: the tile carried one `aria-` attribute and put its
     * whole description in a `title`, which a phone never shows and a screen
     * reader mostly will not announce over an element that already has a name.
     * The same string is the button's accessible name now, and it says the
     * things the visual tile says — including the two states added above.
     */
    const described = `${tribute.name} — District ${tribute.district}, ${tribute.gender}, age ${tribute.age}`
        + (tribute.epithet ? `, known as ${tribute.epithet}` : '')
        + (dead ? ' (deceased)' : downed ? ` (down, ${tribute.downed!.cyclesLeft} cycles left)` : tribute.transit ? ' (in transit)' : '');

    if (!onSelect) {
        return (
            <span
                role="group"
                aria-label={described}
                className={`inline-flex items-center gap-2 ${dead && dimDead ? 'opacity-70' : ''}`}
            >
                {body}
            </span>
        );
    }
    return (
        <button
            type="button"
            onClick={() => onSelect(tribute.id)}
            aria-label={described}
            className={`inline-flex items-center gap-2 hover:opacity-80 focus-visible:outline focus-visible:outline-1 ${dead && dimDead ? 'opacity-70' : ''}`}
        >
            {body}
        </button>
    );
}
