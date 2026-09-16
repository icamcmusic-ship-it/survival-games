import { Item, Tribute, attr } from '../models/types';
import { SimContext } from './context';
import { DOWNED, STANCE } from '../data/balance';
import { ARCHETYPES } from '../data/archetypes';
import { traitMod } from '../data/traits';
import { clampTribute } from './vitals';
import { consumeOne } from './items';
import { cycleOf } from './memory';
import { adjustRel, adjustRespect } from './relationships';
import { addFear } from './fear';
import { hopsTo, severedEdgeSet } from './map';
import { killTribute, enterShock } from './combat';
import { loseSanity } from './sanityBands';

/**
 * §9.1: the downed state and the rescue window.
 *
 * The bottom of the health scale used to be a cliff: the blow either left you
 * standing or it fired a cannon. Nothing could happen in between, so the arena
 * had no room for the two scenes the source material leans on hardest — an
 * ally arriving in time, and somebody standing over a person who cannot lift
 * their hands and deciding.
 *
 * A downed tribute keeps `status === 'alive'` deliberately: every roster
 * filter in the engine still counts them, and the handful of systems that must
 * care ask `isDowned()`.
 */

/** True while this tribute is at the bottom of the window and not yet a corpse. */
export function isDowned(t: Tribute): boolean {
    return t.status === 'alive' && !!t.downed;
}

/** Convenience for the many places that want "alive and able to act". */
export function isActive(t: Tribute): boolean {
    return t.status === 'alive' && !t.downed;
}

/** §9.1: whether these two would cross a zone for each other. */
function wouldHelp(rescuer: Tribute, downed: Tribute): boolean {
    if (rescuer.allianceId && rescuer.allianceId === downed.allianceId) return true;
    if (rescuer.protectorBonds?.includes(downed.id)) return true;
    return (rescuer.relationships[downed.id] ?? 0) > STANCE.friendRegardThreshold;
}

function medicalItem(t: Tribute): Item | undefined {
    return t.inventory.find(i => i.type === 'medical');
}

/** How likely this particular ally is to get them back on their feet. */
function rescueChance(rescuer: Tribute, hasKit: boolean): number {
    return DOWNED.rescueBase
        + (rescuer.proficiencies?.medicine ?? 0) * DOWNED.rescuePerMedicine
        + attr(rescuer, 'intelligence') * DOWNED.rescuePerIntelligence
        + (hasKit ? DOWNED.rescueItemBonus : 0);
}

/**
 * §9.1: puts a tribute into the window instead of killing them.
 *
 * Called only from `checkDeath`, which is the single funnel every death in the
 * engine passes through — nothing else should be inventing downed tributes.
 */
export function goDown(ctx: SimContext, t: Tribute, cause: string, byId?: string) {
    if (t.status !== 'alive' || t.downed) return;
    // Endurance buys a body one more cycle of arguing with the wound.
    const cycles = DOWNED.baseCycles
        + (attr(t, 'endurance') >= DOWNED.toughEndurance ? 1 : 0);
    t.downed = { sinceCycle: cycleOf(ctx.state), cyclesLeft: cycles, cause, byId };
    t.everDowned = true;
    t.health = 0;
    clampTribute(t);
    ctx.logEvent(
        `${t.name} goes down in ${t.zone} and does not get up. No cannon. ` +
        `Whether that is mercy or arithmetic depends entirely on who reaches them first.`,
        [t.id],
        { important: true, category: 'injury' }
    );
}

/**
 * Ends a downed tribute, keeping the damage record and the cause of death in
 * agreement.
 *
 * `DamageRecord.cause` is used verbatim as the cause of death everywhere else
 * in the engine, and the soak asserts the two agree: a death credited to a
 * tribute has to name them, and a death credited to nobody has to read back
 * exactly as the record does. Neither held here for free. A tribute downed by
 * the arena and then finished by a person still carried the arena's record;
 * a tribute who bled out days after the blow that felled them carried a cause
 * that never mentioned whose blow it was. So the last thing that happened to
 * them is written down as the thing that actually killed them.
 *
 * The `Killed by <name>` prefix is not decoration either. It is the
 * convention `killTribute` writes for every tribute-dealt death, and
 * everything that classifies a cause afterwards keys off it — the metrics
 * script buckets anything it does not recognise as an arena hazard, so a
 * downed tribute finished by a person read as death by scenery and moved
 * two regression indicators at once. Elaborate after the prefix, never
 * before it.
 */
