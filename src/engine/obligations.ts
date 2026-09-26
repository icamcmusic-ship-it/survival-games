import { GameState, Obligation, Tribute } from '../models/types';
import { oathHolds } from './traitHooks';
import { SimContext, getAlive } from './context';
import { AUDIT12_TRIBUTES, OBLIGATIONS } from '../data/balance';
import { cycleOf } from './memory';
import { adjustRel, adjustTrust, getRel } from './relationships';
import { hasTruce } from './parley';
import { ARCHETYPES } from '../data/archetypes';
import { isActive, isDowned } from './downed';
import { giveItem } from './items';
import { refusesCredit, volunteersToCarry } from '../data/traits';
import { samePlace } from './verticality';
import { allied } from './alliance';
import { hopsTo, severedEdgeSet } from './map';

/**
 * AUDIT-9 stage C §4: negotiated obligations.
 *
 * The audit asked for "supply contributions, escort, rescue priority, cache
 * rights, exit conditions", with "deadlines, capacity checks and explicit
 * resolution". The engine had a great many *agreements* — charters, pacts,
 * bloc treaties, truces, debts, loans — and almost no obligations. The
 * difference is that an agreement is a standing condition somebody can be
 * found in breach of, while an obligation is a specific thing one named
 * person owes another named person by a particular cycle, which either gets
 * done or does not.
 *
 * Two of the audit's five already existed in that stronger form and are left
 * alone: `AlliancePact` is exit conditions with a real deadline and an
 * explicit resolution, and `debts.ts`'s loans are a specific object owed back.
 * The three that did not exist at all are here.
 *
 * The properties that make this an obligation rather than another agreement:
 *
 *  - **A deadline.** Every one carries `byCycle`, and something happens when
 *    it passes. An obligation that can be ignored forever is a sentiment.
 *  - **A capacity check at the moment of promising.** Nothing in the engine
 *    asked "can I actually do this before agreeing to it" — `offerLoans`
 *    checking the lender has a genuine spare was the only capacity test in
 *    the family. Promising what you cannot deliver should be rare and
 *    deliberate, not the default.
 *  - **Explicit resolution.** `kept`, `broken` or `lapsed`, each with its own
 *    consequence, rather than quietly disappearing. A promise nobody is ever
 *    seen to keep or break costs nothing to make.
 */

/** Everything currently outstanding. */
export function openObligations(state: GameState): Obligation[] {
    return (state.obligations ?? []).filter(o => o.status === 'open');
}

export function obligationsOf(state: GameState, t: Tribute): Obligation[] {
    return openObligations(state).filter(o => o.owedById === t.id);
}

/**
 * Whether this tribute could actually discharge this, right now.
 *
 * The capacity check the audit asked for, and the reason a promise means
 * something: a tribute with nothing spare cannot promise supplies, and one
 * who cannot stand up cannot promise to walk somebody anywhere.
 */
export function canPromise(state: GameState, t: Tribute, kind: Obligation['kind']): boolean {
    if (!isActive(t)) return false;
    switch (kind) {
        case 'supply': {
            /*
             * Something to give that they are not relying on themselves — so
             * ordinarily a spare *beyond* the one they are living on.
             *
             * AUDIT-9 stage D: a Courier is the exception, and it is the
             * archetype's whole identity rather than a discount. What they are
             * carrying is not their reserve; it is somebody else's, and they
             * are carrying it because that is the job. Without this the
             * signature needed two spares *and* a needy ally in another zone,
             * a conjunction that fired 0.0% of the time across 400 runs — a
             * dead hook of exactly the kind the stage gate exists to catch.
             */
            /*
             * And medicine counts, for a Courier. A courier carrying a kit to
             * somebody who needs one is the archetypal case of the whole role,
             * and counting only food and water held the set piece to 15.7% of
             * its entrants against a 29% floor every other archetype clears.
             */
            const needed = t.archetype === 'courier' ? 0 : OBLIGATIONS.supplySpareNeeded;
            /*
             * §12: count the rations, not the entries.
             *
             * This was `.length`, so a tribute carrying one food item with a
             * stack of three read as carrying one and could never clear "a
             * spare beyond the one you are living on". Stacks are real
             * everywhere else — `consumeOne` decrements one and leaves the
             * entry in place — so the check was asking a question about
             * inventory slots while the comment above it describes portions.
             *
             * Measured before the fix: of 2,286 tribute-cycles with a hungry
             * ally standing there, the tribute could promise supply 29 times.
             * That is 1.3%, and it is why no `supply` obligation has ever been
             * created in any measured run.
             */
            const carried = t.inventory
                .filter(i => i.type === 'food' || i.type === 'water'
                    || (t.archetype === 'courier' && i.type === 'medical'))
                .reduce((sum, i) => sum + (i.stack ?? 1), 0);
            return carried > needed;
        }
        case 'escort':
            return t.health >= OBLIGATIONS.escortMinHealth
                && t.vitals.fatigue <= OBLIGATIONS.escortMaxFatigue;
        case 'rescue':
            return t.health >= OBLIGATIONS.rescueMinHealth;
    }
}

