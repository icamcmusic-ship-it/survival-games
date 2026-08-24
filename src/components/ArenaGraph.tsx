import React, { useMemo } from 'react';
import { GameState, Tribute } from '../models/types';
import { edgeKey, effectiveResources } from '../engine/map';
import { GRAPH_MIN_WIDTH_PX, NODE_HIT_R, NODE_R, VIEW_W, VIEW_H, layoutZones } from './arenaLayout';

/**
 * The arena as a graph, which is what it has always actually been.
 *
 * `Zone.adjacent` governs every movement decision in the simulation — routes,
 * pursuit, the border collapse herding people inward — and the map rendered it
 * as an unordered responsive grid of cards. A reader could not tell why a
 * tribute went where they went, could not see that a zone was a dead end, and
 * could not anticipate the collapse closing a route. All the information was
 * there; none of it was drawn.
 */

const TERRAIN_ICONS: Record<string, string> = {
    open: '🏳️', forest: '🌲', water: '🌊', highland: '⛰️', ruins: '🏚️', wetland: '🥀',
};

const dangerLabel = (d: number) => (d >= 0.7 ? 'High risk' : d >= 0.4 ? 'Moderate' : 'Low risk');
const dangerColor = (d: number) => (d >= 0.7 ? 'var(--cat-death)' : d >= 0.4 ? 'var(--cat-training)' : 'var(--cat-alliance)');

