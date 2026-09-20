import { GameState, Obligation, Tribute } from '../models/types';
import { SimContext, getAlive } from './context';
import { OBLIGATIONS } from '../data/balance';
import { cycleOf } from './memory';
import { adjustRel, adjustTrust } from './relationships';
import { isActive, isDowned } from './downed';
import { giveItem } from './items';
import { refusesCredit, volunteersToCarry } from '../data/traits';

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
            const needed = t.archetype === 'courier' ? 0 : OBLIGATIONS.supplySpareNeeded;
            return t.inventory.filter(i => i.type === 'food' || i.type === 'water').length > needed;
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

        // The person it was owed to is dead: nothing left to owe.
        if (!from || !to || to.status !== 'alive') {
            o.status = 'lapsed';
            return;
        }
        // The person who owed it is dead: they did not break it, they ran out.
        if (from.status !== 'alive') {
            o.status = 'lapsed';
            return;
        }

        const together = from.zone === to.zone;

        if (o.kind === 'supply' && together) {
            const spare = from.inventory.find(i => i.type === 'food' || i.type === 'water');
            if (spare && to.vitals.hunger > OBLIGATIONS.supplyHungerLine) {
                from.inventory = from.inventory.filter(i => i !== spare);
                giveItem(to, spare);
                keep(ctx, o, `${from.name} hands ${to.name} the ${spare.name} without being asked twice. That is the promise, discharged, in front of everybody who heard it made.`);
                return;
            }
        }

        if (o.kind === 'escort' && together && o.detail && from.zone === o.detail) {
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
            o.status = couldHave ? 'broken' : 'lapsed';
            if (couldHave) {
                adjustRel(to, from.id, -OBLIGATIONS.brokenRegard);
                from.faithBroken = (from.faithBroken ?? 0) + 1;
                ctx.logEvent(
                    `${from.name} was standing right there and did not do it. ${to.name} does not bring it up, and does not forget it either.`,
                    [from.id, to.id],
                    { type: 'obligation-broken', important: true, category: 'alliance' },
                );
            } else {
                ctx.logEvent(
                    `Whatever ${from.name} promised ${to.name}, the arena has put a week and half a map between them. It simply stops being a thing either of them is counting on.`,
                    [from.id, to.id],
                    { type: 'obligation-lapsed', category: 'alliance' },
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
        const mates = getAlive(state).filter(o => o.allianceId === t.allianceId
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
