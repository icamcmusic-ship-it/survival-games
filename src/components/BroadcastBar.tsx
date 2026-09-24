import React, { useEffect, useId, useRef, useState } from 'react';
import { Hint } from './Hint';
import { frontName } from '../engine/weatherFront';
import { useTransientFlag } from '../ui/useTransientFlag';
import { useEscapeLayer } from '../ui/useDialogFocus';
import { GameState } from '../models/types';
import { FastForward, Undo2, Volume2, VolumeX } from 'lucide-react';
import { PlaybackPopover, PlayUntil, Speed } from './PlaybackPopover';
import { ChronicleExport } from './ChronicleExport';
import { prefsStore, setPrefs } from '../store/prefsStore';
import { gameActions, gameStore } from '../store/gameStore';
import { useStore } from '../store/createStore';
import { Glossed } from './Glossed';
import { ARENA_MUTTS } from '../data/mutts';

/**
 * A6: the sticky broadcast bar.
 *
 * Proceed, Run to End and Undo were inside the phase panel, which scrolls — the
 * three most-pressed controls on the screen could be scrolled off it. Speed sat
 * beside them but separately; mute was a full-width labelled toggle for
 * something that is a toggle rather than a feature; and the exports were behind
 * a button labelled Filters, which they have nothing to do with.
 */
