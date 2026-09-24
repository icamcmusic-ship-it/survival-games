import { Tribute } from '../models/types';
import { SimContext, getAlive } from './context';
import { HUNTING, STANCE_MODES } from '../data/balance';
import { resolveCombat } from './combat';
import { awareness, isNoticed } from './stealth';
import { getZone } from './map';
import { adjustRel } from './relationships';
import { addFear } from './fear';
import { giveItem } from './items';
import { rattle } from './memory';
import { allied } from './alliance';

/**
 * A1: the once-per-cycle beats that make a conditional stance a *state* rather
 * than a score modifier.
 *
 * Everything here happens after movement and traps and before the ordinary
 * encounter pass, so a shadow's conversion into an ambush and a desperate
 * tribute's raid on their own alliance both resolve before the cycle's
 * generic "who ran into whom" roll gets a chance to describe the same people
 * doing something else.
 */
export function runStanceBeats(ctx: SimContext) {
    getAlive(ctx.state).forEach(t => {
        if (t.status !== 'alive') return;
        if (t.stance === 'Shadowing') tickShadow(ctx, t);
        else if (t.stance === 'Desperate') tickDesperate(ctx, t);
        else if (t.stance === 'Scavenging') tickScavenge(ctx, t);
        else if (t.stance === 'Fortified') tickFortified(ctx, t);
    });
}

/**
 * Trailing someone one zone behind.
 *
 * The `unseenStreak` counter measured 359 across a 400-run soak and produced
 * nothing at all from it. Three consecutive cycles in which the quarry's
 * awareness fails to find their shadow converts into a free ambush — the
 * narrative payoff that number was always describing and never cashing.
 */
function tickShadow(ctx: SimContext, t: Tribute) {
    const trail = t.shadowing;
    if (!trail) return;
    const quarry = ctx.state.tributes.find(o => o.id === trail.targetId);
    if (!quarry || quarry.status !== 'alive') {
        t.shadowing = undefined;
        return;
    }

    const zone = getZone(ctx.state.arena, quarry.zone);
    const alliesPresent = ctx.state.tributes.filter(o =>
        o.status === 'alive' && o.id !== t.id && o.zone === t.zone && allied(o, t)).length;

    // Did they get away with it for another cycle?
    const spotted = t.zone === quarry.zone && isNoticed(ctx, t, quarry, zone, alliesPresent);
    if (spotted) {
        ctx.logEvent(
            `${quarry.name} turns at the wrong moment and finds ${t.name} closer than anyone should be. Whatever ${t.name} was building toward, it is gone.`,
            [t.id, quarry.id],
            { important: true, category: 'survival' }
        );
        addFear(quarry, t.id, STANCE_MODES.shadowing.spottedFear);
        rattle(t, HUNTING.rattledPerSpotted);
        t.shadowing = undefined;
        return;
    }

    trail.cycles += 1;
    if (trail.cycles < STANCE_MODES.shadowing.cyclesToAmbush) {
        ctx.logEvent(
            trail.cycles === 1
                ? `${t.name} picks up ${quarry.name}'s line out of ${quarry.zone} and settles in one turning behind them.`
                : `${t.name} is still there, one zone back. ${quarry.name} has now walked ${trail.cycles} cycles without once looking behind them.`,
            [t.id, quarry.id],
            { category: 'survival' }
        );
        return;
    }

    // Three cycles of being read without ever being seen. The opener is free.
    t.zone = quarry.zone;
    t.shadowing = undefined;
    ctx.logEvent(
        `${t.name} has been a zone behind ${quarry.name} for three straight cycles and ${quarry.name} never once checked. They close the last of it in ${quarry.zone} without a sound.`,
        [t.id, quarry.id],
        { important: true, category: 'combat', zone: quarry.zone }
    );
    // The free hit is modelled as a betrayal-shaped opener: `resolveCombat`
    // treats that as an ambush unconditionally, which is exactly the earned
    // outcome here without duplicating the ambush maths.
    resolveCombat(ctx, t, quarry, false, true);
}

