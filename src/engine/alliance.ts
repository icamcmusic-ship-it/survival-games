import { traitMod } from '../data/traits';
import { ARCHETYPES } from '../data/archetypes';
import { Alliance, EventType, GameState, Item, Tribute } from '../models/types';
import { ALLIANCES, PROFICIENCY, RELATIONSHIPS, ROMANCE } from '../data/balance';
import { announceCharter, rollCharter } from './allianceCharter';
import { SimContext, getAlive } from './context';
import { cycleOf, noteFormerAllies, noteSharedCycle } from './memory';
import { adjustRel, adjustTrust, getRel } from './relationships';
import { pactOath, pactStrictness, rollPact } from './alliancePact';
import { noteTookOverLead } from './runRecords';
import { trainProficiency } from './proficiency';
import { giveItem } from './items';

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

/**
 * Whether `o` counts as a rival to `t` for sighting, noise and firelight.
 * Two loners both carry `allianceId === undefined`, so a bare
 * `o.allianceId !== t.allianceId` reads them as allies — which meant a lone
 * tribute's fire was only ever spotted by allied tributes and zone memory
 * under-recorded rivals whenever two loners shared a zone.
 */
export function isHostileTo(t: Tribute, o: Tribute): boolean {
    if (o.id === t.id) return false;
    return o.allianceId === undefined || t.allianceId === undefined || o.allianceId !== t.allianceId;
}

/**
 * Audit 4 §8.6: `Star-Crossed` is a mechanic, not a trait.
 *
 * `data/traits.ts` opens by documenting that a trait should be a row of
 * modifiers against named hooks, and that a scattered
 * `traits.includes('...')` check is the failure the file exists to remove. A
 * grep found **56** of them still in the engine, and `Star-Crossed` was twelve
 * — by a distance the largest, and the clearest case, because it is not a
 * disposition at all. It is a *state flag* that happens to be stored in the
 * trait array: the showmance layer sets it, the romance beats read it, the
 * epilogue reads it, and it carries no `mods` row because there is nothing for
 * one to say.
 *
 * So it gets a predicate rather than twelve string literals, next to
 * `areLovers`, which is the function it exists to support.
 */
export function isStarCrossed(t: Pick<Tribute, 'traits'>): boolean {
    return t.traits.includes('Star-Crossed');
}

export function areLovers(a: Tribute, b: Tribute): boolean {
    if (a.id === b.id) return false;
    if (!isStarCrossed(a) || !isStarCrossed(b)) return false;
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
        // AUDIT-6 §12.2 `leadership`: whether people actually follow this one.
        const score = (t: Tribute) =>
            t.attributes.charisma * 1.6 + t.attributes.strength + t.trainingScore * 0.5 + t.kills * 2
            + traitMod(t, 'leadership');
        return score(m) > score(best) ? m : best;
    });
}

/**
 * Creates the record for a newly-formed alliance, including whatever they
 * agreed out loud. The pact is the interesting part: a group that has said
 * "until the final eight" has committed to a public deadline.
 */
/**
 * §4.4: who does what inside the group.
 *
 * An Alliance was a leaderId and a flat memberIds, which meant a coup changed
 * one string and a betrayal had no natural target — everyone in the group was
 * mechanically interchangeable, so the only thing that could distinguish them
 * was regard. Roles are assigned once on formation from what each member is
 * actually best at, and each one is a job somebody else can want:
 *
 *   quartermaster  holds the cache. The obvious knife target, and the member a
 *                  charter breach over rations is measured against.
 *   scout          moves ahead of the group; their sightings are the group's.
 *   muscle         the one sent to the front of a fight.
 *   medic          patches the others up before themselves.
 *
 * A role is never assigned to somebody who is not in the group.
 *
 * Audit 3 §1.8/§4.3: this used to hand out all four roles to every group of two
 * or more, so each of the four was assigned in exactly 1,748 of 1,848 sampled
 * alliances — 46% of which were pairs. Two people wearing four hats is not a
 * division of labour, and every read site downstream was reading a label with
 * no information in it: `combat.ts` gives the muscle a draw and the medic a
 * shield, which in a pair was frequently the same person getting both, and
 * "kill the quartermaster to break the group" was a strategy against somebody
 * who was also the scout, the muscle and the medic.
 *
 * Roles are now dealt out to fit the group. A pair has one job worth naming —
 * who holds the supplies — and a role is never given to somebody who already
 * holds one until everybody has one, so a group of three has three distinct
 * people doing three distinct things. Only a group of four or more fields the
 * full set, which is what makes the full set mean something.
 */
