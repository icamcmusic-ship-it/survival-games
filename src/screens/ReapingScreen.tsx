import React from 'react';
import { Tribute } from '../models/types';
import { Shuffle, FastForward } from 'lucide-react';

export function ReapingScreen({ tributes, arenaName, seed, onReroll, onConfirm }: {
    tributes: Tribute[],
    arenaName: string,
    seed: string,
    onReroll: () => void,
    onConfirm: () => void,
}) {
    const byDistrict = new Map<number, Tribute[]>();
    tributes.forEach(t => {
        if (!byDistrict.has(t.district)) byDistrict.set(t.district, []);
        byDistrict.get(t.district)!.push(t);
    });

    return (
        <div className="max-w-4xl mx-auto space-y-7">
            <div className="masthead dot-texture">
                <span className="masthead-ghost" aria-hidden="true">02</span>
                <span className="masthead-eyebrow">02 — {arenaName} · seed {seed}</span>
                <h2 className="masthead-title text-5xl md:text-6xl">The Reaping</h2>
                <p className="masthead-sub text-sm">
                    {tributes.length} names have been drawn. Only age, height and build are public — everything
                    else they will have to show you in the arena.
                </p>
            </div>

            <div className="flex justify-center gap-2">
                <button onClick={onReroll} className="btn" title="Draw a different cast from a new sub-seed">
                    <Shuffle className="w-4 h-4" /> Reroll cast
                </button>
                <button onClick={onConfirm} className="btn btn-primary">
                    Confirm tributes <FastForward className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from(byDistrict.entries()).sort((a, b) => a[0] - b[0]).map(([district, pair]) => (
                    <div key={district} className="panel p-4 space-y-2.5 animate-riseIn">
                        <h3 className="panel-title text-[var(--red)]">District {district}</h3>
                        {pair.map(t => (
                            <div key={t.id} className="panel-flush p-3 flex justify-between items-center gap-3">
                                <div className="min-w-0">
                                    <div className="font-black text-[var(--ink)] truncate">
                                        {t.name}
                                        {t.fanFavourite && (
                                            <span className="ml-1.5 text-[var(--gold)]" title="A Capitol favourite before the Games have even begun.">★</span>
                                        )}
                                    </div>
                                    <div className="eyebrow mt-0.5">{t.gender}</div>
                                </div>
                                <div className="text-right text-[11px] text-[var(--color-ink-500)] font-mono font-semibold leading-relaxed flex-none">
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
