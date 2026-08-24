import React from 'react';
import { GameState, Tribute } from '../models/types';
import { X, ArrowLeftRight } from 'lucide-react';
import { BodyDiagram } from './BodyDiagram';
import { TributeTile } from './TributeTile';
import { summarySentence } from './TributeSummary';
import { getRel } from '../engine/relationships';
import { fearOf } from '../engine/fear';
import { notorietyOf } from '../engine/notoriety';
import { resolveOf } from '../engine/resolve';
import { profOf } from '../engine/proficiency';
import { Proficiency } from '../models/types';

/**
 * §2.3: two tributes side by side, mid-run.
 *
 * `HofCompare` exists and answers a different question — what was different
 * about the run that went well, across saved games. Inside a run there was no
 * way to put two tribute sheets next to each other at all, which is exactly
 * what a reader wants the moment a rivalry sharpens or an alliance starts to
 * come apart: not "how is Cato doing" but "how do Cato and Thresh actually
 * compare, and what do they think of each other".
 *
 * That second half is the reason this is a view rather than two modals opened
 * at once. The interesting numbers in a two-tribute comparison are the ones
 * that only exist *between* them — regard each way, fear each way, what each
 * has heard about the other — and none of those can be shown on a single
 * tribute's sheet, because they are not properties of a tribute.
 */

const ATTRIBUTES = [
    ['strength', 'Strength'], ['agility', 'Agility'], ['endurance', 'Endurance'],
    ['intelligence', 'Intelligence'], ['willpower', 'Willpower'],
    ['charisma', 'Charisma'], ['stealth', 'Stealth'],
] as const;

const SKILLS: Array<[Proficiency, string]> = [
    ['melee', 'Melee'], ['ranged', 'Ranged'], ['forage', 'Forage'],
    ['medicine', 'Medicine'], ['tracking', 'Tracking'], ['persuasion', 'Persuasion'],
];

/** A row where the higher number is marked, so the sheet is scannable. */
function Row({ label, a, b, format }: {
    label: string;
    a: number;
    b: number;
    format?: (n: number) => string;
}) {
    const show = format ?? ((n: number) => (Math.round(n * 10) / 10).toString());
    const lead = a === b ? 'tie' : a > b ? 'a' : 'b';
    const cell = (side: 'a' | 'b', value: number) => (
        <div className={`font-mono text-sm text-right tabular-nums ${lead === side ? 'font-black text-[var(--ink)]' : 'text-[var(--color-ink-500)]'}`}>
            {show(value)}
            {/* The lead is marked in text as well as weight — weight alone is
                the same kind of colour-only signal §2.1 is about. */}
            {lead === side && <span className="ml-1 text-[10px]" aria-label="higher">▲</span>}
        </div>
    );
    return (
        <>
            {cell('a', a)}
            <div className="text-[11px] text-[var(--color-ink-500)] text-center self-center">{label}</div>
            {cell('b', b)}
        </>
    );
}

/** The numbers that only exist between the two of them. */
function BetweenThem({ a, b }: { a: Tribute; b: Tribute }) {
    const regardWord = (n: number) =>
        n >= 60 ? 'devoted' : n >= 30 ? 'warm' : n >= 10 ? 'friendly'
        : n > -10 ? 'neutral' : n > -35 ? 'wary' : n > -60 ? 'hostile' : 'murderous';
    const pair = (label: string, from: Tribute, to: Tribute) => {
        const regard = Math.round(getRel(from, to.id));
        const fear = Math.round(fearOf(from, to.id));
        const heard = Math.round(notorietyOf(from, to.id));
        return (
            <div className="panel-flush p-3 space-y-1">
                <div className="eyebrow">{label}</div>
                <div className="text-sm">
                    <span className="font-bold text-[var(--ink)]">{regardWord(regard)}</span>
                    <span className="font-mono text-[11px] text-[var(--color-ink-500)] ml-1.5">({regard > 0 ? '+' : ''}{regard})</span>
                </div>
                <div className="text-[11px] text-[var(--color-ink-500)]">
                    {fear > 0 ? `afraid of them (${fear})` : 'not afraid of them'}
                    {heard > 0 && ` · has heard of them (${heard})`}
                </div>
            </div>
        );
    };
    return (
        <section className="space-y-2">
            <h4 className="panel-title">Between them</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pair(`${a.name} on ${b.name}`, a, b)}
                {pair(`${b.name} on ${a.name}`, b, a)}
            </div>
            {a.allianceId && a.allianceId === b.allianceId && (
                <p className="text-xs text-[var(--cat-alliance)]">They are in the same alliance.</p>
            )}
            {(a.memory?.vengeance ?? []).includes(b.id) && (
                <p className="text-xs text-[var(--cat-betrayal)]">{a.name} has sworn to kill {b.name}.</p>
            )}
            {(b.memory?.vengeance ?? []).includes(a.id) && (
                <p className="text-xs text-[var(--cat-betrayal)]">{b.name} has sworn to kill {a.name}.</p>
            )}
        </section>
    );
}

