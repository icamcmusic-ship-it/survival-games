import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Tribute } from '../../models/types';
import { ARCHETYPES, archetypeCompatibility } from '../../data/archetypes';
import { ALLIANCES, PROTECTOR_BOND, ROMANCE } from '../../data/balance';
import { ALLIANCE_TEXTS, PROTECTOR_BOND_TEXTS, ROMANCE_TEXTS } from '../../data/flavorText';
import { adjustRel, getRel } from '../relationships';
import { cyclesSinceContact, distrustFactor, ensureMemory, hasStoodBy, noteContact } from '../memory';
import { allianceOf, areLovers, contributeToCache, isPerforming, membersOf, mergeAllianceRecords, pickLeader, reconcileAlliances, registerAlliance } from '../alliance';
import { resolveBetrayal } from '../betrayal';
import { betrayalReluctance } from '../debts';
import { addExcitement } from '../audience';
import { traitMod } from '../../data/traits';

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

/** Everything a betrayer stands to walk away with. */
function lootValue(t: Tribute): number {
    return t.inventory.reduce((sum, i) => sum + i.value, 0);
}

/** How easy this ally would be to put down right now. */
function weakness(t: Tribute): number {
    return (100 - t.health) + (t.injuries.bleeding ? 20 : 0) + (t.inventory.some(i => i.type === 'weapon') ? 0 : 25);
}

/**
 * Who gets the knife.
 *
 * Target selection used to be a uniform pick from the alliance, which meant a
 * treacherous Career was exactly as likely to turn on the ally they loved and
 * who was carrying nothing as on the wounded stranger hauling a medkit and a
 * trident. Betrayal is opportunism: it weighs the payday, the grudge, and how
 * winnable the fight is.
 */
function pickBetrayalTarget(ctx: SimContext, betrayer: Tribute, members: Tribute[]): Tribute | undefined {
    const candidates = members.filter(m => m.id !== betrayer.id);
    if (candidates.length === 0) return undefined;

    const scored = candidates.map(m => {
        // Star-crossed lovers are never a target — unless the betrayer is the
        // one performing the romance, in which case the bond is a strategy and
        // was never going to stop them. That asymmetry is the whole point of a
        // performed bond existing.
        const bonded = areLovers(betrayer, m) && !isPerforming(betrayer, m.id);
        if (bonded) return { m, weight: 0 };

        let weight = 1;
        weight += lootValue(m) * ALLIANCES.betrayalLootWeight;
        weight += Math.max(0, -getRel(betrayer, m.id)) * ALLIANCES.betrayalDislikeWeight;
        weight += weakness(m) * ALLIANCES.betrayalWeaknessWeight;
        // Genuine affection is the one thing that stays a betrayer's hand.
        weight *= Math.max(0.05, 1 - Math.max(0, getRel(betrayer, m.id)) / 110);
        // Someone who already burned you goes to the top of the list.
        if (ensureMemory(betrayer).betrayedBy.includes(m.id)) weight *= ALLIANCES.betrayedFirstStrikeWeight;
        // Someone who never stops watching is a much worse mark.
        weight *= Math.max(0.1, 1 - traitMod(m, 'betrayalResist'));
        // And you do not knife the person who pulled you out of a fire. A debt
        // was recorded and then never charged for — this is the charge.
        weight *= betrayalReluctance(betrayer, m.id);
        return { m, weight: Math.max(0, weight) };
    }).filter(s => s.weight > 0);

    if (scored.length === 0) return undefined;
    let roll = ctx.rng.nextFloat() * scored.reduce((sum, s) => sum + s.weight, 0);
    for (const s of scored) {
        roll -= s.weight;
        if (roll <= 0) return s.m;
    }
    return scored[scored.length - 1].m;
}

/** Who does the betraying: treachery, plus how badly they have already been burned. */
function pickBetrayer(ctx: SimContext, members: Tribute[]): Tribute {
    const scored = members.map(m => ({
        m,
        weight: Math.max(0.2, (1 + (ARCHETYPES[m.archetype].treachery + traitMod(m, 'treachery')) * 10)
            * distrustFactor(m)
            * (m.vitals.sanity < 40 ? 1.4 : 1)),
    }));
    let roll = ctx.rng.nextFloat() * scored.reduce((sum, s) => sum + s.weight, 0);
    for (const s of scored) {
        roll -= s.weight;
        if (roll <= 0) return s.m;
    }
    return scored[scored.length - 1].m;
}

