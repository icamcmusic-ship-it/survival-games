import { Arena, Tribute, ZoneLevel } from '../models/types';
import { SimContext } from './context';
import { UNIVERSAL_DEATHS, VERTICALITY } from '../data/balance';
import { getZone, zoneFeatures } from './map';
import { profOf } from './proficiency';
import { isActive } from './downed';
import { canSpend, noteAttempt, noteRefusal } from './actions';
import { spend } from './actionBudget';
import { applyDamage, checkDeath } from './combat';
import { injure, openWound } from './wounds';
import { BLEEDING } from '../data/balance';
import { clampTribute } from './vitals';

/**
 * §5.1: up and down inside one zone.
 *
 * Elevation existed only as a property of a whole zone (`elevation: true`) and
 * movement existed only between zones, so there was no way to express a shaft
 * you descend within one named place, a gallery above a gallery, or a
 * rooftop over the street it overlooks. Every tribute in a zone was at
 * precisely the same point in space, which is why "the Ember Shaft" and "the
 * Cathedral" had to be modelled as separate zones with an edge between them
 * even though they are one place with a height to it.
 *
 * This is built as shared engine surface rather than as a hack for the two
 * arenas that need it most. A zone opts in with `ZoneFeatures.vertical`, and
 * from then on:
 *
 *   - a tribute in it stands at `upper` or `lower`;
 *   - two tributes on different levels of the same zone are not in the same
 *     place — they do not meet, and neither of them is cover for the other;
 *   - changing level is a real act with a real cost, and going down fast is
 *     how people get hurt.
 *
 * Everything outside a vertical zone is unaffected: `levelOf` returns
 * undefined, `samePlace` degrades to a zone comparison, and the thirty-eight
 * arenas that declare nothing keep behaving exactly as they did.
 */

export function isVertical(arena: Arena, zoneName: string): boolean {
    const zone = getZone(arena, zoneName);
    return zone !== undefined && zoneFeatures(zone).vertical === true;
}

/** Where a tribute is standing inside their zone, or undefined if it is flat. */
export function levelOf(arena: Arena, t: Tribute): ZoneLevel | undefined {
    if (!isVertical(arena, t.zone)) return undefined;
    return t.zoneLevel ?? 'upper';
}

/**
 * Whether two tributes are close enough to interact at all.
 *
 * The single predicate every "who else is here" query goes through. In a flat
 * zone it is a zone comparison, which is what every call site meant already;
 * in a vertical one it also asks whether they are on the same level, which is
 * the whole point of the feature.
 */
export function samePlace(arena: Arena, a: Tribute, b: Tribute): boolean {
    if (a.zone !== b.zone) return false;
    if (!isVertical(arena, a.zone)) return true;
    return (a.zoneLevel ?? 'upper') === (b.zoneLevel ?? 'upper');
}

/** Everyone sharing a tribute's exact position, alive, excluding themselves. */
export function othersHere(ctx: SimContext, t: Tribute): Tribute[] {
    return ctx.state.tributes.filter(o =>
        o.status === 'alive' && o.id !== t.id && samePlace(ctx.state.arena, t, o));
}

/**
 * Entering a zone resets a tribute to its top. You arrive at the rim of a
 * shaft, not at the bottom of it; getting to the bottom is a separate act.
 */
export function enterVerticalZone(arena: Arena, t: Tribute) {
    t.zoneLevel = isVertical(arena, t.zone) ? 'upper' : undefined;
}

/**
 * Per-cycle: whoever wants to change level does, and pays for it. Called
 * after movement has resolved, so a tribute who has just arrived is at the
 * top of their new zone and can choose to go down next cycle rather than
 * arriving at the bottom for free.
 */
