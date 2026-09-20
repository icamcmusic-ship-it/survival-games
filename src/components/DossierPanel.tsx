import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Hint } from './Hint';
import { GameState, Tribute } from '../models/types';
import {
    Brain, Heart, MapPin, Settings, Skull, Star, Swords, TrendingDown, TrendingUp, Minus, Users,
} from 'lucide-react';
import { ESCALATION, GAMEMAKER_COSTS } from '../data/balance';
import { gamemakerCooldownRemaining, gamemakerEventCost } from '../engine/gamemaker';
import { GamemakerEventType } from '../engine/gamemaker';
import { objectiveLabel } from '../engine/objectives';
import { oddsFactors, tributeOdds } from '../engine/odds';
import { ordinal } from '../engine/gamesProfile';
import { Explainer } from './Explainer';
import { OddsSparkline } from './OddsSparkline';
import { chronicleStore, setChronicle, toggleSection } from '../store/chronicleStore';
import { prefsStore } from '../store/prefsStore';
import { gameActions, gameStore } from '../store/gameStore';
import { useStore } from '../store/createStore';
import { SPONSOR_BLOCS } from '../engine/sponsorBlocs';
import { arenaFlavor } from '../data/arenaFlavor';
import { Glossed } from './Glossed';

/**
 * A6: five accordion sections instead of three panes behind a segmented
 * control.
 *
 * The sidebar used to carry the run status, the odds ladder, the Gamemaker
 * booth and the full tribute list stacked into one scrolling column, with a
 * mobile-only three-way segmented control on top — one of four segmented
 * controls competing on the same screen. All five sections are now reachable
 * at once, open/closed is per-section, and which ones are open persists.
 */
function Section({ id, title, children, defaultOpen = false, accent }: {
    id: string;
    title: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
    accent?: string;
}) {
    const open = useStore(chronicleStore, s => s.openSections.includes(id) || (defaultOpen && s.openSections.length === 0));
    return (
        <section className="panel" style={accent ? { borderColor: accent, borderWidth: 3 } : undefined}>
            <h3>
                <button
                    className="w-full flex items-center justify-between gap-2 p-3 text-left"
                    aria-expanded={open}
                    onClick={() => toggleSection(id)}
                >
                    <span className="panel-title" style={accent ? { color: accent } : undefined}>{title}</span>
                    <span aria-hidden="true" className="font-mono text-[var(--color-ink-500)]">{open ? '▾' : '▸'}</span>
                </button>
            </h3>
            {open && <div className="px-3 pb-3">{children}</div>}
        </section>
    );
}

