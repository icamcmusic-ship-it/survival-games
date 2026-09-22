import React from 'react';
import { DamageRecord, GameState, Tribute } from '../models/types';

/**
 * AUDIT-10 B3-02: causal inspection — *"from a death, jump to the wound, the
 * source incident, the failed escape, the attribution"*.
 *
 * The end screen gives a cause of death and the chronicle gives eight hundred
 * lines. Neither answers the question a player actually has, which is *how did
 * this person get from a hundred to nothing*. `engine/woundLedger` keeps every
 * `DamageRecord`; this reads it back as the account it is.
 *
 * Health after each blow is shown beside it, captured where the blow landed —
 * not reconstructed by subtracting backwards, which is exact for the last
 * wound and a lie for every earlier one, because it assumes nobody ever
 * healed. That figure is what turns a list into a story: the forty that took
 * somebody from eighty to forty reads differently from the four that finished
 * them.
 */

const KIND_TEXT: Record<DamageRecord['kind'], string> = {
    'tribute': 'a tribute',
    'mutt': 'a mutt',
    'hazard': 'the arena',
    'climate': 'the weather',
    'status': 'their own condition',
    'gamemaker': 'the Gamemakers',
    'arena': 'the arena',
};

export function WoundLedger({ tribute, gameState }: { tribute: Tribute; gameState: GameState }) {
    const wounds = tribute.wounds ?? [];
    if (wounds.length === 0) {
        return (
            <section>
                <h4 className="panel-title mb-2">What has hurt them</h4>
                <p className="text-[var(--color-ink-500)] text-mini">Not a scratch.</p>
            </section>
        );
    }

    const nameOf = (id: string) => gameState.tributes.find(t => t.id === id)?.name;

    return (
        <section>
            <h4 className="panel-title mb-2">What has hurt them ({wounds.length})</h4>
            <ol className="space-y-1">
                {wounds.map((w, i) => {
                    const by = w.sourceId ? nameOf(w.sourceId) : undefined;
                    const killing = i === wounds.length - 1 && tribute.status === 'dead';
                    return (
                        <li
                            key={i}
                            className={`flex justify-between gap-3 text-mini leading-snug ${killing ? 'text-[var(--red)]' : ''}`}
                        >
                            <span className="min-w-0">
                                <span className="font-mono text-[var(--color-ink-500)]">c{w.cycle}</span>{' '}
                                <span className={killing ? '' : 'text-[var(--color-ink-200)]'}>{w.cause}</span>
                                {/* The attribution, when there is one to make. A wound
                                    with a source is a wound somebody can be blamed for,
                                    and that is the half a cause of death leaves out. */}
                                {by && (
                                    <span className="text-[var(--color-ink-500)]">
                                        {' — '}{by}
                                    </span>
                                )}
                                {!by && w.kind !== 'tribute' && (
                                    <span className="text-[var(--color-ink-500)]"> — {KIND_TEXT[w.kind]}</span>
                                )}
                            </span>
                            <span className="font-mono text-[var(--color-ink-500)] flex-none text-right">
                                −{Math.round(w.amount)}
                                {/* Captured where the blow landed. Wounds from before
                                    the ledger existed, on a resumed save, have none —
                                    and a blank is better than a reconstruction that
                                    quietly assumes nobody ever healed. */}
                                {w.healthAfter !== undefined && ` → ${w.healthAfter}`}
                            </span>
                        </li>
                    );
                })}
            </ol>
            {tribute.status === 'dead' && (
                <p className="text-[var(--color-ink-500)] text-mini mt-2 leading-snug">
                    {/* The audit's actual complaint: the last line is not the answer. */}
                    The last line is the blow that finished them. It is rarely the whole reason.
                </p>
            )}
        </section>
    );
}
