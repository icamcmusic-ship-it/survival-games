import React, { useMemo, useState } from 'react';
import { Dices } from 'lucide-react';
import { GameState } from '../models/types';
import { gameActions } from '../store/gameStore';
import type { WhatIfResult } from '../engine/whatIf';

/**
 * AUDIT-10 §11.8: "what if that day had gone the other way?"
 *
 * Picks a checkpoint from the rewind ring, re-rolls the phase after it a
 * handful of times, and says how often the Games still ended the same way.
 * Nothing runs until the player asks — this is several seconds of
 * simulation, and the approved cost was on demand only.
 */
export function WhatIfPanel({ gameState }: { gameState: GameState }) {
    const checkpoints = useMemo(() => gameActions.whatIfCheckpoints(), []);
    const limit = useMemo(() => gameActions.whatIfLimit(), []);
    const [picked, setPicked] = useState<number | null>(checkpoints[0]?.index ?? null);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [result, setResult] = useState<WhatIfResult | null>(null);

    const nameOf = (ids: string[]) => ids.length === 0
        ? 'nobody'
        : ids.map(id => gameState.tributes.find(t => t.id === id)?.name ?? '?').join(' & ');
    const label = (c: { day: number; phase: GameState['phase'] }) =>
        `Day ${c.day} ${c.phase === 'night' ? 'night' : c.phase === 'feast' ? 'feast' : ''}`.trim();

    const run = async () => {
        if (picked === null) return;
        setResult(null);
        setProgress({ done: 0, total: 0 });
        const r = await gameActions.runWhatIf(picked, (done, total) => setProgress({ done, total }));
        setProgress(null);
        setResult(r);
    };

    if (checkpoints.length === 0) {
        return (
            <div className="panel p-5 space-y-2">
                <h3 className="panel-title flex items-center gap-2 border-b border-[var(--color-ink-800)] pb-2">
                    <Dices className="w-3.5 h-3.5" /> What if?
                </h3>
                <div className="empty-state">No arena checkpoints are left to branch from — this Games was resumed from a save, or ended before the gong.</div>
            </div>
        );
    }

    // Tally alternative outcomes, most common first.
    const tally = result
        ? Object.entries(result.branches.reduce<Record<string, number>>((acc, b) => {
            const k = b.victorIds.join(',');
            acc[k] = (acc[k] ?? 0) + 1;
            return acc;
        }, {})).sort((a, b) => b[1] - a[1])
        : [];
    const total = result?.branches.length ?? 0;
    const verdict = !result ? '' : result.sameOutcome === total
        ? 'Settled. However that phase fell, the same Games ends.'
        : result.sameOutcome === 0
            ? 'Not once. That phase was the whole Games.'
            : result.sameOutcome * 2 >= total
                ? 'Likely, but not certain. The luck of that phase mattered.'
                : 'A coin-flip at best. Most of the other ways that phase could have gone crown somebody else.';

    return (
        <div className="panel p-5 space-y-3">
            <h3 className="panel-title flex items-center gap-2 border-b border-[var(--color-ink-800)] pb-2">
                <Dices className="w-3.5 h-3.5" /> What if?
            </h3>
            <p className="text-xs text-[var(--color-ink-400)]">
                Re-roll one phase and play the rest of the Games out again. Everything before it stays as it happened.
            </p>
            <p className="text-xs text-[var(--color-ink-500)]" data-testid="whatif-limit">
                Branches reach back {limit.cap} phases{limit.oldestDay !== null ? `, to Day ${limit.oldestDay} at the earliest` : ''}.
                {limit.truncated ? ' Earlier days of this Games have fallen off the rewind ring.' : ''}
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-[var(--color-ink-400)]" htmlFor="whatif-from">Re-roll</label>
                <select
                    id="whatif-from"
                    className="field text-xs w-auto"
                    value={picked ?? ''}
                    onChange={e => { setPicked(Number(e.target.value)); setResult(null); }}
                    disabled={progress !== null}
                >
                    {checkpoints.map(c => (
                        <option key={c.index} value={c.index}>the phase after {label(c)}</option>
                    ))}
                </select>
                <button className="btn btn-sm" onClick={run} disabled={progress !== null || picked === null}>
                    {progress ? `Running ${progress.done}/${progress.total || '…'}` : 'Run'}
                </button>
            </div>
            {result && (
                <div className="space-y-2" aria-live="polite">
                    <div className="text-sm text-[var(--ink)]">
                        <span className="font-bold">{nameOf(result.actualVictorIds)}</span> still wins in{' '}
                        <span className="font-bold">{result.sameOutcome} of {total}</span>. {verdict}
                    </div>
                    <div className="text-xs text-[var(--color-ink-500)]" data-testid="whatif-replayed">
                        {result.replayedInterventions > 0
                            ? `Your ${result.replayedInterventions} intervention${result.replayedInterventions === 1 ? '' : 's'} after that phase (parachutes, Gamemaker commands) were replayed into every branch.`
                            : 'You made no interventions after that phase; every branch ran on its own.'}
                    </div>
                    <div className="space-y-1.5">
                        {tally.map(([key, n]) => (
                            <div key={key || 'none'} className="panel-flush p-2 flex justify-between items-center text-sm">
                                <span className="truncate">{nameOf(key ? key.split(',') : [])}</span>
                                <span className="chip">{n} of {total}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