export function processAlliances(ctx: SimContext) {
    ctx.rng = new RNG(`${ctx.state.seed}-alliances-${ctx.state.day}-${ctx.state.phase}`);
    const alive = getAlive(ctx.state);
    const alliances = new Map<string, Tribute[]>();

    alive.forEach(t => {
        if (t.allianceId) {
            if (!alliances.has(t.allianceId)) alliances.set(t.allianceId, []);
            alliances.get(t.allianceId)!.push(t);
        }
    });

    // 1. Dissolve small alliances
    alliances.forEach((members, id) => {
        if (members.length < 2) {
            members.forEach(m => delete m.allianceId);
            alliances.delete(id);
        }
    });

    // 1b. An alliance whose trust has rotted through falls apart on its own.
    alliances.forEach((members, id) => {
        if (members.length < 2) return;
        const averageTrust = members.reduce((sum, m) =>
            sum + members.reduce((inner, o) => inner + (o.id === m.id ? 0 : getRel(m, o.id)), 0) / (members.length - 1), 0) / members.length;
        if (averageTrust < -15) {
            members.forEach(m => { delete m.allianceId; });
            // One line for the whole collapse, not a near-identical one per member.
            ctx.logEvent(
                `The alliance of ${members.map(m => m.name).join(', ')} has come apart. They go their separate ways.`,
                members.map(m => m.id),
                { category: 'alliance' }
            );
            alliances.delete(id);
        }
    });

    // 2. Betrayal Logic
    alliances.forEach((members) => {
        if (members.length < 2) return;
        // Betrayal chance increases as fewer tributes remain
        const betrayalThreshold = (alive.length <= ALLIANCES.betrayalEndgameFieldSize
            ? ALLIANCES.betrayalEndgame
            : ALLIANCES.betrayalBase) * ctx.state.config.betrayalRate;

        if (ctx.rng.chance(betrayalThreshold)) {
            const betrayer = pickBetrayer(ctx, members);
            const victim = pickBetrayalTarget(ctx, betrayer, members);

            if (victim) {
                // Which shape the betrayal takes is chosen from what is actually
                // available to this pair right now — see `engine/betrayal.ts`.
                resolveBetrayal(ctx, betrayer, victim, members);
            }
        }
    });

    // 3. Dynamic Alliance Formation & Star-Crossed Lovers
    // Re-read the living: betrayals above may have killed someone since the
    // snapshot at the top of this function.
    const stillAlive = getAlive(ctx.state);
    if (stillAlive.length > ALLIANCES.formationFieldSize) {
        for (let i = 0; i < stillAlive.length; i++) {
            for (let j = i + 1; j < stillAlive.length; j++) {
                const t1 = stillAlive[i];
                const t2 = stillAlive[j];

                if (!t1.allianceId && !t2.allianceId) {
                    const rel = getRel(t1, t2.id);
                    // Archetype chemistry: affinity of both parties plus pair compatibility
                    const affinity = (ARCHETYPES[t1.archetype].allianceAffinity + ARCHETYPES[t2.archetype].allianceAffinity) / 2
                + (traitMod(t1, 'allianceAffinity') + traitMod(t2, 'allianceAffinity')) / 2;
                    const compat = archetypeCompatibility(t1.archetype, t2.archetype);
                    // The persona each sold on the interview couch matters here.
                    const persona = interviewChemistry(t1, t2);
                    // Someone who has been sold out before is far harder to recruit.
                    const trustCost = (distrustFactor(t1) + distrustFactor(t2)) / 2;

                    const formChance = Math.max(
                        ALLIANCES.minFormChance,
                        (ALLIANCES.baseFormChance + affinity + compat + persona) / trustCost
                    );
                    const relThreshold = (ALLIANCES.baseRelThreshold - compat * 100 - persona * 60) * trustCost;

                    if (rel > relThreshold && ctx.rng.chance(formChance)) {
                        const newId = `alliance-${t1.id}-${t2.id}`;
                        t1.allianceId = newId;
                        t2.allianceId = newId;
                        noteContact(ctx.state, t1, t2);
                        registerAlliance(ctx, newId, [t1, t2]);
                        ctx.logEvent(
                            fill(ctx.pickText(ALLIANCE_TEXTS.form), { t1: t1.name, t2: t2.name, zone: t1.zone }),
                            [t1.id, t2.id],
                            { important: true, category: 'alliance' }
                        );
                    }
                }
            }
        }
    }

    // 3a. Pacts coming due. A group that agreed to split at the final eight
    // has a public deadline, and the audience has been watching it approach.
    const remaining = getAlive(ctx.state).length;
    if (remaining <= ALLIANCES.finalEightSize) {
        const byId = new Map<string, Tribute[]>();
        getAlive(ctx.state).forEach(t => {
            if (!t.allianceId) return;
            if (!byId.has(t.allianceId)) byId.set(t.allianceId, []);
            byId.get(t.allianceId)!.push(t);
        });
        byId.forEach((members, id) => {
            const record = allianceOf(ctx.state, id);
            if (!record || record.pact !== 'until-the-final-eight' || members.length < 2) return;
            record.pact = 'no-pact';
            ctx.logEvent(
                `The field is down to ${remaining}. ${members.map(m => m.name).join(' and ')} agreed this was where it ended, ` +
                `and none of them pretends otherwise. The alliance dissolves exactly as promised.`,
                members.map(m => m.id),
                { important: true, category: 'alliance' }
            );
            members.forEach(m => { delete m.allianceId; });
        });
    }

    // 3b. Mergers: two duos who trust each other become a four.
    //
    // This is the path that was missing entirely. Dynamic formation only ever
    // paired two alliance-free tributes, and recruitment only ever added one
    // loner at a time, so almost every organic alliance stayed a pair for the
    // whole run no matter how well two of them got on.
    mergeAlliances(ctx);

    // 3c. Recruitment: a standing group can take in a loner they trust.
    //
    // Without this, the only alliance larger than two that could ever exist was
    // the Career pack seeded at the bloodbath — dynamic formation pairs two
    // alliance-free tributes and nothing ever grew a third member. Groups now
    // grow the way they should: by absorbing someone they already get on with,
    // who is standing in the same zone, and who is willing to be absorbed.
    const groups = new Map<string, Tribute[]>();
    getAlive(ctx.state).forEach(t => {
        if (!t.allianceId) return;
        if (!groups.has(t.allianceId)) groups.set(t.allianceId, []);
        groups.get(t.allianceId)!.push(t);
    });

    groups.forEach((members, id) => {
        if (members.length < 2 || members.length >= ALLIANCES.maxSize) return;
        // Star-crossed lovers are a pair, not the seed of a gang.
        if (id.startsWith('lovers-')) return;

        // The group recruits where its leader stands, not wherever array order
        // happens to put members[0] — the same anti-pattern alliance.ts documents.
        const zone = pickLeader(members).zone;
        const present = members.filter(m => m.zone === zone);
        if (present.length < 2) return;
        const candidates = getAlive(ctx.state).filter(o => !o.allianceId && o.zone === zone);

        candidates.forEach(candidate => {
            if (candidate.allianceId) return;
            if (members.length >= ALLIANCES.maxSize) return;

            // Both directions have to hold: the group has to want them, and
            // they have to want the group.
            const groupOpinion = present.reduce((sum, m) => sum + getRel(m, candidate.id), 0) / present.length;
            const theirOpinion = present.reduce((sum, m) => sum + getRel(candidate, m.id), 0) / present.length;
            const distrust = distrustFactor(candidate);
            const threshold = ALLIANCES.recruitThreshold * distrust;
            if (groupOpinion < threshold || theirOpinion < threshold) return;

            const affinity = ARCHETYPES[candidate.archetype].allianceAffinity + traitMod(candidate, 'allianceAffinity');
            const chance = Math.max(
                ALLIANCES.minFormChance,
                (ALLIANCES.recruitChance + affinity - (members.length - 2) * ALLIANCES.recruitSizePenalty) / distrust
            );
            if (!ctx.rng.chance(chance)) return;

            candidate.allianceId = id;
            members.forEach(m => noteContact(ctx.state, m, candidate));
            members.push(candidate);
            ctx.logEvent(
                fill(ctx.pickText(ALLIANCE_TEXTS.recruit), {
                    tribute: candidate.name,
                    group: members.filter(m => m.id !== candidate.id).map(m => m.name).join(' and '),
                    zone,
                }),
                members.map(m => m.id),
                { important: true, category: 'alliance' }
            );
        });
    });

    // 4. Contact warmth, then romance — see `applyContactWarmth`/`growRomance`.
    applyContactWarmth(ctx);
    growRomance(ctx);
    growProtectorBond(ctx);

    // 5. Structure upkeep: prune the dead, re-elect leaders, pool supplies.
    reconcileAlliances(ctx);
    Object.values(ctx.state.alliances ?? {}).forEach(record => {
        const members = membersOf(ctx.state, record.id);
        if (members.length < 2) return;
        const atCamp = members.filter(m => m.zone === (record.campZone ?? pickLeader(members).zone));
        if (atCamp.length >= 2) contributeToCache(ctx, record, atCamp);
        // A group that has moved on adopts wherever its leader now stands as camp.
        if (atCamp.length < 2) record.campZone = pickLeader(members).zone;
    });
}

