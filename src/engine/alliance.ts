import { Alliance, GameState, Item, Tribute } from '../models/types';
import { ALLIANCES } from '../data/balance';
import { announceCharter, rollCharter } from './allianceCharter';
import { SimContext } from './context';
import { cycleOf } from './memory';
import { adjustRel, getRel } from './relationships';

/**
 * Alliance structure.
 *
 * An alliance used to be a string id copied onto two or more tributes and
 * nothing else. There was no leader — `move()` used `members[0]`, i.e. whatever
 * order the array happened to be in — no roles, no shared supplies, no camp, and
 * no internal politics beyond a scalar trust decay. That is a lot of nothing
 * inside the most socially interesting structure in the game.
 *
 * The record here gives an alliance the things that generate drama on their own:
 * a leader who can be wrong and can be replaced, a declared pact that creates a
 * scheduled betrayal everyone can see coming, a camp worth defending, and a
 * shared cache that gives treachery a payday and raiding a target.
 */

/**
 * Whether these two are each other's star-crossed lover.
 *
 * This used to be tested inline in five places as "both have the trait and
 * share a district". Romance is no longer district-partners-only, so that test
 * would quietly pair up any two lovers who happened to come from the same
 * district and, worse, fail to protect a genuine cross-district pair from being
 * matched against each other in a brawl. The bond id is the actual record of
 * who fell for whom.
 */
/**
 * Whether `t` is performing their bond with `otherId` rather than feeling it.
 *
 * A performed Star-Crossed bond looks identical to everyone in the arena and to
 * every sponsor in the Capitol — it earns the same trust and the same
 * excitement. What it does not earn is loyalty: the betrayal layer reads the
 * real number, so a performer can and will turn on the person they are
 * pretending to love.
 */
export function isPerforming(t: Tribute, otherId: string): boolean {
    return t.displayedRegard?.[otherId] !== undefined;
}

/**
 * §11.1: what `t` appears to feel toward `otherId` — the performance where
 * one is running, the real number where it is not. This is the value other
 * people's trust/betrayal reads should consume: the audience in the arena
 * sees the act, not the ledger.
 */
export function shownRegard(t: Tribute, otherId: string): number {
    return t.displayedRegard?.[otherId] ?? (t.relationships[otherId] || 0);
}

/**
 * §11.1: the performance is maintained scene by scene. A shared camp, a
 * parley, alliance chatter — each one the performer plays warm refreshes the
 * displayed number, independent of whatever they actually feel.
 */
export function maintainPerformance(t: Tribute, otherId: string, delta: number) {
    if (!t.displayedRegard || t.displayedRegard[otherId] === undefined) return;
    t.displayedRegard[otherId] = Math.max(-100, Math.min(100, t.displayedRegard[otherId] + delta));
}

export function areLovers(a: Tribute, b: Tribute): boolean {
    if (a.id === b.id) return false;
    if (!a.traits.includes('Star-Crossed') || !b.traits.includes('Star-Crossed')) return false;
    // The bond id names both of them, so it survives one of them losing the id
    // (pulled into another group, or the record pruned) without ever matching a
    // pair who merely both happen to be in love with somebody.
    const bondId = `lovers-${a.id}-${b.id}`;
    const reverseId = `lovers-${b.id}-${a.id}`;
    const inBond = (t: Tribute) => t.allianceId === bondId || t.allianceId === reverseId;
    // Joining a different alliance is walking out on the bond. Without this,
    // one party holding the id kept the other permanently unable to fight
    // them — even after being pulled into a Career pack — which is both
    // one-sided and a stalemate risk in a final two.
    const defected = (t: Tribute) => !!t.allianceId && !inBond(t);
    return (inBond(a) || inBond(b)) && !defected(a) && !defected(b);
}

export function allianceRecords(state: GameState): Record<string, Alliance> {
    if (!state.alliances) state.alliances = {};
    return state.alliances;
}

export function allianceOf(state: GameState, id: string | undefined): Alliance | undefined {
    if (!id) return undefined;
    return allianceRecords(state)[id];
}

export function membersOf(state: GameState, id: string): Tribute[] {
    return state.tributes.filter(t => t.status === 'alive' && t.allianceId === id);
}

/** Who the group would follow: presence and capability, not array order. */
export function pickLeader(members: Tribute[]): Tribute {
    return members.reduce((best, m) => {
        const score = (t: Tribute) =>
            t.attributes.charisma * 1.6 + t.attributes.strength + t.trainingScore * 0.5 + t.kills * 2;
        return score(m) > score(best) ? m : best;
    });
}

