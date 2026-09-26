import React from 'react';
import { GameConfig, GameState } from '../models/types';
import { gameActions, gameStore } from '../store/gameStore';
import { useStore } from '../store/createStore';
import { AUDIT12_WAVE3 } from '../data/balance';
import { ARENAS } from '../data/constants';
import { compatibleMutators, mutatorCap, mutatorName } from '../data/mutators';
import { weeklyArena } from '../data/replayHooks';
import { directorEffectLine } from '../engine/season/directorEffect';
import { directorTaste } from '../data/directors';
import { museumOf, victorTour } from '../engine/season/offSeason';
import { crueltyBand, crueltyOf } from '../engine/season/cruelty';

/**
 * AUDIT-12 wave 3: the side features' screens — the season panel on setup,
 * the debrief on the end screen (director effect, victor's tour,
 * apprenticeship choices), the museum on the Hall of Fame, and the cruelty
 * meter on the dossier. Every number comes from the engine modules; nothing
 * here computes a rule of its own.
 */

export function SetupSeasonPanel({ config, setConfig, onPickArena }: {
    config: GameConfig;
    setConfig: React.Dispatch<React.SetStateAction<GameConfig>>;
    onPickArena: (id: string) => void;
}) {
    const panem = useStore(gameStore, s => s.panem);
    const ledger = panem.ledger;
    const season = ledger?.season;
    const weekly = weeklyArena();
    const standings = Object.entries(season?.points ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const card = season?.mutator;
    const playingCard = !!card && (config.mutators ?? []).includes(card);
    return (
        <div className="panel-flush p-3 mt-2 text-micro text-[var(--color-ink-500)] space-y-1.5" data-testid="season-panel">
            <div className="text-xs font-bold text-[var(--ink)]">
                Season {season?.number ?? 1} &mdash; Games {Math.min((season?.played ?? 0) + 1, AUDIT12_WAVE3.season.length)} of {AUDIT12_WAVE3.season.length}
            </div>
            {standings.length > 0 && (
                <div>Standings: {standings.map(([d, p]) => `D${d} ${p}`).join(' · ')}{season?.champions?.[0] ? ` · last champion D${season.champions[0].district}` : ''}</div>
            )}
            <div className="flex flex-wrap items-center gap-2">
                {card ? (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                            type="checkbox"
                            data-testid="season-card"
                            className="w-3.5 h-3.5 accent-[var(--red)]"
                            checked={playingCard}
                            onChange={e => setConfig(c => {
                                const cur = (c.mutators ?? []).filter(m => m !== card);
                                const next = e.target.checked ? compatibleMutators([card, ...cur], mutatorCap(c)) : cur;
                                return { ...c, mutators: next.length > 0 ? next : undefined };
                            })}
                        />
                        This season&rsquo;s card: {mutatorName(card)}
                    </label>
                ) : <span>No season card yet — the first is drawn when this season closes.</span>}
                {season?.nextMutator && <span>· next season: {mutatorName(season.nextMutator)}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <span>This week&rsquo;s arena: <strong className="text-[var(--ink)]">{weekly.name}</strong>{weekly.thin ? ' (seldom seen)' : ''}</span>
                <button type="button" className="btn btn-sm btn-ghost" data-testid="weekly-arena" onClick={() => onPickArena(weekly.id)}>Play it</button>
            </div>
            {ledger?.predictionBank && (
                <div>Slip bankroll {ledger.predictionBank.bankroll} pts · best sharp streak {ledger.predictionBank.bestStreak} · upsets called {ledger.predictionBank.upsetsCalled}</div>
            )}
            {ledger?.gauntletBest && (
                <div>Best gauntlet: {ledger.gauntletBest.score} ({ledger.gauntletBest.mutators.map(mutatorName).join(' + ')})</div>
            )}
            {(ledger?.nemeses?.length ?? 0) > 0 && (
                <div>Nemeses at large: {ledger!.nemeses!.map(n => `${n.name} (D${n.district}, ${n.kills} kills)`).join('; ')}</div>
            )}
            {(ledger?.rivalries?.length ?? 0) > 0 && (
                <div>Blood between districts: {ledger!.rivalries!.slice(0, 3).map(r => `D${r.aDistrict}–D${r.bDistrict}`).join(', ')}</div>
            )}
        </div>
    );
}

export function EndSeasonPanel({ gameState }: { gameState: GameState }) {
    const panem = useStore(gameStore, s => s.panem);
    const offers = panem.ledger?.apprenticeOffers ?? {};
    const chosen = panem.ledger?.apprenticeships ?? {};
    const effect = directorEffectLine(gameState);
    const tours = victorTour(gameState);
    const taste = gameState.headGamemaker ? directorTaste(gameState.headGamemaker) : undefined;
    const fired = (gameState.season?.directorFired ?? []).filter(k => k.startsWith('dir:')).map(k => k.slice(4));
    const story = gameState.season?.story;
    const chain = story ? { title: story.chainId.replace(/^the-/, 'The ').replace(/-/g, ' ') } : undefined;
    return (
        <div className="panel p-4 space-y-3" data-testid="season-debrief">
            <h3 className="panel-title">The off-season</h3>
            {effect && taste && (
                <p className="text-xs" data-testid="director-effect">
                    {gameState.headGamemaker} ({taste.label}): <strong>{effect}</strong>
                    {fired.length > 0 ? ` · authored turns played: ${fired.join(', ')}` : ''}.
                </p>
            )}
            {chain && story && (
                <p className="text-xs">{chain.title}: {story.step} of {AUDIT12_WAVE3.story.steps} parts{story.step >= AUDIT12_WAVE3.story.steps ? ', told in full.' : '. The rest waits for the next Games here.'}</p>
            )}
            {tours.map(t => (
                <div key={t.victor} className="text-xs space-y-0.5" data-testid="victor-tour">
                    <div className="eyebrow">{t.victor}&rsquo;s victory tour</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                        {t.stops.map(s => <li key={s.district}>{s.line}</li>)}
                    </ul>
                </div>
            ))}
            {Object.keys(offers).length > 0 && (
                <div className="space-y-1" data-testid="apprenticeships">
                    <div className="eyebrow">Apprenticeships for next year</div>
                    <p className="text-micro text-[var(--color-ink-500)]">Choose what each district&rsquo;s next tribute is taught before the reaping. It is used once.</p>
                    <div className="grid sm:grid-cols-2 gap-1.5">
                        {Object.entries(offers).sort((a, b) => Number(a[0]) - Number(b[0])).map(([d, o]) => (
                            <label key={d} className="flex items-center gap-2 text-micro">
                                <span className="w-24 flex-none">District {d}</span>
                                <select
                                    className="field text-xs flex-1"
                                    aria-label={`Apprenticeship for District ${d}`}
                                    value={chosen[Number(d)]?.skill ?? ''}
                                    onChange={e => gameActions.chooseApprenticeship(Number(d), e.target.value || null)}
                                >
                                    <option value="">— none</option>
                                    {o.skills.map(k => <option key={k} value={k}>{k} (from {o.teacher})</option>)}
                                </select>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function MuseumPanel() {
    const ledger = useStore(gameStore, s => s.panem.ledger);
    const rooms = museumOf(ledger);
    if (rooms.length === 0) return null;
    const nameOf = (key: string) => ARENAS.find(a => a.name === key || a.id === key)?.name ?? key;
    return (
        <div className="panel p-4 space-y-2" data-testid="arena-museum">
            <h3 className="panel-title">The arena museum</h3>
            <p className="text-micro text-[var(--color-ink-500)]">Every arena you have run, what it took, and who it crowned.</p>
            <div className="grid sm:grid-cols-2 gap-2">
                {rooms.slice(0, 24).map(r => (
                    <div key={r.arena} className="panel-flush p-2.5 text-micro space-y-0.5">
                        <div className="text-xs font-bold text-[var(--ink)]">{nameOf(r.arena)}</div>
                        {r.mastery && (
                            <div>{r.mastery.runs} Games · {r.mastery.crowns} crowned · longest {r.mastery.longest} days{r.mastery.victors.length ? ` · ${r.mastery.victors.join(', ')}` : ''}</div>
                        )}
                        {r.pieces.map((p, i) => <div key={i} className="text-[var(--color-ink-500)]">{p.name} (D{p.district}), day {p.day}: {p.cause}</div>)}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function CrueltyMeter({ gameState }: { gameState: GameState }) {
    const value = crueltyOf(gameState);
    const band = crueltyBand(value);
    const recent = (gameState.season?.crueltyLog ?? []).slice(-3).reverse();
    return (
        <div className="panel-flush p-2.5 text-micro space-y-1" data-testid="cruelty-meter" role="group" aria-label={`Gamemaker cruelty ${Math.round(value)} of 100, ${band}`}>
            <div className="flex justify-between">
                <span className="eyebrow">Gamemaker cruelty</span>
                <span className="font-mono">{Math.round(value)}/100 · {band}</span>
            </div>
            <div className="h-1.5 border border-[var(--line)]">
                <div style={{ width: `${Math.min(100, value)}%`, height: '100%', background: value >= AUDIT12_WAVE3.cruelty.guardAt ? 'var(--red)' : 'var(--ink)' }} />
            </div>
            <div className="text-[var(--color-ink-500)]">
                {value >= AUDIT12_WAVE3.cruelty.guardAt
                    ? 'The fairness guard is holding: no authored intervention until the booth cools.'
                    : recent.length > 0 ? `Last: ${recent.map(r => r.why).join('; ')}` : 'The booth has kept its hands still.'}
            </div>
        </div>
    );
}