export function DossierPanel({
    gameState,
    isOver,
    arenaSealed,
    onSelectTribute,
    allianceAccent,
    oddsLadder,
    oddsMovement,
    onGamemakerEvent,
}: {
    gameState: GameState;
    isOver: boolean;
    arenaSealed: boolean;
    onSelectTribute: (id: string) => void;
    allianceAccent: (allianceId?: string) => string | undefined;
    oddsLadder: Array<{ tribute: Tribute; pct: number; mult: number }>;
    oddsMovement: Record<string, number>;
    onGamemakerEvent: (type: GamemakerEventType, targetId?: string) => void;
}) {
    const followedId = useStore(chronicleStore, s => s.followedId);
    const spoilerSafe = useStore(prefsStore, p => p.spoilerSafe);
    const coins = useStore(gameStore, s => s.coins);
    const bets = useStore(gameStore, s => s.bets);
    const [oddsExpanded, setOddsExpanded] = useState(false);

    /**
     * §2.4: what just changed.
     *
     * After Proceed the tribute list's numbers jump with nothing saying which
     * of them moved. Health deltas are held for one cycle beside the number
     * that moved, which is where a reader is already looking.
     */
    const prevHealth = useRef<Record<string, number>>({});
    const [healthDelta, setHealthDelta] = useState<Record<string, number>>({});
    // §2.2: the tile showed current state, and the interesting thing about a
    // tribute mid-run is the derivative — a tribute at 60 health who was at 90
    // an hour ago is a different story from one who has climbed there. Health
    // already had this; sanity and the odds line did not, and both move for
    // reasons a viewer wants to go and look up.
    const prevSanity = useRef<Record<string, number>>({});
    const [sanityDelta, setSanityDelta] = useState<Record<string, number>>({});
    const prevOdds = useRef<Record<string, number>>({});
    const [oddsDelta, setOddsDelta] = useState<Record<string, number>>({});
    useEffect(() => {
        const deltas: Record<string, number> = {};
        const sanity: Record<string, number> = {};
        const odds: Record<string, number> = {};
        const board = gameState.tributes.filter(o => o.status === 'alive');
        gameState.tributes.forEach(t => {
            const before = prevHealth.current[t.id];
            const now = t.status === 'alive' ? t.health : 0;
            if (before !== undefined && before !== now) deltas[t.id] = now - before;
            prevHealth.current[t.id] = now;

            const sanityNow = t.status === 'alive' ? Math.round(t.vitals.sanity) : 0;
            const sanityBefore = prevSanity.current[t.id];
            if (sanityBefore !== undefined && sanityBefore !== sanityNow) sanity[t.id] = sanityNow - sanityBefore;
            prevSanity.current[t.id] = sanityNow;

            const oddsNow = t.status === 'alive' ? tributeOdds(t, board).pct : 0;
            const oddsBefore = prevOdds.current[t.id];
            if (oddsBefore !== undefined && Math.abs(oddsBefore - oddsNow) >= 1) odds[t.id] = oddsNow - oddsBefore;
            prevOdds.current[t.id] = oddsNow;
        });
        if (Object.keys(sanity).length > 0) setSanityDelta(sanity);
        if (Object.keys(odds).length > 0) setOddsDelta(odds);
        if (Object.keys(deltas).length > 0) setHealthDelta(deltas);
        // Recomputed at phase boundaries, not on every render, so the deltas
        // describe the cycle just played rather than flickering to zero.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState.phase, gameState.day]);
    const [muttTargetId, setMuttTargetId] = useState('');
    const [gmZone, setGmZone] = useState('');

    const aliveCount = gameState.tributes.filter(t => t.status === 'alive').length;
    const deadCount = gameState.tributes.length - aliveCount;

    /**
     * What a lever costs *now*, and whether it can be pulled at all.
     *
     * These buttons used to price and disable off the flat `GAMEMAKER_COSTS`
     * base, while `GameScreen` charges the escalated price and refuses a lever
     * on cooldown — so a button could sit enabled, take a click, and do nothing
     * whatsoever, with no coins spent and nothing said. Both the price on the
     * face of the button and its disabled state are read from the same two
     * functions the spend path uses.
     */
    /**
     * Audit 4 §2.7: how many of this arena's once-only events have fired.
     *
     * `state.firedEvents` has held exactly this all along and no component read
     * it. Computed the same way `every-door` tests it, so the counter and the
     * achievement cannot disagree.
     */
    const onceOnly = (() => {
        const ids = arenaFlavor(gameState.arena.id, gameState.arena).events
            .filter(e => e.oncePerRun && e.id)
            .map(e => e.id as string);
        const fired = new Set(gameState.firedEvents ?? []);
        return { total: ids.length, fired: ids.filter(id => fired.has(id)).length };
    })();

    const priceOf = (type: GamemakerEventType, base: number) => gamemakerEventCost(gameState, type, base);
    const cooldownOf = (type: GamemakerEventType) => gamemakerCooldownRemaining(gameState, type);
    const leverState = (type: GamemakerEventType, base: number, tip: string) => {
        const cost = priceOf(type, base);
        const cooling = cooldownOf(type);
        return {
            cost,
            disabled: coins < cost || cooling > 0,
            title: cooling > 0
                ? `${tip} — the booth needs ${cooling} more cycle${cooling === 1 ? '' : 's'} before this lever resets.`
                : coins < cost
                    ? `${tip} — costs ${cost} coins and you have ${coins}.`
                    : `${tip} (${cost} coins)`,
        };
    };

    const spendGamemaker = (type: GamemakerEventType, targetId?: string) => {
        onGamemakerEvent(type, targetId);
    };

    const sorted = useMemo(() => [...gameState.tributes].sort((a, b) => {
        if (a.id === followedId && a.status === 'alive') return -1;
        if (b.id === followedId && b.status === 'alive') return 1;
        if (a.status !== b.status) return a.status === 'alive' ? -1 : 1;
        if (a.status === 'alive') {
            if (a.allianceId && !b.allianceId) return -1;
            if (!a.allianceId && b.allianceId) return 1;
            if (a.allianceId && b.allianceId && a.allianceId !== b.allianceId) {
                return a.allianceId.localeCompare(b.allianceId);
            }
        }
        if (a.district !== b.district) return a.district - b.district;
        return a.gender.localeCompare(b.gender);
    }), [gameState.tributes, followedId]);

    return (
        <div className="space-y-3">
            {/* ---------- tributes (default open) ---------- */}
            <Section id="tributes" title={`Tributes · ${aliveCount}`} defaultOpen>
                {!isOver && (
                    <p className="text-micro text-[var(--color-ink-500)] mb-2">
                        Open any living tribute to send a sponsor parachute. The star pins them: the feed
                        foregrounds their story and the playback brakes can stop on their events.
                    </p>
                )}
                <div className="space-y-1.5 max-h-[60vh] md:max-h-[520px] overflow-y-auto pr-1.5 custom-scrollbar">
                    {sorted.map(t => {
                        const dead = t.status === 'dead';
                        const accent = dead ? undefined : allianceAccent(t.allianceId);
                        return (
                            <div
                                key={t.id}
                                className={`panel-flush p-2.5 flex flex-col gap-2 ${dead ? 'opacity-50' : ''}`}
                                style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <button
                                        onClick={() => onSelectTribute(t.id)}
                                        className="min-w-0 text-left flex-1"
                                        aria-label={dead ? `${t.name} — deceased` : `${t.name} — open profile`}
                                    >
                                        <span className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`font-bold text-sm truncate ${dead ? 'line-through text-[var(--color-ink-500)]' : 'text-[var(--color-ink-100)]'}`}>
                                                {t.name}
                                            </span>
                                            <span className="chip" role="group" aria-label={`District ${t.district} · ${t.gender} · age ${t.age}`} title={`District ${t.district} · ${t.gender} · age ${t.age}`}>
                                                D{t.district}·{t.gender === 'Male' ? 'M' : 'F'}
                                            </span>
                                            {!dead && t.allianceId && (
                                                <span className="chip" style={accent ? { color: accent, borderColor: accent } : undefined}>
                                                    <Users className="w-2.5 h-2.5" /> Pack
                                                </span>
                                            )}
                                            {!dead && !isOver && (t.injuries.bleeding || t.vitals.thirst > 70 || !t.inventory.some(i => i.type === 'weapon')) && (
                                                <span
                                                    className="chip"
                                                    style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                                                    role="group" aria-label={`${t.name} ${t.injuries.bleeding ? 'is bleeding' : t.vitals.thirst > 70 ? 'is badly dehydrated' : 'is unarmed'} — a sponsor parachute would fix this.`} title={`${t.name} ${t.injuries.bleeding ? 'is bleeding' : t.vitals.thirst > 70 ? 'is badly dehydrated' : 'is unarmed'} — a sponsor parachute would fix this.`}
                                                >
                                                    🪂 Needs aid
                                                </span>
                                            )}
                                        </span>
                                        <span className="block text-micro uppercase tracking-wider text-[var(--color-ink-500)] flex flex-wrap gap-2 mt-1">
                                            {dead ? (
                                                <span className="truncate">Day {t.dayOfDeath ?? '—'} · {t.causeOfDeath ?? 'Eliminated'}</span>
                                            ) : (
                                                <>
                                                    <span className="flex items-center gap-1">
                                                        <Heart className="w-3 h-3 text-[var(--cat-death)]" /> {t.health}
                                                        {!!healthDelta[t.id] && (
                                                            <span
                                                                className="font-bold"
                                                                style={{ color: healthDelta[t.id] > 0 ? 'var(--cat-alliance)' : 'var(--cat-death)' }}
                                                                role="group" aria-label={`${healthDelta[t.id] > 0 ? 'Recovered' : 'Lost'} ${Math.abs(healthDelta[t.id])} health last cycle`} title={`${healthDelta[t.id] > 0 ? 'Recovered' : 'Lost'} ${Math.abs(healthDelta[t.id])} health last cycle`}
                                                            >
                                                                {healthDelta[t.id] > 0 ? '↑' : '↓'}{Math.abs(healthDelta[t.id])}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="flex items-center gap-1"><Swords className="w-3 h-3" /> {t.kills}</span>
                                                    {/* §2.2: sanity and the odds line, with the
                                                        direction they moved in last cycle. */}
                                                    <span className="flex items-center gap-1" role="group" aria-label={`Sanity ${Math.round(t.vitals.sanity)}`} title={`Sanity ${Math.round(t.vitals.sanity)}`}>
                                                        <Brain className="w-3 h-3 text-[var(--cat-sanity)]" /> {Math.round(t.vitals.sanity)}
                                                        {!!sanityDelta[t.id] && (
                                                            <span
                                                                className="font-bold"
                                                                style={{ color: sanityDelta[t.id] > 0 ? 'var(--cat-alliance)' : 'var(--cat-death)' }}
                                                                role="group" aria-label={`${sanityDelta[t.id] > 0 ? 'Steadied' : 'Frayed'} ${Math.abs(sanityDelta[t.id])} last cycle`} title={`${sanityDelta[t.id] > 0 ? 'Steadied' : 'Frayed'} ${Math.abs(sanityDelta[t.id])} last cycle`}
                                                            >
                                                                {sanityDelta[t.id] > 0 ? '↑' : '↓'}{Math.abs(sanityDelta[t.id])}
                                                            </span>
                                                        )}
                                                    </span>
                                                    {!!oddsDelta[t.id] && (
                                                        <span
                                                            className="flex items-center gap-1 font-bold"
                                                            style={{ color: oddsDelta[t.id] > 0 ? 'var(--cat-alliance)' : 'var(--cat-death)' }}
                                                            role="group" aria-label={`The book moved ${oddsDelta[t.id] > 0 ? 'toward' : 'away from'} ${t.name} last cycle`} title={`The book moved ${oddsDelta[t.id] > 0 ? 'toward' : 'away from'} ${t.name} last cycle`}
                                                        >
                                                            {oddsDelta[t.id] > 0 ? '▲' : '▼'}{Math.abs(oddsDelta[t.id])}%
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 text-[var(--cat-travel)]" /> {arenaSealed ? '❓' : t.zone}</span>
                                                    {/* §2.2: intentions, not coordinates — and
                                                        `objectiveTension.margin` is a free tension
                                                        indicator the tile never surfaced. */}
                                                    <span className="w-full truncate text-[var(--red)]">
                                                        {objectiveLabel(gameState, t)}
                                                        {t.objectiveTension && (
                                                            <span
                                                                className="ml-1 font-bold not-italic"
                                                                style={{ color: 'var(--cat-sanity)' }}
                                                                role="group"
                                                                aria-label={`Torn — they nearly ${objectiveLabel(gameState, { ...t, objective: t.objectiveTension.runnerUp }).toLowerCase()} instead`}
                                                            >
                                                                ⟂ torn
                                                            </span>
                                                        )}
                                                    </span>
                                                </>
                                            )}
                                        </span>
                                    </button>
                                    <div className="flex-none flex items-center gap-1">
                                        {/* A6: following is chosen from the tribute list, which is
                                            where a reader is already looking at tributes. */}
                                        {!dead && (
                                            <button
                                                aria-pressed={followedId === t.id}
                                                aria-label={followedId === t.id ? `Stop following ${t.name}` : `Follow ${t.name}`}
                                                onClick={() => setChronicle({ followedId: followedId === t.id ? null : t.id })}
                                            >
                                                <Star className={`w-3.5 h-3.5 ${followedId === t.id ? 'text-[var(--red)] fill-[var(--red)]' : 'text-[var(--color-ink-600)]'}`} />
                                            </button>
                                        )}
                                        {dead && <Skull className="w-4 h-4 text-[var(--color-ink-600)]" />}
                                    </div>
                                </div>
                                {!dead && (
                                    <div className="meter">
                                        <span
                                            style={{
                                                width: `${t.health}%`,
                                                background: t.health >= 70 ? 'var(--cat-alliance)' : t.health >= 35 ? 'var(--cat-training)' : 'var(--cat-death)',
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Section>

            {/* ---------- odds board ---------- */}
            {/* §2.5: the odds board is the other half of the spoiler problem.
                A viewer watching a shared seed for the first time can read the
                ending off a ladder that has one tribute at 62% — so while
                spoiler-safe viewing is on, it waits for the epilogue like
                everything else. */}
            {spoilerSafe && !isOver && oddsLadder.length > 1 && (
                <Section id="odds" title="Odds board">
                    <p className="text-xs text-[var(--color-ink-500)]">
                        Hidden while spoiler-safe viewing is on. The board gives the shape of the ending away
                        long before the arena does; it comes back at the epilogue.
                    </p>
                </Section>
            )}
            {!spoilerSafe && !isOver && oddsLadder.length > 1 && (
                <Section id="odds" title="Odds board">
                    {/* The Explainer is a button, so it cannot live inside the
                        accordion's own header button — it sits at the top of the
                        panel body instead, where it is still the first thing a
                        reader meets. */}
                    <p className="mb-2">
                        <Explainer align="left" label={<span className="chip">why these numbers?</span>} title="How the odds are made">
                            Each tribute's number is a share of the living field's combined score:
                            raw strength and agility, the training score, how the bookmakers read
                            their traits, then live form — kills, health, an alliance at their back,
                            open wounds, and days survived against expectation. The sparkline is that
                            tribute's line over the whole run so far.
                        </Explainer>
                    </p>
                    <div className="space-y-1 max-h-72 overflow-y-auto pr-1.5 custom-scrollbar">
                        {(oddsExpanded ? oddsLadder : oddsLadder.slice(0, 10)).map(({ tribute, pct, mult }, i) => {
                            const move = oddsMovement[tribute.id] ?? 0;
                            const MoveIcon = move > 0 ? TrendingUp : move < 0 ? TrendingDown : Minus;
                            const moveColor = move > 0 ? 'var(--cat-alliance)' : move < 0 ? 'var(--cat-death)' : 'var(--color-ink-500)';
                            return (
                                <button
                                    key={tribute.id}
                                    onClick={() => onSelectTribute(tribute.id)}
                                    className="w-full text-left flex items-center gap-2 px-1.5 py-1 hover:bg-[var(--paper-flush)] transition-colors"
                                    aria-label={`${tribute.name} — ${pct}% survival chance, ${mult.toFixed(1)}× payout. ${oddsFactors(tribute).slice(0, 3).map(f => `${f.delta > 0 ? '+' : ''}${Math.round(f.delta)} ${f.label}`).join(', ')}`}
                                >
                                    <span className="font-mono text-micro text-[var(--color-ink-500)] w-4 flex-none">{i + 1}</span>
                                    <span className="text-xs font-bold text-[var(--color-ink-100)] truncate flex-1 min-w-0">
                                        {tribute.name}
                                        {bets[tribute.id] && <span className="ml-1 text-[var(--red)]" role="group" aria-label="Your wager" title="Your wager">●</span>}
                                    </span>
                                    {/* §2.8: `oddsHistory` was stored every day and never once drawn. */}
                                    <OddsSparkline history={gameState.oddsHistory} tributeId={tribute.id} />
                                    <span className="font-mono text-mini font-bold text-[var(--ink)] flex-none">{pct}%</span>
                                    <span className="flex items-center gap-0.5 font-mono text-micro flex-none w-10 justify-end" style={{ color: moveColor }}>
                                        <MoveIcon className="w-3 h-3" />
                                        {move !== 0 && (move > 0 ? `+${move}` : move)}
                                    </span>
                                </button>
                            );
                        })}
                        {oddsLadder.length > 10 && (
                            <button onClick={() => setOddsExpanded(v => !v)} className="btn btn-sm btn-ghost w-full justify-center">
                                {oddsExpanded ? 'Show top 10' : `Show all ${oddsLadder.length}`}
                            </button>
                        )}
                    </div>
                </Section>
            )}

            {/* ---------- gamemaker booth ---------- */}
            {gameState.gamemakerMode && !isOver && (
                <Section
                    id="gamemaker"
                    accent="var(--red)"
                    title={<span className="flex items-center gap-2"><Settings className="w-3.5 h-3.5" /> Gamemaker booth</span>}
                >
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="eyebrow" htmlFor="mutt-target">Mutt target</label>
                            <select id="mutt-target" value={muttTargetId} onChange={e => setMuttTargetId(e.target.value)} className="field text-xs">
                                <option value="">Random tribute</option>
                                {gameState.tributes.filter(t => t.status === 'alive').map(t => (
                                    <option key={t.id} value={t.id}>{t.name} (D{t.district})</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={() => { onGamemakerEvent('mutt', muttTargetId || undefined); setMuttTargetId(''); }} className="btn w-full">
                            <Skull className="w-4 h-4 text-[var(--red)]" /> Release mutts
                        </button>
                        <button onClick={() => onGamemakerEvent('weather')} className="btn w-full">Force weather event</button>
                        <button
                            onClick={() => onGamemakerEvent('feast')}
                            className="btn w-full"
                            disabled={!gameState.config.enableFeast}
                            aria-label={gameState.config.enableFeast
                                ? 'Announce feast — call a feast at the Cornucopia'
                                : "Announce feast — feasts are disabled in this run's settings"}
                        >
                            Announce feast
                        </button>

                        <div className="border-t border-[var(--color-ink-800)] pt-3 space-y-2">
                            <div className="flex items-baseline justify-between">
                                <span className="eyebrow">Arena controls</span>
                                <span className="font-mono text-mini text-[var(--color-ink-500)]">{coins} coins</span>
                            </div>
                            <div className="space-y-1">
                                <label className="eyebrow" htmlFor="gm-zone">Target zone</label>
                                <select
                                    id="gm-zone"
                                    value={gmZone}
                                    onChange={e => setGmZone(e.target.value)}
                                    className="field text-xs"
                                    disabled={arenaSealed}
                                >
                                    <option value="">Random zone</option>
                                    {!arenaSealed && gameState.arena.zones
                                        .filter(z => !(gameState.collapsedZones ?? []).includes(z.name))
                                        .map(z => <option key={z.name} value={z.name}>{z.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {([
                                    ['burn', 'Ignite', GAMEMAKER_COSTS.burn, 'Set the zone burning — and fire spreads'],
                                    ['flood', 'Flood', GAMEMAKER_COSTS.flood, 'Put the zone under water'],
                                    ['fog', 'Fog', GAMEMAKER_COSTS.fog, 'Blind everyone in the zone'],
                                    ['sever', 'Cut route', GAMEMAKER_COSTS.sever, 'Destroy one path out of the zone'],
                                ] as const).map(([type, label, base, tip]) => {
                                    const { cost, disabled, title } = leverState(type, base, tip);
                                    return (
                                    // Audit 3 §2.1: these buttons read "Ignite 40" and "Cut route
                                    // 60", and what they actually do to the arena lived in a hover
                                    // tooltip — so on a phone the Gamemaker was spending coins on
                                    // levers with no stated effect.
                                    <Hint key={type} className="w-full" text={title}>
                                        <button
                                            onClick={() => spendGamemaker(type, gmZone || undefined)}
                                            className="btn btn-sm w-full"
                                            disabled={disabled}
                                        >
                                            {label} <span className="font-mono text-micro text-[var(--color-ink-500)]">{cost}</span>
                                        </button>
                                    </Hint>
                                    );
                                })}
                            </div>
                            <Hint className="w-full" text={leverState('drop', GAMEMAKER_COSTS.drop, 'Restock the Cornucopia with a supply drop').title}>
                                <button
                                    onClick={() => spendGamemaker('drop')}
                                    className="btn btn-sm w-full"
                                    disabled={leverState('drop', GAMEMAKER_COSTS.drop, 'Restock the Cornucopia with a supply drop').disabled}
                                >
                                    Supply drop <span className="font-mono text-micro text-[var(--color-ink-500)]">{priceOf('drop', GAMEMAKER_COSTS.drop)}</span>
                                </button>
                            </Hint>
                            <Hint className="w-full" text={leverState('strip', GAMEMAKER_COSTS.strip, "Strip the zone's forage — nothing edible left in it for days").title}>
                                <button
                                    onClick={() => spendGamemaker('strip', gmZone || undefined)}
                                    className="btn btn-sm w-full"
                                    disabled={leverState('strip', GAMEMAKER_COSTS.strip, "Strip the zone's forage — nothing edible left in it for days").disabled}
                                >
                                    Strip zone <span className="font-mono text-micro text-[var(--color-ink-500)]">{priceOf('strip', GAMEMAKER_COSTS.strip)}</span>
                                </button>
                            </Hint>
                            <div className="grid grid-cols-2 gap-1.5">
                                <Hint className="w-full" text={leverState('mercy', GAMEMAKER_COSTS.mercy, 'Send an unrequested medical parachute to the selected tribute (or the most hurt) — and let the whole field see who you favour').title}>
                                    <button
                                        onClick={() => spendGamemaker('mercy', muttTargetId || undefined)}
                                        className="btn btn-sm w-full"
                                        disabled={leverState('mercy', GAMEMAKER_COSTS.mercy, 'Send an unrequested medical parachute to the selected tribute (or the most hurt) — and let the whole field see who you favour').disabled}
                                    >
                                        Mercy <span className="font-mono text-micro text-[var(--color-ink-500)]">{priceOf('mercy', GAMEMAKER_COSTS.mercy)}</span>
                                    </button>
                                </Hint>
                                <Hint align="right" className="w-full" text={leverState('reveal', GAMEMAKER_COSTS.reveal, 'Put the selected tribute (or the best hidden one) on every screen in the arena').title}>
                                    <button
                                        onClick={() => spendGamemaker('reveal', muttTargetId || undefined)}
                                        className="btn btn-sm w-full"
                                        disabled={leverState('reveal', GAMEMAKER_COSTS.reveal, 'Put the selected tribute (or the best hidden one) on every screen in the arena').disabled}
                                    >
                                        Reveal <span className="font-mono text-micro text-[var(--color-ink-500)]">{priceOf('reveal', GAMEMAKER_COSTS.reveal)}</span>
                                    </button>
                                </Hint>
                            </div>
                            <Hint
                                className="w-full"
                                text={gameState.bountyTargetId
                                    ? 'A bounty already stands'
                                    : leverState('bounty', GAMEMAKER_COSTS.bounty, 'Place a bounty and point the whole field at them').title}
                            >
                                <button
                                    onClick={() => spendGamemaker('bounty', muttTargetId || undefined)}
                                    className="btn btn-sm w-full"
                                    disabled={leverState('bounty', GAMEMAKER_COSTS.bounty, '').disabled || !!gameState.bountyTargetId}
                                >
                                    Place bounty <span className="font-mono text-micro text-[var(--color-ink-500)]">{priceOf('bounty', GAMEMAKER_COSTS.bounty)}</span>
                                </button>
                            </Hint>
                        </div>
                    </div>
                </Section>
            )}

            {/* ---------- your bets and coins ---------- */}
            <Section id="bets" title={`Your bets · ${coins} ⨷`}>
                {Object.keys(bets).length === 0 ? (
                    <p className="text-mini text-[var(--color-ink-500)]">
                        No wagers standing. Bets are placed on the roster screen before the gong.
                    </p>
                ) : (
                    <div className="space-y-1">
                        {Object.entries(bets).map(([id, bet]) => {
                            const t = gameState.tributes.find(o => o.id === id);
                            if (!t) return null;
                            const live = oddsLadder.find(o => o.tribute.id === id);
                            return (
                                <div key={id} className={`text-mini font-mono flex justify-between gap-2 items-center ${t.status === 'dead' ? 'line-through text-[var(--color-ink-500)]' : 'text-[var(--color-ink-200)]'}`}>
                                    <span className="truncate">{bet.stake} on {t.name} @ {bet.mult.toFixed(1)}×</span>
                                    <span className="flex-none">
                                        {t.status === 'dead' ? 'lost' : live ? `now ${live.mult.toFixed(1)}×` : ''}
                                    </span>
                                    {t.status === 'alive' && live && (
                                        <Hint align="right" text={`Cash out now at the current price (${live.pct}% implied)`}>
                                            <button
                                                className="btn btn-sm btn-ghost flex-none -my-1"
                                                onClick={() => gameActions.cashOutBet(t.id)}
                                            >
                                                Cash out
                                            </button>
                                        </Hint>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Section>

            {/* ---------- sponsor blocs ---------- */}
            {gameState.sponsorBlocBudgets && (
                <Section id="blocs" title="Sponsor blocs">
                    <p className="text-mini text-[var(--color-ink-500)] mb-2">
                        Every parachute is paid for by one of four crowds, each with its own taste and its own purse. A bloc that has
                        spent out stops giving — late-run scarcity that the seal on each crate only hinted at.
                    </p>
                    <div className="space-y-1.5">
                        {SPONSOR_BLOCS.map(b => {
                            const left = gameState.sponsorBlocBudgets?.[b.id] ?? 0;
                            const opening = Math.round(b.budget * Math.max(0.25, gameState.config.sponsorGenerosity));
                            const share = opening > 0 ? Math.max(0, Math.min(1, left / opening)) : 0;
                            return (
                                <div key={b.id} className="text-xs">
                                    <div className="flex justify-between gap-2">
                                        <span className="text-[var(--color-ink-200)] capitalize">{b.name.replace(/^the /, '')}</span>
                                        <span className="font-mono text-[var(--color-ink-500)]">{left} / {opening}</span>
                                    </div>
                                    <div className="h-1.5 bg-[var(--paper-flush)] mt-0.5" role="progressbar" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${b.name} purse remaining`}>
                                        <div className="h-full" style={{ width: `${share * 100}%`, background: share < 0.25 ? 'var(--red)' : 'var(--gold)' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Section>
            )}

            {/* ---------- this run ---------- */}
            <Section id="run" title="This run">
                <div className="grid grid-cols-2 gap-3">
                    <div className="stat-tile">
                        <div className="text-2xl font-black text-[var(--ink)]">{aliveCount}</div>
                        <div className="eyebrow mt-1">Alive</div>
                    </div>
                    <div className="stat-tile">
                        <div className="text-2xl font-black text-[var(--red)]">{deadCount}</div>
                        <div className="eyebrow mt-1">Fallen</div>
                    </div>
                </div>
                {gameState.gamesProfile && (
                    <p className="text-mini text-[var(--color-ink-500)] mt-3" role="group" aria-label={gameState.gamesProfile.temperament.blurb} title={gameState.gamesProfile.temperament.blurb}>
                        <span className="text-[var(--ink)] font-semibold">{ordinal(gameState.gamesProfile.gamesNumber)} Games</span>
                        {' — '}{gameState.gamesProfile.temperament.name}
                        {gameState.gamesProfile.wildcard.kind !== 'nothing' && (
                            <span role="group" aria-label={gameState.gamesProfile.wildcard.announcement} title={gameState.gamesProfile.wildcard.announcement}>
                                , with {gameState.gamesProfile.wildcard.name}
                                {gameState.gamesProfile.wildcard.day > 0 ? ` on day ${gameState.gamesProfile.wildcard.day}` : ''}
                            </span>
                        )}
                    </p>
                )}
                {gameState.headGamemaker && (
                    <p className="text-mini text-[var(--color-ink-500)] mt-2" role="group" aria-label="Chosen at the reaping. Their patience and their hazard appetite shape the whole run." title="Chosen at the reaping. Their patience and their hazard appetite shape the whole run.">
                        Head Gamemaker: <span className="text-[var(--ink)] font-semibold">{gameState.headGamemaker}</span>
                    </p>
                )}
                {/*
                  Audit 4 §2.7: `state.firedEvents` holds exactly which of an
                  arena's once-only events have happened this run, and 'Every
                  Door' asks the player to collect all of them — so the one
                  achievement in the table that is explicitly a collection was
                  the one with no instrument. A player pursuing it had no way to
                  know how many were left or that any had fired.
                */}
                {onceOnly.total >= 2 && (
                    <p className="text-mini text-[var(--color-ink-500)] mt-2">
                        <Glossed text={`${onceOnly.fired} of this arena's ${onceOnly.total} once-only events have happened this Games. Triggering every one of them is 'Every Door'.`}>
                            <span>
                                Once-only events:{' '}
                                <span className="text-[var(--ink)] font-semibold">{onceOnly.fired}/{onceOnly.total}</span>
                            </span>
                        </Glossed>
                    </p>
                )}
                {/* §10 (requests): the "close to earning" list used to live
                    here, mid-run. It is gone: an achievement named as a near
                    miss on day six frequently gives away which of the survivors
                    is about to win, and the end screen already shows the same
                    list at the one moment it costs the reader nothing. */}
                {gameState.audienceInterest !== undefined && (
                    <Explainer
                        align="left"
                        label={
                            <div className="stat-tile mt-3 w-full text-left">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="eyebrow">Audience interest</span>
                                    <span
                                        className="text-lg font-black"
                                        style={{ color: gameState.audienceInterest < ESCALATION.boredomThreshold ? 'var(--red)' : 'var(--ink)' }}
                                    >
                                        {gameState.audienceInterest}
                                    </span>
                                </div>
                                <div className="text-micro text-[var(--color-ink-500)] mt-1">
                                    {gameState.escalationDay !== undefined
                                        ? `Arena closing since day ${gameState.escalationDay}`
                                        : gameState.audienceInterest < ESCALATION.boredomThreshold
                                            ? 'The Capitol is losing patience'
                                            : 'The Capitol is entertained'}
                                </div>
                            </div>
                        }
                        title="Audience interest"
                    >
                        The average excitement the living field is generating. The Gamemakers are not working
                        to a timetable — they escalate because the feed has gone quiet. If this falls below{' '}
                        {ESCALATION.boredomThreshold} the border starts closing early.
                    </Explainer>
                )}
            </Section>
        </div>
    );
}