/**
 * Past caring.
 *
 * `desperationFights` measured 15 across 400 runs — a coin flip that almost
 * never landed. As a stance it is a standing condition: they will take what
 * they need off somebody who trusted them, and the alliance will remember it.
 */
function tickDesperate(ctx: SimContext, t: Tribute) {
    if (!t.allianceId) return;
    if (!ctx.rng.chance(STANCE_MODES.desperate.robAllyChance)) return;

    const allies = ctx.state.tributes.filter(o =>
        o.status === 'alive' && o.id !== t.id
        && allied(o, t) && o.zone === t.zone
        && o.inventory.some(i => i.type === 'food' || i.type === 'water' || i.type === 'medical'));
    if (allies.length === 0) return;

    const victim = ctx.rng.pick(allies);
    const idx = victim.inventory.findIndex(i => i.type === 'food' || i.type === 'water' || i.type === 'medical');
    const taken = victim.inventory.splice(idx, 1)[0];
    giveItem(t, taken);

    ctx.logEvent(
        `${t.name} takes ${taken.name} out of ${victim.name}'s pack in ${t.zone} and does not pretend it was a mistake. Nobody in this alliance is going to forget that.`,
        [t.id, victim.id],
        { important: true, category: 'alliance' }
    );
    adjustRel(victim, t.id, -STANCE_MODES.desperate.victimRegard);
    adjustRel(t, victim.id, -STANCE_MODES.desperate.thiefRegard);
    addFear(victim, t.id, STANCE_MODES.desperate.victimFear);
    victim.memory.suspicion = victim.memory.suspicion ?? {};
    victim.memory.suspicion[t.id] = (victim.memory.suspicion[t.id] ?? 0) + STANCE_MODES.desperate.victimSuspicion;
}

/** Working over ground somebody else has already paid for. */
function tickScavenge(ctx: SimContext, t: Tribute) {
    const bodies = ctx.state.tributes.filter(o => o.status === 'dead' && o.zone === t.zone && o.inventory.length > 0);
    if (bodies.length === 0) return;
    if (!ctx.rng.chance(STANCE_MODES.scavenging.bodyStripChance)) return;

    const body = bodies[0];
    const spoils = body.inventory;
    body.inventory = [];
    const dropped = giveItem(t, ...spoils);
    // What will not fit stays on the body. The overflow used to be computed and
    // then thrown away — `body.inventory` was already emptied — so a scavenger
    // at capacity annihilated the rest of a corpse's pack instead of leaving it
    // for the next person through. Both the other looting sites conserve it.
    body.inventory = dropped;
    const taken = spoils.filter(i => !dropped.includes(i));
    t.corpsesLooted = (t.corpsesLooted ?? 0) + 1;
    ctx.logEvent(
        taken.length > 0
            ? `${t.name} works over what is left of ${body.name} in ${t.zone} and comes away with ${taken.map(i => i.name).join(', ')}. They do not look at the face.`
            : `${t.name} goes through ${body.name}'s things in ${t.zone} and finds nothing worth the carrying.`,
        [t.id],
        { important: taken.length > 0, category: 'loot' }
    );
}

/** Dug in. The beat is the preparation, and occasionally the reputation. */
function tickFortified(ctx: SimContext, t: Tribute) {
    // `>=`, with the counter consumed below, rather than an exact match: the
    // tenure counter can advance by more than one step in a cycle and an
    // equality test simply missed the beat when it did.
    const held = t.fortifiedCycles ?? 0;
    if (held < STANCE_MODES.fortified.holdCycles) return;
    if (t.fortifiedBeatShown) return;
    t.fortifiedBeatShown = true;
    ctx.logEvent(
        `${t.name} has not moved out of ${t.zone} in days, and it has stopped looking like somewhere they are hiding and started looking like somewhere they own.`,
        [t.id],
        { important: true, category: 'survival' }
    );
    // Everyone who can see the position files it away.
    getAlive(ctx.state).forEach(o => {
        if (o.id === t.id) return;
        if (awareness(o) < STANCE_MODES.shadowing.positionNoticeAwareness) return;
        addFear(o, t.id, STANCE_MODES.shadowing.positionFear);
    });
}

