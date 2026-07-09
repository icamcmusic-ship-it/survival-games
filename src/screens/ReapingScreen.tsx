import React from 'react';
import { Tribute } from '../models/types';
import { Shuffle, FastForward } from 'lucide-react';

export function ReapingScreen({ tributes, onReroll, onConfirm }: {
    tributes: Tribute[],
    onReroll: () => void,
    onConfirm: () => void,
}) {
    const byDistrict = new Map<number, Tribute[]>();
    tributes.forEach(t => {
        if (!byDistrict.has(t.district)) byDistrict.set(t.district, []);
        byDistrict.get(t.district)!.push(t);
    });

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-4 mb-8">
                <h2 className="text-5xl font-black uppercase tracking-tighter text-white">The Reaping</h2>
                <p className="text-zinc-400 text-lg">
                    The Capitol has drawn its tributes. Only their age, height and build are known — everything else remains to be seen.
                </p>
            </div>

            <div className="flex justify-center gap-3">
                <button
                    onClick={onReroll}
                    className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold uppercase tracking-widest rounded-lg text-xs transition-colors flex items-center gap-2"
                >
                    <Shuffle className="w-4 h-4" /> Reroll Cast
                </button>
                <button
                    onClick={onConfirm}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-lg text-xs transition-colors flex items-center gap-2"
                >
                    Confirm Tributes <FastForward className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from(byDistrict.entries()).sort((a, b) => a[0] - b[0]).map(([district, pair]) => (
                    <div key={district} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-red-400">District {district}</h3>
                        {pair.map(t => (
                            <div key={t.id} className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-3 flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-white">{t.name}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">{t.gender}</div>
                                </div>
                                <div className="text-right text-xs text-zinc-400 font-mono space-y-0.5">
                                    <div>Age {t.age}</div>
                                    <div>{t.heightCm} cm</div>
                                    <div>{t.build}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
