import { useMemo, useState } from 'react';
import { GameState } from '../models/types';
import { achievementsAvailableIn, evaluateInRunNearMisses } from '../data/achievements';

/**
 * AUDIT-12 S8 / §4: live "almost unlocked" hints, spoiler-gated.
 *
 * The §10 (requests) note in GameScreen is right that a near miss named on
 * day six can give away who is about to win, so this never shows on its own:
 * it is hidden entirely under spoiler-safe viewing, and otherwise collapsed
 * behind an explicit "may spoil" reveal that resets every run.
 */
export function NearMissHints({ state, unlocked, spoilerSafe }: { state: GameState; unlocked: string[]; spoilerSafe: boolean }) {
    const [revealedSeed, setRevealedSeed] = useState<string | null>(null);
    const revealed = revealedSeed === state.seed;
    const available = useMemo(() => achievementsAvailableIn(state).filter(a => !unlocked.includes(a.id)).length,
        [state, unlocked]);
    const misses = useMemo(() => (revealed ? evaluateInRunNearMisses(state, unlocked) : []),
        [revealed, state, unlocked]);
    if (spoilerSafe || state.phase === 'ended') return null;
    return (
        <section className="panel p-3 space-y-2" data-testid="near-miss-hints" aria-label="Almost unlocked">
            <div className="flex items-center justify-between gap-2">
                <h3 className="panel-title">Almost unlocked</h3>
                <span className="text-micro font-mono text-[var(--color-ink-500)]">{available} still open here</span>
            </div>
            {!revealed ? (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRevealedSeed(state.seed)}>
                    Show hints (may spoil)
                </button>
            ) : misses.length === 0 ? (
                <p className="text-micro text-[var(--color-ink-500)]">Nothing close yet.</p>
            ) : (
                <ul className="space-y-1">
                    {misses.map(m => (
                        <li key={m.id} className="text-xs"><span className="font-semibold">{m.name}</span> — <span className="text-[var(--color-ink-500)]">{m.detail}</span></li>
                    ))}
                </ul>
            )}
        </section>
    );
}
