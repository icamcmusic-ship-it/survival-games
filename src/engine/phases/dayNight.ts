import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Tribute } from '../../models/types';
import { IMPROVISED_ITEMS, ITEMS } from '../../data/constants';
import { ACTION_BUDGET, ARENA_LAWS, BLEEDING, ACHIEVEMENT_BARS, ANTHEM, CRAFTING, EARNED_TRAIT_RULES, ENCOUNTERS, ESCALATION, HUNTING, MEMORY, MOVEMENT, OBJECTIVES, PROFICIENCY, QUELL_MECHANICS, RESOLVE, SANITY_BANDS, SPONSORS, STANCE_MODES, ZONE_EFFECTS } from '../../data/balance';
import { traitMod } from '../../data/traits';
import { AMBIENT_TEXTS, BORDER_TEXTS, DYNAMIC_AMBIENT_TEXTS, ENCOUNTER_TEXTS, SURVIVAL_TEXTS } from '../../data/flavorText';
import { arenaFlavor } from '../../data/arenaFlavor';
import { applyDamage, checkDeath, resolveGroupCombat } from '../combat';
import { processSponsors } from '../sponsors';
import { zoneNames, getZone, reachableZones, depletionOf, regenerateZones, nearestSafeZone, noteTraffic, decayTraffic, severedEdgeSet, severEdge, depleteZone, edgeKey, travelCost, applyEdgeToll, edgeTimeCost, hasForceField, zoneSightlines, zoneFeatures, tickHiddenEdges, tickGarrisons, tickOpeningEdges, restoreEdge } from '../map';
import { enforceCapacity, giveItem } from '../items';
import {
    addZoneThreat, advanceCycle, checkIntelLies, cycleOf, noteRivalSighting, noteSighting, shareScoutSighting, tickIntelSharing } from '../memory';
import { driftReputation, getRel } from '../relationships';
import { clampTribute } from '../vitals';
import { clearBleeding, healInjury, openWound } from '../wounds';
import { canAfford, crossingsLeft, hoursLeft, noteCrossing, resetBudget, spend, travelHoursFor } from '../actionBudget';
import { isNoticed } from '../stealth';
import { pickDestination } from '../movement';
import { objectiveHolds, objectiveLabel, objectiveStep, updateObjective } from '../objectives';
import { checkTraps, hasCamp, tickTraps } from '../fieldcraft';
import { allianceRecords, areLovers, fractureBlocs, isHostileTo, leaderFor } from '../alliance';

