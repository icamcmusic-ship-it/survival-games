import { GameState, InterventionRecord, Tribute } from '../../models/types';
import { WHAT_IF } from '../../data/balance';
import { Simulator } from '../simulator';
import { generateTributes } from '../generator';
import { snapshotState } from '../../utils/snapshot';
import { playerInterventionsAfter } from '../whatIf';

/**
 * AUDIT-12 wave 3 §11: two more counterfactuals for the debrief, both played
 * from the reaping rather than from a late checkpoint.
 *
 *  - **"X was never reaped."** The tribute's plate is taken by a reserve drawn
 *    from the same district — a different person generated from a salted seed,
 *    keeping the slot's id so every reference in the cast stays valid — and
 *    the whole Games is played again on the same seed.
 *  - **"This alliance never formed."** The same Games, with a replayed
 *    Capitol command (`bar-alliance`, through the ordinary intervention
 *    replay) that forbids those members from sharing a pack; any pack that
 *    would put two of them together loses the later arrival each cycle.
 *
 * Both replay the player's own interventions at the cycles they happened, so
 * the only thing that differs is the one fact the question is about.
 */
export interface CounterfactualResult {
    kind: 'never-reaped' | 'no-alliance';
    /** The tribute or alliance the question was about. */
    subject: string;
    actualVictorIds: string[];
    /** One ending per branch: branch 0 is the same seed, the rest salted. */
    branches: Array<{ victorIds: string[]; victorNames: string[]; endDay: number }>;
    sameOutcome: number;
    /** The reserve who took the plate, for 'never-reaped'. */
    reserveName?: string;
}

const victorsOf = (s: GameState) => s.tributes.filter(t => t.status === 'alive');

function runToEnd(start: GameState, salt?: string): GameState {
    const seed = start.seed;
    if (salt !== undefined) start.seed = `${seed}~wi-${salt}`;
    const sim = new Simulator(start);
    let guard = WHAT_IF.maxAdvances * 4;
    while (guard-- > 0 && sim.advance()) { /* to the epilogue */ }
    const end = sim.getState();
    end.seed = seed;
    return end;
}

function summarise(kind: CounterfactualResult['kind'], subject: string, actual: GameState, ends: GameState[], reserveName?: string): CounterfactualResult {
    const key = victorsOf(actual).map(t => t.id).sort().join(',');
    const branches = ends.map(e => ({
        victorIds: victorsOf(e).map(t => t.id).sort(),
        victorNames: victorsOf(e).map(t => t.name),
        endDay: e.day,
    }));
    return {
        kind, subject, reserveName,
        actualVictorIds: victorsOf(actual).map(t => t.id).sort(),
        branches,
        sameOutcome: branches.filter(b => b.victorIds.join(',') === key).length,
    };
}

/** The reserve who would have been reaped instead, grafted onto the slot. */
export function reserveFor(reaping: GameState, tributeId: string): Tribute | undefined {
    const slot = reaping.tributes.find(t => t.id === tributeId);
    if (!slot) return undefined;
    const pool = generateTributes(`${reaping.seed}~reserve-${tributeId}`, reaping.config, slot.zone, reaping.gamesProfile?.castShape, reaping.gamesProfile?.quell);
    const taken = new Set(reaping.tributes.map(t => t.name));
    const pick = pool.find(t => t.district === slot.district && t.gender === slot.gender && !taken.has(t.name))
        ?? pool.find(t => !taken.has(t.name));
    if (!pick) return undefined;
    return { ...pick, id: slot.id, district: slot.district, zone: slot.zone };
}

export function neverReaped(reaping: GameState, actual: GameState, tributeId: string, count = 4): CounterfactualResult | undefined {
    if (reaping.phase !== 'reaping' && reaping.phase !== 'setup') return undefined;
    const reserve = reserveFor(reaping, tributeId);
    const subject = reaping.tributes.find(t => t.id === tributeId)?.name ?? tributeId;
    if (!reserve) return undefined;
    const planned = playerInterventionsAfter(reaping, actual);
    const ends: GameState[] = [];
    for (let k = 0; k < count; k++) {
        const start = snapshotState(reaping);
        start.tributes = start.tributes.map(t => (t.id === tributeId ? snapshotTribute(reserve) : t));
        if (planned.length) start.plannedInterventions = planned.map(p => ({ ...p }));
        ends.push(runToEnd(start, k === 0 ? undefined : `reap-${k}`));
    }
    return summarise('never-reaped', subject, actual, ends, reserve.name);
}

export function allianceNeverFormed(reaping: GameState, actual: GameState, memberIds: string[], label: string, count = 4): CounterfactualResult | undefined {
    if (memberIds.length < 2) return undefined;
    const planned: InterventionRecord[] = [
        { cycle: 0, type: 'bar-alliance', targetId: memberIds.join(',') },
        ...playerInterventionsAfter(reaping, actual),
    ];
    const ends: GameState[] = [];
    for (let k = 0; k < count; k++) {
        const start = snapshotState(reaping);
        start.plannedInterventions = planned.map(p => ({ ...p }));
        ends.push(runToEnd(start, k === 0 ? undefined : `ally-${k}`));
    }
    return summarise('no-alliance', label, actual, ends);
}

function snapshotTribute(t: Tribute): Tribute {
    return JSON.parse(JSON.stringify(t)) as Tribute;
}
