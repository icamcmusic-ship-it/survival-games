import { Objective, Tribute } from '../models/types';
import { OBJECTIVES, PLANNING, PROFICIENCY } from '../data/balance';
import { SimContext, getAlive } from './context';
import { cycleOf, ensureMemory, rememberedBarren } from './memory';
import { getZone, reachableZones } from './map';
import { profOf, trainProficiency } from './proficiency';
import { fearOf } from './fear';

/**
 * §3.2: the decision layer's three missing pieces.
 *
 *   planning     objectives expired and nothing chained them. A tribute could
 *                not decide "get water, *then* set up at the chokepoint" — every
 *                goal was chosen from scratch against the state of that instant,
 *                so a plan two steps long was not representable at all.
 *   commitment   `objectiveTension` was voiced once and thrown away. A tribute
 *                torn between water and their dying ally for three cycles
 *                running should eventually snap one way, loudly, rather than
 *                hesitating identically forever.
 *   exhaustion   `ZoneMemory.barren` was a modifier on a forage roll. A tribute
 *                who has failed to find anything in the same zone four times
 *                kept trying at a slightly worse number, when the interesting
 *                thing a person does at that point is *decide* — leave, or stop
 *                foraging and start trapping.
 */

/**
 * §3.2: put a prerequisite in front of a goal the tribute cannot currently
 * serve, and remember the goal.
 *
 * Depth two on purpose. Anything deeper is a planner rather than a person, and
 * an arena is not a place where three-step plans survive contact.
 */
export function queueGoal(t: Tribute, goal: Objective) {
    // The goal goes to the front; whatever was already queued shuffles back
    // and falls off the end at `queueDepth`. This used to be `[goal].slice(…)`
    // — a one-element literal — so the depth knob did nothing and the queue
    // could never hold the second goal the module header promises.
    const same = (a: Objective, b: Objective) => a.kind === b.kind && JSON.stringify(a) === JSON.stringify(b);
    const rest = (t.objectiveQueue ?? []).filter(g => !same(g, goal));
    t.objectiveQueue = [goal, ...rest].slice(0, PLANNING.queueDepth);
}

/**
 * The prerequisite a goal needs before it is worth walking toward, or
 * undefined if the tribute can simply go and do it.
 *
 * Only the two that actually stop people: you do not set up on a chokepoint
 * with an empty canteen, and you do not go hunting on an empty stomach.
 */
export function prerequisiteFor(ctx: SimContext, t: Tribute, goal: Objective): Objective | undefined {
    const needsWater = t.vitals.thirst >= PLANNING.prerequisiteThirst;
    const needsFood = t.vitals.hunger >= PLANNING.prerequisiteHunger;
    if (!needsWater && !needsFood) return undefined;
    // A goal that *is* the errand needs no errand in front of it.
    if (goal.kind === 'reach' && (goal.reason === 'water' || goal.reason === 'forage')) return undefined;
    if (goal.kind === 'flee' || goal.kind === 'protect') return undefined;

    const reason = needsWater ? 'water' : 'forage';
    const zone = bestZoneFor(ctx, t, reason);
    if (!zone) return undefined;
    return { kind: 'reach', zone, reason, expires: cycleOf(ctx.state) + OBJECTIVES.reachCycles };
}

function bestZoneFor(ctx: SimContext, t: Tribute, reason: 'water' | 'forage'): string | undefined {
    const options = reachableZones(ctx.state.arena, t.zone, ctx.state.collapsedZones ?? []);
    const scored = options
        .map(z => ({
            name: z.name,
            score: reason === 'water'
                ? (z.terrain === 'water' || z.terrain === 'wetland' ? 2 : 0) + z.resources
                : z.resources - rememberedBarren(ctx.state, t, z.name),
        }))
        .sort((a, b) => b.score - a.score);
    return scored[0]?.name;
}

/**
 * §3.2: sustained tension resolves.
 *
 * `voiced` gated the hesitation beat to once per choice, which is right — but
 * it also meant that being torn had no accumulating consequence. A tribute
 * pulled the same two ways for several cycles running is a tribute about to do
 * something abrupt, and the runner-up should be able to win outright.
 */
