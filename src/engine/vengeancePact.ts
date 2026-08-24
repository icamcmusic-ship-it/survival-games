/**
 * §4.3: vengeance sworn together.
 *
 * Individual vengeance is one of the most-fired mechanics in the engine —
 * `swearVengeance` runs about 3,000 times across a 400-run soak — and it is
 * strictly private. Two people who lost the same person to the same killer
 * each swore their own separate grudge, pursued it separately, and the
 * simulation had no idea the two grudges were the same grudge.
 *
 * A pact is the group version, and the thing that makes it a distinct object
 * rather than two entries in a list is that the objective is *shared*: it is
 * held by more than one tribute at once, it is what they are both doing, and
 * it ends for everybody the moment it ends for anybody. Three ways out:
 *
 *  - **paid** — the target dies, by any hand. The pact is over whether or not
 *    the people who swore it were the ones who did it, which is its own kind
 *    of ending;
 *  - **broken off** — a member abandons it, which the others feel;
 *  - **outlived** — everyone who swore it is dead, and nobody is coming.
 *
 * Formed only after a *mutual* loss, which is what separates it from two
 * people who happen to want the same person dead: they both have to have
 * mourned the same tribute.
 */
import { GameState, Tribute } from '../models/types';
import { VENGEANCE_PACT } from '../data/balance';
import { SimContext, getAlive } from './context';
import { cycleOf, ensureMemory, hasVengeanceAgainst, swearVengeance } from './memory';
import { adjustMutual, adjustRel, getRel } from './relationships';
import { addExcitement } from './audience';
import { adjustResolve } from './resolve';

function pacts(state: GameState) {
    if (!state.vengeancePacts) state.vengeancePacts = [];
    return state.vengeancePacts;
}

/** True when these two are bound to the same kill. Read by the hunting layer. */
export function sharesVengeancePact(state: GameState, a: Tribute, b: Tribute): boolean {
    return pacts(state).some(p => p.memberIds.includes(a.id) && p.memberIds.includes(b.id));
}

/** The pact `t` is party to, if any. */
export function pactOf(state: GameState, t: Tribute) {
    return pacts(state).find(p => p.memberIds.includes(t.id));
}

/**
 * Two or more people, in the same place, who lost the same person to the same
 * killer, and are still close enough to say so out loud.
 */
export function formVengeancePacts(ctx: SimContext) {
    const state = ctx.state;
    const alive = getAlive(state);
    const byId = new Map(state.tributes.map(t => [t.id, t] as const));

    alive.forEach(a => {
        if (pactOf(state, a)) return;
        const aMem = ensureMemory(a);
        if (aMem.vengeance.length === 0) return;
        const targetId = aMem.vengeance[0];
        const target = byId.get(targetId);
        if (!target || target.status !== 'alive') return;

        const partner = alive.find(b =>
            b.id !== a.id
            && b.zone === a.zone
            && !pactOf(state, b)
            && hasVengeanceAgainst(b, targetId)
            && getRel(a, b.id) >= VENGEANCE_PACT.minRegard
            && getRel(b, a.id) >= VENGEANCE_PACT.minRegard
            // The shared loss is the whole gate. Two people who each want the
            // same person dead for their own reasons are rivals with an
            // overlap, not partners.
            && ensureMemory(b).mourned.some(id => aMem.mourned.includes(id)));
        if (!partner) return;
        if (!ctx.rng.chance(VENGEANCE_PACT.chance)) return;

        const shared = ensureMemory(partner).mourned.find(id => aMem.mourned.includes(id));
        const lost = shared ? byId.get(shared) : undefined;

        pacts(state).push({
            targetId,
            memberIds: [a.id, partner.id],
            sworn: cycleOf(state),
            overWhomId: shared,
        });
        // Swearing it together is worth something to both of them, and to the
        // will that keeps people upright.
        adjustMutual(state, a, partner, VENGEANCE_PACT.regard);
        [a, partner].forEach(m => {
            adjustResolve(m, VENGEANCE_PACT.resolve);
            addExcitement(m, VENGEANCE_PACT.excitement);
            // The pact is the objective now, for both of them at once.
            m.objective = { kind: 'hunt', targetId, expires: cycleOf(state) + VENGEANCE_PACT.objectiveCycles };
            swearVengeance(m, targetId);
        });
        ctx.logEvent(
            lost
                ? `${a.name} and ${partner.name} say ${lost.name}'s name to each other once, and then ${target.name}'s, and that is the whole conversation. `
                    + 'Neither of them is doing this alone any more.'
                : `${a.name} and ${partner.name} discover they are carrying the same name, and agree, without much ceremony, to carry it together. `
                    + `${target.name} now has two people coming.`,
            [a.id, partner.id, target.id],
            { important: true, category: 'alliance' }
        );
    });
}

/** One cycle of a shared grudge holding, being paid, or coming apart. */
export function tickVengeancePacts(ctx: SimContext) {
    const state = ctx.state;
    const byId = new Map(state.tributes.map(t => [t.id, t] as const));

    state.vengeancePacts = pacts(state).filter(pact => {
        const members = pact.memberIds.map(id => byId.get(id)).filter((t): t is Tribute => !!t && t.status === 'alive');
        const target = byId.get(pact.targetId);

        // Everyone who swore it is gone.
        if (members.length === 0) return false;

        // Paid — by their hand or anybody's.
        if (!target || target.status !== 'dead') {
            // still standing; fall through
        } else {
            const theirs = members.some(m => target.causeOfDeath?.includes(m.name));
            members.forEach(m => {
                m.objective = { kind: 'survive' };
                adjustResolve(m, theirs ? VENGEANCE_PACT.paidResolve : -VENGEANCE_PACT.stolenResolve);
            });
            ctx.logEvent(
                theirs
                    ? `${members.map(m => m.name).join(' and ')} finish what they swore to finish. Whatever they expected to feel, `
                        + 'both of them are quiet for a long time afterwards.'
                    : `${target.name} is dead, and it was not ${members.map(m => m.name).join(' or ')} who did it. `
                        + 'They swore this together and somebody else has taken it off them, which is not the same as it being over.',
                [...members.map(m => m.id), pact.targetId],
                { important: true, category: 'alliance' }
            );
            return false;
        }

        // A single survivor is not a pact. It is back to being a grudge.
        if (members.length < 2) {
            members.forEach(m => swearVengeance(m, pact.targetId));
            return false;
        }

        // Broken off: somebody has stopped, and the other one notices.
        const quitter = members.find(m => !hasVengeanceAgainst(m, pact.targetId)
            || getRel(m, members.find(o => o.id !== m.id)!.id) < VENGEANCE_PACT.abandonRegard);
        if (quitter) {
            const others = members.filter(m => m.id !== quitter.id);
            others.forEach(m => adjustRel(m, quitter.id, -VENGEANCE_PACT.abandonPenalty));
            ctx.logEvent(
                `${quitter.name} lets it go. ${others.map(m => m.name).join(' and ')} does not, and will not be forgetting `
                + 'which of them was the one who could.',
                [quitter.id, ...others.map(m => m.id)],
                { important: true, category: 'betrayal' }
            );
            return false;
        }

        // Standing: the objective is refreshed for everyone still in it, which
        // is the mechanical content of "shared".
        members.forEach(m => {
            if (m.objective?.kind !== 'hunt' || m.objective.targetId !== pact.targetId) {
                m.objective = { kind: 'hunt', targetId: pact.targetId, expires: cycleOf(state) + VENGEANCE_PACT.objectiveCycles };
            }
        });
        return true;
    });
}
