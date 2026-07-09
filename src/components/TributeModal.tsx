import React from 'react';
import { GameState, Tribute } from '../models/types';
import { MapPin, Users, X } from 'lucide-react';
import { getRelationshipLabel, RELATIONSHIP_COLORS } from '../engine/relationships';

export function TributeModal({ tribute, gameState, onClose }: { tribute: Tribute, gameState: GameState, onClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-2xl font-black text-white">{tribute.name}</h3>
                        <div className="flex gap-3 mt-1">
                            <p className="text-zinc-400 text-sm flex items-center gap-1">
                                <MapPin className="w-4 h-4" /> {tribute.zone}
                            </p>
                            {tribute.allianceId && (
                                <p className="text-emerald-400 text-sm flex items-center gap-1">
                                    <Users className="w-4 h-4" /> Alliance
                                </p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Vitals & Status</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                                <div className="text-xs text-zinc-500">Health</div>
                                <div className="font-mono text-white">{tribute.health}%</div>
                            </div>
                            <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                                <div className="text-xs text-zinc-500">Hunger</div>
                                <div className="font-mono text-white">{tribute.vitals.hunger}%</div>
                            </div>
                            <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                                <div className="text-xs text-zinc-500">Thirst</div>
                                <div className="font-mono text-white">{tribute.vitals.thirst}%</div>
                            </div>
                            <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                                <div className="text-xs text-zinc-500">Fatigue</div>
                                <div className="font-mono text-white">{tribute.vitals.fatigue}%</div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Injuries</h4>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(tribute.injuries).filter(([_, v]) => v).length === 0 ? (
                                <span className="text-sm text-zinc-400">None</span>
                            ) : (
                                Object.entries(tribute.injuries).filter(([_, v]) => v).map(([k]) => (
                                    <span key={k} className="px-2 py-1 bg-red-950/30 text-red-500 border border-red-900/50 rounded text-xs uppercase tracking-wider">
                                        {k}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Inventory</h4>
                        <div className="space-y-2">
                            {tribute.inventory.length === 0 ? (
                                <span className="text-sm text-zinc-400">Empty</span>
                            ) : (
                                tribute.inventory.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center bg-zinc-950 p-2 rounded border border-zinc-800">
                                        <span className="text-sm text-white">{item.name}</span>
                                        <span className="text-xs text-zinc-500 uppercase">{item.type}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Relationships</h4>
                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                            {Object.entries(tribute.relationships).length === 0 ? (
                                <span className="text-sm text-zinc-400">None</span>
                            ) : (
                                Object.entries(tribute.relationships).map(([id, val]) => {
                                    const other = gameState.tributes.find(t => t.id === id);
                                    if (!other) return null;
                                    const numVal = val as number;
                                    const label = getRelationshipLabel(tribute, other, numVal);
                                    return (
                                        <div key={id} className="flex justify-between items-center text-sm">
                                            <span className="text-zinc-300">{other.name}</span>
                                            <span className="flex items-center gap-2">
                                                <span className={`text-[10px] uppercase tracking-wider font-bold ${RELATIONSHIP_COLORS[label]}`}>{label}</span>
                                                <span className={numVal > 0 ? 'text-green-400' : 'text-red-400'}>{numVal > 0 ? `+${numVal}` : numVal}</span>
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