/**
 * Creates the record for a newly-formed alliance, including whatever they
 * agreed out loud. The pact is the interesting part: a group that has said
 * "until the final eight" has committed to a public deadline.
 */
/**
 * §4.5: names the group for the broadcast. The Capitol brands everything it
 * televises; an alliance the commentators can refer to by name is one the
 * audience follows week to week.
 */
function brandFor(ctx: SimContext, id: string, leader: Tribute, members: Tribute[]): string {
    if (id.startsWith('career-pack')) return 'the Career pack';
    const districts = [...new Set(members.map(m => m.district))].sort((a, b) => a - b);
    const patterns = [
        `the ${leader.name} crew`,
        districts.length === 1 ? `the District ${districts[0]} bloc` : `the ${districts.map(d => `${d}`).join('-')} compact`,
        `${leader.name}'s ${members.length > 2 ? 'company' : 'pair'}`,
    ];
    return ctx.rng.pick(patterns);
}

export function registerAlliance(ctx: SimContext, id: string, members: Tribute[]): Alliance {
    const records = allianceRecords(ctx.state);
    // Star-crossed lovers get the record — a camp, a leader for movement — but
    // none of the machinery of a gang: no rolled pact, no charter terms, no
    // broadcast brand. The rest of the codebase already skips `lovers-` ids for
    // recruitment and pact expiry; falling in love should not read like a
    // Career pack signing articles.
    const isLoversBond = id.startsWith('lovers-');
    const roll = ctx.rng.nextFloat();
    const pact: Alliance['pact'] = isLoversBond ? 'no-pact'
        : roll < ALLIANCES.pactFinalEightChance
            ? 'until-the-final-eight'
            : roll < ALLIANCES.pactFinalEightChance + ALLIANCES.pactToTheEndChance
                ? 'to-the-end'
                : 'no-pact';

    const leader = pickLeader(members);
    const record: Alliance = {
        id,
        name: isLoversBond ? 'the star-crossed pair' : brandFor(ctx, id, leader, members),
        leaderId: leader.id,
        memberIds: members.map(m => m.id),
        formedCycle: cycleOf(ctx.state),
        // The leader's zone, not whatever order the array happened to be in —
        // the exact anti-pattern this module's header calls out.
        campZone: leader.zone,
        sharedCache: [],
        pact,
        charter: isLoversBond ? [] : rollCharter(ctx.rng, members),
    };
    records[id] = record;
    announceCharter(ctx, record, members);

    if (pact !== 'no-pact') {
        ctx.logEvent(
            pact === 'until-the-final-eight'
                ? `${members.map(m => m.name).join(' and ')} shake on it: they run together until the final eight, and after that all bets are off.`
                : `${members.map(m => m.name).join(' and ')} swear to see it through to the end, whatever the end turns out to look like.`,
            members.map(m => m.id),
            { important: true, category: 'alliance' }
        );
    }
    return record;
}

/**
 * Merges the absorbed alliance's record into the surviving one instead of
 * re-registering from scratch — two groups that pooled supplies for six days
 * keep both caches (capped), keep the older founding date, keep the stricter
 * pact (without re-announcing one), and re-elect a leader across the whole
 * merged roster.
 */
export function mergeAllianceRecords(ctx: SimContext, keepId: string, absorbedId: string, members: Tribute[]): Alliance {
    const records = allianceRecords(ctx.state);
    const keep = records[keepId];
    const absorbed = records[absorbedId];
    delete records[absorbedId];
    if (!keep) return registerAlliance(ctx, keepId, members);

    const strictness: Record<Alliance['pact'], number> = { 'no-pact': 0, 'until-the-final-eight': 1, 'to-the-end': 2 };
    keep.memberIds = members.map(m => m.id);
    keep.leaderId = pickLeader(members).id;
    if (absorbed) {
        keep.sharedCache = [...keep.sharedCache, ...absorbed.sharedCache].slice(0, ALLIANCES.cacheMaxSize);
        keep.formedCycle = Math.min(keep.formedCycle, absorbed.formedCycle);
        if (strictness[absorbed.pact] > strictness[keep.pact]) keep.pact = absorbed.pact;
    }
    return keep;
}

/**
 * Per-cycle upkeep on the structure itself: prune the dead, re-elect when the
 * leader is gone or has lost the room, and drop records nobody belongs to.
 */