export function assignRoles(members: Tribute[], leader: Tribute): Alliance['roles'] {
    if (members.length < 2) return undefined;
    // Ordered by how much the group notices losing them, so a small group keeps
    // the jobs that matter: somebody holds the food before anybody walks point.
    const jobs: Array<[keyof NonNullable<Alliance['roles']>, (t: Tribute) => number]> = [
        ['quartermaster', t => t.attributes.intelligence + t.attributes.strength * 0.5
            // Not the leader where the group is big enough to spread the work: a
            // leader who also holds the supplies is a dictatorship, not a pact.
            + (members.length > 2 && t.id === leader.id ? -4 : 0)],
        ['muscle', t => t.attributes.strength * 1.5 + t.kills],
        ['scout', t => t.attributes.stealth * 1.4 + t.attributes.agility],
        ['medic', t => t.attributes.intelligence * 1.2 + (t.proficiencies?.medicine ?? 0) * 2],
        /*
         * AUDIT-6 §4.2: four more, ordered after the original four so a small
         * group still fills the jobs it cannot do without first. A group only
         * reaches these once it is big enough that specialising is possible —
         * which is exactly when "who are you in this group" stopped having an
         * answer under the old roster.
         */
        ['face', t => t.attributes.charisma * 1.5 + (t.proficiencies?.persuasion ?? 0) * 2],
        ['watch', t => t.attributes.stealth + t.attributes.willpower * 1.2 + traitMod(t, 'awarenessNight') * 2],
        ['runner', t => t.attributes.agility * 1.4 + t.attributes.endurance],
        ['keeper', t => t.attributes.intelligence * 1.3 + t.attributes.willpower],
    ];
    /*
     * A pair names one job, a trio three, four or more the lot.
     *
     * Audit 4 §4.2: and for a pair that job used to be `quartermaster`,
     * because it is first in the list. 47.6% of all alliance-samples are
     * pairs, so for roughly half of all alliance-time the only named role in
     * the game was the one with no effect in a pair: quartermaster's three
     * read sites are a betrayal weight, the cache being lost when they die,
     * and a log line. `muscle` and `medic` — the two roles with combat teeth —
     * are both gated on `allyPresent`, and in a pair the ally is by definition
     * the other role-holder, which a pair does not have.
     *
     * So a pair names the job that does something when there are two of you.
     * Whoever is the better fighter is the muscle; the other one is not
     * nothing, they are the one who patches them up. Two people, two jobs, and
     * both of the combat hooks reachable at the group size that is half the
     * game.
     *
     * AUDIT-7 §4.2: "four or more the lot" was not true, and two roles were
     * unreachable because of it.
     *
     * `slots` was `min(jobs.length, members.length)`, so role *n* needed a
     * group of *n+1*: `runner` at index 6 needed seven members and `keeper` at
     * index 7 needed eight. `ALLIANCES.maxSize` is 6 and the grand-coalition
     * extra is 2, so eight is the absolute ceiling of the game — and across
     * 7,680 live alliance samples neither role was filled once. They were also
     * read by nothing: the comment on `AllianceRole` in types.ts says `runner`
     * carries the cache and `keeper` holds the group's debts, and neither
     * sentence had an implementation. A role nobody can hold, that nothing
     * reads, is three lines of scoring and a union member.
     *
     * A group of four or more now fills every job, doubling a member up where
     * there are more jobs than people — which is what a small group does, and
     * what the paragraph above always claimed. `taken` still spreads the work
     * first: nobody holds a second job until everybody holds a first.
     */
    if (members.length === 2) {
        const [a, b] = members;
        const fighter = jobs[1][1](a) >= jobs[1][1](b) ? a : b;
        const other = fighter === a ? b : a;
        return { muscle: fighter.id, medic: other.id };
    }
    const slots = members.length >= ALLIANCES.allRolesFrom ? jobs.length : Math.min(jobs.length, members.length);
    const roles: NonNullable<Alliance['roles']> = {};
    const taken = new Set<string>();
    jobs.slice(0, slots).forEach(([role, score]) => {
        const free = members.filter(m => !taken.has(m.id));
        // Everybody already holds something: fall back to the whole group
        // rather than leaving the role unfilled. With `allRolesFrom` this is
        // now the ordinary case for a group of four to seven rather than a
        // safety net that never fired.
        const pool = free.length > 0 ? free : members;
        const pick = pool.reduce((top, m) => (score(m) > score(top) ? m : top));
        roles[role] = pick.id;
        taken.add(pick.id);
    });
    return roles;
}

