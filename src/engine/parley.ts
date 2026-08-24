import { Item, Tribute, TruceReason } from '../models/types';
import { COMPOSURE, INTEL, PARLEY, PROFICIENCY, RESPECT, ROMANCE } from '../data/balance';
import { RNG } from '../utils/rng';
import { PARLEY_TEXTS } from '../data/flavorText';
import { ARCHETYPES } from '../data/archetypes';
import { traitMod } from '../data/traits';
import { SimContext, getAlive } from './context';
import { assessZone } from './stance';
import { adjustMutual, adjustRel, getRel, respectOf } from './relationships';
import { addZoneThreat, cycleOf, ensureMemory, lieAboutZone, noteStoodBy, raiseSuspicion, rememberedThreat, shareZoneIntel, swearVengeance } from './memory';
import { areLovers, maintainPerformance } from './alliance';
import { earnTrait } from './earnedTraits';
import { giveItem, itemPhrase } from './items';
import { fearOf } from './fear';
import { profOf, trainProficiency } from './proficiency';
import { clampTribute } from './vitals';
import { addExcitement } from './audience';
import { isAggressiveStance } from '../data/stances';

/**
 * Talking instead of fighting.
 *
 * `resolvePairEncounter` had four outcomes: peaceful, friendly, combat and
 * desperation. Two strangers who met in a clearing either fought or exchanged
 * pleasantries — there was no way to model the far more common thing, which is
 * two frightened people negotiating their way out of a fight neither of them
 * can afford.
 *
 * Three outcomes, all of which are decisions rather than dice:
 *
 *  - **standoff** — both armed, both aware, neither with an advantage worth
 *    taking. They back out of the clearing watching each other's hands. Nobody
 *    gains anything except the knowledge of where the other one is.
 *  - **tribute** — one of them is clearly outmatched and pays to be allowed to
 *    leave. That is a real transfer of supplies, and a real humiliation.
 *  - **truce** — an explicit, expiring non-aggression pact. Neither has to like
 *    the other; they simply both prefer the odds elsewhere.
 */

export type ParleyOutcome = 'standoff' | 'tribute' | 'truce' | null;

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

/** Cycle a truce between these two runs out on, if one is standing. */
export function truceWith(t: Tribute, otherId: string): number | undefined {
    return t.truces?.[otherId];
}

export function hasTruce(state: { cycle?: number }, t: Tribute, otherId: string): boolean {
    const until = truceWith(t, otherId);
    return until !== undefined && (state.cycle ?? 0) < until;
}

/**
 * A2: a truce struck by somebody other than the two parties.
 *
 * The Diplomat's whole mechanical identity — brokering an agreement between
 * two people who are not them — needs a way to write a truce that
 * `declareTruce`'s parley-local shape does not offer.
 */
export function grantTruce(ctx: SimContext, a: Tribute, b: Tribute, cycles: number, reason: TruceReason = 'brokered') {
    const until = cycleOf(ctx.state) + cycles;
    a.truces = { ...(a.truces ?? {}), [b.id]: until };
    b.truces = { ...(b.truces ?? {}), [a.id]: until };
    a.truceReason = { ...(a.truceReason ?? {}), [b.id]: reason };
    b.truceReason = { ...(b.truceReason ?? {}), [a.id]: reason };
}

/**
 * §4.3: has the reason this truce exists stopped being true?
 *
 * This is what turns a truce from a cycle counter into an agreement about
 * something. Two tributes who shook hands because they were both bleeding are
 * done the moment they both stop; two who shook hands against a Career pack are
 * done when the pack is. Returning true here brings the resolution scene
 * forward — it never extends a truce past its cycle count.
 */
function reasonSpent(ctx: SimContext, a: Tribute, b: Tribute): boolean {
    const reason = a.truceReason?.[b.id] ?? b.truceReason?.[a.id];
    switch (reason) {
        case 'both-wounded':
            return a.health >= PARLEY.truceHealedHealth && b.health >= PARLEY.truceHealedHealth
                && !a.injuries.bleeding && !b.injuries.bleeding;
        case 'mutual-threat': {
            const pair = new Set([a.id, b.id]);
            return !getAlive(ctx.state).some(o =>
                !pair.has(o.id) && (o.isCareer || o.kills >= PARLEY.truceThreatKills));
        }
        case 'extortion':
        case 'brokered':
        default:
            return false;
    }
}

