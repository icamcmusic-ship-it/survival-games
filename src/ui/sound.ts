/**
 * §2.2: "Sound. A cannon, an anthem sting, a parachute chime — three cues,
 * opt-in, would do more for atmosphere than any visual change. The anthem
 * already exists as a narrative beat with no audio."
 *
 * Synthesised with the Web Audio API rather than shipped as files: three
 * short cues are a few dozen lines of oscillator here against several hundred
 * kilobytes of assets, they load instantly, and there is nothing to license.
 *
 * Three rules this module keeps, because audio in a browser is easy to get
 * wrong in ways people genuinely resent:
 *
 *  - **Opt-in.** Nothing plays until the player turns it on (see
 *    `StoredFilters.sound`, which defaults to false).
 *  - **Lazily constructed.** The AudioContext is created on the first cue
 *    after that, so a page that never plays anything never builds one — and
 *    browsers refuse to construct one before a user gesture anyway.
 *  - **Never fatal.** Every path is wrapped: a browser with no Web Audio, a
 *    context refused by autoplay policy, or a suspended tab must cost the
 *    chronicle nothing.
 */

export type SoundCue = 'cannon' | 'anthem' | 'parachute';

let context: AudioContext | null = null;
let enabled = false;

/** Mirrors the stored preference. Called once at mount and on every toggle. */
export function setSoundEnabled(on: boolean) {
    enabled = on;
    if (!on && context) {
        // Release the hardware rather than leaving a suspended context around.
        void context.close().catch(() => { /* already closing */ });
        context = null;
    }
}

export function isSoundEnabled(): boolean {
    return enabled;
}

function audio(): AudioContext | null {
    if (!enabled) return null;
    if (context) return context;
    try {
        const Ctor = window.AudioContext
            ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        context = new Ctor();
        return context;
    } catch {
        return null;
    }
}

/** One shaped tone. `attack`/`release` are seconds; `type` is the waveform. */
function tone(
    ctx: AudioContext,
    { at, freq, to, duration, gain, type }: {
        at: number; freq: number; to?: number; duration: number; gain: number; type: OscillatorType;
    },
) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + duration);

    // A short attack and a long exponential tail: anything with a hard edge
    // at either end clicks, and a click is the thing that makes synthesised
    // audio sound broken rather than cheap.
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(gain, at + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    osc.connect(amp).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + duration + 0.05);
}

/**
 * Plays one cue. Safe to call at any time and from any state: disabled,
 * unsupported, blocked and suspended all return quietly.
 */
export function playCue(cue: SoundCue) {
    const ctx = audio();
    if (!ctx) return;
    try {
        // A context created before the first gesture starts suspended; asking
        // it to resume is free and silently declined when it cannot.
        if (ctx.state === 'suspended') void ctx.resume().catch(() => { /* declined */ });
        const now = ctx.currentTime + 0.02;

        if (cue === 'cannon') {
            // Low, short, and falling — a report rather than a note.
            tone(ctx, { at: now, freq: 110, to: 34, duration: 0.55, gain: 0.32, type: 'triangle' });
            tone(ctx, { at: now, freq: 62, to: 28, duration: 0.7, gain: 0.22, type: 'sine' });
            return;
        }

        if (cue === 'anthem') {
            // Three rising notes: a sting, not a tune. Long enough to be
            // recognisable across a run and short enough to survive being
            // heard eight nights running.
            [[0, 392], [0.24, 494], [0.48, 587]].forEach(([offset, freq]) => {
                tone(ctx, { at: now + offset, freq, duration: 0.34, gain: 0.16, type: 'sawtooth' });
            });
            return;
        }

        // parachute: two bright, quiet chimes.
        tone(ctx, { at: now, freq: 1175, duration: 0.22, gain: 0.1, type: 'sine' });
        tone(ctx, { at: now + 0.12, freq: 1568, duration: 0.3, gain: 0.08, type: 'sine' });
    } catch {
        // An audio failure must never cost the chronicle.
    }
}