/**
 * §4.5: names the group for the broadcast. The Capitol brands everything it
 * televises; an alliance the commentators can refer to by name is one the
 * audience follows week to week.
 */
function brandFor(ctx: SimContext, id: string, leader: Tribute, members: Tribute[]): string {
    if (id.startsWith('career-pack')) return 'the Career pack';
    const districts = [...new Set(members.map(m => m.district))].sort((a, b) => a - b);
    const districtName = districts.length === 1
        ? `the District ${districts[0]} bloc`
        : `the ${districts.map(d => `${d}`).join('-')} compact`;
    // §11.2: three patterns made every group in every run read the same. The
    // pool now mixes member-derived brands with the ones the crowd invents —
    // a Capitol audience does not wait for permission to nickname a gang.
    const patterns = [
        // Member-derived: how the pack would introduce itself.
        `the ${leader.name} crew`,
        districtName,
        `${leader.name}'s ${members.length > 2 ? 'company' : 'pair'}`,
        `the ${leader.name} pact`,
        members.length >= 4 ? `${leader.name}'s ${members.length}` : `${leader.name} and company`,
        `the ${districts.map(d => `${d}`).join(' and ')} alliance`,
        // Crowd-invented: what the commentators started calling them and
        // could not be stopped from calling them.
        'the Outliers',
        'the Quiet Table',
        'the Long Odds',
        'the Second Reaping',
        'the Leftovers',
        'the Night Shift',
        'the Slow Knives',
        'the Understudies',
        'the Homesick',
        'the Holdouts',
        'the Cheap Seats',
        `the ${leader.name} problem`,
        'the Unsponsored',
        'the Late Entries',
    ];
    return ctx.rng.pick(patterns);
}

/**
 * §4: what kind of leader somebody is, from what kind of tribute they are.
 * Deterministic — no RNG draw — so it survives a seeded replay and so two
 * runs of the same seed put the same person in charge the same way.
 */
export function leaderStyleOf(leader: Tribute): 'democratic' | 'tyrant' | 'absent' {
    const arch = ARCHETYPES[leader.archetype];
    const hard = arch.aggression + arch.treachery - arch.allianceAffinity;
    if (hard > ALLIANCES.tyrantThreshold) return 'tyrant';
    /*
     * AUDIT-6 §4.2: the third style. A leader who is cautious, unassertive and
     * disinclined to bind anybody is not running a democracy — they are not
     * running anything, and the group knows it. Read off the same three
     * archetype dials as the tyrant, from the other end: low aggression, low
     * alliance affinity, high caution.
     */
    const detached = arch.caution - arch.allianceAffinity - arch.aggression;
    if (detached > ALLIANCES.absentThreshold) return 'absent';
    return 'democratic';
}

