import { Alliance, AllianceDisputeRecord, Item, Tribute } from '../models/types';
import { SimContext } from './context';
import { ALLIANCE_DISPUTE } from '../data/balance';
import { allianceRecords, membersOf } from './alliance';
import { cycleOf } from './memory';
import { adjustRel, adjustTrust, getRel } from './relationships';
import { isActive } from './downed';
import { giveItem } from './items';
import { spend } from './actionBudget';
import { canSpend, noteAttempt, noteRefusal } from './actions';
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

/**
 * AUDIT-10 F11: which need is the one this hearing is about.
 *
 * Hunger and thirst are different needs and the box holds two different kinds
 * of thing. Handing a starving member the first water bottle in the cache and
 * recording them as fed is an accounting mistake that then manufactures a
 * political grievance out of nothing.
 */
function needKindOf(t: Tribute): 'food' | 'water' {
    return t.vitals.thirst > t.vitals.hunger ? 'water' : 'food';
}

/** Is this something a person can actually eat or drink? */
function isProvision(i: Item): boolean {
    return i.type === 'food' || i.type === 'water';
}

/**
 * AUDIT-10 F11: portions, not objects.
 *
 * A stack of four loaves is four portions in one inventory slot. The hearing
 * used to hand out one *item* per member and the first member took the whole
 * stack, after which two hungry members were recorded as passed over with
 * three loaves standing in the room. Equivalent quantities packed as one stack
 * or as several now produce equivalent entitlements.
 */
function portionsOf(i: Item): number {
    return Math.max(1, i.stack ?? 1);
}

/**
 * Edible and drinkable portions in the cache, counted separately.
 *
 * This replaces `cacheValue` for the scarcity test. `cacheValue` sums sale
 * value over *everything*, so one expensive utility item — a condenser, a
 * sleeping bag — suppressed a food-shortage hearing in a group with nothing to
 * eat. Sale value is not a meal.
 */
function provisionPortions(record: Alliance, kind?: 'food' | 'water'): number {
    return record.sharedCache
        .filter(i => isProvision(i) && (kind === undefined || i.type === kind))
        .reduce((sum, i) => sum + portionsOf(i), 0);
}

/**
 * Take exactly one portion out of the cache, splitting a stack rather than
 * handing over the whole thing. Returns the portion, or undefined when there
 * is none of that kind left.
 */
function drawPortion(record: Alliance, kind: 'food' | 'water'): Item | undefined {
    const source = record.sharedCache.find(i => i.type === kind);
    if (!source) return undefined;
    const held = portionsOf(source);
    if (held <= 1 || source.stack === undefined) {
        record.sharedCache = record.sharedCache.filter(i => i !== source);
        return source;
    }
    source.stack = held - 1;
    // A portion off a stack carries the stack's freshness and contamination
    // with it; splitting supplies never makes either better than the source.
    return { ...source, stack: 1 };
}

/**
 * AUDIT-10 F10: where the cache physically is.
 *
 * Stored on the group rather than read off the leader, so a leader who walks
 * away does not take the box with them.
 */
function cacheSite(record: Alliance): { zone: string | undefined; level: string } {
    return { zone: record.campZone, level: record.campLevel ?? 'upper' };
}

