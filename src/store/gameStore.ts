import { InterviewPersona, GameState, GameConfig, HallOfFameEntry, CampaignSnapshot, InterventionRecord } from '../models/types';
import { Bet, REWIND_PERSIST, SAVED_RUN_SPEC, SAVE_SLOT_SPECS, SavedRun, SideBet, SideBetKind, packRewind } from '../utils/saveMigrations';
import { SIDE_BETS } from '../data/balance';
import { SideBetTarget, SideQuote, priceSideBet, quoteSideMarkets, settleSideBet, sideBettingOpen, marketRulesOf } from '../engine/sideMarkets';
import { STARTING_COINS, readCoins, writeCoins } from '../utils/prefsStorage';
import { clearAllStoredData } from '../utils/storage';
import { readHallOfFame, writeHallOfFame } from '../utils/hofStorage';
import { WriteResult, persistenceMode, readStored, removeStored, tryWriteStored } from '../utils/storage';
import { snapshotState } from '../utils/snapshot';
import { ARENAS, DEFAULT_GAME_CONFIG } from '../data/constants';
import { QUELLS } from '../data/gamesProfile';
import { RNG } from '../utils/rng';
import type { Simulator } from '../engine/simulator';
import type { GamemakerEventType } from '../engine/gamemaker';
import { createStore } from './createStore';
import { PanemRecords, campaignSnapshotOf, RunOutcome, addPatronDistrict, buyArena, clearPanem, commitRun, dropPatronDistrict, noteStipendTaken, readPanem } from '../utils/panemStorage';
import type { SponsorResult } from '../engine/playerSponsor';
import { readPrefs } from './prefsStore';
import { seatVeterans } from '../engine/veterans';
import { COIN_ECONOMY, VETERANS } from '../data/balance';

/**
 * PERF: the engine is loaded on demand.
 *
 * `engine/engineBundle` pulls in the simulator and the big flavour/balance
 * tables — ~500 kB of the old single chunk — none of which the setup screen
 * needs. Every path that can start a run (fresh start, seeded replay from a
 * share link, Hall-of-Fame relaunch, resuming a save) awaits `loadEngine()`
 * first, so the boundary can only ever be crossed with the module present.
 *
 * Once resolved the module is cached in `engine`, so the synchronous callers
 * that only ever run *during* a Games (reroll, phase advance, sponsoring) can
 * keep reading it directly.
 */
type EngineModule = typeof import('../engine/engineBundle');
let engine: EngineModule | null = null;
let enginePromise: Promise<EngineModule> | null = null;

function loadEngine(): Promise<EngineModule> {
    if (engine) return Promise.resolve(engine);
    if (!enginePromise) {
        enginePromise = import('../engine/engineBundle').then(mod => {
            engine = mod;
            return mod;
        }).catch(err => {
            // Let a later attempt retry rather than caching the failure forever.
            enginePromise = null;
            throw err;
        });
    }
    return enginePromise;
}

/** Kicks off the engine fetch without waiting for it — used to warm the chunk
 *  while the player is still reading the setup screen. */
export function prefetchEngine() {
    void loadEngine().catch(() => { /* the real load path reports failures */ });
}

export type ViewName = 'setup' | 'roster' | 'game' | 'chronicle' | 'hallOfFame' | 'howToPlay';

/**
 * `Bet` and `SavedRun` are declared in `utils/saveMigrations` (with the schema
 * that repairs them on load) and re-exported here so existing importers of
 * `gameStore` are unaffected.
 */
export type { Bet, SavedRun, SideBet, SideBetKind };

export interface GameStoreState {
    gameState: GameState | null;
    simulator: Simulator | null;
    view: ViewName;
    coins: number;
    bets: Record<string, Bet>;
    /** §6.8: proposition bets settled from the run itself. */
    sideBets: SideBet[];
    betWonMessage: string | null;
    isReplayedRun: boolean;
    /** Guards against paying out the same wager twice (e.g. Run to End then Proceed). */
    betsResolved: boolean;
    /** Guards against writing the same victory to the Hall of Fame twice. */
    hofSaved: boolean;
    /**
     * Set when the archive write for the run that just ended did not land —
     * the origin is at its storage quota, or storage is unavailable. The
     * saved-run writer degrades in four stages; the archive has one shot, and
     * the end screen has to say when it missed rather than lose the victory
     * silently.
     */
    /**
     * How the Hall-of-Fame write went, when it was anything other than
     * durably on disk. 'session' means it was accepted by the in-memory
     * stand-in and will not survive a reload — the end screen says so rather
     * than reporting a successful archive (F03).
     */
    hofWriteFailed: Exclude<WriteResult, 'ok'> | null;
    /**
     * AUDIT-10 F02: why a shared link's campaign was not applied.
     *
     * Set at boot, before React renders, by the link handler in `App`. It lives
     * here rather than in component state because the decision is made once
     * during start-up and the banner that reports it must not be a `setState`
     * fired from inside a mount effect.
     */
    linkNotice: string | null;
    /** REPLAY-03: everything that carries between runs. */
    panem: PanemRecords;
    /** What the run that just finished unlocked or beat, for the end screen. */
    lastRunOutcome: RunOutcome | null;
    /** Non-null while `runToEnd()` is fast-forwarding, for the progress readout. */
    runProgress: RunProgress | null;
    /**
     * §10.5: Hall of Fame entry ids picked for a Grudge Match — up to two past
     * victors who will be reaped again into the next run started. Held in the
     * store rather than threaded through `startGame`'s signature, which is
     * called from five places that have nothing to do with this.
     */
    grudgeMatchIds: string[];
}

/** Live counters for the Run-to-End progress readout. */
export interface RunProgress {
    day: number;
    phase: GameState['phase'];
    turns: number;
    logLines: number;
    tributesAlive: number;
    /**
     * U-4: the stakes, not just the counters. The tributes the player has
     * wagered on, and whether each is still breathing — losing your bet
     * during a skip should not be silent until the end screen.
     */
    wagered: Array<{ name: string; district: number; alive: boolean }>;
}

const BROKE_THRESHOLD = COIN_ECONOMY.brokeThreshold;
/** §6.2: cost of becoming (or changing) a district's standing patron. */
const PATRON_COST = COIN_ECONOMY.patronBaseCost;
const PATRON_TRUST_BONUS = 12;

/**
 * §9 (audit): what the next stipend is worth.
 *
 * A flat 250 every time a player went broke meant the economy had no failure
 * state at all — coins were a formality after ten runs and the odds model
 * underneath the betting layer stopped mattering. Each stipend taken makes
 * the next one smaller, down to a floor that keeps the feature alive without
 * keeping the player solvent.
 */
function stipendAmount(): number {
    const taken = readPanem().stipendsTaken ?? 0;
    return Math.max(
        COIN_ECONOMY.stipendFloor,
        Math.round(COIN_ECONOMY.stipendBase * Math.pow(COIN_ECONOMY.stipendTaper, taken)),
    );
}

/**
 * §9 (audit): how many recently-played arenas the sealed draw skips. Eight is
 * the same window `recentRuns` already keeps, so this needs no storage of its
 * own, and it is well under the forty-one entries in the pool.
 */
