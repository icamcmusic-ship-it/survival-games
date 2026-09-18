import { GameState, Item, Tribute } from '../models/types';
import { forceStance } from './stance';
import { noteRivalDeath } from './rapport';
import { RNG } from '../utils/rng';
import { BETRAYAL, DEBTS, RELATIONSHIPS, GENERATION, HUNTING, RESPECT, SUSPICION , EARNED_TRAIT_RULES } from '../data/balance';
import { ARCHETYPES } from '../data/archetypes';
import { SimContext } from './context';
import { carryCapacity, giveItem } from './items';
import { clampTribute } from './vitals';
import { cyclesSinceContact, ensureMemory, hasStoodBy, raiseSuspicion, rattle, swearVengeance, noteContact } from './memory';
import { areLovers } from './alliance';
import { GRIEF_TEXTS, VENGEANCE_TEXTS, RELIEF_TEXTS, BETRAYAL_WITNESS_TEXTS } from '../data/flavorText';
import { resolveLoansOnDeath } from './debts';
import { addExcitement } from './audience';
import { traitMod } from '../data/traits';
import { earnTrait } from './earnedTraits';
import { loseSanity } from './sanityBands';

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
    // §4.5: affection buys trust only up to a point. Past `trustFromRegardCap`
    // the two axes come apart, which is what makes "someone you love and do
    // not trust" a state the engine can hold: a bond can run to +100 regard
    // and still leave trust sitting at the cap until the person has actually
    // done something — stood by them, carried their debt — to earn the rest.
    // Negative regard passes through undamped: distrust was never the half of
    // this that was broken.
    let trust = Math.min(getRel(a, b.id), RELATIONSHIPS.trustFromRegardCap);
    if (hasStoodBy(a, b.id)) trust += RELATIONSHIPS.trustStoodByBonus;
    const mem = a.memory;
    if (mem?.betrayedBy?.includes(b.id)) trust -= RELATIONSHIPS.trustBetrayedPenalty;
    trust -= (mem?.suspicion?.[b.id] ?? 0) * RELATIONSHIPS.trustSuspicionWeight;
    // A creditor is safe company: they have already proven what they'll risk.
    if ((b.debts?.[a.id] ?? 0) > 0) trust += RELATIONSHIPS.trustCreditorBonus;
    // §4.2 (audit): plus whatever history has built or broken on its own.
    trust += a.trusts?.[b.id] ?? 0;
    return Math.max(RELATIONSHIPS.min, Math.min(RELATIONSHIPS.max, trust));
}

/** §4.2 (audit): the stored trust history alone, without the derivation. */
export function trustHistoryOf(a: Tribute, bId: string): number {
    return a.trusts?.[bId] ?? 0;
}

/**
 * §4.2 (audit): move stored trust. Positive deltas are capped lower than
 * negative ones: trust is earned slowly and lost at once.
 */
export function adjustTrust(a: Tribute, bId: string, delta: number): void {
    // AUDIT-6 §12.2 `trustGain`: how fast this tribute's trust moves at all.
    // Applied to the upward direction only — a trait that makes somebody quick
    // to trust should not also make them quick to stop.
    const scaled = delta > 0 ? delta * Math.max(0, 1 + traitMod(a, 'trustGain')) : delta;
    const next = Math.max(-RELATIONSHIPS.trustHistoryMax, Math.min(RELATIONSHIPS.trustHistoryMax, trustHistoryOf(a, bId) + scaled));
    a.trusts = { ...(a.trusts ?? {}), [bId]: Math.round(next * 10) / 10 };
}

/**
 * §4.2 (audit): trust history heals toward zero at its own rate — slower
 * than regard decays, and slower on the way up from a betrayal than on the
 * way down from a kept promise, which is the asymmetry the derived formula
 * could never express.
 */