function declareTruce(ctx: SimContext, a: Tribute, b: Tribute) {
    const until = cycleOf(ctx.state) + PARLEY.truceCycles;
    a.truces = { ...(a.truces ?? {}), [b.id]: until };
    b.truces = { ...(b.truces ?? {}), [a.id]: until };
    // §4.3: a truce is about something. Which of the two obvious reasons it is
    // decides when it comes due — not a cycle counter that means nothing to
    // either of them.
    const reason: TruceReason = (a.health < PARLEY.truceHealedHealth && b.health < PARLEY.truceHealedHealth)
        || a.injuries.bleeding || b.injuries.bleeding
        ? 'both-wounded'
        : 'mutual-threat';
    a.truceReason = { ...(a.truceReason ?? {}), [b.id]: reason };
    b.truceReason = { ...(b.truceReason ?? {}), [a.id]: reason };
    // §11.1: a parley is a stage. A performer plays the negotiation warm.
    maintainPerformance(a, b.id, ROMANCE.performedUpkeep);
    maintainPerformance(b, a.id, ROMANCE.performedUpkeep);
}

/** §10.1: 'Toll Collector' — who this tribute has shaken down, deduplicated. */
function noteExtortion(stronger: Tribute, weakerId: string) {
    stronger.extortedIds = stronger.extortedIds ?? [];
    if (!stronger.extortedIds.includes(weakerId)) stronger.extortedIds.push(weakerId);
}

/** Tears up a standing truce from both sides, so neither is still honouring it. */
function clearTruce(a: Tribute, b: Tribute) {
    if (a.truces) delete a.truces[b.id];
    if (b.truces) delete b.truces[a.id];
    if (a.truceReason) delete a.truceReason[b.id];
    if (b.truceReason) delete b.truceReason[a.id];
}

/**
 * Whether `t` breaks a standing truce with `other` right now.
 *
 * Opportunism, on the same shape as betrayal targeting: how treacherous they
 * are, how winnable this particular fight looks from where they stand, and how
 * few people are left. Someone who has already been sold out themselves is
 * markedly less willing to do it to somebody else — the one restraint in here,
 * and the one that makes a kept truce mean something.
 */
export function breaksTruce(ctx: SimContext, t: Tribute, other: Tribute): boolean {
    // A bond you actually feel is not a truce you are looking to escape.
    if (areLovers(t, other)) return false;
    if (t.allianceId !== undefined && t.allianceId === other.allianceId) return false;

    let chance = PARLEY.truceBreakBase
        + (ARCHETYPES[t.archetype].treachery + traitMod(t, 'treachery')) * PARLEY.truceBreakTreacheryWeight;

    // How this matchup reads to the breaker — through the perception layer, so
    // a concealed tribute is not obviously easy prey.
    const ratio = assessZone(other, [other, t], ctx.state).ratio;
    if (ratio > PARLEY.truceBreakOpportunismRatio) chance += PARLEY.truceBreakOpportunismBonus;

    const alive = ctx.state.tributes.filter(o => o.status === 'alive').length;
    if (alive <= PARLEY.truceBreakEndgameFieldSize) chance += PARLEY.truceBreakEndgameBonus;

    // Genuine regard is what holds a promise together when nothing else does.
    chance *= Math.max(0.05, 1 - Math.max(0, getRel(t, other.id)) / 110);
    // §4.1: and so is professional esteem — you do not cross someone you rate.
    chance *= Math.max(0.3, 1 - Math.max(0, respectOf(t, other.id)) / RESPECT.truceRestraintDivisor);
    if (ensureMemory(t).betrayedBy.length > 0) chance *= PARLEY.truceBreakBetrayedRestraint;
    // §8: the other party's persuasion. Someone who is good at this does not
    // only talk you into an agreement, they keep talking you out of leaving
    // it — which is the read site persuasion was missing, and the reason a
    // charisma build's investment stopped paying the moment the truce existed.
    chance *= Math.max(0.35, 1 - profOf(other, 'persuasion') * PROFICIENCY.persuasionRestraintWeight);

    return breakChanceOf(ctx, chance);
}

