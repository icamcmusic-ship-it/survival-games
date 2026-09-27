import React from 'react';
import { GameState } from '../models/types';
import { gameActions } from '../store/gameStore';
import { AUDIT13_SIDE } from '../data/balance';
import { returningStories } from '../engine/season/surfaced';
import { runTierOf } from '../engine/season/replayability';
import { legacyOf } from '../data/districts';

/**
 * AUDIT-13 S2: the carry-over stories the ledger applied at this reaping —
 * returning nemeses, district blood feuds, reunions, apprenticeships — which
 * the engine has been running since AUDIT-12 without the player ever being
 * told. Nothing renders when the record book carried nothing in.
 */
export function ReturningStrip({ gameState }: { gameState: GameState }) {
    const stories = returningStories(gameState);
    const drifted = [...new Set(gameState.tributes.map(t => t.district))]
        .filter(d => runTierOf(gameState, d) !== legacyOf(d).tier)
        .sort((a, b) => a - b);
    if (stories.length === 0 && drifted.length === 0) return null;
    const label: Record<string, string> = { nemesis: 'Nemesis', rivalry: 'Blood feud', reunion: 'Reunion', apprentice: 'Apprentice' };
    return (
        <div className="panel p-4 space-y-1.5 animate-riseIn" data-testid="returning-grudges">
            <span className="eyebrow">Returning grudges</span>
            {stories.map((s, i) => (
                <p key={i} className="text-label leading-relaxed text-[var(--color-ink-500)] m-0">
                    <span className={`chip mr-1.5${s.kind === 'nemesis' ? ' chip-gold' : ''}`}>{label[s.kind]}</span>{s.text}
                </p>
            ))}
            {/* AUDIT-13 P3: districts whose legacy has drifted with their record. */}
            {drifted.length > 0 && (
                <p className="text-label leading-relaxed text-[var(--color-ink-500)] m-0">
                    <span className="chip mr-1.5">Legacy</span>
                    {drifted.map(d => `District ${d} is ${runTierOf(gameState, d)} now (was ${legacyOf(d).tier})`).join('; ')}. The pedigree money has noticed.
                </p>
            )}
        </div>
    );
}

/**
 * AUDIT-13 P6: draft mode. Four tributes before the gong, scored on where
 * they finish (the victor is worth the most). Beside the prediction slip, not
 * part of it: the slip is a set of calls, a draft is a team.
 */
export function DraftPanel({ gameState }: { gameState: GameState }) {
    const picks = gameState.draft ?? [];
    const full = picks.length >= AUDIT13_SIDE.draftSize;
    return (
        <div className="panel p-4 space-y-2 animate-riseIn" data-testid="draft-panel">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
                <span className="eyebrow">Draft {AUDIT13_SIDE.draftSize}</span>
                <span className="text-mini text-[var(--color-ink-500)]">
                    Points by finishing place: {AUDIT13_SIDE.draftPoints.map((p, i) => `${i === 0 ? 'victor' : `#${i + 1}`} ${p}`).join(', ')}.
                </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {[...gameState.tributes].sort((a, b) => a.district - b.district).map(t => {
                    const on = picks.includes(t.id);
                    return (
                        <button key={t.id} type="button" aria-pressed={on} disabled={!on && full}
                            className={`btn btn-sm ${on ? '' : 'btn-ghost'}`}
                            onClick={() => gameActions.toggleDraftPick(t.id)}>
                            D{t.district} · {t.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
