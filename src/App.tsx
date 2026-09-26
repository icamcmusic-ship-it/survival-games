/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { decodeCampaignResult } from './utils/campaignLink';
import { fidelityMessage, fidelityOf, parseInterventionLog } from './utils/replayManifest';
import React, { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Menu, Settings2, Swords, X } from 'lucide-react';
import { ShareButton } from './components/ShareButton';
import { SettingsPanel } from './components/SettingsPanel';
import { SetupScreen } from './screens/SetupScreen';
import { gameActions, gameStore, prefetchEngine, ViewName } from './store/gameStore';
import { initRouter, navigate, pathForView, redirectView, resolveView } from './store/router';
import { setUi, uiStore } from './ui/uiStore';
import { persistenceMode } from './utils/storage';
import { useEscapeLayer } from './ui/useDialogFocus';

/**
 * PERF: only the shell and the setup screen are in the initial chunk.
 *
 * Every screen below depends on the simulation engine and its big flavour and
 * balance tables; none of them can be on screen until a run exists, so they are
 * split out and fetched at the moment the player actually needs them.
 */
const ReapingScreen = lazy(() => import('./screens/ReapingScreen').then(m => ({ default: m.ReapingScreen })));
const GameScreen = lazy(() => import('./screens/GameScreen').then(m => ({ default: m.GameScreen })));
const EndScreen = lazy(() => import('./screens/EndScreen').then(m => ({ default: m.EndScreen })));
const ChronicleScreen = lazy(() => import('./screens/ChronicleScreen').then(m => ({ default: m.ChronicleScreen })));
const HallOfFameScreen = lazy(() => import('./screens/HallOfFameScreen').then(m => ({ default: m.HallOfFameScreen })));
const HowToPlayScreen = lazy(() => import('./screens/HowToPlayScreen').then(m => ({ default: m.HowToPlayScreen })));
const VictorInterviewScreen = lazy(() => import('./screens/VictorInterviewScreen').then(m => ({ default: m.VictorInterviewScreen })));

/** Shown for the moment a split screen chunk is in flight. */
/**
 * §2.14: a skeleton of the destination, not one line of text.
 *
 * The lazy chunk behind this fallback can include the whole engine, so on a
 * cold load the reader sat looking at a single sentence in an otherwise empty
 * page for as long as it took to arrive. A skeleton of roughly the right shape
 * reads as "this is loading" rather than "this is broken".
 */
function ScreenFallback() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="panel p-5 mb-5">
        <div className="skeleton h-6 w-56 mb-3" />
        <div className="skeleton h-3 w-80" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 panel p-5 space-y-3">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4" style={{ width: `${70 - i * 6}%` }} />
            </div>
          ))}
        </div>
        <div className="panel p-4 space-y-2">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton h-12 w-full" />)}
        </div>
      </div>
    </div>
  );
}
import { CommandPalette } from './components/CommandPalette';
import { TributeModal } from './components/TributeModal';
import { useStore } from './store/createStore';
import { prefsStore } from './store/prefsStore';
import { DEFAULT_GAME_CONFIG } from './data/constants';
import { ARENA_DEATH_BUDGET, BLOODBATH } from './data/balance';
import { parseMutators } from './data/mutators';

/** Routes kept inline on the phone header while a run exists. */
const RUN_ROUTES: ViewName[] = ['roster', 'game', 'debrief', 'chronicle'];

