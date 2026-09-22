import React from 'react';
import { DamageRecord, DeathCauseCode, GameState, Tribute } from '../models/types';

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

/**
 * What a wound is, from its typed code, in the present tense.
 *
 * `DamageRecord.cause` is documented as "human-readable cause, used verbatim
 * as cause of death" — it is written as the sentence that will appear in an
 * obituary *if* this blow turns out to be the last one. Printing it for every
 * entry gave a tribute standing at 44 health a list reading "Died of
 * dehydration", "Succumbed to an infected wound", "Killed by District 2 Boy",
 * which is absurd and was entirely this panel's fault: it took a field that is
 * only true in one case and displayed it in all of them.
 *
 * The code is the typed fact and survives the distinction, so the code is what
 * this reads. The cause line is kept for the entry that actually did kill
 * them, where it is the true sentence and the one the obituary uses.
 */
const WOUND_TEXT: Partial<Record<DeathCauseCode, string>> = {
    'tribute': 'Cut down in a fight',
    'bleeding': 'Bleeding that would not stop',
    'infection': 'A wound turning',
    'sepsis': 'The infection reaching further',
    'poison': 'Poison',
    'shock': 'Shock',
    'dehydration': 'Going without water',
    'starvation': 'Going without food',
    'exhaustion': 'Pushed past exhaustion',
    'hypothermia': 'The cold',
    'heatstroke': 'The heat',
    'burns': 'Burns',
    'asphyxiation': 'Unable to breathe',
    'exposure': 'Exposure',
    'drowning': 'Water closing over them',
    'fall': 'A fall',
    'collapse': 'Something coming down on them',
    'border': 'The border',
    'trap': 'A trap',
    'machinery': 'The arena\'s machinery',
    'hazard': 'The ground turning on them',
    'mutt': 'A mutt',
    'gamemaker': 'The Gamemakers',
    'nightlock': 'Nightlock',
    'self-inflicted': 'By their own hand',
    'status': 'Their own condition',
};

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

    /*
     * Consecutive ticks of the same thing are one line.
     *
     * A status effect bites every cycle, so untreated burns produced three
     * identical rows in a row — "Died of untreated burns", twice more, two
     * damage each — which is a chronicle of a mechanic rather than of a
     * tribute. Grouped, it reads as what it is: burns, over three cycles, for
     * six. The killing blow never groups, because it is a distinct event and
     * the last line is the one the obituary argues about.
     */
    const rows: Array<{ first: DamageRecord; last: DamageRecord; ticks: number; total: number; killing: boolean }> = [];
    wounds.forEach((w, i) => {
        const killing = i === wounds.length - 1 && tribute.status === 'dead';
        const open = rows[rows.length - 1];
        const sameThing = open && !open.killing && !killing
            && open.last.code === w.code && open.last.sourceId === w.sourceId;
        if (sameThing) {
            open.last = w;
            open.ticks += 1;
            open.total += w.amount;
            return;
        }
        rows.push({ first: w, last: w, ticks: 1, total: w.amount, killing });
    });

    return (
        <section>
            <h4 className="panel-title mb-2">What has hurt them ({wounds.length})</h4>
            <ol className="space-y-1">
                {rows.map((row, i) => {
                    const w = row.last;
                    const by = w.sourceId ? nameOf(w.sourceId) : undefined;
                    const killing = row.killing;
                    return (
                        <li
                            key={i}
                            className={`flex justify-between gap-3 text-mini leading-snug ${killing ? 'text-[var(--red)]' : ''}`}
                        >
                            <span className="min-w-0">
                                <span className="font-mono text-[var(--color-ink-500)]">
                                    c{row.first.cycle}{row.ticks > 1 && row.last.cycle !== row.first.cycle ? `-${row.last.cycle}` : ''}
                                </span>{' '}
                                {/* The killing blow keeps its obituary sentence, because
                                    there it is true and it is the one the record book
                                    uses. Every other entry is described as the wound it
                                    was. */}
                                <span className={killing ? '' : 'text-[var(--color-ink-200)]'}>
                                    {killing ? w.cause : (WOUND_TEXT[w.code ?? 'status'] ?? 'A wound')}
                                </span>
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
                                −{Math.round(row.total)}{row.ticks > 1 ? ` (${row.ticks}\u00d7)` : ''}
                                {/* Captured where the blow landed. Wounds from before
                                    the ledger existed, on a resumed save, have none —
                                    and a blank is better than a reconstruction that
                                    quietly assumes nobody ever healed. */}
                                {row.last.healthAfter !== undefined && ` → ${row.last.healthAfter}`}
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
