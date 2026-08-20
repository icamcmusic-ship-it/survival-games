import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Tribute } from '../../models/types';
import { IMPROVISED_ITEMS, ITEMS } from '../../data/constants';
import { CRAFTING, ENCOUNTERS, ESCALATION, HUNTING, MEMORY, SPONSORS } from '../../data/balance';
import { AMBIENT_TEXTS, ENCOUNTER_TEXTS } from '../../data/flavorText';
import { arenaFlavor } from '../../data/arenaFlavor';
import { applyDamage, checkDeath, resolveGroupCombat } from '../combat';
import { processSponsors } from '../sponsors';
import { zoneNames, getZone, reachableZones, depletionOf, regenerateZones, nearestSafeZone } from '../map';
import { enforceCapacity, giveItem } from '../items';
import {
    addZoneThreat, advanceCycle, decayMemories, decayRelationships, noteSighting,
} from '../memory';
import { decayAllianceTrust, driftReputation, getRel } from '../relationships';
import { clampTribute } from '../vitals';
import { isNoticed } from '../stealth';
import { pickDestination } from '../movement';
import { objectiveHolds, objectiveLabel, objectiveStep, updateObjective } from '../objectives';
import { checkTraps, tickTraps } from '../fieldcraft';
import { decayFear } from '../fear';
import { updateStance } from '../stance';
import { processSpoilage, processVitals } from '../survival';
import {
    applyArenaEvent, fill, handleInsanity, idleAction, isBreakingDown,
    resolveMuttAttack, resolvePairEncounter,
} from '../encounters';

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
    advanceCycle(ctx.state);
    const alive = getAlive(ctx.state);
    // Counted once per day, so it freezes at whatever the tribute reached.
    if (time === 'day') alive.forEach(t => { t.daysSurvived = ctx.state.day; });

    const flavor = arenaFlavor(ctx.state.arena.id);

    // Occasional scene-setting line so the feed reads like a broadcast, not a spreadsheet.
    if (ctx.rng.chance(ENCOUNTERS.ambientLineChance)) {
        const pool = ctx.rng.chance(ENCOUNTERS.ambientArenaShare) ? flavor.ambient : AMBIENT_TEXTS;
        ctx.logEvent(ctx.pickText(pool), [], { category: 'arena' });
    }

    // 0. The arena shrinks from day 5 onward.
    const isEscalated = collapseBorders(ctx);
    const collapsed = ctx.state.collapsedZones || [];

    // 1-2. Spoilage, then vitals, exposure, wounds and supplies.
    processSpoilage(ctx);
    processVitals(ctx, time);

    // 3. Crafting, situational awareness, stance and movement.
    const currentAlive = getAlive(ctx.state);
    const acted = new Set<string>();
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

        move(ctx, t, currentAlive, collapsed, flavor);
        // Walking into a zone is what springs things left in it.
        checkTraps(ctx, t);
    });

    // 4. Hazards, mutts and everyone who runs into everyone else.
    resolveEncounters(ctx, currentAlive, acted, isEscalated, flavor);

    // 5. Cycle upkeep: the arena restocks, memories fade, bonds cool, the
    // crowd's attention wanders.
    regenerateZones(ctx.state);
    tickTraps(ctx);
    decayMemories(ctx.state);
    decayRelationships(ctx.state);
    decayAllianceTrust(ctx.state);
    decayFear(ctx.state);
    getAlive(ctx.state).forEach(t => {
        // Bloodlust cools. A kill on day 3 should not still be making someone
        // braver on day 8.
        if (t.momentum) t.momentum = Math.max(0, t.momentum - HUNTING.momentumDecayPerCycle);
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
}

/** Hazard escalation and safe-zone shrinking. Returns whether it is active. */
function collapseBorders(ctx: SimContext): boolean {
    if (ctx.state.day < ESCALATION.startDay) return false;

    const allZoneNames = zoneNames(ctx.state.arena);
    // Deterministic per-seed but not the same reverse-declaration-order every
    // run — otherwise every endgame in every run of an arena collapses toward
    // the same zone (always the Cornucopia) in the same order.
    const collapseOrder = new RNG(`${ctx.state.seed}-collapse`).shuffle(allZoneNames);
    const collapseCount = Math.min(collapseOrder.length - 1, ctx.state.day - (ESCALATION.startDay - 1));
    const collapsedList = collapseOrder.slice(0, collapseCount);
    ctx.state.collapsedZones = collapsedList;

    getAlive(ctx.state).forEach(t => {
        if (!collapsedList.includes(t.zone)) return;

        // The Gamemakers want a victor, not an empty arena: the border herds
        // the last survivors together rather than finishing them.
        const finalists = getAlive(ctx.state).length <= ESCALATION.finalistCount;
        const damage = finalists
            ? ESCALATION.finalistCollapseDamage
            : ESCALATION.collapseDamageBase + (ctx.state.day - ESCALATION.startDay) * ESCALATION.collapseDamagePerDay;
        const safeZones = allZoneNames.filter(z => !collapsedList.includes(z));
        // Nearest reachable safe zone via the adjacency graph, not an
        // arbitrary index — a tribute should not teleport across the arena.
        const newSafeZone = nearestSafeZone(ctx.state.arena, t.zone, safeZones);
        const trappedZone = t.zone;

        applyDamage(ctx, t, damage, {
            cause: `Caught in the collapsing border of ${trappedZone}`,
            kind: 'arena',
        });
        ctx.logEvent(
            `BORDER COLLAPSE: ${t.name} is caught inside the failing border of ${trappedZone}. They take ${damage} damage clawing their way into ${newSafeZone}.`,
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
        giveItem(t, { ...spear });
        ctx.logEvent(`${t.name} lashes a knife to a shaft with rope and walks away holding a Spear.`, [t.id], { category: 'loot' });
    }

    // Anyone holding nothing at all will make something. A tribute with empty
    // hands is a tribute who will never willingly fight, and only a third of the
    // cast was ever armed — the Cornucopia and the feast simply do not put
    // enough steel into circulation to go round.
    if (!t.inventory.some(i => i.type === 'weapon') && ctx.rng.chance(CRAFTING.improviseChance)) {
        const zone = getZone(ctx.state.arena, t.zone);
        // What the ground offers: timber in the woods, stone everywhere else.
        const wooded = zone?.terrain === 'forest' || zone?.terrain === 'wetland';
        const recipe = IMPROVISED_ITEMS.find(i => i.id === (wooded ? 'club' : 'sharpstone'))!;
        giveItem(t, { ...recipe });
        ctx.logEvent(
            wooded
                ? `${t.name} breaks a limb off a deadfall in ${t.zone} and works it into a cudgel.`
                : `${t.name} spends an hour in ${t.zone} knapping a stone into something with an edge.`,
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

function move(ctx: SimContext, t: Tribute, currentAlive: Tribute[], collapsed: string[], flavor: ReturnType<typeof arenaFlavor>) {
    if (t.allianceId) {
        const allianceMembers = currentAlive.filter(m => m.allianceId === t.allianceId && m.status === 'alive');
        const leader = allianceMembers[0];
        if (!leader || t.id !== leader.id) return;

        const options = reachableZones(ctx.state.arena, t.zone, collapsed);
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
        present.forEach(m => { m.zone = newZone; });
        if (t.stance === 'Evasive') {
            ctx.logEvent(`${present.map(m => m.name).join(', ')} slip out of ${t.zone} without a sound.`, present.map(m => m.id), { zone: newZone, category: 'travel' });
        } else {
            ctx.logEvent(
                `The alliance of ${present.map(m => m.name).join(', ')} moves out to ${newZone}.`,
                present.map(m => m.id),
                { zone: newZone, category: 'travel' }
            );
        }
        return;
    }

    const options = reachableZones(ctx.state.arena, t.zone, collapsed);
    if (options.length === 0) return;

    // A tribute who has decided to be somewhere goes there, by the shortest
    // route over the adjacency graph, and does so whether or not the wander
    // roll would have moved them. Deciding is not the same as drifting.
    if (objectiveHolds(t)) return;
    const step = objectiveStep(ctx, t, options);
    if (step && step.name !== t.zone) {
        const from = t.zone;
        t.zone = step.name;
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

    const oldZone = t.zone;
    t.zone = newZone;
    if (t.stance === 'Evasive') {
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
) {
    const shuffled = ctx.rng.shuffle(currentAlive);

    shuffled.forEach(t => {
        if (acted.has(t.id) || t.status === 'dead') return;

        const zone = getZone(ctx.state.arena, t.zone);
        const zoneDanger = zone ? 0.5 + zone.danger : 1; // 0.5x-1.5x from zone danger
        let eventChance = ENCOUNTERS.baseEventChance * zoneDanger;
        let muttChance = ENCOUNTERS.baseMuttChance * zoneDanger;
        if (isEscalated) {
            const multiplier = 1 + (ctx.state.day - ESCALATION.startDay) * ESCALATION.hazardMultiplierPerDay;
            eventChance = Math.min(ESCALATION.hazardCeiling, eventChance * multiplier);
            muttChance = Math.min(ESCALATION.hazardCeiling, muttChance * multiplier);
        }
        eventChance = Math.min(ENCOUNTERS.hazardCeiling, eventChance * ctx.state.config.hazardRate);
        muttChance = Math.min(ENCOUNTERS.hazardCeiling, muttChance * ctx.state.config.hazardRate);

        if (ctx.rng.chance(eventChance)) {
            applyArenaEvent(ctx, t, ctx.rng.pick(flavor.events));
            acted.add(t.id);
            return;
        }

        if (ctx.rng.chance(muttChance)) {
            resolveMuttAttack(ctx, t);
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

        if (others.length < inZone.length && ctx.rng.chance(0.25)) {
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
        const meetChance = t.stance === 'Aggressive'
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
            resolvePairEncounter(ctx, t, others[0]);
            acted.add(t.id);
            acted.add(others[0].id);
            return;
        }

        idleAction(ctx, t, flavor);
        acted.add(t.id);
    });
}
