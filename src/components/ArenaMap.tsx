import React from 'react';
import { GameState, Tribute } from '../models/types';

const TERRAIN_ICONS: Record<string, string> = {
    open: '🏳️', forest: '🌲', water: '🌊', highland: '⛰️', ruins: '🏚️', wetland: '🥀'
};

const dangerLabel = (d: number) => (d >= 0.7 ? 'High risk' : d >= 0.4 ? 'Moderate' : 'Low risk');
const dangerColor = (d: number) => (d >= 0.7 ? 'var(--cat-death)' : d >= 0.4 ? 'var(--cat-training)' : 'var(--cat-alliance)');

export function ArenaMap({ gameState, selectedZone, onSelectZone, tributes }: {
    gameState: GameState;
    selectedZone: string | null;
    onSelectZone: (zone: string | null) => void;
    tributes: Tribute[];
}) {
    const zones = gameState.arena.zones;
    const collapsed = gameState.collapsedZones || [];

    return (
        <div className="space-y-3 text-left">
            <div className="flex justify-between items-center gap-3 flex-wrap">
                <span className="panel-title">Arena sectors</span>
                <span className="text-[10px] text-[var(--color-ink-500)]">
                    Click a sector to isolate its log{collapsed.length > 0 && ` · ${collapsed.length} sector${collapsed.length === 1 ? '' : 's'} collapsed`}
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {zones.map(zone => {
                    const isCollapsed = collapsed.includes(zone.name);
                    const occupants = tributes.filter(t => t.status === 'alive' && t.zone === zone.name);
                    const isSelected = selectedZone === zone.name;

                    return (
                        <button
                            key={zone.name}
                            onClick={() => onSelectZone(isSelected ? null : zone.name)}
                            title={`${zone.name} — ${zone.terrain}, ${dangerLabel(zone.danger)}, ${Math.round(zone.resources * 100)}% resources`}
                            className={`panel-flush p-3.5 text-left transition-all flex flex-col justify-between gap-3 min-h-[136px] hover:border-[var(--color-ink-600)] ${
                                isSelected ? 'ring-2 ring-[var(--red)] border-[var(--red)]' : ''
                            } ${isCollapsed ? 'opacity-60' : ''}`}
                        >
                            <div className="space-y-1.5 w-full">
                                <div className="flex justify-between items-start gap-2">
                                    <span className="eyebrow" style={{ color: isCollapsed ? 'var(--cat-death)' : 'var(--cat-alliance)' }}>
                                        {isCollapsed ? '● Collapsed' : '● Active'}
                                    </span>
                                    {occupants.length > 0 && (
                                        <span className="chip chip-accent">{occupants.length} here</span>
                                    )}
                                </div>
                                <h4 className="font-extrabold text-sm leading-snug text-[var(--ink)]">
                                    {TERRAIN_ICONS[zone.terrain] || ''} {zone.name}
                                </h4>
                                <div className="flex justify-between text-[10px] uppercase tracking-wider font-mono">
                                    <span style={{ color: dangerColor(zone.danger) }}>⚠ {dangerLabel(zone.danger)}</span>
                                    <span className="text-[var(--color-ink-500)]">{zone.terrain}</span>
                                </div>
                                <div className="meter">
                                    <span style={{ width: `${zone.resources * 100}%`, background: 'var(--cat-loot)' }} />
                                </div>
                            </div>

                            <div className="w-full">
                                {isCollapsed ? (
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--cat-death)] font-bold">
                                        Sector out of bounds
                                    </span>
                                ) : occupants.length === 0 ? (
                                    <span className="text-[10px] text-[var(--color-ink-600)] font-mono">No tributes present</span>
                                ) : (
                                    <div className="flex flex-wrap gap-1 items-center">
                                        {occupants.slice(0, 12).map(t => (
                                            <span
                                                key={t.id}
                                                title={`${t.name} (District ${t.district}) — ${t.health}% health`}
                                                className="w-2 h-2 rounded-full inline-block"
                                                style={{
                                                    background: t.health >= 70 ? 'var(--cat-alliance)' : t.health >= 35 ? 'var(--cat-training)' : 'var(--cat-death)',
                                                }}
                                            />
                                        ))}
                                        {occupants.length > 12 && (
                                            <span className="text-[10px] text-[var(--color-ink-500)] font-mono">+{occupants.length - 12}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
