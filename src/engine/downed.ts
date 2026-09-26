import { Item, Tribute, attr } from '../models/types';
import { thawRivals } from './allianceBonds';
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
import { canReach, noteAttempt, noteRefusal } from './actions';
import { killTribute, enterShock } from './combat';
import { loseSanity } from './sanityBands';
import { reattributeWound } from './woundLedger';
import { allied } from './alliance';

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
export function wouldHelp(rescuer: Tribute, downed: Tribute): boolean {
    if (allied(rescuer, downed)) return true;
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
function finish(
    ctx: SimContext,
    t: Tribute,
    cause: string,
    killer?: Tribute,
    silent = false,
    /**
     * AUDIT-10 F05: what killed them, when it was not a person.
     *
     * Without this the no-killer path inherited `t.lastDamage.kind`, and a
     * tribute who was downed *by somebody* and then finished by the arena kept
     * `kind: 'tribute'` with `sourceId` cleared to undefined — a killing blow
     * credited to a tribute the roster does not contain. Harmless while the
     * only no-killer callers were the bleed-out paths (which inherit a status
     * cause honestly); not harmless once an anchor tearing out could end the
     * window. An explicit kind is the honest answer for those.
     */
    arenaKind?: { kind: NonNullable<Tribute['lastDamage']>['kind']; code?: NonNullable<Tribute['lastDamage']>['code'] },
) {
    /*
     * REQUEST: the fixed Games. The downed window is the one route to a death
     * that does not go through `applyDamage`, so the protection has to be
     * repeated here rather than inherited.
     *
     * They come round instead. Whoever was standing over them with a knife
     * finds the hovercraft arriving first, which is the Capitol's own
     * explanation and also the true one.
     */
    if (ctx.state.riggedVictorId === t.id) {
        delete t.downed;
        t.health = Math.max(t.health, DOWNED.reviveHealth);
        clampTribute(t);
        ctx.logEvent(
            `${t.name} is on the ground in ${t.zone} and does not stay there. Nobody watching can say afterwards `
            + 'quite what it was that went wrong for the person standing over them.',
            [t.id],
            { important: true, category: 'survival' },
        );
        return;
    }
    delete t.downed;
    reattributeWound(t, {
        cause,
        kind: killer ? 'tribute' : (arenaKind?.kind ?? t.lastDamage?.kind ?? 'status'),
        // A finished tribute is a tribute kill; an expired one keeps whatever
        // the marker's own cause classifies as.
        code: killer ? 'tribute' : (arenaKind?.code ?? t.lastDamage?.code),
        sourceId: killer?.id,
        cycle: cycleOf(ctx.state),
        amount: t.lastDamage?.amount ?? 0,
    });
    killTribute(ctx, t, killer, { cause, silent });
}

/**
 * The tribute bleeds out where they lie. Whoever struck the blow gets the
 * kill, days later — which is why the cause has to say so.
 */
function bleedOut(ctx: SimContext, t: Tribute, describe: (killerName: string) => string, fallback: string, silent = false) {
    const by = t.downed?.byId ? ctx.state.tributes.find(o => o.id === t.downed!.byId) : undefined;
    finish(ctx, t, by ? describe(by.name) : fallback, by, silent);
}

/**
 * AUDIT-10 F05: a lethal interruption of the rescue window, from outside it.
 *
 * `applyDamage` and `checkDeath` both refuse an already-downed tribute on
 * purpose (see the comment at the top of `applyDamage`): status damage runs
 * through that funnel every cycle against a tribute sitting at exactly 0
 * health, so anything that landed would make the window zero cycles wide.
 * The consequence was that a rescue line deliberately cut under a downed
 * person recorded a betrayal and changed nothing — no damage, no death, no
 * attacker attribution — because the only doors into their ending were shut.
 *
 * This is the door for events that are *meant* to end it: the line cut, the
 * anchor torn out, the debris that came down on them. It ends the window now
 * and credits `killer` when there is one, leaving the ordinary clock —
 * rescue, execution, bleeding out — exactly as it was for everything else.
 */
export function cutDownedLine(ctx: SimContext, t: Tribute, cause: string, killer?: Tribute) {
    if (!isDowned(t)) return;
    // With no killer this is the arena doing it — a fall — and it must say so
    // rather than inheriting a tribute attribution from the blow that downed
    // them, whose source is not the source of this.
    finish(ctx, t, cause, killer, false, killer ? undefined : { kind: 'arena', code: 'fall' });
}

/**
 * AUDIT-10 F04: buy a downed tribute more of the clock.
 *
 * The explicit version of "the rescue window improved". An extraction does not
 * put somebody back on their feet, but it does take them out of the thing that
 * was going to finish them, and that is worth saying in the one number the
 * window is actually made of rather than leaving it as an implication of prose.
 */
export function widenRescueWindow(t: Tribute, cycles: number) {
    if (!t.downed || cycles <= 0) return;
    t.downed.cyclesLeft += cycles;
    t.downed.extracted = true;
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
            /*
             * REQUEST (run length), found by the soak: the kill is credited
             * here and, until this line said so, nothing in the chronicle tied
             * it to anybody.
             *
             * `bleedOut` below writes "Killed by <name>, who left them for
             * dead" onto the obituary and increments that tribute's kill
             * count — but it passes `silent`, because this branch has already
             * narrated the death, and `killTribute`'s silent path emits no
             * `kill`-category line at all. The result was a victor who
             * finished with kills and had no kill in the log: the soak caught
             * it as "epilogue never quotes a real event despite the victor
             * having kills", and Caesar's closing question had nothing to
             * quote. It is rare — one run in five hundred — and it is exactly
             * the sort of gap a longer Games makes more likely, because the
             * rescue window has more cycles in which to time out.
             *
             * Naming the credit is also the truer line. A tribute who opened
             * somebody up two days ago and walked away has killed them, and
             * the Capitol is scrupulous about who the cannon belongs to.
             */
            // AUDIT-12 T10: credit only a killer who is still alive to be credited;
            // a dead one gets no posthumous kill line.
            const found = t.downed?.byId ? ctx.state.tributes.find(o => o.id === t.downed!.byId) : undefined;
            const by = found?.status === 'alive' ? found : undefined;
            ctx.logEvent(
                `The Gamemakers are done waiting on ${t.name}. Whatever was keeping them breathing in ${t.zone} stops.`
                + (by ? ` The kill is credited to ${by.name}, who put them there and did not stay to watch.` : ''),
                by ? [t.id, by.id] : [t.id],
                // AUDIT-12 T10: say who acted; the cast order is victim-first.
                { important: true, category: by ? 'kill' : 'death', actorId: by?.id }
            );
            bleedOut(ctx, t, name => `Killed by ${name}, who left them for dead`, t.downed!.cause, true);
            return;
        }

        /*
         * AUDIT-10 F09: contact, not a matching zone name.
         *
         * This was `o.zone === t.zone`, which in a vertical zone is not a
         * place — it is two places with a drop between them. A probe revived a
         * tribute on the lower level with a helper standing on the upper one
         * while `samePlace` returned false for the same pair. Direct treatment
         * and an execution both require being able to put hands on somebody, so
         * both go through the engine's one proximity predicate.
         *
         * A rope rescue may deliberately span levels; that is `rescueLine.ts`,
         * which checks reach and equipment for itself. This pass is the
         * medical one.
         */
        const here = ctx.state.tributes.filter(o => {
            if (o.id === t.id) return false;
            const reach = canReach(ctx.state, o, t);
            /*
             * AUDIT-10 batch 2: counted, not merely excluded. Somebody who
             * would have helped and could not get to them is the difference
             * between a rescue window that is tight and one that is closed,
             * and only one of those is a design decision.
             *
             * Only people who could have acted at all are counted: a corpse or
             * another downed tribute failing `canAct` is not a reachability
             * failure, and counting them buried the signal under it.
             */
            /*
             * AUDIT-11: ...and only people who actually would have helped
             * (`wouldHelp`, the same test the rescue itself uses) and were
             * within a sector of it. This counted anybody anywhere in the arena
             * with a regard above zero, so the ledger's "13% got through" was
             * mostly acquaintances four zones away who were never coming.
             */
            if (!reach.ok && reach.why !== 'incapable' && wouldHelp(o, t)
                && (o.zone === t.zone || (hopsTo(ctx.state.arena, o.zone, t.zone, ctx.state.collapsedZones ?? [], severedEdgeSet(ctx.state)) ?? 99) <= 1)) {
                noteRefusal(ctx.state, 'treat-downed', reach.why);
            }
            return reach.ok;
        });

        // (a) Rescue. Whoever in the zone has the best chance of it tries.
        const allies = here.filter(o => wouldHelp(o, t));
        let failedRescuer: Tribute | undefined;
        if (allies.length > 0) {
            const rescuer = allies.reduce((best, o) =>
                (rescueChance(o, !!medicalItem(o)) > rescueChance(best, !!medicalItem(best)) ? o : best));
            // The kit is spent on the attempt, not on the outcome.
            noteAttempt(ctx.state, 'treat-downed');
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
                // AUDIT-11 §6: a rival pulling you up is the arc turning.
                thawRivals(ctx, rescuer, t);
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
                /*
                 * AUDIT-6 §8.1: the Confessor's win condition, which the
                 * archetype advertised and the engine never implemented.
                 *
                 * "Wins by being the person nobody can justify killing" was
                 * carried entirely by a once-per-run signature that granted a
                 * single truce, so a Confessor survived to the end (4.70 days,
                 * third-longest in the game) and could not close (0.38 kills,
                 * the lowest) and won 3.15% of the time — last on the board.
                 *
                 * This is the standing version, at the one moment where "can
                 * you justify it" is literally the question being asked: a
                 * tribute deciding whether to finish somebody on the ground.
                 * Charisma is what makes it hard, and it is hardest in front of
                 * an audience — the witnesses are the whole point. Somebody
                 * alone in a sector with a downed Confessor still mostly does
                 * it; somebody with three people watching finds it much harder
                 * to be the one who did.
                 *
                 * Deliberately scaled off the victim's charisma rather than
                 * keyed to the archetype id, so a charismatic anybody gets some
                 * of it and the Confessor — with `statBias: { charisma: 3 }` —
                 * gets most of it.
                 */
                const watching = here.filter(o => o.id !== decider.id).length;
                chance -= (t.attributes.charisma / DOWNED.pleaCharismaScale)
                    * (DOWNED.pleaBase + watching * DOWNED.pleaPerWitness);
                const witnesses = here.filter(o => o.id !== decider.id);
                if (ctx.rng.chance(Math.max(0, Math.min(1, chance)))) {
                    decider.finishedDowned = [...(decider.finishedDowned ?? []), t.id];
                    finish(ctx, t, `Killed by ${decider.name} while they lay unconscious`, decider);
                    // Finishing the helpless is not fighting, and the zone knows it.
                    witnesses.forEach(w => {
                        addFear(w, decider.id, DOWNED.executeFear, decider);
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
                true,
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
        // Only the branch that wrote its own sentence suppresses the generic one.
        const narrated = !!nearAlly;
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
        bleedOut(ctx, t, name => `Killed by ${name} — bled out where they fell`, marker.cause, narrated);
    });
}
