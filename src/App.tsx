/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect } from 'react';
import { Swords } from 'lucide-react';
import { ShareButton } from './components/ShareButton';
import { SetupScreen } from './screens/SetupScreen';
import { gameActions, gameStore, prefetchEngine, ViewName } from './store/gameStore';

/**
 * PERF: only the shell and the setup screen are in the initial chunk.
 *
 * Every screen below depends on the simulation engine and its big flavour and
 * balance tables; none of them can be on screen until a run exists, so they are
 * split out and fetched at the moment the player actually needs them.
 */
const ReapingScreen = lazy(() => import('./screens/ReapingScreen').then(m => ({ default: m.ReapingScreen })));
const RosterScreen = lazy(() => import('./screens/RosterScreen').then(m => ({ default: m.RosterScreen })));
const GameScreen = lazy(() => import('./screens/GameScreen').then(m => ({ default: m.GameScreen })));
const EndScreen = lazy(() => import('./screens/EndScreen').then(m => ({ default: m.EndScreen })));
const HallOfFameScreen = lazy(() => import('./screens/HallOfFameScreen').then(m => ({ default: m.HallOfFameScreen })));
const VictorInterviewScreen = lazy(() => import('./screens/VictorInterviewScreen').then(m => ({ default: m.VictorInterviewScreen })));

/** Shown for the moment a split screen chunk is in flight. */
function ScreenFallback() {
  return <div className="empty-state" role="status" aria-live="polite">Loading the arena…</div>;
}
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

  // Replay sharing: ?seed=...&arena=...&districtCount=... boots straight into that exact run.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSeed = params.get('seed');
    const urlArena = params.get('arena');
    const urlGamemaker = params.get('gamemaker') === 'true';
    if (urlSeed && urlArena) {
      const numParam = (key: string, fallback: number, min: number, max: number) => {
        const raw = params.get(key);
        const n = raw === null ? NaN : Number(raw);
        if (!Number.isFinite(n)) return fallback;
        return Math.min(max, Math.max(min, n));
      };
      const boolParam = (key: string, fallback: boolean) => {
        const raw = params.get(key);
        return raw === null ? fallback : raw === 'true';
      };
      // Ranges mirror the setup screen's sliders — a shared link is untrusted
      // input and must not be able to exceed what the UI itself allows.
      const config = {
        districtCount: Math.round(numParam('districtCount', DEFAULT_GAME_CONFIG.districtCount, 2, 12)),
        hazardRate: numParam('hazardRate', DEFAULT_GAME_CONFIG.hazardRate, 0.25, 2.5),
        betrayalRate: numParam('betrayalRate', DEFAULT_GAME_CONFIG.betrayalRate, 0, 3),
        sponsorGenerosity: numParam('sponsorGenerosity', DEFAULT_GAME_CONFIG.sponsorGenerosity, 0, 3),
        enableFeast: boolParam('enableFeast', DEFAULT_GAME_CONFIG.enableFeast),
        enableSanity: boolParam('enableSanity', DEFAULT_GAME_CONFIG.enableSanity),
      };
      void gameActions.startGame(urlSeed, urlArena, urlGamemaker, config, true);
      // Consume the replay params so a later refresh doesn't relaunch it.
      window.history.replaceState(null, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warm the engine chunk once the shell is up, so pressing Start doesn't pay
  // the download. Deliberately after first paint, and failures are ignored —
  // every entry into the simulation awaits the same cached promise anyway.
  useEffect(() => {
    const id = setTimeout(prefetchEngine, 1500);
    return () => clearTimeout(id);
  }, []);

  const navItems: Array<{ id: ViewName; label: string; show: boolean }> = [
    { id: 'setup', label: 'New Game', show: true },
    { id: 'roster', label: 'Roster', show: !!gameState },
    { id: 'game', label: 'Arena', show: !!gameState && gameState.phase !== 'setup' && gameState.phase !== 'reaping' },
    { id: 'hallOfFame', label: 'Hall of Fame', show: true },
  ];

  return (
    <div className="min-h-screen text-[var(--color-ink-300)] selection:bg-[var(--red)] selection:text-white">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="sticky top-0 z-20 bg-[var(--ink)] border-b-[3px] border-[var(--red)]">
        <div className="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-3 px-4 py-3.5">
          <h1 className="text-xl md:text-2xl uppercase tracking-tight flex items-center gap-2 text-white m-0" style={{ fontFamily: 'var(--font-display)' }}>
            <Swords className="w-5 h-5 text-[var(--red)]" />
            Survival Games
          </h1>

          <nav className="flex gap-1 items-center flex-wrap">
            {isReplayedRun && gameState && (
              <span className="chip chip-coin hidden sm:inline-flex">Replay · {gameState.seed}</span>
            )}
            <span className="chip chip-gold" title="Capitol Coins available for wagers">{coins} ⨷</span>
            {gameState && (
              <ShareButton seed={gameState.seed} arenaId={gameState.arena.id} gamemakerMode={gameState.gamemakerMode} config={gameState.baseConfig} />
            )}
            {navItems.filter(i => i.show).map(item => (
              <button
                key={item.id}
                onClick={() => gameActions.setView(item.id)}
                aria-pressed={view === item.id}
                className="px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] transition-colors"
                style={{ fontFamily: 'var(--font-mono)', color: view === item.id ? 'var(--red)' : '#a89a86' }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-6xl mx-auto px-4 py-8">
        <Suspense fallback={<ScreenFallback />}>
        {view === 'setup' && (
          <SetupScreen onStart={(seed, arenaId, gamemakerMode, config) => { void gameActions.startGame(seed, arenaId, gamemakerMode, config); }} />
        )}

        {view === 'roster' && gameState && gameState.phase === 'reaping' && (
          <ReapingScreen
            tributes={gameState.tributes}
            arenaName={gameState.arena.name}
            seed={gameState.seed}
            profile={gameState.gamesProfile}
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
        </Suspense>
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-10 text-center">
        <p className="eyebrow">May the odds be ever in your favour</p>
      </footer>
    </div>
  );
}
