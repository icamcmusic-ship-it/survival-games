import React from 'react';
import { GameState } from '../models/types';
import { ordinal } from '../engine/gamesProfile';

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
    ];

    return (
        <div className="panel p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h3 className="panel-title">This year's Games</h3>
                <span className="font-mono text-[10px] text-[var(--color-ink-500)]">seed {gameState.seed}</span>
            </div>

            {profile?.quell && (
                <div className="panel-flush p-3 space-y-1" style={{ borderColor: 'var(--red)' }}>
                    <div className="eyebrow" style={{ color: 'var(--red)' }}>
                        Quarter Quell — {profile.quell.name}
                    </div>
                    <p className="text-[13px] leading-relaxed text-[var(--color-ink-300)]">
                        {profile.quell.announcement}
                    </p>
                </div>
            )}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
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
