import React, { useEffect } from 'react';
import { GameState, Tribute } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { MapPin, Users, X, Heart } from 'lucide-react';

function VitalBar({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
    // For hunger/thirst/fatigue a high number is bad; for health/sanity it is good.
    const severity = invert ? value : 100 - value;
    const color = severity >= 66 ? 'var(--cat-death)' : severity >= 33 ? 'var(--cat-training)' : 'var(--cat-alliance)';
    return (
        <div className="panel-flush p-2.5 space-y-1.5">
            <div className="flex justify-between items-baseline">
                <span className="eyebrow">{label}</span>
                <span className="font-mono text-white text-sm">{value}%</span>
            </div>
            <div className="meter">
                <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
            </div>
        </div>
    );
}

export function TributeModal({ tribute, gameState, onClose }: { tribute: Tribute, gameState: GameState, onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const archetype = ARCHETYPES[tribute.archetype];
    const injuries = Object.entries(tribute.injuries).filter(([, v]) => v).map(([k]) => k);
    const relationships = Object.entries(tribute.relationships)
        .map(([id, val]) => ({ other: gameState.tributes.find(t => t.id === id), value: val as number }))
        .filter(r => !!r.other)
        .sort((a, b) => b.value - a.value);

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={`${tribute.name} profile`}
        >
            <div className="panel p-6 max-w-lg w-full max-h-[88vh] overflow-y-auto custom-scrollbar animate-riseIn" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-5 gap-4">
                    <div className="min-w-0">
                        <h3 className="display-title text-2xl">{tribute.name}</h3>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="chip">District {tribute.district}</span>
                            <span className="chip chip-accent" title={archetype.description}>{archetype.name}</span>
                            {tribute.isCareer && <span className="chip chip-gold">Career</span>}
                            <span className="chip">{tribute.stance}</span>
                            {tribute.trainingScore > 0 && <span className="chip">Training {tribute.trainingScore}</span>}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2.5 text-sm text-[var(--color-ink-400)]">
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {tribute.zone}</span>
                            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-[var(--cat-death)]" /> {tribute.kills} kills</span>
                            {tribute.allianceId && (
                                <span className="flex items-center gap-1 text-[var(--cat-alliance)]"><Users className="w-3.5 h-3.5" /> In an alliance</span>
                            )}
                        </div>
                        <p className="text-xs text-[var(--color-ink-500)] mt-2">
                            {tribute.age} years old · {tribute.heightCm} cm · {tribute.build} build
                        </p>
                    </div>
                    <button onClick={onClose} className="btn btn-sm btn-ghost flex-none" aria-label="Close">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {tribute.status === 'dead' && (
                    <div className="panel-flush p-3 mb-5 text-sm text-[var(--cat-death)]">
                        Died on day {tribute.dayOfDeath ?? '—'} · {tribute.causeOfDeath ?? 'Eliminated'}
                    </div>
                )}

                <div className="space-y-5">
                    <section>
                        <h4 className="panel-title mb-2">Condition</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <VitalBar label="Health" value={tribute.health} invert />
                            <VitalBar label="Sanity" value={tribute.vitals.sanity} invert />
                            <VitalBar label="Hunger" value={tribute.vitals.hunger} />
                            <VitalBar label="Thirst" value={tribute.vitals.thirst} />
                            <VitalBar label="Fatigue" value={tribute.vitals.fatigue} />
                            <VitalBar label="Sponsor trust" value={tribute.sponsorTrust} invert />
                        </div>
                    </section>

                    <section>
                        <h4 className="panel-title mb-2">Traits</h4>
                        <div className="flex flex-wrap gap-1">
                            {tribute.traits.length === 0
                                ? <span className="text-sm text-[var(--color-ink-400)]">None recorded</span>
                                : tribute.traits.map(t => <span key={t} className="chip">{t}</span>)}
                        </div>
                    </section>

                    <section>
                        <h4 className="panel-title mb-2">Injuries</h4>
                        <div className="flex flex-wrap gap-1.5">
                            {injuries.length === 0
                                ? <span className="text-sm text-[var(--cat-alliance)]">Unharmed</span>
                                : injuries.map(k => <span key={k} className="chip chip-accent">{k}</span>)}
                        </div>
                    </section>

                    <section>
                        <h4 className="panel-title mb-2">Inventory ({tribute.inventory.length})</h4>
                        <div className="space-y-1.5">
                            {tribute.inventory.length === 0 ? (
                                <span className="text-sm text-[var(--color-ink-400)]">Carrying nothing</span>
                            ) : tribute.inventory.map((item, i) => (
                                <div key={`${item.id}-${i}`} className="panel-flush p-2 flex justify-between items-center gap-2">
                                    <span className="text-sm text-white truncate">{item.name}</span>
                                    <span className="flex items-center gap-2 flex-none">
                                        {item.durability !== undefined && (
                                            <span className="text-[10px] font-mono text-[var(--color-ink-500)]">{item.durability} dur</span>
                                        )}
                                        <span className="chip">{item.type}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h4 className="panel-title mb-2">Relationships</h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                            {relationships.length === 0 ? (
                                <span className="text-sm text-[var(--color-ink-400)]">Has not met anyone yet</span>
                            ) : relationships.map(({ other, value }) => (
                                <div key={other!.id} className="flex justify-between items-center text-sm gap-2">
                                    <span className={`truncate ${other!.status === 'dead' ? 'text-[var(--color-ink-500)] line-through' : 'text-[var(--color-ink-200)]'}`}>
                                        {other!.name}
                                    </span>
                                    <span
                                        className="font-mono text-xs flex-none"
                                        style={{ color: value > 0 ? 'var(--cat-alliance)' : value < 0 ? 'var(--cat-death)' : 'var(--color-ink-500)' }}
                                    >
                                        {value > 0 ? `+${value}` : value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