/** Is this member standing at the cache, on its level? */
function atCache(record: Alliance, t: Tribute): boolean {
    const site = cacheSite(record);
    if (site.zone === undefined) return false;
    if (t.zone !== site.zone) return false;
    return (t.zoneLevel ?? 'upper') === site.level;
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
type Split = AllianceDisputeRecord['split'];

/**
 * AUDIT-10 B5-01: where one member stands, from their own interest.
 *
 * Not a preference they were assigned — a reading of the room from where they
 * are standing in it. Somebody who filled the pile wants it counted; somebody
 * who is starving wants need counted; everybody else wants the rule that cannot
 * be argued with. That is most of why these arguments happen at all.
 *
 * Deliberately self-interested rather than principled. A member who has
 * contributed nothing and is not hungry votes `equal`, which is the honest
 * shape of "I would like a share, thank you" — and it is also why `equal` wins
 * most hearings, because most of a group is usually in that position.
 */
function positionOf(record: Alliance, t: Tribute, members: Tribute[]): Split {
    const mine = contributionOf(record, t);
    const most = Math.max(...members.map(m => contributionOf(record, m)), 0);
    const need = needOf(t);
    const worst = Math.max(...members.map(needOf), 0);
    // Whichever claim is strongest for *them*, and only when it is actually
    // strong — a marginal edge is not a position worth taking against friends.
    const contributionClaim = most > 0 && mine >= most ? ALLIANCE_DISPUTE.contributionClaim : 0;
    const needClaim = need >= worst && need > ALLIANCE_DISPUTE.hungryLine ? ALLIANCE_DISPUTE.needClaim : 0;
    if (contributionClaim === 0 && needClaim === 0) return 'equal';
    return contributionClaim >= needClaim ? 'by-contribution' : 'by-need';
}

/**
 * AUDIT-10 B5-01: who puts a rule forward.
 *
 * The leader, in a group that has one who does anything — a proposal is an act
 * of authority, and `leaderStyle` is already the field that says whether this
 * leader performs any. Where the leader is absent it falls to whoever has the
 * strongest claim, because somebody short of food will say so whether or not
 * anybody is chairing.
 */
function proposerOf(record: Alliance, members: Tribute[]): Tribute {
    const leader = members.find(m => m.id === record.leaderId);
    if (leader && record.leaderStyle !== 'absent') return leader;
    return [...members].sort((a, b) =>
        (contributionOf(record, b) + needOf(b)) - (contributionOf(record, a) + needOf(a)))[0] ?? members[0];
}

function decideSplit(
    ctx: SimContext,
    record: Alliance,
    members: Tribute[],
): AllianceDisputeRecord['split'] {
    const sworn = (record.charter ?? []).includes('share-food');
    const desperate = members.some(m => needOf(m) > ALLIANCE_DISPUTE.desperateNeed);
    /*
     * AUDIT-10 B5-01: the room decides, and the room is made of people with
     * interests.
     *
     * This was a weighted roll over three rules — the group "chose" by dice,
     * with the charter and the leader's temperament nudging the odds. It gave
     * plausible *rates* and no politics: nobody put anything forward, nobody
     * had a position, and a member overruled at every hearing they ever
     * attended had no way to know.
     *
     * Now each attending member holds a position from their own interest and
     * those positions are counted. The old weights survive as the standing
     * pull on the room — a group that swore to share food finds `equal` hard
     * to argue against, a desperate member makes `by-need` hard to dismiss —
     * which is what those knobs always meant. The roll is the tiebreak rather
     * than the decision, because a tie in a room of four is a real thing and
     * somebody still has to hand the food out.
     *
     * `leaderStyle` finally does something mechanical here. A tyrant's position
     * counts for several members; a democrat's counts for a little more than
     * one; an absent leader's counts for exactly one, like everybody else's.
     */
    const tally: Record<Split, number> = { 'equal': 0, 'by-contribution': 0, 'by-need': 0 };
    members.forEach(m => {
        const weight = m.id === record.leaderId
            ? (record.leaderStyle === 'tyrant' ? ALLIANCE_DISPUTE.tyrantWeight
                : record.leaderStyle === 'democratic' ? ALLIANCE_DISPUTE.democraticLeaderWeight : 1)
            : 1;
        tally[positionOf(record, m, members)] += weight;
    });
    // The room's standing pull, in the units the vote is counted in.
    tally.equal += ALLIANCE_DISPUTE.equalBase + (sworn ? ALLIANCE_DISPUTE.swornEqualBonus : 0);
    tally['by-contribution'] += ALLIANCE_DISPUTE.contributionBase
        + (record.leaderStyle === 'tyrant' ? ALLIANCE_DISPUTE.tyrantContributionBonus : 0);
    tally['by-need'] += ALLIANCE_DISPUTE.needBase + (desperate ? ALLIANCE_DISPUTE.desperateNeedBonus : 0);

    const best = Math.max(...Object.values(tally));
    const tied = (Object.keys(tally) as Split[]).filter(k => tally[k] === best);
    return tied.length === 1 ? tied[0] : tied[Math.floor(ctx.rng.nextFloat() * tied.length)];
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
        /*
         * AUDIT-10 F10: a hearing is people standing round a box.
         *
         * This used to take every active member of the alliance regardless of
         * where they were. Three members in three different sectors received a
         * ration hearing and a transfer out of an unattended cache, while the
         * prose placed all of them around the same box. Attendance is physical:
         * the cache's zone, on the cache's level.
         *
         * Members who are elsewhere keep their standing entitlement — the
         * record notes them — but somebody has to carry it to them, which is a
         * delivery, not a hearing.
         */
        const present = members.filter(m => atCache(record, m));
        const absent = members.filter(m => !atCache(record, m));
        if (present.length < ALLIANCE_DISPUTE.minMembers) return;

        /*
         * AUDIT-10 F11: scarcity measured in portions of the thing people
         * actually need, not in sale value over the whole cache.
         */
        const hungry = present.filter(m => needOf(m) > ALLIANCE_DISPUTE.hungryLine);
        if (hungry.length === 0) return;
        const supply = provisionPortions(record);
        if (supply === 0) return;
        if (supply >= hungry.length * ALLIANCE_DISPUTE.portionsPerHead) return;

        holdHearing(ctx, record, present, absent);
    });
}

