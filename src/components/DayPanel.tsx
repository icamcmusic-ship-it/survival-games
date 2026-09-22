import React from 'react';
import { GameState, Tribute } from '../models/types';
import { hoursLeft, hoursFor, travelHoursFor, crossingsLeft } from '../engine/actionBudget';
import { canSpanTo, Refusal } from '../engine/actions';
import { isVertical, levelOf } from '../engine/verticality';
import { cycleOf } from '../engine/memory';

/**
 * AUDIT-10 B3-02: the day, as the engine actually keeps it.
 *
 * The audit's complaint is that several fields drive every decision a tribute
 * makes and appear nowhere: *"hours remaining, current project site, progress,
 * reserved materials, why it paused"*, forecasts, and upper/lower occupancy.
 * It was exactly true — `hoursLeft`, `partialWork`, `zoneLevel` and
 * `state.forecasts` had no reader under `src/components` or `src/screens` at
 * all. A player watching a tribute stand still all afternoon had no way to
 * learn they were three hours into a shelter, or out of hours, or that the
 * ally one screen away was on the wrong end of a rope.
 *
 * Everything here is read, never derived twice: the hours come from
 * `actionBudget`, the reach verdicts from `engine/actions`, the levels from
 * `engine/verticality`. A panel that recomputed any of them would be a second
 * opinion that can disagree with the simulation, which is worse than no panel.
 */

/** The engine's refusals, in the second person, for someone reading a sheet. */
const WHY_NOT: Record<Refusal, string> = {
    'incapable': 'not in a state to act',
    'in-transit': 'still crossing — not anywhere yet',
    'out-of-contact': 'no way to signal them',
    'out-of-reach': 'same zone, wrong level — a line is paid down, never up',
    'unobserved': 'cannot see them from here',
    'no-time': 'no hours left today',
    'no-room': 'nothing free to carry it',
    'gone': 'dead',
    'incapable-of-this': 'not something they can do',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-3 py-0.5">
            <dt className="text-[var(--color-ink-500)]">{label}</dt>
            <dd className="text-[var(--color-ink-200)] text-right">{children}</dd>
        </div>
    );
}

function Meter({ value, of }: { value: number; of: number }) {
    const pct = of <= 0 ? 0 : Math.max(0, Math.min(100, (value / of) * 100));
    return (
        <div className="h-1.5 bg-[var(--color-ink-800)] rounded-sm overflow-hidden mt-1">
            <div className="h-full bg-[var(--gold)]" style={{ width: `${pct}%` }} />
        </div>
    );
}

export function DayPanel({ tribute, gameState }: { tribute: Tribute; gameState: GameState }) {
    // A dead tribute has a frozen budget and a project nobody will finish. The
    // dossier still opens on them, and reporting "4.2 hours left" for someone
    // in a hovercraft would be a lie told in a monospace font.
    if (tribute.status !== 'alive') return null;

    const left = hoursLeft(tribute);
    const full = hoursFor(tribute);
    const work = tribute.partialWork;
    const here = gameState.tributes.filter(o => o.status === 'alive' && o.id !== tribute.id && o.zone === tribute.zone);
    const vertical = isVertical(gameState.arena, tribute.zone);
    const level = levelOf(gameState.arena, tribute);
    const cycle = cycleOf(gameState);
    const due = (gameState.forecasts ?? []).filter(f => f.zone === tribute.zone);

    return (
        <section>
            <h4 className="panel-title mb-2">Their day</h4>
            <dl className="font-mono text-mini leading-relaxed">
                <Row label="Hours left">
                    {left.toFixed(1)} of {full.toFixed(1)}
                </Row>
                <Meter value={left} of={full} />
                <Row label="A crossing costs">{travelHoursFor(tribute).toFixed(1)}h</Row>
                <Row label="Crossings left">{crossingsLeft(tribute)}</Row>
            </dl>

            <div className="mt-3">
                <div className="panel-title mb-1">Project</div>
                {work ? (
                    <dl className="font-mono text-mini leading-relaxed">
                        <Row label="Job">{work.kind}</Row>
                        <Row label="Hours in">
                            {work.totalHours !== undefined
                                ? `${work.hoursDone.toFixed(1)} of ${work.totalHours.toFixed(1)}`
                                : `${work.hoursDone.toFixed(1)}`}
                        </Row>
                        {work.totalHours !== undefined && <Meter value={work.hoursDone} of={work.totalHours} />}
                        <Row label="Site">
                            {/* Portable work travels with them; sited work does not,
                                and walking away from it is what stalls it. */}
                            {work.site
                                ? `${work.site.zone}${work.site.level ? ` · ${work.site.level}` : ''}`
                                : 'carried with them'}
                        </Row>
                        {work.site && work.site.zone !== tribute.zone && (
                            <p className="text-[var(--red)] mt-1 leading-snug">
                                Stalled — the work is in {work.site.zone} and they are not.
                            </p>
                        )}
                    </dl>
                ) : (
                    <p className="text-[var(--color-ink-500)] text-mini">Nothing part-finished. Starting something else abandons it.</p>
                )}
            </div>

            <div className="mt-3">
                <div className="panel-title mb-1">
                    Standing in {tribute.zone}{vertical && level ? ` · ${level}` : ''}
                </div>
                {here.length === 0 ? (
                    <p className="text-[var(--color-ink-500)] text-mini">Alone here.</p>
                ) : (
                    <ul className="font-mono text-mini leading-relaxed space-y-0.5">
                        {here.map(o => {
                            const verdict = canSpanTo(gameState, tribute, o);
                            const oLevel = vertical ? levelOf(gameState.arena, o) : undefined;
                            return (
                                <li key={o.id} className="flex justify-between gap-3">
                                    <span className="text-[var(--color-ink-300)]">
                                        {o.name}{oLevel ? ` · ${oLevel}` : ''}
                                    </span>
                                    <span className={verdict.ok ? 'text-[var(--color-ink-500)]' : 'text-[var(--red)] text-right'}>
                                        {verdict.ok ? 'in reach' : WHY_NOT[verdict.why]}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {due.length > 0 && (
                <div className="mt-3">
                    <div className="panel-title mb-1">Coming here</div>
                    <ul className="font-mono text-mini leading-relaxed space-y-0.5">
                        {due.map((f, i) => {
                            const cycles = f.dueCycle - cycle;
                            return (
                                <li key={i} className="flex justify-between gap-3">
                                    <span className="text-[var(--color-ink-300)]">{f.kind}</span>
                                    <span className="text-[var(--color-ink-500)] text-right">
                                        {/* Announced but not arrived is the only window in which
                                            anybody can do anything about it — so the distinction
                                            is the whole point of showing it. */}
                                        {cycles > 0 ? `in ${cycles} cycle${cycles === 1 ? '' : 's'}` : 'due now'}
                                        {f.mitigation > 0 && ` · ${Math.round(f.mitigation * 100)}% blunted`}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </section>
    );
}
