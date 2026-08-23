import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameState } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { gameActions } from '../store/gameStore';
import { pathForView } from '../store/router';
import { setChronicle } from '../store/chronicleStore';

/**
 * §2.2: one search across the whole run.
 *
 * The chronicle search was per-view and searched log text only. A reader
 * looking for "where did Rue die", "what is the Warren", or "which achievement
 * was I close to" had three different controls to find and none of them
 * answered across categories. Cmd-K / Ctrl-K opens one field that searches
 * tribute names, sector names, and the chronicle itself, and every result is
 * an action rather than a highlight.
 */

type Result = {
    id: string;
    kind: 'tribute' | 'zone' | 'log' | 'view';
    label: string;
    detail?: string;
    run: () => void;
};

const MAX_PER_KIND = 6;

export function CommandPalette({ gameState, onSelectTribute }: {
    gameState: GameState | null;
    onSelectTribute?: (id: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [cursor, setCursor] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen(v => !v);
                setQuery('');
                setCursor(0);
                return;
            }
            if (e.key === 'Escape' && open) setOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    useEffect(() => {
        if (open) requestAnimationFrame(() => inputRef.current?.focus());
    }, [open]);

    const results = useMemo<Result[]>(() => {
        const needle = query.trim().toLowerCase();
        if (!gameState) return [];
        const out: Result[] = [];

        const go = (view: 'game' | 'roster' | 'chronicle' | 'hallOfFame') => {
            gameActions.setView(view);
            window.location.hash = pathForView(view);
        };

        if (!needle) {
            return [
                { id: 'v-arena', kind: 'view', label: 'Go to the arena', run: () => go('game') },
                { id: 'v-chronicle', kind: 'view', label: 'Go to the chronicle', run: () => go('chronicle') },
                { id: 'v-roster', kind: 'view', label: 'Go to the roster', run: () => go('roster') },
                { id: 'v-hof', kind: 'view', label: 'Go to the hall of fame', run: () => go('hallOfFame') },
            ];
        }

        gameState.tributes
            .filter(t => t.name.toLowerCase().includes(needle)
                || `d${t.district}` === needle
                || ARCHETYPES[t.archetype]?.name.toLowerCase().includes(needle))
            .slice(0, MAX_PER_KIND)
            .forEach(t => out.push({
                id: `t-${t.id}`,
                kind: 'tribute',
                label: t.name,
                detail: `District ${t.district} · ${ARCHETYPES[t.archetype]?.name ?? t.archetype}`
                    + (t.status === 'dead' ? ` · died day ${t.dayOfDeath ?? '—'}` : ` · ${t.health} health`),
                run: () => onSelectTribute?.(t.id),
            }));

        gameState.arena.zones
            .filter(z => !gameState.arenaHidden && z.name.toLowerCase().includes(needle))
            .slice(0, MAX_PER_KIND)
            .forEach(z => out.push({
                id: `z-${z.name}`,
                kind: 'zone',
                label: z.name,
                detail: `${z.terrain} · isolate this sector's log`,
                run: () => { setChronicle({ selectedZone: z.name }); go('game'); },
            }));

        // Newest first: a search across a finished run is usually looking for
        // something recent, and the chronicle page opens on whatever day the
        // filter leaves standing.
        const matches = gameState.log.filter(l => l.text.toLowerCase().includes(needle));
        matches.slice(-MAX_PER_KIND).reverse().forEach(l => out.push({
            id: `l-${l.id}`,
            kind: 'log',
            label: l.text.length > 90 ? `${l.text.slice(0, 89)}…` : l.text,
            detail: l.day === 0 ? l.phase : `Day ${l.day} · ${l.phase}`,
            run: () => {
                setChronicle({ searchText: query.trim(), filterDay: l.day });
                go('chronicle');
            },
        }));

        return out;
    }, [query, gameState, onSelectTribute]);

    if (!open) return null;

    const choose = (r: Result | undefined) => {
        if (!r) return;
        r.run();
        setOpen(false);
    };

    return (
        <div
            className="fixed inset-0 z-[60] bg-black/60 flex items-start justify-center p-4 pt-[12vh]"
            role="dialog"
            aria-modal="true"
            aria-label="Search everything"
            onClick={() => setOpen(false)}
        >
            <div className="panel w-full max-w-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setCursor(0); }}
                    onKeyDown={e => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(results.length - 1, c + 1)); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
                        else if (e.key === 'Enter') { e.preventDefault(); choose(results[cursor]); }
                    }}
                    placeholder="Search tributes, sectors and the chronicle…"
                    aria-label="Search tributes, sectors and the chronicle"
                    className="field text-sm w-full border-0 border-b-2 border-[var(--color-ink-800)] rounded-none"
                />
                <div className="max-h-[55vh] overflow-y-auto custom-scrollbar" role="listbox">
                    {results.length === 0 ? (
                        <div className="empty-state m-3">Nothing matches “{query}”.</div>
                    ) : results.map((r, i) => (
                        <button
                            key={r.id}
                            role="option"
                            aria-selected={i === cursor}
                            onMouseEnter={() => setCursor(i)}
                            onClick={() => choose(r)}
                            className="w-full text-left px-4 py-2.5 flex items-baseline gap-3 border-b border-[var(--line-soft)]"
                            style={i === cursor ? { background: 'var(--paper-flush)' } : undefined}
                        >
                            <span className="eyebrow flex-none w-16">{r.kind}</span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm text-[var(--ink)] truncate">{r.label}</span>
                                {r.detail && (
                                    <span className="block text-[11px] text-[var(--color-ink-500)] truncate">{r.detail}</span>
                                )}
                            </span>
                        </button>
                    ))}
                </div>
                <div className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-500)] flex gap-3 flex-wrap">
                    <span>↑↓ move</span><span>⏎ open</span><span>Esc close</span>
                </div>
            </div>
        </div>
    );
}