/** Make a promise, if it can be kept. Returns it, or undefined if refused. */
export function promise(
    ctx: SimContext,
    from: Tribute,
    to: Tribute,
    kind: Obligation['kind'],
    detail?: string,
): Obligation | undefined {
    const state = ctx.state;
    if (from.id === to.id) return undefined;
    /*
     * AUDIT-9 stage D `Bargain-Shy`: "prefers verifiable immediate exchanges
     * to promises". Not a penalty on promising — a refusal to. They trade what
     * is in their hands now and are correspondingly impossible to defraud on
     * credit, and correspondingly short of favours owed when it matters.
     */
    if (refusesCredit(from)) return undefined;
    if (!canPromise(state, from, kind)) return undefined;
    // One of each kind between the same two people at a time: repeating a
    // promise you have not kept is not a second promise.
    if (openObligations(state).some(o => o.owedById === from.id && o.owedToId === to.id && o.kind === kind)) {
        return undefined;
    }
    const obligation: Obligation = {
        id: `ob-${state.logCounter}-${(state.obligations?.length ?? 0)}`,
        owedById: from.id,
        owedToId: to.id,
        kind,
        byCycle: cycleOf(state) + OBLIGATIONS.deadlineCycles,
        status: 'open',
        detail,
    };
    state.obligations = [...(state.obligations ?? []), obligation];
    ctx.logEvent(
        kind === 'supply'
            ? `${from.name} tells ${to.name} they will not let them go hungry. It is said out loud, in front of whoever else is there, which is what makes it a thing that can be broken.`
            : kind === 'escort'
                ? `${from.name} agrees to walk ${to.name} to ${detail ?? 'safer ground'}. Neither of them says what happens if that stops being convenient.`
                : `${from.name} promises ${to.name} that if they go down, they will not go down alone.`,
        [from.id, to.id],
        { type: 'obligation-made', important: true, category: 'alliance' },
    );
    return obligation;
}

/** Mark an obligation discharged, with the regard that buys. */
export function keep(ctx: SimContext, o: Obligation, line: string) {
    o.status = 'kept';
    const from = ctx.state.tributes.find(t => t.id === o.owedById);
    const to = ctx.state.tributes.find(t => t.id === o.owedToId);
    if (from && to) {
        adjustRel(to, from.id, OBLIGATIONS.keptRegard);
        // Trust is reliance, which is exactly what a kept promise buys.
        adjustTrust(to, from.id, OBLIGATIONS.keptTrust);
    }
    ctx.logEvent(line, [o.owedById, o.owedToId], { type: 'obligation-kept', category: 'alliance' });
}

/**
 * AUDIT-11 E5: the broken rescue. The ally went down a sector away from
 * somebody who was able to come, and they did not.
 */
