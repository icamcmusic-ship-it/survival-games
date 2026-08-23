import { Tribute } from '../models/types';
import { MOTIVES, RESOLVE } from '../data/balance';
import { SimContext, getAlive } from './context';
import { ensureMemory, cyclesSinceContact } from './memory';
import { clampTribute } from './vitals';
import { checkDeath } from './combat';
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
        if (allies.length > 0) delta += RESOLVE.allyBonus;
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

        // Traits: some people are simply harder to put out.
        delta += traitMod(t, 'resolveDrift');

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
    getAlive(ctx.state).forEach(t => {
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

        if ((carried || canFind) && resolveOf(t) <= RESOLVE.nightlockThreshold && ctx.rng.chance(RESOLVE.nightlockChance)) {
            if (carried) t.inventory = t.inventory.filter(i => i !== carried);
            t.health = 0;
            clampTribute(t);
            ctx.logEvent(
                carried
                    ? `${t.name} sits down in ${t.zone}, takes out the nightlock, and does not hurry over it. `
                        + `The Capitol cuts away, and then has to cut back, because there is nothing else to show.`
                    : `${t.name} stops walking in ${t.zone} and starts looking at the undergrowth instead — not for food. `
                        + `They find what they are looking for. The Capitol cuts away, and then has to cut back, because there is nothing else to show.`,
                [t.id],
                { important: true, category: 'death' }
            );
            checkDeath(ctx, t, 'Took the nightlock rather than keep playing');
            return;
        }

        // T-6: walking into the border. Once the arena has started closing,
        // the wall is always there, humming, and a tribute who is finished
        // does not have to find nightlock — they only have to keep walking.
        if (ctx.state.escalationDay !== undefined
            && resolveOf(t) <= RESOLVE.nightlockThreshold
            && ctx.rng.chance(RESOLVE.borderWalkChance)) {
            t.health = 0;
            clampTribute(t);
            ctx.logEvent(
                `${t.name} walks toward the edge of the arena in ${t.zone} at an ordinary pace, like someone going home. `
                + `The commentators fall over each other explaining it as disorientation. It is not disorientation.`,
                [t.id],
                { important: true, category: 'death' }
            );
            checkDeath(ctx, t, 'Walked into the arena border rather than keep playing');
            return;
        }

        // T-6: surrender. With a hostile standing right there, a broken
        // tribute can simply put the weapon down — not a tactic, an
        // abdication. Whether the other party takes the opening is up to the
        // encounter that follows.
        const hostile = getAlive(ctx.state).find(o =>
            o.id !== t.id && o.zone === t.zone && (o.allianceId === undefined || o.allianceId !== t.allianceId));
        const armed = t.inventory.some(i => i.type === 'weapon');
        if (hostile && armed && ctx.rng.chance(RESOLVE.surrenderChance)) {
            t.inventory = t.inventory.filter(i => i.type !== 'weapon');
            t.stance = 'Defensive';
            t.stanceHeld = 0;
            ctx.logEvent(
                `${t.name} looks at ${hostile.name} across ${t.zone}, and puts everything they are carrying that can cut on the ground between them. Whatever happens next, they are done doing it armed.`,
                [t.id, hostile.id],
                { important: true, category: 'sanity' }
            );
            return;
        }

        if (!isEvasiveStance(t.stance) && ctx.rng.chance(0.5)) {
            // Walking into the open. Not a death wish exactly — an end to
            // caring which way it goes.
            t.stance = 'Aggressive';
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
        t.stance = 'Defensive';
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
