import React, { useMemo, useState } from 'react';
import { Tribute, Phase } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { Explainer } from '../components/Explainer';
import { heightLabel } from '../engine/physique';
import { prefsStore } from '../store/prefsStore';
import { useStore } from '../store/createStore';
import { traitInfo } from '../data/traitInfo';
import {
    attributeBand, canSeeArchetype, canSeeAttributeBands, canSeeExactAttributes,
    canSeeTraits, disclosureFor, sealedReason,
} from '../ui/disclosure';
import { Stat } from '../components/Stat';
import { tributeOdds } from '../engine/odds';
import { Bet, gameActions, gameStore } from '../store/gameStore';
import { Swords, Zap, Brain, Eye, User, FastForward, Search } from 'lucide-react';

type SortKey = 'district' | 'odds' | 'training' | 'name';

export function RosterScreen({
    tributes,
    phase,
    onProceed,
    coins,
    bets,
    setBets,
    setCoins
}: {
    tributes: Tribute[],
    phase: Phase,
    onProceed: () => void,
    coins: number,
    bets: Record<string, Bet>,
    setBets: (bets: Record<string, Bet> | ((prev: Record<string, Bet>) => Record<string, Bet>)) => void,
    setCoins: (coins: number | ((prev: number) => number)) => void
}) {
    const bettingOpen = phase === 'setup';
    const sideBets = useStore(gameStore, s => s.sideBets);
    // UX-16: the audience learns things when the Capitol broadcasts them, not
    // all at once the moment the reaping ends.
    const disclosure = disclosureFor(phase);
    const buttonText = bettingOpen ? 'Begin training' : 'Return to arena';

    const units = useStore(prefsStore, p => p.units);
    const [query, setQuery] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('district');

    const oddsById = useMemo(() => {
        const map = new Map<string, ReturnType<typeof tributeOdds>>();
        tributes.forEach(t => map.set(t.id, tributeOdds(t, tributes)));
        return map;
    }, [tributes]);

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const filtered = needle
            ? tributes.filter(t =>
                t.name.toLowerCase().includes(needle) ||
                `district ${t.district}`.includes(needle) ||
                `d${t.district}` === needle ||
                // Searching must not leak what the card is deliberately hiding:
                // matching on a sealed trait would let a player enumerate them.
                (canSeeArchetype(disclosure) && ARCHETYPES[t.archetype].name.toLowerCase().includes(needle)) ||
                (canSeeTraits(disclosure) && t.traits.some(tr => tr.toLowerCase().includes(needle))))
            : tributes;

        return [...filtered].sort((a, b) => {
            switch (sortKey) {
                case 'odds':
                    return (oddsById.get(b.id)?.pct ?? 0) - (oddsById.get(a.id)?.pct ?? 0);
                case 'training':
                    return b.trainingScore - a.trainingScore;
                case 'name':
                    return a.name.localeCompare(b.name);
                default:
                    return a.district - b.district || a.gender.localeCompare(b.gender);
            }
        });
    }, [tributes, query, sortKey, oddsById, disclosure]);

    const totalStaked = Object.values(bets).reduce((a, b) => a + b.stake, 0);

    const placeBet = (t: Tribute, amount: number) => {
        setCoins(prevCoins => {
            if (prevCoins < amount) return prevCoins;
            const { mult } = oddsById.get(t.id)!;
            setBets(prev => ({
                ...prev,
                [t.id]: { stake: (prev[t.id]?.stake ?? 0) + amount, mult },
            }));
            return prevCoins - amount;
        });
    };

    const clearBet = (t: Tribute) => {
        const current = bets[t.id]?.stake ?? 0;
        if (!current) return;
        setBets(prev => {
            const copy = { ...prev };
            delete copy[t.id];
            return copy;
        });
        setCoins(prevCoins => prevCoins + current);
    };

    return (
        <div className="space-y-6">
            <div className="masthead dot-texture">
                <span className="masthead-ghost" aria-hidden="true">03</span>
                <span className="masthead-eyebrow">03 — Review The Roster</span>
                <div className="flex flex-wrap justify-between items-end gap-4">
                    <div>
                        <h2 className="masthead-title text-4xl md:text-5xl">The Tributes</h2>
                        <p className="text-[var(--gold-line)] font-semibold text-sm mt-2">
                            {tributes.length} reaped · {tributes.filter(t => t.isCareer).length} careers
                            {!bettingOpen && ' · betting is closed once the Games begin'}
                        </p>
                    </div>
                    <button onClick={onProceed} className="btn btn-primary flex-none">
                        {buttonText} <FastForward className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {bettingOpen && (
                <div className="panel p-5 flex flex-col md:flex-row justify-between items-center gap-5">
                    <div className="space-y-1">
                        <h3 className="display-title text-lg">Capitol Betting Parlour</h3>
                        <p className="text-[var(--color-ink-500)] text-xs max-w-lg">
                            Spread your wager across as many tributes as you like before the bloodbath. Payouts scale
                            inversely with survival odds — backing a long shot is where the money is.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <div className="stat-tile">
                            <div className="eyebrow">Wallet</div>
                            <div className="text-2xl font-black text-[var(--color-coin-400)] font-mono">{coins}</div>
                        </div>
                        <div className="stat-tile">
                            <div className="eyebrow">Staked</div>
                            <div className="text-2xl font-black text-[var(--ink)] font-mono">{totalStaked}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* §6.8: the proposition book — settled from what the run does, not who wins. */}
            {bettingOpen && (
                <div className="panel p-4 space-y-2">
                    <div className="flex items-baseline justify-between flex-wrap gap-2">
                        <span className="eyebrow">Side bets (50 coins each)</span>
                        {sideBets.length > 0 && (
                            <span className="font-mono text-[11px] text-[var(--color-ink-500)]">
                                {sideBets.map(b => `${b.kind} @ ${b.mult.toFixed(1)}×`).join(' · ')}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <span className="chip opacity-70" title="This wager needs a name — use the '1st blood' button on a tribute card below.">
                            First blood: pick a tribute below
                        </span>
                        <button className="chip" disabled={coins < 50} onClick={() => gameActions.placeSideBet('no-victor', 50)}>
                            No victor at all
                        </button>
                        <button className="chip" disabled={coins < 50} onClick={() => gameActions.placeSideBet('career-victor', 50)}>
                            A Career wins
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-500)]" />
                    <input
                        type="search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search name, district, archetype or trait"
                        className="field pl-9 text-sm"
                    />
                </div>
                <div className="seg">
                    {([['district', 'District'], ['odds', 'Odds'], ['training', 'Training'], ['name', 'Name']] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setSortKey(key)} aria-pressed={sortKey === key} className="seg-item">
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {visible.length === 0 ? (
                <div className="empty-state">No tribute matches “{query}”.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {visible.map(t => {
                        const { pct, mult } = oddsById.get(t.id)!;
                        const currentBet = bets[t.id]?.stake ?? 0;
                        const lockedMult = bets[t.id]?.mult ?? mult;

                        return (
                            <div key={t.id} className="panel p-4 flex flex-col gap-3.5 animate-riseIn">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0">
                                        <h3 className="font-black text-lg text-[var(--ink)] truncate">{t.name}</h3>
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            <span className="chip">District {t.district}</span>
                                            {t.isCareer && <span className="chip chip-gold">Career</span>}
                                            {t.volunteered && (
                                                <Explainer
                                                    align="left"
                                                    label={<span className="chip chip-gold">Volunteer</span>}
                                                    title="Volunteered"
                                                >
                                                    {t.reapingNote}
                                                </Explainer>
                                            )}
                                            <span className="chip" title={`${t.gender}, age ${t.age}, ${heightLabel(t.heightCm, units)}, ${t.build} build`}>
                                                {t.gender} · {t.age} · {heightLabel(t.heightCm, units)} · {t.build}
                                            </span>
                                            {canSeeArchetype(disclosure) ? (
                                                <Explainer
                                                    align="left"
                                                    label={<span className="chip chip-accent">{ARCHETYPES[t.archetype].name}</span>}
                                                    title={`${ARCHETYPES[t.archetype].name} archetype`}
                                                >
                                                    {ARCHETYPES[t.archetype].description}
                                                    <span className="block mt-1.5 font-mono text-[10px] text-[var(--color-ink-500)]">
                                                        Aggression {ARCHETYPES[t.archetype].aggression >= 0 ? '+' : ''}{ARCHETYPES[t.archetype].aggression.toFixed(2)} ·
                                                        Caution {ARCHETYPES[t.archetype].caution >= 0 ? '+' : ''}{ARCHETYPES[t.archetype].caution.toFixed(2)}
                                                    </span>
                                                </Explainer>
                                            ) : (
                                                <span className="chip opacity-50" title={sealedReason(disclosure)}>⧗ Unassessed</span>
                                            )}
                                        </div>
                                    </div>
                                    {t.trainingScore > 0 && (
                                        <div
                                            className="stat-tile !p-2 flex-none"
                                            title="Training score — anything above 8 is exceptionally rare"
                                        >
                                            <div className={`text-xl font-black font-mono ${
                                                t.trainingScore >= 11 ? 'text-[var(--red)]'
                                                    : t.trainingScore >= 9 ? 'text-[var(--cat-training)]'
                                                    : 'text-[var(--ink)]'
                                            }`}>
                                                {t.trainingScore}
                                            </div>
                                            <div className="eyebrow">Score</div>
                                        </div>
                                    )}
                                </div>

                                {canSeeExactAttributes(disclosure) ? (
                                    <div className="grid grid-cols-2 gap-1.5 text-sm">
                                        <Stat icon={<Swords className="w-3.5 h-3.5 text-[var(--cat-death)]" />} label="STR" value={t.attributes.strength} />
                                        <Stat icon={<Zap className="w-3.5 h-3.5 text-[var(--cat-training)]" />} label="AGI" value={t.attributes.agility} />
                                        <Stat icon={<Brain className="w-3.5 h-3.5 text-[var(--cat-loot)]" />} label="INT" value={t.attributes.intelligence} />
                                        <Stat icon={<Eye className="w-3.5 h-3.5 text-[var(--cat-sanity)]" />} label="STL" value={t.attributes.stealth} />
                                        <Stat icon={<User className="w-3.5 h-3.5 text-[var(--cat-romance)]" />} label="CHA" value={t.attributes.charisma} />
                                    </div>
                                ) : canSeeAttributeBands(disclosure) ? (
                                    <div className="space-y-1">
                                        {([
                                            ['Strength', t.attributes.strength],
                                            ['Agility', t.attributes.agility],
                                            ['Cunning', t.attributes.intelligence],
                                            ['Stealth', t.attributes.stealth],
                                        ] as Array<[string, number]>).map(([label, value]) => {
                                            const band = attributeBand(value);
                                            return (
                                                <div key={label} className="flex items-center gap-2 text-xs">
                                                    <span className="text-[var(--color-ink-500)] w-16 flex-none">{label}</span>
                                                    <span className="flex gap-0.5 flex-1" aria-hidden="true">
                                                        {[1, 2, 3, 4, 5].map(i => (
                                                            <span
                                                                key={i}
                                                                className="h-2 flex-1 border border-[var(--line)]"
                                                                style={{ background: i <= band.filled ? 'var(--ink)' : 'transparent' }}
                                                            />
                                                        ))}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-[var(--color-ink-400)] w-20 text-right flex-none">
                                                        {band.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        <p className="text-[10px] text-[var(--color-ink-500)] pt-0.5">
                                            The Gamemakers publish an assessment, not a sheet.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="panel-flush p-3 text-center">
                                        <div className="eyebrow text-[var(--color-ink-500)]">⧗ Not yet assessed</div>
                                        <p className="text-[10px] text-[var(--color-ink-500)] mt-1">
                                            Only the public record is available before training: district, gender,
                                            age, height and build.
                                        </p>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-1">
                                    {canSeeTraits(disclosure)
                                        ? t.traits.map(trait => (
                                            <Explainer
                                                key={trait}
                                                align="left"
                                                label={<span className="chip">{trait}</span>}
                                                title={trait}
                                            >
                                                {traitInfo(trait)}
                                            </Explainer>
                                        ))
                                        : <span className="chip opacity-50" title={sealedReason(disclosure)}>⧗ Traits sealed</span>}
                                </div>

                                {bettingOpen && (
                                    <div className="pt-3 border-t-2 border-[var(--line-soft)] space-y-2">
                                        <div className="flex justify-between text-[10px] font-mono text-[var(--color-ink-500)]">
                                            <span>SURVIVAL ODDS / PAYOUT</span>
                                            <span className="text-[var(--ink)] font-bold">{pct}% · {mult.toFixed(1)}×</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => placeBet(t, 50)} disabled={coins < 50} className="btn btn-sm flex-1">+50</button>
                                            <button onClick={() => placeBet(t, 100)} disabled={coins < 100} className="btn btn-sm flex-1">+100</button>
                                            {/* §6.8: the named side bet. */}
                                            <button
                                                onClick={() => gameActions.placeSideBet('first-blood', 50, t.id)}
                                                disabled={coins < 50 || sideBets.some(b => b.kind === 'first-blood')}
                                                className="btn btn-sm"
                                                title="Side bet: this tribute draws first blood (50 coins)"
                                            >
                                                1st blood
                                            </button>
                                            {currentBet > 0 && (
                                                <button onClick={() => clearBet(t)} className="btn btn-sm" title="Refund this wager">Clear</button>
                                            )}
                                        </div>
                                        {currentBet > 0 && (
                                            <div className="chip chip-coin w-full justify-center py-1.5">
                                                {currentBet} staked · returns {Math.floor(currentBet * lockedMult)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
