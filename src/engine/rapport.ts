import { Tribute } from '../models/types';
import { RELATIONSHIPS, RESPECT, RIVALRY } from '../data/balance';
import { SimContext, getAlive } from './context';
import { adjustMutual, adjustRel, getRel, adjustRespect, respectOf } from './relationships';
import { cycleOf, ensureMemory, rivalRecord } from './memory';
import { addFear, fearOf } from './fear';

/**
 * §4.3: the three things the relationship layer could not do.
 *
 *   inference       only the two participants in a scene ever updated their
 *                   model of each other. A tribute who stands in a clearing and
 *                   watches X drag Y out of a fire learns nothing about the X-Y
 *                   bond, which is the single most useful thing anybody in an
 *                   arena can learn by looking.
 *   reconciliation  `rivals` recorded escalation — fights, wounds taken, times
 *                   fled — and had no path down. Two tributes who fought twice
 *                   and then survived a mutt attack together were stuck as
 *                   enemies by arithmetic that only ever went one way.
 *   respect         written in four places and read in two. Professional esteem
 *                   independent of liking is a genuinely good idea; it should
 *                   decide who you go after last and whose warning you believe,
 *                   not only who gets recruited.
 */

/** How strongly `t` believes `a` and `b` are bound to each other. */
export function perceivedBond(t: Tribute, aId: string, bId: string): number {
    return ensureMemory(t).perceivedBonds?.[`${aId}|${bId}`] ?? 0;
}

function notePerceived(t: Tribute, aId: string, bId: string, delta: number) {
    const mem = ensureMemory(t);
    mem.perceivedBonds = mem.perceivedBonds ?? {};
    const key = `${aId}|${bId}`;
    const next = Math.max(-RELATIONSHIPS.perceivedBondMax,
        Math.min(RELATIONSHIPS.perceivedBondMax, perceivedBond(t, aId, bId) + delta));
    mem.perceivedBonds[key] = Math.round(next);
    mem.perceivedBonds[`${bId}|${aId}`] = Math.round(next);
}

/**
 * §4.3: everyone standing there updates their model of the pair.
 *
 * Called from the paths where one tribute visibly does something for another —
 * standing by them in a fight, patching them up, handing over supplies they
 * needed themselves. The participants already record it as a debt; this is what
 * the *audience in the zone* takes away, which is a different and more
 * dangerous piece of information: it tells them who is worth threatening to
 * move somebody else.
 */
export function witnessKindness(ctx: SimContext, actor: Tribute, beneficiary: Tribute, weight = 1) {
    getAlive(ctx.state).forEach(w => {
        if (w.id === actor.id || w.id === beneficiary.id) return;
        if (w.zone !== actor.zone) return;
        notePerceived(w, actor.id, beneficiary.id, RELATIONSHIPS.perceivedBondPerScene * weight);
        // Competence witnessed is competence rated, whether or not you like
        // the person — this is exactly what `respects` is for.
        adjustRespect(w, actor.id, RESPECT.witnessCompetence * weight);
    });
}

/**
 * §3.3: proficiency is visible.
 *
 * Watching somebody dress a wound properly, read weather, or set a snare that
 * actually holds tells you something no attribute sheet in the arena can. It
 * raises respect, which is now a real currency.
 */
export function witnessCompetence(ctx: SimContext, actor: Tribute, weight = 1) {
    getAlive(ctx.state).forEach(w => {
        if (w.id === actor.id || w.zone !== actor.zone) return;
        adjustRespect(w, actor.id, RESPECT.witnessCompetence * weight);
    });
}

/**
 * §4.3: the way down.
 *
 * Two people who fought, and then stood in the same place while the arena tried
 * to kill them both, are not the same two people. Rivalry cools with time and
 * cools much faster with shared survival — the fight count decays rather than
 * being erased, so the history stays true and stops being destiny.
 */
