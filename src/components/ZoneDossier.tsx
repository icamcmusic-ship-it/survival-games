import React from 'react';
import { GameState } from '../models/types';
import { ZONES, LOAD_BEARING } from '../data/balance';
import { structuralFatigueOf } from '../engine/loadBearing';
import { frontName } from '../engine/weatherFront';
import { isVertical } from '../engine/verticality';

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
 *
 * Audit 3 §2.2/§2.6: three more pieces of live state that the engine wrote on
 * most cycles of most runs and that the interface never showed anywhere —
 * `structuralFatigue` (which decides whether a ruin comes down on you),
 * `weatherFront` (a storm with a position, which is the one hazard in the game
 * you can *see coming and walk away from*), and `climateDrift` (the arena's
 * slow turn toward heat, cold, wet or dry). A hazard the player cannot see is
 * not a decision; it is an accident that happens to them.
 *
 * This component also carried no `aria-*` or `role` at all, which for a panel
 * that is nothing but label/value pairs made it an undifferentiated run of text
 * to anything not reading the visual grid.
 */
export function ZoneDossier({ gameState, zone }: { gameState: GameState; zone: string }) {
    const printed = gameState.arena.zones.find(z => z.name === zone);
    if (!printed) return null;

    const depletion = gameState.zoneDepletion?.[zone] ?? 0;
    const peak = gameState.zoneDepletionPeak?.[zone] ?? depletion;
    const deaths = gameState.zoneDeaths?.[zone] ?? 0;
    const traffic = gameState.zoneTraffic?.[zone] ?? 0;
    const effects = gameState.zoneEffects?.[zone] ?? [];
    /*
     * AUDIT-10 B3-02: "forecasts on the map and dossier, distinguishing pending
     * warnings from active effects".
     *
     * They are genuinely different facts and the dossier only had a row for one
     * of them. `State` is what this sector is doing to you right now; a forecast
     * is what it is going to do, and the gap between the two is the only window
     * in which anybody — tribute or player — can act. A panel that folded them
     * together would turn a warning into a weather report.
     */
    const cycle = gameState.cycle ?? 0;
    const forecasts = (gameState.forecasts ?? [])
        .filter(f => f.zone === zone)
        .sort((a, b) => a.dueCycle - b.dueCycle);
    const here = gameState.tributes.filter(t => t.status === 'alive' && t.zone === zone);
    const fatigue = structuralFatigueOf(gameState, zone);
    const vertical = isVertical(gameState.arena, zone);
    const front = gameState.weatherFront;
    const frontHere = front?.zone === zone;
    // Adjacent and not already crossed: the front has to go somewhere, and this
    // is the honest version of "it might be here next".
    const frontNext = front !== undefined
        && !frontHere
        && (printed.adjacent ?? []).includes(front.zone)
        && !front.crossed.includes(zone);
    const drift = gameState.climateDrift;
    // `Tribute.zone` is not cleared on death, so the fallen are still standing
    // where they fell — which is what makes naming them here possible at all.
    const fell = gameState.tributes.filter(t => t.status === 'dead' && t.zone === zone);
    /*
     * AUDIT-10 F17: two different quantities, labelled as one.
     *
     * `printed.resources` is the zone's yield relative to the arena; depletion
     * is the share of *that* which has been taken. The product of the two is
     * effective yield, and it was printed under the label "% of what it started
     * with" — so a zone with `resources: 0.4` and nothing taken from it at all
     * read as "40% of what it started with", which is a lie about a number the
     * player uses to decide where to forage.
     *
     * Both are now shown, each on its own scale and under its own name:
     * `stockLeft` is the share of this zone's own original stock still there,
     * and `effectiveYield` is what a forage here is actually worth. The
     * historical worst figure sits on the same scale as the stock figure it
     * qualifies.
     */
    const stockLeft = Math.round((1 - depletion) * 100);
    const worstStockLeft = Math.round((1 - peak) * 100);
    const effectiveYield = Math.round(printed.resources * (1 - depletion) * 100);
    const stripped = depletion >= 1 - ZONES.minYieldFraction - 0.01;

    const row = (label: string, value: React.ReactNode) => (
        <div role="row" className="flex gap-3 text-mini">
            <span role="rowheader" className="eyebrow flex-none w-24 pt-px">{label}</span>
            <span role="cell" className="text-[var(--color-ink-200)] min-w-0">{value}</span>
        </div>
    );

    return (
        <div role="table" aria-label={`Sector dossier: ${zone}`} className="panel-flush p-3 space-y-1.5">
            {row('Ground', `${printed.terrain} · danger ${Math.round(printed.danger * 100)}% · printed yield ${Math.round(printed.resources * 100)}%`)}
            {row('Forage', (
                <span>
                    {stockLeft}% of what it started with · effective yield {effectiveYield}%
                    {stripped && <strong className="text-[var(--red)]"> — stripped to the floor</strong>}
                    {peak > depletion + 0.05 && ` (worst its stock has been: ${worstStockLeft}%)`}
                </span>
            ))}
            {row('Traffic', traffic === 0 ? 'Nobody has set foot here.' : `${traffic} crossings this run`)}
            {row('Deaths', deaths === 0
                ? 'Nobody has died here.'
                : `${deaths} — ${fell.map(t => t.name).join(', ') || 'unrecorded'}`)}
            {effects.length > 0 && row('State', effects.map(e => e.kind).join(', '))}
            {forecasts.length > 0 && row('Forecast', (
                <span>
                    {forecasts.map((f, i) => {
                        const cycles = f.dueCycle - cycle;
                        return (
                            <span key={i} className={cycles <= 1 ? 'text-[var(--red)]' : undefined}>
                                {i > 0 && ' · '}
                                <strong>{f.kind}</strong>
                                {cycles > 0 ? ` in ${cycles} cycle${cycles === 1 ? '' : 's'}` : ' — due now'}
                                {/* A partly dug firebreak still takes the edge off,
                                    so the mitigation is a number rather than a flag. */}
                                {f.mitigation > 0 && ` (${Math.round(f.mitigation * 100)}% headed off)`}
                            </span>
                        );
                    })}
                </span>
            ))}
            {fatigue > 0 && row('Structure', (
                <span>
                    {Math.round(fatigue * 100)}% loaded
                    {fatigue >= LOAD_BEARING.liveAt
                        ? <strong className="text-[var(--red)]"> — it is a question of when, not whether</strong>
                        : ' — holding, for now'}
                </span>
            ))}
            {(frontHere || frontNext) && front && row('Weather', (
                <span className={frontHere ? 'text-[var(--red)]' : undefined}>
                    {frontHere
                        ? <strong>{frontName(front)}, here now</strong>
                        : `${frontName(front)}, one sector away and moving`}
                </span>
            ))}
            {drift && drift.progress > 0.15 && row('Climate', `The arena is turning ${drift.toward} (${Math.round(drift.progress * 100)}% of the way)`)}
            {/* B3-02: which level they are on, where the zone has levels. Two
                tributes in the same sector on opposite ends of a rope cannot
                reach each other, and a single list said they could. */}
            {row('Standing', here.length === 0 ? 'Empty.' : (
                vertical
                    ? ['upper', 'lower'].map(l => {
                        const on = here.filter(t => (t.zoneLevel ?? 'lower') === l);
                        return on.length === 0 ? null : `${l}: ${on.map(t => t.name).join(', ')}`;
                    }).filter(Boolean).join(' · ')
                    : here.map(t => t.name).join(', ')
            ))}
        </div>
    );
}
