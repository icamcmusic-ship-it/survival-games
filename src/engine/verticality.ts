import { Arena, Tribute, ZoneLevel } from '../models/types';
import { SimContext } from './context';
import { VERTICALITY } from '../data/balance';
import { getZone, zoneFeatures } from './map';
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
        if (t.status !== 'alive') return;
        if (!isVertical(arena, t.zone)) { t.zoneLevel = undefined; return; }
        const level: ZoneLevel = t.zoneLevel ?? 'upper';

        // Down is where the good ground is, and where the danger is. A tribute
        // is drawn down by need and pushed up by fear, which is the whole
        // decision the mechanic exists to create.
        const wantsDown = level === 'upper'
            && (t.vitals.hunger > VERTICALITY.descendHunger || t.vitals.thirst > VERTICALITY.descendThirst
                || othersHere(ctx, t).length > 0);
        const wantsUp = level === 'lower' && t.health < VERTICALITY.retreatHealth;

        if (!wantsDown && !wantsUp) return;
        if (!ctx.rng.chance(VERTICALITY.changeLevelChance)) return;

        const going: ZoneLevel = wantsDown ? 'lower' : 'upper';
        t.vitals.fatigue += going === 'lower' ? VERTICALITY.descendFatigue : VERTICALITY.climbFatigue;

        // Going down fast is how people get hurt; going up is slow and safe.
        if (going === 'lower' && ctx.rng.chance(VERTICALITY.descendFallChance)) {
            const cause = `Fell inside ${t.zone}`;
            applyDamage(ctx, t, VERTICALITY.fallDamage, { cause, kind: 'arena' });
            openWound(t, BLEEDING.hazardSeverity);
            injure(t, 'legs');
            ctx.logEvent(
                `${t.name} takes the fast way down inside ${t.zone} and finds out, halfway, that it is the fast way for a reason.`,
                [t.id],
                { important: true, category: 'hazard' }
            );
            clampTribute(t);
            checkDeath(ctx, t, cause);
            if (t.status !== 'alive') return;
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
