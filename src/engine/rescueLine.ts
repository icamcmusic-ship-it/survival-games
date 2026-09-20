import { GameState, Item, RescueLineRecord, Tribute } from '../models/types';
import { SimContext, getAlive } from './context';
import { RESCUE_LINE, BLEEDING } from '../data/balance';
import { applyDamage, checkDeath } from './combat';
import { isActive, isDowned } from './downed';
import { isVertical } from './verticality';
import { hasEffect } from './zoneEffects';
import { encumbranceOf } from './items';
import { profOf, trainProficiency } from './proficiency';
import { cycleOf } from './memory';
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
function anchorFor(t: Tribute): { kind: RescueLineRecord['anchor']; quality: number } {
    const rope = t.inventory.find(i => i.type === 'utility' || i.type === 'tool');
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
     * a skill that shows up once, under load, at the worst moment. It also
     * gives that trait a use in the one situation its own description is
     * about — its three existing mods are a grapple, a trap and highland
     * movement, none of which is a rope holding a person.
     *
     * Practised climbing still counts, at a bar low enough to be reachable.
     */
    const knows = t.traits.includes('Rope-Handed')
        || profOf(t, 'climbing') >= RESCUE_LINE.goodAnchorClimbing;
    if (rope && knows) return { kind: 'rigged', quality: RESCUE_LINE.riggedQuality };
    if (rope) return { kind: 'rope', quality: RESCUE_LINE.ropeQuality };
    return { kind: 'improvised', quality: RESCUE_LINE.improvisedQuality };
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

        const rescuers = getAlive(state).filter(o =>
            o.id !== stranded.id
            && isActive(o)
            && o.zone === stranded.zone
            && !isDowned(o));
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
        const rescuer = rescuers
            .map(o => ({ o, w: willingness(o, stranded) }))
            .sort((a, b) => b.w - a.w)[0].o;
        if (!ctx.rng.chance(Math.max(0, Math.min(RESCUE_LINE.maxWillingness, willingness(rescuer, stranded))))) return;
        if (rescuer.health < RESCUE_LINE.rescuerMinHealth) return;

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
        record(ctx, { rescuerId: rescuer.id, strandedId: stranded.id, zone: stranded.zone, anchor: anchor.kind, stranding, outcome: 'cut' });
        applyDamage(ctx, stranded, RESCUE_LINE.fallDamage, {
            cause: `Dropped in ${stranded.zone} when the anchor went`,
            kind: 'tribute', sourceId: rescuer.id, code: 'fall',
        });
        openWound(stranded, BLEEDING.combatSeverity);
        clampTribute(stranded);
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
        checkDeath(ctx, stranded, `Dropped in ${stranded.zone} when the anchor went`);
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
        record(ctx, { rescuerId: rescuer.id, strandedId: stranded.id, zone: stranded.zone, anchor: anchor.kind, stranding, outcome });
        // Who it goes badly for. An anchor that tears out takes whoever was
        // braced against it; a load that drags takes the person holding it.
        const victim = outcome === 'overloaded' ? stranded
            : ctx.rng.chance(RESCUE_LINE.rescuerFallsShare) ? rescuer : stranded;
        const cause = outcome === 'overloaded'
            ? `Dragged down in ${stranded.zone} by what they would not let go of`
            : `Fell in ${stranded.zone} when the anchor went`;
        applyDamage(ctx, victim, RESCUE_LINE.fallDamage, { cause, kind: 'arena', code: 'fall' });
        openWound(victim, BLEEDING.combatSeverity);
        clampTribute(victim);
        ctx.logEvent(
            outcome === 'overloaded'
                ? `${stranded.name} will not let go of the pack, and the pack is heavier than they are strong. `
                  + `${rescuer.name} holds on for as long as anybody could.`
                : `The anchor comes out of the ground with a sound like a tooth coming loose. `
                  + `${victim.name} goes with it.`,
            [rescuer.id, stranded.id],
            { type: 'rescue-line-failed', important: true, zone: stranded.zone, category: 'survival' },
        );
        checkDeath(ctx, victim, cause);
        return;
    }

    /*
     * It works. The non-fatal branch the batch gate asks for — and it is not
     * free: hauling somebody up a face costs the rescuer the day's strength
     * and, if their hands were full, something out of them.
     */
    record(ctx, { rescuerId: rescuer.id, strandedId: stranded.id, zone: stranded.zone, anchor: anchor.kind, stranding, outcome: 'clean' });
    if (stranding === 'below') stranded.zoneLevel = 'upper';
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
        `${stranded.name} comes up out of ${stranded.zone} on ${rescuer.name}'s line, and lies on the ground next to them `
        + 'while both of them work out how to breathe again.'
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

        if (r.outcome === 'clean' && rescuer.status === 'alive' && stranded.status === 'alive') {
            ctx.logEvent(
                `${stranded.name} has not said much about ${r.zone}, and has not been further than arm's reach from `
                + `${rescuer.name} since. Some debts do not get discharged so much as carried about.`,
                [rescuer.id, stranded.id],
                { type: 'rescue-line-remembered', zone: stranded.zone, category: 'alliance' },
            );
            return;
        }
        if (r.outcome === 'cut' && rescuer.status === 'alive') {
            ctx.logEvent(
                `${rescuer.name} still has the rope. Whatever they tell themselves about ${r.zone}, they kept the rope.`,
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
