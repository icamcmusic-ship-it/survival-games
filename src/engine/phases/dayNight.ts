import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Tribute } from '../../models/types';
import { IMPROVISED_ITEMS, ITEMS } from '../../data/constants';
import { ANTHEM, CRAFTING, ENCOUNTERS, ESCALATION, EXHAUSTION, HUNTING, MEMORY, MODIFIERS, MOVEMENT, OBJECTIVES, PROFICIENCY, SPONSORS } from '../../data/balance';
import { AMBIENT_TEXTS, BORDER_TEXTS, DYNAMIC_AMBIENT_TEXTS, ENCOUNTER_TEXTS, SURVIVAL_TEXTS } from '../../data/flavorText';
import { arenaFlavor } from '../../data/arenaFlavor';
import { applyDamage, checkDeath, resolveGroupCombat } from '../combat';
import { processSponsors } from '../sponsors';
import { zoneNames, getZone, zoneFeatures, reachableZones, depletionOf, regenerateZones, nearestSafeZone, noteTraffic, decayTraffic, severedEdgeSet, edgeKey, travelCost } from '../map';
import { enforceCapacity, giveItem } from '../items';
import {
    addZoneThreat, advanceCycle, cycleOf, decayMemories, decayRelationships, decaySuspicion, noteArmament, noteSighting,
} from '../memory';
import { decayAllianceTrust, driftReputation, getRel } from '../relationships';
import { clampTribute } from '../vitals';
import { isNoticed } from '../stealth';
import { pickDestination } from '../movement';
import { objectiveHolds, objectiveLabel, objectiveStep, updateObjective } from '../objectives';
import { checkTraps, hasCamp, tickTraps } from '../fieldcraft';
import { areLovers, leaderFor } from '../alliance';
import { decayFear } from '../fear';
import { updateStance } from '../stance';
import { traitMod } from '../../data/traits';
import { profOf, trainProficiency } from '../proficiency';
import { processSpoilage, processVitals } from '../survival';
import {
    applyArenaEvent, fill, handleInsanity, idleAction, isBreakingDown,
    pickTerrainEvent, resolveMuttAttack, resolvePairEncounter,
} from '../encounters';
import { tickPersistentMutts } from '../mutts';
import { restockCornucopia, rollAmbientZoneEffects, tickZoneEffects } from '../zoneEffects';
import { runArenaSignature } from '../arenaSignature';
import { runGamemakerSignature } from '../gamemakerAgency';
import { tickWeatherFront } from '../weatherFront';
import { tickZoneControl } from '../zoneControl';
import { resolveBreakdowns, tickResolve } from '../resolve';
import { resolveTruces } from '../parley';
import { spreadNotoriety } from '../notoriety';
import { commentate } from '../broadcast';
import { decayPackTruces, resolvePackEncounters } from '../packParley';
import { repayDebts, tickDistrictBonds } from '../debts';
import { enforceCharters } from '../allianceCharter';
import { gamemakerProfile } from '../../data/gamemakers';
import { readCustomContent } from '../../utils/customContent';
import { landmarkOf } from '../landmarks';
import { escalationShift, hasModifier, modifierEscalationShift, wildcardIs } from '../gamesProfile';
import { mintItem } from '../items';
import { QUALITY_BIAS } from '../../data/balance';

/**
 * The day/night cycle: the orchestrator, not the implementation.
 *
 * Terrain, vitals, exposure, movement scoring, stance, encounters and sanity
 * each live in their own module now (`survival`, `climate`/`exposure`,
 * `movement`, `stance`, `encounters`). What is left here is the order things
 * happen in, which is the part that actually belongs to the phase.
 */
