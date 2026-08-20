import { Tribute, Zone } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { MEMORY } from '../data/balance';
import { SimContext } from './context';
import { effectiveResources } from './map';
import { ensureMemory, hasVengeanceAgainst, rememberedBarren, rememberedRivals, rememberedThreat } from './memory';

/**
 * Destination scoring.
 *
 * A tribute picks a zone from its printed danger and resource numbers *and*
 * from what they personally know: that three people died in the swamp
 * yesterday, that the Careers were camped in the forest an hour ago, that they
 * already stripped the riverbank themselves. None of that is omniscient — it
 * all comes out of the tribute's own memory, which decays.
 */
export function pickDestination(ctx: SimContext, t: Tribute, options: Zone[]): Zone {
    const arch = ARCHETYPES[t.archetype];
    const state = ctx.state;

    const scored = options.map(z => {
        let score = 1;

        // Printed terrain qualities, adjusted for what has actually been eaten.
        score += effectiveResources(state, z) * (1 + arch.caution) * 1.4;
        score += z.danger * (arch.aggression > 0 ? arch.aggression * 2 : -arch.caution * 2);

        // Remembered dread: bodies, ambushes and hazards leave a mark.
        const threat = rememberedThreat(state, t, z.name);
        score -= threat * (1 + arch.caution) * 1.5;
        if (t.stance === 'Evasive' && threat > MEMORY.avoidThreshold) score -= 3;

        // Remembered company: hunters follow it, hiders run from it.
        const rivals = rememberedRivals(state, t, z.name);
        if (rivals > 0) {
            const seeking = t.stance === 'Aggressive' || arch.aggression > 0.1;
            score += seeking
                ? rivals * MEMORY.rivalSeekWeight
                : -rivals * MEMORY.rivalAvoidWeight * (1 + arch.caution);
        }

        // A vengeance target's last known position beats every other consideration.
        if (ensureMemory(t).vengeance.length > 0) {
            const hunted = state.tributes.filter(o =>
                o.status === 'alive' && hasVengeanceAgainst(t, o.id) && o.zone === z.name);
            if (hunted.length > 0 && rivals > 0) score += 4;
        }

        // Ground they believe they already stripped is not worth walking back to.
        score -= rememberedBarren(state, t, z.name) * MEMORY.barrenWeight;

        if (t.stance === 'Evasive') score -= z.danger * 2;
        return { z, score: Math.max(0.1, score) };
    });

    let roll = ctx.rng.nextFloat() * scored.reduce((s, o) => s + o.score, 0);
    for (const o of scored) {
        roll -= o.score;
        if (roll <= 0) return o.z;
    }
    return scored[scored.length - 1].z;
}
