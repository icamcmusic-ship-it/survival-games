import React from 'react';
import { ACHIEVEMENTS } from '../data/achievements';
import { PanemRecords, RECORD_DEFS } from '../utils/panemStorage';
import { Trophy, Lock, Check } from 'lucide-react';

/**
 * REPLAY-03/04: what the player has, across every run they have ever finished.
 *
 * Locked achievements are shown by name and hint rather than hidden, because
 * the whole point of the list is to tell a player what the simulation can do
 * that they have not seen yet. A hidden list teaches nothing.
 */
export function PanemRecordBook({ panem }: { panem: PanemRecords }) {
    const unlocked = new Set(panem.unlocked);
    const seen = ACHIEVEMENTS.filter(a => unlocked.has(a.id));
    const unseen = ACHIEVEMENTS.filter(a => !unlocked.has(a.id));
    const heldRecords = RECORD_DEFS.filter(def => panem.bests[def.id] !== undefined);

    if (panem.runs === 0) {
        return (
            <div className="panel p-5">
                <h3 className="panel-title mb-2">Your Panem</h3>
                <p className="text-sm text-[var(--color-ink-500)]">
                    No Games finished yet. Records and the list of things these Games can do will fill in
                    as you run them.
                </p>
            </div>
        );
    }

    return (
        <div className="panel p-5 space-y-5">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h3 className="panel-title">Your Panem</h3>
                <span className="text-[11px] font-mono text-[var(--color-ink-500)]">
                    {panem.runs} Games finished · {panem.victors} crowned ·{' '}
                    {seen.length}/{ACHIEVEMENTS.length} seen
                </span>
            </div>

            {heldRecords.length > 0 && (
                <section>
                    <div className="eyebrow mb-2">Record book</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {heldRecords.map(def => {
                            const held = panem.bests[def.id]!;
                            return (
                                <div key={def.id} className="panel-flush p-2.5">
                                    <div className="eyebrow">{def.label}</div>
                                    <div className="text-sm text-[var(--ink)] font-semibold mt-0.5">
                                        {def.format(held.value)}
                                    </div>
                                    <div className="text-[11px] text-[var(--color-ink-500)] truncate">
                                        {held.name} (D{held.district}) · {held.arenaName} · seed {held.seed}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            <section>
                <div className="eyebrow mb-2">Things these Games can do</div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                    {seen.map(a => (
                        <div key={a.id} className="panel-flush p-2.5 flex items-start gap-2.5">
                            <Check className="w-3.5 h-3.5 mt-0.5 flex-none" style={{ color: 'var(--cat-alliance)' }} />
                            <div className="min-w-0">
                                <div className="text-sm font-bold text-[var(--ink)]">{a.name}</div>
                                <div className="text-[11px] text-[var(--color-ink-500)]">{a.hint}</div>
                            </div>
                        </div>
                    ))}
                    {unseen.map(a => (
                        <div key={a.id} className="panel-flush p-2.5 flex items-start gap-2.5 opacity-55">
                            <Lock className="w-3.5 h-3.5 mt-0.5 flex-none text-[var(--color-ink-500)]" />
                            <div className="min-w-0">
                                <div className="text-sm font-bold text-[var(--color-ink-400)]">{a.name}</div>
                                <div className="text-[11px] text-[var(--color-ink-500)]">{a.hint}</div>
                            </div>
                        </div>
                    ))}
                </div>
                {unseen.length > 0 && (
                    <p className="text-[11px] text-[var(--color-ink-500)] mt-2 italic">
                        <Trophy className="w-3 h-3 inline mb-0.5" /> Locked entries are listed on purpose —
                        they are a menu of outcomes this simulation can produce, not a secret.
                    </p>
                )}
            </section>
        </div>
    );
}