function breakRescue(ctx: SimContext, o: Obligation, from: Tribute, to: Tribute) {
    // AUDIT-12 T15: an Oathkeeper cannot break it — they run the sector instead.
    if (oathHolds(ctx, o, from, to)) return;
    o.status = 'broken';
    from.faithBroken = (from.faithBroken ?? 0) + 1;
    if (to.status === 'alive') adjustRel(to, from.id, -OBLIGATIONS.brokenRegard);
    ctx.logEvent(
        to.status === 'alive'
            ? `${to.name} went down one sector from ${from.name}, who had promised to come, and ${from.name} did not come. ${to.name} does not bring it up, and does not forget it either.`
            : `${from.name} promised ${to.name} they would not go down alone. They went down one sector away, and they went alone.`,
        [from.id, to.id],
        { type: 'obligation-broken', important: true, category: 'alliance' },
    );
}

/**
 * One cycle of obligations being discharged or running out.
 *
 * Discharge is opportunistic and physical: a supply promise is kept by
 * actually handing food over while standing next to the person, an escort by
 * arriving together, a rescue by being there when they go down. None of them
 * can be kept from across the map, which is the point.
 */
export function tickObligations(ctx: SimContext) {
    const state = ctx.state;
    if (!state.obligations?.length) return;
    const cycle = cycleOf(state);
    const byId = new Map(state.tributes.map(t => [t.id, t]));

    openObligations(state).forEach(o => {
        const from = byId.get(o.owedById);
        const to = byId.get(o.owedToId);

        // AUDIT-11 E5: a rescue can be failed before it expires. Record the
        // cycle the ally was down and the promiser was a sector away, on their
        // feet, and did not come — the one version of this that is a choice.
        if (o.kind === 'rescue' && from && to && from.status === 'alive' && to.status === 'alive'
            && isDowned(to) && isActive(from) && !samePlace(state.arena, from, to)
            && (hopsTo(state.arena, from.zone, to.zone, state.collapsedZones ?? [], severedEdgeSet(state)) ?? Infinity) <= 1) {
            // AUDIT-12 T11: one cycle is not a choice — it takes a cycle to
            // hear and move. Two or more cycles of staying put is.
            o.rescueMissedCycles = (o.rescueMissedCycles ?? 0) + 1;
            if (o.rescueMissedCycles >= AUDIT12_TRIBUTES.rescueMissCycles) o.rescueMissed = true;
        } else if (o.kind === 'rescue' && to && !isDowned(to)) {
            // Back on their feet (whoever got them there): the miss is moot.
            o.rescueMissedCycles = 0;
            o.rescueMissed = false;
        }

        // The person it was owed to is dead: nothing left to owe — unless they
        // died down, a sector from somebody who had promised to come.
        if (!from || !to || to.status !== 'alive') {
            if (o.rescueMissed && from && to && from.status === 'alive') {
                breakRescue(ctx, o, from, to);
                return;
            }
            o.status = 'lapsed';
            return;
        }
        // The person who owed it is dead: they did not break it, they ran out.
        if (from.status !== 'alive') {
            o.status = 'lapsed';
            return;
        }

        /*
         * AUDIT-10 B12: standing next to somebody is a physical fact.
         *
         * Zone equality is not it. A vertical zone has an upper and a lower
         * level that are a climb apart, and `samePlace` is the check the rest
         * of the engine uses for contact — so a supply promise was being marked
         * kept, and bread teleported from the rim of a shaft to its floor,
         * while the one function that knows about levels said they were not
         * together at all. Both of them also have to be *able* to act: a
         * tribute who is down or in transit is not handing anything over.
         */
        const together = samePlace(state.arena, from, to) && isActive(from);

        if (o.kind === 'supply' && together) {
            // What they actually need: a kit for a wound, food for hunger.
            const wants = to.health < OBLIGATIONS.escortMinHealth ? 'medical' : undefined;
            const spare = (wants ? from.inventory.find(i => i.type === wants) : undefined)
                ?? from.inventory.find(i => i.type === 'food' || i.type === 'water');
            if (spare && (to.vitals.hunger > OBLIGATIONS.supplyHungerLine
                || (wants === 'medical' && spare.type === 'medical'))) {
                /*
                 * AUDIT-10 B13: the handover is a transfer, and a transfer can
                 * fail. `giveItem` returns what would not fit; this caller used
                 * to discard that return value, take the item off the donor
                 * regardless, and mark the promise kept — so a full recipient
                 * could drop the incoming supply (or something else out of
                 * their own bag) and the ledger recorded a delivery.
                 *
                 * The contract: the promise is kept when the thing promised is
                 * in the recipient's hands afterwards. Anything displaced goes
                 * on the ground where it happened, which is what dropping
                 * means, and if the gift itself is what got dropped the donor
                 * keeps it and the promise stays open for another try.
                 */
                from.inventory = from.inventory.filter(i => i !== spare);
                const dropped = giveItem(to, spare);
                const landed = !dropped.includes(spare) && to.inventory.some(i => i.id === spare.id);
                if (!landed) {
                    // Nothing changed hands. Put it back and try again later.
                    to.inventory = to.inventory.filter(i => i !== spare);
                    from.inventory.push(spare);
                    return;
                }
                if (dropped.length > 0) {
                    ctx.logEvent(
                        `${to.name} has to put ${dropped.map(i => i.name).join(' and ')} down to take the ${spare.name} — there is only so much one person can carry.`,
                        [to.id, from.id],
                        { category: 'loot', zone: to.zone },
                    );
                }
                keep(ctx, o, `${from.name} hands ${to.name} the ${spare.name} without being asked twice. That is the promise, discharged, in front of everybody who heard it made.`);
                return;
            }
        }

        if (o.kind === 'escort' && together && isActive(to) && o.detail && from.zone === o.detail) {
            keep(ctx, o, `${from.name} and ${to.name} walk into ${o.detail} together. ${from.name} said they would get them here, and here they are.`);
            return;
        }

        if (o.kind === 'rescue' && isDowned(to) && together) {
            keep(ctx, o, `${to.name} is on the ground in ${to.zone} and ${from.name} is standing over them, which is exactly what was promised.`);
            return;
        }

        if (cycle >= o.byCycle) {
            /*
             * The deadline passed. Whether that is a broken promise or a
             * lapsed one turns on two things: whether they *could* have kept
             * it, and whether it was still wanted.
             *
             * The second clause is the one the first draft was missing, and it
             * mattered enormously: a promise of food to somebody who has since
             * found their own is not a betrayal, it is a promise the week made
             * irrelevant. Without it the ledger read 348 made, 16 kept, 91
             * broken — an arena where nobody keeps their word, which was an
             * artefact of counting "the need passed" as "they refused".
             */
            const stillWanted = o.kind === 'supply'
                ? to.vitals.hunger > OBLIGATIONS.supplyHungerLine
                : o.kind === 'escort'
                    ? from.zone !== o.detail
                    : isDowned(to);
            const couldHave = together && stillWanted && canPromise(state, from, o.kind);
            // AUDIT-11 E5: the ally was down a sector away and they stayed put.
            if (o.kind === 'rescue' && o.rescueMissed) {
                breakRescue(ctx, o, from, to);
                return;
            }
            // AUDIT-12 T15: an Oathkeeper who could keep it keeps it, even out
            // of the last ration they have.
            if (couldHave && oathHolds(ctx, o, from, to)) return;
            /*
             * §12: three outcomes, not two.
             *
             * `lapsed` was carrying two different facts. "They could not" is
             * one of them; "it never came due" is the other, and they are not
             * the same thing about the person who promised. Measured over 150
             * runs, the 23 expired rescues split 8 and 15: eight never came
             * due, because the ally did not go down inside the window, and
             * fifteen were real failures, where the ally *was* down and the
             * promiser was not there or was in no state to reach them. The
             * ledger recorded all 23 identically, which hid the fifteen that
             * are actually worth reading.
             *
             * Neither costs the promiser anything, so this is a record-honesty
             * fix rather than a behavioural one. But the record is what the
             * chronicle and any future reader of this ledger see, and a
             * rescue that was never needed should not read the same as one
             * somebody could not reach.
             */
            o.status = couldHave ? 'broken' : stillWanted ? 'lapsed' : 'moot';
            if (couldHave) {
                adjustRel(to, from.id, -OBLIGATIONS.brokenRegard);
                from.faithBroken = (from.faithBroken ?? 0) + 1;
                ctx.logEvent(
                    `${from.name} was standing right there and did not do it. ${to.name} does not bring it up, and does not forget it either.`,
                    [from.id, to.id],
                    { type: 'obligation-broken', important: true, category: 'alliance' },
                );
            } else if (o.status === 'lapsed') {
                /*
                 * §12: say what actually stood between them. This line used
                 * to claim "half a map" for every expiry that was not a
                 * breach — including the promiser standing right beside a
                 * downed ally, too hurt or too spent to do anything about it.
                 */
                ctx.logEvent(
                    together
                        ? `${from.name} is right there when ${to.name} needs what was promised, and is in no state to give it. Nobody calls it a broken promise. Nobody calls it a kept one either.`
                        : `Whatever ${from.name} promised ${to.name}, the arena has put too much ground between them. It simply stops being a thing either of them is counting on.`,
                    [from.id, to.id],
                    { type: 'obligation-lapsed', category: 'alliance' },
                );
            } else {
                /*
                 * Moot: the need never came. Measured, this is most expiring
                 * rescue promises — the ally simply did not go down inside
                 * the window — and it used to print the same "half a map
                 * between them" line as a real failure to reach somebody,
                 * about two people who had usually been together the whole
                 * time. It is a quiet fact, not a beat.
                 */
                ctx.logEvent(
                    `${from.name}'s promise to ${to.name} is never called in. It did not need to be.`,
                    [from.id, to.id],
                    { category: 'alliance' },
                );
            }
        }
    });

    // Keep the ledger from growing without bound across a long run.
    state.obligations = state.obligations.filter(o =>
        o.status === 'open' || cycle - o.byCycle < OBLIGATIONS.rememberCycles);
}