export function pressTension(ctx: SimContext, t: Tribute): Objective | undefined {
    const tension = t.objectiveTension;
    if (!tension) { t.tensionStreak = 0; return undefined; }
    t.tensionStreak = (t.tensionStreak ?? 0) + 1;
    if (t.tensionStreak < PLANNING.snapCycles) return undefined;

    t.tensionStreak = 0;
    const snapped = tension.runnerUp;
    t.objectiveTension = undefined;
    ctx.logEvent(
        `${t.name} has been standing in two places at once for days, and stops. Whatever the argument was, `
        + 'they have finished having it with themselves, and they move like somebody who is not going to reconsider.',
        [t.id],
        { important: true, category: 'sanity' }
    );
    return snapped;
}

/**
 * §3.2: a zone this tribute has given up on, and what they do about it.
 *
 * Returns the decision, so the caller can act on it: leave for somewhere they
 * have not already stripped, or stop foraging in a place that has nothing and
 * start putting snares in it instead — which is the correct answer, and one
 * `barren` could never produce as a modifier.
 */
export function exhaustedHere(ctx: SimContext, t: Tribute): 'leave' | 'trap' | undefined {
    const mem = ensureMemory(t);
    const failures = mem.forageFailures?.[t.zone] ?? 0;
    if (failures < PLANNING.exhaustionFailures) return undefined;

    // Somebody who can set a snare has a second answer available; somebody who
    // cannot simply has to walk.
    if (profOf(t, 'tracking') >= PLANNING.exhaustionTrapSkill && !ctx.state.traps?.some(tr => tr.zone === t.zone && tr.ownerId === t.id)) {
        return 'trap';
    }
    return 'leave';
}

/** Records that this tribute searched this zone and came up with nothing. */
export function noteForageFailure(t: Tribute, zone: string) {
    const mem = ensureMemory(t);
    mem.forageFailures = mem.forageFailures ?? {};
    mem.forageFailures[zone] = (mem.forageFailures[zone] ?? 0) + 1;
}

/** ...and that it paid, which resets the tribute's patience with the place. */
export function noteForageSuccess(t: Tribute, zone: string) {
    t.forageSuccesses = (t.forageSuccesses ?? 0) + 1;
    if (t.memory?.forageFailures) delete t.memory.forageFailures[zone];
}

/**
 * §3.2: generalised fear.
 *
 * `memory.fear` is per-target and good — 68,000 entries across a 400-run soak —
 * but there was no aggregate. A tribute could be frightened of every single
 * person left alive and have no state that said so, which is a real and
 * distinct condition from low resolve: resolve is "I cannot keep doing this",
 * dread is "there is nowhere in here that is not one of them".
 */
export function dreadOf(ctx: SimContext, t: Tribute): number {
    const others = getAlive(ctx.state).filter(o => o.id !== t.id);
    if (others.length === 0) return 0;
    const feared = others.filter(o => fearOf(t, o.id) >= PLANNING.dreadPerTargetFloor).length;
    return Math.min(1, feared / Math.max(1, others.length * PLANNING.dreadSaturation));
}

/** Whether dread has taken this tribute over — the baseline has changed. */
export function isCowed(ctx: SimContext, t: Tribute): boolean {
    return dreadOf(ctx, t) >= PLANNING.dreadCowedAt;
}

/**
 * §3.2: deception in movement.
 *
 * Tributes moved toward what they wanted and nothing else. Nobody feinted,
 * doubled back, or laid a false trail — despite `zoneTraffic` existing and
 * being exactly the signal a false trail would poison. A tribute who knows they
 * are being followed, and is good enough at this, can now spend a cycle making
 * the arena's own record of where people have been say the wrong thing.
 */
