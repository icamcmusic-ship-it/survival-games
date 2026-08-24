import { Alliance, CharterRule, Tribute } from '../models/types';
import { ALLIANCES } from '../data/balance';
import { SimContext, getAlive } from './context';
import { allianceRecords, membersOf, pickLeader } from './alliance';
import { adjustRel, getRel } from './relationships';
import { cycleOf, suspicionOf } from './memory';
import { giveItem } from './items';

/**
 * §4.2: politics inside the group.
 *
 * The alliance record already carried a leader, roles, a charter, a cache and
 * a breach counter — the structure was alive (merges, leadership changes,
 * recruitments and charter breaches all fire in a soak) but it had no
 * *interior*. A five-member alliance was one leader and four undifferentiated
 * members. There was no way to represent "the two from District 4 have decided
 * the leader is a liability", nobody was ever thrown out, a second breach of
 * the same clause cost exactly what the first one did, and six days of feeding
 * the group bought a member nothing when it split.
 *
 * Four mechanics, all built on state that already existed:
 *
 *   factions     `memory.suspicion` is already per-pair. When two or more
 *                members' suspicion of the same third party is all high, that
 *                *is* a faction whether anyone says the word or not. It heats
 *                up while it holds and resolves as a coup or a walk-out.
 *   hearings     `breachesBy` splits the breach counter per member per clause,
 *                so a *second* breach of the same clause by the same person is
 *                a scene — the group expels, demotes, or forgives.
 *   expulsion    the most common way a real group loses a member, and the one
 *                exit the engine did not have.
 *   succession   a named heir, so killing the leader is a different sum.
 */

/** Members of `record` who are still alive, leader first. */
function standing(ctx: SimContext, record: Alliance): Tribute[] {
    const members = membersOf(ctx.state, record.id);
    return members.sort((a, b) => (a.id === record.leaderId ? -1 : b.id === record.leaderId ? 1 : 0));
}

/**
 * Finds and ages the blocs inside one group.
 *
 * A faction is not declared; it is *detected*. Every non-leader member the
 * group is collectively suspicious of is a candidate target, and the members
 * whose suspicion of them clears the bar are the bloc.
 */
function updateFactions(ctx: SimContext, record: Alliance, members: Tribute[]) {
    if (members.length < ALLIANCES.factionMinMembers + 1) { record.factions = []; return; }

    const detected: NonNullable<Alliance['factions']> = [];
    members.forEach(target => {
        const bloc = members.filter(m =>
            m.id !== target.id && suspicionOf(m, target.id) >= ALLIANCES.factionSuspicion);
        if (bloc.length < ALLIANCES.factionMinMembers) return;
        const existing = record.factions?.find(f =>
            f.againstId === target.id && f.memberIds.some(id => bloc.some(m => m.id === id)));
        detected.push({
            againstId: target.id,
            memberIds: bloc.map(m => m.id),
            formedCycle: existing?.formedCycle ?? cycleOf(ctx.state),
            // A bloc that has held together across cycles is a bloc that is
            // going to do something. This is the only clock it needs.
            heat: (existing?.heat ?? 0) + ALLIANCES.factionHeatPerCycle,
        });
    });
    record.factions = detected;
}

