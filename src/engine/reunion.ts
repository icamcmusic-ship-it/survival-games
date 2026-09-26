import { SimContext, getAlive } from './context';
import { trainProficiency } from './proficiency';
import { samePlace } from './verticality';
import { cycleOf } from './memory';
import { adjustRel, adjustTrust } from './relationships';
import { REUNION } from '../data/balance';
import { noteMilestone } from './milestones';
import { allied } from './alliance';
import { isVeteran } from './veterans';
import { pairKey, seasonOf } from './season/runState';

/**
 * AUDIT-10 B5-01: real reunions.
 *
 * The last item of B5-01 absent outright. `alliance.ts` knows a pack can be
 * "separated" — it says so in a comment about a group that has come apart —
 * and nothing marked the moment it stopped being. Two allies who spent four
 * days on opposite sides of the map and walked back into each other were
 * mechanically identical to two who had never left the same clearing.
 *
 * That is the wrong way round. Days apart in an arena actively trying to kill
 * both of you is the strongest thing an alliance has going for it: the whole
 * value of the bond is that somebody came back.
 *
 * Checked as possible before being written — 658 reunions across 80 runs, 124
 * of them after three or more cycles apart, so gating on a real absence leaves
 * about one and a half a run rather than a beat nobody sees.
 *
 * The payoff is the one the engine already has a lever for. `SANITY.isolationDrain`
 * punishes being alone; finding the person you were counting on is the answer
 * to that, and it is a relief rather than a heal — the arena has not got any
 * safer, but for one evening somebody is watching the other side.
 */
export function tickReunions(ctx: SimContext) {
    const now = cycleOf(ctx.state);
    const grouped = getAlive(ctx.state).filter(t => t.allianceId !== undefined);

    grouped.forEach(t => {
        grouped.forEach(other => {
            if (other.id === t.id || !allied(other, t)) return;
            if (!samePlace(ctx.state.arena, t, other)) return;

            const ledger = t.lastTogetherCycle ?? (t.lastTogetherCycle = {});
            const last = ledger[other.id];
            ledger[other.id] = now;
            if (last === undefined || now - last < REUNION.apartCycles) return;

            /*
             * Both sides remember it, and only one of them narrates it. The
             * pair is ordered by id so the line is written once rather than
             * twice with the names swapped — the same reunion described from
             * both ends reads like two reunions.
             */
            adjustRel(t, other.id, REUNION.regard);
            adjustTrust(t, other.id, REUNION.trust);
            t.vitals.sanity = Math.min(100, t.vitals.sanity + REUNION.sanityRelief);
            // AUDIT-12 §16: finding each other again is what Signalling is for.
            trainProficiency(t, 'signalling', ctx);
            if (t.id > other.id) return;

            noteMilestone(ctx, 'reunion', [t.id, other.id]);
            // AUDIT-12 wave 3: the reunion is written to the campaign, by district pair.
            const pairs = seasonOf(ctx.state).reunionPairs ?? (seasonOf(ctx.state).reunionPairs = []);
            const key = pairKey(t.district, other.district);
            if (!pairs.includes(key)) pairs.push(key);
            const apart = now - last;
            ctx.logEvent(
                `${t.name} and ${other.name} find each other again in ${t.zone} after ${apart} cycles apart. `
                + `Neither of them had any way of knowing the other was still alive until this moment.`,
                [t.id, other.id],
                { important: true, category: 'alliance', zone: t.zone },
            );
        });
    });
}

/**
 * AUDIT-11 §8: the veteran's arena moment. A past victor reaped again gets one
 * beat, the first time they share ground with somebody who has never been in
 * an arena before: the difference is visible, and the other tribute knows it.
 * Once per veteran, no roll.
 */
export function tickVeteranMoments(ctx: SimContext) {
    const seated = ctx.state.veteransSeated;
    if (!seated || seated.length === 0) return;
    const done = ctx.state.veteranMoments ?? [];
    const alive = getAlive(ctx.state);
    alive.filter(v => isVeteran(seated, v) && !done.includes(v.id)).forEach(vet => {
        const rookie = alive.find(o => o.id !== vet.id && !isVeteran(seated, o) && samePlace(ctx.state.arena, vet, o));
        if (!rookie) return;
        ctx.state.veteranMoments = [...(ctx.state.veteranMoments ?? []), vet.id];
        // AUDIT-12 wave 3: and the veteran's district carries it into the next reaping.
        const vets = seasonOf(ctx.state).veteranDistricts ?? (seasonOf(ctx.state).veteranDistricts = []);
        if (!vets.includes(vet.district)) vets.push(vet.district);
        adjustRel(rookie, vet.id, REUNION.veteranRegard);
        ctx.logEvent(
            `${rookie.name} watches ${vet.name} check the wind, the ground and the tree line in the order the ${vet.veteranOf ?? 'last'} Games taught them, `
            + `and understands for the first time that ${vet.name} has done this before and is not frightened of it.`,
            [vet.id, rookie.id],
            { important: true, category: 'arena', zone: vet.zone, actorId: vet.id, fact: `${rookie.name} met the veteran ${vet.name}.` },
        );
    });
}
