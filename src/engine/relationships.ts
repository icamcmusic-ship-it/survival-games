import { GameState, Tribute } from '../models/types';
import { forceStance } from './stance';
import { noteRivalDeath } from './rapport';
import { RNG } from '../utils/rng';
import { DEBTS, RELATIONSHIPS, GENERATION, HUNTING, RESPECT, RIVALRY, SUSPICION } from '../data/balance';
import { ARCHETYPES } from '../data/archetypes';
import { SimContext } from './context';
import { clampTribute } from './vitals';
import { cyclesSinceContact, ensureMemory, hasStoodBy, raiseSuspicion, rattle, swearVengeance, noteContact } from './memory';
import { areLovers } from './alliance';
import { GRIEF_TEXTS, VENGEANCE_TEXTS, RELIEF_TEXTS } from '../data/flavorText';
import { addExcitement } from './audience';
import { traitMod } from '../data/traits';
import { earnTrait } from './earnedTraits';

/**
 * The social graph, and everything that writes to it.
 *
 * Relationships used to be a bare number nudged in half a dozen places with no
 * shared rules — which is how a betrayal could end in a kill and leave the
 * relationship map completely untouched. Every write now goes through here,
 * stays inside [-100, 100], and leaves a trace in the tribute's memory.
 */

/** Ids of everyone still breathing — distrust cannot spread to a corpse. */
function livingIds(ctx: SimContext): string[] {
    return ctx.state.tributes.filter(t => t.status === 'alive').map(t => t.id);
}

const clampRel = (v: number) => Math.max(RELATIONSHIPS.min, Math.min(RELATIONSHIPS.max, Math.round(v * 10) / 10));

export function getRel(a: Tribute, bId: string): number {
    return a.relationships[bId] || 0;
}

export function adjustRel(a: Tribute, bId: string, delta: number): number {
    const next = clampRel(getRel(a, bId) + delta);
    a.relationships[bId] = next;
    return next;
}

/**
 * §4.3: trust, distinct from regard.
 *
 * `relationships[id]` is one scalar doing the work of trust, affection,
 * respect, fear and obligation — two Careers who rate each other as fighters
 * but would never sleep unguarded near each other were unrepresentable.
 * Rather than splitting the stored graph (every write already funnels through
 * this module, but so does every save ever written), trust is *derived*:
 * regard corrected by the concrete history the memory layer already keeps.
 * Someone who stood by you is trusted above their regard; someone you watched
 * knife an ally, or who owes you nothing and reads as treacherous, below it.
 * Alliance formation, recruitment and mergers read trust; targeting, grief
 * and the audience read regard.
 */
export function trustOf(a: Tribute, b: Tribute): number {
    let trust = getRel(a, b.id);
    if (hasStoodBy(a, b.id)) trust += RELATIONSHIPS.trustStoodByBonus;
    const mem = a.memory;
    if (mem?.betrayedBy?.includes(b.id)) trust -= RELATIONSHIPS.trustBetrayedPenalty;
    trust -= (mem?.suspicion?.[b.id] ?? 0) * RELATIONSHIPS.trustSuspicionWeight;
    // A creditor is safe company: they have already proven what they'll risk.
    if ((b.debts?.[a.id] ?? 0) > 0) trust += RELATIONSHIPS.trustCreditorBonus;
    return Math.max(RELATIONSHIPS.min, Math.min(RELATIONSHIPS.max, trust));
}

/** Most interactions move both sides of the pair. */
export function adjustMutual(state: GameState, a: Tribute, b: Tribute, delta: number) {
    adjustRel(a, b.id, delta);
    adjustRel(b, a.id, delta);
    noteContact(state, a, b);
}

/** §4.1: the second stored axis — professional esteem, not warmth. */
export function respectOf(a: Tribute, bId: string): number {
    return a.respects?.[bId] ?? 0;
}

export function adjustRespect(a: Tribute, bId: string, delta: number): void {
    const next = Math.max(-RESPECT.max, Math.min(RESPECT.max, respectOf(a, bId) + delta));
    a.respects = { ...(a.respects ?? {}), [bId]: Math.round(next * 10) / 10 };
}

export function setRel(a: Tribute, bId: string, value: number) {
    a.relationships[bId] = clampRel(value);
}

/**
 * Backstory: nobody walks into the arena a total stranger.
 *
 * District partners rode the same train. Careers trained in the same academy
 * for a decade. A twelve-year-old and an eighteen-year-old size each other up
 * very differently than two sixteen-year-olds do. This is all pre-Games, so it
 * runs once at generation and gives the alliance layer something to work with
 * on day one instead of a wall of zeroes.
 */