/** A faction that has hardened far enough to act, and the act it chooses. */
function resolveFactions(ctx: SimContext, record: Alliance, members: Tribute[]) {
    const faction = (record.factions ?? []).find(f => f.heat >= ALLIANCES.factionSplitHeat);
    if (!faction) return;
    const target = members.find(m => m.id === faction.againstId);
    const bloc = members.filter(m => faction.memberIds.includes(m.id));
    if (!target || bloc.length < ALLIANCES.factionMinMembers) return;

    const names = bloc.map(m => m.name).join(' and ');

    // A coup only makes sense against the person actually holding the job.
    if (target.id === record.leaderId && faction.heat >= ALLIANCES.factionCoupHeat) {
        const replacement = record.successorId && bloc.some(m => m.id === record.successorId)
            ? bloc.find(m => m.id === record.successorId)!
            : pickLeader(bloc);
        record.leaderId = replacement.id;
        record.factions = (record.factions ?? []).filter(f => f !== faction);
        ctx.state.allianceDeposals = ctx.state.allianceDeposals ?? {};
        ctx.state.allianceDeposals[record.id] = (ctx.state.allianceDeposals[record.id] ?? 0) + 1;
        bloc.forEach(m => adjustRel(m, target.id, ALLIANCES.factionCoupRegard));
        adjustRel(target, replacement.id, ALLIANCES.factionCoupRegard);
        ctx.logEvent(
            `${names} have been talking without ${target.name} for days, and this morning they simply stop pretending. `
            + `${replacement.name} is giving the orders now; ${target.name} is still in the group, which may be worse.`,
            members.map(m => m.id),
            { important: true, category: 'alliance' }
        );
        return;
    }

    // Otherwise the bloc walks — a quiet split rather than a betrayal.
    const splinterId = `alliance-split-${record.id}-${cycleOf(ctx.state)}`;
    bloc.forEach(m => { m.allianceId = splinterId; });
    record.memberIds = record.memberIds.filter(id => !faction.memberIds.includes(id));
    record.factions = (record.factions ?? []).filter(f => f !== faction);
    ctx.logEvent(
        `${names} take their share and walk. Nobody says the word ${target.name}, and nobody has to: `
        + 'the group is two groups now, camped a valley apart and each certain the other made the mistake.',
        members.map(m => m.id),
        { important: true, category: 'alliance' }
    );
}

/**
 * §4.2: a second breach of the same clause by the same member is a hearing.
 *
 * Called from the charter enforcement path, which previously did nothing but
 * increment a scalar. `breachesBy` is the per-member ledger that makes "again"
 * a thing the group can notice.
 */
export function noteBreach(ctx: SimContext, record: Alliance, offender: Tribute, rule: CharterRule, members: Tribute[]) {
    record.breachesBy = record.breachesBy ?? {};
    const ledger = record.breachesBy[offender.id] = [...(record.breachesBy[offender.id] ?? []), rule];
    const repeats = ledger.filter(r => r === rule).length;
    if (repeats < ALLIANCES.hearingBreachCount) return;

    const others = members.filter(m => m.id !== offender.id);
    if (others.length === 0) return;

    const roll = ctx.rng.nextFloat();
    if (roll < ALLIANCES.hearingExpelChance) {
        expel(ctx, record, offender, members, `${offender.name} has done it twice, and the second time nobody argues for them.`);
        return;
    }
    if (roll < ALLIANCES.hearingExpelChance + ALLIANCES.hearingDemoteChance && record.roles) {
        const held = (Object.keys(record.roles) as Array<keyof NonNullable<Alliance['roles']>>)
            .find(role => record.roles?.[role] === offender.id);
        if (held) {
            delete record.roles[held];
            const replacement = others[0];
            record.roles[held] = replacement.id;
            ctx.logEvent(
                `The group sits ${offender.name} down about it — the second time, now — and takes the ${held} job off them. `
                + `${replacement.name} holds it from here. Nobody is thrown out. Nobody forgets either.`,
                members.map(m => m.id),
                { important: true, category: 'alliance' }
            );
            return;
        }
    }
    ctx.logEvent(
        `${offender.name} is made to stand there and account for it in front of everyone. They are forgiven, out loud, `
        + 'in the tone people use when it is the last time.',
        members.map(m => m.id),
        { important: true, category: 'alliance' }
    );
    others.forEach(m => adjustRel(m, offender.id, -ALLIANCES.expulsionRegardCost / 2));
}

/**
 * Throws a member out. The exit the alliance layer did not have.
 *
 * An expelled member is remembered as expelled, so recruitment does not simply
 * hand them back their place next cycle, and they leave with whatever claim
 * their contributions to the cache earned them.
 */