/**
 * Allies negotiating, once per cycle.
 *
 * Deliberately need-driven rather than random: somebody promises supplies to
 * an ally who is going hungry, an escort to one who is hurt, a rescue to one
 * they already owe their life to. The audit's guardrail for believable
 * betrayal applies here in the positive — no promise "solely because a
 * periodic random check fired".
 */
export function negotiateObligations(ctx: SimContext) {
    const state = ctx.state;
    getAlive(state).forEach(t => {
        if (!isActive(t) || !t.allianceId) return;
        const mates = getAlive(state).filter(o => allied(o, t)
            && o.id !== t.id && o.zone === t.zone && isActive(o));
        if (!mates.length) return;
        const mate = mates[0];

        const hungry = mate.vitals.hunger > OBLIGATIONS.supplyHungerLine;
        const hurt = mate.health < OBLIGATIONS.escortMinHealth;
        /*
         * AUDIT-9 stage D `Shared-Burden`: "volunteers for transport of an
         * injured ally". They promise the hard ones — the escort and the
         * rescue — far more readily than anybody else, and the exhaustion is
         * the cost, arriving through the escort itself rather than as a flat
         * fatigue tax.
         */
        const volunteers = volunteersToCarry(t)
            ? OBLIGATIONS.sharedBurdenMultiplier
            : 1;

        if (hungry && canPromise(state, t, 'supply') && ctx.rng.chance(OBLIGATIONS.supplyPromiseChance)) {
            promise(ctx, t, mate, 'supply');
            return;
        }
        /*
         * An escort is the one of the three with a destination, which makes
         * it the one that comes due on its own: they either get there
         * together or they do not. Promised toward wherever the hurt tribute
         * was already trying to go, so it is help with their plan rather than
         * a detour invented for the promise.
         */
        if (hurt && canPromise(state, t, 'escort') && ctx.rng.chance(OBLIGATIONS.escortPromiseChance * volunteers)) {
            const where = mate.objective?.kind === 'reach' ? mate.objective.zone : undefined;
            if (where && where !== t.zone) {
                promise(ctx, t, mate, 'escort', where);
                return;
            }
        }
        if (hurt && canPromise(state, t, 'rescue') && ctx.rng.chance(OBLIGATIONS.rescuePromiseChance * volunteers)) {
            promise(ctx, t, mate, 'rescue');
        }
    });
}