export function registerAlliance(ctx: SimContext, id: string, members: Tribute[]): Alliance {
    const records = allianceRecords(ctx.state);
    // Star-crossed lovers get the record — a camp, a leader for movement — but
    // none of the machinery of a gang: no rolled pact, no charter terms, no
    // broadcast brand. The rest of the codebase already skips `lovers-` ids for
    // recruitment and pact expiry; falling in love should not read like a
    // Career pack signing articles.
    const isLoversBond = id.startsWith('lovers-');
    // §4.1: rolled against the *live* field, so a small-field run cannot swear
    // to a deadline it is already past.
    const pact: Alliance['pact'] = isLoversBond ? { kind: 'no-pact' } : rollPact(ctx.rng, ctx.state, members);

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
        pactSwornField: getAlive(ctx.state).length,
        cacheContributions: {},
        charter: isLoversBond ? [] : rollCharter(ctx.rng, members),
        leaderStyle: leaderStyleOf(leader),
        // §4: the ledger baseline the counting clauses are measured against.
        lootedAtCharter: Object.fromEntries(members.map(m => [m.id, m.corpsesLooted ?? 0])),
        intelSoldAtCharter: Object.fromEntries(members.map(m => [m.id, m.intelSold ?? 0])),
        // §4.4: lovers are not an organisation and do not get assigned jobs.
        roles: isLoversBond ? undefined : assignRoles(members, leader),
    };
    records[id] = record;
    announceCharter(ctx, record, members);
    /*
     * AUDIT-8 §3.5: `oratory` is the skill for addressing a *group*, and it had
     * three sites — the Herald's once-per-run signature and the two speakers at
     * a bloc treaty (244 sworn per 400 runs). 91.0% of tributes never trained
     * it, which is why §4.5's bloc-treaty renewal rate reads a skill nobody
     * has: 77% of treaties ended only because one side died.
     *
     * Swearing a charter in front of the people it binds is the commonest
     * occasion in the game for exactly this competence, and it was not a
     * training site. The leader carries it; everyone else is being spoken to.
     */
    if (!isLoversBond && members.length >= 3) {
        trainProficiency(leader, 'oratory', undefined, PROFICIENCY.oratoryAddressShare);
    }

    // §4.4: the division of labour, said out loud. Only for groups big enough
    // for it to be a division rather than a description of a pair.
    if (record.roles && members.length >= 3) {
        const named = (role: keyof NonNullable<Alliance['roles']>) =>
            members.find(m => m.id === record.roles?.[role])?.name;
        const quartermaster = named('quartermaster');
        const scout = named('scout');
        if (quartermaster && scout) {
            // §22: the group is the line's cast and only two of them were in it.
            const rest = members
                .filter(m => m.name !== quartermaster && m.name !== scout)
                .map(m => m.name);
            ctx.logEvent(
                `${quartermaster} takes the supplies and ${scout} walks point.`
                + (rest.length > 0 ? ` ${rest.join(', ')} take${rest.length === 1 ? 's' : ''} no fixed role.` : ''),
                members.map(m => m.id),
                { category: 'alliance' }
            );
        }
    }

    const oath = pactOath(pact, targetId => ctx.state.tributes.find(t => t.id === targetId)?.name ?? 'them');
    if (oath) {
        ctx.logEvent(
            `${members.map(m => m.name).join(' and ')} shake on it: they ${oath}.`,
            members.map(m => m.id),
            { type: 'pact-declared', important: true, category: 'alliance' }
        );
    }
    // AUDIT-10 B05: the group exists from here; the chronicle starts with it.
    recordAllianceState(ctx.state, record);
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

    keep.memberIds = members.map(m => m.id);
    const merged = pickLeader(members);
    keep.leaderId = merged.id;
    // §4.4: a merged group re-divides the work across the whole roster, the
    // same way it re-elects.
    if (keep.roles) keep.roles = assignRoles(members, merged);
    if (absorbed) {
        keep.sharedCache = [...keep.sharedCache, ...absorbed.sharedCache].slice(0, ALLIANCES.cacheMaxSize);
        keep.formedCycle = Math.min(keep.formedCycle, absorbed.formedCycle);
        if (pactStrictness(absorbed.pact) > pactStrictness(keep.pact)) {
            keep.pact = absorbed.pact;
            keep.pactSwornField = absorbed.pactSwornField;
        }
        // §4.2: a merge pools two ledgers of who fed whom.
        const pooled: Record<string, number> = { ...(keep.cacheContributions ?? {}) };
        Object.entries(absorbed.cacheContributions ?? {}).forEach(([id, n]) => { pooled[id] = (pooled[id] ?? 0) + n; });
        keep.cacheContributions = pooled;
    }
    // AUDIT-10 B05: a merge is how packs reach their largest, so the chronicle
    // has to see the moment rather than waiting for the next reconcile.
    recordAllianceState(ctx.state, keep);
    return keep;
}


/**
 * §4.2: who takes over, and what it costs when that is not obvious.
 *
 * Three outcomes, in ascending order of how badly it goes:
 *
 *  - **uncontested** — there is a named heir and the group has no stronger
 *    preference. The charter did its job and nobody has to have an argument
 *    about it in front of a body.
 *  - **passed over** — the group plainly backs somebody else. The heir does
 *    not get it, which is its own quiet humiliation and its own grudge.
 *  - **contested** — the two are close enough that neither can claim it, and
 *    the group splits along the line between them. This is the failure mode
 *    worth having: an alliance that survives its leader is not guaranteed to
 *    survive the question of who replaces them.
 */
