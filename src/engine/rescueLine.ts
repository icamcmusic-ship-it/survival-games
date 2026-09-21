import { GameState, Item, RescueLineRecord, Tribute } from '../models/types';
import { SimContext, getAlive } from './context';
import { RESCUE_LINE, BLEEDING } from '../data/balance';
import { applyDamage, checkDeath } from './combat';
import { cutDownedLine, isActive, isDowned, widenRescueWindow } from './downed';
import { isVertical, samePlace } from './verticality';
import { hasEffect } from './zoneEffects';
import { encumbranceOf } from './items';
import { profOf, trainProficiency } from './proficiency';
import { cycleOf } from './memory';
import { canSpend, canSpanTo, perform } from './actions';
import { adjustMutual, adjustRel, getRel } from './relationships';
import { incurDebt } from './debts';
import { clampTribute } from './vitals';
import { openWound } from './wounds';
import { isOverprepared, volunteersToCarry } from '../data/traits';
import { ARCHETYPES } from '../data/archetypes';
import { witnessKindness } from './rapport';

/**
 * AUDIT-9 batch 4, pilot 1: the rescue line.
 *
 * The audit's §7 table asks for one universal death chain shaped like this:
 *
 *   | Rescue line failure | A stranded person, suitable anchor and attempted
 *   | extraction. | Rescuer or rescued person falls/drowns; distinguish bad
 *   | anchor, excess load and deliberate cutting. |
 *
 * and the batch's gate adds the rest of the shape: a warning or inferable
 * risk, an avoidance option, structured attribution, at least one non-fatal
 * outcome, and a follow-up a cycle or two later that reads the actual result.
 *
 * Why this one, of the twelve proposed: it is the chain that turns three
 * systems the engine already has — being downed, standing on the lower level
 * of a vertical zone, and carrying more than you can manage — into a decision
 * somebody else makes about you. Everything else in the list is a thing that
 * happens *to* a tribute. This is a thing another tribute chooses, badly or
 * well or dishonestly, and the three failure modes are three different
 * stories about the same act:
 *
 *   - **The anchor was never good enough.** Nobody is to blame and the arena
 *     is. It is the one the chain warns about in advance, because the
 *     rescuer can see what they are tying off to.
 *   - **They would not let go of the bag.** The stranded person's own choice
 *     kills them, and it has an avoidance branch they can take instead.
 *   - **Somebody cut it.** A murder that looks exactly like an accident to
 *     anybody who was not standing close enough to see, which is the most
 *     arena-ish version of this beat there is.
 *
 * The prose the cause taxonomy already anticipates — `causes.ts` has matched
 * "when the anchor went" as a `fall` since the taxonomy was written — and
 * nothing in the engine has ever produced it. This is the thing that was
 * missing from the other end of that regex.
 */

/** A tribute who cannot get themselves out of where they are. */
function strandingOf(state: GameState, t: Tribute): RescueLineRecord['stranding'] | undefined {
    if (t.status !== 'alive') return undefined;
    // On the ground: the clearest case, and the one the engine already models.
    if (isDowned(t)) return 'downed';
    if (!isActive(t)) return undefined;
    // At the bottom of something, with the reason to be down there now on fire
    // or underwater. Going up is the expensive direction and they are in no
    // state to take it.
    if (isVertical(state.arena, t.zone) && (t.zoneLevel ?? 'upper') === 'lower') {
        const bad = hasEffect(state, t.zone, 'flooded')
            || hasEffect(state, t.zone, 'burning')
            || hasEffect(state, t.zone, 'quaking');
        if (bad && t.health < RESCUE_LINE.strandedHealth) return 'below';
    }
    return undefined;
}

/**
 * What they are tying the line off to, and how much it is worth.
 *
 * This is the chain's *warning*: it is knowable before the attempt, it is
 * said out loud in the line that announces the attempt, and it is the thing
 * the rescuer could go and improve instead of pulling now.
 */
