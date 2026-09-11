import { Tribute, Zone } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { FEAR, MEMORY, MOVEMENT, NOTORIETY, DECISION_TRACE, ENDGAME_POSITIONING, INJURY_BEHAVIOUR, RISK } from '../data/balance';
import { SimContext } from './context';
import { effectiveResources, zoneFeatures } from './map';
import { ensureMemory, hasVengeanceAgainst, reckonsRegrown, rememberedBarren, rememberedRivals, rememberedThreat } from './memory';
import { fearInZone } from './fear';
import { notorietyInZone } from './notoriety';
import { rumourPull } from './rumours';
import { riskTolerance } from './risk';
import { injuryGrade } from './wounds';
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
        // A §4: and the state half of the same read. A tribute who is hurt,
        // laden and late in the run avoids dangerous ground the same archetype
        // would have walked into on day one.
        score += z.danger * riskTolerance(ctx, t) * RISK.dangerWeight;

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

        // Ground they believe they already stripped is not worth walking back
        // to — unless they can read the regrowth curve and reckon it has had
        // long enough. §11.1: this is what turns depletion from a permanent
        // "do not return" flag into a boom-bust cycle a canny tribute can time.
        if (reckonsRegrown(state, t, z.name)) {
            score += MEMORY.regrowthPull;
        } else {
            score -= rememberedBarren(state, t, z.name) * MEMORY.barrenWeight;
        }

        // Fear of a *person*, not of a place. A tribute who watched someone
        // butcher their district partner will not walk into that person's zone
        // however good the foraging is, and no amount of generic zone-threat
        // captured that before.
        // §3.5: a zone is also avoided for who is *said* to be in it, not only
        // for who has been watched working there.
        score -= notorietyInZone(state, t, z.name) * NOTORIETY.avoidWeight;
        // §4.7: and whatever they have been told about the place. A believed
        // cache pulls, a believed occupant pushes, and either can be a plant.
        score += rumourPull(state, t, z.name);
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

        // A §7: a tribute with their legs opened does not pick the far zone.
        // `injurySeverity` graded leg wounds and the destination scorer never
        // asked — a tribute on a grade-3 leg walked the map exactly like one
        // who could run.
        const legs = injuryGrade(t, 'legs');
        if (legs > 0 && z.name !== t.zone) {
            score -= legs * INJURY_BEHAVIOUR.legsHopPenaltyPerGrade;
        }

        // A §11: the last few pick their ground on purpose.
        const fieldLeft = state.tributes.filter(o => o.status === 'alive').length;
        if (fieldLeft <= ENDGAME_POSITIONING.fieldSize && fieldLeft > 1) {
            const wantsTheHorn = riskTolerance(ctx, t) > ENDGAME_POSITIONING.hornEdge;
            const isHorn = /cornucopia/i.test(z.name);
            const isHigh = zoneFeatures(z).elevation === true;
            if ((wantsTheHorn && isHorn) || (!wantsTheHorn && isHigh)) {
                score += ENDGAME_POSITIONING.pullWeight;
            }
        }

        const out = { z, score: Math.max(0.1, score) };
        return out;
    });

    // A §1: the top few destinations, for the tribute sheet's trace.
    if (t.decisionTrace) {
        t.decisionTrace.destinations = [...scored]
            .sort((a, b) => b.score - a.score)
            .slice(0, DECISION_TRACE.topN)
            .map(o => ({ zone: o.z.name, score: Math.round(o.score * 100) / 100 }));
    }

    let roll = ctx.rng.nextFloat() * scored.reduce((s, o) => s + o.score, 0);
    let pick = scored[scored.length - 1];
    for (const o of scored) {
        roll -= o.score;
        if (roll <= 0) { pick = o; break; }
    }
    // §3.3 (audit): where the pick sat among the options. The roll is
    // weighted, so a low-ranked pick is legitimate now and then; the soak's
    // decision check asserts it is not the norm.
    if (t.decisionTrace) {
        const ranked = [...scored].sort((a, b) => b.score - a.score);
        const rank = ranked.indexOf(pick);
        t.decisionTrace.destinationPick = {
            zone: pick.z.name,
            rank,
            of: ranked.length,
            percentile: ranked.length <= 1 ? 1 : Math.round((1 - rank / (ranked.length - 1)) * 100) / 100,
        };
    }
    return pick.z;
}