/** Probability post-processing hook — kept separate so `resolveTrucePair` and
 *  the encounter path share one clamp. */
function breakChanceOf(ctx: SimContext, chance: number): boolean {
    return ctx.rng.chance(Math.max(0, Math.min(0.75, chance)));
}

/**
 * §4.2: one break decision per pair per cycle, not one roll per party per
 * encounter. Truce survival used to decay geometrically in encounters — two
 * tributes camping the same sector re-rolled the coin every time they laid
 * eyes on each other, so of 141 declared truces only 5 were ever *held*.
 * The decision is drawn deterministically from (seed, cycle, pair), so a
 * second meeting in the same cycle cannot re-litigate it; `breaksTruce`
 * still supplies each party's inclination.
 */
function truceBreakerThisCycle(ctx: SimContext, a: Tribute, b: Tribute): Tribute | null {
    const [lo, hi] = a.id < b.id ? [a, b] : [b, a];
    const roll = new RNG(`${ctx.state.seed}-truce-${cycleOf(ctx.state)}-${lo.id}-${hi.id}`).nextFloat();
    // Each party gets the front section of the unit interval proportional to
    // their own inclination; the shared roll lands in at most one of them.
    const chanceLo = truceBreakChance(ctx, lo, hi);
    const chanceHi = truceBreakChance(ctx, hi, lo);
    if (roll < chanceLo) return lo;
    if (roll < chanceLo + chanceHi) return hi;
    return null;
}

/** The bare probability `breaksTruce` would roll against. */
function truceBreakChance(ctx: SimContext, t: Tribute, other: Tribute): number {
    if (areLovers(t, other)) return 0;
    if (t.allianceId !== undefined && t.allianceId === other.allianceId) return 0;
    let chance = PARLEY.truceBreakBase
        + (ARCHETYPES[t.archetype].treachery + traitMod(t, 'treachery')) * PARLEY.truceBreakTreacheryWeight;
    const ratio = assessZone(other, [other, t], ctx.state).ratio;
    if (ratio > PARLEY.truceBreakOpportunismRatio) chance += PARLEY.truceBreakOpportunismBonus;
    const alive = ctx.state.tributes.filter(o => o.status === 'alive').length;
    if (alive <= PARLEY.truceBreakEndgameFieldSize) chance += PARLEY.truceBreakEndgameBonus;
    chance *= Math.max(0.05, 1 - Math.max(0, getRel(t, other.id)) / 110);
    chance *= Math.max(0.3, 1 - Math.max(0, respectOf(t, other.id)) / RESPECT.truceRestraintDivisor);
    if (ensureMemory(t).betrayedBy.length > 0) chance *= PARLEY.truceBreakBetrayedRestraint;
    return Math.max(0, Math.min(0.75, chance));
}

/**
 * Carries out the break: the agreement is gone, and the arena knows it. The
 * fight itself is the caller's business — this is only the bookkeeping and the
 * line the audience reads.
 */
export function breakTruce(ctx: SimContext, breaker: Tribute, victim: Tribute) {
    clearTruce(breaker, victim);
    adjustRel(victim, breaker.id, -PARLEY.truceBreakRegard);
    // Going back on your word costs you with the person you did it to, and with
    // everyone watching from the Capitol who was told there was an agreement.
    raiseSuspicion(victim, breaker.id, PARLEY.truceBreakSuspicion);
    swearVengeance(victim, breaker.id);
    breaker.reputation = Math.max(0, breaker.reputation - PARLEY.truceBreakReputationCost);
    addExcitement(breaker, PARLEY.truceBreakExcitement);
    clampTribute(breaker);
    clampTribute(victim);
    ctx.logEvent(
        fill(ctx.pickText(PARLEY_TEXTS.truceBroken), { breaker: breaker.name, victim: victim.name, zone: breaker.zone }),
        [breaker.id, victim.id],
        { important: true, category: 'betrayal' }
    );
}