import { decayNotoriety, reputationPriors, spreadNotoriety } from '../notoriety';
import { updateStance } from '../stance';
import { runStanceBeats } from '../stanceBeats';
import { runArchetypeSignatures, tickGhosts, tickScholars } from '../archetypeHooks';
import { isActive, isDowned } from '../downed';
import { decayUpkeep, postActionUpkeep, preActionUpkeep } from './upkeep';
import { resolveParachutes } from '../parachutes';
import { appealForAid, negotiateObligations, tickObligations } from '../obligations';
import { tickForecasts } from '../hazardChain';
import { tickExposure } from '../survival';
import {
    applyArenaEvent, fill, handleInsanity, idleAction, isBreakingDown,
    pendingChain, pickTerrainEvent, resolveMuttAttack, resolvePairEncounter,
} from '../encounters';
import { tickPersistentMutts } from '../mutts';
import { hasEffect, restockCornucopia, rollAmbientZoneEffects, startZoneEffect, tickForceField, tickZoneEffects } from '../zoneEffects';
import { tickStructuralFatigue } from '../loadBearing';
import { tickAbandonedCamps } from '../abandonedCamps';
import { enterVerticalZone, samePlace, tickVerticality } from '../verticality';
import { tickEpithets } from '../epithets';
import { noteEffectCaused, tickRunRecords } from '../runRecords';
import { climateOf } from '../climate';
import { tributeOdds } from '../odds';
import { runArenaSignature } from '../arenaSignature';
import { runGamemakerSignature } from '../gamemakerAgency';
import { tickWeatherFront } from '../weatherFront';
import { tickZoneControl } from '../zoneControl';
import { resolveBreakdowns, tickResolve } from '../resolve';
import { tickPersona } from '../persona';
import { resolveTruces } from '../parley';
import { postWatches } from '../watch';
import { offerLoans, repayDebts, settleLoans, tickDistrictBonds, tickRetainers } from '../debts';
import { reconcileRivals } from '../rapport';
import { decaySkillsUnderInjury, profOf, teachSkills, trainProficiency } from '../proficiency';
import { enforceCharters } from '../allianceCharter';
import { earnTrait } from '../earnedTraits';
import { tickTraitArcs } from '../traitArcs';
import { detectTriangles, forceTriangleChoice, tickTriangles } from '../triangles';
import { proposeBlocTreaties, tickBlocTreaties } from '../blocTreaty';
import { formVengeancePacts, tickVengeancePacts } from '../vengeancePact';
import { checkRumours, mintTrueRumours, shareRumoursInCamp } from '../rumours';
import { gamemakerProfile } from '../../data/gamemakers';
import { arenaHasLaw, arenaIsSilent, escalationShift, wildcardIs } from '../gamesProfile';
import { tickArenaEvents, tickConvergence } from '../arenaEventPacks';
import { mintItem } from '../items';
import { QUALITY_BIAS } from '../../data/balance';
import { isAggressiveStance, isEvasiveStance } from '../../data/stances';
import { loseSanity } from '../sanityBands';

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

    /*
     * Audit 3 §5.2 `dawnMercy`: the second of the two laws that give.
     *
     * Anybody who spent the night at the Cornucopia is treated at first light —
     * bleeding stopped, a wound dressed, health back. Enforced at exactly one
     * site, like every other law, and deliberately at the horn rather than
     * anywhere else: the horn is already the highest-danger tile in the arena
     * and this makes it the highest-reward one too, so the law creates ground
     * worth contesting rather than a uniform easing. Camping it all night with
     * the rest of the field awake and hungry is the price.
     */
    if (time === 'day' && arenaHasLaw(ctx.state, 'dawnMercy')) {
        const horn = ctx.state.arena.zones.find(z => /cornucopia/i.test(z.name));
        const atHorn = horn ? alive.filter(t => t.zone === horn.name) : [];
        /*
         * One tribute, not everyone standing there — the worst hurt of them.
         *
         * The first cut treated the whole tile, and measured over 1,600 runs
         * that handed the law to the Career pack: the horn is only the
         * highest-danger tile in the arena for somebody arriving alone, and for
         * the group already camped on it free healing every morning is simply a
         * pack bonus. Career win rate went 7.57% -> 8.02% and the whole-field
         * spread went back over its goal.
         *
         * Treating the worst-hurt one keeps everything the law was for — the
         * horn becomes worth the risk of sleeping on, and the Capitol gets its
         * televised act of generosity — and takes the pack bonus out: a group
         * of five gets one member patched, a tribute who risked it alone gets
         * patched every time.
         */
        const patient = atHorn.reduce<Tribute | undefined>(
            (worst, t) => (worst === undefined || t.health < worst.health ? t : worst), undefined);
        if (horn && patient) {
            clearBleeding(patient);
            healInjury(patient, 'infected');
            patient.health = Math.min(100, patient.health + ARENA_LAWS.dawnMercyHeal);
            patient.vitals.sanity = Math.min(100, patient.vitals.sanity + ARENA_LAWS.dawnMercySanity);
            clampTribute(patient);
            ctx.logEvent(
                `First light at ${horn.name}, and the Capitol is generous to exactly one of the people who stayed: `
                + `${patient.name}, who needed it most and is the best television. `
                // §22: the cast is everybody who slept at the horn, so the
                // line says who watched rather than "everybody else".
                + (atHorn.length > 1
                    ? `${atHorn.filter(t => t.id !== patient.id).map(t => t.name).join(', ')} watch it happen and do the `
                        + 'arithmetic on what being the worst hurt is worth.'
                    : 'There was nobody else there to watch, which the Capitol will have found disappointing.'),
                atHorn.map(t => t.id),
                { important: true, category: 'gamemaker', zone: horn.name }
            );
        }
    }
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
            const pool = ctx.rng.chance(ENCOUNTERS.ambientArenaShare) ? flavor.ambient : AMBIENT_TEXTS;
            ctx.logEvent(ctx.pickText(pool), [], { category: 'arena' });
        }
    }

    // §1 `tidalBorders` / `meltingGround`: the two laws that re-shape the map
    // rather than taxing the people on it. Before anybody moves, so the routes
    // and the ground a tribute scores this cycle are the ones they will get.
    runTidalBorders(ctx, time);

    // 0. The audience decides how much arena the tributes get to keep.
    updateAudienceInterest(ctx, time);
    // §3/§11 (requests): this run's arena set pieces, and the convergence that
    // drives whatever is left of the field into one sector. Before the border
    // collapse below, because a set piece can take zones out of bounds itself
    // and the collapse should see the map the set piece left.
    if (time === 'day') tickArenaEvents(ctx);
    tickConvergence(ctx);
    forceFinale(ctx);
    const isEscalated = collapseBorders(ctx, time);
    const collapsed = ctx.state.collapsedZones || [];
    const severed = severedEdgeSet(ctx.state);
    // §5.5: who is sitting on which pass, settled before anybody tries to walk
    // through one — a claim made by digging in last cycle is live this cycle.
    tickGarrisons(ctx);

    // 1-2. Spoilage, then vitals, exposure, wounds and supplies.
    // AUDIT-9 B01: through the shared lifecycle, so the feast — which replaces
    // this phase rather than adding one — runs the same upkeep rather than a
    // copy of it that can drift. See `phases/upkeep.ts`.
    preActionUpkeep(ctx, time);

    // 3. Crafting, situational awareness, stance and movement.
    // Resolution order is drawn fresh every cycle. Each tribute fully resolves
    // — sights, stance, intention, move — before the next one even looks at
    // the zone, so whoever went first saw a world nobody had acted on yet.
    // In roster order that was a standing advantage for the lowest slots.
    const currentAlive = ctx.rng.shuffle(getAlive(ctx.state));
    const acted = new Set<string>();
    // Tributes brought ashore this cycle as part of somebody else's group
    // crossing. Kept separate from `acted` on purpose: they have finished
    // moving, but they still meet whatever is waiting in the new zone.
    const crossed = new Set<string>();
    currentAlive.forEach(t => {
        // §9.1: a tribute bleeding out on the floor does not craft, choose a
        // stance, form an intention or walk anywhere. `tickDowned` is the only
        // thing that resolves them.
        if (!isActive(t)) return;

        // AUDIT-9 stage C §3: a new cycle is a new day's hours. Everything
        // below competes for them — see `engine/actionBudget`.
        resetBudget(t);

        craft(ctx, t);

        // What they can see from where they stand, before they decide anything.
        // §5.1: two tributes on different levels of the same shaft are not in
        // the same place, and do not run into each other.
        const here = currentAlive.filter(o => o.status === 'alive' && samePlace(ctx.state.arena, t, o));
        const hostiles = here.filter(o => isHostileTo(t, o)).length;
        noteSighting(ctx.state, t, t.zone, hostiles, depletionOf(ctx.state, t.zone));
        // A §5: every rival in view is a small lesson in how dangerous they
        // are. `noteRivalSighting` existed for exactly this and had no caller,
        // so a read only ever improved by meeting, fighting or bleeding.
        // AUDIT-9 B11: seeing somebody is also learning where they are. The
        // state/tribute arguments are what write that belief.
        here.forEach(o => { if (o.id !== t.id && isHostileTo(t, o)) noteRivalSighting(t, o.id, ctx.state, o); });
        // §4.4/§5.9: if this is the group's scout, that sighting belongs to
        // everybody wearing the same colours.
        shareScoutSighting(ctx.state, t, t.zone, hostiles, depletionOf(ctx.state, t.zone));
        // §5.6: high ground is a watchtower. A tribute on elevation reads the
        // zones its sightlines reach — who is moving down there — and feeds it
        // into the same memory the sighting layer uses, so a ridge camp is
        // genuinely worth holding for the intelligence alone. Only by daylight.
        if (ctx.state.timeOfDay === 'day') {
            const vantage = getZone(ctx.state.arena, t.zone);
            if (vantage) {
                zoneSightlines(ctx.state.arena, vantage).forEach(watched => {
                    const rivalsThere = currentAlive.filter(o =>
                        o.status === 'alive' && o.zone === watched && o.id !== t.id
                        && (o.allianceId === undefined || o.allianceId !== t.allianceId)).length;
                    noteSighting(ctx.state, t, watched, rivalsThere, depletionOf(ctx.state, watched));
                });
            }
        }

        updateStance(ctx, t, here);
        // Stance first, then intention: what they mean to do this cycle depends
        // on how threatened they have just decided they are.
        updateObjective(ctx, t, here);

        if (isBreakingDown(ctx, t)) {
            handleInsanity(ctx, t);
            // AUDIT-9 stage C §3: a breakdown costs the cycle. Found by the
            // "a tribute in transit is not also building things" scenario:
            // somebody who came apart mid-crossing kept a full untouched day,
            // because the breakdown branch returns before `move` and `move`
            // was the only thing charging for the crossing. Losing the day is
            // what a breakdown *is*.
            spend(t, hoursLeft(t));
            acted.add(t.id);
            return;
        }

        move(ctx, t, currentAlive, collapsed, flavor, severed, crossed, effectiveTime);
    });

    // Walking into a zone is what springs things left in it. This runs as a
    // second pass because a non-leader alliance member is only relocated when
    // their leader's iteration comes around — checking traps inside the
    // movement loop tested whichever zone the array order happened to leave
    // them in at that moment.
    currentAlive.forEach(t => {
        if (!isActive(t)) return;
        checkTraps(ctx, t);
    });

    // Dusk is over: everything from here resolves in full dark.
    ctx.state.timeOfDay = effectiveTime;

    // A fire is warmth, hot food, and after dark it is the only thing in the
    // arena visible from a zone away. This is the trade the source material is
    // built on, and it only pays off at night.
    if (effectiveTime === 'night') revealFires(ctx);
    // §6.3: by daylight the flame is invisible and the smoke is not.
    if (effectiveTime === 'day') revealSmoke(ctx);
    // §11.4: low sanity blows cover audibly, and only the dark makes it matter.
    if (effectiveTime === 'night') revealNoisyBreakdowns(ctx);
    // §6.3/§6.5: camps meet the arena — a fire can escape into dry ground,
    // and rain scrubs camouflage off early.
    tickCampConsequences(ctx);

    // A1: the per-stance beats — a shadow's three quiet cycles cashing in, a
    // desperate tribute robbing their own alliance, a scavenger working a
    // body. Resolved before the generic encounter pass so those people are not
    // also described doing something else in the same cycle.
    runStanceBeats(ctx);

    // 4. Hazards, mutts and everyone who runs into everyone else.
    resolveEncounters(ctx, currentAlive, acted, isEscalated, flavor, effectiveTime);
    // A mutt that has found someone keeps looking for them for a few more
    // cycles, independent of the ordinary per-cycle mutt roll.
    tickPersistentMutts(ctx);

    // §9.1: the rescue window. Runs after movement and encounters because the
    // whole question it asks is who is standing in the zone by the end of the
    // cycle — the ally who got there in time, the enemy who got there first,
    // or nobody at all.
    postActionUpkeep(ctx);
    /*
     * AUDIT-9 stage C §4: promises are made where people are standing next to
     * each other, and discharged the same way. Both run after the cycle has
     * settled, so "together" means together now.
     */
    negotiateObligations(ctx);
    // AUDIT-9 batch 3: and the ask that does not need an alliance behind it.
    // Runs before the tick so an appeal answered this cycle can be discharged
    // this cycle — both of them are already standing in the same place, which
    // is the whole reason this promise is a different shape from the others.
    appealForAid(ctx);
    tickObligations(ctx);

    // 4a. Whether anyone has stopped wanting to win. Resolve drifts on what
    // this cycle actually did to them, then the ones who have run out act on it.
    tickResolve(ctx);
    tickPersona(ctx);
    resolveBreakdowns(ctx);
    // 4a-ii. §3.2: and whether this cycle changed who they are. Traits decay,
    // collide and evolve here, after everything that could have earned one.
    tickTraitArcs(ctx);
    // §4.6: detect the shape, then let it build. Detection first so a triangle
    // that forms this cycle starts accruing on the next one rather than
    // arriving with heat already on it.
    detectTriangles(ctx);
    tickTriangles(ctx);
    // §4.6: the feast is one pressure point; the field closing is the other,
    // and it is the one that always arrives. A triangle cannot survive into a
    // final handful of tributes without somebody addressing it.
    if (getAlive(ctx.state).length <= RESOLVE.endgameFieldSize) forceTriangleChoice(ctx);

    // §5.3 (audit): the sealed horn reopens on schedule.
    if (ctx.state.sealedHornUntilCycle !== undefined && (ctx.state.cycle ?? 0) >= ctx.state.sealedHornUntilCycle) {
        const horn = ctx.state.arena.zones[0];
        horn.adjacent.forEach(n => restoreEdge(ctx.state, horn.name, n));
        ctx.state.sealedHornUntilCycle = undefined;
        ctx.logEvent(`The force fields around ${horn.name} drop as quietly as they rose.`, [], { category: 'gamemaker', zone: horn.name });
    }
    // 4b. The arena's own rule — the clock, the tide, the blackout schedule.
    // Runs after movement and encounters so it acts on where tributes actually
    // ended up, and before upkeep so the effects it starts tick normally.
    runArenaSignature(ctx);
    // Audit 5 §5.4 `theBell`: named at first light, paid at nightfall.
    if (arenaHasLaw(ctx.state, 'theBell')) {
        if (time === 'day') {
            const zones = ctx.state.arena.zones.map(z => z.name).filter(z => !(ctx.state.collapsedZones ?? []).includes(z));
            if (zones.length > 0) {
                const rng = new RNG(`${ctx.state.seed}-bell-${ctx.state.day}`);
                ctx.state.bellZone = rng.pick(zones);
                ctx.logEvent(`THE BELL: one stroke over the arena at first light, and the Capitol's voice after it, naming ${ctx.state.bellZone}. Whoever is standing there when the light goes gets fed.`, [], { important: true, zone: ctx.state.bellZone, category: 'arena' });
            }
        } else if (ctx.state.bellZone) {
            const there = getAlive(ctx.state).filter(t => t.zone === ctx.state.bellZone);
            there.forEach(t => {
                t.vitals.hunger = Math.max(0, t.vitals.hunger - ARENA_LAWS.bellFeed);
                t.vitals.thirst = Math.max(0, t.vitals.thirst - ARENA_LAWS.bellQuench);
                t.sponsorTrust = Math.min(100, t.sponsorTrust + ARENA_LAWS.bellSponsorTrust);
                clampTribute(t);
            });
            if (there.length > 0) {
                ctx.logEvent(`The bell pays out in ${ctx.state.bellZone}: ${there.map(t => t.name).join(', ')} ${there.length === 1 ? 'is' : 'are'} fed and watered by the Capitol, on camera, in front of everybody who did not make it there.`, there.map(t => t.id), { important: true, zone: ctx.state.bellZone, category: 'arena' });
            } else {
                ctx.logEvent(`The bell's zone, ${ctx.state.bellZone}, is empty at nightfall. The Capitol's supper goes back up on the wire uneaten.`, [], { zone: ctx.state.bellZone, category: 'arena' });
            }
            ctx.state.bellZone = undefined;
        }
    }
    // ...and the Head Gamemaker's, once per run, when the feed needs saving.
    runGamemakerSignature(ctx);
    // A2: and the archetypes' own — one set piece per tribute per run, which
    // is what makes an archetype a character rather than a modifier row.
    runArchetypeSignatures(ctx);
    // A2: the Ghost's two opposed currencies, settled once per cycle.
    tickGhosts(ctx);
    tickScholars(ctx);

    // 5. Cycle upkeep: the arena restocks, memories fade, bonds cool, the
    // crowd's attention wanders.
    // Audit 3 §5.3: ground that has come all the way back blooms. `blooming` is
    // the arena's only unambiguously good zone effect and the only thing that
    // could ever start one was a rare authored boon event in eleven of forty
    // arenas — third-rarest of ten kinds at 33 samples against `fogbound`'s 711.
    // The regrowth beat already told the field the ground was worth returning
    // to; now it is.
    regenerateZones(ctx).forEach(zone => startZoneEffect(ctx, zone, 'blooming', false));
    // §1 `meltingGround`: ...and, in the one arena where nothing grows back,
    // the ground everybody has been standing on gives up a little more. After
    // the regeneration pass on purpose: the law is that recovery loses.
    runMeltingGround(ctx);
    // §5.5: a way nobody has found yet is the most valuable thing in an arena
    // that has one. Run in upkeep, after this cycle's movement has settled
    // `zoneHeld`, so finding one takes actually having sat somewhere.
    tickOpeningEdges(ctx);
    tickHiddenEdges(ctx);
    // Fire spreads, floods drown stragglers, and whatever else is happening to
    // the ground itself lands after this cycle's movement has resolved.
    tickWeatherFront(ctx);
    tickZoneControl(ctx);
    tickSharedGrief(ctx);
    rollAmbientZoneEffects(ctx);
    // AUDIT-9 stage C §5: forecasts come due before the effects tick, so a
    // hazard that lands this cycle is a hazard this cycle.
    tickForecasts(ctx);
    // AUDIT-9 stage D chain 2: bad water drunk days ago, arriving now.
    tickExposure(ctx);
    tickZoneEffects(ctx);
    // §5.8: occupation loads the arena's structures; empty ones settle back.
    tickStructuralFatigue(ctx);
    // §7.1: the arena's edge is a thing tributes can find, touch, and use.
    tickForceField(ctx);
    restockCornucopia(ctx);
    maintainBounty(ctx);
    maintainMovingArena(ctx);
    tickTraps(ctx);
    // §5.1: who has gone up or down inside their own zone this cycle.
    tickVerticality(ctx);
    // §5.5: who left a camp standing this cycle, and who walked into one.
    tickAbandonedCamps(ctx);
    // §11.5: and whether anybody has become known for something this cycle.
    tickEpithets(ctx);
    // §12: the per-run shapes the achievement table asks about.
    tickRunRecords(ctx);
    decayTraffic(ctx.state);
    // §9.7: a lie about the map is only a lie once somebody stands in the zone
    // and finds out. Tested before memories decay, while the invented threat
    // the liar planted is still there to be contradicted.
    checkIntelLies(ctx);
    // §4.2 (audit): stored trust heals on its own clock. AUDIT-9 B01: the
    // whole decay block is the shared lifecycle's third stage.
    decayUpkeep(ctx);
    // §3.5: the two contactless channels — the sky, and the zone next door —
    // then the decay, so a name nobody has heard again fades. Ordered after
    // `decayFear` for the same reason: this cycle's belief is built on top of
    // what survived last cycle's forgetting, not underneath it.
    spreadNotoriety(ctx);
    // AUDIT-6 §4.1: and what the field has heard becomes what it thinks.
    reputationPriors(ctx);
    decayNotoriety(ctx.state);
    // §9.7: and knowledge moves. After the discovery pass above, so a lie found
    // out this cycle is not immediately papered over by a fresh trade.
    tickIntelSharing(ctx);
    resolveTruces(ctx);
    // A §6: who is awake. Posted at nightfall for every group sleeping in one
    // place, so a Light Sleeper in the party is worth a better night for
    // everybody else.
    if (effectiveTime === 'night') postWatches(ctx);
    // §4.1: the bloc layer, alongside the pair layer. Proposed before it is
    // ticked so a treaty sworn this cycle is not immediately assessed against
    // the clock it was just given.
    // §4: an oversized coalition comes apart before anything else is decided.
    fractureBlocs(ctx);
    proposeBlocTreaties(ctx);
    tickBlocTreaties(ctx);
    // §4.3: the shared grudge. Formed before it is ticked, so a pact sworn
    // this cycle is not immediately assessed for whether anybody has quit it.
    formVengeancePacts(ctx);
    tickVengeancePacts(ctx);
    // §4.7: the world says a true thing about itself, and anybody who walked
    // somewhere on somebody's word finds out whether the word was good.
    mintTrueRumours(ctx);
    shareRumoursInCamp(ctx);
    checkRumours(ctx);
    // Obligations come due, district partners grow into each other, and any
    // group that agreed terms is held to them.
    repayDebts(ctx);
    tickDistrictBonds(ctx);
    // §1.2: a contract has an upkeep. The Mercenary's ledger is finally read.
    tickRetainers(ctx);
    // §4.4: the light ledger. Offered before it is settled, so a loan made
    // this cycle is not immediately assessed for being overdue.
    offerLoans(ctx);
    settleLoans(ctx);
    // §4.3: rivalry has a way down as well as a way up.
    reconcileRivals(ctx);
    // §3.3: knowledge moves between allies, and a ruined limb takes some with it.
    teachSkills(ctx);
    decaySkillsUnderInjury(ctx);
    enforceCharters(ctx);
    const board = getAlive(ctx.state);
    // §10.1: 'Paid in Full' — debts existed, and none were still outstanding
    // when the field first reached four. Sampled before the audit below so a
    // debt still open this cycle counts as ever having existed.
    const anyOutstanding = board.some(t => t.debts && Object.values(t.debts).some(d => d > 0));
    if (anyOutstanding) ctx.state.debtsEverIncurred = true;
    if (board.length <= 4 && board.length >= 2 && !ctx.state.finalFourDebtsChecked) {
        ctx.state.finalFourDebtsChecked = true;
        if (ctx.state.debtsEverIncurred && !anyOutstanding) ctx.state.paidInFullSeen = true;
    }
    board.forEach(t => {
        // §10.1: the personal map — every zone they have stood in.
        t.visitedZones = t.visitedZones ?? [];
        if (!t.visitedZones.includes(t.zone)) {
            t.visitedZones.push(t.zone);
            /*
             * AUDIT-7 §3.5: standing somewhere you have not stood is how
             * anybody learns ground, and `navigation` had one training site in
             * the whole engine. Its peak across 6,000 tributes was 2.53 against
             * a cap of 6, on the skill that decides whether a tribute can read
             * a route — so the arena's own map was teaching nobody anything.
             * A partial share: arriving is not the same as knowing your way
             * back, and a tribute who crosses the whole arena should end the
             * run able to.
             */
            trainProficiency(t, 'navigation', undefined, PROFICIENCY.navigationNewZoneShare);
        }
        /*
         * AUDIT-7 §12.4: `pacing` is trained by the walking rather than by
         * arriving somewhere new, which is what separates it from navigation:
         * one is knowing the ground and the other is having legs left at the
         * end of it. Every cycle on the move counts, including the repetitive
         * ones — especially the repetitive ones.
         */
        if (t.transit) trainProficiency(t, 'pacing', undefined, PROFICIENCY.pacingPerCrossingShare);
        // §8.9: cycles spent with no hostile in the zone. Enough of them in a
        // row and quiet has become who they are.
        const hostileHere = board.some(o => o.id !== t.id && o.zone === t.zone
            && (o.allianceId === undefined || o.allianceId !== t.allianceId));
        t.unseenStreak = hostileHere ? 0 : (t.unseenStreak ?? 0) + 1;
        if (t.unseenStreak >= EARNED_TRAIT_RULES.silentStepCycles) earnTrait(ctx, t, 'Silent Step');
        // A1: consecutive cycles on the same ground. Fortified needs a tribute
        // to have actually settled somewhere rather than merely be standing
        // there this instant, and there was no way to ask that question before.
        if (t.zoneHeldName === t.zone) t.zoneHeld = (t.zoneHeld ?? 0) + 1;
        else { t.zoneHeldName = t.zone; t.zoneHeld = 0; }
        // §10.1: 'Full Kit' — three of armour, light, warmth and a purifier at
        // once.
        //
        // §12: this used to require all four, and nobody ever managed it: the
        // most any tribute reached across 400 measured runs was three, because
        // a fourth utility slot competes with food, water and a weapon for the
        // same carry capacity. An achievement gated above what the item and
        // capacity systems can produce is decoration, so the bar is now the
        // top of what they actually produce.
        if (!t.fullKitSeen) {
            const kit = [
                t.inventory.some(i => (i.armour ?? 0) > 0),
                t.inventory.some(i => i.light),
                t.inventory.some(i => i.warmth),
                t.inventory.some(i => i.purifies),
            ].filter(Boolean).length;
            if (kit >= ACHIEVEMENT_BARS.fullKitSlots) t.fullKitSeen = true;
        }
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
        // §11.1: how long the act has been running. Counted on the performer,
        // reset the moment the performance drops.
        t.performingStreak = t.displayedRegard && Object.keys(t.displayedRegard).length > 0
            ? (t.performingStreak ?? 0) + 1
            : 0;
        // §10.1: 'The Long Con' reads the high-water mark, not the live streak.
        t.maxPerformingStreak = Math.max(t.maxPerformingStreak ?? 0, t.performingStreak);
        // AUDIT-6 §11.2: and the run keeps its own, so the entry survives the
        // performer not being the one who wins.
        ctx.state.longestPerformance = Math.max(ctx.state.longestPerformance ?? 0, t.performingStreak);
        // §11: cycles holding a named role in their group, for 'Quartermaster'.
        const roles = t.allianceId ? allianceRecords(ctx.state)[t.allianceId]?.roles : undefined;
        if (roles && Object.values(roles).includes(t.id)) t.roleCycles = (t.roleCycles ?? 0) + 1;
        clampTribute(t);
    });

    // §6.8: the book reprices once a day — a snapshot the betting layer (and
    // any cash-out) can read as "the price when the day closed".
    if (time === 'day') {
        const board = getAlive(ctx.state);
        ctx.state.oddsHistory = ctx.state.oddsHistory ?? {};
        ctx.state.oddsHistory[ctx.state.day] = Object.fromEntries(
            board.map(t => [t.id, tributeOdds(t, ctx.state.tributes).pct]));
    }

    processSponsors(ctx);
    /*
     * AUDIT-9 stage C §4: the parachute comes down in the zone it was sent to,
     * in the same cycle, and whoever is standing in that zone opens it.
     *
     * Resolved here rather than a cycle later on purpose. A full cycle of
     * delay meant the addressee had usually walked off before their own gift
     * arrived — 42% of parachutes were taken by somebody else, which is not a
     * dramatic arena, it is a broken postal service. Landing it now means
     * interception happens for the reason it should: they were not alone when
     * their sponsors came through.
     */
    resolveParachutes(ctx);

    // The anthem closes the night. Every tribute learns exactly who died today,
    // wherever they were standing when it happened — which is the single most
    // recognisable rhythm the source material has, and the moment a tribute
    // finds out whether the person they were travelling with is still alive.
    if (time === 'night') soundTheAnthem(ctx);
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
    // A silent-arena year, or an arena whose own law is noCannons: no
    // anthem, no faces, and nobody finds out who is left except by walking
    // into them.
    if (arenaIsSilent(ctx.state)) return;

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
        /**
         * Audit 4 §3.2: this was `sanityPerNamedLoss * lost.length`, unbounded,
         * and it is the single largest sanity event in the game — a bloodbath
         * night that names four people a tribute was counting on took 24 in one
         * step, straight past the whole pressure gauge in `applySanityPressure`.
         *
         * It also fell hardest on exactly the tributes the social layer exists
         * to produce: the more bonds somebody has formed, the more names in the
         * sky are theirs. Playing the game well was the fastest route to the
         * bottom band.
         *
         * A second name is worse than one and a fourth is not four times the
         * first. Capped, so a bad night is a bad night rather than a cliff.
         */
        const grief = Math.min(ANTHEM.maxSanityPerAnthem, ANTHEM.sanityPerNamedLoss * lost.length);
        loseSanity(t, grief);
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
 * 'The Bounty Quell': names (or renames) the quarry. Retargets on a fixed
 * schedule, or immediately once the current quarry is dead — killTribute
 * (combat.ts) pays out the standing sponsor bonus; this just keeps a live
 * target named at all times.
 */
