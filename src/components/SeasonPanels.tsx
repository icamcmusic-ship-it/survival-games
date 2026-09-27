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
import { AUDIT13_SIDE } from '../data/balance';
import { dailySeed, weeklyRules } from '../data/replayHooks';
import { COMMENTATORS, SCENARIO_CARDS, scenarioCard } from '../data/replayCards';
import { chapterChipFor, masteryFor, masteryTier } from '../engine/season/surfaced';
import { driftedTier, legacySteps, scoreDraft } from '../engine/season/replayability';
import { dailyStreakOf } from '../utils/panemStorage';
import { legacyOf } from '../data/districts';

/**
 * AUDIT-12 wave 3: the side features' screens — the season panel on setup,
 * the debrief on the end screen (director effect, victor's tour,
 * apprenticeship choices), the museum on the Hall of Fame, and the cruelty
 * meter on the dossier. Every number comes from the engine modules; nothing
 * here computes a rule of its own.
 */

export function SetupSeasonPanel({ config, setConfig, onPickArena, arenaId, onPlayRules }: {
    config: GameConfig;
    setConfig: React.Dispatch<React.SetStateAction<GameConfig>>;
    onPickArena: (id: string) => void;
    /** AUDIT-13: the arena picked, for its scars; and a way to load a whole rules card (seed, arena, config). */
    arenaId?: string;
    onPlayRules?: (seed: string, arenaId: string, config: GameConfig) => void;
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
            <SetupReplayRows config={config} setConfig={setConfig} arenaId={arenaId} onPlayRules={onPlayRules} />
        </div>
    );
}

/**
 * AUDIT-13 §11 S5/S7 and §12 P1/P3/P4/P5/P6/P7/P8: the season panel's second
 * half — the daily's streak and history, the season bankroll, this week's
 * rules, scenario cards, the commentator, the victor-return Quell, legacy
 * drift, the best draft, and the picked arena's scars.
 */
