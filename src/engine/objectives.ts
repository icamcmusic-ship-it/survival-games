import { Objective, Tribute, Zone } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { MOVEMENT, OBJECTIVES } from '../data/balance';
import { SimContext } from './context';
import { cycleOf, ensureMemory, rememberedRivals, rememberedThreat } from './memory';
import { getZone, nextHopToward } from './map';
import { fearOf } from './fear';
import { getRel } from './relationships';

/**
 * Intentions.
 *
 * Every decision in the simulation used to be a fresh per-cycle scored roll.
 * Nothing persisted across cycles, so no tribute ever *decided* anything — they
 * re-rolled a destination lottery every turn. That produced a chronicle of
 * "Marvel moved to Sector 2" when the interesting sentence was always "Marvel is
 * hunting Rue", and it made behaviour unreadable: you could not tell why anyone
 * went anywhere because there was no why, only a weighting.
 *
 * An objective is chosen from need, archetype and memory, and then *held* —
 * re-evaluated only when it expires or something invalidates it. That single
 * property is what turns a weighted wander into a plan.
 */

/** Human-readable line for the chronicle when a tribute forms a new intention. */
function announce(ctx: SimContext, t: Tribute, objective: Objective) {
    const name = (id: string) => ctx.state.tributes.find(o => o.id === id)?.name ?? 'someone';
    switch (objective.kind) {
        case 'hunt':
            ctx.logEvent(
                `${t.name} stops pretending to forage and starts hunting ${name(objective.targetId)}.`,
                [t.id, objective.targetId],
                { important: true, category: 'travel' }
            );
            return;
        case 'reach': {
            const why = {
                water: 'looking for water',
                shelter: 'looking for somewhere to sleep',
                feast: 'heading for the feast',
                ally: 'trying to rejoin their allies',
                forage: 'looking for anything to eat',
            }[objective.reason];
            ctx.logEvent(
                `${t.name} sets off for ${objective.zone}, ${why}.`,
                [t.id],
                { category: 'travel' }
            );
            return;
        }
        case 'hold':
            ctx.logEvent(
                `${t.name} decides ${objective.zone} is worth holding and digs in.`,
                [t.id],
                { category: 'survival' }
            );
            return;
        case 'flee':
            ctx.logEvent(
                `${t.name} wants to be anywhere but ${objective.from}.`,
                [t.id],
                { category: 'travel' }
            );
            return;
        case 'protect':
            ctx.logEvent(
                `${t.name} decides ${name(objective.wardId)} is not dying on their watch.`,
                [t.id, objective.wardId],
                { important: true, category: 'alliance' }
            );
            return;
        default:
            return;
    }
}

/** Whether the intention still makes sense, or the world has moved on without it. */
export function isObjectiveValid(ctx: SimContext, t: Tribute): boolean {
    const objective = t.objective;
    if (!objective || objective.kind === 'survive') return false;

    const cycle = cycleOf(ctx.state);
    if ('expires' in objective && cycle >= objective.expires) return false;

    const collapsed = ctx.state.collapsedZones ?? [];
    const living = (id: string) => ctx.state.tributes.find(o => o.id === id && o.status === 'alive');

    switch (objective.kind) {
        case 'hunt':
            // No point hunting a corpse, or someone you have become too
            // frightened of to follow through on.
            return !!living(objective.targetId)
                && fearOf(t, objective.targetId) < OBJECTIVES.huntAbandonFear;
        case 'protect':
            return !!living(objective.wardId);
        case 'reach':
            // Arrived, or the ground went out of bounds under the destination.
            return t.zone !== objective.zone && !collapsed.includes(objective.zone);
        case 'hold':
            return t.zone === objective.zone && !collapsed.includes(objective.zone);
        case 'flee':
            return t.zone === objective.from;
        default:
            return false;
    }
}

