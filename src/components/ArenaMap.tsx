import React from 'react';
import { GameState, Tribute } from '../models/types';
import { getZoneGraph } from '../engine/zoneGraph';

const ALLIANCE_COLORS = ['#34d399', '#22d3ee', '#fbbf24', '#a78bfa', '#f472b6'];

function allianceColor(allianceId?: string): string {
    if (!allianceId) return '#ef4444';
    let hash = 0;
    for (let i = 0; i < allianceId.length; i++) {
        hash = allianceId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return ALLIANCE_COLORS[Math.abs(hash) % ALLIANCE_COLORS.length];
}

export function ArenaMap({ gameState, selectedZone, onSelectZone, tributes }: {
    gameState: GameState;
    selectedZone: string | null;
    onSelectZone: (zone: string | null) => void;
    tributes: Tribute[];
}) {
    const zones = gameState.arena.zones;
    const collapsed = gameState.collapsedZones || [];
    const graph = getZoneGraph(zones);
    const nodeById = new Map(graph.map(n => [n.id, n]));

    const edges: Array<[string, string]> = [];
    const seenEdge = new Set<string>();
    graph.forEach(node => {
        node.adjacentZoneIds.forEach(otherId => {
            const key = [node.id, otherId].sort().join('~');
            if (!seenEdge.has(key)) {
                seenEdge.add(key);
                edges.push([node.id, otherId]);
            }
        });
    });

    return (
        <div className="space-y-4 text-left">
            <div className="flex justify-between items-center">
                <span className="text-xs uppercase font-extrabold text-zinc-500 tracking-widest font-mono">📡 Hologram Arena Feed</span>
                <span className="text-[10px] text-zinc-400 font-mono">Click a sector to isolate logs</span>
            </div>

            <div className="bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden">
                <svg viewBox="0 0 100 100" className="w-full aspect-square" style={{ maxHeight: 480 }}>
                    {edges.map(([a, b]) => {
                        const na = nodeById.get(a);
                        const nb = nodeById.get(b);
                        if (!na || !nb) return null;
                        const dim = collapsed.includes(a) || collapsed.includes(b);
                        return (
                            <line
                                key={`${a}-${b}`}
                                x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                                stroke={dim ? '#3f1d1d' : '#3f3f46'}
                                strokeWidth={0.6}
                            />
                        );
                    })}

                    {graph.map(node => {
                        const isCollapsed = collapsed.includes(node.id);
                        const isSelected = selectedZone === node.id;
                        const tributesInZone = tributes.filter(t => t.status === 'alive' && t.zone === node.id);

                        return (
                            <g
                                key={node.id}
                                onClick={() => onSelectZone(isSelected ? null : node.id)}
                                style={{ cursor: 'pointer' }}
                            >
                                <circle
                                    cx={node.x} cy={node.y} r={isSelected ? 9 : 7.5}
                                    fill={isCollapsed ? 'rgba(127,29,29,0.25)' : isSelected ? 'rgba(239,68,68,0.25)' : 'rgba(24,24,27,0.9)'}
                                    stroke={isCollapsed ? '#7f1d1d' : isSelected ? '#ef4444' : '#52525b'}
                                    strokeWidth={0.6}
                                    style={{ transition: 'r 0.3s ease, fill 0.3s ease' }}
                                />
                                <text
                                    x={node.x} y={node.y + (node.id === zones[0] ? 13 : 12.5)}
                                    textAnchor="middle"
                                    fontSize={2.6}
                                    fontFamily="monospace"
                                    fill={isCollapsed ? '#f87171' : '#a1a1aa'}
                                    style={{ pointerEvents: 'none' }}
                                >
                                    {node.name.length > 18 ? node.name.slice(0, 17) + '…' : node.name}
                                </text>

                                {tributesInZone.map((t, i) => {
                                    const clusterAngle = (2 * Math.PI * i) / Math.max(1, tributesInZone.length);
                                    const radius = tributesInZone.length > 1 ? 3.2 : 0;
                                    const dx = radius * Math.cos(clusterAngle);
                                    const dy = radius * Math.sin(clusterAngle);
                                    return (
                                        <circle
                                            key={t.id}
                                            cx={node.x + dx} cy={node.y + dy} r={1.4}
                                            fill={allianceColor(t.allianceId)}
                                            stroke="#09090b"
                                            strokeWidth={0.3}
                                            style={{ transition: 'cx 0.8s ease, cy 0.8s ease' }}
                                        >
                                            <title>{t.name} (District {t.district})</title>
                                        </circle>
                                    );
                                })}
                            </g>
                        );
                    })}
                </svg>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px]">
                {graph.map(node => {
                    const isCollapsed = collapsed.includes(node.id);
                    const count = tributes.filter(t => t.status === 'alive' && t.zone === node.id).length;
                    const isSelected = selectedZone === node.id;
                    return (
                        <button
                            key={node.id}
                            onClick={() => onSelectZone(isSelected ? null : node.id)}
                            className={`flex justify-between items-center px-2 py-1.5 rounded border font-mono transition-colors ${
                                isCollapsed
                                    ? 'bg-red-950/10 border-red-900/40 text-red-500/80'
                                    : isSelected
                                    ? 'bg-red-500/10 border-red-500 text-white'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                            }`}
                        >
                            <span className="truncate">{node.name}</span>
                            <span>{isCollapsed ? 'DEFUNCT' : count > 0 ? `${count} ACT` : '—'}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