function anchorFor(t: Tribute): { kind: RescueLineRecord['anchor']; quality: number; rope: boolean } | undefined {
    /*
     * AUDIT-10 F06: composed from item capabilities, not from item type.
     *
     * This used to be `t.inventory.find(i => i.type === 'utility' || i.type === 'tool')`.
     * Nightlock Berries are a utility — deliberately, so nobody eats them by
     * accident — so a Rope-Handed tribute carrying nothing but poison berries
     * was rigging a proper anchor with them, and matches, charcoal filters and
     * whetstones did the same. A drawer of the catalogue is not a capability.
     *
     * Three honest tiers now, and which one you get is a physical fact about
     * what is in the pack:
     *
     *   - a **line**: something with usable length that will bear a person;
     *   - **lashable material**: straps, cloth, a pack, knotted into one;
     *   - **belts and a jacket**: what everybody is wearing, always available,
     *     and the worst of the three.
     *
     * Deliberately no consumption of arbitrary supplies to make an otherwise
     * impossible scene legal: the third tier is clothing, which is real.
     */
    const line = t.inventory.find(i =>
        (i.ropeLength ?? 0) >= RESCUE_LINE.minRopeLength
        && (i.tensileStrength ?? 0) >= RESCUE_LINE.minTensile);
    /*
     * AUDIT-9 batch 4: who actually knows how to tie one off.
     *
     * The first version asked for climbing proficiency, and measured: 69.1% of
     * tributes end a run at climbing 0 and 0.7% reach 4, so `rigged` occurred
     * zero times across 200 runs. That is a dead branch, which this batch's
     * gate forbids, and it was dead for a reason worth keeping rather than
     * tuning around — climbing is a thing this game's tributes almost never
     * get to practise.
     *
     * `Rope-Handed` is the answer the trait table already had: "grew up on
     * lines and knots". It is a thing somebody arrives knowing rather than
     * something the arena teaches them in a week, which is the right shape for
     * a skill that shows up once, under load, at the worst moment.
     *
     * Practised climbing still counts, at a bar low enough to be reachable.
     */
    const knows = t.traits.includes('Rope-Handed')
        || profOf(t, 'climbing') >= RESCUE_LINE.goodAnchorClimbing;
    if (line && knows) return { kind: 'rigged', quality: RESCUE_LINE.riggedQuality, rope: true };
    if (line) return { kind: 'rope', quality: RESCUE_LINE.ropeQuality, rope: true };
    const lashable = t.inventory.filter(i => i.lashable).length;
    // Enough strapping to knot a line out of, or the clothes they stand up in.
    // Either way it is improvised; the first is merely less desperate, which
    // the anchor roll already prices through `quality`.
    return {
        kind: 'improvised',
        quality: RESCUE_LINE.improvisedQuality
            + (lashable >= RESCUE_LINE.lashablePieces ? RESCUE_LINE.lashableBonus : 0),
        rope: false,
    };
}

/**
 * AUDIT-10 F07: can this person actually do it, asked *before* ranking.
 *
 * `tickRescueLines` used to rank the whole zone by willingness and then check
 * the winner's health, returning if it was too low — so one keen, nearly-dead
 * favourite blocked every healthy volunteer behind them. A fixture with a
 * one-health favourite and a healthy willing alternative produced no rescue in
 * 100 attempts. Capability, reach and resources are a filter, not a tiebreak.
 */
function canAttemptRescue(state: GameState, rescuer: Tribute, stranded: Tribute): boolean {
    if (rescuer.id === stranded.id) return false;
    /*
     * AUDIT-10 batch 2: asked through the shared contract rather than
     * re-derived here.
     *
     * `canSpanTo` is the one predicate in the engine for "can get a line to",
     * as distinct from `canReach` ("can put hands on"). A rope may deliberately
     * span the levels of a vertical zone — paid downward, never up — and that
     * distinction was written out longhand here in batch 1, which is exactly
     * how nine subsystems ended up with nine versions of it.
     */
    if (!canSpanTo(state, rescuer, stranded).ok) return false;
    if (rescuer.health < RESCUE_LINE.rescuerMinHealth) return false;
    // F15: hauling somebody up a face is a major action, and a day has only so
    // many hours in it. Fatigue was already charged; the budget was not.
    return canSpend(rescuer, RESCUE_LINE.rescuerHours).ok;
}