/** Picks the most pressing thing this tribute could be trying to do right now. */
function chooseObjective(ctx: SimContext, t: Tribute, here: Tribute[]): Objective {
    const state = ctx.state;
    const cycle = cycleOf(state);
    const arch = ARCHETYPES[t.archetype];
    const collapsed = state.collapsedZones ?? [];
    const active = state.arena.zones.filter(z => !collapsed.includes(z.name));
    const expiry = (cycles: number) => cycle + cycles;

    // 1. Get out. Standing somewhere they are badly outmatched beats every
    //    other consideration a tribute has.
    const hostilesHere = here.filter(o =>
        o.id !== t.id && (o.allianceId === undefined || o.allianceId !== t.allianceId));
    const scaredOf = hostilesHere.some(o => fearOf(t, o.id) >= OBJECTIVES.fleeFear);
    if (scaredOf && t.stance !== 'Aggressive') {
        return { kind: 'flee', from: t.zone, expires: expiry(OBJECTIVES.fleeCycles) };
    }

    // 2. Thirst. The most reliable killer that a tribute can actually do
    //    something about, and the clearest possible intention.
    if (t.vitals.thirst > MOVEMENT.thirstUrgency && !t.inventory.some(i => i.type === 'water')) {
        const water = nearestZoneMatching(ctx, t, active, z => z.terrain === 'water' || z.terrain === 'wetland');
        if (water && water !== t.zone) {
            return { kind: 'reach', zone: water, reason: 'water', expires: expiry(OBJECTIVES.reachCycles) };
        }
    }

    // 3. The feast, once it is called: a scheduled reason for the whole cast to
    //    converge that the movement layer previously knew nothing about.
    if (state.feastDay !== undefined && state.day >= state.feastDay - 1) {
        const cornucopia = active.find(z => /cornucopia/i.test(z.name));
        if (cornucopia && cornucopia.name !== t.zone && arch.aggression > -0.2) {
            return { kind: 'reach', zone: cornucopia.name, reason: 'feast', expires: expiry(OBJECTIVES.reachCycles) };
        }
    }

    // 4. Somebody to kill. Either sworn, or simply the nearest rival a hunter
    //    has a live sighting of.
    const mem = ensureMemory(t);
    const sworn = mem.vengeance
        .map(id => state.tributes.find(o => o.id === id && o.status === 'alive'))
        .find(o => !!o);
    if (sworn) {
        return { kind: 'hunt', targetId: sworn.id, expires: expiry(OBJECTIVES.huntCycles) };
    }
    if (t.stance === 'Aggressive') {
        // Only somebody they have actually seen recently — a hunter with no
        // sighting is not tracking anyone, they are just walking around angry.
        const target = state.tributes.find(o =>
            o.status === 'alive' && o.id !== t.id
            && (o.allianceId === undefined || o.allianceId !== t.allianceId)
            && rememberedRivals(state, t, o.zone) > 0
            && fearOf(t, o.id) < OBJECTIVES.huntAbandonFear);
        if (target) {
            return { kind: 'hunt', targetId: target.id, expires: expiry(OBJECTIVES.huntCycles) };
        }
    }

    // 5. Somebody to keep alive. Protectors are defined by this and had no way
    //    to express it.
    if (arch.allianceAffinity > 0.15 || t.archetype === 'protector') {
        const ward = state.tributes.find(o =>
            o.status === 'alive' && o.id !== t.id
            && o.allianceId !== undefined && o.allianceId === t.allianceId
            && (o.health < OBJECTIVES.wardHealth || getRel(t, o.id) > OBJECTIVES.wardBond));
        if (ward) {
            return { kind: 'protect', wardId: ward.id, expires: expiry(OBJECTIVES.protectCycles) };
        }
    }

    // 6. Somewhere to sleep it off.
    if (t.vitals.fatigue > MOVEMENT.shelterUrgency || t.health < OBJECTIVES.holeUpHealth) {
        const shelter = nearestZoneMatching(ctx, t, active, z => z.terrain === 'forest' || z.terrain === 'ruins');
        if (shelter && shelter !== t.zone) {
            return { kind: 'reach', zone: shelter, reason: 'shelter', expires: expiry(OBJECTIVES.reachCycles) };
        }
        if (shelter === t.zone) {
            return { kind: 'hold', zone: t.zone, expires: expiry(OBJECTIVES.holdCycles) };
        }
    }

    // 7. Ground worth standing on: good forage, no bad memories, nobody else in it.
    const current = getZone(state.arena, t.zone);
    if (current && rememberedThreat(state, t, t.zone) < OBJECTIVES.holdMaxThreat
        && hostilesHere.length === 0 && current.resources > OBJECTIVES.holdMinResources) {
        return { kind: 'hold', zone: t.zone, expires: expiry(OBJECTIVES.holdCycles) };
    }

    return { kind: 'survive' };
}

/** Closest zone satisfying a predicate, by hops over the adjacency graph. */
function nearestZoneMatching(
    ctx: SimContext,
    t: Tribute,
    active: Zone[],
    predicate: (z: Zone) => boolean,
): string | undefined {
    const matches = active.filter(predicate);
    if (matches.length === 0) return undefined;
    if (matches.some(z => z.name === t.zone)) return t.zone;

    const collapsed = ctx.state.collapsedZones ?? [];
    // Prefer whichever match is actually routable and least dreaded, so a
    // tribute does not set off for a lake through a zone they watched two
    // people die in.
    const routable = matches
        .map(z => ({ z, hop: nextHopToward(ctx.state.arena, t.zone, z.name, collapsed) }))
        .filter(m => m.hop !== undefined)
        .sort((a, b) =>
            rememberedThreat(ctx.state, t, a.z.name) - rememberedThreat(ctx.state, t, b.z.name));
    return routable[0]?.z.name;
}

