import React from 'react';
import { GameState } from '../models/types';
import { FastForward, Radio } from 'lucide-react';

export function VictorInterviewScreen({ gameState, onProceed }: { gameState: GameState, onProceed: () => void }) {
    const interview = gameState.epilogueInterview || [];
    const winner = gameState.tributes.find(t => t.status === 'alive');

    const strip = (line: string) => line.replace(/^[^:]*:\s*'/, '').replace(/'$/, '');

    return (
        <div className="max-w-3xl mx-auto space-y-7 animate-fadeIn">
            <div className="masthead dot-texture text-center">
                <span className="masthead-ghost" aria-hidden="true">05</span>
                <span className="masthead-eyebrow flex items-center gap-1.5 w-fit mx-auto">
                    <Radio className="w-3 h-3 animate-pulseSoft" /> Live from Caesar's Stage
                </span>
                <h2 className="masthead-title text-4xl md:text-5xl">The Victor's Interview</h2>
                <p className="masthead-sub text-sm mx-auto">
                    {winner ? `${winner.name} of District ${winner.district}` : 'The stage stands empty.'}
                </p>
            </div>

            <div className="panel p-6 md:p-8 space-y-7">
                <div className="space-y-6">
                    {interview.map((qa, idx) => (
                        <div key={idx} className="space-y-3 border-b border-[var(--color-ink-800)] pb-5 last:border-0 last:pb-0">
                            <div className="flex gap-3 text-sm">
                                <span className="eyebrow text-[var(--color-blood-400)] flex-none pt-0.5">Caesar</span>
                                <p className="text-[var(--color-ink-300)] italic">{strip(qa.question)}</p>
                            </div>
                            <div className="flex gap-3 text-sm pl-4 border-l-2 border-[var(--color-gold-500)]">
                                <span className="eyebrow text-[var(--color-gold-400)] flex-none pt-0.5">Victor</span>
                                <p className="text-[var(--ink)] font-medium">{strip(qa.answer)}</p>
                            </div>
                        </div>
                    ))}
                    {interview.length === 0 && <div className="empty-state">The stage remains quiet.</div>}
                </div>

                <div className="pt-5 border-t border-[var(--color-ink-800)] flex justify-end">
                    <button onClick={onProceed} className="btn btn-gold">
                        Review the debrief <FastForward className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