function finish(ctx: SimContext, t: Tribute, cause: string, killer?: Tribute) {
    delete t.downed;
    t.lastDamage = {
        cause,
        kind: killer ? 'tribute' : (t.lastDamage?.kind ?? 'status'),
        sourceId: killer?.id,
        cycle: cycleOf(ctx.state),
        amount: t.lastDamage?.amount ?? 0,
    };
    killTribute(ctx, t, killer, { cause });
}

/**
 * The tribute bleeds out where they lie. Whoever struck the blow gets the
 * kill, days later — which is why the cause has to say so.
 */
function bleedOut(ctx: SimContext, t: Tribute, describe: (killerName: string) => string, fallback: string) {
    const by = t.downed?.byId ? ctx.state.tributes.find(o => o.id === t.downed!.byId) : undefined;
    finish(ctx, t, by ? describe(by.name) : fallback, by);
}

/**
 * §9.1: one cycle of the rescue window, for everybody currently in it.
 *
 * Run once per cycle, after movement has settled — who is standing in the zone
 * is the entire question this pass asks.
 */
export function tickDowned(ctx: SimContext) {
    // A snapshot: an execution inside the loop can kill a tribute later in it.
    const down = ctx.state.tributes.filter(isDowned);

    down.forEach(t => {
        if (!isDowned(t)) return;

        // The floor, enforced for as long as the window is open and not just
        // at the moment it opens. Deaths elsewhere can drain the field down
        // past it while somebody is still lying in it, and a finalist who is
        // neither dead nor able to stand is a run `checkDualVictory` would
        // happily call for two — so the Gamemakers close the window instead.
        const standing = ctx.state.tributes.filter(isActive).length;
        if (standing <= DOWNED.finalistFloor) {
            ctx.logEvent(
                `The Gamemakers are done waiting on ${t.name}. Whatever was keeping them breathing in ${t.zone} stops.`,
                [t.id],
                { important: true, category: 'death' }
            );
            bleedOut(ctx, t, name => `Killed by ${name}, who left them for dead`, t.downed!.cause);
            return;
        }

        const here = ctx.state.tributes.filter(o =>
            o.id !== t.id && isActive(o) && o.zone === t.zone);

        // (a) Rescue. Whoever in the zone has the best chance of it tries.
        const allies = here.filter(o => wouldHelp(o, t));
        let failedRescuer: Tribute | undefined;
        if (allies.length > 0) {
            const rescuer = allies.reduce((best, o) =>
                (rescueChance(o, !!medicalItem(o)) > rescueChance(best, !!medicalItem(best)) ? o : best));
            // The kit is spent on the attempt, not on the outcome.
            const kit = consumeOne(rescuer, i => i.type === 'medical');
            if (ctx.rng.chance(rescueChance(rescuer, !!kit))) {
                const cause = t.downed!.cause;
                delete t.downed;
                t.health = DOWNED.reviveHealth;
                t.revivedBy = rescuer.id;
                // A §8: nobody comes round from that and gets straight back to
                // whatever they were doing.
                enterShock(ctx, t, cause);
                t.vitals.sanity += DOWNED.rescueSanityRelief;
                adjustRel(t, rescuer.id, DOWNED.rescueBond);
                adjustRel(rescuer, t.id, DOWNED.rescueBond);
                rescuer.reachedDownedFirst = (rescuer.reachedDownedFirst ?? 0) + 1;
                clampTribute(t);
                clampTribute(rescuer);
                ctx.logEvent(
                    `${rescuer.name} gets ${t.name} breathing again${kit ? ` — ${kit.name}, and steadier hands than anyone expected` : ', with nothing but what they had on them'}. ` +
                    `${t.name} will not forget which face was above them.`,
                    [rescuer.id, t.id],
                    { important: true, category: 'alliance' }
                );
                return;
            }
            failedRescuer = rescuer;
            loseSanity(rescuer, DOWNED.failedRescueSanity);
            rescuer.vitals.fatigue += DOWNED.rescueFatigue;
            clampTribute(rescuer);
            ctx.logEvent(
                `${rescuer.name} works over ${t.name} and cannot make it hold. The bleeding is winning.`,
                [rescuer.id, t.id],
                { important: true, category: 'injury' }
            );
        }

        // (b) Execution or mercy. Reached whenever no rescue *succeeded* — this
        // used to be the `else` of "is an ally present", so one twelve-year-old
        // kneeling over the body meant the four Careers standing around it never
        // got a decision at all. A failed rescue is not an absence of hostiles;
        // it is the most charged moment for one of them to step forward.
        {
            const hostiles = here.filter(o => !wouldHelp(o, t));
            if (hostiles.length > 0) {
                const decider = ctx.rng.pick(hostiles);
                // `killSanity` is the trait table's own mercy axis — Pacifist and
                // Softhearted sit high on it, Ruthless and Bloodthirsty below zero
                // — so it is the suitable key here rather than a new one. Grim has
                // no entry on that axis and gets an explicit shove.
                let chance = DOWNED.executeBase
                    + ARCHETYPES[decider.archetype].aggression * DOWNED.executePerAggression
                    - traitMod(decider, 'killSanity') * DOWNED.executePerAggression;
                chance += traitMod(decider, 'executeDrive');
                const witnesses = here.filter(o => o.id !== decider.id);
                if (ctx.rng.chance(Math.max(0, Math.min(1, chance)))) {
                    decider.finishedDowned = [...(decider.finishedDowned ?? []), t.id];
                    finish(ctx, t, `Killed by ${decider.name} while they lay unconscious`, decider);
                    // Finishing the helpless is not fighting, and the zone knows it.
                    witnesses.forEach(w => {
                        addFear(w, decider.id, DOWNED.executeFear);
                        adjustRespect(w, decider.id, -DOWNED.executeRespect);
                    });
                    loseSanity(decider, DOWNED.executeSanity);
                    clampTribute(decider);
                    return;
                }
                decider.sparedDowned = [...(decider.sparedDowned ?? []), t.id];
                adjustRel(t, decider.id, DOWNED.spareGratitude);
                witnesses.forEach(w => adjustRespect(w, decider.id, DOWNED.spareRespect));
                ctx.logEvent(
                    `${decider.name} stands over ${t.name} for a long moment, and then steps around them. ` +
                    `Nobody in ${t.zone} says anything about it.`,
                    [decider.id, t.id],
                    { important: true, category: 'combat' }
                );
            }
        }

        // (c) The clock. It runs whatever anyone in the zone chose to do.
        const marker = t.downed;
        if (!marker) return;
        marker.cyclesLeft -= 1;
        if (marker.cyclesLeft > 0) return;

        if (failedRescuer) {
            // The social death: they did not die alone, they died in someone's hands.
            ctx.logEvent(
                `${t.name} dies with ${failedRescuer.name} still holding onto them. ` +
                `${failedRescuer.name} keeps working for a while after there is any point to it.`,
                [t.id, failedRescuer.id],
                { important: true, category: 'death' }
            );
            bleedOut(
                ctx, t,
                name => `Killed by ${name} — bled out in ${failedRescuer.name}'s hands`,
                'Bled out during a rescue attempt',
            );
            return;
        }

        // Dying alone with somebody who would have come one zone away is its own
        // beat, and the run's tally of them says something about the Games.
        const collapsed = ctx.state.collapsedZones || [];
        const severed = severedEdgeSet(ctx.state);
        // Audit 2 §11.2: this required the would-be rescuer to be in a
        // *different* zone, exactly one hop away, which excluded the purest
        // case of all — somebody standing over them who would have helped and
        // did not. (A same-zone ally who actually tries is the `failedRescuer`
        // branch above and has already returned, so this cannot double-count
        // them.) With the same-zone case excluded, `diedWithinReach` never
        // exceeded 2 across 150 runs, which left `within-reach` unreachable at
        // its old threshold of 3 and made `nobody-came` — the zero case of the
        // same counter — fire on 61% of runs. One counter, two broken entries,
        // in opposite directions.
        const nearAlly = ctx.state.tributes.find(o => {
            if (o.id === t.id || !isActive(o) || !wouldHelp(o, t)) return false;
            if (o.zone === t.zone) return true;
            // `hopsTo` is undefined when no route exists at all, which is not
            // within reach of anything.
            const hops = hopsTo(ctx.state.arena, o.zone, t.zone, collapsed, severed);
            return hops !== undefined && hops <= 1;
        });
        if (nearAlly) {
            ctx.state.diedWithinReach = (ctx.state.diedWithinReach ?? 0) + 1;
            ctx.logEvent(
                nearAlly.zone === t.zone
                    ? `${t.name} bleeds out in ${t.zone} with ${nearAlly.name} close enough to touch. `
                        + `${nearAlly.name} does not close the distance, and will have the rest of the Games to think about it.`
                    : `${t.name} bleeds out in ${t.zone}. ${nearAlly.name} is one zone away and will hear the cannon `
                        + `before they ever hear why.`,
                [t.id, nearAlly.id],
                { important: true, category: 'death' }
            );
        }
        bleedOut(ctx, t, name => `Killed by ${name} — bled out where they fell`, marker.cause);
    });
}
