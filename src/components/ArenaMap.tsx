import React, { useState } from 'react';
import { GameState, Tribute } from '../models/types';
import { effectiveResources } from '../engine/map';
import { ArenaGraph } from './ArenaGraph';

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
    // The graph is the honest view — it is the structure the simulation actually
    // moves over — but the card grid remains for reading the numbers at a glance.
    const [view, setView] = useState<'graph' | 'grid'>('graph');

    return (
        <div className="space-y-3 text-left">
            <div className="flex justify-between items-center gap-3 flex-wrap">
                <span className="panel-title">Arena sectors</span>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] text-[var(--color-ink-500)]">
                        Click a sector to isolate its log{collapsed.length > 0 && ` · ${collapsed.length} sector${collapsed.length === 1 ? '' : 's'} collapsed`}
                    </span>
                    <div className="seg">
                        <button onClick={() => setView('graph')} aria-pressed={view === 'graph'} className="seg-item">Map</button>
                        <button onClick={() => setView('grid')} aria-pressed={view === 'grid'} className="seg-item">Detail</button>
                    </div>
                </div>
            </div>

            {view === 'graph' && (
                <div className="panel-flush p-2">
                    <ArenaGraph
                        gameState={gameState}
                        selectedZone={selectedZone}
                        onSelectZone={onSelectZone}
                        tributes={tributes}
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pb-1 text-[10px] text-[var(--color-ink-500)] font-mono uppercase tracking-wider">
                        <span>Lines · routes between sectors</span>
                        <span style={{ color: 'var(--red)' }}>Thick/red · traffic this cycle</span>
                        <span style={{ color: 'var(--cat-loot)' }}>Ring · forage remaining</span>
                        <span>Dashed · out of bounds</span>
                    </div>
                </div>
            )}

            {view === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {zones.map(zone => {
                    const isCollapsed = collapsed.includes(zone.name);
                    const occupants = tributes.filter(t => t.status === 'alive' && t.zone === zone.name);
                    const isSelected = selectedZone === zone.name;
                    const stock = effectiveResources(gameState, zone);

                    return (
                        <button
                            key={zone.name}
                            onClick={() => onSelectZone(isSelected ? null : zone.name)}
                            title={`${zone.name} — ${zone.terrain}, ${dangerLabel(zone.danger)}, ${Math.round(stock * 100)}% stock (${Math.round(zone.resources * 100)}% potential)`}
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
                                <div className="meter" title={`Current stock ${Math.round(stock * 100)}% · potential ${Math.round(zone.resources * 100)}%`}>
                                    <span style={{ width: `${stock * 100}%`, background: 'var(--cat-loot)' }} />
                                    <span className="meter-ghost" style={{ width: `${zone.resources * 100}%` }} />
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
                                        {occupants.slice(0, 12).map(t => {
                                            // Colour alone can't carry condition (UX-13), so each
                                            // marker also names its band with a glyph and shows the
                                            // district number at a readable size.
                                            const band = t.health >= 70 ? 'healthy' : t.health >= 35 ? 'wounded' : 'critical';
                                            const glyph = band === 'healthy' ? '●' : band === 'wounded' ? '◐' : '○';
                                            const color = band === 'healthy'
                                                ? 'var(--cat-alliance)'
                                                : band === 'wounded' ? 'var(--cat-training)' : 'var(--cat-death)';
                                            return (
                                                <span
                                                    key={t.id}
                                                    title={`${t.name} (District ${t.district}) — ${t.health}% health, ${band}`}
                                                    className="inline-flex items-center gap-0.5 font-mono text-[10px] leading-none px-1 py-0.5 border"
                                                    style={{ color, borderColor: color }}
                                                >
                                                    <span aria-hidden="true">{glyph}</span>D{t.district}
                                                </span>
                                            );
                                        })}
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
            )}
        </div>
    );
}