function holdHearing(ctx: SimContext, record: Alliance, members: Tribute[], absent: Tribute[]) {
    const state = ctx.state;
    /*
     * AUDIT-10 F15: a hearing takes the participants' time.
     *
     * Standing round a box arguing is not free, and it was: nothing here
     * reserved any of the day, so a group could hold a hearing on top of a full
     * cycle of everything else. Anybody who cannot afford the half hour is not
     * at the hearing, and if that leaves too few people there is no hearing.
     */
    const attending = members.filter(m => {
        const time = canSpend(m, ALLIANCE_DISPUTE.hearingHours);
        if (!time.ok) noteRefusal(state, 'alliance-hearing', time.why);
        return time.ok;
    });
    if (attending.length < ALLIANCE_DISPUTE.minMembers) {
        noteRefusal(state, 'alliance-hearing', 'no-time');
        return;
    }
    attending.forEach(m => spend(m, ALLIANCE_DISPUTE.hearingHours));
    noteAttempt(state, 'alliance-hearing');
    members = attending;
    /*
     * B5-01: the proposal and the positions, taken before the decision because
     * that is when they exist. A position read afterwards is a rationalisation.
     */
    const proposer = proposerOf(record, members);
    const positions = Object.fromEntries(members.map(m => [m.id, positionOf(record, m, members)]));
    const proposal = positions[proposer.id];
    const split = decideSplit(ctx, record, members);

    // Who gets it, on this group's chosen rule. One *portion* to each, in
    // order, until the provisions run out — so "short" means somebody gets
    // nothing, which is the entire subject of the argument.
    const order = [...members].sort((a, b) => {
        if (split === 'by-need') return needOf(b) - needOf(a);
        if (split === 'by-contribution') return contributionOf(record, b) - contributionOf(record, a);
        /*
         * Equal: the leader is not first. That is what "equal" has to mean here
         * or the word is doing no work.
         *
         * AUDIT-10 F11 asks that the remainder not always fall to the same
         * people: roster order is deterministic, so under "equal" the same
         * member is last in the queue at every hearing this group ever holds.
         * The queue is rotated by the hearing count instead, which keeps it
         * deterministic for a given seed and stops it being a standing
         * disadvantage.
         */
        return members.indexOf(a) - members.indexOf(b);
    });
    const heldBefore = (state.allianceDisputes ?? []).filter(d => d.allianceId === record.id).length;
    if (split === 'equal' && order.length > 0) {
        const offset = heldBefore % order.length;
        order.push(...order.splice(0, offset));
    }

    const fed: string[] = [];
    const passedOver: Tribute[] = [];
    order.forEach(m => {
        /*
         * AUDIT-10 F11: match the ration to the need.
         *
         * The old selection took the first food *or* water in the cache
         * regardless of which of the two the member was short of, so a
         * dehydrated member could be recorded as fed on a loaf of bread.
         * The member's critical need decides; the other kind is the fallback
         * only when it is not critical.
         */
        const wants = needKindOf(m);
        const critical = needOf(m) > ALLIANCE_DISPUTE.criticalNeed;
        const portion = drawPortion(record, wants)
            ?? (critical ? undefined : drawPortion(record, wants === 'food' ? 'water' : 'food'));
        if (!portion) {
            if (needOf(m) > ALLIANCE_DISPUTE.hungryLine) passedOver.push(m);
            return;
        }
        /*
         * AUDIT-10 F12: an atomic transfer, with the overflow conserved.
         *
         * `holdHearing` removed the item from the cache, called `giveItem`,
         * threw away its returned dropped items and pushed the recipient into
         * `fedIds` regardless. So a member with a full pack was recorded as fed
         * on a ration that fell on the floor and ceased to exist — the same
         * conservation boundary that was fixed for obligations and reintroduced
         * here. Whatever does not fit goes back into the cache, which is the
         * actual location the hearing is happening at, and the member is
         * recorded as issued a ration only if they are holding it.
         */
        const dropped = giveItem(m, portion);
        const landed = !dropped.includes(portion) && m.inventory.some(i => i === portion || i.id === portion.id);
        const returned = dropped.filter(i => i !== portion);
        if (returned.length > 0) record.sharedCache.push(...returned);
        if (!landed) {
            record.sharedCache.push(portion);
            if (needOf(m) > ALLIANCE_DISPUTE.hungryLine) passedOver.push(m);
            ctx.logEvent(
                `${m.name} is handed a share and has nowhere to put it. It goes back in the box, `
                + 'which is nobody\'s idea of being fed.',
                [m.id], { zone: record.campZone, category: 'alliance' },
            );
            return;
        }
        // Issued, not consumed: they are carrying it. Eating it is survival's
        // business, and the record says which of the two this is.
        fed.push(m.id);
    });

    /*
     * Everybody standing round it is named: `check-unnamed`'s rule is that
     * every tribute a line is about appears in it, and a hearing is about all
     * of them — that is what makes it a hearing rather than a hand-out.
     */
    const standing = members.map(m => m.name).join(', ');
    ctx.logEvent(
        `${standing} stand round what is left of ${record.name ?? 'the group'}'s cache, and it is not enough. `
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
        // F10: members who were owed a share and were not standing there. Their
        // entitlement is real; a delivery is what discharges it, and until one
        // happens nothing here has fed them.
        absentIds: absent.map(m => m.id),
        // F13: the membership as it stood at the hearing, so the follow-up can
        // tell "never came back" from "came back".
        memberIdsAtHearing: members.map(m => m.id),
        // B5-01: what was put, by whom, where everybody stood, and who lost.
        proposal,
        proposedById: proposer.id,
        positions,
        // Everyone whose position was not what the room settled on. Recorded
        // even when they were fed, because being overruled and being hungry are
        // different grievances and a group can produce either on its own.
        conceded: members.filter(m => positions[m.id] !== split).map(m => m.id),
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

        /*
         * AUDIT-10 F13: check before asserting.
         *
         * "has not gone back" was printed over somebody who had rejoined the
         * same alliance two cycles earlier. A record of an incident is evidence
         * about the incident; a claim about what has happened *since* has to be
         * read off the current state, and where the state does not support the
         * stronger claim the wording drops back to what the incident alone
         * shows.
         */
        if (gone.length > 0) {
            const rejoined = gone.filter(t => t.allianceId === d.allianceId);
            const away = gone.filter(t => t.allianceId !== d.allianceId);
            if (away.length > 0) {
                ctx.logEvent(
                    `${away.map(t => t.name).join(' and ')} ${away.length === 1 ? 'has' : 'have'} not gone back, `
                    + 'and the group has not gone looking. Whatever that camp was, it is a smaller thing now.',
                    away.map(t => t.id),
                    { type: 'alliance-dispute-remembered', category: 'alliance' },
                );
            }
            if (rejoined.length > 0) {
                ctx.logEvent(
                    `${rejoined.map(t => t.name).join(' and ')} ${rejoined.length === 1 ? 'is' : 'are'} back in the camp. `
                    + 'Nobody has brought up the box, and nobody has forgotten it either.',
                    rejoined.map(t => t.id),
                    { type: 'alliance-dispute-remembered', category: 'alliance' },
                );
            }
            return;
        }
        // ...and "still in the camp" is also a claim about now, not about then.
        const stillIn = stayed.filter(t => t.allianceId === d.allianceId);
        const driftedOff = stayed.filter(t => t.allianceId !== d.allianceId);
        if (driftedOff.length > 0) {
            ctx.logEvent(
                `${driftedOff.map(t => t.name).join(' and ')} said nothing at the time and ${driftedOff.length === 1 ? 'is' : 'are'} `
                + 'not with the group any more. Some people do not announce it.',
                driftedOff.map(t => t.id),
                { type: 'alliance-dispute-remembered', category: 'alliance' },
            );
        }
        if (stillIn.length > 0) {
            ctx.logEvent(
                `${stillIn.map(t => t.name).join(' and ')} ${stillIn.length === 1 ? 'is' : 'are'} still in the camp, `
                + 'still doing the work, and has stopped saying very much at meals.',
                stillIn.map(t => t.id),
                { type: 'alliance-dispute-remembered', category: 'alliance' },
            );
        }
    });
}
