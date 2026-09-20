import { Alliance, AllianceDisputeRecord, Tribute } from '../models/types';
import { SimContext } from './context';
import { ALLIANCE_DISPUTE } from '../data/balance';
import { allianceRecords, cacheValue, membersOf } from './alliance';
import { cycleOf } from './memory';
import { adjustRel, adjustTrust, getRel } from './relationships';
import { isActive } from './downed';
import { giveItem } from './items';
import { ARCHETYPES } from '../data/archetypes';

/**
 * AUDIT-9 batch 4, pilot 2: the argument about the food.
 *
 * The audit's §5 asks for "scarcity-driven politics": *"record what was
 * contributed and what was consumed. Let an alliance debate an expensive
 * rescue or an unequal ration split, with decisions tied to need and charter
 * terms."* And the batch's own gate wants a chain that is non-fatal by
 * construction, where the consequence is political rather than lethal.
 *
 * The pieces were nearly all here and had never been put together.
 * `cacheContributions` has recorded who fed the group since the charter
 * system landed, and it was read by exactly one thing: a line of prose when
 * the group dissolved. `charter` has held `share-food` as a sworn clause with
 * a detectable breach. `leaderStyle` has said whether a group is run by
 * consensus or by one person. Nothing ever made those three disagree with
 * each other in front of everybody, which is what an alliance actually is
 * when the food runs low.
 *
 * So: when the cache cannot cover the people depending on it, the group has
 * to decide *how* to be short, and there are only three honest answers —
 * equally, to whoever put it in, or to whoever needs it most. Each of the
 * three has somebody it is unfair to, and that person remembers.
 *
 * Nobody dies of this. The outcome is a changed group: trust moved, a debt of
 * resentment on the leader, and sometimes somebody deciding they are better
 * off on their own. That is the point — the audit's §10 asks for depth that
 * is not another way to die, and the arena has plenty of those.
 */

/** How badly this member needs what is in the box. */
function needOf(t: Tribute): number {
    return Math.max(t.vitals.hunger, t.vitals.thirst);
}

/** What they have put into it, on the group's own ledger. */
function contributionOf(record: Alliance, t: Tribute): number {
    return record.cacheContributions?.[t.id] ?? 0;
}

/**
 * Which way this particular group splits a short ration.
 *
 * Not a roll between three equal options. A group that swore to share food
 * shares it; a tyrant takes the contributors' side because the contributors
 * are the people keeping them in charge; a group with a medic or a badly
 * hurt member in front of them finds it very hard to argue for anything but
 * need. The roll only decides between whatever is left after that.
 */
function decideSplit(
    ctx: SimContext,
    record: Alliance,
    members: Tribute[],
): AllianceDisputeRecord['split'] {
    const sworn = (record.charter ?? []).includes('share-food');
    const desperate = members.some(m => needOf(m) > ALLIANCE_DISPUTE.desperateNeed);
    const weights: Array<[AllianceDisputeRecord['split'], number]> = [
        ['equal', ALLIANCE_DISPUTE.equalBase + (sworn ? ALLIANCE_DISPUTE.swornEqualBonus : 0)],
        ['by-contribution', ALLIANCE_DISPUTE.contributionBase
            + (record.leaderStyle === 'tyrant' ? ALLIANCE_DISPUTE.tyrantContributionBonus : 0)],
        ['by-need', ALLIANCE_DISPUTE.needBase + (desperate ? ALLIANCE_DISPUTE.desperateNeedBonus : 0)],
    ];
    const total = weights.reduce((sum, [, w]) => sum + w, 0);
    let roll = ctx.rng.nextFloat() * total;
    for (const [kind, w] of weights) {
        roll -= w;
        if (roll <= 0) return kind;
    }
    return 'equal';
}

/**
 * One cycle of alliances arguing about a box that will not go round.
 */
export function tickAllianceDisputes(ctx: SimContext) {
    const state = ctx.state;
    const records = allianceRecords(state);

    Object.keys(records).forEach(id => {
        const record = records[id];
        const members = membersOf(state, id).filter(isActive);
        if (members.length < ALLIANCE_DISPUTE.minMembers) return;

        // Not more than one hearing per group per few cycles: a standing
        // argument is not a scene, and the ledger fills with noise.
        const last = (state.allianceDisputes ?? [])
            .filter(d => d.allianceId === id)
            .reduce((max, d) => Math.max(max, d.cycle), -Infinity);
        if (cycleOf(state) - last < ALLIANCE_DISPUTE.cooldownCycles) return;

        /*
         * Scarcity, measured rather than rolled: what is in the box against
         * how many people are looking at it and how much they need it. A
         * group with plenty does not have this argument, which is why a
         * well-supplied alliance never triggers this and a starving one does
         * so within a cycle or two.
         */
        const hungry = members.filter(m => needOf(m) > ALLIANCE_DISPUTE.hungryLine);
        if (hungry.length === 0) return;
        const supply = cacheValue(record);
        if (supply >= hungry.length * ALLIANCE_DISPUTE.enoughPerHead) return;
        if (record.sharedCache.length === 0) return;

        holdHearing(ctx, record, members);
    });
}

