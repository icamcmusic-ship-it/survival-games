import { Stance, Tribute } from '../models/types';
import { ARCHETYPES } from '../data/archetypes';
import { STANCE, STEALTH, VITALS } from '../data/balance';
import { SimContext } from './context';
import { ensureMemory } from './memory';
import { getRel } from './relationships';

/**
 * Threat assessment: who else is standing here, and can I take them?
 * Returns the ratio of hostile power to the tribute's own, allies included.
 */
export function assessZone(t: Tribute, occupants: Tribute[]) {
    const power = (o: Tribute) => o.attributes.strength + o.attributes.agility
        + (o.inventory.some(i => i.type === 'weapon') ? 4 : 0) + o.health / 25;

    let hostile = 0;
    let friendly = 0;
    occupants.forEach(o => {
        if (o.id === t.id) return;
        const allied = t.allianceId !== undefined && t.allianceId === o.allianceId;
        const friend = allied || getRel(t, o.id) > 25;
        if (friend) friendly += power(o);
        else hostile += power(o);
    });

    const own = power(t) + friendly;
    // Someone who can move through a zone unseen is genuinely less cornered by
    // the people standing in it.
    const discount = 1 - Math.min(STEALTH.maxThreatDiscount, t.attributes.stealth * STEALTH.threatDiscountPerPoint);
    return { ratio: own > 0 ? (hostile / own) * discount : 0, hostile, friendly };
}

/**
 * Stance selection with hysteresis.
 *
 * Stance is scored — including who else is in the zone — and a challenger has
 * to clearly beat the incumbent to take over. Without the hold, a tribute
 * hovering near a health threshold flips between two stances on alternate
 * cycles forever.
 */
export function updateStance(ctx: SimContext, t: Tribute, occupants: Tribute[]) {
    const arch = ARCHETYPES[t.archetype];
    const hasWeapon = t.inventory.some(i => i.type === 'weapon');
    const { ratio } = assessZone(t, occupants);
    const wounded = t.injuries.bleeding || t.injuries.infected || t.injuries.poisoned;

    const scores: Record<Stance, number> = { Aggressive: 0, Defensive: 1, Evasive: 0 };

    scores.Aggressive += arch.aggression * 3;
    scores.Aggressive += hasWeapon ? 1.2 : -1.2;
    scores.Aggressive += (t.health - STANCE.aggressiveHealth) / 30;
    if (t.isCareer) scores.Aggressive += 0.8;
    if (t.traits.includes('Bloodthirsty')) scores.Aggressive += 1;
    if (t.traits.includes('Pacifist')) scores.Aggressive -= 1.5;
    if (ensureMemory(t).vengeance.length > 0) scores.Aggressive += 1.5;
    if (ratio > 0 && ratio < STANCE.dominantRatio) scores.Aggressive += 1.2;

    scores.Evasive += arch.caution * 3;
    scores.Evasive += (STANCE.evasiveHealth - t.health) / 25;
    if (wounded) scores.Evasive += 1;
    if (!hasWeapon) scores.Evasive += 0.6;
    if (ratio > STANCE.outmatchedRatio) scores.Evasive += 1.6;
    if (arch.caution > 0.2 && t.health < STANCE.cautiousEvasiveHealth) scores.Evasive += 1;
    if (ctx.state.config.enableSanity && t.vitals.sanity < VITALS.breakdownThreshold) scores.Evasive += 0.8;
    // Someone who is genuinely good at disappearing reaches for it sooner —
    // but only slightly, or the whole cast goes to ground and nothing happens.
    scores.Evasive += (t.attributes.stealth - 5) * 0.06;

    scores.Defensive += 0.5 - Math.abs(arch.aggression) - Math.abs(arch.caution);
    if (t.allianceId) scores.Defensive += 0.5;

    // A genuine emergency overrides the hold: nobody stands their ground bleeding out.
    const emergency = t.health < STANCE.evasiveHealth * 0.6 || ratio > STANCE.outmatchedRatio * 1.6;

    const ranked = (Object.entries(scores) as Array<[Stance, number]>).sort((a, b) => b[1] - a[1]);
    const [bestStance, bestScore] = ranked[0];

    if (bestStance === t.stance) {
        t.stanceHeld += 1;
        return;
    }
    if (!emergency && t.stanceHeld < STANCE.minHold) {
        t.stanceHeld += 1;
        return;
    }
    if (!emergency && bestScore < scores[t.stance] + STANCE.switchMargin) {
        t.stanceHeld += 1;
        return;
    }

    t.stance = bestStance;
    t.stanceHeld = 0;
}
