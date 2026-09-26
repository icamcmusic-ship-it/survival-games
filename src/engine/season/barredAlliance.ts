import { SimContext } from '../context';
import { seasonOf } from './runState';

/**
 * AUDIT-12 wave 3: the "this alliance never formed" what-if, as a replayed
 * Capitol command. Kept apart from `whatIfBranches.ts` so the per-cycle tick
 * does not import the simulator.
 */
/** The replayed `bar-alliance` command. */
export function barAlliance(ctx: SimContext, targetId: string | undefined): void {
    const ids = (targetId ?? '').split(',').filter(Boolean);
    if (ids.length >= 2) seasonOf(ctx.state).barredAlliance = ids;
}

/** Each cycle: no two barred members may share a pack. The later member is turned out. */
export function enforceBarredAlliance(ctx: SimContext): void {
    const barred = ctx.state.season?.barredAlliance;
    if (!barred || barred.length < 2) return;
    const seen = new Map<string, string>();
    barred.forEach(id => {
        const t = ctx.state.tributes.find(x => x.id === id);
        if (!t || t.status !== 'alive' || !t.allianceId) return;
        if (seen.has(t.allianceId)) {
            t.allianceId = undefined;
            return;
        }
        seen.set(t.allianceId, t.id);
    });
}