function holdHearing(ctx: SimContext, record: Alliance, members: Tribute[]) {
    const state = ctx.state;
    const split = decideSplit(ctx, record, members);

    // Who gets it, on this group's chosen rule. One item to each, in order,
    // until the box is empty — so "short" means somebody gets nothing, which
    // is the entire subject of the argument.
    const order = [...members].sort((a, b) => {
        if (split === 'by-need') return needOf(b) - needOf(a);
        if (split === 'by-contribution') return contributionOf(record, b) - contributionOf(record, a);
        // Equal: the leader is not first. That is what "equal" has to mean
        // here or the word is doing no work — deterministic roster order.
        return members.indexOf(a) - members.indexOf(b);
    });

    const fed: string[] = [];
    const passedOver: Tribute[] = [];
    order.forEach(m => {
        const item = record.sharedCache.find(i => i.type === 'food' || i.type === 'water');
        if (!item) {
            if (needOf(m) > ALLIANCE_DISPUTE.hungryLine) passedOver.push(m);
            return;
        }
        record.sharedCache = record.sharedCache.filter(i => i !== item);
        giveItem(m, item);
        fed.push(m.id);
    });

    /*
     * Everybody standing round it is named: `check-unnamed`'s rule is that
     * every tribute a line is about appears in it, and a hearing is about all
     * of them — that is what makes it a hearing rather than a hand-out.
     */
    const present = members.map(m => m.name).join(', ');
    ctx.logEvent(
        `${present} stand round what is left of ${record.name ?? 'the group'}'s cache, and it is not enough. `
        + (split === 'equal'
            ? 'They go round the circle and stop when it runs out, which is the fairest way and helps nobody in particular.'
            : split === 'by-contribution'
                ? 'It goes to the people who put it there. Said out loud, in those words, with everybody counting.'
                : 'It goes to whoever is worst off, and the people who fetched it watch it go.'),
        members.map(m => m.id),
        { type: 'alliance-dispute', important: true, zone: record.campZone, category: 'alliance' },
    );

    /*
     * The losing side, and what they do about it. This is the half that makes
     * it politics rather than a distribution function: somebody was passed
     * over on a rule they did not choose, and the record says who, why, and
     * what it cost the group.
     */
    const leader = members.find(m => m.id === record.leaderId);
    const walkouts: string[] = [];
    passedOver.forEach(m => {
        // Resentment lands on whoever the rule favoured, and on the leader
        // for it being the rule.
        if (leader && leader.id !== m.id) {
            adjustRel(m, leader.id, -ALLIANCE_DISPUTE.passedOverRegard);
            adjustTrust(m, leader.id, -ALLIANCE_DISPUTE.passedOverTrust);
        }
        const bitter = ALLIANCE_DISPUTE.walkoutBase
            + needOf(m) * ALLIANCE_DISPUTE.walkoutPerNeed
            + Math.max(0, ARCHETYPES[m.archetype].treachery) * ALLIANCE_DISPUTE.walkoutTreachery
            - (leader ? Math.max(0, getRel(m, leader.id)) * ALLIANCE_DISPUTE.walkoutPerRegard : 0);
        if (ctx.rng.chance(bitter)) {
            delete m.allianceId;
            walkouts.push(m.id);
        } else {
            // AUDIT-9 batch 5: 'The Vote Held' — they lost the argument and
            // stayed anyway, which is the thing an alliance is made of.
            m.stayedAfterBeingPassedOver = true;
        }
    });

    if (passedOver.length > 0) {
        ctx.logEvent(
            `${passedOver.map(m => m.name).join(' and ')} ${passedOver.length === 1 ? 'gets' : 'get'} nothing, `
            + (walkouts.length > 0
                ? `and ${walkouts.length === passedOver.length ? 'walk' : 'some of them walk'} out of the camp with `
                  + 'whatever they came in with. Nobody stops them; stopping them would mean explaining the arithmetic again.'
                : 'and stays, which is a decision somebody is going to have to live with either way.'),
            passedOver.map(m => m.id),
            { type: 'alliance-dispute-lost', important: true, zone: record.campZone, category: 'alliance' },
        );
    }

    state.allianceDisputes = state.allianceDisputes ?? [];
    state.allianceDisputes.push({
        cycle: cycleOf(state),
        allianceId: record.id,
        split,
        fedIds: fed,
        passedOverIds: passedOver.map(m => m.id),
        walkoutIds: walkouts,
    });
}

/**
 * The follow-up, a cycle or two on, that reads the actual result.
 *
 * Same requirement as the rescue chain's: *"Add a follow-up one or two cycles
 * later that reads the actual result."* It reads the record rather than
 * restating the scene — who was passed over, whether they stayed, and whether
 * the split the group chose turned out to have been worth the argument.
 */
export function tickDisputeAftermath(ctx: SimContext) {
    const state = ctx.state;
    if (!state.allianceDisputes?.length) return;
    const cycle = cycleOf(state);
    const byId = new Map(state.tributes.map(t => [t.id, t]));

    state.allianceDisputes.forEach(d => {
        if (d.read) return;
        if (cycle < d.cycle + ALLIANCE_DISPUTE.aftermathCycles) return;
        d.read = true;

        const stayed = d.passedOverIds
            .filter(id => !d.walkoutIds.includes(id))
            .map(id => byId.get(id))
            .filter((t): t is Tribute => t !== undefined && t.status === 'alive');
        const gone = d.walkoutIds
            .map(id => byId.get(id))
            .filter((t): t is Tribute => t !== undefined && t.status === 'alive');

        if (gone.length > 0) {
            ctx.logEvent(
                `${gone.map(t => t.name).join(' and ')} ${gone.length === 1 ? 'has' : 'have'} not gone back, `
                + 'and the group has not gone looking. Whatever that camp was, it is a smaller thing now.',
                gone.map(t => t.id),
                { type: 'alliance-dispute-remembered', category: 'alliance' },
            );
            return;
        }
        if (stayed.length > 0) {
            ctx.logEvent(
                `${stayed.map(t => t.name).join(' and ')} ${stayed.length === 1 ? 'is' : 'are'} still in the camp, `
                + 'still doing the work, and has stopped saying very much at meals.',
                stayed.map(t => t.id),
                { type: 'alliance-dispute-remembered', category: 'alliance' },
            );
        }
    });
}