function resolveSuccession(ctx: SimContext, record: Alliance, members: Tribute[]) {
    const backingFor = (t: Tribute) =>
        members.reduce((sum, m) => sum + (m.id === t.id ? 0 : getRel(m, t.id)), 0);

    const heir = record.successorId
        ? members.find(m => m.id === record.successorId)
        : undefined;
    const favourite = pickLeader(members);

    const install = (next: Tribute, line: string, type: EventType) => {
        record.leaderId = next.id;
        if (heir && next.id === heir.id) next.succeededAsHeir = true;
        record.successorId = undefined;
        // §12: 'Understudy' — they are running this group because the person
        // who was running it is dead.
        noteTookOverLead(next);
        ctx.logEvent(line, members.map(m => m.id), { type, important: true, category: 'alliance' });
    };

    // No heir was ever named, or they did not outlive the leader either.
    if (!heir) {
        install(favourite,
            // §22: "the group" is this line's own cast list.
            `${favourite.name} takes over the group. No heir was named and nobody objects.`
            + ` The rest of it is ${members.filter(m => m.id !== favourite.id).map(m => m.name).join(', ')}.`,
            'succession-unnamed');
        return;
    }

    if (heir.id === favourite.id) {
        install(heir,
            `${heir.name} takes over the group, having been named for it.`
            + ` ${members.filter(m => m.id !== heir.id).map(m => m.name).join(', ')} accept it.`,
            'succession-heir')
        return;
    }

    const gap = backingFor(favourite) - backingFor(heir);

    // Close enough that neither of them can simply have it.
    if (gap < ALLIANCES.successionContestMargin) {
        if (ctx.rng.chance(ALLIANCES.successionSplitChance)) {
            const withHeir = members.filter(m =>
                m.id === heir.id || (m.id !== favourite.id && getRel(m, heir.id) >= getRel(m, favourite.id)));
            const withFavourite = members.filter(m => !withHeir.includes(m));
            // A split needs two real groups; otherwise it is one person
            // leaving. §4: "two real groups" meant four members at the moment
            // a leader died, which put the whole beat at four firings in 400
            // runs. Three is enough for the group to come apart — the pair
            // keeps the camp, the odd one out keeps the grudge — and that is
            // the story the mechanic exists to tell.
            if (withHeir.length >= 1 && withFavourite.length >= 1
                && withHeir.length + withFavourite.length >= ALLIANCES.successionSplitMinMembers) {
                const splinterId = `alliance-succession-${record.id}-${cycleOf(ctx.state)}`;
                withHeir.forEach(m => { m.allianceId = splinterId; });
                // A group that comes apart is still a group. Assigning the id
                // and leaving it there gave the breakaway no record until the
                // politics sweep back-filled a bare one — no pact, no charter,
                // no roles, and an array-order leader in between — so no camp
                // formed by a schism could ever swear to anything.
                registerAlliance(ctx, splinterId, withHeir);
                record.memberIds = withFavourite.map(m => m.id);
                record.leaderId = favourite.id;
                record.successorId = undefined;
                withHeir.forEach(a => withFavourite.forEach(b => {
                    adjustRel(a, b.id, -ALLIANCES.successionLoserRegard);
                    adjustRel(b, a.id, -ALLIANCES.successionLoserRegard);
                }));
                ctx.logEvent(
                    `The leader named ${heir.name}; the group would rather have ${favourite.name}; and there is nobody left `
                    + 'with the standing to settle it. By the afternoon there are two camps and neither of them is going to be the one that apologises.',
                    members.map(m => m.id),
                    { type: 'succession-split', important: true, category: 'alliance' }
                );
                return;
            }
        }
        install(heir,
            `${heir.name} was named, ${favourite.name} is what the group would have chosen, and the argument goes on long enough `
            + 'that having been named turns out to be the only thing anybody can point at. It is not a mandate.',
            'succession-heir');
        adjustRel(favourite, heir.id, -ALLIANCES.successionLoserRegard);
        return;
    }

    // The group is not close on it at all: the heir is simply passed over.
    install(favourite,
        `The leader named ${heir.name}. The group, without ever putting it to a vote, follows ${favourite.name} instead. `
        + `${heir.name} does not make anything of it, and does not forget it either.`,
        'succession-passed-over');
    adjustRel(heir, favourite.id, -ALLIANCES.successionLoserRegard);
}

/**
 * Per-cycle upkeep on the structure itself: prune the dead, re-elect when the
 * leader is gone or has lost the room, and drop records nobody belongs to.
 */
/**
 * §4: the fracture.
 *
 * A bloc that got past the ordinary ceiling is not a stable object — it is a
 * Career year's worth of people who all agreed to postpone the same problem.
 * Once it is that big it comes apart on its own, loudly, along the line of
 * who actually likes whom, rather than quietly shedding one member at a time.
 */