/**
 * Re-evaluates the tribute's intention, but only when the current one has run
 * out or stopped making sense. Holding is the entire point — an objective
 * recomputed every cycle is just a mood with extra steps.
 */
export function updateObjective(ctx: SimContext, t: Tribute, here: Tribute[]) {
    if (isObjectiveValid(ctx, t)) return;

    const previous = t.objective;
    const next = chooseObjective(ctx, t, here);
    t.objective = next;

    // Only narrate genuinely new intentions, and never the null one — a line
    // every time someone lapses back to "survive" would drown the feed.
    if (next.kind !== 'survive' && !sameObjective(previous, next)) {
        announce(ctx, t, next);
    }
}

function sameObjective(a: Objective | undefined, b: Objective): boolean {
    if (!a || a.kind !== b.kind) return false;
    if (a.kind === 'hunt' && b.kind === 'hunt') return a.targetId === b.targetId;
    if (a.kind === 'protect' && b.kind === 'protect') return a.wardId === b.wardId;
    if (a.kind === 'reach' && b.kind === 'reach') return a.zone === b.zone;
    if (a.kind === 'hold' && b.kind === 'hold') return a.zone === b.zone;
    if (a.kind === 'flee' && b.kind === 'flee') return a.from === b.from;
    return true;
}

/**
 * The zone this tribute's objective wants them in, if any. Hunt and protect
 * resolve through the target's *believed* position rather than their true one —
 * a hunter chases the last place they saw someone, not a live tracking beacon.
 */
export function objectiveZone(ctx: SimContext, t: Tribute): string | undefined {
    const objective = t.objective;
    if (!objective) return undefined;
    const state = ctx.state;

    switch (objective.kind) {
        case 'reach':
            return objective.zone;
        case 'hold':
            return objective.zone;
        case 'hunt': {
            const target = state.tributes.find(o => o.id === objective.targetId && o.status === 'alive');
            if (!target) return undefined;
            // Only if they have a live sighting of that zone. Otherwise the
            // hunter genuinely does not know where their quarry went.
            return rememberedRivals(state, t, target.zone) > 0 ? target.zone : undefined;
        }
        case 'protect': {
            const ward = state.tributes.find(o => o.id === objective.wardId && o.status === 'alive');
            return ward?.zone;
        }
        default:
            return undefined;
    }
}

/**
 * The next step toward the objective, or undefined to let the normal wander
 * scoring decide. A 'flee' objective has no destination, only a direction:
 * away.
 */
export function objectiveStep(ctx: SimContext, t: Tribute, options: Zone[]): Zone | undefined {
    const objective = t.objective;
    if (!objective || objective.kind === 'survive') return undefined;
    const collapsed = ctx.state.collapsedZones ?? [];

    if (objective.kind === 'hold') {
        // Holding is expressed by not moving, which the caller handles.
        return undefined;
    }

    if (objective.kind === 'flee') {
        // Anywhere but here, preferring ground they have no bad memory of.
        const away = [...options]
            .filter(z => z.name !== objective.from)
            .sort((a, b) =>
                rememberedThreat(ctx.state, t, a.name) - rememberedThreat(ctx.state, t, b.name));
        return away[0];
    }

    const target = objectiveZone(ctx, t);
    if (!target || target === t.zone) return undefined;
    const hop = nextHopToward(ctx.state.arena, t.zone, target, collapsed);
    if (!hop) return undefined;
    return options.find(z => z.name === hop);
}

/** True when the objective says to stay put this cycle. */
export function objectiveHolds(t: Tribute): boolean {
    return t.objective?.kind === 'hold';
}

/** Short label for the UI, so a reader can see what a tribute is trying to do. */
export function objectiveLabel(state: { tributes: Tribute[] }, t: Tribute): string {
    const objective = t.objective;
    if (!objective || objective.kind === 'survive') return 'Surviving';
    const name = (id: string) => state.tributes.find(o => o.id === id)?.name ?? 'someone';
    switch (objective.kind) {
        case 'hunt': return `Hunting ${name(objective.targetId)}`;
        case 'protect': return `Protecting ${name(objective.wardId)}`;
        case 'hold': return `Holding ${objective.zone}`;
        case 'flee': return `Fleeing ${objective.from}`;
        case 'reach': {
            const why = {
                water: 'for water', shelter: 'for shelter', feast: 'for the feast',
                ally: 'to reach an ally', forage: 'to forage',
            }[objective.reason];
            return `Making for ${objective.zone} ${why}`;
        }
        default: return 'Surviving';
    }
}
