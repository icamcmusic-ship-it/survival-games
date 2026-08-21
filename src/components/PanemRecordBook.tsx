import React from 'react';
import { ACHIEVEMENTS } from '../data/achievements';
import { PanemRecords, RECORD_DEFS } from '../utils/panemStorage';
import { DISTRICT_LEGACY, legacyOf } from '../data/districts';
import { ARCHETYPES } from '../data/archetypes';
import { ArchetypeId } from '../models/types';
import { Trophy, Lock, Check, Crown } from 'lucide-react';

const DISTRICT_NUMBERS = Object.keys(DISTRICT_LEGACY).map(Number).sort((a, b) => a - b);

function archetypeName(id: string): string {
    return ARCHETYPES[id as ArchetypeId]?.name ?? id;
}

/**
 * REPLAY-03/04: what the player has, across every run they have ever finished.
 *
 * Locked achievements are shown by name and hint rather than hidden, because
 * the whole point of the list is to tell a player what the simulation can do
 * that they have not seen yet. A hidden list teaches nothing.
 */
export function PanemRecordBook({ panem }: { panem: PanemRecords }) {
    const unlocked = new Set(panem.unlocked);
    const seen = ACHIEVEMENTS.filter(a => unlocked.has(a.id));
    const unseen = ACHIEVEMENTS.filter(a => !unlocked.has(a.id));
    const heldRecords = RECORD_DEFS.filter(def => panem.bests[def.id] !== undefined);
    // Absent on any record written before district crowns existed, which reads
    // correctly as "nothing crowned yet".
    const crowns = panem.districtCrowns ?? {};
    const crownedDistricts = DISTRICT_NUMBERS.filter(d => crowns[d]?.first?.name).length;

    if (panem.runs === 0) {
        return (
            <div className="panel p-5">
                <h3 className="panel-title mb-2">Your Panem</h3>
                <p className="text-sm text-[var(--color-ink-500)]">
                    No Games finished yet. Records and the list of things these Games can do will fill in
                    as you run them.
                </p>
            </div>
        );
    }

    return (
        <div className="panel p-5 space-y-5">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h3 className="panel-title">Your Panem</h3>
                <span className="text-[11px] font-mono text-[var(--color-ink-500)]">
                    {panem.runs} Games finished · {panem.victors} crowned ·{' '}
                    {seen.length}/{ACHIEVEMENTS.length} seen
                </span>
            </div>

            {heldRecords.length > 0 && (
                <section>
                    <div className="eyebrow mb-2">Record book</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {heldRecords.map(def => {
                            const held = panem.bests[def.id]!;
                            return (
                                <div key={def.id} className="panel-flush p-2.5">
                                    <div className="eyebrow">{def.label}</div>
                                    <div className="text-sm text-[var(--ink)] font-semibold mt-0.5">
                                        {def.format(held.value)}
                                    </div>
                                    <div className="text-[11px] text-[var(--color-ink-500)] truncate">
                                        {held.name} (D{held.district}) · {held.arenaName} · seed {held.seed}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* REPLAY-12: the aggregate counters above cannot tell a player that a
                District 12 crown is the rarest thing in the simulation, or that they
                have never taken one. Twelve slots can. */}
            <section>
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                    <div className="eyebrow">District crowns</div>
                    <span className="text-[11px] font-mono text-[var(--color-ink-500)]">
                        {crownedDistricts}/{DISTRICT_NUMBERS.length} districts crowned
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {DISTRICT_NUMBERS.map(d => {
                        const crown = crowns[d];
                        const legacy = legacyOf(d);
                        if (!crown?.first?.name) {
                            return (
                                <div key={d} className="panel-flush p-2.5 flex items-start gap-2.5 opacity-55">
                                    <Lock className="w-3.5 h-3.5 mt-0.5 flex-none text-[var(--color-ink-500)]" />
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-[var(--color-ink-400)]">District {d}</div>
                                        <div className="text-[11px] text-[var(--color-ink-500)] truncate">
                                            {legacy.industry} · no crown yet
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        // Everything below is read straight out of localStorage, so a
                        // hand-edited or partial entry falls back rather than rendering NaN.
                        const archetypes = Array.isArray(crown.archetypes) ? crown.archetypes : [];
                        const victories = crown.victories ?? 1;
                        const kills = crown.first.kills ?? 0;
                        const days = crown.first.days ?? 0;
                        return (
                            <div key={d} className="panel-flush p-2.5 flex items-start gap-2.5">
                                <Crown className="w-3.5 h-3.5 mt-0.5 flex-none" style={{ color: 'var(--gold)' }} />
                                <div className="min-w-0">
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-[var(--ink)]">District {d}</span>
                                        <span className="chip">
                                            {victories} crown{victories === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-[var(--color-ink-500)] truncate">
                                        First: {crown.first.name} · Games {crown.first.run ?? '?'} ·{' '}
                                        {kills} kill{kills === 1 ? '' : 's'} ·{' '}
                                        {days} day{days === 1 ? '' : 's'}
                                    </div>
                                    <div className="text-[11px] text-[var(--color-ink-500)] truncate">
                                        {crown.first.arenaName || 'an unrecorded arena'} · seed {crown.first.seed || '—'}
                                        {archetypes.length > 0 && ` · won as ${archetypes.map(archetypeName).join(', ')}`}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {crownedDistricts < DISTRICT_NUMBERS.length && (
                    <p className="text-[11px] text-[var(--color-ink-500)] mt-2 italic">
                        <Trophy className="w-3 h-3 inline mb-0.5" /> The outer districts almost never win.
                        An empty slot is a standing invitation.
                    </p>
                )}
            </section>

            <section>
                <div className="eyebrow mb-2">Things these Games can do</div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                    {seen.map(a => (
                        <div key={a.id} className="panel-flush p-2.5 flex items-start gap-2.5">
                            <Check className="w-3.5 h-3.5 mt-0.5 flex-none" style={{ color: 'var(--cat-alliance)' }} />
                            <div className="min-w-0">
                                <div className="text-sm font-bold text-[var(--ink)]">{a.name}</div>
                                <div className="text-[11px] text-[var(--color-ink-500)]">{a.hint}</div>
                            </div>
                        </div>
                    ))}
                    {unseen.map(a => (
                        <div key={a.id} className="panel-flush p-2.5 flex items-start gap-2.5 opacity-55">
                            <Lock className="w-3.5 h-3.5 mt-0.5 flex-none text-[var(--color-ink-500)]" />
                            <div className="min-w-0">
                                <div className="text-sm font-bold text-[var(--color-ink-400)]">{a.name}</div>
                                <div className="text-[11px] text-[var(--color-ink-500)]">{a.hint}</div>
                            </div>
                        </div>
                    ))}
                </div>
                {unseen.length > 0 && (
                    <p className="text-[11px] text-[var(--color-ink-500)] mt-2 italic">
                        <Trophy className="w-3 h-3 inline mb-0.5" /> Locked entries are listed on purpose —
                        they are a menu of outcomes this simulation can produce, not a secret.
                    </p>
                )}
            </section>
        </div>
    );
}
