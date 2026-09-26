import React, { useMemo, useState } from 'react';
import { Dices } from 'lucide-react';
import { GameState } from '../models/types';
import { gameActions } from '../store/gameStore';
import type { WhatIfResult } from '../engine/whatIf';
import { AUDIT12_UI } from '../data/balance';

/**
 * AUDIT-10 §11.8: "what if that day had gone the other way?"
 *
 * Picks a checkpoint from the rewind ring, re-rolls the phase after it a
 * handful of times, and says how often the Games still ended the same way.
 * Nothing runs until the player asks — this is several seconds of
 * simulation, and the approved cost was on demand only.
 */
export function WhatIfPanel({ gameState, onOpenTribute }: { gameState: GameState; onOpenTribute?: (id: string) => void }) {
    const checkpoints = useMemo(() => gameActions.whatIfCheckpoints(), []);
    const limit = useMemo(() => gameActions.whatIfLimit(), []);
    // AUDIT-12 §4: default to the victor's closest call — the checkpoint whose
    // next phase left them lowest — rather than the oldest one on the ring.
    const closest = useMemo(() => checkpoints.reduce<(typeof checkpoints)[number] | null>((best, c) =>
        c.victorHealthAfter !== null && (best === null || best.victorHealthAfter === null || c.victorHealthAfter < best.victorHealthAfter) ? c : best, null),
    [checkpoints]);
    const [picked, setPicked] = useState<number | null>(closest?.index ?? checkpoints[0]?.index ?? null);
    const [branchCount, setBranchCount] = useState<number>(AUDIT12_UI.whatIfBranchOptions[0]);
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
        const r = await gameActions.runWhatIf(picked, (done, total) => setProgress({ done, total }), branchCount);
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
                The rewind window holds the last {limit.cap} phases, so branches reach back {limit.cap} phases at most{limit.oldestDay !== null ? ` — to Day ${limit.oldestDay} at the earliest` : ''}.
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
                        <option key={c.index} value={c.index}>the phase after {label(c)}{closest?.index === c.index ? ' — the victor\u2019s closest call' : ''}</option>
                    ))}
                </select>
                <label className="text-xs text-[var(--color-ink-400)]" htmlFor="whatif-count">×</label>
                <select
                    id="whatif-count"
                    className="field text-xs w-auto"
                    aria-label="How many branches to play"
                    value={branchCount}
                    onChange={e => { setBranchCount(Number(e.target.value)); setResult(null); }}
                    disabled={progress !== null}
                >
                    {AUDIT12_UI.whatIfBranchOptions.map(n => <option key={n} value={n}>{n} branches</option>)}
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
                        {tally.map(([key, n]) => {
                            const ids = key ? key.split(',') : [];
                            const same = key === result.actualVictorIds.join(',');
                            return (
                                <div key={key || 'none'} className="panel-flush p-2 flex justify-between items-center gap-2 text-sm">
                                    <span className="min-w-0 truncate">
                                        {ids.length === 0 ? (
                                            // AUDIT-12 §4: a wipeout is its own outcome, and says so.
                                            <span className="italic text-[var(--color-ink-500)]">No victor — the field wiped itself out</span>
                                        ) : ids.map((id, i) => (
                                            <React.Fragment key={id}>
                                                {i > 0 && ' & '}
                                                {onOpenTribute ? (
                                                    <button type="button" className="in-prose font-semibold underline decoration-dotted hover:text-[var(--red)]"
                                                        onClick={() => onOpenTribute(id)}>
                                                        {gameState.tributes.find(t => t.id === id)?.name ?? '?'}
                                                    </button>
                                                ) : (gameState.tributes.find(t => t.id === id)?.name ?? '?')}
                                            </React.Fragment>
                                        ))}
                                        {same && <span className="text-micro font-mono uppercase text-[var(--color-ink-500)]"> · as it happened</span>}
                                    </span>
                                    <span className="chip flex-none">{n} of {total}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