export function seedBackstoryRelationships(tributes: Tribute[], rng: RNG) {
    const spread = (base: number, range: number) => base + rng.nextInt(-range, range);

    for (let i = 0; i < tributes.length; i++) {
        for (let j = i + 1; j < tributes.length; j++) {
            const a = tributes[i];
            const b = tributes[j];
            let value = 0;

            if (a.district === b.district) {
                // Home is home, even when only one of you is coming back.
                value += spread(RELATIONSHIPS.districtPartnerBase, RELATIONSHIPS.districtPartnerSpread);
            } else if (a.isCareer && b.isCareer) {
                // Academy classmates, with the edge of knowing one of them wins.
                value += spread(RELATIONSHIPS.careerPackBase, RELATIONSHIPS.careerPackSpread);
                value -= RELATIONSHIPS.careerRivalPenalty;
            }

            if (a.archetype === b.archetype) value += RELATIONSHIPS.archetypeKinship;
            if (ARCHETYPES[a.archetype].treachery > 0.2 && ARCHETYPES[b.archetype].caution > 0.2) {
                value -= RELATIONSHIPS.archetypeKinship;
            }

            const ageGap = Math.abs(a.age - b.age);
            value += ageGap <= 1 ? RELATIONSHIPS.ageAffinity : -Math.min(RELATIONSHIPS.ageAffinity, ageGap);

            // A protector cannot look at a twelve-year-old and feel nothing.
            const younger = a.age < b.age ? a : b;
            const older = a.age < b.age ? b : a;
            if (younger.age <= 13 && ARCHETYPES[older.archetype].allianceAffinity > 0.15) {
                adjustRel(older, younger.id, RELATIONSHIPS.ageAffinity * 2);
            }

            if (value !== 0) {
                adjustRel(a, b.id, value);
                adjustRel(b, a.id, value);
            }

            // Being the crowd's darling costs you with the other tributes.
            if (a.fanFavourite && !b.fanFavourite) adjustRel(b, a.id, -RELATIONSHIPS.fanFavouriteEnvy);
            if (b.fanFavourite && !a.fanFavourite) adjustRel(a, b.id, -RELATIONSHIPS.fanFavouriteEnvy);
        }
    }
}

const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.split(`{${k}}`).join(v), template);

/**
 * Death fallout: a cannon is never just the victim's problem.
 *
 * Anyone who cared about the dead tribute takes a sanity hit scaled to the
 * bond, turns on the killer, and may swear vengeance outright. Anyone who
 * hated them exhales. The crowd notices when a favourite is put down. The old
 * code did exactly one of these things, for exactly one trait.
 */
