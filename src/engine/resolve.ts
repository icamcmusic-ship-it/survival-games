import { Tribute, attr } from '../models/types';
import { forceStance } from './stance';
import { MOTIVES, RESOLVE, SOCIAL_AXES } from '../data/balance';
import { SimContext, getAlive } from './context';
import { agedResolveDecay } from './physique';
import { ensureMemory, cyclesSinceContact } from './memory';
import { rhetoricOf } from './composure';
import { inFinalTwoGrace, selfInflictedDeath } from './combat';
import { getZone } from './map';
import { traitMod } from '../data/traits';
import { getRel } from './relationships';
import { isEvasiveStance } from '../data/stances';

/**
 * Resolve: the will to keep going, as distinct from sanity.
 *
 * Sanity models coming apart — hallucinations, dropped kit, blown cover. It is
 * about perception. Resolve is about *intent*: whether a tribute still wants to
 * win. Nothing in the simulation modelled that, so no tribute could ever make
 * the choice the source material's most famous ending is built on. Everyone
 * fought to the last drop of health because health was the only thing that
 * could end them.
 *
 * Resolve is eroded by grief, by isolation, by being hunted, by watching the
 * field close in; it is restored by allies, by sponsors remembering you, by
 * winning something. At the bottom, a tribute stops playing — they stop
 * running, they walk into the open, and some of them take the nightlock.
 *
 * It is deliberately slow. A stat that swings in a cycle is a mood; this is
 * meant to be the arc of a run.
 */

export function resolveOf(t: Tribute): number {
    return t.resolve ?? RESOLVE.start;
}

export function adjustResolve(t: Tribute, amount: number) {
    t.resolve = Math.max(0, Math.min(RESOLVE.max, resolveOf(t) + amount));
}

/** True once a tribute has stopped trying to win. */
export function hasBroken(t: Tribute): boolean {
    return resolveOf(t) <= RESOLVE.brokenThreshold;
}

/**
 * Per-cycle drift. Everything here is a reason a person in an arena either
 * keeps going or stops, and each is already tracked by some other system —
 * this is the layer that reads them together.
 */
export function tickResolve(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    const fieldSize = alive.length;

    alive.forEach(t => {
        const mem = ensureMemory(t);
        let delta = RESOLVE.driftPerCycle;

        // Somebody to keep going for, or somebody to avenge. Both work.
        const allies = alive.filter(o => o.id !== t.id && o.allianceId !== undefined && o.allianceId === t.allianceId);
        if (allies.length > 0) {
            delta += RESOLVE.allyBonus;
            // §3.2: and the other half of the split. Warmth is who you want
            // beside you; rhetoric is who can still make the case for
            // tomorrow when you have stopped being able to. Resolve is about
            // *intent*, so it is rhetoric that reaches it — an ally who is
            // merely pleasant company does nothing here, and does everything
            // to sanity.
            const argued = allies.reduce((best, o) => Math.max(best, rhetoricOf(o)), 0);
            delta += Math.max(0, argued - SOCIAL_AXES.attributeMidpoint) * SOCIAL_AXES.allyArgumentPerRhetoric;
        }
        // §3.10: private motive. A tribute holding onto someone at home is
        // harder to put out; one whose whole reason is their district
        // partner burns hotter for vengeance when it comes to that.
        if (mem.vengeance.length > 0) {
            delta += RESOLVE.vengeanceBonus
                * (t.motive === 'partner' ? MOTIVES.avengeVengeanceMultiplier : 1);
        }
        if (t.motive === 'family') delta += MOTIVES.familyResolveBonus;
        // Being remembered by the Capitol is, grimly, a reason to keep standing.
        if (t.excitementRating > RESOLVE.watchedExcitement) delta += RESOLVE.watchedBonus;

        // Grief, in the cycles right after it lands.
        const freshLoss = mem.mourned.some(id => cyclesSinceContact(ctx.state, t, id) <= RESOLVE.griefWindow);
        if (freshLoss) delta -= RESOLVE.griefPenalty;

        // Alone, hurt, and nobody has spoken to you in days.
        //
        // "Nobody is warm to you", not "everybody dislikes you". Requiring a
        // non-positive relationship with every living tribute at once meant
        // one lingering positive residue — a district partner, a decayed
        // acquaintance — kept the penalty switched off for a tribute who
        // plainly has no one, so it almost never fired.
        const lonely = allies.length === 0
            && !alive.some(o => o.id !== t.id && getRel(t, o.id) >= RESOLVE.isolationWarmthThreshold);
        if (lonely) delta -= RESOLVE.isolationPenalty;
        if (t.health < RESOLVE.woundedHealth) delta -= RESOLVE.woundedPenalty;
        if (t.vitals.hunger > RESOLVE.deprivationThreshold || t.vitals.thirst > RESOLVE.deprivationThreshold) {
            delta -= RESOLVE.deprivationPenalty;
        }
        // The arithmetic closing in. Late in a run, most people can see it.
        if (fieldSize <= RESOLVE.endgameFieldSize) delta -= RESOLVE.endgamePenalty;

        // Winning something — anything — is the strongest restorative there is.
        if ((t.momentum ?? 0) > 0) delta += RESOLVE.momentumBonus;

        // §3.3: the old half of the age curve. Four more reapings' worth of
        // knowing exactly what this is, and it costs — but only under
        // sustained tension. A quiet run does not wear an older tribute down
        // any faster than a younger one; carrying it does.
        delta -= agedResolveDecay(t.age, t.tensionStreak ?? 0);

        // Traits: some people are simply harder to put out.
        delta += traitMod(t, 'resolveDrift');
        // §3.1: resolve is per-run state; willpower is the disposition under
        // it. A negative day costs a strong-willed tribute less and a fragile
        // one more, and a positive day is worth slightly more to them — which
        // is the difference between a trait and a mood.
        const grit = (attr(t, 'willpower') - 5) * RESOLVE.willpowerPerPoint;
        delta += delta < 0 ? Math.min(-delta, grit) : grit * RESOLVE.willpowerUpsideShare;

        adjustResolve(t, delta);
    });
}

