import { SimContext, getAlive } from '../context';
import { RNG } from '../../utils/rng';
import { Tribute } from '../../models/types';
import { ARCHETYPES, archetypeCompatibility } from '../../data/archetypes';
import { RESPECT, ALLIANCES, PROFICIENCY, PROTECTOR_BOND, QUELL_MECHANICS, ROMANCE, SUSPICION } from '../../data/balance';
import { profOf, trainProficiency } from '../proficiency';
import { applyDamage, checkDeath } from '../combat';
import { clampTribute } from '../vitals';
import { ALLIANCE_TEXTS, PROTECTOR_BOND_TEXTS, ROMANCE_TEXTS } from '../../data/flavorText';
import { adjustRel, getRel, trustOf } from '../relationships';
import { cyclesSinceContact, distrustFactor, ensureMemory, hasStoodBy, noteContact, raiseSuspicion, suspicionOf } from '../memory';
import { respectOf } from '../relationships';
import { allianceOf, areLovers, cacheValue, contributeToCache, isPerforming, membersOf, mergeAllianceRecords, pickLeader, reconcileAlliances, registerAlliance, shownRegard } from '../alliance';
import { resolveBetrayal } from '../betrayal';
import { betrayalReluctance } from '../debts';
import { addExcitement } from '../audience';
import { traitMod } from '../../data/traits';
import { effectiveAllianceMaxSize, wildcardIs } from '../gamesProfile';
import { COLD_PERSONAS, PERSONA_THREAT, WARM_PERSONAS } from '../../data/personas';

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
        // §11.1: and the mark's own performance works on the betrayer too — a
        // member who keeps playing warm toward them reads as safe to keep, or
        // as an easy, unguarded target, depending on the knife. Net: the
        // displayed warmth stays the betrayer's hand a little, because a
        // devoted ally is worth more alive than looted.
        weight *= Math.max(0.3, 1 - Math.max(0, shownRegard(m, betrayer.id)) / 250);
        // §4.4: the quartermaster holds the cache, which makes them the one
        // member whose death pays for itself. A role is a reason, which is
        // exactly what a flat memberIds list could never give a betrayal.
        const record = allianceOf(ctx.state, betrayer.allianceId);
        if (record?.roles?.quartermaster === m.id) weight *= ALLIANCES.betrayalQuartermasterWeight;
        // Someone who already burned you goes to the top of the list.
        if (ensureMemory(betrayer).betrayedBy.includes(m.id)) weight *= ALLIANCES.betrayedFirstStrikeWeight;
        // Someone who never stops watching is a much worse mark.
        weight *= Math.max(0.1, 1 - traitMod(m, 'betrayalResist'));
        // §4.2: so is someone who is specifically watching *you*.
        weight *= Math.max(0.1, 1 - (suspicionOf(m, betrayer.id) / SUSPICION.max) * SUSPICION.hardMarkFactor);
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

    // 0. 'No Alliances': the recruit/merge caps above stop a group from
    // *growing* past the limit, but the Career pack still forms all at once
    // at the bloodbath — this is the Gamemakers' answer to that, a small
    // hazard tax on anyone still standing in an oversized group.
    if (wildcardIs(ctx.state, 'quell-alliance-cap')) {
        const cap = effectiveAllianceMaxSize(ctx.state, ALLIANCES.maxSize);
        alliances.forEach(members => {
            if (members.length <= cap) return;
            members.forEach(m => {
                applyDamage(ctx, m, QUELL_MECHANICS.allianceCapHazardDamage, { cause: 'Struck down for defying the Gamemakers\' Quell', kind: 'arena' });
                clampTribute(m);
                checkDeath(ctx, m, 'Struck down for defying the Gamemakers\' Quell');
            });
            ctx.logEvent(
                `The Gamemakers make an example of the pack still travelling ${members.length} strong. This year, that costs them.`,
                members.map(m => m.id),
                { important: true, category: 'gamemaker' }
            );
        });
    }

    // 1. Dissolve small alliances
    alliances.forEach((members, id) => {
        if (members.length < 2) {
            members.forEach(m => delete m.allianceId);
            alliances.delete(id);
        }
    });

    // 1a-ii. §4: a big group splits along the lines everyone could already
    // see, rather than either holding together or evaporating. Checked before
    // the rot-dissolve below, because a pack with two coherent halves should
    // become two packs, not eight loners.
    schismAlliances(ctx, alliances);

    // 1b. An alliance whose trust has rotted through falls apart on its own.
    alliances.forEach((members, id) => {
        if (members.length < 2) return;
        // §11.1: the group judges the room it can see. A performer's shown
        // warmth counts toward cohesion even when the ledger underneath is cold.
        const averageTrust = members.reduce((sum, m) =>
            sum + members.reduce((inner, o) => inner + (o.id === m.id ? 0 : shownRegard(m, o.id)), 0) / (members.length - 1), 0) / members.length;
        if (averageTrust < ALLIANCES.rotDissolveTrust) {
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

    // 1b2. §4.8: suspicion gets an investigation path. A tribute who
    // suspects an ally no longer only waits or leaves: below the departure
    // threshold they *test* it — trail the suspect, check the cache, ask a
    // third party — and the suspicion either resolves or hardens.
    alliances.forEach((members, id) => {
        if (members.length < 2 || id.startsWith('lovers-')) return;
        members.forEach(m => {
            if (m.status !== 'alive' || m.allianceId !== id) return;
            const suspect = members.find(o =>
                o.id !== m.id && o.status === 'alive'
                && suspicionOf(m, o.id) >= SUSPICION.investigateThreshold
                && suspicionOf(m, o.id) < SUSPICION.departThreshold);
            if (!suspect) return;
            if (!ctx.rng.chance(SUSPICION.investigateChance)) return;
            // The test finds what there is to find: real treachery confirms,
            // an honest ally clears.
            const guilty = (ARCHETYPES[suspect.archetype].treachery + traitMod(suspect, 'treachery')) > 0.25
                || ensureMemory(m).betrayedBy.includes(suspect.id);
            if (guilty) {
                raiseSuspicion(m, suspect.id, SUSPICION.investigateConfirmAmount);
                ctx.logEvent(
                    `${m.name} trails ${suspect.name} for half a day, says nothing, and comes back having seen enough. The watching gets harder to hide after that.`,
                    [m.id, suspect.id],
                    { important: true, category: 'alliance' }
                );
            } else {
                raiseSuspicion(m, suspect.id, -SUSPICION.investigateClearAmount);
                adjustRel(m, suspect.id, 4);
                ctx.logEvent(
                    `${m.name} checks the cache while ${suspect.name} sleeps, counts everything twice, and finds it all where it should be. Something eases.`,
                    [m.id, suspect.id],
                    { category: 'alliance' }
                );
            }
        });
    });

    // 1c. §4.2: pre-emptive departure. A member whose suspicion of a specific
    // ally has climbed high enough gets out before the knife does — the
    // telegraphed version of the betrayal the audience can see building.
    alliances.forEach((members, id) => {
        if (members.length < 2 || id.startsWith('lovers-')) return;
        members.forEach(m => {
            if (m.status !== 'alive' || m.allianceId !== id) return;
            const suspect = members.find(o =>
                o.id !== m.id && o.status === 'alive' && suspicionOf(m, o.id) >= SUSPICION.departThreshold);
            if (!suspect) return;
            if (!ctx.rng.chance(SUSPICION.departChance)) {
                // Not gone yet — but sleeping apart is a beat the audience reads.
                if (ctx.rng.chance(0.3)) {
                    ctx.logEvent(
                        `${m.name} beds down apart from the others and keeps ${suspect.name} in view. Whatever trust there was is being rationed now.`,
                        [m.id, suspect.id],
                        { category: 'alliance' }
                    );
                }
                return;
            }
            delete m.allianceId;
            ctx.logEvent(
                `${m.name} is gone before dawn. No theft, no knife — just a bedroll left cold and ${suspect.name} watched all the way out of sight. Some betrayals you leave before they happen.`,
                [m.id, suspect.id],
                { important: true, category: 'alliance' }
            );
        });
    });

    // 1d. Going it alone. Not a grievance — every other way out of an alliance
    // is one (suspicion, betrayal, romance, a pact coming due), which left no
    // path at all for a tribute who gets on fine with their group and has
    // simply decided that only one person goes home. The field has to be small
    // enough that everyone can see the arithmetic, so this reads as a choice
    // about the endgame rather than churn.
    if (alive.length <= ALLIANCES.soloDepartureFieldSize) {
        alliances.forEach((members, id) => {
            if (members.length < 2 || id.startsWith('lovers-')) return;
            members.forEach(m => {
                if (m.status !== 'alive' || m.allianceId !== id) return;
                // Nobody walks out on someone they are bonded to.
                if (members.some(o => o.id !== m.id && areLovers(m, o))) return;
                if ((m.protectorBonds ?? []).some(wardId => members.some(o => o.id === wardId))) return;

                const independence = -(ARCHETYPES[m.archetype].allianceAffinity + traitMod(m, 'allianceAffinity'));
                let chance = ALLIANCES.soloDepartureBase
                    + independence * ALLIANCES.soloDepartureAffinityWeight;
                // Someone who rates their own chances has least reason to split
                // a victory they think they can take outright.
                const strongest = members.every(o =>
                    o.id === m.id || m.trainingScore >= o.trainingScore);
                if (strongest) chance += ALLIANCES.soloDepartureConfidenceBonus;
                if (!ctx.rng.chance(Math.max(0, chance))) return;

                const others = members.filter(o => o.id !== m.id && o.status === 'alive');
                delete m.allianceId;
                // Leaving on good terms still costs: they are people you were
                // sharing food with yesterday.
                others.forEach(o => adjustRel(o, m.id, -ALLIANCES.soloDepartureRegard));
                ctx.logEvent(
                    `${m.name} tells ${others.map(o => o.name).join(' and ')} straight out, in ${m.zone}, that only one of them is going home `
                    + `and they would rather stop pretending otherwise. Nobody argues, because nobody can.`,
                    [m.id, ...others.map(o => o.id)],
                    { important: true, category: 'alliance' }
                );
            });
        });
    }

    // 1e. A2: the Mercenary's terms coming due.
    //
    // `parley.ts` gestured at alliance-as-transaction and nothing in the model
    // could express it — a mercenary who joined for pay stayed for affection
    // like everybody else. They leave the cycle the cache runs dry, without
    // rancour and without apology, because that was always the deal.
    alliances.forEach((members, id) => {
        if (members.length < 2 || id.startsWith('lovers-')) return;
        const record = allianceOf(ctx.state, id);
        if (!record || cacheValue(record) > ALLIANCES.mercenaryRetainer) return;
        members.forEach(m => {
            if (m.status !== 'alive' || m.allianceId !== id) return;
            if (m.archetype !== 'mercenary') return;
            const others = members.filter(o => o.id !== m.id && o.status === 'alive');
            if (others.length === 0) return;
            delete m.allianceId;
            ctx.logEvent(
                `${m.name} counts what is left in the alliance's cache in ${m.zone}, finds it empty, and leaves. `
                + `${others.map(o => o.name).join(' and ')} are not betrayed so much as no longer paying, and ${m.name} makes no pretence that it was ever anything else.`,
                [m.id, ...others.map(o => o.id)],
                { important: true, category: 'alliance' }
            );
            others.forEach(o => adjustRel(o, m.id, -ALLIANCES.soloDepartureRegard));
        });
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
    // §7.1's sibling rule: the no-alliances rule change was announced by a
    // wildcard and enforced by nothing. When it stands, no new alliance forms,
    // no group recruits and no groups merge — what existed before the
    // announcement is grandfathered in, and lovers keep theirs secret.
    const alliancesForbidden = wildcardIs(ctx.state, 'rule-change-no-allies');
    const stillAlive = getAlive(ctx.state);
    if (!alliancesForbidden && stillAlive.length > ALLIANCES.formationFieldSize) {
        for (let i = 0; i < stillAlive.length; i++) {
            for (let j = i + 1; j < stillAlive.length; j++) {
                const t1 = stillAlive[i];
                const t2 = stillAlive[j];

                // Same ground, like recruitment and mergers: an alliance is
                // agreed face to face, not between two tributes standing in
                // different zones who have never actually met.
                if (!t1.allianceId && !t2.allianceId && t1.zone === t2.zone) {
                    // §4.3: joining someone is a trust decision, not a regard
                    // one. The mean, not the min: requiring the *lower* side to
                    // clear the bar collapsed formation entirely (the firing
                    // floors caught it) — a wary party joining a warm one is a
                    // real alliance, and the wariness is what betrayal feeds on.
                    const rel = (trustOf(t1, t2) + trustOf(t2, t1)) / 2;
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
    if (!alliancesForbidden) mergeAlliances(ctx);

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

    const maxSize = effectiveAllianceMaxSize(ctx.state, ALLIANCES.maxSize);
    groups.forEach((members, id) => {
        if (alliancesForbidden) return;
        if (members.length < 2 || members.length >= maxSize) return;
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
            if (members.length >= maxSize) return;

            // Both directions have to hold: the group has to want them, and
            // they have to want the group.
            // §4.3: recruitment is trust in both directions — and §4.1, a
            // candidate the group *rates* is wanted above their warmth.
            const groupOpinion = present.reduce(
                (sum, m) => sum + trustOf(m, candidate) + respectOf(m, candidate.id) * RESPECT.recruitWeight,
                0) / present.length;
            const theirOpinion = present.reduce((sum, m) => sum + trustOf(candidate, m), 0) / present.length;
            // A2: the Beast has no capacity for company at all. Not a low
            // affinity — none. It is the one thing that makes them read as
            // something the arena made rather than a district.
            if (candidate.archetype === 'beast' || present.some(m => m.archetype === 'beast')) return;
            const distrust = distrustFactor(candidate);
            // §4.7: the Career pack recruits hard in the early game — sweeping
            // up the strong stragglers is its narrative function.
            const hungryPack = members.some(m => m.isCareer) && ctx.state.day <= ALLIANCES.careerRecruitEarlyDays;
            const threshold = ALLIANCES.recruitThreshold * distrust
                * (hungryPack ? ALLIANCES.careerRecruitThresholdFactor : 1);
            if (groupOpinion < threshold || theirOpinion < threshold) return;

            // §1.4: somebody in the group has to do the persuading, and being
            // good at it is a trainable skill rather than a raw charisma read.
            const advocate = Math.max(0, ...present.map(m => profOf(m, 'persuasion')));
            const affinity = ARCHETYPES[candidate.archetype].allianceAffinity
                + traitMod(candidate, 'allianceAffinity')
                + advocate * PROFICIENCY.persuasionRecruitWeight;
            const chance = Math.max(
                ALLIANCES.minFormChance,
                (ALLIANCES.recruitChance + affinity - (members.length - 2) * ALLIANCES.recruitSizePenalty)
                    * (hungryPack ? ALLIANCES.careerRecruitMultiplier : 1) / distrust
            );
            if (!ctx.rng.chance(chance)) return;

            candidate.allianceId = id;
            present.forEach(m => { if (profOf(m, 'persuasion') === advocate) trainProficiency(m, 'persuasion'); });
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
 * §4: factions inside a large group, and the split when they stop pretending.
 *
 * Alliance size was capped and nothing distinguished a six-person pack's
 * internal politics from a pair's beyond leader-challenge maths. A large group
 * was binary — intact, or dissolved into loners — so the most interesting
 * thing a coalition can do was not representable.
 *
 * The split follows the regard graph the social layer already maintains, so it
 * lands along the lines the audience has watched form. Seeded from the member
 * who gets on with the rest least well (the malcontent, not an arbitrary
 * index) and grown by who would rather stand with them than with the others.
 */
function findFaction(members: Tribute[]): Tribute[] | undefined {
    const averageRegardTo = (m: Tribute, others: Tribute[]) => {
        const rest = others.filter(o => o.id !== m.id);
        if (rest.length === 0) return 0;
        return rest.reduce((sum, o) => sum + getRel(m, o.id), 0) / rest.length;
    };

    // The unhappiest member anchors the splinter.
    const seed = members.reduce((worst, m) =>
        (averageRegardTo(m, members) < averageRegardTo(worst, members) ? m : worst));

    const faction = [seed];
    members.forEach(m => {
        if (m.id === seed.id) return;
        // Bonded pairs are never split across a schism.
        if (faction.some(f => areLovers(f, m))) { faction.push(m); return; }
        const withSeed = getRel(m, seed.id);
        const withRest = averageRegardTo(m, members.filter(o => !faction.some(f => f.id === o.id)));
        if (withSeed > withRest + ALLIANCES.schismCohesionGap) faction.push(m);
    });

    const remainder = members.filter(m => !faction.some(f => f.id === m.id));
    if (faction.length < ALLIANCES.schismMinFaction) return undefined;
    if (remainder.length < ALLIANCES.schismMinFaction) return undefined;

    // Two camps, not one group with a grumbler in it: the split only happens
    // when the two sides genuinely do not get on across the line.
    const crossRegard = (x: Tribute[], y: Tribute[]) =>
        x.reduce((sum, m) => sum + y.reduce((inner, o) => inner + getRel(m, o.id), 0) / y.length, 0) / x.length;
    if (crossRegard(faction, remainder) > ALLIANCES.schismCrossRegard) return undefined;
    if (crossRegard(remainder, faction) > ALLIANCES.schismCrossRegard) return undefined;

    return faction;
}

function schismAlliances(ctx: SimContext, alliances: Map<string, Tribute[]>) {
    alliances.forEach((members, id) => {
        if (members.length < ALLIANCES.schismMinSize) return;
        // A lovers' bond is a pair by definition and has nothing to split.
        if (id.startsWith('lovers-')) return;
        if (!ctx.rng.chance(ALLIANCES.schismChance)) return;

        const faction = findFaction(members);
        if (!faction) return;
        const remainder = members.filter(m => !faction.some(f => f.id === m.id));

        // The splinter becomes a standing alliance of its own rather than a
        // handful of loners — that is the whole point of modelling it as a
        // faction instead of a mass departure.
        const splinterId = `alliance-${faction[0].id}-splinter`;
        faction.forEach(m => { m.allianceId = splinterId; });
        registerAlliance(ctx, splinterId, faction);
        alliances.set(splinterId, faction);
        alliances.set(id, remainder);

        // Whatever was left of the shared regard does not survive the split.
        faction.forEach(f => remainder.forEach(r => {
            adjustRel(f, r.id, -ALLIANCES.soloDepartureRegard);
            adjustRel(r, f.id, -ALLIANCES.soloDepartureRegard);
        }));

        ctx.logEvent(
            `${faction.map(m => m.name).join(' and ')} stop eating with the others. By morning it is not an argument any more, it is two camps: `
            + `${remainder.map(m => m.name).join(' and ')} keep the fire, and the rest walk. Nobody pretends the group still exists.`,
            members.map(m => m.id),
            { important: true, category: 'alliance' }
        );
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
    const maxSize = effectiveAllianceMaxSize(ctx.state, ALLIANCES.maxSize);

    // Bounded per cycle rather than returning on the first success, which made
    // a third merge-ready pairing wait a cycle for no reason. See
    // ALLIANCES.maxMergesPerCycle.
    let merges = 0;
    const ids = [...groups.keys()];
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const a = groups.get(ids[i])!;
            const b = groups.get(ids[j])!;
            // A group absorbed earlier this cycle is no longer its own group.
            if (!a || !b || !groups.has(ids[i]) || !groups.has(ids[j])) continue;
            if (a.length < 2 || b.length < 2) continue;
            if (a.length + b.length > maxSize) continue;
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
                x.reduce((sum, m) => sum + y.reduce((inner, o) => inner + trustOf(m, o), 0) / y.length, 0) / x.length;
            // Two leaders who know and rate each other can shake on it directly;
            // otherwise the groups need to broadly get on — either basis opens
            // the negotiation, and dissenters walk instead of vetoing it.
            // §4.3: a merger is negotiated on trust — two leaders who respect
            // each other as fighters but not as sleeping company do not merge.
            const leadersAgree = trustOf(leadA, leadB) >= ALLIANCES.mergeThreshold
                && trustOf(leadB, leadA) >= ALLIANCES.mergeThreshold;
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
                `${leadA.name} and ${leadB.name} shake on it in ${leadA.zone}: ${allianceOf(ctx.state, ids[i])?.name ?? 'their group'} and ${allianceOf(ctx.state, ids[j])?.name ?? 'the other'} run as one. ` +
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
            if (++merges >= ALLIANCES.maxMergesPerCycle) return;
            // ids[i] may have just been absorbed; stop working this row and let
            // the outer loop move on rather than merging a group into itself.
            break;
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

    // Bounded rather than one-and-done: see ROMANCE.maxPerCycle. Returning on
    // the first success meant a second eligible pair in the same cycle was
    // never even evaluated.
    let declared = 0;
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
                // §4.4: a tribute who planned the showmance on Caesar's couch
                // has been waiting for exactly this opening all run.
                const planned = t1.interviewAngle === 'showmance' || t2.interviewAngle === 'showmance';
                const performChance = ROMANCE.performedChance
                    * (planned ? ROMANCE.showmanceMultiplier : 1)
                    * Math.pow(ROMANCE.latenessDecay, lateness);
                // §4.1: regard floor *and* asymmetry. The pair that makes this
                // work is one tribute in deep and one who is not, which the
                // old absolute-ceiling gate could not express — it selected
                // for mutual warmth just below the romance threshold, which is
                // the one shape a performance is least likely to come out of.
                // Either shape qualifies: somebody far enough gone that it
                // plays on its own (the old absolute gate, now the fallback),
                // or a gap wide enough that the performance is the story —
                // one tribute in deep and one who has noticed. Requiring both
                // at once measured worse than the original: a pair with a
                // sustained contact streak is warm on both sides almost by
                // construction, so asymmetry-and-regard selected for nearly
                // nobody. Asymmetry is the interesting case, not the only one.
                const gap = Math.abs(getRel(t1, t2.id) - getRel(t2, t1.id));
                const qualifies = gap >= ROMANCE.performedMinAsymmetry
                    ? oneSided >= ROMANCE.performedMinRegard
                    : oneSided >= ROMANCE.performedHighRegard;
                if (qualifies && ctx.rng.chance(performChance)) {
                    // The planner performs if either could: the whole point
                    // of the interview beat was choosing this in advance.
                    let smitten = getRel(t1, t2.id) >= getRel(t2, t1.id) ? t1 : t2;
                    let performer = smitten === t1 ? t2 : t1;
                    if (smitten.interviewAngle === 'showmance' && performer.interviewAngle !== 'showmance'
                        && getRel(performer, smitten.id) >= ROMANCE.performedMinRegard) {
                        [smitten, performer] = [performer, smitten];
                    }
                    // §4.1: a showmance planned on Caesar's couch is a decision
                    // already taken. Charisma decides how well it plays, not
                    // whether it happens — a planner who cannot sell it sells
                    // it badly, which is its own kind of television.
                    if (performer.interviewAngle === 'showmance') {
                        declareLovers(ctx, smitten, performer, performer);
                        if (++declared >= ROMANCE.maxPerCycle) return;
                        continue;
                    }
                    // Playing it well is a charisma job, and the crowd is the
                    // only audience that matters.
                    if (performer.attributes.charisma >= ROMANCE.performerCharisma) {
                        declareLovers(ctx, smitten, performer, performer);
                        if (++declared >= ROMANCE.maxPerCycle) return;
                        continue;
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
            if (++declared >= ROMANCE.maxPerCycle) return;
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

    // Bounded per cycle rather than one-and-done — same reasoning as
    // `growRomance`: a second eligible pair used not to be evaluated at all.
    let formed = 0;
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
            if (++formed >= ROMANCE.maxPerCycle) return;
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

    // §1.7: the two camps live in `data/personas.ts` alongside the union and
    // the threat table, rather than as a third copy of the same thirteen
    // strings typed out by hand. Every persona belongs to one of them except
    // The Wildcard, which is deliberately neutral — unpredictability reads as
    // neither warmth nor menace.
    const warm: string[] = WARM_PERSONAS;
    const cold: string[] = COLD_PERSONAS;

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
    // §1.7: a `Record` keyed by the union rather than a `switch` over string
    // literals — a persona added without a weighting is now a compile error
    // instead of a silent zero.
    return t.interviewStrategy ? PERSONA_THREAT[t.interviewStrategy] ?? 0 : 0;
}