export function processDayNight(ctx: SimContext, time: 'day' | 'night') {
    ctx.rng = new RNG(`${ctx.state.seed}-${ctx.state.day}-${time}`);
    // An extended-darkness wildcard holds the arena in night for several
    // cycles: the lights do not come up, whatever the schedule says.
    const blackout = ctx.state.blackoutUntilCycle !== undefined
        && (ctx.state.cycle ?? 0) < ctx.state.blackoutUntilCycle;
    if (blackout && time === 'day') {
        ctx.logEvent(
            'The arena lights do not come up. Whatever today was going to be, it happens in the dark.',
            [],
            { important: true, category: 'gamemaker' }
        );
    }
    // REPLAY-07: the arena's clock, so concealment, awareness and ambush can
    // read it without threading `time` through every call site that touches them.
    // `time` stays the scheduled phase (the anthem is still read at nightfall,
    // the border still closes on its own clock); `effectiveTime` is how dark it
    // actually is, which is what fires, nocturnal mutts and stealth care about.
    const effectiveTime = blackout ? 'night' : time;
    // Movement in the night phase happens at dusk: there is still enough light
    // to travel by, which is exactly why it is the most dangerous hour to be
    // moving in. `resolveEncounters` below runs in full dark.
    ctx.state.timeOfDay = effectiveTime === 'night' ? 'dusk' : 'day';
    advanceCycle(ctx.state);
    const alive = getAlive(ctx.state);
    const aliveAtCycleStart = alive.length;
    // Counted once per day, so it freezes at whatever the tribute reached.
    if (time === 'day') alive.forEach(t => { t.daysSurvived = ctx.state.day; });

    const flavor = arenaFlavor(ctx.state.arena.id, ctx.state.arena);

    // Occasional scene-setting line so the feed reads like a broadcast, not a spreadsheet.
    if (ctx.rng.chance(ENCOUNTERS.ambientLineChance)) {
        // CONTENT-03: a slice of these read the run's actual state — who's
        // still alive, who the Capitol is watching — instead of being pure
        // scenery, so the broadcast tracks the story it is telling.
        if (ctx.rng.chance(ENCOUNTERS.dynamicAmbientShare)) {
            ctx.logEvent(dynamicAmbientLine(ctx), [], { category: 'arena' });
        } else {
            const custom = readCustomContent().ambient;
            const pool = ctx.rng.chance(ENCOUNTERS.ambientArenaShare) ? flavor.ambient : [...AMBIENT_TEXTS, ...custom];
            ctx.logEvent(ctx.pickText(pool).split('{zone}').join(ctx.state.arena.zones[0].name), [], { category: 'arena' });
        }
    }

    // 0. The audience decides how much arena the tributes get to keep.
    updateAudienceInterest(ctx, time);
    forceFinale(ctx);
    const isEscalated = collapseBorders(ctx, time);
    const collapsed = ctx.state.collapsedZones || [];
    const severed = severedEdgeSet(ctx.state);

    // 1-2. Spoilage, then vitals, exposure, wounds and supplies.
    processSpoilage(ctx);
    processVitals(ctx, time);

    // 3. Crafting, situational awareness, stance and movement.
    const currentAlive = getAlive(ctx.state);
    const acted = new Set<string>();
    // Tributes brought ashore this cycle as part of somebody else's group
    // crossing. Kept separate from `acted` on purpose: they have finished
    // moving, but they still meet whatever is waiting in the new zone.
    const crossed = new Set<string>();
    currentAlive.forEach(t => {
        if (t.status !== 'alive') return;

        craft(ctx, t);

        // What they can see from where they stand, before they decide anything.
        const here = currentAlive.filter(o => o.status === 'alive' && o.zone === t.zone);
        const hostiles = here.filter(o => o.id !== t.id && o.allianceId !== t.allianceId).length;
        noteSighting(ctx.state, t, t.zone, hostiles, depletionOf(ctx.state, t.zone));

        updateStance(ctx, t, here);
        // Stance first, then intention: what they mean to do this cycle depends
        // on how threatened they have just decided they are.
        updateObjective(ctx, t, here);

        if (isBreakingDown(ctx, t)) {
            handleInsanity(ctx, t);
            acted.add(t.id);
            return;
        }

        // T-4: past a few nights without sleep the body takes what it was not
        // given. A microsleep costs the turn — they are standing in the open
        // with their eyes shut — and refunds some of the fatigue, which is
        // exactly the trade a tribute who kept moving did not want to make.
        if (rollMicrosleep(ctx, t)) {
            acted.add(t.id);
            return;
        }

        move(ctx, t, currentAlive, collapsed, flavor, severed, crossed);
    });

    // Walking into a zone is what springs things left in it. This runs as a
    // second pass because a non-leader alliance member is only relocated when
    // their leader's iteration comes around — checking traps inside the
    // movement loop tested whichever zone the array order happened to leave
    // them in at that moment.
    currentAlive.forEach(t => {
        if (t.status !== 'alive') return;
        checkTraps(ctx, t);
    });

    // R-2: two groups in one zone negotiate as groups before the encounter
    // layer resolves them as a pile of individuals.
    resolvePackEncounters(ctx);
    decayPackTruces(ctx.state);

    // Dusk is over: everything from here resolves in full dark.
    ctx.state.timeOfDay = effectiveTime;

    // A fire is warmth, hot food, and after dark it is the only thing in the
    // arena visible from a zone away. This is the trade the source material is
    // built on, and it only pays off at night.
    if (effectiveTime === 'night') revealFires(ctx);
    // A-3: and by day, whoever is standing on the high ground is watching.
    surveyFromHighGround(ctx);

    // 4. Hazards, mutts and everyone who runs into everyone else.
    resolveEncounters(ctx, currentAlive, acted, isEscalated, flavor, effectiveTime);
    // A mutt that has found someone keeps looking for them for a few more
    // cycles, independent of the ordinary per-cycle mutt roll.
    tickPersistentMutts(ctx);

    // 4a. Whether anyone has stopped wanting to win. Resolve drifts on what
    // this cycle actually did to them, then the ones who have run out act on it.
    tickResolve(ctx);
    resolveBreakdowns(ctx);

    // 4b. The arena's own rule — the clock, the tide, the blackout schedule.
    // Runs after movement and encounters so it acts on where tributes actually
    // ended up, and before upkeep so the effects it starts tick normally.
    runArenaSignature(ctx);
    // ...and the Head Gamemaker's, once per run, when the feed needs saving.
    runGamemakerSignature(ctx);

    // 5. Cycle upkeep: the arena restocks, memories fade, bonds cool, the
    // crowd's attention wanders.
    regenerateZones(ctx.state);
    // Fire spreads, floods drown stragglers, and whatever else is happening to
    // the ground itself lands after this cycle's movement has resolved.
    tickWeatherFront(ctx);
    tickZoneControl(ctx);
    rollAmbientZoneEffects(ctx);
    tickZoneEffects(ctx);
    restockCornucopia(ctx);
    tickTraps(ctx);
    decayTraffic(ctx.state);
    decayMemories(ctx.state);
    decayRelationships(ctx.state);
    decayAllianceTrust(ctx.state);
    decayFear(ctx.state);
    decaySuspicion(ctx.state);
    resolveTruces(ctx);
    // R-5: the field catching up with what the sky told it.
    spreadNotoriety(ctx);
    // Obligations come due, district partners grow into each other, and any
    // group that agreed terms is held to them.
    repayDebts(ctx);
    tickDistrictBonds(ctx);
    enforceCharters(ctx);
    getAlive(ctx.state).forEach(t => {
        // Bloodlust cools. A kill on day 3 should not still be making someone
        // braver on day 8.
        if (t.momentum) t.momentum = Math.max(0, t.momentum - HUNTING.momentumDecayPerCycle);
        if (t.rattled) t.rattled = Math.max(0, t.rattled - HUNTING.rattledDecayPerCycle);
        // Capacity can shrink under a tribute — losing the Backpack is the
        // usual way — and `giveItem` only checks when something is added.
        const spilled = enforceCapacity(t);
        if (spilled.length > 0) {
            ctx.logEvent(
                `${t.name} cannot manage it all without a pack and leaves ${spilled.map(i => i.name).join(', ')} behind in ${t.zone}.`,
                [t.id],
                { category: 'loot' }
            );
        }
        // Excitement is a decaying asset — a tribute cannot coast on a day-1
        // highlight reel while someone else is having a far more eventful day 6.
        t.excitementRating = Math.max(0, Math.round(
            t.excitementRating * (1 - SPONSORS.excitementDecayPerCycle) - SPONSORS.excitementFloorDecay
        ));
        driftReputation(t, SPONSORS.trustDriftPerCycle);
        clampTribute(t);
    });

    processSponsors(ctx);

    // The anthem closes the night. Every tribute learns exactly who died today,
    // wherever they were standing when it happened — which is the single most
    // recognisable rhythm the source material has, and the moment a tribute
    // finds out whether the person they were travelling with is still alive.
    if (time === 'night') soundTheAnthem(ctx);
    // §8.3: the desk, after the cycle's events have actually resolved — so a
    // "quiet day" line only ever follows a day that was quiet.
    commentate(ctx, time, getAlive(ctx.state).length - aliveAtCycleStart);
}

/**
 * The faces in the sky.
 *
 * `broadcastDeath` already told every living tribute that *a* death happened
 * and roughly where. The anthem is the other half: the Capitol names them,
 * publicly, once a day. Anyone who was hoping an ally was still out there
 * finds out here, and a tribute who has outlived everyone they knew has that
 * confirmed to them in the most Capitol way possible.
 */
