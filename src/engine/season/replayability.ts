import { GameState, HallOfFameEntry, Tribute } from '../../models/types';
import { ArenaScar, SeasonLedger } from '../../models/seasonTypes';
import { AUDIT13_SIDE } from '../../data/balance';
import { LegacyTier, legacyOf } from '../../data/districts';
import { campaignOf } from '../campaign';
import { finishingOrder } from '../prediction';

/**
 * AUDIT-13 §12: the replayability layer's rules — pure functions over the
 * ledger and the finished state, plus the one arena hook (P8). The UI and the
 * record book call these; the engine reads only the campaign slice a run was
 * created under, so a headless run with no record book is unchanged.
 */

/* -------------------------------------------------------------------------- */
/* P3: district legacy drift                                                   */
/* -------------------------------------------------------------------------- */

const TIERS: LegacyTier[] = ['forgotten', 'thin', 'modest', 'strong', 'storied'];

/** Tier steps a district's drift has moved it, up (+) or down (-). */
export function legacySteps(drift: number | undefined): number {
    const d = drift ?? 0;
    return d >= 0 ? Math.floor(d / AUDIT13_SIDE.legacyTierStep) : -Math.floor(-d / AUDIT13_SIDE.legacyTierStep);
}

/** The district's tier after its drift: storied districts that stop winning slide, thin ones that win climb. */
export function driftedTier(district: number, drift: Record<number, number> | undefined): LegacyTier {
    const base = TIERS.indexOf(legacyOf(district).tier);
    const at = Math.max(0, Math.min(TIERS.length - 1, base + legacySteps(drift?.[district])));
    return TIERS[at];
}

/** The drifted tier for a live run, from the campaign it was created under. */
export function runTierOf(state: Pick<GameState, 'campaign'>, district: number): LegacyTier {
    return driftedTier(district, campaignOf(state.campaign).ledger?.legacyDrift);
}

/**
 * One Games folded into the drift: every district's drift decays toward
 * zero, a crowned district climbs, and a district a storied tier above its
 * results slips — so the sponsor landscape moves over seasons.
 */
export function foldLegacyDrift(prev: Record<number, number> | undefined, state: GameState): Record<number, number> {
    const next: Record<number, number> = {};
    Object.entries(prev ?? {}).forEach(([d, v]) => {
        const kept = Math.round(v * AUDIT13_SIDE.legacyKeep * 100) / 100;
        if (Math.abs(kept) >= 0.05) next[Number(d)] = kept;
    });
    const crowned = new Set(state.tributes.filter(t => t.status === 'alive').map(t => t.district));
    new Set(state.tributes.map(t => t.district)).forEach(d => {
        if (crowned.has(d)) next[d] = Math.round(((next[d] ?? 0) + AUDIT13_SIDE.legacyCrownDrift) * 100) / 100;
        // A storied or strong district that went home with nothing loses a little shine.
        else if (TIERS.indexOf(legacyOf(d).tier) >= 3) next[d] = Math.round(((next[d] ?? 0) - AUDIT13_SIDE.legacyCrownDrift / 4) * 100) / 100;
    });
    return next;
}

/** What the sponsor blocs' pedigree money reads: +1 per tier the district has climbed, -1 per tier it has fallen. */
export function legacySponsorLean(state: Pick<GameState, 'campaign'>, t: Pick<Tribute, 'district'>): number {
    return legacySteps(campaignOf(state.campaign).ledger?.legacyDrift?.[t.district]);
}

/* -------------------------------------------------------------------------- */
/* P6: draft mode                                                              */
/* -------------------------------------------------------------------------- */

export interface DraftScore {
    score: number;
    max: number;
    /** Each pick's finishing place (1 = victor) and points. */
    picks: Array<{ id: string; name: string; place: number; points: number }>;
}

export function scoreDraft(state: GameState, draft: string[] | undefined = state.draft): DraftScore | undefined {
    const ids = (draft ?? []).filter(Boolean).slice(0, AUDIT13_SIDE.draftSize);
    if (ids.length === 0) return undefined;
    const order = finishingOrder(state.tributes);
    const picks = ids.map(id => {
        const place = order.findIndex(t => t.id === id) + 1;
        const t = state.tributes.find(x => x.id === id);
        return { id, name: t?.name ?? '?', place, points: place > 0 ? AUDIT13_SIDE.draftPoints[place - 1] ?? 0 : 0 };
    });
    const max = AUDIT13_SIDE.draftPoints.slice(0, ids.length).reduce((a, b) => a + b, 0);
    return { score: picks.reduce((a, p) => a + p.points, 0), max, picks };
}

/* -------------------------------------------------------------------------- */
/* P7: victor-return Quell                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The victors a victor-return Quell reaps again: the most recent crowned,
 * single-victor entries in the player's own Hall of Fame, one per given name.
 * Deterministic over the archive, so the same book seats the same field.
 */
export function victorReturnPool(archive: HallOfFameEntry[], cap: number = AUDIT13_SIDE.victorReturnSeats): HallOfFameEntry[] {
    const seen = new Set<string>();
    return archive
        .filter(e => !e.noVictor && !e.winnerName.includes('&'))
        .filter(e => {
            const key = e.winnerName.split(/\s+/)[0];
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, cap);
}

/* -------------------------------------------------------------------------- */
/* P8: arena incident scars                                                    */
/* -------------------------------------------------------------------------- */

export const arenaScarKey = (arena: GameState['arena']) => arena.mapId ?? arena.id;

/** The incident a finished Games leaves on its arena, if any. */
export function incidentOf(state: GameState, run: number): ArenaScar | undefined {
    const winners = state.tributes.filter(t => t.status === 'alive');
    const dead = state.tributes.filter(t => t.status === 'dead')
        .sort((a, b) => (b.eliminationIndex ?? 0) - (a.eliminationIndex ?? 0));
    // Where the last of them fell: a dead tribute keeps the zone they died in.
    const lastZone = dead[0]?.zone;
    if (winners.length === 0 && lastZone) return { kind: 'wipeout', zone: lastZone, run };
    const override = (state.interventionLog ?? []).filter(i => i.type !== 'parachute' && !i.scheduled);
    if (override.length > 0) {
        const target = state.tributes.find(t => t.id === override[override.length - 1].targetId);
        const zone = target?.zone ?? state.arena.zones[0]?.name;
        if (zone) return { kind: 'override', zone, run };
    }
    return undefined;
}

export function foldArenaScars(prev: SeasonLedger['arenaScars'], state: GameState, run: number): SeasonLedger['arenaScars'] {
    const scar = incidentOf(state, run);
    if (!scar) return prev;
    const key = arenaScarKey(state.arena);
    const next = { ...(prev ?? {}) };
    next[key] = [scar, ...(next[key] ?? []).filter(s => s.zone !== scar.zone)].slice(0, AUDIT13_SIDE.scarsPerArena);
    return next;
}
