/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GameState, Arena, Tribute, Phase, HallOfFameEntry } from './models/types';
import { ARENAS } from './data/constants';
import { generateTributes } from './engine/generator';
import { Simulator } from './engine/simulator';
import { Shield, Swords, Skull, Heart, Droplets, Zap, Brain, Eye, User, Settings, Trophy, Play, FastForward, Activity, MapPin, X } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [view, setView] = useState<'setup' | 'roster' | 'game' | 'hallOfFame'>('setup');
  const [simulator, setSimulator] = useState<Simulator | null>(null);

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
            date: new Date().toISOString()
          };
          const existing = JSON.parse(localStorage.getItem('hungerGamesHoF') || '[]');
          localStorage.setItem('hungerGamesHoF', JSON.stringify([entry, ...existing]));
        }
      }
    }
    
    setGameState({ ...simulator.getState() });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-red-900/50">
      <header className="border-b border-zinc-800 bg-zinc-900/50 p-4 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tighter text-red-500 uppercase flex items-center gap-2">
            <Swords className="w-6 h-6" />
            Hunger Games Simulator
          </h1>
          <nav className="flex gap-4">
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
            onProceed={() => {
              handleNextPhase();
              setView('game');
            }} 
          />
        )}
        {view === 'game' && gameState && simulator && (
          <GameScreen 
            gameState={gameState} 
            onNextPhase={handleNextPhase} 
            simulator={simulator}
            setGameState={setGameState}
          />
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

function RosterScreen({ tributes, onProceed }: { tributes: Tribute[], onProceed: () => void }) {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tight text-white">The Tributes</h2>
          <p className="text-zinc-400">Review the roster before the games begin.</p>
        </div>
        <button 
          onClick={onProceed}
          className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center gap-2"
        >
          Begin Training <FastForward className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tributes.map(t => (
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

            <div className="flex flex-wrap gap-1 mt-auto">
              {t.traits.map(trait => (
                <span key={trait} className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-[10px] uppercase tracking-wider rounded border border-zinc-700">
                  {trait}
                </span>
              ))}
            </div>
          </div>
        ))}
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

function GameScreen({ gameState, onNextPhase, simulator, setGameState }: { gameState: GameState, onNextPhase: () => void, simulator: Simulator, setGameState: (state: GameState) => void }) {
  const [selectedTribute, setSelectedTribute] = useState<Tribute | null>(null);

  const aliveCount = gameState.tributes.filter(t => t.status === 'alive').length;
  const deadCount = gameState.tributes.filter(t => t.status === 'dead').length;

  // Group logs by day and phase
  const groupedLogs = gameState.log.reduce((acc, log) => {
    const key = `Day ${log.day} - ${log.phase.charAt(0).toUpperCase() + log.phase.slice(1)}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {} as Record<string, typeof gameState.log>);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">
              {gameState.phase === 'ended' ? 'The Games Have Ended' : `Day ${gameState.day} - ${gameState.phase.toUpperCase()}`}
            </h2>
            <p className="text-zinc-400 text-sm">{gameState.arena.name}</p>
          </div>
          {gameState.phase !== 'ended' && (
            <button 
              onClick={onNextPhase}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center gap-2"
            >
              Proceed <FastForward className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="space-y-8">
          {Object.entries(groupedLogs).reverse().map(([key, logs]) => (
            <div key={key} className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2">{key}</h3>
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className={`p-3 rounded-lg border ${log.important ? 'bg-red-950/20 border-red-900/50 text-red-200' : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-300'}`}>
                    {log.text}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {gameState.log.length === 0 && (
            <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
              No events have occurred yet. Proceed to the next phase.
            </div>
          )}
        </div>
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
            <div className="space-y-2">
              <button 
                onClick={() => { simulator.triggerGamemakerEvent('mutt'); setGameState({...simulator.getState()}); }}
                className="w-full py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded text-sm font-semibold transition-colors"
              >
                Release Mutts
              </button>
              <button 
                onClick={() => { simulator.triggerGamemakerEvent('weather'); setGameState({...simulator.getState()}); }}
                className="w-full py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded text-sm font-semibold transition-colors"
              >
                Trigger Weather Event
              </button>
              <button 
                onClick={() => { simulator.triggerGamemakerEvent('feast'); setGameState({...simulator.getState()}); }}
                className="w-full py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded text-sm font-semibold transition-colors"
              >
                Announce Feast
              </button>
            </div>
          </div>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="font-bold uppercase tracking-widest text-zinc-500 text-xs mb-4">Tributes</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {gameState.tributes.map(t => (
              <div 
                key={t.id} 
                onClick={() => t.status === 'alive' && setSelectedTribute(t)}
                className={`p-3 rounded-lg border flex justify-between items-center transition-colors ${t.status === 'dead' ? 'bg-zinc-950/50 border-zinc-900 opacity-50' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600 cursor-pointer'}`}
              >
                <div>
                  <div className={`font-bold text-sm ${t.status === 'dead' ? 'line-through text-zinc-600' : 'text-zinc-300'}`}>{t.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex gap-2 mt-1">
                    {t.status === 'alive' ? (
                      <>
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-500" /> {t.health}</span>
                        <span className="flex items-center gap-1"><Swords className="w-3 h-3 text-zinc-400" /> {t.kills}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-blue-400" /> {t.zone}</span>
                      </>
                    ) : (
                      <span>Day {t.dayOfDeath}</span>
                    )}
                  </div>
                </div>
                {t.status === 'dead' && <Skull className="w-4 h-4 text-zinc-600" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedTribute && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTribute(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black text-white">{selectedTribute.name}</h3>
                <p className="text-zinc-400 text-sm flex items-center gap-1 mt-1">
                  <MapPin className="w-4 h-4" /> {selectedTribute.zone}
                </p>
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
}

function HallOfFameScreen() {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('hungerGamesHoF') || '[]');
    setEntries(saved);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-5xl font-black uppercase tracking-tighter text-white flex items-center justify-center gap-4">
          <Trophy className="w-12 h-12 text-yellow-500" /> Hall of Fame
        </h2>
        <p className="text-zinc-400 text-lg">The legendary victors of past games.</p>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
          No victors have been crowned yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {entries.map(entry => (
            <div key={entry.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="text-2xl font-black text-white">{entry.winnerName}</h3>
                <div className="text-zinc-400 text-sm mt-1">
                  Victor of {entry.arenaName}
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <div className="text-zinc-500 uppercase tracking-widest text-[10px] font-bold">Kills</div>
                  <div className="font-mono text-white text-lg">{entry.kills}</div>
                </div>
                <div className="text-center">
                  <div className="text-zinc-500 uppercase tracking-widest text-[10px] font-bold">Seed</div>
                  <div className="font-mono text-white text-lg">{entry.seed}</div>
                </div>
                <div className="text-center">
                  <div className="text-zinc-500 uppercase tracking-widest text-[10px] font-bold">Date</div>
                  <div className="font-mono text-white text-lg">{new Date(entry.date).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

