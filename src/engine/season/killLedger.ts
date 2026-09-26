import { GameState } from '../../models/types';
import { KillLedgerEntry } from '../../models/seasonTypes';

/**
 * AUDIT-12 wave 3 §11: a tribute's kill ledger — who they killed, on what day,
 * and how — read off the typed death records rather than the prose, in the
 * order the deaths happened. Pure; used by the interview, the Hall of Fame
 * and the campaign fold.
 */
export function killLedgerOf(state: GameState, killerId: string): KillLedgerEntry[] {
    return state.tributes
        .filter(t => t.status === 'dead' && t.id !== killerId && t.lastDamage?.sourceId === killerId)
        .sort((a, b) => (a.eliminationIndex ?? a.dayOfDeath ?? 0) - (b.eliminationIndex ?? b.dayOfDeath ?? 0))
        .map(t => ({ victim: t.name, district: t.district, day: t.dayOfDeath ?? state.day, how: t.causeOfDeath ?? t.lastDamage?.cause ?? 'killed' }));
}

/** Every killer's ledger, keyed by killer id. */
export function allKillLedgers(state: GameState): Record<string, KillLedgerEntry[]> {
    const out: Record<string, KillLedgerEntry[]> = {};
    state.tributes.forEach(t => {
        const k = killLedgerOf(state, t.id);
        if (k.length > 0) out[t.id] = k;
    });
    return out;
}
