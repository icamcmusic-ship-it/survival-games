import { GameState } from '../models/types';
import { SimContext } from './context';
import { cycleOf } from './memory';

/**
 * AUDIT-10 B3-03: typed facts about what happened, written where it happens.
 *
 * Twenty-five achievement predicates read `state.log`, and ten of them read the
 * *prose* in it with a regular expression. Two things are wrong with that, and
 * only one of them is obvious.
 *
 * The obvious one is that rewording a line changes whether an achievement is
 * earned. The audit puts it plainly: *"More flavor text should not change
 * whether an achievement is earned."* It is not hypothetical — `three-fingers`
 * ("see a district give the salute") tested `/three[- ]finger/i` against every
 * line in the chronicle, and the arena flavour tables contain *"a crack opens
 * across {zone}, three fingers wide"* and *"the hold {tribute} has three
 * fingers behind comes away whole"*. A crack in the ground was awarding a
 * salute.
 *
 * The less obvious one applies to **every** log-reading predicate, typed or
 * not: the chronicle is trimmed. `writeSave` drops the log to 4,000 lines, then
 * 2,000, then 800, then 200 when storage is short — so a tribute whose run is
 * saved and resumed on a full disk can lose the evidence for an achievement
 * they earned on day two. A predicate that reads `e.type === 'obligation-kept'`
 * is immune to rewording and is not immune to that.
 *
 * So: a fact is recorded when it happens, on the state, as a count and a first
 * cycle and (where it matters) who it involved. Small, bounded — one entry per
 * kind of fact rather than per occurrence — and it survives trimming because it
 * is not in the chronicle at all.
 *
 * The chronicle keeps its lines. This is not a replacement for narration; it is
 * the difference between the record of a Games and the story of it.
 */
export interface Milestone {
    /** How many times it happened. */
    count: number;
    /** The cycle it first happened, for anything that cares about order. */
    firstCycle: number;
    /**
     * Who it involved, deduplicated. Only recorded where a predicate needs it —
     * an unbounded id list per fact would be a memory leak wearing a record's
     * clothes.
     */
    who?: string[];
}

/**
 * The facts the engine records. A union rather than a free string so a typo is
 * a build error rather than an achievement that silently never fires — which is
 * the failure mode this whole exercise is about.
 */
export type MilestoneId =
    /** A fire crossed from one zone into the next. */
    | 'fire-spread'
    /** Somebody's bleeding was stopped by hand, theirs or an ally's. */
    | 'bleeding-stopped'
    /** A pack posted a patrol on ground it holds. */
    | 'patrol-posted'
    /** The Capitol restocked the Cornucopia. */
    | 'cornucopia-restocked'
    /** A district gave the three-finger salute at the reaping. */
    | 'salute-given'
    /**
     * AUDIT-10 B5-03: somebody picked up work another tribute had started.
     *
     * Here rather than counted from the chronicle, which is what
     * `check-projects` did first — and matching prose in a test is the same
     * mistake B3-03 spent a commit arguing against, with a milder consequence.
     * A reworded line breaking a build is an annoyance rather than a silently
     * mis-awarded achievement, but the fix is identical and already written.
     */
    | 'project-inherited'
    /**
     * AUDIT-10 B5-03: two wounded people, one treatment, and the moment the
     * question was actually posed.
     *
     * Three ids rather than one, because the interesting number is not how
     * often somebody was generous — it is how often the situation arose at all,
     * and what share of those went each way. A count of gifts with no
     * denominator says nothing about whether the beat is working.
     */
    | 'treatment-scarcity'
    | 'treatment-given'
    | 'treatment-refused'
    /** AUDIT-10 B5-01: two allies found each other again after days apart. */
    | 'reunion'
    /** §16: somebody walked back to where a tribute they cared about fell. */
    | 'grave-visited'
    /** §16: somebody climbed to a vantage and read the ground around it. */
    | 'vantage-swept'
    /** §12: a told killing overturned by the holder's own eyes. */
    | 'accusation-corrected';

/*
 * Deliberately *not* here: traps and mutts. Both were on the first draft of
 * this union and both came off it, because the engine already keeps the fact
 * in typed form — `Tribute.trapsSet` and `GameState.muttsSeen` — and a second
 * record of a fact is a record that can disagree with the first. `check-knobs`
 * makes the same argument about tunables it can no longer find a reader for.
 */

export function noteMilestone(ctx: SimContext, id: MilestoneId, who?: string[]) {
    recordMilestone(ctx.state, id, cycleOf(ctx.state), who);
}

/** The same, for callers that hold a state rather than a context. */
export function recordMilestone(state: GameState, id: MilestoneId, cycle: number, who?: string[]) {
    state.milestones = state.milestones ?? {};
    const existing = state.milestones[id];
    if (!existing) {
        state.milestones[id] = { count: 1, firstCycle: cycle, ...(who?.length ? { who: [...new Set(who)] } : {}) };
        return;
    }
    existing.count += 1;
    if (who?.length) existing.who = [...new Set([...(existing.who ?? []), ...who])];
}

/** Did this happen at all? */
export function happened(state: GameState, id: MilestoneId): boolean {
    return (state.milestones?.[id]?.count ?? 0) > 0;
}

/** How many times — for the predicates that want "twice in one Games". */
export function timesHappened(state: GameState, id: MilestoneId): number {
    return state.milestones?.[id]?.count ?? 0;
}

/** Everyone (or everything) a fact involved. */
export function involvedIn(state: GameState, id: MilestoneId): string[] {
    return state.milestones?.[id]?.who ?? [];
}
