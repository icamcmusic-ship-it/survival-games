import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useDialogFocus } from '../ui/useDialogFocus';
import { GameState } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { ViewName, gameActions, gameStore } from '../store/gameStore';
import { navigate, routeIsAvailable } from '../store/router';
import { chronicleStore, setChronicle } from '../store/chronicleStore';
import { useStore } from '../store/createStore';
import { prefsStore, setPrefs } from '../store/prefsStore';
import { resumeWithRecap, setUi } from '../ui/uiStore';

/**
 * §2.2: one search across the whole run.
 *
 * Cmd-K / Ctrl-K opens one field that searches actions, tribute names, sector
 * names, and the chronicle itself; every result is an action.
 *
 * AUDIT-11 U7/U8/U9 + §4:
 *  - useful before a run exists (New game, Resume slot N, Hall of Fame,
 *    How to play, Settings, spoiler toggle);
 *  - only offers routes that can actually render (`routeIsAvailable`), and
 *    filter/sector actions land on the chronicle, via one navigation;
 *  - a real combobox: `aria-activedescendant`, option ids, and the active
 *    row kept scrolled into view;
 *  - results grouped by kind with the match highlighted.
 */

type Kind = 'nav' | 'action' | 'tribute' | 'zone' | 'log';

/** AUDIT-12 §4: the order groups are shown in, so each group is one block. */
const KIND_ORDER: Kind[] = ['action', 'nav', 'tribute', 'zone', 'log'];

type Result = {
    id: string;
    kind: Kind;
    label: string;
    detail?: string;
    /** Extra words an action should match on. */
    keywords?: string;
    run: () => void;
};

const MAX_PER_KIND = 6;

const GROUP_LABEL: Record<Kind, string> = {
    nav: 'Go to',
    action: 'Actions',
    tribute: 'Tributes',
    zone: 'Sectors',
    log: 'Chronicle',
};

function Highlight({ text, needle }: { text: string; needle: string }) {
    if (!needle) return <>{text}</>;
    const at = text.toLowerCase().indexOf(needle);
    if (at < 0) return <>{text}</>;
    return (
        <>
            {text.slice(0, at)}
            <mark className="palette-mark">{text.slice(at, at + needle.length)}</mark>
            {text.slice(at + needle.length)}
        </>
    );
}