/**
 * The most expendable thing a tribute is carrying — what they would hand over.
 * Never their only weapon: paying with that is not buying your life, it is
 * postponing the same fight under worse terms.
 */
function tributePayment(t: Tribute): Item | undefined {
    const weapons = t.inventory.filter(i => i.type === 'weapon').length;
    const spare = t.inventory.filter(i => i.type !== 'weapon' || weapons > 1);
    if (spare.length === 0) return undefined;
    return spare.reduce((worst, i) => (i.value < worst.value ? i : worst));
}

/**
 * Decides whether this meeting is a negotiation, and resolves it if so.
 * Returns the outcome, or null to let the caller fall through to its normal
 * peaceful/friendly/combat handling.
 */
export function tryParley(ctx: SimContext, t: Tribute, other: Tribute): ParleyOutcome {
    // A standing truce is itself the outcome: they have already had this
    // conversation and both are still honouring it — unless one of them has
    // decided, right now, that they are not. Either party can be the one who
    // goes back on it; returning null drops the caller through to combat,
    // which is exactly what a broken truce should become.
    if (hasTruce(ctx.state, t, other.id)) {
        // §4.2: one decision per pair per cycle — meeting twice in a day does
        // not re-roll the coin, so a kept truce is actually keepable.
        const breaker = truceBreakerThisCycle(ctx, t, other);
        if (breaker) {
            breakTruce(ctx, breaker, breaker === t ? other : t);
            return null;
        }
        ctx.logEvent(
            fill(ctx.pickText(PARLEY_TEXTS.truceHeld), { t1: t.name, t2: other.name, zone: t.zone }),
            [t.id, other.id],
            { category: 'alliance' }
        );
        return 'truce';
    }

    const tArmed = t.inventory.some(i => i.type === 'weapon');
    const otherArmed = other.inventory.some(i => i.type === 'weapon');
    // How each of them reads the matchup, using the same estimate the stance
    // layer does — so a concealer's disguise and a Career's reputation both
    // count, and neither side is reading the other's sheet.
    const tRatio = assessZone(t, [t, other], ctx.state).ratio;
    const otherRatio = assessZone(other, [other, t], ctx.state).ratio;

    // TRIBUTE: one of them knows they lose. Paying is better than dying, and
    // the stronger one has to be willing to take payment rather than blood.
    const tOutmatched = tRatio > PARLEY.outmatchedRatio;
    const otherOutmatched = otherRatio > PARLEY.outmatchedRatio;
    // §1.11: the shakedown was reachable and effectively never reached —
    // `tributesPaid` measured 1 across 400 runs and `paidInInformation` 6.
    // The gating was the cause: the early return below fires precisely for the
    // *confident* aggressor, which is the one party a shakedown needs, so the
    // branch was gated shut by the same condition that creates its
    // opportunity. An asymmetric hostile meeting now reaches the extortion
    // block first and only falls through to the knife afterwards.
    const shakedownOnTheTable = tOutmatched !== otherOutmatched;

    // Anyone genuinely committed to a fight is not negotiating — except that
    // a confident predator sometimes prefers the shakedown to the kill: the
    // toll costs nothing and the crowd loves it.
    const extortInstead = ctx.rng.chance(PARLEY.aggressiveExtortChance);
    const committedToTheFight =
        (isAggressiveStance(t.stance) && tRatio < PARLEY.confidentRatio)
        || (isAggressiveStance(other.stance) && otherRatio < PARLEY.confidentRatio);
    // Deferred rather than an immediate return: a committed aggressor with a
    // shakedown available takes the toll instead, and only reaches for the
    // knife if the toll does not come off.
    if (committedToTheFight && !extortInstead && !shakedownOnTheTable) return null;

    const mutualRegard = Math.min(getRel(t, other.id), getRel(other, t.id));
    const mutualFear = Math.max(fearOf(t, other.id), fearOf(other, t.id));

    if (shakedownOnTheTable) {
        const weaker = tOutmatched ? t : other;
        const stronger = tOutmatched ? other : t;
        const payment = tributePayment(weaker);
        // §8.3 widened the item catalogue enough that empty hands went rare,
        // which starved this branch — so the shakedown sometimes wants
        // directions even from a tribute with something in their pack.
        const wantsInfo = !payment || ctx.rng.chance(PARLEY.tollInfoPreferenceChance);
        // §1.4: getting somebody to hand over their supplies rather than fight
        // for them is a persuasion problem, and the stronger party's skill at
        // it is what decides whether the shakedown comes off.
        const tollChance = PARLEY.tributeChance
            + profOf(stronger, 'persuasion') * PROFICIENCY.persuasionTollWeight;
        if (wantsInfo && ctx.rng.chance(tollChance)) {
            // Nothing spare to hand over. Someone with empty hands is exactly
            // the tribute most likely to be shaken down, and they still have
            // the only thing everyone in an arena wants: where the bodies
            // turned up. Paying in directions is a real transfer — the
            // stronger party walks away knowing what the weaker one learned
            // the hard way — and it is why the extortion branch is reachable
            // at all now that most of its candidates carry nothing.
            //
            // §9.7: and it is a real transfer now rather than a line claiming
            // one. It used to require the weaker party to know somewhere that
            // had already frightened them — which is the wrong gate entirely,
            // because the tribute with nothing in their pack is usually the
            // one who has been keeping their head down and knows where the
            // water is, not the one who has been watching people die. Anything
            // they know is currency. Whether it is *true* is up to them.
            const known = Object.keys(ensureMemory(weaker).zones)
                .map(zone => ({ zone, threat: rememberedThreat(ctx.state, weaker, zone) }))
                .filter(z => z.threat >= PARLEY.tollInfoMinThreat)
                .sort((a, b) => b.threat - a.threat);
            const worst = known[0];
            // A frightened tribute buying their life is exactly the person most
            // tempted to buy it with a story — and the stronger party has no
            // way to check until they are standing in it.
            const lieChance = INTEL.lieChanceBase
                + Math.max(0, treacheryOf(weaker)) * INTEL.lieChancePerTreachery;
            const told = ctx.rng.chance(lieChance)
                ? [lieAboutZone(ctx, weaker, stronger, { silent: true })].filter((z): z is string => !!z)
                : shareZoneIntel(ctx, weaker, stronger, { silent: true });
            if (told.length > 0) {
                noteExtortion(stronger, weaker.id);
                trainProficiency(stronger, 'persuasion');
                weaker.intelSold = (weaker.intelSold ?? 0) + 1;
                // The worst place they know is thrown in on top: a warning is
                // the cheapest thing anyone in an arena can hand over.
                if (worst) addZoneThreat(ctx.state, stronger, worst.zone, worst.threat);
                adjustMutual(ctx.state, weaker, stronger, -PARLEY.tollInfoResentment);
                addExcitement(stronger, PARLEY.tributeExcitement);
                weaker.vitals.sanity -= PARLEY.tollInfoSanityCost;
                clampTribute(weaker);
                clampTribute(stronger);
                ctx.logEvent(
                    fill(ctx.pickText(PARLEY_TEXTS.tributeInformation), {
                        weak: weaker.name, strong: stronger.name, zone: weaker.zone,
                        told: worst ? worst.zone : told.join(' and '),
                    }),
                    [weaker.id, stronger.id],
                    { important: true, category: 'alliance' }
                );
                return 'tribute';
            }
        }
        if (payment && ctx.rng.chance(tollChance)) {
            noteExtortion(stronger, weaker.id);
            trainProficiency(stronger, 'persuasion');
            weaker.inventory = weaker.inventory.filter(i => i !== payment);
            giveItem(stronger, payment);
            // Being extorted is not being befriended, and the crowd loves it.
            adjustMutual(ctx.state, weaker, stronger, -PARLEY.tributeResentment);
            addExcitement(stronger, PARLEY.tributeExcitement);
            weaker.vitals.sanity -= PARLEY.tributeSanityCost;
            clampTribute(weaker);
            clampTribute(stronger);
            ctx.logEvent(
                fill(ctx.pickText(PARLEY_TEXTS.tribute), {
                    weak: weaker.name, strong: stronger.name, zone: weaker.zone, item: itemPhrase(payment),
                }),
                [weaker.id, stronger.id],
                { important: true, category: 'loot' }
            );
            return 'tribute';
        }
    }

    // The shakedown was on the table and did not come off. A tribute who was
    // only at this conversation for the toll now goes back to what they were
    // doing, which is the fight.
    if (committedToTheFight && !extortInstead) return null;

    // TRUCE: neither can see an advantage, and there is at least some basis for
    // taking the other at their word. This is the one that can later be broken.
    // §3.4: a rattled party wants out of this conversation alive more than
    // they want anything else — being shaken makes the pact more likely.
    const rattledBonus = ((t.rattled ?? 0) > 0 || (other.rattled ?? 0) > 0) ? COMPOSURE.rattledParleyBonus : 0;
    // §1.4: whoever is better at talking is the reason the conversation lands.
    // This is `persuasion`'s primary read site and the whole reason the
    // charisma station now trains something.
    const talker = Math.max(profOf(t, 'persuasion'), profOf(other, 'persuasion'));
    const persuasionBonus = talker * PROFICIENCY.persuasionTruceWeight;
    if (mutualRegard > PARLEY.truceMinRegard
        && ctx.rng.chance(PARLEY.truceChance + rattledBonus + persuasionBonus)) {
        trainProficiency(t, 'persuasion');
        trainProficiency(other, 'persuasion');
        declareTruce(ctx, t, other);
        // Agreeing to something and keeping it is the seed of a real bond —
        // and §1.4, a negotiation somebody actually talked their way through
        // leaves both parties thinking better of the other than a shrug does.
        adjustMutual(ctx.state, t, other,
            PARLEY.truceRegard + talker * PROFICIENCY.persuasionRegardWeight);
        noteStoodBy(t, other.id);
        noteStoodBy(other, t.id);
        ctx.logEvent(
            fill(ctx.pickText(PARLEY_TEXTS.truce), { t1: t.name, t2: other.name, zone: t.zone }),
            [t.id, other.id],
            { important: true, category: 'alliance' }
        );
        return 'truce';
    }

    // STANDOFF: both armed, both wary, nobody moves first. The default shape of
    // two strangers meeting in an arena that has already taught them what
    // strangers cost.
    if (tArmed && otherArmed && ctx.rng.chance(PARLEY.standoffChance + mutualFear * PARLEY.standoffPerFear)) {
        // They learn nothing about each other except that it was not worth it.
        t.vitals.fatigue += PARLEY.standoffFatigue;
        other.vitals.fatigue += PARLEY.standoffFatigue;
        clampTribute(t);
        clampTribute(other);
        ctx.logEvent(
            fill(ctx.pickText(PARLEY_TEXTS.standoff), { t1: t.name, t2: other.name, zone: t.zone }),
            [t.id, other.id],
            { important: true, category: 'combat' }
        );
        return 'standoff';
    }

    return null;
}