const SEALED_DRAW_NO_REPEAT = 8;

/** Ordinal for a run number, so a returning victor's Games has a year on it. */
function ordinalRun(n: number): string {
    const rem100 = n % 100;
    if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
    switch (n % 10) {
        case 1: return `${n}st`;
        case 2: return `${n}nd`;
        case 3: return `${n}rd`;
        default: return `${n}th`;
    }
}

/** §9 (audit): what the nth standing patronage costs, counting the ones already bought. */
export function patronCostFor(owned: number): number {
    return Math.round(COIN_ECONOMY.patronBaseCost * Math.pow(COIN_ECONOMY.patronCostGrowth, owned));
}

/**
 * UX-01: an in-progress run is autosaved after every phase, so a refresh or a
 * closed tab doesn't erase an 8-day chronicle. Finished runs aren't worth
 * resuming, so they don't get saved.
 *
 * The payload carries a schema version and is normalised on read (see
 * `utils/saveMigrations`), so a save written by an older build — one whose
 * `Tribute` predates half the fields the current engine reads — resumes with
 * every field defaulted rather than relying on `??` at each call site.
 */
function readSavedRun(): SavedRun | null {
    return readStored(SAVED_RUN_SPEC);
}

/**
 * The chronicle is the run's whole point, so the save keeps all of it.
 *
 * It used to be truncated to the last 200 lines, which meant every
 * refresh-and-resume silently threw away the opening days of the narrative.
 * The full log is written instead; only if localStorage actually refuses the
 * payload do we fall back through progressively shorter tails, so a save near
 * the ~5 MB origin quota degrades instead of failing outright.
 */
const LOG_TAIL_FALLBACKS = [4000, 2000, 800, 200];

/** The note on the rolling autosave, kept in memory so the 2s rewrite does not erase it. */
let autosaveNote: string | undefined;

function writeSave() {
    const { gameState, bets, sideBets, betsResolved, hofSaved, isReplayedRun } = gameStore.getState();
    if (!gameState || gameState.phase === 'ended') {
        clearSavedRun();
        return;
    }
    // Full log first (the chronicle is the run's whole point), through the
    // versioned envelope, falling back through shorter tails only on a
    // genuine quota refusal — `tryWriteStored` reports the difference between
    // "won't fit" (retry smaller) and "storage unavailable" (stop).
    const savedAt = new Date().toISOString();
    const attempt = (log: GameState['log'], rewindDepth: number) => tryWriteStored(SAVED_RUN_SPEC, {
        gameState: log === gameState.log ? gameState : { ...gameState, log },
        // §2.2: the undo stack rides along, so a refresh mid-run no longer
        // resumes with the history gone. `packRewind` shares this payload's
        // chronicle with the checkpoints instead of writing it again per
        // checkpoint — see its comment for why that is exact.
        ...packRewind(rewindDepth > 0 ? rewindStack.slice(-rewindDepth) : [], log),
        bets, sideBets, betsResolved, hofSaved, isReplayedRun, savedAt,
        note: autosaveNote,
    } as SavedRun);

    // Each checkpoint is a whole state, so the rewind tail is the most
    // expensive optional thing in the payload — and the cheapest to lose.
    // It degrades first, before a single line of chronicle is dropped.
    const depths = [...new Set([REWIND_PERSIST, 1, 0].map(d => Math.min(d, rewindStack.length)))];
    for (const depth of depths) {
        if (attempt(gameState.log, depth) !== 'quota') return;
    }

    for (const cap of LOG_TAIL_FALLBACKS) {
        if (gameState.log.length <= cap) continue;
        if (attempt(gameState.log.slice(-cap), 0) !== 'quota') return;
    }
    // Even the shortest tail won't fit — leave whatever save already exists
    // rather than clobbering it with a failed write.
}

/**
 * Autosaving on every phase advance was a synchronous main-thread write every
 * 60 ms at the fastest speed setting. A trailing debounce loses at most a
 * couple of seconds of progress on a crash, which a phase-based sim shrugs off.
 */
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistRun() {
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
        persistTimer = null;
        writeSave();
    }, 2000);
}

/** A pending debounced write, written now. */
function flushPersist() {
    if (persistTimer === null) return;
    clearTimeout(persistTimer);
    persistTimer = null;
    writeSave();
}

// The debounce was accepted as "a couple of seconds lost on a crash", which is
// fine — but closing the tab is not a crash, and it lost the same two seconds
// every time. `pagehide` is the last reliable moment to write; hidden-tab is
// the cheap one to write early on.
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushPersist);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPersist(); });
}

function clearSavedRun() {
    // A debounced write pending from before the clear must not fire after it
    // and resurrect the save.
    if (persistTimer !== null) {
        clearTimeout(persistTimer);
        persistTimer = null;
    }
    // localStorage access itself throws in Safari Private Browsing and
    // sandboxed iframes; removeStored absorbs that. This is called from
    // startGame, so an unguarded throw here blocked starting the game.
    removeStored(SAVED_RUN_SPEC);
}

/** A one-line description of a saved run, for the slot cards. */
export interface SlotSummary {
    slot: number;
    savedAt: string;
    seed: string;
    arenaName: string;
    arenaHidden: boolean;
    phase: GameState['phase'];
    day: number;
    alive: number;
    note?: string;
}

function summarize(slot: number, saved: SavedRun): SlotSummary {
    return {
        slot,
        savedAt: saved.savedAt,
        note: saved.note,
        seed: saved.gameState.seed,
        arenaName: saved.gameState.arena.name,
        arenaHidden: !!saved.gameState.arenaHidden,
        phase: saved.gameState.phase,
        day: saved.gameState.day,
        alive: saved.gameState.tributes.filter(t => t.status === 'alive').length,
    };
}

/**
 * §2.6: an in-run "step back one phase". Every phase advance snapshots the
 * state it left behind (bounded ring, module-level so React never diffs it);
 * stepping back rebuilds the simulator from the snapshot. Deliberately not
 * usable once the run has ended — bets and records have already committed.
 */
const REWIND_CAP = 16;
let rewindStack: GameState[] = [];

function pushRewind(state: GameState) {
    rewindStack.push(snapshotState(state));
    if (rewindStack.length > REWIND_CAP) rewindStack.shift();
}

function clearRewind() {
    rewindStack = [];
}

/**
 * §2.2: adopt the checkpoints that came back with a resumed save.
 *
 * The stack used to be wiped on resume because it was never written down:
 * a refresh mid-run resumed the chronicle and silently dropped every undo.
 * Only the last `REWIND_PERSIST` survive a reload (see `writeSave`), so the
 * button comes back working but shallower — which the UI says out loud
 * rather than leaving the player to discover.
 */
function restoreRewind(snaps: GameState[] | undefined) {
    rewindStack = (snaps ?? []).slice(-REWIND_CAP);
}

