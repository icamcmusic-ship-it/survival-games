import React from 'react';
import { GameState, Tribute } from '../models/types';

export function ArenaMap({ gameState, selectedZone, onSelectZone, tributes }: {
    gameState: GameState;
    selectedZone: string | null;
    onSelectZone: (zone: string | null) => void;
    tributes: Tribute[];
}) {
    const zones = gameState.arena.zones;
    const collapsed = gameState.collapsedZones || [];

    return (
        <div className="space-y-4 text-left">
            <div className="flex justify-between items-center">
                <span className="text-xs uppercase font-extrabold text-zinc-500 tracking-widest font-mono">📡 Hologram Arena Feed</span>
                <span className="text-[10px] text-zinc-400 font-mono">Click a sector to isolate logs</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {zones.map((zoneName) => {
                    const isCollapsed = collapsed.includes(zoneName);
                    const tributesInZone = tributes.filter(t => t.status === 'alive' && t.zone === zoneName);
                    const isSelected = selectedZone === zoneName;

                    return (
                        <button
                            key={zoneName}
                            onClick={() => onSelectZone(isSelected ? null : zoneName)}
                            className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between h-40 ${
                                isCollapsed
                                    ? 'bg-red-950/10 border-red-900/40 text-red-500/80 cursor-not-allowed'
                                    : isSelected
                                    ? 'bg-red-500/10 border-red-500 text-white ring-1 ring-red-500/40 z-10'
                                    : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                            }`}
                        >
                            {isSelected && (
                                <div className="absolute inset-0 bg-gradient-to-t from-red-500/5 to-transparent pointer-events-none" />
                            )}

                            <div className="space-y-1 z-10 w-full">
                                <div className="flex justify-between items-start">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 font-mono">
                                        {isCollapsed ? '🔴 DEFUNCT' : '🟢 ACTIVE'}
                                    </span>
                                    {tributesInZone.length > 0 && (
                                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-500 border border-red-500/30 rounded text-[9px] font-black font-mono">
                                            {tributesInZone.length} ACT
                                        </span>
                                    )}
                                </div>
                                <h4 className="font-extrabold text-xs tracking-tight leading-snug line-clamp-2 mt-2 font-sans">
                                    {zoneName}
                                </h4>
                            </div>

                            <div className="space-y-2 z-10 mt-auto w-full">
                                <div className="flex flex-wrap gap-1 max-h-12 overflow-hidden items-center">
                                    {tributesInZone.map(t => (
                                        <span
                                            key={t.id}
                                            title={`${t.name} (District ${t.district})`}
                                            className="w-2 h-2 rounded-full bg-red-500 border border-zinc-950 inline-block"
                                        />
                                    ))}
                                    {tributesInZone.length === 0 && !isCollapsed && (
                                        <span className="text-[9px] text-zinc-600 font-mono">No telemetry</span>
                                    )}
                                    {isCollapsed && (
                                        <span className="text-[9px] text-red-500 font-mono uppercase tracking-wider font-bold">MUTED</span>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