/**
 * Two standing groups who trust each other joining forces.
 *
 * Requires them to be in the same place and to actually get on across the
 * boundary — a merger is not two leaders shaking hands over the heads of people
 * who hate each other.
 */
function mergeAlliances(ctx: SimContext) {
    const groups = new Map<string, Tribute[]>();
    getAlive(ctx.state).forEach(t => {
        if (!t.allianceId || t.allianceId.startsWith('lovers-')) return;
        if (!groups.has(t.allianceId)) groups.set(t.allianceId, []);
        groups.get(t.allianceId)!.push(t);
    });

    const ids = [...groups.keys()];
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const a = groups.get(ids[i])!;
            const b = groups.get(ids[j])!;
            if (a.length < 2 || b.length < 2) continue;
            if (a.length + b.length > ALLIANCES.maxSize) continue;
            // Same ground, or there is no conversation to have — judged by the
            // leaders who would do the negotiating, not by array order.
            if (pickLeader(a).zone !== pickLeader(b).zone) continue;

            // A merger is negotiated by whoever the two groups actually follow,
            // not vetoed by blanket mutual regard: the leaders have to get on,
            // and any member who genuinely loathes the other side walks out
            // rather than blocking the handshake. That is a better story than
            // the merge silently failing.
            const leadA = pickLeader(a);
            const leadB = pickLeader(b);
            const crossRegard = (x: Tribute[], y: Tribute[]) =>
                x.reduce((sum, m) => sum + y.reduce((inner, o) => inner + getRel(m, o.id), 0) / y.length, 0) / x.length;
            // Two leaders who know and rate each other can shake on it directly;
            // otherwise the groups need to broadly get on — either basis opens
            // the negotiation, and dissenters walk instead of vetoing it.
            const leadersAgree = getRel(leadA, leadB.id) >= ALLIANCES.mergeThreshold
                && getRel(leadB, leadA.id) >= ALLIANCES.mergeThreshold;
            const groupsAgree = crossRegard(a, b) >= ALLIANCES.mergeThreshold
                && crossRegard(b, a) >= ALLIANCES.mergeThreshold;
            if (!leadersAgree && !groupsAgree) continue;
            if (!ctx.rng.chance(ALLIANCES.mergeChance)) continue;

            const regardFor = (m: Tribute, others: Tribute[]) =>
                others.reduce((sum, o) => sum + getRel(m, o.id), 0) / others.length;
            const dissenters = [
                ...a.filter(m => m.id !== leadA.id && regardFor(m, b) < ALLIANCES.mergeDissentThreshold),
                ...b.filter(m => m.id !== leadB.id && regardFor(m, a) < ALLIANCES.mergeDissentThreshold),
            ];
            dissenters.forEach(m => { delete m.allianceId; });

            const stayA = a.filter(m => !dissenters.includes(m));
            const stayB = b.filter(m => !dissenters.includes(m));
            if (stayA.length === 0 || stayB.length === 0) continue;

            // The larger group absorbs the smaller; a tie goes to the older pact.
            const keepId = stayA.length >= stayB.length ? ids[i] : ids[j];
            const merged = [...stayA, ...stayB];
            merged.forEach(m => { m.allianceId = keepId; });
            merged.forEach(m => merged.forEach(o => { if (m.id !== o.id) noteContact(ctx.state, m, o); }));
            mergeAllianceRecords(ctx, keepId, keepId === ids[i] ? ids[j] : ids[i], merged);
            groups.set(keepId, merged);
            groups.delete(keepId === ids[i] ? ids[j] : ids[i]);

            ctx.logEvent(
                `${leadA.name} and ${leadB.name} shake on it in ${leadA.zone}: their groups run as one. ` +
                `Two small groups are one larger one, which is either much safer or much worse.`,
                merged.map(m => m.id),
                { important: true, category: 'alliance' }
            );
            if (dissenters.length > 0) {
                ctx.logEvent(
                    `${dissenters.map(m => m.name).join(' and ')} want${dissenters.length === 1 ? 's' : ''} no part of the new arrangement and walk${dissenters.length === 1 ? 's' : ''} away from it.`,
                    dissenters.map(m => m.id),
                    { important: true, category: 'alliance' }
                );
            }
            return;
        }
    }
}

