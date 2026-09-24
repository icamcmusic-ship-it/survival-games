import { SimContext, getAlive } from './context';
import { samePlace } from './verticality';
import { cycleOf } from './memory';
import { adjustRel, adjustTrust } from './relationships';
import { REUNION } from '../data/balance';
import { noteMilestone } from './milestones';
import { allied } from './alliance';

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
            if (t.id > other.id) return;

            noteMilestone(ctx, 'reunion', [t.id, other.id]);
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