function maintainBounty(ctx: SimContext) {
    if (!wildcardIs(ctx.state, 'quell-bounty-rotating')) return;
    const alive = getAlive(ctx.state);
    if (alive.length === 0) return;
    const cycle = cycleOf(ctx.state);
    const current = ctx.state.quellBounty;
    const currentStillAlive = current && alive.some(t => t.id === current.targetId);
    const stale = !current || cycle - current.namedCycle >= QUELL_MECHANICS.bountyRetargetEveryCycles;
    if (currentStillAlive && !stale) return;

    const target = ctx.rng.pick(alive);
    ctx.state.quellBounty = { targetId: target.id, namedCycle: cycle };
    ctx.logEvent(
        `THE CAPITOL: a bounty is named. ${target.name} is the quarry now — whoever collects it eats well for the rest of the Games.`,
        [target.id],
        { important: true, category: 'sponsor' }
    );
}

/**
 * 'The Moving Arena': the arena will not be the same arena on the last day
 * as it was on the first. Two zones swap terrain, danger and resources —
 * not their name or adjacency — so a memorized route goes stale without the
 * map itself changing shape. Relies on `Arena.zones` being this run's own
 * array (gameStore.ts deep-clones it precisely so this is safe to mutate).
 */
function maintainMovingArena(ctx: SimContext) {
    if (!wildcardIs(ctx.state, 'quell-moving-arena')) return;
    const cycle = cycleOf(ctx.state);
    if (cycle % QUELL_MECHANICS.movingArenaEveryCycles !== 0) return;
    const collapsed = ctx.state.collapsedZones ?? [];
    const cornucopia = ctx.state.arena.zones[0]?.name;
    const candidates = ctx.state.arena.zones.filter(z => z.name !== cornucopia && !collapsed.includes(z.name));
    if (candidates.length < 2) return;

    const [a, b] = ctx.rng.shuffle(candidates).slice(0, 2);
    const swap = { terrain: a.terrain, danger: a.danger, resources: a.resources };
    a.terrain = b.terrain; a.danger = b.danger; a.resources = b.resources;
    b.terrain = swap.terrain; b.danger = swap.danger; b.resources = swap.resources;
    ctx.logEvent(
        `THE ARENA: ${a.name} and ${b.name} are not what they were yesterday. The ground itself has moved.`,
        [],
        { important: true, category: 'arena' }
    );
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
    // §10.5: two more endgame shapes beyond wall and ring — a spiral rotating
    // in around the Cornucopia, and a split that takes one half of the arena
    // before it starts on the half the horn stands in.
    const pattern = patternRng.pick(['scattered', 'wall', 'ring', 'spiral', 'split'] as const);

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

    if (pattern === 'split') {
        // The arena severed into halves: every zone is assigned to whichever
        // pole it sits nearer — the far pole (the edge furthest from the
        // horn) or the Cornucopia itself. The far half is eaten first, then
        // the collapse crosses the divide and works inward on the rest.
        const fromCornucopia = bfsDistances(allZoneNames[0]);
        const farPole = [...fromCornucopia.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? allZoneNames[0];
        const fromFar = bfsDistances(farPole);
        const farHalf = allZoneNames.filter(n =>
            (fromFar.get(n) ?? Infinity) < (fromCornucopia.get(n) ?? Infinity));
        const nearHalf = allZoneNames.filter(n => !farHalf.includes(n));
        return [
            ...farHalf.sort((a, b) => (fromFar.get(a) ?? 0) - (fromFar.get(b) ?? 0)),
            ...nearHalf.sort((a, b) => (fromCornucopia.get(b) ?? 0) - (fromCornucopia.get(a) ?? 0)),
        ];
    }

    // Ring and spiral both work outside-in over the same BFS rings.
    const distances = bfsDistances(allZoneNames[0]);
    const outsideIn = [...allZoneNames].sort((a, b) => (distances.get(b) ?? 0) - (distances.get(a) ?? 0));
    if (pattern === 'ring') return outsideIn;

    // Spiral: the collapse rotates around the Cornucopia — within each ring
    // the failing zone chains along adjacency from wherever the last one
    // fell, so the border reads as a sweep rather than a whole ring at once.
    const spiralOrder: string[] = [];
    const rings = new Map<number, string[]>();
    outsideIn.forEach(n => {
        const d = distances.get(n) ?? 0;
        rings.set(d, [...(rings.get(d) ?? []), n]);
    });
    let previous: string | undefined;
    [...rings.keys()].sort((a, b) => b - a).forEach(d => {
        const remaining = new Set(rings.get(d)!);
        while (remaining.size > 0) {
            const prevZone = previous ? getZone(ctx.state.arena, previous) : undefined;
            const next = [...remaining].find(n => prevZone?.adjacent.includes(n)) ?? [...remaining][0];
            spiralOrder.push(next);
            remaining.delete(next);
            previous = next;
        }
    });
    return spiralOrder;
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
    const shift = escalationShift(ctx.state);
    const bored = ctx.state.day >= ESCALATION.boredomEarliestDay + Math.max(0, shift)
        && interest < threshold;
    // §5 `shrinkingArena`: an arena built to close from the first morning.
    // Declarable as a law rather than only reachable by a bored Gamemaker.
    const alwaysClosing = arenaHasLaw(ctx.state, 'shrinkingArena');
    const scheduled = alwaysClosing || ctx.state.day >= ESCALATION.startDay + shift;
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
 * §1 `tidalBorders`: the map re-cut every night.
 *
 * A third of the arena's edges are severed and everything the last tide took
 * is given back, so a route scouted in daylight is a different question after
 * dark and a dead end may not stay one. The set is drawn from `(seed, day)`,
 * which keeps it replayable, and a zone is never cut off entirely — a sector
 * nobody can reach with somebody standing in it is a tribute removed from
 * their own Games.
 *
 * The one enforcement site for the law.
 */
function runTidalBorders(ctx: SimContext, time: 'day' | 'night') {
    if (time !== 'night' || !arenaHasLaw(ctx.state, 'tidalBorders')) return;

    // Everything the last tide took comes back first.
    const zones = ctx.state.arena.zones;
    zones.forEach(z => z.adjacent.forEach(n => restoreEdge(ctx.state, z.name, n)));

    const rng = new RNG(`${ctx.state.seed}-tide-${ctx.state.day}`);
    const edges: Array<[string, string]> = [];
    zones.forEach(z => z.adjacent.forEach(n => {
        if (z.name < n) edges.push([z.name, n]);
    }));
    const wanted = Math.floor(edges.length * ARENA_LAWS.tidalSeverShare);
    // Track the degree left to each zone as the tide takes edges, so the last
    // route into a sector is never the one that goes.
    const degree = new Map<string, number>();
    zones.forEach(z => degree.set(z.name, z.adjacent.length));
    const cut: string[] = [];
    rng.shuffle(edges).forEach(([a, b]) => {
        if (cut.length >= wanted) return;
        if ((degree.get(a) ?? 0) <= 1 || (degree.get(b) ?? 0) <= 1) return;
        severEdge(ctx.state, a, b);
        degree.set(a, (degree.get(a) ?? 1) - 1);
        degree.set(b, (degree.get(b) ?? 1) - 1);
        cut.push(`${a} to ${b}`);
    });
    if (cut.length === 0) return;
    ctx.logEvent(
        `The tide turns. These routes are closed until morning: ${cut.join('; ')}.`,
        [],
        { important: true, category: 'arena' },
    );
}

/**
 * §1 `meltingGround`: whatever a sector had, it has less of once somebody has
 * been through it, and it does not come back.
 *
 * `depleteZone` is the existing mechanism and the recovery pass is what makes
 * it temporary everywhere else; this simply adds depletion for occupancy and
 * never removes it. The map therefore degrades from wherever the traffic is,
 * which drives the field outward and then together without the border moving
 * at all. The one enforcement site for the law.
 */
function runMeltingGround(ctx: SimContext) {
    if (!arenaHasLaw(ctx.state, 'meltingGround')) return;
    const occupied = new Set(getAlive(ctx.state).map(t => t.zone));
    occupied.forEach(zone => depleteZone(ctx.state, zone, ARENA_LAWS.meltingDepletionPerCycle));
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
    const horn = pickFinaleZone(ctx, active);
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
        // §18 (requests): the lovers' exemption exists so the nightlock
        // standoff stays reachable. With one victor guaranteed there is no
        // standoff to reach, so the alliance is revoked for them too.
        && (ctx.state.config.singleVictor || !areLovers(alive[0], alive[1]))) {
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
 * §10.5: where the Gamemakers convene the finale. Usually the Cornucopia —
 * but some years the last fight is staged at the arena's own landmark
 * instead: the law zone the whole run has orbited, or the high ground.
 * Rolled once per run from the seed, so the choice is stable cycle to cycle.
 */
function pickFinaleZone(ctx: SimContext, active: string[]): string {
    const horn = active.includes(ctx.state.arena.zones[0].name)
        ? ctx.state.arena.zones[0].name
        : active[active.length - 1] ?? ctx.state.arena.zones[0].name;
    if (!new RNG(`${ctx.state.seed}-finale-stage`).chance(ESCALATION.altFinaleChance)) return horn;
    const law = ctx.state.arena.lawZone;
    if (law && active.includes(law) && law !== horn) return law;
    const high = ctx.state.arena.zones.find(z =>
        active.includes(z.name) && z.name !== horn && zoneFeatures(z).elevation);
    return high?.name ?? horn;
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
            isHostileTo(t, o)
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

/**
 * §6.3: daytime smoke. A fire by daylight is not a glow but a column, and a
 * column is a signal — less certain than the night's beacon, but read by the
 * same neighbouring zones.
 */
function revealSmoke(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    const severed = severedEdgeSet(ctx.state);

    alive.forEach(t => {
        if (!hasCamp(ctx, t, 'fire')) return;
        const zone = getZone(ctx.state.arena, t.zone);
        if (!zone) return;

        const watchers = alive.filter(o =>
            isHostileTo(t, o)
            && zone.adjacent.includes(o.zone)
            && !severed.has(edgeKey(t.zone, o.zone))
            && ctx.rng.chance(CRAFTING.smokeRevealChance));
        if (watchers.length === 0) return;

        watchers.forEach(o => {
            noteSighting(ctx.state, o, t.zone, 1, depletionOf(ctx.state, t.zone));
        });
        ctx.logEvent(
            `A column of smoke stands up over ${t.zone}. ${watchers.map(w => w.name).join(', ')} read${watchers.length === 1 ? 's' : ''} it for exactly what it is.`,
            [t.id, ...watchers.map(w => w.id)],
            { zone: t.zone, category: 'survival' }
        );
    });
}

/**
 * §11.4: the stealth mistake, made audible. A tribute far enough gone makes
 * noise in the dark — and everyone within a zone of them learns where they
 * are, which is the cap turned into a mechanic.
 */
function revealNoisyBreakdowns(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    if (!ctx.state.config.enableSanity) return;
    // §(requests 2): the noisy-breakdown layer is its own switch now.
    if (ctx.state.config.enableBreakdowns === false) return;
    const severed = severedEdgeSet(ctx.state);

    alive.forEach(t => {
        const frayed = t.vitals.sanity < SANITY_BANDS.noisyNightSanity || (t.sanityStealthLoss ?? 0) > 0;
        if (!frayed || !ctx.rng.chance(SANITY_BANDS.noisyNightChance)) return;
        const zone = getZone(ctx.state.arena, t.zone);
        if (!zone) return;

        const hearers = alive.filter(o =>
            isHostileTo(t, o)
            && (o.zone === t.zone || (zone.adjacent.includes(o.zone) && !severed.has(edgeKey(t.zone, o.zone)))));
        if (hearers.length === 0) return;

        hearers.forEach(o => {
            noteSighting(ctx.state, o, t.zone, Math.max(1, o.zone === t.zone ? 1 : 0), depletionOf(ctx.state, t.zone));
        });
        ctx.logEvent(
            `Something in ${t.name} slips in the dark — a cry, a dropped pot, a fire fed too high in ${t.zone}. ${hearers.map(h => h.name).join(', ')} hear${hearers.length === 1 ? 's' : ''} every second of it.`,
            [t.id, ...hearers.map(h => h.id)],
            { important: true, zone: t.zone, category: 'sanity' }
        );
    });
}

/**
 * The camps meeting the arena. A fire left burning in dry terrain can escape
 * into the zone-effect system; a weather front over a camouflaged tribute
 * scrubs the work off early.
 */
function tickCampConsequences(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    // Same dryness read the fire-spread arithmetic uses: a hot climate is one
    // that multiplies thirst.
    const climate = climateOf(ctx.state.arena.id);
    const hotClimate = (climate?.drains?.thirstMultiplier ?? 1) > 1;

    alive.forEach(t => {
        const zone = getZone(ctx.state.arena, t.zone);
        if (!zone) return;

        // §6.3: the campfire that gets away.
        if (hasCamp(ctx, t, 'fire')
            && (ZONE_EFFECTS.flammableTerrain as readonly string[]).includes(zone.terrain)
            && !hasEffect(ctx.state, t.zone, 'burning')
            && ctx.rng.chance(CRAFTING.fireEscapeChance * (hotClimate ? CRAFTING.fireEscapeDryMultiplier : 1))) {
            ctx.logEvent(
                `${t.name}'s campfire finds the dry ground of ${t.zone} and stops being anybody's campfire.`,
                [t.id],
                { important: true, zone: t.zone, category: 'hazard' }
            );
            startZoneEffect(ctx, t.zone, 'burning');
            // §12: their campfire, their wildfire.
            noteEffectCaused(t);
        }

        // §6.5: rain and camouflage do not coexist.
        if (ctx.state.weatherFront?.zone === t.zone
            && ctx.state.camps?.[t.id]?.camouflage !== undefined
            && hasCamp(ctx, t, 'camouflage')
            && ctx.rng.chance(CRAFTING.camouflageRainWashChance)) {
            delete ctx.state.camps[t.id].camouflage;
            ctx.logEvent(
                `The weather over ${t.zone} takes ${t.name}'s camouflage off them in streaks. The shape of a person comes back.`,
                [t.id],
                { category: 'survival' }
            );
        }
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
    // 'The Long Games': the border will not move this year, whatever else
    // happens inside it. Starvation, infection and attrition decide it instead.
    if (wildcardIs(ctx.state, 'quell-long-games')) return false;
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

    let collapsedList = collapseOrder.slice(0, thisCount);

    /**
     * §11 (requests, second pass): the forced finale closes the arena for
     * real, not only in the announcement.
     *
     * `forceFinale` already says this from the sky — "every route that is not
     * toward {horn} closes behind whoever walks it" — and then left the border
     * on its ordinary day-counted schedule, so the last two were herded by an
     * objective they could decline and nothing else. Measured across 400 runs:
     * the finalists were standing in the finale zone for 30.7% of the cycles
     * they were being herded through, the forced-finale branch fired in 97 of
     * 361 final-two runs, and in none of the runs whose victor finished with
     * no kills did the two of them ever meet.
     *
     * So the wall does what the announcement said. Everywhere that is not the
     * finale zone goes out of bounds, and the relocation below puts both of
     * them in the only place left — `nearestSafeZone` walks the adjacency
     * graph and falls back to the single safe name, so a severed arena cannot
     * strand either of them. They are not teleported into a fight: they arrive
     * in the same zone and the encounter layer resolves it, which is the same
     * order of events as any other meeting.
     *
     * The finalist damage cap above (`finalistCollapseDamage`, itself clamped
     * to `health - 1`) is what keeps this from being the border deciding the
     * Games — the wall bloodies them into the room and never lands the last
     * blow.
     */
    const forcedFinale = ctx.state.finaleZone !== undefined
        && (ctx.state.finalistCycles ?? 0) >= ESCALATION.finaleAfterFinalistCycles;
    if (forcedFinale) {
        const stage = ctx.state.finaleZone!;
        collapsedList = allZoneNames.filter(z => z !== stage);
    }
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

        // §7.1: at the arena's own edge, the closing border is the force
        // field itself — the death reads as the wall, not abstract collapse.
        // §7: a chokepoint is a different death from an open field. A pass, a
        // bridge or a tunnel closing with somebody inside it does not herd
        // them anywhere — there is nowhere for the walls to herd them to.
        const zone = getZone(ctx.state.arena, trappedZone);
        const inAChokepoint = zone !== undefined && zoneFeatures(zone).chokepoint === true;
        const cause = hasForceField(ctx.state.arena, trappedZone)
            ? `Driven into the force field as the border closed over ${trappedZone}`
            : inAChokepoint
                ? `Crushed as ${trappedZone} closed`
                : `Caught in the collapsing border of ${trappedZone}`;
        // The crush *replaces* the open-ground collapse rather than preceding
        // it. A survivor used to take the multiplied crush and then the full
        // base damage again under the same cause — so the multiplier was really
        // 1 + itself — and then read the generic "pushed along in front of it"
        // line immediately after a line insisting there is no such version.
        if (inAChokepoint && !finalists) {
            applyDamage(ctx, t, Math.round(damage * ESCALATION.chokepointCrushMultiplier), { cause, kind: 'arena', code: 'border' });
            openWound(t, BLEEDING.hazardSeverity);
            ctx.logEvent(
                `${trappedZone} is not somewhere anybody rides out a collapse. The walls of it come together with ${t.name} still inside, `
                + 'and there is no version of that where they simply get pushed along in front of it.',
                [t.id],
                { important: true, zone: trappedZone, category: 'hazard' }
            );
            clampTribute(t);
        } else {
            applyDamage(ctx, t, damage, { cause, kind: 'arena', code: 'border' });
            ctx.logEvent(
                fill(ctx.pickText(BORDER_TEXTS.collapse), {
                    tribute: t.name, trapped: trappedZone, damage: String(damage), safe: newSafeZone,
                }),
                [t.id],
                { important: true, zone: newSafeZone, category: 'hazard' }
            );
        }
        t.zone = newSafeZone;
        enterVerticalZone(ctx.state.arena, t);
        addZoneThreat(ctx.state, t, trappedZone, MEMORY.deathThreat);
        checkDeath(ctx, t, cause);
    });

    return true;
}

/** Field-expedient weapons from whatever is in the pack. */
function craft(ctx: SimContext, t: Tribute) {
    // Improvising a weapon is a morning's work with a knife, not something
    // that happens for free on the way past. A tribute who has spent the day
    // crossing a river has not also lashed a spear together.
    if (!canAfford(t, ACTION_BUDGET.craftHours)) return;
    const hasRope = t.inventory.findIndex(i => i.id === 'rope');
    const hasKnife = t.inventory.findIndex(i => i.id === 'knife');
    if (hasRope >= 0 && hasKnife >= 0 && !t.inventory.some(i => i.id === 'spear')) {
        t.inventory.splice(Math.max(hasRope, hasKnife), 1);
        t.inventory.splice(Math.min(hasRope, hasKnife), 1);
        const spear = ITEMS.find(i => i.id === 'spear')!;
        giveItem(t, mintItem(ctx.rng, spear, QUALITY_BIAS.improvised));
        ctx.logEvent(`${t.name} lashes a knife to a shaft with rope and walks away holding a Spear.`, [t.id], { category: 'loot' });
    }

    // Anyone holding nothing at all will make something. A tribute with empty
    // hands is a tribute who will never willingly fight, and only a third of the
    // cast was ever armed — the Cornucopia and the feast simply do not put
    // enough steel into circulation to go round.
    if (!t.inventory.some(i => i.type === 'weapon') && ctx.rng.chance(CRAFTING.improviseChance)) {
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
                { type: 'hunt-or-craft', category: 'loot' }
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
            // Minted, like every other weapon the game hands out. A plain
            // spread shares one object shape and skips the quality roll, so the
            // four terrain-driven improvisations — the common case, since most
            // tributes are standing on ground rather than holding rope — could
            // never carry durability, never accumulate `bloodDrawn`, and so
            // could never earn a name. A sling could; a club could not.
            giveItem(t, mintItem(ctx.rng, recipe, QUALITY_BIAS.improvised));
            ctx.logEvent(
                fill(ctx.pickText(pool), { tribute: t.name, zone: t.zone }),
                [t.id],
                { type: 'hunt-or-craft', category: 'loot' }
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
            giveItem(t, mintItem(ctx.rng, garrote, QUALITY_BIAS.improvised));
            ctx.logEvent(`${t.name} twists a length of wire into a garrote and tests it on a branch.`, [t.id], { category: 'loot' });
        }
    }
}

/** Alliances move as a unit; everyone else moves for themselves. */
// Hiding is the one stance that should hold position — a reduced chance to
// slip away quietly, not the guaranteed, silent teleport it used to be.
function wanderChanceFor(ctx: SimContext, t: Tribute): number {
    let chance = isEvasiveStance(t.stance) ? ENCOUNTERS.wanderChance * 0.4 : ENCOUNTERS.wanderChance;
    // Night travel is rarer, unless the tribute is built for it.
    if (ctx.state.timeOfDay !== 'day') {
        const buyback = Math.min(1, traitMod(t, 'nightMovement') * ENCOUNTERS.nightMovementPerPoint);
        chance *= ENCOUNTERS.nightWanderMultiplier + (1 - ENCOUNTERS.nightWanderMultiplier) * buyback;
    }
    return chance;
}

/**
 * §5.3: routes a decided move through its traversal cost.
 *
 * Three outcomes, not two. This returned a boolean when there were only two
 * things that could happen — arrived, or started a crossing — and one caller
 * relied on `false` meaning "there is now a `t.transit` to copy onto the rest
 * of the group" (`{ ...t.transit! }`, non-null assertion and all). Adding a
 * third outcome to the boolean made that spread `{...undefined}`, which is
 * `{}`, which is a transit to `undefined` — and the group-arrival filter then
 * matched two of those against each other and read `.remaining` off a tribute
 * who was never crossing anything. A named outcome cannot be misread that way.
 */
type MoveOutcome =
    /** Arrived this cycle. */
    | 'arrived'
    /** A multi-cycle crossing has begun; `t.transit` is set. */
    | 'crossing'
    /** AUDIT-9 stage C: no hours left to spend on going anywhere. */
    | 'no-time';

function beginMove(ctx: SimContext, t: Tribute, destName: string): MoveOutcome {
    const dest = getZone(ctx.state.arena, destName);
    /*
     * AUDIT-9 stage C §3: walking somewhere is the expensive thing a day
     * holds, and this is where it stops being free.
     *
     * Charged before the crossing starts rather than per leg, because the
     * decision being priced is "I am spending today going there" — a tribute
     * who commits to a two-cycle crossing has spent this cycle on it whether
     * or not they arrive. What they cannot then do is spend the same hours
     * building a shelter at the far end.
     *
     * A tribute with no hours left does not travel. They are not frozen: they
     * still eat, bleed, are found and fight, because none of those are things
     * they chose to spend a day on.
     */
    if (crossingsLeft(t) <= 0) return 'no-time';
    if (!spend(t, travelHoursFor(t))) return 'no-time';
    noteCrossing(t);
    // §11.6: a tolled edge's `timeCost` is extra cycles spent on the crossing
    // itself, on top of whatever the destination terrain already costs.
    const cost = (dest ? travelCost(t, dest) : 1) + edgeTimeCost(ctx.state, t.zone, destName);
    applyEdgeToll(ctx, t, t.zone, destName);
    // A1: Fortified is a commitment to *ground*. Pulling up a prepared
    // position and carrying it somewhere else costs double the fatigue —
    // which is the price that makes digging in a real decision rather than a
    // free bonus.
    if (t.stance === 'Fortified') {
        t.vitals.fatigue = Math.min(100,
            t.vitals.fatigue + MOVEMENT.baseMoveFatigue * STANCE_MODES.fortified.moveFatigueMultiplier);
    }
    // §8.9: a crossing into open water is a swim, whatever else it is.
    if (dest?.terrain === 'water') {
        t.waterCrossings = (t.waterCrossings ?? 0) + 1;
        if (t.waterCrossings >= EARNED_TRAIT_RULES.waterbornCrossings) earnTrait(ctx, t, 'Waterborn');
    }
    if (cost <= 1) return 'arrived';
    t.transit = { to: destName, remaining: cost - 1 };
    ctx.logEvent(
        dest?.terrain === 'highland'
            ? `${t.name} starts the long climb toward ${destName}. It will not be done by nightfall.`
            : `${t.name} wades into the crossing toward ${destName}. This is going to take everything the day has left.`,
        [t.id],
        { category: 'travel' }
    );
    return 'crossing';
}

function move(ctx: SimContext, t: Tribute, currentAlive: Tribute[], collapsed: string[], flavor: ReturnType<typeof arenaFlavor>, severed: Set<string>, crossed: Set<string>, time: 'day' | 'night') {
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
            /*
             * AUDIT-9 stage C §3: the *continuing* legs cost the day too.
             *
             * `beginMove` charged the hours that start a crossing and nothing
             * charged the ones that finish it, so day two of a three-day ford
             * came with a full budget: the scenario "a tribute in transit is
             * not also building things" caught 23 of 44 mid-crossing tributes
             * with an unspent day. Spending the hours here is what makes a
             * long crossing cost what it says it costs.
             */
            spend(t, travelHoursFor(t));
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

            const destZone = getZone(ctx.state.arena, dest);
            arriving.forEach(m => {
                delete m.transit;
                m.zone = dest;
                enterVerticalZone(ctx.state.arena, m);
                m.vitals.fatigue = Math.min(100, m.vitals.fatigue + MOVEMENT.crossingFatigue);
                crossed.add(m.id);
                // §7 (audit): the last stretch of a crossing, spent. Swimming
                // and the water trait are the defence; nothing else is.
                if (destZone?.terrain === 'water' && m.vitals.fatigue >= MOVEMENT.drowningFatigue && traitMod(m, 'water') <= 0) {
                    const chance = Math.max(0, MOVEMENT.drowningChance - profOf(m, 'swimming') * MOVEMENT.drowningSwimmingProtection);
                    if (ctx.rng.chance(chance)) {
                        const cause = `Drowned crossing to ${dest}`;
                        applyDamage(ctx, m, MOVEMENT.drowningDamage, { cause, kind: 'hazard', code: 'drowning' });
                        ctx.logEvent(
                            m.health <= 0
                                ? `${m.name} goes under a body-length from the bank of ${dest} and does not come up. There was nothing left in their arms.`
                                : `${m.name} goes under a body-length from the bank of ${dest}, and comes up, and comes up again, and gets a hand on the shore with nothing left in their arms.`,
                            [m.id],
                            { important: true, zone: dest, category: 'hazard' }
                        );
                        clampTribute(m);
                        checkDeath(ctx, m, cause);
                    }
                }
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
            // §5.5: the leader is the one doing the navigating, so hidden ways
            // they know are open to the whole group and ways they do not are not.
            const options = reachableZones(ctx.state.arena, t.zone, collapsed, severed, time, { state: ctx.state, tribute: t });
            if (options.length === 0) return;

            // The group follows whatever its leader has decided to do; only when the
            // leader has no standing intention does the pack drift.
            if (objectiveHolds(t)) return;
            const led = objectiveStep(ctx, t, options);
            if (!led && !ctx.rng.chance(wanderChanceFor(ctx, t))) return;
            const newZone = (led ?? pickDestination(ctx, t, options)).name;
            if (t.zone === newZone) return;

            // Only members actually standing with the leader travel — anyone
            // separated by a border collapse or a feast pulls their own weight
            // back rather than being snapped across the map for free.
            const present = allianceMembers.filter(m => m.zone === t.zone);
            // §5.3: the group pays the leader's traversal cost together.
            const outcome = beginMove(ctx, t, newZone);
            if (outcome !== 'arrived') {
                // Only a real crossing is copied onto the group. Out of hours,
                // the group simply stays where it is.
                if (outcome === 'crossing') {
                    present.forEach(m => {
                        if (m.id === t.id) return;
                        m.transit = { ...t.transit! };
                        // The group pays the leader's crossing each, not once
                        // between them: everybody walking it is walking it.
                        spend(m, travelHoursFor(m));
                    });
                }
                return;
            }
            const departed = t.zone;
            present.forEach(m => { m.zone = newZone; enterVerticalZone(ctx.state.arena, m); });
            noteTraffic(ctx.state, departed, newZone, present.length);
            if (isEvasiveStance(t.stance)) {
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

    const options = reachableZones(ctx.state.arena, t.zone, collapsed, severed, time, { state: ctx.state, tribute: t });
    if (options.length === 0) return;

    // A tribute who has decided to be somewhere goes there, by the shortest
    // route over the adjacency graph, and does so whether or not the wander
    // roll would have moved them. Deciding is not the same as drifting.
    if (objectiveHolds(t)) return;
    const step = objectiveStep(ctx, t, options);
    if (step && step.name !== t.zone) {
        if (beginMove(ctx, t, step.name) !== 'arrived') return;
        const from = t.zone;
        t.zone = step.name;
        enterVerticalZone(ctx.state.arena, t);
        noteTraffic(ctx.state, from, step.name);
        ctx.logEvent(
            `${t.name} leaves ${from} for ${step.name} — ${objectiveLabel(ctx.state, t).toLowerCase()}.`,
            [t.id],
            { zone: step.name, category: 'travel' }
        );
        // A1: a hunter covers two zones a cycle. Somebody working a named
        // target closes ground faster than somebody drifting, which is most of
        // what makes Hunting frightening to be the subject of.
        if (t.stance === 'Hunting' && !t.transit) {
            const onward = reachableZones(ctx.state.arena, t.zone, collapsed, severed, time, { state: ctx.state, tribute: t });
            const second = objectiveStep(ctx, t, onward);
            if (second && second.name !== t.zone && beginMove(ctx, t, second.name) === 'arrived') {
                const midpoint = t.zone;
                t.zone = second.name;
                enterVerticalZone(ctx.state.arena, t);
                noteTraffic(ctx.state, midpoint, second.name);
                ctx.logEvent(
                    `${t.name} does not stop in ${midpoint} — they are through it and into ${second.name} inside the hour.`,
                    [t.id],
                    { zone: second.name, category: 'travel' }
                );
            }
        }
        return;
    }

    if (!ctx.rng.chance(wanderChanceFor(ctx, t))) return;
    const newZone = pickDestination(ctx, t, options).name;
    if (t.zone === newZone) return;
    if (beginMove(ctx, t, newZone) !== 'arrived') return;

    const oldZone = t.zone;
    t.zone = newZone;
    // §5.1: you arrive at the rim of a shaft, not at the bottom of it. Every
    // other site that moves a tribute does this too — arriving with the level
    // you happened to hold in the zone behind you put a purposeful traveller at
    // the bottom of a shaft for free, and `samePlace` gates both sighting and
    // encounters, so they could be structurally unmeetable in a zone they
    // walked into on purpose.
    enterVerticalZone(ctx.state.arena, t);
    noteTraffic(ctx.state, oldZone, newZone);
    if (isEvasiveStance(t.stance)) {
        ctx.logEvent(`${t.name} slips out of ${oldZone} without a sound.`, [t.id], { zone: newZone, category: 'travel' });
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
        // §9.1: the arena does not spring traps on, or send mutts after, a
        // tribute who is already down. Whoever is standing over them decides.
        if (acted.has(t.id) || t.status === 'dead' || isDowned(t)) return;

        const zone = getZone(ctx.state.arena, t.zone);

        /**
         * §11 (requests, second pass): once the Gamemakers have forced the
         * finale, a finalist standing where the other finalist is standing
         * meets them. Nothing gets to go first.
         *
         * `forceFinale` drains the arena to one zone and `resolveEncounter`
         * has had a branch since §7 that turns a final-two meeting into the
         * fight — but the meeting has to be reached, and three things above it
         * were reaching their own conclusions instead. A hazard roll (capped
         * at `ESCALATION.hazardCeiling`) and a mutt roll (the same ceiling)
         * each `return` after firing, so in the escalated endgame better than
         * half of a finalist's cycles were spent on the arena rather than on
         * the other finalist; and `isNoticed` still let one of them go to
         * ground in a sector the Gamemakers have just stripped of cover.
         *
         * Measured across 400 runs with the attrition grace, the finalist
         * opt-out and the finale round ceiling all closed: 361 runs reached a
         * final two and the forced-finale branch fired 59 times, none of them
         * in a run whose victor finished with no kills. The last fight was not
         * being called a draw. It was not being started.
         */
        const finaleNow = ctx.state.finaleZone !== undefined
            && (ctx.state.finalistCycles ?? 0) >= ESCALATION.finaleAfterFinalistCycles;
        const finaleOpponent = finaleNow
            ? shuffled.find(o => o.id !== t.id && o.status === 'alive' && !isDowned(o) && samePlace(ctx.state.arena, t, o))
            : undefined;

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

        if (!finaleOpponent && ctx.rng.chance(eventChance)) {
            // §7e: an arena that started a story last cycle finishes it.
            const arenaEvent = pendingChain(ctx, t, flavor.events)
                ?? pickTerrainEvent(ctx, flavor.events, zone?.terrain, t);
            /*
             * AUDIT-10 B15: the selector can now legitimately return nothing —
             * every authored event for this zone either needs something this
             * tribute does not have or has already had its one turn. That is
             * not an error and it is not a reason to fire an ineligible event;
             * the arena simply does not single this tribute out this cycle, and
             * they fall through to the rest of the cycle's ordinary business.
             */
            if (arenaEvent) {
                applyArenaEvent(ctx, t, arenaEvent);
                acted.add(t.id);
                return;
            }
        }

        if (!finaleOpponent && ctx.rng.chance(muttChance)) {
            resolveMuttAttack(ctx, t, time);
            acted.add(t.id);
            return;
        }

        // Only encounter others in the SAME ZONE — and only those who actually
        // notice each other. A tribute who has gone to ground in heavy cover is
        // simply not found this cycle, which is what stealth buys them.
        const inZone = shuffled.filter(o => o.id !== t.id && !acted.has(o.id) && o.status === 'alive' && samePlace(ctx.state.arena, t, o));
        const alliesOf = (o: Tribute) => inZone.filter(x => x.allianceId !== undefined && x.allianceId === o.allianceId).length;
        // In a forced finale the notice roll is skipped for the same reason
        // the hazard rolls above are: there is no cover left to be missed in.
        const others = finaleOpponent
            ? inZone
            : inZone.filter(o =>
                isNoticed(ctx, o, t, zone, alliesOf(o)) || isNoticed(ctx, t, o, zone, alliesOf(t)));

        if (others.length < inZone.length && ctx.rng.chance(ENCOUNTERS.nearMissLineChance)) {
            const missed = inZone.filter(o => !others.includes(o));
            ctx.logEvent(
                fill(ctx.pickText(ENCOUNTER_TEXTS.unnoticed), { t1: t.name, t2: missed[0].name, zone: t.zone }),
                [t.id, missed[0].id],
                { type: 'hidden-moments', category: 'survival' }
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
        // §11 (requests): and the convergence does the same thing one stage
        // earlier. Once the arena has been closed to one sector, two tributes
        // standing in it have run out of arena to drift apart into.
        const meetChance = ctx.state.finaleZone
            ? 1
            : ctx.state.convergenceZone
                ? ESCALATION.convergeEncounterChance
                : isAggressiveStance(t.stance)
                    ? Math.min(0.95, ENCOUNTERS.meetChance * HUNTING.meetChanceMultiplier)
                    : ENCOUNTERS.meetChance;

        if (ctx.rng.chance(meetChance)) {
            // Three or more free bodies in one zone is a group problem.
            const hostilePresent = others.filter(o => o.allianceId === undefined || o.allianceId !== t.allianceId);
            if (others.length >= 2 && hostilePresent.length >= 1 && ctx.rng.chance(ENCOUNTERS.groupFightChance)) {
                const party = [t, ...others].slice(0, ENCOUNTERS.maxBrawlSize);
                const anyAggressive = party.some(p => isAggressiveStance(p.stance));
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

/**
 * §12: 'Both Mourned' — two tributes who grieved the same death and are still
 * standing together afterwards.
 *
 * This has to be sampled during the run. Evaluated against the end state, as
 * it used to be, the only tribute left alive is the victor and every alliance
 * has dissolved, so the pairing it describes is structurally unobservable by
 * the time anybody asks.
 */
function tickSharedGrief(ctx: SimContext) {
    if (ctx.state.sharedGriefAllies) return;
    const allied = getAlive(ctx.state).filter(t => t.allianceId);
    for (let i = 0; i < allied.length; i++) {
        for (let j = i + 1; j < allied.length; j++) {
            const a = allied[i], b = allied[j];
            if (a.allianceId !== b.allianceId) continue;
            const mournedA = a.memory?.mourned ?? [];
            if (mournedA.length === 0) continue;
            if (!mournedA.some(id => (b.memory?.mourned ?? []).includes(id))) continue;
            // Grief alone is not the achievement — nearly every allied pair
            // has watched somebody die by the midgame, which is why simply
            // observing the pairing fired on 96.8% of runs. What it names is
            // an alliance that *held* through it, so the pair has to still be
            // together a few cycles later before it counts.
            const key = [a.id, b.id].join('|');
            const cycle = ctx.state.cycle ?? 0;
            const pending = ctx.state.sharedGriefPending;
            if (pending?.pair !== key) {
                ctx.state.sharedGriefPending = { pair: key, cycle };
            } else if (cycle - pending.cycle >= ACHIEVEMENT_BARS.sharedGriefCycles) {
                ctx.state.sharedGriefAllies = true;
            }
            return;
        }
    }
}
