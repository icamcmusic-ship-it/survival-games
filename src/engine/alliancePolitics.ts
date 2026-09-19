import { Alliance, CharterRule, Tribute } from '../models/types';
import { ALLIANCES, PROFICIENCY } from '../data/balance';
import { SimContext, getAlive } from './context';
import { allianceRecords, membersOf, pickLeader, registerAlliance } from './alliance';
import { adjustRel, getRel } from './relationships';
import { cycleOf, suspicionOf } from './memory';
import { giveItem } from './items';
import { trainProficiency } from './proficiency';

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
        // §4.4: two ways to be a bloc. Suspicion is the sharp one — these
        // people think that member is going to do something — and it was the
        // only one, which is why factions needed a witnessed betrayal to get
        // started at all. The other one is commoner and just as real: people
        // who have simply stopped being able to stand the same member.
        const bloc = members.filter(m =>
            m.id !== target.id
            && (suspicionOf(m, target.id) >= ALLIANCES.factionSuspicion
                || getRel(m, target.id) <= ALLIANCES.factionResentRegard));
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

    // §4.4: a bloc that is most of the group does not leave — it throws the
    // member out. Expulsion is described as "the most common way a real group
    // loses a member", and it was reachable only through a second breach of
    // the same charter clause by the same person: 18 firings in 400 runs, and
    // then fewer once factions started walking out before the group lived long
    // enough to hold a hearing. A majority that has decided about somebody is
    // exactly the situation an expulsion is, and the group survives it, which
    // a walk-out does not.
    const rest = members.filter(m => m.id !== target.id && !faction.memberIds.includes(m.id));
    // `rest` has to contain somebody: in a group of three, everyone who is not
    // the target *is* the bloc, and a unanimous group of two throwing out the
    // third is not politics, it is the group ending. That stays a walk-out.
    if (rest.length >= 1 && bloc.length > rest.length) {
        record.factions = (record.factions ?? []).filter(f => f !== faction);
        expel(ctx, record, target, members,
            `${names} have been talking about ${target.name} for days and this morning they say it to their face.`);
        return;
    }

    // Otherwise the bloc walks — a quiet split rather than a betrayal.
    const splinterId = `alliance-split-${record.id}-${cycleOf(ctx.state)}`;
    bloc.forEach(m => { m.allianceId = splinterId; });
    // The bloc that walks is a real alliance from the moment it walks: its own
    // pact, its own charter, its own leader. Without this it carried an id and
    // nothing else until the sweep below gave it a pactless, charterless record.
    registerAlliance(ctx, splinterId, bloc);
    record.memberIds = record.memberIds.filter(id => !faction.memberIds.includes(id));
    record.factions = (record.factions ?? []).filter(f => f !== faction);
    // §22: the members who stayed are on this line and were never in it.
    const stayed = members.filter(m => !bloc.some(b => b.id === m.id)).map(m => m.name);
    ctx.logEvent(
        `${names} take their share and leave the group over ${target.name}.`
        + (stayed.length > 0 ? ` ${stayed.join(', ')} stay.` : '')
        + ' There are two groups now.',
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
    /*
     * AUDIT-6 §4.4: the hearing is what a breach *is for*, and 95% of breaches
     * skipped it.
     *
     * Measured over 400 runs: 148 charter breaches against 7 hearings. The gate
     * was a second breach of *the same clause* by the same person, which is a
     * far narrower event than it reads — a member who breaks the food rule and
     * then the camp rule has broken the charter twice and triggered nothing.
     * `alliancePolitics.ts` is three hundred lines of machinery a player would
     * typically never see fire.
     *
     * A repeat of one clause is still the loudest case and still counts on its
     * own. The second door is simply breaking the charter twice, whichever
     * clauses: the group notices a pattern, not a statute.
     */
    const total = ledger.length;
    if (repeats < ALLIANCES.hearingBreachCount && total < ALLIANCES.hearingAnyBreachCount) return;

    const others = members.filter(m => m.id !== offender.id);
    if (others.length === 0) return;

    const roll = ctx.rng.nextFloat();
    // §4: the leader's style is the thumb on this scale. A tyrant throws
    // people out; a democratic leader talks it round. Same hearing, and the
    // difference between the two groups is visible from the outside.
    const style = record.leaderStyle ?? 'democratic';
    /*
     * AUDIT-6 §4.2: and an absent leader does not hold the hearing at all.
     *
     * Nobody convenes it, so the breach simply sits there — which is worse than
     * either of the other two outcomes, because the group keeps the person and
     * keeps the grievance. This is the beat the succession data implied and the
     * engine could not produce.
     */
    if (style === 'absent') {
        ctx.logEvent(
            `Somebody ought to say something to ${offender.name} about it. Nobody does. `
            + 'The group carries on with the thing unsaid in it, which is heavier than carrying it said.',
            members.map(m => m.id),
            { important: true, category: 'alliance' }
        );
        others.forEach(m => adjustRel(m, offender.id, -ALLIANCES.expulsionRegardCost / 3));
        // ...and they trust the person who did not deal with it a little less too.
        const leader = members.find(m => m.id === record.leaderId);
        if (leader && leader.id !== offender.id) {
            others.filter(m => m.id !== leader.id)
                .forEach(m => adjustRel(m, leader.id, -ALLIANCES.expulsionRegardCost / 4));
        }
        return;
    }
    /*
     * AUDIT-8 §3.5: a hearing is one person speaking for a group about
     * somebody in it, which is the definition `oratory` was given and the
     * second-commonest occasion for it in the engine. The leader who convenes
     * it learns from it whichever way it goes.
     */
    const speaker = members.find(m => m.id === record.leaderId);
    if (speaker && speaker.id !== offender.id) {
        trainProficiency(speaker, 'oratory', undefined, PROFICIENCY.oratoryAddressShare);
    }
    const expelChance = style === 'tyrant'
        ? ALLIANCES.hearingExpelChance + ALLIANCES.tyrantExpelBonus
        : Math.max(0, ALLIANCES.hearingExpelChance - ALLIANCES.democratExpelRelief);
    if (roll < expelChance) {
        expel(ctx, record, offender, members, `${offender.name} has done it twice, and the second time nobody argues for them.`);
        return;
    }
    if (roll < expelChance + ALLIANCES.hearingDemoteChance && record.roles) {
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

    /*
     * §22 / AUDIT-6: the whole group is the cast of this line, so the whole
     * group has to be in it.
     *
     * `because` names whoever moved against them; everybody else was standing
     * there and was claimed by `tributesInvolved` without ever being mentioned,
     * which is the single largest source of unnamed-tribute lines in the
     * repository. Naming them is also the better sentence — an expulsion is
     * mostly made of the people who did not say anything.
     */
    const named = new Set<string>();
    members.forEach(m => { if (because.includes(m.name)) named.add(m.id); });
    named.add(offender.id);
    const silent = others.filter(m => !named.has(m.id));
    ctx.logEvent(
        `${because} ${offender.name} is put out of the group.`
        + (takes.length > 0
            ? ` They take ${takes.map(i => i.name).join(' and ')} with them — they put more into that cache than anyone, and say so.`
            : ' They leave with what they walked in with, which is not much.')
        + (silent.length > 0
            ? ` ${silent.map(m => m.name).join(', ')} ${silent.length > 1 ? 'say' : 'says'} nothing, which is its own kind of vote.`
            : ''),
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
    // §22: "the group" was the rest of this line's cast list, unnamed. At 153
    // occurrences a sweep this was the second-worst offender in the log.
    const witnesses = members.filter(m => m.id !== leader.id && m.id !== heir.id).map(m => m.name);
    ctx.logEvent(
        `${leader.name} names ${heir.name} to take over the group if they are killed.`
        + (witnesses.length > 0 ? ` ${witnesses.join(', ')} hear${witnesses.length === 1 ? 's' : ''} it said.` : ''),
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
        // Through `registerAlliance` rather than hand-built, so a group that
        // reaches here still gets a pact, a charter and roles. The hand-built
        // record was permanently pactless and charterless, and every one of the
        // three splinter sites used to land here.
        registerAlliance(ctx, t.allianceId, peers);
    });
}

/** Whether this group has already thrown this person out once. */
export function wasExpelled(record: Alliance | undefined, id: string): boolean {
    return !!record?.expelledIds?.includes(id);
}
