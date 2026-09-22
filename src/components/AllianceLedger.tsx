import React from 'react';
import { Alliance, CharterRule, GameState } from '../models/types';
import { ruleText } from '../engine/allianceCharter';

/**
 * AUDIT-10 B3-02: the alliance ledger.
 *
 * The sheet already shows what a group *is* — leader, pact, camp, charter,
 * heir. What it never showed is the running account between the people in it,
 * and that is the half that decides how the group ends. Four fields, none of
 * them named by any component before this one:
 *
 *   `cacheContributions`  who actually filled the pile
 *   `breachesBy`          which clause each member has broken, and how often
 *   `expelledIds`         who was thrown out, so nobody wonders why they are
 *                         not being re-recruited
 *   `allianceDisputes`    every hearing about a cache that would not go round
 *
 * The audit's phrasing is "an alliance ledger", and a ledger is the right word
 * rather than a summary: a group whose quartermaster has put in nine units and
 * whose loudest member has put in none is a different group from an even one,
 * and the engine has always known which it was looking at.
 *
 * A hearing is shown as what it decided and who it cost, because that is the
 * part with consequences — `split` is the rule they chose, and each of the
 * three honest ways to be short is unfair to somebody different.
 */

const SPLIT_TEXT: Record<'equal' | 'by-contribution' | 'by-need', string> = {
    'equal': 'split evenly',
    'by-contribution': 'to whoever filled the pile',
    'by-need': 'to whoever needed it most',
};

export function AllianceLedger({ alliance, gameState }: { alliance: Alliance; gameState: GameState }) {
    const nameOf = (id: string) => gameState.tributes.find(t => t.id === id)?.name ?? 'someone';

    const contributions = Object.entries(alliance.cacheContributions ?? {})
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]);
    // Members who put in nothing are the point of the list, not an omission
    // from it — an empty row is the reason a split by contribution bites.
    const freeloaders = alliance.memberIds.filter(id => !(alliance.cacheContributions?.[id] ?? 0));

    const breaches = Object.entries(alliance.breachesBy ?? {}).filter(([, rules]) => rules.length > 0);
    const expelled = alliance.expelledIds ?? [];
    const hearings = (gameState.allianceDisputes ?? []).filter(d => d.allianceId === alliance.id);

    if (contributions.length === 0 && breaches.length === 0 && expelled.length === 0 && hearings.length === 0) {
        return (
            <p className="text-[var(--color-ink-500)] text-mini mt-2">
                Nothing on the ledger yet — nobody has put anything in, broken anything or been thrown out.
            </p>
        );
    }

    return (
        <div className="mt-3 space-y-3">
            {(contributions.length > 0 || freeloaders.length > 0) && (
                <div>
                    <div className="panel-title mb-1">Who filled the pile</div>
                    <ul className="font-mono text-mini leading-relaxed space-y-0.5">
                        {contributions.map(([id, n]) => (
                            <li key={id} className="flex justify-between gap-3">
                                <span className="text-[var(--color-ink-300)]">{nameOf(id)}</span>
                                <span className="text-[var(--color-ink-500)]">{n}</span>
                            </li>
                        ))}
                        {freeloaders.length > 0 && (
                            <li className="flex justify-between gap-3">
                                <span className="text-[var(--color-ink-500)]">
                                    {freeloaders.map(nameOf).join(', ')}
                                </span>
                                <span className="text-[var(--color-ink-500)]">nothing</span>
                            </li>
                        )}
                    </ul>
                </div>
            )}

            {breaches.length > 0 && (
                <div>
                    <div className="panel-title mb-1">Broken terms</div>
                    <ul className="text-mini leading-snug space-y-1">
                        {breaches.map(([id, rules]) => {
                            // A second breach of the *same* clause is a hearing, so
                            // the count per clause is the fact that matters, not the
                            // total.
                            const perRule = new Map<string, number>();
                            rules.forEach(r => perRule.set(r, (perRule.get(r) ?? 0) + 1));
                            return (
                                <li key={id}>
                                    <span className="text-[var(--color-ink-200)] font-bold">{nameOf(id)}</span>
                                    <span className="text-[var(--color-ink-500)]">
                                        {' — '}
                                        {[...perRule].map(([r, n]) =>
                                            `${ruleText(r as CharterRule)}${n > 1 ? ` (${n} times)` : ''}`).join('; ')}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {expelled.length > 0 && (
                <div>
                    <div className="panel-title mb-1">Thrown out</div>
                    <p className="text-mini text-[var(--color-ink-300)] leading-snug">
                        {expelled.map(nameOf).join(', ')}
                        <span className="text-[var(--color-ink-500)]"> — not eligible to be taken back in.</span>
                    </p>
                </div>
            )}

            {hearings.length > 0 && (
                <div>
                    <div className="panel-title mb-1">Hearings ({hearings.length})</div>
                    <ul className="text-mini leading-snug space-y-1">
                        {hearings.map((d, i) => (
                            <li key={i}>
                                <span className="text-[var(--color-ink-500)] font-mono">c{d.cycle}</span>
                                <span className="text-[var(--color-ink-200)]"> {SPLIT_TEXT[d.split]}</span>
                                <span className="text-[var(--color-ink-500)]">
                                    {' — fed '}{d.fedIds.map(nameOf).join(', ') || 'nobody'}
                                    {d.passedOverIds.length > 0 && `; passed over ${d.passedOverIds.map(nameOf).join(', ')}`}
                                    {/* Not at the cache is not the same as passed over:
                                        a standing entitlement is not a meal. */}
                                    {(d.absentIds?.length ?? 0) > 0 && `; ${d.absentIds!.map(nameOf).join(', ')} were not there`}
                                </span>
                                {d.walkoutIds.length > 0 && (
                                    <span className="text-[var(--red)]">
                                        {' — '}{d.walkoutIds.map(nameOf).join(', ')} walked out over it.
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