export function propagateDeathFallout(ctx: SimContext, victim: Tribute, killer?: Tribute) {
    const state = ctx.state;
    const mourners: Tribute[] = [];

    state.tributes.forEach(other => {
        if (other.status !== 'alive' || other.id === victim.id) return;
        const bond = getRel(other, victim.id);
        const wereAllied = other.allianceId !== undefined && other.allianceId === victim.allianceId;
        const isLover = areLovers(other, victim);

        // §11.3: the district partner is the person from home. Their death is
        // a bigger loss than an ally's, whatever the raw number said.
        const isPartner = other.district === victim.district
            && (bond >= DEBTS.partnerGriefBond || other.districtBondNoted === true);

        if (bond >= RELATIONSHIPS.grievableBond || wereAllied || isLover || isPartner) {
            const intensity = isLover ? 1 : Math.min(1, (bond + (wereAllied ? 25 : 0)) / 100);
            const sanityHit = (isLover
                ? RELATIONSHIPS.griefSanityMax + 15
                : RELATIONSHIPS.griefSanityMin + intensity * (RELATIONSHIPS.griefSanityMax - RELATIONSHIPS.griefSanityMin))
                + (isPartner ? DEBTS.partnerGriefSanity : 0);

            // Some people have buried someone before, and some people have not.
            other.vitals.sanity -= sanityHit * Math.max(0, 1 - traitMod(other, 'griefResist'));
            addExcitement(other, Math.round(10 + intensity * 25));
            // The crowd rewards visible grief.
            other.sponsorTrust += Math.round(intensity * 6);
            ensureMemory(other).mourned.push(victim.id);
            mourners.push(other);
            // §3.4: grief is also a bad day in the arena, not only a slow gauge.
            rattle(other, HUNTING.rattledPerGrief);
            clampTribute(other);

            if (killer && killer.id !== other.id) {
                const hatred = RELATIONSHIPS.griefTowardKiller * intensity
                    + (wereAllied ? RELATIONSHIPS.griefTowardKillerAllyBonus : 0);
                const now = adjustRel(other, killer.id, -hatred);
                // Vengeance is sworn on the event, not on the arithmetic.
                //
                // Gating it on the relationship dropping past -55 meant it
                // almost never fired: most tributes sit near zero with most
                // others, decay pulls everything back toward zero every cycle,
                // and the grief hit had to cover the whole gap in one go. So
                // the single best beat in the epilogue — "you went after X for
                // what happened to Y" — appeared in well under 1% of runs.
                // Watching your ally or someone you loved die is sufficient on
                // its own; the relationship hit is the consequence, not the gate.
                const personal = wereAllied || isLover || isPartner || bond >= RELATIONSHIPS.vengeanceBond;
                if (personal || now <= RELATIONSHIPS.vengeanceThreshold) {
                    swearVengeance(other, killer.id);
                    forceStance(other, 'Aggressive');
                    ctx.logEvent(
                        fill(ctx.pickText(VENGEANCE_TEXTS), { mourner: other.name, victim: victim.name, killer: killer.name }),
                        [other.id, killer.id, victim.id],
                        { important: true, category: 'sanity' }
                    );
                }
            }

            // Watching someone you were actually close to die does not wash off.
            if ((isLover || wereAllied) && intensity > 0.5) earnTrait(ctx, other, 'Haunted');

            if (isLover) {
                ctx.logEvent(
                    `TRAGEDY: ${other.name} hears the cannon and knows. Their star-crossed lover ${victim.name} is gone, and something in them goes with it.`,
                    [other.id, victim.id],
                    { important: true, category: 'romance' }
                );
            } else if (isPartner) {
                ctx.logEvent(
                    killer && killer.id !== other.id
                        ? `${other.name} hears the cannon for ${victim.name} — the other half of District ${other.district} — and something colder than grief settles in behind the tears. Their whole district watched that happen.`
                        : `${other.name} is the last of District ${other.district} now. ${victim.name} rode the same train, ate at the same table, and there is nobody left in the arena who knew home.`,
                    killer && killer.id !== other.id ? [other.id, victim.id, killer.id] : [other.id, victim.id],
                    { important: true, category: 'sanity' }
                );
            } else if (intensity > 0.45) {
                ctx.logEvent(
                    fill(ctx.pickText(GRIEF_TEXTS), { mourner: other.name, victim: victim.name, zone: other.zone }),
                    [other.id, victim.id],
                    { important: true, category: 'sanity' }
                );
            }
        } else if (ensureMemory(other).vengeance.includes(victim.id)) {
            // §4.3: the fourth kind of loss. Grief for an ally, a district
            // partner and a lover were all separate beats; a rival's death was
            // relief or nothing — which misses the more interesting reading. A
            // tribute who organised their whole run around one person, and
            // then hears somebody else's cannon fire it, has lost the thing
            // that was holding them together.
            noteRivalDeath(ctx, other, victim, killer);
        } else if (bond <= RELATIONSHIPS.enemyBond) {
            other.vitals.sanity += RELATIONSHIPS.reliefSanity;
            clampTribute(other);
            if (ctx.rng.chance(0.4)) {
                ctx.logEvent(
                    fill(ctx.pickText(RELIEF_TEXTS), { tribute: other.name, victim: victim.name, zone: other.zone }),
                    [other.id, victim.id],
                    { category: 'survival' }
                );
            }
        }
    });

    // §4.1: a kill is a résumé line. Everyone standing where it happened
    // rates the killer higher as a fighter, whatever it does to their regard.
    if (killer) {
        state.tributes.forEach(w => {
            if (w.status !== 'alive' || w.id === killer.id) return;
            if (w.zone === killer.zone) adjustRespect(w, killer.id, RESPECT.witnessKill);
        });
    }

    // §4.9: shared grief. Two people who both loved the victim, standing in
    // the same place, bond over it — free content off existing state.
    for (let i = 0; i < mourners.length; i++) {
        for (let j = i + 1; j < mourners.length; j++) {
            const a = mourners[i], b = mourners[j];
            if (a.zone !== b.zone) continue;
            adjustMutual(state, a, b, RELATIONSHIPS.sharedGriefBond);
            ctx.logEvent(
                `${a.name} and ${b.name} both knew ${victim.name}. Neither says much about it, but something settles between them that was not there before.`,
                [a.id, b.id, victim.id],
                { category: 'alliance' }
            );
        }
    }

    // Sponsor reaction: putting down a crowd favourite is not a free action.
    if (killer && (victim.fanFavourite || victim.sponsorTrust > 75)) {
        killer.sponsorTrust -= 12;
        addExcitement(killer, 25);
        clampTribute(killer);
        ctx.logEvent(
            `The Capitol audience goes quiet. ${victim.name} was a favourite, and ${killer.name} just took them off the board.`,
            [killer.id, victim.id],
            { important: true, category: 'sponsor' }
        );
    }
}

