import { Tribute, Zone } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { FEAR, MEMORY, MOVEMENT } from '../data/balance';
import { SimContext } from './context';
import { effectiveResources, zoneFeatures } from './map';
import { ensureMemory, hasVengeanceAgainst, rememberedBarren, rememberedRivals, rememberedThreat } from './memory';
import { fearInZone } from './fear';
import { traitMod } from '../data/traits';
import { isAggressiveStance, isEvasiveStance } from '../data/stances';

/**
 * Destination scoring.
 *
 * A tribute picks a zone from its printed danger and resource numbers, from
 * what their own body is telling them, *and* from what they personally know:
 * that three people died in the swamp yesterday, that the Careers were camped
 * in the forest an hour ago, that they already stripped the riverbank
 * themselves. None of that is omniscient — it all comes out of the tribute's
 * own memory, which decays.
 */
export function pickDestination(ctx: SimContext, t: Tribute, options: Zone[]): Zone {
    const arch = ARCHETYPES[t.archetype];
    const state = ctx.state;

    const scored = options.map(z => {
        let score = 1;

        // Printed terrain qualities, adjusted for what has actually been eaten.
        score += effectiveResources(state, z) * (1 + arch.caution) * 1.4;

        // Need, not just opportunity. A tribute dying of thirst walks toward
        // water — this is the simplest and most important standing intention in
        // the arena, and without it they wandered by resource score alone and
        // died of dehydration two zones from a river.
        if (t.vitals.thirst > MOVEMENT.thirstUrgency && zoneFeatures(z).waterSource === true) {
            const urgency = (t.vitals.thirst - MOVEMENT.thirstUrgency) / (100 - MOVEMENT.thirstUrgency);
            score += urgency * MOVEMENT.waterSeekWeight;
        }
        // Cover is worth walking to when they need to sleep off a bad day.
        if (t.vitals.fatigue > MOVEMENT.shelterUrgency && (z.terrain === 'forest' || z.terrain === 'ruins')) {
            score += MOVEMENT.shelterSeekWeight;
        }
        score += z.danger * (arch.aggression > 0 ? arch.aggression * 2 : -arch.caution * 2);

        // Remembered dread: bodies, ambushes and hazards leave a mark.
        const threat = rememberedThreat(state, t, z.name);
        score -= threat * (1 + arch.caution) * 1.5;
        if (isEvasiveStance(t.stance) && threat > MEMORY.avoidThreshold) score -= 3;

        // Remembered company: hunters follow it, hiders run from it.
        const rivals = rememberedRivals(state, t, z.name);
        if (rivals > 0) {
            const seeking = isAggressiveStance(t.stance) || arch.aggression > 0.1;
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

        // Fear of a *person*, not of a place. A tribute who watched someone
        // butcher their district partner will not walk into that person's zone
        // however good the foraging is, and no amount of generic zone-threat
        // captured that before.
        const dreaded = fearInZone(state, t, z.name) / FEAR.max;
        if (dreaded > 0) {
            // Unless they are the one doing the hunting: a target's menace is a
            // reason to go, not a reason to stay away.
            const hunting = isAggressiveStance(t.stance) || ensureMemory(t).vengeance.length > 0;
            if (!hunting) score -= dreaded * FEAR.avoidWeight * (1 + arch.caution);
        }

        // Ground a tribute is personally good at. A Climber goes up, a Swimmer
        // crosses, and a Night-Sighted tribute is not pinned down after dark.
        if (z.terrain === 'highland') score += traitMod(t, 'highland');
        if (z.terrain === 'water' || z.terrain === 'wetland') score += traitMod(t, 'water');

        if (isEvasiveStance(t.stance)) score -= z.danger * 2;

        // A1: Scavenging routes toward ground somebody else has already paid
        // for — a cannon site with a dropped pack still on it, or a zone
        // stripped of forage but never picked over for kit. This is the
        // opposite of the barren penalty above and deliberately overrides it.
        if (t.stance === 'Scavenging') {
            const cycle = state.cycle ?? 0;
            const cannon = (state.recentCannonZones ?? [])
                .filter(c => c.zone === z.name && c.cycle >= cycle - MOVEMENT.scavengeCannonMemory).length;
            score += cannon * MOVEMENT.scavengeCannonWeight;
            // Depleted-but-unlooted ground: the food is gone, the gear is not.
            score += rememberedBarren(state, t, z.name) * MOVEMENT.scavengeBarrenWeight;
            const bodies = state.tributes.filter(o => o.status === 'dead' && o.zone === z.name).length;
            score += bodies * MOVEMENT.scavengeBodyWeight;
        }

        // A1: Shadowing follows one zone behind a specific person rather than
        // scoring the map at all.
        if (t.stance === 'Shadowing' && t.shadowing) {
            const quarry = state.tributes.find(o => o.id === t.shadowing!.targetId);
            if (quarry?.status === 'alive' && quarry.zone === z.name) score += MOVEMENT.shadowFollowWeight;
        }

        return { z, score: Math.max(0.1, score) };
    });

    let roll = ctx.rng.nextFloat() * scored.reduce((s, o) => s + o.score, 0);
    for (const o of scored) {
        roll -= o.score;
        if (roll <= 0) return o.z;
    }
    return scored[scored.length - 1].z;
}
