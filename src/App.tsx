/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Swords } from 'lucide-react';
import { ShareButton } from './components/ShareButton';
import { SetupScreen } from './screens/SetupScreen';
import { RosterScreen } from './screens/RosterScreen';
import { GameScreen } from './screens/GameScreen';
import { EndScreen } from './screens/EndScreen';
import { HallOfFameScreen } from './screens/HallOfFameScreen';
import { VictorInterviewScreen } from './screens/VictorInterviewScreen';
import { gameActions, gameStore } from './store/gameStore';
import { useStore } from './store/createStore';

export default function App() {
  const gameState = useStore(gameStore, s => s.gameState);
  const view = useStore(gameStore, s => s.view);
  const simulator = useStore(gameStore, s => s.simulator);
  const coins = useStore(gameStore, s => s.coins);
  const bets = useStore(gameStore, s => s.bets);
  const betWonMessage = useStore(gameStore, s => s.betWonMessage);
  const isReplayedRun = useStore(gameStore, s => s.isReplayedRun);

  // Parse URL search parameters for Seed and Arena to support Replay Sharing!
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSeed = params.get('seed');
    const urlArena = params.get('arena');
    const urlGamemaker = params.get('gamemaker') === 'true';
    if (urlSeed && urlArena) {
      gameActions.startGame(urlSeed, urlArena, urlGamemaker, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <button onClick={() => gameActions.setView('setup')} className={`text-sm uppercase tracking-wider font-semibold ${view === 'setup' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>New Game</button>
            {gameState && <button onClick={() => gameActions.setView('roster')} className={`text-sm uppercase tracking-wider font-semibold ${view === 'roster' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>Roster</button>}
            {gameState && gameState.phase !== 'setup' && <button onClick={() => gameActions.setView('game')} className={`text-sm uppercase tracking-wider font-semibold ${view === 'game' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>Arena</button>}
            <button onClick={() => gameActions.setView('hallOfFame')} className={`text-sm uppercase tracking-wider font-semibold ${view === 'hallOfFame' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>Hall of Fame</button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 py-8">
        {view === 'setup' && <SetupScreen onStart={(seed, arenaId, gamemakerMode) => gameActions.startGame(seed, arenaId, gamemakerMode)} />}
        {view === 'roster' && gameState && (
          <RosterScreen
            tributes={gameState.tributes}
            phase={gameState.phase}
            coins={coins}
            bets={bets}
            setBets={gameActions.setBets}
            setCoins={gameActions.setCoins}
            onProceed={() => {
              if (gameState.phase === 'setup') {
                gameActions.nextPhase();
              }
              gameActions.setView('game');
            }}
          />
        )}
        {view === 'game' && gameState && simulator && (
          gameState.phase === 'ended' ? (
            <EndScreen gameState={gameState} onRestart={() => gameActions.setView('setup')} coins={coins} betWonMessage={betWonMessage} />
          ) : gameState.phase === 'epilogue' ? (
            <VictorInterviewScreen gameState={gameState} onProceed={gameActions.nextPhase} />
          ) : (
            <GameScreen
              gameState={gameState}
              onNextPhase={gameActions.nextPhase}
              simulator={simulator}
              setGameState={(state) => gameStore.setState({ gameState: state })}
              coins={coins}
              bets={bets}
              setCoins={gameActions.setCoins}
              setBets={gameActions.setBets}
            />
          )
        )}
        {view === 'hallOfFame' && <HallOfFameScreen />}
      </main>
    </div>
  );
}
