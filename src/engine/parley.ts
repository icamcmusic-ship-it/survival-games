import { Item, Tribute } from '../models/types';
import { COMPOSURE, PARLEY, RESPECT, ROMANCE } from '../data/balance';
import { RNG } from '../utils/rng';
import { PARLEY_TEXTS } from '../data/flavorText';
import { ARCHETYPES } from '../data/archetypes';
import { traitMod } from '../data/traits';
import { SimContext } from './context';
import { assessZone } from './stance';
import { adjustMutual, adjustRel, getRel, respectOf } from './relationships';
import { addZoneThreat, cycleOf, ensureMemory, noteStoodBy, raiseSuspicion, rememberedThreat, swearVengeance } from './memory';
import { areLovers, maintainPerformance } from './alliance';
import { earnTrait } from './earnedTraits';
import { giveItem, itemPhrase } from './items';
import { fearOf } from './fear';
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

function declareTruce(ctx: SimContext, a: Tribute, b: Tribute) {
    const until = cycleOf(ctx.state) + PARLEY.truceCycles;
    a.truces = { ...(a.truces ?? {}), [b.id]: until };
    b.truces = { ...(b.truces ?? {}), [a.id]: until };
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
        if (wantsInfo && ctx.rng.chance(PARLEY.tributeChance)) {
            // Nothing spare to hand over. Someone with empty hands is exactly
            // the tribute most likely to be shaken down, and they still have
            // the only thing everyone in an arena wants: where the bodies
            // turned up. Paying in directions is a real transfer — the
            // stronger party walks away knowing what the weaker one learned
            // the hard way — and it is why the extortion branch is reachable
            // at all now that most of its candidates carry nothing.
            const known = Object.keys(ensureMemory(weaker).zones)
                .map(zone => ({ zone, threat: rememberedThreat(ctx.state, weaker, zone) }))
                .filter(z => z.threat >= PARLEY.tollInfoMinThreat)
                .sort((a, b) => b.threat - a.threat);
            const worst = known[0];
            if (worst) {
                noteExtortion(stronger, weaker.id);
                addZoneThreat(ctx.state, stronger, worst.zone, worst.threat);
                adjustMutual(ctx.state, weaker, stronger, -PARLEY.tollInfoResentment);
                addExcitement(stronger, PARLEY.tributeExcitement);
                weaker.vitals.sanity -= PARLEY.tollInfoSanityCost;
                clampTribute(weaker);
                clampTribute(stronger);
                ctx.logEvent(
                    fill(ctx.pickText(PARLEY_TEXTS.tributeInformation), {
                        weak: weaker.name, strong: stronger.name, zone: weaker.zone, told: worst.zone,
                    }),
                    [weaker.id, stronger.id],
                    { important: true, category: 'alliance' }
                );
                return 'tribute';
            }
        }
        if (payment && ctx.rng.chance(PARLEY.tributeChance)) {
            noteExtortion(stronger, weaker.id);
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
    if (mutualRegard > PARLEY.truceMinRegard && ctx.rng.chance(PARLEY.truceChance + rattledBonus)) {
        declareTruce(ctx, t, other);
        // Agreeing to something and keeping it is the seed of a real bond.
        adjustMutual(ctx.state, t, other, PARLEY.truceRegard);
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
            if (cycle < until) return;
            const other = byId.get(otherId);
            // A dead counterparty leaves nothing to resolve. Clear both
            // sides of the record — leaving the mirror key on the other
            // tribute made save payloads accrete stale empty truce objects.
            if (!other || other.status !== 'alive' || t.status !== 'alive') {
                // §10.1: 'Kept Word' — a truce that had been renewed at least
                // once was still standing when one of its parties fell.
                if ((t.truceRenewed?.[otherId] ?? 0) > 0) state.keptWordSeen = true;
                delete t.truces![otherId];
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

function treacheryOf(t: Tribute): number {
    return ARCHETYPES[t.archetype].treachery + traitMod(t, 'treachery');
}

function resolveTrucePair(ctx: SimContext, a: Tribute, b: Tribute) {
    clearTruce(a, b);
    const regard = Math.min(getRel(a, b.id), getRel(b, a.id));

    // RENEW: it worked, and both of them know it.
    if (regard >= PARLEY.truceRenewMinRegard && ctx.rng.chance(PARLEY.truceRenewChance)) {
        // §10.1: 'Kept Word' reads this — a truce that was renewed at least
        // once and was still standing when one party died.
        a.truceRenewed = { ...(a.truceRenewed ?? {}), [b.id]: (a.truceRenewed?.[b.id] ?? 0) + 1 };
        b.truceRenewed = { ...(b.truceRenewed ?? {}), [a.id]: (b.truceRenewed?.[a.id] ?? 0) + 1 };
        declareTruce(ctx, a, b);
        adjustMutual(ctx.state, a, b, PARLEY.truceRegard);
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
    ctx.logEvent(
        fill(ctx.pickText(PARLEY_TEXTS.truceLapsed), { t1: a.name, t2: b.name }),
        [a.id, b.id],
        { category: 'alliance' }
    );
    // §8.9: a promise kept all the way down is a thing the field remembers.
    earnTrait(ctx, a, 'Oathbound');
    earnTrait(ctx, b, 'Oathbound');
}