/**
 * AUDIT-9 batch 3: asking somebody who is not on your side.
 *
 * `negotiateObligations` above requires an alliance and a mate inside it, so
 * every promise in the game was made between two people who had already
 * agreed to help each other. The audit names that failure directly — "protect
 * against a social role being valuable only when everyone nearby is already
 * friendly" — and the measurement is unambiguous about who it costs: the
 * Confessor, whose entire description is "wins by being the person nobody can
 * justify killing", has the most company of any archetype in the game (13.38
 * others in the zone, alone in only 3.8% of cycles), dies of body causes more
 * than any other archetype measured, and had the second-worst win rate. It was
 * standing in a crowd of people carrying food, with no way to ask.
 *
 * An appeal is the general form of asking. Anybody in visible need can make
 * one; whether it is answered turns on standing — the charisma to ask well, a
 * truce or regard already in place, and whether the person being asked is the
 * sort to step over somebody, or has been killing people. That makes this the
 * Confessor's engine without being a Confessor branch: they are simply the
 * best in the game at the thing everybody can now do.
 *
 * The promise runs the giver -> asker, and both of them are standing in the
 * same place when it is made, so it is immediately attemptable. That matters:
 * the audit's other note on this system is that the ledger fills with promises
 * nobody could have kept, and an appeal is the opposite shape — the supplies
 * and the need are within arm's reach at the moment the words are said.
 */