export function reconcileRivals(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    const cycle = cycleOf(ctx.state);
    alive.forEach(t => {
        const rivals = t.memory?.rivals;
        if (!rivals) return;
        Object.entries(rivals).forEach(([otherId, record]) => {
            if (record.fights <= 0) return;
            const other = alive.find(o => o.id === otherId);
            const quiet = cycle - record.lastFightCycle;
            if (quiet < RIVALRY.coolingCycles) return;

            // Simply not having fought for a while takes the edge off.
            let steps = RIVALRY.coolingPerWindow;
            // Standing in the same place while something else tried to kill
            // them is worth far more than time.
            const sharedDanger = other && other.zone === t.zone && other.status === 'alive'
                && (t.health < RIVALRY.sharedDangerHealth || other.health < RIVALRY.sharedDangerHealth);
            if (sharedDanger) steps += RIVALRY.coolingSharedDanger;

            record.fights = Math.max(0, record.fights - steps);
            record.lastFightCycle = cycle;
            if (other) {
                addFear(other, t.id, -RIVALRY.coolingFear);
                addFear(t, other.id, -RIVALRY.coolingFear);
            }

            if (sharedDanger && record.fights <= 0 && other) {
                adjustMutual(ctx.state, t, other, RIVALRY.reconcileRegard);
                // Respect survives the reconciliation even when the liking does
                // not — you do not forget what they were like across a clearing.
                adjustRespect(t, other.id, RESPECT.reconcile);
                adjustRespect(other, t.id, RESPECT.reconcile);
                ctx.logEvent(
                    `${t.name} and ${other.name} have tried to kill each other before. Tonight they are simply two people `
                    + 'in the same bad place, and neither of them raises a hand. Nobody calls it peace. It is nearer to it than anything else in here.',
                    [t.id, other.id],
                    { important: true, category: 'alliance' }
                );
            }
        });
    });
}

/**
 * §4.3: how much `t` would rather not be the one to finish `other`.
 *
 * Respect is not liking. A tribute can loathe somebody and still leave them for
 * last, because the person they are most afraid of losing to is the person they
 * rate. Consumed by the hunting and betrayal target weightings.
 */
export function targetReluctance(t: Tribute, otherId: string): number {
    const rated = Math.max(0, respectOf(t, otherId));
    return 1 - Math.min(RESPECT.targetReluctanceMax, rated / RESPECT.targetReluctanceDivisor);
}

/**
 * §4.3: whether `t` believes what `other` just told them.
 *
 * A warning from somebody you rate is information; the same warning from
 * somebody you have written off is noise. Liking barely enters into it, which
 * is precisely why respect had to be its own number.
 */
export function believes(t: Tribute, other: Tribute): boolean {
    const rated = respectOf(t, other.id);
    // Inside a group the default is belief: you act on your own scout's report
    // unless you have actively written them off. Outside one, a stranger's
    // warning has to be earned — which is the read respect exists for.
    if (t.allianceId !== undefined && t.allianceId === other.allianceId) {
        return rated > RESPECT.dismissedThreshold;
    }
    const scared = fearOf(t, other.id) > 0;
    return rated >= RESPECT.credibilityThreshold
        || (scared && rated >= 0)
        || getRel(t, other.id) >= RELATIONSHIPS.grievableBond;
}

/**
 * §4.3: grief for somebody you had sworn to kill.
 *
 * The one shape of loss the fallout path had no branch for. Grief for an ally,
 * a district partner and a lover were all distinct beats; a rival's death was
 * either "relief" or nothing, which misses the more interesting truth — a
 * tribute who has organised their whole run around one person and then hears
 * that person's cannon fired by somebody else has lost the thing that was
 * holding them together.
 */
export function noteRivalDeath(ctx: SimContext, mourner: Tribute, victim: Tribute, killer?: Tribute) {
    const sworn = ensureMemory(mourner).vengeance.includes(victim.id);
    const record = mourner.memory?.rivals?.[victim.id];
    if (!sworn && (record?.fights ?? 0) < RIVALRY.grievableFights) return;
    if (killer?.id === mourner.id) return;

    mourner.vitals.sanity = Math.max(0, mourner.vitals.sanity - RIVALRY.stolenKillSanity);
    ensureMemory(mourner).vengeance = ensureMemory(mourner).vengeance.filter(id => id !== victim.id);
    if (killer) adjustRel(mourner, killer.id, -RIVALRY.stolenKillRegard);
    ctx.logEvent(
        sworn
            ? `${mourner.name} had promised themselves ${victim.name}. The cannon goes and it was not them, and what is left `
              + `is not relief — it is a person standing in a clearing with nothing to do next.`
            : `${mourner.name} and ${victim.name} had fought more than once, and something like an understanding had grown out of it. `
              + `${mourner.name} does not celebrate the cannon.`,
        killer ? [mourner.id, victim.id, killer.id] : [mourner.id, victim.id],
        { important: true, category: 'sanity' }
    );
}