export function fractureBlocs(ctx: SimContext) {
    const records = allianceRecords(ctx.state);
    Object.entries(records).forEach(([id, record]) => {
        if (id.startsWith('lovers-')) return;
        const members = membersOf(ctx.state, id);
        if (members.length < ALLIANCES.fractureSize) return;
        if (!ctx.rng.chance(ALLIANCES.fractureChance)) return;

        const leader = members.find(m => m.id === record.leaderId) ?? pickLeader(members);
        // Who would still follow them, and who has been waiting to say so.
        // Sorted by how much they actually back the leader, then cut in the
        // middle: a bloc this size always contains two halves, and asking for
        // an absolute regard floor on both sides meant the beat could never
        // fire at all (0 fractures in 400 runs against 8-member packs).
        const ranked = [...members]
            .filter(m => m.id !== leader.id)
            .sort((a, b) => getRel(b, leader.id) - getRel(a, leader.id));
        const keep = Math.max(1, ranked.filter(m => getRel(m, leader.id) >= ALLIANCES.fractureLoyalRegard).length);
        const loyal = [leader, ...ranked.slice(0, keep)];
        const rest = ranked.slice(keep);
        if (loyal.length < 2 || rest.length < 2) return;

        const splinterId = `alliance-fracture-${id}-${cycleOf(ctx.state)}`;
        rest.forEach(m => { m.allianceId = splinterId; });
        registerAlliance(ctx, splinterId, rest);
        record.memberIds = loyal.map(m => m.id);
        record.leaderId = leader.id;
        record.successorId = undefined;
        loyal.forEach(a => rest.forEach(b => {
            adjustRel(a, b.id, -ALLIANCES.fractureRegardCost);
            adjustRel(b, a.id, -ALLIANCES.fractureRegardCost);
        }));
        ctx.logEvent(
            `The big pack stops being one. ${leader.name} keeps ${loyal.filter(m => m.id !== leader.id).map(m => m.name).join(', ')}; `
            + `${rest.map(m => m.name).join(', ')} walk off together. Everybody had known for days that a group that size was only ever an arrangement.`,
            members.map(m => m.id),
            { type: 'fracture', important: true, category: 'alliance' }
        );
    });
}

/**
 * AUDIT-10 B05: fold one alliance's current state into the durable chronicle.
 *
 * Called every cycle for every living group, so the peak is the peak as it
 * happened rather than whatever the group was holding when it came apart. The
 * roster is a union: somebody who joined on day two and died on day four was
 * in the pack, and a record that forgot them would misreport its own size.
 */
export function recordAllianceState(state: GameState, record: Alliance) {
    state.allianceChronicle = state.allianceChronicle ?? [];
    const cycle = cycleOf(state);
    let entry = state.allianceChronicle.find(e => e.id === record.id);
    if (!entry) {
        entry = {
            id: record.id,
            name: record.name,
            peakSize: 0,
            memberIds: [],
            formedCycle: record.formedCycle ?? cycle,
            lastCycle: cycle,
        };
        state.allianceChronicle.push(entry);
    }
    if (record.name) entry.name = record.name;
    record.memberIds.forEach(mid => { if (!entry!.memberIds.includes(mid)) entry!.memberIds.push(mid); });
    entry.peakSize = Math.max(entry.peakSize, record.memberIds.length);
    entry.lastCycle = cycle;
}