export function layFalseTrail(ctx: SimContext, t: Tribute) {
    /*
     * AUDIT-7 §12.4: `signalling` is the skill this gate was borrowing.
     *
     * It read raw `intelligence` plus `tracking`, which is the skill for
     * *reading* marks rather than leaving them — so the tribute who could tell
     * a day-old print from an hour-old one was, by definition, also the best
     * liar about their own. They are related and they are not the same, and the
     * false trail is the one place in the engine where the difference matters.
     * Tracking still counts, because you cannot fake a trail you cannot read.
     */
    if (t.attributes.intelligence < PLANNING.falseTrailIntelligence) return;
    const craft = profOf(t, 'signalling') + profOf(t, 'tracking') * PLANNING.falseTrailTrackingShare;
    if (craft < PLANNING.falseTrailSkill) return;
    /*
     * AUDIT-8 §1.11: the skill could only be learned by succeeding at the
     * thing it gates.
     *
     * This was the only `trainProficiency(t, 'signalling')` call in the
     * repository and it sat *below* the success roll, behind an entry floor of
     * `falseTrailSkill` that — with `signalling` starting at 0 and carrying no
     * `TRAIT_PROFICIENCY_FLOOR` head start — reduced to `tracking >= 3.0`.
     * Measured `tracking` peaks at a population mean of 1.24, so the entry
     * condition for a tribute's *first* point of signalling was 2.4x the mean
     * of a different skill. Result: **99.6% of tributes never trained it and
     * the population mean was 0.01**, which makes every gate reading it
     * permanently closed and an authored axis of the proficiency system
     * effectively absent from the game.
     *
     * Two changes, both the pattern AUDIT-6 used successfully on `navigation`
     * in the same batch this axis was added in: the floor comes down to the
     * population mean of the prerequisite, and the *attempt* teaches, at a
     * partial share, rather than only the success. Laying a false trail badly
     * is still how anybody learns to lay one well.
     */
    trainProficiency(t, 'signalling', undefined, PROFICIENCY.signallingAttemptShare);
    if (!ctx.rng.chance(PLANNING.falseTrailChance + profOf(t, 'signalling') * PLANNING.falseTrailPerSignalling)) return;
    trainProficiency(t, 'signalling');

    const options = reachableZones(ctx.state.arena, t.zone, ctx.state.collapsedZones ?? [])
        .filter(z => z.name !== t.zone);
    if (options.length === 0) return;
    const decoy = ctx.rng.pick(options).name;

    // The lie goes into the two places the arena actually keeps a record of
    // where somebody has been: the traffic count, and everyone else's memory.
    ctx.state.zoneTraffic = ctx.state.zoneTraffic ?? {};
    ctx.state.zoneTraffic[decoy] = (ctx.state.zoneTraffic[decoy] ?? 0) + PLANNING.falseTrailTraffic;
    getAlive(ctx.state).forEach(o => {
        if (o.id === t.id) return;
        if (o.attributes.intelligence >= PLANNING.falseTrailSeeThrough) {
            /*
             * AUDIT-8 §1.11: the other half of the craft. Reading a trail and
             * seeing that somebody built it is the same competence as building
             * one, and the tribute who is not fooled has just had the single
             * best lesson in it available.
             */
            trainProficiency(o, 'signalling', undefined, PROFICIENCY.signallingReadShare);
            return;
        }
        const mem = ensureMemory(o);
        mem.zones[decoy] = mem.zones[decoy] ?? { seen: -99, threat: 0, rivals: 0, barren: 0 };
        mem.zones[decoy].rivals = Math.max(mem.zones[decoy].rivals, 1);
        mem.zones[decoy].seen = cycleOf(ctx.state);
    });

    ctx.logEvent(
        `${t.name} walks a long way into ${decoy}, breaks branches like somebody in a hurry, and comes back the way they came `
        + `along the stones where nothing prints. Anyone reading the ground tonight will read ${decoy}.`,
        [t.id],
        { category: 'survival' }
    );
}

/** The zone a tribute would actually double back to, if they are being followed. */
export function isBeingFollowed(ctx: SimContext, t: Tribute): boolean {
    return getAlive(ctx.state).some(o =>
        o.id !== t.id && (o.shadowing?.targetId === t.id
            || (o.objective?.kind === 'hunt' && o.objective.targetId === t.id)
            || (o.objective?.kind === 'stalk' && o.objective.targetId === t.id)));
}

/** Somewhere this tribute has not already given up on. */
export function freshGround(ctx: SimContext, t: Tribute): string | undefined {
    const options = reachableZones(ctx.state.arena, t.zone, ctx.state.collapsedZones ?? [])
        .filter(z => z.name !== t.zone && (t.memory?.forageFailures?.[z.name] ?? 0) === 0);
    if (options.length === 0) return undefined;
    return options.sort((a, b) => (getZone(ctx.state.arena, b.name)?.resources ?? 0)
        - (getZone(ctx.state.arena, a.name)?.resources ?? 0))[0]?.name;
}
