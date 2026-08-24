/**
 * §4.1: non-aggression between whole alliances, as blocs.
 *
 * `parley.ts` truces are between two people. Two packs who had decided not to
 * fight each other could only express that as a mesh of individual
 * agreements — every member with every member, each with its own expiry, each
 * breakable on its own, and none of them meaning anything about the groups.
 * That is not the same object: a treaty is agreed by whoever speaks for the
 * group, it binds people who were not at the table, and it dissolves for
 * reasons about the *groups* rather than about any pair.
 *
 * Modelled on `alliancePact.ts` deliberately — a pact is an alliance's
 * agreement with itself, and this is an alliance's agreement with another one,
 * so they share a shape: sworn out loud, with a stated end condition, and
 * resolved on screen when it arrives.
 *
 * The three dissolution triggers are all about blocs, not pairs:
 *
 *  - **the clock** — it was for a stated number of cycles and they are up;
 *  - **the field** — the arithmetic closes and two packs is one pack too many;
 *  - **a killing** — any member of either bloc kills any member of the other,
 *    which ends it for everyone at once. That is the property individual
 *    truces could not have: one person breaking it breaks it for their whole
 *    side, which is what makes a treaty worth more and worth less than a
 *    handshake.
 */
import { Alliance, GameState, Tribute } from '../models/types';
import { BLOC_TREATY } from '../data/balance';
import { SimContext, getAlive } from './context';
import { allianceRecords, membersOf, pickLeader } from './alliance';
import { adjustRel, getRel } from './relationships';
import { cycleOf } from './memory';
import { profOf, trainProficiency } from './proficiency';
import { addExcitement } from './audience';

function treaties(state: GameState) {
    if (!state.blocTreaties) state.blocTreaties = [];
    return state.blocTreaties;
}

function treatyKey(a: string, b: string): string {
    return [a, b].sort().join('|');
}

/** True when these two tributes are on opposite sides of a standing treaty. */
export function underBlocTreaty(state: GameState, a: Tribute, b: Tribute): boolean {
    if (!a.allianceId || !b.allianceId || a.allianceId === b.allianceId) return false;
    const key = treatyKey(a.allianceId, b.allianceId);
    return treaties(state).some(t => treatyKey(t.aId, t.bId) === key && cycleOf(state) < t.until);
}

/**
 * Two groups whose leaders are standing in the same place, and who have more
 * reason to leave each other alone than to find out. Negotiated by whoever
 * speaks for each side — this is the one social mechanic in the game where a
 * single tribute's persuasion binds people who are not present, which is what
 * having a leader is for.
 */
export function proposeBlocTreaties(ctx: SimContext) {
    const state = ctx.state;
    const records = allianceRecords(state);
    const ids = Object.keys(records).filter(id => !id.startsWith('lovers-'));

    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const aId = ids[i], bId = ids[j];
            if (treaties(state).some(t => treatyKey(t.aId, t.bId) === treatyKey(aId, bId))) continue;

            const aMembers = membersOf(state, aId);
            const bMembers = membersOf(state, bId);
            if (aMembers.length < BLOC_TREATY.minBlocSize || bMembers.length < BLOC_TREATY.minBlocSize) continue;

            // Somebody has to be able to talk to somebody. Two packs on
            // opposite sides of the arena do not sign anything.
            const aSpeaker = speakerOf(state, records[aId], aMembers);
            const bSpeaker = speakerOf(state, records[bId], bMembers);
            if (!aSpeaker || !bSpeaker || aSpeaker.zone !== bSpeaker.zone) continue;

            // Two groups do not agree to anything while their members hate
            // each other. Read across the whole membership, not the speakers:
            // a treaty the rank and file will not honour is not worth signing.
            const warmth = crossRegard(aMembers, bMembers);
            if (warmth < BLOC_TREATY.minCrossRegard) continue;

            const odds = BLOC_TREATY.baseChance
                + Math.max(profOf(aSpeaker, 'persuasion'), profOf(bSpeaker, 'persuasion')) * BLOC_TREATY.perPersuasion;
            if (!ctx.rng.chance(odds)) continue;

            const cycles = BLOC_TREATY.cycles;
            treaties(state).push({
                aId, bId,
                until: cycleOf(state) + cycles,
                sworn: cycleOf(state),
                fieldFloor: BLOC_TREATY.dissolveFieldSize,
            });
            trainProficiency(aSpeaker, 'persuasion');
            trainProficiency(bSpeaker, 'persuasion');
            addExcitement(aSpeaker, BLOC_TREATY.excitement);
            addExcitement(bSpeaker, BLOC_TREATY.excitement);
            ctx.logEvent(
                `${aSpeaker.name} and ${bSpeaker.name} talk for a long time with both groups watching, and then walk back to their own people `
                + 'with the same thing to say: not us, not yet. It is the first agreement in this arena that anybody made on behalf of somebody else.',
                [...aMembers.map(m => m.id), ...bMembers.map(m => m.id)],
                { important: true, category: 'alliance' }
            );
        }
    }
}