export function appealForAid(ctx: SimContext) {
    const state = ctx.state;
    getAlive(state).forEach(asker => {
        if (!isActive(asker)) return;
        // Visible need. Not "would like more" — the kind somebody standing
        // next to them can see.
        const need = Math.max(asker.vitals.hunger, asker.vitals.thirst);
        if (need < OBLIGATIONS.appealNeedLine) return;
        if (!ctx.rng.chance(OBLIGATIONS.appealChance)) return;

        // Somebody who is not already on their side, is here, and has it spare.
        const candidates = getAlive(state).filter(o =>
            o.id !== asker.id
            && isActive(o)
            && samePlace(state.arena, asker, o)
            && !allied(asker, o)
            && canPromise(state, o, 'supply'));
        if (candidates.length === 0) return;

        // Who is likeliest to say yes, asked first — one ask per cycle, so it
        // is the best prospect rather than a canvass of the whole zone.
        const scored = candidates
            .map(giver => ({ giver, chance: appealChance(ctx, asker, giver) }))
            .sort((a, b) => b.chance - a.chance)[0];
        if (!ctx.rng.chance(scored.chance)) return;

        const made = promise(ctx, scored.giver, asker, 'supply');
        if (!made) return;
        ctx.logEvent(
            `${asker.name} asks ${scored.giver.name} outright, in front of whoever is watching. `
            + `${scored.giver.name} says yes — which is a thing the arena will remember about both of them.`,
            [asker.id, scored.giver.id],
            { type: 'obligation-made', important: true, category: 'alliance', zone: asker.zone },
        );
    });
}

/** How likely this particular person is to answer this particular asker. */
function appealChance(ctx: SimContext, asker: Tribute, giver: Tribute): number {
    let chance = OBLIGATIONS.appealPerCharisma
        * (asker.attributes.charisma - OBLIGATIONS.appealCharismaMidpoint);
    if (hasTruce(ctx.state, asker, giver.id)) chance += OBLIGATIONS.appealTruceBonus;
    chance += Math.max(0, getRel(giver, asker.id)) * OBLIGATIONS.appealPerRegard;
    // Somebody who turns on people does not stop to hand over their water.
    chance -= Math.max(0, ARCHETYPES[giver.archetype].treachery) * OBLIGATIONS.appealTreacheryWeight;
    // And nobody gives to somebody who has been killing people.
    chance -= asker.kills * OBLIGATIONS.appealPerKill;
    return Math.max(0, Math.min(OBLIGATIONS.appealMaxChance, chance));
}