export function BroadcastBar({
    gameState,
    phaseLabel,
    aliveCount,
    deadCount,
    isOver,
    onNextPhase,
    onRunToEnd,
    speed,
    onSpeed,
    playUntil,
    onPlayUntil,
    hasFollowed,
    pauseNotice,
    onDismissNotice,
    arenaSealed,
}: {
    gameState: GameState;
    phaseLabel: string;
    aliveCount: number;
    deadCount: number;
    isOver: boolean;
    onNextPhase: () => void;
    onRunToEnd: () => void;
    speed: Speed;
    onSpeed: (s: Speed) => void;
    playUntil: PlayUntil;
    onPlayUntil: (p: PlayUntil) => void;
    hasFollowed: boolean;
    pauseNotice: string | null;
    onDismissNotice: () => void;
    arenaSealed: boolean;
}) {
    const prefs = useStore(prefsStore, p => p);
    const runProgress = useStore(gameStore, s => s.runProgress);
    const [showExport, setShowExport] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const controlsId = useId();
    // Publish the bar's height so sticky elements below it can sit under it.
    const barRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = barRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const root = document.documentElement;
        const ro = new ResizeObserver(() => root.style.setProperty('--bar-h', `${el.offsetHeight}px`));
        ro.observe(el);
        return () => { ro.disconnect(); root.style.removeProperty('--bar-h'); };
    }, []);

    // §2.4: "what just changed". After Proceed the counters jump with nothing
    // to say which of them moved, so each flashes for a moment when it does.
    const prevAlive = useRef(aliveCount);
    const [aliveDelta, setAliveDelta] = useState(0);
    /** Which save slot is showing a confirmation, and what it says. */
    const [slotNotice, setSlotNotice] = useTransientFlag<{ slot: number; text: string } | null>(null, 1800);
    useEffect(() => {
        const delta = aliveCount - prevAlive.current;
        prevAlive.current = aliveCount;
        if (delta === 0) return;
        setAliveDelta(delta);
        const id = setTimeout(() => setAliveDelta(0), 1600);
        return () => clearTimeout(id);
    }, [aliveCount]);

    const [checkpointsOpen, setCheckpointsOpen] = useState(false);
    const checkpoints = checkpointsOpen ? gameActions.checkpoints() : [];
    useEscapeLayer(checkpointsOpen, () => setCheckpointsOpen(false));
    useEscapeLayer(showExport, () => setShowExport(false));
    // §2.2: rewind is bounded — sixteen phases in memory, three across a
    // refresh — and the bound used to be invisible, so the list just quietly
    // stopped reaching back any further.
    const rewind = gameActions.rewindInfo();

    // §2.13: Undo said "Undo" with no indication of what it undoes.
    const undoLabel = gameActions.canStepBack()
        ? `Undo — back to ${gameState.day === 0 ? 'the previous phase' : `day ${gameState.day}`}`
            + ` (${rewind.depth} of the last ${rewind.cap} phases kept${rewind.atCap ? ' — the oldest is being let go' : ''})`
        : 'Nothing to undo yet';

    const front = gameState.weatherFront;
    // Audit 4 §2.1: see the comment in the header below.
    const hornHolder = gameState.cornucopiaHolder
        ? gameState.tributes.find(t => t.id === gameState.cornucopiaHolder && t.status === 'alive')
        : undefined;
    // An `ActiveMutt` stores the mutt's id and who it is hunting; the name
    // comes from the arena's roster and the zone from the quarry.
    const muttRoster = ARENA_MUTTS[gameState.arena.id] ?? gameState.arena.muttRoster ?? [];
    const loose = (gameState.activeMutts ?? []).flatMap(active => {
        const mutt = muttRoster.find(m => m.id === active.muttId);
        const quarry = gameState.tributes.find(t => t.id === active.targetId && t.status === 'alive');
        return mutt && quarry ? [{ name: mutt.name, zone: quarry.zone }] : [];
    });

    return (
        /* AUDIT-11 U2: sticks under the *measured* header (`--header-h`, set by
           App) instead of a guessed 3.75rem, and below `lg` collapses to one
           row — phase, counts and a toggle — expanding for Undo, speed and
           export. Proceed is on the bottom nav there. */
        <div ref={barRef} className="panel sticky below-header z-20 px-4 py-2 lg:py-2.5 mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <h2 className="display-title text-lg leading-none">{phaseLabel}</h2>
                    <span className="text-[var(--color-ink-500)] text-xs truncate" role="group" aria-label={arenaSealed ? 'Sealed until the Games begin.' : undefined} title={arenaSealed ? 'Sealed until the Games begin.' : undefined}>
                        {arenaSealed ? '❓ Arena sealed' : gameState.arena.name}
                    </span>
                </div>
                <div className={`font-mono text-micro uppercase tracking-wider text-[var(--color-ink-500)] mt-0.5 ${expanded ? '' : 'truncate lg:whitespace-normal'}`}>
                    <span className={aliveDelta !== 0 ? 'text-[var(--red)] font-black' : ''}>
                        {aliveCount} alive
                        {aliveDelta !== 0 && <span> ({aliveDelta > 0 ? '+' : ''}{aliveDelta})</span>}
                    </span>
                    {' / '}{deadCount} fallen
                    {/* Audit 3 §2.6: the front is the one hazard in the game a
                        tribute can see coming and walk away from, and it had no
                        surface anywhere — so the reader watched people get caught
                        by something the engine had been telegraphing for cycles. */}
                    {front && !arenaSealed && (
                        <>
                            {' / '}
                            <span className="text-[var(--red)] font-black">
                                ⛈ {frontName(front)} over {front.zone}
                            </span>
                        </>
                    )}
                    {/*
                      Audit 4 §2.1: three pieces of live run state that no
                      component in the app named.

                      `timeOfDay` has three values and the header showed the
                      phase, which has two — so dusk, the window several
                      mechanics key off, was never visible. `cornucopiaHolder`
                      and `maxHornHold` record who is sitting on the horn and
                      how long the longest hold has run. `activeMutts` is what
                      is loose in the arena right now, with its zone; before
                      this the reader learned about a mutt pack only from the
                      line where it caught somebody.
                    */}
                    {!arenaSealed && gameState.timeOfDay === 'dusk' && (
                        <>
                            {' / '}
                            <Glossed text="Dusk — the window between the day and night phases. Stealth, sightlines and several arena events key off it.">
                                <span className="text-[var(--gold)] font-black">◐ dusk</span>
                            </Glossed>
                        </>
                    )}
                    {hornHolder && !arenaSealed && (
                        <>
                            {' / '}
                            <Glossed text={`${hornHolder.name} is holding the Cornucopia. The longest hold this Games has run ${gameState.maxHornHold ?? 0} cycle${(gameState.maxHornHold ?? 0) === 1 ? '' : 's'}.`}>
                                <span className="text-[var(--gold)] font-black">⌂ {hornHolder.name} holds the horn</span>
                            </Glossed>
                        </>
                    )}
                    {loose.length > 0 && !arenaSealed && (
                        <>
                            {' / '}
                            <Glossed
                                align="right"
                                text={`Loose in the arena: ${loose.map(m => `${m.name} in ${m.zone}`).join('; ')}.`}
                            >
                                <span className="text-[var(--cat-mutt)] font-black">
                                    ☣ {loose.length} pack{loose.length === 1 ? '' : 's'} loose
                                </span>
                            </Glossed>
                        </>
                    )}
                </div>
            </div>

            <button
                type="button"
                className="btn btn-sm btn-ghost lg:hidden flex-none tap-target"
                aria-expanded={expanded}
                aria-controls={controlsId}
                onClick={() => setExpanded(v => !v)}
            >
                {expanded ? 'Less' : 'More'} <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
            </button>

            {!isOver && (
                <div id={controlsId} className={`${expanded ? 'flex' : 'hidden lg:flex'} items-center gap-2 flex-wrap`}>
                    <span className="relative">
                        <button
                            onClick={() => gameActions.stepBack()}
                            className="btn btn-sm"
                            disabled={!gameActions.canStepBack()}
                            aria-label={undoLabel}
                        >
                            <Undo2 className="w-4 h-4" />
                        </button>
                        {/* §2: rewind was one step. Every phase of the run was
                            already on the snapshot stack and there was no way
                            to reach past the top of it. */}
                        <button
                            onClick={() => setCheckpointsOpen(o => !o)}
                            // AUDIT-7 §2.1: one glyph wide (19px at 380px), so
                            // `min-width` has to come from somewhere other than
                            // the label.
                            className="btn btn-sm btn-ghost px-1 tap-target"
                            disabled={!gameActions.canStepBack()}
                            aria-expanded={checkpointsOpen}
                            aria-haspopup="menu"
                            aria-label="Jump back to any earlier point in the run"
                        >
                            ▾
                        </button>
                        {checkpointsOpen && (
                            <div
                                role="menu"
                                className="absolute left-0 top-full mt-1 z-30 panel p-1.5 max-h-64 overflow-y-auto custom-scrollbar min-w-[13rem]"
                            >
                                <div className="eyebrow px-1.5 pb-1">Jump back to</div>
                                {checkpoints.length === 0 && (
                                    <div className="px-1.5 py-1 text-xs text-[var(--color-ink-500)]">
                                        Nothing to go back to yet.
                                    </div>
                                )}
                                {checkpoints.map(c => (
                                    <button
                                        key={c.index}
                                        role="menuitem"
                                        className="btn btn-sm btn-ghost w-full justify-start text-left"
                                        onClick={() => { gameActions.rewindTo(c.index); setCheckpointsOpen(false); }}
                                    >
                                        <span className="font-mono text-micro mr-2">
                                            {c.day === 0 ? '—' : `d${c.day}`}
                                        </span>
                                        {c.phase}
                                        <span className="ml-auto text-micro text-[var(--color-ink-500)]">
                                            {c.alive} alive
                                        </span>
                                    </button>
                                ))}
                                {checkpoints.length > 0 && (
                                    <p className="px-1.5 pt-1.5 mt-1 border-t border-[var(--line-soft)] text-micro leading-snug text-[var(--color-ink-500)]">
                                        {rewind.atCap
                                            ? `Holding the last ${rewind.cap} phases — anything earlier has been let go.`
                                            : `${rewind.depth} of ${rewind.cap} phases held.`}
                                        {' '}A refresh keeps the last {rewind.persisted}.
                                    </p>
                                )}
                            </div>
                        )}
                    </span>
                    <Hint text="Advance one phase (Space)">
                        <button
                            onClick={onNextPhase}
                            className="btn btn-primary"
                            disabled={!!runProgress}
                        >
                            Proceed <FastForward className="w-4 h-4" />
                        </button>
                    </Hint>
                    {runProgress ? (
                        <Hint text="Stop the fast-forward and keep what has happened so far">
                            <button onClick={() => gameActions.cancelRunToEnd()} className="btn btn-sm">Cancel</button>
                        </Hint>
                    ) : (
                        <Hint text="Simulate the entire run at once">
                            <button onClick={onRunToEnd} className="btn btn-sm">Run to end</button>
                        </Hint>
                    )}
                    <span
                        className="chip font-mono"
                        role="group"
                        aria-label={speed === 'manual'
                            ? 'Playback is manual — advance with space or the button'
                            : `Playing automatically at ${speed}`}
                        title={speed === 'manual'
                            ? 'Playback is manual — advance with space or the button'
                            : `Playing automatically at ${speed}`}
                    >
                        {speed === 'manual' ? '⏸ manual' : `▶ ${speed}`}
                        {playUntil ? ` · until ${playUntil}` : ''}
                    </span>
                    <PlaybackPopover
                        speed={speed}
                        onSpeed={onSpeed}
                        playUntil={playUntil}
                        onPlayUntil={onPlayUntil}
                        feastEnabled={gameState.config.enableFeast}
                        aliveCount={aliveCount}
                        hasFollowed={hasFollowed}
                        disabled={!!runProgress}
                    />
                </div>
            )}

            <div className={`${expanded ? 'flex' : 'hidden lg:flex'} items-center gap-1`}>
                <button
                    onClick={() => setPrefs({ muteAudio: !prefs.muteAudio })}
                    aria-pressed={prefs.muteAudio}
                    className="seg-item"
                    aria-label={prefs.muteAudio ? 'Unmute sound' : 'Mute sound'}
                >
                    {prefs.muteAudio ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </button>
                <div className="relative">
                    <Hint align="right" text="Copy or download the chronicle, and park this run in a save slot">
                        <button
                            className="seg-item"
                            aria-expanded={showExport}
                            onClick={() => setShowExport(v => !v)}
                        >
                            Export
                        </button>
                    </Hint>
                    {showExport && (
                        <div className="absolute top-full right-0 mt-1 z-40 panel p-4 space-y-3 w-[min(26rem,90vw)] shadow-[var(--shadow-ink-sm)]">
                            <ChronicleExport gameState={gameState} />
                            {!isOver && (
                                <div className="flex flex-wrap gap-2 items-center border-t border-[var(--color-ink-800)] pt-3">
                                    <span className="eyebrow">Park this run</span>
                                    {/* Through React state rather than by writing
                                        `textContent` onto the live node: the DOM
                                        poke was outside React's tree, so any
                                        re-render in the 1.8s window restored the
                                        label early and the pending timer then wrote
                                        it again — onto a node that may by then have
                                        belonged to a different slot, or be gone. */}
                                    {([2, 3] as const).map(slot => (
                                        <button
                                            key={slot}
                                            className="btn btn-sm"
                                            aria-label={`Slot ${slot} — save a copy of this run, to resume later from the setup screen`}
                                            onClick={() => setSlotNotice(gameActions.saveToSlot(slot)
                                                ? { slot, text: `Saved to slot ${slot}` }
                                                : { slot, text: 'Save failed' })}
                                        >
                                            {slotNotice?.slot === slot ? slotNotice.text : `Slot ${slot}`}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {runProgress && (
                <div
                    className="w-full font-mono text-micro uppercase tracking-wider text-[var(--color-ink-500)] leading-tight"
                    role="status"
                    aria-live="polite"
                >
                    Simulating — {runProgress.day === 0 ? runProgress.phase : `Day ${runProgress.day} · ${runProgress.phase}`}
                    {' · '}{runProgress.tributesAlive} alive · {runProgress.logLines} lines
                    {runProgress.wagered?.length > 0 && (
                        <span className="ml-2">
                            {runProgress.wagered.map(w => (
                                <span key={w.name} className={`mr-2 ${w.alive ? '' : 'line-through opacity-60'}`}>
                                    {w.alive ? '● ' : '† '}{w.name} (D{w.district})
                                </span>
                            ))}
                        </span>
                    )}
                </div>
            )}

            {pauseNotice && (
                <span role="status" aria-live="polite" className="w-full text-micro uppercase tracking-wider text-[var(--red)] font-bold">
                    {pauseNotice}
                    <button className="underline ml-1.5" onClick={onDismissNotice}>Dismiss</button>
                </span>
            )}
        </div>
    );
}