export function expel(ctx: SimContext, record: Alliance, offender: Tribute, members: Tribute[], because: string) {
    const others = members.filter(m => m.id !== offender.id);
    if (others.length < 2) return;

    // §4.2: a member who fed the group for six days has a claim when they go.
    const contributed = record.cacheContributions?.[offender.id] ?? 0;
    const takes = contributed > 0
        ? record.sharedCache.splice(0, Math.max(1, Math.round(record.sharedCache.length * ALLIANCES.cacheClaimShare)))
        : [];
    // `giveItem` respects carry capacity; a raw push does not, and an expelled
    // member walking out over their limit is a soak failure waiting to happen.
    takes.forEach(item => giveItem(offender, item));

    delete offender.allianceId;
    record.memberIds = record.memberIds.filter(id => id !== offender.id);
    record.expelledIds = [...(record.expelledIds ?? []), offender.id];
    if (record.cacheContributions) delete record.cacheContributions[offender.id];
    if (record.leaderId === offender.id) record.leaderId = (record.successorId && others.some(o => o.id === record.successorId))
        ? record.successorId
        : pickLeader(others).id;
    others.forEach(m => adjustRel(m, offender.id, -ALLIANCES.expulsionRegardCost));
    adjustRel(offender, others[0].id, -ALLIANCES.expulsionRegardCost);

    ctx.logEvent(
        `${because} ${offender.name} is put out of the group.`
        + (takes.length > 0
            ? ` They take ${takes.map(i => i.name).join(' and ')} with them — they put more into that cache than anyone, and say so.`
            : ' They leave with what they walked in with, which is not much.'),
        members.map(m => m.id),
        { important: true, category: 'alliance' }
    );
}

/**
 * The leader names an heir once the group is big enough for the question to
 * matter. Read by the coup path above and by `reconcileAlliances`.
 */
function nameSuccessor(ctx: SimContext, record: Alliance, members: Tribute[]) {
    if (members.length < ALLIANCES.successorMinSize) return;
    const leader = members.find(m => m.id === record.leaderId);
    if (!leader) return;
    if (record.successorId && members.some(m => m.id === record.successorId)) return;
    const heir = members
        .filter(m => m.id !== leader.id)
        .sort((a, b) => getRel(leader, b.id) - getRel(leader, a.id))[0];
    if (!heir) return;
    record.successorId = heir.id;
    ctx.logEvent(
        `${leader.name} tells the group, without any ceremony about it, that if anything happens to them ${heir.name} `
        + 'has the say. It changes what killing the leader is worth, and everyone standing there works that out at once.',
        members.map(m => m.id),
        { category: 'alliance' }
    );
}

/** One pass of interior politics across every standing group. */
export function runAlliancePolitics(ctx: SimContext) {
    const records = allianceRecords(ctx.state);
    Object.values(records).forEach(record => {
        if (record.id.startsWith('lovers-')) return;
        const members = standing(ctx, record);
        if (members.length < 2) return;
        updateFactions(ctx, record, members);
        resolveFactions(ctx, record, members);
        nameSuccessor(ctx, record, members);
    });
    // A walk-out can leave the group it left behind with one person in it, and
    // a one-person alliance is not an alliance — the same invariant
    // `reconcileAlliances` keeps, re-established here because politics runs
    // after it.
    Object.values(records).forEach(record => {
        const left = membersOf(ctx.state, record.id);
        if (left.length >= 2) return;
        left.forEach(m => { delete m.allianceId; });
        delete records[record.id];
    });

    // A splinter group needs a record of its own, or it is an id on two
    // tributes and nothing else — exactly the bug the Alliance record fixed.
    getAlive(ctx.state).forEach(t => {
        if (!t.allianceId || records[t.allianceId]) return;
        const peers = getAlive(ctx.state).filter(o => o.allianceId === t.allianceId);
        if (peers.length < 2) { delete t.allianceId; return; }
        const leader = pickLeader(peers);
        records[t.allianceId] = {
            id: t.allianceId,
            name: `${leader.name}'s splinter`,
            leaderId: leader.id,
            memberIds: peers.map(p => p.id),
            formedCycle: cycleOf(ctx.state),
            campZone: leader.zone,
            sharedCache: [],
            cacheContributions: {},
            pact: { kind: 'no-pact' },
            pactSwornField: getAlive(ctx.state).length,
        };
    });
}

/** Whether this group has already thrown this person out once. */
export function wasExpelled(record: Alliance | undefined, id: string): boolean {
    return !!record?.expelledIds?.includes(id);
}