export function reconcileAlliances(ctx: SimContext) {
    const records = allianceRecords(ctx.state);

    Object.keys(records).forEach(id => {
        recordAllianceState(ctx.state, records[id]);
        const members = membersOf(ctx.state, id);
        if (members.length < 2) {
            // A one-person alliance is not an alliance. This also cleans up the
            // id left on a lone survivor, which otherwise persisted and showed
            // up in the UI as a standing pack of one.
            // §3.7: a pack that has simply come apart — the last two members
            // separated, or died down to one — still leaves whoever is left
            // holding six days of having been in it with somebody.
            // The living membership is already down to one, so it has to be
            // the record's last known roster that says who they were in it
            // with — `noteFormerAllies` over one tribute writes nothing, and
            // that is how the whole ex-ally layer went unreached on this path.
            const roster = (records[id].memberIds ?? [])
                .map(mid => ctx.state.tributes.find(o => o.id === mid))
                .filter((o): o is Tribute => o !== undefined);
            noteFormerAllies(roster.length >= 2 ? roster : members);
            /*
             * AUDIT-9 B07: the third and quietest teardown path.
             *
             * This one has no narration and no ceremony — it is the record
             * being pruned because the group has died or drifted down to one —
             * and it was deleting whatever the group was still holding along
             * with it. The survivor inherits it; with nobody alive it stays on
             * the ground as a cache, which is the honest answer and gives the
             * arena something to find.
             */
            const division = distributeCache(ctx, records[id], members);
            if (division.given.length > 0) {
                ctx.logEvent(
                    `What the group was keeping has one owner now: ${cacheDivisionLine(division)}`,
                    division.given.map(g => g.to.id),
                    { category: 'loot' },
                );
            }
            members.forEach(m => { delete m.allianceId; });
            delete records[id];
            return;
        }

        const record = records[id];
        record.memberIds = members.map(m => m.id);
        // §4: one more cycle of having been in it together, on both sides.
        noteSharedCycle(members);

        const leader = members.find(m => m.id === record.leaderId);
        if (!leader) {
            // §4.2: the succession. This used to re-run `pickLeader` from
            // scratch, which quietly made `successorId` decorative in exactly
            // the case it exists for — the coup path and the expulsion path
            // both honoured the named heir, and the commonest cause of a
            // leadership change by a wide margin, the leader dying, did not.
            resolveSuccession(ctx, record, members);
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
                    // §22: "nobody in the group" is the rest of the group, and
                    // they were on this line without being in it.
                    `${challenger.name} stops deferring to ${leader.name}, and nobody in the group argues.`
                    + ` ${members.filter(m => m.id !== challenger.id && m.id !== leader.id).map(m => m.name).join(', ') || 'Nobody else'}`
                    + ` ${members.length > 3 ? 'have' : 'has'} a new leader by the end of the sentence.`,
                    members.map(m => m.id),
                    { type: 'leadership-changes', important: true, category: 'alliance' }
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
        // §4.2: the cache is a political object. Who fed the group is a claim
        // when it splits, and a reason for the quartermaster to play favourites.
        record.cacheContributions = record.cacheContributions ?? {};
        record.cacheContributions[m.id] = (record.cacheContributions[m.id] ?? 0) + spare.value;
        /*
         * AUDIT-7 §4.1: feeding the group is the commonest trust-building act
         * in the arena and moved no trust at all.
         *
         * `cacheContributions` already records who fed the group, because it is
         * a *claim* when the group splits. It is also the plainest evidence
         * anybody in an alliance ever gets that a member is in it for more than
         * themselves, and the stored trust axis — which had three ceremonial
         * write sites and 12.3% fill across ally pairs — is exactly where that
         * belongs. Small per act, because it is a small act; it accumulates
         * over a run the way the ceremonies cannot.
         */
        members.forEach(other => {
            if (other.id === m.id) return;
            adjustTrust(other, m.id, RELATIONSHIPS.trustSharedCache);
        });
        ctx.logEvent(
            `${m.name} adds their ${spare.name} to the group's stash in ${record.campZone ?? m.zone}.`,
            [m.id],
            { type: 'cache-contributions', category: 'alliance' }
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

/**
 * AUDIT-9 B07: an alliance ends; the food it was holding does not evaporate.
 *
 * Three paths tore a group down — the `split-at-eight` clause coming due, the
 * rot-dissolve when average regard falls through the floor, and
 * `reconcileAlliances` pruning a record whose membership has dropped below two
 * — and not one of them touched `sharedCache`. The split-at-eight line even
 * says out loud that "they divide what is in the cache"; nothing was divided,
 * the record was pruned a moment later, and the items ceased to exist.
 * Reproduced: one cached loaf in, zero items received, record deleted.
 *
 * Distribution is round-robin from the leader outward, which is both the
 * simplest defensible allocation and the one the charter language implies. It
 * goes through `giveItem`, so capacity applies and anything that genuinely
 * cannot be carried is *dropped* and returned rather than deleted — the same
 * conservation contract every other transfer in the game obeys.
 *
 * Returns what was handed out and what was left on the ground, so the caller
 * can narrate the actual allocation instead of asserting one.
 */
export function distributeCache(
    ctx: SimContext,
    record: Alliance | undefined,
    members: Tribute[],
): { given: Array<{ to: Tribute; item: Item }>; dropped: Item[] } {
    const given: Array<{ to: Tribute; item: Item }> = [];
    const dropped: Item[] = [];
    if (!record || record.sharedCache.length === 0) return { given, dropped };

    const living = members.filter(m => m.status === 'alive');
    const spoils = emptyCache(record);
    if (living.length === 0) {
        // Nobody left to take it. It stays where the group kept it, which is
        // what the abandoned-camp layer is for; the items are still real.
        ctx.state.abandonedCamps = ctx.state.abandonedCamps ?? [];
        ctx.state.abandonedCamps.push({
            zone: record.campZone ?? ctx.state.arena.zones[0].name,
            ownerId: record.leaderId ?? '',
            ownerName: 'the group that kept it',
            cycle: ctx.state.cycle ?? 0,
            items: spoils.map(i => i.id),
        });
        return { given, dropped: spoils };
    }

    // Leader first, then the rest in roster order: a deterministic allocation,
    // so a replay divides the cache the same way.
    const order = [
        ...living.filter(m => m.id === record.leaderId),
        ...living.filter(m => m.id !== record.leaderId),
    ];
    spoils.forEach((item, index) => {
        const taker = order[index % order.length];
        const spilled = giveItem(taker, item);
        if (spilled.includes(item)) dropped.push(item);
        else given.push({ to: taker, item });
        spilled.filter((i: Item) => i !== item).forEach((i: Item) => dropped.push(i));
    });
    return { given, dropped };
}

/** One clause naming who actually ended up with what. */
export function cacheDivisionLine(division: { given: Array<{ to: Tribute; item: Item }>; dropped: Item[] }): string {
    if (division.given.length === 0 && division.dropped.length === 0) return '';
    const handed = division.given.map(g => `${g.to.name} takes ${g.item.name}`).join('; ');
    const left = division.dropped.length > 0
        ? ` ${division.dropped.map(i => i.name).join(', ')} ${division.dropped.length === 1 ? 'is' : 'are'} left where it lay.`
        : '';
    return `${handed ? `${handed}.` : ''}${left}`.trim();
}

/**
 * §4.3: a performed bond is a claim, and claims can be tested.
 *
 * The Star-Crossed-as-strategy idea only becomes a strategy if it can fail.
 * Before this, a performer collected the sponsor benefit of a devotion they did
 * not feel with no exposure at all — the act was invisible to everyone in the
 * arena and everyone in the Capitol, forever. Two things can now catch it: a
 * sharp tribute standing close enough to watch them not mean it, and the
 * cameras themselves once the pair are excited enough to be worth watching
 * closely. Both are far more dangerous to the performer than being alone.
 */
export function sniffPerformances(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    alive.forEach(performer => {
        const shown = Object.keys(performer.displayedRegard ?? {});
        if (shown.length === 0) return;
        shown.forEach(targetId => {
            const target = alive.find(o => o.id === targetId);
            if (!target) return;
            const observers = alive.filter(o =>
                o.id !== performer.id && o.zone === performer.zone
                && o.attributes.intelligence >= ROMANCE.performedSniffIntelligence);
            const crowdWatching = performer.excitementRating >= ROMANCE.performedExposedExcitement;
            if (observers.length === 0 && !crowdWatching) return;
            if (!ctx.rng.chance(ROMANCE.performedSniffChance)) return;

            const witness = observers[0];
            // The Capitol paid for a love story and is being sold a rehearsal.
            performer.sponsorTrust = Math.max(0, performer.sponsorTrust - ROMANCE.performedExposedTrust);
            if (performer.displayedRegard) delete performer.displayedRegard[targetId];
            adjustRel(target, performer.id, -ROMANCE.performedExposedRegard);
            ctx.logEvent(
                witness
                    ? `${witness.name} watches ${performer.name} say it again and, this time, hears the rehearsal in it. `
                      + `Whatever is between ${performer.name} and ${target.name}, one half of it is a performance — and now three people know.`
                    : `The cameras are close enough on ${performer.name} to catch the half-second before the line lands. `
                      + `Panem sees it at the same moment ${target.name} does.`,
                witness ? [performer.id, target.id, witness.id] : [performer.id, target.id],
                { important: true, category: 'betrayal' }
            );
        });
    });
}


/**
 * §9 (requests): how willing a Career is to attach themselves to somebody from
 * an outer district, as a multiplier on an alliance roll.
 *
 * The same rule the training floor uses (`mingleWillingness` in
 * phases/training.ts) applied to the thing that actually matters — who ends up
 * in a group with whom. A Career allies with Careers. The exceptions are a
 * tribute strong enough to be worth having, and a tribute the pack has already
 * accepted: an existing shared alliance, or a training pact struck before the
 * gong, which is exactly what "formally accepted" means in this simulation.
 *
 * Symmetric: it takes both of them, so an outer-district tribute who badly
 * wants in still does not get in.
 */
export function careerSocialFactor(a: Tribute, b: Tribute): number {
    const isCareerish = (t: Tribute) => t.isCareer || t.archetype === 'career';
    const pair: Array<[Tribute, Tribute]> = [[a, b], [b, a]];
    return pair.reduce((lowest, [self, other]) => {
        if (!isCareerish(self) || isCareerish(other)) return lowest;
        if (self.trainingPact?.includes(other.id)) return lowest;
        if (self.allianceId !== undefined && self.allianceId === other.allianceId) return lowest;
        const worthHaving = other.trainingScore >= ALLIANCES.careerRespectScore
            || other.attributes.strength >= ALLIANCES.careerRespectStrength
            || other.kills >= ALLIANCES.careerRespectKills;
        return Math.min(lowest, worthHaving ? ALLIANCES.careerStrongOutlierFactor : ALLIANCES.careerOutlierFactor);
    }, 1);
}