export default function App() {
  const gameState = useStore(gameStore, s => s.gameState);
  const view = useStore(gameStore, s => s.view);
  const simulator = useStore(gameStore, s => s.simulator);
  const coins = useStore(gameStore, s => s.coins);
  const betWonMessage = useStore(gameStore, s => s.betWonMessage);
  // A tribute chosen from the command palette opens here rather than inside
  // whichever screen happens to be showing — the palette works from all of them.
  const [paletteTributeId, setPaletteTributeId] = useState<string | null>(null);
  const paletteTribute = paletteTributeId && gameState
    ? gameState.tributes.find(t => t.id === paletteTributeId) ?? null
    : null;
  const isReplayedRun = useStore(gameStore, s => s.isReplayedRun);
  const showSettings = useStore(uiStore, u => u.settingsOpen);
  const setShowSettings = (open: boolean) => setUi({ settingsOpen: open });
  const recap = useStore(uiStore, u => u.recap);
  const [menuOpen, setMenuOpen] = useState(false);
  useEscapeLayer(menuOpen, () => setMenuOpen(false));

  /*
   * AUDIT-11 U2: the header's real height, published as `--header-h` so the
   * broadcast bar and anything else sticky sits under it instead of under a
   * guessed 3.75rem that was wrong the moment the nav wrapped.
   */
  const headerRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const write = () => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
    write();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /*
   * AUDIT-11 §4: on a route change, move focus to the new screen's heading so
   * a screen reader announces where the reader has landed. Not on first load.
   */
  const prevView = useRef(view);
  useEffect(() => {
    if (prevView.current === view) return;
    prevView.current = view;
    // AUDIT-12 U6: a new screen starts at its top — except a deep link with a
    // query (`#/chronicle?day=4`), which scrolls itself to its target.
    if (!window.location.hash.includes('?')) window.scrollTo({ top: 0, behavior: 'auto' });
    let frames = 0;
    let raf = 0;
    const tryFocus = () => {
      const main = document.getElementById('main-content');
      const heading = main?.querySelector<HTMLElement>('h1, h2');
      if (heading && !main?.querySelector('[aria-busy="true"]')) {
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
        return;
      }
      if (frames++ < 60) raf = requestAnimationFrame(tryFocus);
    };
    raf = requestAnimationFrame(tryFocus);
    return () => cancelAnimationFrame(raf);
  }, [view]);

  // §4: the persistent saved / not-saved chip.
  const persistent = React.useMemo(() => persistenceMode() === 'persistent', []);
  /**
   * F02: a share link whose campaign payload did not validate still launches —
   * the seed and rules are fine — but it launches under the receiver's own
   * career, and says so. Silently discarding the campaign while the link
   * advertises an exact replay is the misreport this replaces.
   */
  const linkNotice = useStore(gameStore, s => s.linkNotice);

  // §2.4: the in-app reduced-motion preference, mirrored onto <html> so the
  // stylesheet's own reduced-motion rules apply to it as well as to the OS
  // media query — one set of declarations, two ways to reach them.
  const reduceMotion = useStore(prefsStore, p => p.reduceMotion);
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduceMotion ? 'true' : 'false';
  }, [reduceMotion]);

  // Replay sharing: ?seed=...&arena=...&districtCount=... boots straight into that exact run.
  // The router is started from the same effect, and only after this has run:
  // a replay link decides the screen itself, so the URL is corrected to match
  // the run it just booted rather than the (empty) route in the address bar.
  useEffect(() => {
    let bootedFromLink = false;
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
      // Absent, 'bowl' or unparseable all mean "this setting was not set",
      // which for the age pair is a real and different state from any number.
      const optionalNumParam = (key: string, min: number, max: number) => {
        const raw = params.get(key);
        if (raw === null || raw === 'bowl') return undefined;
        const n = Number(raw);
        if (!Number.isFinite(n)) return undefined;
        return Math.min(max, Math.max(min, n));
      };
      // Ranges mirror the setup screen's sliders — a shared link is untrusted
      // input and must not be able to exceed what the UI itself allows.
      const config = {
        districtCount: Math.round(numParam('districtCount', DEFAULT_GAME_CONFIG.districtCount, 2, 16)),
        hazardRate: numParam('hazardRate', DEFAULT_GAME_CONFIG.hazardRate, 0.25, 2.5),
        betrayalRate: numParam('betrayalRate', DEFAULT_GAME_CONFIG.betrayalRate, 0, 3),
        // The death-mix dials. Absent — which is every link written before they
        // existed — falls back to the defaults, which is what those links
        // always replayed. Ranges mirror the setup screen's sliders, because a
        // shared link is untrusted input.
        naturalDeathRate: numParam('naturalDeathRate', DEFAULT_GAME_CONFIG.naturalDeathRate,
          ARENA_DEATH_BUDGET.minNaturalRate, ARENA_DEATH_BUDGET.maxNaturalRate),
        bloodbathDeathShare: numParam('bloodbathDeathShare', DEFAULT_GAME_CONFIG.bloodbathDeathShare,
          0, BLOODBATH.maxDeathShare),
        arenaDeathShare: numParam('arenaDeathShare', DEFAULT_GAME_CONFIG.arenaDeathShare,
          0, ARENA_DEATH_BUDGET.maxDeathShare),
        sponsorGenerosity: numParam('sponsorGenerosity', DEFAULT_GAME_CONFIG.sponsorGenerosity, 0, 3),
        enableFeast: boolParam('enableFeast', DEFAULT_GAME_CONFIG.enableFeast),
        enableSanity: boolParam('enableSanity', DEFAULT_GAME_CONFIG.enableSanity),
        plainNames: boolParam('plainNames', !!DEFAULT_GAME_CONFIG.plainNames),
        // §2.6: a Vanilla Games link replays vanilla. Links written before the
        // parameter existed read as false, which is what they always were.
        vanillaRules: boolParam('vanillaRules', !!DEFAULT_GAME_CONFIG.vanillaRules),
        // §18 (requests): a one-victor link replays as a one-victor run.
        singleVictor: boolParam('singleVictor', !!DEFAULT_GAME_CONFIG.singleVictor),
        // §8 (requests): the age distribution decides the cast, so a link that
        // dropped it replayed a different set of tributes under the same seed.
        // 'bowl' — and a link written before the parameter existed — means the
        // canon tesserae-weighted draw, which is what every such link had.
        ageMean: optionalNumParam('ageMean', 12, 18),
        ageSpread: optionalNumParam('ageSpread', 0.5, 4),
        // AUDIT-7 §1.1: the sanity block. Absent — which is every link written
        // before this — falls back to the defaults, which is the behaviour
        // those links always replayed. Ranges mirror the setup screen's
        // sliders, because a shared link is untrusted input.
        sanityDrainRate: numParam('sanityDrainRate', DEFAULT_GAME_CONFIG.sanityDrainRate ?? 1, 0.25, 2.5),
        sanityRecoveryRate: numParam('sanityRecoveryRate', DEFAULT_GAME_CONFIG.sanityRecoveryRate ?? 1, 0.25, 2.5),
        sanityStart: numParam('sanityStart', DEFAULT_GAME_CONFIG.sanityStart ?? 100, 40, 100),
        enableHallucinations: boolParam('enableHallucinations', DEFAULT_GAME_CONFIG.enableHallucinations ?? true),
        enableBreakdowns: boolParam('enableBreakdowns', DEFAULT_GAME_CONFIG.enableBreakdowns ?? true),
        // AUDIT-11 §12: the mutator cards. Absent on older links: none.
        mutators: parseMutators(params.get('mutators')),
      };
      // A shared link pins the run's exact Quarter Quell (or explicit lack of
      // one) so it replays the same Games it was copied from — the same
      // mechanism a Hall of Fame replay uses. Links from before this param
      // existed (`null` here) fall through to the ordinary seeded draw.
      const rawQuell = params.get('quell');
      const pinnedQuellId = rawQuell === null ? undefined : (rawQuell === 'none' ? null : rawQuell);
      /*
       * AUDIT-9 B06: a link may carry the record book the run was played
       * under. When it does the run is reproduced; when it does not — which
       * is every link written before this, and every deliberate "play this
       * seed in my campaign" link — the receiver's own career applies, as it
       * always has. `decodeCampaign` validates rather than casts: a link is
       * untrusted input and a malformed payload reads as no history.
       */
      const decoded = decodeCampaignResult(params.get('campaign'));
      const plannedInterventions = parseInterventionLog(params.get('log'));
      /*
       * AUDIT-10 F19: say which of the four kinds of reproduction this is
       * before the Games starts, rather than letting every link imply the
       * strongest one. `exact` is the only one that needs no explanation, so it
       * is the only one that does not raise the banner.
       */
      const fidelityInputs = {
        campaign: decoded.status === 'ok',
        campaignRejected: decoded.status === 'rejected',
        revision: params.get('rev') ?? undefined,
        veteransSeated: Number(params.get('vets') ?? 0) || 0,
        interventions: Number(params.get('acts') ?? 0) || 0,
        // B3-01: how many of them the link actually brought. A log that was
        // truncated to fit, or mangled in transit, carries fewer than the count
        // says — and the manifest is built to report exactly that gap.
        carriedInterventions: plannedInterventions.length,
      };
      const fidelity = fidelityOf(fidelityInputs);
      const notice = decoded.status === 'rejected'
        ? `${decoded.reason ?? 'The campaign attached to this link could not be read.'} ${fidelityMessage(fidelity, fidelityInputs)}`
        : fidelity === 'exact' ? null : fidelityMessage(fidelity, fidelityInputs);
      void gameActions.startGame(urlSeed, urlArena, urlGamemaker, config, true, false, pinnedQuellId, decoded.snapshot, plannedInterventions)
        .then(() => gameActions.setLinkNotice(notice));
      bootedFromLink = true;
      // Consume the replay params so a later refresh doesn't relaunch it.
      window.history.replaceState(null, '', window.location.pathname);
    }
    return initRouter(!bootedFromLink);
    // AUDIT-7 §1.10: the `exhaustive-deps` disable that used to sit here was
    // suppressing nothing — the rule has no complaint about a genuinely
    // mount-only effect with an empty deps array. One of two such directives
    // found the moment a linter was actually pointed at this file.
  }, []);

  // Warm the engine chunk once the shell is up, so pressing Start doesn't pay
  // the download. Deliberately after first paint, and failures are ignored —
  // every entry into the simulation awaits the same cached promise anyway.
  useEffect(() => {
    const id = setTimeout(prefetchEngine, 1500);
    return () => clearTimeout(id);
  }, []);

  // A route can also go stale after load — abandoning a run while sitting on
  // #/arena, say. The router redirects on navigation; this catches the rest,
  // so a screen that has nothing to render never renders as a blank page.
  useEffect(() => {
    const resolved = resolveView(view);
    if (resolved !== view) redirectView(resolved);
  }, [view, gameState]);

  const navItems: Array<{ id: ViewName; label: string; show: boolean }> = [
    { id: 'setup', label: 'New Game', show: true },
    // §(requests 5/6): the reaping is the only roster page left, and it only
    // exists while a cast is waiting to be confirmed. Everything else about
    // the cast is a tab inside the arena.
    { id: 'roster', label: 'Reaping', show: !!gameState && gameState.phase === 'reaping' },
    { id: 'game', label: 'Arena', show: !!gameState && gameState.phase !== 'reaping' && gameState.phase !== 'ended' && gameState.phase !== 'epilogue' },
    // AUDIT-12 U13: the finished Games is the debrief, not the arena.
    { id: 'debrief', label: 'Debrief', show: !!gameState && (gameState.phase === 'ended' || gameState.phase === 'epilogue') },
    { id: 'chronicle', label: 'Chronicle', show: !!gameState && gameState.phase !== 'reaping' },
    { id: 'howToPlay', label: 'How to Play', show: true },
    { id: 'hallOfFame', label: 'Hall of Fame', show: true },
  ];

  return (
    <div className="min-h-screen text-[var(--color-ink-300)] selection:bg-[var(--red)] selection:text-white">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header ref={headerRef} className="app-header sticky top-0 z-30 border-b-[3px] border-[var(--red)]">
        <div className="relative max-w-6xl mx-auto flex justify-between items-center gap-2 sm:gap-3 px-4 py-2.5 lg:py-3.5">
          <h1 className="text-lg sm:text-xl md:text-2xl uppercase tracking-tight flex items-center gap-2 m-0 min-w-0 truncate" style={{ fontFamily: 'var(--font-display)', color: 'var(--chrome-ink)' }}>
            <Swords className="w-5 h-5 text-[var(--red-on-ink)] flex-none" aria-hidden="true" />
            <span className={gameState ? 'sr-only sm:not-sr-only truncate' : 'truncate'}>Survival Games</span>
          </h1>

          <div className="flex gap-1 sm:gap-2 items-center flex-none">
            {isReplayedRun && gameState && (
              // B3-01: a run the player took the controls of is no longer a
              // replay of anybody's Games, and a badge that still says so is
              // the same false claim F19 exists to prevent.
              <span className="chip chip-coin hidden md:inline-flex">
                {gameState.replayBranched ? 'Branched from' : 'Replay'} · {gameState.seed}
              </span>
            )}
            {gameState && (
              // §4: whether this run survives a refresh. `persistenceMode()`
              // is 'session' when storage is blocked (private windows, quota).
              <span
                className={`chip hidden md:inline-flex ${persistent ? '' : 'chip-accent'}`}
                role="status"
                title={persistent ? 'This run autosaves every phase' : 'Storage is unavailable — this run will be lost on refresh'}
                style={persistent ? { color: 'var(--chrome-muted)', borderColor: 'var(--chrome-muted)', background: 'transparent' } : undefined}
              >
                {persistent ? '● Saved' : '○ Not saved'}
              </span>
            )}
            <span className="chip chip-gold" role="status" aria-label={`${coins} Capitol Coins available for wagers`} title="Capitol Coins available for wagers">{coins} <span aria-hidden="true">⨷</span></span>
            {gameState && (
              <span className="hidden md:inline-flex">
              <ShareButton seed={gameState.seed} arenaId={gameState.arena.id} gamemakerMode={gameState.gamemakerMode} config={gameState.baseConfig} quellId={gameState.gamesProfile?.quell?.id ?? null} campaign={gameState.campaign}
                // F19: the two inputs the link cannot carry, counted off the
                // run so the control can describe itself honestly.
                veteransSeated={gameState.veteransSeated?.length ?? 0}
                interventions={gameState.gamemakerCommands ?? 0}
                // B3-01: and the one it now can — the commands themselves.
                interventionLog={gameState.interventionLog} />
              </span>
            )}
            <button
              onClick={() => setShowSettings(true)}
              // AUDIT-7 §2.1: icon-only, so `tap-target` supplies the size.
              className="nav-link px-2 py-1.5 tap-target inline-flex items-center justify-center"
              title="Settings — units, sound, auto-play brakes"
              aria-label="Open settings"
              aria-haspopup="dialog"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            {/* Real links now that screens are real routes. Desktop: inline. */}
            <nav aria-label="Primary" className="hidden lg:flex gap-1 items-center">
              {navItems.filter(i => i.show).map(item => (
                <a
                  key={item.id}
                  href={`#${pathForView(item.id)}`}
                  onClick={() => gameActions.setView(item.id)}
                  aria-current={view === item.id ? 'page' : undefined}
                  className="nav-link px-3 py-1.5 text-mini font-extrabold uppercase tracking-[0.1em] transition-colors no-underline"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            {/* AUDIT-11 §4: below lg the header is one row — logo, coins, the
                run's own routes, and a menu for everything else. */}
            <nav aria-label="Run" className="flex lg:hidden items-center">
              {navItems.filter(i => i.show && RUN_ROUTES.includes(i.id)).map(item => (
                <a
                  key={item.id}
                  href={`#${pathForView(item.id)}`}
                  onClick={() => { gameActions.setView(item.id); setMenuOpen(false); }}
                  aria-current={view === item.id ? 'page' : undefined}
                  className="nav-link px-1.5 min-h-[44px] inline-flex items-center text-micro font-extrabold uppercase tracking-[0.06em] no-underline"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <button
              type="button"
              className="nav-link lg:hidden tap-target inline-flex items-center justify-center px-2 py-1.5"
              aria-expanded={menuOpen}
              aria-controls="app-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen(v => !v)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
          {menuOpen && (
            <nav id="app-menu" aria-label="Primary" className="app-menu lg:hidden">
              {navItems.filter(i => i.show && !RUN_ROUTES.includes(i.id)).map(item => (
                <a
                  key={item.id}
                  href={`#${pathForView(item.id)}`}
                  onClick={() => { gameActions.setView(item.id); setMenuOpen(false); }}
                  aria-current={view === item.id ? 'page' : undefined}
                  className="nav-link text-mini font-extrabold uppercase tracking-[0.1em] no-underline"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {item.label}
                </a>
              ))}
              {gameState && (
                <div className="px-3 py-2 md:hidden flex flex-wrap gap-2 items-center border-t border-[var(--chrome-muted)]/30">
                  <span className="text-micro font-mono uppercase" style={{ color: 'var(--chrome-muted)' }}>
                    {persistent ? '● Autosaved' : '○ Not saved — storage unavailable'}
                  </span>
                  <ShareButton seed={gameState.seed} arenaId={gameState.arena.id} gamemakerMode={gameState.gamemakerMode} config={gameState.baseConfig} quellId={gameState.gamesProfile?.quell?.id ?? null} campaign={gameState.campaign}
                    veteransSeated={gameState.veteransSeated?.length ?? 0}
                    interventions={gameState.gamemakerCommands ?? 0}
                    interventionLog={gameState.interventionLog} />
                </div>
              )}
            </nav>
          )}
        </div>
      </header>

      {/* AUDIT-11 U17: one app-level live region for shortcut announcements,
          so a shortcut that switches screens is still spoken. */}
      <div id="app-announcer" role="status" aria-live="polite" className="sr-only" />

      {/* §2.2: Cmd-K / Ctrl-K, across the whole run. Mounted at the app level
          so it works from any screen, including the ones that have no search. */}
      <CommandPalette gameState={gameState} onSelectTribute={setPaletteTributeId} />
      {/* Not while the arena is on screen: `GameScreen` mounts its own sheet
          for the tribute it has selected, and two `aria-modal` dialogs open at
          once means two focus traps fighting each other and a reader who cannot
          tab out of either. On the arena route the palette hands the id down
          and the arena opens it in the one sheet it already owns. */}
      {/* AUDIT-11 U5: GameScreen is only mounted while the Games are live —
          on the end screen and the victor's interview the app opens it. */}
      {paletteTribute && gameState && !(view === 'game' && gameState.phase !== 'ended' && gameState.phase !== 'epilogue') && (
        <TributeModal
          key={paletteTribute.id}
          tribute={paletteTribute}
          gameState={gameState}
          onClose={() => setPaletteTributeId(null)}
        />
      )}

      <main id="main-content" tabIndex={-1} className="max-w-6xl mx-auto px-4 py-5 lg:py-8">
        {recap && gameState && (
          // §4: a one-line recap after resuming a saved run.
          <div role="status" className="panel p-3 mb-4 flex items-start justify-between gap-3" style={{ borderColor: 'var(--gold-line)', borderWidth: '2px' }}>
            <p className="text-sm text-[var(--color-ink-200)] m-0">{recap}</p>
            <button type="button" className="btn btn-sm flex-none min-h-[28px] px-3" onClick={() => setUi({ recap: null })}>Dismiss</button>
          </div>
        )}
        {linkNotice && (
          <div role="alert" className="panel p-4 mb-5 flex items-start justify-between gap-4"
            style={{ borderColor: 'var(--color-coin-400)', borderWidth: '2px' }}>
            <div className="space-y-1">
              <span className="eyebrow text-[var(--color-coin-400)]">Shared link: what this replays</span>
              <p className="text-sm text-[var(--color-ink-200)] m-0">{linkNotice}</p>
            </div>
            {/* `min-h`/`px` rather than a bare ghost button: `test:ui` holds every
                control to a 24px touch target and a text-only button is under it. */}
            <button type="button" className="btn btn-sm flex-none min-h-[28px] px-3" onClick={() => gameActions.setLinkNotice(null)}>Dismiss</button>
          </div>
        )}
        <Suspense fallback={<ScreenFallback />}>
        {view === 'setup' && (
          <SetupScreen onStart={(seed, arenaId, gamemakerMode, config, forceQuell, pinnedQuellId) => {
            // F19: a Games the player set up themselves inherits no claim from
            // a previous link or relaunch, so the banner goes with it.
            gameActions.setLinkNotice(null);
            setUi({ recap: null });
            void gameActions.startGame(seed, arenaId, gamemakerMode, config, false, forceQuell, pinnedQuellId ?? undefined);
          }} />
        )}

        {view === 'roster' && gameState && gameState.phase === 'reaping' && (
          <ReapingScreen
            tributes={gameState.tributes}
            arenaName={gameState.arenaHidden ? '❓ Arena sealed until the bloodbath' : gameState.arena.name}
            seed={gameState.seed}
            profile={gameState.gamesProfile}
            gameState={gameState}
            onReroll={gameActions.rerollCast}
            onConfirm={gameActions.confirmReaping}
            onCoach={(id, coaching) => { gameActions.setCoaching(id, coaching); }}
            onRig={(id) => { gameActions.setRiggedVictor(id); }}
          />
        )}

        {view === 'howToPlay' && <HowToPlayScreen />}

        {view === 'chronicle' && gameState && (
          <ChronicleScreen gameState={gameState} />
        )}

        {(view === 'game' || view === 'debrief') && gameState && simulator && (
          gameState.phase === 'ended' ? (
            <EndScreen
              gameState={gameState}
              onRestart={() => gameActions.setView('setup')}
              onPlayAgain={() => {
                const seed = Math.random().toString(36).substring(2, 8).toUpperCase();
                void gameActions.startGame(seed, gameState.arena.id, gameState.gamemakerMode, gameState.baseConfig ?? gameState.config);
              }}
              onReplaySeed={() => {
                void gameActions.startGame(gameState.seed, gameState.arena.id, gameState.gamemakerMode, gameState.baseConfig ?? gameState.config, true);
              }}
              onHallOfFame={() => gameActions.setView('hallOfFame')}
              coins={coins}
              betWonMessage={betWonMessage}
              /*
               * AUDIT-9 batch 3 P1: a highlight opens the moment it was
               * derived from. The chronicle already deep-links by day and
               * phase — `#/chronicle?day=4&phase=night` — so the receipt on
               * the end screen lands on the page where it happened rather
               * than at the top of the log.
               */
              onOpenEvidence={evidence => {
                // AUDIT-11 U4: the query travels with the navigation instead
                // of being overwritten by it.
                navigate('chronicle', evidence.day !== undefined && evidence.phase
                  ? `day=${evidence.day}&phase=${encodeURIComponent(evidence.phase)}`
                  : undefined);
              }}
            />
          ) : gameState.phase === 'epilogue' ? (
            <VictorInterviewScreen gameState={gameState} onProceed={gameActions.nextPhase} />
          ) : (
            <GameScreen
              gameState={gameState}
              onNextPhase={gameActions.nextPhase}
              onRunToEnd={gameActions.runToEnd}
              onGamemakerEvent={gameActions.triggerGamemakerEvent}
              paletteTributeId={paletteTributeId}
              onPaletteHandled={() => setPaletteTributeId(null)}
            />
          )
        )}

        {view === 'hallOfFame' && <HallOfFameScreen />}
        </Suspense>
      </main>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      <footer className="max-w-6xl mx-auto px-4 pb-10 text-center">
        <p className="eyebrow">May the odds be ever in your favour</p>
      </footer>
    </div>
  );
}
