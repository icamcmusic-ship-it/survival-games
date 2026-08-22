/**
 * §2.2: the three sounds that matter — the cannon, the anthem, the parachute —
 * synthesized with WebAudio so there is nothing to download and nothing to
 * license. Everything routes through one lazily-created context (browsers
 * refuse audio before a user gesture; `unlockAudio` is called from the first
 * click) and one gate: the persisted mute preference.
 */
import { prefsStore } from '../store/prefsStore';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
        try {
            ctx = new AC();
        } catch {
            return null;
        }
    }
    return ctx;
}

/** Call from any user gesture — resumes a context the browser auto-suspended. */
export function unlockAudio(): void {
    const c = getCtx();
    if (c && c.state === 'suspended') void c.resume().catch(() => { /* stays silent */ });
}

function muted(): boolean {
    return prefsStore.getState().muteAudio;
}

/** The cannon: a low, felt-more-than-heard boom. Also the accessibility cue —
 *  it says "somebody died" while the player's eyes are on the map pane. */
export function playCannon(): void {
    const c = getCtx();
    if (!c || muted()) return;
    const t = c.currentTime;
    // Filtered noise burst over a sine thump.
    const noiseLen = 0.4;
    const buffer = c.createBuffer(1, c.sampleRate * noiseLen, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(220, t);
    const nGain = c.createGain();
    nGain.gain.setValueAtTime(0.5, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + noiseLen);
    noise.connect(lp).connect(nGain).connect(c.destination);

    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.5);
    const oGain = c.createGain();
    oGain.gain.setValueAtTime(0.6, t);
    oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(oGain).connect(c.destination);

    noise.start(t);
    osc.start(t);
    osc.stop(t + 0.65);
}

/** The parachute: a small silver chime, two partials a fifth apart. */
export function playParachute(): void {
    const c = getCtx();
    if (!c || muted()) return;
    const t = c.currentTime;
    [880, 1318.5].forEach((freq, i) => {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.9);
        osc.connect(g).connect(c.destination);
        osc.start(t + i * 0.09);
        osc.stop(t + i * 0.09 + 1);
    });
}

/** The anthem: four solemn brass-ish notes for the nightly roll-call. */
export function playAnthem(): void {
    const c = getCtx();
    if (!c || muted()) return;
    const t = c.currentTime;
    const notes = [196, 261.63, 329.63, 392]; // G3 C4 E4 G4
    notes.forEach((freq, i) => {
        const start = t + i * 0.28;
        const osc = c.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.14, start + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, start + (i === notes.length - 1 ? 1.4 : 0.5));
        osc.connect(g).connect(c.destination);
        osc.start(start);
        osc.stop(start + 1.5);
    });
}