function speakerOf(state: GameState, record: Alliance | undefined, members: Tribute[]): Tribute | undefined {
    if (members.length === 0) return undefined;
    const leader = record && members.find(m => m.id === record.leaderId);
    return leader ?? pickLeader(members);
}

/** Average regard across the two memberships, both directions. */
function crossRegard(a: Tribute[], b: Tribute[]): number {
    let sum = 0, n = 0;
    a.forEach(x => b.forEach(y => {
        sum += getRel(x, y.id) + getRel(y, x.id);
        n += 2;
    }));
    return n === 0 ? 0 : sum / n;
}

/**
 * A killing across the line. Called from the kill path: one person's decision
 * ends the agreement for both blocs at once, which is the whole difference
 * between a treaty and a handshake.
 */
export function noteBlocKill(ctx: SimContext, killer: Tribute, victim: Tribute) {
    const state = ctx.state;
    if (!killer.allianceId || !victim.allianceId) return;
    const key = treatyKey(killer.allianceId, victim.allianceId);
    const treaty = treaties(state).find(t => treatyKey(t.aId, t.bId) === key && cycleOf(state) < t.until);
    if (!treaty) return;

    state.blocTreaties = treaties(state).filter(t => t !== treaty);
    const theirs = membersOf(state, victim.allianceId);
    const ours = membersOf(state, killer.allianceId);
    // Everybody on the other side holds it against everybody on this one. That
    // is the cost of having signed as a bloc.
    theirs.forEach(m => ours.forEach(o => adjustRel(m, o.id, -BLOC_TREATY.breachRegard)));
    ctx.logEvent(
        `${killer.name} kills ${victim.name} and takes the agreement between the two groups with them. `
        + `Nobody on ${victim.name}'s side is going to draw a distinction between ${killer.name} and the people ${killer.name} eats with.`,
        [killer.id, victim.id],
        { important: true, category: 'betrayal' }
    );
}

/** The clock and the arithmetic. Called once a cycle. */
export function tickBlocTreaties(ctx: SimContext) {
    const state = ctx.state;
    const cycle = cycleOf(state);
    const fieldSize = getAlive(state).length;

    state.blocTreaties = treaties(state).filter(treaty => {
        const aMembers = membersOf(state, treaty.aId);
        const bMembers = membersOf(state, treaty.bId);
        // A bloc that no longer exists cannot be a party to anything.
        if (aMembers.length === 0 || bMembers.length === 0) return false;

        if (fieldSize <= treaty.fieldFloor) {
            ctx.logEvent(
                `There are ${fieldSize} tributes left and two groups holding an agreement not to fight each other, `
                + 'which is an arithmetic problem rather than a moral one. Both sides work it out on the same morning.',
                [...aMembers.map(m => m.id), ...bMembers.map(m => m.id)],
                { important: true, category: 'alliance' }
            );
            return false;
        }
        if (cycle >= treaty.until) {
            ctx.logEvent(
                `The agreement between the two groups runs out. Nobody renews it and nobody breaks it; `
                + 'they simply stop being people who have an agreement, and start watching each other again.',
                [...aMembers.map(m => m.id), ...bMembers.map(m => m.id)],
                { category: 'alliance' }
            );
            return false;
        }
        return true;
    });
}
