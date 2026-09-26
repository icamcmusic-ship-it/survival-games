import { GameState } from '../../models/types';
import { AUDIT12_WAVE3 } from '../../data/balance';
import { NEUTRAL_TASTE, directorTaste } from '../../data/directors';
import { seasonOf } from './runState';

/**
 * AUDIT-12 wave 3 §11: the Gamemakers' cruelty meter.
 *
 * Every intervention the booth makes on its own account — a mutt release, a
 * front, a signature, a director's authored turn — adds to one 0-100 meter,
 * which decays each cycle. The meter is the fairness guard's input: above
 * `guardAt` the booth may not reach for another authored intervention until
 * it cools, so a director's taste cannot stack itself into a massacre. The
 * player sees it on the dossier with the reason for each rise.
 */
const C = AUDIT12_WAVE3.cruelty;

export type CrueltyKind = 'mutt' | 'weather' | 'feast' | 'signature' | 'director';

const AMOUNT: Record<CrueltyKind, number> = {
    mutt: C.perMutt,
    weather: C.perWeather,
    feast: C.perFeast,
    signature: C.perSignature,
    director: C.perDirector,
};

export function crueltyOf(state: GameState): number {
    return state.season?.cruelty ?? 0;
}

export function addCruelty(state: GameState, kind: CrueltyKind, why: string): void {
    const s = seasonOf(state);
    const amount = AMOUNT[kind];
    s.cruelty = Math.min(100, Math.round(((s.cruelty ?? 0) + amount) * 10) / 10);
    const log = s.crueltyLog ?? (s.crueltyLog = []);
    log.push({ cycle: state.cycle ?? 0, amount, why });
    if (log.length > C.logCap) log.splice(0, log.length - C.logCap);
}

export function decayCruelty(state: GameState): void {
    const s = state.season;
    if (!s?.cruelty) return;
    s.cruelty = Math.round(s.cruelty * C.keep * 10) / 10;
    if (s.cruelty < 0.5) s.cruelty = 0; // balance-exempt: rounding a decayed meter to zero, not a design dial
}

/** The fairness guard: may the booth make another authored intervention now? */
export function fairnessAllows(state: GameState): boolean {
    return crueltyOf(state) < C.guardAt;
}

export function crueltyBand(value: number): 'restrained' | 'pointed' | 'cruel' | 'vicious' {
    const [a, b, c] = C.bands;
    if (value >= c) return 'vicious';
    if (value >= b) return 'cruel';
    if (value >= a) return 'pointed';
    return 'restrained';
}

/** The booth's command types, read as cruelty. Mercy, drops and reveals cost nothing. */
export function noteGamemakerCruelty(state: GameState, type: string, scheduled: boolean): void {
    const kind: CrueltyKind | undefined = type === 'mutt' || type === 'bounty' ? 'mutt'
        : type === 'weather' || type === 'burn' || type === 'flood' || type === 'fog' || type === 'sever' || type === 'strip' ? 'weather'
            : type === 'feast' ? 'feast' : undefined;
    if (!kind) return;
    addCruelty(state, kind, `${scheduled ? 'the Capitol' : 'the booth'}: ${type}`);
}

/**
 * The Capitol's unscheduled disruptions wait while the booth is over the
 * fairness line, and never come at all under a hands-off director — the
 * calendar's own beats still fire, because those were announced.
 */
export function extraDisruptionHeld(state: GameState): boolean {
    if (state.config.vanillaRules) return false;
    if (!fairnessAllows(state)) return true;
    const taste = directorTaste(state.headGamemaker);
    return !!state.headGamemaker && taste.id === 'hands-off' && taste !== NEUTRAL_TASTE;
}