/**
 * How likely this person is to pick up the rope. The avoidance option, from
 * their side — and the selection key, so the volunteer is whoever most wants
 * to be holding it, for whatever reason.
 */
function willingness(rescuer: Tribute, stranded: Tribute): number {
    let chance = RESCUE_LINE.baseWillingness;
    if (rescuer.allianceId !== undefined && rescuer.allianceId === stranded.allianceId) {
        chance += RESCUE_LINE.allyWillingness;
    }
    chance += Math.max(0, getRel(rescuer, stranded.id)) * RESCUE_LINE.perRegard;
    chance -= ARCHETYPES[rescuer.archetype].aggression * RESCUE_LINE.aggressionWeight;
    /*
     * AUDIT-9 stage D's `Shared-Burden` — "volunteers for transport of an
     * injured ally" — is this decision, exactly, and it already exists. A new
     * trait hook for the same idea would be a second answer to one question.
     */
    if (volunteersToCarry(rescuer)) chance += RESCUE_LINE.volunteerWillingness;
    /*
     * ...and the other kind of volunteer. Somebody treacherous, standing over
     * somebody they dislike, has a reason of their own to be the one holding
     * the rope — and it is a reason that makes them *more* likely to step
     * forward, not less. This term is what makes the `cut` branch reachable
     * at all; without it the chain only ever selects people who want the
     * rescue to work.
     */
    chance += Math.max(0, ARCHETYPES[rescuer.archetype].treachery)
        * Math.max(0, -getRel(rescuer, stranded.id)) * RESCUE_LINE.opportunistWeight;
    return chance;
}

/**
 * One cycle of people trying to get other people out of things.
 *
 * Runs after movement and combat have settled, so "standing there" means
 * standing there now.
 */
export function tickRescueLines(ctx: SimContext) {
    const state = ctx.state;
    getAlive(state).forEach(stranded => {
        const stranding = strandingOf(state, stranded);
        if (!stranding) return;
        // One attempt per person per cycle. Being hauled at twice in an
        // afternoon is not a story, it is a loop.
        if ((state.rescueLines ?? []).some(r => r.strandedId === stranded.id && r.cycle === cycleOf(state))) return;

        /*
         * AUDIT-10 F07: filter first, rank second.
         *
         * Capability, reach and resources decide who is *eligible*; willingness
         * only decides which of the eligible steps forward. The other order —
         * rank everybody, then test the winner — let one keen, nearly-dead
         * favourite block every healthy volunteer behind them.
         */
        const rescuers = getAlive(state).filter(o => canAttemptRescue(state, o, stranded));
        if (rescuers.length === 0) return;

        /*
         * Whoever is likeliest to step forward — which is not the same as
         * whoever likes them most, and getting that wrong made a whole branch
         * of this chain unreachable.
         *
         * The first version sorted by regard and took the friendliest person
         * present. That is the obvious reading and it is wrong twice over: it
         * quietly guarantees the rescuer is somebody who wants the rescue to
         * work, so `cut` measured 0 occurrences across 200 runs — a dead hook,
         * which is exactly what this batch's gate forbids — and it throws away
         * the best version of the beat. The person who picks up the rope is
         * not always your friend. Sometimes it is the one who has been waiting
         * for a reason to be standing over you holding something sharp, and
         * everybody watching just sees somebody helping.
         *
         * So: willingness decides, and a treacherous tribute has their own
         * reasons to volunteer.
         */
        /*
         * Ties no longer always fall to roster order: two equally willing
         * eligible rescuers are separated by the run's own stream, so the
         * person who picks up the rope is not simply whoever was reaped first.
         */
        const ranked = rescuers
            .map(o => ({ o, w: willingness(o, stranded) }))
            .sort((a, b) => b.w - a.w);
        const best = ranked[0].w;
        const tied = ranked.filter(r => Math.abs(r.w - best) < 1e-9).map(r => r.o);
        const rescuer = tied.length > 1 ? ctx.rng.pick(tied) : tied[0];
        if (!ctx.rng.chance(Math.max(0, Math.min(RESCUE_LINE.maxWillingness, willingness(rescuer, stranded))))) return;

        attemptRescueLine(ctx, rescuer, stranded, stranding);
    });
}