export function ArenaGraph({ gameState, selectedZone, onSelectZone, tributes }: {
    gameState: GameState;
    selectedZone: string | null;
    onSelectZone: (zone: string | null) => void;
    tributes: Tribute[];
}) {
    const arena = gameState.arena;
    // Keyed on the arena identity, so the layout is computed once per arena
    // rather than on every simulation tick.
    const positions = useMemo(() => layoutZones(arena), [arena]);
    const collapsed = gameState.collapsedZones ?? [];
    const traffic = gameState.zoneTraffic ?? {};
    // §2.9: `zoneDeaths` and `camps` have both been stored since they landed
    // and neither was ever drawn — the map showed structure and forage and
    // nothing about what has actually happened on it.
    const deaths = gameState.zoneDeaths ?? {};
    const campZones = new Set(
        Object.entries(gameState.camps ?? {})
            .filter(([, camp]) => camp.shelter !== undefined || camp.fire !== undefined)
            .map(([id]) => tributes.find(t => t.id === id))
            .filter((t): t is Tribute => !!t && t.status === 'alive')
            .map(t => t.zone)
    );

    // Deduplicated edge list: `adjacent` lists both directions.
    const edges = useMemo(() => {
        const seen = new Set<string>();
        const list: Array<{ a: string; b: string; key: string }> = [];
        arena.zones.forEach(z => {
            z.adjacent.forEach(other => {
                if (!positions[other]) return;
                const key = edgeKey(z.name, other);
                if (seen.has(key)) return;
                seen.add(key);
                list.push({ a: z.name, b: other, key });
            });
        });
        return list;
    }, [arena, positions]);

    const busiest = Math.max(1, ...Object.values(traffic));

    return (
        <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            // §2.10: never shrink below the width at which a zone is a 44px
            // touch target. Past that the wrapper scrolls instead.
            style={{ minWidth: GRAPH_MIN_WIDTH_PX }}
            className="w-full h-auto select-none"
            role="img"
            aria-label={`Map of ${arena.name}: ${arena.zones.length} sectors and the routes between them`}
        >
            {/* ---------- routes ---------- */}
            {edges.map(({ a, b, key }) => {
                const pa = positions[a];
                const pb = positions[b];
                const severed = collapsed.includes(a) || collapsed.includes(b);
                const flow = traffic[key] ?? 0;
                const intensity = flow / busiest;
                return (
                    <g key={key}>
                        <line
                            x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                            stroke={severed ? 'var(--color-ink-700)' : flow > 0 ? 'var(--red)' : 'var(--line)'}
                            strokeWidth={severed ? 1 : 1.5 + intensity * 5}
                            strokeDasharray={severed ? '4 5' : undefined}
                            opacity={severed ? 0.35 : flow > 0 ? 0.35 + intensity * 0.65 : 0.55}
                        />
                        {/* Traffic is also printed, because a thicker line is not a
                            readable quantity and colour alone is not an accessible one. */}
                        {flow >= 1 && !severed && (
                            <text
                                x={(pa.x + pb.x) / 2} y={(pa.y + pb.y) / 2 - 4}
                                textAnchor="middle"
                                style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800 }}
                                fill="var(--red)"
                            >
                                {Math.round(flow)}
                            </text>
                        )}
                    </g>
                );
            })}

            {/* ---------- sectors ---------- */}
            {arena.zones.map(zone => {
                const p = positions[zone.name];
                const isCollapsed = collapsed.includes(zone.name);
                const isSelected = selectedZone === zone.name;
                const occupants = tributes.filter(t => t.status === 'alive' && t.zone === zone.name);
                const stock = effectiveResources(gameState, zone);
                const deadEnd = zone.adjacent.filter(n => !collapsed.includes(n)).length <= 1;
                const zoneDeaths = deaths[zone.name] ?? 0;
                const hasCamp = campZones.has(zone.name);

                return (
                    <g
                        key={zone.name}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        aria-label={
                            `${zone.name}. ${zone.terrain}. ${dangerLabel(zone.danger)}. ` +
                            `${Math.round(stock * 100)} percent forage remaining. ` +
                            `${occupants.length} tribute${occupants.length === 1 ? '' : 's'} present.` +
                            `${zoneDeaths > 0 ? ` ${zoneDeaths} died here.` : ''}` +
                            `${hasCamp ? ' A camp stands here.' : ''}` +
                            `${isCollapsed ? ' Out of bounds.' : ''}${deadEnd && !isCollapsed ? ' Dead end.' : ''}`
                        }
                        onClick={() => onSelectZone(isSelected ? null : zone.name)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelectZone(isSelected ? null : zone.name);
                            }
                        }}
                        style={{ cursor: 'pointer' }}
                    >
                        {/* §2.10: the touch target, larger than anything drawn.
                            The visible node is 52 units across; a finger needs
                            72, and `GRAPH_MIN_WIDTH_PX` guarantees that maps to
                            at least 44 CSS pixels however narrow the viewport
                            gets. Sized under the measured minimum node
                            separation so two targets never overlap. */}
                        <circle cx={p.x} cy={p.y} r={NODE_HIT_R} fill="transparent" stroke="none" />
                        {/* Forage stock drawn as a ring around the node: the arc is the
                            stock, the faint full circle behind it is the printed potential. */}
                        <circle cx={p.x} cy={p.y} r={NODE_R + 5} fill="none" stroke="var(--line-soft)" strokeWidth={3} />
                        <circle
                            cx={p.x} cy={p.y} r={NODE_R + 5}
                            fill="none"
                            stroke="var(--cat-loot)"
                            strokeWidth={3}
                            strokeDasharray={`${2 * Math.PI * (NODE_R + 5) * stock} ${2 * Math.PI * (NODE_R + 5)}`}
                            transform={`rotate(-90 ${p.x} ${p.y})`}
                            opacity={isCollapsed ? 0.25 : 1}
                        />
                        <circle
                            cx={p.x} cy={p.y} r={NODE_R}
                            fill={isCollapsed ? 'var(--paper-flush)' : 'var(--paper-panel)'}
                            stroke={isSelected ? 'var(--red)' : isCollapsed ? 'var(--color-ink-600)' : 'var(--ink)'}
                            strokeWidth={isSelected ? 4 : 2}
                            strokeDasharray={isCollapsed ? '3 3' : undefined}
                            opacity={isCollapsed ? 0.55 : 1}
                        />
                        <text
                            x={p.x} y={p.y + 1}
                            textAnchor="middle" dominantBaseline="middle"
                            style={{ fontSize: 15 }}
                            opacity={isCollapsed ? 0.4 : 1}
                        >
                            {TERRAIN_ICONS[zone.terrain] ?? '•'}
                        </text>
                        {/* Occupancy, as a number rather than a cluster of 8px dots. */}
                        {occupants.length > 0 && (
                            <>
                                <circle cx={p.x + NODE_R - 4} cy={p.y - NODE_R + 4} r={10} fill="var(--red)" stroke="var(--ink)" strokeWidth={1.5} />
                                <text
                                    x={p.x + NODE_R - 4} y={p.y - NODE_R + 5}
                                    textAnchor="middle" dominantBaseline="middle"
                                    style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800 }}
                                    fill="#fff"
                                >
                                    {occupants.length}
                                </text>
                            </>
                        )}
                        {/* §2.9: bodies. The count of deaths this sector has
                            taken, which is the single most useful thing a
                            reader can know about a place before walking into it. */}
                        {zoneDeaths > 0 && (
                            <>
                                <circle
                                    cx={p.x - NODE_R + 4} cy={p.y + NODE_R - 4} r={9}
                                    fill="var(--ink)" stroke="var(--cat-death)" strokeWidth={1.5}
                                />
                                <text
                                    x={p.x - NODE_R + 4} y={p.y + NODE_R - 3}
                                    textAnchor="middle" dominantBaseline="middle"
                                    style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800 }}
                                    fill="var(--cat-death)"
                                >
                                    †{zoneDeaths}
                                </text>
                            </>
                        )}
                        {/* §2.9: somebody has built something here. */}
                        {hasCamp && !isCollapsed && (
                            <text
                                x={p.x - NODE_R + 2} y={p.y - NODE_R + 6}
                                textAnchor="middle" dominantBaseline="middle"
                                style={{ fontSize: 11 }}
                            >
                                ⛺
                            </text>
                        )}
                        <text
                            x={p.x} y={p.y + NODE_R + 18}
                            textAnchor="middle"
                            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, letterSpacing: '0.04em' }}
                            fill={isCollapsed ? 'var(--color-ink-600)' : 'var(--ink)'}
                            textDecoration={isCollapsed ? 'line-through' : undefined}
                        >
                            {zone.name.length > 22 ? `${zone.name.slice(0, 21)}…` : zone.name}
                        </text>
                        <text
                            x={p.x} y={p.y + NODE_R + 30}
                            textAnchor="middle"
                            style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 700 }}
                            fill={isCollapsed ? 'var(--color-ink-600)' : dangerColor(zone.danger)}
                        >
                            {isCollapsed ? 'OUT OF BOUNDS' : `${dangerLabel(zone.danger).toUpperCase()}${deadEnd ? ' · DEAD END' : ''}`}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
