import React from 'react';
import { GameState, Tribute } from '../models/types';

/**
 * §2.3: the debrief as a story rather than a stat block.
 *
 * Everything needed to narrate a victor's run was already on the state and
 * nowhere on the page: `oddsHistory` (what the book thought of them on each
 * day), `shedTraits` and `traitAge` (who they stopped being and who they
 * became), `visitedZones` (how much of the arena they actually walked),
 * `memory.rivals` (who they kept meeting) and `memory.mourned` (who they lost).
 * The debrief opened with cause-of-death counts instead.
 *
 * This is one paragraph, assembled from those, in the order the run happened —
 * priced at 3% on day two, took the horn on day five, shed Skittish, earned
 * Hardened. Every clause is dropped when the data is not there, so a quiet
 * victor gets a short sentence rather than a padded one.
 */
export function VictorArc({ gameState, victor }: { gameState: GameState; victor: Tribute }) {
    const clauses: string[] = [];

    // The book, from opening line to the day it changed its mind.
    const history = gameState.oddsHistory ?? {};
    const days = Object.keys(history).map(Number).sort((a, b) => a - b);
    const series = days.map(d => ({ day: d, pct: history[d]?.[victor.id] })).filter(p => p.pct !== undefined) as Array<{ day: number; pct: number }>;
    if (series.length >= 2) {
        const opening = series[0];
        const low = series.reduce((worst, p) => (p.pct < worst.pct ? p : worst));
        const closing = series[series.length - 1];
        clauses.push(
            low.pct < opening.pct - 2 && low.day > opening.day
                ? `The book opened them at ${opening.pct}% and had them down to ${low.pct}% by day ${low.day}.`
                : `The book opened them at ${opening.pct}%.`
        );
        if (closing.pct > opening.pct + 5) {
            clauses.push(`By day ${closing.day} it had them at ${closing.pct}% and was still behind.`);
        }
    }

    // What the run did to them, in the order the trait layer records it.
    const shed = [...new Set(victor.shedTraits ?? [])];
    const earned = Object.entries(victor.traitAge ?? {})
        // A trait carried since the reaping has aged the whole run; anything
        // younger than the run itself was picked up inside the arena.
        .filter(([trait, age]) => age < (gameState.cycle ?? 0) - 1 && victor.traits.includes(trait))
        .map(([trait]) => trait);
    if (shed.length > 0 && earned.length > 0) {
        clauses.push(`They went in ${shed.join(' and ').toLowerCase()} and came out ${earned.join(' and ').toLowerCase()}.`);
    } else if (shed.length > 0) {
        clauses.push(`They stopped being ${shed.join(' and ').toLowerCase()} somewhere in there.`);
    } else if (earned.length > 0) {
        clauses.push(`The arena made them ${earned.join(' and ').toLowerCase()}.`);
    }

    // Ground covered, which separates a runner from somebody who found a
    // corner of the map and stayed in it.
    const walked = victor.visitedZones?.length ?? 0;
    const total = gameState.arena.zones.length;
    if (walked > 0) {
        clauses.push(walked >= total - 1
            ? `They walked almost the whole arena — ${walked} of its ${total} sectors.`
            : walked <= 2
                ? `They found ${walked === 1 ? 'one sector' : 'two sectors'} they could live in and never really left.`
                : `They covered ${walked} of the arena's ${total} sectors.`);
    }

    // The people. A rival they kept meeting matters more than a body count.
    const rivals = Object.entries(victor.memory?.rivals ?? {})
        .filter(([, r]) => r.fights > 0)
        .sort((a, b) => b[1].fights - a[1].fights);
    if (rivals[0]) {
        const [id, record] = rivals[0];
        const who = gameState.tributes.find(t => t.id === id);
        if (who && record.fights > 1) {
            clauses.push(`${who.name} found them ${record.fights} times, and lost the last one.`);
        }
    }
    const mourned = (victor.memory?.mourned ?? [])
        .map(id => gameState.tributes.find(t => t.id === id))
        .filter((t): t is Tribute => !!t);
    if (mourned.length > 0) {
        clauses.push(mourned.length === 1
            ? `They are going home without ${mourned[0].name}.`
            : `They are going home without ${mourned.slice(0, 2).map(t => t.name).join(' or ')}${mourned.length > 2 ? ` — or ${mourned.length - 2} others` : ''}.`);
    }

    if (victor.kills === 0) {
        clauses.push('They never killed anybody. The arena did all of it for them, and they will be asked about that for the rest of their life.');
    }

    if (clauses.length === 0) return null;

    return (
        <div className="md:col-span-2 panel p-5 space-y-2" style={{ borderColor: 'var(--gold)', borderWidth: '3px' }}>
            <span className="eyebrow" style={{ color: 'var(--red)' }}>How {victor.name} got out</span>
            <p className="text-sm text-[var(--color-ink-200)] leading-relaxed">{clauses.join(' ')}</p>
        </div>
    );
}