function attemptRescueLine(
    ctx: SimContext,
    rescuer: Tribute,
    stranded: Tribute,
    stranding: RescueLineRecord['stranding'],
) {
    const state = ctx.state;
    const anchor = anchorFor(rescuer);
    if (!anchor) return;
    /*
     * AUDIT-10 batch 2: the commit goes through the contract.
     *
     * `perform` validates, validates *again* immediately before resolving, and
     * only then spends the hours — which matters here more than almost
     * anywhere, because this pass iterates the whole roster and an earlier
     * rescue in the same cycle can kill the rope holder or move the person at
     * the bottom of it. The `check` is the audit's own example: the rescue
     * target moved.
     */
    const committed = perform(ctx, {
        kind: 'rescue-line',
        actors: [rescuer],
        hours: RESCUE_LINE.rescuerHours,
        check: () => canAttemptRescue(state, rescuer, stranded)
            && strandingOf(state, stranded) === stranding,
    }, () => resolveRescueLine(ctx, rescuer, stranded, stranding, anchor));
    void committed;
}

function resolveRescueLine(
    ctx: SimContext,
    rescuer: Tribute,
    stranded: Tribute,
    stranding: RescueLineRecord['stranding'],
    anchor: NonNullable<ReturnType<typeof anchorFor>>,
) {
    const state = ctx.state;

    /*
     * The warning. Said before the roll, naming the thing the attempt rests
     * on, so that a line that snaps afterwards was a thing the arena told
     * everybody about first. An improvised anchor is *visibly* improvised.
     */
    ctx.logEvent(
        `${rescuer.name} gets a line down to ${stranded.name} in ${stranded.zone}`
        + (anchor.kind === 'rigged'
            ? ', anchored properly, with the turns taken the way somebody was taught to take them.'
            : anchor.kind === 'rope'
                ? ' and makes it fast to the nearest thing that looks like it will hold.'
                : ' — belts, straps and somebody\'s jacket, knotted, tied off around a root.'),
        [rescuer.id, stranded.id],
        { type: 'rescue-line', important: true, zone: stranded.zone, category: 'survival' },
    );

    /*
     * The stranded person's avoidance option, and their way of dying.
     *
     * Everything they are carrying is on the line with them. They can drop it
     * — which is the non-fatal branch and costs them their kit — or they can
     * keep hold of it, which is a choice with a number behind it.
     */
    const load = encumbranceOf(stranded);
    let droppedLoad: Item[] = [];
    const overloaded = load > RESCUE_LINE.loadLine;
    if (overloaded) {
        /*
         * `Overprepared` carries the spare and the spare's spare, and its
         * stated cost is a slower departure. This is the sharpest version of
         * that cost: the one moment where what you are carrying is the thing
         * deciding whether you come up.
         */
        const letsGo = ctx.rng.chance(isOverprepared(stranded)
            ? RESCUE_LINE.dropLoadChance * RESCUE_LINE.overpreparedGrip
            : RESCUE_LINE.dropLoadChance);
        if (letsGo) {
            droppedLoad = stranded.inventory.splice(0, Math.max(1, Math.ceil(stranded.inventory.length / 2)));
            ctx.logEvent(
                `${stranded.name} lets the pack go. It goes down into ${stranded.zone} without them, `
                + 'which is the entire point and will not feel like it later.',
                [stranded.id], { zone: stranded.zone, category: 'survival' },
            );
        }
    }

    /*
     * Deliberate cutting. Checked before the anchor roll, because a rescuer
     * who intended this from the moment they picked up the rope does not need
     * the anchor to fail — and attributing it correctly is the whole reason
     * this chain records a cause at all. Only somebody with a reason: a real
     * dislike, and the treachery to act on it, with nobody standing close
     * enough to be sure of what they saw.
     */
    /*
     * Witnesses deter it, but they cannot deter it away entirely: a zone holds
     * a dozen people on an average cycle, and a per-head deterrent at that
     * scale is a prohibition wearing a probability's clothes. It was, in the
     * first version — `cut` measured 0 across 200 runs partly because of this
     * and partly because the rescuer was always somebody's friend.
     */
    const witnesses = getAlive(state).filter(o =>
        o.id !== rescuer.id && o.id !== stranded.id && o.zone === rescuer.zone).length;
    const deterrent = Math.min(RESCUE_LINE.cutMaxDeterrent, witnesses * RESCUE_LINE.cutWitnessDeterrent);
    const cutChance = Math.max(0, ARCHETYPES[rescuer.archetype].treachery) * RESCUE_LINE.cutTreacheryWeight
        + Math.max(0, -getRel(rescuer, stranded.id)) * RESCUE_LINE.cutPerDislike
        - deterrent;
    if (ctx.rng.chance(cutChance)) {
        /*
         * AUDIT-10 F05: a cut line is a murder, and the record has to say so.
         *
         * The cause was `Dropped in <zone> when the anchor went` with
         * `kind: 'tribute'` and the cutter as the source — three statements
         * that do not agree. `killTribute` writes `Killed by <name>` for every
         * tribute-dealt death and everything downstream keys off that prefix:
         * the soak asserts the obituary names the recorded killer, and the
         * metrics script buckets anything it does not recognise as a hazard,
         * so this read as death by scenery and moved two indicators. The prose
         * about the anchor is elaboration and belongs *after* the prefix.
         *
         * `code: 'fall'` was the same disagreement in the taxonomy: a person
         * did this. The fall is how, not who.
         */
        const cause = `Killed by ${rescuer.name}, who cut the line in ${stranded.zone} and let the anchor take the blame`;
        record(ctx, { rescuerId: rescuer.id, strandedId: stranded.id, zone: stranded.zone, anchor: anchor.kind, stranding, outcome: 'cut', rope: anchor.rope });
        /*
         * AUDIT-10 F05: a downed victim is outside the damage system.
         *
         * `applyDamage` and `checkDeath` both refuse an already-downed tribute
         * on purpose — `applyStatusDamage` runs bleeding, infection, venom and
         * thirst through the same funnel every cycle, and a downed tribute sits
         * at exactly 0 health, so any damage that landed would close the rescue
         * window to zero cycles wide. Which meant this branch recorded a cut,
         * incremented betrayal, and left the victim downed with no new attacker
         * attribution at all: a murder the engine declined to notice.
         *
         * So the cut goes through the downed state machine instead of around
         * it. `cutDownedLine` is a lethal *interruption* — it ends the window
         * now and credits the cutter — while ordinary status damage keeps the
         * clock it has always had.
         */
        const wasDowned = isDowned(stranded);
        if (wasDowned) {
            cutDownedLine(ctx, stranded, cause, rescuer);
        } else {
            applyDamage(ctx, stranded, RESCUE_LINE.fallDamage, {
                cause, kind: 'tribute', sourceId: rescuer.id, code: 'tribute',
            });
            openWound(stranded, BLEEDING.combatSeverity);
            clampTribute(stranded);
        }
        ctx.logEvent(
            `The line goes slack. ${rescuer.name} is holding the cut end of it, and ${stranded.name} is not on the other one.`
            + (witnesses > 0
                ? ` ${witnesses === 1 ? 'One person' : `${witnesses} people`} saw enough to wonder.`
                : ' Nobody else was close enough to see how it happened.'),
            [rescuer.id, stranded.id],
            { type: 'rescue-line-failed', important: true, zone: stranded.zone, category: 'betrayal' },
        );
        // Attributed only to what a witness could actually know.
        if (witnesses > 0) {
            getAlive(state)
                .filter(o => o.id !== rescuer.id && o.id !== stranded.id && o.zone === rescuer.zone)
                .forEach(o => adjustRel(o, rescuer.id, -RESCUE_LINE.cutWitnessRegard));
        }
        rescuer.betrayalsCommitted = (rescuer.betrayalsCommitted ?? 0) + 1;
        // Already resolved through the downed machine when they were down.
        if (!wasDowned) checkDeath(ctx, stranded, cause);
        return;
    }

    /*
     * The anchor roll. Load still on the line makes it worse; a rigged anchor
     * and a practised climber make it better. This is the failure mode nobody
     * chose, and it is the one the warning above was about.
     */
    const stillLoaded = overloaded && droppedLoad.length === 0;
    const hold = anchor.quality
        + profOf(rescuer, 'climbing') * RESCUE_LINE.perClimbingPoint
        - (stillLoaded ? RESCUE_LINE.overloadedPenalty : 0)
        - (stranding === 'downed' ? RESCUE_LINE.deadWeightPenalty : 0);

    if (!ctx.rng.chance(Math.max(RESCUE_LINE.minHold, Math.min(RESCUE_LINE.maxHold, hold)))) {
        const outcome: RescueLineRecord['outcome'] = stillLoaded ? 'overloaded' : 'anchor-failed';
        record(ctx, { rescuerId: rescuer.id, strandedId: stranded.id, zone: stranded.zone, anchor: anchor.kind, stranding, outcome, rope: anchor.rope });
        // Who it goes badly for. An anchor that tears out takes whoever was
        // braced against it; a load that drags takes the person holding it.
        const victim = outcome === 'overloaded' ? stranded
            : ctx.rng.chance(RESCUE_LINE.rescuerFallsShare) ? rescuer : stranded;
        const cause = outcome === 'overloaded'
            ? `Dragged down in ${stranded.zone} by what they would not let go of`
            : `Fell in ${stranded.zone} when the anchor went`;
        // F05, the accidental twin of the cut: an anchor that tears out under
        // a downed person has to reach them through the same door, or it is a
        // fall the engine silently declines to apply.
        const victimDowned = isDowned(victim);
        if (victimDowned) {
            cutDownedLine(ctx, victim, cause, undefined);
        } else {
            applyDamage(ctx, victim, RESCUE_LINE.fallDamage, { cause, kind: 'arena', code: 'fall' });
            openWound(victim, BLEEDING.combatSeverity);
            clampTribute(victim);
        }
        ctx.logEvent(
            outcome === 'overloaded'
                ? `${stranded.name} will not let go of the pack, and the pack is heavier than they are strong. `
                  + `${rescuer.name} holds on for as long as anybody could.`
                /*
                 * Both of them are named, because the line is about both of
                 * them — `check-unnamed`'s rule, and it caught this one at 51
                 * occurrences: the anchor tearing out is as much a thing that
                 * happened to the person braced against it as to the person
                 * on the end of it.
                 */
                : `The anchor comes out of the ground with a sound like a tooth coming loose. `
                  + `${victim.name} goes with it, and ${victim.id === rescuer.id ? stranded.name : rescuer.name} `
                  + 'is left holding a line with nothing on the end of it.',
            [rescuer.id, stranded.id],
            { type: 'rescue-line-failed', important: true, zone: stranded.zone, category: 'survival' },
        );
        if (!victimDowned) checkDeath(ctx, victim, cause);
        return;
    }

    /*
     * It works. The non-fatal branch the batch gate asks for — and it is not
     * free: hauling somebody up a face costs the rescuer the day's strength
     * and, if their hands were full, something out of them.
     */
    /*
     * AUDIT-10 F04: a successful haul has to have a physical result.
     *
     * This branch recorded `clean`, charged fatigue and awarded debt and
     * regard — and changed position only for `stranding === 'below'`. For a
     * downed tribute it ended with health 0, the `downed` marker still set, and
     * nothing moved: a scene that reported success with no corresponding result
     * anywhere in the state. `postActionUpkeep` then ran the independent
     * rescue/execution clock over them exactly as though nobody had come.
     *
     * The fix is not to make every haul a medical revival — that would delete
     * the most interesting outcome in the chain, which is somebody arriving in
     * time and it still not being enough. Three separate reliefs:
     *
     *   - **extracted**: they are somewhere else, out of what was going to
     *     finish them. The vertical case, and the downed case in a zone whose
     *     lower level is on fire or under water.
     *   - **stabilized**: they did not move, but the window measurably widened
     *     — `widenRescueWindow` adds cycles to the downed clock, which is the
     *     explicit improvement the audit asks for in place of a silent one.
     *   - **revived**: back on their feet. Only `tickDowned`'s medical clock
     *     ever does this, and it can still fail.
     */
    let relief: NonNullable<RescueLineRecord['relief']>;
    if (stranding === 'below') {
        stranded.zoneLevel = 'upper';
        relief = 'extracted';
    } else if (isVertical(state.arena, stranded.zone) && (stranded.zoneLevel ?? 'upper') === 'lower') {
        // Downed at the bottom of something: hauling them up is the extraction,
        // and it takes the drop, the water or the fire out of the equation.
        stranded.zoneLevel = 'upper';
        widenRescueWindow(stranded, RESCUE_LINE.extractionCycles);
        relief = 'extracted';
    } else {
        widenRescueWindow(stranded, RESCUE_LINE.extractionCycles);
        relief = 'stabilized';
    }
    record(ctx, { rescuerId: rescuer.id, strandedId: stranded.id, zone: stranded.zone, anchor: anchor.kind, stranding, outcome: 'clean', relief, rope: anchor.rope });
    rescuer.vitals.fatigue = Math.min(100, rescuer.vitals.fatigue + RESCUE_LINE.rescuerFatigue);
    let rescuerDropped: Item | undefined;
    if (encumbranceOf(rescuer) > RESCUE_LINE.loadLine && rescuer.inventory.length > 0) {
        rescuerDropped = rescuer.inventory.pop();
    }
    trainProficiency(rescuer, 'climbing', ctx);
    incurDebt(stranded, rescuer, RESCUE_LINE.debt, ctx);
    adjustMutual(state, rescuer, stranded, RESCUE_LINE.regard);
    witnessKindness(ctx, rescuer, stranded);
    clampTribute(rescuer);
    ctx.logEvent(
        // The line says which of the three things happened, because they are
        // three different scenes and reading them as one is what let a haul
        // that left somebody unconscious on the ground read as a rescue.
        (relief === 'extracted'
            ? `${stranded.name} comes up out of ${stranded.zone} on ${rescuer.name}'s line`
                + (stranding === 'downed'
                    ? ', limp, breathing, and no longer in the part of it that was going to finish them.'
                    : ', and lies on the ground next to them while both of them work out how to breathe again.')
            : `${rescuer.name} gets the line round ${stranded.name} and braces it. `
                + `${stranded.name} does not come round, but they stop sliding, and that buys whoever can do something about it a little longer to arrive.`)
        + (rescuerDropped ? ` ${rescuer.name}'s ${rescuerDropped.name} is somewhere at the bottom; it had to be.` : ''),
        [rescuer.id, stranded.id],
        { type: 'rescue-line-held', important: true, zone: stranded.zone, category: 'survival' },
    );
}

