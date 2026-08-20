import React, { useEffect, useMemo, useRef } from 'react';
import { GameState, Tribute } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { FeedLine } from './EventFeed';
import { fearOf } from '../engine/fear';
import { heightLabel } from '../engine/physique';
import { PROFICIENCY } from '../data/balance';
import { bleedSeverity } from '../engine/wounds';
import { MapPin, Users, X, Heart } from 'lucide-react';

const PROFICIENCY_LABELS: Record<string, string> = {
    forage: 'Foraging', melee: 'Melee', ranged: 'Ranged', medicine: 'Medicine', tracking: 'Tracking',
};

/** A wound's rate, not merely its existence. */
const BLEED_LABELS: Record<number, string> = {
    1: 'bleeding (slight)', 2: 'bleeding (steady)', 3: 'bleeding (severe)',
};

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function VitalBar({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
    // For hunger/thirst/fatigue a high number is bad (severity = value). For
    // health/sanity/sponsor trust a high number is good, so severity runs the
    // other way — this was backwards before, which painted a tribute at full
    // health in danger-red.
    const severity = invert ? 100 - value : value;
    const color = severity >= 66 ? 'var(--cat-death)' : severity >= 33 ? 'var(--cat-training)' : 'var(--cat-alliance)';
    return (
        <div className="panel-flush p-2.5 space-y-1.5">
            <div className="flex justify-between items-baseline">
                <span className="eyebrow">{label}</span>
                <span className="font-mono text-[var(--ink)] text-sm">{value}%</span>
            </div>
            <div className="meter">
                <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
            </div>
        </div>
    );
}

export function TributeModal({ tribute, gameState, onClose }: { tribute: Tribute, gameState: GameState, onClose: () => void }) {
    const panelRef = useRef<HTMLDivElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        previouslyFocused.current = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        (focusable?.[0] ?? panel)?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key !== 'Tab' || !panel) return;
            const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
            if (nodes.length === 0) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            previouslyFocused.current?.focus();
        };
    }, [onClose]);

    const archetype = ARCHETYPES[tribute.archetype];
    const injuries = Object.entries(tribute.injuries).filter(([, v]) => v).map(([k]) => k);
    const sworn = new Set(tribute.memory?.vengeance ?? []);
    const relationships = Object.entries(tribute.relationships)
        .map(([id, val]) => ({
            other: gameState.tributes.find(t => t.id === id),
            // Decay leaves fractional values in the graph; the reader wants a number.
            value: Math.round(val as number),
            sworn: sworn.has(id),
        }))
        .filter(r => !!r.other)
        .sort((a, b) => b.value - a.value);
    // UX-05: every event already records who was in it, so a tribute's whole
    // story is one filter away.
    const personalLog = useMemo(
        () => gameState.log.filter(l => l.tributesInvolved.includes(tribute.id)),
        [gameState.log, tribute.id]
    );
    const proficiencies = Object.entries(tribute.proficiencies ?? {})
        .filter(([, level]) => (level ?? 0) > 0)
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as Array<[string, number]>;
    const feared = gameState.tributes
        .map(o => ({ other: o, value: fearOf(tribute, o.id) }))
        .filter(f => f.other.id !== tribute.id && f.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    const knownZones = Object.entries(tribute.memory?.zones ?? {})
        .map(([name, slot]) => ({ name, ...slot }))
        .filter(z => z.threat > 0.15 || z.rivals > 0)
        .sort((a, b) => b.threat - a.threat)
        .slice(0, 4);

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={`${tribute.name} profile`}
        >
            <div ref={panelRef} tabIndex={-1} className="panel p-6 max-w-lg w-full max-h-[88vh] overflow-y-auto custom-scrollbar animate-riseIn" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-5 gap-4">
                    <div className="min-w-0">
                        <h3 className="display-title text-2xl">{tribute.name}</h3>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="chip">District {tribute.district}</span>
                            <span className="chip chip-accent" title={archetype.description}>{archetype.name}</span>
                            {tribute.isCareer && <span className="chip chip-gold">Career</span>}
                            {tribute.fanFavourite && <span className="chip chip-gold" title="The Capitol had a favourite before the gong ever sounded.">Fan favourite</span>}
                            {tribute.interviewStrategy && <span className="chip" title="The persona they sold on Caesar's couch.">{tribute.interviewStrategy}</span>}
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
                            {tribute.age} years old · {heightLabel(tribute.heightCm)} · {tribute.build} build
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
                                : injuries.map(k => (
                                    <span key={k} className="chip chip-accent">
                                        {/* Bleeding is the one injury with a rate, not just a state —
                                            a trickle and an artery are very different problems. */}
                                        {k === 'bleeding' ? `${BLEED_LABELS[bleedSeverity(tribute)] ?? 'bleeding'}` : k}
                                    </span>
                                ))}
                        </div>
                    </section>

                    <section>
                        <h4 className="panel-title mb-2">Proficiencies</h4>
                        {proficiencies.length === 0 ? (
                            <span className="text-sm text-[var(--color-ink-400)]">Has not practised anything yet</span>
                        ) : (
                            <div className="space-y-1.5">
                                {proficiencies.map(([skill, level]) => (
                                    <div key={skill} className="flex items-center gap-2 text-sm">
                                        <span className="text-[var(--color-ink-200)] w-24 flex-none">{PROFICIENCY_LABELS[skill] ?? skill}</span>
                                        <div className="meter flex-1">
                                            <span style={{ width: `${(level / PROFICIENCY.max) * 100}%`, background: 'var(--cat-training)' }} />
                                        </div>
                                        <span className="font-mono text-xs text-[var(--color-ink-400)] w-10 text-right flex-none">
                                            {level.toFixed(1)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {feared.length > 0 && (
                        <section>
                            <h4 className="panel-title mb-2">Who frightens them</h4>
                            <div className="space-y-1">
                                {feared.map(({ other, value }) => (
                                    <div key={other!.id} className="flex justify-between items-center text-sm gap-2">
                                        <span className={`truncate ${other!.status === 'dead' ? 'text-[var(--color-ink-500)] line-through' : 'text-[var(--color-ink-200)]'}`}>
                                            {other!.name}
                                        </span>
                                        <span className="font-mono text-xs flex-none text-[var(--cat-death)]">
                                            {value >= 60 ? 'terrified' : value >= 30 ? 'wary' : 'uneasy'} · {value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <section>
                        <h4 className="panel-title mb-2">Inventory ({tribute.inventory.length})</h4>
                        <div className="space-y-1.5">
                            {tribute.inventory.length === 0 ? (
                                <span className="text-sm text-[var(--color-ink-400)]">Carrying nothing</span>
                            ) : tribute.inventory.map((item, i) => (
                                <div key={`${item.id}-${i}`} className="panel-flush p-2 flex justify-between items-center gap-2">
                                    <span className="text-sm text-[var(--ink)] truncate">{item.name}</span>
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
                            ) : relationships.map(({ other, value, sworn }) => (
                                <div key={other!.id} className="flex justify-between items-center text-sm gap-2">
                                    <span className={`truncate ${other!.status === 'dead' ? 'text-[var(--color-ink-500)] line-through' : 'text-[var(--color-ink-200)]'}`}>
                                        {other!.name}
                                    </span>
                                    <span
                                        className="font-mono text-xs flex-none"
                                        style={{ color: value > 0 ? 'var(--cat-alliance)' : value < 0 ? 'var(--cat-death)' : 'var(--color-ink-500)' }}
                                        title={sworn ? `${tribute.name} has sworn to kill ${other!.name}` : undefined}
                                    >
                                        {sworn ? '⚔ ' : ''}{value > 0 ? `+${value}` : value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h4 className="panel-title mb-2">Their chronicle ({personalLog.length})</h4>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                            {personalLog.length === 0 ? (
                                <span className="text-sm text-[var(--color-ink-400)]">Nothing recorded about them yet</span>
                            ) : (
                                [...personalLog].reverse().map(l => <FeedLine key={l.id} log={l} animate={false} />)
                            )}
                        </div>
                    </section>

                    <section>
                        <h4 className="panel-title mb-2">What they know</h4>
                        {knownZones.length === 0 ? (
                            <span className="text-sm text-[var(--color-ink-400)]">Nothing worth remembering yet</span>
                        ) : (
                            <div className="space-y-1">
                                {knownZones.map(z => (
                                    <div key={z.name} className="flex justify-between items-center text-sm gap-2">
                                        <span className="truncate text-[var(--color-ink-200)]">{z.name}</span>
                                        <span className="font-mono text-xs flex-none text-[var(--color-ink-400)]">
                                            {z.threat > 0.15 && <span style={{ color: 'var(--cat-death)' }}>danger {z.threat.toFixed(1)}</span>}
                                            {z.threat > 0.15 && z.rivals > 0 && ' · '}
                                            {z.rivals > 0 && `${z.rivals} seen`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
