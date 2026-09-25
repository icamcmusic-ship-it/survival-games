import React from 'react';
import { GameState } from '../models/types';
import { ordinal } from '../engine/gamesProfile';
import { mutatorName } from '../data/mutators';
import { directorTaste } from '../data/directors';
import { CAMPAIGN_ARC } from '../data/balance';
import { isFreshCampaign, rebellionLabel, rebellionOf } from '../engine/campaign';

/** AUDIT-11 §12: a date-derived daily seed (`daily-YYYY-MM-DD`). */
function isDailySeed(seed: string): boolean {
    return /^daily-\d{4}-\d{2}-\d{2}$/.test(seed);
}

/**
 * §2.10: this year's Games, on one card.
 *
 * The run's identity — the temperament, the Quell if there is one, the Head
 * Gamemaker, the arena or the fact that it is sealed, how many districts were
 * reaped, and what the three multiplier sliders were left at — was learned from
 * scattered log lines over the first several phases, if at all. Two of those
 * things (the multipliers and the district count) had no surface anywhere.
 */
export function RunProfileCard({ gameState }: { gameState: GameState }) {
    const profile = gameState.gamesProfile;
    const config = gameState.baseConfig ?? gameState.config;

    /** A slider at 1 is the baseline; anything else is worth naming. */
    const multiplier = (value: number) => {
        if (Math.abs(value - 1) < 0.01) return 'as usual';
        if (value === 0) return 'switched off';
        return `${value.toFixed(2).replace(/\.?0+$/, '')}×`;
    };
    const off = (value: number) => Math.abs(value - 1) >= 0.01;

    const rows: Array<[string, React.ReactNode, boolean]> = [
        ['Games', profile ? `${ordinal(profile.gamesNumber)} — ${profile.temperament.name}` : '—', false],
        ['Arena', gameState.arenaHidden ? '❓ SEALED until the bloodbath' : gameState.arena.name, !!gameState.arenaHidden],
        ['Head Gamemaker', gameState.headGamemaker ?? 'not yet appointed', false],
        ['Districts reaped', `${config.districtCount} · ${gameState.tributes.length} tributes`, false],
        ['Hazards', multiplier(config.hazardRate), off(config.hazardRate)],
        ['Betrayals', multiplier(config.betrayalRate), off(config.betrayalRate)],
        ['Sponsors', multiplier(config.sponsorGenerosity), off(config.sponsorGenerosity)],
        ['Feast', config.enableFeast ? 'will be called' : 'none this year', !config.enableFeast],
        ['Sanity', config.enableSanity ? 'tracked' : 'not tracked', !config.enableSanity],
        // AUDIT-11 §12: the mutator cards drawn for this Games.
        ['Mutators', config.mutators?.length ? config.mutators.map(mutatorName).join(' + ') : 'none', !!config.mutators?.length],
        // AUDIT-11 §12: the daily, the director's taste and the campaign arc.
        ...(isDailySeed(gameState.seed) ? [['Daily seed', gameState.seed.slice('daily-'.length), true] as [string, React.ReactNode, boolean]] : []),
        ...(gameState.headGamemaker ? [['Director', directorTaste(gameState.headGamemaker).label, false] as [string, React.ReactNode, boolean]] : []),
        ...(!isFreshCampaign(gameState.campaign) ? [['Rebellion', `${Math.round(rebellionOf(gameState.campaign))} — ${rebellionLabel(rebellionOf(gameState.campaign))}`, rebellionOf(gameState.campaign) >= CAMPAIGN_ARC.restlessAt] as [string, React.ReactNode, boolean]] : []),
        ...(gameState.legacyTributeIds?.length ? [['Legacy tribute', gameState.tributes.filter(t => gameState.legacyTributeIds!.includes(t.id)).map(t => `${t.name} (D${t.district})`).join(', '), true] as [string, React.ReactNode, boolean]] : []),
    ];

    return (
        <div className="panel p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h3 className="panel-title">This year's Games</h3>
                <span className="font-mono text-micro text-[var(--color-ink-500)]">seed {gameState.seed}</span>
            </div>

            {profile?.quell && (
                <div className="panel-flush p-3 space-y-1" style={{ borderColor: 'var(--red)' }}>
                    <div className="eyebrow" style={{ color: 'var(--red)' }}>
                        Quarter Quell — {profile.quell.name}
                    </div>
                    <p className="text-label leading-relaxed text-[var(--color-ink-300)]">
                        {profile.quell.announcement}
                    </p>
                </div>
            )}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-label">
                {rows.map(([label, value, notable]) => (
                    <React.Fragment key={label}>
                        <dt className="eyebrow self-center">{label}</dt>
                        <dd className={`text-right ${notable ? 'text-[var(--red)] font-semibold' : 'text-[var(--color-ink-200)]'}`}>
                            {value}
                        </dd>
                    </React.Fragment>
                ))}
            </dl>
        </div>
    );
}