/**
 * Romance, earned rather than accumulated.
 *
 * The old rule promoted any opposite-gender district pair to star-crossed
 * lovers the moment their relationship crossed 80 — and paid them +4..10 per
 * cycle simply for occupying the same zone, which every tribute does at the
 * Cornucopia on day one. The result was that the rarest, most memorable outcome
 * in the game fired in the overwhelming majority of runs, by roughly day three,
 * before either of them had done anything for the other.
 *
 * Now: the bond only grows from actual contact, it grows far faster when one of
 * them has genuinely stood by the other, and the promotion itself is a roll
 * behind a set of gates rather than a threshold crossing. Cross-district and
 * same-gender pairs are eligible, which both widens the story space and removes
 * the district-partner shortcut that made it so easy to trigger.
 */
/**
 * General relationship warmth from spending time together, plus the
 * sustained-contact streak romance is gated on.
 *
 * This used to live inside `growRomance`, which meant a general relationship
 * inflator was hiding inside the romance function — every pair with recent
 * contact warmed toward each other every cycle before any romance gate was
 * even evaluated, and the soak showed relationships pegged at the ±100 clamp.
 * It is now its own upkeep step so it can be seen and tuned independently.
 */
function applyContactWarmth(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
            const t1 = alive[i];
            const t2 = alive[j];
            // Contact, not co-location. Standing in the same clearing as
            // twenty-three other people is not a relationship.
            const recentContact = cyclesSinceContact(ctx.state, t1, t2.id) <= ROMANCE.contactWindow;

            // The streak lives on t1's memory only; the pair is always
            // iterated in the same order, so one side is enough.
            const mem = ensureMemory(t1);
            mem.contactStreak = mem.contactStreak ?? {};
            mem.contactStreak[t2.id] = recentContact ? (mem.contactStreak[t2.id] ?? 0) + 1 : 0;
            if (!recentContact) continue;

            const stoodBy = hasStoodBy(t1, t2.id) || hasStoodBy(t2, t1.id);
            const growth = stoodBy ? ROMANCE.stoodByGrowth : ROMANCE.contactGrowth;
            adjustRel(t1, t2.id, growth);
            adjustRel(t2, t1.id, growth);
        }
    }
}

