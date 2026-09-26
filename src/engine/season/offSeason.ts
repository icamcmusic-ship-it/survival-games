import { GameState } from '../../models/types';
import { ArenaMastery, MuseumPiece, SeasonLedger } from '../../models/seasonTypes';
import { killLedgerOf } from './killLedger';

/**
 * AUDIT-12 wave 3 §11: the off-season — the arena museum and the victor's tour.
 *
 * The museum is every arena the player has run, with its mastery record and
 * the signature deaths the ledger kept for it, most recent first. The tour is
 * the canon one: the victor visits the districts of the tributes they killed,
 * and each stop names who that district lost and how.
 */
export interface MuseumRoom {
    arena: string;
    mastery?: ArenaMastery;
    pieces: MuseumPiece[];
}

export function museumOf(ledger: SeasonLedger | undefined): MuseumRoom[] {
    const keys = new Set([...Object.keys(ledger?.museum ?? {}), ...Object.keys(ledger?.arenaMastery ?? {})]);
    return [...keys]
        .map(arena => ({ arena, mastery: ledger?.arenaMastery?.[arena], pieces: ledger?.museum?.[arena] ?? [] }))
        .sort((a, b) => (b.mastery?.runs ?? 0) - (a.mastery?.runs ?? 0) || a.arena.localeCompare(b.arena));
}

export interface TourStop {
    district: number;
    line: string;
}

export function victorTour(state: GameState): Array<{ victor: string; stops: TourStop[] }> {
    return state.tributes.filter(t => t.status === 'alive').map(v => {
        const byDistrict = new Map<number, string[]>();
        killLedgerOf(state, v.id).forEach(k => {
            byDistrict.set(k.district, [...(byDistrict.get(k.district) ?? []), `${k.victim} (day ${k.day})`]);
        });
        const stops = [...byDistrict.entries()].sort((a, b) => a[0] - b[0]).map(([district, names]) => ({
            district,
            line: district === v.district
                ? `District ${district}, home: ${names.join(' and ')} came from these streets too. The welcome is quieter than it should be.`
                : `District ${district}: ${names.join(' and ')}. The family stands in the front row because the Capitol says they must. Nobody claps until the Peacekeepers look at them.`,
        }));
        if (stops.length === 0) {
            stops.push({ district: v.district, line: `District ${v.district} only: ${v.name} killed nobody, and the tour has nowhere else it is obliged to go.` });
        }
        return { victor: v.name, stops };
    });
}
