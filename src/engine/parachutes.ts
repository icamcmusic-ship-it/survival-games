import { GameState, Item, Tribute, attr } from '../models/types';
import { SimContext, getAlive } from './context';
import { PARACHUTES } from '../data/balance';
import { giveItem, itemPhrase } from './items';
import { isActive } from './downed';
import { adjustRel } from './relationships';

/**
 * AUDIT-9 stage C §4: a sponsor gift is an object that has to land somewhere.
 *
 * The audit's ask was for "physical caches/delivery". Gifts had no physical
 * existence at all: `processSponsors` called `giveItem` and the medicine was
 * in the tribute's pack, from the Capitol, instantly, wherever they were and
 * whoever was standing next to them. There was no landing zone, no moment
 * between the purchase and the pack, and therefore no possibility that the
 * wrong person reached it first — which is one of the most recognisable beats
 * the source material has, and the engine could not express it.
 *
 * A parachute now lands *in a zone*, addressed to somebody, and is claimed
 * afterwards by whoever is actually standing there. That single change buys
 * several things the audit asked for separately:
 *
 *  - **The wrong person can get it.** A tribute who is not alone when their
 *    sponsors come through has to be able to hold the ground to keep it.
 *  - **Moving has a cost you can see.** Walk away from the zone your gift is
 *    falling into and you may not be there when it arrives.
 *  - **Conservation is real.** The item exists in exactly one place at a time
 *    — in the sky, on the ground, or in a pack — instead of being conjured at
 *    the point of use.
 *
 * Unclaimed parachutes expire rather than accumulating: the Capitol does not
 * leave its property lying in the arena, and an immortal pile of free supplies
 * would be a worse bug than the one this replaces.
 */

/** Put a gift in the sky above a zone, addressed to somebody. */
export function dropParachute(ctx: SimContext, forWhom: Tribute, item: Item, seal?: string) {
    const state = ctx.state;
    state.parachutes = state.parachutes ?? [];
    state.parachutes.push({
        id: `chute-${state.logCounter}-${state.parachutes.length}`,
        item,
        zone: forWhom.zone,
        forId: forWhom.id,
        landedCycle: state.cycle ?? 0,
        seal,
    });
}

/** Anything in the sky or on the ground right now, for reporting and tests. */
export function pendingParachutes(state: GameState) {
    return state.parachutes ?? [];
}

/**
 * One cycle of parachutes landing and being picked up.
 *
 * Run after movement has settled, so "who is standing there" means who is
 * standing there *now* and not who was when the sponsors paid.
 */
export function resolveParachutes(ctx: SimContext) {
    const state = ctx.state;
    if (!state.parachutes?.length) return;
    const cycle = state.cycle ?? 0;
    const kept: NonNullable<GameState['parachutes']> = [];

    state.parachutes.forEach(chute => {
        const addressee = state.tributes.find(t => t.id === chute.forId);
        const present = getAlive(state).filter(t => isActive(t) && t.zone === chute.zone);

        // The person it is for, if they are still standing where it fell.
        const owner = present.find(t => t.id === chute.forId);
        if (owner) {
            /*
             * A crate falling into a clearing you are sharing with somebody
             * who wants you dead is not a delivery, it is a race. This is the
             * beat the source material runs on and the reason the gift had to
             * become an object at all: the medicine is *there*, and getting to
             * it first is the problem.
             *
             * Contested on speed and nerve rather than on who would win a
             * fight — whoever moves first has it, and the fight afterwards is
             * the fight they were going to have anyway.
             */
            const rival = present.find(t => t.id !== owner.id
                && (t.allianceId === undefined || t.allianceId !== owner.allianceId));
            if (rival) {
                const ownerSpeed = attr(owner, 'agility') + attr(owner, 'intelligence') * PARACHUTES.contestWitWeight;
                const rivalSpeed = attr(rival, 'agility') + attr(rival, 'intelligence') * PARACHUTES.contestWitWeight;
                const rivalOdds = rivalSpeed / Math.max(1, ownerSpeed + rivalSpeed);
                if (ctx.rng.chance(rivalOdds * PARACHUTES.contestRivalShare)) {
                    claim(ctx, chute, rival, false);
                    adjustRel(owner, rival.id, -PARACHUTES.stolenRegard);
                    return;
                }
            }
            claim(ctx, chute, owner, true);
            return;
        }

        /*
         * They are not here. Anybody else who is gets first refusal — and
         * takes it, because a crate with somebody else's name on it is still
         * a crate. The addressee finding out is what `adjustRel` is for: this
         * is the kind of theft people remember.
         */
        /*
         * An ally picking it up is not theft — they are carrying it for
         * somebody wearing the same colours, and the group's cache is where
         * that argument gets had. Only somebody outside the alliance taking a
         * crate with another tribute's name on it is the beat this models.
         */
        const ally = addressee?.allianceId
            ? present.find(t => t.allianceId === addressee.allianceId)
            : undefined;
        const taker = ally ?? present[0];
        if (taker) {
            claim(ctx, chute, taker, false, ally !== undefined);
            if (!ally && addressee && addressee.status === 'alive') {
                adjustRel(addressee, taker.id, -PARACHUTES.stolenRegard);
            }
            return;
        }

        // Nobody is there. It waits, for a while.
        if (cycle - chute.landedCycle >= PARACHUTES.lifetimeCycles) {
            ctx.logEvent(
                `The parachute in ${chute.zone} is collected by something the Capitol sends for it. `
                + `Whatever ${itemPhrase(chute.item)} would have been worth, it is not in the arena any more.`,
                addressee ? [addressee.id] : [],
                { type: 'parachute-lost', zone: chute.zone, category: 'sponsor' },
            );
            return;
        }
        kept.push(chute);
    });

    state.parachutes = kept;
}

function claim(
    ctx: SimContext,
    chute: NonNullable<GameState['parachutes']>[number],
    taker: Tribute,
    addressed: boolean,
    byAlly = false,
) {
    giveItem(taker, chute.item);
    const line = addressed
        ? `A parachute comes down in ${chute.zone} and ${taker.name} is standing under it. ${itemPhrase(chute.item)}.${chute.seal ? ` ${chute.seal}` : ''}`
        : byAlly
            ? `A parachute comes down in ${chute.zone} with somebody else's name on it. ${taker.name} collects ${itemPhrase(chute.item)} and carries it back for them.`
            : `A parachute meant for somebody else comes down in ${chute.zone}. ${taker.name} is the one standing there, and takes ${itemPhrase(chute.item)} out of it.`;
    ctx.logEvent(line, [taker.id], {
        type: addressed ? 'parachute-claimed' : byAlly ? 'parachute-collected' : 'parachute-stolen',
        zone: chute.zone,
        important: !addressed && !byAlly,
        category: 'sponsor',
    });
}
