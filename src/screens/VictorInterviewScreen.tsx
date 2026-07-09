import React from 'react';
import { GameState } from '../models/types';
import { FastForward } from 'lucide-react';

export function VictorInterviewScreen({ gameState, onProceed }: { gameState: GameState, onProceed: () => void }) {
    const interview = gameState.epilogueInterview || [];

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn text-left">
            <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-xs font-extrabold text-yellow-500 uppercase tracking-widest font-mono">
                    📡 Live Broadcast from Caesar's Stage
                </div>
                <h2 className="text-4xl font-black uppercase text-white tracking-tight">The Victor's Interview</h2>
                <p className="text-zinc-500 text-sm">Reviewing the psychological and tactical profile of the sole survivor.</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-8">
                <div className="space-y-6">
                    {interview.map((qa, idx) => (
                        <div key={idx} className="space-y-4 border-b border-zinc-800/60 pb-6 last:border-0 last:pb-0">
                            <div className="flex gap-3 text-sm">
                                <span className="text-red-500 font-extrabold uppercase tracking-wider font-mono select-none">Caesar:</span>
                                <p className="text-zinc-350 font-semibold italic">{qa.question.replace(/^Caesar Flickerman:\s*'/, '').replace(/'$/, '')}</p>
                            </div>
                            <div className="flex gap-3 text-sm pl-4 border-l border-zinc-700">
                                <span className="text-yellow-550 font-extrabold uppercase tracking-wider font-mono select-none">Victor:</span>
                                <p className="text-white font-bold">{qa.answer.replace(/^.*:\s*'/, '').replace(/'$/, '')}</p>
                            </div>
                        </div>
                    ))}
                    {interview.length === 0 && (
                        <div className="text-center text-zinc-600 py-6 font-mono">The stage remains quiet...</div>
                    )}
                </div>

                <div className="pt-6 border-t border-zinc-800 flex justify-end">
                    <button
                        onClick={onProceed}
                        className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 text-xs"
                    >
                        Review Battle Stats <FastForward className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