function growRomance(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    if (ctx.state.day < ROMANCE.minDay) return;

    for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
            const t1 = alive[i];
            const t2 = alive[j];
            if (t1.traits.includes('Star-Crossed') || t2.traits.includes('Star-Crossed')) continue;

            const recentContact = cyclesSinceContact(ctx.state, t1, t2.id) <= ROMANCE.contactWindow;
            if (!recentContact) continue;

            // Romance needs sustained contact, not a single shared scene —
            // ROMANCE.sustainedCycles was declared for exactly this and never
            // read. The streak is maintained by `applyContactWarmth`.
            if ((ensureMemory(t1).contactStreak?.[t2.id] ?? 0) < ROMANCE.sustainedCycles) continue;

            const stoodBy = hasStoodBy(t1, t2.id) || hasStoodBy(t2, t1.id);
            const mutual = Math.min(getRel(t1, t2.id), getRel(t2, t1.id));

            // A PERFORMED bond: Star-Crossed in canon is a strategy before it
            // is a romance, and the simulation could only model the sincere
            // version — a bond was mutual, symmetric and true by construction.
            // One tribute who is genuinely attached, one who has worked out
            // what the cameras will pay for it, is the far more interesting
            // shape. The performer gets the sponsor benefit and none of the
            // mechanical loyalty, and the other party does not know.
            if (!stoodBy && mutual < ROMANCE.threshold) {
                const oneSided = Math.max(getRel(t1, t2.id), getRel(t2, t1.id));
                const lateness = Math.max(0, ctx.state.day - ROMANCE.minDay);
                const performChance = ROMANCE.performedChance * Math.pow(ROMANCE.latenessDecay, lateness);
                if (oneSided >= ROMANCE.performedMinRegard && ctx.rng.chance(performChance)) {
                    const smitten = getRel(t1, t2.id) >= getRel(t2, t1.id) ? t1 : t2;
                    const performer = smitten === t1 ? t2 : t1;
                    // Playing it well is a charisma job, and the crowd is the
                    // only audience that matters.
                    if (performer.attributes.charisma >= ROMANCE.performerCharisma) {
                        declareLovers(ctx, smitten, performer, performer);
                        return;
                    }
                }
                continue;
            }

            if (mutual < ROMANCE.threshold) continue;
            // Somebody has to have risked something. This is the gate that makes
            // it a story rather than an arithmetic outcome.
            if (!stoodBy) continue;
            // Romance happens early or not at all. Without this the roll is a
            // flat per-cycle chance, so an eligible pair converts with near
            // certainty given enough cycles — and REPLAY-01 made run length
            // vary from six days to twenty-one, which turned "how long did the
            // Games run" into the dominant input on how many runs have lovers
            // in them. Two people who have been circling each other for a
            // fortnight are not going to.
            const lateness = Math.max(0, ctx.state.day - ROMANCE.minDay);
            if (!ctx.rng.chance(ROMANCE.chancePerCycle * Math.pow(ROMANCE.latenessDecay, lateness))) continue;

            declareLovers(ctx, t1, t2);
            return;
        }
    }
}