function saveHallOfFame(state: GameState): WriteResult {
    const survivors = state.tributes.filter(t => t.status === 'alive');
    const winner = survivors[0];
    // §7.1: a dual victory is archived under both names.
    const jointName = survivors.length === 2 ? `${survivors[0].name} & ${survivors[1].name}` : undefined;
    // A Games nobody survived used to return here, so the run vanished from the
    // archive entirely — the rarest outcome in the game was also the only one
    // with no record of it. A wipeout is archived as its own kind of entry.
    const entry: HallOfFameEntry = {
        id: `${state.seed}-${Date.now().toString(36)}`,
        seed: state.seed,
        arenaName: state.arena.name,
        arenaId: state.arena.id,
        quellId: state.gamesProfile?.quell?.id ?? null,
        config: state.baseConfig,
        noVictor: !winner,
        // REQUEST: a fixed Games is archived as one. A record book that cannot
        // tell a crown that was won from one that was arranged is worse than no
        // record book.
        rigged: state.riggedVictorId !== undefined ? true : undefined,
        winnerName: jointName ?? winner?.name ?? 'No victor',
        winnerDistrict: winner?.district ?? 0,
        kills: winner?.kills ?? 0,
        date: new Date().toISOString(),
        winnerTraits: winner?.traits ?? [],
        winnerEndHealth: winner?.health ?? 0,
        tributeSummaries: state.tributes.map(t => ({
            name: t.name,
            district: t.district,
            kills: t.kills,
            status: t.status,
            causeOfDeath: t.causeOfDeath,
            dayOfDeath: t.dayOfDeath
        }))
    };
    // Keep the archive bounded — storage quota is not infinite. writeHallOfFame
    // applies the cap (honouring player pins); a full or unavailable store is
    // reported rather than swallowed, so the end screen can say the crown
    // was not archived.
    return writeHallOfFame([entry, ...readHallOfFame()]);
}

export const gameStore = createStore<GameStoreState>({
    gameState: null,
    simulator: null,
    view: 'setup',
    coins: readCoins(),
    bets: {},
    sideBets: [],
    betWonMessage: null,
    isReplayedRun: false,
    betsResolved: false,
    hofSaved: false,
    hofWriteFailed: null,
    linkNotice: null,
    panem: readPanem(),
    lastRunOutcome: null,
    grudgeMatchIds: [],
    runProgress: null,
});

/** Deep clone so React sees new object identities all the way down the tree. */
const snapshot = snapshotState;

function commitVictory(state: GameState) {
    const { hofSaved } = gameStore.getState();
    if (hofSaved) return;
    const archived = saveHallOfFame(state);
    // REPLAY-03/04: the record book and the discovery layer both fold in a
    // finished run here, behind the same double-commit guard the archive uses.
    const outcome = commitRun(state);
    gameStore.setState({
        hofSaved: true,
        hofWriteFailed: archived !== 'ok' ? archived : null,
        panem: outcome.records,
        lastRunOutcome: outcome,
    });
}

/** §6.8: settles the proposition book from the finished run's own state. */
function settleSideBets(state: GameState, sideBets: SideBet[]): { winnings: number; lines: string[] } {
    let winnings = 0;
    const lines: string[] = [];
    sideBets.forEach(bet => {
        const { won, push, label } = settleSideBet(state, bet);
        // §6.1: a counting market whose line lands exactly on the result is a
        // push — the stake comes back rather than being swept.
        if (push) {
            winnings += bet.stake;
            lines.push(`Your side wager on ${label} lands exactly on the line: ${bet.stake} coins returned.`);
            return;
        }
        if (won) {
            const payout = Math.floor(bet.stake * bet.mult);
            winnings += payout;
            lines.push(`Your side wager on ${label} lands: ${bet.stake} coins pay ${payout} at ${bet.mult.toFixed(1)}x.`);
        } else {
            lines.push(`Your ${bet.stake}-coin side wager on ${label} does not come in.`);
        }
    });
    return { winnings, lines };
}

function resolveBets(state: GameState) {
    const { bets, sideBets, coins: coinsAtStart, betsResolved, lastRunOutcome } = gameStore.getState();
    if (betsResolved) return;
    const side = settleSideBets(state, sideBets);
    // §20 (requests): what the run's first-time achievements are worth. Paid
    // here rather than in `commitRun` because this is where the wallet lives,
    // and behind the same `betsResolved` guard as everything else on this path
    // so a re-render can never pay for the same discoveries twice.
    const earned = lastRunOutcome?.achievementCoins ?? 0;
    if (side.winnings + earned > 0) gameActions.setCoins(coinsAtStart + side.winnings + earned);
    const achievementLine = earned > 0
        ? [`The Capitol pays ${earned} Capitol Coins for ${lastRunOutcome!.newAchievements.length} first-time achievement${lastRunOutcome!.newAchievements.length === 1 ? '' : 's'}.`]
        : [];
    if (side.lines.length > 0 || achievementLine.length > 0) {
        gameStore.setState({ betWonMessage: [...side.lines, ...achievementLine].join(' '), sideBets: [] });
    }
    const coins = gameStore.getState().coins;
    if (Object.keys(bets).length === 0) {
        gameStore.setState({ betsResolved: true });
        // A player who went broke sponsoring parachutes rather than wagering
        // still needs the stipend — the early return used to skip it, which
        // recreated the exact permanently-broke state it was written to fix.
        const balance = gameStore.getState().coins;
        if (balance < BROKE_THRESHOLD) {
            const stipend = stipendAmount();
            gameActions.setCoins(balance + stipend);
            gameStore.setState({ panem: noteStipendTaken() });
            gameStore.setState({
                betWonMessage: `The Capitol extends a ${stipend}-coin stipend so you can play the next Games.`,
            });
        }
        return;
    }

    // §7.1: a dual victory pays a wager on either victor — the book paid out
    // on "comes home", and both of them did.
    const winners = state.tributes.filter(t => t.status === 'alive' && bets[t.id]);
    if (winners.length > 0) {
        const payouts = winners.map(w => ({ w, winnings: Math.floor(bets[w.id].stake * bets[w.id].mult) }));
        const total = payouts.reduce((sum, p) => sum + p.winnings, 0);
        gameActions.setCoins(coins + total);
        gameStore.setState({
            betWonMessage: [
                ...payouts.map(({ w, winnings }) => `${w.name} of District ${w.district} came home. Your ${bets[w.id].stake}-coin wager pays out ${winnings} Capitol Coins at ${bets[w.id].mult.toFixed(1)}x.`),
                ...side.lines,
                ...achievementLine,
            ].join(' '),
            betsResolved: true,
        });
    } else {
        const staked = Object.values(bets).reduce((a, b) => a + b.stake, 0);
        gameStore.setState({
            betWonMessage: [`None of your ${staked} coins came back. The Capitol thanks you for your contribution.`, ...side.lines, ...achievementLine].join(' '),
            betsResolved: true,
        });
    }

    // A broke player could never wager again, which quietly removed a whole
    // feature from the game. The Capitol grants a stipend instead.
    const balance = gameStore.getState().coins;
    if (balance < BROKE_THRESHOLD) {
        const stipend = stipendAmount();
        gameActions.setCoins(balance + stipend);
        gameStore.setState({ panem: noteStipendTaken() });
        gameStore.setState(s => ({
            betWonMessage: `${s.betWonMessage} The Capitol extends a ${stipend}-coin stipend so you can play the next Games.`,
        }));
    }
}