/**
 * Betrayal fallout: the knife itself moves the numbers, whether
 * or not the fight that follows resolves in a draw.
 */
export function applyBetrayalFallout(ctx: SimContext, betrayer: Tribute, victim: Tribute, witnesses: Tribute[]) {
    adjustRel(victim, betrayer.id, -RELATIONSHIPS.betrayalDirectPenalty);
    adjustRel(betrayer, victim.id, -RELATIONSHIPS.betrayalDirectPenalty / 2);

    const victimMem = ensureMemory(victim);
    victimMem.timesBetrayed += 1;
    if (!victimMem.betrayedBy.includes(betrayer.id)) victimMem.betrayedBy.push(betrayer.id);
    swearVengeance(victim, betrayer.id);

    victim.vitals.sanity -= 15;
    earnTrait(ctx, victim, 'Marked');
    addExcitement(betrayer, 30);
    // The Capitol loves the drama and distrusts the man.
    betrayer.sponsorTrust -= 8;
    clampTribute(victim);
    clampTribute(betrayer);

    witnesses.forEach(w => {
        if (w.id === betrayer.id || w.id === victim.id) return;
        adjustRel(w, betrayer.id, -RELATIONSHIPS.betrayalWitnessPenalty);
        const mem = ensureMemory(w);
        if (!mem.betrayedBy.includes(betrayer.id)) mem.betrayedBy.push(betrayer.id);
        // §4.2: watching someone get knifed makes you watch the knife.
        raiseSuspicion(w, betrayer.id, SUSPICION.perWitnessedBetrayal);
        // Watching an ally get knifed poisons the room — but only the part of
        // the room the witness has actually been in. The old blanket sweep hit
        // every living tribute (~500 relationship writes per betrayal) and
        // saturated the whole graph against its clamp; distrust of a stranger
        // you have never met is not a relationship, it is a mood.
        livingIds(ctx).forEach(id => {
            if (id === betrayer.id || id === w.id) return;
            if (!Number.isFinite(cyclesSinceContact(ctx.state, w, id))) return;
            adjustRel(w, id, -RELATIONSHIPS.betrayedDistrustPenalty / 3);
        });
    });

    // A tribute who has been sold out once stops trusting the room — the people
    // actually still in it that they have actually dealt with, at any rate.
    livingIds(ctx).forEach(id => {
        if (id === betrayer.id || id === victim.id) return;
        if (!Number.isFinite(cyclesSinceContact(ctx.state, victim, id))) return;
        adjustRel(victim, id, -RELATIONSHIPS.betrayedDistrustPenalty / 2);
    });
}

/**
 * Trust erosion inside a standing alliance. Rations run short, the
 * field thins, and everyone starts doing arithmetic about who is left.
 */
export function decayAllianceTrust(state: GameState) {
    const alive = state.tributes.filter(t => t.status === 'alive');
    const lateGame = alive.length <= RELATIONSHIPS.lateGameAliveCount;
    const rate = lateGame ? RELATIONSHIPS.lateGameTrustDecay : RELATIONSHIPS.trustDecayPerCycle;

    alive.forEach(t => {
        if (!t.allianceId) return;
        const record = state.alliances?.[t.allianceId];
        alive.forEach(other => {
            if (other.id === t.id || other.allianceId !== t.allianceId) return;
            // Star-crossed lovers are the one bond the endgame cannot erode.
            const bonded = areLovers(t, other);
            if (bonded) return;
            const paranoia = t.traits.includes('Paranoid') ? 1.8 : 1;
            // §4.6: doubt is not uniform. The leader's authority slows it;
            // a member who is off out of sight of the camp draws it faster.
            let factor = 1;
            if (record?.leaderId === other.id) factor *= RELATIONSHIPS.leaderDecayFactor;
            if (record?.campZone && other.zone !== record.campZone && t.zone === record.campZone) {
                factor *= RELATIONSHIPS.absentDecayFactor;
            }
            adjustRel(t, other.id, -rate * paranoia * factor);
        });
    });
}

/** Baseline sponsor trust drifts back toward the tribute's reputation. */
export function driftReputation(t: Tribute, rate: number) {
    const target = t.reputation ?? GENERATION.baseSponsorTrust;
    if (t.sponsorTrust > target) t.sponsorTrust = Math.max(target, t.sponsorTrust - rate);
    else if (t.sponsorTrust < target) t.sponsorTrust = Math.min(target, t.sponsorTrust + rate);
}