export function reconcileAlliances(ctx: SimContext) {
    const records = allianceRecords(ctx.state);

    Object.keys(records).forEach(id => {
        const members = membersOf(ctx.state, id);
        if (members.length < 2) {
            // A one-person alliance is not an alliance. This also cleans up the
            // id left on a lone survivor, which otherwise persisted and showed
            // up in the UI as a standing pack of one.
            members.forEach(m => { delete m.allianceId; });
            delete records[id];
            return;
        }

        const record = records[id];
        record.memberIds = members.map(m => m.id);

        const leader = members.find(m => m.id === record.leaderId);
        if (!leader) {
            const replacement = pickLeader(members);
            record.leaderId = replacement.id;
            ctx.logEvent(
                `With the leader gone, ${replacement.name} takes charge of what is left of the group.`,
                members.map(m => m.id),
                { category: 'alliance' }
            );
            return;
        }

        // A leadership challenge: someone the group rates more highly, who is
        // also better at the job. Careers being Careers, this is where the pack
        // gets its internal conflict.
        const challenger = pickLeader(members);
        if (challenger.id !== leader.id) {
            const backingFor = (t: Tribute) =>
                members.reduce((sum, m) => sum + (m.id === t.id ? 0 : getRel(m, t.id)), 0);
            if (backingFor(challenger) > backingFor(leader) + ALLIANCES.coupBackingMargin && ctx.rng.chance(ALLIANCES.coupChance)) {
                record.leaderId = challenger.id;
                // §10.1: 'Mutiny' — deposals are counted on the state so the
                // record survives the alliance itself dissolving later.
                ctx.state.allianceDeposals = ctx.state.allianceDeposals ?? {};
                ctx.state.allianceDeposals[id] = (ctx.state.allianceDeposals[id] ?? 0) + 1;
                ctx.logEvent(
                    `${challenger.name} stops deferring to ${leader.name}, and nobody in the group argues. The pack has a new leader.`,
                    members.map(m => m.id),
                    { important: true, category: 'alliance' }
                );
            }
        }

        // §3.3: the pack should be structurally brittle. The two most
        // successful killers in a Career-majority group are rivals for the
        // crown, and every cycle they share a camp the rivalry wears at the
        // bond — a live internal fault line rather than a one-off penalty.
        const careers = members.filter(m => m.isCareer);
        if (careers.length * 2 >= members.length && members.length >= 3) {
            const ranked = [...members].sort((a, b) => b.kills - a.kills);
            const [first, second] = ranked;
            if (first && second && first.kills >= ALLIANCES.crownRivalryMinKills && second.kills >= 1) {
                adjustRel(first, second.id, -ALLIANCES.crownRivalryPerCycle);
                adjustRel(second, first.id, -ALLIANCES.crownRivalryPerCycle);
                if (ctx.rng.chance(ALLIANCES.crownRivalryLineChance)) {
                    ctx.logEvent(
                        `${first.name} and ${second.name} are keeping score against each other now, not just against the arena. The pack pretends not to notice.`,
                        [first.id, second.id],
                        { category: 'alliance' }
                    );
                }
            }
        }
    });
}

/** The leader of a tribute's alliance, or undefined if they have none. */
export function leaderFor(state: GameState, t: Tribute): Tribute | undefined {
    const record = allianceOf(state, t.allianceId);
    if (!record) return undefined;
    return state.tributes.find(o => o.id === record.leaderId && o.status === 'alive');
}

/**
 * Members hand surplus into the pooled cache when they are standing at camp.
 *
 * The cache is deliberately made of things nobody urgently needs right now —
 * a group does not pool its last canteen — which is what makes stealing it a
 * calculated theft rather than a murder by other means.
 */
export function contributeToCache(ctx: SimContext, record: Alliance, members: Tribute[]) {
    members.forEach(m => {
        if (record.sharedCache.length >= ALLIANCES.cacheMaxSize) return;
        if (m.inventory.length <= ALLIANCES.cacheContributeSurplus) return;
        const spare = m.inventory.find(i =>
            (i.type === 'food' && m.vitals.hunger < 40)
            || (i.type === 'water' && m.vitals.thirst < 40)
            || (i.type === 'utility' && i.id !== 'backpack'));
        if (!spare) return;
        m.inventory.splice(m.inventory.indexOf(spare), 1);
        record.sharedCache.push(spare);
        ctx.logEvent(
            `${m.name} adds their ${spare.name} to the group's stash in ${record.campZone ?? m.zone}.`,
            [m.id],
            { category: 'alliance' }
        );
    });
}

export function cacheValue(record: Alliance | undefined): number {
    if (!record) return 0;
    return record.sharedCache.reduce((sum, i) => sum + i.value, 0);
}

/** Empties the cache and returns what was in it, for a thief or a raider. */
export function emptyCache(record: Alliance): Item[] {
    const spoils = record.sharedCache;
    record.sharedCache = [];
    return spoils;
}