/**
 * CONTENT-06: the protective, non-romantic bond — the sibling-like pair, or
 * the older tribute who has quietly adopted a much younger one. Uses the same
 * "somebody has to have risked something" gate as romance, but keyed on a
 * genuine age gap instead of romance eligibility, and it never touches
 * `allianceId`: this is a relationship, not a merger.
 */
function growProtectorBond(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    if (ctx.state.day < ROMANCE.minDay) return;

    for (const older of alive) {
        for (const younger of alive) {
            if (older.id === younger.id) continue;
            if (older.age - younger.age < PROTECTOR_BOND.minAgeGap) continue;
            if (areLovers(older, younger)) continue;
            if (older.protectorBonds?.includes(younger.id)) continue;

            const recentContact = cyclesSinceContact(ctx.state, older, younger.id) <= ROMANCE.contactWindow;
            if (!recentContact) continue;
            if (!hasStoodBy(older, younger.id)) continue;
            if (getRel(older, younger.id) < PROTECTOR_BOND.threshold) continue;
            if (!ctx.rng.chance(PROTECTOR_BOND.chancePerCycle)) continue;

            older.protectorBonds = [...(older.protectorBonds ?? []), younger.id];
            (younger.protectorBonds = younger.protectorBonds ?? []).push(older.id);
            adjustRel(older, younger.id, 15);
            adjustRel(younger, older.id, 15);
            older.sponsorTrust = Math.min(100, older.sponsorTrust + 15);
            younger.sponsorTrust = Math.min(100, younger.sponsorTrust + 20);
            addExcitement(older, 20);
            addExcitement(younger, 25);

            ctx.logEvent(
                fill(ctx.pickText(PROTECTOR_BOND_TEXTS), { older: older.name, younger: younger.name }),
                [older.id, younger.id],
                { important: true, category: 'romance' }
            );
            return;
        }
    }
}