/**
 * §4.1: per-cycle upkeep — but expiry is a decision point, not garbage
 * collection. A negotiated non-aggression pact used to reach its expiry cycle
 * and simply vanish from the Record: no payoff scene, no acknowledgement,
 * nothing observable at all, for 80 of the 84 truces a 240-run soak produced.
 * Every truce now resolves on-screen as one of three beats:
 *
 *  - **renew** — it has been working, and both still prefer it to the odds;
 *  - **turn** — one of them kept the agreement like a blade kept sheathed,
 *    and starts hunting the other the moment it lapses (no promise broken —
 *    which is exactly the kind of technicality the Capitol loves);
 *  - **lapse** — they part as they met: armed, watchful, and both alive
 *    because a promise was kept. Still a line, because silence was the bug.
 */
export function resolveTruces(ctx: SimContext) {
    const state = ctx.state;
    const cycle = cycleOf(state);
    const byId = new Map(state.tributes.map(t => [t.id, t] as const));
    state.tributes.forEach(t => {
        if (!t.truces) return;
        Object.entries(t.truces).forEach(([otherId, until]) => {
            const other = byId.get(otherId);
            // §4.3: expiry is the earlier of the clock and the reason. A truce
            // whose reason has evaporated resolves now rather than idling out
            // its counter, which is what turned 90% of all truces into silence.
            if (cycle < until && !(other && other.status === 'alive' && reasonSpent(ctx, t, other))) return;
            // A dead counterparty leaves nothing to resolve. Clear both
            // sides of the record — leaving the mirror key on the other
            // tribute made save payloads accrete stale empty truce objects.
            if (!other || other.status !== 'alive' || t.status !== 'alive') {
                // §10.1: 'Kept Word' — a truce that had been renewed at least
                // once was still standing when one of its parties fell.
                if ((t.truceRenewed?.[otherId] ?? 0) > 0) state.keptWordSeen = true;
                // §1.4: this was the silent exit — the single largest way a
                // truce ended, and the one the Record never mentioned. A
                // promise that outlived one of the people who made it is worth
                // a line; it is also, unambiguously, a promise kept.
                if (other && t.status === 'alive' && other.status !== 'alive') {
                    state.keptWordSeen = true;
                    // §1.4: the single most common way a truce ends, and it
                    // also never reached the broker. A promise that outlived
                    // one of the people who made it was kept by definition.
                    creditBroker(ctx, t, other, 'outlived');
                    ctx.logEvent(
                        `The agreement between ${t.name} and ${other.name} ends the way most of them do: `
                        + `${other.name} is dead, and ${t.name} never once broke it.`,
                        [t.id, other.id],
                        { category: 'alliance' }
                    );
                }
                delete t.truces![otherId];
                if (t.truceReason) delete t.truceReason[otherId];
                if (other?.truces) {
                    delete other.truces[t.id];
                    if (Object.keys(other.truces).length === 0) delete other.truces;
                }
                return;
            }
            // Each pair resolves exactly once, from whichever side sorts first;
            // the resolution clears both sides of the record.
            if (t.id > otherId) return;
            resolveTrucePair(ctx, t, other);
        });
        if (t.truces && Object.keys(t.truces).length === 0) delete t.truces;
    });
}

