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

    const [checkpointsOpen, setCheckpointsOpen] = useState(false);
    const checkpoints = checkpointsOpen ? gameActions.checkpoints() : [];
    // §2.2: rewind is bounded — sixteen phases in memory, three across a
    // refresh — and the bound used to be invisible, so the list just quietly
    // stopped reaching back any further.
    const rewind = gameActions.rewindInfo();

    // §2.13: Undo said "Undo" with no indication of what it undoes.
    const undoLabel = gameActions.canStepBack()
        ? `Undo — back to ${gameState.day === 0 ? 'the previous phase' : `day ${gameState.day}`}`
            + ` (${rewind.depth} of the last ${rewind.cap} phases kept${rewind.atCap ? ' — the oldest is being let go' : ''})`
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
                    <span className="relative">
                        <button
                            onClick={() => gameActions.stepBack()}
                            className="btn btn-sm"
                            disabled={!gameActions.canStepBack()}
                            title={undoLabel}
                            aria-label={undoLabel}
                        >
                            <Undo2 className="w-4 h-4" />
                        </button>
                        {/* §2: rewind was one step. Every phase of the run was
                            already on the snapshot stack and there was no way
                            to reach past the top of it. */}
                        <button
                            onClick={() => setCheckpointsOpen(o => !o)}
                            className="btn btn-sm btn-ghost px-1"
                            disabled={!gameActions.canStepBack()}
                            aria-expanded={checkpointsOpen}
                            aria-haspopup="menu"
                            title="Jump back to any earlier point in the run"
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
                                        <span className="font-mono text-[10px] mr-2">
                                            {c.day === 0 ? '—' : `d${c.day}`}
                                        </span>
                                        {c.phase}
                                        <span className="ml-auto text-[10px] text-[var(--color-ink-500)]">
                                            {c.alive} alive
                                        </span>
                                    </button>
                                ))}
                                {checkpoints.length > 0 && (
                                    <p className="px-1.5 pt-1.5 mt-1 border-t border-[var(--line-soft)] text-[10px] leading-snug text-[var(--color-ink-500)]">
                                        {rewind.atCap
                                            ? `Holding the last ${rewind.cap} phases — anything earlier has been let go.`
                                            : `${rewind.depth} of ${rewind.cap} phases held.`}
                                        {' '}A refresh keeps the last {rewind.persisted}.
                                    </p>
                                )}
                            </div>
                        )}
                    </span>
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
                    <span
                        className="chip font-mono"
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
