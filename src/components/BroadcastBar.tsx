import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../models/types';
import { FastForward, Undo2, Volume2, VolumeX } from 'lucide-react';
import { PlaybackPopover, PlayUntil, Speed } from './PlaybackPopover';
import { ChronicleExport } from './ChronicleExport';
import { prefsStore, setPrefs } from '../store/prefsStore';
import { gameActions, gameStore } from '../store/gameStore';
import { useStore } from '../store/createStore';

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

    // §2.4: "what just changed". After Proceed the counters jump with nothing
    // to say which of them moved, so each flashes for a moment when it does.
    const prevAlive = useRef(aliveCount);
    const [aliveDelta, setAliveDelta] = useState(0);
    useEffect(() => {
        const delta = aliveCount - prevAlive.current;
        prevAlive.current = aliveCount;
        if (delta === 0) return;
        setAliveDelta(delta);
        const id = setTimeout(() => setAliveDelta(0), 1600);
        return () => clearTimeout(id);
    }, [aliveCount]);

    // §2.13: Undo said "Undo" with no indication of what it undoes.
    const undoLabel = gameActions.canStepBack()
        ? `Undo — back to ${gameState.day === 0 ? 'the previous phase' : `day ${gameState.day}`}`
        : 'Nothing to undo yet';

    return (
        <div className="panel sticky top-[3.75rem] z-20 px-4 py-2.5 mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <h2 className="display-title text-lg leading-none">{phaseLabel}</h2>
                    <span className="text-[var(--color-ink-500)] text-xs truncate" title={arenaSealed ? 'Sealed until the Games begin.' : undefined}>
                        {arenaSealed ? '❓ Arena sealed' : gameState.arena.name}
                    </span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-500)] mt-0.5">
                    <span className={aliveDelta !== 0 ? 'text-[var(--red)] font-black' : ''}>
                        {aliveCount} alive
                        {aliveDelta !== 0 && <span> ({aliveDelta > 0 ? '+' : ''}{aliveDelta})</span>}
                    </span>
                    {' / '}{deadCount} fallen
                </div>
            </div>

            {!isOver && (
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => gameActions.stepBack()}
                        className="btn btn-sm"
                        disabled={!gameActions.canStepBack()}
                        title={undoLabel}
                        aria-label={undoLabel}
                    >
                        <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onNextPhase}
                        className="btn btn-primary"
                        disabled={!!runProgress}
                        title="Advance one phase (Space)"
                    >
                        Proceed <FastForward className="w-4 h-4" />
                    </button>
                    {runProgress ? (
                        <button onClick={() => gameActions.cancelRunToEnd()} className="btn btn-sm" title="Stop the fast-forward and keep what has happened so far">
                            Cancel
                        </button>
                    ) : (
                        <button onClick={onRunToEnd} className="btn btn-sm" title="Simulate the entire run at once">
                            Run to end
                        </button>
                    )}
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

            <div className="flex items-center gap-1">
                <button
                    onClick={() => setPrefs({ muteAudio: !prefs.muteAudio })}
                    aria-pressed={prefs.muteAudio}
                    className="seg-item"
                    title={prefs.muteAudio ? 'Unmute the cannon, anthem and parachute cues' : 'Mute all sound'}
                    aria-label={prefs.muteAudio ? 'Unmute sound' : 'Mute sound'}
                >
                    {prefs.muteAudio ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </button>
                <div className="relative">
                    <button
                        className="seg-item"
                        aria-expanded={showExport}
                        onClick={() => setShowExport(v => !v)}
                        title="Copy or download the chronicle, and park this run in a save slot"
                    >
                        Export
                    </button>
                    {showExport && (
                        <div className="absolute top-full right-0 mt-1 z-40 panel p-4 space-y-3 w-[min(26rem,90vw)] shadow-[var(--shadow-ink-sm)]">
                            <ChronicleExport gameState={gameState} />
                            {!isOver && (
                                <div className="flex flex-wrap gap-2 items-center border-t border-[var(--color-ink-800)] pt-3">
                                    <span className="eyebrow">Park this run</span>
                                    {([2, 3] as const).map(slot => (
                                        <button
                                            key={slot}
                                            className="btn btn-sm"
                                            title={`Save a copy of this run into slot ${slot} — resume it later from the setup screen`}
                                            onClick={e => {
                                                const ok = gameActions.saveToSlot(slot);
                                                const el = e.currentTarget;
                                                el.textContent = ok ? `Saved to slot ${slot}` : 'Save failed';
                                                setTimeout(() => { el.textContent = `Slot ${slot}`; }, 1800);
                                            }}
                                        >
                                            Slot {slot}
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
                    className="w-full font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-500)] leading-tight"
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
                <span role="status" aria-live="polite" className="w-full text-[10px] uppercase tracking-wider text-[var(--red)] font-bold">
                    {pauseNotice}
                    <button className="underline ml-1.5" onClick={onDismissNotice}>Dismiss</button>
                </span>
            )}
        </div>
    );
}
