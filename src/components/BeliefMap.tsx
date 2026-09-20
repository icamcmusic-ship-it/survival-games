import React, { useMemo, useState } from 'react';
import { GameState, Tribute } from '../models/types';

/**
 * AUDIT-6 §6.4: what one tribute believes about the arena, as opposed to what
 * is true about it.
 *
 * The rumour layer is the best-modelled side system in the repository and the
 * least visible. `memory.zones[]` holds a per-tribute impression of every
 * sector — when they last had eyes on it, how much dread it carries, how many
 * rivals they think are standing there, how picked-over they think it is — and
 * `hearsay`/`toldById` model *belief separately from truth*, so a lie has an
 * author to be furious with. Across 400 runs the engine produces 163 planted
 * claims, 81 of them eventually traced back to whoever planted them.
 *
 * None of it reached the screen, because every map view in the app draws the
 * true state. That made a two-hundred-line system invisible and made a whole
 * class of tribute decision look irrational: a tribute walking cheerfully into
 * a sector with four people in it is not stupid, they were told it was empty.
 *
 * So this is the same grid read through one tribute's memory. Nothing new is
 * computed and nothing is stored — it is a projection of state the engine
 * already keeps, which is why it costs one component.
 */

const ageLabel = (cycles: number) =>
    cycles <= 0 ? 'this cycle' : cycles === 1 ? 'last cycle' : `${cycles} cycles ago`;

export function BeliefMap({ gameState, tributes }: { gameState: GameState; tributes: Tribute[] }) {
    const living = useMemo(
        () => tributes.filter(t => t.status === 'alive').sort((a, b) => a.district - b.district || a.name.localeCompare(b.name)),
        [tributes],
    );
    const [watchedId, setWatchedId] = useState<string | null>(null);
    const watched = living.find(t => t.id === watchedId) ?? living[0];
    const cycle = gameState.cycle ?? 0;

    if (!watched) {
        return (
            <div className="panel-flush p-4 text-sm text-[var(--color-ink-400)]">
                Nobody is left to have an opinion about the arena.
            </div>
        );
    }

    const memory = watched.memory?.zones ?? {};
    const nameOf = (id: string | undefined) =>
        (id ? gameState.tributes.find(t => t.id === id)?.name : undefined) ?? 'somebody';

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
                <label className="eyebrow" htmlFor="belief-tribute">Read the arena as</label>
                <select
                    id="belief-tribute"
                    className="field text-xs w-auto min-h-[44px]"
                    aria-label="Read the arena as this tribute believes it to be"
                    value={watched.id}
                    onChange={e => setWatchedId(e.target.value)}
                >
                    {living.map(t => (
                        <option key={t.id} value={t.id}>{t.name} (D{t.district})</option>
                    ))}
                </select>
                <span className="text-micro text-[var(--color-ink-500)]">
                    Their impressions, not the truth. Impressions rot, and some of them were somebody else&rsquo;s idea.
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {gameState.arena.zones.map(zone => {
                    const belief = memory[zone.name];
                    const here = watched.zone === zone.name;
                    const stale = belief ? cycle - belief.seen : undefined;
                    const label = belief === undefined
                        ? `${zone.name} — ${watched.name} has never set eyes on it and has been told nothing about it`
                        : `${zone.name} — ${belief.hearsay ? `told to ${watched.name} by ${nameOf(belief.toldById)}` : 'seen first hand'}`
                            + `, ${ageLabel(stale ?? 0)}: ${belief.rivals} rival${belief.rivals === 1 ? '' : 's'} believed present,`
                            + ` dread ${Math.round(belief.threat)}, ${Math.round(belief.barren * 100)}% picked over`;
                    return (
                        <div
                            key={zone.name}
                            role="group"
                            aria-label={label}
                            title={label}
                            className={`panel-flush p-3 text-left flex flex-col gap-2 min-h-[110px] ${belief === undefined ? 'opacity-55' : ''}`}
                            style={here ? { borderColor: 'var(--red)' } : undefined}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <h4 className="font-extrabold text-sm leading-snug text-[var(--ink)]">{zone.name}</h4>
                                {here && <span className="chip chip-accent flex-none">standing here</span>}
                            </div>

                            {belief === undefined ? (
                                <span className="text-mini text-[var(--color-ink-500)]">
                                    Never seen. Nobody has mentioned it.
                                </span>
                            ) : (
                                <>
                                    <div className="flex flex-wrap gap-1.5 items-center text-micro font-mono uppercase tracking-wider">
                                        {belief.hearsay ? (
                                            <span className="chip" style={{ color: 'var(--cat-training)', borderColor: 'var(--cat-training)' }}>
                                                heard it from {nameOf(belief.toldById)}
                                            </span>
                                        ) : (
                                            <span className="chip">saw it themselves</span>
                                        )}
                                        <span className="text-[var(--color-ink-500)]">{ageLabel(stale ?? 0)}</span>
                                    </div>
                                    <dl className="grid grid-cols-3 gap-1 text-micro">
                                        <div>
                                            <dt className="text-[var(--color-ink-600)] uppercase tracking-wider">Rivals</dt>
                                            <dd className="font-mono text-[var(--ink)]">{belief.rivals}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-[var(--color-ink-600)] uppercase tracking-wider">Dread</dt>
                                            <dd className="font-mono" style={{ color: belief.threat >= 20 ? 'var(--cat-death)' : 'var(--ink)' }}>
                                                {Math.round(belief.threat)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-[var(--color-ink-600)] uppercase tracking-wider">Stripped</dt>
                                            <dd className="font-mono text-[var(--ink)]">{Math.round(belief.barren * 100)}%</dd>
                                        </div>
                                    </dl>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