/**
 * §1.2: the Diplomat's ledger, finally read.
 *
 * `brokeredTruces` was written by the Diplomat's signature and consulted in
 * exactly one place — to dissolve those truces when the Diplomat died. Nothing
 * ever counted them, credited them, or surfaced them, which is a large part of
 * why the archetype sits at the bottom of the table. A brokered truce that runs
 * its full term is the Diplomat's kill: it pays in the currency they actually
 * play for, which is the Capitol's regard.
 */
type BrokerOutcome = 'lapsed' | 'renewed' | 'outlived';

function creditBroker(ctx: SimContext, a: Tribute, b: Tribute, outcome: BrokerOutcome = 'lapsed') {
    getAlive(ctx.state).forEach(broker => {
        if (broker.id === a.id || broker.id === b.id) return;
        const held = broker.brokeredTruces?.some(([x, y]) =>
            (x === a.id && y === b.id) || (x === b.id && y === a.id));
        if (!held) return;
        broker.trucesBrokeredHeld = (broker.trucesBrokeredHeld ?? 0) + 1;
        broker.sponsorTrust = Math.min(100, broker.sponsorTrust + PARLEY.brokerHeldTrust);
        addExcitement(broker, PARLEY.brokerHeldExcitement);
        // A living counterparty can think better of the broker; a dead one
        // cannot, and writing to their ledger would be writing to a corpse.
        if (a.status === 'alive') adjustRel(a, broker.id, PARLEY.brokerHeldRegard);
        if (b.status === 'alive') adjustRel(b, broker.id, PARLEY.brokerHeldRegard);
        const line = outcome === 'renewed'
            ? `${a.name} and ${b.name} sit down and agree to it all over again. `
                + `The words were ${broker.name}'s the first time and they are still holding, which is more than most things in here do.`
            : outcome === 'outlived'
                ? `Whatever else the arena did to ${a.name} and ${b.name}, it never got them to break the agreement ${broker.name} talked them into. `
                    + 'One of them is dead now and it held to the end anyway.'
                : `${a.name} and ${b.name} part without a shot fired, and the agreement that held them apart was ${broker.name}'s. `
                    + 'The Capitol notices who does that; it is the rarest kind of work anyone does in there.';
        ctx.logEvent(line, [broker.id, a.id, b.id], { important: true, category: 'alliance' });
    });
}

