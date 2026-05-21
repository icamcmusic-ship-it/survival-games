/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GameState, Arena, Tribute, Phase, HallOfFameEntry } from './models/types';
import { ARENAS } from './data/constants';
import { generateTributes } from './engine/generator';
import { Simulator } from './engine/simulator';
import { Shield, Swords, Skull, Heart, Droplets, Zap, Brain, Eye, User, Settings, Trophy, Play, FastForward, Activity, MapPin, X, Users, Share2 } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [view, setView] = useState<'setup' | 'roster' | 'game' | 'hallOfFame'>('setup');
  const [simulator, setSimulator] = useState<Simulator | null>(null);
  const [coins, setCoins] = useState(() => Number(localStorage.getItem('capitolCoins') || '1000'));
  const [bets, setBets] = useState<Record<string, number>>({});
  const [betWonMessage, setBetWonMessage] = useState<string | null>(null);
  const [isReplayedRun, setIsReplayedRun] = useState(false);

  // Parse URL search parameters for Seed and Arena to support Replay Sharing!
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSeed = params.get('seed');
    const urlArena = params.get('arena');
    const urlGamemaker = params.get('gamemaker') === 'true';
    if (urlSeed && urlArena) {
      setIsReplayedRun(true);
      handleStartGame(urlSeed, urlArena, urlGamemaker);
      setView('roster'); // Start at roster so we can review tributes and place bets on this seeded run!
    }
  }, []);

  const handleStartGame = (seed: string, arenaId: string, gamemakerMode: boolean) => {
    const arena = ARENAS.find(a => a.id === arenaId) || ARENAS[0];
    const tributes = generateTributes(seed);
    
    const initialState: GameState = {
      seed,
      arena,
      tributes,
      phase: 'setup',
      day: 0,
      log: [],
      gamemakerMode
    };
    
    setGameState(initialState);
    setSimulator(new Simulator(initialState));
    setView('roster');
    setBets({});
    setBetWonMessage(null);
  };

  const handleNextPhase = () => {
    if (!simulator) return;
    
    const state = simulator.getState();
    if (state.phase === 'setup') {
      simulator.processTraining();
    } else if (state.phase === 'training') {
      simulator.processInterviews();
    } else if (state.phase === 'interviews') {
      simulator.startGames();
    } else if (state.phase === 'bloodbath') {
      simulator.processBloodbath();
    } else if (state.phase === 'epilogue') {
      state.phase = 'ended';
      
      // Calculate betting results
      const winner = state.tributes.find(t => t.status === 'alive');
      if (winner && bets[winner.id]) {
        // Calculate multipliers
        const totalOriginalScore = state.tributes.reduce((sum, tr) => {
          const strength = tr.attributes.strength;
          const agility = tr.attributes.agility;
          const training = tr.trainingScore || 5;
          let score = 100 * 0.4 + strength * 2 + agility * 2 + training * 4;
          if (tr.traits.includes('Brute')) score += 15;
          if (tr.traits.includes('Bloodthirsty')) score += 15;
          if (tr.traits.includes('Pacifist')) score -= 10;
          if (tr.traits.includes('Strategist')) score += 12;
          return sum + score;
        }, 0);
        
        const winStrength = winner.attributes.strength;
        const winAgility = winner.attributes.agility;
        const winTraining = winner.trainingScore || 5;
        let winScore = 100 * 0.4 + winStrength * 2 + winAgility * 2 + winTraining * 4;
        if (winner.traits.includes('Brute')) winScore += 15;
        if (winner.traits.includes('Bloodthirsty')) winScore += 15;
        if (winner.traits.includes('Pacifist')) winScore -= 10;
        if (winner.traits.includes('Strategist')) winScore += 12;
        
        const rawOdds = winScore / totalOriginalScore;
        const oddsPercentage = Math.round(rawOdds * 100) || 4;
        const multiplier = Math.max(1.1, Math.min(25.0, 100 / oddsPercentage));
        
        const betAmount = bets[winner.id];
        const winnings = Math.floor(betAmount * multiplier);
        const newCoinBalance = coins + winnings;
        setCoins(newCoinBalance);
        localStorage.setItem('capitolCoins', newCoinBalance.toString());
        setBetWonMessage(`Your backed tribute ${winner.name} won! You won ${winnings} Capitol Coins! (Wager: ${betAmount} @ ${multiplier.toFixed(1)}x)`);
      } else if (Object.keys(bets).length > 0) {
        setBetWonMessage("Your wagered tributes did not survive. The Capitol takes your coins.");
      }
      
      // Save Victor to Hall of Fame
      if (winner) {
        const entry: HallOfFameEntry = {
          id: Math.random().toString(36).substring(2, 9),
          seed: state.seed,
          arenaName: state.arena.name,
          winnerName: winner.name,
          winnerDistrict: winner.district,
          kills: winner.kills,
          date: new Date().toISOString(),
          winnerTraits: winner.traits,
          winnerEndHealth: winner.health,
          tributeSummaries: state.tributes.map(t => ({
            name: t.name,
            district: t.district,
            kills: t.kills,
            status: t.status,
            causeOfDeath: t.causeOfDeath,
            dayOfDeath: t.dayOfDeath
          }))
        };
        let existing = [];
        try {
          existing = JSON.parse(localStorage.getItem('hungerGamesHoF') || '[]');
          if (!Array.isArray(existing)) existing = [];
        } catch (e) {
          existing = [];
        }
        localStorage.setItem('hungerGamesHoF', JSON.stringify([entry, ...existing]));
      }
    } else if (state.phase === 'ended') {
      return;
    } else {
      simulator.processTurn();
      
      const newState = simulator.getState();
      if (newState.phase === 'ended') {
        const winner = newState.tributes.find(t => t.status === 'alive');
        if (winner) {
          const entry: HallOfFameEntry = {
            id: Math.random().toString(36).substring(2, 9),
            seed: newState.seed,
            arenaName: newState.arena.name,
            winnerName: winner.name,
            winnerDistrict: winner.district,
            kills: winner.kills,
            date: new Date().toISOString(),
            winnerTraits: winner.traits,
            winnerEndHealth: winner.health,
            tributeSummaries: newState.tributes.map(t => ({
              name: t.name,
              district: t.district,
              kills: t.kills,
              status: t.status,
              causeOfDeath: t.causeOfDeath,
              dayOfDeath: t.dayOfDeath
            }))
          };
          let existing = [];
          try {
            existing = JSON.parse(localStorage.getItem('hungerGamesHoF') || '[]');
            if (!Array.isArray(existing)) existing = [];
          } catch (e) {
            existing = [];
          }
          localStorage.setItem('hungerGamesHoF', JSON.stringify([entry, ...existing]));
        }
      }
    }
    
    setGameState(JSON.parse(JSON.stringify(simulator.getState())));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-red-900/50">
      <header className="border-b border-zinc-800 bg-zinc-900/50 p-4 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-2xl font-bold tracking-tighter text-red-500 uppercase flex items-center gap-2">
            <Swords className="w-6 h-6" />
            Hunger Games Simulator
          </h1>
          <nav className="flex gap-4 items-center">
            {isReplayedRun && gameState && (
              <span className="text-[10px] bg-teal-950/40 text-teal-400 border border-teal-905 px-2 py-1 rounded font-mono font-bold hidden sm:inline-block">
                REPLAYING: {gameState.seed}
              </span>
            )}
            {gameState && (
              <ShareButton 
                seed={gameState.seed} 
                arenaId={gameState.arena.id} 
                gamemakerMode={gameState.gamemakerMode} 
              />
            )}
            <button onClick={() => setView('setup')} className={`text-sm uppercase tracking-wider font-semibold ${view === 'setup' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>New Game</button>
            {gameState && <button onClick={() => setView('roster')} className={`text-sm uppercase tracking-wider font-semibold ${view === 'roster' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>Roster</button>}
            {gameState && gameState.phase !== 'setup' && <button onClick={() => setView('game')} className={`text-sm uppercase tracking-wider font-semibold ${view === 'game' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>Arena</button>}
            <button onClick={() => setView('hallOfFame')} className={`text-sm uppercase tracking-wider font-semibold ${view === 'hallOfFame' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>Hall of Fame</button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 py-8">
        {view === 'setup' && <SetupScreen onStart={handleStartGame} />}
        {view === 'roster' && gameState && (
          <RosterScreen 
            tributes={gameState.tributes} 
            phase={gameState.phase}
            coins={coins}
            bets={bets}
            setBets={setBets}
            setCoins={setCoins}
            onProceed={() => {
              if (gameState.phase === 'setup') {
                handleNextPhase();
              }
              setView('game');
            }} 
          />
        )}
        {view === 'game' && gameState && simulator && (
          gameState.phase === 'ended' ? (
            <EndScreen gameState={gameState} onRestart={() => setView('setup')} coins={coins} betWonMessage={betWonMessage} />
          ) : gameState.phase === 'epilogue' ? (
            <VictorInterviewScreen gameState={gameState} onProceed={handleNextPhase} />
          ) : (
            <GameScreen 
              gameState={gameState} 
              onNextPhase={handleNextPhase} 
              simulator={simulator}
              setGameState={setGameState}
              coins={coins}
              bets={bets}
              setCoins={setCoins}
              setBets={setBets}
            />
          )
        )}
        {view === 'hallOfFame' && <HallOfFameScreen />}
      </main>
    </div>
  );
}

function SetupScreen({ onStart }: { onStart: (seed: string, arenaId: string, gamemakerMode: boolean) => void }) {
  const [seed, setSeed] = useState(Math.random().toString(36).substring(2, 8).toUpperCase());
  const [arenaId, setArenaId] = useState(ARENAS[0].id);
  const [gamemakerMode, setGamemakerMode] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-5xl font-black uppercase tracking-tighter text-white">May the odds be ever in your favor.</h2>
        <p className="text-zinc-400 text-lg">Configure your simulation parameters below.</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-6">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500">Simulation Seed</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={seed} 
              onChange={(e) => setSeed(e.target.value.toUpperCase())}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 w-full font-mono text-white focus:outline-none focus:border-red-500 transition-colors"
            />
            <button 
              onClick={() => setSeed(Math.random().toString(36).substring(2, 8).toUpperCase())}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Randomize
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-widest font-semibold text-zinc-500">Select Arena</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ARENAS.map(a => (
              <button
                key={a.id}
                onClick={() => setArenaId(a.id)}
                className={`p-4 rounded-lg border text-left transition-all ${arenaId === a.id ? 'bg-red-950/30 border-red-500/50' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600'}`}
              >
                <h3 className="font-bold text-white mb-1">{a.name}</h3>
                <p className="text-xs text-zinc-400 line-clamp-2">{a.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-zinc-800">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${gamemakerMode ? 'bg-red-500 border-red-500' : 'bg-zinc-950 border-zinc-700 group-hover:border-zinc-500'}`}>
              {gamemakerMode && <div className="w-2 h-2 bg-white rounded-sm" />}
            </div>
            <div>
              <div className="font-bold text-white">Gamemaker Mode</div>
              <div className="text-xs text-zinc-400">Allows manual triggering of events and mutts during the simulation.</div>
            </div>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={gamemakerMode} 
              onChange={(e) => setGamemakerMode(e.target.checked)} 
            />
          </label>
        </div>

        <button 
          onClick={() => onStart(seed, arenaId, gamemakerMode)}
          className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2 mt-8"
        >
          <Play className="w-5 h-5" />
          Reap the Tributes
        </button>
      </div>
    </div>
  );
}

function RosterScreen({ 
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

function Stat({ icon, label, value }: { icon: React.ReactNode, label: string, value: number }) {
  return (
    <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded border border-zinc-800/50">
      {icon}
      <span className="text-zinc-500 text-xs font-mono">{label}</span>
      <span className="text-white font-mono ml-auto">{value}/10</span>
    </div>
  );
}

function GameScreen({ 
  gameState, 
  onNextPhase, 
  simulator, 
  setGameState,
  coins,
  bets,
  setCoins,
  setBets 
}: { 
  gameState: GameState, 
  onNextPhase: () => void, 
  simulator: Simulator, 
  setGameState: (state: GameState) => void,
  coins: number,
  bets: Record<string, number>,
  setCoins: (coins: number) => void,
  setBets: React.Dispatch<React.SetStateAction<Record<string, number>>>
}) {
  const [selectedTribute, setSelectedTribute] = useState<Tribute | null>(null);
  const [speed, setSpeed] = useState<'manual' | '1x' | '5x' | 'auto'>('manual');
  const [importantOnly, setImportantOnly] = useState<boolean>(false);
  const [muttTargetId, setMuttTargetId] = useState<string>('');
  const [tacticalTab, setTacticalTab] = useState<'chronicle' | 'map'>('chronicle');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const aliveCount = gameState.tributes.filter(t => t.status === 'alive').length;
  const deadCount = gameState.tributes.filter(t => t.status === 'dead').length;

  // Auto-advance logic
  useEffect(() => {
    if (speed === 'manual' || gameState.phase === 'ended') return;

    const delay = speed === '1x' ? 1200 : speed === '5x' ? 300 : 50;
    const timer = setTimeout(() => {
      onNextPhase();
    }, delay);

    return () => clearTimeout(timer);
  }, [speed, gameState.phase, gameState.day, onNextPhase]);

  // Run to completion instantly
  const handleRunToEnd = () => {
    let state = simulator.getState();
    let maxCycles = 500;
    while (state.phase !== 'ended' && maxCycles > 0) {
      if (state.phase === 'setup') {
        simulator.processTraining();
      } else if (state.phase === 'training') {
        simulator.processInterviews();
      } else if (state.phase === 'interviews') {
        simulator.startGames();
      } else if (state.phase === 'bloodbath') {
        simulator.processBloodbath();
      } else {
        simulator.processTurn();
      }
      state = simulator.getState();
      maxCycles--;
    }

    // Save final state victor to local storage under the new schema
    if (state.phase === 'ended') {
      const winner = state.tributes.find(t => t.status === 'alive');
      if (winner) {
        const entry: HallOfFameEntry = {
          id: Math.random().toString(36).substring(2, 9),
          seed: state.seed,
          arenaName: state.arena.name,
          winnerName: winner.name,
          winnerDistrict: winner.district,
          kills: winner.kills,
          date: new Date().toISOString(),
          winnerTraits: winner.traits,
          winnerEndHealth: winner.health,
          tributeSummaries: state.tributes.map(t => ({
            name: t.name,
            district: t.district,
            kills: t.kills,
            status: t.status,
            causeOfDeath: t.causeOfDeath,
            dayOfDeath: t.dayOfDeath
          }))
        };
        let existing = [];
        try {
          existing = JSON.parse(localStorage.getItem('hungerGamesHoF') || '[]');
          if (!Array.isArray(existing)) existing = [];
        } catch (e) {
          existing = [];
        }
        localStorage.setItem('hungerGamesHoF', JSON.stringify([entry, ...existing]));
      }
    }
    setGameState(JSON.parse(JSON.stringify(simulator.getState())));
  };

  // Group and Filter Logs
  const filteredLogs = gameState.log.filter(log => {
    if (importantOnly && !log.important) return false;
    if (selectedZone && log.zone !== selectedZone) return false;
    return true;
  });

  const groupedLogs = filteredLogs.reduce((acc, log) => {
    const key = `Day ${log.day} - ${log.phase.charAt(0).toUpperCase() + log.phase.slice(1)}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {} as Record<string, typeof gameState.log>);

  // Sort tributes for sidebar: group alive allied together, alive solo, then deceased
  const sortedSidebarTributes = [...gameState.tributes].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'alive' ? -1 : 1;
    }
    if (a.status === 'alive') {
      if (a.allianceId && !b.allianceId) return -1;
      if (!a.allianceId && b.allianceId) return 1;
      if (a.allianceId && b.allianceId) {
        return a.allianceId.localeCompare(b.allianceId);
      }
    }
    if (a.district !== b.district) {
      return a.district - b.district;
    }
    return a.gender.localeCompare(b.gender);
  });

  const getAllianceBorderClass = (allianceId?: string) => {
    if (!allianceId) return '';
    const colors = [
      'border-l-4 border-l-emerald-500 bg-emerald-950/10 hover:border-r hover:border-zinc-650',
      'border-l-4 border-l-cyan-500 bg-cyan-950/10 hover:border-r hover:border-zinc-650',
      'border-l-4 border-l-amber-500 bg-amber-950/10 hover:border-r hover:border-zinc-650',
      'border-l-4 border-l-purple-500 bg-purple-950/10 hover:border-r hover:border-zinc-650',
      'border-l-4 border-l-pink-500 bg-pink-955/10 hover:border-r hover:border-zinc-650'
    ];
    let hash = 0;
    for (let i = 0; i < allianceId.length; i++) {
      hash = allianceId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex flex-col gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-xl">
          <div className="flex justify-between items-center pb-3 border-b border-zinc-850">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white">
                {gameState.phase === 'ended' ? 'The Games Have Ended' : `Day ${gameState.day} - ${gameState.phase.toUpperCase()}`}
              </h2>
              <p className="text-zinc-400 text-sm">{gameState.arena.name}</p>
            </div>
            {gameState.phase !== 'ended' && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleRunToEnd}
                  className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-bold uppercase tracking-widest rounded-lg text-xs transition-colors"
                >
                  Run to End
                </button>
                <button 
                  onClick={onNextPhase}
                  className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-lg text-xs transition-colors flex items-center gap-2"
                >
                  Proceed <FastForward className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          
          {gameState.phase !== 'ended' && (
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Sim Speed:</span>
                <div className="inline-flex rounded-lg bg-zinc-950 p-1 border border-zinc-850">
                  {(['manual', '1x', '5x', 'auto'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-wider transition-colors ${speed === s ? 'bg-red-600/20 text-red-400 border border-red-900/40' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}
                    >
                      {s === 'manual' ? 'Manual' : s === 'auto' ? 'Auto' : s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-1 bg-zinc-950 p-1 border border-zinc-850 rounded-lg">
                <button
                  onClick={() => setTacticalTab('chronicle')}
                  className={`px-3 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all border ${tacticalTab === 'chronicle' ? 'bg-zinc-800 text-white border-zinc-705' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
                >
                  Chronicle feed
                </button>
                <button
                  onClick={() => setTacticalTab('map')}
                  className={`px-3 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all border ${tacticalTab === 'map' ? 'bg-zinc-800 text-white border-zinc-705' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
                >
                  Hologram Map
                </button>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-zinc-200">
                <input 
                  type="checkbox"
                  checked={importantOnly}
                  onChange={(e) => setImportantOnly(e.target.checked)}
                  className="rounded bg-zinc-950 border-zinc-800 text-red-600 focus:ring-red-600 cursor-pointer w-4 h-4"
                />
                <span className="text-[10px] uppercase font-bold tracking-wider">Show Important Events Only</span>
              </label>
            </div>
          )}
        </div>

        {tacticalTab === 'map' ? (
          <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-xl space-y-4">
            <ArenaMap 
              gameState={gameState} 
              selectedZone={selectedZone} 
              onSelectZone={setSelectedZone} 
              tributes={gameState.tributes} 
            />

            {selectedZone ? (
              <div className="p-4 bg-zinc-950 rounded-xl border border-red-900/40 animate-fadeIn">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-red-400">Decrypted Records: {selectedZone}</span>
                  <button 
                    onClick={() => setSelectedZone(null)} 
                    className="text-[9px] text-zinc-500 hover:text-zinc-300 uppercase font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800"
                  >
                    Clear Filter
                  </button>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-sm custom-scrollbar">
                  {filteredLogs.length === 0 ? (
                    <div className="text-zinc-500 text-xs text-center py-6 font-mono">No telemetry captured in this sector.</div>
                  ) : (
                    filteredLogs.map(l => (
                      <div key={l.id} className="p-2.5 bg-zinc-900/60 rounded border border-zinc-850/40 text-zinc-300">
                        {l.text}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 bg-zinc-950/20 rounded-xl">
                💡 Select any sector in the holographic grid above to review activities that occurred there.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8 bg-zinc-900/30 p-4 rounded-xl border border-zinc-850/40">
            {selectedZone && (
              <div className="flex justify-between items-center bg-red-955/10 border border-red-900/30 px-3 py-1.5 rounded-lg text-xs text-red-400">
                <span>Displaying coordinates for: <strong>{selectedZone}</strong></span>
                <button onClick={() => setSelectedZone(null)} className="underline hover:text-white font-bold">Clear Filter</button>
              </div>
            )}
            {Object.entries(groupedLogs).length > 0 ? (
              Object.entries(groupedLogs).reverse().map(([key, logs]) => (
                <div key={key} className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2">{key}</h3>
                  <div className="space-y-2">
                    {logs.map(log => (
                      <div key={log.id} className={`p-3 rounded-lg border transition-all ${log.important ? 'bg-red-955/20 border-red-900/50 text-red-200 shadow-sm shadow-red-950/50' : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-300'}`}>
                        {log.text}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-zinc-505 border border-dashed border-zinc-800 rounded-xl">
                {importantOnly ? 'No important events logged in this phase. Disable filter to view casual activities.' : 'No events have occurred yet. Proceed to start the games!'}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="font-bold uppercase tracking-widest text-zinc-500 text-xs mb-4">Status</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-center">
              <div className="text-3xl font-black text-white">{aliveCount}</div>
              <div className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Alive</div>
            </div>
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-center">
              <div className="text-3xl font-black text-red-500">{deadCount}</div>
              <div className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Deceased</div>
            </div>
          </div>
        </div>

        {gameState.gamemakerMode && gameState.phase !== 'ended' && (
          <div className="bg-zinc-900 border border-red-900/50 rounded-xl p-4 space-y-4">
            <h3 className="font-bold uppercase tracking-widest text-red-500 text-xs flex items-center gap-2">
              <Settings className="w-4 h-4" /> Gamemaker Controls
            </h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Mutt Target</label>
                <select
                  value={muttTargetId}
                  onChange={(e) => setMuttTargetId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded px-2.5 py-1.5 text-xs text-zinc-350 focus:outline-none focus:border-red-500"
                >
                  <option value="">-- Random Tribute --</option>
                  {gameState.tributes.filter(t => t.status === 'alive').map(t => (
                    <option key={t.id} value={t.id}>{t.name} (Dist. {t.district})</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={() => { 
                  simulator.triggerGamemakerEvent('mutt', muttTargetId || undefined); 
                  setGameState({...simulator.getState()}); 
                  setMuttTargetId('');
                }}
                className="w-full py-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 hover:border-red-900/50 text-red-400 rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Skull className="w-4 h-4 text-red-500" /> Release Mutts
              </button>
              <button 
                onClick={() => { simulator.triggerGamemakerEvent('weather'); setGameState({...simulator.getState()}); }}
                className="w-full py-2 bg-zinc-950 hover:bg-zinc-805 border border-zinc-800 rounded text-sm font-semibold transition-colors"
              >
                Trigger Weather Event
              </button>
              <button 
                onClick={() => { simulator.triggerGamemakerEvent('feast'); setGameState({...simulator.getState()}); }}
                className="w-full py-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded text-sm font-semibold transition-colors"
              >
                Announce Feast
              </button>
            </div>
          </div>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="font-bold uppercase tracking-widest text-zinc-500 text-xs mb-4">Tributes</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {sortedSidebarTributes.map(t => {
              const allianceClass = t.status === 'alive' && t.allianceId ? getAllianceBorderClass(t.allianceId) : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600 cursor-pointer';
              return (
                <div 
                  key={t.id} 
                  onClick={() => t.status === 'alive' && setSelectedTribute(t)}
                  className={`p-3 rounded-lg border flex flex-col gap-2 transition-all ${t.status === 'dead' ? 'bg-zinc-950/50 border-zinc-900 opacity-50' : allianceClass}`}
                >
                  <div className="flex justify-between items-center w-full">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={`font-bold text-sm ${t.status === 'dead' ? 'line-through text-zinc-650' : 'text-zinc-300'}`}>{t.name}</div>
                        {t.status === 'alive' && t.allianceId && (
                          <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                            <Users className="w-2.5 h-2.5 text-emerald-400" /> Group
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex gap-2 mt-1">
                        {t.status === 'alive' ? (
                          <>
                            <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-500" /> {t.health}</span>
                            <span className="flex items-center gap-1"><Swords className="w-3 h-3 text-zinc-400" /> {t.kills}</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-blue-400" /> {t.zone}</span>
                          </>
                        ) : (
                          <span>Day {t.dayOfDeath} • {t.causeOfDeath ?? 'Eliminated'}</span>
                        )}
                      </div>
                    </div>
                    {t.status === 'dead' && <Skull className="w-4 h-4 text-zinc-600" />}
                  </div>

                  {/* Sidebar Health Bar */}
                  {t.status === 'alive' && (
                    <div className="w-full bg-zinc-900/80 h-1 rounded-full overflow-hidden border border-zinc-850">
                      <div 
                        className={`h-full ${t.health >= 70 ? 'bg-emerald-500' : t.health >= 35 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${t.health}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedTribute && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTribute(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black text-white">{selectedTribute.name}</h3>
                <div className="flex gap-3 mt-1">
                  <p className="text-zinc-400 text-sm flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> {selectedTribute.zone}
                  </p>
                  {selectedTribute.allianceId && (
                    <p className="text-emerald-400 text-sm flex items-center gap-1">
                      <Users className="w-4 h-4" /> Alliance
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedTribute(null)} className="text-zinc-500 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Vitals & Status</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                    <div className="text-xs text-zinc-500">Health</div>
                    <div className="font-mono text-white">{selectedTribute.health}%</div>
                  </div>
                  <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                    <div className="text-xs text-zinc-500">Hunger</div>
                    <div className="font-mono text-white">{selectedTribute.vitals.hunger}%</div>
                  </div>
                  <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                    <div className="text-xs text-zinc-500">Thirst</div>
                    <div className="font-mono text-white">{selectedTribute.vitals.thirst}%</div>
                  </div>
                  <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                    <div className="text-xs text-zinc-500">Fatigue</div>
                    <div className="font-mono text-white">{selectedTribute.vitals.fatigue}%</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Injuries</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedTribute.injuries).filter(([_, v]) => v).length === 0 ? (
                    <span className="text-sm text-zinc-400">None</span>
                  ) : (
                    Object.entries(selectedTribute.injuries).filter(([_, v]) => v).map(([k]) => (
                      <span key={k} className="px-2 py-1 bg-red-950/30 text-red-500 border border-red-900/50 rounded text-xs uppercase tracking-wider">
                        {k}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Inventory</h4>
                <div className="space-y-2">
                  {selectedTribute.inventory.length === 0 ? (
                    <span className="text-sm text-zinc-400">Empty</span>
                  ) : (
                    selectedTribute.inventory.map((item, i) => (
                      <div key={i} className="flex justify-between items-center bg-zinc-950 p-2 rounded border border-zinc-800">
                        <span className="text-sm text-white">{item.name}</span>
                        <span className="text-xs text-zinc-500 uppercase">{item.type}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Relationships</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {Object.entries(selectedTribute.relationships).length === 0 ? (
                    <span className="text-sm text-zinc-400">None</span>
                  ) : (
                    Object.entries(selectedTribute.relationships).map(([id, val]) => {
                      const other = gameState.tributes.find(t => t.id === id);
                      if (!other) return null;
                      const numVal = val as number;
                      return (
                        <div key={id} className="flex justify-between text-sm">
                          <span className="text-zinc-300">{other.name}</span>
                          <span className={numVal > 0 ? 'text-green-400' : 'text-red-400'}>{numVal > 0 ? `+${numVal}` : numVal}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}function EndScreen({ 
  gameState, 
  onRestart,
  coins,
  betWonMessage
}: { 
  gameState: GameState, 
  onRestart: () => void,
  coins: number,
  betWonMessage: string | null
}) {
  const [activeTab, setActiveTab] = useState<'stats' | 'logs'>('stats');

  const killLeaderboard = [...gameState.tributes]
    .sort((a, b) => b.kills - a.kills)
    .filter(t => t.kills > 0);

  const lastStandingPerDistrict = Array.from({ length: 12 }, (_, i) => {
    const dist = i + 1;
    const distTributes = gameState.tributes.filter(t => t.district === dist);
    const survivor = distTributes.find(t => t.status === 'alive');
    if (survivor) return survivor;
    return [...distTributes].sort((a, b) => (b.dayOfDeath || 0) - (a.dayOfDeath || 0))[0];
  });

  const nonCareers = gameState.tributes.filter(t => !t.isCareer);
  const longestNonCareers = [...nonCareers].sort((a, b) => {
    if (a.status === 'alive' && b.status !== 'alive') return -1;
    if (a.status !== 'alive' && b.status === 'alive') return 1;
    return (b.dayOfDeath || 0) - (a.dayOfDeath || 0);
  }).slice(0, 3);

  const zoneDeaths: Record<string, number> = {};
  gameState.tributes.forEach(t => {
    if (t.status === 'dead') {
      const zone = t.zone || 'Cornucopia';
      zoneDeaths[zone] = (zoneDeaths[zone] || 0) + 1;
    }
  });
  const sortedZones = Object.entries(zoneDeaths).sort((a, b) => b[1] - a[1]);
  const mostDangerousZone = sortedZones[0] ? { name: sortedZones[0][0], count: sortedZones[0][1] } : { name: 'None', count: 0 };

  const causeBreakdown: Record<string, number> = {};
  gameState.tributes.forEach(t => {
    if (t.status === 'dead') {
      const cause = t.causeOfDeath || 'Eliminated';
      let cleanCause = cause;
      if (cause.toLowerCase().includes('bleeding')) cleanCause = 'Bled to death';
      else if (cause.toLowerCase().includes('mutt')) cleanCause = 'Mutt attack';
      else if (cause.toLowerCase().includes('tracker jacker')) cleanCause = 'Tracker Jackers';
      else if (cause.toLowerCase().includes('infection')) cleanCause = 'Sepsis / Infection';
      else if (cause.toLowerCase().includes('dehydration')) cleanCause = 'Dehydration';
      else if (cause.toLowerCase().includes('starvation')) cleanCause = 'Starvation';
      else if (cause.toLowerCase().includes('hypothermia')) cleanCause = 'Hypothermia';
      else if (cause.toLowerCase().includes('poison')) cleanCause = 'Poison berries / water';
      else if (cause.toLowerCase().includes('combat') || cause.toLowerCase().includes('killed') || cause.toLowerCase().includes('slain') || cause.toLowerCase().includes('beaten')) cleanCause = 'Eliminated in Combat';

      causeBreakdown[cleanCause] = (causeBreakdown[cleanCause] || 0) + 1;
    }
  });
  const sortedCauses = Object.entries(causeBreakdown).sort((a, b) => b[1] - a[1]);

  const winner = gameState.tributes.find(t => t.status === 'alive');

  const groupedLogs = gameState.log.reduce((acc, log) => {
    const key = `Day ${log.day} - ${log.phase.charAt(0).toUpperCase() + log.phase.slice(1)}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {} as Record<string, typeof gameState.log>);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="text-center space-y-4">
        <h2 className="text-5xl font-black uppercase text-red-500 tracking-tighter">The Arena Closes</h2>
        <p className="text-zinc-400 text-lg">Detailed debrief and analytics of the simulated games.</p>
        <div className="flex justify-center gap-3 pt-2">
          <button 
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 text-xs uppercase font-bold tracking-widest rounded-lg transition-colors border ${activeTab === 'stats' ? 'bg-zinc-805 text-white border-zinc-700' : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-300'}`}
          >
            Post-Game Stats
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 text-xs uppercase font-bold tracking-widest rounded-lg transition-colors border ${activeTab === 'logs' ? 'bg-zinc-805 text-white border-zinc-700' : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-300'}`}
          >
            Full Chronology
          </button>
          <button 
            onClick={onRestart}
            className="px-5 py-2 text-xs uppercase font-bold tracking-widest rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
          >
            New Battle simulation
          </button>
        </div>
      </div>

      {activeTab === 'logs' ? (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-6">
          <h3 className="text-lg font-black text-white uppercase tracking-wider">Chronicle Archive</h3>
          <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {Object.entries(groupedLogs).reverse().map(([key, logs]) => (
              <div key={key} className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-500 border-b border-zinc-800 pb-1.5 uppercase tracking-widest">{key}</h4>
                <div className="space-y-2">
                  {logs.map(l => (
                    <div key={l.id} className={`p-2.5 rounded text-sm transition-all ${l.important ? 'bg-red-955/20 text-red-100 border-l-2 border-l-red-500 shadow-sm' : 'bg-zinc-950/40 text-zinc-400 border border-zinc-900/40'}`}>
                      {l.text}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
          {betWonMessage && (
            <div className="col-span-1 md:col-span-2 bg-zinc-90 w-full bg-zinc-900 border border-teal-500/30 rounded-xl p-5 flex justify-between items-center gap-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-teal-400 tracking-widest flex items-center gap-1">
                  💰 Capitol Bet Resolution
                </span>
                <p className="text-sm text-zinc-300 font-medium">{betWonMessage}</p>
              </div>
              <div className="bg-zinc-950 px-4 py-2 border border-zinc-850 rounded-lg text-right">
                <div className="text-[9px] text-zinc-500 uppercase font-mono font-bold tracking-wider">Current Account Balance</div>
                <div className="text-xl font-black text-teal-400 font-mono">{coins} COINS</div>
              </div>
            </div>
          )}

          {winner && (
            <div className="col-span-1 md:col-span-2 bg-gradient-to-r from-red-950/10 to-zinc-900 border border-yellow-600/30 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="text-xs uppercase font-extrabold text-yellow-500 tracking-wider">Crowned Victor</span>
                </div>
                <h3 className="text-4xl font-black text-white">{winner.name}</h3>
                <p className="text-zinc-400 text-sm">District {winner.district} • Survived Arena with <span className="text-emerald-400 font-bold">{winner.health}% Vitals</span></p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {winner.traits.map(t => (
                    <span key={t} className="px-2 py-0.5 bg-zinc-950 text-zinc-300 border border-zinc-850 text-[9px] uppercase tracking-wider rounded font-mono">{t}</span>
                  ))}
                </div>
              </div>
              <div className="text-center md:text-right bg-zinc-950 p-4 rounded-xl border border-zinc-850 w-full md:w-auto">
                <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Eliminated Competitors</div>
                <div className="text-5xl font-black text-white font-mono mt-0.5">{winner.kills}</div>
              </div>
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2 flex items-center gap-2">
              <Swords className="w-4 h-4 text-red-500" /> Killer Leaderboard
            </h3>
            <div className="space-y-2">
              {killLeaderboard.length === 0 ? (
                <div className="text-zinc-500 text-xs py-4 text-center">No tributes made combat eliminations in this simulation.</div>
              ) : (
                killLeaderboard.slice(0, 5).map((t, idx) => (
                  <div key={t.id} className="flex justify-between items-center p-2.5 rounded bg-zinc-950 border border-zinc-855 text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="text-zinc-500 font-bold font-mono">#{idx + 1}</span>
                      <span className={`font-semibold ${t.status === 'alive' ? 'text-emerald-400' : 'text-zinc-300'}`}>{t.name}</span>
                      <span className="text-xs text-zinc-500">(Dist. {t.district})</span>
                    </div>
                    <span className="font-mono bg-red-955/20 text-red-400 px-2 py-0.5 border border-red-900/30 rounded text-xs font-bold">{t.kills} KOD</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-5 space-y-5">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-500" /> Hotspot / Lethal Zone
              </h3>
              <div className="mt-2.5 bg-zinc-950 p-3 rounded-lg border border-zinc-850 flex justify-between items-center">
                <div>
                  <div className="font-bold text-white text-base">{mostDangerousZone.name}</div>
                  <div className="text-xs text-zinc-505 mt-0.5">Arena sector with most death incidents</div>
                </div>
                <span className="text-sm font-semibold text-rose-500 bg-rose-955/20 border border-rose-900/40 px-3 py-1 rounded-md">{mostDangerousZone.count} Deaths</span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Elimination Cause Breakdown</h3>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-1 text-xs custom-scrollbar">
                {sortedCauses.map(([cause, count]) => (
                  <div key={cause} className="flex justify-between text-zinc-400 py-1.5 border-b border-zinc-800/60 font-mono">
                    <span className="text-zinc-300">{cause}</span>
                    <span className="text-white font-bold">{count} tributes ({Math.round(count / 24 * 100)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-5 space-y-4 col-span-1 md:col-span-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
              District Last Tribute Standing Survival
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {lastStandingPerDistrict.map((t) => {
                if (!t) return null;
                return (
                  <div key={t.id} className="p-2.5 rounded bg-zinc-950 border border-zinc-850 flex flex-col justify-between min-h-[64px]">
                    <div className="flex justify-between font-bold text-zinc-400">
                      <span>District {t.district}</span>
                      <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-500">
                        {t.status === 'alive' ? 'Victor' : `Day ${t.dayOfDeath}`}
                      </span>
                    </div>
                    <div className={`mt-1 font-semibold truncate ${t.status === 'alive' ? 'text-emerald-400' : 'text-zinc-300'}`}>
                      {t.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-5 space-y-4 col-span-1 md:col-span-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
              Underscore Underdog Achievements (Longest Surviving Non-Careers)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {longestNonCareers.map((t, index) => (
                <div key={t.id} className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-850 flex items-center justify-between text-sm">
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-505 font-bold font-mono text-xs">#{index + 1}</span>
                      <span className={`font-semibold ${t.status === 'alive' ? 'text-emerald-400' : 'text-zinc-300'}`}>{t.name}</span>
                    </div>
                    <p className="text-zinc-550 text-xs mt-0.5">District {t.district} Tribute</p>
                  </div>
                  <span className="text-xs font-mono font-bold bg-zinc-900/50 border border-zinc-800 px-2 py-1 rounded text-zinc-300">
                    {t.status === 'alive' ? 'Survived Arena' : `Died Day ${t.dayOfDeath}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HallOfFameScreen() {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  useEffect(() => {
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem('hungerGamesHoF') || '[]');
      if (!Array.isArray(saved)) saved = [];
    } catch (e) {
      saved = [];
    }
    setEntries(saved);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-5xl font-black uppercase tracking-tighter text-white flex items-center justify-center gap-4">
          <Trophy className="w-12 h-12 text-yellow-500" /> Hall of Fame
        </h2>
        <p className="text-zinc-400 text-lg">The historic, legendary victors of past simulations.</p>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
          No victors saved yet in this timeline. Complete a simulation to crown one!
        </div>
      ) : (
        <div className="grid gap-4">
          {entries.map(entry => (
            <div key={entry.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-2xl font-black text-white flex items-center gap-2">
                    {entry.winnerName}
                  </h3>
                  <div className="text-zinc-400 text-sm mt-1">
                    Crowned Victor of the <span className="text-red-400 font-semibold">{entry.arenaName}</span> arena
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm w-full md:w-auto md:justify-end">
                  <div className="text-center min-w-[60px]">
                    <div className="text-zinc-500 uppercase tracking-widest text-[9px] font-bold">Arena Kills</div>
                    <div className="font-mono text-white text-base">{entry.kills}</div>
                  </div>
                  <div className="text-center min-w-[60px]">
                    <div className="text-zinc-500 uppercase tracking-widest text-[9px] font-bold">Seed</div>
                    <div className="font-mono text-white text-base">{entry.seed}</div>
                  </div>
                  <div className="text-center min-w-[80px]">
                    <div className="text-zinc-500 uppercase tracking-widest text-[9px] font-bold">Crowned On</div>
                    <div className="font-mono text-white text-base">{new Date(entry.date).toLocaleDateString()}</div>
                  </div>
                  <button
                    onClick={() => setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)}
                    className="px-4 py-2 text-xs bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 font-bold uppercase tracking-wider ml-auto md:ml-2"
                  >
                    {expandedEntryId === entry.id ? 'Collapse Details' : 'Verify Archive'}
                  </button>
                </div>
              </div>

              {expandedEntryId === entry.id && (
                <div className="pt-4 border-t border-zinc-800/80 space-y-5 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-850 space-y-2">
                      <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Victor Attributes</h4>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Survival Health:</span>
                        <span className="font-mono text-emerald-400 font-bold">{entry.winnerEndHealth ?? 'N/A'}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-zinc-400 text-sm mr-1">District Rank:</span>
                        <span className="text-white text-xs bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded font-bold">District {entry.winnerDistrict}</span>
                      </div>
                      {entry.winnerTraits && entry.winnerTraits.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {entry.winnerTraits.map(t => (
                            <span key={t} className="px-2 py-0.5 bg-red-950/20 text-red-400 text-[9px] border border-red-900/30 uppercase tracking-widest rounded">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-850 flex flex-col justify-between">
                      <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Simulation Metadata</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                        Full statistics recorded of this exact configuration. Total tally of all other participating tributes.
                      </p>
                      <button 
                        onClick={() => {
                          const conf = confirm('Load this game seed and arena setup again?');
                          if (conf) {
                            window.location.reload(); // Quick reset
                          }
                        }}
                        className="mt-3 text-red-400 hover:text-red-300 text-xs font-semibold text-left"
                      >
                        Copy Simulation Seed ({entry.seed}) →
                      </button>
                    </div>
                  </div>

                  {entry.tributeSummaries && (
                    <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-850 space-y-3">
                      <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Tribute Status & Score List</h4>
                      <div className="max-h-60 overflow-y-auto pr-2 text-sm space-y-2 custom-scrollbar">
                        {entry.tributeSummaries
                          .sort((a, b) => b.kills - a.kills || a.district - b.district)
                          .map((ts, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-zinc-900/40 p-2.5 rounded border border-zinc-800/40">
                              <div>
                                <span className="font-bold text-zinc-200">{ts.name}</span>
                                <span className="text-xs text-zinc-550 ml-2">District {ts.district}</span>
                                {ts.status === 'dead' ? (
                                  <span className="text-xs text-zinc-500 block mt-0.5">
                                    Eliminated Day {ts.dayOfDeath} {ts.causeOfDeath ? `via ${ts.causeOfDeath}` : ''}
                                  </span>
                                ) : (
                                  <span className="text-xs text-emerald-400 block font-bold mt-0.5 flex items-center gap-1">
                                    <Trophy className="w-3 h-3" /> Crowned Victor of Arena
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-bold block">Eliminations</span>
                                <span className="font-mono text-zinc-100 font-bold">{ts.kills}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShareButton({ seed, arenaId, gamemakerMode }: { seed: string, arenaId: string, gamemakerMode: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}?seed=${seed}&arena=${arenaId}&gamemaker=${gamemakerMode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button 
      onClick={handleShare}
      className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-750 text-zinc-350 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5"
    >
      <Share2 className="w-3.5 h-3.5 text-zinc-400" />
      {copied ? 'Copied Link!' : 'Share Run'}
    </button>
  );
}

function VictorInterviewScreen({ gameState, onProceed }: { gameState: GameState, onProceed: () => void }) {
  const winner = gameState.tributes.find(t => t.status === 'alive');
  const interview = gameState.epilogueInterview || [];

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn text-left">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-xs font-extrabold text-yellow-500 uppercase tracking-widest font-mono">
          📡 Live Broadcast from Caesar's Stage
        </div>
        <h2 className="text-4xl font-black uppercase text-white tracking-tight">The Victor's Interview</h2>
        <p className="text-zinc-500 text-sm">Reviewing the psychological and tactical profile of the sole survivor.</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-8">
        <div className="space-y-6">
          {interview.map((qa, idx) => (
            <div key={idx} className="space-y-4 border-b border-zinc-800/60 pb-6 last:border-0 last:pb-0">
              <div className="flex gap-3 text-sm">
                <span className="text-red-500 font-extrabold uppercase tracking-wider font-mono select-none">Caesar:</span>
                <p className="text-zinc-350 font-semibold italic">{qa.question.replace(/^Caesar Flickerman:\s*'/, '').replace(/'$/, '')}</p>
              </div>
              <div className="flex gap-3 text-sm pl-4 border-l border-zinc-700">
                <span className="text-yellow-550 font-extrabold uppercase tracking-wider font-mono select-none">Victor:</span>
                <p className="text-white font-bold">{qa.answer.replace(/^.*:\s*'/, '').replace(/'$/, '')}</p>
              </div>
            </div>
          ))}
          {interview.length === 0 && (
            <div className="text-center text-zinc-600 py-6 font-mono">The stage remains quiet...</div>
          )}
        </div>

        <div className="pt-6 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onProceed}
            className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 text-xs"
          >
            Review Battle Stats <FastForward className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ArenaMap({ gameState, selectedZone, onSelectZone, tributes }: {
  gameState: GameState;
  selectedZone: string | null;
  onSelectZone: (zone: string | null) => void;
  tributes: Tribute[];
}) {
  const zones = gameState.arena.zones;
  const collapsed = gameState.collapsedZones || [];

  return (
    <div className="space-y-4 text-left">
      <div className="flex justify-between items-center">
        <span className="text-xs uppercase font-extrabold text-zinc-500 tracking-widest font-mono">📡 Hologram Arena Feed</span>
        <span className="text-[10px] text-zinc-400 font-mono">Click a sector to isolate logs</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {zones.map((zoneName) => {
          const isCollapsed = collapsed.includes(zoneName);
          const tributesInZone = tributes.filter(t => t.status === 'alive' && t.zone === zoneName);
          const isSelected = selectedZone === zoneName;

          return (
            <button
              key={zoneName}
              onClick={() => onSelectZone(isSelected ? null : zoneName)}
              className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between h-40 ${
                isCollapsed
                  ? 'bg-red-950/10 border-red-900/40 text-red-500/80 cursor-not-allowed'
                  : isSelected
                  ? 'bg-red-500/10 border-red-500 text-white ring-1 ring-red-500/40 z-10'
                  : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
              }`}
            >
              {/* Background Gradient */}
              {isSelected && (
                <div className="absolute inset-0 bg-gradient-to-t from-red-500/5 to-transparent pointer-events-none" />
              )}

              <div className="space-y-1 z-10 w-full">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 font-mono">
                    {isCollapsed ? '🔴 DEFUNCT' : '🟢 ACTIVE'}
                  </span>
                  {tributesInZone.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-500/20 text-red-500 border border-red-500/30 rounded text-[9px] font-black font-mono">
                      {tributesInZone.length} ACT
                    </span>
                  )}
                </div>
                <h4 className="font-extrabold text-xs tracking-tight leading-snug line-clamp-2 mt-2 font-sans">
                  {zoneName}
                </h4>
              </div>

              <div className="space-y-2 z-10 mt-auto w-full">
                {/* Visual Tribute Dots */}
                <div className="flex flex-wrap gap-1 max-h-12 overflow-hidden items-center">
                  {tributesInZone.map(t => (
                    <span
                      key={t.id}
                      title={`${t.name} (District ${t.district})`}
                      className="w-2 h-2 rounded-full bg-red-500 border border-zinc-950 inline-block"
                    />
                  ))}
                  {tributesInZone.length === 0 && !isCollapsed && (
                    <span className="text-[9px] text-zinc-600 font-mono">No telemetry</span>
                  )}
                  {isCollapsed && (
                    <span className="text-[9px] text-red-500 font-mono uppercase tracking-wider font-bold">MUTED</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