function soundTheAnthem(ctx: SimContext) {
    // A silent-arena year: no anthem, no faces, and nobody finds out who is
    // left except by walking into them.
    if (wildcardIs(ctx.state, 'silent-arena') || hasModifier(ctx.state, 'no-anthem')) return;

    const fallenToday = ctx.state.tributes.filter(t =>
        t.status === 'dead' && t.dayOfDeath === ctx.state.day);
    const alive = getAlive(ctx.state);
    if (alive.length === 0) return;

    if (fallenToday.length === 0) {
        ctx.logEvent(
            `The anthem plays over ${ctx.state.arena.name} and the sky stays empty. Nobody died today, and the Capitol makes no attempt to hide its disappointment.`,
            [],
            { important: true, category: 'system' }
        );
        // A day with no cannon is a day the audience did not get what it came
        // for, and the Gamemakers are the ones who answer for that.
        alive.forEach(t => { t.excitementRating = Math.max(0, t.excitementRating - ANTHEM.quietDayExcitementCost); });
        return;
    }

    ctx.logEvent(
        `The anthem plays. ${fallenToday.map(t => `${t.name} of District ${t.district}`).join(', ')} — ${fallenToday.length} face${fallenToday.length === 1 ? '' : 's'} in the sky, and ${alive.length} still counting.`,
        fallenToday.map(t => t.id),
        { important: true, category: 'death' }
    );

    // Watching a name you were counting on appear in the sky.
    alive.forEach(t => {
        const lost = fallenToday.filter(f => getRel(t, f.id) >= ANTHEM.grievableBond);
        if (lost.length === 0) return;
        t.vitals.sanity = Math.max(0, t.vitals.sanity - ANTHEM.sanityPerNamedLoss * lost.length);
        if (ctx.rng.chance(ANTHEM.reactionChance)) {
            ctx.logEvent(
                `${t.name} watches ${lost.map(l => l.name).join(' and ')} go up over ${t.zone} and does not move until the sky is dark again.`,
                [t.id, ...lost.map(l => l.id)],
                { category: 'sanity' }
            );
        }
        clampTribute(t);
    });
}

/**
 * The order zones fail in, for one run.
 *
 * The old version was a plain shuffle: random per seed, but the same shape
 * every time — zones peeled off with no relationship to the map, which reads
 * as arbitrary rather than as a border actually closing in. Real collapse
 * has a shape: a wall sweeping in from one edge, or a ring tightening around
 * the centre. Both use the adjacency graph that already exists for pathing.
 */
// Deterministic per (seed, arena) — both fixed for the lifetime of a run —
// so the two BFS passes only need to run once per `SimContext` rather than
// every single cycle. Memoised on the context itself (see collapseOrder on
// SimContext) instead of a module-level cache: that scopes it to exactly one
// run, with nothing to invalidate and no size cap to tune.
function buildCollapseOrder(ctx: SimContext): string[] {
    if (ctx.collapseOrder) return ctx.collapseOrder;
    const order = computeCollapseOrder(ctx);
    ctx.collapseOrder = order;
    return order;
}