export function tickVerticality(ctx: SimContext) {
    const arena = ctx.state.arena;
    ctx.state.tributes.forEach(t => {
        /*
         * AUDIT-10 F08: `status === 'alive'` is not "can climb".
         *
         * A downed tribute keeps `status === 'alive'` on purpose — every roster
         * filter in the engine counts them — so this check let a zero-health
         * unconscious tribute move from the lower level to the upper one under
         * their own power, with zero hours available, and log a successful
         * climb. `isActive` is the predicate that means able to act.
         */
        if (!isActive(t)) return;
        if (!isVertical(arena, t.zone)) { t.zoneLevel = undefined; return; }
        const level: ZoneLevel = t.zoneLevel ?? 'upper';
        /*
         * F15: and changing level is a real action, so it costs real hours.
         * Fatigue was charged below and the budget was not, which is the same
         * split that let a rescuer with no hours complete a haul.
         */


        // Down is where the good ground is, and where the danger is. A tribute
        // is drawn down by need and pushed up by fear, which is the whole
        // decision the mechanic exists to create.
        const wantsDown = level === 'upper'
            && (t.vitals.hunger > VERTICALITY.descendHunger || t.vitals.thirst > VERTICALITY.descendThirst
                || othersHere(ctx, t).length > 0);
        const wantsUp = level === 'lower' && t.health < VERTICALITY.retreatHealth;

        if (!wantsDown && !wantsUp) return;
        /*
         * AUDIT-10 batch 2: the affordability check sits here, after the want.
         *
         * Placed before it, this counted every tribute merely *standing* in a
         * vertical zone with no hours as a refused level change — ten a run,
         * none of which was an intent — and the audit's whole argument for
         * this counter is that it distinguishes a rare chain from an
         * unreachable one. A refusal is only meaningful against an intent.
         */
        const affordable = canSpend(t, VERTICALITY.levelHours);
        if (!affordable.ok) { noteRefusal(ctx.state, 'change-level', affordable.why); return; }
        if (!ctx.rng.chance(VERTICALITY.changeLevelChance)) return;

        const going: ZoneLevel = wantsDown ? 'lower' : 'upper';
        /*
         * AUDIT-10 batch 2: re-validated at the moment of resolution, not only
         * at intent. The rolls between the two can change the answer — a fall
         * on somebody else's action does not reach this tribute, but the
         * ordering of this pass against the rescue pass does.
         */
        if (!isActive(t)) { noteRefusal(ctx.state, 'change-level', 'incapable'); return; }
        if (!spend(t, VERTICALITY.levelHours)) { noteRefusal(ctx.state, 'change-level', 'no-time'); return; }
        noteAttempt(ctx.state, 'change-level');
        t.vitals.fatigue += going === 'lower' ? VERTICALITY.descendFatigue : VERTICALITY.climbFatigue;
        t.levelsStood = t.levelsStood ?? [level];
        if (!t.levelsStood.includes(going)) t.levelsStood.push(going);
        if (!(t.verticalZonesStood ?? []).includes(t.zone)) {
            t.verticalZonesStood = [...(t.verticalZonesStood ?? []), t.zone];
        }

        /*
         * AUDIT-6 §7.2: going *up* badly.
         *
         * "Going up is slow and safe" was true of everybody equally, which
         * meant `climbing` — a whole proficiency, with a trait head start
         * (`Climber`) feeding it — could not affect the one act it is named
         * for. A tribute who has never climbed anything, on a face they have no
         * business on, is in more danger going up than a practised one is going
         * down. Distinct from the fall below: that is a descent that got away
         * from somebody, this is a climb somebody could not make.
         */
        if (going === 'upper'
            && profOf(t, 'climbing') < UNIVERSAL_DEATHS.climbFailProficiency
            && ctx.rng.chance(UNIVERSAL_DEATHS.climbFailChance)) {
            applyDamage(ctx, t, UNIVERSAL_DEATHS.climbFailDamage, { cause: `Could not make the climb in ${t.zone}`, kind: 'arena', code: 'fall' });
            openWound(t, BLEEDING.combatSeverity);
            ctx.logEvent(
                `${t.name} gets most of the way up ${t.zone} and runs out of the thing that was getting them up it. `
                + 'The last part is not a climb, it is a drop.',
                [t.id], { important: true, zone: t.zone, category: 'hazard' },
            );
            clampTribute(t);
            checkDeath(ctx, t, `Could not make the climb in ${t.zone}`);
            if (!isActive(t)) return;
        }

        // Going down fast is how people get hurt; going up is slow and safe.
        // §7: the descent fall was a flat roll — a tribute who had not slept in
        // four days climbed down exactly as well as one who was fresh. It is
        // fatigue that puts people off ladders.
        const spent = Math.max(0, t.vitals.fatigue - VERTICALITY.fallFatiguePivot) / 100;
        const fallChance = VERTICALITY.descendFallChance * (1 + spent * VERTICALITY.fallFatigueWeight);
        if (going === 'lower' && ctx.rng.chance(fallChance)) {
            // §7.1: a fall from height as a real ending rather than a graze.
            // The engine already knew the tribute was on the upper level, how
            // tired they were and that going down is the dangerous direction;
            // all that was missing was a magnitude that could finish somebody.
            const sheer = t.vitals.fatigue >= VERTICALITY.sheerFallFatigue
                && ctx.rng.chance(VERTICALITY.sheerFallShare);
            const cause = sheer ? `Fell from the top of ${t.zone}` : `Fell inside ${t.zone}`;
            applyDamage(
                ctx, t,
                Math.round((sheer ? VERTICALITY.sheerFallDamage : VERTICALITY.fallDamage) * (1 + spent)),
                { cause, kind: 'arena', code: 'fall' }
            );
            openWound(t, BLEEDING.hazardSeverity);
            injure(t, 'legs');
            if (sheer) injure(t, 'torso');
            ctx.logEvent(
                sheer
                    ? `${t.name} has not slept in days and their hands know it before they do. They go off the ledge inside ${t.zone} `
                        + 'without a sound, and the sound only arrives afterwards.'
                    : `${t.name} takes the fast way down inside ${t.zone} and finds out, halfway, that it is the fast way for a reason.`,
                [t.id],
                { important: true, category: 'hazard' }
            );
            clampTribute(t);
            checkDeath(ctx, t, cause);
            // F08: a fall can *down* somebody mid-action as well as kill them,
            // and somebody who is on the ground unconscious does not finish the
            // descent they started. Capability is rechecked after the damage,
            // not only before it.
            if (!isActive(t)) return;
        }

        t.zoneLevel = going;
        clampTribute(t);
        ctx.logEvent(
            going === 'lower'
                ? `${t.name} goes down a level inside ${t.zone}. Whatever is up there, it is not with them any more; whatever is down here, it is.`
                : `${t.name} climbs back up out of the bottom of ${t.zone}, slowly, and does not look down while doing it.`,
            [t.id],
            { category: 'travel' }
        );
    });
}