/**
 * Run-to-End fast-forward, chunked.
 *
 * `RUN_BATCH_SIZE` turns run back-to-back, then the loop hands the thread back
 * so React can paint the progress readout and the Cancel button stays live.
 * 20 is small enough that the longest single batch is a few milliseconds and
 * large enough that the yields don't dominate the run.
 */
const RUN_BATCH_SIZE = 20;

interface ActiveRun {
    cancelled: boolean;
    simulator: Simulator;
}

/** At most one fast-forward may be in flight; this is the token for it. */
let activeRun: ActiveRun | null = null;

/**
 * Yields to the event loop. `setTimeout(0)` (rather than a microtask) is
 * deliberate: a microtask would drain before paint and reproduce the freeze.
 */
function yieldToBrowser(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Stops any in-flight fast-forward. Also called whenever a run is replaced or
 * abandoned, so navigating away can't leave a zombie loop stepping a simulator
 * nothing is looking at any more.
 */
function cancelRunToEnd() {
    if (!activeRun) return;
    activeRun.cancelled = true;
    // Released immediately so the player can start another run at once; the
    // abandoned loop's `finally` sees the token has moved on and stands down.
    activeRun = null;
    gameStore.setState({ runProgress: null });
}

export const gameActions = {
    /** F02: record, or clear, why a shared link's campaign was not applied. */
    setLinkNotice(linkNotice: string | null) {
        gameStore.setState({ linkNotice });
    },

    setView(view: ViewName) {
        // Leaving the game view abandons any fast-forward in progress.
        if (view !== 'game') cancelRunToEnd();
        gameStore.setState({ view });
    },

    setBets(bets: Record<string, Bet> | ((prev: Record<string, Bet>) => Record<string, Bet>)) {
        gameStore.setState(s => ({ bets: typeof bets === 'function' ? bets(s.bets) : bets }));
    },

    /**
     * §6.8: place a proposition bet. Open only while the ordinary book is —
     * before the gong. Multipliers are fixed (SIDE_BETS in balance.ts).
     */
    placeSideBet(kind: SideBetKind, stake: number, targetId?: string, target: SideBetTarget = {}): boolean {
        const { gameState, coins, sideBets } = gameStore.getState();
        // AUDIT-9 B14: one predicate, shared with the roster screen. This
        // used to name `setup` and `reaping` only — the two phases that
        // existed before the pre-Games were split into stages — so every
        // button the UI drew in between returned false and the click ignored
        // it.
        if (!gameState || !sideBettingOpen(gameState.phase)) return false;
        if (stake <= 0 || coins < stake) return false;
        // §6.1: the price comes off the live board, not a fixed table — an
        // unpriceable wager (first blood on nobody, a district with no
        // tributes left) is simply refused.
        const quote = priceSideBet(
            kind, gameState.tributes,
            { ...target, targetId: targetId ?? target.targetId },
            // AUDIT-9 B17: and an ineligible contract is refused at purchase,
            // not merely hidden — the board is a view, the price is the gate.
            marketRulesOf(gameState),
        );
        if (!quote) return false;
        gameActions.setCoins(coins - stake);
        gameStore.setState({
            sideBets: [...sideBets, {
                kind, stake, mult: quote.mult,
                targetId: quote.targetId, targetDistrict: quote.targetDistrict, line: quote.line,
            }],
        });
        persistRun();
        return true;
    },

    /** §6.1: the live proposition board, for a UI that wants to show what is on offer. */
    sideMarketBoard(): SideQuote[] {
        const { gameState } = gameStore.getState();
        // AUDIT-9 B17: the board is priced against the rules this run is
        // executing, so a contract it cannot settle is never offered.
        return gameState ? quoteSideMarkets(gameState.tributes, marketRulesOf(gameState)) : [];
    },

    /**
     * §6.8: cash out a standing victory wager early, at its current implied
     * value (stake x locked multiplier x live win probability), less the
     * book's cash-out margin. Uses the engine's live odds.
     */
    cashOutBet(tributeId: string): number {
        const { gameState, bets, coins, betsResolved } = gameStore.getState();
        const bet = bets[tributeId];
        if (!gameState || !bet || betsResolved || !engine || gameState.phase === 'ended') return 0;
        const tribute = gameState.tributes.find(t => t.id === tributeId);
        if (!tribute) return 0;
        // AUDIT-9 B15: the store refuses an invalid cash-out on its own
        // authority rather than trusting the odds engine to have floored the
        // price at something harmless. A dead contestant's wager is lost, not
        // tradeable, and that has to be true even if a quote says otherwise.
        if (tribute.status !== 'alive') return 0;
        const live = engine.tributeOdds(tribute, gameState.tributes);
        const value = Math.floor(bet.stake * bet.mult * (live.pct / 100) * SIDE_BETS.cashOutMargin);
        const rest = { ...bets };
        delete rest[tributeId];
        gameActions.setCoins(coins + value);
        gameStore.setState({
            bets: rest,
            betWonMessage: value > 0
                ? `The book settles your position on ${tribute.name} early: ${value} coins at the current price.`
                : `The book buys out your position on ${tribute.name} for nothing. It was worth nothing.`,
        });
        persistRun();
        return value;
    },

    /**
     * §6.10: pre-Games coaching — pin a chosen tribute's training-floor
     * strategy and/or interview angle. Only before the training phase runs.
     */
    setCoaching(tributeId: string, coaching: { trainingStrategy?: 'showcase' | 'conceal' | 'balanced'; interviewStrategy?: InterviewPersona }): boolean {
        const { gameState, simulator } = gameStore.getState();
        if (!gameState || !simulator) return false;
        if (gameState.phase !== 'reaping' && gameState.phase !== 'setup') return false;
        // Written onto the simulator's live state so the phase engines see it.
        simulator.getState().playerCoaching = { tributeId, ...coaching };
        gameActions.syncFromSimulator();
        return true;
    },

    /**
     * REQUEST: "a setting to force a certain tribute to win the games".
     *
     * Only before the gong. Rigging a Games at the final four is a different
     * and much uglier thing, and the engine's protection is written as "nothing
     * may kill this person" — applied halfway through a run it would undo
     * deaths that have already been narrated.
     */
    setRiggedVictor(tributeId: string | null): boolean {
        const { gameState, simulator } = gameStore.getState();
        if (!gameState || !simulator) return false;
        if (gameState.phase !== 'reaping' && gameState.phase !== 'setup') return false;
        const live = simulator.getState();
        if (tributeId === null) delete live.riggedVictorId;
        else if (live.tributes.some(t => t.id === tributeId)) live.riggedVictorId = tributeId;
        else return false;
        gameActions.syncFromSimulator();
        return true;
    },

    setCoins(coins: number | ((prev: number) => number)) {
        gameStore.setState(s => {
            const next = typeof coins === 'function' ? coins(s.coins) : coins;
            const safe = Math.max(0, Math.floor(next));
            // Swallows a full/unavailable store — the balance just won't persist.
            writeCoins(safe);
            return { coins: safe };
        });
    },

    /** Hands back any coins staked on a run that never resolved. */
    refundOpenBets() {
        const { bets, sideBets, betsResolved, coins } = gameStore.getState();
        const staked = Object.values(bets).reduce((a, b) => a + b.stake, 0)
            + sideBets.reduce((a, b) => a + b.stake, 0);
        if (betsResolved || staked === 0) return;
        gameActions.setCoins(coins + staked);
        gameStore.setState({ bets: {}, sideBets: [] });
    },

    /**
     * SIDE-07: relaunch an archived victory.
     *
     * The Hall of Fame could copy a seed to the clipboard and nothing else —
     * the player then had to walk back to setup and paste it, and guess which
     * arena and which settings had produced it. An entry now carries both, so
     * "run it again" is a button.
     */
    /** §10.5: toggle an archived victor into or out of the Grudge Match. */
    toggleGrudgeMatch(id: string) {
        const current = gameStore.getState().grudgeMatchIds;
        gameStore.setState({
            grudgeMatchIds: current.includes(id)
                ? current.filter(i => i !== id)
                : [...current, id].slice(-VETERANS.maxPerRun),
        });
    },

    clearGrudgeMatch() {
        gameStore.setState({ grudgeMatchIds: [] });
    },

    /**
     * AUDIT-10 F19: relaunching an archived run is not replaying it.
     *
     * A Hall-of-Fame entry stores the seed, the arena, the Quell and the
     * config. It does not store the record book the run was played under, so
     * this relaunch has always started under the player's *current* campaign —
     * a different set of starting conditions from the one that produced the
     * archived victor — while presenting itself as running that Games again.
     *
     * The relaunch is still worth having and is unchanged mechanically. What
     * changes is that the player is told which of the four kinds of
     * reproduction they are getting before it starts, instead of finding out
     * from a different victor.
     */
    replayHallOfFameEntry(entry: HallOfFameEntry): Promise<void> {
        const arenaId = entry.arenaId
            ?? ARENAS.find(a => a.name === entry.arenaName)?.id
            ?? 'procedural';
        return gameActions.startGame(entry.seed, arenaId, false, entry.config ?? DEFAULT_GAME_CONFIG, true, false, entry.quellId)
            .then(() => gameActions.setLinkNotice(
                `Relaunching the ${entry.arenaName} Games under seed ${entry.seed} and the rules it was played under. `
                + 'The archive does not store the record book that run had, so this runs under your current career: '
                + 'the same draw, under different rules of inheritance. Expect a different Games.',
            ));
    },

    async resumeSavedRun() {
        return gameActions.resumeFromSlot(1);
    },

    discardSavedRun() {
        clearSavedRun();
    },

    /** Cards for the setup screen's saved-runs panel; null = empty slot. */
    readSaveSlots(): Array<SlotSummary | null> {
        return SAVE_SLOT_SPECS.map((spec, i) => {
            const saved = readStored(spec);
            return saved ? summarize(i + 1, saved) : null;
        });
    },

    /**
     * Parks the current run in a manual slot (2 or 3) without touching the
     * rolling autosave, so a run can be kept at a decision point while
     * another is played.
     */
    saveToSlot(slot: 2 | 3): boolean {
        const { gameState, bets, sideBets, betsResolved, hofSaved, isReplayedRun } = gameStore.getState();
        if (!gameState || gameState.phase === 'ended') return false;
        const spec = SAVE_SLOT_SPECS[slot - 1];
        return tryWriteStored(spec, {
            gameState, bets, sideBets, betsResolved, hofSaved, isReplayedRun,
            ...packRewind(rewindStack.slice(-REWIND_PERSIST), gameState.log),
            savedAt: new Date().toISOString(),
        } as SavedRun) !== 'quota' && persistenceMode() === 'persistent';
    },

    /** A line on a slot card. Rewrites the slot's envelope in place; nothing else about the save moves. */
    setSlotNote(slot: 1 | 2 | 3, note: string): boolean {
        const spec = SAVE_SLOT_SPECS[slot - 1];
        const saved = readStored(spec);
        if (!saved) return false;
        const trimmed = note.trim().slice(0, 120);
        if (slot === 1) autosaveNote = trimmed || undefined;
        return tryWriteStored(spec, { ...saved, note: trimmed || undefined }) === 'ok';
    },

    async resumeFromSlot(slot: 1 | 2 | 3) {
        const spec = SAVE_SLOT_SPECS[slot - 1];
        const saved = readStored(spec);
        if (!saved) return;
        cancelRunToEnd();
        // §2.2: whatever undo history travelled with the save comes back with
        // it. A save from before the stack was persisted has none, and resumes
        // exactly as it used to.
        restoreRewind(saved.rewind);
        autosaveNote = saved.note;
        const { Simulator } = await loadEngine();
        const { gameState } = saved;
        if (!gameState.baseConfig) gameState.baseConfig = gameState.config;
        gameStore.setState({
            gameState,
            simulator: new Simulator(gameState),
            view: gameState.phase === 'reaping' || gameState.phase === 'setup' ? 'roster' : 'game',
            bets: saved.bets,
            sideBets: saved.sideBets ?? [],
            betWonMessage: null,
            betsResolved: saved.betsResolved,
            hofSaved: saved.hofSaved,
            isReplayedRun: saved.isReplayedRun,
        });
        // Resuming a manual slot makes it the live run; the autosave takes
        // over from here (slot content is left in place as the branch point).
        if (slot !== 1) persistRun();
    },

    discardSlot(slot: 1 | 2 | 3) {
        if (slot === 1) { clearSavedRun(); return; }
        removeStored(SAVE_SLOT_SPECS[slot - 1]);
    },

    /**
     * §2.2: how deep the undo history actually goes, for the UI.
     *
     * Rewind is bounded twice — sixteen phases in memory, three across a
     * refresh — and both bounds used to be invisible: the button simply
     * stopped offering the phase you wanted. `depth`/`cap` let the checkpoint
     * menu say how much history is standing and that the oldest is being let
     * go, rather than the player inferring it from a list that never grows.
     */
    rewindInfo(): { depth: number; cap: number; persisted: number; atCap: boolean } {
        return {
            depth: rewindStack.length,
            cap: REWIND_CAP,
            persisted: REWIND_PERSIST,
            atCap: rewindStack.length >= REWIND_CAP,
        };
    },

    /** Whether a step back is currently possible. */
    canStepBack(): boolean {
        const { gameState, runProgress } = gameStore.getState();
        return rewindStack.length > 0 && !!gameState && gameState.phase !== 'ended' && !runProgress;
    },

    /** §2.6: rewind exactly one phase, rebuilding the simulator from the snapshot. */
    stepBack() {
        if (!gameActions.canStepBack() || !engine) return;
        const prev = rewindStack.pop()!;
        gameStore.setState({ gameState: prev, simulator: new engine.Simulator(prev) });
        persistRun();
    },

    /**
     * §2: the checkpoint list.
     *
     * Rewind was one step, which is enough to undo a misclick and not enough
     * to answer "what if the feast had gone differently" — the snapshots for
     * every phase of the run were already on the stack and there was simply no
     * way to reach past the top one. Newest first, so index 0 is the same
     * thing `stepBack` does.
     */
    checkpoints(): Array<{ index: number; day: number; phase: GameState['phase']; alive: number }> {
        const { gameState, runProgress } = gameStore.getState();
        if (!gameState || gameState.phase === 'ended' || runProgress) return [];
        return rewindStack
            .map((snap, i) => ({
                index: rewindStack.length - 1 - i,
                day: snap.day,
                phase: snap.phase,
                alive: snap.tributes.filter(t => t.status === 'alive').length,
            }))
            .reverse();
    },

    /** §2: jump back to one of them, discarding everything after it. */
    rewindTo(index: number) {
        if (!engine || !gameActions.canStepBack()) return;
        if (index < 0 || index >= rewindStack.length) return;
        const target = rewindStack[rewindStack.length - 1 - index];
        rewindStack = rewindStack.slice(0, rewindStack.length - 1 - index);
        gameStore.setState({ gameState: target, simulator: new engine.Simulator(target) });
        persistRun();
    },

    /**
     * §6.2: spend coins to become the standing patron of one district.
     *
     * §9 (audit): patronage is now cumulative and escalating rather than a
     * single 750-coin purchase, so it stays a live coin sink across a career
     * instead of being spent once and forgotten.
     */
    patronDistrict(district: number): boolean {
        const { coins, panem } = gameStore.getState();
        const owned = panem.patronDistricts ?? (panem.patronDistrict === undefined ? [] : [panem.patronDistrict]);
        if (owned.includes(district)) return false;
        if (owned.length >= COIN_ECONOMY.patronMaxDistricts) return false;
        const cost = patronCostFor(owned.length);
        if (coins < cost) return false;
        gameActions.setCoins(coins - cost);
        gameStore.setState({ panem: addPatronDistrict(district) });
        return true;
    },

    /** §9 (audit): give up a standing patronage. No refund; the Capitol does not give coins back. */
    dropPatron(district: number): void {
        gameStore.setState({ panem: dropPatronDistrict(district) });
    },

    /** §9 (audit): what the next patronage would cost, for the button's label. */
    nextPatronCost(): number {
        const { panem } = gameStore.getState();
        const owned = panem.patronDistricts ?? (panem.patronDistrict === undefined ? [] : [panem.patronDistrict]);
        return patronCostFor(owned.length);
    },

    /**
     * §9 (audit): buy a locked arena outright.
     *
     * Waiting for a sealed draw to land on one specific arena is a long wait
     * with 34 of them locked. A coin price gives a player who wants a
     * particular map a way to get there and gives the economy a repeatable
     * sink that scales with how much of the roster is still hidden.
     */
    buyArenaUnlock(arenaName: string): boolean {
        const { coins } = gameStore.getState();
        if (coins < COIN_ECONOMY.arenaUnlockCost) return false;
        gameActions.setCoins(coins - COIN_ECONOMY.arenaUnlockCost);
        gameStore.setState({ panem: buyArena(arenaName) });
        return true;
    },

    arenaUnlockCost: COIN_ECONOMY.arenaUnlockCost,

    patronCost: PATRON_COST,

    /** Wipes achievements, records, and career totals — the "Your Panem" book — back to a blank slate. */
    resetPanem() {
        clearPanem();
        gameStore.setState({ panem: readPanem() });
    },

    /**
     * Everything, not just the record book.
     *
     * `resetPanem` clears exactly one of the nine storage keys. A player who
     * asks to erase their account and finds their coins, Hall of Fame, prefs,
     * feed filters, last config and three save slots still there has not been
     * given a reset, they have been given a misleading button. This clears all
     * nine, re-seeds coins to the starting stake, and rehydrates the store from
     * the now-empty backend so no screen is left holding pre-reset data.
     */
    resetEverything() {
        gameActions.refundOpenBets();
        cancelRunToEnd();
        clearRewind();
        clearAllStoredData();
        writeCoins(STARTING_COINS);
        gameStore.setState({
            gameState: null,
            simulator: null,
            view: 'setup',
            coins: STARTING_COINS,
            bets: {},
            sideBets: [],
            betWonMessage: null,
            isReplayedRun: false,
            betsResolved: false,
            hofSaved: false,
            panem: readPanem(),
            lastRunOutcome: null,
            runProgress: null,
            // The archive these ids pointed into is gone with everything else.
            grudgeMatchIds: [],
        });
    },

    /**
     * AUDIT-9 B06: `pinnedCampaign` is the "reproduce this run" path.
     *
     * A share link may carry the sender's record book. When it does, the run
     * is played under *that* history — which is what makes the link reproduce
     * the run rather than merely reproduce the seed. Omitted, the player's own
     * campaign applies, which is the "play this seed in my campaign" path and
     * the behaviour every existing link keeps.
     */
    async startGame(seed: string, arenaId: string, gamemakerMode: boolean, config: GameConfig = DEFAULT_GAME_CONFIG, markReplayed = false, forceQuell = false, pinnedQuellId?: string | null, pinnedCampaign?: CampaignSnapshot, plannedInterventions?: InterventionRecord[]) {
        // Abandoning a run mid-wager used to silently pocket the player's coins.
        gameActions.refundOpenBets();
        cancelRunToEnd();
        clearSavedRun();
        clearRewind();
        autosaveNote = undefined;

        const { Simulator, resolveArenaForRun, generateTributes, gamesProfileFor, configForProfile } = await loadEngine();

        const safeSeed = seed.trim() || Math.random().toString(36).substring(2, 8).toUpperCase();

        // REPLAY-01/REPLAY-11: this year's Games — including whether it's a
        // Quarter Quell — are rolled from the seed before the arena and cast
        // are resolved, because a Quell can shape both of them.
        // A Hall of Fame replay pins the archived run's exact Quell (or
        // explicit lack of one) rather than re-drawing from the seed — see
        // HallOfFameEntry.quellId. `undefined` (no replay, or an entry that
        // predates Quells) falls through to the ordinary seeded draw.
        const pinnedQuell = pinnedQuellId === undefined ? undefined : (pinnedQuellId === null ? null : QUELLS.find(q => q.id === pinnedQuellId) ?? null);
        const gamesProfile = gamesProfileFor(safeSeed, forceQuell, pinnedQuell, config.vanillaRules === true);
        // 'random-hidden': a real arena, still resolved deterministically from
        // the seed (a shared seed reproduces the same Games) — the pick just
        // isn't the player's to make, and its identity stays out of the UI
        // until the bloodbath reveals it (see arenaHidden below and
        // ui/disclosure.ts's canSeeArena).
        const arenaHidden = arenaId === 'random-hidden';
        // §9 (audit): a sealed draw that can land on the arena you played
        // last is not much of a draw. The recently-played window is excluded
        // from the pool, which is still a pure function of the seed and the
        // player's own record book, so a shared seed replays identically for
        // anyone whose book matches — and the pool never empties, because the
        // exclusion is dropped whenever it would leave fewer than two options.
        const recentArenaNames = new Set(
            (gameStore.getState().panem.recentRuns ?? [])
                .slice(0, SEALED_DRAW_NO_REPEAT)
                .map(r => r.arenaName),
        );
        const fullPool = [...ARENAS.map(a => a.id), 'procedural'];
        const freshPool = fullPool.filter(id => {
            const name = ARENAS.find(a => a.id === id)?.name;
            return name === undefined || !recentArenaNames.has(name);
        });
        const resolvedArenaId = arenaHidden
            ? new RNG(`${safeSeed}-random-arena`).pick(freshPool.length >= 2 ? freshPool : fullPool)
            : arenaId;
        // AUDIT-6 §1.3: the clone, the off-season skin, the Quell law override
        // and the `lawZone` default all live in `resolveArenaForRun` now, so
        // every headless check plays the same arena the player is handed. This
        // block used to be inline here, which is why no test ever saw a skin.
        const arena = resolveArenaForRun(safeSeed, resolvedArenaId, gamesProfile);
        const startZone = arena.zones[0].name;

        const tributes = generateTributes(safeSeed, config, startZone, gamesProfile.castShape, gamesProfile.quell);

        /*
         * AUDIT-9 B06: the record book, snapshotted once, here.
         *
         * Everything below — patronage, mentors, and (inside the engine) the
         * Head Gamemaker's term, district standing and heirlooms — used to
         * read the live record book at the moment it was needed, the engine
         * included. That is what made a shared seed an incomplete description
         * of a run. One snapshot, taken at creation, travels with the save and
         * can travel with a link; `campaignSnapshotOf` is the only place the
         * storage shape is translated into the simulation's.
         *
         * `pinnedCampaign` is a reproduce-this-run link: the sender's record
         * book came with it, so the run replays under that history rather than
         * under the receiver's career.
         */
        const panemNow = pinnedCampaign ?? campaignSnapshotOf(gameStore.getState().panem);
        // §6.2: standing district patronage — a persistent sink for Capitol
        // Coins. The patron's tributes arrive with sponsors already warm.
        // §9 (audit): patronage is a list now, not a single district.
        const patrons = new Set(
            panemNow.patronDistricts ?? (panemNow.patronDistrict === undefined ? [] : [panemNow.patronDistrict]),
        );
        if (patrons.size > 0) {
            tributes.forEach(t => {
                if (patrons.has(t.district)) {
                    t.sponsorTrust = Math.min(100, t.sponsorTrust + PATRON_TRUST_BONUS);
                }
            });
        }

        // §9 (audit): the victor legacy. A district whose last crown is still
        // alive in the player's record book sends that victor to the mentor's
        // chair. Applied after generation and consuming no RNG, so the seed
        // still reproduces the same cast — the mentor's name and the sponsor
        // bonus are the only things a career of Games changes here.
        const victorMentors = panemNow.victorMentors ?? {};
        tributes.forEach(t => {
            const m = victorMentors[t.district];
            if (!m) return;
            t.mentorLegacy = `${m.name}, who came home from the ${ordinalRun(m.run)} Games`;
            t.mentorIsVictor = true;
        });

        // §10.5: the Grudge Match. Two archived victors are grafted onto the
        // field the seed already produced, so the run still replays exactly —
        // what the archive supplies is identity, not a different roll.
        const grudge = gameStore.getState().grudgeMatchIds;
        let veterans: string[] = [];
        if (grudge.length > 0) {
            const archive = readHallOfFame();
            const picked = grudge
                .map(id => archive.find(e => e.id === id))
                .filter((e): e is HallOfFameEntry => e !== undefined);
            if (picked.length > 0) veterans = seatVeterans(safeSeed, tributes, picked);
        }
        // The seating is for *this* Games, as the setup copy says. It used to
        // persist, so the same two victors were reaped again every run after.
        if (grudge.length > 0) gameStore.setState({ grudgeMatchIds: [] });

        const initialState: GameState = {
            // AUDIT-10 B3-01: a replay link's recorded Gamemaker commands, which
            // fire on the cycles they fired on in the run being replayed. An
            // empty list is left off entirely so an ordinary run is byte-for-byte
            // what it was before replay existed.
            ...(plannedInterventions?.length ? { plannedInterventions } : {}),
            seed: safeSeed,
            arena,
            tributes,
            phase: 'reaping',
            day: 0,
            log: [],
            gamemakerMode,
            arenaHidden,
            // §13.2: snapshotted at creation so the engine never reaches into
            // the prefs store, and so a resumed run briefs the way it did the
            // first time.
            arenaBriefingOnDrop: readPrefs().arenaBriefingOnDrop,
            config: configForProfile(config, gamesProfile),
            baseConfig: config,
            gamesProfile,
            logCounter: 0,
            feastsHeld: 0,
            veteransSeated: veterans.length > 0 ? veterans : undefined,
            // AUDIT-9 B06: the record book this run is played under, carried
            // by the state so the engine never reaches for storage and a save
            // resumes under the history it started with.
            campaign: panemNow,
        };

        gameStore.setState({
            gameState: initialState,
            simulator: new Simulator(initialState),
            view: 'roster',
            bets: {},
            sideBets: [],
            betWonMessage: null,
            betsResolved: false,
            hofSaved: false,
            isReplayedRun: markReplayed,
            lastRunOutcome: null,
        });
        persistRun();
    },

    rerollCast() {
        const { gameState } = gameStore.getState();
        if (!gameState || gameState.phase !== 'reaping' || !engine) return;
        const { Simulator, generateTributes, gamesProfileFor, configForProfile } = engine;

        const baseSeed = gameState.seed.split('~')[0];
        const newSeed = `${baseSeed}~${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        // A rerolled cast is a rerolled Games: the sub-seed decides both, and
        // the executed config is re-derived from the player's base config so
        // the old profile's multipliers don't leak into the new year. The
        // Quell is pinned to whatever it already was, though — the arena is
        // already locked in (law and all), so a reroll can't silently swap
        // the run's Quell out from under it.
        const gamesProfile = gamesProfileFor(newSeed, false, gameState.gamesProfile?.quell ?? null, gameState.baseConfig.vanillaRules === true);
        const config = configForProfile(gameState.baseConfig, gamesProfile);
        // §2.6: the cast is drawn from the BASE config, exactly as `startGame`
        // draws it. It used to be drawn from the profile-executed config, which
        // diverges the moment a Quell carries a `configOverride` (the doubled
        // Quell sets districtCount: 16) — the reroll produced a cast the share
        // link could not reproduce, because the link carries the base config
        // and `startGame` re-derives the profile from it. One draw, one config,
        // both paths.
        const tributes = generateTributes(newSeed, gameState.baseConfig, gameState.arena.zones[0].name, gamesProfile.castShape, gamesProfile.quell);
        // The log and its counter are carried over rather than wiped: nothing
        // written before the reaping belongs to the cast that was drawn, and
        // resetting the counter would let a rerolled run reuse log ids.
        const newState: GameState = {
            ...gameState, seed: newSeed, tributes, gamesProfile, config,
        };

        gameStore.setState({ gameState: newState, simulator: new Simulator(newState) });
        persistRun();
    },

    confirmReaping() {
        const { gameState } = gameStore.getState();
        if (!gameState || gameState.phase !== 'reaping' || !engine) return;

        const newState: GameState = { ...gameState, phase: 'setup' };
        gameStore.setState({ gameState: newState, simulator: new engine.Simulator(newState) });
        // §(requests 7): the cast is confirmed, so the next thing the player
        // wants is the record. The chronicle opens empty with the button that
        // holds the reaping; every stage after it lands on its own page.
        gameActions.setView('chronicle');
        persistRun();
    },

    syncFromSimulator() {
        const { simulator } = gameStore.getState();
        if (!simulator) return;
        gameStore.setState({ gameState: snapshot(simulator.getState()) });
        persistRun();
    },

    nextPhase() {
        const { simulator } = gameStore.getState();
        if (!simulator) return;

        const state = simulator.getState();
        // Snapshot the state this advance is leaving, for "step back one phase".
        if (state.phase !== 'ended' && state.phase !== 'epilogue') pushRewind(state);
        if (state.phase === 'epilogue') {
            state.phase = 'ended';
            // §20 (requests): commit first. `commitVictory` is what decides
            // which achievements this run earned for the first time, and
            // `resolveBets` is what pays for them — so the old order paid out
            // against a `lastRunOutcome` from the *previous* run, or from
            // nothing at all on a first run.
            commitVictory(state);
            resolveBets(state);
        } else if (state.phase === 'ended') {
            return;
        } else {
            // §(requests): every stage of the pre-Games, every day and every
            // night, one press each. The simulator owns the dispatch table.
            simulator.advance();
        }

        gameActions.syncFromSimulator();
    },

    /**
     * Fast-forwards the whole run, yielding to the browser between batches.
     *
     * This used to be one synchronous `while` loop, which froze the tab for the
     * length of the run with no progress and no way out. The step sequence is
     * byte-for-byte the same — only the awaits between batches are new, and
     * nothing in the yield touches the simulator or the RNG — so the same seed
     * still produces exactly the same Games.
     */
    async runToEnd() {
        const { simulator } = gameStore.getState();
        // Re-entrancy guard: a second click (or a click on a run already being
        // cancelled) must not start a second loop over the same simulator.
        if (!simulator || activeRun) return;

        const run: ActiveRun = { cancelled: false, simulator };
        activeRun = run;

        /** Aborts if cancelled, or if the run underneath us was swapped out. */
        const stale = () => run.cancelled || gameStore.getState().simulator !== simulator;

        const publishProgress = (state: GameState, turns: number) => {
            const bets = gameStore.getState().bets;
            gameStore.setState({
                runProgress: {
                    day: state.day,
                    phase: state.phase,
                    turns,
                    logLines: state.log.length,
                    tributesAlive: state.tributes.filter(t => t.status === 'alive').length,
                    wagered: state.tributes
                        .filter(t => bets[t.id])
                        .map(t => ({ name: t.name, district: t.district, alive: t.status === 'alive' })),
                },
            });
        };

        try {
            let state = simulator.getState();
            let turns = 0;
            publishProgress(state, turns);
            await yieldToBrowser();
            if (stale()) return;

            // Ceiling well above any realistic run; the phase guards below are
            // what actually terminate the loop.
            let guard = 2000;
            while (state.phase !== 'ended' && guard-- > 0) {
                // Checked before every step, not just at batch boundaries, so a
                // cancelled loop cannot land another turn after the player has
                // already started a new one.
                if (stale()) return;
                if (state.phase === 'epilogue') {
                    state.phase = 'ended';
                } else if (!simulator.advance()) {
                    break;
                }
                state = simulator.getState();
                turns++;

                if (turns % RUN_BATCH_SIZE === 0) {
                    publishProgress(state, turns);
                    await yieldToBrowser();
                    if (stale()) return;
                }
            }

            if (state.phase === 'ended') {
                // §20: same order as the phase-step path above, and for the
                // same reason — the outcome has to exist before it is paid for.
                commitVictory(state);
                resolveBets(state);
            } else if (guard <= 0) {
                // The ceiling tripped. Silently falling out of the loop left
                // bets unresolved, no victory committed, and a half-finished run
                // on screen with nothing anywhere saying why — which is the one
                // outcome a guard exists to make visible rather than tidy.
                console.error(`[survival-games] runToEnd hit its ${turns}-turn ceiling in phase '${state.phase}' with `
                    + `${state.tributes.filter(t => t.status === 'alive').length} alive; bets are unresolved.`);
                state.log.push({
                    id: `log-${(state.logCounter = (state.logCounter ?? 0) + 1)}-ceiling`,
                    day: state.day,
                    phase: state.phase,
                    text: 'The broadcast cuts out. The simulation ran past the turn ceiling without reaching an ending — '
                        + 'this run cannot be completed, and no wagers have been settled.',
                    tributesInvolved: [],
                    important: true,
                    category: 'gamemaker',
                });
            }
        } finally {
            // `cancelRunToEnd` may already have released the token to let a new
            // run start; only the loop that still owns it clears the readout.
            if (activeRun === run) {
                activeRun = null;
                gameStore.setState({ runProgress: null });
            }
            // Whether it finished or was cancelled, show the player where the
            // simulation actually got to — unless the run was replaced, in
            // which case the new one owns the state.
            if (gameStore.getState().simulator === simulator) gameActions.syncFromSimulator();
        }
    },

    /** Stops an in-flight `runToEnd()` at the next batch boundary. */
    cancelRunToEnd,

    isRunningToEnd: () => activeRun !== null,

    /**
     * SIDE-03: the player spends Capitol Coins on a parachute.
     *
     * The wallet used to be a one-way bet placed before the gong. This is the
     * other half of the economy — the audience doing the one thing the audience
     * can actually do — and it is the only way the player touches the arena
     * without Gamemaker mode.
     */
    sponsorTribute(tributeId: string, itemId: string): SponsorResult {
        const { simulator, coins } = gameStore.getState();
        if (!simulator || !engine) return { ok: false, cost: 0, message: 'No Games are running.' };
        const { sponsorableItems, sponsorCost, sendPlayerParachute } = engine;

        const state = simulator.getState();
        const tribute = state.tributes.find(t => t.id === tributeId);
        const item = sponsorableItems().find(i => i.id === itemId);
        if (!tribute || !item) return { ok: false, cost: 0, message: 'That parachute cannot be sent.' };

        const cost = sponsorCost(state, tribute, item);
        if (coins < cost) {
            return { ok: false, cost, message: `That parachute costs ${cost} coins. You have ${coins}.` };
        }

        const result = sendPlayerParachute(state, tributeId, itemId);
        if (!result.ok) return result;

        gameActions.setCoins(coins - result.cost);
        gameActions.syncFromSimulator();
        return result;
    },

    triggerGamemakerEvent(type: GamemakerEventType, targetId?: string) {
        const { simulator } = gameStore.getState();
        if (!simulator) return;
        simulator.triggerGamemakerEvent(type, targetId);
        gameActions.syncFromSimulator();
    },
};

export { readHallOfFame, readSavedRun };
