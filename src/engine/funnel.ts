import { GameState, Tribute } from '../models/types';
import { SimContext } from './context';

/**
 * AUDIT-10 B4-02: where an opportunity is actually lost.
 *
 * `signatureFired` is a boolean, and a boolean is the least useful shape this
 * fact can take. A signature that fires on 30% of runs has failed somewhere,
 * and "somewhere" covers outcomes with opposite fixes:
 *
 *   - the tribute died before the beat could land        → nothing to fix
 *   - the prerequisite never existed                     → the world is wrong
 *   - it existed and the tribute could not see it        → awareness is wrong
 *   - they could see it and could not afford to act      → the price is wrong
 *   - they acted and it did not work                     → the odds are wrong
 *   - it worked and changed nothing                      → the reward is wrong
 *
 * A single rate cannot tell those apart, which is the audit's point about the
 * low-signature archetypes: *"this is what stops an opportunity failure being
 * hidden behind a larger bonus"*. A Broker whose sale multiplier is raised
 * because their signature fires rarely gets a better price on a deal they are
 * still never in a position to offer, and the rate goes up while nothing is
 * fixed.
 *
 * So the stages are counted separately, per archetype, and the report says
 * which one the drop happens at.
 */
export type FunnelStage =
    /** Alive, has a signature, and it has not fired yet. */
    | 'eligible'
    /** The once-per-cycle roll let the beat be considered this cycle. */
    | 'offered'
    /** The beat's own prerequisite was there to act on. */
    | 'available'
    /** The tribute knew about it — a sighting, a memory, a line of sight. */
    | 'aware'
    /** They could pay for it: hours, reach, kit, standing. */
    | 'affordable'
    /** It fired. */
    | 'fired'
    /**
     * It left something behind. The stage the whole exercise is for: a beat
     * that fires and changes nothing is not a working opportunity, and it is
     * indistinguishable from a working one in a fire-rate table.
     */
    | 'benefited';

export const FUNNEL_STAGES: ReadonlyArray<FunnelStage> =
    ['eligible', 'offered', 'available', 'aware', 'affordable', 'fired', 'benefited'];

/**
 * Off by default.
 *
 * The funnel is measurement scaffolding for `scripts/funnel.ts`, not a thing
 * the game needs to know about itself. Counting on every cycle of every run
 * would put a `Record` write in the hot path and a growing object in every
 * save, in exchange for nothing a player ever sees — so a harness opts in and
 * an ordinary run is untouched.
 */
export function enableFunnel(state: GameState) {
    state.funnel = state.funnel ?? {};
}

export function noteStage(ctx: SimContext, t: Tribute, stage: FunnelStage) {
    const funnel = ctx.state.funnel;
    if (!funnel) return;
    const row = funnel[t.archetype] ?? (funnel[t.archetype] = {});
    row[stage] = (row[stage] ?? 0) + 1;
}

/**
 * Did the set piece leave anything behind?
 *
 * Asked once per tribute per run, on the cycle it first becomes true, because
 * `benefited` is a per-tribute fact and counting it per cycle would make an
 * archetype that benefits slowly look better than one that benefits once.
 *
 * Only the archetypes whose outcome has been defined are here, and the report
 * says which those are rather than printing a zero for the rest — a zero and
 * "nobody has said what winning looks like for this beat" are different facts,
 * and conflating them is how an unmeasured thing comes to look like a broken
 * one.
 */
const OUTCOMES: Partial<Record<string, (state: GameState, t: Tribute) => boolean>> = {
    /*
     * Tracker: the read turned into a contact.
     *
     * The audit's instruction is to "reward useful information and avoided
     * danger, not only pursuit", and the first half of that is measurable
     * today: `trackerRead` hands its actor another tribute's position and sets
     * a stalk. Standing where the quarry is standing is the moment the
     * information became worth having. Whether they should also be rewarded for
     * *not* going is a design question this instrument is meant to inform, not
     * pre-empt.
     */
    tracker: (state, t) => {
        const goal = t.objective;
        if (goal?.kind !== 'stalk') return false;
        const quarry = state.tributes.find(o => o.id === goal.targetId);
        return !!quarry && quarry.status === 'alive' && quarry.zone === t.zone;
    },
};

/** The archetypes whose `benefited` stage has a definition. */
export const OUTCOMES_DEFINED: ReadonlyArray<string> = Object.keys(OUTCOMES);

export function runFunnelOutcomes(ctx: SimContext) {
    if (!ctx.state.funnel) return;
    ctx.state.tributes.forEach(t => {
        if (t.status !== 'alive' || !t.signatureFired || t.signatureBenefited) return;
        const outcome = OUTCOMES[t.archetype];
        if (!outcome || !outcome(ctx.state, t)) return;
        t.signatureBenefited = true;
        noteStage(ctx, t, 'benefited');
    });
}