export function TributeCompare({ a, b, gameState, onClose, onSwap }: {
    a: Tribute;
    b: Tribute;
    gameState: GameState;
    onClose: () => void;
    /** Drop the second tribute and pick a different one. */
    onSwap?: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label={`${a.name} compared with ${b.name}`}
            onClick={onClose}
        >
            <div className="panel p-5 max-w-3xl w-full space-y-5 my-8" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start gap-4">
                    <h2 className="display-title text-2xl flex items-center gap-2">
                        <ArrowLeftRight className="w-5 h-5" /> {a.name} vs {b.name}
                    </h2>
                    <div className="flex gap-2">
                        {onSwap && (
                            <button onClick={onSwap} className="btn btn-sm btn-ghost">Pick another</button>
                        )}
                        <button onClick={onClose} className="btn btn-sm btn-ghost" aria-label="Close comparison">
                            <X className="w-4 h-4" /> Close
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {[a, b].map(t => (
                        <div key={t.id} className="space-y-2">
                            <TributeTile tribute={t} size="sm" />
                            <div className="flex justify-center"><BodyDiagram tribute={t} /></div>
                            <p className="text-xs text-[var(--color-ink-400)]">{summarySentence(gameState, t)}</p>
                        </div>
                    ))}
                </div>

                <BetweenThem a={a} b={b} />

                <section className="space-y-2">
                    <h4 className="panel-title">Condition</h4>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-1.5 items-center">
                        <Row label="Health" a={a.health} b={b.health} format={n => `${Math.round(n)}%`} />
                        <Row label="Resolve" a={resolveOf(a)} b={resolveOf(b)} format={n => `${Math.round(n)}`} />
                        <Row label="Sanity" a={a.vitals.sanity} b={b.vitals.sanity} format={n => `${Math.round(n)}`} />
                        {/* Lower is better on these three, so they are shown as
                            what is left rather than what is spent — otherwise
                            the ▲ marks the tribute who is worse off. */}
                        <Row label="Fed" a={100 - a.vitals.hunger} b={100 - b.vitals.hunger} format={n => `${Math.round(n)}%`} />
                        <Row label="Watered" a={100 - a.vitals.thirst} b={100 - b.vitals.thirst} format={n => `${Math.round(n)}%`} />
                        <Row label="Rested" a={100 - a.vitals.fatigue} b={100 - b.vitals.fatigue} format={n => `${Math.round(n)}%`} />
                        <Row label="Kills" a={a.kills} b={b.kills} format={n => `${n}`} />
                    </div>
                </section>

                <section className="space-y-2">
                    <h4 className="panel-title">Attributes</h4>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-1.5 items-center">
                        {ATTRIBUTES.map(([key, label]) => (
                            <Row key={key} label={label} a={a.attributes[key]} b={b.attributes[key]} />
                        ))}
                    </div>
                </section>

                <section className="space-y-2">
                    <h4 className="panel-title">Skills</h4>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-1.5 items-center">
                        {SKILLS.map(([key, label]) => (
                            <Row key={key} label={label} a={profOf(a, key)} b={profOf(b, key)} />
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
