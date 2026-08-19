import React, { useMemo, useState } from 'react';
import { Tribute, Phase } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { Stat } from '../components/Stat';
import { tributeOdds } from '../engine/odds';
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
    bets: Record<string, number>,
    setBets: React.Dispatch<React.SetStateAction<Record<string, number>>>,
    setCoins: (coins: number) => void
}) {
    const bettingOpen = phase === 'setup';
    const buttonText = bettingOpen ? 'Begin training' : 'Return to arena';

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
                ARCHETYPES[t.archetype].name.toLowerCase().includes(needle) ||
                t.traits.some(tr => tr.toLowerCase().includes(needle)))
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
    }, [tributes, query, sortKey, oddsById]);

    const totalStaked = Object.values(bets).reduce((a, b) => a + b, 0);

    const placeBet = (t: Tribute, amount: number) => {
        if (coins < amount) return;
        setBets(prev => ({ ...prev, [t.id]: (prev[t.id] || 0) + amount }));
        setCoins(coins - amount);
    };

    const clearBet = (t: Tribute) => {
        const current = bets[t.id] || 0;
        if (!current) return;
        setBets(prev => {
            const copy = { ...prev };
            delete copy[t.id];
            return copy;
        });
        setCoins(coins + current);
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
                        const currentBet = bets[t.id] || 0;

                        return (
                            <div key={t.id} className="panel p-4 flex flex-col gap-3.5 animate-riseIn">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0">
                                        <h3 className="font-black text-lg text-[var(--ink)] truncate">{t.name}</h3>
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            <span className="chip">District {t.district}</span>
                                            {t.isCareer && <span className="chip chip-gold">Career</span>}
                                            <span className="chip chip-accent" title={ARCHETYPES[t.archetype].description}>
                                                {ARCHETYPES[t.archetype].name}
                                            </span>
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

                                <div className="grid grid-cols-2 gap-1.5 text-sm">
                                    <Stat icon={<Swords className="w-3.5 h-3.5 text-[var(--cat-death)]" />} label="STR" value={t.attributes.strength} />
                                    <Stat icon={<Zap className="w-3.5 h-3.5 text-[var(--cat-training)]" />} label="AGI" value={t.attributes.agility} />
                                    <Stat icon={<Brain className="w-3.5 h-3.5 text-[var(--cat-loot)]" />} label="INT" value={t.attributes.intelligence} />
                                    <Stat icon={<Eye className="w-3.5 h-3.5 text-[var(--cat-sanity)]" />} label="STL" value={t.attributes.stealth} />
                                    <Stat icon={<User className="w-3.5 h-3.5 text-[var(--cat-romance)]" />} label="CHA" value={t.attributes.charisma} />
                                </div>

                                <div className="flex flex-wrap gap-1">
                                    {t.traits.map(trait => <span key={trait} className="chip">{trait}</span>)}
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
                                            {currentBet > 0 && (
                                                <button onClick={() => clearBet(t)} className="btn btn-sm" title="Refund this wager">Clear</button>
                                            )}
                                        </div>
                                        {currentBet > 0 && (
                                            <div className="chip chip-coin w-full justify-center py-1.5">
                                                {currentBet} staked · returns {Math.floor(currentBet * mult)}
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