function SetupReplayRows({ config, setConfig, arenaId, onPlayRules }: {
    config: GameConfig;
    setConfig: React.Dispatch<React.SetStateAction<GameConfig>>;
    arenaId?: string;
    onPlayRules?: (seed: string, arenaId: string, config: GameConfig) => void;
}) {
    const ledger = useStore(gameStore, s => s.panem.ledger);
    const victorReturn = useStore(gameStore, s => s.victorReturnQuell);
    const [copied, setCopied] = React.useState(false);
    const history = ledger?.dailyHistory ?? [];
    const streak = dailyStreakOf(history);
    const today = dailySeed();
    const weekly = weeklyRules();
    const bank = ledger?.seasonBank;
    const board = ledger?.seasonBoard ?? [];
    const drift = Object.entries(ledger?.legacyDrift ?? {})
        .filter(([, v]) => legacySteps(v) !== 0)
        .map(([d, v]) => ({ d: Number(d), v }));
    const scars = arenaId ? ledger?.arenaScars?.[arenaId] ?? [] : [];
    const card = scenarioCard(config.scenario);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(today);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };
    return (
        <div className="space-y-1.5 pt-1.5 border-t border-[var(--line)]" data-testid="season-replay">
            <div className="flex flex-wrap items-center gap-2" data-testid="daily-history">
                <span>Daily streak: <strong className="text-[var(--ink)]">{streak}</strong> day{streak === 1 ? '' : 's'}</span>
                {history.slice(0, 5).map(d => (
                    <span key={d.date} className="chip" role="group" aria-label={`Daily ${d.date}`} title={d.seed}>
                        {d.date.slice(5)} · {d.victorName ? `${d.victorName} (D${d.victorDistrict})` : 'no victor'}
                        {d.pickRight === undefined ? '' : d.pickRight ? ' · called it' : ' · missed'}
                    </span>
                ))}
                <button type="button" className="btn btn-sm btn-ghost" onClick={copy} aria-label="Copy today's daily seed">
                    {copied ? 'Copied' : `Share code: ${today}`}
                </button>
            </div>
            {(bank || board.length > 0) && (
                <div data-testid="season-bankroll">
                    {bank && <>Season {bank.number} bankroll: bought in for {bank.buyIn}, {bank.net >= 0 ? '+' : ''}{bank.net} over {bank.games} Games. </>}
                    {board.length > 0 && <>Best seasons: {board.slice(0, 3).map(r => `S${r.number} ${r.net >= 0 ? '+' : ''}${r.net}`).join(' · ')}</>}
                </div>
            )}
            <div className="flex flex-wrap items-center gap-2" data-testid="weekly-rules">
                <span>This week&rsquo;s rules: {weekly.arenaName} with {weekly.mutators.map(mutatorName).join(' + ') || 'no cards'}
                    {ledger?.weeklyBest?.key === weekly.key ? ` · your best slip ${ledger.weeklyBest.score}/${ledger.weeklyBest.max}` : ''}</span>
                {onPlayRules && (
                    <button type="button" className="btn btn-sm btn-ghost"
                        onClick={() => onPlayRules(weekly.seed, weekly.arenaId, { ...config, mutators: weekly.mutators, gauntlet: undefined })}>
                        Play the weekly
                    </button>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5">
                    Scenario
                    <select className="field text-xs w-auto" data-testid="scenario-card" value={config.scenario ?? ''}
                        onChange={e => setConfig(c => ({ ...c, scenario: e.target.value || undefined }))}>
                        <option value="">none</option>
                        {/* AUDIT-14 S9: a card that cannot be what it says with this many districts is offered, but disabled. */}
                        {SCENARIO_CARDS.map(c => {
                            const tooFew = (c.minDistricts ?? 0) > config.districtCount;
                            return (
                                <option key={c.id} value={c.id} disabled={tooFew}>
                                    {c.name}{ledger?.scenariosWon?.includes(c.id) ? ' (won)' : ''}{tooFew ? ` (needs ${c.minDistricts}+ districts)` : ''}
                                </option>
                            );
                        })}
                    </select>
                </label>
                <label className="flex items-center gap-1.5">
                    Commentary
                    <select className="field text-xs w-auto" data-testid="commentator" value={config.commentator ?? 'classic'}
                        onChange={e => setConfig(c => ({ ...c, commentator: e.target.value === 'classic' ? undefined : e.target.value }))}>
                        {COMMENTATORS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer" aria-label="Victor-return Quell" title="Your own most recent Hall of Fame victors are reaped again, traits and all. For the next Games only.">
                    <input type="checkbox" className="w-3.5 h-3.5 accent-[var(--red)]" data-testid="victor-return"
                        checked={victorReturn} onChange={e => gameActions.setVictorReturnQuell(e.target.checked)} />
                    Victor-return Quell
                </label>
            </div>
            {card && <div>{card.blurb}</div>}
            {drift.length > 0 && (
                <div data-testid="legacy-drift">Legacy drift: {drift.map(({ d, v }) => `D${d} ${legacyOf(d).tier} to ${driftedTier(d, ledger?.legacyDrift)} (${v > 0 ? 'rising' : 'falling'})`).join(' · ')}</div>
            )}
            {ledger?.draftBest && <div>Best draft: {ledger.draftBest.score}/{ledger.draftBest.max} over {ledger.draftsPlayed ?? 1} draft{(ledger.draftsPlayed ?? 1) === 1 ? '' : 's'}.</div>}
            {scars.length > 0 && (
                <div data-testid="arena-scars">This arena is scarred: {scars.map(sc => `${sc.zone} (${sc.kind === 'wipeout' ? 'nobody came out' : 'the Gamemakers reached in'}, Games ${sc.run})`).join('; ')}.</div>
            )}
        </div>
    );
}

/** AUDIT-13 S3: bronze, silver or gold for an arena on the setup picker. */
export function ArenaMasteryBadge({ arenaId, arenaName }: { arenaId: string; arenaName: string }) {
    const ledger = useStore(gameStore, s => s.panem.ledger);
    const m = masteryFor(ledger, arenaId, arenaName);
    const tier = masteryTier(m);
    if (!tier || !m) return null;
    const colour = tier === 'gold' ? 'var(--gold)' : tier === 'silver' ? 'var(--color-ink-400)' : 'var(--color-ink-500)';
    return (
        <span className="flex-none font-mono text-nano font-extrabold uppercase tracking-wider px-1 border" style={{ color: colour, borderColor: colour }}
            role="group" aria-label={`${tier} mastery`} title={`${m.runs} Games here, ${m.crowns} crowned. Gold at ${AUDIT13_SIDE.masteryTiers[2]}.`} data-testid="mastery-tier">
            {tier}
        </span>
    );
}

/** AUDIT-13 S1: "Chapter n/N" for the arena's story chain. */
export function ChapterChip({ arenaId, arenaName }: { arenaId: string; arenaName: string }) {
    const chains = useStore(gameStore, s => s.panem.ledger?.storyChains);
    const chip = chapterChipFor(chains, arenaId, arenaName);
    return (
        <div className="text-micro mt-1 font-mono text-[var(--chrome-muted)]" data-testid="story-chapter">
            {chip.chain.title}: chapter {chip.chapter}/{chip.of}{chip.completed > 0 ? ` · ${chip.completed} told in full here` : ''}
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
    const chain = story ? chapterChipFor({ x: { chainId: story.chainId, step: 1, run: 0, completed: 0 } }, 'x').chain : undefined;
    const draft = scoreDraft(gameState);
    const pieces = useStore(gameStore, s => s.panem.ledger?.museum?.[gameState.arena.mapId ?? gameState.arena.name]?.length ?? 0);
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
            {/* AUDIT-13 H5: the tour and the museum, reachable from the Games that made them. */}
            <div className="flex flex-wrap gap-2 text-micro" data-testid="offseason-links">
                {tours.length > 0 && <a className="btn btn-sm btn-ghost" href="#victor-tour">See the tour</a>}
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => gameActions.setView('hallOfFame')}>
                    Open the museum{pieces > 0 ? ` (${pieces} piece${pieces === 1 ? '' : 's'} from this arena)` : ''}
                </button>
            </div>
            {draft && (
                <p className="text-xs" data-testid="draft-score">
                    Your draft scored <strong>{draft.score}/{draft.max}</strong>: {draft.picks.map(p => `${p.name} ${p.place > 0 ? `#${p.place}` : ''} (+${p.points})`).join(', ')}.
                </p>
            )}
            {tours.map((t, i) => (
                <div key={t.victor} id={i === 0 ? 'victor-tour' : undefined} className="text-xs space-y-0.5" data-testid="victor-tour">
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
        <div className="panel p-4 space-y-2" id="arena-museum" data-testid="arena-museum">
            <h3 className="panel-title">The arena museum</h3>
            <p className="text-micro text-[var(--color-ink-500)]">Every arena you have run, what it took, and who it crowned.</p>
            <div className="grid sm:grid-cols-2 gap-2">
                {rooms.slice(0, 24).map(r => (
                    <div key={r.arena} className="panel-flush p-2.5 text-micro space-y-0.5">
                        <div className="text-xs font-bold text-[var(--ink)]">{nameOf(r.arena)}</div>
                        {r.mastery && (
                            <div>{r.mastery.runs} Games · {r.mastery.crowns} crowned · longest {r.mastery.longest} days{r.mastery.victors.length ? ` · ${r.mastery.victors.join(', ')}` : ''}</div>
                        )}
                        {r.pieces.map((p, i) => <div key={i} className="text-[var(--color-ink-500)]">
                            {p.code === 'story-chain' ? `${p.cause} (Games ${p.run})` : `${p.name} (D${p.district}), day ${p.day}: ${p.cause}`}
                        </div>)}
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
