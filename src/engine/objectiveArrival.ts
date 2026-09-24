import { Tribute } from '../models/types';
import { SimContext } from './context';
import { OBJECTIVES } from '../data/balance';
import { adjustResolve } from './resolve';
import { loseSanity } from './sanityBands';
import { noteSighting } from './memory';
import { depletionOf, hopsTo, severedEdgeSet, zoneNames } from './map';
import { noteMilestone } from './milestones';
import { allied } from './alliance';

/**
 * §16: what standing there actually does.
 *
 * Three of the intentions in `Objective` are walks — the tribute has decided to
 * be somewhere, and the deciding is the whole of it until they arrive. `reach`
 * and `scavenge` arrive into systems that were already there to meet them
 * (water, shelter, a cache with an owner). `mourn` and `scout` arrived into
 * nothing: the tribute walked across the arena, the chronicle said they left
 * one zone for another, and the intention quietly expired. This is the other
 * end of those two walks.
 *
 * Called from the movement step, immediately after a tribute's zone changes,
 * and only fires when the zone they are now standing in is the one their
 * objective named. It cannot double-fire within a cycle: `objectiveStep`
 * returns nothing once the destination is underfoot, so there is no second
 * move to arrive from, and by the next cycle `isObjectiveValid` has already
 * retired the intention.
 */
export function onObjectiveArrival(ctx: SimContext, t: Tribute) {
    const objective = t.objective;
    if (!objective) return;
    if (objective.kind === 'mourn') {
        if (t.zone !== objective.zone) return;
        mournArrival(ctx, t, objective.forId);
        return;
    }
    if (objective.kind === 'scout') {
        if (t.zone !== objective.zone) return;
        scoutArrival(ctx, t);
    }
}

/**
 * The ground somebody fell on.
 *
 * There is deliberately nothing here to pick up. A mourner gets the one thing
 * the arena never otherwise hands out for free — a reason to keep going — and
 * pays for it by looking at what is left, which is what `mournSanity` is. An
 * intention with no survival value that tributes still form is the point of
 * having intentions at all.
 */
function mournArrival(ctx: SimContext, t: Tribute, forId: string) {
    const fallen = ctx.state.tributes.find(o => o.id === forId);
    adjustResolve(t, OBJECTIVES.mournResolve);
    loseSanity(t, OBJECTIVES.mournSanity, ctx.state.config.sanityDrainRate ?? 1);
    noteMilestone(ctx, 'grave-visited', [t.id, forId]);
    ctx.logEvent(
        `${t.name} stands where ${fallen?.name ?? 'they'} fell in ${t.zone}, takes nothing, and goes on.`,
        [t.id, forId],
        { important: true, zone: t.zone, category: 'sanity' }
    );
}

/**
 * A map gone cold.
 *
 * The climb pays in exactly the currency the intention was formed over: where
 * the rest of the field is. Everything inside `scoutSweepHops` of the vantage
 * is written into the tribute's own zone memory through the ordinary sighting
 * path, so it ages, decays and can be lied about like anything else they saw
 * with their own eyes.
 */
function scoutArrival(ctx: SimContext, t: Tribute) {
    const state = ctx.state;
    const collapsed = state.collapsedZones ?? [];
    const severed = severedEdgeSet(state);
    const alive = state.tributes.filter(o => o.status === 'alive');
    let swept = 0;
    let counted = 0;
    zoneNames(state.arena).forEach(zone => {
        if (collapsed.includes(zone)) return;
        const hops = zone === t.zone ? 0 : hopsTo(state.arena, t.zone, zone, collapsed, severed);
        if (hops === undefined || hops > OBJECTIVES.scoutSweepHops) return;
        const rivals = alive.filter(o =>
            o.id !== t.id && o.zone === zone
            && !allied(o, t)).length;
        noteSighting(state, t, zone, rivals, depletionOf(state, zone));
        swept += 1;
        counted += rivals;
    });
    if (swept === 0) return;
    noteMilestone(ctx, 'vantage-swept', [t.id]);
    ctx.logEvent(
        counted > 0
            ? `${t.name} gets high in ${t.zone} and counts ${counted} of them moving across ${swept} zones.`
            : `${t.name} gets high in ${t.zone} and reads ${swept} zones of empty ground. Nobody is moving.`,
        [t.id],
        { zone: t.zone, category: 'travel' }
    );
}