function record(ctx: SimContext, r: Omit<RescueLineRecord, 'cycle' | 'read'>) {
    ctx.state.rescueLines = ctx.state.rescueLines ?? [];
    ctx.state.rescueLines.push({ ...r, cycle: cycleOf(ctx.state) });
}

/**
 * The follow-up the batch gate requires: a cycle or two later, something that
 * reads what actually happened rather than restating that it happened.
 *
 * This is the part the audit is most insistent about and the part content
 * packages usually skip — *"Add a follow-up one or two cycles later that
 * reads the actual result"*, and *"The minimum useful event package is not
 * three synonyms for a death: it is setup, choice, consequence and a
 * remembered result."* Each branch reads a different field of the record, so
 * a cut line and a torn-out anchor produce different afterwards.
 */
export function tickRescueAftermath(ctx: SimContext) {
    const state = ctx.state;
    if (!state.rescueLines?.length) return;
    const cycle = cycleOf(state);
    const byId = new Map(state.tributes.map(t => [t.id, t]));

    state.rescueLines.forEach(r => {
        if (r.read) return;
        if (cycle < r.cycle + RESCUE_LINE.aftermathCycles) return;
        r.read = true;

        const rescuer = byId.get(r.rescuerId);
        const stranded = byId.get(r.strandedId);
        if (!rescuer || !stranded) return;

        /*
         * AUDIT-10 F13: say what the record knows, and check the rest.
         *
         * Both branches below asserted continuous history nobody had recorded.
         * "has not been further than arm's reach since" was printed over two
         * people standing in different sectors, and "still has the rope" was
         * printed over a cutter whose anchor was a knotted jacket and who may
         * have dropped whatever line there was two cycles ago. An incident is
         * evidence for what happened at the incident; a claim about *since*
         * needs either a record of the interval or wording that does not make
         * one.
         */
        if (r.outcome === 'clean' && rescuer.status === 'alive' && stranded.status === 'alive') {
            const together = samePlace(state.arena, rescuer, stranded);
            ctx.logEvent(
                together
                    ? `${stranded.name} has not said much about ${r.zone}, and is still within arm's reach of `
                        + `${rescuer.name}. Some debts do not get discharged so much as carried about.`
                    : `${stranded.name} has not said much about ${r.zone}, and is a long way from `
                        + `${rescuer.name} now. The debt travelled anyway; they always do.`,
                [rescuer.id, stranded.id],
                { type: 'rescue-line-remembered', zone: stranded.zone, category: 'alliance' },
            );
            return;
        }
        if (r.outcome === 'cut' && rescuer.status === 'alive') {
            // Only claim the rope if there was one and they still have it.
            const stillHas = r.rope === true && rescuer.inventory.some(i =>
                (i.ropeLength ?? 0) >= RESCUE_LINE.minRopeLength
                && (i.tensileStrength ?? 0) >= RESCUE_LINE.minTensile);
            ctx.logEvent(
                stillHas
                    ? `${rescuer.name} still has the rope. Whatever they tell themselves about ${r.zone}, they kept the rope.`
                    : `${rescuer.name} does not have the line any more, and has not explained where it went. `
                        + `Whatever they tell themselves about ${r.zone}, they are telling it without the evidence in their hands.`,
                [rescuer.id],
                { type: 'rescue-line-remembered', zone: rescuer.zone, category: 'betrayal' },
            );
            return;
        }
        if (r.outcome === 'anchor-failed' || r.outcome === 'overloaded') {
            const survivor = rescuer.status === 'alive' ? rescuer : stranded.status === 'alive' ? stranded : undefined;
            if (!survivor) return;
            ctx.logEvent(
                r.outcome === 'overloaded'
                    ? `${survivor.name} has been going through their pack, taking things out and putting them back, `
                      + 'and has not explained to anybody what the exercise is.'
                    : `${survivor.name} does not go near the edge in ${r.zone} any more, and tests anything they tie off to twice.`,
                [survivor.id],
                { type: 'rescue-line-remembered', zone: survivor.zone, category: 'survival' },
            );
        }
    });
}