function treacheryOf(t: Tribute): number {
    return ARCHETYPES[t.archetype].treachery + traitMod(t, 'treachery');
}

function resolveTrucePair(ctx: SimContext, a: Tribute, b: Tribute) {
    clearTruce(a, b);
    const regard = Math.min(getRel(a, b.id), getRel(b, a.id));

    // RENEW: it worked, and both of them know it.
    // §8: whichever of them is better at this carries the renewal.
    const renewTalker = Math.max(profOf(a, 'persuasion'), profOf(b, 'persuasion'));
    const renewChance = PARLEY.truceRenewChance + renewTalker * PROFICIENCY.persuasionRenewWeight;
    if (regard >= PARLEY.truceRenewMinRegard && ctx.rng.chance(renewChance)) {
        // §10.1: 'Kept Word' reads this — a truce that was renewed at least
        // once and was still standing when one party died.
        a.truceRenewed = { ...(a.truceRenewed ?? {}), [b.id]: (a.truceRenewed?.[b.id] ?? 0) + 1 };
        b.truceRenewed = { ...(b.truceRenewed ?? {}), [a.id]: (b.truceRenewed?.[a.id] ?? 0) + 1 };
        trainProficiency(a, 'persuasion');
        trainProficiency(b, 'persuasion');
        declareTruce(ctx, a, b);
        adjustMutual(ctx.state, a, b, PARLEY.truceRegard);
        // §1.4: a renewal is the *strongest* evidence a brokered agreement is
        // working — both parties have now chosen it twice — and it was the one
        // ending that paid the broker nothing. Credit was wired to LAPSE only,
        // so across 400 runs the Diplomat's signature payoff fired once: the
        // two commoner endings (renewal, and one party dying with the promise
        // intact) both returned before ever reaching it. Only a *broken* truce
        // should pay its broker nothing.
        creditBroker(ctx, a, b, 'renewed');
        ctx.logEvent(
            fill(ctx.pickText(PARLEY_TEXTS.truceRenewed), { t1: a.name, t2: b.name }),
            [a.id, b.id],
            { category: 'alliance' }
        );
        return;
    }

    // TURN: whichever of them is more treacherous was counting the hours.
    const striker = treacheryOf(a) >= treacheryOf(b) ? a : b;
    const target = striker.id === a.id ? b : a;
    const turnChance = PARLEY.truceTurnChance
        + Math.max(0, treacheryOf(striker)) * PARLEY.truceTurnTreacheryWeight;
    if (ctx.rng.chance(Math.min(0.6, turnChance))) {
        striker.objective = { kind: 'hunt', targetId: target.id, expires: cycleOf(ctx.state) + PARLEY.truceTurnHuntCycles };
        adjustRel(target, striker.id, -PARLEY.truceBreakRegard);
        raiseSuspicion(target, striker.id, PARLEY.truceBreakSuspicion);
        addExcitement(striker, PARLEY.truceBreakExcitement);
        ctx.logEvent(
            fill(ctx.pickText(PARLEY_TEXTS.truceTurned), { t1: striker.name, t2: target.name, zone: striker.zone }),
            [striker.id, target.id],
            { important: true, category: 'betrayal' }
        );
        return;
    }

    // LAPSE: kept to the end. The arena takes note, and so does the feed.
    //
    // §1.4: 'Kept Word' used to need a *renewed* truce still standing when one
    // party died, which across 400 runs happened 11 times against 218 truces —
    // an achievement gated on a coincidence. A truce that ran its full declared
    // term without either side breaking it is a kept word by any reading, and
    // it is the reading a player would use.
    ctx.state.keptWordSeen = true;
    // §1.2: and if somebody else talked them into it, they get the credit.
    creditBroker(ctx, a, b);
    ctx.logEvent(
        fill(ctx.pickText(PARLEY_TEXTS.truceLapsed), { t1: a.name, t2: b.name }),
        [a.id, b.id],
        { category: 'alliance' }
    );
    // §8.9: a promise kept all the way down is a thing the field remembers.
    earnTrait(ctx, a, 'Oathbound');
    earnTrait(ctx, b, 'Oathbound');
}