export function CommandPalette({ gameState, onSelectTribute }: {
    gameState: GameState | null;
    onSelectTribute?: (id: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [cursor, setCursor] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();
    const chron = useStore(chronicleStore, s => s);
    const spoilerSafe = useStore(prefsStore, p => p.spoilerSafe);
    const currentView = useStore(gameStore, s => s.view);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen(v => !v);
                setQuery('');
                setCursor(0);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Recomputed on open so the save-slot list is current.
    const slots = useMemo(() => (open ? gameActions.readSaveSlots() : []), [open]);

    const results = useMemo<Result[]>(() => {
        const needle = query.trim().toLowerCase();
        const go = (view: ViewName, q?: string) => navigate(view, q);

        // ---------- actions: available with or without a run ----------
        const actions: Result[] = [];
        // AUDIT-12 U10 / §4: the screen you are on is marked, not offered as a
        // destination.
        const view = (id: ViewName, label: string, keywords = '') => {
            if (!routeIsAvailable(id)) return;
            const here = id === currentView;
            actions.push({
                id: `v-${id}`, kind: 'nav', label, keywords,
                detail: here ? 'you are here' : undefined,
                run: () => { if (!here) go(id); },
            });
        };

        if (gameState) {
            const watchedId = chron.followedId ?? chron.filterTributeId;
            const watched = watchedId ? gameState.tributes.find(t => t.id === watchedId) ?? null : null;
            const inRun = gameState.phase !== 'reaping';
            if (watched) {
                actions.push({
                    id: 'v-open-watched', kind: 'action',
                    label: `Open ${watched.name}'s dossier`,
                    detail: 'the tribute you are watching · O',
                    run: () => onSelectTribute?.(watched.id),
                });
                if (inRun) {
                    actions.push({
                        id: 'v-filter-watched', kind: 'action',
                        label: chron.filterTributeId === watched.id
                            ? 'Clear the chronicle filter'
                            : `Filter the chronicle to ${watched.name}`,
                        detail: 'X',
                        run: () => {
                            const clearing = chron.filterTributeId === watched.id;
                            setChronicle(clearing
                                ? { filterTributeId: null, filterTributeId2: null }
                                : { filterTributeId: watched.id, filterTributeId2: null, filterPairMode: 'either' });
                            go('chronicle', clearing ? undefined : `tribute=${encodeURIComponent(watched.id)}`);
                        },
                    });
                }
            }
            // AUDIT-12 U9: "next" is next. Unfocused, it starts from the first
            // death and says so; on the last death it is not offered at all.
            const deaths = gameState.log.filter(l => l.category === 'death' || l.category === 'kill');
            const atDeath = deaths.findIndex(l => l.id === chron.focusLogId);
            const nextAt = atDeath === -1 ? 0 : atDeath + 1;
            const nextDeath = deaths[nextAt];
            if (nextDeath && inRun && !spoilerSafe) {
                actions.push({
                    id: 'v-next-death', kind: 'action',
                    label: atDeath === -1 ? 'Jump to the first death' : 'Jump to the next death',
                    detail: `${nextAt + 1} of ${deaths.length} · ${nextDeath.day === 0 ? nextDeath.phase : `day ${nextDeath.day}`} · D`,
                    keywords: 'next death kill cannon',
                    run: () => {
                        setChronicle({ focusLogId: nextDeath.id });
                        go('chronicle', `day=${nextDeath.day}&phase=${encodeURIComponent(nextDeath.phase)}`);
                    },
                });
            }
            view('roster', 'Go to the reaping', 'roster cast');
            view('game', 'Go to the arena', 'standings map');
            view('debrief', 'Go to the debrief', 'end what-if results victor');
            view('chronicle', 'Go to the chronicle', 'log read');
        }
        slots.forEach((slot, i) => {
            if (!slot) return;
            const n = (i + 1) as 1 | 2 | 3;
            // AUDIT-12 U10: a slot holding the run already on screen resumes nothing.
            if (gameState && slot.seed === gameState.seed && slot.day === gameState.day && slot.phase === gameState.phase) return;
            actions.push({
                id: `resume-${n}`, kind: 'nav',
                label: n === 1 ? 'Resume the autosaved run' : `Resume save slot ${n}`,
                detail: `${slot.day === 0 ? slot.phase : `Day ${slot.day} — ${slot.phase}`} · ${slot.alive} alive · seed ${slot.seed}`,
                keywords: 'load continue save slot',
                run: () => { void resumeWithRecap(n); },
            });
        });
        actions.push({ id: 'v-new', kind: 'nav', label: 'Start a new game', keywords: 'setup arena seed', run: () => go('setup') });
        view('hallOfFame', 'Go to the hall of fame', 'victors archive records');
        view('howToPlay', 'How to play', 'help rules');
        actions.push({ id: 'v-settings', kind: 'action', label: 'Open settings', keywords: 'theme sound units preferences', run: () => setUi({ settingsOpen: true }) });
        actions.push({
            id: 'v-spoiler', kind: 'action',
            label: spoilerSafe ? 'Turn spoiler-safe viewing off' : 'Turn spoiler-safe viewing on',
            keywords: 'spoiler hide deaths',
            run: () => setPrefs({ spoilerSafe: !spoilerSafe }),
        });

        const byKind = (a: Result, b: Result) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
        actions.sort(byKind);
        if (!needle) return actions;

        const out: Result[] = actions
            .filter(a => a.label.toLowerCase().includes(needle) || (a.keywords ?? '').includes(needle))
            .slice(0, MAX_PER_KIND * 2);
        if (!gameState) return out;

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
                    + (t.status === 'dead' ? (spoilerSafe && gameState.phase !== 'ended' ? '' : ` · died day ${t.dayOfDeath ?? '—'}`) : ` · ${t.health} health`),
                run: () => onSelectTribute?.(t.id),
            }));

        if (routeIsAvailable('chronicle')) {
            gameState.arena.zones
                .filter(z => !gameState.arenaHidden && z.name.toLowerCase().includes(needle))
                .slice(0, MAX_PER_KIND)
                .forEach(z => out.push({
                    id: `z-${z.name}`,
                    kind: 'zone',
                    label: z.name,
                    detail: `${z.terrain} · isolate this sector in the chronicle`,
                    run: () => { setChronicle({ selectedZone: z.name }); go('chronicle', `zone=${encodeURIComponent(z.name)}`); },
                }));

            const matches = gameState.log.filter(l => l.text.toLowerCase().includes(needle));
            matches.slice(-MAX_PER_KIND).reverse().forEach(l => out.push({
                id: `l-${l.id}`,
                kind: 'log',
                label: l.text.length > 90 ? `${l.text.slice(0, 89)}…` : l.text,
                detail: l.day === 0 ? l.phase : `Day ${l.day} · ${l.phase}`,
                run: () => {
                    const q = query.trim();
                    setChronicle({ searchText: q, filterDay: l.day });
                    go('chronicle', `day=${l.day}&phase=${encodeURIComponent(l.phase)}&q=${encodeURIComponent(q)}`);
                },
            }));
        }
        return out;
    }, [query, gameState, onSelectTribute, chron, slots, spoilerSafe, currentView]);

    // U9: keep the active option in view.
    useEffect(() => {
        if (!open) return;
        document.getElementById(`${listId}-opt-${cursor}`)?.scrollIntoView({ block: 'nearest' });
    }, [cursor, open, listId]);

    if (!open) return null;

    const choose = (r: Result | undefined) => {
        if (!r) return;
        setOpen(false);
        r.run();
    };
    const needle = query.trim().toLowerCase();
    const activeId = results[cursor] ? `${listId}-opt-${cursor}` : undefined;

    return (
        <PaletteDialog
            onClose={() => setOpen(false)}
            input={
                <input
                    ref={inputRef}
                    type="search"
                    role="combobox"
                    aria-expanded={results.length > 0}
                    aria-controls={listId}
                    aria-activedescendant={activeId}
                    aria-autocomplete="list"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setCursor(0); }}
                    onKeyDown={e => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(results.length - 1, c + 1)); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
                        else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); setCursor(0); }
                        else if (e.key === 'End' && e.ctrlKey) { e.preventDefault(); setCursor(Math.max(0, results.length - 1)); }
                        else if (e.key === 'Enter') { e.preventDefault(); choose(results[cursor]); }
                    }}
                    placeholder={gameState ? 'Search actions, tributes, sectors and the chronicle…' : 'Search actions…'}
                    aria-label="Search tributes, sectors and the chronicle — and actions"
                    className="field text-sm w-full border-0 border-b-2 border-[var(--color-ink-800)] rounded-none"
                />
            }
        >
            <div id={listId} className="max-h-[55vh] overflow-y-auto custom-scrollbar" role="listbox" aria-label="Results">
                {results.length === 0 ? (
                    <div className="empty-state m-3" role="presentation">Nothing matches “{query}”.</div>
                ) : results.map((r, i) => (
                    <React.Fragment key={r.id}>
                        {(i === 0 || results[i - 1].kind !== r.kind) && (
                            <div role="presentation" className="eyebrow px-4 pt-2.5 pb-1 bg-[var(--paper-flush)]">{GROUP_LABEL[r.kind]}</div>
                        )}
                        <div
                            id={`${listId}-opt-${i}`}
                            role="option"
                            aria-selected={i === cursor}
                            onMouseEnter={() => setCursor(i)}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => choose(r)}
                            className="w-full text-left px-4 py-2.5 min-h-[44px] flex items-baseline gap-3 border-b border-[var(--line-soft)] cursor-pointer"
                            style={i === cursor ? { background: 'var(--paper-flush)', boxShadow: 'inset 3px 0 0 var(--red)' } : undefined}
                        >
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm text-[var(--ink)] truncate"><Highlight text={r.label} needle={needle} /></span>
                                {r.detail && (
                                    <span className="block text-mini text-[var(--color-ink-500)] truncate">{r.detail}</span>
                                )}
                            </span>
                        </div>
                    </React.Fragment>
                ))}
            </div>
            <div className="kbd-hint px-4 py-2 text-micro font-mono uppercase tracking-wider text-[var(--color-ink-500)] flex gap-3 flex-wrap">
                <span>↑↓ move</span><span>⏎ open</span><span>Esc close</span>
            </div>
        </PaletteDialog>
    );
}

/**
 * Split out so `useDialogFocus` runs on a node that mounts when the palette
 * opens. The shared dialog stack handles Escape (topmost only), the focus
 * trap, the inert background and the scroll lock.
 */
function PaletteDialog({ onClose, input, children }: {
    onClose: () => void;
    input: React.ReactNode;
    children: React.ReactNode;
}) {
    const panelRef = useDialogFocus<HTMLDivElement>(onClose);
    return (
        <div
            className="fixed inset-0 z-[60] bg-black/60 flex items-start justify-center p-4 pt-[12vh]"
            onClick={onClose}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label="Search everything"
                className="panel w-full max-w-xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {input}
                {children}
            </div>
        </div>
    );
}