export function decayTrust(state: GameState) {
    state.tributes.forEach(t => {
        if (t.status !== 'alive' || !t.trusts) return;
        Object.keys(t.trusts).forEach(otherId => {
            const value = t.trusts![otherId];
            if (value === 0) { delete t.trusts![otherId]; return; }
            const rate = value < 0 ? RELATIONSHIPS.trustHealPerCycle : RELATIONSHIPS.trustFadePerCycle;
            const next = value > 0 ? Math.max(0, value - rate) : Math.min(0, value + rate);
            if (next === 0) delete t.trusts![otherId];
            else t.trusts![otherId] = Math.round(next * 10) / 10;
        });
        if (Object.keys(t.trusts).length === 0) delete t.trusts;
    });
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

            // §4.5: shared hardship, which is not the same as shared standing.
            // Two people who have been signing for tesserae since they were
            // twelve know something about each other on sight, and it crosses
            // district lines — which is exactly what the existing three ties
            // could not do for an outer-district pair.
            const slips = Math.min(a.tesserae ?? 0, b.tesserae ?? 0);
            if (a.district !== b.district && slips >= RELATIONSHIPS.hardshipTesseraeFloor) {
                const depth = Math.min(RELATIONSHIPS.hardshipMaxBonus,
                    (slips - RELATIONSHIPS.hardshipTesseraeFloor) * RELATIONSHIPS.hardshipPerExtraSlip);
                value += spread(RELATIONSHIPS.hardshipBase + depth, RELATIONSHIPS.hardshipSpread);
            }

            if (a.archetype === b.archetype) value += RELATIONSHIPS.archetypeKinship;
            if (ARCHETYPES[a.archetype].treachery > RELATIONSHIPS.warinessTreachery
                && ARCHETYPES[b.archetype].caution > RELATIONSHIPS.warinessCaution) {
                value -= RELATIONSHIPS.archetypeKinship;
            }

            const ageGap = Math.abs(a.age - b.age);
            value += ageGap <= 1 ? RELATIONSHIPS.ageAffinity : -Math.min(RELATIONSHIPS.ageAffinity, ageGap);

            // A protector cannot look at a twelve-year-old and feel nothing.
            const younger = a.age < b.age ? a : b;
            const older = a.age < b.age ? b : a;
            if (younger.age <= RELATIONSHIPS.wardAge && ARCHETYPES[older.archetype].allianceAffinity > RELATIONSHIPS.wardAffinity) {
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
/**
 * §4: what a death leaves to whoever was closest.
 *
 * Grief already propagated; the estate did not. A tribute whose only ally
 * died standing next to them walked away from the body with nothing, and the
 * dead tribute's grudges — the people they had sworn to get — died with them,
 * which quietly meant that killing somebody's friend was safer than killing
 * them. The nearest survivor who cared takes both: what is on the body, and
 * who the body was owed by.
 */
function inheritFrom(ctx: SimContext, victim: Tribute, killer?: Tribute) {
    const heir = ctx.state.tributes
        .filter(o => o.status === 'alive' && o.id !== victim.id && o.zone === victim.zone)
        .filter(o => getRel(o, victim.id) >= RELATIONSHIPS.inheritBond
            || (o.allianceId !== undefined && o.allianceId === victim.allianceId))
        .sort((a, b) => getRel(b, victim.id) - getRel(a, victim.id))[0];
    if (!heir || heir.id === killer?.id) return;

    // Their fight, now. Everybody the dead tribute had sworn to get.
    const oaths = ensureMemory(victim).vengeance
        .filter(id => id !== heir.id && ctx.state.tributes.some(o => o.id === id && o.status === 'alive'));
    oaths.forEach(id => swearVengeance(heir, id));

    // The kit is picked up where it fell, if there is room for it.
    const estate = victim.inventory.filter(i => i.capacity === undefined);
    // Tracked by identity, not by name. Item names are not unique — two loaves,
    // two knives, a quality prefix shared across instances — so filtering the
    // body by name deleted every same-named item once the heir ran out of room,
    // destroying the rest of the estate instead of leaving it to be scavenged,
    // and could take the backpack this filter exists to exclude with it.
    const lifted = new Set<Item>();
    estate.forEach(item => {
        if (heir.inventory.length >= carryCapacity(heir)) return;
        giveItem(heir, item);
        lifted.add(item);
    });
    const taken = [...lifted].map(i => i.name);
    victim.inventory = victim.inventory.filter(i => !lifted.has(i));

    if (taken.length === 0 && oaths.length === 0) return;
    ctx.logEvent(
        taken.length > 0 && oaths.length > 0
            ? `${heir.name} takes what ${victim.name} was carrying, and the list of people ${victim.name} was not going to forgive. Both of them are heavier than they look.`
            : taken.length > 0
                ? `${heir.name} goes through what ${victim.name} left and takes ${taken.join(', ')}. Nobody who saw it thinks less of them for it.`
                : `Whatever ${victim.name} had sworn, ${heir.name} heard it often enough to carry it on for them.`,
        [heir.id, victim.id],
        { category: 'alliance', zone: victim.zone }
    );
}

export function propagateDeathFallout(ctx: SimContext, victim: Tribute, killer?: Tribute) {
    const state = ctx.state;
    const mourners: Tribute[] = [];
    inheritFrom(ctx, victim, killer);
    // §4.2: every loan the dead tribute was on either side of closes here,
    // with a line. Both of those endings used to be a silent delete — or, for
    // a borrower who died, not even that.
    resolveLoansOnDeath(ctx, victim);

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
            loseSanity(other, sanityHit * Math.max(0, 1 - traitMod(other, 'griefResist')));
            addExcitement(other, Math.round(10 + intensity * 25));
            // The crowd rewards visible grief.
            other.sponsorTrust += Math.round(intensity * RELATIONSHIPS.griefTrustPerIntensity);
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
                // §4.3: ...but where you were standing when it happened is
                // part of what makes it an oath. Ten sworn a run, 5% of them
                // ever paid by the person who swore, is not a vow, it is a
                // reflex — and most of those were sworn over a name in the
                // sky. A mourner who watched it happen swears; one who heard
                // the cannon from two zones away mostly grieves instead.
                const sworn = other.zone === victim.zone || isLover || isPartner
                    || ctx.rng.chance(RELATIONSHIPS.vengeanceDistantChance);
                if (sworn && (personal || now <= RELATIONSHIPS.vengeanceThreshold)) {
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
            //
            // All three clauses are load-bearing, and until the teardown
            // ordering in `killTribute` was fixed none of them could be tested:
            // `wereAllied` and `isLover` were both permanently false here, so
            // this granted nothing in 120 runs. With the fields arriving
            // intact, the bare `isLover || wereAllied` gate turned out to be
            // far too wide — it took Haunted straight to the second most common
            // trait in the game at 702 grants per 120 runs, and Hollow, six
            // cycles downstream of it, to 352.
            //
            // *Watching*: the same standard vengeance is held to twenty lines
            // above. You were in the zone — or it was your lover, whose death
            // reaches them wherever they are standing.
            //
            // *Close*: read off the bond directly rather than off `intensity`,
            // because intensity saturates. It is `min(1, (bond + 25) / 100)`
            // for an ally, so no threshold below 1 can ask for more than a bond
            // of 75 and a threshold of 1 asks for something unreachable.
            //
            // A post-grief sanity clause was tried here and removed: measured
            // over 120 runs it moved the count by under 5% at every threshold
            // from 15 to 45, because the grief hit immediately above this line
            // takes almost every mourner under all of them. It would have been
            // a knob that reads as a gate and is not one.
            const witnessed = other.zone === victim.zone;
            if ((isLover || (wereAllied && witnessed && bond >= RELATIONSHIPS.hauntedBond))
                && intensity > RELATIONSHIPS.hauntedIntensity) {
                earnTrait(ctx, other, 'Haunted');
            }

            if (isLover) {
                ctx.logEvent(
                    `TRAGEDY: ${other.name} hears the cannon and knows. Their star-crossed lover ${victim.name} is gone, and something in them goes with it.`,
                    [other.id, victim.id],
                    { important: true, category: 'romance' }
                );
            } else if (isPartner) {
                ctx.logEvent(
                    killer && killer.id !== other.id
                        // §12/§22: the killer is in `tributesInvolved` and was
                        // never in the sentence, which on the most-drawn line in
                        // the simulation meant 261 lines a sweep that named two
                        // of the three people they were about.
                        ? `${other.name} hears the cannon for ${victim.name}, the other tribute from District ${other.district}. ${killer!.name} killed them.`
                        : `${other.name} is the last tribute from District ${other.district}. ${victim.name} is dead.`,
                    killer && killer.id !== other.id ? [other.id, victim.id, killer.id] : [other.id, victim.id],
                    { important: true, category: 'sanity' }
                );
            } else if (intensity > RELATIONSHIPS.griefLineIntensity) {
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
            if (ctx.rng.chance(RELATIONSHIPS.reliefLineChance)) {
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
    if (killer && (victim.fanFavourite || victim.sponsorTrust > RELATIONSHIPS.favouriteTrust)) {
        killer.sponsorTrust -= RELATIONSHIPS.favouriteKillTrustCost;
        addExcitement(killer, RELATIONSHIPS.favouriteKillExcitement);
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
    // §4.2 (audit): the wound to trust is separate from the wound to regard,
    // and heals on its own clock.
    adjustTrust(victim, betrayer.id, -RELATIONSHIPS.trustBrokenPromise);

    // §3.4: the other side of the ledger. `timesBetrayed` counts what was done
    // to you; nothing counted what you did, which is what a Loyal tribute
    // wearing through into a Treacherous one turns on.
    betrayer.betrayalsCommitted = (betrayer.betrayalsCommitted ?? 0) + 1;

    const victimMem = ensureMemory(victim);
    victimMem.timesBetrayed += 1;
    if (!victimMem.betrayedBy.includes(betrayer.id)) victimMem.betrayedBy.push(betrayer.id);
    swearVengeance(victim, betrayer.id);

    loseSanity(victim, RELATIONSHIPS.betrayalSanityCost);
    earnTrait(ctx, victim, 'Marked');
    addExcitement(betrayer, RELATIONSHIPS.betrayalExcitement);
    // The Capitol loves the drama and distrusts the man.
    betrayer.sponsorTrust -= RELATIONSHIPS.betrayalTrustCost;
    clampTribute(victim);
    clampTribute(betrayer);

    witnesses.forEach(w => {
        if (w.id === betrayer.id || w.id === victim.id) return;
        adjustRel(w, betrayer.id, -RELATIONSHIPS.betrayalWitnessPenalty);
        const mem = ensureMemory(w);
        if (!mem.betrayedBy.includes(betrayer.id)) mem.betrayedBy.push(betrayer.id);
        // §4.2: watching someone get knifed makes you watch the knife.
        raiseSuspicion(w, betrayer.id, SUSPICION.perWitnessedBetrayal);
        /*
         * AUDIT-7 §4.1: and it costs the betrayer the witness's trust, which
         * is a different thing from watching them.
         *
         * The README names betrayal as one of the four things that move the
         * stored trust axis and it was the one never wired: `adjustTrust` had
         * three call sites, all of them promise-and-debt ceremonies. Suspicion
         * says "I think you will"; trust says "I know what you did". A group
         * that watches somebody knife an ally and goes on trusting them at the
         * same rate is not a group anybody was modelling.
         */
        adjustTrust(w, betrayer.id, -RELATIONSHIPS.trustWitnessedBetrayal);
        // Audit 5 §12.3: the second betrayal somebody watches changes them.
        w.betrayalsWitnessed = (w.betrayalsWitnessed ?? 0) + 1;
        if (w.betrayalsWitnessed >= EARNED_TRAIT_RULES.witnessBetrayals) earnTrait(ctx, w, 'Witness');
        // §4.1: ...and it is a thing that happened to them, too. This moved
        // three numbers and printed nothing, in the thinnest category in the
        // whole chronicle.
        if (ctx.rng.chance(BETRAYAL.witnessLineChance)) {
            ctx.logEvent(
                fill(ctx.pickText(BETRAYAL_WITNESS_TEXTS), {
                    witness: w.name, betrayer: betrayer.name, victim: victim.name, zone: w.zone,
                }),
                [w.id, betrayer.id, victim.id],
                { category: 'betrayal' }
            );
        }
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
 * §4 (audit): which axis a decision reads. The graph carries four and there
 * was no single place that said which one governs what, which is how a
 * function named for trust came to write regard.
 *
 *   regard    warmth. Grief, targeting, romance, the audience, and the
 *             decay below. `getRel`/`adjustRel`.
 *   respect   professional esteem. Who you believe, who you leave for
 *             last, who gets recruited. `respectOf`/`adjustRespect`.
 *   trust     whether their word holds. Alliance formation, recruitment,
 *             loans, truce renewal. `trustOf` (derived) over `trusts`
 *             (stored history, `adjustTrust`).
 *   suspicion per-ally doubt inside a group. Investigations, departures,
 *             the pre-emptive knife. `suspicionOf`/`raiseSuspicion`/
 *             `easeSuspicion` in memory.ts.
 *
 * The rule: a decision about *joining* reads trust, a decision about
 * *believing* reads respect, a decision about *hurting* reads regard, and a
 * decision about *leaving* reads suspicion.
 */

/**
 * Regard erosion inside a standing alliance. Rations run short, the
 * field thins, and everyone starts doing arithmetic about who is left.
 * (Renamed from `decayAllianceTrust`: it writes regard, and always did.)
 */
export function decayAllianceRegard(state: GameState) {
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
            // Through the trait hook, like everything else in the file. This
            // was a hardcoded 'Paranoid' string and a magic 1.8.
            const paranoia = 1 + traitMod(t, 'betrayalResist') * SUSPICION.accrualPerBetrayalResist;
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
