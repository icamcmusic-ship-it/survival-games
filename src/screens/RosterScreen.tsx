import React from 'react';
import { Tribute, Phase } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { Stat } from '../components/Stat';
import { Swords, Zap, Brain, Eye, User, FastForward } from 'lucide-react';

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
    const buttonText = phase === 'setup' ? 'Begin Training' : 'Return to Arena';

    // Calculate total power score across all tributes for normalized survival odds
    const totalOddsScore = tributes.reduce((sum, t) => {
        const strength = t.attributes.strength;
        const agility = t.attributes.agility;
        const training = t.trainingScore || 5;
        let score = 100 * 0.4 + strength * 2 + agility * 2 + training * 4;
        if (t.traits.includes('Brute')) score += 15;
        if (t.traits.includes('Bloodthirsty')) score += 15;
        if (t.traits.includes('Pacifist')) score -= 10;
        if (t.traits.includes('Strategist')) score += 12;
        return sum + Math.max(10, score);
    }, 0);

    const getOddsAndMultiplier = (t: Tribute) => {
        const strength = t.attributes.strength;
        const agility = t.attributes.agility;
        const training = t.trainingScore || 5;
        let score = 100 * 0.4 + strength * 2 + agility * 2 + training * 4;
        if (t.traits.includes('Brute')) score += 15;
        if (t.traits.includes('Bloodthirsty')) score += 15;
        if (t.traits.includes('Pacifist')) score -= 10;
        if (t.traits.includes('Strategist')) score += 12;
        const finalScore = Math.max(10, score);
        const rawOdds = finalScore / totalOddsScore;
        const pct = Math.round(rawOdds * 100) || 4;
        const mult = Math.max(1.1, Math.min(25.0, 100 / pct));
        return { pct, mult };
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end border-b border-zinc-800 pb-4">
                <div>
                    <h2 className="text-3xl font-black uppercase tracking-tight text-white">The Tributes</h2>
                    <p className="text-zinc-400">Review the roster before the games begin.</p>
                </div>
                <button
                    onClick={onProceed}
                    className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center gap-2 text-sm"
                >
                    {buttonText} <FastForward className="w-4 h-4" />
                </button>
            </div>

            {phase === 'setup' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="space-y-1">
                        <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                            🏆 Capitol Betting Parlor Open
                        </h3>
                        <p className="text-zinc-400 text-xs">
                            Distribute your wager across any tributes before initiating the Bloodbath. Correct bets fund sponsor gifts and build points!
                        </p>
                    </div>
                    <div className="bg-zinc-950 px-6 py-3 rounded-xl border border-zinc-800/80 flex items-center gap-3 w-full md:w-auto justify-center">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono tracking-widest">Available Wallet Balance</span>
                        <span className="text-2xl font-black text-teal-400 font-mono tracking-tight">{coins} COINS</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tributes.map(t => {
                    const { pct, mult } = getOddsAndMultiplier(t);
                    const currentBet = bets[t.id] || 0;

                    return (
                        <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg text-white">{t.name}</h3>
                                    <div className="flex gap-2 text-xs mt-1">
                                        {t.isCareer && <span className="text-yellow-500 font-semibold uppercase tracking-wider">Career</span>}
                                        <span className="text-zinc-500">District {t.district}</span>
                                    </div>
                                    <div className="mt-1">
                                        <span
                                            title={ARCHETYPES[t.archetype].description}
                                            className="px-2 py-0.5 bg-red-950/30 text-red-400 text-[10px] font-bold uppercase tracking-wider rounded border border-red-900/40"
                                        >
                                            {ARCHETYPES[t.archetype].name}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <Stat icon={<Swords className="w-4 h-4 text-red-400" />} label="STR" value={t.attributes.strength} />
                                <Stat icon={<Zap className="w-4 h-4 text-yellow-400" />} label="AGI" value={t.attributes.agility} />
                                <Stat icon={<Brain className="w-4 h-4 text-blue-400" />} label="INT" value={t.attributes.intelligence} />
                                <Stat icon={<Eye className="w-4 h-4 text-purple-400" />} label="STL" value={t.attributes.stealth} />
                                <Stat icon={<User className="w-4 h-4 text-pink-400" />} label="CHA" value={t.attributes.charisma} />
                            </div>

                            <div className="flex flex-wrap gap-1">
                                {t.traits.map(trait => (
                                    <span key={trait} className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-[10px] uppercase tracking-wider rounded border border-zinc-700">
                                        {trait}
                                    </span>
                                ))}
                            </div>

                            {phase === 'setup' && (
                                <div className="mt-2 pt-3 border-t border-zinc-800/80 space-y-2 text-xs">
                                    <div className="flex justify-between text-zinc-500 font-mono text-[10px]">
                                        <span>Survival Odds / Payout</span>
                                        <span className="text-white font-bold">{pct}% ({mult.toFixed(1)}x multiplier)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                if (coins >= 50) {
                                                    setBets(prev => ({ ...prev, [t.id]: (prev[t.id] || 0) + 50 }));
                                                    setCoins(coins - 50);
                                                }
                                            }}
                                            className="flex-1 py-1 px-2 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 font-bold transition-all text-[11px]"
                                        >
                                            +50
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (coins >= 100) {
                                                    setBets(prev => ({ ...prev, [t.id]: (prev[t.id] || 0) + 100 }));
                                                    setCoins(coins - 100);
                                                }
                                            }}
                                            className="flex-1 py-1 px-2 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 font-bold transition-all text-[11px]"
                                        >
                                            +100
                                        </button>
                                        {currentBet > 0 && (
                                            <button
                                                onClick={() => {
                                                    setBets(prev => {
                                                        const copy = { ...prev };
                                                        delete copy[t.id];
                                                        return copy;
                                                    });
                                                    setCoins(coins + currentBet);
                                                }}
                                                className="py-1 px-2 bg-red-950/20 hover:bg-red-950 border border-red-900/40 text-red-500 rounded font-bold transition-all text-[11px]"
                                                title="Clear Wager"
                                            >
                                                Reset
                                            </button>
                                        )}
                                    </div>
                                    {currentBet > 0 && (
                                        <div className="bg-emerald-950/15 border border-emerald-900/40 rounded p-2 text-center text-[11px] text-emerald-400 font-extrabold font-mono">
                                            Wagered: {currentBet} Coins (Est. Returns: {Math.floor(currentBet * mult)} Coins)
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
