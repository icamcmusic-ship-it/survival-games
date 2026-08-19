/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Swords } from 'lucide-react';
import { ShareButton } from './components/ShareButton';
import { SetupScreen } from './screens/SetupScreen';
import { ReapingScreen } from './screens/ReapingScreen';
import { RosterScreen } from './screens/RosterScreen';
import { GameScreen } from './screens/GameScreen';
import { EndScreen } from './screens/EndScreen';
import { HallOfFameScreen } from './screens/HallOfFameScreen';
import { VictorInterviewScreen } from './screens/VictorInterviewScreen';
import { gameActions, gameStore, ViewName } from './store/gameStore';
import { useStore } from './store/createStore';
import { DEFAULT_GAME_CONFIG } from './data/constants';

export default function App() {
  const gameState = useStore(gameStore, s => s.gameState);
  const view = useStore(gameStore, s => s.view);
  const simulator = useStore(gameStore, s => s.simulator);
  const coins = useStore(gameStore, s => s.coins);
  const bets = useStore(gameStore, s => s.bets);
  const betWonMessage = useStore(gameStore, s => s.betWonMessage);
  const isReplayedRun = useStore(gameStore, s => s.isReplayedRun);

  // Replay sharing: ?seed=...&arena=... boots straight into that exact run.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSeed = params.get('seed');
    const urlArena = params.get('arena');
    const urlGamemaker = params.get('gamemaker') === 'true';
    if (urlSeed && urlArena) {
      gameActions.startGame(urlSeed, urlArena, urlGamemaker, DEFAULT_GAME_CONFIG, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navItems: Array<{ id: ViewName; label: string; show: boolean }> = [
    { id: 'setup', label: 'New Game', show: true },
    { id: 'roster', label: 'Roster', show: !!gameState },
    { id: 'game', label: 'Arena', show: !!gameState && gameState.phase !== 'setup' && gameState.phase !== 'reaping' },
    { id: 'hallOfFame', label: 'Hall of Fame', show: true },
  ];

  return (
    <div className="min-h-screen text-[var(--color-ink-200)] selection:bg-[var(--color-blood-600)] selection:text-white">
      <header className="sticky top-0 z-20 border-b border-[var(--color-ink-800)] bg-[rgba(8,8,11,0.82)] backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-3 px-4 py-3">
          <h1 className="display-title text-xl flex items-center gap-2 text-[var(--color-blood-500)]">
            <Swords className="w-5 h-5" />
            Survival Games
            <span className="hidden sm:inline text-[var(--color-ink-500)] font-normal tracking-normal normal-case text-xs ml-1">
              Capitol Simulation Network
            </span>
          </h1>

          <nav className="flex gap-1.5 items-center flex-wrap">
            {isReplayedRun && gameState && (
              <span className="chip chip-coin hidden sm:inline-flex">Replay · {gameState.seed}</span>
            )}
            <span className="chip chip-coin" title="Capitol Coins available for wagers">{coins} ⨷</span>
            {gameState && (
              <ShareButton seed={gameState.seed} arenaId={gameState.arena.id} gamemakerMode={gameState.gamemakerMode} />
            )}
            {navItems.filter(i => i.show).map(item => (
              <button
                key={item.id}
                onClick={() => gameActions.setView(item.id)}
                aria-pressed={view === item.id}
                className="seg-item"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {view === 'setup' && (
          <SetupScreen onStart={(seed, arenaId, gamemakerMode, config) => gameActions.startGame(seed, arenaId, gamemakerMode, config)} />
        )}

        {view === 'roster' && gameState && gameState.phase === 'reaping' && (
          <ReapingScreen
            tributes={gameState.tributes}
            arenaName={gameState.arena.name}
            seed={gameState.seed}
            onReroll={gameActions.rerollCast}
            onConfirm={gameActions.confirmReaping}
          />
        )}

        {view === 'roster' && gameState && gameState.phase !== 'reaping' && (
          <RosterScreen
            tributes={gameState.tributes}
            phase={gameState.phase}
            coins={coins}
            bets={bets}
            setBets={gameActions.setBets}
            setCoins={gameActions.setCoins}
            onProceed={() => {
              if (gameState.phase === 'setup') gameActions.nextPhase();
              gameActions.setView('game');
            }}
          />
        )}

        {view === 'game' && gameState && simulator && (
          gameState.phase === 'ended' ? (
            <EndScreen
              gameState={gameState}
              onRestart={() => gameActions.setView('setup')}
              coins={coins}
              betWonMessage={betWonMessage}
            />
          ) : gameState.phase === 'epilogue' ? (
            <VictorInterviewScreen gameState={gameState} onProceed={gameActions.nextPhase} />
          ) : (
            <GameScreen
              gameState={gameState}
              onNextPhase={gameActions.nextPhase}
              onRunToEnd={gameActions.runToEnd}
              onGamemakerEvent={gameActions.triggerGamemakerEvent}
            />
          )
        )}

        {view === 'hallOfFame' && <HallOfFameScreen />}
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-10 text-center">
        <p className="eyebrow">May the odds be ever in your favour</p>
      </footer>
    </div>
  );
}