function declareLovers(ctx: SimContext, t1: Tribute, t2: Tribute, performer?: Tribute) {
    t1.traits.push('Star-Crossed');
    t2.traits.push('Star-Crossed');
    if (performer) {
        // What they are showing the cameras, as distinct from what they feel.
        // The betrayal layer reads `relationships` and is therefore entirely
        // unmoved by the performance, which is the point.
        const other = performer === t1 ? t2 : t1;
        performer.displayedRegard = {
            ...(performer.displayedRegard ?? {}),
            [other.id]: ROMANCE.performedDisplayedRegard,
        };
    }

    // Falling for someone pulls them out of whatever alliance they were already
    // in — that departure needs its own event, not a silent headcount change
    // for the group left behind.
    [t1, t2].forEach(t => {
        if (t.allianceId && !t.allianceId.startsWith('lovers-')) {
            ctx.logEvent(
                fill(ctx.pickText(ALLIANCE_TEXTS.dissolve), { tribute: t.name }),
                [t.id],
                { category: 'alliance' }
            );
            delete t.allianceId;
        }
    });

    const bondId = `lovers-${t1.id}-${t2.id}`;
    t1.allianceId = bondId;
    t2.allianceId = bondId;
    registerAlliance(ctx, bondId, [t1, t2]);

    t1.sponsorTrust = Math.min(100, t1.sponsorTrust + 40);
    t2.sponsorTrust = Math.min(100, t2.sponsorTrust + 40);
    t1.reputation = Math.min(95, t1.reputation + 20);
    t2.reputation = Math.min(95, t2.reputation + 20);
    addExcitement(t1, 50);
    addExcitement(t2, 50);

    ctx.logEvent(
        fill(ctx.pickText(ROMANCE_TEXTS), {
            t1: t1.name,
            t2: t2.name,
            district: t1.district === t2.district ? String(t1.district) : `${t1.district} and ${t2.district}`,
        }),
        [t1.id, t2.id],
        { important: true, category: 'romance' }
    );
    if (performer) {
        // Deliberately narrated: the audience of the *chronicle* is entitled to
        // know what the audience in the Capitol does not.
        const other = performer === t1 ? t2 : t1;
        ctx.logEvent(
            `${performer.name} plays it beautifully. ${other.name} is not playing.`,
            [performer.id, other.id],
            { important: true, category: 'romance' }
        );
    }
}

/**
 * Interview personas as social currency.
 *
 * The strategy a tribute sold on Caesar's couch used to move `sponsorTrust` and
 * then vanish. It is a public persona — the rest of the cast watched the same
 * broadcast, and it should shape who wants to stand next to whom.
 */
export function interviewChemistry(a: Tribute, b: Tribute): number {
    const x = a.interviewStrategy;
    const y = b.interviewStrategy;
    if (!x || !y) return 0;

    // Every persona personaThreat knows about belongs to one of these camps,
    // except The Wildcard, which is deliberately neutral — unpredictability
    // reads as neither warmth nor menace.
    const warm = [
        'The Star-Crossed Lover', 'The Humble Underdog', 'The Charming Flirt',
        'The Quirky Oddball', 'The Grieving Sibling', 'The Reluctant Hero',
        'The District Loyalist',
    ];
    const cold = [
        'The Ruthless Warrior', 'The Arrogant Brute', 'The Mysterious Enigma',
        'The Silent Threat', 'The Cold Strategist',
    ];

    let score = 0;
    if (warm.includes(x) && warm.includes(y)) score += 0.12;
    if (cold.includes(x) && cold.includes(y)) score -= 0.08;
    if (warm.includes(x) && cold.includes(y)) score -= 0.05;
    if (cold.includes(x) && warm.includes(y)) score -= 0.05;
    if (x === y) score += 0.05;
    return score;
}

/** Public personas that make a tribute a priority target in the bloodbath. */
export function personaThreat(t: Tribute): number {
    switch (t.interviewStrategy) {
        case 'The Ruthless Warrior': return 0.35;
        case 'The Arrogant Brute': return 0.3;
        case 'The Mysterious Enigma': return 0.15;
        case 'The Star-Crossed Lover': return -0.1;
        case 'The Humble Underdog': return -0.15;
        case 'The Quirky Oddball': return -0.05;
        case 'The Silent Threat': return 0.25;
        case 'The Cold Strategist': return 0.2;
        case 'The Grieving Sibling': return -0.15;
        case 'The Reluctant Hero': return -0.1;
        case 'The District Loyalist': return -0.05;
        case 'The Wildcard': return 0.05;
        default: return 0;
    }
}
