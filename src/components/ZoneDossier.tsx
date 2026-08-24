import React from 'react';
import { GameState } from '../models/types';
import { ZONES } from '../data/balance';

/**
 * §2.2: a sector, as a place with a history.
 *
 * `ArenaMap` showed where people are standing right now. Everything needed to
 * answer "what is this place?" was already on the state and had no surface at
 * all: `zoneDeaths` (who died here), `zoneTraffic` (how much of the run has
 * passed through), `zoneDepletion` and `zoneDepletionPeak` (how stripped it is
 * and how stripped it has ever been), and `zoneEffects` (what it is currently
 * doing to anyone standing in it).
 *
 * Deliberately a dossier rather than a chart: the sector log below it already
 * carries the narrative, and this is the header that log deserved.
 */
export function ZoneDossier({ gameState, zone }: { gameState: GameState; zone: string }) {
    const printed = gameState.arena.zones.find(z => z.name === zone);
    if (!printed) return null;

    const depletion = gameState.zoneDepletion?.[zone] ?? 0;
    const peak = gameState.zoneDepletionPeak?.[zone] ?? depletion;
    const deaths = gameState.zoneDeaths?.[zone] ?? 0;
    const traffic = gameState.zoneTraffic?.[zone] ?? 0;
    const effects = gameState.zoneEffects?.[zone] ?? [];
    const here = gameState.tributes.filter(t => t.status === 'alive' && t.zone === zone);
    // `Tribute.zone` is not cleared on death, so the fallen are still standing
    // where they fell — which is what makes naming them here possible at all.
    const fell = gameState.tributes.filter(t => t.status === 'dead' && t.zone === zone);
    // The printed yield is what the arena started with; depletion is the share
    // of it that has been taken since.
    const yieldLeft = Math.round(printed.resources * (1 - depletion) * 100);
    const stripped = depletion >= 1 - ZONES.minYieldFraction - 0.01;

    const row = (label: string, value: React.ReactNode) => (
        <div className="flex gap-3 text-[11px]">
            <span className="eyebrow flex-none w-24 pt-px">{label}</span>
            <span className="text-[var(--color-ink-200)] min-w-0">{value}</span>
        </div>
    );

    return (
        <div className="panel-flush p-3 space-y-1.5">
            {row('Ground', `${printed.terrain} · danger ${Math.round(printed.danger * 100)}% · printed yield ${Math.round(printed.resources * 100)}%`)}
            {row('Forage', (
                <span>
                    {yieldLeft}% of what it started with
                    {stripped && <strong className="text-[var(--red)]"> — stripped to the floor</strong>}
                    {peak > depletion + 0.05 && ` (worst it has been: ${Math.round(printed.resources * (1 - peak) * 100)}%)`}
                </span>
            ))}
            {row('Traffic', traffic === 0 ? 'Nobody has set foot here.' : `${traffic} crossings this run`)}
            {row('Deaths', deaths === 0
                ? 'Nobody has died here.'
                : `${deaths} — ${fell.map(t => t.name).join(', ') || 'unrecorded'}`)}
            {effects.length > 0 && row('State', effects.map(e => e.kind).join(', '))}
            {row('Standing', here.length === 0 ? 'Empty.' : here.map(t => t.name).join(', '))}
        </div>
    );
}
