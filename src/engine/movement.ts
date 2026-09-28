import { audit14DestinationScore } from './audit14Content';
import { Tribute, Zone } from '../models/types';
import { audit13DestinationScore } from './audit13Content';
import { cannonAvoidance, signallingPull } from './traitHooks';
import { ARCHETYPES } from '../data/archetypes';
import { CONFUSION, FEAR, MEMORY, MOVEMENT, NOTORIETY, DECISION_TRACE, ENDGAME_POSITIONING, INJURY_BEHAVIOUR, RISK, AUDIT14_ENGINE as E14 } from '../data/balance';
import { confusionOf } from './confusion';
import { SimContext } from './context';
import { edgeKey, effectiveResources, getZone, severedEdgeSet, zoneFeatures } from './map';
import { allied } from './alliance';
import { profOf } from './proficiency';
import { zoneStateOf } from './arenaDynamics';
import { believedIn, cyclesSinceContact, ensureMemory, hasVengeanceAgainst, rememberedPlaceOf, reckonsRegrown, rememberedBarren, rememberedRivals, rememberedThreat } from './memory';
import { fearInZone } from './fear';
import { notorietyInZone } from './notoriety';
import { rumourPull } from './rumours';
import { riskTolerance } from './risk';
import { injuryGrade } from './wounds';
import { traitMod } from '../data/traits';
import { isAggressiveStance, isEvasiveStance } from '../data/stances';
import { isDowned, wouldHelp } from './downed';

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
            // AUDIT-9 B11: the target's last *known* position, not their
            // actual one. A sworn hunter walks to where they saw them, and
            // arrives to find them gone — which is what a hunt is.
            // AUDIT-14 T4: the pull is toward the target, weighted by how fresh
            // the sighting is — it used to need *another* rival seen there too,
            // so an oath with no witness moved nobody.
            let pull = 0;
            state.tributes.forEach(o => {
                if (o.status !== 'alive' || !hasVengeanceAgainst(t, o.id) || !believedIn(state, t, o.id, z.name)) return;
                const since = cyclesSinceContact(state, t, o.id);
                const confidence = Number.isFinite(since)
                    ? Math.max(0, 1 - since / E14.vengeancePullDecayCycles) : 0.5;
                pull = Math.max(pull, E14.vengeancePull * confidence);
            });
            // AUDIT-14 T10: and where they would have gone from there.
            ensureMemory(t).vengeance.forEach(id => {
                if (projectedPlaceOf(ctx, t, id) === z.name) pull = Math.max(pull, E14.vengeancePull * E14.projectionConfidence);
            });
            score += pull;
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
        // AUDIT-14 T3: a sworn oath takes the fear off the *sworn* person only.
        // It used to switch off every person-fear in the arena.
        const dreaded = fearInZone(state, t, z.name, id => hasVengeanceAgainst(t, id)) / FEAR.max;
        if (dreaded > 0) {
            // Unless they are the one doing the hunting: a target's menace is a
            // reason to go, not a reason to stay away.
            if (!isAggressiveStance(t.stance)) score -= dreaded * FEAR.avoidWeight * (1 + arch.caution);
        }
        // AUDIT-14 T6: one hop is not a plan. Water, allies and the sworn
        // target further out pull through the graph, weakening with distance.
        score += potentialField(ctx, t, z.name);

        // Ground a tribute is personally good at. A Climber goes up, a Swimmer
        // crosses, and a Night-Sighted tribute is not pinned down after dark.
        if (z.terrain === 'highland') score += traitMod(t, 'highland');
        // AUDIT-12 T15 / §16: a Cannon-Counter keeps off the ground a cannon
        // just came from; Signalling pulls a scattered group back together.
        score += cannonAvoidance(state, t, z.name) + signallingPull(state, t, z.name);
        // AUDIT-13 N4 / N26 / N35: Drowned Once, the Pilgrim's landmark, Regrouping.
        score += audit13DestinationScore(state, t, z);
        // AUDIT-14 S1-S3 / A34 / T12: a rally, a blood trail, a withdrawal, a ward.
        score += audit14DestinationScore(ctx, t, z);
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

        // AUDIT-11: somebody they would kneel over is lying in the rescue
        // window next door. Nothing in the scorer knew, so the only rescues
        // that happened were the ones where a friend was already standing
        // there — `treat-downed` got through 13% of the time, and most of the
        // rest were helpers a sector away who had no reason to walk over.
        if (state.tributes.some(o => o.id !== t.id && o.zone === z.name && isDowned(o) && wouldHelp(t, o))) {
            score += MOVEMENT.downedAllyPull;
        }

        // A1: Shadowing follows one zone behind a specific person rather than
        // scoring the map at all.
        if (t.stance === 'Shadowing' && t.shadowing) {
            // AUDIT-9 B11: a shadow follows the trail they have, not a live
            // feed. Losing the quarry is a real outcome of shadowing now.
            const quarry = state.tributes.find(o => o.id === t.shadowing!.targetId);
            if (quarry?.status === 'alive' && believedIn(state, t, quarry.id, z.name)) score += MOVEMENT.shadowFollowWeight;
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
            // AUDIT-14 T15: a forcing finalist goes where they believe the
            // others are, and only to the horn when they have no idea; a
            // careful one wants height *and* cover.
            const finalistNear = wantsTheHorn ? believedFinalistWithinHop(ctx, t, z.name) : false;
            const knowsWhere = wantsTheHorn && believesAnyFinalist(state, t);
            if (wantsTheHorn && finalistNear) score += E14.endgameFinalistPull;
            if ((wantsTheHorn && isHorn && !knowsWhere && zoneStateOf(state, z.name) !== 'ruined')
                || (!wantsTheHorn && isHigh)) {
                score += ENDGAME_POSITIONING.pullWeight;
            }
            if (!wantsTheHorn && (z.terrain === 'forest' || z.terrain === 'ruins' || (zoneFeatures(z).shelterQuality ?? 0) > 0)) {
                score += E14.endgameCoverPull;
            }
        }

        const out = { z, score };
        return out;
    });

    // §3.3 (audit): shift the field so the worst option sits at the floor, then
    // sharpen. A flat clamp gave every bad zone the same weight as every other
    // bad zone, and there are many more bad zones than good ones.
    const lowest = scored.reduce((lo, o) => Math.min(lo, o.score), Infinity);
    /*
     * §(requests): how decisively they are able to choose.
     *
     * The ranking above is the tribute's honest read of the map; this is
     * whether they are in any condition to act on it. Exhausted, dehydrated,
     * concussed, bleeding, coming apart, in the dark — the sharpness falls and
     * the draw flattens toward "one of the ones that looked all right", which
     * is what a bad decision made by a person rather than by a dice roll looks
     * like. A rested, unhurt tribute in daylight sits at zero confusion and
     * gets exactly the behaviour this scorer has always had.
     */
    const confusion = confusionOf(ctx, t);
    const sharpness = Math.max(
        MOVEMENT.destinationSharpness - confusion * CONFUSION.destinationFlattening,
        MOVEMENT.destinationSharpness - CONFUSION.destinationFlattening,
    );
    const weighted = scored.map(o => ({
        o,
        w: Math.pow(o.score - lowest + MOVEMENT.destinationFloor, sharpness),
    }));

    // A §1: the top few destinations, for the tribute sheet's trace.
    if (t.decisionTrace) {
        t.decisionTrace.confusion = Math.round(confusion * 100) / 100;
        t.decisionTrace.destinations = [...scored]
            .sort((a, b) => b.score - a.score)
            .slice(0, DECISION_TRACE.topN)
            .map(o => ({ zone: o.z.name, score: Math.round(o.score * 100) / 100 }));
    }

    let roll = ctx.rng.nextFloat() * weighted.reduce((s, e) => s + e.w, 0);
    let pick = scored[scored.length - 1];
    for (const e of weighted) {
        roll -= e.w;
        if (roll <= 0) { pick = e.o; break; }
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

/** AUDIT-14 T6: hop distances from `from` over open, unsevered ground. */
function hopMap(ctx: SimContext, from: string): Map<string, number> {
    const state = ctx.state;
    const collapsed = state.collapsedZones ?? [];
    const severed = severedEdgeSet(state);
    const dist = new Map<string, number>([[from, 0]]);
    let frontier = [from];
    for (let d = 1; d <= E14.fieldMaxHops && frontier.length > 0; d++) {
        const next: string[] = [];
        frontier.forEach(name => {
            (getZone(state.arena, name)?.adjacent ?? []).forEach(n => {
                if (dist.has(n) || collapsed.includes(n) || severed.has(edgeKey(name, n))) return;
                dist.set(n, d);
                next.push(n);
            });
        });
        frontier = next;
    }
    return dist;
}

/**
 * AUDIT-14 T6: max over targets of value / (1 + hops) from this option —
 * water when thirsty, the nearest ally, the sworn target's believed place.
 */
function potentialField(ctx: SimContext, t: Tribute, zone: string): number {
    const state = ctx.state;
    const dist = hopMap(ctx, zone);
    let field = 0;
    const at = (z: string | undefined, value: number) => {
        if (!z) return;
        const h = dist.get(z);
        if (h === undefined) return;
        field = Math.max(field, value / (1 + h));
    };
    if (t.vitals.thirst >= E14.fieldThirstFrom) {
        const urgency = t.vitals.thirst / 100;
        state.arena.zones.forEach(z => { if (zoneFeatures(z).waterSource === true) at(z.name, E14.fieldWater * urgency); });
    }
    if (t.allianceId) {
        state.tributes.forEach(o => {
            if (o.id !== t.id && o.status === 'alive' && o.zone !== t.zone && allied(o, t)) at(o.zone, E14.fieldAlly);
        });
    }
    ensureMemory(t).vengeance.forEach(id => {
        at(rememberedPlaceOf(state, t, id), E14.fieldVengeance);
        at(projectedPlaceOf(ctx, t, id), E14.fieldVengeance * E14.projectionConfidence);
    });
    return field;
}

/** AUDIT-14 T15: the finalists this tribute has a live sighting of. */
function believesAnyFinalist(state: SimContext['state'], t: Tribute): boolean {
    return state.tributes.some(o => o.status === 'alive' && o.id !== t.id && !allied(o, t)
        && rememberedPlaceOf(state, t, o.id) !== undefined);
}

function believedFinalistWithinHop(ctx: SimContext, t: Tribute, zone: string): boolean {
    const state = ctx.state;
    const near = new Set([zone, ...(getZone(state.arena, zone)?.adjacent ?? [])]);
    return state.tributes.some(o => {
        if (o.status !== 'alive' || o.id === t.id || allied(o, t)) return false;
        const place = rememberedPlaceOf(state, t, o.id);
        return place !== undefined && near.has(place);
    });
}

/**
 * AUDIT-14 T10: where the quarry would have gone from the last sighting.
 *
 * Not a live feed — a model of a person: from where they were seen, toward
 * water if they were standing on dry ground, else away from the horn. One hop
 * for anybody, two for a tracker. Undefined with no live sighting to start from.
 */
export function projectedPlaceOf(ctx: SimContext, t: Tribute, otherId: string): string | undefined {
    const state = ctx.state;
    let at: string | undefined = rememberedPlaceOf(state, t, otherId);
    if (!at || cyclesSinceContact(state, t, otherId) < 1) return undefined;
    const collapsed = state.collapsedZones ?? [];
    const severed = severedEdgeSet(state);
    const horn = state.arena.zones[0]?.name;
    const hops = profOf(t, 'tracking') >= E14.projectionTwoHopTracking ? 2 : 1;
    for (let h = 0; h < hops; h++) {
        const from: string = at;
        const here = getZone(state.arena, from);
        const next: string[] = (here?.adjacent ?? []).filter(n => !collapsed.includes(n) && !severed.has(edgeKey(from, n)));
        if (!here || next.length === 0) break;
        const wet = zoneFeatures(here).waterSource === true;
        const water: string | undefined = wet ? undefined : next.find(n => { const z = getZone(state.arena, n); return !!z && zoneFeatures(z).waterSource === true; });
        at = water ?? next.find(n => n !== horn && !(getZone(state.arena, n)?.adjacent ?? []).includes(horn ?? '')) ?? next.find(n => n !== horn) ?? next[0];
    }
    return at;
}