/**
 * What a broken tribute does about it.
 *
 * Three outcomes, in descending order of how much the tribute is still
 * participating: they stop hiding, they stop fighting, or they stop. The last
 * is rare and gated on actually carrying nightlock — the arena does not hand
 * out endings, it only makes them available.
 */
export function resolveBreakdowns(ctx: SimContext) {
    const alive = getAlive(ctx.state);
    /**
     * §11 (requests, second pass): a finalist does not get to opt out.
     *
     * The first pass at this stopped the *arena* finishing the second-to-last
     * tribute, and the ending promptly moved one door along: of 58 zero-kill
     * victors measured across 400 runs afterwards, 34 were the runner-up
     * taking the nightlock or walking into the border. That is the same
     * complaint again — the last fight never happens — and it is worse than
     * the attrition version, because a tribute choosing to stop is a scene the
     * Capitol would not have broadcast.
     *
     * So both self-inflicted endings are held back for exactly as long as the
     * arena's own attrition is: the final-two grace window. Outside it, and at
     * any larger field size, nothing changes — the nightlock is the source
     * material's most famous ending and it stays reachable. What a broken
     * finalist does instead is what the rest of this function was always for:
     * they stop hiding, they put the weapon down, they lose the token. Every
     * one of those puts them in front of the other finalist rather than out of
     * the Games behind their back.
     */
    const finalTwoHolds = inFinalTwoGrace(ctx, alive.length);
    /*
     * REQUEST (run length): the sole survivor has already won.
     *
     * A wipeout probe over 600 runs found that **nine of twenty-three
     * no-victor runs ended with the last tribute alive killing themselves** —
     * seven took the nightlock, two walked into the border. `applyDamage`'s
     * finalist protection could not stop it, because that guard only pulls
     * *arena* damage and a resolve breakdown is a decision rather than a hit.
     *
     * It is also wrong on its own terms. Both endings below are written as a
     * tribute deciding they are done playing, and there is nobody left to play
     * against: the cannon that would sound is their own victory cannon. The
     * two self-inflicted endings stay reachable for everybody else, including
     * the final two (where `finalTwoHolds` already gates them during the
     * grace window), because "I will not be the one who kills you" is the beat
     * they exist for.
     *
     * The rest of the breakdown ladder — surrender, dropping the token,
     * abandoning a stance — still applies to the last survivor. Winning is
     * allowed to have cost them something.
     */
    const soleSurvivor = alive.length <= 1;
    alive.forEach(t => {
        if (!hasBroken(t)) return;
        if (!ctx.rng.chance(RESOLVE.breakdownChance)) return;

        // Taking it is a decision, not a malfunction: it needs the tribute to
        // be genuinely finished, to have the means, and even then it is the
        // least likely of the three.
        //
        // The means are not only what they are carrying. A tribute who has run
        // all the way out of reasons and is standing somewhere things grow can
        // go looking — which is the whole point of nightlock existing in the
        // source material, and the reason this ending has to be reachable
        // rather than gated behind a 1-in-34 loot roll.
        const carried = t.inventory.find(i => i.id === 'nightlock');
        const zone = getZone(ctx.state.arena, t.zone);
        const canFind = !carried
            && (zone?.resources ?? 0) > RESOLVE.nightlockForageResources
            && ctx.rng.chance(RESOLVE.nightlockFindChance);

        if (!finalTwoHolds && !soleSurvivor && (carried || canFind) && resolveOf(t) <= RESOLVE.nightlockThreshold && ctx.rng.chance(RESOLVE.nightlockChance)) {
            if (carried) t.inventory = t.inventory.filter(i => i !== carried);
            ctx.logEvent(
                carried
                    ? `${t.name} sits down in ${t.zone}, takes out the nightlock, and does not hurry over it. `
                        + `The Capitol cuts away, and then has to cut back, because there is nothing else to show.`
                    : `${t.name} stops walking in ${t.zone} and starts looking at the undergrowth instead — not for food. `
                        + `They find what they are looking for. The Capitol cuts away, and then has to cut back, because there is nothing else to show.`,
                [t.id],
                { important: true, category: 'death' }
            );
            selfInflictedDeath(ctx, t, 'Took the nightlock rather than keep playing', true);
            return;
        }

        // T-6: walking into the border. Once the arena has started closing,
        // the wall is always there, humming, and a tribute who is finished
        // does not have to find nightlock — they only have to keep walking.
        if (!finalTwoHolds
            && !soleSurvivor
            && ctx.state.escalationDay !== undefined
            && resolveOf(t) <= RESOLVE.nightlockThreshold
            && ctx.rng.chance(RESOLVE.borderWalkChance)) {
            ctx.logEvent(
                `${t.name} walks toward the edge of the arena in ${t.zone} at an ordinary pace, like someone going home. `
                + `The commentators fall over each other explaining it as disorientation. It is not disorientation.`,
                [t.id],
                { important: true, category: 'death' }
            );
            selfInflictedDeath(ctx, t, 'Walked into the arena border rather than keep playing', true);
            return;
        }

        // T-6: surrender. With a hostile standing right there, a broken
        // tribute can simply put the weapon down — not a tactic, an
        // abdication. Whether the other party takes the opening is up to the
        // encounter that follows.
        const hostile = getAlive(ctx.state).find(o =>
            o.id !== t.id && o.zone === t.zone && (o.allianceId === undefined || o.allianceId !== t.allianceId));
        const armed = t.inventory.some(i => i.type === 'weapon');
        // The churn brake can refuse the posture change, and a surrender that
        // leaves the tribute standing there in a hunting stance is not one. It
        // is asked *before* the weapons go on the ground, so a refused beat
        // costs nothing rather than disarming somebody mid-sentence.
        if (hostile && armed && ctx.rng.chance(RESOLVE.surrenderChance) && forceStance(t, 'Defensive', 'surrendered')) {
            t.inventory = t.inventory.filter(i => i.type !== 'weapon');
            t.stanceHeld = 0;
            ctx.logEvent(
                `${t.name} looks at ${hostile.name} across ${t.zone}, and puts everything they are carrying that can cut on the ground between them. Whatever happens next, they are done doing it armed.`,
                [t.id, hostile.id],
                { important: true, category: 'sanity' }
            );
            return;
        }

        // §12: the token goes first. Before a broken tribute changes how they
        // are playing, they can stop carrying the thing they came in with —
        // the smallest and most legible surrender available to them, and the
        // one that makes keeping it all the way to a crown worth anything.
        if (t.token && ctx.rng.chance(RESOLVE.tokenLostOnBreakdown)) {
            const token = t.token;
            t.token = undefined;
            ctx.logEvent(
                `${t.name} takes out ${token} in ${t.zone}, looks at it for a while, and leaves it on the ground. `
                + `Whoever it was supposed to be a promise to is not watching any more, and they have decided they cannot carry it and this both.`,
                [t.id],
                { important: true, category: 'sanity' }
            );
        }

        // Walking into the open. Not a death wish exactly — an end to caring
        // which way it goes. The whole beat *is* the change of posture, so a
        // refusal means it does not happen rather than that it is narrated.
        if (!isEvasiveStance(t.stance) && ctx.rng.chance(0.5) && forceStance(t, 'Aggressive', 'resolve broke the other way')) {
            t.stanceHeld = 0;
            adjustResolve(t, RESOLVE.breakdownRebound);
            ctx.logEvent(
                `${t.name} stops taking cover in ${t.zone}. Whatever is out there can come and find them.`,
                [t.id],
                { important: true, category: 'sanity' }
            );
            return;
        }

        // Simply stopping: they sit down and let the arena come to them.
        //
        // Unlike walking into the open, this one is not cathartic and does not
        // buy any will back — it is the deeper failure, and it compounds. That
        // asymmetry is what makes the bottom of the scale reachable at all: a
        // rebound on every breakdown put a floor under resolve well above the
        // point where a tribute could ever make the last choice.
        if (!forceStance(t, 'Defensive', 'resolve collapsed')) return;
        t.stanceHeld = 0;
        t.objective = { kind: 'hold', zone: t.zone, expires: (ctx.state.cycle ?? 0) + 2 };
        adjustResolve(t, -RESOLVE.sittingDownPenalty);
        ctx.logEvent(
            `${t.name} sits down in ${t.zone} and stops making plans. They are not hiding and they are not hunting.`,
            [t.id],
            { important: true, category: 'sanity' }
        );
    });
}