function computeCollapseOrder(ctx: SimContext): string[] {
    const allZoneNames = zoneNames(ctx.state.arena);
    const patternRng = new RNG(`${ctx.state.seed}-collapse-pattern`);
    const pattern = patternRng.pick(['scattered', 'wall', 'ring'] as const);

    if (pattern === 'scattered') {
        // Deterministic per-seed but not the same order every run.
        return new RNG(`${ctx.state.seed}-collapse`).shuffle(allZoneNames);
    }

    // Both remaining patterns are a BFS ordering over the graph, so they need a
    // reference point: an edge zone for the wall, the Cornucopia for the ring.
    const bfsDistances = (fromName: string): Map<string, number> => {
        const dist = new Map<string, number>([[fromName, 0]]);
        let frontier = [fromName];
        while (frontier.length > 0) {
            const next: string[] = [];
            frontier.forEach(name => {
                const zone = getZone(ctx.state.arena, name);
                zone?.adjacent.forEach(n => {
                    if (dist.has(n)) return;
                    dist.set(n, dist.get(name)! + 1);
                    next.push(n);
                });
            });
            frontier = next;
        }
        return dist;
    };

    if (pattern === 'wall') {
        // The edge furthest from the Cornucopia by hops — a genuine perimeter,
        // not just a randomly chosen zone. The wall then sweeps in from there.
        const fromCornucopia = bfsDistances(allZoneNames[0]);
        const origin = [...fromCornucopia.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? allZoneNames[0];
        const distances = bfsDistances(origin);
        return [...allZoneNames].sort((a, b) => (distances.get(a) ?? 0) - (distances.get(b) ?? 0));
    }

    // Ring: the perimeter goes first and the safe ground shrinks toward the
    // Cornucopia, which is the shape most people mean by "shrinking circle".
    const distances = bfsDistances(allZoneNames[0]);
    return [...allZoneNames].sort((a, b) => (distances.get(b) ?? 0) - (distances.get(a) ?? 0));
}

/**
 * The boredom meter.
 *
 * Canon's Gamemakers do not escalate on a schedule; they escalate because the
 * feed has gone quiet and the Capitol has started changing channels. Fire,
 * mutts and a closing border are all the same instrument: herd them together
 * and give the audience something. `excitementRating` was already tracked per
 * tribute and read only by the sponsor system — aggregated across the living
 * field it is exactly the metric the Gamemakers are watching.
 *
 * Once escalation starts it never un-starts: a border does not reopen because
 * two tributes finally had a fight.
 */
function updateAudienceInterest(ctx: SimContext, time: 'day' | 'night') {
    const alive = getAlive(ctx.state);
    const interest = alive.length === 0
        ? 0
        : alive.reduce((sum, t) => sum + t.excitementRating, 0) / alive.length;
    ctx.state.audienceInterest = Math.round(interest);

    if (ctx.state.escalationDay !== undefined) return;

    // CONTENT-10: the Head Gamemaker's patience is part of the number, not just
    // the crowd's. A patient Gamemaker (Plutarch, Larkspur) tolerates a quieter
    // Games than an impatient one (Ivo) will stand for.
    const gm = gamemakerProfile(ctx.state.headGamemaker);
    const threshold = ESCALATION.boredomThreshold * gm.boredomMultiplier;
    // REPLAY-01: a lavish or slow Games buys the tributes more arena for
    // longer; a compressed one takes it away early.
    // §10.2: an unbounded year never closes the arena at all, and a
    // compressed one starts closing it on the first night.
    if (hasModifier(ctx.state, 'open-borders')) return;
    const shift = escalationShift(ctx.state) + modifierEscalationShift(ctx.state);
    const bored = ctx.state.day >= ESCALATION.boredomEarliestDay + Math.max(0, shift)
        && interest < threshold;
    const scheduled = ctx.state.day >= ESCALATION.startDay + shift;
    if (!bored && !scheduled) return;

    ctx.state.escalationDay = ctx.state.day;
    if (time === 'day' || !scheduled) {
        ctx.logEvent(
            bored && !scheduled
                ? `The feed has been quiet for too long. Somewhere above the arena a Gamemaker decides the audience has waited long enough, and the border starts to move — three days early.`
                : `The Gamemakers begin closing the arena on schedule. There is less world tonight than there was this morning.`,
            [],
            { important: true, category: 'gamemaker' }
        );
    }
}

/**
 * §7: the forced finale.
 *
 * Finalist protection in `applyDamage` keeps the arena from finishing the last
 * two by attrition — which leaves one failure mode open: two evasive finalists
 * who never cross paths. The first soak after the protection landed produced a
 * 509-day Games between two tributes politely avoiding each other. Canon
 * closes this exact loop on screen: when the field is down to the end and the
 * audience is waiting, the Gamemakers drain the arena of everywhere else to be
 * and drive what is left to the Cornucopia.
 *
 * Implemented as objective override rather than teleport: they are herded, not
 * snapped, so travel, ambush and the encounter layer all still apply on the
 * way in.
 */
function forceFinale(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    if (alive.length > ESCALATION.finalistCount || alive.length < 2) {
        ctx.state.finalistCycles = 0;
        delete ctx.state.finaleZone;
        return;
    }
    ctx.state.finalistCycles = (ctx.state.finalistCycles ?? 0) + 1;
    if (ctx.state.finalistCycles < ESCALATION.finaleAfterFinalistCycles) {
        delete ctx.state.finaleZone;
        return;
    }

    // The horn, unless the border has already taken it — the finale happens
    // in whatever the arena has left. Herding the last two toward a collapsed
    // zone gave them an unreachable objective and a run that never ended.
    const active = ctx.state.arena.zones
        .map(z => z.name)
        .filter(name => !(ctx.state.collapsedZones ?? []).includes(name));
    const horn = active.includes(ctx.state.arena.zones[0].name)
        ? ctx.state.arena.zones[0].name
        : active[active.length - 1] ?? ctx.state.arena.zones[0].name;
    if (ctx.state.finalistCycles === ESCALATION.finaleAfterFinalistCycles) {
        ctx.logEvent(
            `The arena starts taking everything else away. Water stops running, cover thins, and every route that is not toward ${horn} closes behind whoever walks it. `
            + `The Gamemakers are done waiting for ${alive.map(t => t.name).join(' and ')} to find each other.`,
            alive.map(t => t.id),
            { important: true, category: 'gamemaker' }
        );
    }
    // An allied final two with no rule to save them: the alliance cannot
    // survive the arithmetic, and the Gamemakers will not wait for it to.
    // (When a dual-victory route exists — the two-may-win rule change, the
    // district-pairs Quell, or a lovers' bond — `checkDualVictory` has
    // already ended the run before this ever fires, and lovers are exempted
    // here so the nightlock standoff stays reachable. Everyone else gets the
    // 74th's original terms: the revocation, announced from the sky.)
    if (alive.length === 2
        && alive[0].allianceId !== undefined && alive[0].allianceId === alive[1].allianceId
        && !areLovers(alive[0], alive[1])) {
        const [a, b] = alive;
        delete a.allianceId;
        delete b.allianceId;
        ctx.logEvent(
            `The announcement is short: there will be one victor. Whatever ${a.name} and ${b.name} agreed, the Capitol has just revoked it from the sky.`,
            [a.id, b.id],
            { important: true, category: 'gamemaker' }
        );
    }
    // Where they are being driven, recorded on the state so `chooseObjective`
    // can make it the highest-priority intention there is. Setting `objective`
    // directly here does not survive: `updateObjective` runs later in the same
    // cycle and replaces it, which is why an earlier version of this herded
    // the finalists on paper and let them wander past each other for three
    // hundred days.
    ctx.state.finaleZone = horn;
}

/**
 * T-4: the body cashing in on sleeplessness whether or not it is a good moment.
 * Returns true when the tribute loses the turn to it.
 */
function rollMicrosleep(ctx: SimContext, t: Tribute): boolean {
    const over = (t.sleeplessCycles ?? 0) - EXHAUSTION.microsleepAfter;
    if (over <= 0) return false;
    // Insomniac cannot sleep at night, so it is exactly this tribute who ends
    // up sleeping standing up at noon — the trait compounding into something
    // beyond its fatigue penalty.
    const insomniac = traitMod(t, 'fatigueNight') > 0 ? 1.5 : 1;
    const chance = Math.min(
        EXHAUSTION.maxMicrosleepChance,
        over * EXHAUSTION.microsleepChancePerCycle * insomniac,
    );
    if (!ctx.rng.chance(chance)) return false;

    t.vitals.fatigue = Math.max(0, t.vitals.fatigue - EXHAUSTION.microsleepFatigueRelief);
    t.vitals.sanity -= EXHAUSTION.microsleepSanityCost;
    t.sleeplessCycles = Math.max(0, (t.sleeplessCycles ?? 0) - 1);
    clampTribute(t);
    ctx.logEvent(
        ctx.pickText(SURVIVAL_TEXTS.microsleep)
            .split('{tribute}').join(t.name)
            .split('{zone}').join(t.zone),
        [t.id],
        { category: 'survival' }
    );
    return true;
}

/**
 * A-3: line of sight from high ground.
 *
 * `revealFires` proved the pattern — an observation in one zone writing an
 * impression into somebody's memory in another — but nothing else in the
 * arena used it, so standing on a ridge was worth an ambush modifier and
 * nothing else. A tribute on elevation can see who is moving in the sectors
 * next to them, which is exactly what high ground is for.
 */
function surveyFromHighGround(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    const severed = severedEdgeSet(ctx.state);

    alive.forEach(watcher => {
        const here = getZone(ctx.state.arena, watcher.zone);
        if (!here || !zoneFeatures(here).elevation) return;
        // In the dark you see a fire and nothing else; `revealFires` covers that.
        if (ctx.state.timeOfDay === 'night') return;

        here.adjacent.forEach(neighbourName => {
            if (severed.has(edgeKey(watcher.zone, neighbourName))) return;
            const seen = alive.filter(o =>
                o.id !== watcher.id && o.zone === neighbourName
                && (o.allianceId === undefined || o.allianceId !== watcher.allianceId));
            if (seen.length === 0) return;
            noteSighting(ctx.state, watcher, neighbourName, seen.length, depletionOf(ctx.state, neighbourName));
            // Seen from a distance is not the same as met: they learn where
            // people are, not who, unless the RNG says the light was good.
            if (ctx.rng.chance(MOVEMENT.highGroundIdentifyChance)) {
                const subject = ctx.rng.pick(seen);
                noteArmament(ctx.state, watcher, subject);
                ctx.logEvent(
                    `${watcher.name} watches ${subject.name} cross ${neighbourName} from the high ground in ${watcher.zone}, and is not seen doing it.`,
                    [watcher.id, subject.id],
                    { category: 'travel' }
                );
            }
        });
    });
}

/**
 * REPLAY-07: campfires, after dark.
 *
 * `lightFire` already charged a concealment penalty for a fire, but only
 * against people already standing in the same zone — which made it a small
 * local tax rather than the decision the source material treats it as. At
 * night a fire is the brightest thing in the arena, and anyone in an adjacent
 * zone can see exactly where it is. That is a real sighting in their memory,
 * and a hunter will act on it.
 */
function revealFires(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    const severed = severedEdgeSet(ctx.state);

    alive.forEach(t => {
        if (!hasCamp(ctx, t, 'fire')) return;
        const zone = getZone(ctx.state.arena, t.zone);
        if (!zone) return;

        const watchers = alive.filter(o =>
            o.id !== t.id
            && o.allianceId !== t.allianceId
            && zone.adjacent.includes(o.zone)
            && !severed.has(edgeKey(t.zone, o.zone)));
        if (watchers.length === 0) return;

        watchers.forEach(o => {
            // They know where it is, not who is sitting at it — which is
            // exactly the right amount of information for a hunter to act on.
            noteSighting(ctx.state, o, t.zone, 1, depletionOf(ctx.state, t.zone));
        });

        ctx.logEvent(
            watchers.length === 1
                ? `${watchers[0].name} sees firelight from ${t.zone} across the dark, and does not look away from it for a long moment.`
                : `${t.name}'s fire is visible from every ridge around ${t.zone}. ${watchers.map(w => w.name).join(', ')} all see it.`,
            [t.id, ...watchers.map(w => w.id)],
            { important: true, zone: t.zone, category: 'survival' }
        );
    });
}

/** Fills in a state-aware ambient line: who's alive, who's fallen, who the Capitol favours. */
function dynamicAmbientLine(ctx: SimContext): string {
    const alive = getAlive(ctx.state);
    const fallen = ctx.state.tributes.length - alive.length;
    const favourite = [...alive].sort((a, b) => b.sponsorTrust - a.sponsorTrust)[0];
    // §4.5: the broadcast tracks the groups by name. When a branded alliance
    // is standing, some ambient lines are about them rather than individuals.
    const brands = Object.values(ctx.state.alliances ?? {})
        .filter(r => r.name && ctx.state.tributes.filter(t => t.status === 'alive' && t.allianceId === r.id).length >= 2);
    if (brands.length > 0 && ctx.rng.chance(ENCOUNTERS.brandedAmbientChance)) {
        const r = ctx.rng.pick(brands);
        const size = ctx.state.tributes.filter(t => t.status === 'alive' && t.allianceId === r.id).length;
        return ctx.pickText([
            `The Capitol's commentators keep cutting back to ${r.name} — ${size} of them still standing, and the betting shops treat them as a single line item.`,
            `Graphics on the evening broadcast chart ${r.name}'s territory in red. The audience has picked a group to follow, which is not the same as picking a side.`,
            `A recap segment runs on ${r.name}: how it formed, who leads it, and — because this is the Capitol — sweepstakes odds on who breaks it first.`,
        ]);
    }
    return ctx.pickText(DYNAMIC_AMBIENT_TEXTS)
        .split('{alive}').join(String(alive.length))
        .split('{fallen}').join(String(fallen))
        .split('{day}').join(String(ctx.state.day))
        .split('{favourite}').join(favourite ? `${favourite.name} of District ${favourite.district}` : 'nobody in particular');
}

/** Hazard escalation and safe-zone shrinking. Returns whether it is active. */
function collapseBorders(ctx: SimContext, time: 'day' | 'night'): boolean {
    const collapseOrder = buildCollapseOrder(ctx);
    const allZoneNames = zoneNames(ctx.state.arena);

    // Telegraphed one full day ahead — canon gives tributes warning before the
    // border actually closes, and a hazard nobody could see coming is a cheap
    // kind of tension. Only announced once per day (the day phase), or a run
    // with both a day and a night cycle would hear the same warning twice.
    // Progress counts from the day the Gamemakers actually started, not from a
    // fixed date — a boredom-triggered collapse on day 3 must not arrive on day
    // 5 already three zones deep.
    const startDay = ctx.state.escalationDay ?? ESCALATION.startDay;
    const countFor = (day: number) => Math.max(0, Math.min(collapseOrder.length - 1, day - (startDay - 1)));
    const nextCount = countFor(ctx.state.day + 1);
    const thisCount = countFor(ctx.state.day);
    if (time === 'day' && nextCount > thisCount) {
        const warned = collapseOrder[nextCount - 1];
        ctx.logEvent(
            fill(ctx.pickText(BORDER_TEXTS.telegraph), { zone: warned }),
            [],
            { important: true, zone: warned, category: 'arena' }
        );
    }

    if (ctx.state.escalationDay === undefined) return false;

    const collapsedList = collapseOrder.slice(0, thisCount);
    ctx.state.collapsedZones = collapsedList;

    getAlive(ctx.state).forEach(t => {
        if (!collapsedList.includes(t.zone)) return;

        // The Gamemakers want a victor, not an empty arena: the border herds
        // the last survivors together rather than finishing them. For
        // finalists that is literal — the wall bloodies them but never lands
        // the killing blow itself; 7.75% of runs used to end with no victor,
        // most of them to this exact damage source.
        const finalists = getAlive(ctx.state).length <= ESCALATION.finalistCount;
        const damage = finalists
            ? Math.min(ESCALATION.finalistCollapseDamage, Math.max(0, t.health - 1))
            : ESCALATION.collapseDamageBase + (ctx.state.day - startDay) * ESCALATION.collapseDamagePerDay;
        const safeZones = allZoneNames.filter(z => !collapsedList.includes(z));
        // Nearest reachable safe zone via the adjacency graph, not an
        // arbitrary index — a tribute should not teleport across the arena,
        // and cannot flee across a bridge the arena has already burned.
        const newSafeZone = nearestSafeZone(ctx.state.arena, t.zone, safeZones, severedEdgeSet(ctx.state));
        const trappedZone = t.zone;

        applyDamage(ctx, t, damage, {
            cause: `Caught in the collapsing border of ${trappedZone}`,
            kind: 'arena',
        });
        ctx.logEvent(
            fill(ctx.pickText(BORDER_TEXTS.collapse), {
                tribute: t.name, trapped: trappedZone, damage: String(damage), safe: newSafeZone,
            }),
            [t.id],
            { important: true, zone: newSafeZone, category: 'hazard' }
        );
        t.zone = newSafeZone;
        addZoneThreat(ctx.state, t, trappedZone, MEMORY.deathThreat);
        checkDeath(ctx, t, `Caught in the collapsing border of ${trappedZone}`);
    });

    return true;
}

/** Field-expedient weapons from whatever is in the pack. */
function craft(ctx: SimContext, t: Tribute) {
    const hasRope = t.inventory.findIndex(i => i.id === 'rope');
    const hasKnife = t.inventory.findIndex(i => i.id === 'knife');
    if (hasRope >= 0 && hasKnife >= 0 && !t.inventory.some(i => i.id === 'spear')) {
        t.inventory.splice(Math.max(hasRope, hasKnife), 1);
        t.inventory.splice(Math.min(hasRope, hasKnife), 1);
        const spear = ITEMS.find(i => i.id === 'spear')!;
        giveItem(t, mintItem(ctx.rng, spear, QUALITY_BIAS.improvised));
        trainProficiency(t, 'crafting');
        ctx.logEvent(`${t.name} lashes a knife to a shaft with rope and walks away holding a Spear.`, [t.id], { category: 'loot' });
    }

    // Anyone holding nothing at all will make something. A tribute with empty
    // hands is a tribute who will never willingly fight, and only a third of the
    // cast was ever armed — the Cornucopia and the feast simply do not put
    // enough steel into circulation to go round.
    // T-2: the improvised-weapon tree had no skill behind it. Someone who has
    // already made a club out of a branch is quicker to see the next one.
    const improviseChance = CRAFTING.improviseChance + profOf(t, 'crafting') * PROFICIENCY.craftChanceWeight;
    if (!t.inventory.some(i => i.type === 'weapon') && ctx.rng.chance(improviseChance)) {
        const ropeIdx = t.inventory.findIndex(i => i.id === 'rope');
        if (ropeIdx >= 0) {
            // Rope is worth more as reach than as rope to somebody holding
            // nothing. The knife-and-rope spear above has first claim on it;
            // this is what is left when there is no knife to lash to a shaft.
            t.inventory.splice(ropeIdx, 1);
            const sling = IMPROVISED_ITEMS.find(i => i.id === 'sling')!;
            giveItem(t, mintItem(ctx.rng, sling, QUALITY_BIAS.improvised));
            ctx.logEvent(
                fill(ctx.pickText(SURVIVAL_TEXTS.craftSling), { tribute: t.name, zone: t.zone }),
                [t.id],
                { category: 'loot' }
            );
        } else {
            const zone = getZone(ctx.state.arena, t.zone);
            // What the ground offers: timber in the woods, reeds in standing
            // water, salvaged steel in the ruins, stone everywhere else.
            const [recipeId, pool] =
                zone?.terrain === 'forest' ? ['club', SURVIVAL_TEXTS.craftClub] as const
                : zone?.terrain === 'wetland' ? ['reedspear', SURVIVAL_TEXTS.craftReed] as const
                : zone?.terrain === 'ruins' ? ['rebar', SURVIVAL_TEXTS.craftRebar] as const
                : ['sharpstone', SURVIVAL_TEXTS.craftStone] as const;
            const recipe = IMPROVISED_ITEMS.find(i => i.id === recipeId)!;
            giveItem(t, { ...recipe });
            ctx.logEvent(
                fill(ctx.pickText(pool), { tribute: t.name, zone: t.zone }),
                [t.id],
                { category: 'loot' }
            );
        }
    }

    // A cudgel and a night at a fire make something with a point on it. The
    // only upgrade path inside the improvised tree, and it costs a fire —
    // which is the most visible thing a tribute can own.
    const clubIdx = t.inventory.findIndex(i => i.id === 'club');
    if (clubIdx >= 0 && hasCamp(ctx, t, 'fire') && !t.inventory.some(i => i.id === 'stake')) {
        t.inventory.splice(clubIdx, 1);
        const stake = IMPROVISED_ITEMS.find(i => i.id === 'stake')!;
        giveItem(t, mintItem(ctx.rng, stake, QUALITY_BIAS.improvised));
        ctx.logEvent(
            fill(ctx.pickText(SURVIVAL_TEXTS.craftStake), { tribute: t.name, zone: t.zone }),
            [t.id],
            { category: 'loot' }
        );
    }

    // Tricksters can improvise a garrote from wire.
    if (t.archetype === 'trickster') {
        const hasWire = t.inventory.findIndex(i => i.id === 'wire');
        if (hasWire >= 0 && !t.inventory.some(i => i.id === 'garrote')) {
            t.inventory.splice(hasWire, 1);
            const garrote = ITEMS.find(i => i.id === 'garrote')!;
            giveItem(t, { ...garrote });
            ctx.logEvent(`${t.name} twists a length of wire into a garrote and tests it on a branch.`, [t.id], { category: 'loot' });
        }
    }
}

/** Alliances move as a unit; everyone else moves for themselves. */
// Hiding is the one stance that should hold position — a reduced chance to
// slip away quietly, not the guaranteed, silent teleport it used to be.
function wanderChanceFor(t: Tribute): number {
    return t.stance === 'Evasive' ? ENCOUNTERS.wanderChance * 0.4 : ENCOUNTERS.wanderChance;
}

/**
 * §5.3: routes a decided move through its traversal cost. A one-cost move
 * happens now (returns true); a costlier one begins a transit and the
 * tribute holds their ground this cycle (returns false).
 */
function beginMove(ctx: SimContext, t: Tribute, destName: string): boolean {
    const dest = getZone(ctx.state.arena, destName);
    const cost = dest ? travelCost(t, dest, ctx.state) : 1;
    if (cost <= 1) return true;
    t.transit = { to: destName, remaining: cost - 1 };
    // T-2: the crossing itself is the lesson.
    if (dest && (dest.terrain === 'water' || dest.terrain === 'wetland')) trainProficiency(t, 'swimming');
    ctx.logEvent(
        ctx.state.weatherFront?.zone === destName
            ? `${t.name} sets off toward ${destName} into the weather rather than wait it out. Every step of it is going to be paid for.`
            : dest?.terrain === 'highland'
                ? `${t.name} starts the long climb toward ${destName}. It will not be done by nightfall.`
                : `${t.name} wades into the crossing toward ${destName}. This is going to take everything the day has left.`,
        [t.id],
        { category: 'travel' }
    );
    return false;
}

function move(ctx: SimContext, t: Tribute, currentAlive: Tribute[], collapsed: string[], flavor: ReturnType<typeof arenaFlavor>, severed: Set<string>, crossed: Set<string>) {
    // A group crossing is resolved once, for everyone who lands together —
    // anyone already brought ashore by an ally's iteration this cycle has
    // nothing left to do. See the arrival block below.
    if (crossed.has(t.id)) return;

    // §5.3: a traversal already underway finishes before anything else. A
    // crossing abandoned because the destination collapsed is just a wasted
    // cycle — which is the point of travel having a cost.
    if (t.transit) {
        if (collapsed.includes(t.transit.to)) {
            ctx.logEvent(`${t.name} turns back mid-crossing — there is no ${t.transit.to} to arrive in any more.`, [t.id], { category: 'travel' });
            delete t.transit;
        } else {
            const from = t.zone;
            const dest = t.transit.to;
            const remaining = t.transit.remaining;
            if (remaining - 1 > 0) {
                t.transit.remaining = remaining - 1;
                return;
            }
            // Everyone fording it shoulder to shoulder: same alliance, same
            // bank, same destination, same cycle left to run. `beginMove`
            // copies the leader's transit onto the group, so a party that set
            // out together lands together — and the feed says so once, rather
            // than printing four near-identical lines in a row. Members who
            // started their crossing on a different cycle do not match, and
            // still get their own arrival.
            const party = t.allianceId === undefined ? [t] : currentAlive.filter(m =>
                m.status === 'alive'
                && m.allianceId === t.allianceId
                && m.zone === from
                && m.transit?.to === dest
                && m.transit.remaining === remaining);
            const arriving = party.length > 0 ? party : [t];

            arriving.forEach(m => {
                delete m.transit;
                m.zone = dest;
                m.vitals.fatigue = Math.min(100, m.vitals.fatigue + MOVEMENT.crossingFatigue);
                crossed.add(m.id);
            });
            noteTraffic(ctx.state, from, dest, arriving.length);
            ctx.logEvent(
                arriving.length === 1
                    ? `${t.name} finishes the hard crossing from ${from} and comes ashore in ${dest}, spent.`
                    : `${arriving.map(m => m.name).join(', ')} finish the hard crossing from ${from} together and come ashore in ${dest}, spent.`,
                arriving.map(m => m.id),
                { zone: dest, category: 'travel' }
            );
            return;
        }
    }

    if (t.allianceId) {
        const allianceMembers = currentAlive.filter(m => m.allianceId === t.allianceId && m.status === 'alive');
        // The group's actual leader, chosen on merit and open to challenge —
        // not `members[0]`, which was whatever order the array happened to be in.
        const leader = leaderFor(ctx.state, t) ?? allianceMembers[0];
        if (leader && t.id !== leader.id && t.zone !== leader.zone) {
            // Separated from the leader — a border collapse, a feast teleport, a
            // lure betrayal — falls through to solo movement angling back toward
            // the group, rather than freezing in place for the rest of the run.
            if (!(t.objective?.kind === 'reach' && t.objective.reason === 'ally' && t.objective.zone === leader.zone)) {
                t.objective = { kind: 'reach', zone: leader.zone, reason: 'ally', expires: cycleOf(ctx.state) + OBJECTIVES.reachCycles };
            }
        } else if (!leader || t.id !== leader.id) {
            return;
        } else {
            const options = reachableZones(ctx.state.arena, t.zone, collapsed, severed);
            if (options.length === 0) return;

            // The group follows whatever its leader has decided to do; only when the
            // leader has no standing intention does the pack drift.
            if (objectiveHolds(t)) return;
            const led = objectiveStep(ctx, t, options);
            if (!led && !ctx.rng.chance(wanderChanceFor(t))) return;
            const newZone = (led ?? pickDestination(ctx, t, options)).name;
            if (t.zone === newZone) return;

            // Only members actually standing with the leader travel — anyone
            // separated by a border collapse or a feast pulls their own weight
            // back rather than being snapped across the map for free.
            const present = allianceMembers.filter(m => m.zone === t.zone);
            // §5.3: the group pays the leader's traversal cost together.
            if (!beginMove(ctx, t, newZone)) {
                present.forEach(m => { if (m.id !== t.id) m.transit = { ...t.transit! }; });
                return;
            }
            const departed = t.zone;
            present.forEach(m => { m.zone = newZone; });
            noteTraffic(ctx.state, departed, newZone, present.length);
            if (t.stance === 'Evasive') {
                ctx.logEvent(`${present.map(m => m.name).join(', ')} slip out of ${departed} without a sound.`, present.map(m => m.id), { zone: newZone, category: 'travel' });
            } else {
                ctx.logEvent(
                    `The alliance of ${present.map(m => m.name).join(', ')} moves out to ${newZone}.`,
                    present.map(m => m.id),
                    { zone: newZone, category: 'travel' }
                );
            }
            return;
        }
    }

    const options = reachableZones(ctx.state.arena, t.zone, collapsed, severed);
    if (options.length === 0) return;

    // A tribute who has decided to be somewhere goes there, by the shortest
    // route over the adjacency graph, and does so whether or not the wander
    // roll would have moved them. Deciding is not the same as drifting.
    if (objectiveHolds(t)) return;
    const step = objectiveStep(ctx, t, options);
    if (step && step.name !== t.zone) {
        if (!beginMove(ctx, t, step.name)) return;
        const from = t.zone;
        t.zone = step.name;
        noteTraffic(ctx.state, from, step.name);
        ctx.logEvent(
            `${t.name} leaves ${from} for ${step.name} — ${objectiveLabel(ctx.state, t).toLowerCase()}.`,
            [t.id],
            { zone: step.name, category: 'travel' }
        );
        return;
    }

    if (!ctx.rng.chance(wanderChanceFor(t))) return;
    const newZone = pickDestination(ctx, t, options).name;
    if (t.zone === newZone) return;
    if (!beginMove(ctx, t, newZone)) return;

    const oldZone = t.zone;
    t.zone = newZone;
    noteTraffic(ctx.state, oldZone, newZone);
    if (t.stance === 'Evasive') {
        ctx.logEvent(`${t.name} slips out of ${oldZone} without a sound.`, [t.id], { zone: newZone, category: 'travel' });
    } else if (ctx.rng.chance(MOVEMENT.landmarkLineChance)) {
        // §8.3: survivors navigate by the specific thing, not the sector
        // label. The landmark is deterministic per zone, so it accumulates
        // meaning as the same one keeps turning up in different tributes'
        // lines across a run.
        const dest = getZone(ctx.state.arena, newZone);
        ctx.logEvent(
            dest
                ? `${t.name} comes into ${newZone} past ${landmarkOf(dest)}, checking it the way you check a thing that has not moved since yesterday.`
                : fill(ctx.pickText(flavor.actions.travel), { tribute: t.name, zone: newZone }),
            [t.id],
            { zone: newZone, category: 'travel' }
        );
    } else {
        ctx.logEvent(
            fill(ctx.pickText(flavor.actions.travel), { tribute: t.name, zone: newZone }),
            [t.id],
            { zone: newZone, category: 'travel' }
        );
    }
}

/** Everything that can happen to a tribute once they have finished moving. */
function resolveEncounters(
    ctx: SimContext,
    currentAlive: Tribute[],
    acted: Set<string>,
    isEscalated: boolean,
    flavor: ReturnType<typeof arenaFlavor>,
    time: 'day' | 'night',
) {
    const shuffled = ctx.rng.shuffle(currentAlive);

    shuffled.forEach(t => {
        if (acted.has(t.id) || t.status === 'dead') return;

        const zone = getZone(ctx.state.arena, t.zone);
        const zoneDanger = zone ? 0.5 + zone.danger : 1; // 0.5x-1.5x from zone danger
        let eventChance = ENCOUNTERS.baseEventChance * zoneDanger;
        let muttChance = ENCOUNTERS.baseMuttChance * zoneDanger;
        if (isEscalated) {
            const escalatedSince = ctx.state.escalationDay ?? ESCALATION.startDay;
            const gm = gamemakerProfile(ctx.state.headGamemaker);
            const multiplier = (1 + (ctx.state.day - escalatedSince) * ESCALATION.hazardMultiplierPerDay) * gm.hazardMultiplier;
            eventChance = Math.min(ESCALATION.hazardCeiling, eventChance * multiplier);
            muttChance = Math.min(ESCALATION.hazardCeiling, muttChance * multiplier);
        }
        eventChance = Math.min(ENCOUNTERS.hazardCeiling, eventChance * ctx.state.config.hazardRate);
        muttChance = Math.min(ENCOUNTERS.hazardCeiling, muttChance * ctx.state.config.hazardRate);

        if (ctx.rng.chance(eventChance)) {
            applyArenaEvent(ctx, t, pickTerrainEvent(ctx, flavor.events, zone?.terrain));
            acted.add(t.id);
            return;
        }

        if (ctx.rng.chance(muttChance)) {
            resolveMuttAttack(ctx, t, time);
            acted.add(t.id);
            return;
        }

        // Only encounter others in the SAME ZONE — and only those who actually
        // notice each other. A tribute who has gone to ground in heavy cover is
        // simply not found this cycle, which is what stealth buys them.
        const inZone = shuffled.filter(o => o.id !== t.id && !acted.has(o.id) && o.status === 'alive' && o.zone === t.zone);
        const alliesOf = (o: Tribute) => inZone.filter(x => x.allianceId !== undefined && x.allianceId === o.allianceId).length;
        const others = inZone.filter(o =>
            isNoticed(ctx, o, t, zone, alliesOf(o)) || isNoticed(ctx, t, o, zone, alliesOf(t)));

        if (others.length < inZone.length && ctx.rng.chance(ENCOUNTERS.nearMissLineChance)) {
            const missed = inZone.filter(o => !others.includes(o));
            ctx.logEvent(
                fill(ctx.pickText(ENCOUNTER_TEXTS.unnoticed), { t1: t.name, t2: missed[0].name, zone: t.zone }),
                [t.id, missed[0].id],
                { category: 'survival' }
            );
        }

        if (others.length === 0) {
            idleAction(ctx, t, flavor);
            acted.add(t.id);
            return;
        }

        // A tribute who is actively sweeping the zone for someone to fight finds
        // them far more often than one who happens to be standing in it. Without
        // this, hunting was a stance with no mechanical expression at all.
        // §7: once the finale is forced there is nothing else in the arena to
        // do and nowhere to do it. Two finalists standing in the same zone
        // meet, rather than rolling for it and drifting apart again — that
        // roll is what let a forced finale run for hundreds of days.
        const meetChance = ctx.state.finaleZone
            ? 1
            : t.stance === 'Aggressive'
                ? Math.min(0.95, ENCOUNTERS.meetChance * HUNTING.meetChanceMultiplier)
                : ENCOUNTERS.meetChance;

        if (ctx.rng.chance(meetChance)) {
            // Three or more free bodies in one zone is a group problem.
            const hostilePresent = others.filter(o => o.allianceId === undefined || o.allianceId !== t.allianceId);
            if (others.length >= 2 && hostilePresent.length >= 1 && ctx.rng.chance(ENCOUNTERS.groupFightChance)) {
                const party = [t, ...others].slice(0, ENCOUNTERS.maxBrawlSize);
                const anyAggressive = party.some(p => p.stance === 'Aggressive');
                const anyGrudge = party.some(p => party.some(q => q.id !== p.id && getRel(p, q.id) < -10));
                if (anyAggressive || anyGrudge) {
                    party.forEach(p => acted.add(p.id));
                    resolveGroupCombat(ctx, party);
                    return;
                }
            }
            // Who they actually run into. A tribute with a standing hunt
            // objective naming someone in this very zone was resolving against
            // `others[0]` — whatever array order happened to put first — so a
            // hunter could walk past their quarry to have a chance encounter
            // with a bystander. Deciding to hunt someone should mean finding
            // them when they are standing right there.
            const objective = t.objective;
            const quarry = objective?.kind === 'hunt'
                ? others.find(o => o.id === objective.targetId)
                : undefined;
            const met = quarry ?? others[0];
            resolvePairEncounter(ctx, t, met);
            acted.add(t.id);
            acted.add(met.id);
            return;
        }

        idleAction(ctx, t, flavor);
        acted.add(t.id);
    });
}
